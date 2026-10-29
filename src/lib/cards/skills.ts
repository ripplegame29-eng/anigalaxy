/**
 * Умения героев. У каждого героя доступны 5 классовых умений и 2 стихийных;
 * число слотов зависит от ранга. Порядок умений в отряде — их приоритет в бою:
 * в свой ход герой применяет первое готовое умение, иначе бьёт обычной атакой.
 * Общий код сервера, симуляции и интерфейса.
 */

import type { CardClass, Element, Rank } from "./config";

export type SkillTarget = "enemy" | "enemyLow" | "enemies" | "ally" | "allies" | "self";

/** Визуальный эффект каста (CSS-класс `fx-*` в интерфейсе) */
export type SkillFx = "slash" | "whirl" | "pierce" | "burst" | "rain" | "debuff" | "fire" | "drain" | "heal" | "shield" | "buff" | "poison" | "quake" | "taunt" | "ice" | "wind" | "earth" | "beam" | "dark";

export interface Skill {
  id: string;
  name: string;
  desc: string;
  /** Перезарядка в ходах героя */
  cd: number;
  fx: SkillFx;
  target: SkillTarget;
  cls?: CardClass;
  el?: Element;
  /** Урон: множитель атаки */
  power?: number;
  /** Лечение: множитель атаки */
  heal?: number;
  /** Лечение: доля максимального здоровья */
  healPct?: number;
  /** Щит: множитель атаки / доля макс. здоровья (держится 3 раунда) */
  shield?: number;
  shieldPct?: number;
  /** Доля нанесённого урона, возвращаемая лечением */
  drain?: number;
  /** Множитель урона по цели с <35% здоровья */
  exec?: number;
  /** Оглушение, ходов */
  stun?: number;
  /** Поджог/яд: множитель атаки за тик, 3 тика */
  burn?: number;
  /** Снижение защиты цели на долю, 3 раунда */
  defDown?: number;
  /** Усиление атаки на долю, 3 раунда */
  atkUp?: number;
  /** Провокация: враги бьют только этого героя, раундов */
  taunt?: number;
}

const S = (s: Skill): Skill => s;

