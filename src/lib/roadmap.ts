/**
 * Роадмап AniGalaxy — данные страницы «Обновления» (`/updates`).
 *
 * Содержимое перенесено из макета `roadmap (1).html` один в один: это
 * редакционный план проекта, а не вычисляемые данные, поэтому он лежит здесь
 * текстом. Числа голосов — тоже из макета: своего голосования на сервере у
 * проекта нет, а голоса пользователя хранятся в браузере и добавляются к этим
 * значениям (см. `updates-votes.ts`).
 */

/* --------------------------------- Иконки --------------------------------- */

/** Заливка «полупрозрачным currentColor» — так иконки нарисованы в макете */
const F = 'fill="currentColor" fill-opacity=".16"';

export type RoadmapIcon =
  | "star"
  | "flame"
  | "user"
  | "users"
  | "palette"
  | "crown"
  | "message"
  | "search"
  | "bell"
  | "layers"
  | "swords"
  | "play"
  | "coin"
  | "trophy"
  | "phone"
  | "gem"
  | "tv"
  | "shield"
  | "medal"
  | "bars"
  | "download"
  | "news"
  | "bag"
  | "gift"
  | "sparkles"
  | "smile"
  | "badge"
  | "picture"
  | "code"
  | "calendar"
  | "k4"
  | "lock"
  | "key"
  | "send"
  | "mail";

export const ICONS: Record<RoadmapIcon, string> = {
  star: `<path ${F} d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>`,
  flame: `<path ${F} d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>`,
  user: `<circle ${F} cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>`,
  users: `<circle ${F} cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17 14.2c2.8.2 5 2.2 5 5.3"/>`,
  palette: `<path ${F} d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 1.6-2.1-.4-1.1.2-2.4 1.6-2.4H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>`,
  crown: `<path ${F} d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/><path d="M5 21h14"/>`,
  message: `<path ${F} d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-8l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/><path d="M8 10h8M8 13h5"/>`,
  search: `<circle ${F} cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>`,
  bell: `<path ${F} d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7z"/><path d="M10 20a2 2 0 0 0 4 0"/>`,
  layers: `<path ${F} d="M12 3l9 5-9 5-9-5z"/><path d="M3 12.5l9 5 9-5"/><path d="M3 17l9 5 9-5" opacity=".55"/>`,
  swords: `<path d="M14.5 17.5L3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M19 21l2-2"/><path d="M14.5 6.5L18 3h3v3l-3.5 3.5"/><path d="M5 14l4 4"/><path d="M7 17l-3 3"/><path d="M3 19l2 2"/>`,
  play: `<circle ${F} cx="12" cy="12" r="9"/><path ${F} d="M10 8.5l6 3.5-6 3.5z"/>`,
  coin: `<circle ${F} cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.8" opacity=".55"/><path d="M12 8.5v7M10 10.5c0-.8.9-1.2 2-1.2s2 .5 2 1.3c0 1.6-4 .8-4 2.6 0 .8.9 1.3 2 1.3s2-.4 2-1.2"/>`,
  trophy: `<path ${F} d="M8 4h8v6a4 4 0 0 1-8 0z"/><path d="M8 6H4c0 3 1.5 4.5 4 5M16 6h4c0 3-1.5 4.5-4 5"/><path d="M12 14v4M8 21h8M9.5 18h5"/>`,
  phone: `<rect ${F} x="6.5" y="2.5" width="11" height="19" rx="3"/><path d="M10.5 18.5h3"/>`,
  gem: `<path ${F} d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20M9 3L7 9l5 12 5-12-2-6"/>`,
  tv: `<rect ${F} x="3" y="5" width="18" height="12" rx="2.5"/><path d="M8 21h8M12 17v4"/>`,
  shield: `<path ${F} d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>`,
  medal: `<circle ${F} cx="12" cy="9" r="5.5"/><path d="M8.5 13.5L6.5 21l5.5-3 5.5 3-2-7.5"/>`,
  bars: `<path d="M5 20v-8M12 20V5M19 20v-5"/><path d="M3 21h18" opacity=".5"/>`,
  download: `<path d="M12 4v11M7.5 11l4.5 4.5 4.5-4.5M5 20h14"/>`,
  news: `<rect ${F} x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h8M8 17h4"/>`,
  bag: `<path ${F} d="M5 8h14l-1 12H6z"/><path d="M9 8a3 3 0 0 1 6 0"/>`,
  gift: `<rect ${F} x="3.5" y="9" width="17" height="11" rx="2"/><path d="M12 9v11M3.5 13h17M12 9C9.5 9 8 8 8 6.5S10 4 12 9zm0 0c2.5 0 4-1 4-2.5S14 4 12 9z"/>`,
  sparkles: `<path ${F} d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>`,
  smile: `<circle ${F} cx="12" cy="12" r="9"/><path d="M8.5 14.5c1 1.5 2.2 2 3.5 2s2.5-.5 3.5-2"/><circle cx="9" cy="10" r=".7"/><circle cx="15" cy="10" r=".7"/>`,
  badge: `<path ${F} d="M12 3l2.5 2 3.2-.2.8 3.1 2.7 1.8-1.2 3 1.2 3-2.7 1.8-.8 3.1-3.2-.2L12 21l-2.5-2-3.2.2-.8-3.1-2.7-1.8 1.2-3-1.2-3 2.7-1.8.8-3.1 3.2-.2z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>`,
  picture: `<rect ${F} x="3" y="5" width="18" height="14" rx="2.5"/><rect x="12" y="11" width="7" height="5" rx="1.2"/>`,
  code: `<path d="M8 8l-4.5 4L8 16M16 8l4.5 4L16 16M13.5 5l-3 14"/>`,
  calendar: `<rect ${F} x="3.5" y="5" width="17" height="16" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>`,
  k4: `<rect ${F} x="2.5" y="5" width="19" height="14" rx="3"/><text x="12" y="15" text-anchor="middle" font-size="8" font-weight="800" font-family="inherit" fill="currentColor" stroke="none">4K</text>`,
  lock: `<rect ${F} x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>`,
  key: `<circle ${F} cx="8" cy="14" r="4"/><path d="M11 11l9-8M17 6l3 3M15 8l2 2"/>`,
  send: `<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/>`,
  mail: `<rect ${F} x="3" y="5" width="18" height="14" rx="3"/><path d="M3.5 7.5l8.5 6 8.5-6"/>`,
};

