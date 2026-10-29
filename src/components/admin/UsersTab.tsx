"use client";

import { PSelect } from "@/components/PSelect";
import { useCallback, useEffect, useRef, useState } from "react";
import { adminGet, ago, fmtNum } from "./api";
import { Empty, Initial, Pill, Segmented } from "./ui";

interface Row {
  id: number;
  nickname: string;
  email: string;
  role: string;
  premiumUntil: number;
  bannedUntil: number;
  createdAt: number;
  lastSeenAt: number;
  level: number;
  xp: number;
}

const FILTERS = [
  { id: "all", label: "Все" },
  { id: "online", label: "Онлайн" },
  { id: "new", label: "Новые" },
  { id: "premium", label: "Premium" },
  { id: "staff", label: "Команда" },
  { id: "banned", label: "Баны" },
] as const;

export function UsersTab({ onOpen, refreshKey }: { onOpen: (id: number) => void; refreshKey: number }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [sort, setSort] = useState("new");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);
  const [now] = useState(() => Date.now());
  const token = useRef(0);

  const fetchPage = useCallback(
    async (offset: number) => {
      const mine = ++token.current;
      const data = await adminGet<{ users: Row[]; total: number }>("users", { q, filter, sort, offset, limit: 30 });
      if (mine !== token.current) return;
      setTotal(data?.total ?? 0);
      setRows((prev) => (offset > 0 && prev ? [...prev, ...(data?.users ?? [])] : (data?.users ?? [])));
    },
    [q, filter, sort],
  );

  useEffect(() => {
    const t = window.setTimeout(() => void fetchPage(0), 220);
    return () => window.clearTimeout(t);
  }, [fetchPage, refreshKey]);

  return (
    <div className="adm-stack-lg">
      <div className="adm-toolbar">
        <div className="adm-searchbox">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" />
          </svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ник, почта или id" aria-label="Поиск игрока" />
        </div>
        <PSelect value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Сортировка">
          <option value="new">Новые сверху</option>
          <option value="xp">По опыту</option>
          <option value="ac">По балансу</option>
          <option value="seen">По активности</option>
        </PSelect>
      </div>
      <Segmented label="Фильтр" value={filter} onChange={setFilter} options={FILTERS.map((f) => ({ id: f.id, label: f.label }))} />
      <p className="adm-count">{rows ? `Найдено: ${fmtNum(total)}` : "Загрузка…"}</p>

      <ul className="adm-users">
        {(rows ?? []).map((u, i) => {
          const banned = u.bannedUntil > now;
          const premium = u.premiumUntil > now;
          const online = now - u.lastSeenAt < 5 * 60_000;
          return (
            <li key={u.id} style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
              <button type="button" onClick={() => onOpen(u.id)}>
                <span className="adm-ava">
                  <Initial name={u.nickname} size={42} />
                  {online ? <i className="adm-online" aria-label="онлайн" /> : null}
                </span>
                <span className="adm-u-main">
                  <b>{u.nickname}</b>
                  <small>{u.email}</small>
                </span>
                <span className="adm-u-pills">
                  {u.role !== "user" ? <Pill tone="violet">{u.role}</Pill> : null}
                  {premium ? <Pill tone="gold">PREMIUM</Pill> : null}
                  {banned ? <Pill tone="red">БАН</Pill> : null}
                </span>
                <span className="adm-u-meta">
                  <b>ур. {u.level}</b>
                  <small>
                    {fmtNum(u.xp)} XP · {online ? "онлайн" : ago(u.lastSeenAt, now)}
                  </small>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {rows && !rows.length ? <Empty>Никого не нашли</Empty> : null}
      {rows && rows.length < total ? (
        <button type="button" className="adm-btn adm-more" onClick={() => void fetchPage(rows.length)}>
          Показать ещё
        </button>
      ) : null}
    </div>
  );
}
