"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { CONTENT_KINDS, type ContentKind } from "@/lib/admin/content-kinds";

import {
  createBlockAction,
  deleteBlockAction,
  toggleBlockAction,
  updateBlockAction,
  type ContentState,
} from "./actions";

const IDLE: ContentState = { error: null, ok: null };

function Submit({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "danger";
}) {
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

function Feedback({ state }: { state: ContentState }) {
  if (state.error) return <p className="mt-1 text-[11px] text-red-300">{state.error}</p>;
  if (state.ok) return <p className="mt-1 text-[11px] text-emerald-300">{state.ok}</p>;
  return null;
}

/* ------------------------------- Создание ------------------------------ */

export function CreateBlockForm() {
  const [state, formAction] = useActionState<ContentState, FormData>(
    createBlockAction,
    IDLE,
  );
  const [kind, setKind] = useState<ContentKind>("hero_slide");
  const spec = CONTENT_KINDS[kind];

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5"
    >
      <div>
        <h2 className="text-lg font-medium">Новый блок</h2>
        <p className="text-sm text-white/50">{spec.hint}</p>
      </div>

      <div className="flex gap-2">
        <select
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as ContentKind)}
          className="flex-1 rounded-lg border border-white/15 bg-black/40 px-2.5 py-2 text-sm"
        >
          {Object.entries(CONTENT_KINDS).map(([value, item]) => (
            <option key={value} value={value}>
              {item.label}
            </option>
          ))}
        </select>
        <input
          name="title"
          placeholder="Название (для списка в панели)"
          maxLength={200}
          className="flex-1 rounded-lg border border-white/15 bg-black/40 px-2.5 py-2 text-sm outline-none focus:border-[#1f7bff]"
        />
      </div>

      <PayloadEditor kind={kind} name="payload" defaultValue={JSON.stringify(spec.example, null, 2)} />

      <Submit>Создать</Submit>
      <Feedback state={state} />
    </form>
  );
}

/**
 * Редактор payload.
 *
 * JSON, а не отдельные поля: структура у блоков разная, а разводить их на
 * три формы с разными наборами полей — значит поддерживать вчетверо больше
 * разметки. Валидация формы всё равно происходит на сервере (FIELD_LABELS в
 * actions.ts), поэтому опечатка в JSON не уронит сайт, а вернёт ошибкой.
 */
function PayloadEditor({
  kind,
  name,
  defaultValue,
}: {
  kind: ContentKind;
  name: string;
  defaultValue?: string;
}) {
  const [value, setValue] = useState(defaultValue ?? "");

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-white/50">
        Поля для «{CONTENT_KINDS[kind].label}»:{" "}
        {CONTENT_KINDS[kind].fields
          .map((f) => `${f.name}${f.required ? " *" : ""}`)
          .join(", ")}
      </p>
      <textarea
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={7}
        spellCheck={false}
        className="w-full resize-y rounded-lg border border-white/15 bg-black/40 px-2.5 py-2 font-mono text-xs outline-none focus:border-[#1f7bff]"
      />
    </div>
  );
}

/* ------------------------------ Список блоков --------------------------- */

export function BlockRow({
  id,
  kind,
  title,
  payload,
  sortOrder,
  enabled,
}: {
  id: string;
  kind: ContentKind;
  title: string | null;
  payload: string;
  sortOrder: number;
  enabled: boolean;
}) {
  const [toggleState, toggleAction] = useActionState<ContentState, FormData>(
    toggleBlockAction,
    IDLE,
  );
  const [deleteState, deleteAction] = useActionState<ContentState, FormData>(
    deleteBlockAction,
    IDLE,
  );
  const [updateState, updateAction] = useActionState<ContentState, FormData>(
    updateBlockAction,
    IDLE,
  );
  const [open, setOpen] = useState(false);

  return (
    <li className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{title ?? "без названия"}</span>
            <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60">
              {CONTENT_KINDS[kind]?.label ?? kind}
            </span>
            {enabled ? (
              <span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-300">
                на сайте
              </span>
            ) : (
              <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] text-white/50">
                выключен
              </span>
            )}
            <span className="text-[10px] text-white/35">порядок {sortOrder}</span>
          </p>
        </div>

        <div className="flex gap-2">
          <form action={toggleAction}>
            <input type="hidden" name="id" value={id} />
            <Submit tone={enabled ? "danger" : "neutral"}>
              {enabled ? "Снять с сайта" : "Опубликовать"}
            </Submit>
          </form>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg border border-white/15 px-2.5 py-1 text-xs text-white/70 transition hover:border-white/35"
          >
            {open ? "Скрыть" : "Править"}
          </button>
          <form action={deleteAction}>
            <input type="hidden" name="id" value={id} />
            <Submit tone="danger">Удалить</Submit>
          </form>
        </div>
      </div>

      <Feedback state={toggleState} />
      <Feedback state={deleteState} />

      {open ? (
        <form action={updateAction} className="mt-3 space-y-2 border-t border-white/10 pt-3">
          <input type="hidden" name="id" value={id} />

          <div className="flex gap-2">
            <input
              name="title"
              defaultValue={title ?? ""}
              placeholder="Название"
              maxLength={200}
              className="flex-1 rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-sm outline-none focus:border-[#1f7bff]"
            />
            <input
              name="sortOrder"
              type="number"
              defaultValue={sortOrder}
              className="w-24 rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-sm outline-none focus:border-[#1f7bff]"
            />
          </div>

          <textarea
            name="payload"
            defaultValue={payload}
            rows={8}
            spellCheck={false}
            className="w-full resize-y rounded-lg border border-white/15 bg-black/40 px-2.5 py-2 font-mono text-xs outline-none focus:border-[#1f7bff]"
          />

          <Submit>Сохранить</Submit>
          <Feedback state={updateState} />
        </form>
      ) : null}
    </li>
  );
}