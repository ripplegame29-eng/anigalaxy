/** Клановый рынок: наборы паков и боевые бустеры за алмазы со скидкой клана. Общий для сервера и клиента. */

export interface MarketItem {
  id: string;
  name: string;
  desc: string;
  group: "packs" | "boost";
  /** Цена в алмазах */
  price: number;
  /** Цена без клана — чтобы показать выгоду */
  base: number;
  /** Сколько раз за неделю можно купить */
  limit: number;
  /** С какого уровня клана доступно */
  level: number;
  give: { packs?: number; dust?: number; scrolls?: [rank: number, n: number][]; boosters?: Record<string, number> };
  art: "pack-s" | "pack-m" | "pack-l" | "case" | "b-stim" | "b-aegis" | "b-surge" | "b-focus" | "b-feather";
}

export const MARKET: MarketItem[] = [
  { id: "m-recruit", name: "Набор новобранца", desc: "3 пака героев", group: "packs", price: 150, base: 180, limit: 2, level: 1, give: { packs: 3 }, art: "pack-s" },
  { id: "m-squad", name: "Набор отряда", desc: "6 паков и 2 свитка ранга B", group: "packs", price: 290, base: 400, limit: 1, level: 3, give: { packs: 6, scrolls: [[1, 2]] }, art: "pack-m" },
  { id: "m-warchest", name: "Военная казна", desc: "10 паков, свиток ранга A и 300 пыли", group: "packs", price: 480, base: 720, limit: 1, level: 6, give: { packs: 10, dust: 300, scrolls: [[2, 1]] }, art: "pack-l" },
  { id: "m-stim", name: "Стимуляторы ×3", desc: "+12% атаки отряда в первые 3 раунда", group: "boost", price: 45, base: 60, limit: 3, level: 1, give: { boosters: { "b-stim": 3 } }, art: "b-stim" },
  { id: "m-aegis", name: "Щиты предков ×3", desc: "Щит 10% здоровья каждому герою на старте", group: "boost", price: 50, base: 66, limit: 3, level: 1, give: { boosters: { "b-aegis": 3 } }, art: "b-aegis" },
  { id: "m-surge", name: "Разряды ×3", desc: "30 энергии ультимейта на старте боя", group: "boost", price: 60, base: 80, limit: 3, level: 2, give: { boosters: { "b-surge": 3 } }, art: "b-surge" },
  { id: "m-focus", name: "Прицелы ×3", desc: "+12% к шансу критического удара", group: "boost", price: 45, base: 60, limit: 3, level: 1, give: { boosters: { "b-focus": 3 } }, art: "b-focus" },
  { id: "m-feather", name: "Перья феникса ×2", desc: "Первый павший герой возвращается с 30% здоровья", group: "boost", price: 70, base: 95, limit: 2, level: 4, give: { boosters: { "b-feather": 2 } }, art: "b-feather" },
];

export const marketItem = (id: string): MarketItem | undefined => MARKET.find((m) => m.id === id);