/** Градиент плитки-«самоцвета» для каждой иконки */
export const ICON_COLORS: Record<RoadmapIcon, [string, string]> = {
  star: ["#61d1ff", "#3de0ff"],
  flame: ["#ff8a4c", "#ff3d6e"],
  user: ["#38e1ff", "#2aa7ff"],
  users: ["#4dffb0", "#2aa7ff"],
  palette: ["#ff5c9d", "#8b5cff"],
  crown: ["#61d1ff", "#ff5c9d"],
  message: ["#38e1ff", "#8b5cff"],
  search: ["#6dd5ff", "#8b5cff"],
  bell: ["#61d1ff", "#ff8a4c"],
  layers: ["#8b5cff", "#38e1ff"],
  swords: ["#ff5c9d", "#ff8a4c"],
  play: ["#38e1ff", "#8b5cff"],
  coin: ["#61d1ff", "#3ddcff"],
  trophy: ["#61d1ff", "#ff8a4c"],
  phone: ["#2aa7ff", "#38e1ff"],
  gem: ["#ff5c9d", "#8b5cff"],
  tv: ["#38e1ff", "#2aa7ff"],
  shield: ["#8b5cff", "#38e1ff"],
  medal: ["#61d1ff", "#ff5c9d"],
  bars: ["#4dffb0", "#38e1ff"],
  download: ["#38e1ff", "#4dffb0"],
  news: ["#2aa7ff", "#8b5cff"],
  bag: ["#ff5c9d", "#61d1ff"],
  gift: ["#ff5c9d", "#8b5cff"],
  sparkles: ["#c9a6ff", "#38e1ff"],
  smile: ["#61d1ff", "#ff5c9d"],
  badge: ["#4dffb0", "#38e1ff"],
  picture: ["#38e1ff", "#8b5cff"],
  code: ["#4dffb0", "#2aa7ff"],
  calendar: ["#ff8a4c", "#ff5c9d"],
  k4: ["#38e1ff", "#8b5cff"],
  lock: ["#6b7794", "#3d465c"],
  key: ["#61d1ff", "#4dffb0"],
  send: ["#38e1ff", "#8b5cff"],
  mail: ["#4dffb0", "#2aa7ff"],
};

