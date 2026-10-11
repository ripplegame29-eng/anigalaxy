"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { isRole, ROLE_LABELS, ROLES } from "@/lib/roles";

import {
  banUserAction,
  grantPremiumAction,
  killSessionsAction,
  setRoleAction,
  unbanUserAction,
  type ActionState,
} from "./actions";

const IDLE: ActionState = { error: null, ok: null };

function Button({
  children,
  disabled,
  tone = "neutral",
}: {
  children: React.ReactNode;
  disabled?: boolean;
  tone?: "neutral" | "danger";
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={`ag-btn sm${tone === "danger" ? " danger" : ""}`}
    >
      {pending ? "…" : children}
    </button>
  );
}

/** Обёртка: один экшен — один useActionState, свой feedback-блок. */
function Action({
  action,
  children,
  successKey,
}: {
  action: (prev: ActionState, data: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  successKey?: (s: ActionState) => void;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    async (prev, data) => {
      const next = await action(prev, data);
      if (next.ok) successKey?.(next);
      return next;
    },
    IDLE,
  );

  return (
    <>
      <form action={formAction}>{children}</form>
      {state.error ? <p className="ag-bad">{state.error}</p> : null}
      {state.ok ? <p className="ag-ok">{state.ok}</p> : null}
    </>
  );
}

export function UserRowActions({
  userId,
  isBanned,
  currentRole,
  isSelf,
}: {
  userId: string;
  isBanned: boolean;
  currentRole: string;
  isSelf: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ width: "100%", maxWidth: 380 }}>
      <div className="ag-act" style={{ justifyContent: "flex-end" }}>
        {isBanned ? (
          <Action action={unbanUserAction}>
            <input type="hidden" name="id" value={userId} />
            <Button>Разбанить</Button>
          </Action>
        ) : (
          <Action action={banUserAction}>
            <input type="hidden" name="id" value={userId} />
            {/* Бан гасит и собственную сессию — у своей строки кнопка
                заблокирована, а не просто спрятана. */}
            <Button tone="danger" disabled={isSelf}>
              {isSelf ? "Нельзя забанить себя" : "Забанить"}
            </Button>
          </Action>
        )}

        <Action action={killSessionsAction}>
          <input type="hidden" name="id" value={userId} />
          <Button disabled={isSelf}>Закрыть сессии</Button>
        </Action>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ag-btn sm"
          aria-expanded={open}
        >
          {open ? "Скрыть" : "Ещё"}
        </button>
      </div>

      {open ? (
        <div
          className="ag-section"
          style={{
            marginTop: 12,
            gap: 16,
            padding: 16,
            border: "1px solid var(--ag-line)",
            borderRadius: 12,
          }}
        >
          <Action action={setRoleAction}>
            <input type="hidden" name="id" value={userId} />
            <label className="ag-field">
              <span>Роль</span>
              <div style={{ display: "flex", gap: 8 }}>
                <select
                  name="role"
                  defaultValue={isRole(currentRole) ? currentRole : "user"}
                  className="ag-select"
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
                <Button disabled={isSelf}>Сменить</Button>
              </div>
            </label>
            {isSelf ? (
              <p className="ag-note">
                Снять роль с себя нельзя — иначе можно потерять доступ к панели.
              </p>
            ) : null}
          </Action>

          <Action action={grantPremiumAction}>
            <input type="hidden" name="id" value={userId} />
            <label className="ag-field">
              <span>Premium</span>
              <div style={{ display: "flex", gap: 8 }}>
                <select name="days" defaultValue="30" className="ag-select">
                  <option value="7">+7 дней</option>
                  <option value="30">+30 дней</option>
                  <option value="90">+90 дней</option>
                  <option value="365">+1 год</option>
                </select>
                <Button>Выдать</Button>
              </div>
            </label>
          </Action>

          {isSelf ? null : (
            <Action action={banUserAction}>
              <input type="hidden" name="id" value={userId} />
              <label className="ag-field">
                <span>Бан на срок</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <select name="days" defaultValue="7" className="ag-select">
                    <option value="1">1 день</option>
                    <option value="7">7 дней</option>
                    <option value="30">30 дней</option>
                    <option value="">навсегда</option>
                  </select>
                  <input
                    name="reason"
                    placeholder="причина"
                    aria-label="Причина бана"
                    className="ag-input"
                    style={{ maxWidth: 180 }}
                  />
                  <Button tone="danger">Применить</Button>
                </div>
              </label>
            </Action>
          )}
        </div>
      ) : null}
    </div>
  );
}