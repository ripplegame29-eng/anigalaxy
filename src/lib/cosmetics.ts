/**
 * Косметика профиля: фоны баннера, титулы и рамки аватара.
 *
 * Каталог локальный: предметы открываются по уровню, достижению, Premium
 * или покупке за монеты — без сервера и без чужих ассетов, фоны рисуются
 * CSS-градиентами прямо здесь.
 *
 * Титулы рисуются единой тег-капсулой `ag-tag` (FIX_TAGS §2): у каждого —
 * своя двухцветная палитра, ручная иконка 24×24 и эффект, рендер через
 * `titleTag()` → `<AgTag />`. Плоских одноцветных плашек больше нет.
 */

import type { Rarity as TagRarity, TagDef, TagVisual } from "./progression/types";
import { GUILD_FRAMES } from "./guild-cosmetics";

export type Rarity = "common" | "rare" | "epic" | "legendary";

export interface Unlock {
  /** Открывается на этом уровне */
  level?: number;
  /** Открывается этим достижением */
  achievement?: string;
  /** Нужна активная подписка */
  premium?: boolean;
  /** Цена в монетах (покупка в магазине) */
  price?: number;
  /** Открывается за N приглашённых друзей (рубеж реферальной программы) */
  referral?: number;
}

export interface BackgroundItem {
  id: string;
  name: string;
  rarity: Rarity;
  /** CSS-значение background для баннера */
  css: string;
  unlock: Unlock;
  /** Явный background-size (сетки/узоры, которым нужно тайлинг) */
  backgroundSize?: string;
}

export interface TitleItem {
  id: string;
  name: string;
  rarity: Rarity;
  /** Чем подсвечивается титул у ника (дублирует `visual.c` для чипов) */
  color: string;
  unlock: Unlock;
  /** Короткое описание для витрины/магазина */
  description: string;
  /** Визуал капсулы `ag-tag`: палитра, эффекты, ручная иконка 24×24 */
  visual: TagVisual;
}

export interface FrameItem {
  id: string;
  name: string;
  rarity: Rarity;
  /** CSS-градиент ободка (простые рамки) */
  css?: string;
  /** SVG-оверлей поверх аватара (`/frames/…`), со своей анимацией внутри */
  img?: string;
  /**
   * Во сколько раз картинка рамки больше аватара. Не задаётся — 1.3, как у
   * рамок из public/frames (файлы 512×512 рассчитаны на круг ~77% кадра).
   * Нужен рамкам из макетов премиум-рамок: в проекте круг аватара занимает
   * 38.5% ширины картинки, а в макетах — около 26%, и без масштаба венок
   * уезжал под аватар.
   */
  scale?: number;
  /**
   * Рисунок шире обычного холста (у серафимов крылья выходят за 240
   * единиц). Таким рамкам карточка в магазине нужна шире — см. ags-card-wide.
   */
  wide?: boolean;
  unlock: Unlock;
}

export const RARITY_LABEL: Record<Rarity, string> = {
  common: "Обычный",
  rare: "Редкий",
  epic: "Эпический",
  legendary: "Легендарный",
};

export const RARITY_CLASS: Record<Rarity, string> = {
  common: "bg-white/8 text-white/70 ring-white/15",
  rare: "bg-sky-400/15 text-sky-300 ring-sky-400/30",
  epic: "bg-violet-400/15 text-violet-300 ring-violet-400/30",
  legendary: "bg-amber-400/15 text-amber-300 ring-amber-400/30",
};

/* ------------------------------- Фоны ---------------------------------- */

