"use client";

import { useMemo } from "react";
import MyList, { type ListData, type ListItem, type Status } from "@/components/MyListPage";
import { COLLECTIONS_KEY, FAVORITES_KEY, loadCollections, saveCollectionsList } from "@/lib/collections";
import { clearWatchHistory, timeAgo, watchStore } from "@/lib/history";
import { STATUSES_KEY, type WatchStatus } from "@/lib/statuses";
import { useTitles } from "@/lib/titles";
import { useHydrated } from "@/lib/use-hydrated";
import { parseList, useLocalSnapshot } from "@/lib/use-local-storage";

/**
 * «Мой список» на реальных данных аккаунта: статусы, избранное, подборки и
 * история просмотра берутся из тех же хранилищ, что и страница тайтла.
 * У нового аккаунта список пуст — демо-данных здесь нет.
 */

const EXTRAS_KEY = "animehub:list-extras:v1";
const VALID = new Set<string>(["planned", "watching", "completed", "dropped"]);

interface Extra { rating?: number; note?: string; ep?: number; updated?: number }

function readExtras(): Record<string, Extra> {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(EXTRAS_KEY) || "{}") as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, Extra>) : {};
  } catch {
    return {};
  }
}

export default function MyListLive() {
  const mounted = useHydrated();
  const statusesRaw = useLocalSnapshot(STATUSES_KEY);
  const favoritesRaw = useLocalSnapshot(FAVORITES_KEY);
  const collectionsRaw = useLocalSnapshot(COLLECTIONS_KEY);
  const titles = useTitles();
  const watch = watchStore.useStore();

  const initial = useMemo<ListData | null>(() => {
    if (!mounted) return null;
    let statuses: Record<string, string> = {};
    try {
      const parsed = JSON.parse(statusesRaw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) statuses = parsed as Record<string, string>;
    } catch { /* пустой стор */ }
    const favorites = parseList<string>(favoritesRaw, []);
    const collections = parseList<{ id: string; name: string; animeIds: string[] }>(collectionsRaw, []);
    const extras = readExtras();

    const seen = new Map<string, number>();
    for (const r of watch.records) seen.set(r.id, (seen.get(r.id) ?? 0) + 1);
    const lastAt = new Map<string, number>();
    for (const r of watch.records) lastAt.set(r.id, Math.max(lastAt.get(r.id) ?? 0, r.at));

    const ids = [...new Set([...Object.keys(statuses).filter((id) => VALID.has(statuses[id])), ...favorites])];
    const items: ListItem[] = ids.map((id, index) => {
      const meta = titles[id];
      const ex = extras[id] ?? {};
      const st = (VALID.has(statuses[id]) ? statuses[id] : "planned") as Status;
      const eps = meta?.episodesTotal;
      const ep = Math.min(ex.ep ?? seen.get(id) ?? 0, eps ?? Infinity);
      return {
        id,
        title: meta?.title ?? id,
        poster: meta?.poster ?? null,
        eps,
        ep,
        status: st,
        rating: ex.rating ?? 0,
        note: ex.note ?? "",
        updated: ex.updated ?? lastAt.get(id) ?? 1_000_000 - index,
        year: meta?.year,
        genres: meta?.genres,
        href: meta?.manga ? `/manga/${id}` : `/title/${id}`,
      };
    });

    return {
      public: false,
      items,
      cols: collections.map((c) => ({ id: c.id, name: c.name, ids: c.animeIds })),
      history: watch.records.slice(0, 120).map((r) => ({
        id: `${r.id}:${r.season}:${r.episode}`,
        title: r.title,
        image: r.poster ?? titles[r.id]?.poster ?? null,
        ep: r.episode,
        when: timeAgo(r.at),
        href: titles[r.id]?.manga ? `/manga/${r.id}` : `/title/${r.id}`,
      })),
    };
  }, [mounted, statusesRaw, favoritesRaw, collectionsRaw, titles, watch.records]);

  /* Страница получает снимок один раз, дальше правки идут обратно в сторы */
  const first = useMemo(() => initial, [mounted]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!mounted || !first) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="h-72 animate-pulse rounded-3xl border border-line bg-card/50" />
      </div>
    );
  }

  const onSave = (data: ListData) => {
    try {
      const map: Record<string, WatchStatus> = {};
      const extras: Record<string, Extra> = {};
      for (const i of data.items) {
        map[i.id] = i.status;
        extras[i.id] = { rating: i.rating, note: i.note, ep: i.ep, updated: i.updated };
      }
      window.localStorage.setItem(STATUSES_KEY, JSON.stringify(map));
      window.localStorage.setItem(EXTRAS_KEY, JSON.stringify(extras));
      const kept = new Set(data.items.map((i) => i.id));
      const favs = parseList<string>(window.localStorage.getItem(FAVORITES_KEY) ?? "[]", []).filter((id) => kept.has(id));
      window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
      const old = loadCollections();
      saveCollectionsList(
        data.cols.map((c) => {
          const prev = old.find((o) => o.id === c.id);
          return { id: c.id, name: c.name, animeIds: c.ids, createdAt: prev?.createdAt ?? Date.now(), pub: prev?.pub };
        }),
      );
    } catch { /* квота или приватный режим */ }
  };

  return <MyList initial={first} onSave={onSave} onClearHistory={clearWatchHistory} />;
}
