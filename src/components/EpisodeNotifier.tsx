"use client";

/**
 * Уведомления «вышла новая серия».
 *
 * Раз в несколько минут (и сразу при открытии сайта) сверяем расписание с
 * тем, что важно человеку: серии с колокольчиком в расписании и тайтлы из
 * избранного и истории (если в настройках включено «Новые серии»).
 * Когда время выхода наступило, показываем тост, пишем запись в колокольчик
 * шапки и — если браузеру разрешено — системное уведомление.
 *
 * Честное ограничение: проверка идёт, пока сайт открыт в браузере. Чтобы
 * уведомления приходили при закрытой вкладке, нужен сервер, который шлёт
 * push, — у проекта его нет.
 */

import { useEffect } from "react";
import { watchStore } from "@/lib/history";
import { loadFavorites } from "@/lib/collections";
import { addNotice } from "@/lib/profile";
import { readPrefs } from "@/lib/prefs";
import { pushToast } from "@/lib/toasts";

const REMIND_KEY = "animehub:schedule:reminders";
const DONE_KEY = "animehub:schedule:notified";
const POLL = 5 * 60_000;
/** Серии старше суток не «вышли только что» — не будим человека зря */
const FRESH = 24 * 60 * 60_000;

interface Row {
  id: string;
  title: string;
  at: string;
  episode: number;
}

function readList(key: string): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function EpisodeNotifier() {
  useEffect(() => {
    let alive = true;

    const check = async () => {
      const reminders = new Set(readList(REMIND_KEY));
      const prefs = readPrefs();
      const auto = prefs.notify.newEpisodes;
      if (reminders.size === 0 && !auto) return;

      let rows: Row[] = [];
      try {
        const res = await fetch("/api/schedule", { signal: AbortSignal.timeout(10_000) });
        if (!res.ok) return;
        rows = ((await res.json()) as { items?: Row[] }).items ?? [];
      } catch {
        return;
      }
      if (!alive) return;

      const favorites = new Set(loadFavorites());
      const watched = new Set(watchStore.get().records.map((record) => record.id));
      const done = new Set(readList(DONE_KEY));
      const now = Date.now();
      let changed = false;

      for (const row of rows) {
        const at = new Date(row.at).getTime();
        const key = `${row.id}:${row.episode}`;
        if (at > now || now - at > FRESH || done.has(key)) continue;
        const wanted = reminders.has(key) || (auto && (favorites.has(row.id) || watched.has(row.id)));
        if (!wanted) continue;

        done.add(key);
        changed = true;
        const text = `Вышла ${row.episode} серия «${row.title}»`;
        pushToast({ kind: "quest", title: `Серия ${row.episode} вышла`, text: row.title });
        addNotice(`${text}. Можно смотреть.`);

        if ("Notification" in window && Notification.permission === "granted") {
          try {
            const note = new Notification(`Серия ${row.episode} вышла`, {
              body: row.title,
              icon: "/icon.png",
              tag: key,
            });
            note.onclick = () => {
              window.focus();
              window.location.href = `/title/${row.id}`;
            };
          } catch {
            /* некоторые браузеры запрещают конструктор — тост и колокольчик уже есть */
          }
        }
      }

      if (changed) {
        try {
          localStorage.setItem(DONE_KEY, JSON.stringify([...done].slice(-200)));
        } catch {}
      }
    };

    void check();
    const timer = window.setInterval(check, POLL);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
