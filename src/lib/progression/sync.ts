"use client";

/**
 * Отправка прогресса на серверное зеркало.
 *
 * Зачем: пока `storageMode: "local"`, документ живёт в браузере, и админка не
 * может увидеть, что происходит с игроками. Этот модуль незаметно
 * отправляет документ на `/api/progress`, не трогая ни движок, ни сервис
 * прогрессии — контракт `load/save` у `ProgressStore` асинхронный, но
 * переключать режим рано: у гостя сайта нет серверного аккаунта, и
 * прогресс просто пропал бы.
 *
 * Когда игровой вход переедет на сервер, вызовы `sync` отсюда исчезнут, а
 * `createLocalProgressStore` заменится на `createServerProgressStore`, который
 * в проекте уже намечен.
 *
 * Три правила, из-за которых модуль выглядит именно так:
 *
 * 1. Молча. Ошибка зеркала не должна мешать играть: документ в localStorage
 *    цел, потеряется только копия в панели.
 * 2. Пачками. События прогрессии идут пачками (каждый трек просмотра, каждое
 *    открытие профиля), и один HTTP-запрос на событие — лишняя нагрузка.
 * 3. Только после входа. Проверка `/api/auth/me` — один запрос, который
 *    в любом случае делает ссылка в подвале; лишним он получается не всегда,
 *    зато гостю мы не шлём запросы, на которые заведомо получим 401.
 */

import type { ProgressDoc } from "./types";

/** Сколько ждём перед отправкой, чтобы собрать пачку событий. */
const DEBOUNCE_MS = 4000;

/** Не чаще этого интервала, даже если события идут непрерывно. */
const MIN_INTERVAL_MS = 15_000;

/** Документ больше этого — сервер всё равно его отвергнет. */
const MAX_DOC_BYTES = 512 * 1024;

let enabled: boolean | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let lastSentAt = 0;
let inFlight = false;
let pending: string | null = null;

async function hasServerAccount(): Promise<boolean> {
  if (enabled !== null) return enabled;

  try {
    const res = await fetch("/api/auth/me", { credentials: "same-origin" });
    if (!res.ok) {
      enabled = false;
      return false;
    }
    const data = (await res.json()) as { authenticated?: boolean };
    enabled = data.authenticated === true;
  } catch {
    // Сеть недоступна — считаем, что аккаунта нет, и не мучаемся дальше.
    enabled = false;
  }

  return enabled;
}

async function send(doc: string): Promise<void> {
  inFlight = true;
  lastSentAt = Date.now();
  try {
    await fetch("/api/progress", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      // Тело уже строка — двойное кодирование JSON не нужно.
      body: JSON.stringify({ doc }),
    });
  } catch {
    // Молча: см. правило 1 в шапке.
  } finally {
    inFlight = false;
    if (pending !== null) {
      const next = pending;
      pending = null;
      schedule(next);
    }
  }
}

/**
 * Запланировать отправку документа.
 *
 * Вызывать на каждое изменение: модуль сам соберёт события в пачку.
 */
export function sync(doc: ProgressDoc): void {
  let raw: string;
  try {
    raw = JSON.stringify(doc);
  } catch {
    // Документ с чем-то несериализуемым (цикл) — молча пропускаем.
    return;
  }

  schedule(raw);
}

/** Всё, что ниже, работает уже со строкой — она и уходит на сервер. */
function schedule(raw: string): void {
  if (raw.length > MAX_DOC_BYTES) return;

  pending = raw;

  if (!enabled) {
    void hasServerAccount().then((ok) => {
      if (ok) {
        enabled = true;
        const doc = pending;
        pending = null;
        if (doc !== null) schedule(doc);
      }
    });
    return;
  }

  if (timer !== null) return;

  const sinceLast = Date.now() - lastSentAt;
  const wait = Math.max(0, Math.min(DEBOUNCE_MS, MIN_INTERVAL_MS - sinceLast));

  timer = setTimeout(() => {
    timer = null;
    const doc = pending;
    pending = null;
    if (doc === null) return;
    // Пока предыдущий запрос в полёте, новый ждёт в `pending` и уйдёт
    // из finally — иначе два документа перетирали бы друг друга.
    if (inFlight) {
      pending = doc;
      return;
    }
    void send(doc);
  }, wait);
}

/** Загрузить документ с сервера (для будущего режима `server`). */
export async function pull(): Promise<ProgressDoc | null> {
  if (!(await hasServerAccount())) return null;

  try {
    const res = await fetch("/api/progress", { credentials: "same-origin" });
    if (!res.ok) return null;
    const data = (await res.json()) as { doc?: string | null };
    return data.doc ? (JSON.parse(data.doc) as ProgressDoc) : null;
  } catch {
    return null;
  }
}

/** Для тестов и разбора: сбросить внутреннее состояние модуля. */
export function resetSync(): void {
  enabled = null;
  timer = null;
  lastSentAt = 0;
  inFlight = false;
  pending = null;
}