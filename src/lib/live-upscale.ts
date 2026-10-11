"use client";

import { useSyncExternalStore } from "react";
import { getQuality, subscribeQuality } from "./quality";
import { createUpscaleRenderer, type FrameSource, type UpscaleRenderer } from "./upscale-shader";

/**
 * «Апскейл 2x» на живом плеере Kodik — перенос функционала апскейл-расширений
 * (типа «Simple M 2x») средствами самой страницы, без внешних расширений.
 *
 * Почему нельзя было обойтись без этого модуля: страница физически не может
 * читать пиксели кросс-доменного iframe (canvas tainted / CORS), а SVG
 * url(#…)-фильтры браузер к таким кадрам вообще не применяет — проверено
 * замерами (0/255). Расширения работают, потому что получают доступ к кадрам
 * вкладки на уровне браузера. Веб-странице эквивалент даёт Screen Capture
 * API + Element Capture (Chrome 132+, десктоп):
 *
 *  1. `getDisplayMedia({ preferCurrentTab: true })` — браузер один раз
 *     спрашивает «показать эту вкладку?». Это стандартная защита: разрешение
 *     выдаётся человеком, а не кодом (то же, что расширение просит при
 *     установке, только честнее — прямо в момент включения).
 *  2. `track.restrictTo(RestrictionTarget.fromElement(iframe))` — поток
 *     превращается в захват ТОЛЬКО пикселей нашего iframe. Всё постороннее
 *     отсекается, включая наш канвас-оверлей поверх плеера: обратной связи
 *     («в захват попадает собственный вывод») не возникает — фундаментальное
 *     отличие от захвата всей вкладки.
 *  3. Кадры идут в MediaStreamTrackProcessor → WebGL-шейдер 2x
 *     (lib/upscale-shader) → непрозрачный канвас поверх iframe. Клики
 *     проходят сквозь канвас (pointer-events: none) — плеер остаётся
 *     источником звука, управления и фулскрина.
 *
 * Отказ в разрешении, отсутствие API, остановка захвата пользователем —
 * всё ведёт на «CSS-путь»: iframe продолжает обрабатываться цепочками
 * QUALITY_FILTERS (lib/quality), наблюдатель за качеством сам гасит канвас.
 *
 * Стор — тот же паттерн `useSyncExternalStore`, что и у качества.
 */

export type LiveUpscaleStatus =
  /** захват не запрашивался (или страница без плеера) */
  | "idle"
  /** открыт выбор вкладки в браузере */
  | "starting"
  /** конвейер работает: кадры → шейдер → канвас поверх плеера */
  | "live"
  /** разрешение не выдано / не тот источник / захват остановлен */
  | "denied"
  /** браузер не поддерживает Element Capture (не Chrome / старый) */
  | "unsupported";

export interface LiveUpscaleSnapshot {
  status: LiveUpscaleStatus;
  /** поддерживает ли браузер весь конвейер (проверяется на клиенте) */
  supported: boolean;
}

/** Снимок для SSR: клиент уточнит поддержку после гидратации */
const SERVER_SNAPSHOT: LiveUpscaleSnapshot = { status: "idle", supported: false };

/** Пауза перед остановкой захвата, когда плеер исчез со страницы (смена роута) */
const PLAYER_GRACE_MS = 6000;
/** Пауза, когда качество ушло с «Апскейл» — захват не нужен, но включить снова можно без вопроса */
const QUALITY_OFF_GRACE_MS = 20000;
/** Сила нерезкой маски в шейдере 2x */
const LIVE_SHARPEN = 0.75;
/** Подряд неудачных отрисовок, после которых прячем канвас (потеря контекста) */
const MAX_RENDER_FAILURES = 30;

/** Минимум того, что нам нужно из кадра захвата (VideoFrame) */
interface CapturedFrame {
  readonly displayWidth: number;
  readonly displayHeight: number;
  readonly timestamp: number;
  close(): void;
}

interface PlayerRefs {
  /** iframe Kodik — элемент-цель захвата; может отсутствовать (плеер недоступен) */
  iframe: HTMLIFrameElement | null;
  /** канвас-оверлей поверх плеера (рисуется модулем, React его не трогает) */
  overlay: HTMLCanvasElement;
}

