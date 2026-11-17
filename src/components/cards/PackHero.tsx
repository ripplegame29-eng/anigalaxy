"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { cardDef } from "@/lib/cards/catalog";
import { DUST_VALUE, PACK, RANKS } from "@/lib/cards/config";
import { GameCard } from "./GameCard";
import { Ico } from "./icons";

/** Постоянная витрина: от обычной до мифической */
export const FAN_IDS = ["roronoa-zoro", "satoru-gojo", "ryomen-sukuna", "ichigo-kurosaki", "rock-lee"];

/* смещения карт веера по расстоянию от центральной */
const PX = [0, 122, 224];
const PY = [0, 30, 78];
const PR = [0, 7, 15];
const PS = [1.15, 0.95, 0.8];
const PO = [1, 1, 0.92];
const PB = [1, 0.82, 0.62];

const pct = (w: number) => String(w / 10).replace(".", ",");

/**
 * Шапка вкладки «Паки»: заголовок и веер из пяти карт. Центральная карта
 * подсвечивает сцену своим цветом, веер листается сам, по клику или точками.
 * Клик по центральной карте открывает просмотр.
 */
export function PackHero({ onShop, onWeek, onLook }: { onShop: () => void; onWeek: () => void; onLook: (i: number) => void }) {
  const ids = FAN_IDS.filter((id) => !!cardDef(id));
  const n = ids.length;
  const [cur, setCur] = useState(Math.min(2, n - 1));
  const hov = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  const go = (i: number) => setCur(((i % n) + n) % n);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    window.clearInterval(timer.current);
    timer.current = window.setInterval(() => {
      if (!hov.current && !document.hidden) setCur((c) => (c + 1) % n);
    }, 4800);
    return () => window.clearInterval(timer.current);
  }, [cur, n]);

  const tilt = (e: PointerEvent<HTMLElement>) => {
    const c = (e.target as HTMLElement).closest<HTMLElement>(".fc2");
    if (!c) return;
    const r = c.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    c.style.transform = `perspective(700px) rotateY(${((x - 0.5) * 22).toFixed(1)}deg) rotateX(${((0.5 - y) * 22).toFixed(1)}deg)`;
    c.style.setProperty("--mx", `${x * 100}%`);
    c.style.setProperty("--my", `${y * 100}%`);
  };
  const untilt = (e: PointerEvent<HTMLElement>) => {
    const c = (e.target as HTMLElement).closest<HTMLElement>(".fc2");
    if (c) c.style.transform = "";
  };

  const curDef = cardDef(ids[cur]);
  const glow = curDef ? RANKS[curDef.rank].color : "#3b82f6";

  return (
    <section className="cg2-hero" aria-label="Паки AniGalaxy">
      <div className="cg2-hero-l">
        <span className="cg2-eye">Гача AniGalaxy</span>
        <h1>
          Откройте пак<em>найдите героя</em>
        </h1>
        <p>В каждом паке три карты на выбор: оставляете лучшую, остальные превращаются в пыль. Гарантии копятся, пока вы открываете паки подряд.</p>
        <div className="cg2-hero-act">
          <button type="button" className="cg-btn pri" onClick={onShop}>
            Открыть пак <Ico name="right" size={16} />
          </button>
          <button type="button" className="cg-btn" onClick={onWeek}>
            Карта недели
          </button>
        </div>
      </div>

      <div
        className="fan"
        style={{ ["--gc" as string]: glow } as CSSProperties}
        role="list"
        aria-label="Карты AniGalaxy"
        onPointerEnter={() => (hov.current = true)}
        onPointerLeave={() => (hov.current = false)}
        onPointerMove={tilt}
        onPointerOut={untilt}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(cur + 1);
          if (e.key === "ArrowLeft") go(cur - 1);
        }}
      >
        <i className="fgrid" aria-hidden />
        <i className="fglow" aria-hidden />
        <i className="ffl" aria-hidden />
        {ids.map((id, i) => {
          const d = cardDef(id);
          if (!d) return null;
          const r = RANKS[d.rank];
          const dd = ((i - cur + n + Math.floor(n / 2)) % n) - Math.floor(n / 2);
          const a = Math.min(Math.abs(dd), 2);
          const sg = dd < 0 ? -1 : 1;
          const style = {
            ["--x" as string]: `${sg * PX[a]}px`,
            ["--y" as string]: `${PY[a]}px`,
            ["--r" as string]: `${sg * PR[a]}deg`,
            ["--s" as string]: PS[a],
            ["--z" as string]: 10 - a * 3,
            ["--o" as string]: PO[a],
            ["--b" as string]: PB[a],
            ["--dl" as string]: `${-i * 1.3}s`,
            ["--c" as string]: r.color,
          } as CSSProperties;
          return (
            <button
              key={id}
              type="button"
              role="listitem"
              className={`fk2${dd === 0 ? " c" : ""}`}
              style={style}
              onClick={() => (dd === 0 ? onLook(i) : go(i))}
              aria-label={dd === 0 ? `${d.name}, ${r.name}. Открыть` : `Показать: ${d.name}, ${r.name}`}
            >
              <span className="fl">
                <span className="fc2">
                  <GameCard cardId={id} stats={false} />
                  <i className="rim" aria-hidden />
                </span>
              </span>
              <span className="lab">
                <b style={{ color: r.color }}>{r.name}</b>
                <span>
                  шанс {pct(PACK.weights[d.rank])}% · {DUST_VALUE[d.rank]} пыли
                </span>
              </span>
            </button>
          );
        })}
        <div className="fdots">
          {ids.map((id, i) => (
            <button key={id} type="button" className={i === cur ? "on" : undefined} aria-label={`Карта ${i + 1}`} aria-current={i === cur} onClick={() => go(i)} />
          ))}
        </div>
      </div>
    </section>
  );
}
