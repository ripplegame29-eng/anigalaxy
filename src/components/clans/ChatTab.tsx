"use client";

/** Клановый чат: лента сообщений с опросом раз в 3 секунды. */

import { useCallback, useEffect, useRef, useState } from "react";
import { Ico, useClan } from "./common";

interface Msg { id: number; userId: number; nickname: string; role: string; text: string; at: number }

const ROLE: Record<string, string> = { leader: "Глава", officer: "Офицер" };
const time = (t: number) => new Date(t).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
const day = (t: number) => new Date(t).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });

export function ChatTab() {
  const { me } = useClan();
  const uid = me.uid;
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const lastId = useRef(0);
  const stick = useRef(true);

  const merge = useCallback((add: Msg[]) => {
    if (!add.length) return;
    setMsgs((cur) => {
      const seen = new Set(cur.map((m) => m.id));
      const next = [...cur, ...add.filter((m) => !seen.has(m.id))].slice(-300);
      lastId.current = next[next.length - 1]?.id ?? lastId.current;
      return next;
    });
  }, []);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`/api/clans/chat${lastId.current ? `?after=${lastId.current}` : ""}`, { cache: "no-store" });
        const d = (await r.json()) as { messages?: Msg[] };
        if (alive && d.messages) merge(d.messages);
      } catch { /* сеть моргнула — следующий опрос подхватит */ }
    };
    void load();
    const t = setInterval(() => { if (!document.hidden) void load(); }, 3000);
    return () => { alive = false; clearInterval(t); };
  }, [merge]);

  useEffect(() => {
    const el = list.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true); setErr("");
    try {
      const r = await fetch("/api/clans/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: t }) });
      const d = (await r.json()) as { message?: Msg; error?: string };
      if (d.message) { stick.current = true; merge([d.message]); setText(""); }
      else setErr(d.error ?? "Не отправилось");
    } catch { setErr("Нет связи с сервером"); }
    setSending(false);
  };

  return (
    <section className="ca-panel ca-chat">
      <header className="ca-panel-h"><h2><Ico n="chat" size={18} /> Чат клана</h2><span className="ca-panel-aside">видят только участники</span></header>
      <div className="ca-chat-list" ref={list} onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60; }}>
        {msgs.length === 0 && <p className="ca-chat-empty">Здесь пока тихо. Напишите первым</p>}
        {msgs.map((m, i) => {
          const prev = msgs[i - 1];
          const newDay = !prev || day(prev.at) !== day(m.at);
          const grouped = !newDay && prev && prev.userId === m.userId && m.at - prev.at < 5 * 60_000;
          const mine = m.userId === uid;
          return (
            <div key={m.id}>
              {newDay && <div className="ca-chat-day">{day(m.at)}</div>}
              <div className={`ca-msg${mine ? " is-me" : ""}${grouped ? " is-cont" : ""}`}>
                {!grouped && (
                  <div className="ca-msg-h">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/avatar?u=${m.userId}`} alt="" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                    <b>{m.nickname}</b>
                    {ROLE[m.role] && <span className={`ca-msg-role r-${m.role}`}>{ROLE[m.role]}</span>}
                    <time>{time(m.at)}</time>
                  </div>
                )}
                <p>{m.text}</p>
              </div>
            </div>
          );
        })}
      </div>
      <form className="ca-chat-form" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="Сообщение клану" aria-label="Сообщение клану" />
        <button type="submit" className="ca-btn ca-btn-primary" disabled={!text.trim() || sending}>Отправить</button>
      </form>
      {err && <p className="ca-err">{err}</p>}
    </section>
  );
}
