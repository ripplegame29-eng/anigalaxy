/**
 * Сессии и проверка паролей — только для сервера.
 *
 * Зачем это вообще, раз был `src/lib/auth.ts`: там «входом» считалось наличие
 * ключа в localStorage, а пароль кодировался в base64. Так схема годилась
 * для демонстрации интерфейса и не годилась ни для чего, где важны права
 * доступа: значение в localStorage пользователь меняет сам, в том числе
 * `premiumUntil` и роль.
 *
 * Устройство:
 * - пароль проверяется argon2id (см. параметры в prisma/seed.ts)
 * - в cookie кладётся случайный токен, а в базе лежит только его sha256:
 *   утечка дампа таблицы сессий не даёт войти ни в один аккаунт
 * - cookie httpOnly: JS её не читает, поэтому XSS не крадёт сессию
 * - роль читается из базы по сессии, а не из тела запроса
 */

import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { hash, verify } from "@node-rs/argon2";
import { cookies } from "next/headers";

import { db } from "@/lib/db";
import { asRole, can, type Permission, type Role } from "@/lib/roles";

/* ------------------------------ Параметры ------------------------------- */

/**
 * argon2id, 19 МБ памяти, 2 прохода. Обоснование и одинаковые значения при
 * создании админа — в prisma/seed.ts: важно, чтобы параметры совпадали при
 * проверке и при хешировании, иначе один и тот же пароль будет давать
 * разные хэши и сгенерированные ранее аккаунты перестанут входить.
 */
const ARGON2 = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export const SESSION_COOKIE = "ag_session";

/** Срок жизни сессии по умолчанию — 30 дней */
const DEFAULT_TTL_MS = 30 * 86_400_000;

function sessionTtl(): number {
  const raw = Number(process.env.SESSION_TTL_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TTL_MS;
}

/* --------------------------- Пароли и токены ---------------------------- */

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2);
}

export function verifyPassword(digest: string, password: string): Promise<boolean> {
  try {
    return verify(digest, password);
  } catch {
    // Хэш повреждён или создан другими параметрами — это «пароль не подошёл»,
    // а не исключение наружу.
    return Promise.resolve(false);
  }
}

function newToken(): string {
  return randomBytes(32).toString("base64url");
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/* -------------------------------- Типы ---------------------------------- */

export interface SessionUser {
  id: string;
  nickname: string;
  email: string;
  role: Role;
  status: string;
  premiumUntil: number;
  displayName: string | null;
  avatarUrl: string | null;
  bannedUntil: number | null;
}

export interface ActiveSession {
  sessionId: string;
  user: SessionUser;
  expiresAt: number;
}

type UserRow = {
  id: string;
  nickname: string;
  email: string;
  role: string;
  status: string;
  premiumUntil: bigint;
  displayName: string | null;
  avatarUrl: string | null;
  bannedUntil: bigint | null;
};

function toSessionUser(row: UserRow): SessionUser {
  return {
    id: row.id,
    nickname: row.nickname,
    email: row.email,
    role: asRole(row.role),
    status: row.status,
    premiumUntil: Number(row.premiumUntil),
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    bannedUntil: row.bannedUntil === null ? null : Number(row.bannedUntil),
  };
}

/* ------------------------------- Сессии --------------------------------- */

export interface RequestMeta {
  ip?: string | null;
  userAgent?: string | null;
}

function requestMeta(headers?: Headers): RequestMeta {
  if (!headers) return {};
  return {
    ip: headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: headers.get("user-agent"),
  };
}

/**
 * Создаёт сессию и ставит cookie.
 *
 * Вызывать только из Server Action или Route Handler: Next.js не даёт менять
 * cookie во время рендера обычной страницы (и это правильно — рендер может
 * повториться).
 */
export async function createSession(
  userId: string,
  meta: RequestMeta = {},
): Promise<void> {
  const token = newToken();
  const now = Date.now();
  const ttl = sessionTtl();

  await db.session.create({
    data: {
      tokenHash: tokenHash(token),
      userId,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent?.slice(0, 500) ?? null,
      createdAt: now,
      expiresAt: now + ttl,
      lastUsedAt: now,
    },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    // Lax, а не Strict: Strict рвёт ссылку на сайт из стороннего источника
    // (например, из Telegram или почтового клиента) — пришлось бы логиниться
    // заново при каждом таком переходе.
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(ttl / 1000),
  });
}

/** Текущая сессия или null. Не бросает — вызывающий сам решает, что делать. */
export async function getSession(): Promise<ActiveSession | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { user: true },
  });

  if (!session) return null;

  const now = Date.now();

  if (Number(session.expiresAt) <= now) {
    // Протухшую удаляем сразу: иначе таблица сессий растёт мусором, и
    // на неё приходится полагаться при очистке.
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  // Забаненный пользователь не должен пользоваться старой сессией.
  if (session.user.status === "banned") {
    const until = session.user.bannedUntil;
    const active = until !== null && Number(until) > now;
    if (active) return null;
  }

  // Точное время последнего использования меняется на каждом запросе — это
  // лишняя запись в базу на каждый просмотр страницы. Обновляем не чаще
  // раза в 5 минут: для панели сессий точность до минут не нужна.
  if (now - Number(session.lastUsedAt) > 300_000) {
    void db.session
      .update({ where: { id: session.id }, data: { lastUsedAt: now } })
      .catch(() => undefined);
  }

  return {
    sessionId: session.id,
    user: toSessionUser(session.user),
    expiresAt: Number(session.expiresAt),
  };
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) {
    await db.session
      .delete({ where: { tokenHash: tokenHash(token) } })
      .catch(() => undefined);
  }

  store.delete(SESSION_COOKIE);
}

