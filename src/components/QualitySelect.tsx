"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  QUALITY_OPTIONS,
  setQuality,
  useQuality,
  type Quality,
} from "@/lib/quality";
import { getLiveUpscale, requestLiveUpscale, subscribeLiveUpscale } from "@/lib/live-upscale";

/** Сколько держать подпись над плеером после переключения */
const FLASH_MS = 2600;

/**
 * Подписи статусов захвата вкладки: сам запрос решает браузер, поэтому
 * итог («подтвердили / отклонили / не поддерживается») приходит позже
 * клика — рисуем их отдельно от подписи режима.
 */
const LIVE_FLASH = {
  starting: "Браузер запрашивает доступ к вкладке — подтвердите",
  live: "Апскейл 2x: GPU-шейдер работает поверх плеера",
  denied: "Без захвата вкладки — контраст и цвет остаются",
  unsupported: "Захват кадров недоступен — контраст и цвет остаются",
} as const;

/**
 * Кнопка «Апскейл» под плеером: тумблер вкл/выкл + шеврон с режимами
 * («Оригинал / HD+ / Апскейл»).
 *
 * Левая половина — быстрый тумблер: один клик запускает конвейер «Апскейл 2x» —
 * захват кадров вкладки + WebGL-шейдер поверх плеера (см. lib/live-upscale),
 * при первом включении браузер задаёт один стандартный вопрос. Если доступ
 * не выдан или API нет — остаются CSS-фильтры, и следующий клик выключает
 * режим. Шеврон открывает список режимов; там же — честное пояснение, что
 * технология живёт прямо на странице, без внешних расширений.
 *
 * Значение общее для всего сайта — оно же включает WebGL-шейдер резкости
 * на hero-ролях главной. Паттерн выпадающего списка (клик мимо, Escape)
 * повторяет меню озвучки в WatchBox.
 *
 * После переключения над плеером всплывает подпись (портал в #player-shell) —
 * видимое подтверждение режима; ответ браузера на запрос захвата приходит
 * позже и подписывается отдельно (LIVE_FLASH).
 */
