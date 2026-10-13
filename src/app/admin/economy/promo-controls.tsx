"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  createPromoAction,
  createSeasonAction,
  deletePromoAction,
  setSeasonStatusAction,
  togglePromoAction,
  type PromoState,
} from "./promo-actions";

const IDLE: PromoState = { error: null, ok: null };

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

function Feedback({ state }: { state: PromoState }) {
  if (state.error) return <p className="ag-bad">{state.error}</p>;
  if (state.ok) return <p className="ag-ok">{state.ok}</p>;
  return null;
}

const KIND_LABELS: Record<string, string> = {
  premium_days: "Дней Premium",
  balance_ac: "AC (атомов)",
};

/* ------------------------------ Промокоды ------------------------------ */

export function CreatePromoForm() {
  const [state, formAction] = useActionState<PromoState, FormData>(createPromoAction, IDLE);

  return (
    <form action={formAction} className="ag-box pad ag-section" style={{ gap: 12 }}>
      <div className="ag-form">
        <label className="ag-field" style={{ flex: "0 0 180px" }}>
          <span>Код</span>
          <input
            name="code"
            placeholder="КОД"
            required
            maxLength={24}
            className="ag-input"
            style={{ fontFamily: "ui-monospace, Menlo, monospace", textTransform: "uppercase" }}
          />
        </label>

        <label className="ag-field" style={{ flex: "1 1 200px" }}>
          <span>Что выдаёт</span>
          <select name="kind" className="ag-select">
            <option value="premium_days">Дней Premium</option>
            <option value="balance_ac">AC (атомов)</option>
          </select>
        </label>

        <label className="ag-field" style={{ flex: "0 0 150px" }}>
          <span>Значение</span>
          <input
            name="value"
            type="number"
            min={1}
            placeholder="30"
            required
            className="ag-input"
          />
        </label>

        <label className="ag-field" style={{ flex: "0 0 190px" }}>
          <span>Лимит активаций</span>
          <input name="maxUses" type="number" min={1} placeholder="без лимита" className="ag-input" />
        </label>
      </div>

      <label className="ag-field">
        <span>Описание для себя (необязательно)</span>
        <input
          name="description"
          placeholder="Например: раздача на стрим 12.10"
          maxLength={300}
          className="ag-input"
        />
      </label>

      <div>
        <Submit>Создать промокод</Submit>
      </div>
      <Feedback state={state} />
    </form>
  );
}

export function PromoRow({
  id,
  code,
  kind,
  value,
  active,
  usedCount,
  maxUses,
  description,
}: {
  id: string;
  code: string;
  kind: string;
  value: number;
  active: boolean;
  usedCount: number;
  maxUses: number | null;
  description: string | null;
}) {
  const [toggleState, toggleAction] = useActionState<PromoState, FormData>(togglePromoAction, IDLE);
  const [deleteState, deleteAction] = useActionState<PromoState, FormData>(deletePromoAction, IDLE);

  // Запас исчерпан, но код ещё активен: игроки будут вводить его впустую.
  const spent = maxUses !== null && usedCount >= maxUses;

  return (
    <li className="ag-box pad ag-section" style={{ gap: 8 }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <span className="ag-code" style={{ fontSize: 14, fontWeight: 700 }}>{code}</span>
            <span className="ag-n">{KIND_LABELS[kind] ?? kind}</span>
            <span>{value.toLocaleString("ru-RU")}</span>
            {spent ? (
              <span className="ag-lvl">лимит исчерпан</span>
            ) : active ? (
              <span className="ag-lvl" style={{ background: "var(--ag-okbg)", color: "var(--ag-grn)" }}>
                действует
              </span>
            ) : (
              <span className="ag-n">выключен</span>
            )}
          </p>
          <p className="ag-note" style={{ marginTop: 4 }}>
            активаций: {usedCount}
            {maxUses ? ` из ${maxUses}` : " (без лимита)"}
            {description ? ` · ${description}` : ""}
          </p>
        </div>

        <div className="ag-act">
          <form action={toggleAction}>
            <input type="hidden" name="id" value={id} />
            <Submit>{active ? "Выключить" : "Включить"}</Submit>
          </form>
          <form action={deleteAction}>
            <input type="hidden" name="id" value={id} />
            <Submit tone="danger">Удалить</Submit>
          </form>
        </div>
      </div>

      <Feedback state={toggleState} />
      <Feedback state={deleteState} />
    </li>
  );
}

/* -------------------------------- Сезоны -------------------------------- */

export function CreateSeasonForm() {
  const [state, formAction] = useActionState<PromoState, FormData>(createSeasonAction, IDLE);

  return (
    <form action={formAction} className="ag-box pad ag-section" style={{ gap: 12 }}>
      <div className="ag-form">
        <label className="ag-field" style={{ flex: "0 0 180px" }}>
          <span>Идентификатор</span>
          <input
            name="slug"
            placeholder="s1"
            required
            maxLength={16}
            className="ag-input"
            style={{ fontFamily: "ui-monospace, Menlo, monospace" }}
          />
        </label>

        <label className="ag-field" style={{ flex: "1 1 240px" }}>
          <span>Название</span>
          <input name="name" placeholder="Первый сезон" required maxLength={80} className="ag-input" />
        </label>

        <label className="ag-field" style={{ flex: "1 1 200px" }}>
          <span>Начало</span>
          <input name="startsAt" type="datetime-local" required className="ag-input" />
        </label>

        <label className="ag-field" style={{ flex: "1 1 200px" }}>
          <span>Окончание</span>
          <input name="endsAt" type="datetime-local" required className="ag-input" />
        </label>
      </div>

      <div>
        <Submit>Создать сезон</Submit>
      </div>
      <Feedback state={state} />
    </form>
  );
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: "запланирован",
  active: "идёт",
  finished: "завершён",
};

export function SeasonRow({
  id,
  slug,
  name,
  status,
  startsAt,
  endsAt,
}: {
  id: string;
  slug: string;
  name: string;
  status: string;
  startsAt: number;
  endsAt: number;
}) {
  const [state, formAction] = useActionState<PromoState, FormData>(setSeasonStatusAction, IDLE);

  const next = status === "active" ? "finished" : "active";

  return (
    <li className="ag-box pad ag-section" style={{ gap: 8 }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <p style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <b>{name}</b>
            <span className="ag-code">{slug}</span>
            <span className="ag-n">{STATUS_LABELS[status] ?? status}</span>
          </p>
          <p className="ag-note" style={{ marginTop: 4 }}>
            {new Date(startsAt).toLocaleDateString("ru-RU")} —{" "}
            {new Date(endsAt).toLocaleDateString("ru-RU")}
          </p>
        </div>

        <div className="ag-act">
          <form action={formAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value={next} />
            <Submit>{next === "active" ? "Завершить" : "Активировать"}</Submit>
          </form>
        </div>
      </div>

      <Feedback state={state} />
    </li>
  );
}