/* -------------------------------- Данные роадмапа --------------------------- */

/** Что уже работает: [иконка, название] */
export const SHIPPED: [RoadmapIcon, string][] = [
  ["star", "Система уровней и XP"],
  ["flame", "Ежедневные квесты и серии"],
  ["user", "Профиль и вотчлист"],
  ["users", "Система друзей"],
  ["palette", "Кастомизация профиля"],
  ["crown", "Premium-подписка"],
  ["message", "Комментарии"],
  ["search", "Умный поиск (Ctrl+K)"],
  ["bell", "Уведомления"],
  ["layers", "Подборки сообщества"],
  ["swords", "Боевой пропуск"],
  ["play", "Умный плеер"],
];

/** Фильтр по разделу: id → подпись */
export const CATEGORIES: Record<string, string> = {
  all: "Все",
  player: "Плеер",
  social: "Сообщество",
  eco: "Экономика",
  content: "Контент",
  profile: "Профиль",
};

/** Иконка фильтра по разделу */
export const CATEGORY_ICONS: Record<string, RoadmapIcon> = {
  player: "play",
  social: "users",
  eco: "coin",
  content: "tv",
  profile: "user",
};

export type FeatureStatus = "done" | "wip" | "plan";

export interface RoadmapFeature {
  /** Готовится id вида `patch.3` при загрузке страницы */
  id: string;
  title: string;
  icon: RoadmapIcon;
  text: string;
  category: string;
  status: FeatureStatus;
  /** Прогресс 0–100, только для `wip` */
  progress?: number;
  /** Голосов в макете */
  votes: number;
}

export interface RoadmapPatch {
  id: string;
  icon: RoadmapIcon;
  name: string;
  subtitle: string;
  status: Exclude<FeatureStatus, "done">;
  /** Когда ждём патч */
  eta: string;
  color: string;
  features: Omit<RoadmapFeature, "id">[];
}

