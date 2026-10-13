"use client";

import { createLocalStore, dayKey } from "./store";
import { dayIndex, weekIndexOf } from "./progression/time";
import {
  BUILDINGS,
  EMPTY_PURSE,
  QUEST_CAP,
  QUESTS,
  REGIONS,
  SEASON_DAYS,
  SEASON_NAME,
  SEASON_NUMBER,
  SPECIALIZATIONS,
  buildingCost,
  type ClanBuilding,
  type ExpeditionRoute,
  type ClanFaction,
  type ClanPurse,
  type ClanQuestInfo,
  type ClanRegion,
  type ClanResource,
  type ClanSpecialization,
} from "./clans.game";

/**
 * Игровой слой кланов: экономика, задания, сезон, база и территории.
 *
 * Отдельный стор от `clans.ts` не из эстеты, а по существу: у клана-«мира»
 * (топ, поиск, вклады) и у клана-«игры» (ресурсы, задания, сезон) разный
 * срок жизни. Старая запись переживает переработку механик без миграции —
 * при новой схеме клан просто получает пустой кошелёк.
 *
 * Второе отличие — источник прогресса. Промт прямо требует не плодить
 * второй счётчик действий, поэтому задания читают метрики прогрессии
 * сайта и список прочитанных глав, а не свой таймер.
 */

/** Ключ хранилища игрового слоя */
export const CLAN_GAME_KEY = "animehub:clans.game:v1";

/* ------------------------------------------------------------------ */
/* Дерево развития                                                      */
/* ------------------------------------------------------------------ */

export type ClanBranch = "knowledge" | "military" | "community" | "relics";

export interface ClanBranchInfo {
  id: ClanBranch;
  name: string;
  glyph: string;
  color: string;
  desc: string;
}

export const BRANCHES: ClanBranchInfo[] = [
  {
    id: "knowledge",
    name: "Знания",
    glyph: "📖",
    color: "#b06bff",
    desc: "Викторины, коллекционные задания, дополнительные архивы и лор",
  },
  {
    id: "military",
    name: "Военное дело",
    glyph: "⚔️",
    color: "#ff4d6d",
    desc: "Сценарии войн, новые форматы испытаний, эффекты побед",
  },
  {
    id: "community",
    name: "Сообщество",
    glyph: "🤝",
    color: "#00c2a8",
    desc: "Слоты участников, расширенный набор, роли, оформление страницы",
  },
  {
    id: "relics",
    name: "Реликвии",
    glyph: "🏺",
    color: "#ffb020",
    desc: "Трофеи, баннеры, уникальные эмблемы и эффекты появления",
  },
];

const ALL_BRANCHES: ClanBranch[] = BRANCHES.map((b) => b.id);

/** Цена следующей ступени ветки */
export function branchCost(level: number): number {
  return 40 + level * 30;
}

/** Сколько ступеней в ветке */
export const BRANCH_MAX = 10;

/* ------------------------------------------------------------------ */
/* Состояние                                                            */
/* ------------------------------------------------------------------ */

/** Запись журнала действий руководства */
export interface ClanLogEntry {
  at: number;
  text: string;
  /** Кто сделал */
  who: string;
}

export interface ClanQuestLog {
  /** Ключ периода: `2026-10-10` для дневных, `w2026-10-06` для недельных */
  day: string;
  week: string;
  /** Накопленный прогресс по id задания */
  progress: Record<string, number>;
  /** Забрано: `<questId>@<period>` — награда выдаётся один раз */
  claimed: string[];
}

/* ------------------------------------------------------------------ */
/* События сезона                                                       */
/* ------------------------------------------------------------------ */

/** Задача матча: общий набор для обеих сторон */
export interface WarTask {
  id: string;
  name: string;
  /** Сколько нужно накопить: глав, серий или заданий */
  goal: number;
  /** Накоплено за счёт активности на сайте */
  progress: number;
  unit: string;
  /** Сколько очков матча даёт единица прогресса */
  rate: number;
}

/** Война двух кланов на 48 часов */
export interface ClanWarState {
  /** id соперника из RIVALS */
  opponentId: string;
  /**
   * Кто выбрал соперника: `Ты` — из поиска по кланам, `Система` — автоподбор.
   * Поле необязательное: у матчей, начатых до его появления, его нет.
   */
  pickedBy?: string;
  startedAt: number;
  endsAt: number;
  /** Рубеж: кто первым его взял, тот и выиграл */
  target: number;
  /** Очки нашего клана */
  mine: number;
  /** Очки соперника — растут по времени, без бросков кубика */
  theirs: number;
  tasks: WarTask[];
  /** Итог после расчёта */
  winner?: "mine" | "theirs" | "draw";
  /** Сколько раз за сезон клану можно было начать войну */
  index: number;
}

/** Недельный рейд на общего босса */
export interface ClanRaidState {
  /** Ключ недели: у новой — новый босс */
  week: string;
  /** Общий урон клана */
  damage: number;
  /** Урон, нанесённый лично игроком */
  mine: number;
  /** Фазы, за которые уже забрали награду */
  claimed: number[];
  /**
   * Значения активности на момент последнего начисления.
   *
   * Урон начисляется разницей, а не прибавлением текущего счётчика:
   * счётчик за день накопительный, и прибавление на каждом открытии
   * страницы начисляло бы боссу урон за одну и ту же активность снова.
   */
  base: { episodesDay: number; distinctToday: number };
}

