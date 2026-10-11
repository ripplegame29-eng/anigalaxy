"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  runHealthCheckAction,
  setFlagDescriptionAction,
  toggleFlagAction,
  updateSettingAction,
  type SettingsState,
} from "./actions";

const IDLE: SettingsState = { error: null, ok: null };

function Submit({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "danger" }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
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

/** Форма + строка обратной связи. По одному экшену на форму. */
function Feedback({ state }: { state: SettingsState }) {
  if (state.error) return <p className="mt-1 text-[11px] text-red-300">{state.error}</p>;
  if (state.ok) return <p className="mt-1 text-[11px] text-emerald-300">{state.ok}</p>;
  return null;
}

/* ------------------------------- Флаги -------------------------------- */

export function FlagToggle({
  flagKey,
  enabled,
}: {
  flagKey: string;
  enabled: boolean;
}) {
  const [state, formAction] = useActionState<SettingsState, FormData>(
    toggleFlagAction,
    IDLE,
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="key" value={flagKey} />
      <button
        type="submit"
        title={enabled ? "Выключить" : "Включить"}
        className={[
          "relative h-6 w-11 rounded-full transition",
          enabled ? "bg-emerald-500/70" : "bg-white/15",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
            enabled ? "left-[22px]" : "left-0.5",
          ].join(" ")}
        />
        <span className="sr-only">
          {enabled ? "Выключить" : "Включить"} флаг {flagKey}
        </span>
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function FlagDescriptionEditor({
  flagKey,
  description,
}: {
  flagKey: string;
  description: string;
}) {
  const [state, formAction] = useActionState<SettingsState, FormData>(
    setFlagDescriptionAction,
    IDLE,
  );

  return (
    <form action={formAction} className="flex gap-2">
      <input type="hidden" name="key" value={flagKey} />
      <input
        name="description"
        defaultValue={description}
        placeholder="Что делает флаг"
        maxLength={200}
        className="flex-1 rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-xs outline-none focus:border-[#1f7bff]"
      />
      <Submit>Сохранить</Submit>
      <Feedback state={state} />
    </form>
  );
}

/* ----------------------------- Настройки ------------------------------- */

export function SettingEditor({
  settingKey,
  value,
  description,
}: {
  settingKey: string;
  value: string;
  description: string | null;
}) {
  const [state, formAction] = useActionState<SettingsState, FormData>(
    updateSettingAction,
    IDLE,
  );

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <p className="font-mono text-xs text-white/80">{settingKey}</p>
      {description ? (
        <p className="mt-0.5 text-xs text-white/40">{description}</p>
      ) : null}

      <form action={formAction} className="mt-2 flex gap-2">
        <input type="hidden" name="key" value={settingKey} />
        <input
          name="value"
          defaultValue={value}
          maxLength={5000}
          className="flex-1 rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-sm outline-none focus:border-[#1f7bff]"
        />
        <Submit>Сохранить</Submit>
      </form>
      <Feedback state={state} />
    </div>
  );
}

/* --------------------------- Здоровье API ----------------------------- */

export function HealthCheckButton() {
  const [state, formAction] = useActionState<SettingsState, FormData>(
    runHealthCheckAction,
    IDLE,
  );

  return (
    <form action={formAction}>
      <Submit>Проверить сейчас</Submit>
      <Feedback state={state} />
    </form>
  );
}