export const BACKGROUNDS: BackgroundItem[] = [
  {
    id: "preset-dusk",
    name: "Синий закат",
    rarity: "common",
    css: "linear-gradient(120deg,#04264f 0%,#0b57d0 45%,#00c8ff 100%)",
    unlock: {},
  },
  {
    id: "preset-violet",
    name: "Фиолетовый закат",
    rarity: "common",
    css: "linear-gradient(120deg,#2a0a4a 0%,#6d28d9 50%,#f472b6 100%)",
    unlock: {},
  },
  {
    id: "preset-space",
    name: "Космос",
    rarity: "rare",
    css: "radial-gradient(120% 140% at 20% 0%,#1e3a8a 0%,#0b1026 55%,#05060f 100%)",
    unlock: { level: 3 },
  },
  {
    id: "preset-neon",
    name: "Неон",
    rarity: "rare",
    css: "linear-gradient(135deg,#05060f 0%,#0ea5e9 45%,#22d3ee 70%,#05060f 100%)",
    unlock: { price: 800 },
  },
  {
    id: "preset-sakura",
    name: "Сакура",
    rarity: "rare",
    css: "linear-gradient(120deg,#3b0d2a 0%,#be185d 55%,#fbcfe8 100%)",
    unlock: { price: 1000 },
  },
  {
    id: "preset-cybergrid",
    name: "Кибер-сетка",
    rarity: "epic",
    css: "linear-gradient(rgba(14,165,233,.16) 1px,transparent 1px),linear-gradient(90deg,rgba(14,165,233,.16) 1px,transparent 1px),radial-gradient(120% 120% at 50% 0%,#0b57d0 0%,#05060f 70%)",
    unlock: { price: 1500 },
    /** Размер сетки в фоне баннера */
    backgroundSize: "34px 34px,34px 34px,cover",
  },
  {
    id: "preset-nova",
    name: "Нова",
    rarity: "legendary",
    css: "radial-gradient(circle at 28% 18%,#7c3aed 0%,#1e3a8a 38%,#0b1026 72%,#05060f 100%)",
    unlock: { price: 3000 },
  },
  {
    id: "preset-wave",
    name: "Аниме-волна",
    rarity: "epic",
    css: "conic-gradient(from 210deg at 30% 20%,#0b57d0,#00c8ff,#7c3aed,#0b57d0)",
    unlock: { level: 6 },
  },
  {
    id: "preset-aurora",
    name: "Северное сияние",
    rarity: "epic",
    css: "linear-gradient(160deg,#020617 0%,#065f46 40%,#22d3ee 75%,#020617 100%)",
    unlock: { achievement: "showcase" },
  },
  {
    id: "preset-abyss",
    name: "Бездна",
    rarity: "legendary",
    css: "radial-gradient(100% 120% at 80% 10%,#312e81 0%,#111827 50%,#000000 100%)",
    unlock: { level: 10 },
  },
];

/* ------------------------------ Титулы ---------------------------------- */

/**
 * У каждого титула — своя палитра (`visual.c`/`visual.c2`), свой эффект
 * из библиотеки `ag-tag.css` и своя ручная иконка 24×24 (stroke, без
 * заливки): титулы соседствуют с тегами прогрессии и обязаны выглядеть
 * так же богато. Эффект здесь — «собственный», он складывается с полом
 * редкости (см. `titleTag`).
 */
