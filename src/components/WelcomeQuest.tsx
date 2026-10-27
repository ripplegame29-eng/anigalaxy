"use client";

/**
 * Приветственный квест: три дня, три награды, на третий день — рамка.
 * Показывается новичкам, пока есть что забрать. Сервер сам решает, какой
 * день открыт, поэтому ничего не накрутить сменой даты в браузере.
 */

import { useCallback, useEffect, useState } from "react";
import { pushToast } from "@/lib/toasts";
import { useAccount } from "@/lib/use-account";
import { WELCOME_DAYS, welcomeRewardText } from "@/lib/welcome-rules";
import "./welcome-quest.css";

interface State {
  active: boolean;
  days: { day: number; status: "claimed" | "ready" | "locked" }[];
  nextInMs: number;
}

function untilText(ms: number): string {
  const h = Math.max(1, Math.ceil(ms / 3_600_000));
  return h >= 24 ? "завтра" : `через ${h} ч`;
}

export function WelcomeQuest() {
  const account = useAccount();
  const [state, setState] = useState<State | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!account) return;
    let alive = true;
    fetch("/api/welcome", { credentials: "same-origin", cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<State>) : null))
      .then((d) => alive && d && setState(d))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [account]);

  const claim = useCallback(async (day: number) => {
    setBusy(true);
    try {
      const response = await fetch("/api/welcome", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day }),
      });
      const data = (await response.json()) as { ok?: boolean; state?: State; error?: string };
      if (data.ok && data.state) {
        setState(data.state);
        const rule = WELCOME_DAYS.find((d) => d.day === day);
        pushToast({ kind: "ac", title: `Квест, день ${day}`, text: rule ? welcomeRewardText(rule) : "Награда получена" });
      } else {
        pushToast({ kind: "quest", title: "Не получилось", text: data.error ?? "Попробуйте позже" });
      }
    } catch {
      pushToast({ kind: "quest", title: "Нет связи с сервером", text: "Попробуйте позже" });
    } finally {
      setBusy(false);
    }
  }, []);

  if (!account || !state?.active) return null;
  const done = state.days.filter((d) => d.status === "claimed").length;
  const ready = state.days.some((d) => d.status === "ready");

  return (
    <div className="wq">
      {open && (
        <section className="wq-panel" aria-label="Приветственный квест">
          <header>
            <b>Приветственный квест</b>
            <button type="button" aria-label="Свернуть" onClick={() => setOpen(false)}>×</button>
          </header>
          <p>Заходи три дня подряд и забирай награды. На третий день — рамка для аватара.</p>
          <ol>
            {WELCOME_DAYS.map((rule) => {
              const st = state.days.find((d) => d.day === rule.day)?.status ?? "locked";
              return (
                <li key={rule.day} className={`wq-${st}`}>
                  <span className="wq-n">{st === "claimed" ? "✓" : rule.day}</span>
                  <div>
                    <b>{rule.title}</b>
                    <small>{welcomeRewardText(rule)}</small>
                  </div>
                  {st === "ready" && (
                    <button type="button" disabled={busy} onClick={() => void claim(rule.day)}>
                      Забрать
                    </button>
                  )}
                  {st === "locked" && <em>{untilText(state.nextInMs + (rule.day - 2) * 86_400_000)}</em>}
                </li>
              );
            })}
          </ol>
        </section>
      )}
      <button type="button" className={`wq-chip${ready ? " is-ready" : ""}`} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="wq-ring" style={{ ["--p" as string]: `${(done / 3) * 100}%` }}>{done}/3</span>
        <span>{ready ? "Награда ждёт" : "Квест новичка"}</span>
      </button>
    </div>
  );
}
