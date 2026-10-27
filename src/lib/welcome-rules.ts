/**
 * Приветственные правила для новичков — общие для сервера и интерфейса:
 * бонус за регистрацию и квест на три дня. Без "use client": файл
 * импортируется и в серверных маршрутах.
 */

/** Монеты за регистрацию */
export const SIGNUP_BONUS_AC = 100;

export interface WelcomeDay {
  day: 1 | 2 | 3;
  title: string;
  ac: number;
  xp: number;
  /** Дней Premium в награду */
  premiumDays: number;
  /** Рамка в награду */
  frame?: { id: string; name: string };
}

export const WELCOME_DAYS: readonly WelcomeDay[] = [
  { day: 1, title: "Старт", ac: 50, xp: 200, premiumDays: 0 },
  { day: 2, title: "Второй заход", ac: 100, xp: 300, premiumDays: 1 },
  { day: 3, title: "Свой стиль", ac: 150, xp: 500, premiumDays: 0, frame: { id: "frame-13", name: "Синее пламя эго" } },
];

/** Сколько дней после регистрации квест остаётся доступным */
export const WELCOME_WINDOW_DAYS = 14;

export function welcomeRewardText(d: WelcomeDay): string {
  const parts = [`+${d.ac} монет`, `+${d.xp} XP`];
  if (d.premiumDays) parts.push(`${d.premiumDays} день Premium`);
  if (d.frame) parts.push(`рамка «${d.frame.name}»`);
  return parts.join(" · ");
}
