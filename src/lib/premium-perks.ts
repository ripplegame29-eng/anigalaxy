/**
 * Что именно даёт Premium — данные без React.
 *
 * Единый источник правды: страница Premium, меню качества плеера, движок
 * прогрессии и кланы читают этот же модуль. Раньше возможности были
 * расписаны текстом прямо в компоненте страницы, а по факту не делали
 * ничего — «4K-качество» стояло в списке, хотя плеер отдавал его всем
 * бесплатно, а промокод принимался и не продлевал подписку.
 *
 * Файл намеренно без хуков и без localStorage: его читает и движок
 * (чистая функция), и клиентские компоненты.
 */

export type PremiumIcon = "quality" | "boost" | "clan" | "pass" | "cosmetics" | "gifts";

export interface PremiumPerk {
  id: string;
  icon: PremiumIcon;
  /** Заголовок возможности */
  title: string;
  /** Что именно делает — одной строкой */
  text: string;
  /** Где это видно в интерфейсе: помогает поверить, а не поверить на слово */
  where: string;
}

/** Множитель начислений за квесты и бонус за вход */
export const PREMIUM_QUEST_MULT = 2;

/** Насколько выше ставка клановых заданий */
export const PREMIUM_CLAN_MULT = 1.5;

/** Качества плеера, доступные только по подписке */
export const PREMIUM_QUALITIES = ["2160", "1440"] as const;

export const PREMIUM_PERKS: PremiumPerk[] = [
  {
    id: "quality",
    icon: "quality",
    title: "4K и 2K в плеере",
    text: "Цели Anime4K поверх потока 1080p: восстановление линий и апскейл ×2 до 2160p и 1440p.",
    where: "Плеер → Качество → 4K / 2K",
  },
  {
    id: "boost",
    icon: "boost",
    title: "Вдвое больше за квесты и вход",
    text: `Начисления XP и атомов за ежедневные и недельные задания и бонус за вход ×${PREMIUM_QUEST_MULT}.`,
    where: "Профиль → Квесты, баланс атомов",
  },
  {
    id: "clan",
    icon: "clan",
    title: "Клану +50% очков",
    text: "Задания войны кланов считают на 50% больше очков за главу, серию и закрытое задание.",
    where: "Кланы → Война, Задания",
  },
  {
    id: "pass",
    icon: "pass",
    title: "Линия Premium в пропуске",
    text: "Вторая линия наград сезона: аникойны, рамки и теги — на каждом уровне отдельно от бесплатной.",
    where: "Боевой пропуск → колонка Premium",
  },
  {
    id: "cosmetics",
    icon: "cosmetics",
    title: "Эксклюзивные рамки и титулы",
    text: "Четыре предмета, которых нет в магазине за атомы: два титула и две рамки.",
    where: "Профиль → Косметика",
  },
  {
    id: "gifts",
    icon: "gifts",
    title: "Промокоды на дни подписки",
    text: "Промокод на странице Premium продлевает подписку, а не просто показывает текст.",
    where: "Premium → Есть промокод",
  },
];

/**
 * Промокоды: код → сколько дней подписки он добавляет.
 *
 * Раньше промокод принимался и показывал текст, но подписку не продлевал —
 * обещание на странице было пустым. Теперь код реально начисляет дни.
 */
export const PROMO_DAYS: Record<string, number> = {
  START: 3,
  ANIGALAXY: 7,
  PREMIUM25: 7,
  OTAGENS: 30,
};

/** Промокод уже использован — повторное применение ничего не даёт */
const PROMO_KEY = "animehub:promo:v1";

/** Сколько раз каждый код применялся */
export function promoUses(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PROMO_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export interface PromoResult {
  ok: boolean;
  /** Текст для показа пользователю */
  message: string;
  /** Начислено дней (0 — ничего не начислено) */
  days: number;
}

/**
 * Применить промокод.
 *
 * Ограничение одно: один код на аккаунт. Иначе код из новостей, который
 * все и так увидели, превращался бы в бесконечное продление.
 */
export function applyPromo(
  code: string,
  addDays: (days: number) => number | null,
): PromoResult {
  const key = code.trim().toUpperCase();
  if (!key) return { ok: false, message: "Введи промокод", days: 0 };

  const days = PROMO_DAYS[key];
  if (!days) return { ok: false, message: "Промокод не найден или истёк", days: 0 };

  const used = promoUses();
  if (used[key]) {
    return {
      ok: false,
      message: `Промокод ${key} уже использован — он даёт ${days} ${daysWord(days)} только один раз`,
      days: 0,
    };
  }

  const until = addDays(days);
  if (until === null) return { ok: false, message: "Сначала войди в аккаунт", days: 0 };

  try {
    window.localStorage.setItem(PROMO_KEY, JSON.stringify({ ...used, [key]: 1 }));
  } catch {
    /* без записи повторно применить можно будет, но подписка уже продлена */
  }

  return {
    ok: true,
    message: `Промокод принят: подписка продлена на ${days} ${daysWord(days)}`,
    days,
  };
}

function daysWord(days: number): string {
  const mod10 = days % 10;
  const mod100 = days % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "дня";
  return "дней";
}

/** Нужен ли Premium для выбора качества */
export function qualityNeedsPremium(quality: string): boolean {
  return (PREMIUM_QUALITIES as readonly string[]).includes(quality);
}