/** Событие на этапе экспедиции */
export type ExpeditionEventKind = "treasure" | "trap" | "miniboss" | "fork";

export interface ExpeditionEvent {
  kind: ExpeditionEventKind;
  title: string;
  text: string;
  glyph: string;
  /** Сколько активности нужно, чтобы закрыть событие */
  goal: number;
  /** Сколько единиц активности уже вложено */
  progress: number;
  unit: string;
  /** Награда за закрытие */
  reward: Partial<ClanPurse>;
  /** Цена провала: столько прогресса отнимается */
  penalty: number;
}

/** Поход клана: карта, маршрут и добыча */
export interface ClanExpeditionState {
  route: ExpeditionRoute;
  startedAt: number;
  /** Сколько этапов пройдено (0..длины маршрута) */
  progress: number;
  /** Добыча, собранная по дороге и уже не отнимаемая */
  loot: ClanPurse;
  /** Событие текущего этапа */
  event: ExpeditionEvent | null;
  /** Количество активности, вложенное в событие */
  eventProgress: number;
  /** Событие текущего этапа закрыто */
  eventDone: boolean;
  /** Активность, потраченная сегодня (дневной лимит) */
  today: number;
  /** Значения активности на момент последнего начисления */
  base: { episodesDay: number; distinctToday: number; mangaToday: number };
  /** Ключ дня последнего начисления */
  day: string;
  finished: boolean;
  outcome?: "success" | "failed";
  /** Награды, выданные за этапы — не отнимаются при смене маршрута */
  secured: ClanPurse;
}

/* ------------------------------------------------------------------ */
/* Социальный слой                                                      */
/* ------------------------------------------------------------------ */

/** Заявка на вступление от кандидата */
export interface ClanApplication {
  id: string;
  name: string;
  tier: string;
  /** Сопроводительное сообщение */
  message: string;
  /** Уровень будущего участника — от него зависит его вклад */
  level: number;
  at: number;
}

/** Отправленное приглашение и ответ на него */
export interface ClanInvite {
  id: string;
  name: string;
  tier: string;
  /** Кандидат согласился или отказался */
  answer: "pending" | "accepted" | "declined";
  at: number;
}

/** Реликвия в клановой коллекции */
export interface ClanRelic {
  id: string;
  name: string;
  glyph: string;
  /** Откуда получено */
  source: string;
  at: number;
}

/**
 * Номинации недели.
 *
 * Голосование тайное до последнего момента: результаты видны только когда
 * неделя закрыта. Иначе номинация превращается в опрос «за кого уже все»,
 * а промт отдельно просит не делать из этого травлю.
 */
export interface ClanNomination {
  week: string;
  /** Кто за кого голосовал: имя номинации → id участника */
  votes: Record<string, string>;
  /** Итоги уже опубликованы */
  revealed: boolean;
}

/* ------------------------------------------------------------------ */
/* Магазин, оформление и журнал операций                               */
/* ------------------------------------------------------------------ */

/** Купленный предмет клана. Покупка разовая и необратимая */
export type ClanUnlock = string;

/** Активное оформление клана: купленное можно менять бесплатно */
export interface ClanOutfit {
  /** id фона страницы гильдии, "" — стандартный */
  background: string;
  /** id эмблемы */
  emblem: string;
  /** id включённых декораций: рамки, эффекты, орнаменты */
  decorations: string[];
}

/**
 * Запись журнала ресурсных операций.
 *
 * Записи только добавляются: откат не делается, ошибка исправляется
 * компенсирующей операцией. Так журнал остаётся источником правды о том,
 * куда ушли общие ресурсы.
 */
export interface ClanLedgerEntry {
  id: string;
  at: number;
  /** Тип операции */
  kind: "shop" | "treasury" | "equip" | "refund";
  /** Кто действовал */
  actor: string;
  /** Предмет или сундук */
  subject: string;
  /** Списано */
  cost?: { resource: ClanResource; amount: number };
  /** Выдано: описание для журнала */
  reward?: string;
}

/** Сокровищница: открытые уровни и счётчик сундуков */
export interface ClanTreasuryState {
  /** Открытый уровень сокровищницы: 0..3 */
  tier: number;
  /** Ключ операции последнего открытия — защита от повторного клика */
  lastOpenKey: string;
  /** Сколько сундуков каждого уровня уже открыто */
  opened: Record<string, number>;
}

/** Запись зала славы */
export interface ClanTrophy {
  at: number;
  title: string;
  detail: string;
}

