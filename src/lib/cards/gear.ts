/**
 * Боевое снаряжение: реликвии, модификаторы арены и тактические бустеры.
 * Все три сводятся к одному набору чисел `Perks`, который понимает симуляция боя.
 * Общий код сервера, симуляции и интерфейса.
 */

/** Суммируемые бонусы стороны. Доли: 0.1 = +10%. */
export interface Perks {
  /** Статы отряда до боя */
  atk?: number;
  def?: number;
  hp?: number;
  spd?: number;
  /** Шанс крита */
  crit?: number;
  /** Итоговый исходящий урон */
  dmg?: number;
  /** Входящий урон (отрицательное значение = защита) */
  taken?: number;
  /** Доп. урон по цели с <35% здоровья */
  exec?: number;
  /** Усиление стихийного преимущества / ослабление стихийного штрафа */
  advUp?: number;
  advDown?: number;
  /** Вампиризм: доля нанесённого урона */
  vamp?: number;
  /** Отражение: доля полученного урона */
  thorns?: number;
  /** Сила лечения и щитов */
  heal?: number;
  shield?: number;
  /** Урон горения и яда */
  dot?: number;
  /** Скорость набора энергии у своих / у врагов */
  enMul?: number;
  foeEnMul?: number;
  /** Стартовая энергия (ед.) и щит (доля макс. здоровья) */
  startEn?: number;
  startShield?: number;
  /** Однократное возрождение первого павшего союзника, доля здоровья */
  revive?: number;
  /** Атака на первые N раундов */
  burstAtk?: number;
  burstN?: number;
}

const MAXED: (keyof Perks)[] = ["revive", "burstN"];

export function mergePerks(...list: (Perks | undefined | null)[]): Perks {
  const out: Perks = {};
  for (const p of list) {
    if (!p) continue;
    for (const k of Object.keys(p) as (keyof Perks)[]) {
      const v = p[k];
      if (typeof v !== "number") continue;
      out[k] = MAXED.includes(k) ? Math.max(out[k] ?? 0, v) : (out[k] ?? 0) + v;
    }
  }
  return out;
}

/* -------------------------------- Реликвии -------------------------------- */

export type RelicRarity = "rare" | "epic" | "legend";
export const RELIC_MAX = 5;
export const RELIC_SLOTS = 3;

export const RARITY: Record<RelicRarity, { name: string; color: string; dust: number; cost: number }> = {
  rare: { name: "Редкая", color: "#5ec8ff", dust: 30, cost: 50 },
  epic: { name: "Эпическая", color: "#b690ff", dust: 80, cost: 110 },
  legend: { name: "Легендарная", color: "#ff7a5e", dust: 200, cost: 220 },
};

export interface Relic {
  id: string;
  name: string;
  rarity: RelicRarity;
  /** Имя иконки интерфейса */
  ico: "bolt" | "fire" | "shield" | "heart" | "crown" | "target" | "star" | "clock" | "eye" | "swords" | "skull" | "light" | "dark" | "scroll" | "wind";
  /** Короткое описание эффекта на уровне */
  desc: (lv: number) => string;
  perks: (lv: number) => Perks;
}

const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;

