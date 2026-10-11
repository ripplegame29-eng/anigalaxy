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

function Feedback({ state }: { state: PromoState }) {
  if (state.error) return <p className="mt-1 text-[11px] text-red-300">{state.error}</p>;
  if (state.ok) return <p className="mt-1 text-[11px] text-emerald-300">{state.ok}</p>;
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
    <form
      action={formAction}
      className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5"
    >
      <div className="flex flex-wrap gap-2">
        <input
          name="code"
          placeholder="КОД"
          required
          maxLength={24}
          className="w-40 rounded-lg border border-white/15 bg-black/40 px-3 py-2 font-mono text-sm uppercase outline-none focus:border-[#1f7bff]"
        />
        <select
          name="kind"
          className="flex-1 rounded-lg border border-white/15 bg-black/40 px-2.5 py-2 text-sm"
        >
          <option value="premium_days">Дней Premium</option>
          <option value="balance_ac">AC (атомов)</option>
        </select>
        <input
          name="value"
          type="number"
          min={1}
          placeholder="Значение"
          required
          className="w-32 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#1f7bff]"
        />
        <input
          name="maxUses"
          type="number"
          min={1}
          placeholder="лимит (пусто = без него)"
          className="w-48 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#1f7bff]"
        />
      </div>

      <input
        name="description"
        placeholder="Описание для себя (необязательно)"
        maxLength={300}
        className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#1f7bff]"
      />

      <Submit>Создать промокод</Submit>
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
  const [toggleState, toggleAction] = useActionState<PromoState, FormData>(
    togglePromoAction,
    IDLE,
  );
  const [deleteState, deleteAction] = useActionState<PromoState, FormData>(
    deletePromoAction,
    IDLE,
  );

  return (
    <li className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold">{code}</span>
            <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60">
              {KIND_LABELS[kind] ?? kind}
            </span>
            <span className="text-sm text-white/70">
              {value.toLocaleString("ru-RU")}
            </span>
            {active ? (
              <span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-300">
                действует
              </span>
            ) : (
              <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] text-white/50">
                выключен
              </span>
            )}
          </p>
          <p className="mt-1 text-xs text-white/40">
            активаций: {usedCount}
            {maxUses ? ` из ${maxUses}` : " (без лимита)"}
            {description ? ` · ${description}` : ""}
          </p>
        </div>

        <div className="flex gap-2">
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
  const [state, formAction] = useActionState<PromoState, FormData>(
    createSeasonAction,
    IDLE,
  );

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5"
    >
      <div className="flex flex-wrap gap-2">
        <input
          name="slug"
          placeholder="идентификатор (s1)"
          required
          maxLength={16}
          className="w-44 rounded-lg border border-white/15 bg-black/40 px-3 py-2 font-mono text-sm outline-none focus:border-[#1f7bff]"
        />
        <input
          name="name"
          placeholder="Название"
          required
          maxLength={80}
          className="flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#1f7bff]"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <label className="flex-1 text-xs text-white/50">
          Начало
          <input
            name="startsAt"
            type="datetime-local"
            required
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex-1 text-xs text-white/50">
          Окончание
          <input
            name="endsAt"
            type="datetime-local"
            required
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <Submit>Создать сезон</Submit>
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
  const [state, formAction] = useActionState<PromoState, FormData>(
    setSeasonStatusAction,
    IDLE,
  );

  const next = status === "active" ? "finished" : "active";

  return (
    <li className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{name}</span>
            <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white/60">
              {slug}
            </code>
            <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60">
              {STATUS_LABELS[status] ?? status}
            </span>
          </p>
          <p className="mt-1 text-xs text-white/40">
            {new Date(startsAt).toLocaleDateString("ru-RU")} —{" "}
            {new Date(endsAt).toLocaleDateString("ru-RU")}
          </p>
        </div>

        <form action={formAction}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="status" value={next} />
          <Submit>{next === "active" ? "Завершить" : "Активировать"}</Submit>
        </form>
      </div>

      <Feedback state={state} />
    </li>
  );
}