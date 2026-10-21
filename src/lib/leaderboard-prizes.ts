/**
 * Чистая часть лидерборда: очки соперников, призы и место за очки.
 * Без хранилищ и браузера, поэтому покрыта юнит-тестами.
 */

/** Очки лидера недели у сгенерированных соперников */
export const TOP_POINTS = 4702;
/** Множитель очков за период: неделя / месяц / всё время */
export const PERIOD_SCALE = [1, 4.3, 28];
/** Сколько мест получают приз */
export const PRIZE_DEPTH = 100;

/** Детерминированный шум: строки не «прыгают» между рендерами */
export function noise(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Очки соперника на месте i (с нуля) за период */
export function botPoints(period: number, i: number): number {
  return TOP_POINTS * PERIOD_SCALE[period] * Math.pow(0.982, i) * (1 - noise(i, period) * 0.01);
}

export interface Prize {
  from: number;
  to: number;
  place: string;
  xp: number;
  ac: number;
  titleId?: string;
  frameId?: string;
  text: string;
}

export const PRIZES: Prize[] = [
  { from: 1, to: 1, place: "1 место", xp: 3000, ac: 600, titleId: "t-lb-conqueror", frameId: "frame-golden-laurel", text: "3 000 XP и 600 AC, титул «Покоритель», золотая рамка «Золотой лавр»" },
  { from: 2, to: 5, place: "2–5", xp: 1500, ac: 300, titleId: "t-lb-elite", frameId: "frame-golden-seal", text: "1 500 XP и 300 AC, титул «Элита недели», рамка «Золотая печать»" },
  { from: 6, to: 10, place: "6–10", xp: 900, ac: 150, titleId: "t-lb-top10", text: "900 XP и 150 AC, титул «Десятка недели»" },
  { from: 11, to: 25, place: "11–25", xp: 450, ac: 80, text: "450 XP и 80 AC" },
  { from: 26, to: 100, place: "26–100", xp: 150, ac: 30, text: "150 XP и 30 AC" },
];

export const prizeFor = (rank: number | null): Prize | undefined =>
  rank === null ? undefined : PRIZES.find((p) => rank >= p.from && rank <= p.to);

/** Место за недельные очки: 1 + число соперников впереди; null — вне призовой сотни */
export function weeklyRank(points: number): number | null {
  if (points <= 0) return null;
  let ahead = 0;
  for (let i = 0; i < PRIZE_DEPTH; i += 1) if (botPoints(0, i) > points) ahead += 1;
  const rank = ahead + 1;
  return rank <= PRIZE_DEPTH ? rank : null;
}

/** Понедельник текущей недели по UTC: «2026-10-19» */
export function weekKey(now: number): string {
  const d = new Date(now);
  const back = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back)).toISOString().slice(0, 10);
}