export interface ClanGameState {
  /** Фракция клана: постоянный бонус и тематика */
  faction: ClanFaction;
  /** Четыре несмешиваемых ресурса */
  purse: ClanPurse;
  /** Уровни зданий базы */
  buildings: Record<ClanBuilding, number>;
  /** Специализация участника: `<memberId>` → специализация */
  specs: Record<string, ClanSpecialization>;
  /** Дата последней смены специализации (лимит — раз в сутки) */
  specDay: string;
  /** Уникальные прочитанные главы: `<mangaId>:<chapter>` */
  chapters: string[];
  /** Сколько уникальных глав засчитано сегодня и на этой неделе */
  mangaDay: { key: string; today: number; weekKey: string; week: number };
  /** Сколько достижений было, когда начался текущий период */
  achBase: { week: string; value: number };
  /** Прогресс заданий */
  quests: ClanQuestLog;
  /** Вложенное в регионы влияние */
  regions: Record<ClanRegion, number>;
  /** Захваченные регионы */
  held: ClanRegion[];
  /** Ступени веток дерева развития */
  tree: Record<ClanBranch, number>;
  /** Журнал действий руководства */
  log: ClanLogEntry[];
  /** Текущая война с соперником */
  war: ClanWarState | null;
  /** Рейд на босса текущей недели */
  raid: ClanRaidState | null;
  /** Идущий поход */
  expedition: ClanExpeditionState | null;
  /** Трофеи и рекорды — переживают смену сезонов */
  trophies: ClanTrophy[];
  /** Заявки на вступление, ждущие ответа */
  applications: ClanApplication[];
  /** Отправленные приглашения и ответы на них */
  invites: ClanInvite[];
  /** Коллекция клана: реликвии и фрагменты эмблемы */
  collection: ClanRelic[];
  /** Номинации текущей недели */
  nomination: ClanNomination;
  /** Ключ недели последней ротации территорий */
  rotation: string;
  /** Коллекция клана: купленные один раз предметы */
  unlocks: ClanUnlock[];
  /** Активное оформление */
  outfit: ClanOutfit;
  /** Журнал операций с общими ресурсами */
  ledger: ClanLedgerEntry[];
  /** Сокровищница */
  treasury: ClanTreasuryState;
  /**
   * Активная транзакция.
   *
   * Пока ключ не пустой, любая операция с общими ресурсами отклоняется.
   * Это защита от двойного клика и от повторного запроса: интерфейс
   * не может запустить вторую операцию, пока первая не завершилась.
   */
  pending: string;
}

function emptyBuildings(): Record<ClanBuilding, number> {
  const out = {} as Record<ClanBuilding, number>;
  for (const b of BUILDINGS) out[b.id] = 0;
  return out;
}

function emptyTree(): Record<ClanBranch, number> {
  const out = {} as Record<ClanBranch, number>;
  for (const b of ALL_BRANCHES) out[b] = 0;
  return out;
}

function emptyRegions(): Record<ClanRegion, number> {
  const out = {} as Record<ClanRegion, number>;
  for (const r of REGIONS) out[r.id] = 0;
  return out;
}

const EMPTY_GAME: ClanGameState = {
  faction: "sword",
  purse: { ...EMPTY_PURSE },
  buildings: emptyBuildings(),
  specs: {},
  specDay: "",
  chapters: [],
  mangaDay: { key: "", today: 0, weekKey: "", week: 0 },
  achBase: { week: "", value: -1 },
  quests: { day: "", week: "", progress: {}, claimed: [] },
  regions: emptyRegions(),
  held: [],
  tree: emptyTree(),
  log: [],
  war: null,
  raid: null,
  expedition: null,
  trophies: [],
  applications: [],
  invites: [],
  collection: [],
  nomination: { week: "", votes: {}, revealed: false },
  rotation: "",
  unlocks: [],
  outfit: { background: "", emblem: "", decorations: [] },
  ledger: [],
  treasury: { tier: 0, lastOpenKey: "", opened: {} },
  pending: "",
};

/* ------------------------------------------------------------------ */
/* Периоды                                                              */
/* ------------------------------------------------------------------ */

/**
 * Ключ дня: смена в полночь по часовому поясу игрока.
 *
 * Раньше здесь была вторая реализация с дефолтом «UTC» — из-за неё кланы и
 * профиль считали сутки иначе, чем движок прогрессии, и в первые три часа
 * после полуночи по UTC+3 игрок получал «разные дни» в двух местах
 * интерфейса. Теперь это единственный `dayKey` из `./store`, пере-экспортированный
 * для внешних вызывающих (clans.events.ts), — чтобы правка в одном месте
 * меняла поведение везде.
 */
export { dayKey };

/**
 * Ключ недели.
 *
 * Неделя здесь ровно та же, что у прогрессии сайта (`weekIndexOf`): блок
 * из семи суток от эпохи в часовом поясе игрока. Если у кланов и у сайта
 * границы недели разойдутся, игрок увидит «задание обнулилось, а прогресс
 * нет» — поэтому берём одну и ту же функцию, а не свою календарную.
 */
export function weekKey(now = Date.now(), tz = "UTC"): string {
  return `w${weekIndexOf(dayIndex(now, tz))}`;
}

/** Ключ периода задания: дневные и недельные не должны путаться */
function periodKey(quest: ClanQuestInfo, now = Date.now()): string {
  return quest.period === "daily" ? `d${dayKey(now)}` : weekKey(now);
}

/* ------------------------------------------------------------------ */
/* Разбор и починка старых записей                                      */
/* ------------------------------------------------------------------ */

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Разбор событийных полей.
 *
 * Отдельными функциями не из-за красоты: у войны, рейда и похода разные
 * формы, а падение в одном из них не должно обнулять весь игровой слой
 * вместе с кошельком и базой.
 */
