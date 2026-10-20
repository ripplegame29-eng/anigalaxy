/**
 * Отображаемое имя и его оформление — услуги «Смена ника» и «Цвет ника».
 *
 * Правила, палитры и цены взяты из макета «AniGalaxy — смена ника и цвет
 * ника». Модуль чистый: его считает и движок (сверка цены услуги), и окна,
 * и тесты. Ничего не хранит — за имя отвечает `lib/auth.ts`, за стиль
 * оформления `lib/profile.ts`.
 *
 * Отображаемое имя и логин — разные вещи: покупается именно имя, логин
 * (`@ник` для входа) и ссылка на профиль не меняются.
 */

/* ------------------------------- Правила -------------------------------- */

export const NICK_MIN = 3;
export const NICK_MAX = 20;

/** Буквы (латиница и кириллица), цифры и `_` — без пробелов и дефисов */
const NICK_RE = /^[A-Za-zА-Яа-яЁё0-9_]+$/;

const HEX_RE = /^#[0-9a-f]{6}$/i;

/** Цвет пригоден для оформления ника */
export function isNickColor(value: unknown): value is string {
  return typeof value === "string" && HEX_RE.test(value.trim());
}

/* -------------------------------- Стиль --------------------------------- */

export type NickMode = "def" | "solid" | "grad";

export interface NickStyle {
  /** `def` — без оформления, `solid` — цвет, `grad` — градиент */
  mode: NickMode;
  c1: string;
  c2: string;
  /** Градиент плавно бежит по нику */
  anim: boolean;
  /** Скорость переливания, с */
  sp: number;
  /** Мягкий ореол вокруг букв */
  glow: boolean;
}

/** Палитра из макета: 12 цветов */
export const NICK_PALETTE: readonly string[] = [
  "#ffffff",
  "#ff5d73",
  "#ff9f43",
  "#ffd32a",
  "#a3e635",
  "#34d399",
  "#22d3ee",
  "#3b9eff",
  "#8b5cf6",
  "#e879f9",
  "#f472b6",
  "#94a3b8",
];

export interface NickGradient {
  name: string;
  c1: string;
  c2: string;
}

/** Готовые градиенты из макета */
export const NICK_GRADIENTS: readonly NickGradient[] = [
  { name: "Закат", c1: "#ff5d73", c2: "#ffd32a" },
  { name: "Океан", c1: "#22d3ee", c2: "#2563eb" },
  { name: "Сакура", c1: "#f472b6", c2: "#a78bfa" },
  { name: "Неон", c1: "#34d399", c2: "#22d3ee" },
  { name: "Огонь", c1: "#ff9f43", c2: "#ef4444" },
  { name: "Галактика", c1: "#8b5cf6", c2: "#22d3ee" },
  { name: "Золото", c1: "#ffe9a0", c2: "#f5a623" },
  { name: "Мята", c1: "#a3e635", c2: "#06b6d4" },
];

/** Скорости переливания из макета, с */
export const NICK_SPEEDS: readonly number[] = [6, 3.5, 1.8];

export const NICK_SPEED_LABELS: readonly string[] = ["Медленно", "Средне", "Быстро"];

/** Стиль, когда оформления ещё нет */
export const DEFAULT_NICK_STYLE: NickStyle = {
  mode: "def",
  c1: "#3b9eff",
  c2: "#22d3ee",
  anim: false,
  sp: 3.5,
  glow: false,
};

/** С чего начинают в окне, если оформления ещё не было (макет: обычный синий) */
export const START_NICK_STYLE: NickStyle = { ...DEFAULT_NICK_STYLE, mode: "solid" };

/**
 * Приводит значение из хранилища к валидному стилю.
 *
 * В localStorage могло попасть что угодно: мусорный режим, не-цвет в `c1`,
 * скорость 0 или минус. Всё это молча ломало бы градиент, поэтому лишнее
 * заменяется значениями по умолчанию.
 */
export function normalizeNickStyle(raw: unknown): NickStyle {
  const value = (raw ?? {}) as Partial<NickStyle>;
  const mode: NickMode = value.mode === "solid" || value.mode === "grad" ? value.mode : "def";
  const sp = typeof value.sp === "number" && Number.isFinite(value.sp) && value.sp > 0 ? value.sp : 3.5;
  return {
    mode,
    c1: isNickColor(value.c1) ? value.c1.trim().toLowerCase() : DEFAULT_NICK_STYLE.c1,
    c2: isNickColor(value.c2) ? value.c2.trim().toLowerCase() : DEFAULT_NICK_STYLE.c2,
    anim: mode === "grad" && value.anim === true,
    sp,
    glow: value.glow === true,
  };
}

/**
 * Подпись стиля: два одинаковых оформления дают одну строку, и окно
 * понимает, что стиль уже применён («Уже применено»).
 */
export function nickSignature(style: NickStyle): string {
  if (style.mode === "grad") {
    return [style.mode, style.c1, style.c2, style.anim, style.sp, style.glow].join("|");
  }
  return [style.mode, style.c1, style.glow].join("|");
}

