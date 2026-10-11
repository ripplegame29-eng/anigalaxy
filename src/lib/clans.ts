"use client";

import { createLocalStore, localId } from "./store";

/**
 * Кланы: игроки объединяются, копят очки и поднимаются в общем топе.
 *
 * Механика вклада взята из Clash of Clans: у клана есть уровень, от него
 * зависит сетка клеток для вкладов, за каждый новый уровень даётся награда.
 * Так вклад перестаёт быть «кнопкой +N очков»: он разложен по клеткам,
 * и игрок видит, до чего конкретно его клан дотянет.
 *
 * Хранение локальное, как у подборок и косметики: сервера в проекте нет,
 * поэтому «мир» собирается из системных кланов (RIVALS) и клана игрока.
 * Вклад капает из валюты прогрессии — так кланы связаны с боевым пропуском
 * и квестами, а не висят отдельной декорацией.
 */

/** Ключ хранилища */
export const CLANS_KEY = "animehub:clans:v1";

export interface ClanTier {
  at: number;
  name: string;
  color: string;
}

/** Ранг по сумме очков: чем выше сумма, тем «толще» знак */
export const CLAN_TIERS: ClanTier[] = [
  { at: 0, name: "Новичок", color: "#8b93a7" },
  { at: 2_000, name: "Отряд", color: "#3d7dff" },
  { at: 8_000, name: "Батальон", color: "#00c2a8" },
  { at: 20_000, name: "Орден", color: "#b06bff" },
  { at: 45_000, name: "Легион", color: "#ffb020" },
  { at: 90_000, name: "Империя", color: "#ff4d6d" },
];

/* ------------------------------------------------------------------ */
/* Участники и права                                                   */
/* ------------------------------------------------------------------ */

/** Роль в клане. Порядок значим: выше роль — больше прав */
export type ClanRole = "member" | "moderator" | "admin" | "owner";

export const ROLE_LABEL: Record<ClanRole, string> = {
  owner: "Владелец",
  admin: "Администратор",
  moderator: "Модератор",
  member: "Участник",
};

/** Права роли — единый источник правды для интерфейса и проверок */
export const ROLE_RIGHTS: Record<ClanRole, ClanRight[]> = {
  member: ["donate", "viewMembers"],
  moderator: ["donate", "viewMembers", "kickMember", "renameMember"],
  admin: [
    "donate",
    "viewMembers",
    "kickMember",
    "renameMember",
    "setRole",
    "editClan",
    "startWar",
  ],
  owner: [
    "donate",
    "viewMembers",
    "kickMember",
    "renameMember",
    "setRole",
    "editClan",
    "startWar",
    "disbandClan",
    "transferOwnership",
  ],
};

export type ClanRight =
  | "donate"
  | "viewMembers"
  | "kickMember"
  | "renameMember"
  | "setRole"
  | "editClan"
  | "startWar"
  | "disbandClan"
  | "transferOwnership";

/** Права по роли одним списком */
export function rightsOf(role: ClanRole): ClanRight[] {
  return ROLE_RIGHTS[role];
}

/** Есть ли у роли конкретное право */
export function can(role: ClanRole, right: ClanRight): boolean {
  return ROLE_RIGHTS[role].includes(right);
}

export interface ClanMember {
  id: string;
  /** Имя участника */
  name: string;
  role: ClanRole;
  /** Очки, внесённые участником лично */
  contributed: number;
  /** Дата вступления, ISO */
  joinedAt: string;
  /** Это игрок */
  isPlayer?: boolean;
}

/** Участник своего клана */
const SELF: ClanMember = {
  id: "self",
  name: "Ты",
  role: "owner",
  contributed: 0,
  joinedAt: "",
  isPlayer: true,
};

/**
 * Пул кандидатов: те, кому можно подать заявку или пригласить.
 *
 * Имена фиксированы и не меняются при перезагрузке страницы: иначе игрок не смог бы заметить, кого приглашать.
 */
