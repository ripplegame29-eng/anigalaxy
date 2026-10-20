"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { isPremiumActive } from "@/lib/auth";
import { openAuthDialog } from "@/lib/auth-dialog";
import { useAccount } from "@/lib/use-account";
import { useLevelInfo, useProgress } from "@/lib/progression/events";
import { PROGRESSION_CONFIG } from "@/lib/progression/progression.config";
import { sourceLabel } from "@/lib/progression/labels";
import type { ProgressDoc } from "@/lib/progression/types";
import { timeAgo } from "@/lib/history";
import { ShopSection } from "@/components/profile/ProfileSections";

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
    <div className="ag-root space-y-6">
      {/* --------------------------- Герой витрины --------------------------- */}
      {/* Ник, Premium, уровень и полосу XP показывает каталог ниже — здесь
          только то, чего в нём нет: название витрины и пояснение. Держать
          одно и то же дважды на странице незачем. */}
      <section className="ag-card relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-accent/18 via-accent-2/8 to-accent-2/10"
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
              <h1 className="ag-shop-h1 mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
                Косметика
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
                  <Link href="/profile?tab=quests" className={`${CHIP} bg-mint/12 text-mint ring-mint/35 hover:bg-mint/20`}>
                    Квесты дня
                  </Link>
                  <Link href="/premium" className={`${CHIP} border-accent-2/40 bg-accent-2/10 text-accent-2 hover:bg-accent-2/18`}>
                    Premium
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
    <section className="rounded-3xl border border-line bg-card/60 p-5 sm:p-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.5fr)_minmax(0,1.2fr)]">
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
            <span className="min-w-0">
              <span className="block bg-gradient-to-r from-accent-2 to-accent bg-clip-text text-4xl font-black leading-none text-transparent sm:text-5xl">
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
              href="/profile?tab=quests"
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

function StatCaption({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted">{children}</p>
  );
}

function PackChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-2 py-1 text-[11px] font-bold text-muted ring-1 ring-white/10">
      <span className="h-1.5 w-1.5 rounded-full bg-accent-2" aria-hidden />
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
  const dayMax = questAcMax + PROGRESSION_CONFIG.economy.dailyLoginAc;
  const yearMax = dayMax * 365;
  const fmt = (n: number) => n.toLocaleString("ru-RU");

  return (
    <section className="space-y-4">
      {/* ---------------------------- Шапка секции --------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-lg font-black uppercase tracking-tight text-white">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent/15 text-accent-2 ring-1 ring-accent/30">
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
              <rect x="3" y="6" width="18" height="13" rx="2" />
              <path d="M3 10h18M16 14h2" />
            </svg>
          </span>
          Пополнение кассы
        </h2>
        <Link
          href="/profile"
          className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-xs font-bold text-muted ring-1 ring-white/10 transition hover:text-white"
        >
          <span aria-hidden>🎁</span>
          Подарки за уровни
          <span className="font-medium text-muted/80">— забрать в профиле</span>
        </Link>
      </div>

      {/* ------------------------------ Карточка ----------------------------- */}
      <div className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-r from-accent/14 via-card to-accent-2/10">
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
              <span aria-hidden>✨</span>
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
                <StatCaption>✨ Сразу за первый день</StatCaption>
                <p className="mt-2 flex items-center gap-2">
                  <Image src="/coin.png" alt="" aria-hidden width={28} height={28} className="ag-coin-mini h-7 w-7" />
                  <span className="text-3xl font-black leading-none text-white">{fmt(dayMax)}</span>
                </p>
                <p className="mt-2 text-[11px] text-muted">вход + три квеста</p>
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
                href="/profile?tab=quests"
                className="btn-primary rounded-xl px-5 py-3 text-sm font-bold text-white"
              >
                Квесты дня →
              </Link>
              <span className="flex items-baseline gap-2">
                <span className="text-xl font-black text-white">Бесплатно</span>
                <span className="text-xs font-bold uppercase tracking-wide text-muted">навсегда</span>
              </span>
              <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-muted">
                  Также в кассе:
                </span>
                <PackChip>Серия +50</PackChip>
                <PackChip>Подарки 50 AC</PackChip>
                <PackChip>71 достижение</PackChip>
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
};

const COIN_PACKS: CoinPack[] = [
  { id: "stack", name: "Стопка", img: "/pack-2.png", w: 325, h: 340, amount: 2400, bonus: "+20%", price: 179 },
  { id: "bag", name: "Мешок", img: "/pack-3.png", w: 340, h: 334, amount: 5600, bonus: "+40%", price: 349, gift: "+5 600 AC подарком за первую покупку" },
  { id: "small-chest", name: "Маленький сундук", img: "/pack-1.png", w: 296, h: 340, amount: 640, bonus: "Стартовый", price: 69, tone: "gold" },
  { id: "chest", name: "Сундук", img: "/pack-4.png", w: 340, h: 305, amount: 14400, bonus: "+50%", price: 749 },
  { id: "vault", name: "Хранилище", img: "/pack-5.png", w: 325, h: 340, amount: 32000, bonus: "+60%", price: 1490, oldPrice: 1790 },
  { id: "treasury", name: "Сокровищница", img: "/pack-6.png", w: 340, h: 305, amount: 54400, bonus: "+70%", price: 2290 },
];

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
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-2/15 text-accent-2 ring-1 ring-accent-2/35">
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
            className="flex flex-col rounded-2xl border border-line bg-card/70 p-3 transition hover:-translate-y-0.5 hover:border-accent/40 hover:bg-card"
          >
            {/* Иллюстрация на свечении: парение + пульс свечения, как у монетки */}
            <div className="relative flex h-28 items-center justify-center">
              <span
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,170,255,0.26),transparent_68%)]"
                aria-hidden
              />
              <span
                className={`absolute right-0 top-0 z-10 rounded-md px-1.5 py-0.5 text-[10px] font-black ring-1 ${
                  pack.tone === "gold"
                    ? "bg-accent-2/15 text-accent-2 ring-accent-2/40"
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
                🎁 {pack.gift}
              </p>
            )}

            <div className="mt-auto flex items-center justify-between gap-2 pt-3">
              <span className="min-w-0">
                {pack.oldPrice && (
                  <s className="block text-[10px] font-bold leading-none text-muted/70">{fmt(pack.oldPrice)} ₽</s>
                )}
                <span className="text-sm font-black text-white">{fmt(pack.price)} ₽</span>
              </span>
              <button
                type="button"
                onClick={() => setPicked(pack)}
                className="shrink-0 rounded-lg bg-accent/15 px-2.5 py-1.5 text-[11px] font-black text-accent-2 ring-1 ring-accent/35 transition hover:bg-accent/25 hover:text-white"
              >
                Купить (демо) →
              </button>
            </div>
          </article>
        ))}
      </div>

      {/* --------------------------- Статус оплаты -------------------------- */}
      <p aria-live="polite" className="min-h-4 text-xs font-bold text-muted">
        {picked ? (
          <span className="text-mint">
            💰 {picked.name} ({fmt(picked.price)} ₽) — выбор отмечен, оплата не подключена: AC не начислены.
          </span>
        ) : null}
      </p>
    </section>
  );
}
