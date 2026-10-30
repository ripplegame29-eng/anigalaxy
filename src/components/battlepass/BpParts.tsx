"use client";

/**
 * Новая шапка и блок покупки боевого пропуска (макет «Hueco Mundo»):
 * вкладки «Награды / Задания», кольцо уровня, плитки, предложение пропуска.
 * Данные приходят из BattlePassView — здесь только оформление.
 */

import { BpIcon } from "./BpIcons";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { plural } from "@/components/battlepass/model";
import { BATTLEPASS } from "@/lib/battlepass/logic";

export type BpTab = "rewards" | "tasks";

export interface BpHeroProps {
  tab: BpTab;
  onTab: (tab: BpTab) => void;
  level: number;
  maxLevel: number;
  /** Прогресс внутри уровня, 0…1 */
  fraction: number;
  into: number;
  need: number;
  xpLeftToFinal: number;
  claimables: number;
  totalCards: number;
  missionsDone: number;
  missionsTotal: number;
  heroRef: React.RefObject<HTMLElement | null>;
}

const SEASON = BATTLEPASS.name.split("·").map((part) => part.trim());

export function BpHero(props: BpHeroProps) {
  const { tab, onTab, level, maxLevel, fraction, into, need, xpLeftToFinal, claimables, totalCards, missionsDone, missionsTotal, heroRef } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDaysLeft(Math.max(0, Math.ceil((BATTLEPASS.to - Date.now()) / 86_400_000)));
      setReady(true);
    }, 250);
    return () => window.clearTimeout(t);
  }, []);

  /* Песчинки на canvas + параллакс фона от курсора */
  useEffect(() => {
    const hero = heroRef.current;
    const cv = canvasRef.current;
    if (!hero || !cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(hover: none), (max-width: 767px)").matches;
    const count = coarse ? 28 : 80;
    let W = 0;
    let H = 0;
    const resize = () => {
      W = cv.width = cv.offsetWidth;
      H = cv.height = cv.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    const P = Array.from({ length: count }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.8 + 0.3,
      v: Math.random() * 0.0009 + 0.0003,
      d: Math.random() * 0.0003 + 0.0001,
      o: Math.random() * 0.5 + 0.15,
    }));
    let raf = 0;
    let visible = true;
    const io = new IntersectionObserver((e) => {
      visible = e[0]?.isIntersecting ?? true;
      if (visible && !still && !raf) raf = requestAnimationFrame(frame);
    });
    io.observe(hero);
    function frame() {
      raf = 0;
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      for (const p of P) {
        if (!still) {
          p.x += p.v;
          p.y += p.d;
          if (p.x > 1.02) {
            p.x = -0.02;
            p.y = Math.random();
          }
          if (p.y > 1) p.y = 0;
        }
        ctx.fillStyle = `rgba(225,240,250,${p.o})`;
        ctx.beginPath();
        ctx.arc(p.x * W, p.y * H, p.r, 0, 6.3);
        ctx.fill();
      }
      if (!still && visible) raf = requestAnimationFrame(frame);
    }
    frame();
    const onMove = (e: PointerEvent) => {
      const r = hero.getBoundingClientRect();
      hero.style.setProperty("--mx", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
      hero.style.setProperty("--my", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
    };
    if (!still && !coarse) hero.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("resize", resize);
      hero.removeEventListener("pointermove", onMove);
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [heroRef]);

  const pct = level >= maxLevel ? 100 : Math.round(fraction * 100);

  return (
    <header className="bp2-hero" ref={heroRef as React.RefObject<HTMLElement>}>
      <div className="bp2-bgimg" />
      <div className="bp2-fog" />
      <div className="bp2-fog f2" />
      <div className="bp2-fl" />
      <canvas className="bp2-sand" ref={canvasRef} aria-hidden />
      <div className="bp2-w">
        <div className="bp2-seg" role="tablist" aria-label="Разделы пропуска">
          <button type="button" role="tab" aria-selected={tab === "rewards"} className="bp2-sg" onClick={() => onTab("rewards")}>
            <svg viewBox="0 0 24 24" aria-hidden><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3" /></svg>
            <span>
              <b>Награды</b>
              <small>Уровень {level} из {maxLevel}</small>
            </span>
          </button>
          <button type="button" role="tab" aria-selected={tab === "tasks"} className="bp2-sg" onClick={() => onTab("tasks")}>
            <svg viewBox="0 0 24 24" aria-hidden><path d="M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" /></svg>
            <span>
              <b>Задания</b>
              <small>Выполнено {missionsDone} из {missionsTotal}</small>
            </span>
          </button>
        </div>

        <div className="bp2-hg">
          <div className="bp2-lv">
            <svg viewBox="0 0 210 210" aria-hidden>
              <circle cx="105" cy="105" r="96" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="8" />
              <circle
                cx="105"
                cy="105"
                r="96"
                fill="none"
                stroke="url(#bp2g)"
                strokeWidth="8"
                strokeLinecap="round"
                pathLength={100}
                strokeDasharray={`${ready ? pct : 0} 100`}
                style={{ transition: "stroke-dasharray 1.6s cubic-bezier(.2,.8,.2,1)" }}
              />
              <circle cx="105" cy="105" r="104" fill="none" stroke="rgba(255,150,170,.35)" strokeWidth="5" strokeDasharray="0.4 2.7" />
              <g className="bp2-head" style={{ transform: `rotate(${ready ? pct * 3.6 : 0}deg)` }}>
                <circle cx="201" cy="105" r="9" fill="url(#bp2hd)" />
                <circle cx="201" cy="105" r="3.2" fill="#fff" />
              </g>
              <defs>
                <radialGradient id="bp2hd">
                  <stop offset="0" stopColor="#fff" />
                  <stop offset=".4" stopColor="#ff7a94" stopOpacity=".9" />
                  <stop offset="1" stopColor="#ff3d62" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="bp2g">
                  <stop offset="0" stopColor="#ff9fb4" />
                  <stop offset=".6" stopColor="#ff3d62" />
                  <stop offset="1" stopColor="#ffd9a0" />
                </linearGradient>
              </defs>
            </svg>
            <div className="in">
              <div>
                <b>{level}</b>
                <small>из {maxLevel}</small>
              </div>
            </div>
          </div>

          <div className="bp2-hmain">
            <p className="bp2-kick">Боевой пропуск · {SEASON[0]}</p>
            <h1>{SEASON[1] ?? SEASON[0]}</h1>
            <p className="bp2-sub">
              Сто уровней, две линии наград — бесплатная и пропуск — и весь XP сайта, который идёт в сезон один в один.
              Забирай аникойны, титулы и рамки: редкие предметы доступны только в этом сезоне.
            </p>

            <div className="bp2-pr">
              <div>
                <span>
                  {level >= maxLevel
                    ? "Максимальный уровень"
                    : `${into.toLocaleString("ru-RU")} / ${need.toLocaleString("ru-RU")} XP до уровня ${level + 1}`}
                </span>
                <b>{pct}%</b>
              </div>
              <div className="bp2-bar">
                <i style={{ width: `${ready ? pct : 0}%` }} />
              </div>
            </div>

            <div className="bp2-tiles">
              <div className="bp2-tile">
                <span><BpIcon name="flag" size={26} /></span>
                <div>
                  <small>До финала</small>
                  <b>{xpLeftToFinal.toLocaleString("ru-RU")} XP</b>
                </div>
              </div>
              <div className={`bp2-tile${claimables > 0 ? " hot" : ""}`}>
                <span><BpIcon name="gift" /></span>
                <div>
                  <small>К получению</small>
                  <b>
                    {claimables} {plural(claimables, "награда", "награды", "наград")}
                  </b>
                </div>
              </div>
              <div className="bp2-tile">
                <span><BpIcon name="hourglass" /></span>
                <div>
                  <small>{daysLeft === null ? "Сезон" : "До конца сезона"}</small>
                  <b>{daysLeft === null ? `${totalCards} наград` : `${daysLeft} дн.`}</b>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

/* ----------------------------- Предложение ------------------------------ */

const SEASON_PRICE = 1190;

export function BpOffer({
  premium,
  level,
  totals,
}: {
  premium: boolean;
  level: number;
  totals: { ac: number; bpXp: number; items: number; levels: number };
}) {
  if (premium) {
    return (
      <div className="bp2-card bp2-offer on">
        <div>
          <span className="bp2-gk">Лента пропуска</span>
          <h2>Пропуск активен</h2>
          <p className="bp2-offer-p">
            Нижняя лента открыта целиком: {totals.levels} наградных уровней, {totals.items} предметов и{" "}
            {totals.ac.toLocaleString("ru-RU")} AC сверх бесплатной. Забирайте на дорожке — ничего не сгорит после сезона.
          </p>
        </div>
        <div className="bp2-buy">
          <small>Подписка AniGalaxy Premium</small>
          <Link href="/premium" className="bp2-btn ghost">
            Управление подпиской
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className="bp2-card bp2-offer">
      <div>
        <span className="bp2-gk">Вторая лента наград</span>
        <h2>Откройте полный трек сезона</h2>
        <div className="bp2-pk">
          <div>
            <i><BpIcon name="puzzle" size={24} /></i>
            <span>
              {totals.items} {plural(totals.items, "предмет", "предмета", "предметов")} косметики — рамки и титулы только за этот сезон
            </span>
          </div>
          <div>
            <i><BpIcon name="gem" size={24} /></i>
            <span>
              Нижняя лента на {totals.levels} {plural(totals.levels, "уровне", "уровнях", "уровнях")} — выдаётся сразу, вместе с пройденными
            </span>
          </div>
          <div>
            <i><BpIcon name="crown" size={24} /></i>
            <span>
              {totals.ac.toLocaleString("ru-RU")} AC и {totals.bpXp.toLocaleString("ru-RU")} XP сезона по ходу трека
            </span>
          </div>
          <div>
            <i>⌛</i>
            <span>Награды не сгорают после конца сезона — заберёте, когда удобно</span>
          </div>
        </div>
      </div>
      <div className="bp2-buy">
        <small>Сезонный пропуск · {SEASON[1] ?? SEASON[0]}</small>
        <div className="bp2-price">
          {SEASON_PRICE.toLocaleString("ru-RU")} <small>₽</small>
        </div>
        <div className="bp2-old">
          <span>Разовый платёж · весь сезон</span>
          <span>{level > 1 ? `Ур. ${level} выдадим сразу` : "Награды сразу"}</span>
        </div>
        <Link href="/battlepass/buy" className="bp2-btn gold">
          Купить пропуск
        </Link>
        <Link href="/premium" className="bp2-btn ghost">
          Что даёт Premium
        </Link>
      </div>
    </div>
  );
}
