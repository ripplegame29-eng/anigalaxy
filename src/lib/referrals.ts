/**
 * Реферальные ссылки и учёт приглашений.
 *
 * Как это работает в режиме local (сервера у проекта нет):
 *  - у каждого аккаунта есть свой код, он же часть ссылки `/?ref=КОД`;
 *  - при регистрации код из адресной строки запоминается у новичка
 *    (`REFERRED_KEY`) и уходит в движок событием `REFERRAL_REGISTERED` —
 *    тот начисляет награду пригласившему и пишет запись в журнал;
 *  - список «мои приглашения» хранится локально (`REF_KEY`) и показывается
 *    в разделе «Пригласи друзей».
 *
 * Честная оговорка: без сервера приглашение, сделанное с ДРУГОГО устройства,
 * сюда не попадёт — у каждого браузера своя база. Поэтому «топ месяца»
 * показывает приглашения с этого устройства, а не весь сайт. Это подписано
 * прямо в интерфейсе, чтобы не выдавать локальное за общее.
 */

import { useSyncExternalStore } from "react";
import { PROGRESSION_CONFIG } from "./progression/progression.config";
import { createLocalStore } from "./store";
import { progressEmit } from "./progression/events";
import { activatePremium, readAccount } from "./auth";

/** Ключ списка моих приглашений */
export const REF_KEY = "animehub:refs:v1";
/** Ключ «меня пригласил такой-то код» */
export const REFERRED_KEY = "animehub:referred-by:v1";
/**
 * Ключ очереди приглашений: код пригласившего → сколько людей ещё не получили награду.
 *
 * Зачем очередь: пригласивший — это другой человек с другого устройства, и в
 * момент регистрации новичка его аккаунт здесь недоступен. Поэтому приглашение
 * сначала складывается в очередь под своим кодом, а награда начисляется, когда
 * владелец кода сам откроет приложение (`flushReferralPremium`).
 */
export const PENDING_REF_KEY = "animehub:ref-pending:v1";

/** Сколько дней Premium даёт одно приглашение — из конфига экономики */
export const REFERRAL_PREMIUM_DAYS = PROGRESSION_CONFIG.economy.referralPremiumDays;

export interface ReferralEntry {
  /** Код пригласившего */
  code: string;
  /** Ник приглашённого */
  nick: string;
  /** Когда зарегистрировался, мс */
  at: number;
}

export interface ReferredBy {
  code: string;
  at: number;
}

/**
 * Реферальный код аккаунта.
 *
 * Строится из ника и даты создания: ник даёт узнаваемость («TEST1234»),
 * хвост из `createdAt` — уникальность, чтобы два аккаунта с одинаковым ником
 * не получили один код. Только латиница и цифры — код живёт в URL.
 */
/**
 * Кириллица → латиница.
 *
 * Ник может быть на русском, а реферальный код живёт в URL и должен быть
 * из латиницы и цифр. Без транслитерации ник «Иван» превращался бы в
 * четырёхсимвольный хвост от `createdAt` — и ссылка выглядела бы сломанной.
 */
const CYRILLIC: Record<string, string> = {
  а: "A", б: "B", в: "V", г: "G", д: "D", е: "E", ё: "E", ж: "ZH", з: "Z",
  и: "I", й: "I", к: "K", л: "L", м: "M", н: "N", о: "O", п: "P", р: "R",
  с: "S", т: "T", у: "U", ф: "F", х: "H", ц: "TS", ч: "CH", ш: "SH", щ: "SCH",
  ъ: "", ы: "Y", ь: "", э: "E", ю: "YU", я: "YA",
};

function transliterate(value: string): string {
  return value
    .toLowerCase()
    .split("")
    .map((ch) => CYRILLIC[ch] ?? ch)
    .join("");
}

export function refCodeFor(account: { nickname?: string; createdAt?: number } | null): string {
  const base = transliterate(account?.nickname ?? "guest")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
  const tail = (account?.createdAt ?? 0).toString(36).toUpperCase().slice(-4);
  return `${base}${tail}` || "ANIGALAXY";
}

/**
 * Ссылка для приглашения.
 *
 * Всегда относительная: на сервере `window` нет, и абсолютный адрес
 * получился бы другим, чем на клиенте — расхождение при гидрации.
 * Полный URL собирается в момент копирования (см. `absoluteRefLink`), когда
 * origin точно есть и различать его больше не нужно.
 */
export function refLink(code: string): string {
  return `/?ref=${encodeURIComponent(code)}`;
}