export const CANDIDATES: { name: string; tier: "legenda" | "opytnyy" | "novichok" }[] = [
  { name: "Астерия", tier: "legenda" },
  { name: "Рен", tier: "opytnyy" },
  { name: "Хакуто", tier: "opytnyy" },
  { name: "Ильза", tier: "novichok" },
  { name: "Тобияш", tier: "opytnyy" },
  { name: "Юна", tier: "novichok" },
  { name: "Вальдо", tier: "legenda" },
  { name: "Мицуба", tier: "opytnyy" },
  { name: "Каэдэ", tier: "novichok" },
  { name: "Соларис", tier: "legenda" },
  { name: "Барт", tier: "novichok" },
  { name: "Нэйр", tier: "opytnyy" },
];

export type CandidateTier = "legenda" | "opytnyy" | "novichok";

export const TIER_LABEL: Record<CandidateTier, string> = {
  legenda: "Легенда",
  opytnyy: "Опытный",
  novichok: "Новичок",
};

/** Текст заявки подбирается по уровню кандидата */
export const APPLICATION_LINES: Record<CandidateTier, string[]> = {
  legenda: [
    "Случайно наткнулся на ваш клан — оставить след решил.",
    "Беру задания хоть раз в неделю. Похоже, вам это нужно.",
  ],
  opytnyy: [
    "Смотрю много, читаю ещё больше. Годится?",
    "Умею держать темп по сериям. Добавлюсь.",
  ],
  novichok: [
    "Хочу в клан, где хотя бы хоть что-то делают.",
    "Новичок, но каждый день. Возьмёте?",
  ],
};

/**
 * Спутники появляются вместе с кланом: без них «список участников» и
 * распределение прав были бы пустым экраном — с сервером эти роли выдавали
 * бы живые игроки.
 */
const RETAINERS: Omit<ClanMember, "id">[] = [
  { name: "Kurokami", role: "admin", contributed: 4_200, joinedAt: "2026-01-14" },
  { name: "Сильвер", role: "moderator", contributed: 2_850, joinedAt: "2026-02-02" },
  { name: "Мидзуки", role: "moderator", contributed: 1_940, joinedAt: "2026-02-19" },
  { name: "Артём", role: "member", contributed: 1_260, joinedAt: "2026-03-05" },
  { name: "Ника", role: "member", contributed: 860, joinedAt: "2026-03-22" },
  { name: "Даня", role: "member", contributed: 430, joinedAt: "2026-04-08" },
];

/** Собирает состав клана игрока: владелец + спутники */
function selfMembers(): ClanMember[] {
  return [
    { ...SELF, joinedAt: "" },
    ...RETAINERS.map((item, i) => ({ ...item, id: `cr${i}` })),
  ];
}

/** Состав системного клана — детерминированно от его id */
function rivalMembers(clanId: string, count: number): ClanMember[] {
  const NAMES = [
    "Ash", "Yuki", "Tor", "Rin", "Zeph", "Nova", "Kite", "Mio", "Ren", "Sora",
    "Kaze", "Hikari", "Raiden", "Yoru", "Akira", "Sora2", "Nami", "Kuro",
    "Frost", "Ember", "Vega", "Onyx", "Lumen", "Drift", "Sol",
  ];
  // Состав по индексу клана в массиве — детерминирован, без random при рендере
  const base = clanId.charCodeAt(clanId.length - 1) % NAMES.length;
  const roles: ClanRole[] = ["admin", "moderator", "moderator", "member"];
  return Array.from({ length: count }, (_, i) => ({
    id: `${clanId}-m${i}`,
    name: NAMES[(base + i * 5) % NAMES.length],
    role: i === 0 ? "admin" : (roles[i % roles.length] as ClanRole),
    contributed: 900 + i * 640,
    joinedAt: `2025-${String((i % 12) + 1).padStart(2, "0")}-01`,
  }));
}

/** Состав клана: у системных — сгенерированный, у своего — игрок и спутники */
export function clanMembers(clan: Clan): ClanMember[] {
  const roster = clan.members ?? [];
  if (clan.mine) return roster.length ? roster : selfMembers();
  return roster.length ? roster : rivalMembers(clan.id, Math.min(clan.memberCount || 1, 12));
}

