"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Pending {
  token: string;
  code: string;
  link: string;
  expiresAt: number;
}

/** Настоящая привязка Telegram: бот подтверждает, сервер записывает telegram_id в аккаунт */
export function TelegramLink({ onChange }: { onChange?: (linked: boolean) => void }) {
  const [state, setState] = useState<{ loaded: boolean; linked: boolean; username: string; guest: boolean }>({
    loaded: false,
    linked: false,
    username: "",
    guest: false,
  });
  const [pending, setPending] = useState<Pending | null>(null);
  const [left, setLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/tglogin/link", { cache: "no-store" });
      if (res.status === 401) {
        setState({ loaded: true, linked: false, username: "", guest: true });
        return;
      }
      const data = await res.json();
      setState({ loaded: true, linked: !!data.linked, username: data.username || "", guest: false });
      cb.current?.(!!data.linked);
    } catch {
      setState((s) => ({ ...s, loaded: true }));
    }
  }, []);
  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const start = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/tglogin/link", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Не удалось начать привязку");
        return;
      }
      setPending({ token: data.token, code: data.code, link: data.link, expiresAt: data.expiresAt });
      window.open(data.link, "_blank", "noopener");
    } catch {
      setError("Не удалось связаться с сервером");
    } finally {
      setBusy(false);
    }
  };

  const token = pending?.token ?? null;
  const expiresAt = pending?.expiresAt ?? 0;
  useEffect(() => {
    if (!token) return;
    let stop = false;
    const tick = window.setInterval(() => setLeft(Math.max(0, Math.round((expiresAt - Date.now()) / 1000))), 500);
    const poll = async () => {
      if (stop) return;
      try {
        const res = await fetch(`/api/tglogin/link?token=${encodeURIComponent(token)}`, { cache: "no-store" });
        const data = await res.json();
        if (stop) return;
        if (data.status === "ok") {
          setPending(null);
          void load();
          return;
        }
        if (data.status === "taken") {
          setPending(null);
          setError("Этот Telegram уже привязан к другому аккаунту");
          return;
        }
        if (data.status === "cancelled") {
          setPending(null);
          setError("Привязка отменена в Telegram");
          return;
        }
        if (data.status === "expired" || data.status === "unknown") {
          setPending(null);
          setError("Время вышло. Попробуйте ещё раз");
          return;
        }
      } catch {
        /* временная ошибка сети */
      }
      window.setTimeout(poll, 2500);
    };
    const first = window.setTimeout(poll, 2000);
    return () => {
      stop = true;
      window.clearInterval(tick);
      window.clearTimeout(first);
    };
  }, [token, expiresAt, load]);

  const unlink = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/tglogin/link", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) setError(data.error || "Не удалось отвязать");
      else await load();
    } catch {
      setError("Не удалось связаться с сервером");
    } finally {
      setBusy(false);
    }
  };

  if (!state.loaded) return null;
  if (state.guest) return <p className="ag-set-hint">Войдите в аккаунт, чтобы привязать Telegram.</p>;

  const hint = pending ? (
    <>
      Откройте бота и подтвердите привязку. Код в боте должен совпасть: <strong>{pending.code}</strong> · осталось {Math.floor(left / 60)}:
      {String(left % 60).padStart(2, "0")}
    </>
  ) : state.linked ? (
    <>{state.username ? `@${state.username} · ` : ""}привязан, вход через бота открывает этот аккаунт</>
  ) : (
    "Подтверждение через бота AniGalaxy"
  );

  return (
    <div className="ag-set-r">
      <span className="ag-set-ri" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 3L3 10.5l6 2.5 2.5 6.5 3-4.5L19 19z" />
          <path d="M9 13l12-10" />
        </svg>
      </span>
      <div className="ag-set-rx">
        <b>Telegram</b>
        <small>{hint}</small>
        {error && <small className="ag-set-warn">{error}</small>}
      </div>
      {pending ? (
        <a className="ag-set-btn" href={pending.link} target="_blank" rel="noopener">
          Открыть бота
        </a>
      ) : state.linked ? (
        <button type="button" className="ag-set-btn danger" onClick={unlink} disabled={busy}>
          Отвязать
        </button>
      ) : (
        <button type="button" className="ag-set-btn" onClick={start} disabled={busy}>
          Привязать Telegram
        </button>
      )}
    </div>
  );
}