function parseWar(raw: unknown): ClanWarState | null {
  const war = raw as Partial<ClanWarState> | null;
  if (!war || typeof war.opponentId !== "string" || !Array.isArray(war.tasks)) return null;
  return {
    opponentId: war.opponentId,
    startedAt: num(war.startedAt),
    endsAt: num(war.endsAt),
    target: Math.max(1, num(war.target, 3000)),
    mine: Math.max(0, num(war.mine)),
    theirs: Math.max(0, num(war.theirs)),
    tasks: war.tasks
      .filter((t): t is WarTask => Boolean(t) && typeof t.id === "string")
      .map((t) => ({
        id: t.id,
        name: String(t.name ?? ""),
        goal: Math.max(1, num(t.goal, 1)),
        progress: Math.max(0, num(t.progress)),
        unit: String(t.unit ?? ""),
        rate: Math.max(0, num(t.rate)),
      })),
    winner: war.winner,
    index: num(war.index),
  };
}

function parseRaid(raw: unknown): ClanRaidState | null {
  const raid = raw as Partial<ClanRaidState> | null;
  if (!raid || typeof raid.week !== "string") return null;
  const base: Partial<ClanRaidState["base"]> = raid.base ?? {};
  return {
    week: raid.week,
    damage: Math.max(0, num(raid.damage)),
    mine: Math.max(0, num(raid.mine)),
    claimed: Array.isArray(raid.claimed) ? raid.claimed.filter((n) => Number.isFinite(n)) : [],
    base: {
      episodesDay: num(base.episodesDay),
      distinctToday: num(base.distinctToday),
    },
  };
}

function parseExpedition(raw: unknown): ClanExpeditionState | null {
  const exp = raw as Partial<ClanExpeditionState> | null;
  if (!exp || typeof exp.route !== "string") return null;
  return {
    route: exp.route,
    startedAt: num(exp.startedAt),
    progress: Math.max(0, num(exp.progress)),
    loot: { ...EMPTY_PURSE, ...(exp.loot as object) },
    event: (exp.event as ExpeditionEvent | null) ?? null,
    eventProgress: Math.max(0, num(exp.eventProgress)),
    eventDone: exp.eventDone === true,
    today: Math.max(0, num(exp.today)),
    base: {
      episodesDay: num(exp.base?.episodesDay),
      distinctToday: num(exp.base?.distinctToday),
      mangaToday: num(exp.base?.mangaToday),
    },
    day: String(exp.day ?? ""),
    finished: exp.finished === true,
    outcome: exp.outcome,
    secured: { ...EMPTY_PURSE, ...(exp.secured as object) },
  };
}

function parseGame(raw: string): ClanGameState | null {
  try {
    const parsed = JSON.parse(raw) as Partial<ClanGameState>;
    if (!parsed || typeof parsed !== "object") return null;

    const purse = { ...EMPTY_PURSE };
    for (const key of Object.keys(EMPTY_PURSE) as ClanResource[]) {
      purse[key] = Math.max(0, num((parsed.purse as ClanPurse | undefined)?.[key]));
    }

    const buildings = emptyBuildings();
    for (const info of BUILDINGS) {
      buildings[info.id] = Math.max(0, num(parsed.buildings?.[info.id]));
    }

    const tree = emptyTree();
    for (const id of ALL_BRANCHES) tree[id] = Math.max(0, num(parsed.tree?.[id]));

    const regions = emptyRegions();
    for (const info of REGIONS) regions[info.id] = Math.max(0, num(parsed.regions?.[info.id]));

    const specs: Record<string, ClanSpecialization> = {};
    for (const [id, spec] of Object.entries(parsed.specs ?? {})) {
      if (SPECIALIZATIONS.some((s) => s.id === spec)) specs[id] = spec;
    }

    return {
      faction: parsed.faction ?? EMPTY_GAME.faction,
      purse,
      buildings,
      specs,
      specDay: parsed.specDay ?? "",
      chapters: Array.isArray(parsed.chapters)
        ? parsed.chapters.filter((c): c is string => typeof c === "string")
        : [],
      mangaDay: {
        key: parsed.mangaDay?.key ?? "",
        today: num(parsed.mangaDay?.today),
        weekKey: parsed.mangaDay?.weekKey ?? "",
        week: num(parsed.mangaDay?.week),
      },
      achBase: {
        week: parsed.achBase?.week ?? "",
        value: num(parsed.achBase?.value, -1),
      },
      quests: {
        day: parsed.quests?.day ?? "",
        week: parsed.quests?.week ?? "",
        progress: (parsed.quests?.progress as Record<string, number>) ?? {},
        claimed: Array.isArray(parsed.quests?.claimed) ? parsed.quests.claimed : [],
      },
      regions,
      held: Array.isArray(parsed.held)
        ? parsed.held.filter((r): r is ClanRegion => REGIONS.some((x) => x.id === r))
        : [],
      tree,
      log: Array.isArray(parsed.log) ? parsed.log.slice(-40) : [],
      war: parseWar(parsed.war),
      raid: parseRaid(parsed.raid),
      expedition: parseExpedition(parsed.expedition),
      applications: Array.isArray(parsed.applications)
        ? parsed.applications.filter((a): a is ClanApplication => Boolean(a) && typeof a.id === "string")
        : [],
      invites: Array.isArray(parsed.invites)
        ? parsed.invites.filter((i): i is ClanInvite => Boolean(i) && typeof i.id === "string")
        : [],
      collection: Array.isArray(parsed.collection)
        ? parsed.collection.filter((r): r is ClanRelic => Boolean(r) && typeof r.id === "string")
        : [],
      nomination: {
        week: parsed.nomination?.week ?? "",
        votes: (parsed.nomination?.votes as Record<string, string>) ?? {},
        revealed: parsed.nomination?.revealed === true,
      },
      rotation: parsed.rotation ?? "",
      unlocks: Array.isArray(parsed.unlocks)
        ? parsed.unlocks.filter((u): u is ClanUnlock => typeof u === "string")
        : [],
      outfit: {
        background: parsed.outfit?.background ?? "",
        emblem: parsed.outfit?.emblem ?? "",
        decorations: Array.isArray(parsed.outfit?.decorations)
          ? parsed.outfit.decorations.filter((d): d is string => typeof d === "string")
          : [],
      },
      ledger: Array.isArray(parsed.ledger) ? parsed.ledger.slice(-80) : [],
      treasury: {
        tier: Math.max(0, Math.min(3, num(parsed.treasury?.tier))),
        lastOpenKey: parsed.treasury?.lastOpenKey ?? "",
        opened: (parsed.treasury?.opened as Record<string, number>) ?? {},
      },
      pending: "",
      trophies: Array.isArray(parsed.trophies)
        ? parsed.trophies.filter(
            (t): t is ClanTrophy =>
              Boolean(t) && typeof (t as ClanTrophy).title === "string" &&
              typeof (t as ClanTrophy).at === "number",
          )
        : [],
    };
  } catch {
    return null;
  }
}