export function QualitySelect({ className }: { className?: string }) {
  const quality = useQuality();
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const flashTimer = useRef<number | null>(null);

  const active = QUALITY_OPTIONS.find((option) => option.id === quality) ?? QUALITY_OPTIONS[0];

  // Закрываем список по клику мимо и по Escape
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Не даём таймеру пережить размонтирование
  useEffect(
    () => () => {
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    },
    [],
  );

  /** Подтверждение режима — в обработчике клика, а не в эффекте */
  const showFlash = useCallback((text: string, ms: number = FLASH_MS) => {
    setFlash(text);
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), ms);
  }, []);

  const qualityFlash = (id: Quality): string =>
    QUALITY_OPTIONS.find((option) => option.id === id)?.flash ?? "";

  // Ответ браузера на запрос захвата вкладки приходит асинхронно —
  // подписываемся на статус конвейера и подписываем итог отдельно
  useEffect(() => {
    let last = getLiveUpscale().status;
    return subscribeLiveUpscale(() => {
      const status = getLiveUpscale().status;
      if (status === last) return;
      last = status;
      if (status === "starting") showFlash(LIVE_FLASH.starting, 9000);
      else if (status === "live") showFlash(LIVE_FLASH.live);
      else if (status === "denied") showFlash(LIVE_FLASH.denied);
      else if (status === "unsupported") showFlash(LIVE_FLASH.unsupported);
    });
  }, [showFlash]);

  /**
   * Запуск конвейера 2x. Вызывается только из обработчиков клика —
   * getDisplayMedia требует жеста пользователя (иначе браузер откажет сам).
   */
  const startUpscale = () => {
    const request = requestLiveUpscale();
    // "requested" — браузер показал вопрос, подпись даст статус starting
    if (request === "unsupported") showFlash(LIVE_FLASH.unsupported);
    else if (request !== "requested") showFlash(qualityFlash("4k"));
  };

  const pick = (id: Quality) => {
    setQuality(id);
    setOpen(false);
    if (id === "4k") startUpscale();
    else showFlash(qualityFlash(id));
  };

  // Тумблер отражает состояние качества: включённый режим (4k/HD+) →
  // «Оригинал»; «Оригинал» → запуск конвейера 2x. Важно не спутать:
  // поток может жить в grace-паузе (status live) при уже выключенном
  // качестве — тогда клик обязан ВКЛЮЧИТЬ, а не «выключать» повторно.
  const toggle = () => {
    setOpen(false);
    if (quality !== "original") {
      setQuality("original");
      showFlash(qualityFlash("original"));
      return;
    }
    setQuality("4k");
    startUpscale();
  };

  // Плеер лежит в #player-shell (см. WatchBox); на сервере его нет,
  // но flash там всегда null — до клика по кнопке портал не собирается
  const shell = flash ? document.getElementById("player-shell") : null;

  // Тон кнопки по режиму: выкл — серый, HD+ — акцент, «Апскейл» — accent-2
  const tone =
    quality === "4k"
      ? "bg-accent-2/12 text-accent-2 ring-accent-2/40 hover:bg-accent-2/20"
      : quality === "hd"
        ? "bg-accent/12 text-accent ring-accent/40 hover:bg-accent/20"
        : "bg-white/6 text-muted ring-white/10 hover:bg-white/12 hover:text-white";

  return (
    <div ref={boxRef} className={`relative ${className ?? ""}`}>
      <div
        className={`flex items-stretch overflow-hidden rounded-md ring-1 transition-colors ${tone}`}
      >
        {/* Тумблер: главная зона кнопки */}
        <button
          type="button"
          onClick={toggle}
          aria-pressed={quality !== "original"}
          className="btn-ghost flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" />
          </svg>
          <span>Апскейл</span>
        </button>

        {/* Шеврон: список режимов */}
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Качество изображения: ${active.label}`}
          className="btn-ghost flex items-center justify-center border-l border-white/10 px-1.5 hover:bg-white/10"
        >
          <svg
            viewBox="0 0 24 24"
            className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden
          >
            <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {open && (
        <div
          role="listbox"
          aria-label="Качество изображения"
          className="absolute right-0 top-[calc(100%+8px)] z-30 w-[272px] rounded-xl border border-line bg-[#0d0d15]/98 p-1.5 shadow-[0_28px_60px_-24px_rgba(0,0,0,1)] backdrop-blur-xl animate-fade-in"
        >
          <p className="px-2 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wider text-muted">
            Качество изображения
          </p>

          {QUALITY_OPTIONS.map((option) => {
            const selected = option.id === quality;
            return (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => pick(option.id)}
                className={`flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left transition-colors ${
                  selected
                    ? "bg-accent/15 ring-1 ring-accent/40"
                    : "hover:bg-white/6 focus-visible:bg-white/6"
                }`}
              >
                <span
                  className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full ring-1 ${
                    selected ? "bg-accent ring-accent" : "bg-white/6 ring-white/25"
                  }`}
                >
                  {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-white">
                    {option.label}
                    <span className="rounded bg-white/8 px-1 py-px text-[9px] font-extrabold uppercase tracking-wider text-muted ring-1 ring-white/10">
                      {option.badge}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted">
                    {option.hint}
                  </span>
                </span>
              </button>
            );
          })}

          <p className="mt-1 border-t border-line px-2 pb-1 pt-2 text-[10px] leading-snug text-muted/85">
            Источник Kodik отдаёт ролик до 1080p: апскейл 2x считает GPU прямо в браузере.
            Если картинка «задумается» — возьмите HD+.
          </p>

          {/* Технология апскейла — целиком на сайте, без внешних расширений */}
          <div className="mx-0.5 mt-1 flex items-start gap-2 rounded-lg bg-white/5 px-2 py-2 ring-1 ring-white/10">
            <svg
              viewBox="0 0 24 24"
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-2"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden
            >
              <rect x="7.5" y="7.5" width="9" height="9" rx="1.5" />
              <path d="M10 3.5v4M14 3.5v4M10 16.5v4M14 16.5v4M3.5 10h4M3.5 14h4M16.5 10h4M16.5 14h4" />
            </svg>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-xs font-bold text-white">
                Апскейл 2x внутри страницы
                <span className="rounded bg-white/8 px-1 py-px text-[9px] font-extrabold uppercase tracking-wider text-muted ring-1 ring-white/10">
                  GPU
                </span>
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-muted">
                При первом включении браузер один раз спросит, показывать ли вкладку —
                это стандартный доступ, тот же, что просят расширения. Дальше кадры плеера
                захватываются и режутся WebGL-шейдером (Catmull-Rom 2x + нерезкая маска)
                прямо поверх плеера. Без внешних расширений.
              </span>
            </span>
          </div>
        </div>
      )}

      {/* Подпись «режим применён» поверх самого плеера (портал в #player-shell) */}
      {flash &&
        shell &&
        createPortal(
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center p-3 animate-fade-in">
            <span className="rounded-lg bg-black/70 px-3 py-1.5 text-[11px] font-bold text-white ring-1 ring-white/20 backdrop-blur-md">
              {flash}
            </span>
          </div>,
          shell,
        )}
    </div>
  );
}
