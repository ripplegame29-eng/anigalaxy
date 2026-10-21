"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFriends, type FriendRow } from "@/lib/friends-cloud";

/**
 * Окно «Подписчики / Подписки / Друзья» — по макету «AniGalaxy — профиль и
 * подписки»: вкладки, поиск, фильтры и список.
 *
 * Данные теперь настоящие (`/api/friends`): вкладки читаются как входящие
 * заявки, исходящие заявки и принятые дружбы. Без входа или без сервера
 * список честно пуст — раздел ничего не придумывает.
 */

type Tab = 0 | 1 | 2;

const TABS = ["Подписчики", "Подписки", "Друзья"] as const;
/** Статус, который показывает каждая вкладка */
const TAB_STATUS: Record<Tab, FriendRow["status"]> = { 0: "incoming", 1: "outgoing", 2: "accepted" };

const SORTS = ["По имени", "Сначала новые"] as const;

export interface FollowsDialogProps {
  /** Вкладка, с которой открывается окно */
  tab: Tab;
  className?: string;
  label: React.ReactNode;
  /** Компактная кнопка-ссылка — как «Все» в шапке блока друзей */
  compact?: boolean;
}

function dateOf(ms: number): string {
  if (!ms) return "";
  return new Date(ms).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}

export function FollowsDialog({ tab, className, label, compact }: FollowsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [active, setActive] = useState<Tab>(tab);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(0);
  const [open, setOpen] = useState(false);
  const [addNick, setAddNick] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [addBusy, setAddBusy] = useState(false);

  const { friends, loading, error, request, remove } = useFriends(open);

  const show = () => {
    setActive(tab);
    setQuery("");
    setAddError(null);
    setOpen(true);
    dialogRef.current?.showModal();
  };

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const onBackdrop = (e: MouseEvent) => {
      if (e.target === el) el.close();
    };
    const onClose = () => setOpen(false);
    el.addEventListener("click", onBackdrop);
    el.addEventListener("close", onClose);
    return () => {
      el.removeEventListener("click", onBackdrop);
      el.removeEventListener("close", onClose);
    };
  }, []);

  const counts = useMemo(
    () => ({
      0: friends.filter((f) => f.status === "incoming").length,
      1: friends.filter((f) => f.status === "outgoing").length,
      2: friends.filter((f) => f.status === "accepted").length,
    }),
    [friends],
  );

  const q = query.trim().toLowerCase();
  const rows = friends
    .filter((f) => f.status === TAB_STATUS[active])
    .filter((f) => !q || f.nickname.toLowerCase().includes(q))
    .sort((a, b) => (sort === 0 ? a.nickname.localeCompare(b.nickname, "ru") : b.since - a.since));

  const onAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    const nickname = addNick.trim();
    if (!nickname || addBusy) return;
    setAddBusy(true);
    const err = await request(nickname);
    setAddBusy(false);
    if (err) setAddError(err);
    else {
      setAddError(null);
      setAddNick("");
      setActive(1);
    }
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
                  <b>{counts[i as Tab] || "—"}</b>
                </button>
              ))}
            </div>
            <button type="button" className="gfr-fx" onClick={() => dialogRef.current?.close()} aria-label="Закрыть">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          <form className="fq" onSubmit={onAdd}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>
            <input
              value={addNick}
              placeholder="Добавить по нику"
              autoComplete="off"
              aria-label="Добавить по нику"
              onChange={(e) => {
                setAddNick(e.target.value);
                setAddError(null);
              }}
            />
            <button type="submit" className="fqc" disabled={!addNick.trim() || addBusy} aria-label="Отправить заявку">
              +
            </button>
          </form>
          {addError && <p className="fe" style={{ padding: "0 4px" }}>{addError}</p>}

          <div className="ff">
            <input
              value={query}
              placeholder="Поиск по нику в списке"
              autoComplete="off"
              aria-label="Поиск по нику в списке"
              onChange={(e) => setQuery(e.target.value)}
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "inherit" }}
            />
            <button type="button" className="so" onClick={() => setSort((s) => (s + 1) % SORTS.length)}>
              ⇅ {SORTS[sort]}
            </button>
          </div>

          <div className="fl">
            {error === "auth" ? (
              <div className="fe">
                <b>Нужен вход</b>
                Друзья хранятся на сервере за аккаунтом — войдите, чтобы увидеть список
              </div>
            ) : loading ? (
              <div className="fe">
                <b>Загрузка…</b>
              </div>
            ) : rows.length ? (
              rows.map((u, i) => (
                <div key={u.userId} className="fr" style={{ "--d": i } as React.CSSProperties}>
                  <div className="fa" style={{ "--bg": "linear-gradient(140deg,#8b5cf6,#3b82f6)" } as React.CSSProperties}>
                    {u.nickname[0]?.toUpperCase()}
                  </div>
                  <div className="fn">
                    <strong>
                      <span className="nm">{u.nickname}</span>
                    </strong>
                    <small>{active === 0 ? "Хочет дружить" : active === 1 ? "Заявка отправлена" : `Друзья с ${dateOf(u.since)}`}</small>
                  </div>
                  {active === 0 && (
                    <button type="button" className="so" onClick={() => void request(u.nickname)}>
                      Принять
                    </button>
                  )}
                  {active !== 0 && (
                    <button type="button" className="so" onClick={() => void remove(u.userId)}>
                      {active === 1 ? "Отменить" : "Удалить"}
                    </button>
                  )}
                </div>
              ))
            ) : (
              <div className="fe">
                <b>{active === 0 ? "Входящих заявок нет" : active === 1 ? "Исходящих заявок нет" : "Друзей пока нет"}</b>
                Добавьте игрока по нику выше — заявка придёт ему в «Подписчики»
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