type RestrictionCtor = { fromElement(el: Element): Promise<unknown> };
type ProcessorCtor = new (init: { track: MediaStreamTrack }) => {
  readable: ReadableStream<CapturedFrame>;
};
type TrackWithRestrict = MediaStreamTrack & {
  restrictTo?: (target: unknown) => Promise<void>;
};
/**
 * В актуальном Chrome (154) `restrictTo` живёт на интерфейсе
 * `BrowserCaptureMediaStreamTrack` (именно его возвращает getDisplayMedia),
 * а НЕ на `MediaStreamTrack.prototype` — проверка по базовому прототипу
 * давала false и весь конвейер уходил в «unsupported».
 */
type BrowserCaptureCtor = { prototype: { restrictTo?: unknown } };

/* ------------------------------- Стор ------------------------------- */

const listeners = new Set<() => void>();
let snapshot: LiveUpscaleSnapshot = SERVER_SNAPSHOT;
let checked = false;

function notify(): void {
  for (const listener of listeners) listener();
}

function setStatus(status: LiveUpscaleStatus): void {
  if (snapshot.status === status) return;
  snapshot = { ...snapshot, status };
  syncOverlay();
  notify();
}

function detectSupport(): boolean {
  if (typeof navigator === "undefined") return false;
  const media = navigator.mediaDevices;
  if (!media || typeof media.getDisplayMedia !== "function") return false;
  const processor = (globalThis as unknown as { MediaStreamTrackProcessor?: ProcessorCtor })
    .MediaStreamTrackProcessor;
  const restriction = (window as unknown as { RestrictionTarget?: RestrictionCtor })
    .RestrictionTarget;
  if (!processor || !restriction || typeof restriction.fromElement !== "function") return false;
  // Основной путь: Chrome 132+ отдаёт BrowserCaptureMediaStreamTrack
  const bc = (
    globalThis as unknown as { BrowserCaptureMediaStreamTrack?: BrowserCaptureCtor }
  ).BrowserCaptureMediaStreamTrack;
  if (bc && typeof bc.prototype.restrictTo === "function") return true;
  // Запасной путь: если движок положил restrictTo на базовый прототип (спека)
  const proto =
    typeof MediaStreamTrack !== "undefined"
      ? (MediaStreamTrack.prototype as unknown as TrackWithRestrict)
      : null;
  return !!proto && typeof proto.restrictTo === "function";
}

