"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { resolveReportAction, type ModerationState } from "./actions";

const IDLE: ModerationState = { error: null, ok: null };

function Button({
  children,
  tone = "neutral",
  outcome,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "danger" | "accept";
  /** Значение кнопки-отправителя: отправляется вместе с формой */
  outcome?: "resolved" | "rejected";
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="outcome"
      value={outcome}
      disabled={pending}
      className={[
        "rounded-lg border px-2.5 py-1 text-xs transition disabled:cursor-not-allowed disabled:opacity-40",
        tone === "danger"
          ? "border-red-500/30 text-red-300 hover:border-red-500/60"
          : tone === "accept"
            ? "border-emerald-500/30 text-emerald-300 hover:border-emerald-500/60"
            : "border-white/15 text-white/70 hover:border-white/35 hover:text-white",
      ].join(" ")}
    >
      {pending ? "…" : children}
    </button>
  );
}

/**
 * Форма разбора жалобы.
 *
 * Решение фиксируется явно («обоснованна» / «отклонена»), а не просто
 * закрытием: иначе через месяц нельзя понять, сколько жалоб отклоняли
 * на пустом месте.
 */
export function ReportResolver({ reportId }: { reportId: string }) {
  const [state, formAction] = useActionState<ModerationState, FormData>(
    resolveReportAction,
    IDLE,
  );

  return (
    <form action={formAction} className="w-full max-w-xs space-y-2">
      <input type="hidden" name="id" value={reportId} />

      <input
        name="note"
        placeholder="Комментарий модератора"
        maxLength={500}
        className="w-full rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs outline-none focus:border-[#1f7bff]"
      />

      <div className="flex gap-2">
        <Button outcome="resolved" tone="accept">
          Обоснованна
        </Button>
        <Button outcome="rejected" tone="danger">
          Отклонить
        </Button>
      </div>

      {state.error ? <p className="text-[11px] text-red-300">{state.error}</p> : null}
      {state.ok ? <p className="text-[11px] text-emerald-300">{state.ok}</p> : null}
    </form>
  );
}