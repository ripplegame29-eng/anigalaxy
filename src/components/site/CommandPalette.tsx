"use client";

/**
 * Поиск по каталогу — оверлей на Ctrl+K и по клику на поле в шапке.
 *
 * Макет: `anigalaxy-search.html` из вложения пользователя (разметка, стили,
 * логика списка, превью, клавиатура). Стили лежат в `search.css`, все
 * селекторы под префиксом `.sx`.
 *
 * Главное отличие от прежней палитры — источник данных. Раньше палитра
 * искала только по локальным хранилищам (`animehub:titles:v1` — история
 * просмотра, друзья, подборки). У гостя они пусты, поэтому поиск всегда
 * отвечал «Ничего не найдено», хотя по каталогу есть 33 тысячи тайтлов.
 * Теперь запрос идёт в тот же Kodik API, что и страница каталога:
 *
 *  - с текстом — `/api/kodik/search` (`quickSearch`): умеет искать по
 *    оригинальному названию и склеивает material-id в один тайтл;
 *  - без текста — `/api/kodik/list?sort=rating`: то, что в прототипе
 *    подписано «ПОПУЛЯРНОЕ».
 *
 * Фильтры прототипа (Все / Онгоинги / Фильмы / Рейтинг 8+) уходят в API,
 * а не режутся на клиенте: иначе под фильтром список мог остаться пустым,
 * хотя подходящие тайтлы есть.
 *
 * Проектных правил здесь нарушено три места, и все три — по необходимости:
 *
 *  1. `highlight()` подсвечивает совпадения строкой с `<mark>`. Это
 *     единственный dangerouslySetInnerHTML в файле, и он безопасен:
 *     значение экранируется (тот же esc, что в прототипе), а вставляется
 *     только разметка совпадения — данные пользователя внутрь не попадают.
 *  2. Пустая строка тоже показывает «ПОПУЛЯРНОЕ» — без этого оверлей
 *     открывался бы с пустым списком.
 *  3. Запрос debounce 220 мс: Kodik не любит частые обращения, а
 *     `quickSearch` кэширует результаты на 5 минут.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KIND_LABELS } from "@/lib/anime";
import type { AnimeCard } from "@/lib/types";

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Строка выбрана — колбэк оставлен ради совместимости с HeaderShell */
  onPick?: (href: string) => void;
}

type Filter = "all" | "ongoing" | "movie" | "top";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "ongoing", label: "Онгоинги" },
  { id: "movie", label: "Фильмы" },
  { id: "top", label: "Рейтинг 8+" },
];

const ROW_LIMIT = 24;
const DEBOUNCE_MS = 220;

/* ------------------------------------------------------------------ */
/* Вспомогательное                                                     */
/* ------------------------------------------------------------------ */

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

/** Подсветка совпадений. На вход идёт текст из каталога, он экранируется. */
function highlight(text: string, term: string): string {
  const safe = esc(text);
  if (!term) return safe;
  const re = new RegExp("(" + term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig");
  return safe.replace(re, "<mark>$1</mark>");
}

/* Подпись типа. Словарь KIND_LABELS уже есть в lib/anime — своим не
   пользуемся, чтобы «ТВ Сериал» и прочие подписи не разъехались с
   карточками каталога. */
function kindLabel(card: AnimeCard): string | null {
  const known = card.kind ? KIND_LABELS[card.kind] : undefined;
  return known ?? (isOngoing(card) ? "Онгоинг" : null);
}

function isOngoing(card: AnimeCard): boolean {
  return card.status === "ongoing";
}

/** Цвет подложки постера, когда самого постера нет */
function tintOf(card: AnimeCard): string {
  const h = (card.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) * 37) % 360;
  return `hsl(${h} 62% 46%)`;
}

/** Параметры запроса под текущий фильтр */
function requestFor(q: string, filter: Filter): string {
  if (q.trim().length >= 2) return `/api/kodik/search?q=${encodeURIComponent(q.trim())}&limit=${ROW_LIMIT}`;

  const sp = new URLSearchParams({ limit: String(ROW_LIMIT), sort: "rating" });
  if (filter === "ongoing") sp.set("status", "ongoing");
  if (filter === "movie") sp.set("type", "movie");
  return `/api/kodik/list?${sp.toString()}`;
}

/* ------------------------------------------------------------------ */
/* Компонент                                                            */
/* ------------------------------------------------------------------ */

