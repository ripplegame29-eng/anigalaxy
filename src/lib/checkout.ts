/**
 * Глобальное окно оплаты. Любая кнопка «купить за деньги» вызывает
 * `openCheckout({...})`; окно живёт в шапке (HeaderShell) и общее на сайт.
 * Платёжный шлюз пока не подключён: `onPaid` вызывается после подтверждения
 * в окне (демо-режим), деньги не списываются.
 */
export interface CheckoutOrder {
  /** Что покупаем: «Premium · 3 месяца», «Боевой пропуск» */
  title: string;
  /** Короткая подпись под названием */
  caption?: string;
  /** Цена в рублях */
  price: number;
  /** До скидки, ₽ (необязательно) */
  oldPrice?: number;
  /** Что получит покупатель — 2–4 коротких строки */
  perks?: string[];
  /** Вызывается после успешной оплаты */
  onPaid: () => void;
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
