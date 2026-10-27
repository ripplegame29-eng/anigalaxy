/**
 * Локальный «аккаунт» проекта.
 *
 * Бэкенда и базы данных нет, поэтому учётная запись целиком живёт в
 * localStorage браузера — по той же схеме, что и подборки (`lib/collections.ts`).
 * Пароль хранится только как баз64-хэш и служит исключительно для имитации
 * входа в демо-интерфейсе: реальную защиту данных такая схема не даёт.
 */

import { captureReferralOnRegister } from "./referrals";
import { displayNameError } from "./nickname";

export interface Account {
  /** Никнейм — латиница, кириллица, цифры, `_` и `-` */
  nickname: string;
  /**
   * Отображаемое имя (услуга «Смена ника»). Пусто — показывается `nickname`.
   *
   * Отдельно от логина: по макету смена имени не трогает ни `@ник` для
   * входа, ни ссылку на профиль, ни почту — только то, что видно другим.
   */
  displayName?: string;
  email: string;
  /** Хэш пароля (демо-проверка при входе, не шифрование) */
  passHash: string;
  /** Дата регистрации, мс */
  createdAt: number;
  /** До какой даты активна Premium-подписка, мс; 0 — подписки нет */
  premiumUntil?: number;
  /** С какого момента считается текущий оплаченный период, мс */
  premiumSince?: number;
  /** Сколько дней оплачено в текущем периоде — нужно для прогресс-бара */
  premiumTotalDays?: number;
}

export const ACCOUNT_KEY = "animehub:account:v1";

/**
 * Границы правдоподобной отметки времени для полей аккаунта.
 *
 * В localStorage могло попасть любое число, а `new Date(...)` превращал
 * его в дату вплоть до года 275760 — страница показывала «С 9 ноября
 * 55840 г.». Значения вне диапазона считаются мусором и заменяются
 * нулём: подписки нет, а не «подписка до 55840 года».
 */
const PLAUSIBLE_MIN_MS = Date.UTC(1970, 0, 1);
const PLAUSIBLE_MAX_MS = Date.UTC(2120, 0, 1);

/** Отметка времени из хранилища, если она похожа на настоящую */
function plausibleTime(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) &&
    value >= PLAUSIBLE_MIN_MS && value <= PLAUSIBLE_MAX_MS
    ? value
    : fallback;
}

/** Событие, которое шлёт `saveAccount`/`clearAccount` внутри вкладки */
export const ACCOUNT_EVENT = "animehub:account-changed";

const NICKNAME_RE = /^[A-Za-z0-9А-Яа-яЁё_-]{3,32}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-zА-Яа-я]{2,}$/;
const MIN_PASSWORD = 6;
const MAX_PASSWORD = 72;

function available(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function notify(): void {
  if (!available()) return;
  window.dispatchEvent(new Event(ACCOUNT_EVENT));
}

/** SHA-256 пароля (синхронно, без base64 и обратимости) */
export function hashPassword(value: string): string {
  const bytes = new TextEncoder().encode(value);
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

  const bitLen = bytes.length * 8;
  const padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, bitLen, false);

  for (let offset = 0; offset < padded.length; offset += 64) {
    const W = new Array<number>(64);
    for (let i = 0; i < 16; i++) W[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  return H.map((x) => x.toString(16).padStart(8, "0")).join("");
}

/** Разбирает JSON-объект аккаунта; любая ошибка — «не вошли» */
export function parseAccount(raw: string | null): Account | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const candidate = parsed as Partial<Account>;
    if (
      typeof candidate.nickname !== "string" ||
      typeof candidate.email !== "string" ||
      typeof candidate.passHash !== "string"
    ) {
      return null;
    }
    return {
      nickname: candidate.nickname,
      /* Имя из хранилища может оказаться мусором: показываем его только
         после проверки, иначе в прошлёк бы попал нечитаемый текст. */
      displayName:
        typeof candidate.displayName === "string" && displayNameError(candidate.displayName) === null
          ? candidate.displayName.trim()
          : "",
      email: candidate.email,
      passHash: candidate.passHash,
      /* createdAt без подстановки Date.now(): иначе при разборе битого
         значения год в профиле «прыгал» бы при каждой перерисовке. */
      createdAt: plausibleTime(candidate.createdAt, 0),
      premiumUntil: plausibleTime(candidate.premiumUntil, 0),
      premiumSince: plausibleTime(candidate.premiumSince, 0),
      premiumTotalDays:
        typeof candidate.premiumTotalDays === "number" &&
        Number.isFinite(candidate.premiumTotalDays) &&
        candidate.premiumTotalDays >= 0
          ? candidate.premiumTotalDays
          : 0,
    };
  } catch {
    return null;
  }
}

