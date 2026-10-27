/**
 * Мир кланов — общие правила и генерация карты.
 * Без "use client": файл читают и сервер (проверка действий), и интерфейс (рисует карту).
 *
 * Карта одна на всех и детерминированная: из зерна считается форма материка, виды
 * местности и названия. В базе лежит только то, что меняется (кто владеет клеткой,
 * сколько у неё прочности), поэтому клиенту не нужно присылать ландшафт.
 *
 * Принцип честности тот же, что в лигах: «влияние» клана — это его недельные очки,
 * посчитанные сервером из реального опыта игроков. За деньги влияние не купить.
 */

export const WORLD_SEED = "anigalaxy-world-1";
export const WORLD_RADIUS = 11;
export const HEX_SIZE = 44;

/* ------------------------------- Правила ------------------------------- */

/** Минимум игроков в клане, чтобы он мог занимать земли */
export const MIN_WORLD_MEMBERS = 3;
export type Tier = 1 | 2 | 3 | 4;
export const TIER_NAME: Record<Tier, string> = { 1: "Окраина", 2: "Провинция", 3: "Сердце земель", 4: "Престол" };
/** Цена занятия свободной клетки в очках влияния */
export const CLAIM_COST: Record<Tier, number> = { 1: 150, 2: 320, 3: 640, 4: 1300 };
/** Каждая уже занятая клетка делает следующий захват дороже: сильные кланы растут медленнее */
export const CLAIM_GROWTH = 0.04;
export const CLAIM_GROWTH_CAP = 2.5;
/** Прочность клетки по ярусу */
export const TIER_HP: Record<Tier, number> = { 1: 500, 2: 900, 3: 1500, 4: 2600 };
export const CAPITAL_HP = 2200;
/** С какой доли прочности клетка начинает у нового владельца */
export const CLAIM_START_HP = 0.5;
export const CAPTURE_START_HP = 0.35;
/** Прочность без присмотра убывает: доля от максимума в сутки, но не ниже пола */
export const DECAY_PER_DAY = 0.03;
export const DECAY_FLOOR = 0.3;
export const MIN_ACTION = 50;
export const MIN_ATTACK = 100;
export const SHIELD_CLAIM_MS = 60 * 60 * 1000;
export const SHIELD_CAPTURE_MS = 4 * 60 * 60 * 1000;
export const SHIELD_CAPITAL_MS = 12 * 60 * 60 * 1000;
/** Очки клетки в недельном зачёте владений */
export const TILE_SCORE: Record<Tier, number> = { 1: 1, 2: 2, 3: 4, 4: 8 };
/** Дань: монеты в казну клана за клетку каждую неделю */
export const TILE_TRIBUTE: Record<Tier, number> = { 1: 15, 2: 30, 3: 60, 4: 120 };

export interface WorldReward {
  from: number;
  to: number;
  label: string;
  memberAc: number;
  treasuryAc: number;
  trophies: number;
  titleId?: string;
}
/** Награды недели за владения: только для кланов, у которых есть хоть одна клетка */
export const WORLD_REWARDS: readonly WorldReward[] = [
  { from: 1, to: 1, label: "Владыка карты", memberAc: 500, treasuryAc: 2000, trophies: 6, titleId: "t-world-sovereign" },
  { from: 2, to: 3, label: "Завоеватели", memberAc: 300, treasuryAc: 1200, trophies: 3, titleId: "t-world-warlord" },
  { from: 4, to: 10, label: "Хранители границ", memberAc: 120, treasuryAc: 500, trophies: 1, titleId: "t-world-keeper" },
  { from: 11, to: 9999, label: "Поселенцы", memberAc: 40, treasuryAc: 0, trophies: 0 },
];
export const worldRewardForRank = (rank: number): WorldReward | undefined => WORLD_REWARDS.find((r) => rank >= r.from && rank <= r.to);

export const claimCost = (tier: Tier, owned: number): number =>
  Math.round(CLAIM_COST[tier] * Math.min(CLAIM_GROWTH_CAP, 1 + CLAIM_GROWTH * owned));

