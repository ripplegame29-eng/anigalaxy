"use client";

import { useEffect, useRef, useState } from "react";
import { loginTelegramVerified } from "@/lib/auth";
import { adoptTelegramSession } from "@/lib/cloud";
import { playSfx } from "@/lib/sfx";

interface Pending {
  token: string;
  code: string;
  link: string;
  expiresAt: number;
}
type Phase = { id: "idle" } | { id: "starting" } | { id: "waiting"; p: Pending } | { id: "done" };

const PLANE = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden>
    <path d="M21.9 4.3 18.7 19.6c-.2 1-.9 1.3-1.7.8l-4.7-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.9 8.9-8c.4-.3-.1-.5-.6-.2L6.6 13.4 1.9 12c-1-.3-1-1 .2-1.5L20.4 3.4c.9-.3 1.600.2 1.500.9z" />
  </svg>
);

/** Вход через Telegram-бота: кнопка → код → подтверждение в боте → мы внутри */
export function TelegramBotLogin({ onDone, onError }: { onDone: () => void; onError: (message: string | null) => void }) {
  const [phase, setPhase] = useState<Phase>({ id: "idle" });
  const [left, setLeft] = useState(0);
  const alive = useRef(true);
  // Колбэки держим в ref: родитель может пересоздавать их на каждый рендер, а опрос от этого перезапускаться не должен
  const cbs = useRef({ onDone, onError });
  useEffect(() => {
    cbs.current = { onDone, onError };
  });

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const start = async () => {
    onError(null);
    setPhase({ id: "starting" });
    try {
      const res = await fetch("/api/tglogin/start", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setPhase({ id: "idle" });
        onError(data.error || "Не удалось начать вход через Telegram");
        playSfx("err");
        return;
      }
      setPhase({ id: "waiting", p: { token: data.token, code: data.code, link: data.link, expiresAt: data.expiresAt } });
    } catch {
      setPhase({ id: "idle" });
      onError("Не удалось связаться с сервером");
    }
  };

  // Ждём подтверждения: опрос каждые 2,5 с и обратный отсчёт
  const token = phase.id === "waiting" ? phase.p.token : null;
  const expiresAt = phase.id === "waiting" ? phase.p.expiresAt : 0;
  useEffect(() => {
    if (!token) return;
    let stop = false;
    const tick = window.setInterval(() => setLeft(Math.max(0, Math.round((expiresAt - Date.now()) / 1000))), 500);
    const poll = async () => {
      if (stop) return;
      try {
        const res = await fetch(`/api/tglogin/status?token=${encodeURIComponent(token)}`, { cache: "no-store" });
        const data = await res.json();
        if (stop || !alive.current) return;
        if (data.status === "ok") {
          const result = loginTelegramVerified({ nickname: data.nickname, telegram: data.telegram });
          if (!result.ok) {
            cbs.current.onError(result.error);
            setPhase({ id: "idle" });
            return;
          }
          await adoptTelegramSession(data.account);
          playSfx("ok");
          setPhase({ id: "done" });
          cbs.current.onDone();
          return;
        }
        if (data.status === "cancelled") {
          cbs.current.onError("Вход отменён в Telegram");
          setPhase({ id: "idle" });
          return;
        }
        if (data.status === "expired" || data.status === "unknown") {
          cbs.current.onError("Время на вход вышло. Попробуйте ещё раз");
          setPhase({ id: "idle" });
          return;
        }
        if (data.status === "banned") {
          cbs.current.onError("Аккаунт заблокирован");
          setPhase({ id: "idle" });
          return;
        }
      } catch {
        /* временная ошибка сети — пробуем снова */
      }
      window.setTimeout(poll, 2500);
    };
    const first = window.setTimeout(poll, 2000);
    return () => {
      stop = true;
      window.clearInterval(tick);
      window.clearTimeout(first);
    };
  }, [token, expiresAt]);

  if (phase.id === "waiting") {
    const { p } = phase;
    const mm = Math.floor(left / 60);
    const ss = String(left % 60).padStart(2, "0");
    return (
      <div className="tgb-wait" role="status" aria-live="polite">
        <p className="tgb-hint">Откройте бота и подтвердите вход. Код в боте должен совпасть с этим:</p>
        <div className="tgb-code" aria-label={`Код ${p.code}`}>
          {p.code.split("").map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <a href={p.link} target="_blank" rel="noopener noreferrer" className="tgb-btn">
          {PLANE}
          Открыть Telegram
        </a>
        <div className="tgb-foot">
          <span className="tgb-dots" aria-hidden><i /><i /><i /></span>
          <span>Ждём подтверждения · {mm}:{ss}</span>
          <button type="button" onClick={() => setPhase({ id: "idle" })}>Отмена</button>
        </div>
      </div>
    );
  }

  return (
    <button type="button" className="tgb-btn" onClick={() => void start()} disabled={phase.id !== "idle"}>
      {PLANE}
      {phase.id === "starting" ? "Готовим вход…" : "Войти через Telegram"}
    </button>
  );
}
