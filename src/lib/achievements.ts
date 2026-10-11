/**
 * Достижения.
 *
 * Каталог локальный: прогресс считается по данным этого браузера (история
 * просмотра, избранное, подборки, комментарии, уровень, подписка). Награда
 * выдаётся вручную кнопкой «Забрать» — XP и монеты начисляет `profile.ts`.
 */

import type { ProfileState } from "./profile";
import { watchStats, type WatchState } from "./history";
import type { Collection } from "./collections";
import { levelInfo } from "./levels";
import { getProgress } from "./progression/service";
import type { Rarity } from "./cosmetics";

export type AchievementCategory = "watch" | "collection" | "profile" | "social" | "premium";

export const CATEGORY_LABEL: Record<AchievementCategory, string> = {
  watch: "Просмотр",
  collection: "Коллекции",
  profile: "Профиль",
  social: "Общение",
  premium: "Поддержка",
};

export interface StatsBundle {
  minutes: number;
  minutesToday: number;
  titles: number;
  episodes: number;
  episodesToday: number;
  favorites: number;
  collections: number;
  comments: number;
  claims: number;
  level: number;
  xp: number;
  premium: boolean;
  hasAvatar: boolean;
  hasBio: boolean;
  hasTitle: boolean;
  showcase: number;
  accountDays: number;
  streak: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  rarity: Rarity;
  threshold: number;
  /** Единица измерения прогресса для подписи */
  unit: string;
  rewardXp: number;
  rewardCoins: number;
  progress: (stats: StatsBundle) => number;
}

const R = {
  common: { xp: 25, coins: 10 },
  rare: { xp: 60, coins: 25 },
  epic: { xp: 120, coins: 60 },
  legendary: { xp: 250, coins: 150 },
};

const at = (value: number, limit: number) => Math.min(value, limit);

