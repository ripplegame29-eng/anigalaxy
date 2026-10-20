"use client";

/**
 * Привязанные аккаунты, список друзей и подключённые устройства.
 *
 * Всё три живёт в браузере: OAuth у Telegram и Google требует сервера и
 * секретов приложения, а подключение телевизора — обмена кодами через
 * сеть. Здесь эти три вещи сделаны как локальные записи, и интерфейс
 * честно пишет, что подтверждения от сервиса не было. Пользователь
 * ничего не теряет: список можно удалить, и данные останутся целыми.
 */

import { useCallback, useSyncExternalStore } from "react";
import { createLocalStore } from "./store";

/* ------------------------- Привязанные аккаунты ------------------------- */

export type LinkProvider = "google" | "telegram";

export interface AccountLink {
  provider: LinkProvider;
  /** Имя аккаунта у сервиса: адрес Google или юзернейм Telegram */
  handle: string;
  /** Отображаемое имя */
  name: string;
  /** Когда привязали, мс */
  at: number;
}

export const LINK_LABEL: Record<LinkProvider, string> = {
  google: "Google",
  telegram: "Telegram",
};

const LINKS_KEY = "animehub:links:v1";
const LINKS_EVENT = "animehub:links-changed";
const PROVIDERS = new Set<LinkProvider>(["google", "telegram"]);

/** Мягкая проверка: не отправляем данные наружу, ловим только явный мусор */
function normalizeHandle(provider: LinkProvider, raw: string): { handle: string; name: string } | null {
  const clean = raw.trim().replace(/^@/, "");
  if (provider === "google") {
    if (!/^[^\s@]+@[^\s@]+\.[A-Za-zА-Яа-я]{2,}$/.test(clean)) return null;
    return { handle: clean.toLowerCase(), name: clean.split("@")[0] };
  }
  if (!/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(clean)) return null;
  return { handle: clean, name: clean };
}

function parseLinks(raw: string): AccountLink[] | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(value)) return null;
  const out: AccountLink[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const link = item as Partial<AccountLink>;
    if (typeof link.provider !== "string" || !PROVIDERS.has(link.provider as LinkProvider)) continue;
    if (typeof link.handle !== "string" || !link.handle) continue;
    out.push({
      provider: link.provider as LinkProvider,
      handle: link.handle,
      name: typeof link.name === "string" ? link.name : link.handle,
      at: typeof link.at === "number" ? link.at : 0,
    });
    // Один аккаунт на сервис: повторная привязка заменяет прежнюю
    if (out.some((existing) => existing.provider === link.provider)) break;
  }
  return out.slice(0, 2);
}

const linksStore = createLocalStore<AccountLink[]>(LINKS_KEY, [], parseLinks);

export function useLinks(): AccountLink[] {
  return linksStore.useStore();
}

/**
 * Привязать аккаунт. Возвращает текст ошибки или null при успехе —
 * без записи не получится, потому что проверить у сервиса нечем.
 */
export function linkAccount(provider: LinkProvider, handle: string): string | null {
  const normalized = normalizeHandle(provider, handle);
  if (!normalized) {
    return provider === "google"
      ? "Введите адрес почты Google"
      : "Юзернейм Telegram: латиница, цифры и _, от 5 символов";
  }
  const list = linksStore.get().filter((item) => item.provider !== provider);
  list.push({ provider, handle: normalized.handle, name: normalized.name, at: Date.now() });
  linksStore.set(list);
  return null;
}

export function unlinkAccount(provider: LinkProvider): void {
  linksStore.set(linksStore.get().filter((item) => item.provider !== provider));
}

/* -------------------------------- Друзья -------------------------------- */

export interface Friend {
  /** Никнейм AniGalaxy — по нему и сверяется доступ к профилю */
  nickname: string;
  /** Отметка «взаимная» — влияет только на подпись в списке */
  mutual: boolean;
  at: number;
}

export const FRIENDS_KEY = "animehub:friends:v1";

const NICK_RE = /^[A-Za-z0-9А-Яа-яЁё_-]{3,32}$/;

function parseFriends(raw: string): Friend[] | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(value)) return null;
  const out: Friend[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const friend = item as Partial<Friend>;
    if (typeof friend.nickname !== "string" || !NICK_RE.test(friend.nickname)) continue;
    const key = friend.nickname.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ nickname: friend.nickname, mutual: friend.mutual === true, at: typeof friend.at === "number" ? friend.at : 0 });
    if (out.length >= 200) break;
  }
  return out;
}

const friendsStore = createLocalStore<Friend[]>(FRIENDS_KEY, [], parseFriends);

export function useFriends(): Friend[] {
  return friendsStore.useStore();
}

export function addFriend(nickname: string, mutual: boolean): string | null {
  const nick = nickname.trim();
  if (!NICK_RE.test(nick)) return "Никнейм: 3–32 символа, буквы, цифры, _ и -";
  const list = friendsStore.get().filter((item) => item.nickname.toLowerCase() !== nick.toLowerCase());
  list.push({ nickname: nick, mutual, at: Date.now() });
  friendsStore.set(list);
  return null;
}

export function removeFriend(nickname: string): void {
  friendsStore.set(friendsStore.get().filter((item) => item.nickname.toLowerCase() !== nickname.toLowerCase()));
}

/* --------------------------- Устройства (ТВ) --------------------------- */

export interface DeviceLink {
  /** Человеческое имя: «Телевизор в гостиной» */
  label: string;
  /** Код подключения, который показывается на телевизоре */
  code: string;
  /** Последняя активность, мс */
  at: number;
}

export const DEVICES_KEY = "animehub:devices:v1";