/**
 * Завершает все сессии пользователя, кроме текущей.
 * Вызывается при смене пароля: если пароль утек, взломщик не должен сохранить
 * себе доступ, пока жертва уже сменила пароль.
 */
export async function destroyOtherSessions(
  userId: string,
  keepSessionId?: string,
): Promise<number> {
  const result = await db.session.deleteMany({
    where: {
      userId,
      ...(keepSessionId ? { id: { not: keepSessionId } } : {}),
    },
  });
  return result.count;
}

/** Удаляет протухшие сессии. Вызывается кроном или при старте панели. */
export async function cleanupSessions(): Promise<number> {
  const result = await db.session.deleteMany({
    where: { expiresAt: { lt: BigInt(Date.now()) } },
  });
  return result.count;
}

/* ------------------------------ Проверки -------------------------------- */

export interface LoginResult {
  ok: boolean;
  error?: string;
  user?: SessionUser;
}

/**
 * Вход по никнейму или почте.
 *
 * Сообщения об ошибках намеренно одинаковые для «нет такого пользователя» и
 * «неверный пароль»: разные формулировки превращают форму входа в способ
 * перебрать существующие никнеймы.
 */
export async function login(
  identifier: string,
  password: string,
  meta: RequestMeta = {},
): Promise<LoginResult> {
  const id = identifier.trim().toLowerCase();
  if (!id || !password) {
    return { ok: false, error: "Введите логин и пароль" };
  }

  const user = await db.user.findFirst({
    where: {
      OR: [{ nickname: { equals: id } }, { email: { equals: id } }],
    },
  });

  // Считаем хэш даже когда пользователя нет — иначе по время ответа можно
  // отличить существующий никнейм от несуществующего (timing attack).
  const ok = await verifyPassword(
    user?.passwordHash ?? (await dummyHash()),
    password,
  );

  if (!user || !ok) {
    return { ok: false, error: "Неверный логин или пароль" };
  }

  if (user.status === "banned") {
    const until = user.bannedUntil;
    if (until === null || Number(until) > Date.now()) {
      return {
        ok: false,
        error:
          until === null
            ? "Аккаунт заблокирован"
            : `Аккаунт заблокирован до ${new Date(Number(until)).toLocaleDateString("ru-RU")}`,
      };
    }
  }

  await createSession(user.id, meta);
  return { ok: true, user: toSessionUser(user) };
}

/**
 * Хэш-болванка для выравнивания времени ответа: когда пользователя нет, мы всё
 * равно прогоняем проверку, иначе «неверный пароль» отвечает быстро, а
 * «нет такого пользователя» — медленно, и по задержке перебирают никнеймы.
 *
 * Считается один раз лениво и кэшируется: argon2 намеренно медленный (~100 мс),
 * и платить за это на каждой попытке входа незачем.
 */
let cachedDummyHash: Promise<string> | null = null;

function dummyHash(): Promise<string> {
  cachedDummyHash ??= hashPassword("ag-timing-equalizer-not-a-real-password");
  return cachedDummyHash;
}

export function metaFromHeaders(headers: Headers): RequestMeta {
  return requestMeta(headers);
}

/* ------------------------------ Права ---------------------------------- */

/** Может ли текущая сессия выполнять действие. Молчит, если сессии нет. */
export async function sessionCan(permission: Permission): Promise<boolean> {
  const session = await getSession();
  return session ? can(session.user.role, permission) : false;
}