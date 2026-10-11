"use client";

import {
  BOSS,
  FACTION_PERK,
  ROUTES,
  routeOf,
  SPECIALIZATIONS,
  type ClanPurse,
  type ExpeditionRoute,
} from "./clans.game";
import { RIVALS, clanTier, type Clan } from "./clans";
import { grantRelic } from "./clans.social";
import { isPremiumActive, readAccount } from "./auth";
import { PREMIUM_CLAN_MULT } from "./premium-perks";
import {
  clanActivitySnapshot,
  clanGame,
  dayKey,
  patchClanGame,
  questViews,
  weekKey,
  type ClanActivity,
  type ClanExpeditionState,
  type ClanGameState,
  type ClanWarState,
  type ExpeditionEvent,
  type WarTask,
} from "./clans.runtime";

/**
 * События сезона: войны между кланами, недельный рейд на босса и поход.
 *
 * Общее у всех трёх — источник очков. Ни одна из них не заводит своего
 * счётчика: урон, очки войны и продвижение похода считаются из той же
 * активности на сайте, что и клановые задания. Иначе игрок получил бы
 * три независимых способа накрутки вместо одного.
 *
 * Второе общее — соперник не бросает кубик. Очки клана-противника,
 * события похода и исход финального боя выведены из его id и номера этапа,
 * поэтому результат воспроизводим и не зависит от того, когда открыли
 * страницу.
 */

/* ------------------------------------------------------------------ */
/* Войны                                                                */
/* ------------------------------------------------------------------ */

/** Длительность матча — 48 часов, как в описании механик */
export const WAR_HOURS = 48;

/** Рубеж, при котором матч заканчивается победой стороны первой */
export const WAR_TARGET = 3_000;

/** Задачи матча: общий набор для обеих сторон */
const WAR_TASK_BASE: Omit<WarTask, "progress">[] = [
  { id: "war-manga", name: "Прочитать главы", goal: 60, unit: "глав", rate: 14 },
  { id: "war-episodes", name: "Посмотреть серии", goal: 30, unit: "серий", rate: 22 },
  { id: "war-quests", name: "Закрыть задания", goal: 8, unit: "заданий", rate: 60 },
];

/**
 * Задания войны с поправкой на подписку.
 *
 * Подписка поднимает ставку очков за задание — не количество единиц,
 * а цену единицы. По той же причине множитель не трогает рубеж матча:
 * иначе Premium был бы не оформлением подписки, а гарантированной
 * победой в войне, и сопернику оставалось бы только смотреть.
 */
export function warTasks(): Omit<WarTask, "progress">[] {
  const mult = isPremiumActive(readAccount()) ? PREMIUM_CLAN_MULT : 1;
  return WAR_TASK_BASE.map((task) => ({
    ...task,
    rate: Math.round(task.rate * mult),
  }));
}

/**
 * Подбор соперника.
 *
 * Промт требует подбирать примерно равного по силе и учитывать не только
 * размер клана. Берём соседей по очкам: падение разницы больше чем в
 * полтора раза в любую сторону означает, что соперник уже из другой весовой
 * категории.
 */
export function findOpponent(points: number, exclude: string[] = []): Clan | null {
  const pool = RIVALS.filter((clan) => !exclude.includes(clan.id));
  if (pool.length === 0) return null;

  const scored = pool
    .map((clan) => ({ clan, gap: Math.abs(clan.points - points) }))
    // Сортировка по разнице очков, при равенстве — по id: порядок стабилен
    // между открытиями страницы, иначе соперник «прыгал» бы при перерисовке
    .sort((a, b) => a.gap - b.gap || a.clan.id.localeCompare(b.clan.id));

  const best = scored[0];
  return best.gap <= Math.max(points, 1) * 1.5 ? best.clan : scored[0].clan;
}

/** Насколько соперник близок по силе: диапазон ±25% считается равным */
export type Matchup = "even" | "easier" | "harder";

