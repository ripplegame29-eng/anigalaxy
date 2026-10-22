"use client";

import { useEffect, useRef, useState } from "react";
import { useProfileSocial, type SocialEntry } from "@/lib/profile-social";

/**
 * Списки чужого профиля: подписчики, подписки и друзья игрока. Данные —
 * с сервера (`/api/profile-social`); у каждого игрока в списке ник ведёт на
 * его профиль. Оформление то же, что у окна своих подписок.
 */

type Tab = 0 | 1 | 2;
const TABS = ["Подписчики", "Подписки", "Друзья"] as const;

const dateOf = (ms: number) => (ms ? new Date(ms).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" }) : "");

export interface PlayerSocialDialogProps {
  nickname: string;
  tab: Tab;
  className?: string;
  label: React.ReactNode;
}

export function PlayerSocialDialog({ nickname, tab, className, label }: PlayerSocialDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [active, setActive] = useState<Tab>(tab);
  const [query, setQuery] = useState("");
  const { loaded, data } = useProfileSocial(nickname);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const onBackdrop = (e: MouseEvent) => {
      if (e.target === el) el.close();
    };
    el.addEventListener("click", onBackdrop);
    return () => el.removeEventListener("click", onBackdrop);
  }, []);

  const lists: SocialEntry[][] = [data?.followers ?? [], data?.following ?? [], data?.friends ?? []];
  const q = query.trim().toLowerCase();
  const rows = lists[active].filter((row) => !q || row.nickname.toLowerCase().includes(q));
  const note = ["Хочет дружить с игроком", "Заявка отправлена", "Друзья с"] as const;

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          setActive(tab);
          setQuery("");
          dialogRef.current?.showModal();
        }}
      >
        {label}
      </button>

      <dialog ref={dialogRef} className="fd" aria-label={`Подписчики и подписки ${nickname}`}>
        <div className="fs" data-t={active}>
          <div className="fh2">
            <div className="ftabs" role="tablist">
              <i className="fi" aria-hidden="true" />
              {TABS.map((name, i) => (
                <button key={name} type="button" role="tab" data-t={i} aria-selected={active === i} onClick={() => setActive(i as Tab)}>
                  {name}
                  <b>{lists[i].length || "—"}</b>
                </button>
              ))}
            </div>
            <button type="button" className="gfr-fx" onClick={() => dialogRef.current?.close()} aria-label="Закрыть">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          <div className="ff">
            <input
              value={query}
              placeholder="Поиск по нику в списке"
              autoComplete="off"
              aria-label="Поиск по нику в списке"
              onChange={(e) => setQuery(e.target.value)}
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "inherit" }}
            />
          </div>

          <div className="fl">
            {!loaded ? (
              <div className="fe">
                <b>Загрузка…</b>
              </div>
            ) : rows.length ? (
              rows.map((row, i) => (
                <a key={row.nickname} className="fr" href={`/u/${encodeURIComponent(row.nickname)}`} style={{ "--d": i, textDecoration: "none", color: "inherit" } as React.CSSProperties}>
                  <div className="fa" style={{ "--bg": "linear-gradient(140deg,#8b5cf6,#3b82f6)" } as React.CSSProperties}>
                    {row.nickname[0]?.toUpperCase()}
                  </div>
                  <div className="fn">
                    <strong>
                      <span className="nm">{row.nickname}</span>
                    </strong>
                    <small>{active === 2 ? `${note[2]} ${dateOf(row.since)}` : note[active]}</small>
                  </div>
                </a>
              ))
            ) : (
              <div className="fe">
                <b>{active === 0 ? "Подписчиков пока нет" : active === 1 ? "Подписок пока нет" : "Друзей пока нет"}</b>
                {active === 0 ? "Станьте первым — нажмите «Подписаться» в профиле" : "Здесь появятся игроки, когда заявки будут отправлены"}
              </div>
            )}
          </div>

          <div className="ft">
            <span>{rows.length ? `Показано ${rows.length} из ${lists[active].length}` : "Пусто"}</span>
            <span>Esc — закрыть</span>
          </div>
        </div>
      </dialog>
    </>
  );
}
