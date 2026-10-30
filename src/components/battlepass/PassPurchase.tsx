"use client";

/**
 * Блок покупки боевого пропуска (правая колонка шапки).
 *
 * В нашем проекте золотую линию открывает подписка AniGalaxy Premium, поэтому
 * «пропуск» — это сезонный план подписки: разовая оплата, все 95 наградных
 * уровней золотой линии и уже достигнутые уровни выдаются сразу. Суммы и
 * формулировки берём из конфига сезона и тарифов, а не из вёрстки.
 */

import Link from "next/link";

import { BATTLEPASS } from "@/lib/battlepass/logic";
import { plural } from "@/components/battlepass/model";

/** Годовой план подписки — он и открывает сезонный пропуск */
const SEASON_PRICE = 1190;

export interface PassPurchaseProps {
  premium: boolean;
  level: number;
  /** Итоги золотой линии за сезон */
  totals: { ac: number; bpXp: number; items: number; levels: number };
}

export function PassPurchase({ premium, level, totals }: PassPurchaseProps) {
  const rewardLevels = BATTLEPASS.levels.length;

  if (premium) {
    return (
      <aside className="bp-buy border border-mint/25" aria-label="Статус пропуска">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-mint">Боевой пропуск</p>
        <p className="mt-1 font-display text-lg font-black leading-tight text-white">
          Пропуск активен ✓
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Золотая линия открыта целиком: {totals.levels} наградных уровней,{" "}
          {totals.items} предметов и {totals.ac.toLocaleString("ru-RU")} AC сверх бесплатной
          ветки. Забирайте на дорожке — ничего не сгорит после сезона.
        </p>
        <Link
          href="/premium"
          className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-white/12 bg-white/[0.05] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-white/10 motion-reduce:transition-none"
        >
          Управление подпиской
        </Link>
        <p className="mt-2 text-[10px] leading-snug text-muted">
          Золотую линию открывает подписка — срок и продление видны в разделе Premium.
        </p>
      </aside>
    );
  }

  return (
    <aside className="bp-buy border border-accent/25" aria-label="Покупка боевого пропуска">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-accent-2">
          Боевой пропуск
        </p>
        <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-black text-gold ring-1 ring-gold/40">
          ~20% выгоднее
        </span>
      </div>

      <p className="mt-1 flex items-baseline gap-2">
        <span className="font-display text-3xl font-black leading-none text-white tabular-nums">
          {SEASON_PRICE.toLocaleString("ru-RU")}
          <span className="text-lg">₽</span>
        </span>
        <span className="text-xs font-bold text-muted line-through opacity-60">
          {Math.round(SEASON_PRICE / 12)} ₽/мес
        </span>
      </p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-muted">
        Разовый платёж · весь сезон
      </p>

      <ul className="mt-3 space-y-2 text-[11px] leading-snug">
        <li className="rounded-xl border border-accent/25 bg-accent/[0.07] px-3 py-2 font-bold text-white">
          <span className="text-accent-2">1</span> Золотая линия на {rewardLevels}{" "}
          {plural(rewardLevels, "уровне", "уровнях", "уровнях")} — выдаётся сразу, вместе с
          уровнями, которые вы уже прошли
        </li>
        <li className="flex items-start gap-2 text-muted">
          <Check />
          {totals.items} предметов косметики — рамки, маски и титулы только за этот сезон
        </li>
        <li className="flex items-start gap-2 text-muted">
          <Check />
          {totals.ac.toLocaleString("ru-RU")} AC и {totals.bpXp.toLocaleString("ru-RU")} XP сезона
        </li>
        <li className="flex items-start gap-2 text-muted">
          <Check />
          Награды не сгорают после конца сезона — заберёте, когда удобно
        </li>
      </ul>

      <Link
        href="/battlepass/buy"
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-accent to-accent-2 px-4 py-3 text-sm font-black text-white shadow-[0_8px_26px_-10px_rgba(31,123,255,0.9)] transition hover:brightness-110 motion-reduce:transition-none"
      >
        Купить пропуск →
      </Link>
      <button
        type="button"
        disabled
        className="mt-2 inline-flex w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-bold text-muted opacity-70"
        title="Подарки появятся вместе с оплатой пропуска"
      >
        🎁 Подарить другую
      </button>

      <p className="mt-2 text-center text-[10px] leading-snug text-muted">
        {level > 1
          ? `Уровень ${level} уже достигнут — эти награды выдадутся сразу после оплаты.`
          : "Награды до текущего уровня выдадутся сразу."}
      </p>
    </aside>
  );
}

function Check() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="mt-[1px] h-3 w-3 shrink-0 text-mint"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.2"
      aria-hidden
    >
      <path strokeLinecap="round" d="m5 12 5 5L19 7" />
    </svg>
  );
}
