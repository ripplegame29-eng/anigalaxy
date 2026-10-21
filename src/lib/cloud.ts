"use client";

/**
 * Облачная часть аккаунта: вход через сервер и фоновая синхронизация
 * локальных хранилищ с базой данных.
 *
 * Сайт по-прежнему работает на localStorage — это быстро и не требует сети.
 * Модуль лишь зеркалит ключи из `sync-keys.ts` на сервер, пока игрок вошёл,
 * и подтягивает их на новом устройстве. Если сервер недоступен, всё
 * продолжает работать локально, а изменения уйдут при следующей связи.
 */

import {
  ACCOUNT_EVENT,
  hashPassword,
  readAccount,
  registerAccount,
  loginAccount,
  saveAccount,
  validateEmail,
  validateNickname,
  validatePassword,
  type Account,
  type AuthResult,
} from "./auth";
import { captureReferralOnRegister } from "./referrals";
import { PROGRESS_DOC_KEY, isSyncKey } from "./sync-keys";
import { isViewMode } from "./view-mode";

const META_KEY = "animehub:sync:meta:v1";
const PUSH_DELAY_MS = 2500;
const RETRY_DELAY_MS = 30_000;
const RELOAD_STAMP = "animehub:sync:reload";

interface ServerAccount {
  id: number;
  nickname: string;
  displayName: string;
  email: string;
  premiumUntil: number;
  premiumSince: number;
  premiumTotalDays: number;
  createdAt: number;
}

interface Meta {
  userId: number | null;
  versions: Record<string, number>;
  dirty: string[];
  /** Последние отправленные поля аккаунта (имя и Premium) */
  profile: string;
}

interface Reply<T> {
  status: number;
  data: T | null;
  /** Сервер не ответил осмысленно (сети нет, маршрута нет, база не подключена) */
  unavailable: boolean;
}

let started = false;
let active = false;
let applying = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let pushing: Promise<boolean> | null = null;

const nativeGet = typeof Storage !== "undefined" ? Storage.prototype.getItem : null;
const nativeSet = typeof Storage !== "undefined" ? Storage.prototype.setItem : null;
const nativeRemove = typeof Storage !== "undefined" ? Storage.prototype.removeItem : null;

/* ------------------------------ Хранилище ------------------------------- */

function readRaw(key: string): string | null {
  try {
    return nativeGet ? nativeGet.call(window.localStorage, key) : null;
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: string): void {
  try {
    applying = true;
    nativeSet?.call(window.localStorage, key, value);
  } catch {
    /* переполнение или приватный режим */
  } finally {
    applying = false;
  }
}

function readMeta(): Meta {
  const empty: Meta = { userId: null, versions: {}, dirty: [], profile: "" };
  try {
    const parsed = JSON.parse(readRaw(META_KEY) ?? "null") as Partial<Meta> | null;
    if (!parsed || typeof parsed !== "object") return empty;
    return {
      userId: typeof parsed.userId === "number" ? parsed.userId : null,
      versions: parsed.versions && typeof parsed.versions === "object" ? parsed.versions : {},
      dirty: Array.isArray(parsed.dirty) ? parsed.dirty.filter((k): k is string => typeof k === "string") : [],
      profile: typeof parsed.profile === "string" ? parsed.profile : "",
    };
  } catch {
    return empty;
  }
}

function writeMeta(meta: Meta): void {
  writeRaw(META_KEY, JSON.stringify(meta));
}

function syncKeysOnDevice(): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && isSyncKey(key)) keys.push(key);
    }
  } catch {
    /* недоступно */
  }
  return keys;
}

/** Опыт из документа прогресса (−1, если формат незнакомый) */
function xpOf(raw: string | null): number {
  if (!raw) return -1;
  try {
    const parsed = JSON.parse(raw) as { progress?: { xpTotal?: unknown }; xpTotal?: unknown };
    const xp = parsed?.progress?.xpTotal ?? parsed?.xpTotal;
    return typeof xp === "number" && Number.isFinite(xp) ? xp : -1;
  } catch {
    return -1;
  }
}

function reloadOnce(): void {
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_STAMP) ?? 0);
    if (Date.now() - last < 15_000) return;
    window.sessionStorage.setItem(RELOAD_STAMP, String(Date.now()));
  } catch {
    /* без метки перезагрузка всё равно безопасна: она разовая за вызов */
  }
  window.location.reload();
}

