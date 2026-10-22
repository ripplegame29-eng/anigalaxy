"use client";

import { useCallback, useEffect, useState } from "react";
import { adminGet, adminPost, ago, fmtDate } from "./api";
import { Empty, Pill, Segmented, useUi } from "./ui";

interface Err { id: number; source: string; message: string; stack: string; path: string; userId: number; count: number; firstAt: number; lastAt: number; resolved: boolean }
interface LogRow { id: number; admin: string; action: string; targetId: number; target: string; detail: string; at: number }

export function ErrorsTab({ openUser }: { openUser: (id: number) => void }) {
  const ui = useUi();
  const [source, setSource] = useState("");
  const [resolved, setResolved] = useState(false);
  const [items, setItems] = useState<Err[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [now] = useState(() => Date.now());

  const reload = useCallback(async () => {
    const data = await adminGet<{ errors: Err[] }>("errors", { source, resolved: resolved ? 1 : 0 });
    setItems(data?.errors ?? []);
  }, [source, resolved]);

  useEffect(() => {
    let alive = true;
    void adminGet<{ errors: Err[] }>("errors", { source, resolved: resolved ? 1 : 0 }).then((d) => alive && setItems(d?.errors ?? []));
    return () => {
      alive = false;
    };
  }, [source, resolved]);

  return (
    <div className="adm-stack-lg">
      <div className="adm-toolbar">
        <Segmented
          label="Источник"
          value={source}
          onChange={setSource}
          options={[
            { id: "", label: "Все" },
            { id: "server", label: "Сервер" },
            { id: "client", label: "Браузер" },
          ]}
        />
        <Segmented
          label="Статус"
          value={resolved ? "1" : "0"}
          onChange={(v) => setResolved(v === "1")}
          options={[
            { id: "0", label: "Открытые" },
            { id: "1", label: "Разобранные" },
          ]}
        />
        <button
          type="button"
          className="adm-btn adm-btn-ghost"
          onClick={async () => {
            if (!(await ui.confirm(resolved ? "Удалить разобранные ошибки?" : "Очистить весь журнал ошибок?", { danger: true, confirmLabel: "Очистить" }))) return;
            const r = await adminPost({ action: "errorClear", onlyResolved: resolved });
            ui.toast(r.ok ? `Удалено записей: ${String(r.count)}` : (r.error ?? "Ошибка"), r.ok ? "ok" : "err");
            void reload();
          }}
        >
          Очистить
        </button>
      </div>
      <ul className="adm-errors">
        {(items ?? []).map((e) => (
          <li key={e.id} className={open === e.id ? "open" : ""}>
            <button type="button" className="adm-err-head" onClick={() => setOpen(open === e.id ? null : e.id)} aria-expanded={open === e.id}>
              <Pill tone={e.source === "server" ? "red" : "violet"}>{e.source === "server" ? "сервер" : "браузер"}</Pill>
              <span className="adm-err-msg">
                <b>{e.message}</b>
                <small>{e.path || "—"}</small>
              </span>
              <span className="adm-err-n">
                ×{e.count}
                <small>{ago(e.lastAt, now)}</small>
              </span>
            </button>
            {open === e.id ? (
              <div className="adm-err-body">
                <pre>{e.stack || "Стека нет"}</pre>
                <p>
                  Первый раз: {fmtDate(e.firstAt)} · последний: {fmtDate(e.lastAt)}
                  {e.userId ? (
                    <>
                      {" "}
                      · игрок{" "}
                      <button type="button" className="adm-link" onClick={() => openUser(e.userId)}>
                        #{e.userId}
                      </button>
                    </>
                  ) : null}
                </p>
                <div className="adm-row">
                  <button type="button" className="adm-btn adm-btn-sm" onClick={() => void navigator.clipboard?.writeText(`${e.message}\n${e.path}\n${e.stack}`).then(() => ui.toast("Скопировано", "info"))}>
                    Копировать
                  </button>
                  {!e.resolved ? (
                    <button
                      type="button"
                      className="adm-btn adm-btn-sm adm-btn-primary"
                      onClick={async () => {
                        await adminPost({ action: "errorResolve", id: e.id });
                        ui.toast("Отмечена как разобранная");
                        void reload();
                      }}
                    >
                      Разобрано
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {items && !items.length ? <Empty>{resolved ? "Разобранных ошибок нет." : "Ошибок нет — всё работает."}</Empty> : null}
    </div>
  );
}

const ACTION_LABEL: Record<string, string> = {
  ban: "Бан",
  premium: "Premium",
  role: "Роль",
  resolve: "Жалоба",
  deleteChat: "Чат",
  deleteComment: "Комментарий",
  closeRoom: "Комната",
  account: "Профиль",
  balance: "Баланс",
  item: "Предмет",
  equip: "Надето",
  notify: "Сообщение",
  password: "Пароль",
  sessions: "Сессии",
  deleteUser: "Удаление",
  broadcast: "Рассылка",
  massGrant: "Массовая выдача",
  errorClear: "Ошибки",
};

export function LogTab({ openUser }: { openUser: (id: number) => void }) {
  const [items, setItems] = useState<LogRow[] | null>(null);
  const [now] = useState(() => Date.now());
  useEffect(() => {
    let alive = true;
    void adminGet<{ log: LogRow[] }>("log").then((d) => alive && setItems(d?.log ?? []));
    return () => {
      alive = false;
    };
  }, []);
  return (
    <div className="adm-stack-lg">
      <ul className="adm-log">
        {(items ?? []).map((l) => (
          <li key={l.id}>
            <span className="adm-log-dot" aria-hidden />
            <div>
              <b>
                {l.admin} · {ACTION_LABEL[l.action] ?? l.action}
                {l.target ? (
                  <>
                    {" "}
                    →{" "}
                    <button type="button" className="adm-link" onClick={() => l.targetId && openUser(l.targetId)}>
                      {l.target}
                    </button>
                  </>
                ) : null}
              </b>
              <p>{l.detail}</p>
            </div>
            <time>{ago(l.at, now)}</time>
          </li>
        ))}
      </ul>
      {items && !items.length ? <Empty>Журнал пуст — действий администраторов пока не было.</Empty> : null}
    </div>
  );
}
