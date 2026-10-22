"use client";

import { useCallback, useEffect, useState } from "react";
import { adminGet, adminPost, ago, fmtDate } from "./api";
import { Empty, Initial, Segmented, useUi } from "./ui";

type Sub = "reports" | "chat" | "comments" | "rooms";

interface Report { id: number; reporter: string; kind: string; targetId: string; reason: string; createdAt: number }
interface Chat { id: number; userId: number; nickname: string; body: string; createdAt: number }
interface Comment { id: number; titleId: string; body: string; createdAt: number; userId: number; nickname: string }
interface Room { id: number; code: string; title: string; anime: string; access: string; episode: number; createdAt: number; live: number; members: number }

export function Moderation({ openUser }: { openUser: (id: number) => void }) {
  const [sub, setSub] = useState<Sub>("reports");
  return (
    <div className="adm-stack-lg">
      <Segmented
        label="Раздел модерации"
        value={sub}
        onChange={setSub}
        options={[
          { id: "reports", label: "Жалобы" },
          { id: "chat", label: "Чат" },
          { id: "comments", label: "Комментарии" },
          { id: "rooms", label: "Комнаты" },
        ]}
      />
      {sub === "reports" ? <Reports openUser={openUser} /> : null}
      {sub === "chat" ? <ChatList openUser={openUser} /> : null}
      {sub === "comments" ? <Comments openUser={openUser} /> : null}
      {sub === "rooms" ? <Rooms /> : null}
    </div>
  );
}

function useList<T>(view: string, key: string, params: Record<string, string | number> = {}) {
  const [items, setItems] = useState<T[] | null>(null);
  const paramKey = JSON.stringify(params);
  const reload = useCallback(async () => {
    const data = await adminGet<Record<string, T[]>>(view, JSON.parse(paramKey));
    setItems(data?.[key] ?? []);
  }, [view, key, paramKey]);
  useEffect(() => {
    let alive = true;
    void adminGet<Record<string, T[]>>(view, JSON.parse(paramKey)).then((data) => alive && setItems(data?.[key] ?? []));
    return () => {
      alive = false;
    };
  }, [view, key, paramKey]);
  return [items, reload] as const;
}

