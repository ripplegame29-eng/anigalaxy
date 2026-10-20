"use client";

import { RESOURCE_LABEL, type ClanResource } from "./clans.game";
import { emit } from "./progression/service";
import {
  appendLedger,
  clanGame,
  commitClanTransaction,
  type ClanGameState,
  type ClanTreasuryState,
  type ClanUnlock,
} from "./clans.runtime";
import { CLAN_EMBLEMS } from "./emblems.data";
import { CLAN_BACKGROUNDS, CLAN_DECORATIONS, shopItem } from "./clans.shop";

/**
 * Сокровищница клана.
 *
 * Общая казна: открытие тратит ресурсы всего клана, поэтому право есть не у
 * каждого участника. Шансы наград заданы в таблице и показываются игроку
 * до открытия — случайный предмет не должен выглядеть как гарантированный.
 *
 * Награда выпадает один раз за открытие и либо уходит в общую казну, либо
 * в конкретному участнику. Кому именно — написано в таблице, а не
 * подразумевается: выдавать личную вещь «от имени клана» без указания
 * получателя нельзя.
 */

export type ChestTier = 0 | 1 | 2 | 3;
export type Rarity = "common" | "rare" | "epic" | "legendary";

export interface LootEntry {
  id: string;
  label: string;
  /** Шанс в процентах внутри своей ступени. Ступени суммируются в 100 */
  chance: number;
  /** Куда уходит награда */
  to: "purse" | "self" | "unlock";
  /** Ресурс, если to === "purse" */
  resource?: ClanResource;
  /** Сколько ресурса или атомов */
  amount?: number;
  /** id предмета, если to === "unlock" */
  itemId?: string;
  /** Ограничение: максимум копий за жизнь */
  max?: number;
}

export interface ChestInfo {
  tier: ChestTier;
  name: string;
  rarity: Rarity;
  glyph: string;
  /** Цена открытия */
  currency: ClanResource;
  price: number;
  /** Условие доступа: минимальный уровень клина */
  needPoints: number;
  /** Открывается этим уровнем */
  unlockNote: string;
  /** Таблица наград, видимая игроку до открытия */
  loot: LootEntry[];
  color: string;
}

/* ------------------------------------------------------------------ */
/* Таблицы наград                                                       */
/* ------------------------------------------------------------------ */

/** Процент на каждую ступень; сумма обязана быть ровно 100 */
const P = (value: number) => Math.round(value * 100) / 100;

export const CHESTS: ChestInfo[] = [
  {
    tier: 0,
    name: "Обычный сундук",
    rarity: "common",
    glyph: "🧰",
    currency: "materials",
    price: 260,
    needPoints: 0,
    unlockNote: "Доступен сразу",
    color: "#8b93a7",
    loot: [
      { id: "c0-mat", label: "Материалы клана", chance: P(46), to: "purse", resource: "materials", amount: 180 },
      { id: "c0-inf", label: "Влияние", chance: P(28), to: "purse", resource: "influence", amount: 220 },
      { id: "c0-xp", label: "Клановый опыт", chance: P(18), to: "purse", resource: "xp", amount: 260 },
      { id: "c0-ac", label: "Атомы в личную копилку", chance: P(8), to: "self", amount: 90 },
    ],
  },
  {
    tier: 1,
    name: "Редкий сундук",
    rarity: "rare",
    glyph: "🔷",
    currency: "influence",
    price: 1_200,
    needPoints: 8_000,
    unlockNote: "С 8 000 очков клана",
    color: "#7dd3fc",
    loot: [
      { id: "c1-mat", label: "Материалы клана", chance: P(34), to: "purse", resource: "materials", amount: 420 },
      { id: "c1-inf", label: "Влияние", chance: P(24), to: "purse", resource: "influence", amount: 300 },
      { id: "c1-pre", label: "Престиж", chance: P(18), to: "purse", resource: "prestige", amount: 140 },
      { id: "c1-ac", label: "Атомы в личную копилку", chance: P(14), to: "self", amount: 220 },
      { id: "c1-deco", label: "Орнамент-разделитель", chance: P(6), to: "unlock", itemId: "clan-deco-divider-rune" },
      { id: "c1-bg", label: "Фон «Туманный лес»", chance: P(4), to: "unlock", itemId: "clan-bg-mist", max: 1 },
    ],
  },
  {
    tier: 2,
    name: "Эпический сундук",
    rarity: "epic",
    glyph: "🔮",
    currency: "prestige",
    price: 900,
    needPoints: 45_000,
    unlockNote: "С 45 000 очков клана",
    color: "#b06bff",
    loot: [
      { id: "c2-mat", label: "Материалы клана", chance: P(26), to: "purse", resource: "materials", amount: 900 },
      { id: "c2-inf", label: "Влияние", chance: P(20), to: "purse", resource: "influence", amount: 700 },
      { id: "c2-pre", label: "Престиж", chance: P(20), to: "purse", resource: "prestige", amount: 320 },
      { id: "c2-ac", label: "Атомы в личную копилку", chance: P(14), to: "self", amount: 480 },
      { id: "c2-deco", label: "Рунная рамка", chance: P(10), to: "unlock", itemId: "clan-deco-frame-runic" },
      { id: "c2-emblem", label: "Эмблема «Лунный орден»", chance: P(6), to: "unlock", itemId: "clan-emblem-05" },
      { id: "c2-bg", label: "Фон «Драконья бездна»", chance: P(4), to: "unlock", itemId: "clan-bg-dragon", max: 1 },
    ],
  },
  {
    tier: 3,
    name: "Легендарный сундук",
    rarity: "legendary",
    glyph: "👑",
    currency: "prestige",
    price: 2_600,
    needPoints: 140_000,
    unlockNote: "С 140 000 очков клана — элита сезона",
    color: "#ffb020",
    loot: [
      { id: "c3-mat", label: "Материалы клана", chance: P(22), to: "purse", resource: "materials", amount: 1_800 },
      { id: "c3-pre", label: "Престиж", chance: P(24), to: "purse", resource: "prestige", amount: 700 },
      { id: "c3-inf", label: "Влияние", chance: P(18), to: "purse", resource: "influence", amount: 1_400 },
      { id: "c3-ac", label: "Атомы в личную копилку", chance: P(14), to: "self", amount: 1_200 },
      { id: "c3-deco", label: "Свечение шапки", chance: P(10), to: "unlock", itemId: "clan-deco-header-glow" },
      { id: "c3-emblem", label: "Эмблема «Багровые Драконы»", chance: P(7), to: "unlock", itemId: "clan-emblem-01" },
      { id: "c3-bg", label: "Фон «Золотое измерение»", chance: P(5), to: "unlock", itemId: "clan-bg-gold", max: 1 },
    ],
  },
];

