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
      className="ag-btn sm"
      style={
        tone === "danger"
          ? { borderColor: "var(--ag-red)", color: "var(--ag-red)" }
          : tone === "accept"
            ? { borderColor: "var(--ag-grn)", color: "var(--ag-grn)" }
            : undefined
      }
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
    <form action={formAction} className="ag-section" style={{ width: "100%", maxWidth: 300, gap: 10 }}>
      <input type="hidden" name="id" value={reportId} />

      <input
        name="note"
        placeholder="Комментарий модератора"
        aria-label="Комментарий модератора"
        maxLength={500}
        className="ag-input"
      />

      <div className="ag-act">
        <Button outcome="resolved" tone="accept">
          Обоснованна
        </Button>
        <Button outcome="rejected" tone="danger">
          Отклонить
        </Button>
      </div>

      {state.error ? <p className="ag-bad">{state.error}</p> : null}
      {state.ok ? <p className="ag-ok">{state.ok}</p> : null}
    </form>
  );
}