export const TITLES: TitleItem[] = [
  {
    id: "t-newbie",
    name: "Новичок",
    rarity: "common",
    color: "#93c5fd",
    unlock: {},
    description: "Знак первых шагов в AniGalaxy — всё ещё впереди",
    visual: {
      c: "#93c5fd",
      c2: "#1e3a8a",
      effects: ["shine"],
      text: "plain",
      // росток
      icon: `<path d="M12 21v-8.5"/><path d="M12 12.5c0-3.8 3-6.5 8-6.5 0 4-3 6.5-8 6.5z"/><path d="M12 12.5c0-2.8-2.4-4.8-6-4.8 0 3 2.4 4.8 6 4.8z"/>`,
    },
  },
  {
    id: "t-first",
    name: "Первый шаг",
    rarity: "common",
    color: "#a5b4fc",
    unlock: { achievement: "watch-1" },
    description: "Первый просмотренный тайтл: путь начался",
    visual: {
      c: "#a5b4fc",
      c2: "#312e81",
      effects: ["shine"],
      text: "plain",
      // флажок
      icon: `<path d="M6 21V4"/><path d="M6 5h11.5L15 8.5l2.5 3.5H6"/>`,
    },
  },
  {
    id: "t-curator",
    name: "Куратор",
    rarity: "common",
    color: "#67e8f9",
    unlock: { achievement: "collection-1" },
    description: "Первая собственная подборка в коллекции",
    visual: {
      c: "#67e8f9",
      c2: "#155e75",
      effects: ["shine"],
      text: "plain",
      // список с маркерами
      icon: `<circle cx="4.5" cy="6" r="1.3"/><circle cx="4.5" cy="12" r="1.3"/><circle cx="4.5" cy="18" r="1.3"/><path d="M9 6h11M9 12h11M9 18h11"/>`,
    },
  },
  {
    id: "t-marathon",
    name: "Марафонец",
    rarity: "rare",
    color: "#38bdf8",
    unlock: { achievement: "minutes-300" },
    description: "300 минут просмотра — темп уже не сбить",
    visual: {
      c: "#38bdf8",
      c2: "#0c4a6e",
      effects: ["border-blade"],
      text: "neon",
      // двойной шеврон «вперёд»
      icon: `<path d="M4.5 5.5 11 12l-6.5 6.5"/><path d="M12 5.5 18.5 12 12 18.5"/>`,
    },
  },
  {
    id: "t-binge",
    name: "Поглощатель",
    rarity: "rare",
    color: "#f0abfc",
    unlock: { achievement: "episodes-25" },
    description: "25 серий подряд — остановиться было невозможно",
    visual: {
      c: "#f0abfc",
      c2: "#701a75",
      effects: ["mist"],
      text: "neon",
      // play в кольце
      icon: `<circle cx="12" cy="12" r="8.4"/><path d="M10.2 8.6l5.3 3.4-5.3 3.4z"/>`,
    },
  },
  {
    id: "t-zen",
    name: "Знаток",
    rarity: "rare",
    color: "#5eead4",
    unlock: { level: 5 },
    description: "Пятый уровень: вкус сформирован, списки выверены",
    visual: {
      c: "#5eead4",
      c2: "#134e4a",
      effects: ["runes"],
      text: "plain",
      // открытая книга
      icon: `<path d="M12 6.2C10 4.7 7.6 4.2 4 4.2v13.6c3.6 0 6 .5 8 2 2-1.5 4.4-2 8-2V4.2c-3.6 0-6 .5-8 2z"/><path d="M12 6.2v13.6"/>`,
    },
  },
  {
    id: "t-premium",
    name: "Меценат",
    rarity: "epic",
    color: "#fcd34d",
    unlock: { premium: true },
    description: "Поддержка проекта подпиской Premium",
    visual: {
      c: "#fcd34d",
      c2: "#78350f",
      effects: ["double"],
      text: "metal",
      // корона
      icon: `<path d="M3.5 18h17"/><path d="M3.5 18 2.5 8.7 8 12.4 12 5.6l4 6.8 5.5-3.7-1 9.3z"/>`,
    },
  },
  {
    id: "t-curator5",
    name: "Хранитель подборок",
    rarity: "epic",
    color: "#c4b5fd",
    unlock: { achievement: "collections-5" },
    description: "Пять подборок под надёжной охраной",
    visual: {
      c: "#c4b5fd",
      c2: "#4c1d95",
      effects: ["orbit"],
      text: "plain",
      // слои
      icon: `<path d="M12 3.5l8.5 4.7L12 12.9 3.5 8.2z"/><path d="m4.5 12.4 7.5 4.1 7.5-4.1"/><path d="m4.5 16.6 7.5 4.1 7.5-4.1"/>`,
    },
  },
  {
    id: "t-archivist",
    name: "Архивариус",
    rarity: "epic",
    color: "#7dd3fc",
    unlock: { achievement: "titles-10" },
    description: "Десять тайтлов в коллекции — порядок наведён",
    visual: {
      c: "#7dd3fc",
      c2: "#1e3a5f",
      effects: ["backdrop-grid"],
      text: "plain",
      // архивный ящик
      icon: `<rect x="3.5" y="4.5" width="17" height="4.6" rx="1"/><path d="M5 9.1V19.5h14V9.1"/><path d="M10 13.4h4"/>`,
    },
  },
  {
    id: "t-veteran",
    name: "Ветеран сезона",
    rarity: "legendary",
    color: "#fda4af",
    unlock: { level: 20 },
    description: "Двадцатый уровень: сезоны сменяются — он остаётся",
    visual: {
      c: "#fda4af",
      c2: "#881337",
      effects: ["aura"],
      text: "neon",
      // медаль с лентами
      icon: `<circle cx="12" cy="14.6" r="4.4"/><path d="M8.7 10.9 5.2 3.5h4.6L12 8.2l2.2-4.7h4.6l-3.5 7.4"/>`,
    },
  },
  {
    id: "t-legend",
    name: "Легенда AniGalaxy",
    rarity: "legendary",
    color: "#fde68a",
    unlock: { achievement: "level-10" },
    description: "Десятый уровень. Легенда этого каталога",
    visual: {
      c: "#fde68a",
      c2: "#713f12",
      effects: ["flame"],
      text: "metal",
      // звезда
      icon: `<path d="m12 3.4 2.6 5.5 6 .7-4.4 4.1 1.2 5.9-5.4-3-5.4 3 1.2-5.9-4.4-4.1 6-.7z"/>`,
    },
  },
  {
    // Отдельный знак поддержки проекта — красный стиль (§FIX-запрос)
    id: "t-donater",
    name: "Donater",
    rarity: "epic",
    color: "#ff5c5c",
    unlock: { premium: true },
    description: "Особый красный знак поддержки проекта",
    visual: {
      c: "#ff5c5c",
      c2: "#7f1d1d",
      effects: ["flame"],
      text: "neon",
      // сердце
      icon: `<path d="M12 20.4C7.1 16.4 3.6 13.2 3.6 9.6 3.6 7.1 5.6 5.1 8 5.1c1.6 0 3.1.8 4 2.1.9-1.3 2.4-2.1 4-2.1 2.4 0 4.4 2 4.4 4.5 0 3.6-3.5 6.8-8.4 10.8z"/>`,
    },
  },
];

