"use client";

import { PSelect } from "@/components/PSelect";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * «Подборки сообщества» — отдельный раздел.
 *
 * Транскрипция макета `collections.html`: герой с поиском и счётчиками,
 * карусель «выбор редакции», топ авторов, вкладки, сортировка, три вида
 * сетки, теги-фильтры, карточки с мозаикой и лайком, ящик с тайтлами,
 * форма создания, палитра по Ctrl+K, тосты, конфетти и наклон карточек.
 *
 * Отличия от макета:
 * • префикс `col-` у классов: в макете они generic (.hero, .card, .grid,
 *   .tabs), а такие имена в проекте уже заняты общими стилями;
 * • своя шапка и подвал макета не переносятся — у сайта они свои, как и
 *   счётчик AniCoin: баланс настоящий и живёт в движке прогрессии, а
 *   второй счётчик рядом с ним означал бы две разные валюты. Поэтому за
 *   прохождение подборки даётся прогресс и конфетти, а не монеты;
 * • лайки, свои подборки и отметки просмотра лежат в localStorage: сервера
 *   у проекта нет, витрина демонстрационная (см. `lib/collections-catalog.ts`).
 */

import {
  COLLECTIONS_CATALOG,
  COLLECTION_SUGGESTIONS,
  COLLECTION_TAGS,
  ago,
  allTags,
  collectionProgress,
  featured,
  filterCollections,
  formatCount,
  hueOf,
  itemTitle,
  mosaicItems,
  normalizeTitle,
  plural,
  topAuthors,
  type Collection,
  type SortKey,
} from "@/lib/collections-catalog";
import type { AnimeCard } from "@/lib/types";
import { parseList, useLocalSnapshot } from "@/lib/use-local-storage";
import "./collections.css";
import { PremiumChip } from "@/components/profile/PremiumChip";

/* ------------------------------- Хранилище ------------------------------- */

const KEY_LIKED = "ag_col_liked";
const KEY_MINE = "ag_col_mine";
const KEY_WATCHED = "ag_col_watched";

/** id подборки → индексы отмеченных тайтлов; битое значение — пустая карта */
function parseMap(raw: string): Record<number, number[]> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<number, number[]> = {};
    for (const [id, list] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(list)) continue;
      out[Number(id)] = list.filter((n): n is number => typeof n === "number");
    }
    return out;
  } catch {
    return {};
  }
}

const HEART = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M12 21s-8-5.2-9.5-10A5 5 0 0 1 12 7a5 5 0 0 1 9.5 4C20 15.8 12 21 12 21z" />
  </svg>
);

const SEARCH_ICON = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-4-4" />
  </svg>
);

const VIEW_ICONS = {
  grid: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="8" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
      <rect x="13" y="13" width="8" height="8" rx="2" />
    </svg>
  ),
  dense: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="2" y="3" width="5" height="5" rx="1" />
      <rect x="9.5" y="3" width="5" height="5" rx="1" />
      <rect x="17" y="3" width="5" height="5" rx="1" />
      <rect x="2" y="10" width="5" height="5" rx="1" />
      <rect x="9.5" y="10" width="5" height="5" rx="1" />
      <rect x="17" y="10" width="5" height="5" rx="1" />
    </svg>
  ),
  list: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="3" y="4" width="18" height="4" rx="2" />
      <rect x="3" y="10" width="18" height="4" rx="2" />
      <rect x="3" y="16" width="18" height="4" rx="2" />
    </svg>
  ),
};

type View = "grid" | "dense" | "list";
type Tab = "pop" | "new" | "ed" | "lk" | "my";


