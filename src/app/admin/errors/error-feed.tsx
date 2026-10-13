"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { resolveAllAction, toggleResolvedAction, type ErrorState } from "./actions";

const IDLE: ErrorState = { error: null, ok: null };

export interface ErrorRow {
  id: string;
  level: string;
  source: string;
  sourceLabel: string;
  operation: string | null;
  message: string;
  /** Уже разобранная запись показывается приглушённой, с серой точкой. */
  resolved: boolean;
  count: number;
  firstSeen: string;
  lastSeen: string;
  /** Уже отформатированные на сервере: JSON и стек приходят в панель как есть. */
  context: string | null;
  stack: string | null;
  userAgent: string | null;
}

const CHEVRON = '<path d="M9 6l6 6-6 6"/>';

function Submit({ children, tone }: { children: React.ReactNode; tone?: "danger" }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`ag-btn sm${tone ? " danger" : ""}`}>
      {pending ? "…" : children}
    </button>
  );
}

/**
 * Строка журнала: свёрнута — что и где сломалось, развёрнута — контекст и стек.
 *
 * Раскрытие локальное (useState), а не через <details>: макет рисует
 * стрелку и анимирует высоту, а у <details> анимации нет — он открывается
 * скачком. Сервер при этом перерисовывать страницу не должен: раскрытая
 * строка остаётся открытой, пока список не обновился.
 */
function ErrorItem({ entry }: { entry: ErrorRow }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ErrorState, FormData>(
    toggleResolvedAction,
    IDLE,
  );

  const crit = entry.level === "error";
  const cls = [
    "ag-err",
    crit ? "crit" : "",
    entry.resolved ? "read" : "",
    open ? "open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li className={cls}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="ag-dot" aria-hidden="true" />

        <span className="ag-m">
          <b>{entry.message}</b>
          <small>
            {entry.operation ? <span className="ag-code">{entry.operation}</span> : null}
            {entry.operation ? " · " : null}
            {entry.sourceLabel} · повторов {entry.count}
          </small>
        </span>

        <span className={`ag-lvl${entry.level === "info" ? " info" : ""}`}>
          {entry.level === "error" ? "критично" : entry.level === "warn" ? "внимание" : "инфо"}
        </span>

        <time dateTime={entry.lastSeen} style={{ flex: "none", color: "var(--ag-mut)", fontSize: 13 }}>
          {entry.lastSeen}
        </time>

        <svg className="ag-chev" viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: CHEVRON }} />
      </button>

      <div className="ag-det">
        <div>
          <p>
            Источник: <span className="ag-code">{entry.source}</span>
            {entry.operation ? (
              <>
                {" · "}операция: <span className="ag-code">{entry.operation}</span>
              </>
            ) : null}
            {" · "}впервые {entry.firstSeen}, повтор {entry.lastSeen}.
            {entry.userAgent ? <> Браузер: {entry.userAgent}.</> : null}
          </p>

          {entry.context ? (
            <pre>{entry.context}</pre>
          ) : null}

          {entry.stack ? (
            <pre>{entry.stack}</pre>
          ) : null}

          <div className="ag-act" style={{ padding: "0 20px 16px 46px" }}>
            <form action={formAction}>
              <input type="hidden" name="id" value={entry.id} />
              <Submit>{entry.resolved ? "Вернуть в работу" : "Пометить решённой"}</Submit>
            </form>
            {state.error ? <span className="ag-bad">{state.error}</span> : null}
            {state.ok ? <span className="ag-ok">{state.ok}</span> : null}
          </div>
        </div>
      </div>
    </li>
  );
}

export function ErrorFeed({
  entries,
  level,
}: {
  entries: ErrorRow[];
  /** Уровень текущего фильтра — нужен форме массового действия. */
  level: string;
}) {
  const [state, formAction] = useActionState<ErrorState, FormData>(
    resolveAllAction,
    IDLE,
  );
  const [confirming, setConfirming] = useState(false);

  if (entries.length === 0) {
    return (
      <div className="ag-box">
        <div className="ag-empty">
          Под этот фильтр ничего не попало. Смените чипу или включите «Все».
        </div>
      </div>
    );
  }

  return (
    <div className="ag-section" style={{ gap: 12 }}>
      <div className="ag-box">
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {entries.map((entry) => (
            <ErrorItem key={entry.id} entry={entry} />
          ))}
        </ul>
      </div>

      {/* Массовое действие требует подтверждения: оно закрывает сразу
          сотни записей, и отменить это нельзя. */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 13,
          color: "var(--ag-mut)",
        }}
      >
        <span>Показано {entries.length} записей.</span>

        {confirming ? (
          <div className="ag-act">
            <span>Пометить решёнными все неразобранные записи фильтра?</span>
            <form action={formAction}>
              <input type="hidden" name="level" value={level} />
              <Submit tone="danger">Да, пометить</Submit>
            </form>
            <button type="button" className="ag-btn sm" onClick={() => setConfirming(false)}>
              Отмена
            </button>
          </div>
        ) : (
          <button type="button" className="ag-btn sm" onClick={() => setConfirming(true)}>
            Пометить решёнными всё неразобранное
          </button>
        )}
      </div>

      {state.error ? <p className="ag-bad">{state.error}</p> : null}
      {state.ok ? <p className="ag-ok">{state.ok}</p> : null}
    </div>
  );
}