export interface WarCandidate {
  clan: Clan;
  /** Отношение очков: соперник делён на наш */
  ratio: number;
  matchup: Matchup;
  /** Подпись разницы в процентах — «+12%», «ровня» */
  label: string;
  /** Что получится за победу над ним по очкам кассы */
  stakes: { influence: number; prestige: number };
}

/**
 * Кандидаты для поиска соперника.
 *
 * Автоподбор findOpponent берёт ближайшего по очкам и не даёт выбора:
 * игрок не мог ни посмотреть, кто вообще может стать соперником, ни выбрать
 * конкретного — например, принципиально слабого или, наоборот, равного по
 * очкам соседа из топа. Список отдаётся по убыванию «интересности»: сначала
 * равные, потом те, у кого разница меньше.
 */
export function warCandidates(clan: Clan, query = ""): WarCandidate[] {
  const q = query.trim().toLowerCase();
  const list = RIVALS.filter((item) => {
    if (item.id === clan.id) return false;
    if (!q) return true;
    return (
      item.name.toLowerCase().includes(q) ||
      item.tag.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q)
    );
  });

  const rank: Record<Matchup, number> = { even: 0, easier: 1, harder: 2 };

  return list
    .map((item) => {
      const ratio = clan.points > 0 ? item.points / clan.points : 1;
      const diff = Math.round(Math.abs(ratio - 1) * 100);
      const matchup: Matchup = diff <= 25 ? "even" : ratio < 1 ? "easier" : "harder";
      return {
        clan: item,
        ratio,
        matchup,
        label: diff === 0 ? "ровня" : (diff > 0 ? "+" : "−") + String(diff) + "%",
        // Столько кассы даёт победа: как в settleWar, по предварительному счёту
        stakes: {
          influence: ratio > 1.4 ? 1_500 : ratio > 1 ? 1_200 : 900,
          prestige: ratio > 1.4 ? 260 : ratio > 1 ? 220 : 180,
        },
      };
    })
    .sort(
      (a, b) =>
        rank[a.matchup] - rank[b.matchup] ||
        Math.abs(a.ratio - 1) - Math.abs(b.ratio - 1) ||
        a.clan.name.localeCompare(b.clan.name),
    );
}

/**
 * Начать войну.
 *
 * Ограничение — одна война в сутки. Без него можно было бы набивать себе
 * очки, объявляя сопернику матч за матчем и закрывая задачи в каждом.
 */
export function startWar(
  clan: Clan,
  now = Date.now(),
  opponentId?: string,
): { ok: boolean; reason?: string } {
  const game = clanGame();
  const current = game.war;

  if (current && !current.winner && now < current.endsAt) {
    return { ok: false, reason: "Война уже идёт" };
  }
  if (current && now - current.startedAt < 86_400_000) {
    return { ok: false, reason: "Новый матч можно начать не чаще раза в сутки" };
  }

  // Соперник либо выбран игроком в поиске, либо подбирается автоматически
  const picked = opponentId ? RIVALS.find((item) => item.id === opponentId) : undefined;
  if (opponentId && !picked) return { ok: false, reason: "Клан не найден" };
  if (picked && picked.id === clan.id) return { ok: false, reason: "Нельзя объявить войну самому себе" };

  const rival = picked ?? findOpponent(clan.points, current ? [current.opponentId] : []);
  if (!rival) return { ok: false, reason: "Нет доступного соперника" };

  const war: ClanWarState = {
    opponentId: rival.id,
    /** Кто выбрал соперника: "Ты" — поиском, "Система" — автоподбор */
    pickedBy: picked ? "Ты" : "Система",
    startedAt: now,
    endsAt: now + WAR_HOURS * 3_600_000,
    target: WAR_TARGET,
    mine: 0,
    // Разгон соперника: сильному клану достаётся более быстрый набор
    theirs: Math.round(clanTier(rival.points).at / 8),
    tasks: warTasks().map((task) => ({ ...task, progress: 0 })),
    index: (current?.index ?? 0) + 1,
  };

  patchClanGame((state) => ({
    ...state,
    war,
    log: [
      ...state.log,
      { at: now, text: `Объявлена война: ${rival.name}`, who: "Ты" },
    ].slice(-40),
  }));

  // Матч начинается на середине дня: задачи сразу показывают то, что уже
  // набрано. Иначе игрок объявляет войну и видит нули, хотя серии за
  // сегодня уже посмотрены, а до следующего обновления прогресса их
  // пришлось бы ставить вручную
  const snapshot = clanActivitySnapshot();
  if (snapshot) syncWar(snapshot, now);

  return { ok: true };
}