export interface Clan {
  id: string;
  /** Название клана */
  name: string;
  /** Короткая метка в скобках, как у игровых тегов: `[СВТ]` */
  tag: string;
  /** Эмблема — эмодзи-символ в круглом медальоне */
  emblem: string;
  /** Основной цвет клана (обводка, свечение) */
  color: string;
  description: string;
  /** Очки клана — определяют уровень и место в топе */
  points: number;
  /** Сколько участников в клане (для системных — зашитое число) */
  memberCount: number;
  /** Клан игрока */
  mine?: boolean;
  /** Дата создания, ISO */
  since: string;
  /**
   * Уровень клана. Растёт от суммы вкладов и открывает новые клетки.
   * У системных кланов считается от очков, у своего — от `cells`.
   */
  level: number;
  /** Сетка вкладов: сколько вложено в каждую клетку */
  cells: number[];
  /** Уровни, награда за которые уже забрана */
  claimed: number[];
  /** Состав: роли и вклад каждого (у системных кланов — генерируется) */
  members: ClanMember[];
}

/* ------------------------------------------------------------------ */
/* Уровни клана — по мотивам ратуши из Clash of Clans                  */
/* ------------------------------------------------------------------ */

/** Награда за достижение уровня клана */
export interface ClanLevelReward {
  /** Валюта прогрессии (AC) */
  ac?: number;
  /** Очки клана — сразу капают в общий счёт */
  points?: number;
  /** Название косметики, которую даёт уровень */
  item?: { kind: "title" | "frame"; id: string };
  label: string;
}

export interface ClanLevelInfo {
  level: number;
  /** Сколько клеток для вкладов открыто на этом уровне */
  cells: number;
  /** Сколько валюты нужно вложить в одну клетку */
  goal: number;
  /** Сколько очков клана даёт полностью заполненная клетка */
  points: number;
  reward: ClanLevelReward;
}

/**
 * Лестница уровней. На каждом уровне открывается ещё одна клетка для вкладов
 * и выдаётся награда — как ратуша в Clash of Clans, только вместо ресурсов
 * копим очки и валюту прогрессии.
 */
export const CLAN_LEVELS: ClanLevelInfo[] = Array.from({ length: 15 }, (_, i) => {
  const level = i + 1;
  const goal = 120 + (level - 1) * 90;
  return {
    level,
    cells: level,
    goal,
    points: goal * 0.5,
    reward:
      level % 5 === 0
        ? {
            ac: 600 + level * 120,
            points: 900 + level * 160,
            item:
              level >= 10
                ? { kind: "frame" as const, id: `frame-${11 + level}` }
                : { kind: "title" as const, id: `clan-l${level}` },
            label: level >= 10 ? "Рамка клана" : "Титул клана",
          }
        : { ac: 150 + level * 40, points: 200 + level * 60, label: "Валюта и очки" },
  };
});

/** Сколько клеток открыто на уровне */
export function cellsAtLevel(level: number): number {
  const info = CLAN_LEVELS[Math.min(Math.max(level, 1), CLAN_LEVELS.length) - 1];
  return info?.cells ?? 1;
}

/** Параметры уровня (с откатом на последний существующий) */
export function levelInfo(level: number): ClanLevelInfo {
  const clamped = Math.min(Math.max(level, 1), CLAN_LEVELS.length);
  return CLAN_LEVELS[clamped - 1];
}

/** Следующий уровень: сколько ещё нужно вложить */
export function nextLevelAt(level: number): ClanLevelInfo | null {
  return level >= CLAN_LEVELS.length ? null : CLAN_LEVELS[level];
}

/** Состояние раздела: свой клан + вклад */
export interface ClansState {
  /** Клан игрока, если он его основал */
  own: Clan | null;
  /** Накоплено очков, ещё не внесённых в клан */
  pending: number;
  /** Всего внесено за всё время */
  contributed: number;
}