const gameStore = createLocalStore<ClanGameState>(CLAN_GAME_KEY, EMPTY_GAME, parseGame);

/** Хук игрового слоя клана */
export const useClanGame = gameStore.useStore;

/** Текущее состояние вне React (для действий) */
export function clanGame(): ClanGameState {
  return gameStore.get();
}

function update(fn: (state: ClanGameState) => ClanGameState): void {
  gameStore.update(fn);
}

/**
 * Прямая запись в игровой слой.
 *
 * Отдаётся наружу только для `clans.events.ts` (войны, рейд, поход):
 * логика событий живёт там, а состояние — здесь, и круговая зависимость
 * двух модулей ломала бы сборку.
 */
export function patchClanGame(fn: (state: ClanGameState) => ClanGameState): void {
  update(fn);
}

/** Что вернёт транзакция */
export interface CommitResult {
  ok: boolean;
  reason?: string;
}

const OK_COMMIT: CommitResult = { ok: true };
const BUSY: CommitResult = { ok: false, reason: "Предыдущая операция ещё выполняется" };

/**
 * Атомарная операция над общими ресурсами клана.
 *
 * Собирает всё в одну функцию обновления стора: проверка баланса, списание,
 * выдача и запись в журнал происходят за один `store.set`. Промежуточного
 * состояния, в котором ресурсы списаны, а награда не начислена, не
 * существует — ровно тот случай, который требует промт.
 *
 * `guard` защищает от повторного запуска той же операции: если ключ уже
 * встречается в состоянии, повтор отклоняется без побочных эффектов.
 */
export function commitClanTransaction<T>(
  key: string,
  guard: (state: ClanGameState) => boolean,
  apply: (state: ClanGameState) => ClanGameState | null,
): CommitResult & { value?: T } {
  const state = gameStore.get();
  if (state.pending) return BUSY;
  if (key && guard(state)) return { ok: false, reason: "Операция уже выполнена" };

  let result: (ClanGameState | null) | undefined;
  update((current) => {
    // Повторная проверка внутри апдейта: между чтением и записью состояние
    // могли изменить другие вкладки (событие storage)
    if (current.pending) return current;
    const next = apply(current);
    if (!next) {
      result = null;
      return current;
    }
    result = { ...next, pending: key };
    return result;
  });

  if (result === null || result === undefined) {
    return { ok: false, reason: "Операция отклонена" };
  }

  // Снимаем блокировку следующим тиком: так повторный клик, пришедший
  // уже после применения, увидит guard и не пройдёт
  const settled: ClanGameState = result;
  update((current) => (current.pending === key ? { ...current, pending: "" } : current));

  return { ...OK_COMMIT, value: settled as unknown as T };
}

/** Запись в журнал операций */
export function appendLedger(
  state: ClanGameState,
  entry: Omit<ClanLedgerEntry, "id" | "at">,
): ClanGameState {
  const now = Date.now();
  return {
    ...state,
    ledger: [
      ...state.ledger,
      { ...entry, id: `led-${now}-${state.ledger.length}`, at: now },
    ].slice(-80),
  };
}

