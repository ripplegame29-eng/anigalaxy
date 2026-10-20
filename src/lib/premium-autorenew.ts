"use client";

/**
 * Автопродление подписки — настройка браузера.
 *
 * Проект без платёжки: денег мы не списываем и подтверждений ни от кого не
 * ждём. Переключатель честно делает ровно одно — если срок подписки истёк, а
 * автопродление включено, подписка продлевается ещё на AUTORENEW_DAYS дней.
 * Раньше такой тумблер был бы обещанием без механики, а такие обещания в
 * проекте уже приводили к пунктам «4K-качество», которых плеер не делал.
 *
 * Продление срабатывает при открытии страницы Premium: без платёжки и без
 * сервера иначе не узнать, что подписка кончилась.
 */

import { activatePremium, isPremiumActive, readAccount, type Account } from "./auth";

const KEY = "anigalaxy:premium-autorenew:v1";

/** Сколько дней добавляет одно автопродление */
export const AUTORENEW_DAYS = 30;

/**
 * Включено ли автопродление. По умолчанию — нет: без платёжки «продление»
 * означало бы бесплатную выдачу подписки, о которой никто не просил.
 * Игрок включает тумблер сам.
 */
export function autoRenewEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setAutoRenew(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* приватный режим: переключатель просто не запомнится до перезагрузки */
  }
}

/**
 * Продлить истёкшую подписку, если автопродление включено.
 *
 * Возвращает новый аккаунт, когда продление случилось, иначе null.
 */
export function applyAutoRenew(): Account | null {
  const account = readAccount();
  if (!account) return null;
  if (isPremiumActive(account)) return null;
  if (!autoRenewEnabled()) return null;
  return activatePremium(AUTORENEW_DAYS);
}
