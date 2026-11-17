/**
 * Карты боя («заклинания»): «рука» отряда в управляемом бою, как в Hearthstone.
 * Мана копится каждый раунд, карты разыгрывают в ход героя перед действием.
 * Игрок собирает коллекцию карт боя и составляет из неё колоду заклинаний.
 * Арты лежат в /public/spells/<id>.webp.
 *
 * Эффекты описаны данными (ops), обрабатывает их один обработчик в battle.ts.
 */

import type { SkillFx } from "./skills";

export type SpellKind = "damage" | "heal" | "shield" | "buff" | "debuff" | "control" | "utility";

/** Кого касается эффект */
export type Target = "self" | "allies" | "foes" | "lowAlly" | "strongAlly" | "lowFoe" | "strongFoe" | "woundedFoe" | "randFoe" | "backFoe" | "frontFoe";

export type Op =
  | { k: "dmg"; to: Target; p: number; hits?: number; exec?: { below: number; p: number } }
  | { k: "drain"; to: Target; p: number; heal: number }
  | { k: "heal"; to: Target; pct: number }
  | { k: "shield"; to: Target; pct: number }
  | { k: "atkUp"; to: Target; v: number }
  | { k: "defDown"; to: Target; v: number }
  | { k: "burn"; to: Target; m: number }
  | { k: "stun"; to: Target }
  | { k: "taunt" }
  | { k: "energy"; to: Target; n: number }
  | { k: "cleanse"; to: Target }
  | { k: "cdreset" }
  | { k: "crit" }
  | { k: "amp"; v: number }
  | { k: "revive"; pct: number }
  | { k: "mana"; n: number }
  | { k: "draw"; n: number };

export interface Tactic {
  id: string;
  name: string;
  cost: number;
  desc: string;
  fx: SkillFx;
  /** 0 обычная · 1 редкая · 2 эпическая · 3 легендарная */
  rank: 0 | 1 | 2 | 3;
  kind: SpellKind;
  ops: Op[];
  /** Входит в стартовый набор (есть у каждого игрока и у ботов) */
  starter?: boolean;
}

export const TACTIC_RULES = { start: 2, perRound: 2, max: 6, hand: 3 };
/** Колода заклинаний: сколько карт можно взять в колоду */
export const SPELL_DECK = { min: 5, max: 10 };

export const SPELL_KIND: Record<SpellKind, string> = { damage: "Урон", heal: "Лечение", shield: "Защита", buff: "Усиление", debuff: "Ослабление", control: "Контроль", utility: "Тактика" };
export const SPELL_RANK = ["Обычная", "Редкая", "Эпическая", "Легендарная"] as const;
export const SPELL_COLOR = ["#8fa3c7", "#4a8dff", "#a56bff", "#f1c56a"] as const;

/* ---------------- как получить карты боя ---------------- */
/** Создание нужной карты за пыль */
export const SPELL_CRAFT = [60, 150, 400, 900] as const;
/** Пыль за повторную карту (и при распылении) */
export const SPELL_DUST = [15, 40, 100, 240] as const;
/** Свиток карт боя: цена в пыли, сколько карт, шансы редкостей (%) */
export const SPELL_SCROLL = { cost: 120, count: 3, weights: [60, 27, 10, 3] as const };
/** Шанс получить карту боя за победу */
export const SPELL_DROP: Record<string, number> = { ladder: 0.3, duel: 0.35, campaign: 0.4, raid: 0.45, clanwar: 0.3 };
export const SPELL_DROP_WEIGHTS = [64, 26, 8, 2] as const;

const T = (id: string, name: string, cost: number, rank: 0 | 1 | 2 | 3, kind: SpellKind, fx: SkillFx, desc: string, ops: Op[], starter = false): Tactic => ({ id, name, cost, rank, kind, fx, desc, ops, ...(starter ? { starter } : {}) });

