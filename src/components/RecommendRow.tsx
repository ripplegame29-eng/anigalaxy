"use client";

/**
 * «Рекомендуем вам» — ряд на главной по вкусу зрителя.
 *
 * Вкус считаем из того, что есть у человека в браузере: история просмотра
 * (свежее весит больше) и избранное (весит вдвое). Из жанров этих тайтлов
 * берём два самых частых, добираем лучшие по рейтингу тайтлы этих жанров
 * и убираем всё, что человек уже смотрел или сохранил.
 *
 * Пока истории и избранного нет, блок не показывается: выдумывать
 * «персональные» рекомендации для пустого профиля было бы враньём.
 */

import { useEffect, useMemo, useState } from "react";
import { watchStore } from "@/lib/history";
import { loadFavorites } from "@/lib/collections";
import { useTitles } from "@/lib/titles";
import type { AnimeCard as Card } from "@/lib/types";
import { AnimeRow } from "./AnimeRow";

const LIMIT = 14;
const cache = new Map<string, { at: number; cards: Card[] }>();
const TTL = 20 * 60_000;

async function fetchGenre(genre: string): Promise<Card[]> {
  const hit = cache.get(genre);
  if (hit && Date.now() - hit.at < TTL) return hit.cards;
  const res = await fetch(`/api/kodik/list?genre=${encodeURIComponent(genre)}&sort=rating`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { cards?: Card[] };
  const cards = data.cards ?? [];
  cache.set(genre, { at: Date.now(), cards });
  return cards;
}

export function RecommendRow() {
  const watch = watchStore.useStore();
  const titles = useTitles();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [cards, setCards] = useState<Card[]>([]);

  useEffect(() => {
    const read = () => setFavorites(loadFavorites());
    read();
    window.addEventListener("animehub:favorites-changed", read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("animehub:favorites-changed", read);
      window.removeEventListener("storage", read);
    };
  }, []);

  /** Любимые жанры и множество уже знакомых тайтлов */
  const taste = useMemo(() => {
    const score = new Map<string, number>();
    const seen = new Set<string>();
    let lastTitle = "";
    const add = (id: string, weight: number) => {
      for (const genre of titles[id]?.genres ?? []) score.set(genre, (score.get(genre) ?? 0) + weight);
    };

    const recent = new Set<string>();
    for (const record of watch.records) {
      seen.add(record.id);
      if (recent.has(record.id)) continue;
      recent.add(record.id);
      if (recent.size <= 12) add(record.id, 3 - Math.min(2, Math.floor(recent.size / 5)));
      if (!lastTitle) lastTitle = record.title || titles[record.id]?.title || "";
    }
    for (const id of favorites) {
      seen.add(id);
      add(id, 2);
    }

    const genres = [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([g]) => g);
    return { genres, seen, lastTitle };
  }, [watch.records, favorites, titles]);

  const key = taste.genres.join("|");

  useEffect(() => {
    if (!key) return;
    let alive = true;
    Promise.all(key.split("|").map((genre) => fetchGenre(genre).catch(() => [] as Card[])))
      .then((lists) => {
        if (!alive) return;
        // Перемешиваем жанры по очереди, чтобы лента не была одним жанром
        const mixed: Card[] = [];
        const longest = Math.max(0, ...lists.map((list) => list.length));
        for (let i = 0; i < longest; i += 1) for (const list of lists) if (list[i]) mixed.push(list[i]);
        const unique = new Map<string, Card>();
        for (const card of mixed) if (card.poster && !unique.has(card.id)) unique.set(card.id, card);
        setCards([...unique.values()].filter((card) => !taste.seen.has(card.id)).slice(0, LIMIT));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [key, taste.seen]);

  if (!key || cards.length < 4) return null;

  return (
    <AnimeRow
      title="Рекомендуем вам"
      mark="spark"
      cards={cards}
      href={`/catalog?genre=${encodeURIComponent(taste.genres[0])}&sort=rating`}
      viewAllLabel="Ещё по вкусу"
      headerExtra={
        <span className="rec-why" title="Подбираем по вашей истории просмотра и избранному">
          {taste.lastTitle ? `Вы смотрели «${taste.lastTitle}»` : `Любите: ${taste.genres.join(", ")}`}
        </span>
      }
    />
  );
}