/** Запись в журнал руководства: храним последние 40 записей */
function note(state: ClanGameState, text: string, who = "Ты"): ClanGameState {
  return { ...state, log: [...state.log, { at: Date.now(), text, who }].slice(-40) };
}

/** Что вернёт действие: получилось или нет и почему */
export interface ActionResult {
  ok: boolean;
  reason?: string;
}

const OK: ActionResult = { ok: true };

/* ------------------------------------------------------------------ */
/* Фракция и специализации                                              */
/* ------------------------------------------------------------------ */

/** Сменить фракцию клана */
export function setFaction(faction: ClanFaction): ActionResult {
  const state = gameStore.get();
  if (state.faction === faction) return { ok: false, reason: "Фракция уже выбрана" };
  update((next) => note({ ...next, faction }, "Фракция клана изменена"));
  return OK;
}

/** Можно ли менять специализацию сегодня */
export function canSwitchSpec(state: ClanGameState): boolean {
  return state.specDay !== dayKey();
}

/**
 * Назначить специализацию. Ограничение — одна смена в сутки: иначе
 * состав можно было бы перебирать под каждое задание.
 */
export function setSpecialization(memberId: string, spec: ClanSpecialization): ActionResult {
  if (!SPECIALIZATIONS.some((s) => s.id === spec)) return { ok: false, reason: "Такой специализации нет" };
  const state = gameStore.get();
  if (!canSwitchSpec(state)) return { ok: false, reason: "Специализацию можно менять раз в сутки" };
  if (state.specs[memberId] === spec) return { ok: false, reason: "Специализация уже такая" };
  update((next) =>
    note(
      { ...next, specs: { ...next.specs, [memberId]: spec }, specDay: dayKey() },
      "Специализация участника изменена",
    ),
  );
  return OK;
}

/** Специализация участника или null, если не назначена */
export function specOfMember(state: ClanGameState, memberId: string): ClanSpecialization | null {
  return state.specs[memberId] ?? null;
}

/* ------------------------------------------------------------------ */
/* Активность: главы манги и метрики сайта                             */
/* ------------------------------------------------------------------ */

/** Насколько шкала задания может уйти за цель */
export function questCeiling(quest: ClanQuestInfo): number {
  return quest.goal * QUEST_CAP[quest.period];
}

/**
 * Начислить прогресс заданию с потолком.
 *
 * Потолок не даёт одной длинной сессии закрыть всё задания разом: шкала
 * упирается в `цель × QUEST_CAP`. Основная защита от накрутки — уникальность
 * источника и выдача награды один раз за период.
 */
function credit(state: ClanGameState, questId: string, amount: number): ClanGameState {
  const quest = QUESTS.find((q) => q.id === questId);
  if (!quest || amount <= 0) return state;

  const progress = { ...state.quests.progress };
  const next = Math.min(questCeiling(quest), (progress[questId] ?? 0) + amount);
  if (next === (progress[questId] ?? 0)) return state;
  progress[questId] = next;
  return { ...state, quests: { ...state.quests, progress } };
}

/**
 * Отметить прочитанную главу.
 *
 * Считается только уникальная глава: перечитывание не должно приносить
 * клану второй раз то же самое — это ровно тот случай накрутки, о котором
 * предупреждает промт.
 */
export function noteMangaChapter(mangaId: string, chapter: string): boolean {
  if (!mangaId || !chapter) return false;
  const key = `${mangaId}:${chapter}`;
  if (gameStore.get().chapters.includes(key)) return false;

  const day = dayKey();
  const week = weekKey();
  update((state) => {
    const sameDay = state.mangaDay.key === day;
    const sameWeek = state.mangaDay.weekKey === week;
    const next: ClanGameState = {
      ...state,
      chapters: [...state.chapters, key],
      mangaDay: {
        key: day,
        today: sameDay ? state.mangaDay.today + 1 : 1,
        weekKey: week,
        week: sameWeek ? state.mangaDay.week + 1 : 1,
      },
    };
    // Одна глава двигает и дневное, и недельное задание
    return credit(credit(next, "library-keeper", 1), "long-read", 1);
  });
  return true;
}

/** Сколько уникальных глав засчитано сегодня и на этой неделе */
export function mangaCounts(state: ClanGameState, now = Date.now()): { day: number; week: number } {
  const sameDay = state.mangaDay.key === dayKey(now);
  const sameWeek = state.mangaDay.weekKey === weekKey(now);
  return {
    day: sameDay ? state.mangaDay.today : 0,
    week: sameWeek ? state.mangaDay.week : 0,
  };
}

/* ------------------------------------------------------------------ */
/* Активность сайта                                                     */
/* ------------------------------------------------------------------ */

/**
 * Снимок активности сайта для клановых заданий.
 *
 * Берётся из уже существующего счётчика прогрессии, а не из нового: у
 * заданий нет собственного «счётчика манги» или «счётчика серий».
 */
/**
 * Последний снимок активности.
 *
 * Нужен механике, которая стартует уже после того, как игрок поработал:
 * войну можно объявить на вкладке «Война», когда серии за сегодня уже
 * посмотрены. Без кэша новый матч начинался бы с нулевых задач, хотя
 * активность есть, и игрок видел бы обнуление вместо своего результата.
 */
