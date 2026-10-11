"use client";

import {
  BUILDINGS,
  RESOURCE_LABEL,
  type ClanResource,
} from "./clans.game";
import { CLAN_EMBLEMS, EMBLEM_TIER_LABEL, type ClanEmblemArt } from "./emblems.data";
import {
  appendLedger,
  clanGame,
  commitClanTransaction,
  type ClanGameState,
  type ClanLedgerEntry,
} from "./clans.runtime";

/**
 * Магазин гильдии.
 *
 * Три категории, и все три работают по одному правилу: покупка разовая и
 * навсегда, установка бесплатная. Предмет не пропадает из коллекции, когда
 * его сняли, и не списывается повторно при смене оформления.
 *
 * Редкость здесь отражает только визуальную ценность: она не даёт ни
 * очков, ни ресурсов, ни скорости. Покупка дорогого оформления не должна
 * давать преимущества в игре — иначе это перестаёт быть косметикой.
 */

export type ClanShopRarity = "common" | "rare" | "epic" | "legendary";
export type ClanShopCategory = "background" | "emblem" | "decoration";

export const SHOP_RARITY_LABEL: Record<ClanShopRarity, string> = {
  common: "Обычный",
  rare: "Редкий",
  epic: "Эпический",
  legendary: "Легендарный",
};

/** Цена редкости: влияние за оформление */
const RARITY_COST: Record<ClanShopRarity, number> = {
  common: 400,
  rare: 900,
  epic: 1_800,
  legendary: 3_600,
};

export interface ClanShopItem {
  id: string;
  category: ClanShopCategory;
  name: string;
  rarity: ClanShopRarity;
  /** Чем оплачивается */
  currency: ClanResource;
  price: number;
  description: string;
  /** Валюта фона: многослойный CSS-фон страницы гильдии */
  css?: string;
  backgroundSize?: string;
  /** Явные уровни затемнения под текст — заданы вместе с фоном */
  veil?: string;
  /** Ссылка на эмблему из выгрузки макета */
  emblem?: ClanEmblemArt;
  /** Декорация: класс эффекта в clans-shop.css */
  deco?: string;
}

/* ------------------------------------------------------------------ */
/* Фоны страницы гильдии                                                */
/* ------------------------------------------------------------------ */

/**
 * Фоны гильдии.
 *
 * Каждый — многослойный градиент плюс два оверлея: затемнение под текст
 * и цветовое зарево тона фона. Без оверлея яркий фон съедал бы заголовки,
 * а без затемнения читать описание поверх картинки было бы невозможно.
 */
