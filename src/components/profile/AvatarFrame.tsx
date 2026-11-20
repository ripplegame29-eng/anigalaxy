"use client";

/**
 * Аватар с рамкой — порт `avatar-frame.js`.
 *
 * Размеры заданы только токенами в `avatar-frame.css`, здесь их нет:
 *   xs — сводка, комментарии, меню
 *   sm — карточка в магазине
 *   md — панель предпросмотра, профиль
 *   lg — предмет дня
 *
 * Размер рамки считает CSS: `--av × --scale`, где `--scale` приходит из
 * данных рамки. Рамка рисуется поверх аватара и на всю коробку.
 */
import { useState } from "react";
import type { FrameItem } from "@/lib/cosmetics";

export type AvSize = "xs" | "sm" | "md" | "lg";

/** Аватара без рамки: просто круг */
export function AvatarCircle({
  nickname,
  avatar,
  className = "h-16 w-16",
  textClass = "text-lg",
  pmAvatar = false,
}: {
  nickname: string;
  avatar?: string;
  className?: string;
  textClass?: string;
  pmAvatar?: boolean;
}) {
  const initials =
    nickname.trim().split(/[\s_-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("") ||
    nickname.slice(0, 2);
  const [failed, setFailed] = useState<string | null>(null);
  const showImg = Boolean(avatar) && failed !== avatar;
  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full ${className}`}
      aria-hidden
      {...(pmAvatar ? { "data-pm-av": "" } : {})}
    >
      <span
        className={`relative grid h-full w-full place-items-center bg-gradient-to-br from-accent to-accent-2 text-center font-black leading-none text-white ${textClass}`}
      >
        {showImg ? (
          /* Размеры и позиция — инлайном: чужие правила для img (рамки
             магазина, превью) иначе сжимали картинку до половины круга */
          <img
            src={avatar}
            alt=""
            draggable={false}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", maxWidth: "none", objectFit: "cover", margin: 0, transform: "none" }}
            onError={() => setFailed(avatar ?? null)}
          />
        ) : (
          <span className="truncate px-1">{initials.toUpperCase()}</span>
        )}
      </span>
    </span>
  );
}

/**
 * Аватар с рамкой каталога. `frame` — запись из FRAMES; без неё выходит
 * просто круг с тонким ободком (вариант «без рамки»).
 */
export function AvatarFrame({
  nickname,
  avatar,
  frame,
  size = "md",
  className = "",
}: {
  nickname: string;
  avatar?: string;
  frame?: FrameItem;
  size?: AvSize;
  className?: string;
}) {
  const hasImage = Boolean(frame?.img);
  return (
    <span
      className={`ag-frame ag-frame--${size}${hasImage ? "" : " ag-frame--none"} ${className}`}
      data-fx={frame?.fx}
      /* --scale приходит из данных рамки, в CSS не зашит */
      style={{
        ["--scale" as string]: String(frame?.scale ?? 1.3),
        ["--fx" as string]: String(frame?.dx ?? 0),
        ["--fy" as string]: String(frame?.dy ?? 0),
      }}
    >
      <AvatarCircle nickname={nickname} avatar={avatar} className="ag-frame__avatar" textClass="" />
      {hasImage && (
        // eslint-disable-next-line @next/next/no-img-element -- анимированный SVG-оверлей: next/image его не проигрывает
        <img className="ag-frame__img" src={frame?.img} alt="" aria-hidden />
      )}
    </span>
  );
}