/* -------------------------------- Сеть ---------------------------------- */

async function call<T>(path: string, body?: unknown, keepalive = false): Promise<Reply<T>> {
  try {
    const response = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
      keepalive,
    });
    let data: T | null = null;
    try {
      data = (await response.json()) as T;
    } catch {
      data = null;
    }
    const unavailable = data === null || response.status === 404 || response.status >= 500;
    return { status: response.status, data, unavailable };
  } catch {
    return { status: 0, data: null, unavailable: true };
  }
}

/* ----------------------------- Синхронизация ---------------------------- */

function markDirty(key: string): void {
  const meta = readMeta();
  if (!meta.dirty.includes(key)) {
    meta.dirty.push(key);
    writeMeta(meta);
  }
  schedulePush(PUSH_DELAY_MS);
}

function schedulePush(delay: number): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void push();
  }, delay);
}

interface PutResult {
  key: string;
  ok: boolean;
  version?: number;
  reason?: string;
  server?: { value: string; version: number };
}

/** Отправляет изменённые документы. true — отправлять больше нечего */
export function push(keepalive = false): Promise<boolean> {
  if (isViewMode()) return Promise.resolve(false);
  if (pushing) return pushing;
  pushing = doPush(keepalive).finally(() => {
    pushing = null;
  });
  return pushing;
}

async function doPush(keepalive: boolean): Promise<boolean> {
  if (!active) return false;
  const meta = readMeta();
  const keys = meta.dirty.filter((key) => isSyncKey(key));
  const sent = new Map<string, string>();
  for (const key of keys) {
    const value = readRaw(key);
    if (value !== null) sent.set(key, value);
  }
  meta.dirty = meta.dirty.filter((key) => sent.has(key));
  if (!sent.size) {
    writeMeta(meta);
    return true;
  }

  const batch = [...sent.entries()].slice(0, 60);
  const reply = await call<{ results?: PutResult[] }>(
    "/api/sync",
    { docs: batch.map(([key, value]) => ({ key, value, baseVersion: meta.versions[key] })) },
    keepalive,
  );
  if (reply.status === 401) {
    active = false;
    return false;
  }
  if (!reply.data?.results) {
    schedulePush(RETRY_DELAY_MS);
    return false;
  }

  let serverWon = false;
  const fresh = readMeta();
  for (const result of reply.data.results) {
    const key = result.key;
    const settled = () => {
      /* если за время запроса ключ снова менялся — он остаётся «грязным» */
      if (readRaw(key) === sent.get(key)) fresh.dirty = fresh.dirty.filter((k) => k !== key);
    };
    if (result.ok && typeof result.version === "number") {
      fresh.versions[key] = result.version;
      settled();
    } else if ((result.reason === "conflict" || result.reason === "implausible") && result.server) {
      fresh.versions[key] = result.server.version;
      const localXp = xpOf(sent.get(key) ?? null);
      if (key === PROGRESS_DOC_KEY && result.reason === "conflict" && localXp > xpOf(result.server.value)) {
        /* локальный прогресс больше — отправим ещё раз поверх новой версии */
        if (!fresh.dirty.includes(key)) fresh.dirty.push(key);
      } else {
        writeRaw(key, result.server.value);
        fresh.dirty = fresh.dirty.filter((k) => k !== key);
        serverWon = true;
      }
    } else {
      /* invalid / too_large / too_many — повторять бессмысленно */
      fresh.dirty = fresh.dirty.filter((k) => k !== key);
    }
  }
  writeMeta(fresh);
  if (fresh.dirty.length) schedulePush(PUSH_DELAY_MS);
  if (serverWon) reloadOnce();
  return fresh.dirty.length === 0;
}