export const CLAN_BACKGROUNDS: ClanShopItem[] = [
  {
    id: "clan-bg-standard",
    category: "background",
    name: "Стандартный",
    rarity: "common",
    currency: "materials",
    price: 0,
    description: "Базовое оформление гильдии. Доступно бесплатно и всегда.",
    css: "radial-gradient(120% 100% at 50% 0%,rgb(28 32 48) 0%,rgb(10 12 20) 70%)",
    veil: "rgb(8 10 18 / 0.72)",
  },
  {
    id: "clan-bg-fantasy",
    category: "background",
    name: "Тёмное фэнтези",
    rarity: "common",
    currency: "influence",
    price: RARITY_COST.common,
    description: "Сумеречный замок на холме. Спокойный фон, на котором хорошо читается текст.",
    css: "radial-gradient(90% 70% at 50% 8%,#3a2a5c 0%,transparent 60%),linear-gradient(180deg,#1b1430 0%,#0a0812 70%)",
    veil: "rgb(10 8 18 / 0.7)",
  },
  {
    id: "clan-bg-void",
    category: "background",
    name: "Космическая бездна",
    rarity: "rare",
    currency: "influence",
    price: RARITY_COST.rare,
    description: "Чёрный фон с тусклыми звёздами и туманностью по краям.",
    css: "radial-gradient(1px 1px at 20% 30%,#fff 50%,transparent 51%),radial-gradient(1px 1px at 70% 60%,#cfe3ff 50%,transparent 51%),radial-gradient(1px 1px at 45% 80%,#fff 50%,transparent 51%),radial-gradient(120% 90% at 50% 0%,#101c3f 0%,#04060f 70%)",
    backgroundSize: "160px 160px,220px 220px,300px 300px,cover",
    veil: "rgb(4 6 15 / 0.68)",
  },
  {
    id: "clan-bg-cyber",
    category: "background",
    name: "Неоновый киберпанк",
    rarity: "rare",
    currency: "influence",
    price: RARITY_COST.rare,
    description: "Сетка линий и холодное свечение. Резкие углы, высокий контраст.",
    css: "linear-gradient(rgb(34 211 238 / .12) 1px,transparent 1px),linear-gradient(90deg,rgb(34 211 238 / .12) 1px,transparent 1px),radial-gradient(120% 100% at 50% 0%,#0d2b4a 0%,#050810 72%)",
    backgroundSize: "38px 38px,38px 38px,cover",
    veil: "rgb(5 8 16 / 0.66)",
  },
  {
    id: "clan-bg-sakura",
    category: "background",
    name: "Сакура и храм",
    rarity: "rare",
    currency: "influence",
    price: RARITY_COST.rare,
    description: "Тёплый закат над силуэтами ворот тории. Тёплый тон, мягкий свет.",
    css: "radial-gradient(70% 50% at 50% 96%,#fbcfe8 0%,transparent 70%),linear-gradient(180deg,#5b1030 0%,#2a0a1c 60%,#160714 100%)",
    veil: "rgb(30 8 22 / 0.6)",
  },
  {
    id: "clan-bg-ember",
    category: "background",
    name: "Огненная энергия",
    rarity: "epic",
    currency: "prestige",
    price: RARITY_COST.epic,
    description: "Тлеющие угли снизу и жар мастерской. Тёплый, но читаемый.",
    css: "radial-gradient(90% 60% at 50% 108%,#ff7a18 0%,transparent 65%),radial-gradient(60% 40% at 20% 0%,#b3341a 0%,transparent 70%),linear-gradient(180deg,#2a0d08 0%,#120604 100%)",
    veil: "rgb(24 8 5 / 0.58)",
  },
  {
    id: "clan-bg-frost",
    category: "background",
    name: "Ледяная магия",
    rarity: "epic",
    currency: "prestige",
    price: RARITY_COST.epic,
    description: "Стужащий туман и кристаллические блики. Холодная палитра.",
    css: "radial-gradient(80% 60% at 70% 10%,#7dd3fc 0%,transparent 60%),radial-gradient(70% 50% at 20% 90%,#1e3a5f 0%,transparent 70%),linear-gradient(180deg,#0b1a2e 0%,#060c16 100%)",
    veil: "rgb(8 16 28 / 0.6)",
  },
  {
    id: "clan-bg-mist",
    category: "background",
    name: "Туманный лес",
    rarity: "epic",
    currency: "prestige",
    price: RARITY_COST.epic,
    description: "Слоистый туман между стволами. Ровный свет, хорош для длинных текстов.",
    css: "linear-gradient(180deg,transparent 0%,rgb(148 163 184 / .14) 40%,transparent 70%),radial-gradient(60% 80% at 30% 20%,#334155 0%,transparent 70%),linear-gradient(180deg,#10151f 0%,#080b12 100%)",
    veil: "rgb(9 12 19 / 0.64)",
  },
  {
    id: "clan-bg-ruins",
    category: "background",
    name: "Руины древней цивилизации",
    rarity: "epic",
    currency: "prestige",
    price: RARITY_COST.epic,
    description: "Песчаник, обломки колонн и пыль в воздухе. Приглушённая гамма.",
    css: "radial-gradient(70% 50% at 50% 100%,#b08d57 0%,transparent 70%),linear-gradient(180deg,#2d2418 0%,#14100a 100%)",
    veil: "rgb(24 18 10 / 0.6)",
  },
  {
    id: "clan-bg-moon",
    category: "background",
    name: "Мистическая луна",
    rarity: "legendary",
    currency: "prestige",
    price: RARITY_COST.legendary,
    description: "Луна за облаками и холодное сияние. Самый спокойный фон коллекции.",
    css: "radial-gradient(circle at 62% 26%,#e8ecff 0%,#9aa6d8 18%,transparent 34%),radial-gradient(90% 70% at 50% 0%,#1b2350 0%,transparent 70%),linear-gradient(180deg,#0a0f24 0%,#05060e 100%)",
    veil: "rgb(6 8 20 / 0.62)",
  },
  {
    id: "clan-bg-dragon",
    category: "background",
    name: "Драконья бездна",
    rarity: "legendary",
    currency: "prestige",
    price: RARITY_COST.legendary,
    description: "Тёмно-красная magma и силуэт чешуи. Насыщенный, но с затемнением по центру.",
    css: "radial-gradient(80% 60% at 50% 106%,#ff3d2e 0%,transparent 60%),radial-gradient(60% 40% at 80% 0%,#7a1410 0%,transparent 70%),linear-gradient(180deg,#20070a 0%,#0b0304 100%)",
    veil: "rgb(20 5 8 / 0.58)",
  },
  {
    id: "clan-bg-academy",
    category: "background",
    name: "Магическая академия",
    rarity: "legendary",
    currency: "prestige",
    price: RARITY_COST.legendary,
    description: "Фиолетовые круги рун и плавающие огни. Фирменная палитра магов.",
    css: "radial-gradient(circle at 50% 42%,transparent 0%,transparent 22%,rgb(176 107 255 / .3) 22%,rgb(176 107 255 / .3) 24%,transparent 24%,transparent 30%,rgb(176 107 255 / .2) 30%,rgb(176 107 255 / .2) 32%,transparent 32%),radial-gradient(90% 70% at 50% 0%,#2a1450 0%,transparent 70%),linear-gradient(180deg,#120a24 0%,#07040f 100%)",
    veil: "rgb(12 7 26 / 0.6)",
  },
  {
    id: "clan-bg-gold",
    category: "background",
    name: "Золотое измерение",
    rarity: "legendary",
    currency: "prestige",
    price: RARITY_COST.legendary,
    description: "Тёплое золото с блеском частиц. Самая дорогая покупка раздела.",
    css: "radial-gradient(1px 1px at 30% 40%,#ffe9a8 50%,transparent 51%),radial-gradient(1px 1px at 75% 25%,#fff 50%,transparent 51%),radial-gradient(90% 70% at 50% 0%,#5c3d05 0%,transparent 65%),linear-gradient(180deg,#241703 0%,#0d0802 100%)",
    backgroundSize: "180px 180px,260px 260px,cover,cover",
    veil: "rgb(20 13 3 / 0.58)",
  },
];

