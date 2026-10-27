"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { claimGift, useProfile, type ProfileGift } from "@/lib/profile";
import { timeAgo } from "@/lib/history";
import { syncLegacyDelta } from "@/lib/progression/service";
import { useLevelInfo } from "@/lib/progression/events";
import { PROGRESSION_CONFIG } from "@/lib/progression/progression.config";
import "./gifts.css";

/**
 * Страница «Подарки» (/gifts): награды за новые уровни и события профиля.
 * Каждый подарок — коробка: нажмите, и она раскроется с вспышкой, а AC
 * упадут на баланс. Сверху сводка, фильтр и подсказка про следующий подарок.
 */

type Filter = "all" | "wait" | "done";

const OPEN_MS = 720;
const STAGGER_MS = 240;
const SPARKS = Array.from({ length: 10 }, (_, i) => i);

function Box({ open, done, size = 84 }: { open?: boolean; done?: boolean; size?: number }) {
  return (
    <svg
      viewBox="0 0 96 96"
      width={size}
      height={size}
      className={`gf-box${open ? " is-open" : ""}${done ? " is-done" : ""}`}
      aria-hidden
    >
      <defs>
        <linearGradient id="gf-b1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5aa2ff" />
          <stop offset="1" stopColor="#1b4fd6" />
        </linearGradient>
        <linearGradient id="gf-b2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7cc0ff" />
          <stop offset="1" stopColor="#2f6cf0" />
        </linearGradient>
        <linearGradient id="gf-r" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe7a8" />
          <stop offset="1" stopColor="#ffa93d" />
        </linearGradient>
      </defs>
      <ellipse cx="48" cy="88" rx="30" ry="5" fill="#000" opacity=".35" />
      <g className="gf-body">
        <rect x="16" y="44" width="64" height="40" rx="7" fill="url(#gf-b1)" />
        <rect x="16" y="44" width="64" height="12" rx="6" fill="#000" opacity=".16" />
        <rect x="43" y="44" width="10" height="40" fill="url(#gf-r)" />
      </g>
      <g className="gf-lid">
        <rect x="11" y="30" width="74" height="18" rx="6" fill="url(#gf-b2)" />
        <rect x="43" y="30" width="10" height="18" fill="url(#gf-r)" />
        <path d="M48 30c-3-9-14-12-17-6s6 8 17 6zM48 30c3-9 14-12 17-6s-6 8-17 6z" fill="url(#gf-r)" />
        <circle cx="48" cy="30" r="4" fill="#ffd27a" />
      </g>
    </svg>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function Coin({ size = 20 }: { size?: number }) {
  return <Image src="/coin.png" alt="" aria-hidden width={size} height={size} className="gf-coin" />;
}

export function GiftsView() {
  const profile = useProfile();
  const info = useLevelInfo();
  const [filter, setFilter] = useState<Filter>("all");
  const [opening, setOpening] = useState<string[]>([]);
  const [popped, setPopped] = useState<Record<string, number>>({});
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const list = timers.current;
    return () => list.forEach((id) => window.clearTimeout(id));
  }, []);

  const sorted = useMemo<ProfileGift[]>(() => [...profile.gifts].sort((a, b) => b.at - a.at), [profile.gifts]);
  const pending = useMemo(() => sorted.filter((gift) => !gift.claimed), [sorted]);
  const taken = useMemo(() => sorted.filter((gift) => gift.claimed), [sorted]);
  const waitTotal = pending.reduce((sum, gift) => sum + gift.coins, 0);
  const takenTotal = taken.reduce((sum, gift) => sum + gift.coins, 0);

  const visible = filter === "wait" ? pending : filter === "done" ? taken : sorted;

  /** Раскрыть коробку: анимация, затем зачисление AC */
  const openGift = useCallback((gift: ProfileGift, delay = 0) => {
    const start = window.setTimeout(() => {
      setOpening((prev) => (prev.includes(gift.id) ? prev : [...prev, gift.id]));
      const done = window.setTimeout(() => {
        claimGift(gift.id);
        syncLegacyDelta();
        setOpening((prev) => prev.filter((id) => id !== gift.id));
        setPopped((prev) => ({ ...prev, [gift.id]: gift.coins }));
        const clear = window.setTimeout(() => {
          setPopped((prev) => {
            const next = { ...prev };
            delete next[gift.id];
            return next;
          });
        }, 1500);
        timers.current.push(clear);
      }, OPEN_MS);
      timers.current.push(done);
    }, delay);
    timers.current.push(start);
  }, []);

  const openAll = () => {
    pending.forEach((gift, i) => openGift(gift, i * STAGGER_MS));
  };

  const nextLevel = info.level + 1;
  const gift = PROGRESSION_CONFIG.economy.levelGiftAc;

  const tabs: { id: Filter; label: string; n: number }[] = [
    { id: "all", label: "Все", n: sorted.length },
    { id: "wait", label: "Ждут", n: pending.length },
    { id: "done", label: "Забраны", n: taken.length },
  ];

  return (
    <div className="gf-page">
      <div className="gf-bg" aria-hidden>
        <i className="gf-aur a" />
        <i className="gf-aur b" />
        <i className="gf-aur c" />
        <i className="gf-grid" />
        {Array.from({ length: 16 }, (_, i) => (
          <i key={i} className="gf-conf" style={{ ["--x" as string]: `${(i * 37 + 8) % 100}%`, ["--d" as string]: `${14 + ((i * 5) % 12)}s`, ["--w" as string]: `${-((i * 3.1) % 18)}s`, ["--s" as string]: 4 + (i % 4) * 2 }} />
        ))}
      </div>

      <main className="gf">
        <header className="gf-head">
          <h1>Подарки</h1>
          <p>Награды за новые уровни и события профиля</p>
        </header>

        {/* ------------------------------ Витрина ------------------------------ */}
        <section className="gf-hero" aria-label="Сводка">
          <div className="gf-hero-l">
            <span className="gf-eyebrow">{pending.length > 0 ? `Ждут вас: ${pending.length}` : "Всё забрано"}</span>
            <div className="gf-sum">
              <Coin size={42} />
              <b>{waitTotal.toLocaleString("ru-RU")}</b>
              <small>AC</small>
            </div>
            <p>
              {pending.length > 0
                ? "Нажмите на коробку, чтобы открыть подарок, или откройте все сразу."
                : "Новые подарки появятся, когда вы получите следующий уровень."}
            </p>
            <div className="gf-act">
              {pending.length > 0 ? (
                <button type="button" className="gf-all" onClick={openAll} disabled={opening.length > 0}>
                  Открыть все
                  <span>+{waitTotal}</span>
                </button>
              ) : (
                <Link href="/quests" className="gf-all gf-all--ghost">
                  Квесты дня
                </Link>
              )}
            </div>
          </div>
          <div className="gf-hero-r" aria-hidden>
            <span className="gf-halo" />
            <Box open={opening.length > 0} size={190} />
          </div>
        </section>

        <section className="gf-stats" aria-label="Статистика">
          <div>
            <small>Подарков получено</small>
            <b>{sorted.length}</b>
          </div>
          <div>
            <small>Забрано AC</small>
            <b>{takenTotal.toLocaleString("ru-RU")}</b>
          </div>
          <div>
            <small>Ваш уровень</small>
            <b>{info.level}</b>
          </div>
        </section>

        <section className="gf-next">
          <div className="gf-next-t">
            <b>Следующий подарок — за уровень {nextLevel}</b>
            <small>
              Осталось {info.left.toLocaleString("ru-RU")} XP · награда +{gift} AC
            </small>
          </div>
          <div className="gf-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(info.percent)}>
            <i style={{ width: `${Math.max(3, Math.min(100, info.percent))}%` }} />
          </div>
        </section>

        {/* ------------------------------ Коллекция ----------------------------- */}
        <div className="gf-bar2">
          <div className="gf-tabs" data-t={filter} role="tablist">
            {tabs.map((tab) => (
              <button key={tab.id} type="button" role="tab" aria-selected={filter === tab.id} onClick={() => setFilter(tab.id)}>
                {tab.label}
                <em>{tab.n}</em>
              </button>
            ))}
          </div>
        </div>

        {sorted.length === 0 ? (
          <section className="gf-empty">
            <Box size={110} done />
            <b>Подарков пока нет</b>
            <p>Они приходят за новые уровни. Смотрите аниме и выполняйте квесты — коробки появятся здесь.</p>
            <Link href="/levels" className="gf-link">
              Как получить уровни
            </Link>
          </section>
        ) : visible.length === 0 ? (
          <section className="gf-empty gf-empty--s">
            <b>{filter === "wait" ? "Всё уже забрано" : "Пока ничего не забрано"}</b>
          </section>
        ) : (
          <ul className="gf-grid2">
            {visible.map((item, i) => {
              const isOpening = opening.includes(item.id);
              const pop = popped[item.id];
              return (
                <li
                  key={item.id}
                  className={`gf-card${item.claimed ? " done" : " new"}${isOpening ? " opening" : ""}`}
                  style={{ ["--i" as string]: Math.min(i, 12) }}
                >
                  <div className="gf-art">
                    <span className="gf-glow2" />
                    <Box open={isOpening} done={item.claimed} />
                    {isOpening && SPARKS.map((n) => <i key={n} className="gf-spark" style={{ ["--a" as string]: `${n * 36}deg` }} />)}
                    {pop ? <span className="gf-pop">+{pop}</span> : null}
                  </div>
                  <div className="gf-info">
                    <b>{item.name}</b>
                    <small>
                      {item.hint} · {timeAgo(item.at)}
                    </small>
                  </div>
                  {item.claimed ? (
                    <span className="gf-got">
                      <Check />+{item.coins} AC
                    </span>
                  ) : (
                    <button type="button" className="gf-take" disabled={isOpening} onClick={() => openGift(item)}>
                      {isOpening ? "Открываем…" : "Открыть"}
                      {!isOpening && <span>+{item.coins}</span>}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
