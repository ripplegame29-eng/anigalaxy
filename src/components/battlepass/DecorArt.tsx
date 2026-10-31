"use client";

import type { CSSProperties } from "react";

/** Арт награды «Оформление профиля» для клеток дорожки и витрины пропуска: мини-сцена Хуэко Мундо */
export function DecorArt({ size }: { size: "sm" | "md" | "lg" | "xl" }) {
  return (
    <span className={`pv2-art pv2-art-${size}`} aria-hidden>
      {/* Живописный фон: пейзаж Хуэко Мундо с тории и багровой сакурой */}
      <span className="pv2-art-bg" />
      {/* Атмосферный багровый туман и виньетка */}
      <span className="pv2-art-fog" />
      {/* Тонкий кровавый серп луны */}
      <span className="pv2-art-crescent" />
      {/* Парящие багровые лепестки-искры */}
      <span className="pv2-art-petals">
        <i style={{ "--i": 0 } as CSSProperties} />
        <i style={{ "--i": 1 } as CSSProperties} />
        <i style={{ "--i": 2 } as CSSProperties} />
        <i style={{ "--i": 3 } as CSSProperties} />
      </span>
      {/* Угловые скобки в стиле интерфейса пропуска */}
      <i className="pv2-art-c tl" />
      <i className="pv2-art-c br" />
      {/* Стеклянный шильдик с кандзи и подписью */}
      <span className="pv2-art-badge">
        <b>虚圏</b>
        {size !== "sm" && <small>HUECO MUNDO</small>}
      </span>
    </span>
  );
}