/* ------------------------------------------------------------------ */
/* Эмблемы                                                              */
/* ------------------------------------------------------------------ */

/**
 * Эмблемы из макета «Ожившие эмблемы кланов».
 *
 * Цена выведена из редкости макета, а не задана вручную: 23 эмблемы
 * держать в согласованном состоянии вручную невозможно.
 */
export const CLAN_EMBLEM_ITEMS: ClanShopItem[] = CLAN_EMBLEMS.map((emblem) => {
  const rarity: ClanShopRarity =
    emblem.tier === "l" ? "legendary" : emblem.tier === "e" ? "epic" : "common";
  return {
    id: emblem.id,
    category: "emblem",
    name: emblem.ru,
    rarity,
    currency: "prestige",
    price: RARITY_COST[rarity],
    description: `${emblem.name} — «${emblem.motto}». ${EMBLEM_TIER_LABEL[emblem.tier]}.`,
    emblem,
  };
});

/* ------------------------------------------------------------------ */
/* Декорации                                                            */
/* ------------------------------------------------------------------ */

/**
 * Косметические улучшения страницы гильдии: рамка карточки, эффект за
 * эмблемой, орнамент-разделитель, свечение шапки.
 *
 * Каждый включается и выключается независимо — купив один, игрок может
 * держать его в коллекции и не применять.
 */
