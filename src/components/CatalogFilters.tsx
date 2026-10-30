"use client";

/**
 * Панель фильтров каталога в визуале `ag-catalog.html`.
 *
 * Поведение прежнее: любое изменение сразу обновляет URL, страница
 * перерисовывается на сервере, ссылки остаются шаримыми. Мультивыбор
 * жанров склеивается через запятую — Kodik принимает такой `all_genres`.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadFavorites } from "@/lib/collections";
import {
  KIND_OPTIONS,
  STATUS_OPTIONS,
  SORT_OPTIONS,
  toSearch,
  TYPE_OPTIONS,
  type CatalogState,
} from "@/lib/catalog-query";

export interface CatalogMeta {
  genres: { title: string; count: number }[];
  years: number[];
}

type Density = "big" | "norm" | "compact";

const DENSITY_KEY = "animehub:catalog-density";

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="cat-i" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="cat-i" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
    </svg>
  );
}

function CaretIcon() {
  return (
    <svg viewBox="0 0 24 24" className="cat-i cat-caret" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="cat-check" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

/** Закрытие поповеров по клику снаружи и Escape */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  return ref;
}

function Dropdown({
  label,
  value,
  options,
  onChange,
  className = "",
  set,
  caption,
}: {
  caption?: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  className?: string;
  set?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  const ref = useDismiss(open, () => setOpen(false));

  return (
    <div className={`cat-dd${open ? " open" : ""}${set ? " set" : ""} ${className}`} ref={ref}>
      {caption && <span className="cat-cap">{caption}</span>}
      <button
        type="button"
        className="cat-dt"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((next) => !next)}
      >
        <span className="truncate">{selected?.label ?? label}</span>
        <CaretIcon />
      </button>

      <ul className="cat-dm" role="listbox" aria-label={label}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <li
              key={`${label}-${option.value || "any"}`}
              role="option"
              aria-selected={active}
              tabIndex={0}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onChange(option.value);
                  setOpen(false);
                }
              }}
            >
              {option.label}
              <span className="cat-ck">
                <CheckIcon />
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function CatalogFilters({ value, meta }: { value: CatalogState; meta: CatalogMeta }) {
  const router = useRouter();
  const [search, setSearch] = useState(value.q ?? "");
  const [density, setDensity] = useState<Density>(() => {
    if (typeof window === "undefined") return "norm";
    try {
      const saved = window.localStorage.getItem(DENSITY_KEY);
      return saved === "big" || saved === "compact" ? saved : "norm";
    } catch {
      return "norm";
    }
  });
  const [favCount, setFavCount] = useState(0);
  const [genresOpen, setGenresOpen] = useState(false);
  /* На телефоне панель фильтров свёрнута, чтобы выдача была под рукой */
  const [panelOpen, setPanelOpen] = useState(false);
  const firstRender = useRef(true);
  const searchRef = useRef<HTMLInputElement>(null);
  const genresRef = useDismiss(genresOpen, () => setGenresOpen(false));

  // Синхронизируем поле с URL (например, при «назад» в браузере) — паттерн
  // «adjust state during render» вместо setState внутри эффекта
  const [prevQ, setPrevQ] = useState(value.q);
  if (value.q !== prevQ) {
    setPrevQ(value.q);
    setSearch(value.q ?? "");
  }

  // Дебаунс-поиск по мере ввода
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const trimmed = search.trim();
    if (trimmed === (value.q ?? "")) return;

    const timer = window.setTimeout(() => {
      router.push(`/catalog${toSearch({ ...value, q: trimmed || undefined })}`);
    }, 500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    const sync = () => setFavCount(loadFavorites().length);
    sync();
    window.addEventListener("animehub:favorites-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("animehub:favorites-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.catDensity = density;
  }, [density]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;
      if (event.key === "/" && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const update = (patch: Partial<CatalogState>) => {
    router.push(`/catalog${toSearch({ ...value, ...patch })}`);
  };

  const changeDensity = (next: Density) => {
    setDensity(next);
    document.documentElement.dataset.catDensity = next;
    try {
      window.localStorage.setItem(DENSITY_KEY, next);
    } catch {
      /* приватный режим — плотность просто не запомнится */
    }
  };

  const currentYear = new Date().getFullYear();
  const selectedGenres = (value.genre ?? "").split(",").filter(Boolean);
  const activeType = value.type ?? "all";
  const activeStatus = value.status ?? "";

  const activeChips: { key: string; label: string; clear: () => void }[] = [];
  if (value.q) {
    activeChips.push({
      key: "q",
      label: `Поиск: ${value.q}`,
      clear: () => {
        setSearch("");
        update({ q: undefined });
      },
    });
  }
  if (activeType !== "all") {
    const label = TYPE_OPTIONS.find((option) => option.value === activeType)?.label ?? activeType;
    activeChips.push({ key: "type", label, clear: () => update({ type: "all" }) });
  }
  if (value.status) {
    const label = STATUS_OPTIONS.find((option) => option.value === value.status)?.label ?? value.status;
    activeChips.push({ key: "status", label, clear: () => update({ status: undefined }) });
  }
  if (value.kind) {
    const label = KIND_OPTIONS.find((option) => option.value === value.kind)?.label ?? value.kind;
    activeChips.push({ key: "kind", label, clear: () => update({ kind: undefined }) });
  }
  selectedGenres.forEach((genre) => {
    activeChips.push({
      key: `genre-${genre}`,
      label: genre,
      clear: () => {
        const rest = selectedGenres.filter((item) => item !== genre);
        update({ genre: rest.length ? rest.join(",") : undefined });
      },
    });
  });
  if (value.yearFrom) {
    activeChips.push({ key: "yearFrom", label: `от ${value.yearFrom}`, clear: () => update({ yearFrom: undefined }) });
  }
  if (value.yearTo) {
    activeChips.push({ key: "yearTo", label: `до ${value.yearTo}`, clear: () => update({ yearTo: undefined }) });
  }
  if (value.sort && value.sort !== "rating") {
    const label = SORT_OPTIONS.find((option) => option.value === value.sort)?.label ?? value.sort;
    activeChips.push({ key: "sort", label, clear: () => update({ sort: "rating" }) });
  }

  /* Enter или «Поиск» на мобильной клавиатуре: форма отправляется сразу,
     не дожидаясь дебаунса. Иначе на iPhone нажатие клавиши ничего не делало. */
  const submitSearch = () => {
    const trimmed = search.trim();
    searchRef.current?.blur();
    if (trimmed === (value.q ?? "")) return;
    router.push(`/catalog${toSearch({ ...value, q: trimmed || undefined })}`);
  };

  return (
    <section className="cat-fp" aria-label="Фильтры каталога">
      <form
        className="cat-sb"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          submitSearch();
        }}
      >
        <SearchIcon />
        <input
          ref={searchRef}
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setSearch("");
            }
          }}
          placeholder="Введите название аниме…"
          aria-label="Поиск по каталогу"
          autoComplete="off"
          enterKeyHint="search"
        />
        {search && (
          <button
            type="button"
            className="cat-clr"
            aria-label="Очистить поиск"
            onClick={() => {
              setSearch("");
              searchRef.current?.focus();
            }}
          >
            <CloseIcon />
          </button>
        )}
        <span className="cat-kbd" aria-hidden>
          /
        </span>
      </form>

      <button
        type="button"
        className={`cat-ftoggle${panelOpen ? " on" : ""}`}
        aria-expanded={panelOpen}
        onClick={() => setPanelOpen((v) => !v)}
      >
        Фильтры
        <CaretIcon />
      </button>

      <div className={`cat-panel${panelOpen ? " open" : ""}`}>
      <div className="cat-row1">
        <div className="cat-grp">
          <span className="cat-lab">Тип</span>
          <div className="cat-pls">
            {TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={activeType === option.value ? "on" : undefined}
                aria-pressed={activeType === option.value}
                onClick={() => update({ type: option.value })}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="cat-grp">
          <span className="cat-lab">Статус</span>
          <div className="cat-pls">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value || "any"}
                type="button"
                className={activeStatus === option.value ? "on" : undefined}
                aria-pressed={activeStatus === option.value}
                onClick={() => update({ status: option.value || undefined })}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="cat-row2">
        {/* Жанры — мультивыбор */}
        <div className={`cat-dd cat-dd-genres${genresOpen ? " open" : ""}${selectedGenres.length ? " set" : ""}`} ref={genresRef}>
          <span className="cat-cap">Жанр</span>
          <button
            type="button"
            className="cat-dt"
            aria-haspopup="true"
            aria-expanded={genresOpen}
            onClick={() => setGenresOpen((next) => !next)}
          >
            <span className="truncate">
              {selectedGenres.length ? `Жанры: ${selectedGenres.length}` : "Все жанры"}
            </span>
            <CaretIcon />
          </button>

          <div className="cat-dm cat-gm" role="group" aria-label="Жанры">
            <div className="cat-gl">
              {meta.genres.map((genre) => {
                const active = selectedGenres.includes(genre.title);
                return (
                  <button
                    key={genre.title}
                    type="button"
                    className={`cat-gi${active ? " on" : ""}`}
                    aria-pressed={active}
                    onClick={() => {
                      const next = active
                        ? selectedGenres.filter((item) => item !== genre.title)
                        : [...selectedGenres, genre.title];
                      update({ genre: next.length ? next.join(",") : undefined });
                    }}
                  >
                    <span className="cat-cb">
                      <CheckIcon />
                    </span>
                    <span className="truncate">{genre.title}</span>
                  </button>
                );
              })}
            </div>
            {selectedGenres.length > 0 && (
              <div className="cat-gf">
                <button type="button" onClick={() => update({ genre: undefined })}>
                  Сбросить жанры
                </button>
              </div>
            )}
          </div>
        </div>

        <Dropdown
          caption="Тип"
          label="Формат"
          value={value.kind ?? ""}
          onChange={(next) => update({ kind: next || undefined })}
          options={KIND_OPTIONS.map((option) => ({ ...option }))}
        />

        <Dropdown
          caption="Год от"
          label="Год от"
          value={value.yearFrom ? String(value.yearFrom) : ""}
          onChange={(next) => update({ yearFrom: next ? Number(next) : undefined })}
          options={[
            { value: "", label: "Год от" },
            ...meta.years
              .slice()
              .reverse()
              .map((year) => ({ value: String(year), label: String(year) })),
          ]}
          set={Boolean(value.yearFrom)}
        />

        <Dropdown
          caption="Год до"
          label="Год до"
          value={value.yearTo ? String(value.yearTo) : ""}
          onChange={(next) => update({ yearTo: next ? Number(next) : undefined })}
          options={[
            { value: "", label: "Год до" },
            ...Array.from({ length: 16 }, (_, index) => currentYear + 1 - index).map((year) => ({
              value: String(year),
              label: String(year),
            })),
          ]}
          set={Boolean(value.yearTo)}
        />

        <Dropdown
          caption="Сортировка"
          label="Сортировка"
          value={value.sort}
          onChange={(next) => update({ sort: next })}
          options={SORT_OPTIONS.map((option) => ({ ...option }))}
          className="cat-dd-sort"
          set={value.sort !== "rating"}
        />

        <span className="cat-grow" />

        <a className="cat-fvb" href="/list" title="Перейти в мой список">
          <HeartIcon />
          Мой список
          {favCount > 0 && <b className="cat-nb">{favCount > 99 ? "99+" : favCount}</b>}
        </a>

        <div className="cat-dens" role="group" aria-label="Размер карточек">
          <button
            type="button"
            data-d="big"
            className={density === "big" ? "on" : undefined}
            aria-label="Крупные карточки"
            aria-pressed={density === "big"}
            onClick={() => changeDensity("big")}
          >
            <svg viewBox="0 0 24 24" className="cat-i" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <rect x="4" y="4" width="7" height="16" rx="2" />
              <rect x="13" y="4" width="7" height="16" rx="2" />
            </svg>
          </button>
          <button
            type="button"
            data-d="norm"
            className={density === "norm" ? "on" : undefined}
            aria-label="Средние карточки"
            aria-pressed={density === "norm"}
            onClick={() => changeDensity("norm")}
          >
            <svg viewBox="0 0 24 24" className="cat-i" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <rect x="3" y="4" width="5" height="16" rx="1.5" />
              <rect x="9.5" y="4" width="5" height="16" rx="1.5" />
              <rect x="16" y="4" width="5" height="16" rx="1.5" />
            </svg>
          </button>
          <button
            type="button"
            data-d="compact"
            className={density === "compact" ? "on" : undefined}
            aria-label="Компактные карточки"
            aria-pressed={density === "compact"}
            onClick={() => changeDensity("compact")}
          >
            <svg viewBox="0 0 24 24" className="cat-i" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <rect x="3" y="3" width="8" height="8" rx="1.5" />
              <rect x="13" y="3" width="8" height="8" rx="1.5" />
              <rect x="3" y="13" width="8" height="8" rx="1.5" />
              <rect x="13" y="13" width="8" height="8" rx="1.5" />
            </svg>
          </button>
        </div>
      </div>

      </div>

      {activeChips.length > 0 && (
        <div className="cat-act">
          {activeChips.map((chip) => (
            <span className="cat-af" key={chip.key}>
              {chip.label}
              <button type="button" aria-label={`Убрать фильтр ${chip.label}`} onClick={chip.clear}>
                <CloseIcon />
              </button>
            </span>
          ))}
          <button type="button" className="cat-rs" onClick={() => router.push("/catalog")}>
            Сбросить всё
          </button>
        </div>
      )}
    </section>
  );
}
