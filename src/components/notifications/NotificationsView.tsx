"use client";

/**
 * Страница «Уведомления».
 *
 * Источник — `profile.notices` (lib/profile.ts): у записей есть только текст,
 * время и признак «прочитано». Тип (уровень / достижение / тег / серия) и
 * награды разбираются из текста, поэтому новые формулировки без совпадения
 * попадают в «Другое» и ничего не ломают.
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  clearNotices,
  markNoticesRead,
  removeNotice,
  setNoticeRead,
  unreadCount,
  useProfile,
  type ProfileNotice,
} from "@/lib/profile";
import { timeAgo } from "@/lib/history";
import "./notifications.css";

type Kind = "level" | "ach" | "tag" | "episode" | "other";
type Filter = "all" | "unread" | Kind;

interface Parsed {
  kind: Kind;
  title: string;
  body: string;
  xp: number;
  ac: number;
  href?: string;
}

const KIND_LABEL: Record<Kind, string> = {
  level: "Уровни",
  ach: "Награды",
  tag: "Теги",
  episode: "Серии",
  other: "Другое",
};

const num = (v: string | undefined) => (v ? Number(v.replace(/\s/g, "")) : 0);

function parse(text: string): Parsed {
  const xp = num(text.match(/\+\s?([\d\s]+)\s*XP/i)?.[1]);
  const ac = num(text.match(/\+\s?([\d\s]+)\s*[AА][CС]/i)?.[1]);
  let m = text.match(/^Новый уровень (\d+)[!.]?\s*(.*)$/);
  if (m) return { kind: "level", title: `Новый уровень ${m[1]}`, body: m[2] || "Продолжай в том же духе", xp, ac, href: "/levels" };
  m = text.match(/^Достижение «(.+?)» получено/);
  if (m) return { kind: "ach", title: m[1], body: "Достижение получено", xp, ac, href: "/profile?tab=achievements" };
  m = text.match(/^Открыт тег «(.+?)»/);
  if (m) return { kind: "tag", title: m[1], body: "Открыт новый тег", xp, ac, href: "/profile?tab=achievements" };
  if (/Можно смотреть/i.test(text)) {
    const t = text.replace(/\.?\s*Можно смотреть\.?$/i, "");
    return { kind: "episode", title: "Вышла новая серия", body: t, xp, ac, href: "/schedule" };
  }
  return { kind: "other", title: "Уведомление", body: text, xp, ac };
}

function Icon({ kind }: { kind: Kind }) {
  const p = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (kind) {
    case "level":
      return <svg {...p}><path d="M12 3 4 7.5v9L12 21l8-4.5v-9z" /><path d="m9 12 2.2 2.2L15.5 10" /></svg>;
    case "ach":
      return <svg {...p}><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M9 20h6" /></svg>;
    case "tag":
      return <svg {...p}><path d="M3 12V4h8l9 9-8 8z" /><circle cx="7.5" cy="8.5" r="1.2" /></svg>;
    case "episode":
      return <svg {...p}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M10 9.5v5l4.5-2.5z" /></svg>;
    default:
      return <svg {...p}><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></svg>;
  }
}

function dayLabel(at: number): string {
  const d = new Date(at);
  const today = new Date();
  const s = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((s(today) - s(d)) / 86400000);
  if (diff <= 0) return "Сегодня";
  if (diff === 1) return "Вчера";
  if (diff < 7) return "На этой неделе";
  return "Раньше";
}

const GROUP_ORDER = ["Сегодня", "Вчера", "На этой неделе", "Раньше"];

export function NotificationsView() {
  const profile = useProfile();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [confirm, setConfirm] = useState(false);

  const items = useMemo(
    () => profile.notices.map((n) => ({ n, p: parse(n.text) })),
    [profile.notices],
  );
  const unread = unreadCount(profile);
  const total = items.length;

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: total, unread, level: 0, ach: 0, tag: 0, episode: 0, other: 0 };
    for (const { p } of items) c[p.kind] += 1;
    return c;
  }, [items, total, unread]);

  const totalXp = useMemo(() => items.reduce((a, { p }) => a + p.xp, 0), [items]);
  const totalAc = useMemo(() => items.reduce((a, { p }) => a + p.ac, 0), [items]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(({ n, p }) => {
      if (filter === "unread" && n.read) return false;
      if (filter !== "all" && filter !== "unread" && p.kind !== filter) return false;
      if (q && !`${p.title} ${p.body}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, filter, query]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof shown>();
    for (const it of shown) {
      const g = dayLabel(it.n.at);
      map.set(g, [...(map.get(g) ?? []), it]);
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({ g, list: map.get(g)! }));
  }, [shown]);

  const pct = total ? Math.round(((total - unread) / total) * 100) : 100;
  const filters: Filter[] = ["all", "unread", "level", "ach", "tag", "episode", "other"];

  let idx = 0;

  return (
    <div className="nt-root mx-auto max-w-4xl px-4 pb-16 pt-8 sm:px-6">
      <header className="nt-hero">
        <div className="nt-hero-txt">
          <span className="nt-eyebrow">Центр событий</span>
          <h1 className="nt-h1">Уведомления</h1>
          <p className="nt-sub">
            {unread > 0
              ? `Новых событий: ${unread}. Забирай награды и не пропускай серии.`
              : "Всё прочитано — ты в курсе всех событий."}
          </p>
          <div className="nt-actions">
            <button type="button" className="nt-btn nt-btn--pri" onClick={markNoticesRead} disabled={unread === 0}>
              Прочитать все
            </button>
            <button
              type="button"
              className={`nt-btn ${confirm ? "nt-btn--danger" : ""}`}
              disabled={total === 0}
              onClick={() => {
                if (!confirm) {
                  setConfirm(true);
                  setTimeout(() => setConfirm(false), 3000);
                } else {
                  clearNotices();
                  setConfirm(false);
                }
              }}
            >
              {confirm ? "Точно очистить?" : "Очистить"}
            </button>
          </div>
        </div>

        <div className="nt-ring" style={{ "--p": pct } as React.CSSProperties}>
          <div className="nt-ring-in">
            <b>{unread}</b>
            <span>новых</span>
          </div>
        </div>

        <div className="nt-stats">
          <div><b>{total}</b><span>всего</span></div>
          <div><b className="nt-xp">+{totalXp.toLocaleString("ru-RU")}</b><span>XP</span></div>
          <div><b className="nt-ac">+{totalAc.toLocaleString("ru-RU")}</b><span>AC</span></div>
        </div>
      </header>

      <div className="nt-bar">
        <div className="nt-chips" role="tablist">
          {filters.map((f) => {
            if (f !== "all" && f !== "unread" && counts[f] === 0) return null;
            return (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filter === f}
                className="nt-chip"
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "Все" : f === "unread" ? "Непрочитанные" : KIND_LABEL[f]}
                <i>{counts[f]}</i>
              </button>
            );
          })}
        </div>
        <label className="nt-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по событиям" aria-label="Поиск по уведомлениям" />
        </label>
      </div>

      {shown.length === 0 ? (
        <div className="nt-empty">
          <div className="nt-bell"><Icon kind="other" /></div>
          <h2>{total === 0 ? "Пока тихо" : "Ничего не найдено"}</h2>
          <p>
            {total === 0
              ? "Здесь появятся новые уровни, достижения, теги и выход серий."
              : "Попробуй другой фильтр или очисти поиск."}
          </p>
          {total > 0 && (
            <button type="button" className="nt-btn" onClick={() => { setFilter("all"); setQuery(""); }}>
              Сбросить фильтры
            </button>
          )}
        </div>
      ) : (
        groups.map(({ g, list }) => (
          <section key={g} className="nt-group">
            <h2 className="nt-gh">{g}<i>{list.length}</i></h2>
            <ul>
              {list.map(({ n, p }) => (
                <Row key={n.id} n={n} p={p} i={idx++} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function Row({ n, p, i }: { n: ProfileNotice; p: Parsed; i: number }) {
  return (
    <li
      className={`nt-item nt-k-${p.kind} ${n.read ? "is-read" : "is-new"}`}
      style={{ "--i": Math.min(i, 14) } as React.CSSProperties}
      onClick={() => !n.read && setNoticeRead(n.id, true)}
    >
      <span className="nt-ico"><Icon kind={p.kind} /></span>
      <div className="nt-main">
        <div className="nt-top">
          <h3>{p.title}</h3>
          {!n.read && <em>NEW</em>}
        </div>
        <p>{p.body}</p>
        {(p.xp > 0 || p.ac > 0) && (
          <div className="nt-rw">
            {p.xp > 0 && <span className="nt-xp">+{p.xp.toLocaleString("ru-RU")} XP</span>}
            {p.ac > 0 && <span className="nt-ac">+{p.ac.toLocaleString("ru-RU")} AC</span>}
          </div>
        )}
      </div>
      <div className="nt-side">
        <time>{timeAgo(n.at)}</time>
        <div className="nt-tools" onClick={(e) => e.stopPropagation()}>
          {p.href && <Link href={p.href} className="nt-tool" title="Открыть" aria-label="Открыть">↗</Link>}
          <button type="button" className="nt-tool" title={n.read ? "Пометить непрочитанным" : "Прочитано"} aria-label="Переключить прочтение" onClick={() => setNoticeRead(n.id, !n.read)}>
            {n.read ? "○" : "●"}
          </button>
          <button type="button" className="nt-tool nt-tool--del" title="Удалить" aria-label="Удалить" onClick={() => removeNotice(n.id)}>×</button>
        </div>
      </div>
    </li>
  );
}