/**
 * Начисление очков войны из активности.
 *
 * Прогресс задачи и очки матча растут вместе, но у задачи есть потолок
 * `цель × 2`: иначе одна длинная сессия закрывала бы все три задачи и
 * матч за один присев.
 */
const WAR_TASK_CAP = 2;

export function syncWar(activity: ClanActivity, now = Date.now()): void {
  const game = clanGame();
  const war = game.war;
  if (!war) return;

  const manga = mangaUnits(game);
  // Считаем все закрытые задания, включая забранные: выполненная работа
  // не перестаёт быть выполненной после получения награды
  const quests = questViews(game, now).filter((v) => v.done).length;
  const values: Record<string, number> = {
    "war-manga": manga,
    "war-episodes": activity.episodesDay + activity.episodesWeek,
    "war-quests": quests,
  };

  let changed = false;
  patchClanGame((state) => {
    if (!state.war) return state;
    const tasks = state.war.tasks.map((task) => {
      const next = Math.min(task.goal * WAR_TASK_CAP, values[task.id] ?? task.progress);
      if (next === task.progress) return task;
      changed = true;
      return { ...task, progress: next };
    });
    const mine = tasks.reduce((sum, task) => sum + task.progress * task.rate, 0);
    return { ...state, war: { ...state.war, tasks, mine } };
  });

  if (changed) settleWar(now);
}

/** Сколько уникальных глав засчитано сегодня и на этой неделе */
function mangaUnits(game: ClanGameState): number {
  const day = game.mangaDay.key === dayKey() ? game.mangaDay.today : 0;
  const week = game.mangaDay.weekKey === weekKey() ? game.mangaDay.week : 0;
  return day + week;
}

/** Очки соперника: равномерно по часам, без случайности */
export function opponentScore(war: ClanWarState, now = Date.now()): number {
  const hours = Math.max(0, (now - war.startedAt) / 3_600_000);
  const rival = RIVALS.find((clan) => clan.id === war.opponentId);
  // Быстрый соперник — быстрый набор; медленный — медленный
  const perHour = rival ? 26 + Math.round(rival.points / 6_000) : 30;
  return war.theirs + Math.round(hours * perHour);
}

export interface WarView {
  war: ClanWarState;
  /** Повышенная ли ставка заданий из-за подписки */
  premiumBoost: boolean;
  rival: Clan | null;
  mine: number;
  theirs: number;
  /** Часы до конца матча */
  hoursLeft: number;
  /** Идёт ли матч прямо сейчас */
  live: boolean;
  /** Кто ведёт сейчас */
  lead: "mine" | "theirs" | "draw";
  /** Итог матча, если он уже рассчитан */
  winner?: "mine" | "theirs" | "draw";
  /** Кто выбрал соперника */
  pickedBy?: string;
  /** Доля пройденного времени матча, 0…1 */
  elapsed: number;
  /** Награда по итогу текущего счёта — показывается до расчёта */
  stakes: { influence: number; prestige: number };
  /** Лента событий матча */
  feed: { at: number; text: string; who: string }[];
}

/**
 * Срез войны для интерфейса.
 *
 * `ownPoints` — очки своего клана: без них нельзя понять, тяжелее ли
 * соперник, а от этого зависит и ставка. Интерфейс всегда их передаёт,
 * параметр опционален ради вызовов из логики, где своего клана под рукой нет.
 */