export const TACTICS: Tactic[] = [
  /* ===== мана 0–1 ===== */
  T("c-coin", "Монета маны", 0, 0, "utility", "buff", "Даёт 1 ману. Для хитрых комбинаций.", [{ k: "mana", n: 1 }]),
  T("c-surge", "Прилив", 1, 0, "utility", "buff", "+30 энергии герою, который ходит", [{ k: "energy", to: "self", n: 30 }], true),
  T("c-purge", "Очищение", 1, 0, "utility", "wind", "Снимает горение и ослабление со всего отряда", [{ k: "cleanse", to: "allies" }], true),
  T("c-bulwark", "Каменная кожа", 1, 0, "shield", "earth", "Герой, который ходит, получает щит на 25% здоровья", [{ k: "shield", to: "self", pct: 0.25 }]),
  T("c-spark", "Искра", 1, 0, "damage", "beam", "Бьёт врага с наименьшим здоровьем с силой 70%", [{ k: "dmg", to: "lowFoe", p: 0.7 }]),
  T("c-adren", "Адреналин", 1, 0, "buff", "burst", "+20% к урону героя в этот ход", [{ k: "amp", v: 1.2 }]),
  T("c-patch", "Перевязка", 1, 0, "heal", "heal", "Лечит самого раненого союзника на 12% здоровья", [{ k: "heal", to: "lowAlly", pct: 0.12 }]),
  T("c-glimpse", "Озарение", 1, 1, "utility", "wind", "Берёте ещё 1 карту боя", [{ k: "draw", n: 1 }]),
  /* ===== мана 2 ===== */
  T("c-focus", "Фокус", 2, 0, "buff", "pierce", "Удары героя в этот ход гарантированно критические", [{ k: "crit" }], true),
  T("c-power", "Натиск", 2, 0, "buff", "burst", "+35% к урону героя в этот ход", [{ k: "amp", v: 1.35 }], true),
  T("c-guard", "Заслон", 2, 0, "shield", "shield", "Щит на 18% здоровья самому раненому союзнику", [{ k: "shield", to: "lowAlly", pct: 0.18 }], true),
  T("c-mend", "Исцеление", 2, 0, "heal", "heal", "Лечит самого раненого союзника на 20% здоровья", [{ k: "heal", to: "lowAlly", pct: 0.2 }], true),
  T("c-weaken", "Слабость", 2, 0, "debuff", "debuff", "Сильнейший враг теряет 25% защиты на 3 хода", [{ k: "defDown", to: "strongFoe", v: 0.25 }], true),
  T("c-haste", "Второе дыхание", 2, 0, "utility", "whirl", "Умения героя перезаряжаются мгновенно", [{ k: "cdreset" }], true),
  T("c-bolt", "Громовая стрела", 2, 0, "damage", "beam", "Бьёт врага с наименьшим здоровьем с силой 130%", [{ k: "dmg", to: "lowFoe", p: 1.3 }]),
  T("c-snipe", "Меткий выстрел", 2, 0, "damage", "pierce", "Бьёт врага в тылу с силой 120%", [{ k: "dmg", to: "backFoe", p: 1.2 }]),
  T("c-warcry", "Рёв", 2, 0, "buff", "burst", "Герой бьёт на 30% сильнее 3 хода", [{ k: "atkUp", to: "self", v: 0.3 }]),
  T("c-barrier", "Барьер", 2, 0, "shield", "shield", "Щит на 8% здоровья каждому союзнику", [{ k: "shield", to: "allies", pct: 0.08 }]),
  T("c-spring", "Живая вода", 2, 0, "heal", "heal", "Герой, который ходит, лечит себя на 28% здоровья", [{ k: "heal", to: "self", pct: 0.28 }]),
  T("c-fire", "Огненный шар", 2, 1, "damage", "fire", "Поджигает сильнейшего врага: горение на 3 хода", [{ k: "burn", to: "strongFoe", m: 0.3 }]),
  T("c-drain", "Похищение жизни", 2, 1, "damage", "drain", "Бьёт сильнейшего врага и лечит героя на 80% урона", [{ k: "drain", to: "strongFoe", p: 0.8, heal: 0.8 }]),
  T("c-curse", "Проклятие", 2, 1, "debuff", "dark", "Все враги теряют 15% защиты на 3 хода", [{ k: "defDown", to: "foes", v: 0.15 }]),
  T("c-taunt", "Провокация", 2, 1, "control", "taunt", "Враги обязаны атаковать героя, который ходит, 3 хода", [{ k: "taunt" }]),
  T("c-venom", "Ядовитый укус", 2, 1, "damage", "poison", "Отравляет случайного врага: сильное горение на 3 хода", [{ k: "burn", to: "randFoe", m: 0.4 }]),
  T("c-frost", "Ледяной шип", 2, 1, "control", "ice", "Бьёт сильнейшего врага (70%) и снижает его защиту на 15%", [{ k: "dmg", to: "strongFoe", p: 0.7 }, { k: "defDown", to: "strongFoe", v: 0.15 }]),
  T("c-cleave", "Рассечение", 2, 1, "damage", "slash", "Бьёт врага в авангарде (110%) и случайного врага (50%)", [{ k: "dmg", to: "frontFoe", p: 1.1 }, { k: "dmg", to: "randFoe", p: 0.5 }]),
  /* ===== мана 3 ===== */
  T("c-recharge", "Перезарядка", 3, 1, "utility", "buff", "Весь отряд получает +25 энергии", [{ k: "energy", to: "allies", n: 25 }]),
  T("c-rally", "Боевой клич", 3, 1, "buff", "burst", "Весь отряд бьёт на 20% сильнее 3 хода", [{ k: "atkUp", to: "allies", v: 0.2 }]),
  T("c-bless", "Благословение", 3, 1, "heal", "heal", "Лечит весь отряд на 12% здоровья", [{ k: "heal", to: "allies", pct: 0.12 }]),
  T("c-fortify", "Укрепление", 3, 1, "shield", "earth", "Щит на 12% здоровья каждому союзнику", [{ k: "shield", to: "allies", pct: 0.12 }]),
  T("c-wisdom", "Вихрь знаний", 3, 1, "utility", "wind", "Берёте ещё 2 карты боя", [{ k: "draw", n: 2 }]),
  T("c-mirror", "Зеркальный щит", 3, 1, "shield", "shield", "Щит на 40% здоровья герою, который ходит, и враги бьют только его", [{ k: "shield", to: "self", pct: 0.4 }, { k: "taunt" }]),
  T("c-volley", "Залп", 3, 2, "damage", "rain", "Бьёт всех врагов с силой 60%", [{ k: "dmg", to: "foes", p: 0.6 }]),
  T("c-exec", "Казнь", 3, 2, "damage", "slash", "Бьёт самого раненого врага; добивает почти мёртвых с силой 220%", [{ k: "dmg", to: "woundedFoe", p: 1.0, exec: { below: 0.4, p: 2.2 } }]),
  T("c-stun", "Оглушение", 3, 2, "control", "quake", "Сильнейший враг пропускает следующий ход", [{ k: "stun", to: "strongFoe" }]),
  T("c-lightning", "Цепная молния", 3, 2, "damage", "beam", "Три удара молнии по случайным врагам с силой 80%", [{ k: "dmg", to: "randFoe", p: 0.8, hits: 3 }]),
  T("c-shadow", "Теневой клинок", 3, 2, "damage", "dark", "Гарантированно критический удар по врагу с наименьшим здоровьем", [{ k: "crit" }, { k: "dmg", to: "lowFoe", p: 1.0 }]),
  T("c-pact", "Кровавый договор", 3, 2, "buff", "dark", "Весь отряд бьёт на 25% сильнее, но защита падает на 10%", [{ k: "atkUp", to: "allies", v: 0.25 }, { k: "defDown", to: "allies", v: 0.1 }]),
  T("c-lull", "Сонная пыль", 3, 2, "control", "wind", "Случайный враг пропускает ход и теряет 15% защиты", [{ k: "stun", to: "randFoe" }, { k: "defDown", to: "foes", v: 0.15 }]),
  /* ===== мана 4 ===== */
  T("c-aegis", "Эгида", 4, 2, "shield", "shield", "Щит на 15% здоровья каждому союзнику", [{ k: "shield", to: "allies", pct: 0.15 }]),
  T("c-rage", "Ярость", 4, 2, "utility", "burst", "Энергия героя мгновенно заполняется до максимума", [{ k: "energy", to: "self", n: 100 }]),
  T("c-inferno", "Адское пламя", 4, 2, "damage", "fire", "Поджигает всех врагов: горение на 3 хода", [{ k: "burn", to: "foes", m: 0.3 }]),
  T("c-dominate", "Подавление", 4, 2, "control", "dark", "Все враги теряют 25% защиты, сильнейший пропускает ход", [{ k: "defDown", to: "foes", v: 0.25 }, { k: "stun", to: "strongFoe" }]),
  T("c-sanct", "Святилище", 4, 2, "heal", "heal", "Лечит весь отряд на 20% и снимает дурные эффекты", [{ k: "heal", to: "allies", pct: 0.2 }, { k: "cleanse", to: "allies" }]),
  T("c-blitz", "Блицкриг", 4, 2, "buff", "burst", "Весь отряд бьёт на 25% сильнее и получает +20 энергии", [{ k: "atkUp", to: "allies", v: 0.25 }, { k: "energy", to: "allies", n: 20 }]),
  T("c-assassin", "Заказное убийство", 4, 3, "damage", "slash", "Бьёт самого раненого врага с силой 140%; ниже 35% здоровья — 300%", [{ k: "dmg", to: "woundedFoe", p: 1.4, exec: { below: 0.35, p: 3.0 } }]),
  T("c-revive", "Второй шанс", 4, 3, "heal", "heal", "Возвращает в бой павшего союзника с 35% здоровья", [{ k: "revive", pct: 0.35 }]),
  /* ===== мана 5 ===== */
  T("c-meteor", "Метеоритный дождь", 5, 3, "damage", "fire", "Сокрушительный удар по всем врагам с силой 120%", [{ k: "dmg", to: "foes", p: 1.2 }]),
  T("c-ascend", "Вознесение", 5, 3, "buff", "heal", "Весь отряд: +30% к урону, щит 15% и лечение 10%", [{ k: "atkUp", to: "allies", v: 0.3 }, { k: "shield", to: "allies", pct: 0.15 }, { k: "heal", to: "allies", pct: 0.1 }]),
  T("c-time", "Остановка времени", 5, 3, "control", "whirl", "Все враги пропускают следующий ход, отряд получает +20 энергии", [{ k: "stun", to: "foes" }, { k: "energy", to: "allies", n: 20 }]),
];

export const tacticDef = (id: string): Tactic | undefined => TACTICS.find((t) => t.id === id);
export const STARTER_SPELLS: string[] = TACTICS.filter((t) => t.starter).map((t) => t.id);
/** Путь к арту карты (положите файл — он появится сам) */
export const spellArt = (id: string): string => `/spells/${id}.webp`;

/** Очистить список id заклинаний: известные, без повторов, не больше SPELL_DECK.max */
export const cleanSpells = (v: unknown): string[] => {
  const out: string[] = [];
  if (!Array.isArray(v)) return out;
  for (const id of v) if (typeof id === "string" && tacticDef(id) && !out.includes(id) && out.length < SPELL_DECK.max) out.push(id);
  return out;
};
/** Рабочая колода: свою берут, если в ней хватает карт; иначе стартовый набор */
export const spellDeckOf = (v: unknown): string[] => {
  const c = cleanSpells(v);
  return c.length >= SPELL_DECK.min ? c : STARTER_SPELLS;
};