/* -------------------------------- Цена ---------------------------------- */

/** Наценки за опции оформления (AC) — те же числа, что в макете */
export interface NickAddons {
  gradient: number;
  flow: number;
  glow: number;
}

export const NICK_ADDONS: NickAddons = { gradient: 100, flow: 100, glow: 50 };

export interface NickCostLine {
  label: string;
  value: string;
  /** строка вычитается из итога (бонус Premium) */
  minus?: boolean;
}

/**
 * Итог услуги «Цвет ника»: базовая цена плюс наценки за опции.
 * Порядок сложения — как в макете: цвет, градиент, переливание, свечение.
 */
export function nickColorTotal(base: number, addons: NickAddons, style: NickStyle): number {
  return (
    base +
    (style.mode === "grad" ? addons.gradient : 0) +
    (style.mode === "grad" && style.anim ? addons.flow : 0) +
    (style.glow ? addons.glow : 0)
  );
}

/** Разбивка «К оплате» для окна цвета */
export function nickCostLines(
  base: number,
  addons: NickAddons,
  style: NickStyle,
  premiumFree = false,
): NickCostLine[] {
  const total = nickColorTotal(base, addons, style);
  const lines: NickCostLine[] = [{ label: "Цвет ника", value: `${base} АС` }];
  if (style.mode === "grad") lines.push({ label: "Градиент", value: `+${addons.gradient} АС` });
  if (style.mode === "grad" && style.anim) lines.push({ label: "Переливание", value: `+${addons.flow} АС` });
  if (style.glow) lines.push({ label: "Свечение", value: `+${addons.glow} АС` });
  if (premiumFree) lines.push({ label: "Бонус Premium", value: `−${total} АС`, minus: true });
  return lines;
}

/* ------------------------------ Проверка -------------------------------- */

export type NickCheckState = "idle" | "bad" | "ok";

export interface NickCheck {
  state: NickCheckState;
  message: string;
}

/**
 * Проверка нового имени по правилам макета: 3–20 символов, буквы, цифры и
 * `_`. Текущее имя отбраковывается отдельно — переименование «в то же самое»
 * не имеет смысла.
 */
export function checkNickname(value: string, current: string): NickCheck {
  const nick = value.trim();
  if (!nick) return { state: "idle", message: "Введи новый ник" };
  if (nick.length < NICK_MIN) return { state: "bad", message: `Минимум ${NICK_MIN} символа` };
  if (nick.length > NICK_MAX) return { state: "bad", message: `Максимум ${NICK_MAX} символов` };
  if (!NICK_RE.test(nick)) return { state: "bad", message: "Только буквы, цифры и «_», без пробелов" };
  if (current && nick.toLowerCase() === current.trim().toLowerCase()) {
    return { state: "bad", message: "Это твой текущий ник" };
  }
  return { state: "ok", message: "Ник свободен" };
}

/** Та же проверка строкой ошибки — её использует движок перед списанием */
export function displayNameError(value: string): string | null {
  const check = checkNickname(value, "");
  return check.state === "bad" ? check.message : null;
}

/* ------------------------------ Бонус ----------------------------------- */

export type NickBonusState = "none" | "available" | "used";

/**
 * Состояние баннера «Бонус Premium»: подписка даёт одну бесплатную смену
 * ника и одну бесплатную смену цвета, дальше — за AC.
 */
export function nickBonusState(premium: boolean, used: boolean): NickBonusState {
  if (!premium) return "none";
  return used ? "used" : "available";
}

export interface NickBonusText {
  title: string;
  note: string;
  on: boolean;
}

/** Тексты баннера бонуса из макета */
export function nickBonusText(state: NickBonusState, what: "смена ника" | "цвет ника"): NickBonusText {
  if (state === "available") {
    return { title: "Бонус Premium", note: `1 бесплатная ${what}`, on: true };
  }
  if (state === "used") {
    return { title: "Бонус уже использован", note: `Дальше ${what} за АС`, on: false };
  }
  return { title: "С Premium — бесплатно", note: `Первая ${what} без оплаты`, on: false };
}

/* ------------------------------ Разметка -------------------------------- */

export interface NickStyleProps {
  className: string;
  vars: Record<string, string>;
}

/**
 * Классы и переменные для отображения имени. Один источник правды для
 * превью в окнах и для самого профиля: иначе окно показывало бы один цвет,
 * а профиль — другой.
 */
export function nickStyleProps(style: NickStyle): NickStyleProps {
  const vars: Record<string, string> = { "--c1": style.c1, "--c2": style.c2, "--sp": `${style.sp}s` };
  let className = "nickname";
  if (style.mode === "grad") {
    className += style.anim ? " nick-grad nick-flow" : " nick-grad";
  } else if (style.mode === "solid") {
    vars.color = style.c1;
    className += " nick-solid";
  }
  if (style.glow) className += " nick-glow";
  return { className, vars };
}