export function warView(now = Date.now(), ownPoints?: number): WarView | null {
  const game = clanGame();
  const war = game.war;
  if (!war) return null;
  const rival = RIVALS.find((clan) => clan.id === war.opponentId) ?? null;
  const theirs = opponentScore(war, now);
  const mine = war.mine;
  const total = Math.max(1, war.endsAt - war.startedAt);
  const ratio = rival && ownPoints ? rival.points / ownPoints : 1;
  const feed = game.log.filter((entry) => entry.at >= war.startedAt).slice(-8);

  return {
    war,
    rival,
    premiumBoost: isPremiumActive(readAccount()),
    mine,
    theirs,
    hoursLeft: Math.max(0, Math.ceil((war.endsAt - now) / 3_600_000)),
    live: !war.winner && now < war.endsAt,
    lead: mine === theirs ? "draw" : mine > theirs ? "mine" : "theirs",
    winner: war.winner,
    pickedBy: war.pickedBy,
    elapsed: Math.min(1, Math.max(0, (now - war.startedAt) / total)),
    stakes: {
      influence: ratio > 1.4 ? 1_500 : ratio > 1 ? 1_200 : 900,
      prestige: ratio > 1.4 ? 260 : ratio > 1 ? 220 : 180,
    },
    feed,
  };
}

/**
 * Подсчёт итога.
 *
 * Матч заканчивается тремя способами: кто-то взял рубеж, подошло 48 часов,
 * либо игрок подтвердил досрочный расчёт. Победа засчитывается сразу и
 * награды начисляются ровно один раз — повторный вызов ничего не даёт.
 */
export function settleWar(now = Date.now()): { ok: boolean; winner?: string } {
  const view = warView(now);
  if (!view || !view.live) return { ok: false };

  const byTarget = view.mine >= view.war.target || view.theirs >= view.war.target;
  if (!byTarget && now < view.war.endsAt) return { ok: false };

  const winner: "mine" | "theirs" | "draw" =
    view.mine === view.theirs ? "draw" : view.mine > view.theirs ? "mine" : "theirs";

  patchClanGame((state) => {
    if (!state.war || state.war.winner) return state;

    // Победа: влияние и престиж. Поражение: только престиж за участие —
    // иначе проигрыш хуже, чем отсутствие войны вовсе
    const influence = winner === "mine" ? 1_200 : winner === "draw" ? 400 : 150;
    const prestige = winner === "mine" ? 220 : winner === "draw" ? 90 : 40;

    return {
      ...state,
      war: { ...state.war, mine: view.mine, theirs: view.theirs, winner },
      purse: {
        ...state.purse,
        influence: state.purse.influence + influence,
        prestige: state.purse.prestige + prestige,
      },
      trophies: [
        ...state.trophies,
        {
          at: now,
          title: winner === "mine" ? "Победа в войне кланов" : winner === "draw" ? "Ничья в войне" : "Поражение в войне",
          detail: `${view.mine} : ${view.theirs} против ${view.rival?.name ?? "соперника"}`,
        },
      ].slice(-30),
      log: [
        ...state.log,
        { at: now, text: `Война завершена: ${winner === "mine" ? "победа" : winner === "draw" ? "ничья" : "поражение"}`, who: "Система" },
      ].slice(-40),
    };
  });

  // Знамя войны — единоразовая награда за победу: у клана будет ровно
  // одно, поэтому ценность не размывается повторами
  if (winner === "mine") grantRelic("war-banner");

  return { ok: true, winner };
}

/* ------------------------------------------------------------------ */
/* Рейд на босса                                                        */
/* ------------------------------------------------------------------ */

/** Сколько урона получает неделя-рекорд босса */
export const RAID_PHASE = BOSS.phase;

/**
 * Урон рейда.
 *
 * Считается из дневной активности и достижений, умножается на бонус
 * фракции (демоны бьют сильнее) и делится пропорционально личному вкладу:
 * коллективная шкала общая, но видно, кто именно её двигает.
 */
export function raidDamage(activity: ClanActivity): number {
  const base = activity.episodesDay * 900 + activity.distinctToday * 450;
  return Math.round(base * factionDamageBonus(clanGame().faction));
}

/** Бонус фракции к урону */
function factionDamageBonus(faction: string): number {
  const perk = FACTION_PERK[faction as keyof typeof FACTION_PERK];
  return perk?.damage ?? 1;
}