export const SKILLS: Skill[] = [
  /* Воин */
  S({ id: "w-slash", name: "Рубящий удар", desc: "Мощный удар по врагу: 170% атаки.", cd: 2, fx: "slash", target: "enemy", cls: "warrior", power: 1.7 }),
  S({ id: "w-whirl", name: "Вихрь клинков", desc: "Задевает всех врагов: 80% атаки каждому.", cd: 3, fx: "whirl", target: "enemies", cls: "warrior", power: 0.8 }),
  S({ id: "w-finish", name: "Добивание", desc: "140% атаки, вдвое больше по врагу с <35% здоровья.", cd: 3, fx: "pierce", target: "enemyLow", cls: "warrior", power: 1.4, exec: 2 }),
  S({ id: "w-cry", name: "Боевой клич", desc: "Вся команда получает +20% к атаке на 3 раунда.", cd: 4, fx: "buff", target: "allies", cls: "warrior", atkUp: 0.2 }),
  S({ id: "w-stun", name: "Оглушающий удар", desc: "120% атаки и оглушение: враг пропускает ход.", cd: 4, fx: "quake", target: "enemy", cls: "warrior", power: 1.2, stun: 1 }),
  /* Маг */
  S({ id: "m-fireball", name: "Огненный шар", desc: "Взрыв по самому слабому врагу: 180% атаки.", cd: 2, fx: "burst", target: "enemyLow", cls: "mage", power: 1.8 }),
  S({ id: "m-rain", name: "Ледяной дождь", desc: "Осколки льда по всем врагам: 75% атаки.", cd: 3, fx: "rain", target: "enemies", cls: "mage", power: 0.75 }),
  S({ id: "m-curse", name: "Проклятие слабости", desc: "80% атаки и −30% защиты цели на 3 раунда.", cd: 3, fx: "debuff", target: "enemy", cls: "mage", power: 0.8, defDown: 0.3 }),
  S({ id: "m-mark", name: "Горящая метка", desc: "Поджигает врага: 3 тика по 45% атаки.", cd: 3, fx: "fire", target: "enemy", cls: "mage", burn: 0.45 }),
  S({ id: "m-drain", name: "Поглощение силы", desc: "130% атаки, 60% урона возвращается лечением.", cd: 3, fx: "drain", target: "enemy", cls: "mage", power: 1.3, drain: 0.6 }),
  /* Страж */
  S({ id: "t-bastion", name: "Щит бастиона", desc: "Щит на 28% максимального здоровья на 3 раунда.", cd: 4, fx: "shield", target: "self", cls: "tank", shieldPct: 0.28 }),
  S({ id: "t-crush", name: "Сокрушающий удар", desc: "Тяжёлый удар: 140% атаки.", cd: 2, fx: "quake", target: "enemy", cls: "tank", power: 1.4 }),
  S({ id: "t-taunt", name: "Провокация", desc: "Враги бьют только вас 2 раунда, щит 12% здоровья.", cd: 4, fx: "taunt", target: "self", cls: "tank", taunt: 2, shieldPct: 0.12 }),
  S({ id: "t-counter", name: "Ударная волна", desc: "Волна по всем врагам: 60% атаки.", cd: 3, fx: "whirl", target: "enemies", cls: "tank", power: 0.6 }),
  S({ id: "t-will", name: "Железная воля", desc: "Восстанавливает 22% максимального здоровья.", cd: 4, fx: "heal", target: "self", cls: "tank", healPct: 0.22 }),
  /* Убийца */
  S({ id: "a-backstab", name: "Удар в спину", desc: "Бьёт слабейшего врага: 200% атаки.", cd: 3, fx: "pierce", target: "enemyLow", cls: "assassin", power: 2 }),
  S({ id: "a-blades", name: "Град клинков", desc: "Клинки по всем врагам: 70% атаки.", cd: 3, fx: "whirl", target: "enemies", cls: "assassin", power: 0.7 }),
  S({ id: "a-venom", name: "Яд", desc: "Отравляет врага: 3 тика по 40% атаки.", cd: 2, fx: "poison", target: "enemy", cls: "assassin", burn: 0.4 }),
  S({ id: "a-shadow", name: "Тень", desc: "+40% к собственной атаке на 3 раунда.", cd: 4, fx: "buff", target: "self", cls: "assassin", atkUp: 0.4 }),
  S({ id: "a-sting", name: "Парализующий укол", desc: "100% атаки и оглушение на ход.", cd: 4, fx: "pierce", target: "enemy", cls: "assassin", power: 1, stun: 1 }),
  /* Хилер */
  S({ id: "s-heal", name: "Лечение", desc: "Исцеляет самого раненого союзника: 140% атаки.", cd: 2, fx: "heal", target: "ally", cls: "support", heal: 1.4 }),
  S({ id: "s-wave", name: "Волна исцеления", desc: "Лечит всю команду: 70% атаки каждому.", cd: 4, fx: "heal", target: "allies", cls: "support", heal: 0.7 }),
  S({ id: "s-aegis", name: "Щит света", desc: "Щит на раненого союзника: 150% атаки, 3 раунда.", cd: 3, fx: "shield", target: "ally", cls: "support", shield: 1.5 }),
  S({ id: "s-bless", name: "Благословение", desc: "Вся команда получает +20% к атаке на 3 раунда.", cd: 4, fx: "buff", target: "allies", cls: "support", atkUp: 0.2 }),
  S({ id: "s-smite", name: "Священный свет", desc: "Луч света по врагу: 140% атаки.", cd: 3, fx: "beam", target: "enemy", cls: "support", power: 1.4 }),
  /* Стихии */
  S({ id: "e-fire1", name: "Пламя феникса", desc: "190% атаки и ожог на 3 тика по 30%.", cd: 4, fx: "fire", target: "enemy", el: "fire", power: 1.9, burn: 0.3 }),
  S({ id: "e-fire2", name: "Огненная буря", desc: "Пламя по всем врагам: 80% атаки.", cd: 4, fx: "burst", target: "enemies", el: "fire", power: 0.8 }),
  S({ id: "e-water1", name: "Приливная волна", desc: "Волна по всем врагам: 80% атаки.", cd: 4, fx: "rain", target: "enemies", el: "water", power: 0.8 }),
  S({ id: "e-water2", name: "Ледяные оковы", desc: "100% атаки и оглушение на ход.", cd: 4, fx: "ice", target: "enemy", el: "water", power: 1, stun: 1 }),
  S({ id: "e-wind1", name: "Режущий вихрь", desc: "Вихрь по всем врагам: 80% атаки.", cd: 3, fx: "wind", target: "enemies", el: "wind", power: 0.8 }),
  S({ id: "e-wind2", name: "Попутный ветер", desc: "Вся команда получает +25% к атаке на 3 раунда.", cd: 4, fx: "wind", target: "allies", el: "wind", atkUp: 0.25 }),
  S({ id: "e-earth1", name: "Каменный шип", desc: "Шип из земли: 170% атаки.", cd: 2, fx: "earth", target: "enemy", el: "earth", power: 1.7 }),
  S({ id: "e-earth2", name: "Каменная кожа", desc: "Щит на 25% максимального здоровья, 3 раунда.", cd: 4, fx: "shield", target: "self", el: "earth", shieldPct: 0.25 }),
  S({ id: "e-light1", name: "Луч рассвета", desc: "Бьёт слабейшего врага: 180% атаки.", cd: 3, fx: "beam", target: "enemyLow", el: "light", power: 1.8 }),
  S({ id: "e-light2", name: "Свет надежды", desc: "Лечит всю команду: 60% атаки каждому.", cd: 4, fx: "heal", target: "allies", el: "light", heal: 0.6 }),
  S({ id: "e-dark1", name: "Клинок тьмы", desc: "200% атаки, 30% урона возвращается лечением.", cd: 3, fx: "dark", target: "enemy", el: "dark", power: 2, drain: 0.3 }),
  S({ id: "e-dark2", name: "Бездна", desc: "Тьма разъедает врага: −25% защиты и ожог на 3 тика по 35%.", cd: 3, fx: "dark", target: "enemy", el: "dark", defDown: 0.25, burn: 0.35 }),
];

