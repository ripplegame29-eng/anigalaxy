/**
 * Серия дней — капсула в шапке профиля.
 *
 * Числа, уровни и механика кольца перенесены из макета «AniGalaxy — серия
 * дней» как есть: пять уровней (Искра/Пламя/Плазма/Звёздный след/Сверхновая)
 * и семь отметок (7, 14, 30, 60, 100, 200, 365).
 *
 * Награды — не из макета. Там на отметках стоят «тег Комета», «рамка Орбита»
 * и «тег Первозданный», которых в проекте нет: показывать их значило бы
 * обещать предметы, которых нельзя купить. Здесь отметка разрешается в то,
 * что проект действительно выдаёт:
 *
 *   • каждые `economy.streakEveryDays` дней — `economy.streakBonusAc` AC
 *     (движок начисляет это сам, см. `startSession`);
 *   • достижения семейства `streak`, у которых порог равен отметке.
 *
 * Отметка, на которой нет ни того, ни другого, показывает честное «без
 * награды» вместо правдоподобной выдумки.
 */

import { PROGRESSION_CONFIG } from "./progression/progression.config";

/** Отметки из макета: до них кольцо и полоса идут своим шагом. */
export const STREAK_MARKS = [7, 14, 30, 60, 100, 200, 365] as const;

/** Пять уровней из макета: `from` — с какого дня огонь выглядит так. */
export const STREAK_TIERS = [
  { name: "Искра", from: 0 },
  { name: "Пламя", from: 7 },
  { name: "Плазма", from: 30 },
  { name: "Звёздный след", from: 100 },
  { name: "Сверхновая", from: 365 },
] as const;

export const STREAK_TIER_MAX = STREAK_TIERS.length - 1;

export type StreakTier = {
  /** Индекс уровня 0…4 — им же помечается капсула (`t0`…`t4`). */
  index: number;
  name: string;
};

/** Уровень серии: последний, чей порог пройден. */
export function streakTier(days: number): StreakTier {
  let index = 0;
  STREAK_TIERS.forEach((tier, i) => {
    if (days >= tier.from) index = i;
  });
  return { index, name: STREAK_TIERS[index].name };
}

export type StreakSpan = {
  /** Предыдущая отметка: с неё начинается текущий шаг. */
  prev: number;
  /** Следующая отметка; null — все пройдены. */
  next: number | null;
  /** Доля шага 0…100 для кольца. */
  percent: number;
};

export function streakSpan(days: number): StreakSpan {
  let prev = 0;
  let next: number | null = null;
  for (const mark of STREAK_MARKS) {
    if (days < mark) {
      next = mark;
      break;
    }
    prev = mark;
  }
  // Нижняя граница 4% — иначе на первых днях кольцо выглядит пустым,
  // хотя серия уже идёт. Это же значение стоит в макете.
  const percent = next === null ? 100 : Math.max(4, ((days - prev) / (next - prev)) * 100);
  return { prev, next, percent };
}

export type StreakReward = {
  /** Текст награды для строки в окне серии. */
  label: string;
  /** Отдельная выплата AC — её показываем с плюсом, предметы названием. */
  ac: number;
  /** Ячейка достижения, если отметка совпала с порогом достижения. */
  achievementId: string | null;
};

/**
 * Что проект реально даёт за отметку. `null` — награды нет, и в окне
 * серия об этом скажет прямо, а не придумает предмет.
 */
export function streakReward(days: number | null): StreakReward | null {
  if (days === null) return null;

  const { economy, achievements } = PROGRESSION_CONFIG;
  const parts: string[] = [];
  let ac = 0;
  let achievementId: string | null = null;

  if (days % economy.streakEveryDays === 0) {
    ac = economy.streakBonusAc;
    parts.push(`+${ac} AC`);
  }

  const ach = achievements.find(
    (item) => item.family === "streak" && item.condition.metric === "STREAK_BEST" && item.condition.threshold === days,
  );
  if (ach) {
    achievementId = ach.id;
    parts.push(`достижение «${ach.name}»`);
  }

  if (parts.length === 0) return null;
  return { label: parts.join(" + "), ac, achievementId };
}

/** «1 день / 2 дня / 5 дней» — правило из макета. */
export function pluralDays(n: number): string {
  const a = n % 10;
  const b = n % 100;
  if (a === 1 && b !== 11) return "день";
  if (a >= 2 && a <= 4 && (b < 10 || b >= 20)) return "дня";
  return "дней";
}

/** Максимум заморозок — из конфига, а не константой из макета. */
export const STREAK_FREEZE_MAX = PROGRESSION_CONFIG.economy.freezeMax;

/** Ключ календарного дня в часовом поясе пользователя, как у движка. */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Разбор ключа в локальную полночь — без `new Date(key)`, который трактует
 *  строку как UTC и на отрицательных смещениях сдвигает день назад. */
function parseDayKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  date.setHours(0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

export type StreakWeek = {
  /** Пн…Вс текущей недели. */
  days: { key: string; label: string }[];
  /** Ключи дней, попавших в серию. */
  done: Set<string>;
};

/**
 * Неделя вокруг серии: отмечены дни, которые серия действительно покрывает.
 *
 * Источник — `lastActiveDate` и `streakCurrent`: серия это N подряд идущих
 * дней, заканчивающихся в `lastActiveDate`. Ничего не придумываем про
 * «какие дни смотрели» — если день не входит в окно серии, он и не отмечен.
 */
export function streakWeek(lastActiveDate: string, current: number): StreakWeek {
  const labels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const anchor = parseDayKey(lastActiveDate);
  const done = new Set<string>();
  if (anchor && current > 0) {
    for (let back = 0; back < current; back++) {
      const d = new Date(anchor);
      d.setDate(anchor.getDate() - back);
      done.add(dayKey(d));
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Понедельник недели: (день недели + 6) % 7 — как в макете.
  const mondayOffset = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - mondayOffset);

  const days = labels.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { key: dayKey(d), label };
  });

  return { days, done };
}

/** Миллисекунд до полуночи — для обратного отсчёта, когда день ещё не засчитан. */
export function msUntilMidnight(now: Date = new Date()): number {
  const end = new Date(now);
  end.setHours(24, 0, 0, 0);
  return Math.max(0, end.getTime() - now.getTime());
}

/** «чч:мм:сс» из миллисекунд, как в макете. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((x) => String(x).padStart(2, "0")).join(":");
}