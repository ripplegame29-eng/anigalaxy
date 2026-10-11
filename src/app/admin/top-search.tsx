"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useToast } from "./toast";
import type { AdminSection } from "./sections";

/**
 * Поиск по разделам панели.
 *
 * Слепой переход по первой подсказке считали бы «работает», пока человек
 * ищет «журнал» и попадает в «Настройки». Поэтому подсказки видны: список
 * раскрывается по мере набора, стрелки двигают выбор, Enter открывает.
 *
 * «/» фокусирует поле — привычка из макета. Перехват не срабатывает, если
 * фокус уже в поле ввода или в textarea: иначе админ не смог бы набрать
 * косую черту в поле промокода.
 */

export function TopSearch({ sections }: { sections: AdminSection[] }) {
  const router = useRouter();
  const toast = useToast();

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Ищем по названию и по расшифровке: «ошибки» находит «Журнал ошибок»,
  // а «парсер» — подсказку «сбои парсеров», хотя слова в названии нет.
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return sections
      .filter(
        (s) =>
          s.label.toLowerCase().includes(needle) ||
          s.hint.toLowerCase().includes(needle),
      )
      // Точное совпадение в начале названия важнее вхождения в середине:
      // на запрос «бан» первым должен идти «Блоки», а не «Баны» из подсказки.
      .sort((a, b) => {
        const ax = a.label.toLowerCase().startsWith(needle) ? 0 : 1;
        const bx = b.label.toLowerCase().startsWith(needle) ? 0 : 1;
        return ax - bx;
      });
  }, [query, sections]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const tag = document.activeElement?.tagName ?? "";
      if (event.key !== "/" || tag === "INPUT" || tag === "TEXTAREA") return;
      event.preventDefault();
      inputRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Клик мимо поля закрывает список. Слушатель на документе, а не на обёртке:
  // иначе закрытие срабатывало бы слишком поздно и мешало выпадающему списку.
  useEffect(() => {
    if (!open) return;
    function onDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const go = useCallback(
    (section: AdminSection) => {
      setOpen(false);
      setQuery("");
      router.push(section.href);
    },
    [router],
  );

  function submit() {
    if (matches.length === 0) {
      toast(query.trim() ? `Ничего не найдено по запросу «${query.trim()}»` : "");
      return;
    }
    // Клик мышью сдвигает курсор на ту строку, которую нажали; клавишей
    // остаётся на первой подходящей.
    go(matches[Math.min(cursor, matches.length - 1)]);
  }

  return (
    <div className="ag-search" ref={wrapRef}>
      <input
        ref={inputRef}
        type="search"
        value={query}
        placeholder="Поиск раздела…  /"
        aria-label="Поиск раздела панели"
        aria-expanded={open && matches.length > 0}
        role="combobox"
        aria-controls="ag-search-list"
        autoComplete="off"
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          // Список меняется целиком, поэтому курсор сбрасывается здесь, а не в
          // эффекте по query: так лишней перерисовки не происходит.
          setCursor(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setCursor((c) => Math.min(c + 1, matches.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setCursor((c) => Math.max(c - 1, 0));
          } else if (event.key === "Escape") {
            setOpen(false);
          } else if (event.key === "Enter") {
            event.preventDefault();
            submit();
          }
        }}
      />

      {open && matches.length > 0 ? (
        <ul className="ag-search-list" id="ag-search-list" role="listbox">
          {matches.map((section, index) => (
            <li key={section.href}>
              <button
                type="button"
                role="option"
                aria-selected={index === cursor}
                className={`ag-search-item${index === cursor ? " on" : ""}`}
                onMouseEnter={() => setCursor(index)}
                onClick={() => go(section)}
              >
                <b>{section.label}</b>
                <small>{section.hint}</small>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}