export { GUILD_TITLES } from "./guild-cosmetics";

/** Шкала редкости косметики (4 ступени) → шкала тегов прогрессии (7) */
const TITLE_TAG_RARITY: Record<Rarity, TagRarity> = {
  common: "COMMON",
  rare: "RARE",
  epic: "EPIC",
  legendary: "LEGENDARY",
};

/**
 * Титул косметики как тег-капсула: единый рендер `<AgTag />` (FIX_TAGS §2).
 * Пол редкости докидывает эффекты сам (см. `RARITY_FLOOR`), здесь — только
 * данные предмета. Хранилище и условия открытия остаются косметическими
 * (`titleId` в профиле), конвертер меняет лишь слой отображения.
 */
export function titleTag(item: TitleItem): TagDef {
  return {
    id: `title_${item.id}`,
    name: item.name,
    description: item.description,
    rarity: TITLE_TAG_RARITY[item.rarity],
    source: "achievement",
    visual: item.visual,
  };
}

/* ------------------------------ Рамки ----------------------------------- */

/**
 * Рамки — готовые анимированные SVG-оверлеи (`public/frames/*.svg`, 512×512,
 * прозрачный центр, своя анимация + поддержка reduced-motion внутри файла).
 * Рендерятся поверх аватара (`AvatarView`), в витрине и магазине — тем же
 * оверлеем. Прежние градиентные ободки заменены этим набором (§15.1).
 */