/** Текущий аккаунт (или null); работает только в браузере */
export function readAccount(): Account | null {
  if (!available()) return null;
  try {
    return parseAccount(window.localStorage.getItem(ACCOUNT_KEY));
  } catch {
    return null;
  }
}

export function saveAccount(account: Account): void {
  if (!available()) return;
  try {
    window.localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
    notify();
  } catch {
    /* приватный режим — молча пропускаем */
  }
}

export function clearAccount(): void {
  if (!available()) return;
  try {
    window.localStorage.removeItem(ACCOUNT_KEY);
    notify();
  } catch {
    /* приватный режим — молча пропускаем */
  }
}

/* ------------------------------ Валидация ------------------------------ */

export function validateNickname(value: string): string | null {
  const nick = value.trim();
  if (!nick) return "Введите никнейм";
  if (nick.length < 3 || nick.length > 32) return "Никнейм должен быть от 3 до 32 символов";
  if (!NICKNAME_RE.test(nick)) return "Никнейм: буквы, цифры, `_` и `-`, без пробелов";
  return null;
}

/* -------------------------- Отображаемое имя ---------------------------- */

/** Имя, которое видно в интерфейсе: своё, если куплена смена, иначе логин */
export function displayNameOf(account: Account | null | undefined): string {
  const custom = account?.displayName?.trim();
  return custom ? custom : (account?.nickname ?? "");
}

/**
 * Записывает отображаемое имя в аккаунт.
 *
 * Списание AC к этому моменту уже прошло через движок: функция только
 * сохраняет результат покупки. Возвращает текст ошибки, если имя не
 * проходит правила макета, — тогда UI честно скажет, что покупка не
 * применена (и вернёт имя в прежнее состояние).
 */
export function setDisplayName(value: string): string | null {
  const account = readAccount();
  if (!account) return "Аккаунт не найден";
  const clean = value.trim();
  if (displayNameError(clean)) return displayNameError(clean);
  if (clean.toLowerCase() === displayNameOf(account).toLowerCase()) {
    return "Это твой текущий ник";
  }
  saveAccount({ ...account, displayName: clean });
  return null;
}

export function validateEmail(value: string): string | null {
  const email = value.trim();
  if (!email) return "Введите электронную почту";
  if (!EMAIL_RE.test(email)) return "Введите корректный email";
  return null;
}

export function validatePassword(value: string): string | null {
  if (!value) return "Введите пароль";
  if (value.length < MIN_PASSWORD) return `Пароль слишком короткий: минимум ${MIN_PASSWORD} символов`;
  if (value.length > MAX_PASSWORD) return `Пароль слишком длинный: максимум ${MAX_PASSWORD} символов`;
  return null;
}

export type AuthResult = { ok: true } | { ok: false; error: string };

/** Вход по никнейму или почте + пароль */
export function loginAccount(login: string, password: string): AuthResult {
  const trimmed = login.trim();
  if (!trimmed) return { ok: false, error: "Введите никнейм или почту" };

  const account = readAccount();
  if (!account) return { ok: false, error: "Аккаунт не найден — зарегистрируйтесь" };

  const sameLogin =
    account.nickname.toLowerCase() === trimmed.toLowerCase() ||
    account.email.toLowerCase() === trimmed.toLowerCase();
  if (!sameLogin || account.passHash !== hashPassword(password)) {
    return { ok: false, error: "Неверный никнейм или пароль" };
  }
  return { ok: true };
}