let lastActivity: ClanActivity | null = null;

/** Снимок активности, последний раз увиденный разделом */
export function clanActivitySnapshot(): ClanActivity | null {
  return lastActivity;
}

export interface ClanActivity {
  /** Серий засчитано сегодня */
  episodesDay: number;
  /** Серий засчитано на этой неделе */
  episodesWeek: number;
  /** Всего открытых достижений */
  achievements: number;
  /** Разные виды активности за сегодня: оценки, комментарии, списки, тайтлы */
  distinctToday: number;
}

/**
 * Синхронизация периода.
 *
 * Серии и главы приходят уже готовыми за период: движок сайта сам обнуляет
 * дневные счётчики в полночь, а главы считаются отдельным списком с ключом
 * дня. Вычитать «базу» из них не нужно — это отняло бы у игрока то, что он
 * уже сделал сегодня.
 *
 * База нужна ровно одному счётчику — общему числу достижений. Оно не
 * обнуляется никогда, поэтому недельная цель считается как разница.
 */
export function syncClanActivity(activity: ClanActivity, now = Date.now()): void {
  // Запоминаем снимок: механику можно начать уже после того, как игрок
  // набрал активность за день (война объявляется на вкладке «Война»),
  // и без кэша новый матч начинался бы с нуля, хотя серии уже посмотрены
  lastActivity = activity;
  const day = dayKey(now);
  const week = weekKey(now);
  const state = gameStore.get();

  const dayChanged = state.quests.day !== day;
  const weekChanged = state.quests.week !== week;
  // -1 значит «базы ещё не было»: первый запуск обязан поставить её сразу,
  // иначе задания выполнятся за счёт всего счётчика сайта
  const firstRun = state.achBase.value < 0;

  if (!dayChanged && !weekChanged && !firstRun) return;

  update((current) => {
    const keep = (quest: ClanQuestInfo) => {
      const dropped = (dayChanged && quest.period === "daily")
        || (weekChanged && quest.period === "weekly");
      return dropped ? 0 : (current.quests.progress[quest.id] ?? 0);
    };

    return {
      ...current,
      quests: {
        day,
        week,
        progress: Object.fromEntries(
          QUESTS.filter((q) => keep(q) > 0).map((q) => [q.id, keep(q)]),
        ),
        claimed: current.quests.claimed.filter((key) => {
          const period = key.slice(key.indexOf("@") + 1);
          return period.startsWith("d") ? !dayChanged : !weekChanged;
        }),
      },
      achBase: weekChanged || firstRun ? { week, value: activity.achievements } : current.achBase,
      mangaDay: weekChanged ? { ...current.mangaDay, weekKey: week, week: 0 } : current.mangaDay,
    };
  });
}

/**
 * Пересчитать задания из активности. Вызывается при открытии раздела и по
 * подписке на эффекты прогрессии — то есть после реального действия.
 */
export function recomputeQuests(activity: ClanActivity, now = Date.now()): void {
  syncClanActivity(activity, now);
  update((current) => {
    const manga = mangaCounts(current, now);
    const achievements = Math.max(0, activity.achievements - current.achBase.value);

    let next = current;
    for (const quest of QUESTS) {
      let value = 0;
      if (quest.kind === "manga") value = quest.period === "daily" ? manga.day : manga.week;
      else if (quest.kind === "anime") {
        value = quest.period === "daily" ? activity.episodesDay : activity.episodesWeek;
      } else if (quest.kind === "achievements") value = achievements;
      else if (quest.kind === "unique") value = activity.distinctToday;

      if (value > (next.quests.progress[quest.id] ?? 0)) {
        next = credit(next, quest.id, value - (next.quests.progress[quest.id] ?? 0));
      }
    }
    return next;
  });
}

/* ------------------------------------------------------------------ */
/* Задания: состояние и получение                                      */
/* ------------------------------------------------------------------ */

export interface QuestView {
  quest: ClanQuestInfo;
  /** Прогресс, обрезанный по цели (в большую сторону не показываем) */
  progress: number;
  /** Доля готовности 0..1 */
  pct: number;
  done: boolean;
  claimed: boolean;
  /** Насколько перевыполнено цель */
  overflow: number;
}

export function questViews(state: ClanGameState, now = Date.now()): QuestView[] {
  return QUESTS.map((quest) => {
    const value = state.quests.progress[quest.id] ?? 0;
    return {
      quest,
      progress: Math.min(value, quest.goal),
      pct: Math.min(1, value / quest.goal),
      done: value >= quest.goal,
      claimed: state.quests.claimed.includes(`${quest.id}@${periodKey(quest, now)}`),
      overflow: Math.max(0, value - quest.goal),
    };
  });
}

/** Готовые к получению задания */
export function readyQuests(state: ClanGameState, now = Date.now()): QuestView[] {
  return questViews(state, now).filter((q) => q.done && !q.claimed);
}

/**
 * Забрать награду. Ключ `<id>@<период>` делает выдачу одноразовой: повторный
 * клик ничего не даёт, даже если состояние ещё не перерисовалось.
 */