/** Подтягивает серверные документы. true — локальные данные поменялись */
async function pull(): Promise<boolean> {
  const reply = await call<{ docs?: { key: string; value: string; version: number }[] }>("/api/sync");
  if (reply.status === 401) {
    active = false;
    return false;
  }
  if (!reply.data?.docs) return false;

  const meta = readMeta();
  const onServer = new Set<string>();
  let changed = false;

  for (const doc of reply.data.docs) {
    if (!isSyncKey(doc.key)) continue;
    onServer.add(doc.key);
    const local = readRaw(doc.key);
    const known = meta.versions[doc.key];
    meta.versions[doc.key] = doc.version;

    if (local === doc.value) {
      meta.dirty = meta.dirty.filter((k) => k !== doc.key);
      continue;
    }
    /* Локальная правка поверх актуальной серверной версии — оставляем и отправим */
    if (local !== null && known === doc.version) {
      if (!meta.dirty.includes(doc.key)) meta.dirty.push(doc.key);
      continue;
    }
    /* Прогресс никогда не откатываем назад */
    if (doc.key === PROGRESS_DOC_KEY && local !== null && xpOf(local) > xpOf(doc.value)) {
      if (!meta.dirty.includes(doc.key)) meta.dirty.push(doc.key);
      continue;
    }
    writeRaw(doc.key, doc.value);
    meta.dirty = meta.dirty.filter((k) => k !== doc.key);
    changed = true;
  }

  /* Всё, чего на сервере ещё нет, уезжает туда */
  for (const key of syncKeysOnDevice()) {
    if (!onServer.has(key) && !meta.dirty.includes(key)) meta.dirty.push(key);
  }
  writeMeta(meta);
  if (meta.dirty.length) schedulePush(0);
  return changed;
}

function wipeSyncedKeys(): void {
  for (const key of syncKeysOnDevice()) {
    try {
      applying = true;
      nativeRemove?.call(window.localStorage, key);
    } catch {
      /* пропускаем */
    } finally {
      applying = false;
    }
  }
}

/* ------------------------------- Аккаунт -------------------------------- */

function profileSignature(account: Account): string {
  return JSON.stringify([
    account.displayName ?? "",
    account.premiumUntil ?? 0,
    account.premiumSince ?? 0,
    account.premiumTotalDays ?? 0,
  ]);
}

async function pushProfile(): Promise<void> {
  if (!active) return;
  const account = readAccount();
  if (!account) return;
  const signature = profileSignature(account);
  const meta = readMeta();
  if (meta.profile === signature) return;
  const reply = await call<{ ok?: boolean }>("/api/account/profile", {
    displayName: account.displayName ?? "",
    premiumUntil: account.premiumUntil ?? 0,
    premiumSince: account.premiumSince ?? 0,
    premiumTotalDays: account.premiumTotalDays ?? 0,
  });
  if (reply.data?.ok) writeMeta({ ...readMeta(), profile: signature });
}

/** Локальная запись об аккаунте по данным сервера (с сохранением купленного локально) */
function localFromServer(server: ServerAccount, passHash: string): Account {
  const prev = readAccount();
  const same = prev && prev.nickname.toLowerCase() === server.nickname.toLowerCase();
  return {
    nickname: server.nickname,
    displayName: server.displayName || (same ? prev.displayName : "") || "",
    email: server.email,
    passHash,
    createdAt: server.createdAt,
    premiumUntil: Math.max(server.premiumUntil, same ? (prev.premiumUntil ?? 0) : 0),
    premiumSince: server.premiumSince || (same ? (prev.premiumSince ?? 0) : 0),
    premiumTotalDays: Math.max(server.premiumTotalDays, same ? (prev.premiumTotalDays ?? 0) : 0),
  };
}

/** Общий хвост входа: сохранить аккаунт, подтянуть данные, при изменениях обновить страницу */
async function adopt(server: ServerAccount, passHash: string, keepLocalData: boolean): Promise<void> {
  const meta = readMeta();
  if (meta.userId !== server.id) {
    /* Данные другого игрока на этом устройстве в новый аккаунт не попадают */
    if (meta.userId !== null || !keepLocalData) wipeSyncedKeys();
    writeMeta({ userId: server.id, versions: {}, dirty: [], profile: "" });
  }
  active = true;
  const next = localFromServer(server, passHash);
  if (JSON.stringify(readAccount()) !== JSON.stringify(next)) saveAccount(next);
  const changed = await pull();
  void pushProfile();
  if (changed) reloadOnce();
}

type AuthReply = { ok?: boolean; account?: ServerAccount; error?: string; code?: string };

