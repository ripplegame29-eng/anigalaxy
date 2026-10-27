"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { openAuthDialog } from "@/lib/auth-dialog";
import "./support.css";

interface Ticket {
  id: number;
  subject: string;
  category: string;
  status: "open" | "answered" | "closed";
  createdAt: number;
  updatedAt: number;
  unread: boolean;
}
interface Msg {
  id: number;
  isStaff: boolean;
  body: string;
  createdAt: number;
}

const CATS: { id: string; label: string; hint: string; d: string }[] = [
  { id: "account", label: "Аккаунт", hint: "Вход, пароль, профиль", d: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-6 8-6s8 2 8 6" },
  { id: "payment", label: "Premium и оплата", hint: "Подписка, AC, покупки", d: "M3 7h18v10H3zM3 11h18M7 15h3" },
  { id: "bug", label: "Ошибка на сайте", hint: "Что-то сломалось", d: "M12 8v5M12 16.5h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" },
  { id: "content", label: "Видео и контент", hint: "Серия, озвучка, тайтл", d: "M4 5h16v11H4zM9 20h6M10 9l5 2.5L10 14z" },
  { id: "idea", label: "Идея", hint: "Предложить улучшение", d: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" },
  { id: "other", label: "Другое", hint: "Всё остальное", d: "M5 12h.01M12 12h.01M19 12h.01" },
];
const CAT_LABEL = Object.fromEntries(CATS.map((c) => [c.id, c.label]));
const STATUS: Record<Ticket["status"], string> = { open: "Ждёт ответа", answered: "Есть ответ", closed: "Закрыто" };

function when(ms: number): string {
  const d = new Date(ms);
  const same = d.toDateString() === new Date().toDateString();
  return same
    ? d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

const Svg = ({ d, size = 20 }: { d: string; size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

type Reply<T> = { status: number; data: T & { ok?: boolean; error?: string } };

async function api<T>(url: string, init?: RequestInit): Promise<Reply<T>> {
  try {
    const res = await fetch(url, { credentials: "same-origin", cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
    return { status: res.status, data: (await res.json().catch(() => ({}))) as Reply<T>["data"] };
  } catch {
    return { status: 0, data: { ok: false, error: "Нет связи с сервером" } as Reply<T>["data"] };
  }
}

/** Кнопка, которая открывает окно поддержки */
export function SupportButton({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  const show = useCallback(() => {
    setOpen(true);
    requestAnimationFrame(() => ref.current?.showModal());
  }, []);

  // Ссылка /#support (например, из бота) открывает окно сразу
  useEffect(() => {
    if (window.location.hash !== "#support") return;
    const t = window.setTimeout(show, 400);
    return () => window.clearTimeout(t);
  }, [show]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onClose = () => setOpen(false);
    const onBackdrop = (e: MouseEvent) => {
      if (e.target === el) el.close();
    };
    el.addEventListener("close", onClose);
    el.addEventListener("click", onBackdrop);
    return () => {
      el.removeEventListener("close", onClose);
      el.removeEventListener("click", onBackdrop);
    };
  }, []);

  return (
    <>
      <button type="button" className={className} onClick={show}>
        {children}
      </button>
      <dialog ref={ref} className="sd" aria-label="Поддержка AniGalaxy">
        {open ? <Desk onClose={() => ref.current?.close()} /> : null}
      </dialog>
    </>
  );
}

type View = { t: "new" } | { t: "ticket"; id: number };

function Desk({ onClose }: { onClose: () => void }) {
  const [auth, setAuth] = useState<"load" | "guest" | "ok">("load");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [view, setView] = useState<View>({ t: "new" });
  const [mobileList, setMobileList] = useState(true);
  const [detail, setDetail] = useState<{ ticket: Ticket; messages: Msg[] } | null>(null);
  const [form, setForm] = useState({ category: "", subject: "", body: "" });
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<number | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const loadList = useCallback(async () => {
    const r = await api<{ tickets: Ticket[] }>("/api/tickets");
    if (r.status === 401) return setAuth("guest");
    if (r.data.tickets) {
      setTickets(r.data.tickets);
      setAuth("ok");
    }
  }, []);

  const loadTicket = useCallback(async (id: number) => {
    const r = await api<{ ticket: Ticket; messages: Msg[] }>(`/api/tickets/${id}`);
    if (r.data.ticket) setDetail({ ticket: r.data.ticket, messages: r.data.messages });
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void loadList(), 0);
    return () => window.clearTimeout(t);
  }, [loadList]);

  const activeId = view.t === "ticket" ? view.id : 0;
  useEffect(() => {
    if (!activeId) return;
    const t = window.setTimeout(() => void loadTicket(activeId), 0);
    return () => window.clearTimeout(t);
  }, [activeId, loadTicket]);

  // Живое обновление: ответы поддержки появляются без перезагрузки
  useEffect(() => {
    if (auth !== "ok") return;
    const id = window.setInterval(() => {
      void loadList();
      if (activeId) void loadTicket(activeId);
    }, 7000);
    return () => window.clearInterval(id);
  }, [auth, activeId, loadList, loadTicket]);

  const msgCount = detail?.messages.length ?? 0;
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [msgCount, activeId]);

  const openTicket = (id: number) => {
    setDetail(null);
    setSent(null);
    setError(null);
    setView({ t: "ticket", id });
    setMobileList(false);
  };
  const openNew = () => {
    setView({ t: "new" });
    setSent(null);
    setError(null);
    setMobileList(false);
  };

  const create = async () => {
    setBusy(true);
    setError(null);
    const r = await api<{ id: number }>("/api/tickets", { method: "POST", body: JSON.stringify(form) });
    setBusy(false);
    if (r.data.ok && r.data.id) {
      setSent(r.data.id);
      setForm({ category: "", subject: "", body: "" });
      void loadList();
    } else setError(r.data.error ?? "Не удалось отправить обращение");
  };

  const send = async () => {
    if (view.t !== "ticket") return;
    setBusy(true);
    setError(null);
    const r = await api(`/api/tickets/${view.id}`, { method: "POST", body: JSON.stringify({ text: reply }) });
    setBusy(false);
    if (r.data.ok) {
      setReply("");
      void loadTicket(view.id);
      void loadList();
    } else setError(r.data.error ?? "Не удалось отправить");
  };

  const setStatus = async (status: "open" | "closed") => {
    if (view.t !== "ticket") return;
    await api(`/api/tickets/${view.id}`, { method: "POST", body: JSON.stringify({ status }) });
    void loadTicket(view.id);
    void loadList();
  };

  const canCreate = form.subject.trim().length >= 4 && form.body.trim().length >= 10 && !!form.category && !busy;
  const closed = detail?.ticket.status === "closed";

  return (
    <div className="sd-shell">
      <i className="sd-glow" aria-hidden />
      <button type="button" className="sd-x" onClick={onClose} aria-label="Закрыть">
        <Svg d="M6 6l12 12M18 6 6 18" size={18} />
      </button>

      <aside className={`sd-side${mobileList ? " show" : ""}`}>
        <header className="sd-brand">
          <span className="sd-badge">
            <Svg d="M4.5 13v-1.5a7.5 7.5 0 0 1 15 0V13M3 12.5h4v6H3zM17 12.5h4v6h-4zM19 18.5c0 1.5-1.5 2.5-4 2.5h-2" size={22} />
          </span>
          <div>
            <h2>Поддержка</h2>
            <p>Отвечаем в течение дня</p>
          </div>
        </header>

        <button type="button" className="sd-new" onClick={openNew}>
          <Svg d="M12 5v14M5 12h14" size={18} />
          Новое обращение
        </button>

        <div className="sd-list" role="list">
          {auth === "ok" && !tickets.length ? <p className="sd-empty">Обращений пока нет. Опишите вопрос, и мы поможем.</p> : null}
          {tickets.map((t, i) => (
            <button
              key={t.id}
              type="button"
              role="listitem"
              className={`sd-item${activeId === t.id ? " on" : ""}`}
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
              onClick={() => openTicket(t.id)}
            >
              <span className={`sd-dot s-${t.status}`} aria-hidden />
              <span className="sd-it">
                <b>{t.subject}</b>
                <small>
                  {CAT_LABEL[t.category] ?? "Другое"} · {when(t.updatedAt)}
                </small>
              </span>
              <span className={`sd-pill s-${t.status}`}>{STATUS[t.status]}</span>
              {t.unread ? <i className="sd-unread" aria-label="Есть новый ответ" /> : null}
            </button>
          ))}
        </div>
      </aside>

      <section className={`sd-main${mobileList ? "" : " show"}`}>
        <button type="button" className="sd-back" onClick={() => setMobileList(true)}>
          <Svg d="M15 5l-7 7 7 7" size={18} />
          Обращения
        </button>

        {auth === "load" ? (
          <div className="sd-center">
            <span className="sd-spin" />
          </div>
        ) : null}

        {auth === "guest" ? (
          <div className="sd-center sd-guest">
            <span className="sd-badge big">
              <Svg d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-6 8-6s8 2 8 6" size={30} />
            </span>
            <h3>Войдите, чтобы написать нам</h3>
            <p>Так мы увидим ваш аккаунт и сможем быстрее разобраться с вопросом.</p>
            <button
              type="button"
              className="sd-cta"
              onClick={() => {
                onClose();
                openAuthDialog("login");
              }}
            >
              Войти
            </button>
          </div>
        ) : null}

        {auth === "ok" && view.t === "new" && sent === null ? (
          <form
            className="sd-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (canCreate) void create();
            }}
          >
            <h3>О чём вопрос?</h3>
            <div className="sd-cats" role="group" aria-label="Тема обращения">
              {CATS.map((c, i) => (
                <button key={c.id} type="button" aria-pressed={form.category === c.id} style={{ animationDelay: `${i * 45}ms` }} onClick={() => setForm({ ...form, category: c.id })}>
                  <Svg d={c.d} />
                  <b>{c.label}</b>
                  <small>{c.hint}</small>
                </button>
              ))}
            </div>

            <label className="sd-f">
              <span>Коротко о проблеме</span>
              <input value={form.subject} maxLength={90} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Например: не пришли 500 AC после покупки" />
            </label>
            <label className="sd-f">
              <span>Подробности</span>
              <textarea value={form.body} maxLength={2000} rows={5} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Что вы делали, что ожидали и что получилось. Если ошибка, укажите страницу и браузер." />
              <em>{form.body.length} / 2000</em>
            </label>

            {error ? (
              <p className="sd-err" role="alert">
                {error}
              </p>
            ) : null}
            <button type="submit" className="sd-cta" disabled={!canCreate}>
              {busy ? "Отправляем…" : "Отправить обращение"}
            </button>
          </form>
        ) : null}

        {auth === "ok" && view.t === "new" && sent !== null ? (
          <div className="sd-center sd-ok">
            <svg viewBox="0 0 52 52" aria-hidden>
              <circle cx="26" cy="26" r="23" />
              <path d="m15 27 8 8 15-17" />
            </svg>
            <h3>Обращение №{sent} отправлено</h3>
            <p>Ответ появится здесь, в этом окне. Обычно мы отвечаем в течение дня.</p>
            <button type="button" className="sd-cta" onClick={() => openTicket(sent)}>
              Открыть обращение
            </button>
          </div>
        ) : null}

        {auth === "ok" && view.t === "ticket" ? (
          <div className="sd-chat">
            {detail ? (
              <>
                <header className="sd-ch">
                  <div>
                    <h3>{detail.ticket.subject}</h3>
                    <p>
                      №{detail.ticket.id} · {CAT_LABEL[detail.ticket.category] ?? "Другое"} · создано {when(detail.ticket.createdAt)}
                    </p>
                  </div>
                  <span className={`sd-pill s-${detail.ticket.status}`}>{STATUS[detail.ticket.status]}</span>
                </header>

                <div className="sd-log" ref={logRef} aria-live="polite">
                  {detail.messages.map((m) => (
                    <div key={m.id} className={`sd-msg ${m.isStaff ? "staff" : "me"}`}>
                      <small>
                        {m.isStaff ? "Поддержка AniGalaxy" : "Вы"} · {when(m.createdAt)}
                      </small>
                      <p>{m.body}</p>
                    </div>
                  ))}
                </div>

                {closed ? (
                  <div className="sd-closed">
                    <span>Обращение закрыто</span>
                    <button type="button" className="sd-ghost" onClick={() => void setStatus("open")}>
                      Открыть заново
                    </button>
                  </div>
                ) : (
                  <form
                    className="sd-reply"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (reply.trim().length >= 2 && !busy) void send();
                    }}
                  >
                    <textarea
                      value={reply}
                      rows={2}
                      maxLength={2000}
                      placeholder="Напишите ответ…"
                      onChange={(e) => setReply(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                          e.preventDefault();
                          if (reply.trim().length >= 2 && !busy) void send();
                        }
                      }}
                    />
                    <div>
                      <button type="button" className="sd-ghost" onClick={() => void setStatus("closed")}>
                        Проблема решена
                      </button>
                      <button type="submit" className="sd-cta sm" disabled={reply.trim().length < 2 || busy}>
                        Отправить
                      </button>
                    </div>
                    {error ? (
                      <p className="sd-err" role="alert">
                        {error}
                      </p>
                    ) : null}
                  </form>
                )}
              </>
            ) : (
              <div className="sd-center">
                <span className="sd-spin" />
              </div>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}
