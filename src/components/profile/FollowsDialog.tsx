"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Окно «Подписчики / Подписки / Друзья» — по макету «AniGalaxy — профиль и
 * подписки»: вкладки, поиск, фильтры и список.
 *
 * Списка в проекте нет: подписок и других аккаунтов не существует, а макет
 * рисует 64 выдуманных ника. Поэтому окно открывается и показывает честную
 * пустоту, а не притворяется, что данные есть. Как только появится бэкенд,
 * меняется только `USERS` — вся вёрстка и фильтры уже на месте.
 */

interface User {
  nick: string;
  online: boolean;
  premium: boolean;
  level: string;
  lastSeen: string;
  mutual: boolean;
}

/** Пустой пул: подписок в проекте нет. См. описание выше. */
const USERS: User[] = [];

type Tab = 0 | 1 | 2;

const TABS = ["Подписчики", "Подписки", "Друзья"] as const;

const SORTS = ["По имени", "Сначала онлайн"] as const;

type Filter = "all" | "on" | "prem" | "mut";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "on", label: "В сети" },
  { id: "prem", label: "Premium" },
  { id: "mut", label: "Взаимные" },
];

export interface FollowsDialogProps {
  /** Вкладка, с которой открывается окно */
  tab: Tab;
  className?: string;
  label: React.ReactNode;
  /** Компактная кнопка-ссылка — как «Все» в шапке блока друзей */
  compact?: boolean;
}

export function FollowsDialog({ tab, className, label, compact }: FollowsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [active, setActive] = useState<Tab>(tab);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState(0);

  // Вкладку берём из пропса прямо в обработчике: ref здесь означал бы
  // присваивание во время рендера, а `tab` и так меняется вместе с кнопкой.
  const show = () => {
    setActive(tab);
    setQuery("");
    setFilter("all");
    dialogRef.current?.showModal();
  };

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const onBackdrop = (e: MouseEvent) => {
      if (e.target === el) el.close();
    };
    el.addEventListener("click", onBackdrop);
    return () => el.removeEventListener("click", onBackdrop);
  }, []);

  const q = query.trim().toLowerCase();
  const rows = USERS.filter((u) => {
    const byQuery = !q || u.nick.toLowerCase().includes(q);
    const byFilter =
      filter === "all" ||
      (filter === "on" && u.online) ||
      (filter === "prem" && u.premium) ||
      (filter === "mut" && u.mutual);
    return byQuery && byFilter;
  }).sort((a, b) => (sort === 0 ? a.nick.localeCompare(b.nick, "ru") : Number(b.online) - Number(a.online)));

  const counts = {
    all: USERS.length,
    on: USERS.filter((u) => u.online).length,
    prem: USERS.filter((u) => u.premium).length,
    mut: USERS.filter((u) => u.mutual).length,
  };

  return (
    <>
      <button type="button" className={className} onClick={show} data-compact={compact ? "y" : undefined}>
        {label}
      </button>

      <dialog ref={dialogRef} className="fd" aria-label="Подписчики и подписки">
        <div className="fs" data-t={active}>
          <div className="fh2">
            <div className="ftabs" role="tablist">
              <i className="fi" aria-hidden="true" />
              {TABS.map((name, i) => (
                <button
                  key={name}
                  type="button"
                  role="tab"
                  data-t={i}
                  aria-selected={active === i}
                  onClick={() => setActive(i as Tab)}
                >
                  {name}
                  <b>{USERS.length || "—"}</b>
                </button>
              ))}
            </div>
            <button type="button" className="gfr-fx" onClick={() => dialogRef.current?.close()} aria-label="Закрыть">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          <div className="fq">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>
            <input
              value={query}
              placeholder="Поиск по нику"
              autoComplete="off"
              aria-label="Поиск по нику"
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              type="button"
              className="fqc"
              onClick={() => setQuery("")}
              aria-label="Очистить"
              hidden={!query}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          <div className="ff">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
                <em>{counts[f.id]}</em>
              </button>
            ))}
            <button type="button" className="so" onClick={() => setSort((s) => (s + 1) % SORTS.length)}>
              ⇅ {SORTS[sort]}
            </button>
          </div>

          <div className="fl">
            {rows.length ? (
              rows.map((u, i) => (
                <div key={u.nick} className="fr" style={{ "--d": i } as React.CSSProperties}>
                  <div
                    className={`fa${u.premium ? " p" : ""}${u.online ? " on" : ""}`}
                    style={{ "--bg": "linear-gradient(140deg,#8b5cf6,#3b82f6)" } as React.CSSProperties}
                  >
                    {u.nick[0]?.toUpperCase()}
                  </div>
                  <div className="fn">
                    <strong>
                      <span className="nm">{u.nick}</span>
                      {u.premium && <span className="pb">PREMIUM</span>}
                    </strong>
                    <small className={u.online ? "o" : undefined}>
                      {u.online ? "В сети" : `Был(а) ${u.lastSeen}`}
                    </small>
                  </div>
                  <div className="lvl b4">{u.level}</div>
                </div>
              ))
            ) : (
              <div className="fe">
                <b>Списка пока нет</b>
                В проекте один аккаунт на браузер: подписок и других пользователей
                не существует, поэтому показывать здесь нечего
              </div>
            )}
          </div>

          <div className="ft">
            <span>{rows.length ? `Показано ${rows.length} из ${rows.length}` : "Пусто"}</span>
            <span>Esc — закрыть</span>
          </div>
        </div>
      </dialog>
    </>
  );
}