/** Прочность с учётом ухода: считается лениво по времени, в базе хранится точка отсчёта */
export function effectiveHp(hp: number, hpAt: number, maxHp: number, now: number): number {
  const days = Math.max(0, now - hpAt) / 86_400_000;
  const floor = Math.floor(maxHp * DECAY_FLOOR);
  if (hp <= floor) return hp;
  return Math.max(floor, Math.round(hp - maxHp * DECAY_PER_DAY * days));
}

/* ------------------------------- Местность ----------------------------- */

export type TileKind = "plains" | "forest" | "mountain" | "shrine" | "ruins" | "city" | "rift" | "crystal" | "throne";

export interface KindInfo {
  label: string;
  /** Множитель прочности клетки */
  hp: number;
  blurb: string;
  /** Цвет местности на карте: верх и низ градиента */
  a: string;
  b: string;
}
export const KINDS: Record<TileKind, KindInfo> = {
  plains: { label: "Равнины", hp: 1, blurb: "Открытые земли: легко занять, легко потерять.", a: "#27406f", b: "#1a2a52" },
  forest: { label: "Лес", hp: 1.1, blurb: "Густая чаща скрывает гарнизон.", a: "#1f5a58", b: "#133d44" },
  mountain: { label: "Горы", hp: 1.3, blurb: "Скалы держат оборону лучше стен.", a: "#4a4f78", b: "#2c3050" },
  shrine: { label: "Святилище", hp: 1.1, blurb: "Место силы: за него любят сражаться.", a: "#5a3f86", b: "#33245a" },
  ruins: { label: "Руины", hp: 0.9, blurb: "Старые стены уже не те, что прежде.", a: "#4a4568", b: "#2b2845" },
  city: { label: "Город", hp: 1.2, blurb: "Стены, рынок и гарнизон.", a: "#2f5b86", b: "#1d3a60" },
  rift: { label: "Разлом", hp: 1.15, blurb: "Из трещины тянет холодом и силой.", a: "#6a2c6e", b: "#3a1546" },
  crystal: { label: "Кристальные пики", hp: 1.2, blurb: "Звёздные кристаллы светятся даже ночью.", a: "#2a6a86", b: "#173b5a" },
  throne: { label: "Престол", hp: 1.4, blurb: "Сердце карты. Тот, кто держит его, виден всем.", a: "#8a6a2a", b: "#4a3414" },
};

export interface WorldTile {
  id: number;
  q: number;
  r: number;
  x: number;
  y: number;
  dist: number;
  tier: Tier;
  kind: TileKind;
  name: string;
  landmark: boolean;
  /** Окраина: здесь клан может основать столицу */
  spawn: boolean;
  neighbors: number[];
  maxHp: number;
}

export interface World {
  tiles: WorldTile[];
  byCoord: Map<string, number>;
  width: number;
  height: number;
  minX: number;
  minY: number;
  spawns: number[];
}

/* ------------------------------- Хэш и шум ----------------------------- */

function hash32(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function lattice(ix: number, iy: number, salt: string): number {
  return hash32(`${WORLD_SEED}:${salt}:${ix}:${iy}`) / 4294967296;
}
const smooth = (t: number): number => t * t * (3 - 2 * t);
function valueNoise(x: number, y: number, salt: string): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smooth(x - x0);
  const fy = smooth(y - y0);
  const a = lattice(x0, y0, salt);
  const b = lattice(x0 + 1, y0, salt);
  const c = lattice(x0, y0 + 1, salt);
  const d = lattice(x0 + 1, y0 + 1, salt);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
const fbm = (x: number, y: number, salt: string): number => valueNoise(x, y, salt) * 0.65 + valueNoise(x * 2.1, y * 2.1, `${salt}b`) * 0.35;

const DIRS: [number, number][] = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
export const hexDistance = (q: number, r: number): number => Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));

/* -------------------------------- Названия ----------------------------- */

