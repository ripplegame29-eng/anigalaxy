/**
 * Модель дорожки боевого пропуска для новой витрины.
 *
 * Макет рисует каждую награду одной монеткой; здесь у каждого типа награды
 * свой визуал и своя «редкость» из палитры эмблем, а данные берутся из
 * конфига сезона (`lib/battlepass`) — то есть дорожка остаётся источником
 * правды, а этот модуль только переводит её в форму для UI.
 */

import { AE_RARITY, type AERarity } from "@/components/progression/AchievementEmblem";
import { BATTLEPASS, bpRewards, describeReward, type RewardView } from "@/lib/battlepass/logic";
import type { BattlepassLine } from "@/lib/progression/types";

/** Тип награды для визуала: монета, молния XP, капсула титула, рамка */
export type BpCardKind = "ac" | "bpXp" | "tag" | "frame";

export interface BpRewardCard {
  /** `line:level` — стабильный ключ клетки */
  key: string;
  level: number;
  line: BattlepassLine;
  kind: BpCardKind;
  /** Главная награда пакета (первая по порядку выдачи) */
  view: RewardView;
  /** Остальные награды пакета, если он бандл */
  extras: RewardView[];
  bundle: number;
  /** Короткая подпись в клетке */
  label: string;
  /** Тип награды человеческим языком */
  kindLabel: string;
  rarity: AERarity;
  rarityLabel: string;
  desc: string;
}

const RARITY_INDEX: Record<AERarity, number> = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
  mythic: 4,
};

const tierToRarity = (tier: number): AERarity => {
  const order: AERarity[] = ["common", "rare", "epic", "legendary", "mythic"];
  return order[Math.max(0, Math.min(4, tier))];
};

const KIND_LABEL: Record<BpCardKind, string> = {
  ac: "Аникойны",
  bpXp: "XP сезона",
  tag: "Титул",
  frame: "Рамка",
};

const DESC: Record<BpCardKind, string> = {
  ac: "Аникойны (AC) — внутренняя валюта AniGalaxy: монетные пакеты, косметика профиля и подписка Premium.",
  bpXp: "XP сезона — двигает уровень пропуска. Ценится выше обычного XP: даёт ещё XP поверх основного.",
  tag: "Титул встаёт рядом с ником в профиле, чате и списках просмотра. Эффекты капсулы зависят от редкости.",
  frame: "Анимированная рамка аватара в профиле, комментариях и списках просмотра.",
};

const PICK_DESC = "Рамка на выбор: выдаётся первая ещё не полученная из списка лучших рамок сезона.";

/** Редкость предмета — из каталога косметики; для валюты — по уровню и линии */
function cardRarity(kind: BpCardKind, view: RewardView, level: number, line: BattlepassLine): AERarity {
  const bonus = line === "premium" ? 1 : 0;
  if (kind === "tag" || kind === "frame") {
    const base = RARITY_INDEX[view.kind === "tag" || view.kind === "frame" ? view.rarity : "common"] ?? 0;
    return tierToRarity(base + bonus);
  }
  // Валюта: чем выше уровень и золотая линия — тем «пышнее» пакет
  const tier = level >= 75 ? 3 : level >= 50 ? 2 : level >= 25 ? 1 : 0;
  return tierToRarity(tier + bonus);
}

function cardKind(view: RewardView): BpCardKind {
  if (view.kind === "ac") return "ac";
  if (view.kind === "bpXp") return "bpXp";
  if (view.kind === "tag") return "tag";
  return "frame";
}

function buildCard(level: number, line: BattlepassLine, rewards: ReturnType<typeof bpRewards>): BpRewardCard | null {
  if (!rewards?.length) return null;
  const views = rewards.map((reward) => describeReward(reward));
  const primary = views[0];
  const kind = cardKind(primary);
  const rarity = cardRarity(kind, primary, level, line);
  const isPick = rewards[0]?.kind === "framePick";

  return {
    key: `${line}:${level}`,
    level,
    line,
    kind,
    view: primary,
    extras: views.slice(1),
    bundle: views.length,
    label: primary.label,
    kindLabel: isPick ? "Рамка на выбор" : KIND_LABEL[kind],
    rarity,
    rarityLabel: AE_RARITY[rarity].n,
    desc: isPick ? PICK_DESC : DESC[kind],
  };
}

/** Все наградные клетки обеих линий, отсортированные по уровню */
export const TRACK_CARDS: BpRewardCard[] = [];
for (const def of BATTLEPASS.levels) {
  for (const line of ["free", "premium"] as const) {
    const card = buildCard(def.level, line, bpRewards(def.level, line));
    if (card) TRACK_CARDS.push(card);
  }
}
TRACK_CARDS.sort((a, b) => a.level - b.level || (a.line === "free" ? -1 : 1));

/** Карточки одного уровня (для колонки дорожки) — предрассчитано один раз */
export const CARDS_BY_LEVEL = new Map<number, { free?: BpRewardCard; premium?: BpRewardCard }>();
for (const card of TRACK_CARDS) {
  const entry = CARDS_BY_LEVEL.get(card.level) ?? {};
  entry[card.line] = card;
  CARDS_BY_LEVEL.set(card.level, entry);
}

export function cardsAtLevel(level: number): { free?: BpRewardCard; premium?: BpRewardCard } {
  return CARDS_BY_LEVEL.get(level) ?? {};
}

/** Уровни с предметами — на них ползунок рисует короткую засечку */
export const ITEM_LEVELS = new Set(
  TRACK_CARDS.filter((card) => card.kind === "tag" || card.kind === "frame").map((card) => card.level),
);

/** Пакеты с предметами — для витрины эксклюзивов */
export const EXCLUSIVE_CARDS = TRACK_CARDS.filter((card) => card.kind === "tag" || card.kind === "frame");

/** Правильные окончания: 1 пакет / 2 пакета / 5 пакетов */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
