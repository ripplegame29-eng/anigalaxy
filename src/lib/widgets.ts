/**
 * Виджеты профиля — набор блоков, которые видит гость.
 *
 * До этого здесь была «Витрина»: до шести тайтлов из избранного, порядок
 * задавался только добавлением. Это отдельная, более простая сущность, и она
 * осталась на месте — просто вкладку теперь занимают виджеты.
 *
 * Виджет — не карточка, а запись в раскладке: { какой блок, какого размера }.
 * Сами данные блоков никуда не копируются и не дублируются: каждый виджет
 * читает собственные источники (история, прогресс, избранное) прямо при
 * отрисовке. Поэтому «Активность» не может разойтись с историей просмотра,
 * а «Достижения» — с достижениями.
 *
 * Ключи хранилища новые и не пересекаются со старыми: прежние данные витрины
 * (`profile.showcase`) остаются нетронутыми и не теряются.
 */

import { createLocalStore } from "./store";

export const WIDGETS_KEY = "animehub:widgets:v1";
export const WIDGETS_OPTS_KEY = "animehub:widgets:opts:v1";

export type WidgetId =
  /** Достижения: ранг, трофейный счёт, редкие */
  | "ach"
  /** Любимое: до пяти тайтлов */
  | "fav"
  /** Активность: тепловая карта дней просмотра */
  | "act"
  /** Неделя: серии по дням недели */
  | "week"
  /** Подборки */
  | "coll"
  /** Обо мне: подпись профиля */
  | "about"
  /** Хронология: последние просмотры (платный блок) */
  | "chrono"
  /** Студии (платный блок) */
  | "stud"
  /** Трофейная полка */
  | "shelf"
  /** Подарки */
  | "gifts"
  /** Совместимость (платный блок) */
  | "compat"
  /** Статистика: просмотрено, аниме, серии, достижения */
  | "stats"
  /** Тир-лист аниме: ряды S…F с постерами */
  | "tier";

/** `s` — 1×1, `l` — на всю ширину */
export type WidgetSize = "s" | "l";

export interface WidgetDef {
  id: WidgetId;
  title: string;
  /** Имя иконки из набора дизайна (рисуется компонентом) */
  icon: string;
  /** Размер, который блок занимает при добавлении */
  size: WidgetSize;
  /** Услуга в магазине, открывающая блок. Нет — блок бесплатный. */
  service?: string;
}

export const WIDGETS: WidgetDef[] = [
  { id: "ach", title: "Достижения", icon: "trophy", size: "l" },
  { id: "act", title: "Активность", icon: "bolt", size: "l" },
  { id: "fav", title: "Любимое", icon: "heart", size: "l" },
  { id: "week", title: "Неделя", icon: "chart", size: "s" },
  { id: "coll", title: "Подборки", icon: "layers", size: "s" },
  { id: "about", title: "Обо мне", icon: "user", size: "s" },
  { id: "chrono", title: "Хронология", icon: "clock", size: "s", service: "svc_widgets_chrono" },
  { id: "stud", title: "Студии", icon: "film", size: "s", service: "svc_widgets_studios" },
  { id: "shelf", title: "Трофейная полка", icon: "star", size: "s" },
  { id: "gifts", title: "Подарки", icon: "gift", size: "s" },
  { id: "compat", title: "Совместимость", icon: "link", size: "s", service: "svc_widgets_compat" },
  { id: "stats", title: "Статистика", icon: "chart", size: "l" },
  { id: "tier", title: "Тир-лист", icon: "tier", size: "l" },
];

export const WIDGET_BY_ID: Record<WidgetId, WidgetDef> = Object.fromEntries(
  WIDGETS.map((item) => [item.id, item]),
) as Record<WidgetId, WidgetDef>;

/**
 * Ячейка витрины. Этот же список читает главная страница: блок, добавленный
 * в разделе «Виджеты», показывается и там. Отдельного списка для главной нет
 * намеренно — с двумя списками один и тот же блок можно было бы оставить на
 * главной, сняв его с витрины, и тогда снять его уже было бы нечем.
 */
export interface WidgetSlot {
  id: WidgetId;
  w: WidgetSize;
}

export interface WidgetOptions {
  /** Кольцо вокруг списков — тонкая рамка вместо сплошной */
  rings: boolean;
  /** Разделители между блоками */
  sep: boolean;
}

/**
 * Раскладка по умолчанию. Совпадает с порядком макета: сперва то, что
 * показывает масштаб профиля, потом мелочи.
 */
export const DEFAULT_LAYOUT: WidgetSlot[] = [
  { id: "ach", w: "l" },
  { id: "act", w: "l" },
  { id: "fav", w: "l" },
  { id: "week", w: "s" },
  { id: "coll", w: "s" },
  { id: "about", w: "s" },
];

export const DEFAULT_OPTIONS: WidgetOptions = { rings: true, sep: false };

/** Максимум блоков на витрине — чтобы профиль не превращался в длинный список */
export const MAX_WIDGETS = 12;

/**
 * Разбор сохранённой раскладки.
 *
 * Стор передаёт парсеру СЫРУЮ строку из localStorage, а не готовый объект,
 * поэтому разбираем JSON здесь. Если забыть это, `Array.isArray("...")`
 * всегда даёт false и виджеты молча возвращаются к раскладке по умолчанию:
 * пользователь сохраняет, перезагружает — и ничего не меняется.
 */
function parseLayout(raw: string): WidgetSlot[] | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(value)) return null;
  const out: WidgetSlot[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const slot = item as { id?: unknown; w?: unknown };
    if (typeof slot.id !== "string" || !(slot.id in WIDGET_BY_ID)) continue;
    // Дубли отбрасываем: один и тот же блок дважды смысла не имеет,
    // а в сетке он бы лёг в две ячейки и путал счётчик
    if (out.some((existing) => existing.id === slot.id)) continue;
    out.push({ id: slot.id as WidgetId, w: slot.w === "l" ? "l" : "s" });
    if (out.length >= MAX_WIDGETS) break;
  }
  // Пустая раскладка — не ошибка: пользователь мог убрать всё. Отличаем
  // «ещё не настраивал» (null) от «убрал всё» ([]).
  return out;
}

/** Разбор настроек витрины. По той же причине — из строки, а не из объекта. */
function parseOptions(raw: string): WidgetOptions | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Partial<WidgetOptions>;
  return { rings: item.rings !== false, sep: item.sep === true };
}

const layoutStore = createLocalStore<WidgetSlot[]>(WIDGETS_KEY, DEFAULT_LAYOUT, parseLayout);
const optionsStore = createLocalStore<WidgetOptions>(WIDGETS_OPTS_KEY, DEFAULT_OPTIONS, parseOptions);

export function readWidgetLayout(): WidgetSlot[] {
  return layoutStore.get();
}

export function readWidgetOptions(): WidgetOptions {
  return optionsStore.get();
}

export function saveWidgetLayout(layout: WidgetSlot[]): void {
  layoutStore.set(layout.slice(0, MAX_WIDGETS));
}

export function saveWidgetOptions(options: WidgetOptions): void {
  optionsStore.set(options);
}

/** Есть ли покупка услуги — по журналу покупок движка, а не по своему флагу */
export function isWidgetUnlocked(def: WidgetDef, purchases: { itemId: string }[]): boolean {
  if (!def.service) return true;
  return purchases.some((item) => item.itemId === def.service);
}

/** Цена блока в AC. Ноль — блок бесплатный. */
export function widgetPrice(def: WidgetDef, shopPrice: (id: string) => number): number {
  return def.service ? shopPrice(def.service) : 0;
}