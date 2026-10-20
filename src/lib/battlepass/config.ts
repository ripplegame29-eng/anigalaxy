/**
 * Конфигурация сезона боевого пропуска (§5 ТЗ).
 *
 * Только данные: сезон, кривая XP и таблицы наград FREE/PREMIUM.
 * Суммы AC и XP живут исключительно здесь — UI и движок их не дублируют.
 *
 * Предметы — реальные id каталогов проекта (фиктивных записей нет):
 *   - теги  → `PROGRESSION_CONFIG.tags` (progression.config.ts);
 *   - рамки → `FRAMES` (cosmetics.ts): «маски» в проекте — те же рамки,
 *     поле `as` лишь подписывает их в UI названием из ТЗ.
 *
 * `dupeAc` — компенсация AC, если предмет уже есть у пользователя
 * (§5 ТЗ: дубликат не выдаётся, вместо него начисляется валюта).
 */

import type { BattlepassLine } from "../progression/types";

export type { BattlepassLine };

export type BpReward =
  /** Аникойны в баланс */
  | { kind: "ac"; amount: number }
  /** XP боевого пропуска (отдельная сущность, продвигает по уровням) */
  | { kind: "bpXp"; amount: number }
  /** Тег из каталога прогрессии */
  | { kind: "tag"; itemId: string; dupeAc: number }
  /** Рамка/маска из гардероба; `as` — подпись в названии (рамка/маска) */
  | { kind: "frame"; itemId: string; dupeAc: number; as?: "frame" | "mask" }
  /** «Лучшая подходящая» рамка из магазина: первая невыданная из списка */
  | { kind: "framePick"; candidates: string[]; dupeAc: number };

export interface BpLevelDef {
  level: number;
  free?: BpReward[];
  premium?: BpReward[];
}

export interface BattlePassConfig {
  /** id сезона — входит в ключи идемпотентности и в документ прогрессии */
  seasonId: string;
  name: string;
  description: string;
  /** Границы сезона, мс (фиксированные даты — безопасны для гидратации) */
  from: number;
  to: number;
  maxLevel: number;
  /** Стоимость уровня L: `base + step × (L − 1)` (первые уровни быстрые) */
  cost: { base: number; step: number };
  /** Сколько XP пропуска даёт каждый зачисленный XP активности сайта */
  xpPerSiteXp: number;
  /** Уровни с наградами — остальные 100 уровней несут только прогресс */
  levels: BpLevelDef[];
}

/**
 * Контекст, который движок получает снаружи (сервис читает сторы):
 * премиум и купленная косметика. В server-режиме эти значения приходят
 * с сервера — клиент их не передаёт.
 */
export interface BpExtras {
  premium: boolean;
  purchased: string[];
}

/* ------------------------------- Сезон ---------------------------------- */

/**
 * Тип задания сезона.
 *
 * Задания не заводят собственных счётчиков: каждое указывает на то сезонное
 * состояние, которое движок и так ведёт в `doc.battlepass`. Поэтому прогресс
 * всегда настоящий, а обнуляется он вместе со сменой сезона — см.
 * `syncSeason` в engine.ts.
 */
export type BpMissionKind = "bpXp" | "level" | "claim";

export interface BpMission {
  id: string;
  title: string;
  description: string;
  kind: BpMissionKind;
  /** Цель в единицах kind: XP пропуска, номер уровня, число забранных наград */
  target: number;
}

const SEASON_MISSIONS: BpMission[] = [
  { id: "ms-xp-500", title: "Первый полёт", description: "Накопить 500 XP боевого пропуска за сезон", kind: "bpXp", target: 500 },
  { id: "ms-xp-2000", title: "Разгон", description: "Накопить 2000 XP боевого пропуска за сезон", kind: "bpXp", target: 2000 },
  { id: "ms-xp-6000", title: "Полный разгон", description: "Накопить 6000 XP боевого пропуска за сезон", kind: "bpXp", target: 6000 },
  { id: "ms-lvl-10", title: "Десятый рубеж", description: "Дойти до 10 уровня боевого пропуска", kind: "level", target: 10 },
  { id: "ms-lvl-30", title: "Тридцатый рубеж", description: "Дойти до 30 уровня боевого пропуска", kind: "level", target: 30 },
  { id: "ms-claim-20", title: "Кладоискатель", description: "Забрать 20 наград на уровнях пропуска", kind: "claim", target: 20 },
];