export interface RaidView {
  damage: number;
  mine: number;
  /** Сколько фаз пробито */
  phases: number;
  /** Номер текущей фазы (1..3) */
  current: number;
  /** До конца фазы */
  toPhase: number;
  /** Забраны ли награды за пробитые фазы */
  claimed: number[];
  /** Открыт ли рейд сегодня (воскресенье) */
  open: boolean;
}

/** Срез рейда */
export function raidView(now = Date.now()): RaidView {
  const game = clanGame();
  const raid = ensureRaid(game, now);
  const phases = Math.min(BOSS.phases, Math.floor(raid.damage / RAID_PHASE));
  const into = raid.damage % RAID_PHASE;
  return {
    damage: raid.damage,
    mine: raid.mine,
    phases,
    current: Math.min(BOSS.phases, phases + 1),
    toPhase: Math.max(0, RAID_PHASE - into),
    claimed: raid.claimed,
    // Воскресенье — день рейда. В остальные дни босс живёт, но новый
    // урон всё равно капает: иначе шесть дней недели экран был бы пустым
    open: new Date(now).getDay() === 0,
  };
}

/** Заводит или обнуляет рейд при смене недели */
function ensureRaid(game: ClanGameState, now: number) {
  const week = weekKey(now);
  if (game.raid && game.raid.week === week) return game.raid;
  return { week, damage: 0, mine: 0, claimed: [], base: { episodesDay: 0, distinctToday: 0 } };
}

/** Начислить урон за текущую активность */
/**
 * Начислить урон за новую активность.
 *
 * Урон — разница между текущим счётчиком и тем, что видел прошлый заход.
 * Счётчик за день накопительный: если просто прибавлять его целиком,
 * каждое обновление страницы наносило бы боссу урон заново за ту же
 * активность, и неделя заканчивалась бы за один переход по разделам.
 */
export function syncRaid(activity: ClanActivity, now = Date.now()): void {
  patchClanGame((state) => {
    const current = ensureRaid(state, now);
    const deltaEpisodes = Math.max(0, activity.episodesDay - current.base.episodesDay);
    const deltaDistinct = Math.max(0, activity.distinctToday - current.base.distinctToday);
    const added = Math.round((deltaEpisodes * 900 + deltaDistinct * 450) * factionDamageBonus(state.faction));

    // Недельный потолок: босс не должен умирать от одной марафонской сессии
    const cap = RAID_PHASE * BOSS.phases;
    const room = Math.max(0, cap - current.damage);
    const gained = Math.min(added, room);

    return {
      ...state,
      raid: {
        ...current,
        damage: current.damage + gained,
        mine: current.mine + gained,
        base: {
          episodesDay: activity.episodesDay,
          distinctToday: activity.distinctToday,
        },
      },
    };
  });
}

export interface PhaseReward {
  prestige: number;
  influence: number;
  materials: number;
}

/** Награда за пробитую фазу */
export function phaseReward(phase: number): PhaseReward {
  return {
    prestige: 120 + phase * 60,
    influence: 300 + phase * 200,
    materials: 150 + phase * 120,
  };
}

/** Забрать награду за пробитую фазу — один раз за неделю */
export function claimPhase(phase: number): PhaseReward | null {
  const view = raidView();
  if (phase > view.phases) return null;

  patchClanGame((state) => {
    const current = ensureRaid(state, Date.now());
    if (current.claimed.includes(phase)) return state;
    const reward = phaseReward(phase);
    return {
      ...state,
      raid: { ...current, claimed: [...current.claimed, phase] },
      purse: {
        ...state.purse,
        prestige: state.purse.prestige + reward.prestige,
        influence: state.purse.influence + reward.influence,
        materials: state.purse.materials + reward.materials,
      },
    };
  });
  // Фрагмент эмблемы достаётся на первую пробитую фазу и больше не
  // дублируется: grantRelic идемпотентен
  grantRelic("boss-fragment");
  return phaseReward(phase);
}

/* ------------------------------------------------------------------ */
/* Поход                                                               */
/* ------------------------------------------------------------------ */

