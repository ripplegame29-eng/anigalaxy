"use client";

import { useEffect, useState } from "react";

/** Постеры аниме для наборов: один запрос на сессию, дальше из памяти и sessionStorage */
let mem: Record<string, string> | null = null;
let pending: Promise<Record<string, string>> | null = null;
const KEY = "ag-series-posters-v1";

function load(): Promise<Record<string, string>> {
  if (mem) return Promise.resolve(mem);
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) {
      mem = JSON.parse(raw) as Record<string, string>;
      return Promise.resolve(mem);
    }
  } catch {
    /* не критично */
  }
  pending ??= fetch("/api/cards/series-posters")
    .then((r) => (r.ok ? r.json() : { posters: {} }))
    .then((d: { posters?: Record<string, string> }) => {
      const p = d.posters ?? {};
      if (Object.keys(p).length >= 10) {
        mem = p;
        try {
          sessionStorage.setItem(KEY, JSON.stringify(p));
        } catch {
          /* не критично */
        }
      }
      pending = null;
      return p;
    })
    .catch(() => {
      pending = null;
      return {};
    });
  return pending;
}

export function useSeriesPosters(): Record<string, string> {
  const [p, setP] = useState<Record<string, string>>(mem ?? {});
  useEffect(() => {
    let alive = true;
    void load().then((x) => alive && setP(x));
    return () => {
      alive = false;
    };
  }, []);
  return p;
}