export const ACHIEVEMENTS: Achievement[] = [
  /* ------------------------------ Просмотр ----------------------------- */
  {
    id: "watch-1",
    name: "Первый вечер",
    description: "Открыть первую серию на сайте",
    category: "watch",
    rarity: "common",
    threshold: 1,
    unit: "тайтл",
    rewardXp: R.common.xp,
    rewardCoins: R.common.coins,
    progress: (s) => at(s.titles, 1),
  },
  {
    id: "watch-5",
    name: "Пять вечеров",
    description: "Посмотреть 5 разных тайтлов",
    category: "watch",
    rarity: "common",
    threshold: 5,
    unit: "тайтлов",
    rewardXp: R.common.xp,
    rewardCoins: R.common.coins,
    progress: (s) => at(s.titles, 5),
  },
  {
    id: "titles-10",
    name: "Архивариус",
    description: "Завести 10 разных тайтлов в истории",
    category: "watch",
    rarity: "rare",
    threshold: 10,
    unit: "тайтлов",
    rewardXp: R.rare.xp,
    rewardCoins: R.rare.coins,
    progress: (s) => at(s.titles, 10),
  },
  {
    id: "episodes-10",
    name: "Десяток серий",
    description: "Открыть 10 серий",
    category: "watch",
    rarity: "common",
    threshold: 10,
    unit: "серий",
    rewardXp: R.common.xp,
    rewardCoins: R.common.coins,
    progress: (s) => at(s.episodes, 10),
  },
  {
    id: "episodes-25",
    name: "Поглощатель",
    description: "Открыть 25 серий",
    category: "watch",
    rarity: "rare",
    threshold: 25,
    unit: "серий",
    rewardXp: R.rare.xp,
    rewardCoins: R.rare.coins,
    progress: (s) => at(s.episodes, 25),
  },
  {
    id: "episodes-100",
    name: "Сотня",
    description: "Открыть 100 серий",
    category: "watch",
    rarity: "epic",
    threshold: 100,
    unit: "серий",
    rewardXp: R.epic.xp,
    rewardCoins: R.epic.coins,
    progress: (s) => at(s.episodes, 100),
  },
  {
    id: "minutes-60",
    name: "Час за экраном",
    description: "Провести 60 минут у плеера",
    category: "watch",
    rarity: "common",
    threshold: 60,
    unit: "минут",
    rewardXp: R.common.xp,
    rewardCoins: R.common.coins,
    progress: (s) => at(s.minutes, 60),
  },
  {
    id: "minutes-300",
    name: "Марафонец",
    description: "Провести 5 часов у плеера",
    category: "watch",
    rarity: "rare",
    threshold: 300,
    unit: "минут",
    rewardXp: R.rare.xp,
    rewardCoins: R.rare.coins,
    progress: (s) => at(s.minutes, 300),
  },
  {
    id: "minutes-1000",
    name: "Ночная смена",
    description: "Провести больше 16 часов у плеера",
    category: "watch",
    rarity: "epic",
    threshold: 1000,
    unit: "минут",
    rewardXp: R.epic.xp,
    rewardCoins: R.epic.coins,
    progress: (s) => at(s.minutes, 1000),
  },
  {
    id: "day-3",
    name: "Три дня подряд",
    description: "Собрать серию из 3 ежедневных квестов",
    category: "watch",
    rarity: "rare",
    threshold: 3,
    unit: "дня",
    rewardXp: R.rare.xp,
    rewardCoins: R.rare.coins,
    progress: (s) => at(s.streak, 3),
  },

  /* ------------------------------ Коллекции ---------------------------- */
  {
    id: "fav-1",
    name: "Избранное",
    description: "Добавить тайтл в избранное",
    category: "collection",
    rarity: "common",
    threshold: 1,
    unit: "тайтл",
    rewardXp: R.common.xp,
    rewardCoins: R.common.coins,
    progress: (s) => at(s.favorites, 1),
  },
  {
    id: "fav-10",
    name: "Любимая полка",
    description: "Собрать 10 тайтлов в избранном",
    category: "collection",
    rarity: "rare",
    threshold: 10,
    unit: "тайтлов",
    rewardXp: R.rare.xp,
    rewardCoins: R.rare.coins,
    progress: (s) => at(s.favorites, 10),
  },
  {
    id: "fav-50",
    name: "Хранилище",
    description: "Собрать 50 тайтлов в избранном",
    category: "collection",
    rarity: "epic",
    threshold: 50,
    unit: "тайтлов",
    rewardXp: R.epic.xp,
    rewardCoins: R.epic.coins,
    progress: (s) => at(s.favorites, 50),
  },
  {
    id: "collection-1",
    name: "Куратор",
    description: "Создать первую подборку",
    category: "collection",
    rarity: "common",
    threshold: 1,
    unit: "подборка",
    rewardXp: R.common.xp,
    rewardCoins: R.common.coins,
    progress: (s) => at(s.collections, 1),
  },
  {
    id: "collections-5",
    name: "Хранитель подборок",
    description: "Создать 5 подборок",
    category: "collection",
    rarity: "rare",
    threshold: 5,
    unit: "подборок",
    rewardXp: R.rare.xp,
    rewardCoins: R.rare.coins,
    progress: (s) => at(s.collections, 5),
  },
  {
    id: "showcase",
    name: "Витрина",
    description: "Выставить 3 тайтла на витрину профиля",
    category: "collection",
    rarity: "rare",
    threshold: 3,
    unit: "тайтла",
    rewardXp: R.rare.xp,
    rewardCoins: R.rare.coins,
    progress: (s) => at(s.showcase, 3),
  },

  /* ------------------------------- Профиль ----------------------------- */
  {
    id: "avatar",
    name: "Лицо к бренду",
    description: "Загрузить свой аватар (можно GIF)",
    category: "profile",
    rarity: "common",
    threshold: 1,
    unit: "",
    rewardXp: R.common.xp,
    rewardCoins: R.common.coins,
    progress: (s) => (s.hasAvatar ? 1 : 0),
  },
  {
    id: "bio",
    name: "Немного о себе",
    description: "Заполнить описание профиля",
    category: "profile",
    rarity: "common",
    threshold: 1,
    unit: "",
    rewardXp: R.common.xp,
    rewardCoins: R.common.coins,
    progress: (s) => (s.hasBio ? 1 : 0),
  },
  {
    id: "title-owned",
    name: "Свой титул",
    description: "Выбрать титул рядом с ником",
    category: "profile",
    rarity: "common",
    threshold: 1,
    unit: "",
    rewardXp: R.common.xp,
    rewardCoins: R.common.coins,
    progress: (s) => (s.hasTitle ? 1 : 0),
  },
  {
    id: "profile-done",
    name: "Готовый профиль",
    description: "Аватар, описание и титул — всё заполнено",
    category: "profile",
    rarity: "rare",
    threshold: 3,
    unit: "пункта",
    rewardXp: R.rare.xp,
    rewardCoins: R.rare.coins,
    progress: (s) => at(Number(s.hasAvatar) + Number(s.hasBio) + Number(s.hasTitle), 3),
  },
  {
    id: "account-7",
    name: "Неделя с нами",
    description: "Пользоваться сайтом 7 дней",
    category: "profile",
    rarity: "rare",
    threshold: 7,
    unit: "дней",
    rewardXp: R.rare.xp,
    rewardCoins: R.rare.coins,
    progress: (s) => at(s.accountDays, 7),
  },

  /* ------------------------------ Общение ------------------------------ */
  {
    id: "comment-1",
    name: "Первый комментарий",
    description: "Оставить комментарий в профиле",
    category: "social",
    rarity: "common",
    threshold: 1,
    unit: "комментарий",
    rewardXp: R.common.xp,
    rewardCoins: R.common.coins,
    progress: (s) => at(s.comments, 1),
  },
  {
    id: "comment-10",
    name: "Болтун",
    description: "Оставить 10 комментариев",
    category: "social",
    rarity: "rare",
    threshold: 10,
    unit: "комментариев",
    rewardXp: R.rare.xp,
    rewardCoins: R.rare.coins,
    progress: (s) => at(s.comments, 10),
  },
  {
    id: "claims-10",
    name: "Коллекционер наград",
    description: "Забрать 10 достижений",
    category: "social",
    rarity: "epic",
    threshold: 10,
    unit: "наград",
    rewardXp: R.epic.xp,
    rewardCoins: R.epic.coins,
    progress: (s) => at(s.claims, 10),
  },

  /* ------------------------------ Поддержка ---------------------------- */
  {
    id: "premium",
    name: "Меценат",
    description: "Активировать Premium-подписку",
    category: "premium",
    rarity: "epic",
    threshold: 1,
    unit: "",
    rewardXp: R.epic.xp,
    rewardCoins: R.epic.coins,
    progress: (s) => (s.premium ? 1 : 0),
  },
  {
    id: "level-3",
    name: "Уверенный старт",
    description: "Достичь 3 уровня",
    category: "premium",
    rarity: "common",
    threshold: 3,
    unit: "уровень",
    rewardXp: R.common.xp,
    rewardCoins: R.common.coins,
    progress: (s) => at(s.level, 3),
  },
  {
    id: "level-5",
    name: "Крепкий середняк",
    description: "Достичь 5 уровня",
    category: "premium",
    rarity: "rare",
    threshold: 5,
    unit: "уровень",
    rewardXp: R.rare.xp,
    rewardCoins: R.rare.coins,
    progress: (s) => at(s.level, 5),
  },
  {
    id: "level-10",
    name: "Легенда",
    description: "Достичь 10 уровня",
    category: "premium",
    rarity: "legendary",
    threshold: 10,
    unit: "уровень",
    rewardXp: R.legendary.xp,
    rewardCoins: R.legendary.coins,
    progress: (s) => at(s.level, 10),
  },
];