export const FRAMES: FrameItem[] = [
  { id: "f-none", name: "Без рамки", rarity: "common", css: "", unlock: {} },
  /* — common — */
  { id: "frame-22", name: "Шаринган", rarity: "common", img: "/frames/frame-22.svg?v=2", unlock: {} },
  { id: "frame-33", name: "Мангекё", rarity: "common", img: "/frames/frame-33.svg?v=2", unlock: {} },
  { id: "frame-10", name: "Энсо-самурай", rarity: "common", img: "/frames/frame-10.svg?v=2", unlock: {} },
  { id: "frame-32", name: "Шаринган", rarity: "common", img: "/frames/frame-32.svg?v=2", unlock: { level: 2 } },
  { id: "frame-38", name: "Шаринган 1→2→3", rarity: "common", img: "/frames/frame-38.svg?v=2", unlock: { level: 3 } },
  { id: "frame-39", name: "Шаринган → Мангекё", rarity: "common", img: "/frames/frame-39.svg?v=2", unlock: { level: 3 } },
  { id: "frame-28", name: "Щит АТ-поля", rarity: "common", img: "/frames/frame-28.svg?v=2", unlock: { level: 5 } },
  /* — rare — */
  { id: "frame-05", name: "Цепи и замок", rarity: "rare", img: "/frames/frame-05.svg?v=2", unlock: { level: 4 } },
  { id: "frame-08", name: "Фонк-дрифт", rarity: "rare", img: "/frames/frame-08.svg?v=2", unlock: { level: 6 } },
  { id: "frame-03", name: "Маска гуля", rarity: "rare", img: "/frames/frame-03.svg?v=2", unlock: { referral: 10 } },
  { id: "frame-09", name: "Чёрная дыра", rarity: "rare", img: "/frames/frame-09.svg?v=2", unlock: { level: 8 } },
  { id: "frame-19", name: "Крылья демона", rarity: "rare", img: "/frames/frame-19.svg?v=2", unlock: { level: 9 } },
  { id: "frame-15", name: "Мяч", rarity: "rare", img: "/frames/frame-15.svg?v=2", unlock: { level: 10 } },
  { id: "frame-34", name: "Риннеган", rarity: "rare", img: "/frames/frame-34.svg?v=2", unlock: { level: 12 } },
  { id: "frame-35", name: "Бьякуган", rarity: "rare", img: "/frames/frame-35.svg?v=2", unlock: { level: 14 } },
  { id: "frame-21", name: "Джо-стиль", rarity: "rare", img: "/frames/frame-21.svg?v=2", unlock: { level: 16 } },
  { id: "frame-16", name: "Соты", rarity: "rare", img: "/frames/frame-16.svg?v=2", unlock: { premium: true } },
  { id: "frame-12", name: "Кицунэ", rarity: "rare", img: "/frames/frame-12.svg?v=2", unlock: { achievement: "minutes-300" } },
  { id: "frame-36", name: "Геасс", rarity: "rare", img: "/frames/frame-36.svg?v=2", unlock: { referral: 3 } },
  { id: "frame-13", name: "Синее пламя эго", rarity: "rare", img: "/frames/frame-13.svg?v=2", unlock: { price: 600 } },
  { id: "frame-24", name: "Проклятая энергия", rarity: "rare", img: "/frames/frame-24.svg?v=2", unlock: { price: 1500 } },
  /* — epic — */
  { id: "frame-01", name: "Кагуне", rarity: "epic", img: "/frames/frame-01.svg?v=2", unlock: { level: 18 } },
  { id: "frame-02", name: "Какуган", rarity: "epic", img: "/frames/frame-02.svg?v=2", unlock: { level: 20 } },
  { id: "frame-25", name: "Тетрадь смерти", rarity: "epic", img: "/frames/frame-25.svg?v=2", unlock: { level: 22 } },
  { id: "frame-27", name: "Крылья свободы", rarity: "epic", img: "/frames/frame-27.svg?v=2", unlock: { referral: 30 } },
  { id: "frame-31", name: "Драконьи шары", rarity: "epic", img: "/frames/frame-31.svg?v=2", unlock: { level: 28 } },
  { id: "frame-29", name: "Магическая луна", rarity: "epic", img: "/frames/frame-29.svg?v=2", unlock: { premium: true } },
  { id: "frame-23", name: "Клинок-волны", rarity: "epic", img: "/frames/frame-23.svg?v=2", unlock: { achievement: "titles-10" } },
  { id: "frame-20", name: "Чемпион №1", rarity: "epic", img: "/frames/frame-20.svg?v=2", unlock: { achievement: "collections-5" } },
  { id: "frame-04", name: "Паучья лилия", rarity: "epic", img: "/frames/frame-04.svg?v=2", unlock: { achievement: "episodes-25" } },
  { id: "frame-30", name: "Бензопила", rarity: "epic", img: "/frames/frame-30.svg?v=2", unlock: { price: 3000 } },
  /* Премиум-рамки: код 1:1 из макетов, файлы собираются генераторами
     tools/make-premium-frames.mjs (4), make-premium-frames-more.mjs (8) и
     make-premium-frames-variants.mjs (8). Анимации живут внутри самих SVG,
     поэтому img — обычный файл и AvatarView рисует их штатно.
     Ранг легендарный, цена 6000 AC — выше самой дорогой рамки магазина
     («Золотые крылья», 5000). */

  { id: "frame-lunar-feather", name: "Лунное перо", rarity: "legendary", img: "/frames/frame-lunar-feather.svg?v=2", scale: 1.95, unlock: { price: 6000 } },
  { id: "frame-golden-laurel", name: "Золотой лавр", rarity: "legendary", img: "/frames/frame-golden-laurel.svg?v=2", scale: 1.95, unlock: { price: 6000 } },
  { id: "frame-emerald-laurel", name: "Изумрудный лавр", rarity: "legendary", img: "/frames/frame-emerald-laurel.svg?v=2", scale: 1.95, unlock: { price: 6000 } },
  { id: "frame-sakura", name: "Сакура", rarity: "legendary", img: "/frames/frame-sakura.svg?v=2", scale: 1.95, unlock: { price: 6000 } },
  { id: "frame-ruby-laurel", name: "Рубиновый лавр", rarity: "legendary", img: "/frames/frame-ruby-laurel.svg?v=2", scale: 1.95, unlock: { price: 6000 } },
  { id: "frame-sapphire-night", name: "Сапфировая ночь", rarity: "legendary", img: "/frames/frame-sapphire-night.svg?v=2", scale: 1.95, unlock: { price: 6000 } },
  { id: "frame-amethyst", name: "Аметист", rarity: "legendary", img: "/frames/frame-amethyst.svg?v=2", scale: 1.95, unlock: { price: 6000 } },
  { id: "frame-platinum", name: "Платина", rarity: "legendary", img: "/frames/frame-platinum.svg?v=2", scale: 1.95, unlock: { price: 6000 } },
  { id: "frame-turquoise-laurel", name: "Бирюзовый лавр", rarity: "legendary", img: "/frames/frame-turquoise-laurel.svg?v=2", scale: 1.95, unlock: { price: 6000 } },
  { id: "frame-sunset", name: "Закат", rarity: "legendary", img: "/frames/frame-sunset.svg?v=2", scale: 1.95, unlock: { price: 6000 } },
  { id: "frame-obsidian", name: "Обсидиан", rarity: "legendary", img: "/frames/frame-obsidian.svg?v=2", scale: 1.95, unlock: { price: 6000 } },
  { id: "frame-royal-purple", name: "Королевский пурпур", rarity: "legendary", img: "/frames/frame-royal-purple.svg?v=2", scale: 1.95, unlock: { price: 6000 } },
  { id: "frame-blue-flame", name: "Синее пламя", rarity: "legendary", img: "/frames/frame-blue-flame.svg?v=2", scale: 1.95, unlock: { price: 6000 } },
  { id: "frame-ghost-flame", name: "Призрачный огонь", rarity: "legendary", img: "/frames/frame-ghost-flame.svg?v=2", scale: 1.95, unlock: { price: 6000 } },
  { id: "frame-golden-seal", name: "Золотая печать", rarity: "legendary", img: "/frames/frame-golden-seal.svg?v=2", scale: 1.95, unlock: { price: 6000 } },
  { id: "frame-crimson-seal", name: "Багровая печать", rarity: "legendary", img: "/frames/frame-crimson-seal.svg?v=2", scale: 1.95, unlock: { price: 6000 } },
  { id: "frame-golden-moths", name: "Золотые бабочки", rarity: "legendary", img: "/frames/frame-golden-moths.svg?v=2", scale: 1.95, unlock: { price: 6000 } },
  { id: "frame-lunar-moths", name: "Лунные мотыльки", rarity: "legendary", img: "/frames/frame-lunar-moths.svg?v=2", scale: 1.95, unlock: { price: 6000 } },
  /* — legendary — */
  { id: "frame-37", name: "Безграничные глаза", rarity: "legendary", img: "/frames/frame-37.svg?v=2", unlock: { level: 35 } },
  { id: "frame-26", name: "Пират-соломенная шляпа", rarity: "legendary", img: "/frames/frame-26.svg?v=2", unlock: { level: 40 } },
  { id: "frame-06", name: "Обратный отсчёт 1000−7", rarity: "legendary", img: "/frames/frame-06.svg?v=2", unlock: { level: 50 } },
  { id: "frame-17", name: "Молния", rarity: "legendary", img: "/frames/frame-17.svg?v=2", unlock: { achievement: "level-10" } },
  { id: "frame-11", name: "Они", rarity: "legendary", img: "/frames/frame-11.svg?v=2", unlock: { achievement: "claims-10" } },
  { id: "frame-07", name: "ZXC Cyber", rarity: "legendary", img: "/frames/frame-07.svg?v=2", unlock: { achievement: "showcase" } },
  // награда достижения прогрессии «Хранитель» (reward.frameId)
  { id: "frame-14", name: "Король поля", rarity: "legendary", img: "/frames/frame-14.svg?v=2", unlock: {} },
  { id: "frame-18", name: "Золотые крылья", rarity: "legendary", img: "/frames/frame-18.svg?v=2", unlock: { price: 5000 } },
];

