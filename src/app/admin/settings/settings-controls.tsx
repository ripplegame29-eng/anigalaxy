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
      className={`ag-btn sm${tone === "danger" ? " danger" : ""}`}
    >
      {pending ? "…" : children}
    </button>
  );
}

/** Форма + строка обратной связи. По одному экшену на форму. */
function Feedback({ state }: { state: SettingsState }) {
  if (state.error) return <p className="ag-bad">{state.error}</p>;
  if (state.ok) return <p className="ag-ok">{state.ok}</p>;
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
    <form action={formAction} style={{ flex: "none" }}>
      <input type="hidden" name="key" value={flagKey} />
      <button
        type="submit"
        title={enabled ? "Выключить" : "Включить"}
        aria-pressed={enabled}
        style={{
          position: "relative",
          width: 44,
          height: 26,
          borderRadius: 999,
          border: "1px solid var(--ag-line)",
          background: enabled ? "var(--ag-grn)" : "var(--ag-chipbg)",
          transition: "background .2s, border-color .2s",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: enabled ? 22 : 3,
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: enabled ? "var(--ag-card)" : "var(--ag-mut)",
            transition: "left .2s var(--ag-ease), background .2s",
          }}
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
    <>
      <form action={formAction} style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input type="hidden" name="key" value={flagKey} />
        <input
          name="description"
          defaultValue={description}
          placeholder="Что делает флаг"
          aria-label={`Описание флага ${flagKey}`}
          maxLength={200}
          className="ag-input"
          style={{ minHeight: 36 }}
        />
        <Submit>Сохранить</Submit>
      </form>
      <Feedback state={state} />
    </>
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
    <div className="ag-box pad">
      <p>
        <span className="ag-code" style={{ fontSize: 13 }}>{settingKey}</span>
      </p>
      {description ? (
        <p className="ag-note" style={{ marginTop: 4 }}>
          {description}
        </p>
      ) : null}

      <form action={formAction} style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <input type="hidden" name="key" value={settingKey} />
        <input
          name="value"
          defaultValue={value}
          aria-label={`Значение настройки ${settingKey}`}
          maxLength={5000}
          className="ag-input"
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
    <form action={formAction} style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <Submit>Проверить сейчас</Submit>
      <Feedback state={state} />
    </form>
  );
}