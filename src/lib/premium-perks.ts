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

export type PremiumIcon = "quality" | "boost" | "clan" | "pass" | "cosmetics" | "gifts" | "tag";

/** Пробный период: дней Premium бесплатно, один раз на аккаунт */
export const PREMIUM_TRIAL_DAYS = 3;

/** Ежемесячный подарок подписчика: монеты и заморозки серии */
export const PREMIUM_DROP = { ac: 300, freezes: 1 } as const;


export interface PremiumPerk {
  id: string;
  icon: PremiumIcon;
  /**
   * Заголовок возможности. Длинные формулировки — это осознанно: короткие
   * обрывались на «4K и 2K в каждой серии» или «Клану +50% очков», и по
   * такому заголовку не было видно, что именно даёт подписка.
   */
  title: string;
  /**
   * Что именно делает — одной строкой. Необязательно: у возможностей, где
   * заголовок уже всё объясняет, второго абзаца нет — иначе в карточке один
   * и тот же текст печатался бы дважды.
   */
  text?: string;
  /** Где это видно в интерфейсе: помогает поверить, а не поверить на слово */
  where: string;
}

/** Множитель начислений за квесты и бонус за вход */
export const PREMIUM_QUEST_MULT = 2;

/** Насколько выше ставка клановых заданий */
export const PREMIUM_CLAN_MULT = 1.5;

/** Качества плеера, доступные только по подписке */
export const PREMIUM_QUALITIES = ["2160", "1440"] as const;

/**
 * Сколько первых серий смотрят в 2K/4K без подписки.
 *
 * Апскейл Anime4K реально грузит GPU, поэтому всю серию отдавать его всем
 * было бы нечестно. Но и совсем закрывать его нельзя: без него не видно,
 * что вообще покупается. Поэтому первые серии — бесплатная витрина, дальше
 * замок с окном и переходом на страницу подписки.
 */
export const FREE_HQ_EPISODES = 2;

export const PREMIUM_PERKS: PremiumPerk[] = [
  {
    id: "tag",
    icon: "tag",
    title: "Тег Premium",
    text: "Значок Premium у ника в шапке и в меню профиля, пока подписка активна.",
    where: "Шапка → ник",
  },
  {
    id: "boost",
    icon: "boost",
    title: "Вдвое больше за квесты",
    text: `Начисления XP и AC за ежедневные и недельные задания ×${PREMIUM_QUEST_MULT}.`,
    where: "Профиль → Квесты, баланс AC",
  },
  {
    id: "pass",
    icon: "pass",
    title: "Дополнительные награды",
    text: "AC, уникальные рамки аватара, титулы и другие косметические предметы. Получай награды по мере прохождения уровней.",
    where: "Боевой пропуск → колонка Premium",
  },
  {
    id: "cosmetics",
    icon: "cosmetics",
    title: "Эксклюзивные рамки и титулы",
    text: "Четыре предмета, которых нет в магазине за AC: два титула и две рамки.",
    where: "Профиль → Косметика",
  },
  {
    id: "daily",
    icon: "gifts",
    title: "Двойная награда за вход",
    text: "Ежедневный вход с Premium даёт вдвое больше AC и XP, включая коробки и гранд месяца.",
    where: "Шапка → Ежедневный вход",
  },
  {
    id: "drop",
    icon: "gifts",
    title: `Подарок каждый месяц: ${PREMIUM_DROP.ac} монет и заморозка серии`,
    text: "Раз в месяц на странице Premium забираешь монеты и заморозку, которая спасает серию дней.",
    where: "Premium → Подарок месяца",
  },
  {
    id: "backgrounds",
    icon: "cosmetics",
    title: "Три эксклюзивных фона профиля",
    text: "Фоны «Золотой час», «Ночная сакура» и «Премиум-аврора» — только для подписчиков.",
    where: "Профиль → Изменить фон",
  },
  {
    id: "gifts",
    icon: "gifts",
    title: "Промокоды на дни подписки",
    text: "Промокод добавляет дни Premium; каждый код срабатывает один раз.",
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

/**
 * Нужен ли Premium для выбора качества в конкретной серии.
 *
 * Номер серии обязателен намеренно: правило было «2K/4K только по подписке»
 * для всей серии, и витрины не было вовсе — посмотреть, что вообще
 * покупается, без подписки было негде. Теперь первые FREE_HQ_EPISODES серий
 * открыты всем, дальше — только подписка.
 */
export function qualityNeedsPremium(quality: string, episode: number): boolean {
  if (!(PREMIUM_QUALITIES as readonly string[]).includes(quality)) return false;
  return episode > FREE_HQ_EPISODES;
}

/** Открыто ли 2K/4K всем в этой серии (для подписи в меню качества) */
export function hqFreeForEpisode(episode: number): boolean {
  return episode <= FREE_HQ_EPISODES;
}