export function claimQuest(questId: string, now = Date.now()): ClanResource | null {
  const quest = QUESTS.find((q) => q.id === questId);
  if (!quest) return null;
  const state = gameStore.get();
  const key = `${questId}@${periodKey(quest, now)}`;
  const progress = state.quests.progress[questId] ?? 0;
  if (progress < quest.goal) return null;
  if (state.quests.claimed.includes(key)) return null;

  update((current) => ({
    ...current,
    purse: { ...current.purse, [quest.reward]: current.purse[quest.reward] + quest.amount },
    quests: { ...current.quests, claimed: [...current.quests.claimed, key] },
  }));
  return quest.reward;
}

/* ------------------------------------------------------------------ */
/* База: здания                                                         */
/* ------------------------------------------------------------------ */

/** Цена следующего уровня здания или null, если максимум */
export function nextBuildingCost(state: ClanGameState, id: ClanBuilding): number | null {
  const info = BUILDINGS.find((b) => b.id === id);
  if (!info) return null;
  const level = state.buildings[id] ?? 0;
  if (level >= info.max) return null;
  return buildingCost(info, level);
}

/** Улучшить здание: тратится только материалы */
export function upgradeBuilding(id: ClanBuilding): ActionResult {
  const state = gameStore.get();
  const cost = nextBuildingCost(state, id);
  if (cost === null) return { ok: false, reason: "Максимальный уровень" };
  if (state.purse.materials < cost) return { ok: false, reason: "Не хватает материалов" };
  const info = BUILDINGS.find((b) => b.id === id)!;

  update((current) => {
    const buildings = { ...current.buildings, [id]: (current.buildings[id] ?? 0) + 1 };
    return note(
      {
        ...current,
        buildings,
        purse: { ...current.purse, materials: current.purse.materials - cost },
      },
      `${info.name}: уровень ${buildings[id]}`,
    );
  });
  return OK;
}

/* ------------------------------------------------------------------ */
/* Территории                                                            */
/* ------------------------------------------------------------------ */

/** Сколько ещё влияния не хватает до захвата региона */
export function regionLeft(state: ClanGameState, id: ClanRegion): number {
  const info = REGIONS.find((r) => r.id === id);
  if (!info) return 0;
  return Math.max(0, info.required - (state.regions[id] ?? 0));
}

/**
 * Вложить влияние в регион.
 *
 * Влияние не конвертируется и не сгорает: вложенное остаётся в копилке
 * региона, поэтому частичные вклады видны как заполненная шкала, а не
 * исчезают после неудачи. Захват даёт престиж — прямое назначение этой
 * валюты в экономике.
 */
export function investInfluence(id: ClanRegion, amount: number): ActionResult {
  const info = REGIONS.find((r) => r.id === id);
  if (!info) return { ok: false, reason: "Регион не найден" };
  const state = gameStore.get();
  if (amount <= 0) return { ok: false, reason: "Нечего вкладывать" };
  if (state.purse.influence < amount) return { ok: false, reason: "Не хватает влияния" };

  const current = state.regions[id] ?? 0;
  const accepted = Math.min(amount, info.required - current);
  if (accepted <= 0) return { ok: false, reason: "Регион уже под контролем" };

  update((s) => {
    const regions = { ...s.regions, [id]: current + accepted };
    const captured = current + accepted >= info.required;
    const held = captured && !s.held.includes(id) ? [...s.held, id] : s.held;
    // Престиж за захват: чем крупнее регион, тем щедрее награда
    const bonus = captured ? Math.round(info.required / 20) : 0;
    return note(
      {
        ...s,
        regions,
        held,
        purse: {
          ...s.purse,
          influence: s.purse.influence - accepted,
          prestige: s.purse.prestige + bonus,
        },
      },
      captured ? `${info.name} под контролем клана` : `Влияние вложено: ${info.name}`,
    );
  });
  return OK;
}

/* ------------------------------------------------------------------ */
/* Дерево развития                                                      */
/* ------------------------------------------------------------------ */

/** Купить ступень ветки */
export function upgradeBranch(branch: ClanBranch): ActionResult {
  const info = BRANCHES.find((b) => b.id === branch);
  if (!info) return { ok: false, reason: "Ветка не найдена" };
  const state = gameStore.get();
  const level = state.tree[branch] ?? 0;
  if (level >= BRANCH_MAX) return { ok: false, reason: "Ветка прокачана полностью" };
  const cost = branchCost(level);
  if (state.purse.prestige < cost) return { ok: false, reason: "Не хватает престижа" };

  update((current) => {
    const tree = { ...current.tree, [branch]: level + 1 };
    return note(
      {
        ...current,
        tree,
        purse: { ...current.purse, prestige: current.purse.prestige - cost },
      },
      `${info.name}: ступень ${level + 1}`,
    );
  });
  return OK;
}

/* ------------------------------------------------------------------ */
/* Сезон                                                                */
/* ------------------------------------------------------------------ */

/** Сколько дней осталось до конца сезона */
export function seasonDaysLeft(now = Date.now()): number {
  const start = new Date(now);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + SEASON_DAYS);
  return Math.max(0, Math.ceil((end.getTime() - now) / 86_400_000));
}

export const SEASON = {
  number: SEASON_NUMBER,
  name: SEASON_NAME,
  days: SEASON_DAYS,
};