/** Сколько очков даёт вклад */
export const CONTRIBUTION_RATE = 4;
/** Сколько AC стоит одна единица вклада */
export const CONTRIBUTION_COST = 25;
/** Порог роста уровня клана: очков на следующий уровень */
export const POINTS_PER_LEVEL = 1_500;

/* ------------------------------------------------------------------ */
/* Системные кланы                                                     */
/* ------------------------------------------------------------------ */

/**
 * Кланы-конкуренты. Без них топ состоял бы из одной строки игрока, и
 * место в рейтинге ничего не значило бы. Набор и очки статичны: это
 * «мир», с которым сравнивают себя.
 */
export const RIVALS: Clan[] = [
  {
    id: "r-tengu",
    name: "Небесный Тэнгу",
    tag: "ТНГ",
    emblem: "🦅",
    color: "#ff4d6d",
    description: "Древний орден, что охраняет границы неба. Считают каждый вздох.",
    points: 96_400,
    memberCount: 48,
    since: "2024-02-11",
    level: 12,
    cells: [],
    claimed: [],
    members: [],
  },
  {
    id: "r-nova",
    name: "Нова",
    tag: "NVA",
    emblem: "✦",
    color: "#b06bff",
    description: "Гильдия исследователей. Верят, что за каждым тайтлом стоит вселенная.",
    points: 74_250,
    memberCount: 37,
    since: "2024-06-02",
    level: 11,
    cells: [],
    claimed: [],
    members: [],
  },
  {
    id: "r-ash",
    name: "Пепел и Сталь",
    tag: "ПСТ",
    emblem: "🔥",
    color: "#ffb020",
    description: "Из тех, кто не бросает тайтл на середине. Серия за серией.",
    points: 58_900,
    memberCount: 29,
    since: "2024-03-19",
    level: 10,
    cells: [],
    claimed: [],
    members: [],
  },
  {
    id: "r-lumen",
    name: "Люмен",
    tag: "LMN",
    emblem: "💡",
    color: "#3d7dff",
    description: "Собирают свет от редких кадров и хранят его в общей копилке.",
    points: 41_300,
    memberCount: 22,
    since: "2024-08-07",
    level: 8,
    cells: [],
    claimed: [],
    members: [],
  },
  {
    id: "r-verdant",
    name: "Заросли",
    tag: "ZRS",
    emblem: "🌿",
    color: "#00c2a8",
    description: "Тихий клан садовников: сеют титры, жнут переводы.",
    points: 27_600,
    memberCount: 17,
    since: "2024-11-23",
    level: 7,
    cells: [],
    claimed: [],
    members: [],
  },
  {
    id: "r-obsidian",
    name: "Обсидиан",
    tag: "OBS",
    emblem: "🗿",
    color: "#8b93a7",
    description: "Немногословны. Говорят редко, но каждое слово — вклад.",
    points: 15_800,
    memberCount: 11,
    since: "2025-01-14",
    level: 5,
    cells: [],
    claimed: [],
    members: [],
  },
];

/* ------------------------------------------------------------------ */
/* Стор                                                                */
/* ------------------------------------------------------------------ */

const EMPTY: ClansState = { own: null, pending: 0, contributed: 0 };

/** Приводим сохранённое значение к текущей форме: мусор и старые поля — в ноль */
function parse(raw: string): ClansState | null {
  try {
    const value = JSON.parse(raw) as Partial<ClansState> | null;
    if (!value || typeof value !== "object") return null;
    const own = value.own;
    if (!own || typeof own.name !== "string" || typeof own.id !== "string") {
      return { own: null, pending: Number(value.pending) || 0, contributed: Number(value.contributed) || 0 };
    }
    // Старые кланы (без сетки вкладов и состава) достраиваем
    const level = Number(own.level) || 1;
    const cells = Array.isArray(own.cells) && own.cells.length > 0 ? own.cells.map(Number) : [0];
    const roster = Array.isArray(own.members) && own.members.length > 0 ? own.members : selfMembers();
    return {
      own: {
        ...own,
        memberCount: roster.length,
        members: roster,
        points: Number(own.points) || 0,
        level,
        cells,
        claimed: Array.isArray(own.claimed) ? own.claimed.map(Number) : [],
        mine: true,
      },
      pending: Number(value.pending) || 0,
      contributed: Number(value.contributed) || 0,
    };
  } catch {
    return null;
  }
}