/** Задания сезона в порядке показа */
export const BP_MISSIONS: BpMission[] = SEASON_MISSIONS;

/* ---------------------------- Уровни наград ------------------------------ */

/**
 * Кураторские milestone-уровни сезона: предметы, рамки, теги и крупные
 * пакеты AC/XP на «реперных» точках (5, 10, 20…). Остаются неизменными —
 * балансируются вручную.
 */
const MILESTONE_LEVELS: BpLevelDef[] = [
    {
      level: 1,
      free: [{ kind: "ac", amount: 100 }],
      premium: [{ kind: "ac", amount: 250 }],
    },
    {
      level: 5,
      free: [{ kind: "ac", amount: 150 }],
      premium: [{ kind: "frame", itemId: "frame-36", dupeAc: 600, as: "frame" }],
    },
    {
      level: 10,
      free: [{ kind: "ac", amount: 200 }],
      premium: [{ kind: "tag", itemId: "tag_shadow_clan", dupeAc: 10000 }],
    },
    {
      level: 13,
      free: [{ kind: "bpXp", amount: 150 }],
      premium: [{ kind: "bpXp", amount: 300 }],
    },
    {
      level: 17,
      free: [{ kind: "bpXp", amount: 250 }],
      premium: [{ kind: "bpXp", amount: 400 }],
    },
    {
      level: 20,
      free: [{ kind: "frame", itemId: "frame-12", dupeAc: 600, as: "frame" }],
      premium: [{ kind: "frame", itemId: "frame-24", dupeAc: 1500, as: "frame" }],
    },
    {
      level: 25,
      free: [{ kind: "frame", itemId: "frame-35", dupeAc: 600, as: "mask" }],
      premium: [{ kind: "frame", itemId: "frame-34", dupeAc: 600, as: "mask" }],
    },
    {
      level: 30,
      free: [{ kind: "tag", itemId: "tag_ashura", dupeAc: 5000 }],
      premium: [{ kind: "tag", itemId: "tag_crimson_dawn", dupeAc: 5000 }],
    },
    {
      level: 35,
      free: [{ kind: "frame", itemId: "frame-16", dupeAc: 600, as: "mask" }],
      premium: [{ kind: "frame", itemId: "frame-01", dupeAc: 3000, as: "frame" }],
    },
    {
      level: 40,
      free: [{ kind: "frame", itemId: "frame-13", dupeAc: 600, as: "frame" }],
      premium: [{ kind: "frame", itemId: "frame-19", dupeAc: 600, as: "mask" }],
    },
    {
      level: 45,
      free: [{ kind: "ac", amount: 250 }],
      premium: [{ kind: "ac", amount: 500 }],
    },
    {
      level: 50,
      free: [{ kind: "ac", amount: 500 }],
      premium: [{ kind: "tag", itemId: "tag_cursed", dupeAc: 10000 }],
    },
    {
      level: 55,
      free: [{ kind: "bpXp", amount: 300 }],
      premium: [{ kind: "bpXp", amount: 500 }],
    },
    {
      level: 60,
      free: [{ kind: "frame", itemId: "frame-15", dupeAc: 600, as: "mask" }],
      premium: [{ kind: "tag", itemId: "tag_ghoul", dupeAc: 5000 }],
    },
    {
      level: 65,
      free: [{ kind: "ac", amount: 300 }],
      premium: [{ kind: "ac", amount: 600 }],
    },
    {
      // Титул «Гуль» остался только на золотой линии (уровень 60), поэтому
      // в бесплатной ветке на этом уровне — крупный пакет AC
      level: 70,
      free: [{ kind: "ac", amount: 800 }],
      premium: [{ kind: "frame", itemId: "frame-21", dupeAc: 600, as: "mask" }],
    },
    {
      level: 75,
      free: [{ kind: "bpXp", amount: 400 }],
      premium: [{ kind: "bpXp", amount: 600 }],
    },
    {
      level: 80,
      free: [{ kind: "frame", itemId: "frame-12", dupeAc: 600, as: "frame" }],
      premium: [{ kind: "frame", itemId: "frame-02", dupeAc: 3000, as: "frame" }],
    },
    {
      level: 85,
      free: [{ kind: "ac", amount: 350 }],
      premium: [{ kind: "ac", amount: 750 }],
    },
    {
      level: 90,
      free: [{ kind: "frame", itemId: "frame-21", dupeAc: 600, as: "mask" }],
      premium: [{ kind: "frame", itemId: "frame-16", dupeAc: 600, as: "mask" }],
    },
    {
      level: 95,
      free: [{ kind: "bpXp", amount: 500 }],
      premium: [{ kind: "bpXp", amount: 1000 }],
    },
    {
      level: 100,
      free: [{ kind: "ac", amount: 1000 }],
      premium: [
        { kind: "tag", itemId: "tag_shogun", dupeAc: 7500 },
        { kind: "ac", amount: 2500 },
        {
          kind: "framePick",
          // лучшие рамки магазина по убыванию редкости/цены
          candidates: ["frame-18", "frame-30", "frame-24", "frame-13"],
          dupeAc: 5000,
        },
      ],
    },
];

