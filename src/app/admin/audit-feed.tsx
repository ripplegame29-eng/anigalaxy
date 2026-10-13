"use client";

import { useMemo, useState } from "react";

export interface AuditEntry {
  id: string;
  summary: string | null;
  action: string;
  actor: string | null;
  /** Метка времени в формате ru-RU — готовится на сервере. */
  when: string;
}

const SHOWN = 10;

/**
 * Иконка по типу действия.
 *
 * Различать не точный глагол, а его корень до точки: `user.ban` и
 * `user.role` — одно и то же «про пользователя», а перечислять все глаголы
 * означало бы править список при каждом новом действии в actions.
 */
function iconFor(action: string): { body: string; tone: string } {
  const kind = action.split(".")[0];

  if (action.startsWith("user.")) {
    return {
      tone: "ok",
      body: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/>',
    };
  }
  if (action.startsWith("content.")) {
    return {
      tone: "",
      body: '<path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5"/>',
    };
  }
  if (kind === "promo" || kind === "season" || kind === "economy") {
    return {
      tone: "",
      body: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5c0-1 1-1.8 2.5-1.8s2.5.8 2.5 1.8"/>',
    };
  }
  if (kind === "setting" || kind === "flag" || kind === "system") {
    return {
      tone: "ok",
      body: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
    };
  }
  if (action.includes("delete") || action.includes("ban")) {
    return {
      tone: "off",
      body: '<path d="M6 6l12 12M18 6L6 18"/>',
    };
  }
  return { tone: "", body: '<path d="M12 5v14M5 12h14"/>' };
}

/**
 * Лента последних действий администраторов.
 *
 * По умолчанию показаны десять строк: список грузится целиком, но длинная
 * лента отодвигает то, за чем человек пришёл — счётчики внизу.
 */
export function AuditFeed({ entries }: { entries: AuditEntry[] }) {
  const [expanded, setExpanded] = useState(false);

  const visible = useMemo(
    () => (expanded ? entries : entries.slice(0, SHOWN)),
    [entries, expanded],
  );

  if (entries.length === 0) {
    return (
      <div className="ag-box">
        <div className="ag-empty">
          Журнал пуст — действий администраторов пока не было.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="ag-box">
        {visible.map((entry) => {
          const icon = iconFor(entry.action);
          return (
            <div className="ag-row" key={entry.id}>
              <span className={`ag-ico${icon.tone ? ` ${icon.tone}` : ""}`}>
                <svg className="ag-ic" viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: icon.body }} />
              </span>
              <div className="ag-m">
                <b>{entry.summary ?? entry.action}</b>
                <small>{entry.actor ?? "система"}</small>
              </div>
              <span className="ag-n">{entry.action.split(".")[1] ?? entry.action}</span>
              <time dateTime={entry.when}>{entry.when}</time>
            </div>
          );
        })}
      </div>

      {entries.length > SHOWN ? (
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
          <span>
            Показано {visible.length} из {entries.length}
          </span>
          <button
            type="button"
            className="ag-btn link sm"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded
              ? `Свернуть до ${SHOWN}`
              : `Показать все ${entries.length}`}
          </button>
        </div>
      ) : null}
    </>
  );
}