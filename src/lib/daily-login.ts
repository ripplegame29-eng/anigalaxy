"use client";

/**
 * Ежедневный вход — календарь месяца по макету
 * `AniGalaxy · Ежедневный вход.html`.
 *
 * Ячейки месяца настоящие: день N месяца даёт свою награду по таблице,
 * начисление идёт в профиль через `addCoins`/`addXp`, множитель ×2 — тот же
 * `PREMIUM_QUEST_MULT`, что и у квестов. Пропущенные дни можно вернуть
 * попытками (их три на месяц) — тоже по-настоящему: догоняются ячейки.
 *
 * AC в макете называются аникоинами; в проекте это атомы (`progress.acBalance`),
 * но в интерфейсе везде пишем коротко — AC.
 */

import { createLocalStore } from "./store";
import { addCoins, addXp, purchaseItem } from "./profile";
import { syncLegacyDelta } from "./progression/service";
import { FRAMES } from "./cosmetics";
import { PREMIUM_QUEST_MULT } from "./premium-perks";

export type DailyKind = "ac" | "exp" | "box" | "frame" | "grand" | "skip";

export interface DailyCell {
  day: number;
  kind: DailyKind;
  /** Аникоины / EXP / «N дн.» пропуска — по виду ячейки */
  amount: number;
}

export interface DailyMonth {
  /** 1…12 */
  month: number;
  year: number;
  /** Сколько дней в месяце */
  days: number;
  cells: DailyCell[];
}

/** Сколько попыток «вернуть пропуск» есть на месяц */
export const DAILY_CATCHUPS = 3;

/** Попытки возврата, накопленные с начала месяца */
export const DAILY_CATCHUP_BASE = 10;

/** Награда за вход сама по себе — «+10 аникоинов за вход» из макета */
export const DAILY_ENTRY_AC = 10;

/** Главный приз месяца */
const GRAND_AC = 400;

const KEY = "animehub:daily-login:v2";

export interface DailyState {
  /** Ключ месяца, к которому относится счётчик: YYYY-MM */
  month: string;
  /**
   * Сколько ячеек открыто (забрано). Оставлено для совместимости со старой
   * версией стора: источник правды — `days`, а не непрерывный счётчик.
   */
  claimed: number;
  /** Какие именно дни месяца уже забраны (1-based). Пропуски — дырки в наборе */
  days: number[];
  /** Потраченные попытки возврата в этом месяце */
  catchups: number;
  /** Ключи месяцев, где пропущены дни */
  missedIn: string[];
  /** Автосбор включён */
  auto: boolean;
}

const EMPTY: DailyState = {
  month: "",
  claimed: 0,
  days: [],
  catchups: 0,
  missedIn: [],
  auto: false,
};

const monthKey = (date = new Date()): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const todayOf = (): number => new Date().getDate();

function parse(raw: string): DailyState | null {
  try {
    const value = JSON.parse(raw) as Partial<DailyState>;
    if (!value || typeof value !== "object") return null;
    const claimed = Number.isFinite(value.claimed)
      ? Math.max(0, Math.round(value.claimed as number))
      : 0;
    // Старые сохранения знали только непрерывный счётчик: достраиваем набор
    // дней 1…claimed, чтобы переход не сбросил уже полученные награды.
    const days = Array.isArray(value.days)
      ? [...new Set(value.days.filter((d): d is number => Number.isInteger(d) && d > 0))].sort(
          (a, b) => a - b,
        )
      : Array.from({ length: claimed }, (_, i) => i + 1);
    return {
      month: typeof value.month === "string" ? value.month : "",
      claimed,
      days,
      catchups: Number.isFinite(value.catchups) ? Math.max(0, Math.round(value.catchups as number)) : 0,
      missedIn: Array.isArray(value.missedIn) ? value.missedIn.filter((d) => typeof d === "string") : [],
      auto: value.auto === true,
    };
  } catch {
    return null;
  }
}

const store = createLocalStore<DailyState>(KEY, EMPTY, parse);

/**
 * Награда дня N. Числа — из макета (80/100/120/140/160 аникоинов, EXP на
 * 3/10/20/27-м днях, коробки по понедельникам 7/21/28, рамка аватара 14-го
 * и гранд 31-го), пропуски Premium-дней — на 9-м и 23-м.
 */