/** Регистрация нового аккаунта (перезаписывает локальный) */
export function registerAccount(
  nickname: string,
  email: string,
  password: string,
  confirm: string,
): AuthResult {
  const nickError = validateNickname(nickname);
  if (nickError) return { ok: false, error: nickError };

  const emailError = validateEmail(email);
  if (emailError) return { ok: false, error: emailError };

  const passError = validatePassword(password);
  if (passError) return { ok: false, error: passError };

  if (password !== confirm) return { ok: false, error: "Пароли не совпадают" };

  const existing = readAccount();
  if (existing && existing.nickname.toLowerCase() === nickname.trim().toLowerCase()) {
    return { ok: false, error: "Это имя уже занято — попробуйте другое" };
  }
  if (existing && existing.email.toLowerCase() === email.trim().toLowerCase()) {
    return { ok: false, error: "Эта почта уже зарегистрирована" };
  }

  saveAccount({
    nickname: nickname.trim(),
    email: email.trim(),
    passHash: hashPassword(password),
    createdAt: Date.now(),
    premiumUntil: 0,
    premiumSince: 0,
    premiumTotalDays: 0,
  });
  // Реферальный код из адресной строки: пригласившему уйдёт награду через
  // движок (событие REFERRAL_REGISTERED), сам факт запоминается у новичка
  captureReferralOnRegister();
  return { ok: true };
}

/* --------------------------- Telegram (демо) ---------------------------- */

export interface TelegramDemoAccount {
  /** Имя аккаунта в Telegram (без `@`) */
  username: string;
  /** Отображаемое имя */
  name: string;
}

/**
 * Демо-аккаунты для входа через Telegram.
 *
 * Настоящая проверка входа (Login Widget) требует токен бота и бэкенд:
 * подпись `hash` вычисляется секретом бота. Бота нет — вход демонстрационный:
 * аккаунт создаётся локально тем же кодом, что и обычная регистрация,
 * и никуда не отправляется. Это честно подписано в интерфейсе.
 */
export const TELEGRAM_DEMO_ACCOUNTS: TelegramDemoAccount[] = [
  { username: "otaku_rin", name: "Рин" },
  { username: "senpai_aki", name: "Акира" },
  { username: "neko_yuki", name: "Юки" },
];

/**
 * Демо-вход через Telegram: открывает (или переключает) локальный аккаунт
 * с никнейм = `@username`. Premium этого браузера сохраняется — человек
 * никуда не делся, сменился только способ входа.
 */
export function loginTelegramDemo(username: string): AuthResult {
  if (!available()) return { ok: false, error: "Хранилище браузера недоступно" };
  const clean = username.trim().replace(/^@/, "");
  const nickError = validateNickname(clean);
  if (nickError) return { ok: false, error: nickError };

  const existing = readAccount();
  if (existing && existing.nickname.toLowerCase() === clean.toLowerCase()) {
    // Аккаунт уже этот — вход состоялся (наличие аккаунта = «вошли»)
    return { ok: true };
  }

  saveAccount({
    nickname: clean,
    email: `${clean}@t.me`,
    passHash: hashPassword(`telegram-demo:${clean}`),
    createdAt: Date.now(),
    premiumUntil: existing?.premiumUntil ?? 0,
    premiumSince: existing?.premiumSince ?? 0,
    premiumTotalDays: existing?.premiumTotalDays ?? 0,
  });
  return { ok: true };
}

/**
 * Вход через Telegram после серверной проверки подписи.
 */
export function loginTelegramVerified(payload: {
  nickname: string;
  telegram: { id: number; username: string | null; firstName: string | null; lastName: string | null; photoUrl: string | null };
}): AuthResult {
  if (!available()) return { ok: false, error: "Хранилище браузера недоступно" };
  const nickError = validateNickname(payload.nickname);
  if (nickError) return { ok: false, error: nickError };

  const existing = readAccount();
  saveAccount({
    nickname: payload.nickname,
    email: payload.telegram.username ? payload.telegram.username + "@t.me" : payload.nickname + "@t.me",
    passHash: hashPassword("telegram:" + payload.telegram.id),
    createdAt: existing ? existing.createdAt : Date.now(),
    premiumUntil: existing ? existing.premiumUntil : 0,
    premiumSince: existing ? existing.premiumSince : 0,
    premiumTotalDays: existing ? existing.premiumTotalDays : 0,
  });
  return { ok: true };
}

/**
 * Смена пароля.
 *
 * Проверяет текущий пароль по тому же хэшу, что и вход, и требует новый
 * дважды — опечатку в одном поле пользователь заметит не сразу. Правила
 * нового пароля на 4 символа длиннее, чем при регистрации: пароль, который
 * годами стоял в демо-аккаунте, менять стоит на что-то посерьёзнее.
 */