/** Премиальные duotone-иконки раздела (вместо эмодзи) */
type CIconName = "flame" | "clock" | "crown" | "heart" | "bookmark" | "dice" | "link" | "eye" | "stack";
const CI: Record<CIconName, React.ReactNode> = {
  flame: (
    <>
      <path d="M12 2.4c.7 3.1-1.2 4.5-2.8 6.3-1.5 1.7-2.7 3.5-2.7 5.9a5.5 5.5 0 0 0 11 0c0-2.3-1-3.6-2-4.9-.4 1.1-1 1.8-1.8 2.1.5-3.5-.4-6.6-1.7-9.4z" fill="currentColor" fillOpacity=".24" />
      <path d="M12 12.2c-1.6 1.4-2.3 2.3-2.3 3.5a2.3 2.3 0 0 0 4.6 0c0-1.2-.7-2.1-2.3-3.5z" fill="currentColor" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.6" fill="currentColor" fillOpacity=".2" />
      <path d="M12 7.2V12l3.2 2" />
    </>
  ),
  crown: (
    <>
      <path d="M3.4 8.2l4.4 4 4.2-7 4.2 7 4.4-4-1.9 10.2H5.3z" fill="currentColor" fillOpacity=".24" />
      <path d="M6 20.4h12" />
    </>
  ),
  heart: <path d="M12 20.2s-7.6-4.6-7.6-10.3A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.6 2.6c0 5.7-7.6 10.3-7.6 10.3z" fill="currentColor" fillOpacity=".24" />,
  bookmark: <path d="M7.2 3.6h9.6a1 1 0 0 1 1 1V21L12 16.9 6.2 21V4.6a1 1 0 0 1 1-1z" fill="currentColor" fillOpacity=".24" />,
  dice: (
    <>
      <rect x="3.6" y="3.6" width="16.8" height="16.8" rx="4.4" fill="currentColor" fillOpacity=".2" />
      <circle cx="8.6" cy="8.6" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15.4" cy="15.4" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  eye: (
    <>
      <path d="M2.6 12S6 5.8 12 5.8 21.4 12 21.4 12 18 18.2 12 18.2 2.6 12 2.6 12z" fill="currentColor" fillOpacity=".2" />
      <circle cx="12" cy="12" r="2.9" fill="currentColor" />
    </>
  ),
  stack: (
    <>
      <path d="M4 7l8-3.6L20 7l-8 3.6z" fill="currentColor" fillOpacity=".26" />
      <path d="M4 12l8 3.6 8-3.6M4 16.8l8 3.6 8-3.6" />
    </>
  ),
};
function CIcon({ n, className = "" }: { n: CIconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`col-ic col-ic-${n} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {CI[n]}
    </svg>
  );
}

const TABS: { id: Tab; label: string; icon: CIconName }[] = [
  { id: "pop", label: "Популярное", icon: "flame" },
  { id: "new", label: "Новое", icon: "clock" },
  { id: "ed", label: "Выбор редакции", icon: "crown" },
  { id: "lk", label: "Понравившиеся", icon: "heart" },
  { id: "my", label: "Мои", icon: "bookmark" },
];

const SORTS: { id: SortKey; label: string }[] = [
  { id: "views", label: "По просмотрам" },
  { id: "likes", label: "По лайкам" },
  { id: "size", label: "По числу тайтлов" },
  { id: "date", label: "Сначала новые" },
  { id: "prog", label: "По моему прогрессу" },
];

const PER: Record<View, number> = { grid: 9, dense: 15, list: 9 };

/**
 * Плитка мозаики: постер, а названием подписаны только плитки без картинки —
 * ровно как в макете, где вместо обложек стояли градиенты.
 */
function tile(item: Collection["items"][number], index: number, posters?: Record<string, string>) {
  const title = itemTitle(item);
  const poster = (typeof item === "string" ? undefined : item.poster) ?? posters?.[normalizeTitle(title)];
  const hue = hueOf(title) + index * 8;
  return (
    <div
      key={`${title}-${index}`}
      className="col-t"
      style={{
        background: poster
          ? `url(${poster}) center/cover`
          : `linear-gradient(150deg,hsl(${hue} 75% 52%),hsl(${(hue + 55) % 360} 70% 18%))`,
      }}
    >
      {!poster && <span>{title}</span>}
    </div>
  );
}

/* --------------------------------- Вид ----------------------------------- */

export interface CollectionsViewProps {
  /** «название тайтла в подборке → постер»; без него плитки градиентные */
  posters?: Record<string, string>;
  /** Подборка, которую надо открыть сразу (из ссылки «Поделиться») */
  initialId?: number | null;
}

export function CollectionsView({ posters, initialId }: CollectionsViewProps) {
  const [catalog, setCatalog] = useState<Collection[]>(COLLECTIONS_CATALOG);
  const [tab, setTab] = useState<Tab>("pop");
  const [tags, setTags] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("views");
  const [view, setView] = useState<View>("grid");
  const [page, setPage] = useState(1);
  const [author, setAuthor] = useState<string | null>(null);
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);

  /* Ссылка вида `/collections?c=12` открывает подборку сразу — её отдаёт
     кнопка «Поделиться». Параметр разбирает серверная страница и передаёт
     сюда готовым числом: так ссылка работает и без гидрации. */
  const [openId, setOpenId] = useState<number | null>(initialId ?? null);
  const [creating, setCreating] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [toast, setToast] = useState("");

  /* Состояние из хранилища читаем штатным `useLocalSnapshot`: гидратация
     совпадает с серверным HTML, а «прочитать в useEffect и сделать
     setState» запрещено линтером проекта. */
  const storedLiked = useLocalSnapshot(KEY_LIKED);
  const storedMine = useLocalSnapshot(KEY_MINE);
  const storedWatched = useLocalSnapshot(KEY_WATCHED);

  /* Изменения в этой же вкладке `storage` не подтверждает — держим их
     отдельно; при перезагрузке они читаются из хранилища. */
  const [patch, setPatch] = useState<{
    liked?: number[];
    mine?: number[];
    watched?: Record<number, number[]>;
  }>({});

  const liked = useMemo(() => new Set(patch.liked ?? parseList<number>(storedLiked, [])), [patch.liked, storedLiked]);
  const mine = useMemo(() => new Set(patch.mine ?? parseList<number>(storedMine, [])), [patch.mine, storedMine]);
  const watched = useMemo(() => patch.watched ?? parseMap(storedWatched), [patch.watched, storedWatched]);

  /** Запись в состояние и в хранилище одной операцией */
  const commit = useCallback((next: { liked?: number[]; mine?: number[]; watched?: Record<number, number[]> }) => {
    setPatch((prev) => {
      const merged = { ...prev, ...next };
      try {
        if (next.liked) window.localStorage.setItem(KEY_LIKED, JSON.stringify(next.liked));
        if (next.mine) window.localStorage.setItem(KEY_MINE, JSON.stringify(next.mine));
        if (next.watched) window.localStorage.setItem(KEY_WATCHED, JSON.stringify(next.watched));
      } catch {
        /* приватный режим — молча пропускаем */
      }
      return merged;
    });
  }, []);

  const say = useCallback((text: string) => {
    setToast(text);
    window.setTimeout(() => setToast((cur) => (cur === text ? "" : cur)), 2400);
  }, []);

  /* ------------------------------ Отбор ---------------------------------- */

  const filterState = useMemo(
    () => ({ tab, tags, query, sort, author, liked, mine, watched }),
    [tab, tags, query, sort, author, liked, mine, watched],
  );

  const filtered = useMemo(() => filterCollections(catalog, filterState), [catalog, filterState]);
  const visible = filtered.slice(0, page * PER[view]);

  const authors = useMemo(() => topAuthors(catalog), [catalog]);
  const tagList = useMemo(() => allTags(catalog), [catalog]);
  const featuredList = useMemo(() => featured(catalog), [catalog]);

  const stats = useMemo(
    () => [
      ["Подборок", catalog.length],
      ["Авторов", new Set(catalog.map((c) => c.author)).size],
      ["Тайтлов", catalog.reduce((sum, c) => sum + c.items.length, 0)],
      ["Лайков", catalog.reduce((sum, c) => sum + c.likes, 0)],
    ],
    [catalog],
  );

  const myCount = catalog.filter((c) => mine.has(c.id) || watched[c.id]?.length).length;

  /* ---------------------------- Карусель --------------------------------- */

  useEffect(() => {
    if (featuredList.length < 2 || paused) return;
    const timer = window.setInterval(() => setSlide((s) => (s + 1) % featuredList.length), 6500);
    return () => window.clearInterval(timer);
  }, [featuredList.length, paused]);

  /* ------------------------------ Звёзды --------------------------------- */

  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const stars = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      return Array.from({ length: 90 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.4 + 0.3,
        s: Math.random() * 0.4 + 0.1,
        p: Math.random() * 6,
      }));
    };
    let list = stars();
    const onResize = () => {
      list = stars();
    };
    window.addEventListener("resize", onResize);

    let raf = 0;
    const frame = (t: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const s of list) {
        s.y -= s.s * 0.3;
        if (s.y < 0) s.y = canvas.height;
        ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t / 900 + s.p));
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, 7);
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  /* ----------------------------- Действия -------------------------------- */

  /** Сердечки из макета: разлетаются от кнопки лайка */
  const hearts = (button: HTMLElement) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const box = button.getBoundingClientRect();
    for (let i = 0; i < 7; i += 1) {
      const el = document.createElement("i");
      el.className = "col-bu";
      el.textContent = "♥";
      el.style.left = `${box.left + box.width / 2}px`;
      el.style.top = `${box.top + box.height / 2}px`;
      el.style.setProperty("--dx", `${(Math.random() - 0.5) * 70}px`);
      el.style.setProperty("--dy", `${-30 - Math.random() * 50}px`);
      document.body.appendChild(el);
      window.setTimeout(() => el.remove(), 850);
    }
  };

  /** Конфетти — тот же канвас, что в макете, поверх страницы */
  const confetti = useCallback(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:fixed;inset:0;z-index:400;pointer-events:none";
    document.body.appendChild(canvas);
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      canvas.remove();
      return;
    }
    const colors = ["#38e1ff", "#8b5cff", "#ff5c9d", "#61d1ff", "#4dffb0"];
    const parts = Array.from({ length: 140 }, () => ({
      x: window.innerWidth / 2,
      y: window.innerHeight * 0.6,
      vx: (Math.random() - 0.5) * 16,
      vy: -Math.random() * 18 - 4,
      c: colors[(Math.random() * colors.length) | 0],
      s: Math.random() * 8 + 4,
      r: Math.random() * 6,
    }));
    let n = 0;
    const frame = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of parts) {
        p.vy += 0.45;
        p.x += p.vx;
        p.y += p.vy;
        p.r += 0.2;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      }
      n += 1;
      if (n < 130) requestAnimationFrame(frame);
      else canvas.remove();
    };
    requestAnimationFrame(frame);
  }, []);

  const toggleLike = useCallback(
    (id: number, button?: HTMLElement) => {
      const next = new Set(liked);
      const has = next.has(id);
      if (has) next.delete(id);
      else next.add(id);
      commit({ liked: [...next] });
      say(has ? "Лайк убран" : "♥ Добавлено в «Понравившиеся»");
      if (button && !has) hearts(button);
      if (tab === "lk") setPage(1);
    },
    [liked, commit, say, tab],
  );

  const toggleWatched = useCallback(
    (id: number, index: number) => {
      const collection = catalog.find((c) => c.id === id);
      if (!collection) return;
      const list = new Set(watched[id] ?? []);
      if (list.has(index)) list.delete(index);
      else list.add(index);
      commit({ watched: { ...watched, [id]: [...list] } });
      if (list.size === collection.items.length) {
        confetti();
        say("🎉 Подборка пройдена!");
      }
    },
    [catalog, watched, commit, confetti, say],
  );

  const openDetail = useCallback((id: number) => setOpenId(id), [setOpenId]);
  const closeAll = useCallback(() => {
    setOpenId(null);
    setCreating(false);
    setPaletteOpen(false);
  }, [setOpenId, setCreating, setPaletteOpen]);

  /* ----------------------------- Палитра ---------------------------------- */

  const paletteRows = useMemo(() => {
    const q = paletteQuery.trim().toLowerCase();
    const rows: { kind: "c" | "t"; collection: Collection; title: string; note: string }[] = [];
    for (const c of catalog) {
      if (q && !`${c.title}${c.tags.join(" ")}${c.author}`.toLowerCase().includes(q)) continue;
      rows.push({ kind: "c", collection: c, title: c.title, note: `${c.items.length} тайтлов · ♥ ${c.likes}` });
    }
    if (q) {
      for (const c of catalog) {
        for (const item of c.items) {
          if (rows.length >= 14) break;
          const title = itemTitle(item);
          if (!title.toLowerCase().includes(q)) continue;
          rows.push({ kind: "t", collection: c, title, note: `в «${c.title}»` });
        }
      }
    }
    return rows;
  }, [catalog, paletteQuery]);

  useEffect(() => {
    /* Escape закрывает любое открытое окно — как в макете: и ящик, и форма,
       и палитра. Раньше обработчик жил только внутри палитры, и после
       неё Escape переставал закрывать ящик. */
    const onKeyGlobal = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
        setPaletteQuery("");
        setPaletteIndex(0);
        return;
      }
      if (event.key === "Escape") closeAll();
    };
    document.addEventListener("keydown", onKeyGlobal);
    return () => document.removeEventListener("keydown", onKeyGlobal);
  }, [closeAll]);

  useEffect(() => {
    if (!paletteOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setPaletteIndex((i) => Math.min(paletteRows.length - 1, i + 1));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setPaletteIndex((i) => Math.max(0, i - 1));
      }
      if (event.key === "Enter") {
        const row = paletteRows[paletteIndex];
        if (row) {
          closeAll();
          openDetail(row.collection.id);
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [paletteOpen, paletteIndex, paletteRows, closeAll, openDetail]);

  /* ------------------------------ Разметка -------------------------------- */

  const mosaic = (collection: Collection) =>
    mosaicItems(collection).map((i, k) => tile(collection.items[i], k, posters));

  const avatar = (name: string, cls = "col-ava") => {
    const h = hueOf(name);
    return (
      <span
        className={cls}
        style={{ background: `linear-gradient(135deg,hsl(${h} 80% 55%),hsl(${(h + 60) % 360} 70% 35%))` }}
      >
        {name[0]?.toUpperCase()}
      </span>
    );
  };

  const onCardMove = (event: React.MouseEvent<HTMLElement>) => {
    const card = event.currentTarget;
    const box = card.getBoundingClientRect();
    const x = event.clientX - box.left;
    const y = event.clientY - box.top;
    card.style.setProperty("--mx", `${x}px`);
    card.style.setProperty("--my", `${y}px`);
    // Наклон вдвое мягче, чем в макете: карточка слегка оживает, а не
    // переворачивается под курсором
    card.style.transform = `perspective(1100px) rotateX(${((y / box.height) - 0.5) * -3.5}deg) rotateY(${((x / box.width) - 0.5) * 3.5}deg) translateY(-3px)`;
  };

  const onCardLeave = (event: React.MouseEvent<HTMLElement>) => {
    event.currentTarget.style.transform = "";
  };

  const router = useRouter();
  const [opening, setOpening] = useState<number | null>(null);
  /** Подборка хранит только названия — находим тайтл поиском и открываем его страницу */
  const openTitlePage = async (name: string, index: number) => {
    setOpening(index);
    try {
      const res = await fetch(`/api/kodik/search?q=${encodeURIComponent(name)}&limit=8`);
      const data = res.ok ? ((await res.json()) as { results?: { id: string; title?: string }[] }) : {};
      const norm = (t?: string) => (t ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
      const list = data.results ?? [];
      /* Точное совпадение названия важнее первой позиции поиска (у франшизы много сезонов) */
      const id = (list.find((r) => norm(r.title) === norm(name)) ?? list[0])?.id;
      router.push(id ? `/title/${id}` : `/catalog?q=${encodeURIComponent(name)}`);
    } catch {
      router.push(`/catalog?q=${encodeURIComponent(name)}`);
    } finally {
      setOpening(null);
    }
  };
  const open = openId === null ? null : catalog.find((c) => c.id === openId) ?? null;
  const openWatched = openId === null ? [] : (watched[openId] ?? []);

  return (
    <div className="col-page">
      <div className="col-bg" aria-hidden>
        <span className="col-bg-neb n1" />
        <span className="col-bg-neb n2" />
        <span className="col-bg-neb n3" />
        <span className="col-bg-veil" />
        <span className="col-bg-petals">
          {Array.from({ length: 12 }, (_, i) => (
            <i key={i} style={{ ["--i" as string]: i }} />
          ))}
        </span>
        <span className="col-bg-grid" />
        <span className="col-bg-dust">
          {Array.from({ length: 22 }, (_, i) => (
            <i key={i} style={{ ["--i" as string]: i }} />
          ))}
        </span>
        <span className="col-bg-vig" />
      </div>
      <div className="col-wrap">
        {/* ------------------------------ Hero ------------------------------ */}
        <section className="col-hero">
          <div className="col-aur">
            <i />
            <i />
            <i />
          </div>
          <canvas id="col-stars" ref={canvasRef} aria-hidden />
          <div className="col-grain" />
          <span className="col-eyebrow">✦ ПОДБОРКИ СООБЩЕСТВА</span>
          <h1>
            Найди своё аниме
            <br />
            <span>в лучших подборках</span>
          </h1>
          <p className="col-sub">
            Курируемые списки тайтлов: от шедевров на все времена до уютных вечерних марафонов.
            Лайкайте любимое, отмечайте просмотренное и проходите подборки до конца.
          </p>
          <div className="col-sbox">
            {SEARCH_ICON}
            <input
              value={query}
              placeholder="Найти подборку: «исэкай», «уютное», «драма»…"
              autoComplete="off"
              aria-label="Поиск по подборкам"
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
            <button
              type="button"
              className="col-kbd"
              onClick={() => {
                setPaletteOpen(true);
                setPaletteQuery("");
                setPaletteIndex(0);
              }}
            >
              Ctrl + K
            </button>
          </div>
          <div className="col-sugg">
            {COLLECTION_SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setQuery(s);
                  setPage(1);
                }}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="col-stats">
            {stats.map(([label, value]) => (
              <div className="col-stat" key={label}>
                <b>{value.toLocaleString("ru-RU")}</b>
                <small>{label}</small>
              </div>
            ))}
          </div>
        </section>

        {/* --------------------------- Карусель ---------------------------- */}
        {featuredList.length > 0 && (
          <section
            className={`col-feat${paused ? " col-pause" : ""}`}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            {featuredList.map((c, i) => (
              <div key={c.id} className={`col-slide${i === slide ? " col-on" : ""}`}>
                <div className="col-bgm">{mosaic(c)}</div>
                <div className="col-mos">{mosaic(c)}</div>
                <div className="col-info">
                  <span className="col-badge"><CIcon n="crown" /> ВЫБОР РЕДАКЦИИ · №{i + 1}</span>
                  <h2>{c.title}</h2>
                  <p>{c.desc}</p>
                  <div className="col-row">
                    {c.tags.map((t) => (
                      <span className="col-tag" key={t}>
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="col-fm">
                    <span>
                      <CIcon n="stack" /> {c.items.length} {plural(c.items.length, ["тайтл", "тайтла", "тайтлов"])}
                    </span>
                    <span><CIcon n="heart" /> {c.likes}</span>
                    <span><CIcon n="eye" /> {formatCount(c.views)}</span>
                  </div>
                  <div className="col-row">
                    <button type="button" className="col-btn col-pri" onClick={() => openDetail(c.id)}>
                      Открыть подборку →
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <div className="col-fnav">
              <button
                type="button"
                className="col-a"
                aria-label="Предыдущая"
                onClick={() => setSlide((s) => (s - 1 + featuredList.length) % featuredList.length)}
              >
                ‹
              </button>
              <div className="col-dots">
                {featuredList.map((c, i) => (
                  <i
                    key={c.id}
                    className={i === slide ? "col-on" : ""}
                    onClick={() => setSlide(i)}
                    role="button"
                    aria-label={`Подборка ${i + 1}`}
                  />
                ))}
              </div>
              <button
                type="button"
                className="col-a"
                aria-label="Следующая"
                onClick={() => setSlide((s) => (s + 1) % featuredList.length)}
              >
                ›
              </button>
            </div>
          </section>
        )}

        {/* ---------------------------- Авторы ----------------------------- */}
        <div className="col-sec">
          <h3>Топ авторов</h3>
          <small>нажмите, чтобы отфильтровать</small>
        </div>
        <div className="col-auths">
          {authors.map((a, i) => (
            <button
              key={a.name}
              type="button"
              className={`col-au${author === a.name ? " col-on" : ""}`}
              onClick={() => {
                setAuthor((cur) => (cur === a.name ? null : a.name));
                setPage(1);
              }}
            >
              <div className="col-ring">{avatar(a.name)}</div>
              <div>
                <b>
                  {a.name}
                  <span className="col-rk">#{i + 1}</span>
                </b>
                <small>
                  {a.count} {plural(a.count, ["подборка", "подборки", "подборок"])} · ♥ {a.likes}
                </small>
              </div>
            </button>
          ))}
        </div>

        {/* ---------------------------- Панель ----------------------------- */}
        <div className="col-sec" style={{ marginTop: 36 }}>
          <h3>Все подборки</h3>
        </div>
        <div className="col-bar">
          <div className="col-tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`col-tab${tab === t.id ? " col-on" : ""}`}
                onClick={() => {
                  setTab(t.id);
                  setPage(1);
                }}
              >
                <CIcon n={t.icon} />
                {t.label}
                {t.id === "lk" && <em>{liked.size}</em>}
                {t.id === "my" && <em>{myCount}</em>}
              </button>
            ))}
          </div>
          <PSelect
            className="col-sel"
            value={sort}
            aria-label="Сортировка"
            onChange={(event) => {
              setSort(event.target.value as SortKey);
              setPage(1);
            }}
          >
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </PSelect>
          <div className="col-seg">
            {(Object.keys(VIEW_ICONS) as View[]).map((v) => (
              <button
                key={v}
                type="button"
                className={view === v ? "col-on" : ""}
                title={v === "grid" ? "Сетка" : v === "dense" ? "Компактно" : "Список"}
                aria-label={v === "grid" ? "Сетка" : v === "dense" ? "Компактно" : "Список"}
                onClick={() => {
                  setView(v);
                  setPage(1);
                }}
              >
                {VIEW_ICONS[v]}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="col-btn col-gh"
            onClick={() => {
              const pick = catalog[Math.random() * catalog.length | 0];
              if (pick) openDetail(pick.id);
            }}
          >
            <CIcon n="dice" /> Мне повезёт
          </button>
          <button type="button" className="col-btn col-pri" style={{ marginLeft: "auto" }} onClick={() => setCreating(true)}>
            ＋ Создать подборку
          </button>
        </div>

        <div className="col-chips">
          {tagList.map((t) => (
            <button
              key={t}
              type="button"
              className={`col-chip${tags.has(t) ? " col-on" : ""}`}
              onClick={() => {
                setTags((prev) => {
                  const next = new Set(prev);
                  if (next.has(t)) next.delete(t);
                  else next.add(t);
                  return next;
                });
                setPage(1);
              }}
            >
              {t}
            </button>
          ))}
          {author && (
            <button type="button" className="col-chip col-on" onClick={() => setAuthor(null)}>
              Автор: {author} ✕
            </button>
          )}
          {tags.size > 0 && (
            <button type="button" className="col-chip" onClick={() => setTags(new Set())}>
              ✕ Сбросить теги
            </button>
          )}
        </div>

        <div className="col-rar">
          <span className="col-count">
            {filtered.length
              ? `${filtered.length} ${plural(filtered.length, ["подборка", "подборки", "подборок"])}`
              : ""}
          </span>
        </div>

        {/* ---------------------------- Сетка ------------------------------ */}
        <div className={`col-grid${view === "grid" ? "" : ` col-${view}`}`}>
          {visible.length ? (
            visible.map((c, i) => {
              const progress = collectionProgress(c, watched[c.id] ?? []);
              return (
                <article
                  key={c.id}
                  className="col-card"
                  style={{ animationDelay: `${(i % 9) * 55}ms` }}
                  onClick={() => openDetail(c.id)}
                  onMouseMove={view === "list" ? undefined : onCardMove}
                  onMouseLeave={onCardLeave}
                >
                  <button
                    type="button"
                    className={`col-like${liked.has(c.id) ? " col-on" : ""}`}
                    aria-label="Лайк"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleLike(c.id, event.currentTarget);
                    }}
                  >
                    {HEART}
                  </button>
                  <div className="col-mosaic">
                    {mosaic(c)}
                    <div className="col-meta">
                      <span className="col-pill"><CIcon n="stack" /> {c.items.length}</span>
                      <button
                        type="button"
                        className={`col-pill col-lk${liked.has(c.id) ? " col-on" : ""}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleLike(c.id);
                        }}
                      >
                        <CIcon n="heart" /> <span>{c.likes + (liked.has(c.id) ? 1 : 0)}</span>
                      </button>
                      <span className="col-pill col-r"><CIcon n="eye" /> {formatCount(c.views)}</span>
                    </div>
                  </div>
                  <div className="col-body">
                    <h3>{c.title}</h3>
                    <p>{c.desc}</p>
                    <div className="col-tags">
                      {c.tags.slice(0, 3).map((t) => (
                        <span className="col-tag" key={t}>
                          {t}
                        </span>
                      ))}
                      {c.tags.length > 3 && <span className="col-tag">+{c.tags.length - 3}</span>}
                    </div>
                    {progress > 0 && (
                      <div className={`col-prg${progress >= 1 ? " col-done" : ""}`}>
                        <i style={{ width: `${progress * 100}%` }} />
                      </div>
                    )}
                    <div className="col-auth">
                      {avatar(c.author)}
                      <span>{c.author}</span>
                      {c.pm && <PremiumChip />}
                      <span className="col-when">{ago(c.age)}</span>
                    </div>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="col-empty">
              <b>Ничего не найдено</b>
              Измените запрос или фильтры
              {tab === "lk" && " — поставьте ♥ понравившимся подборкам, и они появятся здесь"}
              {tab === "my" && " — создайте свою подборку или отметьте просмотренные тайтлы"}
            </div>
          )}
        </div>

        {filtered.length > visible.length && (
          <button type="button" className="col-btn col-gh col-more" onClick={() => setPage((p) => p + 1)}>
            Показать ещё
          </button>
        )}
      </div>

      {/* ----------------------------- Ящик ---------------------------------- */}
      <div className={`col-ov col-d${open ? " col-show" : ""}`} onClick={(e) => e.target === e.currentTarget && closeAll()}>
        <aside className="col-drawer">
          {open && (
            <>
              <button type="button" className="col-x" aria-label="Закрыть" onClick={closeAll}>
                ✕
              </button>
              <span className="col-badge">{open.ed ? <><CIcon n="crown" /> ВЫБОР РЕДАКЦИИ</> : "ПОДБОРКА"}</span>
              <h2 style={{ marginTop: 14, fontSize: 28, letterSpacing: "-0.02em" }}>{open.title}</h2>
              <div className="col-row" style={{ marginTop: 8, color: "var(--mut)", fontSize: 13, fontWeight: 600 }}>
                {avatar(open.author)}
                <span>{open.author}</span>
                <span>· {ago(open.age)}</span>
              </div>
              <div className="col-dhead">{mosaic(open)}</div>
              <p style={{ color: "#a9b1c4", lineHeight: 1.65 }}>{open.desc}</p>
              <div className="col-tags">
                {open.tags.map((t) => (
                  <span className="col-tag" key={t}>
                    {t}
                  </span>
                ))}
              </div>
              <div className="col-dstat">
                <div>
                  <b>{open.items.length}</b>
                  <small>тайтлов</small>
                </div>
                <div>
                  <b><CIcon n="heart" /> {open.likes + (liked.has(open.id) ? 1 : 0)}</b>
                  <small>лайков</small>
                </div>
                <div>
                  <b>{formatCount(open.views)}</b>
                  <small>просмотров</small>
                </div>
              </div>
              <div className="col-row" style={{ justifyContent: "space-between", fontWeight: 700, fontSize: 14 }}>
                <span>Ваш прогресс</span>
                <span>
                  {openWatched.length}/{open.items.length} ·{" "}
                  {Math.round(collectionProgress(open, openWatched) * 100)}%
                </span>
              </div>
              <div className="col-prg" style={{ height: 8, marginTop: 8 }}>
                <i style={{ width: `${collectionProgress(open, openWatched) * 100}%` }} />
              </div>
              <div className="col-row">
                <button type="button" className="col-btn col-pri" onClick={(event) => toggleLike(open.id, event.currentTarget)}>
                  <CIcon n="heart" /> {liked.has(open.id) ? "В избранном" : "В избранное"}
                </button>
                <button
                  type="button"
                  className="col-btn col-gh"
                  onClick={async () => {
                    const url = `${window.location.origin}/collections?c=${open.id}`;
                    try {
                      await navigator.clipboard.writeText(url);
                      say("Ссылка скопирована");
                    } catch {
                      say("Скопируйте ссылку из адресной строки");
                    }
                  }}
                >
                  <CIcon n="link" /> Поделиться
                </button>
                <button
                  type="button"
                  className="col-btn col-gh"
                  onClick={() => {
                    const rest = open.items.map((_, i) => i).filter((i) => !openWatched.includes(i));
                    const pool = rest.length ? rest : open.items.map((_, i) => i);
                    say(`🎲 Смотрите: ${itemTitle(open.items[pool[Math.random() * pool.length | 0]])}`);
                  }}
                >
                  <CIcon n="dice" /> Что смотреть?
                </button>
              </div>
              <p style={{ color: "var(--mut)", fontSize: 12, marginTop: 14 }}>
                Нажимайте на тайтлы, чтобы отмечать просмотренные. Полное прохождение подборки
                засчитывается во вкладке «Мои».
              </p>
              <div className="col-items">
                {open.items.map((item, i) => (
                  <div key={`${itemTitle(item)}-${i}`} className={`col-it${openWatched.includes(i) ? " col-w" : ""}`}>
                    <button type="button" className="col-it-main" onClick={() => toggleWatched(open.id, i)}>
                      <i>{openWatched.includes(i) ? "✓" : i + 1}</i>
                      <span>{itemTitle(item)}</span>
                    </button>
                    <button
                      type="button"
                      className="col-it-go"
                      title="Открыть страницу тайтла"
                      aria-label={`Открыть страницу: ${itemTitle(item)}`}
                      disabled={opening === i}
                      onClick={() => openTitlePage(itemTitle(item), i)}
                    >
                      {opening === i ? "…" : "Открыть"}
                      <svg viewBox="0 0 24 24" aria-hidden>
                        <path d="M5 12h14m-6-6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              {openWatched.length === open.items.length && open.items.length > 0 && (
                <p style={{ marginTop: 16, color: "#4dffb0", fontWeight: 700 }}>🎉 Подборка пройдена</p>
              )}
            </>
          )}
        </aside>
      </div>

      {/* --------------------------- Создание ------------------------------- */}
      <CreateDialog
        open={creating}
        onClose={closeAll}
        posters={posters}
        onCreate={(collection) => {
          setCatalog((prev) => [collection, ...prev]);
          commit({ mine: [...mine, collection.id] });
          setTab("new");
          setPage(1);
          closeAll();
          confetti();
          say("Подборка опубликована");
        }}
      />

      {/* ---------------------------- Палитра ------------------------------- */}
      <div
        className={`col-ov col-p${paletteOpen ? " col-show" : ""}`}
        onClick={(e) => e.target === e.currentTarget && closeAll()}
      >
        <div className="col-pal">
          <input
            value={paletteQuery}
            placeholder="Поиск подборок и тайтлов…  ↑↓ Enter"
            aria-label="Палитра"
            onChange={(event) => {
              setPaletteQuery(event.target.value);
              setPaletteIndex(0);
            }}
            ref={(node) => node?.focus()}
          />
          <div className="col-pr">
            {paletteRows.length ? (
              paletteRows.map((row, i) => (
                <button
                  key={`${row.kind}-${row.collection.id}-${row.title}-${i}`}
                  type="button"
                  className={`col-pi${i === paletteIndex ? " col-on" : ""}`}
                  onMouseEnter={() => setPaletteIndex(i)}
                  onClick={() => {
                    closeAll();
                    openDetail(row.collection.id);
                  }}
                >
                  {row.kind === "c" ? "▦" : "▶"} {row.title}
                  <small>{row.note}</small>
                </button>
              ))
            ) : (
              <h6>НИЧЕГО НЕ НАЙДЕНО</h6>
            )}
          </div>
        </div>
      </div>

      <div className={`col-toast${toast ? " col-show" : ""}`} role="status" aria-live="polite">
        {toast}
      </div>
    </div>
  );
}