const store = createLocalStore<ClansState>(CLANS_KEY, EMPTY, parse);

/* ------------------------------------------------------------------ */
/* Логика                                                              */
/* ------------------------------------------------------------------ */

/** Ранг по очкам */
export function clanTier(points: number): ClanTier {
  let tier = CLAN_TIERS[0];
  for (const item of CLAN_TIERS) if (points >= item.at) tier = item;
  return tier;
}

/** Уровень клана из суммы очков (для системных кланов) */
export function clanLevel(points: number): number {
  return Math.floor(points / POINTS_PER_LEVEL) + 1;
}

/** Прогресс внутри уровня по очкам: 0…1 (для системных кланов) */
export function clanLevelProgress(points: number): number {
  return (points % POINTS_PER_LEVEL) / POINTS_PER_LEVEL;
}

/**
 * Сколько вложено всего в клетки. Из этой суммы считается уровень:
 * заполненные клетки поднимают ратушку, как в Clash of Clans.
 * Принимаем и клан, и просто массив клеток — месту удобнее считать по клеткам.
 */
export function investedIn(source: Pick<Clan, "cells"> | number[]): number {
  const cells = Array.isArray(source) ? source : source.cells;
  return cells.reduce((sum, value) => sum + (value || 0), 0);
}

/**
 * Уровень клана от вкладов.
 *
 * Клетка на уровне N стоит `levelInfo(N).goal`. Пока не набрано суммы всех
 * открытых клеток, уровень прежний; переполнение уходит в следующую
 * открытую клетку — поэтому лишнее не пропадает.
 */
export function levelFromCells(cells: number[]): number {
  let level = 1;
  let need = 0;
  for (let i = 1; i <= CLAN_LEVELS.length; i++) {
    need += levelInfo(i).goal;
    if (investedIn(cells) >= need) level = i + 1;
    else break;
  }
  return Math.min(level, CLAN_LEVELS.length);
}

/** Сколько ещё вложить до следующего уровня (0 — уже максимум) */
export function toNextLevel(cells: number[]): number {
  const level = levelFromCells(cells);
  if (level > CLAN_LEVELS.length) return 0;
  let need = 0;
  for (let i = 1; i < level; i++) need += levelInfo(i).goal;
  const target = need + levelInfo(level).goal;
  return Math.max(0, target - investedIn(cells));
}

/** Прогресс внутри уровня по вкладу: 0…1 */
export function levelProgress(cells: number[]): number {
  const level = levelFromCells(cells);
  if (level > CLAN_LEVELS.length) return 1;
  let need = 0;
  for (let i = 1; i < level; i++) need += levelInfo(i).goal;
  const invested = investedIn({ cells });
  return Math.min(1, (invested - need) / levelInfo(level).goal);
}

export interface DonateResult {
  /** Начислено очков клана */
  points: number;
  /** Новые уровни, открытые этим вкладом */
  levelsUp: number[];
  /** Итоговая сетка клеток */
  cells: number[];
}

/**
 * Внести вклад в клетку. Деньги перетекают: сперва заполняется выбранная
 * клетка, остаток уходит в следующую открытую, дальше — в новую, открытую
 * ростом уровня. Возвращает, сколько очков клана начислено.
 */