export function changePassword(
  current: string,
  next: string,
  confirm: string,
): AuthResult {
  const account = readAccount();
  if (!account) return { ok: false, error: "Аккаунт не найден" };
  if (account.passHash !== hashPassword(current)) {
    return { ok: false, error: "Текущий пароль неверен" };
  }
  const error = validateStrongPassword(next);
  if (error) return { ok: false, error };
  if (next !== confirm) return { ok: false, error: "Пароли не совпадают" };
  if (next === current) return { ok: false, error: "Новый пароль совпадает с текущим" };

  saveAccount({ ...account, passHash: hashPassword(next) });
  return { ok: true };
}

/**
 * Правила нового пароля: 8+ символов, заглавная, строчная и цифра.
 * Возвращает null, если пароль подходит.
 */
export function validateStrongPassword(value: string): string | null {
  if (!value) return "Введите новый пароль";
  if (value.length < STRONG_MIN_PASSWORD) {
    return `Минимум ${STRONG_MIN_PASSWORD} символов, заглавная, строчная, цифра`;
  }
  if (value.length > MAX_PASSWORD) return `Пароль слишком длинный: максимум ${MAX_PASSWORD} символов`;
  if (!/[A-Za-zА-Яа-я]/.test(value) || !/[a-zа-я]/.test(value) || !/[A-ZА-ЯЁ]/.test(value)) {
    return "Нужны и заглавная, и строчная буквы";
  }
  if (!/\d/.test(value)) return "Нужна хотя бы одна цифра";
  return null;
}

const STRONG_MIN_PASSWORD = 8;

/* ----------------------------- Premium -------------------------------- */

/**
 * Активирует подписку на `days` дней.
 *
 * Продление активной подписки дописывает дни к текущему периоду — его начало и
 * объём не меняются. Иначе «осталось 25 из 30 дней» после продления на год
 * показывало бы 0%, хотя человек только что заплатил.
 */
export function activatePremium(days: number): Account | null {
  const account = readAccount();
  if (!account) return null;
  const now = Date.now();
  const active = isPremiumActive(account);
  const base = active ? Math.max(now, account.premiumUntil ?? 0) : now;
  const next: Account = {
    ...account,
    premiumUntil: base + days * 86_400_000,
    premiumSince: active ? account.premiumSince || now : now,
    // У аккаунтов, оформленных до появления полей, периода нет: берём остаток
    premiumTotalDays: (active ? account.premiumTotalDays || premiumDaysLeft(account) : 0) + days,
  };
  saveAccount(next);
  return next;
}

export function isPremiumActive(account: Account | null): boolean {
  return Boolean(account?.premiumUntil && account.premiumUntil > Date.now());
}

/** Дата подписки в формате «03.11.2026» */
export function formatPremiumUntil(account: Account | null): string {
  if (!account?.premiumUntil) return "";
  return new Date(account.premiumUntil).toLocaleDateString("ru-RU");
}

/** Сколько дней подписки осталось (0 — подписки нет) */
export function premiumDaysLeft(account: Account | null): number {
  if (!account?.premiumUntil) return 0;
  return Math.max(0, Math.ceil((account.premiumUntil - Date.now()) / 86_400_000));
}

/**
 * Как «вы burnt» оплаченный период — для прогресс-бара на странице Premium.
 *
 * У старых аккаунтов полей нет, поэтому период берётся равным остатку: бар
 * покажет 100%, а не выдуманные 7%. Честнее показать «не знаем», чем выдумать
 * число, которое потом не сойдётся с продлением.
 */
export function premiumProgress(account: Account | null): {
  /** Сколько процентов периода осталось, 0–100 */
  percent: number;
  /** Оплачено дней в периоде; 0 — данных нет */
  totalDays: number;
} {
  if (!account?.premiumUntil) return { percent: 0, totalDays: 0 };
  const totalDays = Math.max(0, Math.round(account.premiumTotalDays ?? 0));
  if (!totalDays) return { percent: 100, totalDays: 0 };
  const leftDays = Math.max(0, account.premiumUntil - Date.now()) / 86_400_000;
  const percent = Math.max(0, Math.min(100, Math.round((leftDays / totalDays) * 100)));
  return { percent, totalDays };
}