export function subscribeLiveUpscale(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLiveUpscale(): LiveUpscaleSnapshot {
  if (typeof window === "undefined") return SERVER_SNAPSHOT;
  if (!checked) {
    checked = true;
    snapshot = { status: "idle", supported: detectSupport() };
  }
  return snapshot;
}

export function getServerLiveUpscale(): LiveUpscaleSnapshot {
  return SERVER_SNAPSHOT;
}

export function useLiveUpscale(): LiveUpscaleSnapshot {
  return useSyncExternalStore(subscribeLiveUpscale, getLiveUpscale, getServerLiveUpscale);
}

/* --------------------------- Плеер и канвас --------------------------- */

let player: PlayerRefs | null = null;
let graceTimer: number | null = null;
let qualitySubscribed = false;

/** Видимость канваса: статус жив + есть отрисованный кадр + режим «Апскейл» */
function syncOverlay(): void {
  if (!player) return;
  const show =
    snapshot.status === "live" && hasFrame && getQuality() === "4k" && !!rendererReady();
  player.overlay.style.display = show ? "block" : "none";
}

function rendererReady(): boolean {
  return renderer !== null;
}

/**
 * Регистрация плеера (вызывается из эффекта WatchBox; возвращает cleanup).
 * Смена эпизода меняет iframe — захват пере-направляется на новый элемент,
 * сам поток при этом живёт: повторного вопроса браузера нет.
 */
export function registerPlayer(refs: PlayerRefs): () => void {
  attach(refs);
  return () => {
    if (player !== refs) return;
    player = null;
    syncOverlay();
    if (graceTimer !== null) window.clearTimeout(graceTimer);
    // Смена эпизода/StrictMode успевает пере-зарегистрироваться за паузу;
    // на странице без плеера захват держать незачем — гасим через паузу
    graceTimer = window.setTimeout(() => {
      graceTimer = null;
      stopStream();
      setStatus("idle");
    }, PLAYER_GRACE_MS);
  };
}

function attach(refs: PlayerRefs): void {
  player = refs;
  hasFrame = false;
  refs.overlay.style.display = "none";
  if (graceTimer !== null) {
    window.clearTimeout(graceTimer);
    graceTimer = null;
  }
  if (!qualitySubscribed) {
    qualitySubscribed = true;
    subscribeQuality(syncOverlay);
  }
  if (track && snapshot.status === "live") {
    // Новый iframe (смена серии) — перенаправляем захват, ошибку переведём в CSS-путь
    applyRestriction().catch(() => failCapture());
  }
}

/* ------------------------------ Захват ------------------------------ */

let stream: MediaStream | null = null;
let track: MediaStreamTrack | null = null;
let reader: ReadableStreamDefaultReader<CapturedFrame> | null = null;
let guardTimer: number | null = null;
let alive = false;
let pumping = false;
let pending: CapturedFrame | null = null;
let renderer: UpscaleRenderer | null = null;
let hasFrame = false;
let lastTimestamp = -1;
let renderFailures = 0;
let offSince: number | null = null;

/**
 * Запрос захвата вкладки. Должен вызываться из обработчика клика:
 * getDisplayMedia требует жеста пользователя (защита браузера).
 *
 * "running" — конвейер уже работает (включение мгновенное);
 * "requested" — открыт вопрос браузера, итог придёт в статусе;
 * "skipped" — на странице нет плеера.
 */
export type LiveRequest = "running" | "requested" | "skipped" | "unsupported";

export function requestLiveUpscale(): LiveRequest {
  const state = getLiveUpscale();
  if (!state.supported) {
    setStatus("unsupported");
    return "unsupported";
  }
  if (state.status === "live" && stream) return "running";
  if (state.status === "starting") return "requested";
  if (!player) return "skipped";
  setStatus("starting");
  void openCapture();
  return "requested";
}

async function openCapture(): Promise<void> {
  try {
    // preferCurrentTab: браузер предлагает текущую вкладку — меньше шансов
    // выбрать «не ту» и упереться в отказ restrictTo
    const options = {
      video: { frameRate: { ideal: 60 } },
      audio: false,
      preferCurrentTab: true,
    } as DisplayMediaStreamOptions;
    const media = await navigator.mediaDevices.getDisplayMedia(options);
    const video = media.getVideoTracks()[0];
    if (!video) throw new Error("нет видеодорожки");

    stream = media;
    track = video;
    video.addEventListener("ended", onTrackEnded, { once: true });

    hasFrame = false;
    lastTimestamp = -1;
    renderFailures = 0;
    await applyRestriction();
    startPump();
    startGuard();
    setStatus("live");
  } catch {
    stopStream();
    setStatus("denied");
  }
}

async function applyRestriction(): Promise<void> {
  if (!track) throw new Error("нет потока");
  if (!player?.iframe) throw new Error("нет плеера");
  const restriction = (window as unknown as { RestrictionTarget?: RestrictionCtor })
    .RestrictionTarget;
  if (!restriction) throw new Error("Element Capture недоступен");
  const target = await restriction.fromElement(player.iframe);
  const limited = track as TrackWithRestrict;
  if (typeof limited.restrictTo !== "function") throw new Error("restrictTo недоступен");
  // Отсекает всё, кроме iframe: наш оверлей в захват не попадает
  await limited.restrictTo(target);
}

/** Пользователь остановил захват шторкой браузера — тихо уходим на CSS */
function onTrackEnded(): void {
  if (snapshot.status !== "live") return;
  stopStream();
  setStatus("idle");
}

/** Невосстановимая ошибка (не та вкладка, сбой restrictTo) — CSS-путь */
function failCapture(): void {
  stopStream();
  setStatus("denied");
}

function stopStream(): void {
  alive = false;
  if (graceTimer !== null) {
    window.clearTimeout(graceTimer);
    graceTimer = null;
  }
  if (guardTimer !== null) {
    window.clearInterval(guardTimer);
    guardTimer = null;
  }
  if (pending) {
    pending.close();
    pending = null;
  }
  if (reader) {
    try {
      void reader.cancel();
    } catch {
      /* поток уже закрыт */
    }
    reader = null;
  }
  if (stream) {
    for (const t of stream.getTracks()) t.stop();
    stream = null;
  }
  track = null;
  pumping = false;
  hasFrame = false;
  offSince = null;
  if (player) player.overlay.style.display = "none";
}

/**
 * Сторож: качество ушло с «Апскейл» — через паузу останавливаем захват
 * (шторка «идёт трансляция» не должна висеть зря), вернуться можно снова
 * одним кликом, пока не истёк таймер.
 */
function startGuard(): void {
  if (guardTimer !== null) return;
  guardTimer = window.setInterval(() => {
    if (getQuality() !== "4k") {
      if (offSince === null) offSince = Date.now();
      else if (Date.now() - offSince >= QUALITY_OFF_GRACE_MS) {
        stopStream();
        setStatus("idle");
      }
    } else {
      offSince = null;
    }
  }, 1000);
}

/* --------------------------- Кадры → шейдер --------------------------- */

function startPump(): void {
  const processor = (globalThis as unknown as { MediaStreamTrackProcessor?: ProcessorCtor })
    .MediaStreamTrackProcessor;
  if (!track || !processor) throw new Error("нет процессора кадров");
  reader = new processor({ track }).readable.getReader();
  alive = true;
  void pump();
}

async function pump(): Promise<void> {
  const current = reader;
  if (!current) return;
  while (alive) {
    let chunk: ReadableStreamReadResult<CapturedFrame>;
    try {
      chunk = await current.read();
    } catch {
      break;
    }
    if (chunk.done) break;
    // «Последний кадр побеждает»: очередь не растёт, если шейдер не поспевает
    if (pending) pending.close();
    pending = chunk.value;
    if (!pumping) void drain();
  }
}

async function drain(): Promise<void> {
  pumping = true;
  while (alive && pending) {
    const frame = pending;
    pending = null;
    if (shouldRender()) await drawFrame(frame);
    frame.close();
    if (document.hidden || document.fullscreenElement) continue;
    // Ограничиваем частоту отрисовкой кадров экрана — дальше бессмысленно
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
  pumping = false;
}

function shouldRender(): boolean {
  return (
    snapshot.status === "live" &&
    getQuality() === "4k" &&
    !!player &&
    document.visibilityState === "visible" &&
    // в фулскрине iframe наш канвас не виден — кадры только тратим
    document.fullscreenElement === null
  );
}

async function drawFrame(frame: CapturedFrame): Promise<void> {
  const target = player;
  if (!target) return;
  // Бокс берём у iframe (или у контейнера): сам канвас скрыт до первого
  // кадра, его clientWidth был бы нулевым — получили бы замкнутый круг
  const boxW = target.iframe?.clientWidth || target.overlay.parentElement?.clientWidth || 0;
  const boxH = target.iframe?.clientHeight || target.overlay.parentElement?.clientHeight || 0;
  if (boxW < 1 || boxH < 1) return;

  if (!renderer) {
    renderer = createUpscaleRenderer(target.overlay);
    if (!renderer) {
      // Нет WebGL — весь конвейер несостоятелен, честно уходим на CSS
      failCapture();
      return;
    }
  }

  // Плотность буфера — под devicePixelRatio; ресайз переключает размер
  // буфера даже на стоп-кадре, иначе после зума картинка «повиснет»
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const outW = Math.max(1, Math.round(boxW * dpr));
  const outH = Math.max(1, Math.round(boxH * dpr));
  const resized = target.overlay.width !== outW || target.overlay.height !== outH;
  if (!resized && frame.timestamp === lastTimestamp) return;

  let ok = false;
  try {
    ok = renderer.render(
      frame as unknown as FrameSource,
      frame.displayWidth,
      frame.displayHeight,
      outW,
      outH,
      LIVE_SHARPEN,
    );
  } catch {
    ok = false;
  }
  if (!ok) {
    // Некоторые сборки не берут VideoFrame в texImage2D — идём через ImageBitmap
    try {
      const bitmap = await createImageBitmap(frame as unknown as ImageBitmapSource2);
      ok = renderer.render(bitmap, bitmap.width, bitmap.height, outW, outH, LIVE_SHARPEN);
      bitmap.close();
    } catch {
      ok = false;
    }
  }

  if (!ok) {
    renderFailures++;
    if (renderFailures >= MAX_RENDER_FAILURES) {
      // Контекст потерян окончательно — прячем канвас, остаются CSS-фильтры
      hasFrame = false;
      syncOverlay();
      renderFailures = 0;
    }
    return;
  }

  renderFailures = 0;
  lastTimestamp = frame.timestamp;
  if (!hasFrame) {
    hasFrame = true;
    syncOverlay();
  }
}

/* -------------------------------- SSR -------------------------------- */

/** Локальный алиас типа: lib.dom разных версий содержит VideoFrame по-разному */
type ImageBitmapSource2 = Parameters<typeof createImageBitmap>[0];