/** Полный адрес для буфера обмена — только по клику, в браузере */
export function absoluteRefLink(code: string): string {
  if (typeof window === "undefined") return refLink(code);
  return `${window.location.origin}${refLink(code)}`;
}

/* ------------------------------ Хранилища -------------------------------- */

const refStore = createLocalStore<Record<string, ReferralEntry[]>>(REF_KEY, {});
const referredStore = createLocalStore<ReferredBy | null>(REFERRED_KEY, null);
const pendingStore = createLocalStore<Record<string, number>>(PENDING_REF_KEY, {});

export function useMyReferrals(): ReferralEntry[] {
  const map = useSyncExternalStore(refStore.subscribe, refStore.get, refStore.getServer);
  return Object.values(map)
    .flat()
    .sort((a, b) => b.at - a.at);
}

export function useReferrer(): ReferredBy | null {
  return useSyncExternalStore(referredStore.subscribe, referredStore.get, referredStore.getServer);
}

/* ------------------------------ Действия --------------------------------- */

/**
 * Зафиксировать приглашение при регистрации.
 *
 * Вызывается из `registerAccount` сразу после создания аккаунта. Код берём
 * из `?ref=` в адресной строке; если его нет или это собственный код —
 * ничего не делаем. Награда уходит движку, он же проверит идемпотентность.
 */
export function captureReferralOnRegister(nick: string): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const code = (params.get("ref") ?? "").trim().toUpperCase();
  if (!code) return;

  // Свой код не считаем: иначе можно было бы приглашать самого себя
  const me = readAccount();
  if (me && refCodeFor(me) === code) return;

  const entry: ReferralEntry = { code, nick, at: Date.now() };
  const current = referredStore.get();
  if (!current || current.code !== code) referredStore.set({ code, at: entry.at });

  const mine = refStore.get();
  const list = mine[code] ?? [];
  // Тот же ник по той же ссылке не должен множиться
  if (!list.some((item) => item.nick === nick)) {
    refStore.set({ ...mine, [code]: [...list, entry] });
  }

  // Награда пригласившему — в очередь под его кодом: его аккаунт на этом
  // устройстве недоступен, и начислим мы её, когда он сам откроет приложение
  const pending = pendingStore.get();
  pendingStore.set({ ...pending, [code]: (pending[code] ?? 0) + 1 });

  progressEmit({ type: "REFERRAL_REGISTERED", refCode: code, newNick: nick });
}

/** Сколько приглашений начислено за всё время (для статистики) */
export function referralCount(): number {
  return Object.values(refStore.get()).reduce((sum, list) => sum + list.length, 0);
}

/**
 * Сколько приглашений было в этом месяце.
 *
 * Читает стор напрямую, без хука: список нужен и в разметке, и в
 * вычислениях внутри компонентов, а `useMyReferrals()` там запрещён
 * правилом хуков.
 */
/**
 * Начислить пригласившему дни Premium из очереди.
 *
 * Вызывается при старте приложения: владелец кода открыл сайт, и все
 * приглашения по его ссылке, накопившиеся с других устройств, превращаются в
 * дни подписки. Идемпотентно по построению: начислили — запись из очереди
 * убрана, повторный вызов ничего не сделает.
 *
 * Возвращает, сколько дней и за сколько приглашений начислено (null — нечего).
 */
export function flushReferralPremium(): { days: number; credited: number } | null {
  const account = readAccount();
  if (!account) return null;

  const code = refCodeFor(account);
  const pending = pendingStore.get();
  const count = pending[code] ?? 0;
  if (count <= 0) return null;

  const days = count * REFERRAL_PREMIUM_DAYS;
  activatePremium(days);
  const rest = { ...pending };
  delete rest[code];
  // Ключ убираем совсем, а не оставляем пустой объект: мусор в хранилище
  if (Object.keys(rest).length === 0) pendingStore.remove();
  else pendingStore.set(rest);
  return { days, credited: count };
}

/** Сколько приглашений ждёт награды по моему коду (для подписи в UI) */
export function pendingReferralCount(): number {
  const account = readAccount();
  if (!account) return 0;
  return pendingStore.get()[refCodeFor(account)] ?? 0;
}

export function referralsThisMonth(now = Date.now()): ReferralEntry[] {
  const d = new Date(now);
  const month = d.getMonth();
  const year = d.getFullYear();
  const all = Object.values(refStore.get())
    .flat()
    .sort((a, b) => b.at - a.at);
  return all.filter((item) => {
    const t = new Date(item.at);
    return t.getMonth() === month && t.getFullYear() === year;
  });
}