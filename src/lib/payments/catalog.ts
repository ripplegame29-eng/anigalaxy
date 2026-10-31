/**
 * Каталог товаров AniGalaxy.
 *
 * Цены и состав покупок живут только здесь: браузер присылает `productId`,
 * а сервер сам находит товар и считает сумму. Клиентская цена из окна оплаты
 * не участвует в заказе, поэтому подменить её запросом нельзя.
 *
 * Модуль общий для клиента и сервера — без Node.js-модулей и секретов.
 */

export type ProductKind = "premium" | "battlepass" | "coins" | "donation" | "gift";

export interface PaymentProduct {
  id: string;
  kind: ProductKind;
  /** Название для платёжной формы */
  title: string;
  /** Цена в рублях */
  price: number;
  /** Старая цена для витрины */
  oldPrice?: number;
  /** Сколько дней Premium выдаётся после оплаты */
  premiumDays?: number;
  /** Сколько AC выдаётся после оплаты */
  ac?: number;
  /** Тег, который открывается вместе с покупкой */
  tag?: string;
  /** Эффект оформления профиля */
  effect?: string;
  /** У донатов AC можно не начислять (переключатель «С набором / Сейчас») */
  optionalAc?: boolean;
  /** Товар-подарок: количество и промокод считаются отдельно */
  gift?: boolean;
  /** Короткое название тарифа для карточки подарка */
  giftTitle?: string;
}

const product = (value: PaymentProduct): PaymentProduct => value;

export const PRODUCTS: Record<string, PaymentProduct> = {
  "premium-month": product({
    id: "premium-month",
    kind: "premium",
    title: "Premium · Месяц",
    price: 99,
    oldPrice: 149,
    premiumDays: 30,
  }),
  "premium-quarter": product({
    id: "premium-quarter",
    kind: "premium",
    title: "Premium · 3 месяца",
    price: 249,
    oldPrice: 447,
    premiumDays: 90,
  }),
  "premium-year": product({
    id: "premium-year",
    kind: "premium",
    title: "Premium · Год",
    price: 1190,
    oldPrice: 2390,
    premiumDays: 365,
  }),
  battlepass: product({
    id: "battlepass",
    kind: "battlepass",
    title: "Боевой пропуск",
    price: 1190,
  }),

  "coins-small-chest": product({
    id: "coins-small-chest",
    kind: "coins",
    title: "Пакет AC · Маленький сундук",
    price: 69,
    ac: 640,
  }),
  "coins-stack": product({
    id: "coins-stack",
    kind: "coins",
    title: "Пакет AC · Стопка",
    price: 179,
    ac: 2400,
  }),
  "coins-bag": product({
    id: "coins-bag",
    kind: "coins",
    title: "Пакет AC · Мешок",
    price: 349,
    ac: 5600,
  }),
  "coins-chest": product({
    id: "coins-chest",
    kind: "coins",
    title: "Пакет AC · Сундук",
    price: 749,
    ac: 14400,
  }),
  "coins-vault": product({
    id: "coins-vault",
    kind: "coins",
    title: "Пакет AC · Хранилище",
    price: 1490,
    oldPrice: 1790,
    ac: 32000,
  }),
  "coins-treasury": product({
    id: "coins-treasury",
    kind: "coins",
    title: "Пакет AC · Сокровищница",
    price: 2290,
    ac: 54400,
  }),

  "donate-start": product({
    id: "donate-start",
    kind: "donation",
    title: "Поддержка · Старт",
    price: 199,
    ac: 1200,
    premiumDays: 30,
    optionalAc: true,
    tag: "t-donater",
  }),
  "donate-action": product({
    id: "donate-action",
    kind: "donation",
    title: "Поддержка · Акционный набор",
    price: 499,
    ac: 2000,
    premiumDays: 180,
    optionalAc: true,
    tag: "t-donater",
    effect: "fx_style_glitch",
  }),
  "donate-space": product({
    id: "donate-space",
    kind: "donation",
    title: "Поддержка · Космос",
    price: 999,
    ac: 4000,
    premiumDays: 365,
    optionalAc: true,
    tag: "t-donater",
    effect: "fx_style_glitch",
  }),

  "gift-month": product({
    id: "gift-month",
    kind: "gift",
    title: "Подарок Premium · 1 месяц",
    price: 99,
    premiumDays: 30,
    gift: true,
    giftTitle: "1 месяц",
  }),
  "gift-quarter": product({
    id: "gift-quarter",
    kind: "gift",
    title: "Подарок Premium · 3 месяца",
    price: 249,
    premiumDays: 90,
    gift: true,
    giftTitle: "3 месяца",
  }),
  "gift-year": product({
    id: "gift-year",
    kind: "gift",
    title: "Подарок Premium · 1 год",
    price: 1190,
    premiumDays: 365,
    gift: true,
    giftTitle: "1 год",
  }),
};

export const GIFT_PRODUCTS: PaymentProduct[] = ["gift-month", "gift-quarter", "gift-year"]
  .map((id) => PRODUCTS[id])
  .filter(Boolean);

/** Скидки за количество подарков: от большего объёма к меньшему */
export const GIFT_VOLUME_DISCOUNTS: ReadonlyArray<readonly [number, number]> = [
  [100, 30],
  [50, 25],
  [25, 20],
  [10, 15],
  [3, 5],
];

export const GIFT_PROMO_CODES: Record<string, number> = {
  GALAXY10: 10,
  SAKURA15: 15,
  ANIME20: 20,
};

export const GIFT_MAX_COUNT = 800;

export function giftVolumeDiscount(count: number): number {
  for (const [from, discount] of GIFT_VOLUME_DISCOUNTS) {
    if (count >= from) return discount;
  }
  return 0;
}

export function normalizePromoCode(code: string): string {
  return code.trim().toUpperCase();
}

export function giftPromoDiscount(code: string): number {
  const clean = normalizePromoCode(code);
  return clean ? GIFT_PROMO_CODES[clean] ?? 0 : 0;
}

/**
 * Стоимость подарка. null — товар не подарок, количество вне диапазона или
 * промокод неизвестен. Клиент и сервер вызывают одну и ту же функцию.
 */
export function giftPrice(productId: string, count: number, promoCode = ""): number | null {
  const item = PRODUCTS[productId];
  if (!item || item.kind !== "gift") return null;
  if (!Number.isFinite(count)) return null;
  const n = Math.round(count);
  if (n < 1 || n > GIFT_MAX_COUNT) return null;
  const clean = normalizePromoCode(promoCode);
  if (clean && !GIFT_PROMO_CODES[clean]) return null;
  const volume = giftVolumeDiscount(n);
  const promo = clean ? GIFT_PROMO_CODES[clean] : 0;
  return Math.round(item.price * n * (1 - volume / 100) * (1 - promo / 100));
}

/** Сумма заказа: для обычных товаров — цена каталога, для подарков — с объёмом и промокодом */
export function orderPrice(productId: string, opts: { count?: number; promoCode?: string } = {}): number | null {
  const item = PRODUCTS[productId];
  if (!item) return null;
  if (item.kind === "gift") return giftPrice(item.id, opts.count ?? 1, opts.promoCode ?? "");
  return item.price;
}
