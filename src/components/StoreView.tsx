"use client";

import { openCheckout } from "@/lib/checkout";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { openAuthDialog } from "@/lib/auth-dialog";
import { useAccount } from "@/lib/use-account";
import { useProgress } from "@/lib/progression/events";
import { PROGRESSION_CONFIG } from "@/lib/progression/progression.config";
import { sourceLabel } from "@/lib/progression/labels";
import type { ProgressDoc } from "@/lib/progression/types";
import { timeAgo } from "@/lib/history";
import { addCoins } from "@/lib/profile";
import { dailyCalendarAvgAc } from "@/lib/daily-login";
import { ShopSection } from "@/components/profile/ProfileSections";
import { PremiumChip } from "@/components/profile/PremiumChip";

/** Свет под курсором для карточек `.sp-card` / `.sp-pack`: одна подписка на всю витрину */
function spotlight(event: React.PointerEvent<HTMLElement>) {
  const card = (event.target as HTMLElement).closest<HTMLElement>(".sp-card, .sp-pack");
  if (!card) return;
  const rect = card.getBoundingClientRect();
  card.style.setProperty("--mx", `${event.clientX - rect.left}px`);
  card.style.setProperty("--my", `${event.clientY - rect.top}px`);
}

/** Искры, плывущие вверх по фону (значения фиксированы — без random, иначе гидратация) */
const SPARKS = [
  { "--x": 6, "--s": "5px", "--d": "14s", "--w": "0s" },
  { "--x": 17, "--s": "3px", "--d": "11s", "--w": "-4s" },
  { "--x": 29, "--s": "6px", "--d": "17s", "--w": "-9s" },
  { "--x": 41, "--s": "4px", "--d": "12s", "--w": "-2s" },
  { "--x": 53, "--s": "5px", "--d": "15s", "--w": "-7s" },
  { "--x": 64, "--s": "3px", "--d": "10s", "--w": "-5s" },
  { "--x": 75, "--s": "6px", "--d": "18s", "--w": "-11s" },
  { "--x": 86, "--s": "4px", "--d": "13s", "--w": "-1s" },
  { "--x": 94, "--s": "5px", "--d": "16s", "--w": "-8s" },
];

const CHIP =
  "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-black uppercase tracking-wide ring-1";

/**
 * Шапка `/store`: баланс AC, уровень и серия — витрина с нашим
 * функционалом прогресса, ниже — общий каталог `ShopSection`
 */
