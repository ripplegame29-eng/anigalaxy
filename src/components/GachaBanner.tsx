import Link from "next/link";
import type { CSSProperties } from "react";
import { GameCard } from "@/components/cards/GameCard";
import "../app/cards-card.css";
import "./gacha-banner.css";

/**
 * Витрина гачи на главной: широкая плашка с кристаллом, призывом и веером
 * наших карточек (от редкой к мифической в центре). Серверный компонент:
 * карточки рисует тот же GameCard, что и в коллекции.
 */
const FAN: { id: string; r: number; x: number; y: number; z: number }[] = [
  { id: "itachi-uchiha", r: -15, x: -2, y: 14, z: 1 },
  { id: "satoru-gojo", r: -7, x: -1, y: 4, z: 2 },
  { id: "ryomen-sukuna", r: 0, x: 0, y: -8, z: 5 },
  { id: "madara-uchiha", r: 7, x: 1, y: 4, z: 2 },
  { id: "monkey-d-luffy", r: 15, x: 2, y: 14, z: 1 },
];

export type GachaVariant = "aurora" | "sakura" | "crystal";

/**
 * Фон плашки: `aurora` — храм под луной с кристальными осколками поверх (по умолчанию),
 * `sakura` — только ночной сад, `crystal` — только осколки.
 */
export function GachaBanner({ variant = "aurora" }: { variant?: GachaVariant }) {
  return (
    <section aria-label="Гача AniGalaxy" className="gb" data-v={variant}>
      <div className="gb-frame">
        <div className="gb-bg" aria-hidden />
        <div className="gb-shade" aria-hidden />
        <span className="gb-shine" aria-hidden />
        {Array.from({ length: 7 }).map((_, i) => (
          <i key={i} className="gb-sp" aria-hidden style={{ ["--x" as string]: `${8 + i * 13}%`, ["--d" as string]: `${i * 0.8}s` } as CSSProperties} />
        ))}

        <div className="gb-left">
          <img className="gb-crystal" src="/banners/gacha-crystal.webp" alt="" width={325} height={328} draggable={false} />
          <div className="gb-text">
            <p className="gb-eyebrow">Коллекция · Бои · Аукцион</p>
            <h2 className="gb-title">
              Гача <em>AniGalaxy</em>
            </h2>
            <p className="gb-sub">Открой карточки любимых персонажей</p>
            <div className="gb-row">
              <Link href="/cards" className="gb-cta">
                Открыть гачу
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
              <Link href="/cards#collection" className="gb-all">
                Все карты
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </div>
      <Link href="/cards" className="gb-fan" aria-label="Открыть карточки">
        {FAN.map((c) => (
          <span key={c.id} className="gb-card" style={{ ["--r" as string]: `${c.r}deg`, ["--x" as string]: `${c.x}%`, ["--y" as string]: `${c.y}px`, zIndex: c.z } as CSSProperties}>
            <GameCard cardId={c.id} stats={false} />
          </span>
        ))}
      </Link>
    </section>
  );
}
