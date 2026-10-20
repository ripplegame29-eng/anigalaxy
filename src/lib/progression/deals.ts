/**
 * Витрина дня: один предмет в сутки со скидкой.
 *
 * Модуль чистый и без React — его читает и движок (проверка цены), и витрина
 * (плашка с таймером). Это обязательно: если бы выбор предмета и скидка
 * считались в компоненте, движок продолжал бы сверять цену с конфигом и
 * отклонял бы покупку как price_mismatch — то есть скидка была бы нарисована
 * на кнопке и не сработала бы никогда.
 *
 * Выбор детерминированный: он зависит только от номера суток и конфига, поэтому
 * вкладка, перезагрузка и движок видят один и тот же предмет. Никаких random
 * и никакого хранения в localStorage: состояние восстанавливается само.
 */

import type { ShopItem } from "./types";

/** Скидка витрины дня */
export const DEAL_PERCENT = 30;

/** Наценка до скидки в промилле — чтобы не плодить float в конфиге */
const DISCOUNT_NUM = (100 - DEAL_PERCENT) / 100;

/**
 * Категории, которые могут попасть в витрину дня.
 *
 * Службы и кастомизация сюда не берутся: у них нет предмета в гардеробе,
 * покупка разовая, и «скидка на заморозку серии» выглядела бы нелепо.
 */
const DEAL_KINDS = new Set<ShopItem["kind"]>([
  "tag",
  "frame",
  "background",
  "title",
]);

/**
 * Номер суток по местному времени.
 *
 * По UTC номер дня едет на 1 при переходе через полночь по Moscow, и у
 * человека в акции вдруг менялся бы товар в неподходящий момент. Сутки
 * считаем по локальному календарю — тем же, по которому человек смотрит
 * на таймер.
 */
export function dayIndex(now: number): number {
  const d = new Date(now);
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60_000) / 86_400_000);
}

/** Полночь, которой заканчиваются сутки */
export function dealEndsAt(now: number): number {
  const d = new Date(now);
  d.setHours(24, 0, 0, 0);
  return d.getTime();
}

/**
 * Детерминированный псевдослучайный выбор из массива по двум числам.
 * Не крипто и не нужно: важно только, чтобы при одинаковых входных данных
 * выбор был одинаковым в интерфейсе и в движке.
 */
function pick<T>(items: T[], day: number, salt: number): T {
  let h = (Math.imul(day, 2654435761) + Math.imul(salt, 40503)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0;
  const index = ((h ^ (h >>> 16)) >>> 0) % items.length;
  return items[index];
}

/** Цена со скидкой — округление вниз, как и в движке (Math.floor) */
export function dealPrice(price: number): number {
  return Math.floor(price * DISCOUNT_NUM);
}

export interface DailyDeal {
  item: ShopItem;
  /** Цена сегодня, по ней и покупаем */
  price: number;
  /** Обычная цена — показываем зачёркнутой */
  oldPrice: number;
  /** Когда скидка закончится */
  endsAt: number;
}

/**
 * Витрина дня на момент `now` либо null, если кандидатов нет.
 */
export function dailyDeal(items: ShopItem[], now: number): DailyDeal | null {
  const pool = items.filter(
    (item) =>
      item.enabled !== false &&
      DEAL_KINDS.has(item.kind) &&
      // одноразовые и только одноразовые: повторяемую скидку не показываем
      (item.maxOwned ?? 1) === 1 &&
      item.price >= 100,
  );
  if (!pool.length) return null;

  const item = pick(pool, dayIndex(now), pool.length);
  return {
    item,
    price: dealPrice(item.price),
    oldPrice: item.price,
    endsAt: dealEndsAt(now),
  };
}

/**
 * Цена, которую движок готов принять за этот предмет прямо сейчас.
 *
 * Возвращает скидочную цену только для сегодняшнего витринного предмета: для
 * всех остальных действует обычная цена из конфига, и клиент не может
 * «подсунуть» свою скидку — цена считается на сервере по тем же правилам.
 */
export function expectedPrice(items: ShopItem[], itemId: string, now: number): number {
  const item = items.find((entry) => entry.id === itemId);
  if (!item) return -1;
  const deal = dailyDeal(items, now);
  if (deal && deal.item.id === itemId) return deal.price;
  return item.price;
}