/**
 * Контроль баланса таблиц.
 *
 * Сумма шансов должна быть ровно 100: иначе часть исходов недостижима
 * молча, а часть наград выпадает чаще заявленного. Проверка выполняется
 * при загрузке модуля, а не в тестах — чтобы ошибка конфигурации была
 * видна сразу.
 */
for (const chest of CHESTS) {
  const sum = chest.loot.reduce((acc, entry) => acc + entry.chance, 0);
  if (Math.abs(sum - 100) > 0.01) {
    throw new Error(`Сокровищница: сумма шансов в «${chest.name}» равна ${sum}, а не 100`);
  }
}

/** Награда, которая реально выпала */
export interface LootResult {
  entry: LootEntry;
  /** Что реально начислили */
  amount: number;
  /** Предмет уже был — выдана компенсация вместо дубля */
  duplicate: boolean;
}

export interface OpenResult {
  ok: boolean;
  reason?: string;
  loot?: LootResult;
  /** Персональная награда — сколько атомов получил игрок */
  selfAc?: number;
  /** Предмет, добавленный в клановую коллекцию */
  unlocked?: string;
}

/* ------------------------------------------------------------------ */
/* Доступ                                                               */
/* ------------------------------------------------------------------ */

/**
 * Кто может открывать сокровищницу.
 *
 * Тратится общая казна, поэтому право есть у руководства и у модераторов,
 * но не у рядового участника: иначе любой мог бы распустить клан на
 * сундуках.
 */
export function canOpen(role: string): boolean {
  return role === "owner" || role === "admin" || role === "moderator";
}

/** Доступен ли уровень сундука этому клану */
export function chestAvailable(chest: ChestInfo, clanPoints: number): boolean {
  return clanPoints >= chest.needPoints;
}

/** Уровень сокровищницы: самый высокий доступный */
export function treasuryTier(clanPoints: number): ChestTier {
  let tier: ChestTier = 0;
  for (const chest of CHESTS) {
    if (clanPoints >= chest.needPoints) tier = chest.tier as ChestTier;
  }
  return tier;
}

/* ------------------------------------------------------------------ */
/* Определение награды                                                   */
/* ------------------------------------------------------------------ */

/**
 * Выбор награды по шансам.
 *
 * Бросок один на всё число — так выбирается ровно одна награда из таблицы,
 * и её вес равен указанному проценту. Клиент подменить не может: функция
 * вызывается внутри транзакции на стороне стора.
 */
function rollLoot(chest: ChestInfo): LootEntry {
  const roll = Math.random() * 100;
  let acc = 0;
  for (const entry of chest.loot) {
    acc += entry.chance;
    if (roll < acc) return entry;
  }
  return chest.loot[chest.loot.length - 1];
}

/**
 * Дубликаты предметов.
 *
 * Повторно выпадающий уже купленный фон не должен ни пропасть молча, ни
 * превращаться в мусор в коллекции: игрок получает компенсацию в
 * ресурсах, а интерфейс прямо пишет, что предмет был.
 */