export const RELICS: Relic[] = [
  { id: "r-fang", name: "Клык упыря", rarity: "rare", ico: "heart", desc: (l) => `Отряд возвращает ${pct(0.03 + 0.01 * l)} нанесённого урона здоровьем.`, perks: (l) => ({ vamp: 0.03 + 0.01 * l }) },
  { id: "r-talon", name: "Коготь хищника", rarity: "rare", ico: "target", desc: (l) => `+${pct(0.02 + 0.008 * l)} к шансу критического удара.`, perks: (l) => ({ crit: 0.02 + 0.008 * l }) },
  { id: "r-eye", name: "Око охотника", rarity: "rare", ico: "eye", desc: (l) => `+${pct(0.06 + 0.03 * l)} урона по врагам с <35% здоровья.`, perks: (l) => ({ exec: 0.06 + 0.03 * l }) },
  { id: "r-thorn", name: "Шипастый амулет", rarity: "rare", ico: "skull", desc: (l) => `Враг получает ${pct(0.03 + 0.01 * l)} нанесённого вам урона обратно.`, perks: (l) => ({ thorns: 0.03 + 0.01 * l }) },
  { id: "r-sage", name: "Свиток мудреца", rarity: "rare", ico: "scroll", desc: (l) => `+${pct(0.04 + 0.02 * l)} к силе лечения и щитов.`, perks: (l) => ({ heal: 0.04 + 0.02 * l, shield: 0.04 + 0.02 * l }) },
  { id: "r-banner", name: "Знамя полководца", rarity: "epic", ico: "crown", desc: (l) => `+${pct(0.012 + 0.006 * l)} к атаке и +${pct(0.008 + 0.004 * l)} к здоровью всего отряда.`, perks: (l) => ({ atk: 0.012 + 0.006 * l, hp: 0.008 + 0.004 * l }) },
  { id: "r-chrono", name: "Часы Хроноса", rarity: "epic", ico: "clock", desc: (l) => `Герои начинают бой с ${5 + 4 * l} энергии ультимейта.`, perks: (l) => ({ startEn: 5 + 4 * l }) },
  { id: "r-aegis", name: "Эгида стража", rarity: "epic", ico: "shield", desc: (l) => `Каждый герой начинает бой со щитом ${pct(0.03 + 0.012 * l)} здоровья.`, perks: (l) => ({ startShield: 0.03 + 0.012 * l }) },
  { id: "r-prism", name: "Призма стихий", rarity: "epic", ico: "light", desc: (l) => `Стихийное преимущество сильнее на ${pct(0.03 + 0.012 * l)}, штраф слабее на ${pct(0.02 + 0.006 * l)}.`, perks: (l) => ({ advUp: 0.03 + 0.012 * l, advDown: 0.02 + 0.006 * l }) },
  { id: "r-ward", name: "Оберег предков", rarity: "epic", ico: "wind", desc: (l) => `Отряд получает на ${pct(0.012 + 0.007 * l)} меньше урона.`, perks: (l) => ({ taken: -(0.012 + 0.007 * l) }) },
  { id: "r-phoenix", name: "Сердце феникса", rarity: "legend", ico: "fire", desc: (l) => `Первый павший герой возвращается в бой с ${pct(0.1 + 0.03 * l)} здоровья.`, perks: (l) => ({ revive: 0.1 + 0.03 * l }) },
  { id: "r-seal", name: "Печать тишины", rarity: "legend", ico: "dark", desc: (l) => `Враги набирают энергию на ${pct(0.04 + 0.02 * l)} медленнее.`, perks: (l) => ({ foeEnMul: -(0.04 + 0.02 * l) }) },
];

export const relicDef = (id: string): Relic | undefined => RELICS.find((r) => r.id === id);

/** Цена улучшения с уровня `lv` на следующий (в пыли) */
export const relicUpCost = (rarity: RelicRarity, lv: number): number => RARITY[rarity].cost * lv;

export interface OwnedRelic {
  id: string;
  lv: number;
}

/** Резонанс экипированного набора: бонус за сочетание редкостей */
export interface Resonance {
  id: string;
  name: string;
  desc: string;
  perks: Perks;
}

export function resonanceOf(set: OwnedRelic[]): Resonance | null {
  if (set.length < RELIC_SLOTS) return null;
  const rar = set.map((r) => relicDef(r.id)?.rarity).filter((x): x is RelicRarity => !!x);
  if (rar.length < RELIC_SLOTS) return null;
  if (rar.every((r) => r === rar[0])) {
    const p: Record<RelicRarity, Resonance> = {
      rare: { id: "res-rare", name: "Резонанс клинка", desc: "Три редких реликвии: +2% атаки.", perks: { atk: 0.02 } },
      epic: { id: "res-epic", name: "Резонанс бури", desc: "Три эпических реликвии: +3% атаки и +3% здоровья.", perks: { atk: 0.03, hp: 0.03 } },
      legend: { id: "res-legend", name: "Резонанс легенд", desc: "Три легендарных реликвии: +5% атаки, +5% здоровья и +3% крита.", perks: { atk: 0.05, hp: 0.05, crit: 0.03 } },
    };
    return p[rar[0]];
  }
  if (new Set(rar).size === 3) return { id: "res-triad", name: "Триада", desc: "Редкая, эпическая и легендарная: +2% к криту, +2% вампиризма.", perks: { crit: 0.02, vamp: 0.02 } };
  return null;
}

/** Сумма бонусов набора реликвий, резонанса и бустера */
export function perksOfGear(relics: OwnedRelic[], booster?: string): Perks {
  const res = resonanceOf(relics);
  return mergePerks(
    ...relics.map((r) => relicDef(r.id)?.perks(Math.max(1, Math.min(RELIC_MAX, r.lv)))),
    res?.perks,
    booster ? boosterDef(booster)?.perks : undefined,
  );
}

/**
 * Выпадение реликвии. `tier` — индекс лиги (0–5), `r1`/`r2` — случайные числа [0,1).
 * Чем выше лига, тем чаще эпические и легендарные.
 */
export function rollRelic(tier: number, r1: number, r2: number, boost = 0): Relic {
  const legend = Math.min(0.14, 0.015 + tier * 0.012 + boost * 0.05);
  const epic = Math.min(0.42, 0.16 + tier * 0.04 + boost * 0.15);
  const rarity: RelicRarity = r1 < legend ? "legend" : r1 < legend + epic ? "epic" : "rare";
  const pool = RELICS.filter((r) => r.rarity === rarity);
  return pool[Math.floor(r2 * pool.length) % pool.length];
}

