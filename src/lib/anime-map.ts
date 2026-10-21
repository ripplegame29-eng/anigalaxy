"use client";

/**
 * Карта аниме: маршруты из тайтлов. Посмотрел несколько серий — забрал
 * награду — открылся следующий узел. Прогресс считается по истории просмотра
 * (`lib/history`), «забрано» и расположение узлов хранятся в браузере.
 */

import { addCoins, addXp, profileStore, updateProfile } from "./profile";
import { progressEmit } from "./progression/events";
import { syncLegacyDelta } from "./progression/service";
import { createLocalStore } from "./store";
import type { WatchState } from "./history";

export * from "./anime-map-data";
import { bonusItems, itemInfo, type MapNode, type MapRoute } from "./anime-map-data";

/* ------------------------------- Хранилище ------------------------------ */

export interface MapState {
  /** Забранные узлы (`routeId:nodeId`) и бонусы маршрутов (`routeId`) */
  claimed: string[];
  /** Ручные позиции узлов: `routeId:nodeId` → [x, y] */
  pos: Record<string, [number, number]>;
}

const EMPTY: MapState = { claimed: [], pos: {} };

function parse(raw: string): MapState | null {
  try {
    const p = JSON.parse(raw) as Partial<MapState>;
    if (!p || typeof p !== "object") return null;
    const pos: Record<string, [number, number]> = {};
    for (const [k, v] of Object.entries(p.pos ?? {})) {
      if (Array.isArray(v) && typeof v[0] === "number" && typeof v[1] === "number") pos[k] = [v[0], v[1]];
    }
    return { claimed: Array.isArray(p.claimed) ? p.claimed.filter((x): x is string => typeof x === "string") : [], pos };
  } catch {
    return null;
  }
}

export const mapStore = createLocalStore<MapState>("ag:animemap:v1", EMPTY, parse);

/** Кэш найденных постеров и id тайтлов в каталоге */
export interface Found {
  id: string;
  poster?: string;
  title: string;
}
export const foundStore = createLocalStore<Record<string, Found | null>>("ag:animemap:found:v1", {});

/* ------------------------------- Логика --------------------------------- */

export type NodeStatus = "locked" | "open" | "doing" | "done" | "claimed";

export interface NodeView {
  node: MapNode;
  watched: number;
  status: NodeStatus;
}

/** Сколько разных серий тайтла открывали (по истории просмотра) */
export function watchedEpisodes(node: MapNode, watch: WatchState, foundId?: string): number {
  const seen = new Set<string>();
  for (const r of watch.records) {
    const t = r.title.toLowerCase();
    if ((foundId && r.id === foundId) || node.match.some((m) => t.includes(m))) {
      seen.add(`${r.season}:${r.episode}`);
    }
  }
  return seen.size;
}

export function viewRoute(
  route: MapRoute,
  state: MapState,
  watch: WatchState,
  found: Record<string, Found | null>,
): NodeView[] {
  const claimed = new Set(state.claimed);
  return route.nodes.map((node) => {
    const watched = Math.min(node.need, watchedEpisodes(node, watch, found[node.q]?.id));
    const key = `${route.id}:${node.id}`;
    let status: NodeStatus;
    if (claimed.has(key)) status = "claimed";
    else if (!node.requires.every((r) => claimed.has(`${route.id}:${r}`))) status = "locked";
    else if (watched >= node.need) status = "done";
    else status = watched > 0 ? "doing" : "open";
    return { node, watched, status };
  });
}

/** Выдать предмет бесплатно: тег — через движок прогрессии, остальное — в «купленное» */
export function grantItem(id: string): void {
  const info = itemInfo(id);
  if (!info) return;
  if (info.kind === "tag") {
    progressEmit({ type: "DEV_TAG_GRANTED", tagId: id });
    return;
  }
  const profile = profileStore.get();
  if (!profile.purchased.includes(id)) updateProfile({ purchased: [...profile.purchased, id] });
}

export function claimNode(route: MapRoute, nodeId: string, watch: WatchState, found: Record<string, Found | null>): string | null {
  const state = mapStore.get();
  const view = viewRoute(route, state, watch, found).find((v) => v.node.id === nodeId);
  if (!view || view.status !== "done") return null;
  mapStore.update((cur) => ({ ...cur, claimed: [...cur.claimed, `${route.id}:${nodeId}`] }));
  addCoins(view.node.ac);
  addXp(view.node.xp);
  let ac = view.node.ac;
  let xp = view.node.xp;
  let name = "";
  if (view.node.item) {
    // финал маршрута: бонус маршрута и бесплатная награда
    ac += route.bonus.ac;
    xp += route.bonus.xp;
    addCoins(route.bonus.ac);
    addXp(route.bonus.xp);
    grantItem(view.node.item);
    const info = itemInfo(view.node.item);
    if (info) name = ` и «${info.name}» бесплатно`;
  }
  syncLegacyDelta();
  return `+${ac} AC, +${xp} XP${name}`;
}

export function claimRouteBonus(route: MapRoute): string | null {
  const state = mapStore.get();
  const all = route.nodes.every((n) => state.claimed.includes(`${route.id}:${n.id}`));
  if (!all || state.claimed.includes(route.id)) return null;
  mapStore.update((cur) => ({ ...cur, claimed: [...cur.claimed, route.id] }));
  addCoins(route.bonus.ac);
  addXp(route.bonus.xp);
  const names: string[] = [];
  for (const id of bonusItems(route)) {
    grantItem(id);
    const info = itemInfo(id);
    if (info) names.push(`«${info.name}»`);
  }
  syncLegacyDelta();
  return `Маршрут пройден! +${route.bonus.ac} AC${names.length ? ` и бесплатно: ${names.join(", ")}` : ""}`;
}

export function setNodePos(routeId: string, nodeId: string, x: number, y: number): void {
  mapStore.update((cur) => ({ ...cur, pos: { ...cur.pos, [`${routeId}:${nodeId}`]: [Math.round(x), Math.round(y)] } }));
}

export function resetLayout(routeId: string): void {
  mapStore.update((cur) => ({
    ...cur,
    pos: Object.fromEntries(Object.entries(cur.pos).filter(([k]) => !k.startsWith(`${routeId}:`))),
  }));
}
