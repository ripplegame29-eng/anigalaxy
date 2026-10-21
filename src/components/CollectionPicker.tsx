"use client";

/**
 * CollectionPicker — окно «В подборки» для страницы тайтла.
 *
 * Разметка, стили и поведение взяты из макета
 * `Страница тайтла — окно «В подборки».html` один в один (классы `cp-*`,
 * анимации, горячие клавиши, «отменить» в тосте, разлёт частиц). Отличается
 * только источник данных: макет читал демо-массив и писал в `localStorage`
 * по ключу `ag_mine`, а окно работает с настоящим хранилищем подборок
 * (`lib/collections`) и берёт постеры из кэша тайтлов (`lib/titles`) —
 * вместо градиентных заглушек в мозаике показывается то, что уже видел
 * пользователь.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./collection-picker.css";
import {
  COLLECTIONS_KEY,
  createCollection,
  sanitizeName,
  toggleInCollection,
  type Collection,
} from "@/lib/collections";
import { parseList, useLocalSnapshot } from "@/lib/use-local-storage";
import { titleMeta } from "@/lib/titles";

const CK = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" pathLength="1" />
  </svg>
);

const X = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

const SEARCH = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-4-4" />
  </svg>
);

/** Оттенок строки плитки — тот же подсчёт, что в макете */
function hue(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) % 360;
  return h;
}

/** Русские числительные: pl(2, ['подборке','подборках','подборках']) → «подборках» */
function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  const index = mod10 === 1 && mod100 !== 11 ? 0 : mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20) ? 1 : 2;
  return forms[index];
}

interface Particle {
  id: number;
  left: number;
  top: number;
  dx: string;
  dy: string;
  color: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  anime: { id: string; title: string; poster?: string };
  /** Автор новых подборок — подпись в хранилище */
  author?: string;
  onToggle?: (collection: Collection, added: boolean) => void;
  onCreate?: (collection: Collection) => void;
  /** Вызывается при закрытии: в info — сколько подборок содержит тайтл */
  onClosed?: (info: { count: number; collections: Collection[] }) => void;
}