export const PATCHES: RoadmapPatch[] = [
  {
    id: "next",
    icon: "flame",
    name: "Следующий патч",
    subtitle: "Карта аниме, новая мобильная версия, плеер и оплата",
    status: "wip",
    eta: "2026-11-05T18:00:00",
    color: "#8b5cff",
    features: [
      { title: "Рамки и аватарки", icon: "shield", text: "Анимированные рамки для профиля и комментариев.", category: "profile", status: "done", votes: 310 },
      { title: "Система титулов", icon: "medal", text: "Звания за достижения, которые видны в профиле и чате.", category: "profile", status: "wip", progress: 70, votes: 268 },
      { title: "4K качество", icon: "k4", text: "Доступ к 4K-каталогу: до 2160p и 1440p в каждой серии.", category: "player", status: "wip", progress: 55, votes: 512 },
      { title: "Лидерборд", icon: "bars", text: "Рейтинг зрителей и авторов с живой статистикой.", category: "social", status: "wip", progress: 35, votes: 197 },
      { title: "Новости аниме", icon: "news", text: "Лента анонсов, трейлеров и релизов прямо на сайте.", category: "content", status: "plan", votes: 224 },
      { title: "Карта аниме", icon: "star", text: "Квест-карта с 8 маршрутами: смотрите связанные тайтлы, двигайте узлы, как удобно, и забирайте AC, XP и бесплатную рамку или тег за финал маршрута.", category: "content", status: "done", votes: 0 },
      { title: "Мобильная версия как приложение", icon: "phone", text: "Нижняя плавающая панель, меню-шторка и поиск-пилюля сверху. Сайт можно установить на экран телефона, а основные страницы открываются даже без сети.", category: "player", status: "done", votes: 0 },
      { title: "Новые кнопки в плеере", icon: "play", text: "Метки опенинга и эндинга на дорожке, кнопки «Пропустить» и «Смотреть опенинг/эндинг», карточка «Следующая серия» с таймером автоперехода.", category: "player", status: "done", votes: 0 },
      { title: "Закладки и скорость в плеере", icon: "bars", text: "Плеер запоминает выбранную скорость и автопереход, а ещё можно ставить закладки на любимые моменты серии.", category: "player", status: "done", votes: 0 },
      { title: "Новое окно оплаты", icon: "coin", text: "Единое окно покупки для Premium, боевого пропуска, подарков и донатов: СБП, криптовалюта и Telegram Stars, оплата удержанием кнопки и красочный экран успеха.", category: "eco", status: "done", votes: 0 },
      { title: "Виджет «Неделя» в профиле", icon: "calendar", text: "Обновлённый дизайн: активность за неделю читается с первого взгляда.", category: "profile", status: "done", votes: 0 },
      { title: "Безопасность и стабильность", icon: "lock", text: "Усиленная защита страниц и заголовков, исправлено наложение кнопок клана и чата на мобильных, уведомления больше не перекрывают панель.", category: "social", status: "done", votes: 0 },
      { title: "Кланы 2.0", icon: "shield", text: "Кланы собраны заново: карта-цитадель, босс недели с общим уроном, цели и личные сундуки, общая казна, роли с правами, заявки и карта из 8 территорий, которые осаждают соперники.", category: "social", status: "done", votes: 0 },
      { title: "Клановые войны", icon: "shield", text: "Война на трёх фронтах на анимированном поле битвы: отряды за AC, способности «Залп», «Щит» и «Рывок», ставка на территорию соперника и престиж за победу.", category: "social", status: "done", votes: 0 },
      { title: "Лавка и сокровищница клана", icon: "bag", text: "Фоны, эмблемы и декор для клана за казну или престиж, четыре сундука с открытыми шансами выпадения.", category: "social", status: "done", votes: 0 },
      { title: "Призы лидерборда", icon: "medal", text: "Итог недели считается по XP: место в сотне лучших приносит XP, AC, титулы «Покоритель», «Элита недели», «Десятка недели» и золотые рамки.", category: "social", status: "done", votes: 0 },
      { title: "Панель плеера: серии и озвучки", icon: "layers", text: "Сезоны, эпизоды и озвучки открываются прямо в плеере, а управление собрано как в крупных сервисах.", category: "player", status: "done", votes: 0 },
      { title: "Быстрее и заметнее в поиске", icon: "search", text: "Карта сайта и описания для поисковиков, ускоренная загрузка страниц, страница-заглушка без сети.", category: "content", status: "done", votes: 0 },
    ],
  },
  {
    id: "eco",
    icon: "coin",
    name: "Патч «Экономика»",
    subtitle: "AC, коллекции и награды",
    status: "plan",
    eta: "2027-01-20T18:00:00",
    color: "#61d1ff",
    features: [
      { title: "Единая система AC", icon: "coin", text: "Аникойны (AC) за уровни, задания, подписку и поддержку проекта уже работают; в патче — общий баланс между устройствами.", category: "eco", status: "wip", progress: 70, votes: 289 },
      { title: "Магазин скинов", icon: "bag", text: "Фоны профиля, эффекты никнейма и стили плеера.", category: "eco", status: "plan", votes: 263 },
      { title: "Гача-крутки", icon: "gift", text: "Крутки за AC: редкие рамки, значки и стикеры.", category: "eco", status: "plan", votes: 177 },
      { title: "Значки-коллекции", icon: "badge", text: "Тематические наборы значков за прохождение подборок.", category: "profile", status: "plan", votes: 152 },
      { title: "Стикеры", icon: "smile", text: "Паки стикеров для комментариев и чатов.", category: "social", status: "plan", votes: 208 },
      { title: "Дополнительные плееры", icon: "layers", text: "Резервные источники видео при недоступности основного.", category: "player", status: "plan", votes: 301 },
    ],
  },
  {
    id: "ach",
    icon: "trophy",
    name: "Патч «Достижения»",
    subtitle: "Ачивки, испытания и уникальные награды",
    status: "plan",
    eta: "2027-03-10T18:00:00",
    color: "#61d1ff",
    features: [
      { title: "Ачивки 1.0", icon: "trophy", text: "Испытания за просмотры, жанры и серии с наградами XP.", category: "profile", status: "plan", votes: 244 },
      { title: "Ачивки 2.0", icon: "sparkles", text: "Награды за легендарные моменты в аниме.", category: "profile", status: "plan", votes: 160 },
      { title: "Сезонные награды", icon: "calendar", text: "Ограниченные награды за участие в событиях сезона.", category: "eco", status: "plan", votes: 133 },
    ],
  },
  {
    id: "app",
    icon: "phone",
    name: "Патч «Приложение»",
    subtitle: "AniGalaxy в вашем кармане",
    status: "plan",
    eta: "2027-05-15T18:00:00",
    color: "#2aa7ff",
    features: [
      { title: "Мобильное приложение", icon: "phone", text: "Нативные клиенты для iOS и Android с синхронизацией.", category: "player", status: "plan", votes: 644 },
      { title: "Офлайн-загрузка серий", icon: "download", text: "Скачивайте серии и смотрите без интернета.", category: "player", status: "plan", votes: 418 },
      { title: "Картинка в картинке", icon: "picture", text: "Плавающее окно плеера поверх других приложений.", category: "player", status: "plan", votes: 226 },
    ],
  },
  {
    id: "pre",
    icon: "gem",
    name: "Патч «Престиж»",
    subtitle: "Статус, который видят все",
    status: "plan",
    eta: "2027-07-01T18:00:00",
    color: "#ff5c9d",
    features: [
      { title: "Система престижа", icon: "crown", text: "Сбросьте уровень ради уникального статуса и наград.", category: "profile", status: "plan", votes: 187 },
      { title: "CSS-кастомизация профиля", icon: "code", text: "Собственные цвета, анимации и шрифты на уровне 10 000.", category: "profile", status: "plan", votes: 359 },
      { title: "Уникальный статус", icon: "sparkles", text: "Особая отметка рядом с ником для лучших зрителей.", category: "social", status: "plan", votes: 142 },
    ],
  },
];

