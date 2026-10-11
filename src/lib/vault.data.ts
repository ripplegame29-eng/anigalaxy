/**
 * Сундуки сокровищницы — выгрузка из макета «Сундуки сокровищ».
 *
 * Файлы вынесены в `public/vault/`: base64 внутри исходника попал бы в
 * бандл целиком. Пропорции и цвета оригинала сохранены как есть.
 *
 * Поля `fd`, `flash`, `aura`, `ray` и `sparks` описывают анимацию из
 * макета: задержка и силу вспышки, плотность ауры и искр.
 */

export interface VaultChestArt {
  /** 0..3 — уровень сундука */
  tier: number;
  /** Путь к WebP относительно public/ */
  file: string;
  /** Название латиницей */
  en: string;
  /** Название по-русски */
  ru: string;
  /** Редкость из макета */
  rarity: string;
  /** Цвет свечения */
  color: string;
  /** Задержка вспышки, мс */
  fd: number;
  /** Сила вспышки */
  flash: number;
  /** Сила ауры */
  aura: number;
  /** Доля лучей */
  ray: number;
  /** Количество искр */
  sparks: number;
}

export const VAULT_CHESTS: VaultChestArt[] = [
  {
    "tier": 0,
    "file": "chest-0.webp",
    "en": "RADIANT CHEST",
    "ru": "Сияющий сундук",
    "rarity": "ОБЫЧНЫЙ",
    "color": "#ffd27a",
    "fd": 0,
    "flash": 3,
    "aura": 0.35,
    "ray": 0.12,
    "sparks": 22
  },
  {
    "tier": 1,
    "file": "chest-1.webp",
    "en": "SAPPHIRE CHEST",
    "ru": "Сапфировый сундук",
    "rarity": "РЕДКИЙ",
    "color": "#58b8ff",
    "fd": 2000,
    "flash": 6,
    "aura": 0.55,
    "ray": 0.3,
    "sparks": 30
  },
  {
    "tier": 2,
    "file": "chest-2.webp",
    "en": "CRYSTAL CHEST",
    "ru": "Кристальный сундук",
    "rarity": "ЭПИЧЕСКИЙ",
    "color": "#8aa8ff",
    "fd": 4000,
    "flash": 9,
    "aura": 0.7,
    "ray": 0.5,
    "sparks": 40
  },
  {
    "tier": 3,
    "file": "chest-3.webp",
    "en": "CELESTIAL CHEST",
    "ru": "Небесный сундук",
    "rarity": "ЛЕГЕНДАРНЫЙ",
    "color": "#ffc94d",
    "fd": 1000,
    "flash": 13,
    "aura": 0.9,
    "ray": 0.75,
    "sparks": 56
  }
];

/** Сундук по уровню */
export function vaultChest(tier: number): VaultChestArt | undefined {
  return VAULT_CHESTS.find((c) => c.tier === tier);
}
