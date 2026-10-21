"use client";

/** Арт награды «Оформление профиля» для клеток дорожки: мини-сцена сезона */
export function DecorArt({ size }: { size: "sm" | "md" | "lg" | "xl" }) {
  return (
    <span className={`pv2-art pv2-art-${size}`} aria-hidden>
      <i className="pv2-art-moon" />
      <i className="pv2-art-lamp" />
      <i className="pv2-art-lamp b" />
      <b>虚圏</b>
    </span>
  );
}
