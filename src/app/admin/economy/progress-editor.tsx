"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { adjustProgressAction, type EconomyState } from "./actions";

const IDLE: EconomyState = { error: null, ok: null };

/** Что и чем правим. Уровень не правим: он следствие XP (см. actions.ts). */
const FIELDS = [
  { key: "xpTotal", label: "XP" },
  { key: "acBalance", label: "AC" },
] as const;

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="ag-btn sm">
      {pending ? "…" : "Записать"}
    </button>
  );
}

/**
 * Ручная правка прогресса.
 *
 * Форма спрятана под кнопкой намеренно: это аварийный инструмент («выдать
 * компенсацию», «откатить накрутку»), а не способ заниматься балансом. Каждое
 * изменение уходит в аудит-лог со значениями до и после.
 */
export function ProgressEditor({
  userId,
  nickname,
  current,
}: {
  userId: string;
  nickname: string;
  current: { level: number; xpTotal: number; acBalance: number };
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<EconomyState, FormData>(
    adjustProgressAction,
    IDLE,
  );

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="ag-btn sm">
        Поправить
      </button>
    );
  }

  return (
    <div className="ag-section" style={{ width: "100%", maxWidth: 360, gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="ag-note">
          {nickname} · сейчас ур. {current.level}, XP {current.xpTotal}, AC{" "}
          {current.acBalance}
        </span>
        <button type="button" className="ag-btn sm" onClick={() => setOpen(false)}>
          Закрыть
        </button>
      </div>

      {FIELDS.map((field) => (
        <form key={field.key} action={formAction} style={{ display: "flex", gap: 8 }}>
          <input type="hidden" name="id" value={userId} />
          <input type="hidden" name="field" value={field.key} />
          <input
            name="value"
            type="number"
            min={0}
            max={1_000_000}
            defaultValue={current[field.key]}
            aria-label={`Новое значение ${field.label}`}
            className="ag-input"
            style={{ width: 130 }}
          />
          <span style={{ alignSelf: "center", color: "var(--ag-mut)", fontSize: 13 }}>
            {field.label}
          </span>
          <Submit />
        </form>
      ))}

      {state.error ? <p className="ag-bad">{state.error}</p> : null}
      {state.ok ? <p className="ag-ok">{state.ok}</p> : null}
    </div>
  );
}