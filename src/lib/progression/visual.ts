/**
 * Чистые хелперы визуального слоя (§11, FIX_TAGS).
 *
 * Вынесены из компонентов намеренно: правило `react-hooks/purity` запрещает
 * `Math.*`/`Date.now()` прямо в JSX-рендере, а чистые функции здесь же
 * покрываются юнит-тестами (детерминированные частицы, полосы ступеней).
 *
 * Тег-капсула: палитра `--c/--c2` из конфига + библиотека эффектов
 * `app/ag-tag.css`. Итоговый набор эффектов = то, что указано в теге,
 * объединённое с «полом редкости» (FIX §4): у COMMON скромно, у MYTHIC —
 * максимум, у SECRET — свой глитч-набор.
 */

import type { Rarity, TagDef } from "./types";

/* ------------------------------ Редкость -------------------------------- */

export const RARITY_WEIGHT: Record<Rarity, number> = {
  COMMON: 0,
  UNCOMMON: 1,
  RARE: 2,
  EPIC: 3,
  LEGENDARY: 4,
  MYTHIC: 5,
  SECRET: 6,
};

export const RARITY_LABEL: Record<Rarity, string> = {
  COMMON: "Обычный",
  UNCOMMON: "Необычный",
  RARE: "Редкий",
  EPIC: "Эпический",
  LEGENDARY: "Легендарный",
  MYTHIC: "Мифический",
  SECRET: "Секрет",
};

/** Минимум эффектов по редкости (FIX §4: чем выше редкость, тем больше слоёв) */
export const RARITY_FLOOR: Record<Rarity, string[]> = {
  // обычная капсула: медленная бегущая рамка + мягкое свечение
  COMMON: ["border", "pulse"],
  // + блик-проход
  UNCOMMON: ["border", "pulse", "shine"],
  // + уголки-«прицела» + иконка в кадре
  RARE: ["border", "pulse", "shine", "brackets", "icon"],
  // + свои частицы (10) и ускоренная рамка (--spin: 3s)
  EPIC: ["border", "pulse", "shine", "brackets", "icon", "sparks"],
  // + аура и двойная рамка
  LEGENDARY: ["border", "pulse", "shine", "brackets", "icon", "sparks", "aura", "double"],
  // всё вышеперечисленное + вход в кадр, рамка бежит за 2s
  MYTHIC: [
    "border",
    "pulse",
    "shine",
    "brackets",
    "icon",
    "sparks",
    "aura",
    "double",
    "enter",
  ],
  // секрет: моно/неон, глитч, искры (количество эффектов своё — 4)
  SECRET: ["border", "pulse", "glitch", "sparks"],
};

/**
 * Скорость бегущей conic-рамки (--spin) по редкости (FIX §4):
 * COMMON 8s — тихо, EPIC 3s, MYTHIC 2s — максимально быстро.
 */
const RARITY_SPIN: Record<Rarity, string> = {
  COMMON: "8s",
  UNCOMMON: "6s",
  RARE: "5s",
  EPIC: "3s",
  LEGENDARY: "2.5s",
  MYTHIC: "2s",
  SECRET: "4s",
};

/** Значение `--spin` для инлайн-стиля капсулы */
export function spinFor(rarity: string): string {
  return isRarity(rarity) ? RARITY_SPIN[rarity] : "2.4s";
}

/** Бюджет частиц на предмет: ≤16 (§11) */
const PARTICLE_BUDGET: Record<Rarity, number> = {
  COMMON: 0,
  // у ниже-EPIC частицы даются только тем тегам, что сами просят `sparks`
  // (Тэнгу «перья-частицы», Вампир «капли», Каге «дым») — допущение §13
  UNCOMMON: 4,
  RARE: 6,
  EPIC: 10,
  LEGENDARY: 14,
  MYTHIC: 16,
  // SECRET по FIX §4 — 8 (ниже общего лимита 16)
  SECRET: 8,
};

export function isRarity(value: string): value is Rarity {
  return value in RARITY_WEIGHT;
}

/** Итоговый набор эффектов капсулы: конфиг тега + порог редкости */
export function effectSet(tag: TagDef): string[] {
  const own = tag.visual.effects;
  const hasBackdrop = own.some((e) => e.startsWith("backdrop-"));
  const floor = isRarity(tag.rarity)
    ? RARITY_FLOOR[tag.rarity].filter(
        // у тега один фоновый слой: свой важнее общего из пола редкости
        (e) => !(e.startsWith("backdrop-") && hasBackdrop),
      )
    : [];
  return [...new Set([...own, ...floor])];
}

/** Сколько частиц рисовать для тега (детерминированно по редкости) */
export function particleBudget(rarity: string): number {
  return isRarity(rarity) ? PARTICLE_BUDGET[rarity] : 0;
}

/**
 * Фактическое число частиц тега (FIX §4): частицы рисуются, только если
 * `sparks` попал в итоговый набор (пол редкости или явный запрос тега).
 * В размере `sm` (меню, комментарии, тост) частиц нет вовсе — см. компонент.
 */
export function sparkCount(tag: TagDef): number {
  if (!effectSet(tag).includes("sparks")) return 0;
  return particleBudget(tag.rarity);
}

/** Вес для сортировки «самое редкое» (больше = реже) */
export function rarityWeight(rarity: string): number {
  return isRarity(rarity) ? RARITY_WEIGHT[rarity] : -1;
}

/* ----------------------------- Ступени ---------------------------------- */

const ROMAN = [
  "",
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
] as const;

/** Ступень внутри семейства → римская цифра (1..10) */
export function romanTier(tier: number): string {
  const value = Math.round(tier);
  if (value < 1) return "I";
  if (value > ROMAN.length - 1) return ROMAN[ROMAN.length - 1];
  return ROMAN[value];
}

/**
 * Цветовая полоса ступени (§11): I–III зелёный, IV–VI синий,
 * VII–VIII фиолетовый, IX–X золотой.
 */
export function tierBand(tier: number): 1 | 2 | 3 | 4 {
  if (tier <= 3) return 1;
  if (tier <= 6) return 2;
  if (tier <= 8) return 3;
  return 4;
}

/* ----------------------------- Частицы ---------------------------------- */

export interface Particle {
  /** Позиция внутри предмета, % */
  x: number;
  y: number;
  /** Задержка старта, с */
  delay: number;
  /** Длительность полёта, с */
  duration: number;
  /** Размер точки, px */
  size: number;
}

/** FNV-1a: стабильный хэш строки (одинаковый на сервере и клиенте) */
function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: маленький детерминированный ГПСЧ (без Math.random) */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Случайные CSS-переменные частиц: их ставит JS (§11), но значения
 * детерминированы от id тега — рендер на сервере и клиенте совпадает.
 */
export function particlesFor(seed: string, count: number): Particle[] {
  const rand = mulberry32(hashSeed(seed));
  const out: Particle[] = [];
  const n = Math.max(0, Math.min(16, Math.round(count)));
  for (let i = 0; i < n; i += 1) {
    out.push({
      x: Math.round(rand() * 1000) / 10,
      y: Math.round(rand() * 1000) / 10,
      delay: Math.round(rand() * 40) / 10,
      duration: 24 + Math.round(rand() * 30) / 10,
      size: 1 + Math.round(rand() * 20) / 10,
    });
  }
  return out;
}