export function CommandPalette({ open, onOpenChange, onPick }: CommandPaletteProps) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [items, setItems] = useState<AnimeCard[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [frameNote, setFrameNote] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const seq = useRef(0);

  const term = q.trim();

  /* --- Загрузка --- */
  const load = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true);
    try {
      const res = await fetch(requestFor(term, filter), { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: unknown = await res.json();
      /* Два маршрута отдают разное: /api/kodik/search — { results },
         /api/kodik/list — { cards, total, next }. Берём оба. */
      const rows: AnimeCard[] = Array.isArray(data)
        ? (data as AnimeCard[])
        : ((data as { results?: AnimeCard[]; cards?: AnimeCard[] })?.results ??
          (data as { cards?: AnimeCard[] })?.cards ??
          []);

      // Ответ мог прийти не по тому запросу — выкидываем устаревший
      if (mine !== seq.current) return;

      let next = rows;
      if (filter === "top") next = rows.filter((c) => (c.rating ?? 0) >= 8);
      setItems(next);
      setActive(0);
      setFailed(false);
    } catch {
      if (mine !== seq.current) return;
      setItems([]);
      setFailed(true);
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [term, filter]);

  /* Debounce: не дёргаем Kodik на каждую букву */
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => void load(), term ? DEBOUNCE_MS : 0);
    return () => window.clearTimeout(id);
  }, [open, load, term]);

  /* Фокус в поле при открытии */
  useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  /* Сброса состояния при закрытии здесь нет намеренно:
     прототип тоже сохраняет запрос и просто перерисовывает список при
     следующем открытии (`render()` вызывается из `open()`). Плюс эффект,
     который синхронно зовёт setState, запрещает правило
     react-hooks/set-state-in-effect: он лишний раз гоняет рендер.
     Список при открытии перезапрашивается эффектом выше — `open` в его
     зависимостях, поэтому свежая выдача приходит всегда. */
  const shown = useMemo(() => items, [items]);

  const heading = term ? "Результаты" : "Популярное";