function Reports({ openUser }: { openUser: (id: number) => void }) {
  const ui = useUi();
  const [status, setStatus] = useState<"open" | "resolved">("open");
  const [items, reload] = useList<Report>("reports", "reports", { status });
  const [now] = useState(() => Date.now());
  return (
    <>
      <Segmented
        label="Статус"
        value={status}
        onChange={setStatus}
        options={[
          { id: "open", label: "Открытые" },
          { id: "resolved", label: "Закрытые" },
        ]}
      />
      <ul className="adm-feed">
        {(items ?? []).map((r) => (
          <li key={r.id}>
            <div>
              <b>
                {r.kind === "user" ? "Жалоба на игрока" : `Жалоба: ${r.kind}`}{" "}
                {r.kind === "user" && Number.isFinite(Number(r.targetId)) ? (
                  <button type="button" className="adm-link" onClick={() => openUser(Number(r.targetId))}>
                    #{r.targetId}
                  </button>
                ) : (
                  `#${r.targetId}`
                )}
              </b>
              <p>{r.reason || "Причина не указана"}</p>
              <small>
                от {r.reporter} · {ago(r.createdAt, now)}
              </small>
            </div>
            {status === "open" ? (
              <button
                type="button"
                className="adm-btn adm-btn-sm adm-btn-primary"
                onClick={async () => {
                  const res = await adminPost({ action: "resolve", id: r.id });
                  ui.toast(res.ok ? "Жалоба закрыта" : (res.error ?? "Ошибка"), res.ok ? "ok" : "err");
                  void reload();
                }}
              >
                Закрыть
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {items && !items.length ? <Empty>{status === "open" ? "Открытых жалоб нет — чисто." : "Закрытых жалоб нет."}</Empty> : null}
    </>
  );
}

function ChatList({ openUser }: { openUser: (id: number) => void }) {
  const ui = useUi();
  const [items, reload] = useList<Chat>("chat", "messages");
  return (
    <>
      <ul className="adm-feed">
        {(items ?? []).map((m) => (
          <li key={m.id}>
            <div className="adm-feed-who">
              <Initial name={m.nickname} size={32} />
              <div>
                <b>
                  <button type="button" className="adm-link" onClick={() => openUser(m.userId)}>
                    {m.nickname}
                  </button>{" "}
                  <small>{fmtDate(m.createdAt)}</small>
                </b>
                <p>{m.body}</p>
              </div>
            </div>
            <button
              type="button"
              className="adm-btn adm-btn-sm adm-btn-ghost"
              onClick={async () => {
                const r = await adminPost({ action: "deleteChat", id: m.id });
                ui.toast(r.ok ? "Сообщение удалено" : (r.error ?? "Ошибка"), r.ok ? "ok" : "err");
                void reload();
              }}
            >
              Удалить
            </button>
          </li>
        ))}
      </ul>
      {items && !items.length ? <Empty>В чате пока тихо</Empty> : null}
    </>
  );
}

function Comments({ openUser }: { openUser: (id: number) => void }) {
  const ui = useUi();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q), 250);
    return () => window.clearTimeout(t);
  }, [q]);
  const [items, reload] = useList<Comment>("comments", "comments", { q: debounced });
  return (
    <>
      <div className="adm-searchbox">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Текст комментария или ник" aria-label="Поиск комментариев" />
      </div>
      <ul className="adm-feed">
        {(items ?? []).map((c) => (
          <li key={c.id}>
            <div className="adm-feed-who">
              <Initial name={c.nickname} size={32} />
              <div>
                <b>
                  <button type="button" className="adm-link" onClick={() => openUser(c.userId)}>
                    {c.nickname}
                  </button>{" "}
                  <small>
                    тайтл {c.titleId} · {fmtDate(c.createdAt)}
                  </small>
                </b>
                <p>{c.body}</p>
              </div>
            </div>
            <button
              type="button"
              className="adm-btn adm-btn-sm adm-btn-ghost"
              onClick={async () => {
                const r = await adminPost({ action: "deleteComment", id: c.id });
                ui.toast(r.ok ? "Комментарий удалён" : (r.error ?? "Ошибка"), r.ok ? "ok" : "err");
                void reload();
              }}
            >
              Удалить
            </button>
          </li>
        ))}
      </ul>
      {items && !items.length ? <Empty>Комментариев не найдено</Empty> : null}
    </>
  );
}

function Rooms() {
  const ui = useUi();
  const [items, reload] = useList<Room>("rooms", "rooms");
  const [now] = useState(() => Date.now());
  return (
    <>
      <ul className="adm-feed">
        {(items ?? []).map((r) => (
          <li key={r.id}>
            <div>
              <b>
                {r.title || r.anime} <small>· код {r.code} · серия {r.episode}</small>
              </b>
              <p>
                {r.anime} · {r.access === "open" ? "открытая" : "по ссылке"} · {r.live} смотрят сейчас из {r.members}
              </p>
              <small>создана {ago(r.createdAt, now)}</small>
            </div>
            <button
              type="button"
              className="adm-btn adm-btn-sm adm-btn-ghost"
              onClick={async () => {
                if (!(await ui.confirm(`Закрыть комнату ${r.code}?`, { text: "Участников выкинет, чат комнаты удалится.", danger: true, confirmLabel: "Закрыть" }))) return;
                const res = await adminPost({ action: "closeRoom", id: r.id });
                ui.toast(res.ok ? "Комната закрыта" : (res.error ?? "Ошибка"), res.ok ? "ok" : "err");
                void reload();
              }}
            >
              Закрыть
            </button>
          </li>
        ))}
      </ul>
      {items && !items.length ? <Empty>Комнат нет</Empty> : null}
    </>
  );
}
