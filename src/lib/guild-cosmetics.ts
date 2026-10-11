import type { TitleItem } from "./cosmetics";

/**
 * Титулы магазина — коллекция для клановой экономики.
 *
 * Написаны в том же визуальном языке, что и существующие титулы: своя
 * палитра `visual.c`/`c2`, эффект из библиотеки `ag-tag.css`, ручная
 * иконка 24×24 и режим текста из `titleTag()`. Плоских цветных плашек
 * здесь нет — иначе они выбивались бы из соседних знаков прогрессии.
 *
 * `unlock.price` совпадает с ценой в `PROGRESSION_CONFIG.shop`: покупка
 * идёт через движок событием `SHOP_PURCHASED`, он сверяет цену с
 * конфигом, проверяет баланс и пишет транзакцию в журнал. Повторная
 * покупка блокируется там же — клиенту доверять нельзя.
 */
export const GUILD_TITLES: TitleItem[] = [
  {
    id: "gt-wanderer",
    name: "Странник",
    rarity: "common",
    color: "#a5b4fc",
    unlock: { price: 400 },
    description: "Прошёл мимо сотни миров и ни разу не запомнил дорогу обратно",
    visual: {
      c: "#a5b4fc",
      c2: "#312e81",
      effects: ["shine"],
      text: "plain",
      // трость и след
      icon: '<path d="M4 20 11 4"/><path d="M9.5 14.5 20 20"/><path d="M11 4 9 9.5"/>',
    },
  },
  {
    id: "gt-recruit",
    name: "Новичок гильдии",
    rarity: "common",
    color: "#93c5fd",
    unlock: { price: 400 },
    description: "Первая заявка принята. Теперь он часть чего-то",
    visual: {
      c: "#93c5fd",
      c2: "#1e3a8a",
      effects: ["shine"],
      text: "plain",
      // щиток с гербом
      icon: '<path d="M12 3.5 20 6.5v6c0 4.4-3.4 7.6-8 8.6-4.6-1-8-4.2-8-8.6v-6z"/><path d="M9 12.2l2 2 4-4"/>',
    },
  },
  {
    id: "gt-adventurer",
    name: "Искатель приключений",
    rarity: "common",
    color: "#6ee7b7",
    unlock: { price: 600 },
    description: "Рюкзак полон чужих легенд и половины нужных карт",
    visual: {
      c: "#6ee7b7",
      c2: "#064e3b",
      effects: ["runes"],
      text: "plain",
      // рюкзак
      icon: '<path d="M4.5 9.5 12 4l7.5 5.5v9L12 21l-7.5-2.5z"/><path d="M12 4v17"/>',
    },
  },
  {
    id: "gt-wayfarer",
    name: "Путник миров",
    rarity: "common",
    color: "#5eead4",
    unlock: { price: 600 },
    description: "Ступает между мирами так же легко, как по лестнице",
    visual: {
      c: "#5eead4",
      c2: "#134e4a",
      effects: ["mist"],
      text: "plain",
      // глобус с меридианами
      icon: '<circle cx="12" cy="12" r="7.5"/><path d="M4.5 12h15"/><path d="M12 4.5c2.4 2.4 3.6 5 3.6 7.5S14.4 17.1 12 19.5c-2.4-2.4-3.6-5-3.6-7.5S9.6 6.9 12 4.5z"/>',
    },
  },
  {
    id: "gt-demon-hunter",
    name: "Охотник на демонов",
    rarity: "rare",
    color: "#fb923c",
    unlock: { price: 1500 },
    description: "Демоны проверяют его имя первым — и уходят",
    visual: {
      c: "#fb923c",
      c2: "#7c2d12",
      effects: ["flame"],
      text: "neon",
      // копьё и клык
      icon: '<path d="M5 19 14 5"/><path d="M14 5h5v5"/><path d="m9 15-4 4"/><path d="M16.5 17.5c1.6 0 2.6-1 2.6-2.4 0-1.6-2.6-3.6-2.6-3.6s-2.6 2-2.6 3.6c0 1.4 1 2.4 2.6 2.4z"/>',
    },
  },
  {
    id: "gt-cursed",
    name: "Проклятая душа",
    rarity: "rare",
    color: "#c084fc",
    unlock: { price: 1800 },
    description: "Проклятие держали восемь лет — оно начало держать его",
    visual: {
      c: "#c084fc",
      c2: "#4c1d95",
      effects: ["aura"],
      text: "neon",
      // череп в ореоле
      icon: '<path d="M12 3.5c3.6 0 6.5 3 6.5 6.8 0 4.6-3.4 8.2-6.5 10.2-3.1-2-6.5-5.6-6.5-10.2 0-3.8 2.9-6.8 6.5-6.8z"/><circle cx="9.6" cy="10.6" r="1.5"/><circle cx="14.4" cy="10.6" r="1.5"/><path d="M10 14.4h4"/>',
    },
  },
  {
    id: "gt-blade-master",
    name: "Мастер клинка",
    rarity: "rare",
    color: "#93c5fd",
    unlock: { price: 1800 },
    description: "Одиннадцать поединков, последние четыре — против мастеров",
    visual: {
      c: "#93c5fd",
      c2: "#1e3a8a",
      effects: ["border-blade"],
      text: "plain",
      // клинок и гарда
      icon: '<path d="M19.5 4.5 8 16"/><path d="m5.5 18.5 2.5-2.5L6.5 14.5 4 17z"/><path d="M4 15.5 7 18.5"/>',
    },
  },
  {
    id: "gt-seal-keeper",
    name: "Хранитель печати",
    rarity: "rare",
    color: "#fcd34d",
    unlock: { price: 2100 },
    description: "Печать скорее подпускает, чем запирает",
    visual: {
      c: "#fcd34d",
      c2: "#78350f",
      effects: ["orbit"],
      text: "metal",
      // замок с печатью
      icon: '<rect x="4.5" y="8.5" width="15" height="10" rx="1.6"/><path d="M9 8.5V6.6a3 3 0 0 1 6 0v1.9"/><path d="M12 12.4v3"/>',
    },
  },
  {
    id: "gt-abyss-lord",
    name: "Повелитель бездны",
    rarity: "epic",
    color: "#f472b6",
    unlock: { price: 4000 },
    description: "Бездна здоровается с ним по имени — у неё их мало",
    visual: {
      c: "#f472b6",
      c2: "#701a75",
      effects: ["aura", "runes"],
      text: "neon",
      // трон
      icon: '<path d="M3.5 19.5h17"/><path d="M6 19.5V9.5L12 4l6 5.5v10"/><path d="M9.5 19.5v-5h5v5"/><circle cx="12" cy="10" r="1.4"/>',
    },
  },
  {
    id: "gt-flame-heir",
    name: "Наследник пламени",
    rarity: "epic",
    color: "#fb923c",
    unlock: { price: 4200 },
    description: "Огонь предков горит в нём с рождения и не спрашивает разрешения",
    visual: {
      c: "#fb923c",
      c2: "#9a3412",
      effects: ["flame", "double"],
      text: "metal",
      // пламя
      icon: '<path d="M12 21c3.9 0 6.5-2.6 6.5-6 0-4.6-4.2-6.6-4.2-11.5-3.4 2-6.5 5-6.5 9.4C7.8 17.9 9.4 21 12 21z"/><path d="M12 21c1.7 0 2.8-1.1 2.8-2.5 0-1.9-1.9-2.8-1.9-4.8-1.5.9-2.8 2.3-2.8 4.1 0 1.8.8 3.2 1.9 3.2z"/>',
    },
  },
  {
    id: "gt-moon-reaper",
    name: "Лунный палач",
    rarity: "epic",
    color: "#c7d2fe",
    unlock: { price: 4600 },
    description: "Работает под луной и только под ней",
    visual: {
      c: "#c7d2fe",
      c2: "#312e81",
      effects: ["mist", "aura"],
      text: "neon",
      // серп луны
      icon: '<path d="M17.5 15.5A7.5 7.5 0 0 1 8.5 6.5a7.5 7.5 0 1 0 9 9z"/><path d="M18.4 4.6 20 8l3.5 1.6L20 11.2l-1.6 3.6L16.8 11.2l-3.5-1.6L16.8 8z"/>',
    },
  },
  {
    id: "gt-archmage",
    name: "Архимаг измерений",
    rarity: "epic",
    color: "#818cf8",
    unlock: { price: 5200 },
    description: "Сгибает реальность в гармошку — аккуратно, чтобы не шумело",
    visual: {
      c: "#818cf8",
      c2: "#312e81",
      effects: ["backdrop-grid", "orbit"],
      text: "neon",
      // ромб измерений
      icon: '<path d="M12 3.5 20.5 12 12 20.5 3.5 12z"/><path d="M12 8.5 15.5 12 12 15.5 8.5 12z"/><path d="M3.5 12h17M12 3.5v17"/>',
    },
  },
  {
    id: "gt-eternity-ruler",
    name: "Владыка вечности",
    rarity: "legendary",
    color: "#fde68a",
    unlock: { price: 11000 },
    description: "Стоял у истоков так долго, что их начали звать его именем",
    visual: {
      c: "#fde68a",
      c2: "#713f12",
      effects: ["double", "aura", "flame"],
      text: "metal",
      // корона и самоцвет
      icon: '<path d="M3.5 19.5h17"/><path d="M3.5 19.5 2.5 9 8 13l4-8 4 8 5.5-4-1 10.5z"/><circle cx="12" cy="17.4" r="1.5"/>',
    },
  },
  {
    id: "gt-fate-breaker",
    name: "Разрушитель судеб",
    rarity: "legendary",
    color: "#fca5a5",
    unlock: { price: 12500 },
    description: "Развязывает нити, которые не предназначалось развязывать",
    visual: {
      c: "#fca5a5",
      c2: "#7f1d1d",
      effects: ["border-blade", "aura"],
      text: "neon",
      // разорванные нити
      icon: '<path d="M3.5 6h4.5L15 18h5.5"/><path d="M20.5 6H16l-3 5.4"/><path d="M14.4 4.6 18 9"/><path d="M6 20.5h5l4-7.2"/><path d="M9.5 12.5 6 9.5"/>',
    },
  },
  {
    id: "gt-last-god",
    name: "Бог последнего измерения",
    rarity: "legendary",
    color: "#f0abfc",
    unlock: { price: 18000 },
    description: "Остался один мир, и он выбрал его своим единственным жителем",
    visual: {
      c: "#f0abfc",
      c2: "#581c87",
      effects: ["orbit", "double", "mist"],
      text: "metal",
      // солнце мира
      icon: '<circle cx="12" cy="12" r="3.4"/><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3"/><path d="m6 6 2.2 2.2M15.8 15.8 18 18M18 6l-2.2 2.2M8.2 15.8 6 18"/>',
    },
  },
];