export function planDonation(clan: Clan, ac: number, cellIndex: number): DonateResult {
  const empty: DonateResult = { points: 0, levelsUp: [], cells: [...clan.cells] };
  let budget = Math.max(0, Math.floor(ac));
  if (budget === 0 || clan.cells.length === 0) return empty;

  const cells = [...clan.cells];

  /** У клетки i цель уровня i+1 — как в ратуше, где этажи дорожают */
  const goalOf = (index: number): number => levelInfo(Math.min(index + 1, CLAN_LEVELS.length)).goal;
  const pointsOf = (index: number): number =>
    levelInfo(Math.min(index + 1, CLAN_LEVELS.length)).points;

  // Сколько клеток нужно, чтобы вместить весь вклад: слоты следующих
  // уровней открываются сами, пока хватает валюты. Без этого крупный вклад
  // упирался бы в первую клетку, а остаток пропадал бы.
  const capacityOf = (count: number): number => {
    let sum = 0;
    for (let i = 0; i < count; i++) sum += goalOf(i);
    return sum;
  };
  let available = Math.max(cells.length, 1);
  const startInvested = investedIn(cells);
  while (capacityOf(available) - startInvested < budget && available < CLAN_LEVELS.length) {
    available++;
  }

  let points = 0;
  let placedAny = false;
  // Вкладываем по кругу от выбранной клетки, пока есть место и деньги
  for (let pass = 0; pass < 4 && budget > 0; pass++) {
    let placed = false;
    for (let step = 0; step < available && budget > 0; step++) {
      const index = (cellIndex + step) % available;
      const goal = goalOf(index);
      const room = Math.max(0, goal - (cells[index] ?? 0));
      if (room === 0) continue;
      const put = Math.min(room, budget);
      cells[index] = (cells[index] ?? 0) + put;
      budget -= put;
      // Доля вложенного даёт долю очков клетки
      points += (put / goal) * pointsOf(index);
      placed = true;
      placedAny = true;
    }
    if (!placed) break;
  }
  if (!placedAny) return empty;

  const before = clan.level ?? levelFromCells(cells);
  const after = levelFromCells(cells);
  while (cells.length < cellsAtLevel(after)) cells.push(0);

  const levelsUp: number[] = [];
  for (let level = before + 1; level <= after; level++) levelsUp.push(level);

  return { points: Math.round(points), levelsUp, cells };
}

/** Тег: 2–4 символа, верхний регистр */
export function normalizeTag(tag: string): string {
  return tag.replace(/[^a-zA-Zа-яА-Я0-9]/g, "").slice(0, 4).toUpperCase();
}

/** Имя: до 24 символов, без служебных пробелов */
export function normalizeName(name: string): string {
  return name.replace(/\s+/g, " ").trim().slice(0, 24);
}

export interface CreateClanInput {
  name: string;
  tag: string;
  emblem: string;
  color: string;
  description: string;
}

/** Ошибки создания — пустой массив значит «можно создавать» */
export function validateClan(
  input: CreateClanInput,
  current: ClansState,
  rivalTags: string[],
): string[] {
  const errors: string[] = [];
  const name = normalizeName(input.name);
  const tag = normalizeTag(input.tag);

  if (name.length < 3) errors.push("Название — минимум 3 символа");
  if (tag.length < 2) errors.push("Метка — минимум 2 символа");
  if ([...name].every((ch) => /\d/.test(ch))) errors.push("Название должно содержать буквы");
  if (rivalTags.includes(tag)) errors.push(`Метка [${tag}] уже занята`);

  const all = [current.own, ...RIVALS].filter(Boolean) as Clan[];
  if (all.some((clan) => normalizeTag(clan.tag) === tag)) errors.push(`Метка [${tag}] уже занята`);
  if (all.some((clan) => normalizeName(clan.name).toLowerCase() === name.toLowerCase()))
    errors.push("Клан с таким названием уже есть");

  if (!input.emblem) errors.push("Выбери эмблему");
  return errors;
}

/** Создать клан игрока */
export function createClan(input: CreateClanInput): ClansState {
  const name = normalizeName(input.name);
  store.update((current) => ({
    ...current,
    own: {
      id: localId("cl"),
      name,
      tag: normalizeTag(input.tag),
      emblem: input.emblem || "🛡",
      color: input.color,
      description: input.description.trim().slice(0, 160),
      points: 0,
      memberCount: 7,
      mine: true,
      since: new Date().toISOString(),
      // Стартуем с одной клеткой — как ратуша первого уровня
      level: 1,
      cells: [0],
      claimed: [],
      members: selfMembers(),
    },
  }));
  return store.get();
}