const ADJ: Record<TileKind, string[]> = {
  plains: ["Ветреные", "Золотые", "Тихие", "Серебряные", "Звёздные", "Росные", "Вольные", "Пепельные"],
  forest: ["Шепчущий", "Туманный", "Старый", "Лунный", "Тенистый", "Багряный", "Спящий", "Дикий"],
  mountain: ["Железный", "Каменный", "Седой", "Грозовой", "Острый", "Ледяной", "Чёрный", "Высокий"],
  shrine: ["Лунный", "Тихий", "Священный", "Забытый", "Светлый", "Звёздный", "Алый", "Белый"],
  ruins: ["Павшая", "Забытая", "Древняя", "Сломанная", "Выжженная", "Безымянная", "Дальняя", "Пустая"],
  city: ["Северный", "Приморский", "Вольный", "Торговый", "Красный", "Новый", "Крепкий", "Стальной"],
  rift: ["Бледный", "Тёмный", "Дрожащий", "Алый", "Беззвёздный", "Гулкий", "Живой", "Холодный"],
  crystal: ["Лазурные", "Звёздные", "Хрустальные", "Поющие", "Синие", "Сияющие", "Тонкие", "Ясные"],
  throne: ["Небесный"],
};
const NOUN: Record<TileKind, string[]> = {
  plains: ["Луга", "Поля", "Степи", "Холмы", "Долина", "Берега"],
  forest: ["Лес", "Бор", "Дубрава", "Роща", "Чаща", "Заросли"],
  mountain: ["Перевал", "Хребет", "Утёс", "Пик", "Кряж", "Уступ"],
  shrine: ["Алтарь", "Храм", "Святилище", "Кумирня", "Источник", "Врата"],
  ruins: ["Руины", "Развалины", "Крепость", "Башня", "Мост", "Форт"],
  city: ["Порт", "Город", "Гавань", "Посад", "Застава", "Рынок"],
  rift: ["Разлом", "Провал", "Излом", "Бездна", "Трещина", "Портал"],
  crystal: ["Пики", "Грот", "Шпили", "Копи", "Россыпи", "Гряда"],
  throne: ["Престол"],
};

/** Именные места: берём названия из прежней локальной карты кланов, чтобы лор не терялся */
const LANDMARKS: { name: string; kind: TileKind; angle: number; dist: number }[] = [
  { name: "Трон Небожителей", kind: "throne", angle: 0, dist: 0 },
  { name: "Храм Ветров", kind: "shrine", angle: 300, dist: 4 },
  { name: "Бездонный Разлом", kind: "rift", angle: 255, dist: 6 },
  { name: "Небесная Крепость", kind: "city", angle: 335, dist: 6 },
  { name: "Академия Магов", kind: "shrine", angle: 95, dist: 7 },
  { name: "Город Охотников", kind: "city", angle: 40, dist: 8 },
  { name: "Лес Духов", kind: "forest", angle: 155, dist: 8 },
  { name: "Врата Столицы", kind: "city", angle: 205, dist: 8 },
  { name: "Звёздные Копи", kind: "crystal", angle: 125, dist: 4 },
  { name: "Пик Грома", kind: "mountain", angle: 15, dist: 5 },
  { name: "Руины Первой Эры", kind: "ruins", angle: 185, dist: 4 },
  { name: "Озёрный Алтарь", kind: "shrine", angle: 65, dist: 3 },
];

const ROMAN = ["", " II", " III", " IV", " V", " VI"];

/* ------------------------------- Генерация ----------------------------- */

let cache: World | null = null;

