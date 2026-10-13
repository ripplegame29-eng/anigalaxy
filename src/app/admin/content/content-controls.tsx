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
      className={`ag-btn sm${tone === "danger" ? " danger" : ""}`}
    >
      {pending ? "…" : children}
    </button>
  );
}

function Feedback({ state }: { state: ContentState }) {
  if (state.error) return <p className="ag-bad">{state.error}</p>;
  if (state.ok) return <p className="ag-ok">{state.ok}</p>;
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
    <form action={formAction} className="ag-box pad ag-section" style={{ gap: 16 }}>
      <div>
        <h2 className="ag-h2">Новый блок</h2>
        <p className="ag-sub">{spec.hint}</p>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <select
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as ContentKind)}
          className="ag-select"
          style={{ flex: 1 }}
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
          aria-label="Название блока"
          maxLength={200}
          className="ag-input"
          style={{ flex: 1 }}
        />
      </div>

      <PayloadEditor kind={kind} name="payload" defaultValue={JSON.stringify(spec.example, null, 2)} />

      <div>
        <Submit>Создать</Submit>
      </div>
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
    <label className="ag-field">
      <span>
        Поля для «{CONTENT_KINDS[kind].label}»:{" "}
        {CONTENT_KINDS[kind].fields
          .map((f) => `${f.name}${f.required ? " *" : ""}`)
          .join(", ")}
      </span>
      <textarea
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={7}
        spellCheck={false}
        aria-label="Содержимое блока в формате JSON"
        style={{
          width: "100%",
          padding: "10px 12px",
          border: "1px solid var(--ag-line)",
          borderRadius: 10,
          background: "var(--ag-bg)",
          fontFamily: "ui-monospace, Menlo, monospace",
          fontSize: 12,
          lineHeight: 1.5,
        }}
      />
    </label>
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
    <li className="ag-box pad ag-section" style={{ gap: 12 }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <p style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <b>{title ?? "без названия"}</b>
          <span className="ag-n">{CONTENT_KINDS[kind]?.label ?? kind}</span>
          {enabled ? (
            <span className="ag-lvl" style={{ background: "var(--ag-okbg)", color: "var(--ag-grn)" }}>
              на сайте
            </span>
          ) : (
            <span className="ag-n">выключен</span>
          )}
          <span className="ag-note">порядок {sortOrder}</span>
        </p>

        <div className="ag-act">
          <form action={toggleAction}>
            <input type="hidden" name="id" value={id} />
            <Submit tone={enabled ? "danger" : "neutral"}>
              {enabled ? "Снять с сайта" : "Опубликовать"}
            </Submit>
          </form>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="ag-btn sm"
            aria-expanded={open}
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
        <form action={updateAction} className="ag-section" style={{ gap: 10, borderTop: "1px solid var(--ag-line)", paddingTop: 12 }}>
          <input type="hidden" name="id" value={id} />

          <div style={{ display: "flex", gap: 8 }}>
            <input
              name="title"
              defaultValue={title ?? ""}
              placeholder="Название"
              aria-label="Название блока"
              maxLength={200}
              className="ag-input"
              style={{ flex: 1 }}
            />
            <input
              name="sortOrder"
              type="number"
              defaultValue={sortOrder}
              aria-label="Порядок блока на главной"
              className="ag-input"
              style={{ width: 110 }}
            />
          </div>

          <textarea
            name="payload"
            defaultValue={payload}
            rows={8}
            spellCheck={false}
            aria-label="Содержимое блока в формате JSON"
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid var(--ag-line)",
              borderRadius: 10,
              background: "var(--ag-bg)",
              fontFamily: "ui-monospace, Menlo, monospace",
              fontSize: 12,
              lineHeight: 1.5,
            }}
          />

          <div>
            <Submit>Сохранить</Submit>
          </div>
          <Feedback state={updateState} />
        </form>
      ) : null}
    </li>
  );
}