/** Распустить клан */
export function disbandClan(): void {
  store.update((current) => ({ ...current, own: null, pending: 0 }));
}

/**
 * Внести вклад в клетку. `ac` — доступная валюта, `cellIndex` — клетка.
 * Вклад перетекает по кругу (выбранная → следующие), пока есть место.
 */
export function contribute(ac: number, cellIndex = 0): DonateResult {
  const current = store.get();
  const clan = current.own;
  if (!clan) return { points: 0, levelsUp: [], cells: [] };

  const plan = planDonation(clan, ac, cellIndex);
  if (plan.points === 0 && plan.cells.every((value, i) => value === clan.cells[i])) {
    return plan;
  }

  store.update((state) => {
    if (!state.own) return state;
    const earned = plan.levelsUp.reduce((sum, level) => sum + (levelInfo(level).reward.points ?? 0), 0);
    return {
      ...state,
      own: {
        ...state.own,
        cells: plan.cells,
        level: levelFromCells(plan.cells),
        points: state.own.points + plan.points + earned,
      },
      contributed: state.contributed + plan.points,
    };
  });
  return plan;
}

/**
 * Забрать награду за уровень. Очки клана начисляются сразу при вкладе,
 * а предмет и валюту забирают здесь — чтобы игрок увидел, что уровень
 * достигнут и забрал его, как сундук в Clash of Clans.
 */
/* ------------------------------------------------------------------ */
/* Управление составом                                                 */
/* ------------------------------------------------------------------ */

/** Роль, которой можно выдать участника (владельца не трогаем) */
export const ASSIGNABLE_ROLES: ClanRole[] = ["member", "moderator", "admin"];

/** Что вернёт проверка права: либо ок, либо причина отказа */
export interface RightCheck {
  ok: boolean;
  reason?: string;
}

/**
 * Проверка права: роль автора против права, и с учётом того, что владельца
 * нельзя понизить или выгнать.
 */
export function checkRight(
  actor: ClanMember | undefined,
  right: ClanRight,
  target?: ClanMember,
): RightCheck {
  if (!actor) return { ok: false, reason: "Нет доступа" };
  if (!can(actor.role, right)) {
    return { ok: false, reason: `Роль «${ROLE_LABEL[actor.role]}» не даёт этого права` };
  }
  if (target?.isPlayer) return { ok: false, reason: "Владельца не трогают" };
  return { ok: true };
}

/** Кого можно понизить или повысить: не владельца и не самого себя */
export function canEditMember(actor: ClanMember | undefined, target: ClanMember): boolean {
  if (!actor || target.isPlayer || actor.id === target.id) return false;
  return can(actor.role, "setRole");
}

/** Применяет правку к составу; возвращает новое состояние или null */
function patchMembers(
  mutate: (roster: ClanMember[]) => ClanMember[] | null,
): ClansState | null {
  let next: ClansState | null = null;
  store.update((state) => {
    if (!state.own) return state;
    const roster = mutate(clanMembers(state.own));
    if (!roster) return state;
    next = {
      ...state,
      own: { ...state.own, members: roster, memberCount: roster.length },
    };
    return next;
  });
  return next;
}

/** Сменить роль участника */
/**
 * Добавить участника в свой клан.
 *
 * Отдельная функция а не флаг у внутреннего патча: принятая заявка и приглашение — разные события с разными записями в журнале, и старгать должен игровой слой, а не интерфейс.
 */
export function addMember(member: ClanMember): RightCheck {
  const state = store.get();
  if (!state.own) return { ok: false, reason: "Клана нет" };
  if (clanMembers(state.own).some((m) => m.name === member.name)) {
    return { ok: false, reason: "Такой участник уже в клане" };
  }

  let ok = false;
  store.update((current) => {
    if (!current.own) return current;
    const roster = [...clanMembers(current.own), member];
    ok = true;
    return {
      ...current,
      own: { ...current.own, members: roster, memberCount: roster.length },
    };
  });
  return ok ? { ok: true } : { ok: false, reason: "Не удалось добавить" };
}