/** Вход. При недоступном сервере — прежний локальный вход */
export async function signIn(login: string, password: string): Promise<AuthResult> {
  const trimmed = login.trim();
  if (!trimmed) return { ok: false, error: "Введите никнейм или почту" };

  const reply = await call<AuthReply>("/api/account/login", { login: trimmed, password });
  if (reply.unavailable) return loginAccount(login, password);

  if (reply.data?.ok && reply.data.account) {
    await adopt(reply.data.account, hashPassword(password), true);
    return { ok: true };
  }

  /* Аккаунт, созданный до появления сервера, живёт только в браузере:
     при первом входе с верным паролем переносим его в базу. */
  if (reply.data?.code === "no_user") {
    const local = readAccount();
    const matches =
      local &&
      (local.nickname.toLowerCase() === trimmed.toLowerCase() || local.email.toLowerCase() === trimmed.toLowerCase()) &&
      local.passHash === hashPassword(password);
    if (local && matches) {
      const created = await call<AuthReply>("/api/account/register", {
        nickname: local.nickname,
        email: local.email,
        password,
      });
      if (created.data?.ok && created.data.account) {
        await adopt(created.data.account, local.passHash, true);
        return { ok: true };
      }
      if (created.unavailable) return { ok: true };
      return { ok: false, error: created.data?.error ?? "Не удалось перенести аккаунт на сервер" };
    }
  }
  return { ok: false, error: reply.data?.error ?? "Неверный никнейм или пароль" };
}

/** Регистрация. При недоступном сервере — прежняя локальная */
export async function signUp(
  nickname: string,
  email: string,
  password: string,
  confirm: string,
): Promise<AuthResult> {
  const problem =
    validateNickname(nickname) ?? validateEmail(email) ?? validatePassword(password) ??
    (password !== confirm ? "Пароли не совпадают" : null);
  if (problem) return { ok: false, error: problem };

  const reply = await call<AuthReply>("/api/account/register", {
    nickname: nickname.trim(),
    email: email.trim(),
    password,
  });
  if (reply.unavailable) return registerAccount(nickname, email, password, confirm);

  if (reply.data?.ok && reply.data.account) {
    await adopt(reply.data.account, hashPassword(password), true);
    captureReferralOnRegister(reply.data.account.nickname);
    return { ok: true };
  }
  return { ok: false, error: reply.data?.error ?? "Не удалось зарегистрироваться" };
}

/** Вход через Telegram уже выполнен на сервере (cookie выдан) — подтягиваем данные */
export async function adoptTelegramSession(account: ServerAccount | null | undefined): Promise<void> {
  if (!account) return;
  await adopt(account, hashPassword(`telegram:${account.id}`), true);
}

/** Смена пароля на сервере; после неё сессии закрыты, поэтому входим заново */
export async function syncPasswordChange(current: string, next: string): Promise<void> {
  if (!active) return;
  const account = readAccount();
  const reply = await call<{ ok?: boolean }>("/api/account/password", { current, next });
  if (reply.unavailable || !reply.data?.ok || !account) return;
  const again = await call<AuthReply>("/api/account/login", { login: account.nickname, password: next });
  if (again.data?.ok) active = true;
  else active = false;
}

async function signOutCloud(): Promise<void> {
  if (!active) return;
  /* Сначала досылаем несохранённое, и только потом стираем данные устройства */
  const clean = await push();
  active = false;
  await call("/api/account/logout", {});
  if (clean) {
    wipeSyncedKeys();
    writeMeta({ userId: null, versions: {}, dirty: [], profile: "" });
    reloadOnce();
  }
}

/** Запускается один раз при открытии сайта */
export function startCloudSync(): void {
  if (isViewMode()) return;
  if (started || typeof window === "undefined" || !nativeSet) return;
  started = true;

  Storage.prototype.setItem = function patchedSetItem(this: Storage, key: string, value: string) {
    nativeSet.call(this, key, value);
    if (active && !applying && this === window.localStorage && isSyncKey(key)) markDirty(key);
  };

  window.addEventListener(ACCOUNT_EVENT, () => {
    if (!readAccount()) void signOutCloud();
    else void pushProfile();
  });
  window.addEventListener("pagehide", () => {
    if (active && readMeta().dirty.length) void push(true);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && active && readMeta().dirty.length) void push(true);
  });

  void (async () => {
    const me = await call<{ account?: ServerAccount | null }>("/api/account/me");
    const server = me.data?.account;
    if (!server) return;
    const local = readAccount();
    const sameUser = local && local.nickname.toLowerCase() === server.nickname.toLowerCase();
    await adopt(server, sameUser ? local.passHash : hashPassword(`cloud:${server.id}`), false);
  })();
}
