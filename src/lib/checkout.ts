/**
 * Глобальное окно оплаты. Любая кнопка «купить за деньги» вызывает
 * `openCheckout({...})`; окно живёт в шапке (HeaderShell) и общее на сайт.
 *
 * Здесь только описание товара для витрины. Сервер сам находит товар по
 * `productId`, считает цену и создаёт платёж Platega. Клиентская цена нужна
 * для показа и никогда не участвует в заказе.
 */
export interface CheckoutGift {
  mode: "friend" | "random";
  /** Ник получателя для режима «другу» */
  recipient?: string;
  /** Сколько подарков для режима «случайным зрителям» */
  count?: number;
  /** Промокод на скидку */
  promoCode?: string;
  /** Когда доставить подарок, мс; пусто — сразу */
  deliverAt?: number;
}

export interface CheckoutOrder {
  /** id товара из общего каталога `lib/payments/catalog` */
  productId: string;
  /** Что покупаем: «Premium · 3 месяца», «Боевой пропуск» */
  title: string;
  /** Короткая подпись под названием */
  caption?: string;
  /** Цена в рублях для показа */
  price: number;
  /** До скидки, ₽ (необязательно) */
  oldPrice?: number;
  /** Что получит покупатель — 2–4 коротких строки */
  perks?: string[];
  /** Донат: начислять ли AC вместе с Premium */
  withPack?: boolean;
  /** Параметры подарка Premium */
  gift?: CheckoutGift;
  /** Устаревший колбэк для демо-режима */
  onPaid?: () => void;
}

export interface CheckoutState {
  open: boolean;
  order: CheckoutOrder | null;
  /** Номер «билета» — генерируется один раз при открытии окна */
  serial: string;
}

const CLOSED: CheckoutState = { open: false, order: null, serial: "" };
let state: CheckoutState = CLOSED;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const subscribeCheckout = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
export const getCheckoutState = () => state;
export const getServerCheckoutState = () => CLOSED;

export function openCheckout(order: CheckoutOrder): void {
  state = { open: true, order, serial: Math.random().toString(36).slice(2, 8).toUpperCase() };
  emit();
}
export function closeCheckout(): void {
  if (!state.open) return;
  state = CLOSED;
  emit();
}