/**
 * Дневная норма активности на этапе.
 *
 * Растёт и с глубиной маршрута, и с риском выбранного пути: путь бездны
 * должен ощущаться тяжелее безопасного, иначе «сложность» существует
 * только в тексте описания маршрута.
 */
export function expeditionStepGoal(route: ExpeditionRoute, stage: number): number {
  const info = routeOf(route);
  return Math.round((6 + stage * 3) * info.rewardMul);
}

/**
 * Событие этапа.
 *
 * Выбирается детерминированно: индекс события — от номера этапа и маршрута,
 * а сам вид — из таблицы. Случайности нет намеренно: игрок не должен
 * проигрывать этап из-за того, что обновил страницу в неудачный момент.
 */
export function stageEvent(route: ExpeditionRoute, stage: number): ExpeditionEvent {
  const info = routeOf(route);
  // Чем рискованнее маршрут, тем больше ловушек и боссов
  const table: ExpeditionEvent["kind"][] =
    info.id === "abyss"
      ? ["trap", "miniboss", "treasure", "miniboss", "trap", "fork"]
      : info.id === "hunter"
        ? ["miniboss", "treasure", "trap", "fork", "miniboss"]
        : ["treasure", "fork", "trap", "treasure"];

  const kind = table[(stage - 1 + route.length) % table.length];
  const mul = info.rewardMul;
  const goal = Math.round(6 + stage * 2);

  switch (kind) {
    case "treasure":
      return {
        kind,
        title: "Сокровищница",
        text: "Основание зала разрушено, но добыча ещё здесь.",
        glyph: "💰",
        goal,
        progress: 0,
        unit: "единиц активности",
        reward: { materials: Math.round(120 * mul), prestige: Math.round(40 * mul) },
        penalty: 0,
      };
    case "trap":
      return {
        kind,
        title: "Ловушка",
        text: "Коллектив теряет часть добычи, если не успеет обезвредить её.",
        glyph: "🪤",
        goal,
        progress: 0,
        unit: "единиц активности",
        reward: { influence: Math.round(150 * mul) },
        penalty: Math.round(60 * mul),
      };
    case "miniboss":
      return {
        kind,
        title: "Мини-босс",
        text: "Хранитель участка держит проход. Нужен общий урон.",
        glyph: "🗡️",
        goal: goal + 4,
        progress: 0,
        unit: "единиц активности",
        reward: { materials: Math.round(180 * mul), xp: Math.round(150 * mul) },
        penalty: Math.round(40 * mul),
      };
    default:
      return {
        kind: "fork",
        title: "Развилка",
        text: "Два хода. Любой открывает свой участок карты.",
        glyph: "🧭",
        goal: Math.max(2, goal - 2),
        progress: 0,
        unit: "единиц активности",
        reward: { influence: Math.round(120 * mul) },
        penalty: 0,
      };
  }
}

/** Начать поход */
export function startExpedition(
  route: ExpeditionRoute,
  now = Date.now(),
): { ok: boolean; reason?: string } {
  if (!ROUTES.some((item) => item.id === route)) return { ok: false, reason: "Такого маршрута нет" };
  const game = clanGame();
  if (game.expedition && !game.expedition.finished) {
    return { ok: false, reason: "Поход уже идёт" };
  }

  patchClanGame((state) => ({
    ...state,
    expedition: {
      route,
      startedAt: now,
      progress: 0,
      loot: { xp: 0, influence: 0, materials: 0, prestige: 0 },
      event: stageEvent(route, 1),
      eventProgress: 0,
      eventDone: false,
      today: 0,
      base: { episodesDay: 0, distinctToday: 0, mangaToday: 0 },
      day: dayKey(now),
      finished: false,
      secured: { xp: 0, influence: 0, materials: 0, prestige: 0 },
    },
    log: [...state.log, { at: now, text: `Поход по маршруту «${routeOf(route).name}»`, who: "Ты" }].slice(-40),
  }));

  // Поход может начаться вечером, когда часть дневной активности уже
  // сделана. База обнулилась, и без подтягивания снимка она пропала бы
  // до следующего реального действия на сайте
  const snapshot = clanActivitySnapshot();
  if (snapshot) syncExpedition(snapshot, now);

  return { ok: true };
}