export function buildWorld(): World {
  if (cache) return cache;
  const R = WORLD_RADIUS;
  const raw: { q: number; r: number }[] = [];
  for (let r = -R; r <= R; r += 1) {
    for (let q = Math.max(-R, -r - R); q <= Math.min(R, -r + R); q += 1) raw.push({ q, r });
  }
  const sqrt3 = Math.sqrt(3);
  const px = (q: number, r: number) => HEX_SIZE * sqrt3 * (q + r / 2);
  const py = (r: number) => HEX_SIZE * 1.5 * r;

  // Форма материка: шум + спад к краю. В середине всегда суша.
  const isLand = (q: number, r: number): boolean => {
    const d = hexDistance(q, r);
    if (d <= 2) return true;
    const x = px(q, r) / 140;
    const y = py(r) / 140;
    const edge = 1 - Math.pow(d / (R + 0.6), 1.7);
    return fbm(x, y, "land") * 0.62 + edge * 0.6 > 0.5;
  };

  let land = new Set<string>();
  for (const t of raw) if (isLand(t.q, t.r)) land.add(`${t.q},${t.r}`);

  // Оставляем только материк, связанный с центром: острова без дорог были бы недоступны
  const seen = new Set<string>(["0,0"]);
  const queue: [number, number][] = [[0, 0]];
  while (queue.length) {
    const [cq, cr] = queue.pop() as [number, number];
    for (const [dq, dr] of DIRS) {
      const key = `${cq + dq},${cr + dr}`;
      if (land.has(key) && !seen.has(key)) {
        seen.add(key);
        queue.push([cq + dq, cr + dr]);
      }
    }
  }
  land = seen;

  const landTiles = raw.filter((t) => land.has(`${t.q},${t.r}`));
  const idOf = new Map<string, number>();
  landTiles.forEach((t, i) => idOf.set(`${t.q},${t.r}`, i));

  const tiles: WorldTile[] = landTiles.map((t, i) => {
    const dist = hexDistance(t.q, t.r);
    const tier: Tier = dist <= 2 ? 4 : dist <= 5 ? 3 : dist <= 8 ? 2 : 1;
    const x = px(t.q, t.r);
    const y = py(t.r);
    const n1 = fbm(x / 90, y / 90, "kind");
    const n2 = fbm(x / 70 + 9, y / 70 - 4, "kind2");
    let kind: TileKind = "plains";
    if (dist === 0) kind = "throne";
    else if (n1 > 0.64) kind = "mountain";
    else if (n1 > 0.56 && n2 > 0.55) kind = "crystal";
    else if (n2 > 0.62) kind = "forest";
    else if (n1 < 0.3 && n2 < 0.4) kind = "rift";
    else if (n2 < 0.28) kind = "ruins";
    else if (n1 < 0.38) kind = "shrine";
    else if (hash32(`${WORLD_SEED}:city:${t.q}:${t.r}`) % 13 === 0) kind = "city";
    else if (n2 > 0.5) kind = "forest";
    const neighbors: number[] = [];
    for (const [dq, dr] of DIRS) {
      const nid = idOf.get(`${t.q + dq},${t.r + dr}`);
      if (nid !== undefined) neighbors.push(nid);
    }
    return { id: i, q: t.q, r: t.r, x, y, dist, tier, kind, name: "", landmark: false, spawn: dist >= R - 4 && neighbors.length < 6, neighbors, maxHp: 0 };
  });

  // Именные места: ближайшая подходящая клетка к нужному углу и расстоянию
  const taken = new Set<number>();
  for (const mark of LANDMARKS) {
    const a = (mark.angle * Math.PI) / 180;
    const tq = mark.dist * Math.cos(a) * 0.9;
    const tr = -mark.dist * Math.sin(a) * 0.62;
    let best = -1;
    let bestScore = Infinity;
    for (const t of tiles) {
      if (taken.has(t.id) || t.spawn) continue;
      const score = Math.hypot(t.q - (tq - tr / 2), t.r - tr) + Math.abs(t.dist - mark.dist) * 0.5;
      if (score < bestScore) {
        bestScore = score;
        best = t.id;
      }
    }
    if (best >= 0) {
      taken.add(best);
      tiles[best].kind = mark.kind;
      tiles[best].name = mark.name;
      tiles[best].landmark = true;
    }
  }

  // Остальные названия: по виду местности, без повторов
  const used = new Set<string>(tiles.filter((t) => t.name).map((t) => t.name));
  for (const t of tiles) {
    if (!t.name) {
      const h = hash32(`${WORLD_SEED}:name:${t.id}`);
      const adj = ADJ[t.kind];
      const noun = NOUN[t.kind];
      const name = fixAgreement(adj[h % adj.length], noun[(h >>> 8) % noun.length]);
      let k = 0;
      while (used.has(name + ROMAN[k]) && k < ROMAN.length - 1) k += 1;
      t.name = name + ROMAN[k];
      used.add(t.name);
    }
    t.maxHp = Math.round(TIER_HP[t.tier] * KINDS[t.kind].hp);
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const t of tiles) {
    minX = Math.min(minX, t.x - HEX_SIZE);
    maxX = Math.max(maxX, t.x + HEX_SIZE);
    minY = Math.min(minY, t.y - HEX_SIZE);
    maxY = Math.max(maxY, t.y + HEX_SIZE);
  }
  const byCoord = new Map<string, number>();
  tiles.forEach((t) => byCoord.set(`${t.q},${t.r}`, t.id));
  cache = { tiles, byCoord, width: maxX - minX, height: maxY - minY, minX, minY, spawns: tiles.filter((t) => t.spawn).map((t) => t.id) };
  return cache;
}

