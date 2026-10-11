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
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg border border-white/15 px-2.5 py-1 text-xs text-white/70 transition hover:border-white/35 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
    >
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-white/15 px-2.5 py-1 text-xs text-white/70 transition hover:border-white/35"
      >
        Поправить
      </button>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/40">
          {nickname} · сейчас ур. {current.level}, XP {current.xpTotal}, AC{" "}
          {current.acBalance}
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-white/40 hover:text-white/70"
        >
          Закрыть
        </button>
      </div>

      {FIELDS.map((field) => (
        <form key={field.key} action={formAction} className="flex gap-2">
          <input type="hidden" name="id" value={userId} />
          <input type="hidden" name="field" value={field.key} />
          <input
            name="value"
            type="number"
            min={0}
            max={1_000_000}
            defaultValue={current[field.key]}
            className="w-32 rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-xs outline-none focus:border-[#1f7bff]"
          />
          <span className="self-center text-xs text-white/40">{field.label}</span>
          <Submit />
        </form>
      ))}

      {state.error ? <p className="text-[11px] text-red-300">{state.error}</p> : null}
      {state.ok ? <p className="text-[11px] text-emerald-300">{state.ok}</p> : null}
    </div>
  );
}