export const CLAN_DECORATIONS: ClanShopItem[] = [
  {
    id: "clan-deco-frame-gilded",
    category: "decoration",
    name: "Золотая рамка карточки",
    rarity: "rare",
    currency: "prestige",
    price: 700,
    description: "Тонкая золотая оправа по краю карточки гильдии. Заметна на тёмном фоне.",
    deco: "gilded-frame",
  },
  {
    id: "clan-deco-frame-runic",
    category: "decoration",
    name: "Рунная рамка",
    rarity: "epic",
    currency: "prestige",
    price: 1_600,
    description: "Медленно вращающееся рунное кольцо вокруг карточки.",
    deco: "runic-frame",
  },
  {
    id: "clan-deco-emblem-halo",
    category: "decoration",
    name: "Нимб эмблемы",
    rarity: "rare",
    currency: "prestige",
    price: 800,
    description: "Мягкий ореол вокруг эмблемы в шапке. Не перекрывает сам знак.",
    deco: "emblem-halo",
  },
  {
    id: "clan-deco-emblem-trail",
    category: "decoration",
    name: "След кометы",
    rarity: "epic",
    currency: "prestige",
    price: 1_900,
    description: "Мерцающий хвост за эмблемой, как от движения.",
    deco: "emblem-trail",
  },
  {
    id: "clan-deco-divider-rune",
    category: "decoration",
    name: "Орнамент-разделитель",
    rarity: "common",
    currency: "materials",
    price: 350,
    description: "Тонкая рунная линия между шапкой и содержимым страницы.",
    deco: "rune-divider",
  },
  {
    id: "clan-deco-header-glow",
    category: "decoration",
    name: "Свечение шапки",
    rarity: "legendary",
    currency: "prestige",
    price: 3_200,
    description: "Цветное зарево по верхней кромке шапки в тон эмблемы.",
    deco: "header-glow",
  },
  {
    id: "clan-deco-spark-drift",
    category: "decoration",
    name: "Медленный дрейф искр",
    rarity: "rare",
    currency: "materials",
    price: 900,
    description: "Редкие искры, поднимающиеся снизу. Отключается вместе с анимациями.",
    deco: "spark-drift",
  },
  {
    id: "clan-deco-corner-ornament",
    category: "decoration",
    name: "Угловые завитки",
    rarity: "epic",
    currency: "prestige",
    price: 1_400,
    description: "Асимметричные завитки в двух углах карточки.",
    deco: "corner-ornament",
  },
];

/** Полный каталог в порядке категорий */
export const CLAN_SHOP_ITEMS: ClanShopItem[] = [
  ...CLAN_BACKGROUNDS,
  ...CLAN_EMBLEM_ITEMS,
  ...CLAN_DECORATIONS,
];

/** Предмет по id */
export function shopItem(id: string): ClanShopItem | undefined {
  return CLAN_SHOP_ITEMS.find((item) => item.id === id);
}

/* ------------------------------------------------------------------ */
/* Покупка                                                              */
/* ------------------------------------------------------------------ */

export interface ShopPurchaseResult {
  ok: boolean;
  reason?: string;
}

/**
 * Купить предмет клана.
 *
 * Цена и валюта берутся из каталога, а не из аргументов: подменить цену
 * на клиенте нельзя, потому что её здесь вообще нет среди параметров.
 * Повторная покупка отклоняется guard'ом по ключу предмета.
 */
