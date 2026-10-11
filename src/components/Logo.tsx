"use client";

import Link from "next/link";
import { LogoMark } from "@/components/LogoMark";
import { progressEmit } from "@/lib/progression/events";

/**
 * Логотип AniGalaxy: знак-монограмма (инлайн-SVG, без растра и рамок) + вордмарк.
 * Свечение — drop-shadow по альфа-силуэту знака, на hover усиливается.
 *
 * Пасхалка (§12.7): каждый клик по знаку шлёт EASTER_EGG — движок считает
 * их в `flags["egg:logo"]`, седьмой открывает секрет «Хранитель пасхалок».
 * Клик не мешает переходу на главную.
 */
export function Logo({ compact = false }: { compact?: boolean }) {
  const onEggClick = () => {
    progressEmit({ type: "EASTER_EGG", target: "logo" });
  };

  return (
    <Link
      href="/"
      onClick={onEggClick}
      className="group flex items-center gap-2.5"
      aria-label="AniGalaxy — на главную"
    >
      <LogoMark className="h-9 w-[62px] shrink-0 drop-shadow-[0_0_10px_rgba(31,123,255,.35)] transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-110 group-hover:drop-shadow-[0_0_14px_rgba(0,200,255,.7)]" />
      {!compact && (
        <span className="font-accent text-lg font-extrabold tracking-tight">
          <span className="text-white">Ani</span>
          <span className="text-gradient-accent">Galaxy</span>
        </span>
      )}
    </Link>
  );
}