function resolveUnlock(
  entry: LootEntry,
  owned: ClanUnlock[],
): { unlocked: boolean; duplicate: boolean; label: string } {
  const item = entry.itemId ? shopItem(entry.itemId) : undefined;
  if (!item) return { unlocked: false, duplicate: false, label: entry.label };
  if (owned.includes(item.id)) {
    return { unlocked: false, duplicate: true, label: item.name };
  }
  return { unlocked: true, duplicate: false, label: item.name };
}

/* ------------------------------------------------------------------ */
/* Открытие                                                             */
/* ------------------------------------------------------------------ */

/**
 * Открыть сундук.
 *
 * Вся операция — одна транзакция: проверка прав, проверка баланса, списание,
 * определение награды, начисление и запись в журнал. Идентификатор операции
 * строится из уровня и номера открытия, поэтому повторный запрос с тем же
 * ключом отклоняется, а не выдаёт вторую награду.
 */
export function openChest(
  tier: ChestTier,
  role: string,
  clanPoints: number,
): OpenResult {
  const chest = CHESTS.find((c) => c.tier === tier);
  if (!chest) return { ok: false, reason: "Такого сундука нет" };
  if (!canOpen(role)) return { ok: false, reason: "Недостаточно прав" };
  if (!chestAvailable(chest, clanPoints)) return { ok: false, reason: chest.unlockNote };

  const game = clanGame();
  if (game.purse[chest.currency] < chest.price) {
    return { ok: false, reason: `Не хватает ${RESOURCE_LABEL[chest.currency].toLowerCase()}` };
  }

  const openedCount = game.treasury.opened[String(tier)] ?? 0;
  // Ключ операции: повтор того же открытия отклоняется, а не выдаёт
  // вторую награду. Он же попадает в `treasury.lastOpenKey`.
  const openKey = `chest:${tier}:${openedCount}`;

  // Результат ролла живёт в замыкании: apply() выполняется синхронно
  // внутри обновления стора, поэтому к моменту возврата он уже заполнен.
  // Восстанавливать награду из журнала нельзя — там нет суммы и назначения.
  let loot: LootResult | undefined;
  let selfAc = 0;
  let unlocked = "";

  const result = commitClanTransaction(
    openKey,
    (state) => state.treasury.lastOpenKey === openKey,
    (state) => {
      if (state.purse[chest.currency] < chest.price) return null;

      const entry = rollLoot(chest);
      const purse = { ...state.purse };
      let duplicate = false;
      let rewardText = entry.label;

      if (entry.to === "purse" && entry.resource && entry.amount) {
        purse[entry.resource] += entry.amount;
      } else if (entry.to === "self" && entry.amount) {
        // Личная награда: уходит в копилку выдачи участникам, а не в
        // общую казну. Начислять её в purse означало бы раздать личные
        // атомы всему клану.
        selfAc = entry.amount;
      } else if (entry.to === "unlock") {
        const resolved = resolveUnlock(entry, state.unlocks);
        duplicate = resolved.duplicate;
        unlocked = resolved.unlocked ? (entry.itemId ?? "") : "";
        rewardText = resolved.label;
        if (duplicate) {
          // Компенсация: 40% цены предмета в ту валюту, которой он оплачен
          const item = shopItem(entry.itemId ?? "");
          if (item) {
            const back = Math.round(item.price * 0.4);
            purse[item.currency] += back;
            rewardText = `${item.name} (уже есть) — компенсация ${back} ${RESOURCE_LABEL[item.currency].toLowerCase()}`;
          }
        }
      }

      loot = { entry, amount: entry.amount ?? 0, duplicate };

      const treasury: ClanTreasuryState = {
        tier: Math.max(state.treasury.tier, tier),
        lastOpenKey: openKey,
        opened: { ...state.treasury.opened, [String(tier)]: openedCount + 1 },
      };

      let next: ClanGameState = { ...state, purse, treasury };
      if (unlocked) next = { ...next, unlocks: [...next.unlocks, unlocked] };

      return appendLedger(next, {
        kind: "treasury",
        actor: "Ты",
        subject: chest.name,
        cost: { resource: chest.currency, amount: chest.price },
        reward: rewardText,
      });
    },
  );

  if (!result.ok) return { ok: false, reason: result.reason };
  /* «Атомы в личную копилку» обещаны в таблице наград — начисляем их
     реально, через движок прогрессии (ключ открытия защищает от повтора). */
  if (selfAc > 0) {
    emit({ type: "CLAN_CHEST_REWARD", key: openKey, amount: selfAc });
  }
  return { ok: true, loot, selfAc, unlocked };
}

/** Пример содержимого сундука для витрины: сколько у каждого предмета в каталоге */
export function catalogueSize(): { backgrounds: number; emblems: number; decorations: number } {
  return {
    backgrounds: CLAN_BACKGROUNDS.length,
    emblems: CLAN_EMBLEMS.length,
    decorations: CLAN_DECORATIONS.length,
  };
}