/**
 * Дневные квесты.
 *
 * Прогресс считается по локальным данным (история просмотра, избранное,
 * подборки, заполненность профиля); награда забирается вручную и
 * обнуляется вместе с наступлением нового дня.
 */

import type { ProfileState } from "./profile";
import { isQuestClaimed } from "./profile";
import { watchStats, type WatchState } from "./history";
import type { StatsBundle } from "./achievements";

export interface Quest {
  id: string;
  title: string;
  description: string;
  target: number;
  unit: string;
  xp: number;
  coins: number;
  progress: (stats: QuestStats) => number;
}

export interface QuestStats {
  minutesToday: number;
  episodesToday: number;
  favorites: number;
  collections: number;
  complete: number;
}

export const QUESTS: Quest[] = [
  {
    id: "q-minutes",
    title: "Разогрев",
    description: "Провести 15 минут у плеера сегодня",
    target: 15,
    unit: "мин",
    xp: 15,
    coins: 10,
    progress: (s) => Math.min(s.minutesToday, 15),
  },
  {
    id: "q-episodes",
    title: "Серии дня",
    description: "Открыть 3 серии сегодня",
    target: 3,
    unit: "серий",
    xp: 20,
    coins: 15,
    progress: (s) => Math.min(s.episodesToday, 3),
  },
  {
    id: "q-favorite",
    title: "В избранное",
    description: "Держать хотя бы один тайтл в избранном",
    target: 1,
    unit: "тайтл",
    xp: 10,
    coins: 10,
    progress: (s) => Math.min(s.favorites, 1),
  },
  {
    id: "q-collection",
    title: "Своя полка",
    description: "Создать хотя бы одну подборку",
    target: 1,
    unit: "подборка",
    xp: 15,
    coins: 15,
    progress: (s) => Math.min(s.collections, 1),
  },
  {
    id: "q-profile",
    title: "Оформление",
    description: "Заполнить хотя бы два пункта профиля (аватар, описание, титул)",
    target: 2,
    unit: "пункта",
    xp: 25,
    coins: 20,
    progress: (s) => Math.min(s.complete, 2),
  },
];

export function questStats(
  profile: ProfileState,
  watch: WatchState,
  stats: Pick<StatsBundle, "favorites" | "collections">,
): QuestStats {
  const watched = watchStats(watch);
  const complete =
    Number(Boolean(profile.avatar)) +
    Number(Boolean(profile.bio.trim())) +
    Number(Boolean(profile.titleId));
  return {
    minutesToday: watched.minutesToday,
    episodesToday: watched.episodesToday,
    favorites: stats.favorites,
    collections: stats.collections,
    complete,
  };
}

export interface QuestView {
  item: Quest;
  progress: number;
  percent: number;
  ready: boolean;
  claimed: boolean;
}

export function questViews(data: QuestStats, profile: ProfileState): QuestView[] {
  return QUESTS.map((item) => {
    const progress = item.progress(data);
    const ready = progress >= item.target;
    return {
      item,
      progress,
      percent: Math.min(100, Math.round((progress / item.target) * 100)),
      ready,
      claimed: isQuestClaimed(profile, item.id),
    };
  });
}