const BY_ID = new Map(SKILLS.map((s) => [s.id, s]));
export const skillDef = (id: string): Skill | undefined => BY_ID.get(id);

/* ------------------------------ Ультимейты ------------------------------- */

/** Энергия для ультимейта и её приток */
export const ENERGY = { max: 100, perTurn: 18, perHit: 12 } as const;

const U = (id: string, name: string, desc: string, fx: SkillFx, rest: Partial<Skill> & Pick<Skill, "target" | "cls">): Skill => S({ id, name, desc, cd: 0, fx, ...rest });

/** Ультимейт класса: срабатывает сам, когда шкала энергии полна */
export const ULTIMATES: Record<CardClass, Skill> = {
  warrior: U("u-warrior", "Крушение небес", "Удар по всем врагам: 150% атаки и −20% защиты на 3 раунда.", "slash", { target: "enemies", cls: "warrior", power: 1.5, defDown: 0.2 }),
  mage: U("u-mage", "Падение метеоритов", "Метеориты по всем врагам: 170% атаки и ожог (3 тика по 30%).", "burst", { target: "enemies", cls: "mage", power: 1.7, burn: 0.3 }),
  tank: U("u-tank", "Несокрушимый бастион", "Щит всей команде на 25% максимального здоровья на 3 раунда.", "shield", { target: "allies", cls: "tank", shieldPct: 0.25 }),
  assassin: U("u-assassin", "Танец теней", "Серия ударов по слабейшему врагу: 340% атаки, вдвое больше при <35% здоровья.", "pierce", { target: "enemyLow", cls: "assassin", power: 3.4, exec: 1.5 }),
  support: U("u-support", "Дар жизни", "Лечит всю команду на 35% здоровья и даёт +25% к атаке на 3 раунда.", "heal", { target: "allies", cls: "support", healPct: 0.35, atkUp: 0.25 }),
};

/* -------------------------------- Пассивки -------------------------------- */

export interface Passive {
  id: string;
  name: string;
  desc: string;
  fx: SkillFx;
  minRank: number;
}