/** Функции с id `патч.индекс` — так же, как в макете */
export const FEATURES: RoadmapFeature[] = PATCHES.flatMap((patch) =>
  patch.features.map((feature, index) => ({ ...feature, id: `${patch.id}.${index}` })),
);

/** «Закрытая лаборатория»: открытая ячейка хранит подпись, пустая — замок */
export const LAB: string[] = ["Первый ключ", "", "", "", "", "", "", ""];

/** Патчи роадмапа: сколько готов�� / в работе / в планах */
export const PROGRESS = {
  done: SHIPPED.length + FEATURES.filter((item) => item.status === "done").length,
  wip: FEATURES.filter((item) => item.status === "wip").length,
  plan: FEATURES.filter((item) => item.status === "plan").length,
  total: SHIPPED.length + FEATURES.length,
};

/** Готовность патча в процентах: готовое — 100, в работе — его прогресс */
export function patchProgress(patch: RoadmapPatch): number {
  if (!patch.features.length) return 0;
  const sum = patch.features.reduce((acc, feature) => {
    if (feature.status === "done") return acc + 100;
    if (feature.status === "wip") return acc + (feature.progress ?? 0);
    return acc;
  }, 0);
  return Math.round(sum / patch.features.length);
}

/** Прогресс функции: готовое — 100, в работе — его прогресс */
export function featureProgress(feature: RoadmapFeature): number {
  if (feature.status === "done") return 100;
  if (feature.status === "wip") return feature.progress ?? 0;
  return 0;
}

/** Акценты темы страницы — как в макете */
export const THEMES: Record<string, { blue: string; violet: string; cyan: string }> = {
  galaxy: { blue: "#2aa7ff", violet: "#8b5cff", cyan: "#38e1ff" },
  violet: { blue: "#9b6bff", violet: "#ff5cc8", cyan: "#c9a6ff" },
  emerald: { blue: "#19d3a2", violet: "#2aa7ff", cyan: "#6dffd6" },
  sunset: { blue: "#ff8a4c", violet: "#ff4c8a", cyan: "#61d1ff" },
};

export const THEME_NAMES: Record<string, string> = {
  galaxy: "Галактика",
  violet: "Виолет",
  emerald: "Изумруд",
  sunset: "Закат",
};

/** Русские числительные */
export function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  const index =
    mod10 === 1 && mod100 !== 11
      ? 0
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)
        ? 1
        : 2;
  return forms[index];
}

const MONTHS = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

/** «5 ноября 2026» */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** «Q4 2026» */
export function formatQuarter(iso: string): string {
  const date = new Date(iso);
  const quarters = ["Q1", "Q1", "Q1", "Q2", "Q2", "Q2", "Q3", "Q3", "Q3", "Q4", "Q4", "Q4"];
  return `${quarters[date.getMonth()]} ${date.getFullYear()}`;
}