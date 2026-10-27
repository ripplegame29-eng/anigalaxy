import { dayKey, dayStart } from "./day";
import { num, type Database } from "./sqlite";

/**
 * Аналитика роста для админ-панели: регистрации, активные игроки,
 * просмотры и популярные тайтлы за выбранный период.
 *
 * Активность за день — это объединение: таблица `activity_days` (пишется
 * при каждом заходе), открытые серии из истории просмотра игрока и дни
 * регистрации/последнего визита. Так графики не пустые и за период до
 * появления таблицы.
 */

const HISTORY_KEY = "animehub:history:v1";
const PERIODS = [7, 30, 90];

interface Rec {
  id: string;
  title: string;
  at: number;
  poster?: string;
}

function records(value: string): Rec[] {
  try {
    const parsed = JSON.parse(value) as { records?: unknown };
    if (!parsed || !Array.isArray(parsed.records)) return [];
    return parsed.records.filter(
      (r): r is Rec => Boolean(r) && typeof (r as Rec).id === "string" && typeof (r as Rec).at === "number" && (r as Rec).at > 0,
    );
  } catch {
    return [];
  }
}

const touched = new Map<number, string>();

/** Отмечает заход игрока за сегодня (один запрос в базу на игрока в сутки) */
export function touchActivity(db: Database, userId: number, now = Date.now()): void {
  const day = dayKey(now);
  if (touched.get(userId) === day) return;
  try {
    db.prepare("INSERT OR IGNORE INTO activity_days (user_id, day) VALUES (?, ?)").run(userId, day);
    touched.set(userId, day);
  } catch {
    /* аналитика не должна ломать запрос */
  }
}

const cache = new Map<number, { at: number; data: Analytics }>();

export interface TitleStat {
  id: string;
  title: string;
  poster: string;
  views: number;
  viewers: number;
  prev: number;
}

export interface Analytics {
  days: number;
  labels: string[];
  regs: number[];
  total: number[];
  dau: number[];
  views: number[];
  hours: number[];
  titles: TitleStat[];
  kpi: {
    totalUsers: number;
    regs: number;
    regsPrev: number;
    active: number;
    activePrev: number;
    dauToday: number;
    wau: number;
    mau: number;
    views: number;
    viewsPrev: number;
  };
}

export function analytics(db: Database, daysParam: number, now = Date.now()): Analytics {
  const n = PERIODS.includes(daysParam) ? daysParam : 30;
  const hit = cache.get(n);
  if (hit && now - hit.at < 60_000) return hit.data;

  const horizon = Math.max(2 * n, 30);
  const keys: string[] = [];
  const starts: number[] = [];
  for (let i = horizon - 1; i >= 0; i -= 1) {
    const s = dayStart(now, i);
    starts.push(s);
    keys.push(dayKey(s));
  }
  const index = new Map(keys.map((k, i) => [k, i]));
  const from = starts[0];
  const curFrom = horizon - n; // индекс первого дня текущего периода
  const prevFrom = Math.max(0, curFrom - n);

  const regsAll = new Array<number>(horizon).fill(0);
  const active = keys.map(() => new Set<number>());
  const viewsAll = new Array<number>(horizon).fill(0);
  const hours = new Array<number>(24).fill(0);

  const mark = (day: number | undefined, userId: number) => {
    if (day !== undefined) active[day].add(userId);
  };

  for (const row of db.prepare("SELECT id, created_at, last_seen_at FROM users WHERE created_at >= ? OR last_seen_at >= ?").all(from, from)) {
    const id = num(row.id);
    const created = num(row.created_at);
    const seen = num(row.last_seen_at);
    if (created >= from) {
      const d = index.get(dayKey(created));
      if (d !== undefined) {
        regsAll[d] += 1;
        mark(d, id);
      }
    }
    if (seen >= from) mark(index.get(dayKey(seen)), id);
  }

  try {
    for (const row of db.prepare("SELECT user_id, day FROM activity_days WHERE day >= ?").all(keys[0])) {
      mark(index.get(String(row.day)), num(row.user_id));
    }
  } catch {
    /* таблицы может не быть до миграции */
  }

  const titles = new Map<string, { title: string; poster: string; views: number; viewers: Set<number>; prev: number }>();
  const curStartMs = starts[curFrom];
  const prevStartMs = starts[prevFrom];
  for (const row of db.prepare("SELECT user_id, value FROM user_docs WHERE doc_key = ?").all(HISTORY_KEY)) {
    const userId = num(row.user_id);
    for (const rec of records(String(row.value))) {
      if (rec.at < from) continue;
      const d = index.get(dayKey(rec.at));
      if (d === undefined) continue;
      mark(d, userId);
      viewsAll[d] += 1;
      if (rec.at >= curStartMs) {
        hours[new Date(rec.at).getHours()] += 1;
        const t = titles.get(rec.id) ?? { title: rec.title, poster: "", views: 0, viewers: new Set<number>(), prev: 0 };
        t.views += 1;
        t.viewers.add(userId);
        if (rec.title) t.title = rec.title;
        if (rec.poster) t.poster = rec.poster;
        titles.set(rec.id, t);
      } else if (rec.at >= prevStartMs) {
        const t = titles.get(rec.id) ?? { title: rec.title, poster: "", views: 0, viewers: new Set<number>(), prev: 0 };
        t.prev += 1;
        if (!t.title && rec.title) t.title = rec.title;
        titles.set(rec.id, t);
      }
    }
  }

  const totalUsers = num(db.prepare("SELECT COUNT(*) AS c FROM users").get()?.c);
  // «Всего игроков» на конец каждого дня: идём назад от сегодняшнего значения
  const totalAll = new Array<number>(horizon).fill(0);
  let running = totalUsers;
  for (let i = horizon - 1; i >= 0; i -= 1) {
    totalAll[i] = running;
    running -= regsAll[i];
  }

  const sum = (arr: number[], a: number, b: number) => arr.slice(a, b).reduce((s, v) => s + v, 0);
  const union = (a: number, b: number) => {
    const all = new Set<number>();
    for (let i = a; i < b; i += 1) active[i].forEach((u) => all.add(u));
    return all.size;
  };

  const data: Analytics = {
    days: n,
    labels: keys.slice(curFrom),
    regs: regsAll.slice(curFrom),
    total: totalAll.slice(curFrom),
    dau: active.slice(curFrom).map((s) => s.size),
    views: viewsAll.slice(curFrom),
    hours,
    titles: [...titles.entries()]
      .filter(([, t]) => t.views > 0)
      .map(([id, t]) => ({ id, title: t.title || id, poster: t.poster, views: t.views, viewers: t.viewers.size, prev: t.prev }))
      .sort((a, b) => b.views - a.views || b.viewers - a.viewers)
      .slice(0, 10),
    kpi: {
      totalUsers,
      regs: sum(regsAll, curFrom, horizon),
      regsPrev: sum(regsAll, prevFrom, curFrom),
      active: union(curFrom, horizon),
      activePrev: union(prevFrom, curFrom),
      dauToday: active[horizon - 1].size,
      wau: union(horizon - 7, horizon),
      mau: union(horizon - 30, horizon),
      views: sum(viewsAll, curFrom, horizon),
      viewsPrev: sum(viewsAll, prevFrom, curFrom),
    },
  };
  cache.set(n, { at: now, data });
  return data;
}
