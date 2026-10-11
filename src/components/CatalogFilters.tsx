"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  hasActiveFilters,
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

/** Чип-кнопка выбора значения в группе фильтров */
function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`btn-ghost rounded-lg px-3 py-1.5 text-[13px] font-semibold ring-1 transition-all ${
        active
          ? "bg-accent/20 text-white ring-accent/50 shadow-[0_6px_18px_-10px_rgba(31,123,255,.9)]"
          : "bg-white/5 text-muted ring-white/10 hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

/** Стилизованный нативный select */
function Select({
  value,
  onChange,
  label,
  options,
  minWidth = "min-w-[130px]",
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: { value: string; label: string }[];
  minWidth?: string;
}) {
  return (
    <label className={`relative block ${minWidth}`}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className={`h-9 w-full cursor-pointer appearance-none rounded-lg bg-white/5 py-1.5 pl-3 pr-8 text-[13px] font-semibold text-white/85 ring-1 ring-white/10 outline-none transition hover:bg-white/10 focus:ring-accent/50 ${minWidth}`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[#12121c] text-white">
            {o.label}
          </option>
        ))}
      </select>
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
      >
        <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
  );
}

/**
 * Панель фильтров каталога. Любое изменение сразу обновляет URL —
 * страница перерисовывается на сервере, ссылки остаются шаримыми.
 */
export function CatalogFilters({ value, meta }: { value: CatalogState; meta: CatalogMeta }) {
  const router = useRouter();
  const [search, setSearch] = useState(value.q ?? "");
  const firstRender = useRef(true);

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

    const timer = setTimeout(() => {
      router.push(`/catalog${toSearch({ ...value, q: trimmed || undefined })}`);
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const update = (patch: Partial<CatalogState>) => {
    router.push(`/catalog${toSearch({ ...value, ...patch })}`);
  };

  const currentYear = new Date().getFullYear();

  return (
    <div className="rounded-2xl border border-line bg-surface/70 p-4 backdrop-blur-sm sm:p-5">
      {/* Поиск */}
      <div className="relative mb-4">
        <svg
          viewBox="0 0 24 24"
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.2-3.2" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Введите название аниме…"
          aria-label="Поиск по каталогу"
          className="h-11 w-full rounded-xl bg-white/6 pl-10 pr-4 text-sm text-white ring-1 ring-white/10 outline-none transition placeholder:text-muted/80 focus:bg-white/10 focus:ring-accent/50"
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-4">
        {/* Тип контента */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[11px] font-bold uppercase tracking-wider text-muted">Тип</span>
          {TYPE_OPTIONS.map((o) => (
            <Chip key={o.value} active={(value.type ?? "all") === o.value} onClick={() => update({ type: o.value })}>
              {o.label}
            </Chip>
          ))}
        </div>

        {/* Статус */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[11px] font-bold uppercase tracking-wider text-muted">Статус</span>
          {STATUS_OPTIONS.map((o) => (
            <Chip key={o.value} active={(value.status ?? "") === o.value} onClick={() => update({ status: o.value || undefined })}>
              {o.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <Select
          label="Жанр"
          value={value.genre ?? ""}
          onChange={(v) => update({ genre: v || undefined })}
          minWidth="min-w-[160px]"
          options={[{ value: "", label: "Все жанры" }, ...meta.genres.map((g) => ({ value: g.title, label: g.title }))]}
        />

        <Select
          label="Формат"
          value={value.kind ?? ""}
          onChange={(v) => update({ kind: v || undefined })}
          options={KIND_OPTIONS.map((o) => ({ ...o }))}
        />

        <Select
          label="Год от"
          value={value.yearFrom ? String(value.yearFrom) : ""}
          onChange={(v) => update({ yearFrom: v ? Number(v) : undefined })}
          minWidth="min-w-[112px]"
          options={[
            { value: "", label: "Год от" },
            ...meta.years
              .slice()
              .reverse()
              .map((y) => ({ value: String(y), label: String(y) })),
          ]}
        />

        <Select
          label="Год до"
          value={value.yearTo ? String(value.yearTo) : ""}
          onChange={(v) => update({ yearTo: v ? Number(v) : undefined })}
          minWidth="min-w-[112px]"
          options={[
            { value: "", label: "Год до" },
            ...Array.from({ length: 12 }, (_, i) => currentYear + 1 - i).map((y) => ({
              value: String(y),
              label: String(y),
            })),
          ]}
        />

        <Select
          label="Сортировка"
          value={value.sort}
          onChange={(v) => update({ sort: v })}
          minWidth="min-w-[190px]"
          options={SORT_OPTIONS.map((o) => ({ ...o }))}
        />

        {hasActiveFilters(value) && (
          <button
            type="button"
            onClick={() => router.push("/catalog")}
            className="btn-ghost ml-auto inline-flex items-center gap-1.5 rounded-lg bg-accent-2/12 px-3 py-2 text-[13px] font-semibold text-accent-2 ring-1 ring-accent-2/30 hover:bg-accent-2/20"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
            Сбросить
          </button>
        )}
      </div>
    </div>
  );
}