export function StoreView() {
  const account = useAccount();
  const progress = useProgress();

  return (
    <div className="ag-root sp-root space-y-6" onPointerMove={spotlight}>
      <div className="sp-bg" aria-hidden>
        <i className="sp-blob sp-b1" />
        <i className="sp-blob sp-b2" />
        <i className="sp-blob sp-b3" />
        <i className="sp-grid" />
        <i className="sp-stars" />
        <i className="sp-beam" />
        <span className="sp-sparks">
          {SPARKS.map((sp, i) => (
            <b key={i} style={sp as React.CSSProperties} />
          ))}
        </span>
      </div>
      {/* --------------------------- Герой витрины --------------------------- */}
      {/* Ник, Premium, уровень и полосу XP показывает каталог ниже — здесь
          только то, чего в нём нет: название витрины и пояснение. Держать
          одно и то же дважды на странице незачем. */}
      <section className="ag-card sp-hero relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-accent/20 via-accent-2/10 to-violet-500/12"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-accent/16 blur-3xl"
          aria-hidden
        />

        <div className="relative p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-accent-2 to-accent px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white shadow-[0_12px_28px_-14px_rgba(31,123,255,1)]">
                Витрина AniGalaxy
              </span>
              <h1 className="ag-shop-h1 sp-h1 mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
                Магазин
              </h1>
              <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted">
                Теги, титулы, фоны, рамки и эффекты за AC. AC копятся за вход, квесты и
                активность — покупки списываются только движком прогресса.
              </p>
            </div>

            {/* Гость без аккаунта: вход и регистрация, для владельца — ссылки */}
            <div className="flex flex-col items-start gap-2.5 sm:items-end">
              {account ? (
                <div className="flex flex-wrap gap-2">
                  <Link href="/profile" className={`${CHIP} bg-white/8 text-muted ring-white/15 hover:text-white`}>
                    Мой профиль
                  </Link>
                  <Link href="/quests" className={`${CHIP} bg-mint/12 text-mint ring-mint/35 hover:bg-mint/20`}>
                    Квесты дня
                  </Link>
                  <Link href="/premium" aria-label="Premium" className="transition hover:brightness-125">
                    <PremiumChip />
                  </Link>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openAuthDialog("login")}
                    className="btn-primary rounded-xl px-4 py-2 text-xs font-bold text-white"
                  >
                    Войти
                  </button>
                  <button
                    type="button"
                    onClick={() => openAuthDialog("register")}
                    className="btn-ghost rounded-xl px-4 py-2 text-xs font-semibold text-muted hover:text-white"
                  >
                    Создать аккаунт
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ------------- Плашка: баланс / заработать / история (эталон) -------- */}
      <AcOverviewBar progress={progress} />

      {/* ---------- Плашка «Пополнение кассы» с котом (по эталону) ---------- */}
      <CoinPackBanner />

      {/* ----------------- Пакеты монет — ряд из шести сундуков ------------- */}
      <CoinPacks />

      {/* ----------------------------- Каталог ------------------------------ */}
      <ShopSection title="Каталог" />
    </div>
  );
}

/* -------------------- Плашка баланса / заработка / истории --------------- */

const DOT = "h-1.5 w-1.5 shrink-0 rounded-full";

function BarLabel({ dot, children }: { dot: string; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-muted">
      <span className={`${DOT} ${dot}`} aria-hidden />
      {children}
    </p>
  );
}

