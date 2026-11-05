"use client";

import { useEffect, useSyncExternalStore } from "react";

export type Skin = "new" | "classic";
const KEY = "ag-cards-skin";
const subs = new Set<() => void>();
let cur: Skin = "classic";
let inited = false;

function init() {
  if (inited || typeof window === "undefined") return;
  inited = true;
  try {
    const q = new URLSearchParams(window.location.search).get("skin");
    const v = q ?? window.localStorage.getItem(KEY);
    if (v === "classic" || v === "new") cur = v;
  } catch {
    /* хранилище недоступно: остаёмся на классике */
  }
}

export function setSkin(v: Skin) {
  cur = v;
  try {
    window.localStorage.setItem(KEY, v);
  } catch {
    /* ignore */
  }
  subs.forEach((f) => f());
}

const subscribe = (f: () => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};

/** Оформление раздела карточек: «classic» (по умолчанию, как было) или «new» (графит Obsidian). */
export function useSkin(): Skin {
  const v = useSyncExternalStore(
    subscribe,
    () => {
      init();
      return cur;
    },
    () => "classic" as Skin,
  );
  // подключаем/отключаем файл нового оформления
  useEffect(() => {
    const id = "ag-cards-skin-css";
    const old = document.getElementById(id);
    if (v === "new" && !old) {
      const l = document.createElement("link");
      l.id = id;
      l.rel = "stylesheet";
      l.href = "/cards-skin.css?v=1";
      document.head.appendChild(l);
    } else if (v === "classic" && old) {
      old.remove();
    }
  }, [v]);
  return v;
}
