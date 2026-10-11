/**
 * Локальный «аккаунт» проекта.
 *
 * Бэкенда и базы данных нет, поэтому учётная запись целиком живёт в
 * localStorage браузера — по той же схеме, что и подборки (`lib/collections.ts`).
 * Пароль хранится только как баз64-хэш и служит исключительно для имитации
 * входа в демо-интерфейсе: реальную защиту данных такая схема не даёт.
 */

export interface Account {
  /** Никнейм — латиница, кириллица, цифры, `_` и `-` */
  nickname: string;
  email: string;
  /** Хэш пароля (демо-проверка при входе, не шифрование) */
  passHash: string;
  /** Дата регистрации, мс */
  createdAt: number;
  /** До какой даты активна Premium-подписка, мс; 0 — подписки нет */
  premiumUntil?: number;
}

export const ACCOUNT_KEY = "animehub:account:v1";

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

/** Баз64-хэш пароля (демо-уровень, защита не предусмотрена) */
export function hashPassword(value: string): string {
  try {
    return btoa(unescape(encodeURIComponent(value)));
  } catch {
    return "";
  }
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
      email: candidate.email,
      passHash: candidate.passHash,
      createdAt: typeof candidate.createdAt === "number" ? candidate.createdAt : Date.now(),
      premiumUntil: typeof candidate.premiumUntil === "number" ? candidate.premiumUntil : 0,
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
  });
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
  });
  return { ok: true };
}

/* ----------------------------- Premium -------------------------------- */

/** Активирует подписку на `days` дней от текущего момента */
export function activatePremium(days: number): Account | null {
  const account = readAccount();
  if (!account) return null;
  const base = Math.max(Date.now(), account.premiumUntil ?? 0);
  const next: Account = { ...account, premiumUntil: base + days * 86_400_000 };
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