export function dailyCell(day: number): DailyCell {
  /* 14-й день в макете — рамка аватара, а не коробка */
  if (day === 14) return { day, kind: "frame", amount: 0 };
  /* Коробки правда открываются: сумма лежит в ячейке, а не только в подписи */
  if (day === 7 || day === 21 || day === 28) {
    return { day, kind: "box", amount: day === 7 ? 40 : day === 21 ? 60 : 80 };
  }
  if (day === 31) return { day, kind: "grand", amount: GRAND_AC };
  if (day === 3 || day === 10 || day === 20 || day === 27) {
    return { day, kind: "exp", amount: day === 3 ? 600 : day === 10 ? 600 : day === 20 ? 1000 : 1200 };
  }
  if (day === 9 || day === 23) return { day, kind: "skip", amount: day === 9 ? 1 : 3 };
  const base = day <= 7 ? 15 : day <= 14 ? 20 : day <= 19 ? 25 : day <= 26 ? 30 : 35;
  return { day, kind: "ac", amount: base };
}

/** Средний дневной доход AC от календаря входа (31-дневный месяц, без Premium) */
export function dailyCalendarAvgAc(): number {
  let sum = 0;
  for (let day = 1; day <= 31; day += 1) {
    const cell = dailyCell(day);
    if (cell.kind === "ac" || cell.kind === "box" || cell.kind === "grand") sum += cell.amount;
  }
  return Math.round(sum / 31);
}

/** Текущий месяц с готовой сеткой ячеек */
export function dailyMonth(date = new Date()): DailyMonth {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const days = new Date(year, month, 0).getDate();
  const cells: DailyCell[] = [];
  for (let day = 1; day <= days; day += 1) cells.push(dailyCell(day));
  /* Гранд — главный приз месяца, а не приз «31-го числа»: в феврале и
     30-дневных месяцах 31-го просто нет, и гранд не выпадал бы никогда. */
  if (days < 31) cells[days - 1] = { day: days, kind: "grand", amount: GRAND_AC };
  return { month, year, days, cells };
}

/**
 * Состояние с поправкой на смену месяца: счётчик нового месяца идёт с
 * «сегодня минус один». Дни до первого входа не начисляются задним числом —
 * иначе новичок, впервые открывший окно 18-го числа, получил бы награды за
 * все семнадцать предыдущих дней, которых он не видел.
 */
function current(): DailyState {
  const state = store.get();
  const key = monthKey();
  if (state.month === key) return state;
  /* Первый вход в месяце: дни до сегодняшнего считаются «уже закрытыми»,
     иначе новичок получил бы награды за весь месяц задним числом. */
  const before = Math.max(0, todayOf() - 1);
  const days = Array.from({ length: before }, (_, i) => i + 1);
  return { ...state, month: key, claimed: days.length, days, catchups: 0 };
}

export interface DailyModalView {
  /** Сколько ячеек открыто */
  claimed: number;
  /** Какие дни месяца уже забраны */
  claimedDays: number[];
  /** Номер сегодняшнего дня */
  today: number;
  /** Награда за сегодняшний вход (аникоины), без множителя */
  entryAc: number;
  /** Аникоины за ячейку сегодня, без множителя (0 — если ячейка не денежная) */
  todayAc: number;  /** Сегодняшнюю ячейку ещё можно забрать */
  canClaim: boolean;
  /** Пропущенных дней в этом месяце */
  missed: number;
  /** Потрачено попыток возврата */
  catchups: number;
  /** Автосбор */
  auto: boolean;
}

export function dailyView(): DailyModalView {
  const state = current();
  const month = dailyMonth();
  const today = Math.min(todayOf(), month.days);
  const cell = month.cells[today - 1];
  const claimed = new Set(state.days);
  let missed = 0;
  for (let d = 1; d < today; d += 1) if (!claimed.has(d)) missed += 1;
  return {
    claimed: state.days.length,
    claimedDays: state.days,
    today,
    /* Вход (+10 AC) платит сам движок при первом заходе дня — календарь его не дублирует */
    entryAc: 0,
    todayAc:
      cell && (cell.kind === "ac" || cell.kind === "box" || cell.kind === "grand")
        ? cell.amount
        : 0,
    canClaim: !claimed.has(today),
    // Пропуск — это именно дырки в календаре, а не отставание счётчика
    missed,
    catchups: state.catchups,
    auto: state.auto,
  };
}

export interface DailyClaimResult {
  ok: boolean;
  message: string;
  /** Начислено аникоинов (без множителя) */
  ac: number;
  /** Начислено XP (без множителя) */
  xp: number;
  /** Дней догнано возвратом */
  caught: number;
  /** Выдана ли рамка аватара */
  frame: boolean;
}

/**
 * Забрать сегодняшнюю ячейку.
 *
 * Обычный вход открывает только сегодняшний день. `catchUp` — «вернуть
 * пропуск»: одной попыткой выдаются все пропущенные дни этого месяца плюс
 * сегодняшний. Награда за каждый догнанный день идёт полностью — иначе
 * «возврат» ничего бы не значил.
 *
 * `premium` приходит из UI (подписка уже прочитана на границе): множитель
 * ×2 не должен применяться всем подряд.
 */
