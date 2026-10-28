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
  const [useFallback, setUseFallback] = useState(false);
  const [failed, setFailed] = useState(false);
  const current = useFallback && fallback ? fallback : src;
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
      key={current}
      alt={alt}
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
      onError={() => (fallback && !useFallback && fallback !== src ? setUseFallback(true) : setFailed(true))}
    />
  );
}