export function CollectionPicker({ open, onClose, anime, onToggle, onCreate, onClosed }: Props) {
  const collectionsRaw = useLocalSnapshot(COLLECTIONS_KEY);
  const collections = useMemo(
    () => parseList<Collection>(collectionsRaw, []),
    [collectionsRaw],
  );

  const [shown, setShown] = useState(false);
  const [query, setQuery] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [pub, setPub] = useState(true);
  const [toast, setToast] = useState<{ text: string; undo: (() => void) | null } | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  /** Ряд, который только что переключили — для анимации «pop» */
  const [popped, setPopped] = useState<string | null>(null);
  /** Счётчик для перезапуска анимации `cp-bump` у суммы внизу */
  const [bump, setBump] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const toastTimer = useRef(0);
  const particleId = useRef(0);

  const q = query.trim().toLowerCase();
  const filtered = collections.filter(
    (item) => !q || item.name.toLowerCase().includes(q),
  );
  const total = collections.filter((item) => item.animeIds.includes(anime.id)).length;

  /* ------------------------------- Показ/прятка ------------------------------ */

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setShown(true);
        const id = window.setTimeout(
          () => searchRef.current?.focus({ preventScroll: true }),
          380,
        );
        return () => window.clearTimeout(id);
      }),
    );
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(frame);
      document.documentElement.style.overflow = previousOverflow;
    };
  }, [open]);

  /** Закрытие: сначала гасим окно, потом размонтируем — как в макете */
  const close = useCallback(() => {
    setShown(false);
    window.clearTimeout(toastTimer.current);
    window.setTimeout(() => {
      onClose();
      onClosed?.({ count: total, collections });
    }, 320);
  }, [onClose, onClosed, total, collections]);

  /* --------------------------------- Тост ---------------------------------- */

  const say = useCallback((text: string, undo: (() => void) | null) => {
    setToast({ text, undo });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4200);
  }, []);

  /* ------------------------------- Разлёт точек ------------------------------ */

  const burst = useCallback((el: Element | null) => {
    if (!el) return;
    const r = el.getBoundingClientRect();
    const colors = ["#38e1ff", "#4dffb0", "#8b5cff", "#61d1ff", "#2aa7ff"];
    const created: Particle[] = [];
    for (let i = 0; i < 10; i += 1) {
      particleId.current += 1;
      const angle = (Math.PI * 2 * i) / 10 + Math.random() * 0.5;
      const distance = 24 + Math.random() * 26;
      created.push({
        id: particleId.current,
        left: r.left + r.width / 2 - 3,
        top: r.top + r.height / 2 - 3,
        dx: `${Math.cos(angle) * distance}px`,
        dy: `${Math.sin(angle) * distance}px`,
        color: colors[i % colors.length],
      });
    }
    setParticles((prev) => [...prev, ...created]);
    window.setTimeout(() => {
      const ids = new Set(created.map((p) => p.id));
      setParticles((prev) => prev.filter((p) => !ids.has(p.id)));
    }, 750);
  }, []);

  /* ------------------------------ Включение тайла ---------------------------- */

  const toggle = useCallback(
    (collection: Collection, added: boolean, silent = false) => {
      toggleInCollection(collection.id, anime.id);
      onToggle?.(collection, added);
      setBump((value) => value + 1);
      setPopped(collection.id);
      window.setTimeout(() => setPopped(null), 520);
      if (!silent) {
        say(
          added ? `Добавлено в «${collection.name}»` : `Убрано из «${collection.name}»`,
          () => {
            toggleInCollection(collection.id, anime.id);
            onToggle?.(collection, !added);
            setToast(null);
          },
        );
      }
    },
    [anime.id, onToggle, say],
  );

  const toggleFromEvent = useCallback(
    (collection: Collection, check: Element | null) => {
      const added = !collection.animeIds.includes(anime.id);
      toggle(collection, added);
      if (added) burst(check);
    },
    [anime.id, toggle, burst],
  );

  /* -------------------------------- Создание -------------------------------- */

  const create = useCallback(() => {
    const name = sanitizeName(draft);
    if (!name) return;
    const next = createCollection(draft, anime.id, { pub });
    const created = next[0];
    setDraft("");
    setQuery("");
    setNewOpen(false);
    setFlash(created?.id ?? null);
    setBump((value) => value + 1);
    onCreate?.(created);
    if (listRef.current) listRef.current.scrollTop = 0;
    window.setTimeout(() => {
      const check = listRef.current?.querySelector(".cp-row .cp-ck");
      if (check) burst(check);
      setFlash(null);
    }, 250);
    say(`Подборка «${name}» создана`, null);
  }, [anime.id, burst, draft, onCreate, pub, say]);

  const setNew = useCallback((value: boolean) => {
    setNewOpen(value);
    if (value) window.setTimeout(() => nameRef.current?.focus(), 220);
  }, []);

  /* ------------------------------ Горячие клавиши --------------------------- */

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (newOpen && document.activeElement === nameRef.current) {
          setNew(false);
          searchRef.current?.focus();
        } else {
          close();
        }
        return;
      }

      if (event.key === "Tab") {
        const focusable = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not([disabled]),input,.cp-row',
          ),
        ).filter((node) => node.offsetParent !== null);
        if (!focusable.length) return;
        const index = focusable.indexOf(document.activeElement as HTMLElement);
        if (event.shiftKey && index <= 0) {
          event.preventDefault();
          focusable[focusable.length - 1].focus();
        } else if (!event.shiftKey && index === focusable.length - 1) {
          event.preventDefault();
          focusable[0].focus();
        }
        return;
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        const rows = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(".cp-row"),
        );
        if (!rows.length) return;
        const index = rows.indexOf(document.activeElement as HTMLElement);
        if (index < 0 && document.activeElement !== searchRef.current) return;
        event.preventDefault();
        const next = index + (event.key === "ArrowDown" ? 1 : -1);
        if (next < 0) {
          searchRef.current?.focus();
          return;
        }
        const target = rows[Math.min(next, rows.length - 1)];
        target?.focus();
        target?.scrollIntoView({ block: "nearest" });
      }
    },
    [close, newOpen, setNew],
  );

  if (!open || typeof document === "undefined") return null;

  /* --------------------------------- Мозаика -------------------------------- */

  const mosaic = (collection: Collection) =>
    Array.from({ length: 4 }, (_, i) => {
      const id = collection.animeIds[i];
      if (!id) return <i key={i} className="cp-em" />;
      const poster = titleMeta(id)?.poster;
      const h = (hue(id) + i * 8) % 360;
      return (
        <i
          key={i}
          style={
            poster
              ? { backgroundImage: `url(${poster})`, backgroundSize: "cover", backgroundPosition: "center" }
              : { background: `linear-gradient(150deg,hsl(${h} 75% 52%),hsl(${(h + 55) % 360} 70% 18%))` }
          }
        />
      );
    });

  const rootHue = hue(anime.title || "?");

  return createPortal(
    <div className="cp-root">
      <div
        className={`cp-scrim${shown ? " cp-on" : ""}`}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div
          className="cp-dlg"
          role="dialog"
          aria-modal="true"
          aria-label="Добавить в подборки"
          style={{ "--cp-h": rootHue } as React.CSSProperties}
          onKeyDown={onKeyDown}
        >
          {/* ------------------------------ Шапка ----------------------------- */}
          <div className="cp-hd">
            <span
              className="cp-poster"
              style={anime.poster ? { backgroundImage: `url(${anime.poster})` } : undefined}
            >
              {anime.poster
                ? ""
                : (anime.title || "?").charAt(0).toUpperCase()}
            </span>
            <div className="cp-tt">
              <small>В ПОДБОРКИ</small>
              <h2>Добавить в подборки</h2>
              <p title={anime.title}>{anime.title}</p>
            </div>
            <button type="button" className="cp-x" aria-label="Закрыть" onClick={close}>
              {X}
            </button>
          </div>

          {/* ------------------------------ Поиск ----------------------------- */}
          <div className="cp-sr">
            <input
              ref={searchRef}
              type="text"
              placeholder="Найти подборку"
              aria-label="Поиск подборки"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {SEARCH}
          </div>

          {/* --------------------------- Создание ----------------------------- */}
          <div className={`cp-nw${newOpen ? " cp-open" : ""}`}>
            <button
              type="button"
              className="cp-nb"
              aria-expanded={newOpen}
              onClick={() => setNew(!newOpen)}
            >
              <i>+</i>Создать новую подборку
            </button>
            <div className="cp-nf">
              <div>
                <input
                  ref={nameRef}
                  type="text"
                  maxLength={40}
                  placeholder="Название подборки"
                  aria-label="Название новой подборки"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    create();
                  }}
                />
                <div className="cp-nr">
                  <div className="cp-sg">
                    <button
                      type="button"
                      data-pub="1"
                      aria-pressed={pub}
                      onClick={() => setPub(true)}
                    >
                      Публичная
                    </button>
                    <button
                      type="button"
                      data-pub="0"
                      aria-pressed={!pub}
                      onClick={() => setPub(false)}
                    >
                      Приватная
                    </button>
                  </div>
                  <button
                    type="button"
                    className="cp-go"
                    disabled={!draft.trim()}
                    onClick={create}
                  >
                    Создать
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ------------------------------ Список ---------------------------- */}
          <div
            className="cp-ls"
            ref={listRef}
            role="group"
            aria-label="Подборки"
            onMouseDown={(event) => {
              const target = event.target as HTMLElement;
              if (target.closest("[data-mk]")) {
                setNew(true);
                setDraft(searchRef.current?.value.trim() ?? "");
                return;
              }
              const row = target.closest<HTMLElement>(".cp-row");
              if (!row) return;
              const collection = collections.find(
                (item) => String(item.id) === row.dataset.id,
              );
              if (collection) toggleFromEvent(collection, row.querySelector(".cp-ck"));
            }}
          >
            {filtered.length === 0 ? (
              <div className="cp-empty">
                {q ? "Ничего не найдено" : "У вас пока нет подборок"}
                <br />
                <button type="button" data-mk>
                  {q ? `Создать «${query.trim()}»` : "Создать первую подборку"}
                </button>
              </div>
            ) : (
              filtered.map((collection, i) => {
                const on = collection.animeIds.includes(anime.id);
                const count = collection.animeIds.length;
                return (
                  <div
                    key={collection.id}
                    className={`cp-row${on ? " cp-on" : ""}${flash === collection.id ? " cp-new" : ""}`}
                    role="checkbox"
                    aria-checked={on}
                    tabIndex={0}
                    data-id={collection.id}
                    style={{ "--i": Math.min(i, 12) } as React.CSSProperties}
                    onKeyDown={(event) => {
                      if (event.key !== " " && event.key !== "Enter") return;
                      event.preventDefault();
                      const row = event.currentTarget;
                      toggleFromEvent(collection, row.querySelector(".cp-ck"));
                    }}
                  >
                    <span className="cp-mo">{mosaic(collection)}</span>
                    <span className="cp-in">
                      <b>{collection.name}</b>
                      <span>
                        {count} {plural(count, ["тайтл", "тайтла", "тайтлов"])} <u>·</u>{" "}
                        {collection.pub === false ? "Приватная" : "Публичная"}
                      </span>
                    </span>
                    <span className={`cp-ck${popped === collection.id ? " cp-pop" : ""}`}>
                      {CK}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* -------------------------------- Тост --------------------------- */}
          <div className={`cp-ts${toast ? " cp-show" : ""}`} role="status">
            <span>{toast?.text ?? ""}</span>
            <button
              type="button"
              style={{ display: toast?.undo ? undefined : "none" }}
              onClick={() => {
                const undo = toast?.undo;
                setToast(null);
                undo?.();
              }}
            >
              Отменить
            </button>
          </div>

          {/* ------------------------------- Подвал --------------------------- */}
          <div className="cp-ft">
            <div className="cp-sum">
              <b key={bump} className={bump ? "cp-bump" : undefined}>
                {total}
              </b>
              <span>
                {total
                  ? `Тайтл в ${total} ${plural(total, ["подборке", "подборках", "подборках"])}`
                  : "Пока ни в одной подборке"}
              </span>
            </div>
            <button type="button" className="cp-done" onClick={close}>
              Готово
            </button>
          </div>
        </div>
      </div>

      {/* Частицы рисуются портом в .cp-root — как в макете */}
      {particles.map((particle) => (
        <i
          key={particle.id}
          className="cp-pt"
          style={
            {
              left: particle.left,
              top: particle.top,
              "--dx": particle.dx,
              "--dy": particle.dy,
              "--c": particle.color,
            } as React.CSSProperties
          }
        />
      ))}
    </div>,
    document.body,
  );
}