export function setMemberRole(memberId: string, role: ClanRole): RightCheck {
  const state = store.get();
  if (!state.own) return { ok: false, reason: "Клана нет" };
  const roster = clanMembers(state.own);
  const actor = roster.find((m) => m.isPlayer);
  const target = roster.find((m) => m.id === memberId);
  const check = checkRight(actor, "setRole", target);
  if (!check.ok) return check;
  if (!ASSIGNABLE_ROLES.includes(role)) return { ok: false, reason: "Такой роли нет" };

  const updated = patchMembers((list) =>
    list.map((m) => (m.id === memberId ? { ...m, role } : m)),
  );
  return updated ? { ok: true } : { ok: false, reason: "Не удалось применить" };
}

/** Исключить участника из клана */
export function kickMember(memberId: string): RightCheck {
  const state = store.get();
  if (!state.own) return { ok: false, reason: "Клана нет" };
  const roster = clanMembers(state.own);
  const actor = roster.find((m) => m.isPlayer);
  const target = roster.find((m) => m.id === memberId);
  const check = checkRight(actor, "kickMember", target);
  if (!check.ok) return check;

  const updated = patchMembers((list) => list.filter((m) => m.id !== memberId));
  return updated ? { ok: true } : { ok: false, reason: "Не удалось применить" };
}

/** Передать права владельца выбранному участнику */
export function transferOwnership(memberId: string): RightCheck {
  const state = store.get();
  if (!state.own) return { ok: false, reason: "Клана нет" };
  const roster = clanMembers(state.own);
  const target = roster.find((m) => m.id === memberId);
  const check = checkRight(roster.find((m) => m.isPlayer), "transferOwnership", target);
  if (!check.ok) return check;

  const updated = patchMembers((list) =>
    list.map((m) =>
      m.id === memberId
        ? { ...m, role: "owner" as ClanRole }
        : m.isPlayer
          ? { ...m, role: "admin" as ClanRole }
          : m,
    ),
  );
  return updated ? { ok: true } : { ok: false, reason: "Не удалось применить" };
}

export function claimLevelReward(level: number): ClanLevelReward | null {
  const current = store.get();
  const clan = current.own;
  if (!clan) return null;
  if (level > clan.level) return null;
  if (clan.claimed.includes(level)) return null;

  const reward = levelInfo(level).reward;
  store.update((state) =>
    state.own ? { ...state, own: { ...state.own, claimed: [...state.own.claimed, level] } } : state,
  );
  return reward;
}

/** Уровни с готовой, но незабранной наградой */
export function claimableLevels(clan: Clan): number[] {
  return Array.from({ length: clan.level }, (_, i) => i + 1).filter(
    (level) => !clan.claimed.includes(level),
  );
}

/** Полный список кланов: системные + клан игрока, по убыванию очков */
export function allClans(state: ClansState): Clan[] {
  const list = [...RIVALS];
  if (state.own) list.push(state.own);
  return list.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
}

/** Позиция клана игрока в топе (1-based) */
export function ownRank(state: ClansState): number {
  if (!state.own) return 0;
  return allClans(state).findIndex((clan) => clan.id === state.own?.id) + 1;
}

/** Поиск по названию, метке и описанию */
export function searchClans(state: ClansState, query: string): Clan[] {
  const q = query.trim().toLowerCase();
  const list = allClans(state);
  if (!q) return list;
  return list.filter(
    (clan) =>
      clan.name.toLowerCase().includes(q) ||
      clan.tag.toLowerCase().includes(q) ||
      clan.description.toLowerCase().includes(q),
  );
}

/** Эмблемы на выбор */
export const EMBLEMS = [
  "🛡", "⚔", "🔥", "🐺", "🦅", "🐉", "🌿", "💎",
  "👑", "⚡", "🎯", "🌙", "☀", "❄", "🍀", "🔱",
];

/** Палитра клана */
export const CLAN_COLORS = [
  "#3d7dff", "#00c2a8", "#b06bff", "#ffb020",
  "#ff4d6d", "#8b93a7", "#2bd576", "#ff7a45",
];

export const useClans = store.useStore;