/** Согласование рода: «Туманный Лес», «Туманная Чаща», «Туманные Луга», «Священное Святилище» */
function fixAgreement(adj: string, noun: string): string {
  const FEM = new Set(["Долина", "Чаща", "Дубрава", "Роща", "Кумирня", "Гавань", "Застава", "Башня", "Трещина", "Бездна", "Гряда", "Крепость"]);
  const NEUT = new Set(["Святилище"]);
  const PLURAL = new Set(["Луга", "Поля", "Степи", "Холмы", "Берега", "Заросли", "Руины", "Развалины", "Пики", "Шпили", "Копи", "Врата", "Россыпи"]);
  const stem = adj.replace(/(ый|ий|ой|ая|яя|ое|ее|ые|ие)$/, "");
  const hush = /[гкхжшчщ]$/.test(stem);
  const soft = /(ий|ие|яя|ее)$/.test(adj) && !hush;
  if (PLURAL.has(noun)) return `${stem}${hush || soft ? "ие" : "ые"} ${noun}`;
  if (FEM.has(noun)) return `${stem}${soft ? "яя" : "ая"} ${noun}`;
  if (NEUT.has(noun)) return `${stem}${soft ? "ее" : "ое"} ${noun}`;
  return `${stem}${hush || soft ? "ий" : /ой$/.test(adj) ? "ой" : "ый"} ${noun}`;
}

export const tileById = (id: number): WorldTile | undefined => buildWorld().tiles[id];
export const isSpawnTile = (id: number): boolean => !!tileById(id)?.spawn;

/** Палитра клановых цветов: берётся по id клана, если лидер не выбрал свой цвет */
export const CLAN_COLORS = ["#4da3ff", "#ff6b8b", "#ffc25a", "#7ee8b0", "#b98cff", "#ff8a4d", "#5ce1e6", "#f472d0", "#a3e635", "#fb7185", "#60a5fa", "#fbbf24"] as const;
export function clanColor(clanId: number, custom?: unknown): string {
  if (typeof custom === "string" && /^#[0-9a-fA-F]{6}$/.test(custom)) return custom;
  return CLAN_COLORS[Math.abs(Math.imul(clanId, 2654435761) >>> 0) % CLAN_COLORS.length];
}

/** Контур шестиугольника с острым верхом: 6 вершин вокруг центра клетки */
export function hexPoints(cx: number, cy: number, size = HEX_SIZE): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI / 180) * (60 * i - 30);
    pts.push([cx + size * Math.cos(a), cy + size * Math.sin(a)]);
  }
  return pts;
}
/** Ребро между клеткой и её соседом: i — направление из DIRS. Нужно для границ владений */
export const EDGE_FOR_DIR: Record<string, number> = { "1,0": 0, "0,1": 1, "-1,1": 2, "-1,0": 3, "0,-1": 4, "1,-1": 5 };
export const NEIGHBOR_DIRS = DIRS;