function EarnCard({
  href,
  icon,
  title,
  sub,
  tone = "accent",
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  sub: string;
  tone?: "accent" | "mint";
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5 ring-1 ring-white/8 transition hover:bg-white/[0.07] hover:ring-white/15"
    >
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ring-1 ${
          tone === "mint" ? "bg-mint/12 text-mint ring-mint/25" : "bg-accent/15 text-accent-2 ring-accent/30"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4.5 w-4.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {icon}
        </svg>
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-black text-white">{title}</span>
        <span className="block truncate text-[10px] font-black uppercase tracking-[0.14em] text-muted">{sub}</span>
      </span>
    </Link>
  );
}

/**
 * Верхняя плашка магазина в раскладке эталона: баланс AC крупно,
 * карточки источников заработка и последние начисления журнала.
 */
function AcOverviewBar({ progress }: { progress: ProgressDoc }) {
  const [showAll, setShowAll] = useState(false);

  const balance = progress.progress.acBalance;
  const questAcMax =
    Math.max(...PROGRESSION_CONFIG.quests.dailyPool.map((quest) => quest.ac)) * PROGRESSION_CONFIG.quests.dailyPick;

  const history = progress.ledger.filter(
    (entry) => entry.currency === "AC" && entry.status === "confirmed",
  );
  const shown = showAll ? history.slice(-8).reverse() : history.slice(-3).reverse();

  const entryLabel = (source: string) => (source.startsWith("LEVEL_") ? "Уровень" : sourceLabel(source));

  return (
    <section className="sp-card rounded-3xl border border-line bg-card/60 p-5 sm:p-6">
      <div className="grid gap-5 lg:grid-cols-[auto_minmax(0,1.5fr)_minmax(0,1.2fr)]">
        {/* ------------------------------ Баланс ----------------------------- */}
        <div className="lg:pr-5">
          <BarLabel dot="bg-accent-2">Баланс</BarLabel>
          <div className="mt-3 flex items-center gap-3.5">
            <span className="relative inline-block shrink-0">
              <span className="ag-ring-pulse" aria-hidden />
              <span className="ag-orbit" aria-hidden>
                <span className="ag-orbit-dot" />
              </span>
              <span className="ag-orbit ag-orbit-reverse" aria-hidden>
                <span className="ag-orbit-dot" />
              </span>
              <Image
                src="/coin.png"
                alt=""
                aria-hidden
                width={80}
                height={80}
                className="ag-coin-anim relative h-16 w-16 drop-shadow-[0_0_26px_rgba(0,170,255,0.4)] sm:h-20 sm:w-20"
              />
              <SparkleField spots={COIN_SPARKLES} />
            </span>
            <span className="shrink-0">
              <span className="sp-balance block whitespace-nowrap bg-gradient-to-r from-accent-2 to-accent bg-clip-text pr-1 text-4xl font-black leading-none text-transparent sm:text-5xl">
                {balance}
              </span>
              <span className="mt-1.5 block text-[11px] font-black uppercase tracking-[0.18em] text-muted">
                Доступно сейчас
              </span>
            </span>
          </div>
        </div>

        {/* ----------------------------- Заработать -------------------------- */}
        <div className="lg:border-x lg:border-white/8 lg:px-5">
          <BarLabel dot="bg-accent">Заработать</BarLabel>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <EarnCard
              href="/quests"
              title="Квесты"
              sub={`до ${questAcMax} в сутки`}
              icon={
                <>
                  <path d="M9 6h11M9 12h11M9 18h11" />
                  <path d="m3.5 6 1.3 1.3L7 4.8M3.5 12l1.3 1.3L7 10.8M3.5 18l1.3 1.3L7 16.8" />
                </>
              }
            />
            <EarnCard
              href="/profile"
              title="Вход"
              sub={`до ${PROGRESSION_CONFIG.economy.dailyLoginAc} в сутки`}
              icon={
                <>
                  <rect x="4" y="5" width="16" height="15" rx="2" />
                  <path d="M8 3v4M16 3v4M4 10h16" />
                </>
              }
            />
            <EarnCard
              href="/profile"
              tone="mint"
              title="Достижения"
              sub="за активность"
              icon={
                <>
                  <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
                  <path d="M8 5H5v1.5A3.5 3.5 0 0 0 8.5 10M16 5h3v1.5a3.5 3.5 0 0 1-3.5 3.5M12 13v4M9 20h6" />
                </>
              }
            />
            <EarnCard
              href="/profile"
              title="Уровни"
              sub="за каждый уровень"
              icon={
                <>
                  <path d="m5 17 7-7 7 7" />
                  <path d="m5 11 7-7 7 7" />
                </>
              }
            />
          </div>
        </div>

        {/* ------------------------------ История ---------------------------- */}
        <div className="lg:pl-5">
          <BarLabel dot="bg-mint">История</BarLabel>
          <div className="mt-3 space-y-2">
            {shown.length === 0 && (
              <p className="text-xs leading-relaxed text-muted">
                Пока пусто — AC начисляются за ежедневный вход, квесты и просмотр серий.
              </p>
            )}
            {shown.map((entry) => (
              <div key={entry.id} className="flex items-center gap-2.5">
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-black ring-1 ${
                    entry.amount > 0 ? "bg-mint/12 text-mint ring-mint/25" : "bg-white/8 text-muted ring-white/12"
                  }`}
                >
                  {entry.amount > 0 && (
                    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 7 7 17M7 17h6M7 17v-6" />
                    </svg>
                  )}
                  {entry.amount > 0 ? "+" : "−"}
                  {Math.abs(entry.amount)}
                </span>
                <span className="min-w-0 truncate text-xs text-muted">
                  <span className="font-bold text-white/90">{entryLabel(entry.source)}</span> ·{" "}
                  {timeAgo(entry.createdAt)}
                </span>
              </div>
            ))}
          </div>
          {history.length > 3 && (
            <button
              type="button"
              onClick={() => setShowAll((value) => !value)}
              className="mt-3 w-full rounded-xl bg-white/[0.05] px-4 py-2.5 text-xs font-bold text-white ring-1 ring-white/10 transition hover:bg-white/[0.09]"
            >
              {showAll ? "Свернуть" : "Вся история →"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

/* ------------- Плашка «Пополнение кассы» — раскладка эталона ------------- */

/** Статичная позиция блёстки (без random — иначе рассинхрон гидратации) */
type SparkleSpot = { x: number; y: number; size: number; delay: number; dur?: number };

/** Блёстки вокруг монетки баланса (% от бокса) */
const COIN_SPARKLES: SparkleSpot[] = [
  { x: 2, y: 8, size: 12, delay: 0 },
  { x: 96, y: 6, size: 9, delay: 0.5 },
  { x: 104, y: 52, size: 13, delay: 1.1 },
  { x: -4, y: 60, size: 10, delay: 1.6 },
  { x: 50, y: -12, size: 11, delay: 0.8 },
  { x: 84, y: 96, size: 10, delay: 2.0 },
  { x: 16, y: 100, size: 8, delay: 1.3 },
  { x: -8, y: 24, size: 7, delay: 2.4 },
];

/** Блёстки вокруг кота */
const CAT_SPARKLES: SparkleSpot[] = [
  { x: 6, y: 10, size: 14, delay: 0 },
  { x: 92, y: 6, size: 11, delay: 0.6 },
  { x: 100, y: 38, size: 15, delay: 1.2 },
  { x: -3, y: 44, size: 12, delay: 0.3 },
  { x: 88, y: 70, size: 10, delay: 1.8 },
  { x: 8, y: 78, size: 13, delay: 2.2 },
  { x: 46, y: -4, size: 10, delay: 1.5 },
  { x: 66, y: 98, size: 12, delay: 0.9 },
  { x: 30, y: 102, size: 9, delay: 2.6 },
  { x: 97, y: 88, size: 8, delay: 1.9 },
];

/** Восходящие искры под котом */
const CAT_RISE: SparkleSpot[] = [
  { x: 20, y: 62, size: 11, delay: 0, dur: 3.4 },
  { x: 78, y: 55, size: 9, delay: 1.4, dur: 4.0 },
  { x: 50, y: 80, size: 12, delay: 2.6, dur: 3.8 },
];

function SparkleField({ spots, variant = "ag-sparkle" }: { spots: SparkleSpot[]; variant?: string }) {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      {spots.map((spot, index) => (
        <span
          key={index}
          className={variant}
          style={{
            left: `${spot.x}%`,
            top: `${spot.y}%`,
            width: spot.size,
            height: spot.size,
            animationDelay: `${spot.delay}s`,
            ...(spot.dur ? { animationDuration: `${spot.dur}s` } : null),
          }}
        />
      ))}
    </span>
  );
}

/* --------------------------- Иконки кассы --------------------------- */
/* Двухцветные: градиентный штрих и мягкая заливка. Градиенты `sv-g` и
   `sv-w` задаются один раз в <SvgDefs /> внутри секции. */

function SvgDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden focusable="false">
      <defs>
        <linearGradient id="sv-g" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8fd0ff" />
          <stop offset=".55" stopColor="#3b8bff" />
          <stop offset="1" stopColor="#00c8ff" />
        </linearGradient>
        <linearGradient id="sv-w" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffe7a8" />
          <stop offset="1" stopColor="#ffb347" />
        </linearGradient>
      </defs>
    </svg>
  );
}

const ICON_BASE = {
  viewBox: "0 0 24 24",
  fill: "none",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
} as const;

function IcSpark({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg {...ICON_BASE} className={className}>
      <path d="M11 3.5l2 5.6 5.6 2-5.6 2-2 5.6-2-5.6-5.6-2 5.6-2z" fill="url(#sv-w)" fillOpacity=".28" stroke="url(#sv-w)" />
      <path d="M19 3v4M17 5h4" stroke="url(#sv-w)" />
    </svg>
  );
}

function IcGift({ className = "h-3.5 w-3.5", warm = false }: { className?: string; warm?: boolean }) {
  const g = warm ? "url(#sv-w)" : "url(#sv-g)";
  return (
    <svg {...ICON_BASE} className={className}>
      <rect x="3.5" y="9" width="17" height="11.5" rx="2.2" fill={g} fillOpacity=".18" stroke={g} />
      <path d="M2.8 9h18.4v3H2.8zM12 9v11.5" stroke={g} />
      <path d="M12 9S9.2 8.6 8.2 7a2 2 0 0 1 3-2.4C11.8 5.3 12 9 12 9zM12 9s2.8-.4 3.8-2a2 2 0 0 0-3-2.4C12.2 5.3 12 9 12 9z" stroke={g} />
    </svg>
  );
}

function IcWallet({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg {...ICON_BASE} className={className}>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H17a2 2 0 0 1 2 2v1" stroke="url(#sv-g)" />
      <rect x="3" y="7.5" width="18" height="12" rx="3" fill="url(#sv-g)" fillOpacity=".16" stroke="url(#sv-g)" />
      <path d="M21 12.5h-3.2a1.8 1.8 0 0 0 0 3.6H21" stroke="url(#sv-g)" />
      <circle cx="17.9" cy="14.3" r=".6" fill="#8fd0ff" stroke="none" />
    </svg>
  );
}

function IcFlame({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg {...ICON_BASE} className={className}>
      <path d="M12 3c.4 3.2-4.5 5.2-4.5 9.6A4.5 4.5 0 0 0 12 17.5a4.5 4.5 0 0 0 4.5-4.600c0-1.800-.9-3.200-1.900-4.300-.2 1.300-.8 2-1.600 2.300C13.300 8.300 13.300 5.200 12 3z" transform="translate(0 2)" fill="url(#sv-w)" fillOpacity=".25" stroke="url(#sv-w)" />
    </svg>
  );
}

function IcTrophy({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg {...ICON_BASE} className={className}>
      <path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0z" fill="url(#sv-g)" fillOpacity=".2" stroke="url(#sv-g)" />
      <path d="M7.5 6H4.500v1.500a3 3 0 0 0 3.300 2.900M16.500 6h3v1.500a3 3 0 0 1-3.300 2.900M12 13.500V17M8.500 20.500h7M9.500 17h5v3.500h-5z" stroke="url(#sv-g)" />
    </svg>
  );
}

function IcArrow({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg {...ICON_BASE} strokeWidth={2.2} className={className} stroke="currentColor">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function StatCaption({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted">{children}</p>
  );
}

function PackChip({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-[11px] font-bold text-muted ring-1 ring-white/10">
      {icon ?? <span className="h-1.5 w-1.5 rounded-full bg-accent-2" aria-hidden />}
      {children}
    </span>
  );
}

/**
 * Промо-плашка «Пополнение кассы» в структуре эталона (заголовок секции,
 * бейдж, заголовок, три показателя, CTA, иллюстрация справа) — но с нашим
 * функционалом: бесплатный заработок AC вместо покупки монетных пакетов.
 */
function CoinPackBanner() {
  const questAcMax =
    Math.max(...PROGRESSION_CONFIG.quests.dailyPool.map((quest) => quest.ac)) * PROGRESSION_CONFIG.quests.dailyPick;
  const dayMax = questAcMax + PROGRESSION_CONFIG.economy.dailyLoginAc + dailyCalendarAvgAc();
  const yearMax = dayMax * 365;
  const fmt = (n: number) => n.toLocaleString("ru-RU");

  return (
    <section className="space-y-4">
      <SvgDefs />
      {/* ---------------------------- Шапка секции --------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-lg font-black uppercase tracking-tight text-white">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent/15 text-accent-2 ring-1 ring-accent/30">
            <IcWallet className="h-5 w-5" />
          </span>
          Пополнение кассы
        </h2>
        <Link
          href="/gifts"
          className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-xs font-bold text-muted ring-1 ring-white/10 transition hover:text-white"
        >
          <IcGift className="h-4 w-4" warm />
          Подарки за уровни
          <span className="font-medium text-muted/80">— забрать в профиле</span>
        </Link>
      </div>

      {/* ------------------------------ Карточка ----------------------------- */}
      <div className="sp-card relative overflow-hidden rounded-3xl border border-line bg-gradient-to-r from-accent/14 via-card to-accent-2/10">
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-accent/18 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-20 bottom-[-45%] h-56 w-56 rounded-full bg-accent-2/12 blur-3xl"
          aria-hidden
        />

        <div className="relative grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-center">
          <div className="min-w-0 space-y-5">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.07] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white ring-1 ring-white/12">
              <IcSpark className="h-4 w-4" />
              AC · бесплатно
            </span>

            <div className="space-y-2">
              <h3 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                Касса пополняется сама
              </h3>
              <p className="max-w-xl text-sm leading-relaxed text-muted">
                Ежедневный вход, квесты и просмотр серий пополняют баланс — без покупок,
                подписок и пополнений картой.
              </p>
            </div>

            {/* Три показателя — как на эталоне */}
            <div className="grid gap-3 rounded-2xl bg-black/25 p-4 ring-1 ring-white/8 sm:grid-cols-3">
              <div className="rounded-xl bg-white/[0.05] p-3.5 ring-1 ring-white/12">
                <StatCaption>
                  <span className="inline-flex items-center gap-1.5">
                    <IcSpark className="h-3.5 w-3.5" />
                    Сразу за первый день
                  </span>
                </StatCaption>
                <p className="mt-2 flex items-center gap-2">
                  <Image src="/coin.png" alt="" aria-hidden width={28} height={28} className="ag-coin-mini h-7 w-7" />
                  <span className="text-3xl font-black leading-none text-white">{fmt(dayMax)}</span>
                </p>
                <p className="mt-2 text-[11px] text-muted">вход, календарь и три квеста</p>
              </div>
              <div className="p-3.5">
                <StatCaption>Каждый день</StatCaption>
                <p className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-xl font-black text-white/60">+</span>
                  <span className="text-lg font-black text-muted">до</span>
                  <span className="text-3xl font-black leading-none text-white">{fmt(dayMax)}</span>
                </p>
                <p className="mt-2 text-[11px] text-muted">×365 дней в году</p>
              </div>
              <div className="p-3.5">
                <StatCaption>За год</StatCaption>
                <p className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-lg font-black text-muted">до</span>
                  <span className="text-3xl font-black leading-none text-white">{fmt(yearMax)}</span>
                </p>
                <p className="mt-2 text-[11px] text-muted">если забирать каждый день</p>
              </div>
            </div>

            {/* CTA и факты — как нижний ряд эталона */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <Link
                href="/quests"
                className="btn-primary rounded-xl px-5 py-3 text-sm font-bold text-white"
              >
                <span className="inline-flex items-center gap-2">
                  Квесты дня
                  <IcArrow className="h-4 w-4" />
                </span>
              </Link>
              <span className="flex items-baseline gap-2">
                <span className="text-xl font-black text-white">Бесплатно</span>
                <span className="text-xs font-bold uppercase tracking-wide text-muted">навсегда</span>
              </span>
              <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-muted">
                  Также в кассе:
                </span>
                <PackChip icon={<IcFlame />}>Серия +50</PackChip>
                <PackChip icon={<IcGift warm />}>Подарки 50 AC</PackChip>
                <PackChip icon={<IcTrophy />}>{PROGRESSION_CONFIG.achievements.length} достижений</PackChip>
              </div>
            </div>
          </div>

          {/* Наш кот справа — как иллюстрация эталона */}
          <div className="justify-self-center lg:justify-self-end">
            <span className="relative inline-block">
              <Image
                src="/cat.png"
                alt=""
                aria-hidden
                width={680}
                height={680}
                /* Кот — самый крупный элемент над сгибом, поэтому Next
                   просит грузить его сразу: без priority идёт предупреждение
                   про LCP в консоли */
                priority
                className="ag-cat-anim h-auto w-56 max-w-[340px] drop-shadow-[0_0_44px_rgba(0,160,255,0.3)] sm:w-64 lg:w-full"
              />
              <SparkleField spots={CAT_SPARKLES} />
              <SparkleField spots={CAT_RISE} variant="ag-rise-star" />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------- Пакеты монет — ряд сундуков ---------------------- */

/**
 * Рублёвые пакеты AC в раскладке эталона. Баланс цены: стоимость AC за ₽
 * растёт с размером пакета (9.3 → 23.8 AC/₽), бонус +% — доп. монеты
 * сверх базы (2 000→2 400, 4 000→5 600, 9 600→14 400, 20 000→32 000,
 * 32 000→54 400). Оплата подключается позже — кнопка отмечает выбор.
 */
type CoinPack = {
  id: string;
  name: string;
  img: string;
  w: number;
  h: number;
  amount: number;
  bonus: string;
  price: number;
  oldPrice?: number;
  gift?: string;
  tone?: "gold" | "accent";
  badge?: string;
};

const COIN_PACKS: CoinPack[] = [
  { id: "stack", name: "Стопка", img: "/pack-2.png", w: 325, h: 340, amount: 2400, bonus: "+20%", price: 179 },
  { id: "bag", name: "Мешок", img: "/pack-3.png", w: 340, h: 334, amount: 5600, bonus: "+40%", price: 349, badge: "Хит", gift: "+5 600 AC подарком за первую покупку" },
  { id: "small-chest", name: "Маленький сундук", img: "/pack-1.png", w: 296, h: 340, amount: 640, bonus: "Стартовый", price: 69, tone: "gold" },
  { id: "chest", name: "Сундук", img: "/pack-4.png", w: 340, h: 305, amount: 14400, bonus: "+50%", price: 749 },
  { id: "vault", name: "Хранилище", img: "/pack-5.png", w: 325, h: 340, amount: 32000, bonus: "+60%", price: 1490, oldPrice: 1790, badge: "Выгодно" },
  { id: "treasury", name: "Сокровищница", img: "/pack-6.png", w: 340, h: 305, amount: 54400, bonus: "+70%", price: 2290 },
];

/** Ряд идёт по возрастанию цены: от стартового пакета к сокровищнице */
COIN_PACKS.sort((x, y) => x.price - y.price);

/** Блёстки вокруг артов пакетов (позиции статичны — без random, иначе гидратация) */
const PACK_SPARKLES: SparkleSpot[] = [
  { x: 8, y: 14, size: 10, delay: 0 },
  { x: 90, y: 10, size: 8, delay: 0.7 },
  { x: 96, y: 58, size: 11, delay: 1.4 },
  { x: 4, y: 64, size: 9, delay: 0.4 },
  { x: 52, y: -6, size: 8, delay: 1.9 },
  { x: 74, y: 94, size: 9, delay: 1.1 },
  { x: 24, y: 98, size: 7, delay: 2.3 },
];

function CoinPacks() {
  const [picked, setPicked] = useState<CoinPack | null>(null);
  const fmt = (n: number) => n.toLocaleString("ru-RU");

  return (
    <section className="space-y-4">
      {/* ---------------------------- Шапка секции --------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-lg font-black uppercase tracking-tight text-white">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gold/15 text-gold ring-1 ring-gold/35">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="7" width="18" height="13" rx="2" />
              <path d="M3 11h18M12 7v13M7.5 7C5 7 5 3.5 7.5 3.5S10 7 12 7M16.5 7c-2.5 0-2.5-3.5 0-3.5S19 7 12 7" />
            </svg>
          </span>
          Пакеты AC
        </h2>
        <span className="text-[11px] font-black uppercase tracking-[0.14em] text-muted">
          Цены в рублях · оплата подключится позже
        </span>
      </div>

      {/* ------------------------------ Сетка ------------------------------- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {COIN_PACKS.map((pack, idx) => (
          <article
            key={pack.id}
            className={`sp-pack sp-pack--${pack.tone ?? "base"} flex flex-col rounded-2xl border border-line bg-card/70 p-3`}
            style={{ "--i": idx } as React.CSSProperties}
          >
            {pack.badge && <span className="sp-ribbon">{pack.badge}</span>}
            {/* Иллюстрация на свечении: парение + пульс свечения, как у монетки */}
            <div className="relative flex h-28 items-center justify-center">
              <span
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,170,255,0.26),transparent_68%)]"
                aria-hidden
              />
              <span
                className={`absolute right-0 top-0 z-10 rounded-md px-1.5 py-0.5 text-[10px] font-black ring-1 ${
                  pack.tone === "gold"
                    ? "bg-gold/15 text-gold ring-gold/40"
                    : "bg-accent/18 text-accent-2 ring-accent/40"
                }`}
              >
                {pack.bonus}
              </span>
              <Image
                src={pack.img}
                alt=""
                aria-hidden
                width={pack.w}
                height={pack.h}
                style={{ animationDelay: `${(idx * 0.45).toFixed(2)}s` }}
                className="ag-coin-anim relative h-24 w-auto object-contain drop-shadow-[0_6px_18px_rgba(0,140,255,0.35)]"
              />
              <SparkleField spots={PACK_SPARKLES} />
            </div>

            <h3 className="mt-2.5 text-center text-xs font-black uppercase tracking-[0.12em] text-white">
              {pack.name}
            </h3>

            <p className="mt-1.5 flex items-center justify-center gap-1.5">
              <Image src="/coin.png" alt="" aria-hidden width={24} height={24} className="ag-coin-mini h-5 w-5" />
              <span className="text-xl font-black leading-none text-white">{fmt(pack.amount)}</span>
            </p>

            {pack.gift && (
              <p className="mt-1.5 text-center text-[10px] font-bold leading-tight text-mint">
                <span className="inline-flex items-center justify-center gap-1">
                  <IcGift className="h-3 w-3" />
                  {pack.gift}
                </span>
              </p>
            )}

            <div className="mt-auto pt-3">
              <p className="sp-price">
                <span className="sp-price-now">{fmt(pack.price)}&nbsp;₽</span>
                {pack.oldPrice && <s className="sp-price-old">{fmt(pack.oldPrice)}&nbsp;₽</s>}
              </p>
              <button
                type="button"
                onClick={() =>
                  openCheckout({
                    title: `Пакет AC · ${pack.name}`,
                    caption: `${fmt(pack.amount)} AC${pack.gift ? ` · ${pack.gift}` : ""}`,
                    price: pack.price,
                    oldPrice: pack.oldPrice,
                    onPaid: () => {
                      addCoins(pack.amount);
                      setPicked(pack);
                    },
                  })
                }
                className="sp-buy"
              >
                Купить
                <span aria-hidden>→</span>
              </button>
            </div>
          </article>
        ))}
      </div>

      {/* --------------------------- Статус оплаты -------------------------- */}
      <p aria-live="polite" className="min-h-4 text-xs font-bold text-muted">
        {picked ? (
          <span className="text-mint">
            💰 {picked.name}: {fmt(picked.amount)} AC зачислены на баланс.
          </span>
        ) : null}
      </p>
    </section>
  );
}