/* --------------------------- Форма создания ------------------------------ */

interface CreateProps {
  open: boolean;
  onClose: () => void;
  onCreate: (collection: Collection) => void;
  posters?: Record<string, string>;
}

/** Тайтл, добавленный в подборку: название Kodik и его постер */
interface Picked {
  title: string;
  poster?: string;
}

function CreateDialog({ open, onClose, onCreate, posters }: CreateProps) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [picked, setPicked] = useState<Picked[]>([]);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<AnimeCard[]>([]);
  const [searching, setSearching] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Поля чистим в обработчиках закрытия, а не в эффекте: setState прямо в
     useEffect запрещён линтером проекта и лишний раз рендерит форму. */
  const close = () => {
    if (timer.current) clearTimeout(timer.current);
    setTitle("");
    setDesc("");
    setTagsText("");
    setPicked([]);
    setQuery("");
    setFound([]);
    onClose();
  };

  /* Поиск идёт тем же API, что и строка в шапке: реальные тайтлы Kodik с
     их постерами — вбивать названия руками было как раз тем, от чего уходят. */
  const search = async (value: string) => {
    const q = value.trim();
    if (q.length < 2) {
      setFound([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const get = async (url: string): Promise<AnimeCard[]> => {
        try {
          const res = await fetch(url);
          return res.ok ? (((await res.json()) as { results?: AnimeCard[] }).results ?? []) : [];
        } catch {
          return [];
        }
      };
      // Аниме и манга ищутся параллельно: упавший источник не должен прятать второй
      const [anime, manga] = await Promise.all([
        get(`/api/kodik/search?limit=8&q=${encodeURIComponent(q)}`),
        get(`/api/manga/search?limit=4&q=${encodeURIComponent(q)}`),
      ]);
      setFound([...anime.slice(0, 6), ...manga.map((m) => ({ ...m, manga: true }))].slice(0, 10));
    } catch {
      setFound([]);
    } finally {
      setSearching(false);
    }
  };

  const onQueryChange = (value: string) => {
    setQuery(value);
    setHighlight(0);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void search(value);
    }, 250);
  };

  const add = (card: AnimeCard) => {
    setPicked((prev) =>
      prev.some((p) => normalizeTitle(p.title) === normalizeTitle(card.title))
        ? prev
        : [...prev, { title: card.title, poster: card.poster }],
    );
    if (timer.current) clearTimeout(timer.current);
    setQuery("");
    setFound([]);
    setHighlight(0);
  };

  const onSearchKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!found.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((i) => (i + 1) % found.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((i) => (i - 1 + found.length) % found.length);
    } else if (event.key === "Enter") {
      // Enter в поле поиска добавляет тайтл, а не отправляет форму
      event.preventDefault();
      const card = found[highlight];
      if (card) add(card);
    }
  };

  const items: (string | { t: string; poster?: string })[] = picked.map((p) => ({ t: p.title, poster: p.poster }));

  const preview: Collection = {
    id: 0,
    title: title || "Название подборки",
    desc: desc || "Здесь появится описание вашей подборки",
    tags: tagsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    views: 0,
    likes: 0,
    author: "Вы",
    pm: false,
    ed: false,
    age: 0,
    items: items.length ? items : ["Тайтл 1", "Тайтл 2", "Тайтл 3", "Тайтл 4"],
  };

  if (!open) return null;

  return (
    <div className="col-ov col-c col-show" onClick={(e) => e.target === e.currentTarget && close()}>
      <form
        className="col-modal"
        onSubmit={(event) => {
          event.preventDefault();
          if (items.length < 2) return;
          onCreate({
            ...preview,
            id: Date.now(),
            title: title.trim(),
            desc: desc.trim() || "Без описания",
            tags: preview.tags.slice(0, 6),
            items,
          });
          close();
        }}
      >
        <button type="button" className="col-x" aria-label="Закрыть" onClick={close}>
          ✕
        </button>
        <h2>Новая подборка</h2>
        <p style={{ color: "var(--mut)", fontSize: 14, marginTop: 4 }}>
          Соберите список тайтлов — он сохранится в этом браузере и появится во вкладке «Мои».
        </p>
        <div className="col-cg">
          <div>
            <label className="col-fld">
              Название
              <input
                value={title}
                maxLength={60}
                required
                placeholder="Например: Уютные вечера"
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label className="col-fld">
              Описание
              <textarea
                value={desc}
                rows={2}
                maxLength={200}
                placeholder="Коротко о чём подборка"
                onChange={(e) => setDesc(e.target.value)}
              />
            </label>
            <label className="col-fld">
              Теги (через запятую)
              <input
                value={tagsText}
                placeholder="Комедия, Slice of Life"
                onChange={(e) => setTagsText(e.target.value)}
              />
            </label>
            <div className="col-row" style={{ marginTop: 10 }}>
              {COLLECTION_TAGS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="col-chip"
                  onClick={() => {
                    const list = tagsText
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean);
                    if (!list.includes(t)) list.push(t);
                    setTagsText(list.join(", "));
                  }}
                >
                  + {t}
                </button>
              ))}
            </div>
            <div className="col-fld">
              Тайтлы (найдите и добавьте, минимум 2)
              <div className="col-find">
                {SEARCH_ICON}
                <input
                  value={query}
                  placeholder="Например: Ван-Пис"
                  aria-label="Поиск тайтла"
                  autoComplete="off"
                  onChange={(e) => onQueryChange(e.target.value)}
                  onKeyDown={onSearchKey}
                />
                {searching && <span aria-hidden>…</span>}
              </div>
              {found.length > 0 && (
                <ul className="col-found">
                  {found.map((card, i) => (
                    <li key={card.id}>
                      <button
                        type="button"
                        className={`col-foundrow${i === highlight ? " col-on" : ""}`}
                        onMouseEnter={() => setHighlight(i)}
                        onClick={() => add(card)}
                      >
                        <i style={card.poster ? { backgroundImage: `url(${card.poster})` } : undefined} />
                        <b>{card.title}</b>
                        <small>{card.manga ? "Манга" : ""}{card.year ?? ""}{card.rating ? ` ★ ${card.rating.toFixed(2)}` : ""}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {picked.length > 0 && (
              <ul className="col-picked">
                {picked.map((p, i) => (
                  <li key={p.title}>
                    <em>{i + 1}</em>
                    <span>{p.title}</span>
                    <button
                      type="button"
                      aria-label={`Убрать ${p.title}`}
                      onClick={() => setPicked((prev) => prev.filter((_, k) => k !== i))}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {picked.length === 0 ? (
              <p className="col-foundnote">Список пуст — найдите тайтлы в строке выше.</p>
            ) : picked.length < 2 ? (
              <p className="col-foundnote" style={{ color: "var(--pink)" }}>
                Добавьте ещё {2 - picked.length}
              </p>
            ) : (
              <p className="col-foundnote">Тайтлов в подборке: {picked.length}</p>
            )}
            <div className="col-row" style={{ marginTop: 22 }}>
              <button type="submit" className="col-btn col-pri" disabled={picked.length < 2}>
                Опубликовать
              </button>
              <button type="button" className="col-btn col-gh" onClick={close}>
                Отмена
              </button>
            </div>
          </div>
          <div className="col-pv">
            <div className="col-fld" style={{ marginTop: 16 }}>
              Предпросмотр
            </div>
            <PreviewCard collection={preview} progress={0} liked={false} onOpen={() => {}} posters={posters} />
          </div>
        </div>
      </form>
    </div>
  );
}

/* --------------------------- Карточка-превью ----------------------------- */

function PreviewCard({
  collection,
  progress,
  liked,
  onOpen,
  posters,
}: {
  collection: Collection;
  progress: number;
  liked: boolean;
  onOpen: () => void;
  posters?: Record<string, string>;
}) {
  return (
    <article className="col-card" style={{ animation: "none" }} onClick={onOpen}>
      <div className="col-mosaic">
        {mosaicItems(collection).map((i, k) => tile(collection.items[i], k, posters))}
        <div className="col-meta">
          <span className="col-pill"><CIcon n="stack" /> {collection.items.length}</span>
          <span className={`col-pill col-lk${liked ? " col-on" : ""}`}><CIcon n="heart" /> {collection.likes + (liked ? 1 : 0)}</span>
          <span className="col-pill col-r"><CIcon n="eye" /> {formatCount(collection.views)}</span>
        </div>
      </div>
      <div className="col-body">
        <h3>{collection.title}</h3>
        <p>{collection.desc}</p>
        <div className="col-tags">
          {collection.tags.slice(0, 3).map((t) => (
            <span className="col-tag" key={t}>
              {t}
            </span>
          ))}
        </div>
        {progress > 0 && (
          <div className={`col-prg${progress >= 1 ? " col-done" : ""}`}>
            <i style={{ width: `${progress * 100}%` }} />
          </div>
        )}
        <div className="col-auth">
          <span className="col-ava">{collection.author[0]?.toUpperCase()}</span>
          <span>{collection.author}</span>
          <span className="col-when">{ago(collection.age)}</span>
        </div>
      </div>
    </article>
  );
}