export function buyClanItem(itemId: string): ShopPurchaseResult {
  const item = shopItem(itemId);
  if (!item) return { ok: false, reason: "Предмет не найден" };

  const game = clanGame();
  if (game.unlocks.includes(itemId)) return { ok: false, reason: "Уже куплено" };
  if (item.price <= 0) return { ok: false, reason: "Предмет бесплатный" };
  if (game.purse[item.currency] < item.price) {
    return { ok: false, reason: `Не хватает ${RESOURCE_LABEL[item.currency].toLowerCase()}` };
  }

  const result = commitClanTransaction(
    `buy:${itemId}`,
    (state) => state.unlocks.includes(itemId),
    (state) => {
      // Повторная проверка баланса внутри транзакции: между чтением и
      // записью состояние мог изменить другая вкладка
      if (state.purse[item.currency] < item.price) return null;
      const next: ClanGameState = {
        ...state,
        unlocks: [...state.unlocks, itemId],
        purse: { ...state.purse, [item.currency]: state.purse[item.currency] - item.price },
      };
      return appendLedger(next, {
        kind: "shop",
        actor: "Ты",
        subject: item.name,
        cost: { resource: item.currency, amount: item.price },
        reward: "Куплено навсегда",
      });
    },
  );

  if (!result.ok) return { ok: false, reason: result.reason };
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Установка                                                            */
/* ------------------------------------------------------------------ */

/**
 * Установить оформление. Бесплатно и сколько угодно раз — но только среди
 * уже купленного, и только если у роли есть право на изменение страницы.
 */
export function equipClanItem(
  itemId: string,
  role: string,
): ShopPurchaseResult {
  const item = shopItem(itemId);
  if (!item) return { ok: false, reason: "Предмет не найден" };
  if (!canEquip(item.category, role)) {
    return { ok: false, reason: "Недостаточно прав" };
  }

  const game = clanGame();
  if (!game.unlocks.includes(itemId)) return { ok: false, reason: "Предмет не куплен" };

  const result = commitClanTransaction(
    `equip:${itemId}`,
    // Установка повторяемая: guard проверяет, что активен уже другой
    // предмет, иначе клик «вернуть к стандартному» проходил бы вхолостую
    (state) => isEquipped(state, itemId),
    (state) => {
      let outfit = state.outfit;
      if (item.category === "background") outfit = { ...outfit, background: itemId };
      else if (item.category === "emblem") outfit = { ...outfit, emblem: itemId };
      else {
        // Декорации независимы друг от друга: установленный не снимается
        const on = outfit.decorations.includes(itemId);
        outfit = {
          ...outfit,
          decorations: on
            ? outfit.decorations.filter((id) => id !== itemId)
            : [...outfit.decorations, itemId],
        };
      }
      return appendLedger({ ...state, outfit }, {
        kind: "equip",
        actor: "Ты",
        subject: item.name,
      });
    },
  );

  if (!result.ok) return { ok: false, reason: result.reason };
  return { ok: true };
}

/** Кто может менять оформление страницы */
export function canEquip(category: ClanShopCategory, role: string): boolean {
  if (category === "decoration") return role === "owner" || role === "admin";
  return role === "owner";
}

/** Активен ли предмет прямо сейчас */
export function isEquipped(game: ClanGameState, itemId: string): boolean {
  const item = shopItem(itemId);
  if (!item) return false;
  if (item.category === "background") return game.outfit.background === itemId;
  if (item.category === "emblem") return game.outfit.emblem === itemId;
  return game.outfit.decorations.includes(itemId);
}

/** Купленные предметы по категориям */
export function ownedByCategory(
  game: ClanGameState,
  category: ClanShopCategory,
): ClanShopItem[] {
  return CLAN_SHOP_ITEMS.filter(
    (item) => item.category === category && game.unlocks.includes(item.id),
  );
}

/** Фон, применённый сейчас, со значениями по умолчанию */
export function activeBackground(game: ClanGameState): ClanShopItem {
  return (
    shopItem(game.outfit.background) ?? CLAN_BACKGROUNDS[0]
  );
}

/** Эмблема, применённая сейчас (по умолчанию — первая купленная) */
export function activeEmblem(game: ClanGameState): ClanEmblemArt | null {
  const equipped = game.outfit.emblem ? shopItem(game.outfit.emblem) : undefined;
  if (equipped?.emblem) return equipped.emblem;
  const first = CLAN_EMBLEMS.find((e) => game.unlocks.includes(e.id));
  return first ?? null;
}

/** Журнал операций, свежие сверху */
export function recentLedger(limit = 20): ClanLedgerEntry[] {
  return [...clanGame().ledger].slice(-limit).reverse();
}

export { BUILDINGS };