export function claimDailyCell(
  day = todayOf(),
  catchUp = false,
  premium = false,
): DailyClaimResult {
  const state = current();
  const month = dailyMonth();
  const mult = premium ? PREMIUM_QUEST_MULT : 1;
  const target = Math.min(Math.max(1, Math.floor(day)), month.days);
  const claimed = new Set(state.days);
  const targetClaimed = claimed.has(target);

  if (!catchUp && targetClaimed) {
    return { ok: false, message: "Награда за сегодня уже получена", ac: 0, xp: 0, caught: 0, frame: false };
  }
  if (catchUp && state.catchups >= DAILY_CATCHUPS) {
    return { ok: false, message: "Попытки возврата на этот месяц кончились", ac: 0, xp: 0, caught: 0, frame: false };
  }

  const targets: number[] = [];
  if (catchUp) {
    // Все дырки до сегодняшнего дня. Сегодняшний день добавляем только если
    // он ещё не забран: иначе возврат пропуска начислял бы вход второй раз.
    for (let d = 1; d < target; d += 1) if (!claimed.has(d)) targets.push(d);
  }
  if (!targetClaimed) targets.push(target);
  if (targets.length === 0) {
    return { ok: false, message: "Пропусков нет — все дни закрыты", ac: 0, xp: 0, caught: 0, frame: false };
  }

  let ac = 0;
  let xp = 0;
  for (const d of targets) {
    const cell = month.cells[d - 1];
    if (!cell) continue;
    if (cell.kind === "ac" || cell.kind === "box" || cell.kind === "grand") ac += cell.amount;
    if (cell.kind === "exp") xp += cell.amount;
    if (cell.kind === "box") xp += 300;
    if (cell.kind === "grand") xp += 1000;
    if (cell.kind === "skip") xp += DAILY_ENTRY_AC * 3 * Math.max(1, cell.amount);
  }
  // Вход оплачивает движок (SESSION_START), здесь — только награды ячеек.
  ac = ac * mult;
  xp = xp * mult;
  addCoins(ac);
  addXp(xp);
  // Легаси-профиль и движок прогрессии живут раздельно: переносим прирост
  // сразу, иначе баланс в шапке обновится только после перезагрузки.
  syncLegacyDelta();

  /* Рамка аватара с 14-го дня выдаётся по-настоящему: id из каталога
     косметики кладётся в купленное, дальше её носить можно в профиле. */
  let frame = false;
  for (const d of targets) {
    if (month.cells[d - 1]?.kind === "frame") frame = grantDailyFrame() || frame;
  }

  const nextDays = Array.from(new Set([...state.days, ...targets])).sort((a, b) => a - b);
  const caught = catchUp ? targets.filter((d) => d < target).length : 0;
  store.set({
    ...state,
    claimed: nextDays.length,
    days: nextDays,
    catchups: catchUp ? state.catchups + 1 : state.catchups,
  });
  return {
    ok: true,
    message:
      (caught > 0
        ? `Возвращено ${caught} дн. · +${ac} AC и +${xp} XP`
        : `+${ac} AC и +${xp} XP`) + (frame ? " · рамка" : ""),
    ac,
    xp,
    caught,
    frame,
  };
}

/**
 * Рамка аватара за 14-й день: выдаётся первая доступная в каталоге
 * (уровень без требований — `unlock` пустой), id кладётся в купленное.
 * Если каталог изменится и подходящих рамок не будет — просто ничего не
 * выдаст, награда за день при этом всё равно начисляется.
 */
function grantDailyFrame(): boolean {
  const free = FRAMES.find((frame) => frame.id !== "f-none" && Object.keys(frame.unlock).length === 0);
  if (!free) return false;
  return purchaseItem(free.id, 0);
}

export function toggleAuto(): boolean {
  const state = current();
  const next = { ...state, auto: !state.auto };
  store.set(next);
  return next.auto;
}

/**
 * Автосбор: если тумблер включён, а сегодняшняя ячейка ещё не забрана —
 * забираем сразу при открытии окна. Никаких уведомлений браузера макет не
 * просит и сайт не обещает, поэтому «придёт уведомлением сюда» означает
 * ровно это: награда будет начислена при следующем открытии.
 */
export function autoCollectIfNeeded(premium: boolean): DailyClaimResult | null {
  const state = current();
  if (!state.auto) return null;
  const today = todayOf();
  if (state.days.includes(today)) return null;
  return claimDailyCell(today, false, premium);
}