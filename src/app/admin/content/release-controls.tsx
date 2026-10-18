"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  createReleaseAction,
  deleteReleaseAction,
  toggleReleaseAction,
  updateReleaseAction,
  type ReleaseState,
} from "./release-actions";

const IDLE: ReleaseState = { error: null, ok: null };

const DAYS = [
  "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье",
];

function Submit({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "danger";
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

function Feedback({ state }: { state: ReleaseState }) {
  if (state.error) return <p className="ag-bad">{state.error}</p>;
  if (state.ok) return <p className="ag-ok">{state.ok}</p>;
  return null;
}

/** Поля одной серии. Используется и в форме создания, и в правке. */
function ReleaseFields({ defaultValue }: { defaultValue?: Partial<ReleaseDraft> }) {
  const d = defaultValue ?? {};
  return (
    <>
      <div className="ag-form">
        <label className="ag-field" style={{ flex: "2 1 260px" }}>
          <span>Название</span>
          <input
            name="title"
            defaultValue={d.title ?? ""}
            placeholder="Реинкарнация в мече II"
            required
            maxLength={160}
            className="ag-input"
          />
        </label>

        <label className="ag-field" style={{ flex: "1 1 160px" }}>
          <span>Студия</span>
          <input name="studio" defaultValue={d.studio ?? ""} placeholder="MAPPA" className="ag-input" />
        </label>

        <label className="ag-field" style={{ flex: "1 1 160px" }}>
          <span>День недели</span>
          <select name="day" defaultValue={String(d.day ?? 0)} className="ag-select">
            {DAYS.map((label, idx) => (
              <option key={idx} value={idx}>{label}</option>
            ))}
          </select>
        </label>

        <label className="ag-field" style={{ flex: "0 0 120px" }}>
          <span>Время</span>
          <input
            name="time"
            type="time"
            defaultValue={d.time ?? "20:00"}
            required
            className="ag-input"
          />
        </label>
      </div>

      <div className="ag-form">
        <label className="ag-field" style={{ flex: "0 0 140px" }}>
          <span>Эпизодов в неделю</span>
          <input
            name="episodes"
            type="number"
            min={1}
            max={99}
            defaultValue={d.episodes ?? ""}
            className="ag-input"
          />
        </label>

        <label className="ag-field" style={{ flex: "0 0 140px" }}>
          <span>Оценка</span>
          <input
            name="rating"
            type="number"
            min={0}
            max={10}
            step={0.01}
            defaultValue={d.rating ?? ""}
            className="ag-input"
          />
        </label>

        <label className="ag-field" style={{ flex: "2 1 260px" }}>
          <span>Жанры через запятую</span>
          <input
            name="genres"
            defaultValue={d.genres ?? ""}
            placeholder="Экшен, Фэнтези"
            className="ag-input"
          />
        </label>

        <label className="ag-field" style={{ justifyContent: "flex-end" }}>
          <span>&nbsp;</span>
          <span style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 44 }}>
            <input type="checkbox" name="isNew" value="1" defaultChecked={d.isNew ?? false} />
            Премьера
          </span>
        </label>
      </div>

      <label className="ag-field">
        <span>Обложка — ссылка или пусто (тогда страница нарисует обложку сама)</span>
        <input name="poster" defaultValue={d.poster ?? ""} className="ag-input" />
      </label>

      <label className="ag-field">
        <span>Баннер для верхней сцены — пусто, если не нужен</span>
        <input name="banner" defaultValue={d.banner ?? ""} className="ag-input" />
      </label>
    </>
  );
}

interface ReleaseDraft {
  title?: string;
  studio?: string | null;
  day?: number;
  time?: string;
  episodes?: number | null;
  rating?: number | null;
  genres?: string | null;
  poster?: string | null;
  banner?: string | null;
  isNew?: boolean;
}

/* ------------------------------ Создание ------------------------------ */

export function CreateReleaseForm() {
  const [state, formAction] = useActionState<ReleaseState, FormData>(
    createReleaseAction,
    IDLE,
  );

  return (
    <form action={formAction} className="ag-box pad ag-section" style={{ gap: 14 }}>
      <div>
        <h2 className="ag-h2">Новый релиз</h2>
        <p className="ag-sub">
          Расписание повторяется каждую неделю, поэтому у серии есть день и
          время, а не конкретная дата.
        </p>
      </div>

      <ReleaseFields />

      <div>
        <Submit>Добавить в расписание</Submit>
      </div>
      <Feedback state={state} />
    </form>
  );
}

/* -------------------------------- Список ------------------------------- */

export function ReleaseRow({
  id,
  title,
  studio,
  day,
  time,
  episodes,
  rating,
  isNew,
  genres,
  poster,
  banner,
  enabled,
}: {
  id: string;
  title: string;
  studio: string | null;
  day: number;
  time: string;
  episodes: number | null;
  rating: number | null;
  isNew: boolean;
  genres: string | null;
  poster: string | null;
  banner: string | null;
  enabled: boolean;
}) {
  const [open, setOpen] = useState(false);

  const [toggleState, toggleAction] = useActionState<ReleaseState, FormData>(
    toggleReleaseAction,
    IDLE,
  );
  const [deleteState, deleteAction] = useActionState<ReleaseState, FormData>(
    deleteReleaseAction,
    IDLE,
  );
  const [updateState, updateAction] = useActionState<ReleaseState, FormData>(
    updateReleaseAction,
    IDLE,
  );

  return (
    <li className="ag-box pad ag-section" style={{ gap: 10 }}>
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
            <b>{title}</b>
            <span className="ag-n">{DAYS[day]?.slice(0, 2)}, {time}</span>
            {studio ? <span className="ag-n">{studio}</span> : null}
            {isNew ? (
              <span className="ag-lvl" style={{ background: "var(--ag-okbg)", color: "var(--ag-grn)" }}>
                премьера
              </span>
            ) : null}
            {enabled ? null : <span className="ag-n">выключен</span>}
            {!poster ? <span className="ag-n" title="Страница нарисует обложку сама">обложка авто</span> : null}
          </p>
          <p className="ag-note" style={{ marginTop: 4 }}>
            {genres ? `${genres} · ` : ""}
            {episodes ? `${episodes} эп./нед · ` : ""}
            {rating !== null ? `★ ${rating.toFixed(2)}` : "без оценки"}
          </p>
        </div>

        <div className="ag-act">
          <form action={toggleAction}>
            <input type="hidden" name="id" value={id} />
            <Submit>{enabled ? "Убрать" : "Вернуть"}</Submit>
          </form>
          <button
            type="button"
            className="ag-btn sm"
            onClick={() => setOpen((v) => !v)}
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
        <form
          action={updateAction}
          className="ag-section"
          style={{ gap: 14, borderTop: "1px solid var(--ag-line)", paddingTop: 12 }}
        >
          <input type="hidden" name="id" value={id} />
          <ReleaseFields
            defaultValue={{ title, studio, day, time, episodes, rating, genres, poster, banner, isNew }}
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