export const PASSIVES: Passive[] = [
  { id: "p-vigor", name: "Крепость", desc: "+12% к максимальному здоровью.", fx: "heal", minRank: 0 },
  { id: "p-edge", name: "Острие", desc: "+10% к атаке.", fx: "slash", minRank: 0 },
  { id: "p-bulwark", name: "Броня", desc: "+18% к защите.", fx: "shield", minRank: 0 },
  { id: "p-swift", name: "Стремительность", desc: "+20% к скорости, бой начинается с 30 энергии.", fx: "wind", minRank: 0 },
  { id: "p-vamp", name: "Кровожадность", desc: "Обычные атаки лечат на 20% нанесённого урона.", fx: "drain", minRank: 1 },
  { id: "p-thorns", name: "Шипы", desc: "Возвращает атакующему 15% полученного урона.", fx: "earth", minRank: 1 },
  { id: "p-focus", name: "Фокус", desc: "+12% к шансу критического удара.", fx: "beam", minRank: 1 },
  { id: "p-flow", name: "Поток силы", desc: "+8 энергии каждый ход: ультимейт быстрее.", fx: "buff", minRank: 2 },
  { id: "p-revive", name: "Второе дыхание", desc: "Раз за бой: вместо гибели герой восстанавливает 30% здоровья.", fx: "beam", minRank: 3 },
];
const PASSIVE_BY_ID = new Map(PASSIVES.map((p) => [p.id, p]));
export const passiveDef = (id: string | undefined): Passive | undefined => (id ? PASSIVE_BY_ID.get(id) : undefined);

/** Пассивка по умолчанию — по классу */
export const defaultPassive = (cls: CardClass): string => ({ warrior: "p-edge", mage: "p-flow", tank: "p-bulwark", assassin: "p-focus", support: "p-vigor" })[cls];

export const passivesFor = (rank: number): Passive[] => PASSIVES.filter((p) => p.minRank <= rank);

export function validatePassive(id: string, rank: number): string {
  const p = passiveDef(id);
  if (!p) return "Нет такой пассивки";
  return p.minRank > rank ? "Пассивка недоступна для этого ранга" : "";
}

/* ----------------------------- Прокачка умений ---------------------------- */

export const SKILL_MAX_LEVEL = 5;
/** Прирост силы умения за уровень (урон, лечение, щиты, горение) */
export const SKILL_LEVEL_BONUS = 0.1;

/** Цена перехода с уровня `lv` на `lv+1`: пыль и свитки ранга героя (свитки с 3-го уровня) */
export function skillUpCost(rank: number, lv: number): { dust: number; scroll: number } {
  const base = [12, 30, 70, 150, 320][Math.max(0, Math.min(4, rank))];
  return { dust: base * lv * lv, scroll: lv >= 3 ? 1 : 0 };
}

/** Умение с учётом уровня: сила растёт, на максимуме перезарядка короче на 1 ход */
export function levelled(sk: Skill, lv: number): Skill {
  const l = Math.max(1, Math.min(SKILL_MAX_LEVEL, Math.floor(lv) || 1));
  if (l === 1) return sk;
  const m = 1 + SKILL_LEVEL_BONUS * (l - 1);
  const o: Skill = { ...sk };
  for (const k of ["power", "heal", "healPct", "shield", "shieldPct", "burn"] as const) if (o[k]) o[k] = Math.round((o[k] as number) * m * 100) / 100;
  if (l >= SKILL_MAX_LEVEL && o.cd > 1) o.cd -= 1;
  return o;
}

for (const u of Object.values(ULTIMATES)) BY_ID.set(u.id, u);

/** Сколько умений можно экипировать по рангу */
export const SKILL_SLOTS: Record<Rank, number> = { 0: 1, 1: 2, 2: 2, 3: 3, 4: 3 };

export const slotsOf = (rank: number): number => SKILL_SLOTS[rank as Rank] ?? 1;

/** Все умения, доступные герою: 5 классовых и 2 стихийных */
export function skillPool(cls: CardClass, element: Element): Skill[] {
  return [...SKILLS.filter((s) => s.cls === cls), ...SKILLS.filter((s) => s.el === element)];
}

/** Набор по умолчанию: первое классовое, первое стихийное, второе классовое */
export function defaultLoadout(cls: CardClass, element: Element, rank: number): string[] {
  const pool = skillPool(cls, element);
  const c = pool.filter((s) => s.cls);
  const e = pool.filter((s) => s.el);
  return [c[0], e[0], c[1]].filter(Boolean).map((s) => s.id).slice(0, slotsOf(rank));
}

/** Проверка выбора игрока; пустая строка — всё в порядке */
export function validateLoadout(ids: string[], cls: CardClass, element: Element, rank: number): string {
  if (!ids.length) return "Выберите хотя бы одно умение";
  if (ids.length > slotsOf(rank)) return `Для этого ранга доступно слотов: ${slotsOf(rank)}`;
  if (new Set(ids).size !== ids.length) return "Умения не должны повторяться";
  const pool = new Set(skillPool(cls, element).map((s) => s.id));
  return ids.every((id) => pool.has(id)) ? "" : "Это умение недоступно герою";
}
