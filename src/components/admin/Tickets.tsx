"use client";

import { useCallback, useEffect, useState } from "react";
import { adminGet, adminPost, ago, fmtDate } from "./api";
import { Empty, Segmented, useUi } from "./ui";

interface Ticket { id: number; subject: string; category: string; status: "open" | "answered" | "closed"; updatedAt: number; unread: boolean; nickname?: string; userId?: number }
interface Msg { id: number; isStaff: boolean; body: string; createdAt: number }

const STATUS = { open: "Ждёт ответа", answered: "Отвечено", closed: "Закрыто" } as const;
const CAT: Record<string, string> = { account: "Аккаунт", payment: "Оплата", bug: "Ошибка", content: "Контент", idea: "Идея", other: "Другое" };

export function Tickets({ openUser }: { openUser: (id: number) => void }) {
  const ui = useUi();
  const [filter, setFilter] = useState<"open" | "answered" | "closed" | "all">("open");
  const [items, setItems] = useState<Ticket[] | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [detail, setDetail] = useState<{ ticket: Ticket; messages: Msg[] } | null>(null);
  const [text, setText] = useState("");
  const [now] = useState(() => Date.now());

  const loadList = useCallback(async () => {
    const d = await adminGet<{ tickets: Ticket[] }>("tickets", { status: filter });
    setItems(d?.tickets ?? []);
  }, [filter]);
  const loadOne = useCallback(async (id: number) => {
    const d = await adminGet<{ ticket: Ticket; messages: Msg[] }>("ticket", { id });
    if (d) setDetail(d);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void loadList(), 0);
    return () => window.clearTimeout(t);
  }, [loadList]);
  useEffect(() => {
    if (sel === null) return;
    const t = window.setTimeout(() => void loadOne(sel), 0);
    return () => window.clearTimeout(t);
  }, [sel, loadOne]);

  const reply = async () => {
    if (sel === null) return;
    const r = await adminPost({ action: "ticketReply", id: sel, text });
    ui.toast(r.ok ? "Ответ отправлен" : (r.error ?? "Ошибка"), r.ok ? "ok" : "err");
    if (r.ok) {
      setText("");
      void loadOne(sel);
      void loadList();
    }
  };
  const status = async (s: "open" | "closed") => {
    if (sel === null) return;
    const r = await adminPost({ action: "ticketStatus", id: sel, status: s });
    ui.toast(r.ok ? (s === "closed" ? "Обращение закрыто" : "Обращение открыто") : (r.error ?? "Ошибка"), r.ok ? "ok" : "err");
    void loadOne(sel);
    void loadList();
  };

  return (
    <div className="adm-stack-lg">
      <Segmented
        label="Статус обращений"
        value={filter}
        onChange={setFilter}
        options={[
          { id: "open", label: "Ждут ответа" },
          { id: "answered", label: "Отвечены" },
          { id: "closed", label: "Закрыты" },
          { id: "all", label: "Все" },
        ]}
      />
      <ul className="adm-feed">
        {(items ?? []).map((t) => (
          <li key={t.id}>
            <div>
              <b>
                {t.unread ? "● " : ""}#{t.id} · {t.subject}
              </b>
              <small>
                {t.nickname} · {CAT[t.category] ?? "Другое"} · {STATUS[t.status]} · {ago(t.updatedAt, now)}
              </small>
            </div>
            <button type="button" className="adm-btn adm-btn-sm adm-btn-primary" onClick={() => { setSel(t.id); setDetail(null); }}>
              Открыть
            </button>
          </li>
        ))}
      </ul>
      {items && !items.length ? <Empty>Обращений нет.</Empty> : null}

      {sel !== null && detail ? (
        <div className="adm-card" style={{ display: "grid", gap: 12 }}>
          <b>
            #{detail.ticket.id} · {detail.ticket.subject}{" "}
            {detail.ticket.userId ? (
              <button type="button" className="adm-link" onClick={() => openUser(detail.ticket.userId!)}>
                {detail.ticket.nickname}
              </button>
            ) : null}
          </b>
          {detail.messages.map((m) => (
            <div key={m.id} style={{ padding: 10, borderRadius: 12, background: m.isStaff ? "rgba(0,200,255,.08)" : "rgba(255,255,255,.04)" }}>
              <small>
                {m.isStaff ? "Поддержка" : detail.ticket.nickname} · {fmtDate(m.createdAt)}
              </small>
              <p style={{ whiteSpace: "pre-wrap", margin: "4px 0 0" }}>{m.body}</p>
            </div>
          ))}
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ответ игроку…" style={{ width: "100%", padding: 10, borderRadius: 12 }} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="adm-btn adm-btn-primary" disabled={text.trim().length < 2} onClick={() => void reply()}>
              Ответить (игроку придёт уведомление и сообщение в Telegram)
            </button>
            {detail.ticket.status === "closed" ? (
              <button type="button" className="adm-btn adm-btn-ghost" onClick={() => void status("open")}>Открыть заново</button>
            ) : (
              <button type="button" className="adm-btn adm-btn-ghost" onClick={() => void status("closed")}>Закрыть</button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