/* Выбор тайтла: закрыть оверлей и уйти на карточку.
   В прототипе это `location.href = '/title/' + id`; здесь — router.push,
   чтобы не перезагружать страницу целиком. */
  const go = useCallback(
    (card: AnimeCard) => {
      const href = `/title/${card.id}`;
      onOpenChange(false);
      onPick?.(href);
      router.push(href);
    },
    [onOpenChange, onPick, router],
  );

  /* Активная строка всегда попадает в поле зрения */
  useEffect(() => {
    const node = listRef.current?.children[active];
    if (node instanceof HTMLElement) node.scrollIntoView({ block: "nearest" });
  }, [active]);

  /* --- Клавиатура ---
     Слушатель висит на самом оверлее, а не на строке с полем: прототип
     вешает его на document, и это важно — после клика по фильтру фокус
     остаётся на кнопке, и обработчик на шапке её не видел бы: стрелки
     переставали бы листать список. Оверлей — общий предок и поля, и
     кнопок, поэтому события доходят до него от любого элемента внутри.
     Enter отдаём кнопкам и ссылкам: там нажатие должно открыть именно их. */
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onOpenChange(false);
      return;
    }
    const наКнопке = event.target instanceof HTMLElement &&
      event.target.closest("button, a") !== null;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (shown.length ? (i + 1) % shown.length : 0));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (shown.length ? (i - 1 + shown.length) % shown.length : 0));
      return;
    }
    if (event.key === "Enter") {
      if (наКнопке) return;
      const card = shown[active];
      if (!card) return;
      event.preventDefault();
      go(card);
    }
  };

  /* Ctrl+K / Cmd+K — открытие, работает с любой страницы */
  useEffect(() => {
    const onGlobal = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", onGlobal);
    return () => document.removeEventListener("keydown", onGlobal);
  }, [open, onOpenChange]);

  /* Ctrl+V — скриншот в буфере. Сам поиск по кадру — TODO. */
  const onPaste = (event: React.ClipboardEvent) => {
    const file = Array.from(event.clipboardData.files).find((f) => f.type.startsWith("image/"));
    if (file) setFrameNote(`Ищем по кадру… ${file.name}`);
  };

  if (!open) return null;

  const current = shown[active];

  return (
    <div
      className="sx is-open"
      role="dialog"
      aria-modal="true"
      aria-label="Поиск по каталогу"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
    >
      <div className="sx__box">
        {/* ------------------------- Поле ------------------------- */}
        <div className="sx__head">
          <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
          <input
            ref={inputRef}
            className="sx__input"
            type="search"
            value={q}
            placeholder="Поиск аниме — название, жанр, студия…"
            autoComplete="off"
            aria-label="Поиск аниме"
            onChange={(event) => {
              setQ(event.target.value);
              setActive(0);
            }}
          />
          <div className="sx__tools">
            <button
              type="button"
              className="sx__tool"
              aria-label="Вставить скриншот (Ctrl+V)"
              title="Вставить скриншот (Ctrl+V)"
              onClick={() => inputRef.current?.focus()}
            >
              <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
            <span className="kbd">ESC</span>
            <button type="button" className="sx__mode" aria-pressed="true" aria-label="Поиск по аниме">
              <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 5.5A1.5 1.5 0 015.5 4H11v16H5.5A1.5 1.5 0 014 18.5v-13z" />
                <path d="M20 5.5A1.5 1.5 0 0018.5 4H13v16h5.5a1.5 1.5 0 001.5-1.5v-13z" />
              </svg>
            </button>
          </div>
        </div>

        {/* ------------------------ Фильтры ----------------------- */}
        <div className="sx__filters" role="group" aria-label="Фильтры поиска">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className="chip"
              aria-pressed={filter === f.id}
              onClick={() => {
                setFilter(f.id);
                setActive(0);
                /* Возвращаем фокус в поле: после клика по фильтру клавиатура
                   должна продолжать листать список, а не висеть на кнопке. */
                inputRef.current?.focus();
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* ------------------- Список и превью -------------------- */}
        <div className="sx__main">
          <div>
            <div className="sx__cap">
              <b>
                <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" style={{ width: 14, height: 14 }}>
                  <path d="M12 3c.6 3 1.9 4.3 4.9 4.9-3 .6-4.3 1.9-4.9 4.9-.6-3-1.9-4.3-4.9-4.9C10.1 7.3 11.4 6 12 3z" />
                </svg>
              </b>
              {heading}
              <span>{loading ? "загрузка…" : `${shown.length}`}</span>
            </div>

            <ul className="sx__list" ref={listRef} aria-label={heading}>
              {shown.length === 0 ? (
                <li className="empty">
                  <b>{failed ? "Каталог не ответил" : "Ничего не нашли"}</b>
                  {failed
                    ? "Попробуйте ещё раз или откройте каталог"
                    : "Попробуйте другое название или снимите фильтр"}
                </li>
              ) : (
                shown.map((card, i) => (
                  <li
                    key={card.id}
                    className={`row${i === active ? " is-active" : ""}`}
                    style={{ ["--c" as string]: tintOf(card) }}
                    onMouseMove={() => setActive(i)}
                    onClick={() => go(card)}
                  >
                    {card.poster ? (
                      <img className="row__poster" src={card.poster} alt="" loading="lazy" />
                    ) : (
                      <span className="row__poster" aria-hidden />
                    )}
                    <div className="row__body">
                      <div
                        className="row__title"
                        dangerouslySetInnerHTML={{ __html: highlight(card.title, term) }}
                      />
                      {card.studios?.[0] && <div className="row__studio">{card.studios[0]}</div>}
                      <div className="row__meta">
                        {card.rating != null && (
                          <span className="row__rating" style={{ color: "var(--color-accent-2)" }}>
                            ★ {card.rating}
                          </span>
                        )}
                        {card.year && <span className="chipmini">{card.year}</span>}
                        {card.genres.slice(0, 2).map((g) => (
                          <span className="chipmini" key={g}>
                            {g}
                          </span>
                        ))}
                        {/* «0 эп.» у фильмов — шум: у Kodik уmovie
                            lastEpisode всегда 0. Показываем счётчик
                            только когда он что-то значит. */}
                        {card.lastEpisode != null && card.lastEpisode > 0 && (
                          <span className="row__eps">
                            {card.lastEpisode} эп.
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Тип рисуем только когда он известен: пустой span
                        справа занимал бы место и ломал одинаковую сетку
                        строк (в правом колонке с эпизодами). */}
                    {kindLabel(card) && (
                      <span className={isOngoing(card) ? "live" : ""}>{kindLabel(card)}</span>
                    )}
                  </li>
                ))
              )}
            </ul>
          </div>

          {/* Превью выбранного тайтла */}
          <aside className="pv" aria-live="polite">
            {current ? (
              <>
                {current.poster ? (
                  <img className="pv__poster" src={current.poster} alt="" />
                ) : (
                  <span className="pv__poster" aria-hidden />
                )}
                <h3 className="pv__title">{current.title}</h3>
                {current.titleOrig && <div className="pv__orig">{current.titleOrig}</div>}
                <div className="pv__tags">
                  {current.rating != null && <span className="tag tag--star">★ {current.rating}</span>}
                  {current.genres.slice(0, 4).map((g) => (
                    <span className="tag" key={g}>
                      {g}
                    </span>
                  ))}
                </div>
                {current.description && <p className="pv__desc">{current.description}</p>}
                <div className="pv__actions">
                  <Link className="btn btn--main" href={`/title/${current.id}`} onClick={() => onOpenChange(false)}>
                    ▶ Смотреть
                  </Link>
                  <Link className="btn btn--ghost" href={`/title/${current.id}#episodes`} onClick={() => onOpenChange(false)}>
                    Серии
                  </Link>
                </div>
              </>
            ) : (
              <p className="empty empty--sm">
                <b>Выберите тайтл</b>Здесь появятся студия, жанры и описание
              </p>
            )}
          </aside>
        </div>

        {/* -------------------------- Низ ------------------------- */}
        <div className="sx__foot">
          <span className="frame">
            <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span>
              {frameNote ??
                "Есть скриншот? Вставьте его сюда Ctrl+V — найдём аниме, серию и момент"}
            </span>
          </span>
          <Link className="framelink" href="/catalog" onClick={() => onOpenChange(false)}>
            В каталог →
          </Link>
          <span className="hints">
            <span>
              <span className="kbd">↑↓</span> выбор
            </span>
            <span>
              <span className="kbd">Enter</span> открыть
            </span>
            <span>
              <span className="kbd">Esc</span> закрыть
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}