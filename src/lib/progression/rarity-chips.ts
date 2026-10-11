/**
 * Редкости конфига прогрессии (COMMON…SECRET) → классы и подписи чипов.
 *
 * Единый источник для раздела «Достижения», примерочной (вкладка «Теги»)
 * и магазина: редкость тегов/достижений и редкость косметики — разные
 * шкалы, поэтому у каждой свой модуль.
 */

export const CFG_RARITY_CLASS: Record<string, string> = {
  COMMON: "bg-white/8 text-white/70 ring-white/15",
  UNCOMMON: "bg-emerald-400/15 text-emerald-300 ring-emerald-400/30",
  RARE: "bg-sky-400/15 text-sky-300 ring-sky-400/30",
  EPIC: "bg-violet-400/15 text-violet-300 ring-violet-400/30",
  LEGENDARY: "bg-amber-400/15 text-amber-300 ring-amber-400/30",
  MYTHIC: "bg-rose-400/15 text-rose-300 ring-rose-400/30",
  SECRET: "bg-white/8 text-white/70 ring-white/15",
};

export const CFG_RARITY_LABEL: Record<string, string> = {
  COMMON: "Обычный",
  UNCOMMON: "Необычный",
  RARE: "Редкий",
  EPIC: "Эпический",
  LEGENDARY: "Легендарный",
  MYTHIC: "Мифический",
  SECRET: "Секрет",
};
