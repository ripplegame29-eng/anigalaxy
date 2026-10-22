/** Каталоги предметов для выдачи: рамки, титулы, фоны, эффекты, теги, достижения */

import { BACKGROUNDS, FRAMES, SHOP_FRAMES, TITLES, PROFILE_DECORS, type FrameItem } from "@/lib/cosmetics";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { PARTICLE_EFFECTS, STYLE_EFFECTS } from "@/lib/profile-effects";
import { PROGRESSION_CONFIG } from "@/lib/progression/progression.config";

export type CatKind = "frame" | "title" | "background" | "effect" | "decor" | "tag" | "achievement" | "claimed";

export interface CatItem {
  id: string;
  name: string;
  kind: CatKind;
  rarity: string;
  note: string;
  frame?: FrameItem;
  /** Порог/прогресс для достижений */
  threshold?: number;
  /** Что даёт достижение */
  reward?: string;
}

export const KIND_LABEL: Record<CatKind, string> = {
  frame: "Рамки",
  title: "Титулы",
  background: "Фоны",
  effect: "Эффекты",
  decor: "Оформления",
  tag: "Теги",
  achievement: "Достижения",
  claimed: "Достижения профиля",
};

const rar = (r: string) => r.toLowerCase();

function dedupe(items: CatItem[]): CatItem[] {
  const seen = new Set<string>();
  return items.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
}

const frames = dedupe([...FRAMES, ...SHOP_FRAMES].map((f) => ({ id: f.id, name: f.name, kind: "frame" as const, rarity: rar(f.rarity), note: f.unlock.price ? `${f.unlock.price} AC` : f.unlock.grant ?? "", frame: f })));

export const CATALOG: Record<CatKind, CatItem[]> = {
  frame: frames,
  title: TITLES.map((t) => ({ id: t.id, name: t.name, kind: "title", rarity: rar(t.rarity), note: t.description })),
  background: BACKGROUNDS.map((b) => ({ id: b.id, name: b.name, kind: "background", rarity: rar(b.rarity), note: b.unlock.price ? `${b.unlock.price} AC` : "" })),
  effect: dedupe([
    ...PARTICLE_EFFECTS.map((e) => ({ id: e.id, name: `${e.name} · частицы`, kind: "effect" as const, rarity: rar(e.rarity), note: `${e.price} AC` })),
    ...STYLE_EFFECTS.map((e) => ({ id: e.id, name: `${e.name} · стиль`, kind: "effect" as const, rarity: rar(e.rarity), note: `${e.price} AC` })),
  ]),
  decor: PROFILE_DECORS.map((d) => ({ id: d.id, name: d.name, kind: "decor", rarity: rar(d.rarity), note: "сезонное оформление" })),
  tag: PROGRESSION_CONFIG.tags.map((t) => ({ id: t.id, name: t.name, kind: "tag", rarity: rar(t.rarity), note: t.description })),
  achievement: PROGRESSION_CONFIG.achievements.map((a) => ({
    id: a.id,
    name: a.name,
    kind: "achievement",
    rarity: rar(a.rarity),
    note: a.description,
    threshold: a.condition.threshold,
    reward: `${a.reward.xp} XP · ${a.reward.ac} AC`,
  })),
  claimed: ACHIEVEMENTS.map((a) => ({ id: a.id, name: a.name, kind: "claimed", rarity: rar(a.rarity), note: a.description })),
};

export const KIND_ORDER: CatKind[] = ["frame", "title", "tag", "achievement", "background", "effect", "decor", "claimed"];

const index = new Map<string, CatItem>();
for (const kind of KIND_ORDER) for (const item of CATALOG[kind]) index.set(`${kind}:${item.id}`, item);
export const findCat = (kind: CatKind, id: string) => index.get(`${kind}:${id}`);

export const RARITY_TONE: Record<string, string> = { common: "gray", rare: "blue", epic: "violet", legendary: "gold", mythic: "red" };