function parseDevices(raw: string): DeviceLink[] | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(value)) return null;
  const out: DeviceLink[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const device = item as Partial<DeviceLink>;
    if (typeof device.code !== "string" || !device.code) continue;
    out.push({
      code: device.code,
      label: typeof device.label === "string" && device.label ? device.label : "Устройство",
      at: typeof device.at === "number" ? device.at : 0,
    });
    if (out.length >= 20) break;
  }
  return out;
}

const devicesStore = createLocalStore<DeviceLink[]>(DEVICES_KEY, [], parseDevices);

export function useDevices(): DeviceLink[] {
  return devicesStore.useStore();
}

/**
 * Код подключения: восемь символов из алфавита без похожих (0/O, 1/I).
 * Пользователь вводит его на телевизоре, и устройство появляется здесь.
 */
export function newDeviceCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const out: string[] = [];
  for (let i = 0; i < 8; i += 1) {
    out.push(alphabet[Math.floor(Math.random() * alphabet.length)]);
    if (i === 3) out.push("-");
  }
  return out.join("");
}

export function addDevice(label: string, code: string): string | null {
  const clean = code.trim().toUpperCase();
  if (!/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(clean)) return "Код выглядит как XXXX-XXXX";
  const list = devicesStore.get().filter((item) => item.code !== clean);
  list.unshift({ code: clean, label: label.trim() || "Новое устройство", at: Date.now() });
  devicesStore.set(list.slice(0, 20));
  return null;
}

export function removeDevice(code: string): void {
  devicesStore.set(devicesStore.get().filter((item) => item.code !== code));
}

/* ------------------------- Активные сессии ----------------------------- */

/**
 * Список устройств, с которых выполнен вход. Без сервера сессии не
 * различаются, поэтому показываем одно — это то, где сайт открыт сейчас.
 * Отдельная выдача «выйти на всех остальных» означала бы обещание,
 * которого механизм не выполняет, поэтому её здесь нет.
 */
export interface Session {
  id: string;
  browser: string;
  os: string;
  current: boolean;
  at: number;
}

/** Что видно на сервере: браузера там нет, и подставлять настоящее имя
 *  рано — первый клиентский рендер обязан совпасть с серверным HTML */
const SERVER_SESSIONS: Session[] = [{ id: "local", browser: "Браузер", os: "—", current: true, at: 0 }];

function makeSession(ua: string): Session {
  const browser = /edg\//i.test(ua)
    ? "Edge"
    : /firefox\//i.test(ua)
      ? "Firefox"
      : /chrome\//i.test(ua)
        ? "Chrome"
        : /safari\//i.test(ua)
          ? "Safari"
          : "Браузер";
  const os = /windows/i.test(ua)
    ? "Windows"
    : /android/i.test(ua)
      ? "Android"
      : /iphone|ipad/i.test(ua)
        ? "iOS"
        : /mac os/i.test(ua)
          ? "macOS"
          : /linux/i.test(ua)
            ? "Linux"
            : "—";
  return { id: "local", browser, os, current: true, at: Date.now() };
}

/**
 * Снимок сессий для интерфейса.
 *
 * Через `useSyncExternalStore` с серверской заглушкой: `currentSession()`
 * читает `navigator.userAgent`, а на сервере его нет. Без заглушки первый
 * клиентский рендер показал бы «Edge · Windows» против «Браузер · —» в
 * серверном HTML, и React ругался бы на расхождение при гидрации.
 */
export function useSessions(): Session[] {
  const getSnapshot = useCallback((): Session[] => {
    const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
    // Ссылка должна быть стабильной, иначе useSyncExternalStore зациклится
    if (cachedUa !== ua) {
      cachedUa = ua;
      cachedSessions = [makeSession(ua)];
    }
    return cachedSessions;
  }, []);

  const getServerSnapshot = useCallback((): Session[] => SERVER_SESSIONS, []);

  const subscribe = useCallback((onChange: () => void) => {
    window.addEventListener("focus", onChange);
    return () => window.removeEventListener("focus", onChange);
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

let cachedUa: string | null = null;
let cachedSessions: Session[] = SERVER_SESSIONS;

/* ------------------------ Удаление аккаунта --------------------------- */

export const PROJECT_KEY_PREFIX = "animehub:";

/**
 * Полное удаление аккаунта: стирает все ключи проекта.
 *
 * Возвращает, сколько ключей удалено, чтобы интерфейс мог сказать об этом
 * прямо, а не показать пустое состояние, из которого непонятно, сработало
 * ли действие. Требуемое подтверждение проверяет вызывающий код — здесь
 * только сама очистка, чтобы её можно было вызвать и из другого места.
 */
export function eraseAccountData(): number {
  if (typeof window === "undefined" || !window.localStorage) return 0;
  const doomed: string[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(PROJECT_KEY_PREFIX)) doomed.push(key);
    }
  } catch {
    return 0;
  }
  let removed = 0;
  for (const key of doomed) {
    try {
      window.localStorage.removeItem(key);
      removed += 1;
    } catch {
      /* приватный режим — пропускаем */
    }
  }
  // Сторы держат значение в памяти: без этого перезагрузка не подхватила бы
  // очистку, а интерфейс продолжил бы показывать удалённые данные
  try {
    window.dispatchEvent(new StorageEvent("storage", { key: null }));
  } catch {
    /* старые браузеры не умеют StorageEvent — переживём */
  }
  for (const event of [LINKS_EVENT, "animehub:account-changed", "animehub:prefs-changed"]) {
    try {
      window.dispatchEvent(new Event(event));
    } catch {
      /* пусто */
    }
  }
  return removed;
}

export const LINKS_EVENT_NAME = LINKS_EVENT;
