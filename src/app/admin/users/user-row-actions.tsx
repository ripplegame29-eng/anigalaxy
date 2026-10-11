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
      className={[
        "rounded-lg border px-2.5 py-1 text-xs transition disabled:cursor-not-allowed disabled:opacity-40",
        tone === "danger"
          ? "border-red-500/30 text-red-300 hover:border-red-500/60"
          : "border-white/15 text-white/70 hover:border-white/35 hover:text-white",
      ].join(" ")}
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
      {state.error ? (
        <p className="mt-1 text-[11px] text-red-300">{state.error}</p>
      ) : null}
      {state.ok ? (
        <p className="mt-1 text-[11px] text-emerald-300">{state.ok}</p>
      ) : null}
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
    <div className="w-full max-w-sm space-y-2 sm:w-auto">
      <div className="flex flex-wrap justify-end gap-2">
        {isBanned ? (
          <Action action={unbanUserAction}>
            <input type="hidden" name="id" value={userId} />
            <Button>Разбанить</Button>
          </Action>
        ) : (
          <Action action={banUserAction}>
            <input type="hidden" name="id" value={userId} />
            <Button tone="danger">Забанить</Button>
          </Action>
        )}

        <Action action={killSessionsAction}>
          <input type="hidden" name="id" value={userId} />
          <Button disabled={isSelf}>Закрыть сессии</Button>
        </Action>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border border-white/15 px-2.5 py-1 text-xs text-white/70 transition hover:border-white/35"
        >
          {open ? "Скрыть" : "Ещё"}
        </button>
      </div>

      {open ? (
        <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
          <Action action={setRoleAction}>
            <input type="hidden" name="id" value={userId} />
            <p className="mb-1 text-[11px] text-white/40">Роль</p>
            <div className="flex gap-2">
              <select
                name="role"
                defaultValue={isRole(currentRole) ? currentRole : "user"}
                className="flex-1 rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-xs"
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
              <Button disabled={isSelf}>Сменить</Button>
            </div>
            {isSelf ? (
              <p className="mt-1 text-[11px] text-white/30">
                Снять роль с себя нельзя — иначе можно потерять доступ к панели.
              </p>
            ) : null}
          </Action>

          <Action action={grantPremiumAction}>
            <input type="hidden" name="id" value={userId} />
            <p className="mb-1 text-[11px] text-white/40">Premium</p>
            <div className="flex gap-2">
              <select
                name="days"
                defaultValue="30"
                className="flex-1 rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-xs"
              >
                <option value="7">+7 дней</option>
                <option value="30">+30 дней</option>
                <option value="90">+90 дней</option>
                <option value="365">+1 год</option>
              </select>
              <Button>Выдать</Button>
            </div>
          </Action>

          <Action action={banUserAction}>
            <input type="hidden" name="id" value={userId} />
            <p className="mb-1 text-[11px] text-white/40">Бан на срок</p>
            <div className="flex gap-2">
              <select
                name="days"
                defaultValue="7"
                className="flex-1 rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-xs"
              >
                <option value="1">1 день</option>
                <option value="7">7 дней</option>
                <option value="30">30 дней</option>
                <option value="">навсегда</option>
              </select>
              <input
                name="reason"
                placeholder="причина"
                className="w-28 rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-xs"
              />
              <Button tone="danger">Применить</Button>
            </div>
          </Action>
        </div>
      ) : null}
    </div>
  );
}