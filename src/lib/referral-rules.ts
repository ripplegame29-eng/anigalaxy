/**
 * Правила реферальной программы — единый источник для сервера и интерфейса.
 *
 * Всё, что обещает страница «Пригласи друзей», выдаёт сервер по этим же
 * числам (`lib/server/referrals.ts`), поэтому подпись и награда не разойдутся.
 */

import { PROGRESSION_CONFIG } from "./progression/progression.config";

/** Друг засчитывается, когда дорос до уровня и посмотрел столько минут */
export const REFERRAL_MIN_LEVEL = 10;
export const REFERRAL_MIN_MINUTES = 30;

/** Дней Premium пригласившему за каждого засчитанного друга */
export const REFERRAL_DAYS_PER_FRIEND = PROGRESSION_CONFIG.economy.referralPremiumDays;

/** Подарок другу за регистрацию по приглашению */
export const REFERRAL_WELCOME = { days: 7, xp: 500 } as const;

export type ReferralGrant =
  | { kind: "tag"; id: string }
  | { kind: "frame"; id: string }
  | { kind: "effect"; id: string };

export interface ReferralRule {
  /** Сколько засчитанных друзей нужно */
  n: number;
  title: string;
  rarity: "common" | "rare" | "epic" | "leg";
  xp: number;
  /** Дней Premium сверху за рубеж */
  days: number;
  /** Название подарка для подписей */
  item: string;
  grant: ReferralGrant;
}

export const REFERRAL_RULES: readonly ReferralRule[] = [
  { n: 1, title: "Первая искра", rarity: "common", xp: 500, days: 0, item: "Тег «Сенсей»", grant: { kind: "tag", id: "tag_sensei" } },
  { n: 3, title: "Тёплая орбита", rarity: "common", xp: 1500, days: 0, item: "Рамка «Геасс»", grant: { kind: "frame", id: "frame-36" } },
  { n: 5, title: "Бро", rarity: "rare", xp: 2500, days: 0, item: "Эффект «Неон»", grant: { kind: "effect", id: "fx_style_neon" } },
  { n: 10, title: "Гильдмастер", rarity: "rare", xp: 5000, days: 7, item: "Рамка «Маска гуля»", grant: { kind: "frame", id: "frame-03" } },
  { n: 20, title: "Цифровая сакура", rarity: "epic", xp: 10000, days: 14, item: "Эффект «Глитч»", grant: { kind: "effect", id: "fx_style_glitch" } },
  { n: 30, title: "Орден созвездия", rarity: "epic", xp: 15000, days: 30, item: "Рамка «Крылья свободы»", grant: { kind: "frame", id: "frame-27" } },
  { n: 50, title: "Легенда AniGalaxy", rarity: "leg", xp: 25000, days: 90, item: "Эффект «Голограмма»", grant: { kind: "effect", id: "fx-holo" } },
  { n: 100, title: "Архитектор галактики", rarity: "leg", xp: 50000, days: 365, item: "Тег «Герой иного мира»", grant: { kind: "tag", id: "tag_geroyinogomira" } },
];
