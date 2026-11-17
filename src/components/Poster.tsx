"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * Постер с graceful-fallback: если внешний CDN отдал битую картинку
 * или заблокировал хотлинк — рисуем стильную заглушку с названием.
 */
export function Poster({
  src,
  alt,
  title,
  sizes = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw",
  className = "",
  priority = false,
  fallback,
}: {
  src?: string;
  alt: string;
  title?: string;
  sizes?: string;
  className?: string;
  priority?: boolean;
  /** Вторая попытка, если основная картинка не загрузилась */
  fallback?: string;
}) {
  /* Шаги: 0 — основной через оптимизатор, 1 — основной напрямую из браузера
     (если сервер не достучался до CDN), 2 — запасной через оптимизатор, 3 — запасной напрямую, 4 — заглушка */
  const [step, setStep] = useState(0);
  const hasFallback = Boolean(fallback) && fallback !== src;
  const current = step < 2 ? src : fallback;
  const direct = step === 1 || step === 3;
  const failed = step >= 4;
  const [loaded, setLoaded] = useState(false);

  if (!current || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-[linear-gradient(140deg,#171726,#101018_60%,#1d1526)] ${className}`}
        aria-hidden
      >
        <span className="px-4 text-center text-4xl font-extrabold text-white/10">
          {(title ?? alt).slice(0, 1).toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <Image
      src={current}
      key={`${current}:${step}`}
      alt={alt}
      unoptimized={direct}
      fill
      sizes={sizes}
      priority={priority}
      loading={priority ? "eager" : "lazy"}
      className={`${className} ui-img${loaded ? " is-loaded" : ""}`}
      ref={(el) => {
        // Картинка могла загрузиться до гидрации — тогда onLoad уже не придёт
        if (el && el.complete && el.naturalWidth > 0) setLoaded(true);
      }}
      onLoad={() => setLoaded(true)}
      onError={() => {
        setLoaded(false);
        setStep((value) => {
          const next = value + 1;
          if (next >= 2 && next < 4 && !hasFallback) return 4;
          return next;
        });
      }}
    />
  );
}