/**
 * Смена маршрута на ходу.
 *
 * Промт прямо требует: выбор пути влияет на доступные события, но не должен
 * отнимать уже заработанное. Поэтому накопленная добыча и пройденные этапы
 * остаются, меняются только следующие события и множитель добычи.
 */
export function switchRoute(route: ExpeditionRoute): { ok: boolean; reason?: string } {
  const game = clanGame();
  const exp = game.expedition;
  if (!exp || exp.finished) return { ok: false, reason: "Поход не идёт" };
  if (exp.route === route) return { ok: false, reason: "Ты уже на этом маршруте" };

  patchClanGame((state) => {
    if (!state.expedition) return state;
    const current = state.expedition;
    return {
      ...state,
      expedition: {
        ...current,
        route,
        // Событие пересобирается под новый маршрут, вложенное переносится
        event: stageEvent(route, current.progress + 1),
        eventProgress: 0,
        eventDone: false,
      },
      log: [...state.log, { at: Date.now(), text: `Маршрут изменён: ${routeOf(route).name}`, who: "Ты" }].slice(-40),
    };
  });
  return { ok: true };
}

/** Сколько активности нужно на текущий этап */
export function expeditionGoal(exp: ClanExpeditionState): number {
  return expeditionStepGoal(exp.route, exp.progress + 1);
}

/** Защитник в составе снимает половину потери на неудачном событии */
function guardSoftens(specs: Record<string, string>, penalty: number): number {
  const hasGuard = Object.values(specs).includes("guard");
  return hasGuard ? Math.round(penalty / 2) : penalty;
}

/**
 * Начисление активности в поход.
 *
 * Единица активности — то, что игрок уже делает на сайте: глава, серия,
 * оценка или комментарий. Счётчик сбрасывается каждый день, поэтому поход
 * действительно растягивается на дни, а не выдаётся за один присев.
 */
