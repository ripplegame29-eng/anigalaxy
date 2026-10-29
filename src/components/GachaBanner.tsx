import Link from "next/link";
import type { CSSProperties } from "react";
import { GameCard } from "@/components/cards/GameCard";
import { CATALOG } from "@/lib/cards/catalog";
import { RANKS } from "@/lib/cards/config";
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

const LADDER = [...RANKS].reverse().map((r) => ({ ...r, n: CATALOG.filter((c) => c.rank === r.id).length }));

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
        <i className="gb-glow" aria-hidden />
        {Array.from({ length: 7 }).map((_, i) => (
          <u key={i} className="gb-sp" aria-hidden style={{ ["--x" as string]: `${8 + i * 13}%`, ["--d" as string]: `${i * 0.8}s` } as CSSProperties} />
        ))}

        <span className="gb-kanji" aria-hidden>召喚</span>
        <span className="gb-petals" aria-hidden>
          {Array.from({ length: 9 }).map((_, i) => (
            <b key={i} style={{ ["--x" as string]: `${(i * 41 + 7) % 100}%`, ["--d" as string]: `${9 + (i % 4) * 2}s`, ["--w" as string]: `${-i * 1.3}s`, ["--s" as string]: `${8 + (i % 3) * 4}px` } as CSSProperties} />
          ))}
        </span>

        <div className="gb-altar" aria-hidden>
          <i className="gb-pool" />
          <i className="gb-ring" />
          <i className="gb-ring gb-ring-2" />
        </div>

        <div className="gb-left">
          <div className="gb-text">
            <p className="gb-eyebrow">Коллекция · Бои · Аукцион</p>
            <h2 className="gb-title">
              <span className="gb-t1">Гача</span>
              <em className="gb-t2">AniGalaxy</em>
            </h2>
            <i className="gb-orn" aria-hidden />
            <p className="gb-sub">Открой карточки любимых персонажей и собери свою галактику</p>
            <ul className="gb-ladder" aria-label="Редкость карт">
              {LADDER.map((r) => (
                <li key={r.id} style={{ ["--c" as string]: r.color } as CSSProperties} title={r.name}>
                  <i aria-hidden />
                  <b>{r.short}</b>
                  <span>{r.n}</span>
                </li>
              ))}
            </ul>
            <div className="gb-row">
              <Link href="/cards" className="gb-cta">
                <svg className="gb-spark" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden>
                  <path d="M12 1.5l2.2 6.6 6.8 2.2-6.8 2.2L12 19l-2.2-6.5L3 10.3l6.8-2.2L12 1.5z" />
                </svg>
                Открыть гачу
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
              <Link href="/cards#collection" className="gb-all">
                <b>{CATALOG.length}</b> карт в коллекции
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