/* ------------------------------- Бустеры ------------------------------- */

export interface Booster {
  id: string;
  name: string;
  desc: string;
  /** Цена в пыли */
  cost: number;
  ico: "bolt" | "shield" | "fire" | "target" | "heart";
  perks: Perks;
}

export const BOOSTERS: Booster[] = [
  { id: "b-stim", name: "Боевой стимулятор", desc: "+12% атаки отряда в первые 3 раунда.", cost: 40, ico: "bolt", perks: { burstAtk: 0.12, burstN: 3 } },
  { id: "b-aegis", name: "Щит предков", desc: "Каждый герой начинает бой со щитом 10% здоровья.", cost: 45, ico: "shield", perks: { startShield: 0.1 } },
  { id: "b-surge", name: "Разряд", desc: "Все герои начинают бой с 30 энергии ультимейта.", cost: 55, ico: "fire", perks: { startEn: 30 } },
  { id: "b-focus", name: "Прицел", desc: "+12% к шансу критического удара.", cost: 40, ico: "target", perks: { crit: 0.12 } },
  { id: "b-feather", name: "Перо феникса", desc: "Первый павший герой возвращается с 30% здоровья.", cost: 90, ico: "heart", perks: { revive: 0.3 } },
];

export const boosterDef = (id: string): Booster | undefined => BOOSTERS.find((b) => b.id === id);

/* ---------------------------- Правила дня (арена) ---------------------------- */

export interface ArenaMod {
  id: string;
  name: string;
  desc: string;
  /** Тон оформления: тёплый, холодный, тёмный, светлый */
  tone: "ember" | "frost" | "night" | "holy" | "storm";
  ico: "fire" | "water" | "dark" | "light" | "bolt" | "skull" | "shield" | "heart" | "star" | "target";
  perks: Perks;
}

export const ARENA_MODS: ArenaMod[] = [
  { id: "a-moon", name: "Кровавая луна", desc: "Все бойцы возвращают 14% нанесённого урона здоровьем.", tone: "night", ico: "dark", perks: { vamp: 0.14 } },
  { id: "a-storm", name: "Грозовой день", desc: "+14% шанс крита у всех бойцов.", tone: "storm", ico: "bolt", perks: { crit: 0.14 } },
  { id: "a-calm", name: "Тишина", desc: "Энергия ультимейта копится вдвое медленнее.", tone: "frost", ico: "water", perks: { enMul: -0.5 } },
  { id: "a-charge", name: "Перегрузка", desc: "Энергия ультимейта копится на 60% быстрее.", tone: "storm", ico: "star", perks: { enMul: 0.6 } },
  { id: "a-fragile", name: "Хрупкий мир", desc: "Весь урон +20%: бои короче и жёстче.", tone: "ember", ico: "skull", perks: { dmg: 0.2 } },
  { id: "a-iron", name: "Железная кожа", desc: "Весь урон −15%: решают умения и лечение.", tone: "frost", ico: "shield", perks: { dmg: -0.15 } },
  { id: "a-bless", name: "Благословение света", desc: "Лечение и щиты сильнее на 40%.", tone: "holy", ico: "light", perks: { heal: 0.4, shield: 0.4 } },
  { id: "a-ash", name: "Пепельный ветер", desc: "Горение и яд наносят на 70% больше урона.", tone: "ember", ico: "fire", perks: { dot: 0.7 } },
  { id: "a-hunt", name: "Час охотника", desc: "+30% урона по целям с <35% здоровья, +5% крита.", tone: "night", ico: "target", perks: { exec: 0.3, crit: 0.05 } },
  { id: "a-chaos", name: "Хаос стихий", desc: "Стихийное преимущество +20%, штраф сильнее на 10%.", tone: "holy", ico: "heart", perks: { advUp: 0.2, advDown: -0.1 } },
];

export const arenaDef = (id: string): ArenaMod | undefined => ARENA_MODS.find((m) => m.id === id);

/** Порядковый номер календарного дня по местному времени */
export function dayIndex(ms: number): number {
  const d = new Date(ms);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
}

/** Правило арены на день */
export function arenaOfDay(idx: number): ArenaMod {
  return ARENA_MODS[(((idx * 7 + 3) % ARENA_MODS.length) + ARENA_MODS.length) % ARENA_MODS.length];
}

/* ------------------------- Данные боя для отчёта ------------------------- */

/** Снаряжение стороны, как оно попадает в отчёт и интро-заставку */
export interface GearInfo {
  relics: OwnedRelic[];
  booster?: string;
  resonance?: string;
}

/** Что выпало после боя */
export interface Drops {
  relic?: { id: string; lv: number; dup: boolean; dust: number };
  booster?: string;
}