export function syncExpedition(activity: ClanActivity, now = Date.now()): void {
  patchClanGame((state) => {
    const exp = state.expedition;
    if (!exp || exp.finished) return state;

    // Накопительные счётчики дают прирост, а не абсолютное значение:
    // иначе каждое обновление страницы засчитывало бы одну и ту же
    // активность заново и поход закрывался бы за один присев
    const mangaToday = state.mangaDay.key === dayKey(now) ? state.mangaDay.today : 0;
    const gain =
      Math.max(0, activity.episodesDay - exp.base.episodesDay) +
      Math.max(0, activity.distinctToday - exp.base.distinctToday) +
      Math.max(0, mangaToday - exp.base.mangaToday);
    if (gain <= 0) return state;

    const info = routeOf(exp.route);
    const sameDay = exp.day === dayKey(now);
    const today = (sameDay ? exp.today : 0) + gain;
    const base = {
      episodesDay: activity.episodesDay,
      distinctToday: activity.distinctToday,
      mangaToday,
    };
    const log = [...state.log];

    let event = exp.event;
    let eventProgress = sameDay ? exp.eventProgress : 0;
    let eventDone = sameDay ? exp.eventDone : false;
    let progress = exp.progress;
    let loot = exp.loot;
    let secured = exp.secured;

    // День сменился, а событие не закрыто — ловушка срабатывает.
    // Отнимается пройденный участок, а не добыча: снимать уже выданное
    // запрещено, и игрок должен понимать это из интерфейса.
    if (!sameDay && !eventDone && event?.kind === "trap") {
      const penalty = guardSoftens(state.specs, event.penalty);
      progress = Math.max(0, progress - (penalty > 0 ? 1 : 0));
      loot = scaleLoot(loot, penalty > 0 ? 0.85 : 1);
      eventProgress = 0;
      event = stageEvent(exp.route, progress + 1);
      log.push({
        at: now,
        text: penalty > 0 ? "Ловушка: потерян участок, защитники смягчили потерю" : "Ловушка: потерян участок",
        who: "Отряд",
      });
    }

    // Активность идёт в текущее событие, пока оно не закрыто
    if (!eventDone && event) {
      const put = Math.min(Math.max(0, event.goal - eventProgress), today);
      eventProgress += put;
      if (eventProgress >= event.goal) {
        eventDone = true;
        // reward — частичный кошелёк: у события нет всех четырёх валют
        const gain: ClanPurse = { xp: 0, influence: 0, materials: 0, prestige: 0, ...event.reward };
        loot = addPurse(loot, gain);
        secured = addPurse(secured, gain);
        log.push({ at: now, text: `${event.title}: этап взят`, who: "Отряд" });
      }
    }

    // Пока дневная норма не выбрана, участок не открывается
    const goal = expeditionStepGoal(exp.route, progress + 1);
    if (!eventDone || today < goal) {
      return {
        ...state,
        expedition: {
          ...exp,
          progress,
          loot,
          secured,
          today,
          base,
          day: dayKey(now),
          event,
          eventProgress,
          eventDone,
        },
        log: log.slice(-40),
      };
    }

    progress += 1;
    log.push({ at: now, text: `Открыт участок ${progress}`, who: "Отряд" });

    // Финал маршрута: исход выведен из маршрута и номера этапа, а не брошен
    // кубик. Добыча, собранная раньше, достаётся в любом случае — потерять
    // можно только то, что ещё не забрано.
    if (progress >= info.days) {
      const lucky = (progress + info.days + exp.route.length) % 10 < info.success;
      return {
        ...state,
        expedition: {
          ...exp,
          progress,
          loot,
          secured,
          today,
          base,
          day: dayKey(now),
          event,
          eventProgress,
          eventDone,
          finished: true,
          outcome: lucky ? "success" : "failed",
        },
        purse: lucky ? addPurse(state.purse, loot) : state.purse,
        trophies: [
          ...state.trophies,
          {
            at: now,
            title: lucky ? `Поход «${info.name}» пройден` : `Поход «${info.name}» сорвался`,
            detail: `${progress} участков из ${info.days} · маршрут «${info.name}»`,
          },
        ].slice(-30),
        log: [
          ...log,
          { at: now, text: lucky ? "Поход завершён успехом" : "Поход сорвался на финальном боссе", who: "Система" },
        ].slice(-40),
      };
    }

    return {
      ...state,
      expedition: {
        ...exp,
        progress,
        loot,
        secured,
        today,
        base,
        day: dayKey(now),
        event: stageEvent(exp.route, progress + 1),
        eventProgress: 0,
        eventDone: false,
      },
      log: log.slice(-40),
    };
  });
}

/** Уменьшает добычу на долю — для штрафа ловушки */
function scaleLoot(loot: ClanPurse, factor: number): ClanPurse {
  return {
    xp: Math.round(loot.xp * factor),
    influence: Math.round(loot.influence * factor),
    materials: Math.round(loot.materials * factor),
    prestige: Math.round(loot.prestige * factor),
  };
}

function addPurse(base: ClanPurse, add: ClanPurse): ClanPurse {
  return {
    xp: (base.xp ?? 0) + (add.xp ?? 0),
    influence: (base.influence ?? 0) + (add.influence ?? 0),
    materials: (base.materials ?? 0) + (add.materials ?? 0),
    prestige: (base.prestige ?? 0) + (add.prestige ?? 0),
  };
}

/** Подсказка по маршруту: чем рискованнее путь, тем заметнее её последствия */
export function expeditionHint(route: ExpeditionRoute): string {
  if (route === "abyss") return "На пути бездны больше всего ловушек — держи защитника в составе.";
  if (route === "hunter") return "На пути охотника часто встречаются мини-боссы.";
  return "Безопасный путь проходится ровнее: события предсказуемы, добыча меньше.";
}

/** Специализация, которая помогает на выбранном маршруте */
export function routeSpecialization(route: ExpeditionRoute): string {
  const map: Record<ExpeditionRoute, string> = { safe: "guard", hunter: "hunter", abyss: "guard" };
  return SPECIALIZATIONS.find((s) => s.id === map[route])?.name ?? "";
}
