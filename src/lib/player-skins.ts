"use client";

/**
 * Скины плеера: оформление нижней панели, перемотки и кнопок «Пропустить».
 * Выбранный скин хранится локально и синхронизируется как документ `animehub:*`;
 * купленные скины лежат в `profile.purchased` с префиксом `pskin-`.
 */

import { createLocalStore } from "./store";
import { isUnlocked, type Rarity, type Unlock, type UnlockContext } from "./cosmetics";

export interface PlayerSkin {
  id: string;
  name: string;
  tagline: string;
  rarity: Rarity;
  unlock: Unlock;
}

export const PLAYER_SKINS: readonly PlayerSkin[] = [
  { id: "classic", name: "Классика", tagline: "Тёмная панель без украшений", rarity: "common", unlock: {} },
  { id: "glass", name: "Стекло", tagline: "Матовая плавающая панель", rarity: "common", unlock: { level: 3 } },
  { id: "sakura", name: "Сакура", tagline: "Розовые леденцовые кнопки", rarity: "rare", unlock: { level: 8 } },
  { id: "hitech", name: "Хай-тек", tagline: "Скошенные углы и мятный неон", rarity: "rare", unlock: { price: 400 } },
  { id: "sunset", name: "Закат", tagline: "Оранжево-фиолетовое свечение", rarity: "epic", unlock: { price: 600 } },
  { id: "frost", name: "Иней", tagline: "Ледяной голубой с искрами", rarity: "epic", unlock: { level: 25 } },
  { id: "gold", name: "Золотой век", tagline: "Тёмный бархат и золото", rarity: "legendary", unlock: { premium: true } },
  { id: "void", name: "Пустота", tagline: "Фиолетовый разряд, пульсирующий ползунок", rarity: "legendary", unlock: { premium: true, level: 15 } },
];

export const skinById = (id: string): PlayerSkin | undefined => PLAYER_SKINS.find((s) => s.id === id);
export const skinPurchaseId = (id: string): string => `pskin-${id}`;

export function skinOwned(skin: PlayerSkin, ctx: UnlockContext): boolean {
  if (ctx.purchased.includes(skinPurchaseId(skin.id))) return true;
  if (skin.unlock.price) return false;
  return isUnlocked(skin.unlock, ctx);
}

export const playerSkinStore = createLocalStore<string>("animehub:player-skin:v1", "classic", (raw) => {
  try {
    const v = JSON.parse(raw);
    return typeof v === "string" && skinById(v) ? v : null;
  } catch {
    return null;
  }
});
export const selectPlayerSkin = (id: string): void => playerSkinStore.set(id);
export const usePlayerSkin = (): string => playerSkinStore.useStore();