/* ------------------------------ Вычисления ------------------------------ */

export interface AchievementView {
  item: Achievement;
  progress: number;
  percent: number;
  done: boolean;
  claimed: boolean;
}

/** Собирает срез данных для расчёта прогресса */
export function collectStats(
  profile: ProfileState,
  watch: WatchState,
  collections: Collection[],
  favorites: number,
  premium: boolean,
  createdAt: number,
): StatsBundle {
  const stats = watchStats(watch);
  // Уровень/XP/серия — из единого документа прогрессии (старый profile.xp
  // после миграции только догоняется внизу и всегда ≤ документа)
  const doc = getProgress();
  const unlocked = Object.values(doc.achievements).filter((item) => item.unlockedAt > 0).length;
  return {
    ...stats,
    favorites,
    collections: collections.length,
    comments: profile.comments.length,
    // «Наград» = полученных достижений (единый документ); profile.claimed —
    // только мостик миграции старой системы
    claims: unlocked,
    level: levelInfo(doc.progress.xpTotal).level,
    xp: doc.progress.xpTotal,
    premium,
    hasAvatar: Boolean(profile.avatar),
    hasBio: Boolean(profile.bio.trim()),
    hasTitle: Boolean(profile.titleId),
    showcase: profile.showcase.length,
    accountDays: Math.max(1, Math.floor((Date.now() - createdAt) / 86_400_000) + 1),
    streak: doc.progress.streakCurrent,
  };
}

export function achievementViews(stats: StatsBundle, claimed: string[]): AchievementView[] {
  return ACHIEVEMENTS.map((item) => {
    const progress = item.progress(stats);
    const done = progress >= item.threshold;
    return {
      item,
      progress,
      percent: item.threshold > 0 ? Math.min(100, Math.round((progress / item.threshold) * 100)) : 0,
      done,
      claimed: claimed.includes(item.id),
    };
  });
}

export function findAchievement(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((item) => item.id === id);
}