/**
 * Уровни-«передышки»: на них нет наград ни на одной линии. Уровень 3
 * держим пустым, чтобы текущий уровень без наград читался как «вы здесь»
 * (покрыто тестом на статус CURRENT); остальные — ритмические паузы между
 * milestone-пакетами.
 */
const REST_LEVELS = new Set([2, 3, 11, 42, 99]);

/** Ближайший milestone-уровень ≤ n (для масштабирования filler-наград) */
const nearestMilestone = (n: number): number => {
  let best = 0;
  for (const def of MILESTONE_LEVELS) {
    if (def.level <= n) best = def.level;
    else break;
  }
  return best;
};

/**
 * Filler-награды на промежуточных уровнях, чтобы пропуск щедро сыпал на
 * каждом шаге, а не только на 22 реперных точках. Детерминированная формула
 * (без рандома — гидратация и сервер обязаны сойтись): premium заметно
 * ценнее (~2.2×), каждые 6-й уровень — двойной пакет (бандл ×2), между
 * milestone-точками акцент плавно смещается с AC на XP.
 */
const buildFillerLevels = (): BpLevelDef[] => {
  const milestoneSet = new Set(MILESTONE_LEVELS.map((def) => def.level));
  const defs: BpLevelDef[] = [];
  for (let level = 1; level <= 100; level += 1) {
    if (milestoneSet.has(level) || REST_LEVELS.has(level)) continue;
    const anchor = nearestMilestone(level);
    // 0..1 между двумя milestone-точками — плавный сдвиг AC → XP
    const phase = (level - anchor) / 5;
    const ac = Math.round((40 + level * 9) * (1 - phase));
    const bpXp = Math.round((30 + level * 7) * phase);
    // premium ~2.2× бесплатной линии
    const premAc = Math.round(ac * 2.2);
    const premBpXp = Math.round(bpXp * 2.2);
    // каждые 6-й уровень — бандл из двух пакетов (×2 в UI)
    const bundle = level % 6 === 0;
    const free: BpReward[] = [];
    const premium: BpReward[] = [];
    if (ac > 0) free.push({ kind: "ac", amount: ac });
    if (bpXp > 0) free.push({ kind: "bpXp", amount: bpXp });
    if (bundle) {
      if (ac > 0) free.push({ kind: "bpXp", amount: Math.round(bpXp * 0.5) || 20 });
    }
    if (premAc > 0) premium.push({ kind: "ac", amount: premAc });
    if (premBpXp > 0) premium.push({ kind: "bpXp", amount: premBpXp });
    if (bundle) {
      premium.push({ kind: "ac", amount: Math.round(premAc * 0.6) || 40 });
    }
    defs.push({ level, free, premium });
  }
  return defs;
};

/** Все уровни с наградами: milestone + filler, отсортированы по номеру */
const LEVELS: BpLevelDef[] = [...MILESTONE_LEVELS, ...buildFillerLevels()].sort(
  (a, b) => a.level - b.level,
);

export const BATTLEPASS: BattlePassConfig = {
  seasonId: "season-1",
  name: "Сезон 1 · Путь теней",
  description:
    "Сто уровней, две дорожки наград и аникойны за активность: XP сайта идёт в пропуск один в один, а редкие предметы открываются только на определённых уровнях.",
  from: Date.parse("2026-09-28T00:00:00+03:00"),
  to: Date.parse("2026-12-06T21:00:00+03:00"),
  maxLevel: 100,
  cost: { base: 80, step: 9 },
  xpPerSiteXp: 1,
  levels: LEVELS,
};