/**
 * Рамки магазина.
 *
 * Тот же формат, что и у основного набора: SVG-оверлей 512×512 с
 * прозрачным центром, своя анимация внутри файла и поддержка
 * prefers-reduced-motion. Покупаются за AC через движок прогрессии.
 */
export const SHOP_FRAMES: FrameItem[] = GUILD_FRAMES.map((frame) => ({
  id: frame.id,
  name: frame.name,
  rarity: frame.rarity,
  img: `/frames/${frame.id}.svg`,
  unlock: { price: frame.price },
}));

/* --------------------------- Проверка доступа --------------------------- */

export interface UnlockContext {
  level: number;
  premium: boolean;
  claimed: string[];
  purchased: string[];
  /** Сколько друзей приглашено — для предметов за рубежи рефералки */
  referrals: number;
}

export function isUnlocked(unlock: Unlock, ctx: UnlockContext): boolean {
  if (unlock.level && ctx.level < unlock.level) return false;
  if (unlock.achievement && !ctx.claimed.includes(unlock.achievement)) return false;
  if (unlock.premium && !ctx.premium) return false;
  if (unlock.referral && ctx.referrals < unlock.referral) return false;
  return true;
}

/** Предмет доступен (куплен или открыт условиями) */
export function isOwned(id: string, ctx: UnlockContext): boolean {
  const item = findItem(id);
  if (!item) return false;
  if (ctx.purchased.includes(id)) return true;
  // Предмет за цену открывается только покупкой: `unlock.price` — это
  // цена магазина, а не «условие даром» (раньше платная косметика
  // считалась купленной и магазин не мог её продать).
  if (item.unlock.price) return false;
  return isUnlocked(item.unlock, ctx);
}

export function findItem(id: string): BackgroundItem | TitleItem | FrameItem | undefined {
  return (
    BACKGROUNDS.find((bg) => bg.id === id) ??
    TITLES.find((title) => title.id === id) ??
    FRAMES.find((frame) => frame.id === id) ??
    SHOP_FRAMES.find((frame) => frame.id === id)
  );
}

/** Человекочитаемое условие открытия */
export function unlockHint(unlock: Unlock): string {
  if (unlock.price) return `${unlock.price} монет`;
  if (unlock.referral) return `${unlock.referral} ${friendWord(unlock.referral)}`;
  if (unlock.premium) return "нужен Premium";
  if (unlock.achievement) return "за достижение";
  if (unlock.level) return `уровень ${unlock.level}`;
  return "доступно всем";
}

/** «1 друг», «3 друга», «10 друзей» — то же правило, что и в рефералке */
function friendWord(n: number): string {
  const a = n % 10;
  const b = n % 100;
  if (a === 1 && b !== 11) return "друг";
  if (a >= 2 && a <= 4 && (b < 10 || b >= 20)) return "друга";
  return "друзей";
}