/** Рамки магазина: файлы сгенерированы в public/frames */
export const GUILD_FRAMES = [
  { id: "frame-40", name: "Стальной контур", rarity: "common", price: 600 },
  { id: "frame-41", name: "Тихая сакура", rarity: "common", price: 600 },
  { id: "frame-42", name: "Сумеречный орнамент", rarity: "common", price: 800 },
  { id: "frame-43", name: "Энергетический импульс", rarity: "common", price: 800 },
  { id: "frame-44", name: "Печать ниндзя", rarity: "rare", price: 1500 },
  { id: "frame-45", name: "Ледяной кристалл", rarity: "rare", price: 1500 },
  { id: "frame-46", name: "Алый вихрь", rarity: "rare", price: 1800 },
  { id: "frame-47", name: "Кибернетический контур", rarity: "rare", price: 1800 },
  { id: "frame-48", name: "Драконье пламя", rarity: "epic", price: 3200 },
  { id: "frame-49", name: "Око бездны", rarity: "epic", price: 3200 },
  { id: "frame-50", name: "Лунная корона", rarity: "epic", price: 3600 },
  { id: "frame-51", name: "Пространственный разлом", rarity: "epic", price: 3600 },
  { id: "frame-52", name: "Корона вечности", rarity: "legendary", price: 7000 },
  { id: "frame-53", name: "Божественный мандат", rarity: "legendary", price: 8000 },
  { id: "frame-54", name: "Разлом измерений", rarity: "legendary", price: 9500 },
] as const;