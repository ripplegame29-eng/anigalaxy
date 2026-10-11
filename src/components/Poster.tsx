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
}: {
  src?: string;
  alt: string;
  title?: string;
  sizes?: string;
  className?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
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
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      loading={priority ? "eager" : "lazy"}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
