/**
 * Вкладка «Виджеты» — редактор блоков витрины профиля.
 *
 * Сценарий как в макете: слева (или сверху на телефоне) сетка блоков, в
 * редакторе у каждого появляется ручка с кнопками. Перетаскивание — HTML5 DnD
 * по ручке, а кнопки «влево/вправо» нужны потому, что на тач-экране
 * перетаскивание мышью не работает.
 *
 * Черновик и сохранённая раскладка разведены намеренно: «Сохранить» должно
 * быть осознанным действием, а «Отменить» — возвратом к тому, что лежит в
 * хранилище. Поэтому макет меняется без записи, пока пользователь не нажал
 * кнопку.
 */

import { openProfileDialog } from "@/lib/profile-dialog";
import { useCallback, useEffect, useMemo, useState } from "react";
import { pushToast } from "@/lib/toasts";
import { useProgress } from "@/lib/progression/events";
import { PROGRESSION_CONFIG } from "@/lib/progression/progression.config";
import {
  DEFAULT_LAYOUT,
  MAX_WIDGETS,
  WIDGETS,
  WIDGET_CATS,
  WIDGET_ACCENTS,
  accentVars,
  WIDGET_BY_ID,
  isWidgetUnlocked,
  readWidgetLayout,
  readWidgetOptions,
  saveWidgetLayout,
  saveWidgetOptions,
  type WidgetId,
  type WidgetOptions,
  type WidgetSlot,
  type WidgetSize,
} from "@/lib/widgets";
import { WidgetBody } from "./Widgets";
import { WidgetIcon } from "./WidgetIcon";

const SHOP_PRICE = new Map(PROGRESSION_CONFIG.shop.map((item) => [item.id, item.price]));

function priceOf(service: string | undefined): number {
  return service ? (SHOP_PRICE.get(service) ?? 0) : 0;
}

function sameLayout(a: WidgetSlot[], b: WidgetSlot[]): boolean {
  return a.length === b.length && a.every((slot, i) => slot.id === b[i]?.id && slot.w === b[i]?.w && slot.c === b[i]?.c);
}

export function WidgetsPanel({
  onPreview,
  onOpenAchievements,
}: {
  onPreview?: () => void;
  /** Переход к полному списку достижений из блока «Достижения» */
  onOpenAchievements?: () => void;
}) {
  const doc = useProgress();

  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState<WidgetSlot[]>(readWidgetLayout);
  const [draft, setDraft] = useState<WidgetSlot[]>(saved);
  const [opts, setOpts] = useState<WidgetOptions>(readWidgetOptions);
  const [dragId, setDragId] = useState<WidgetId | null>(null);
  const [overId, setOverId] = useState<WidgetId | null>(null);
  /** Блок, у которого открыт выбор цвета, и выбранный в окне цвет */
  const [custom, setCustom] = useState<WidgetId | null>(null);
  const [pick, setPick] = useState<string | undefined>(undefined);

  // Раскладка в хранилище может прийти из другой вкладки браузера
  useEffect(() => {
    const sync = () => {
      const next = readWidgetLayout();
      setSaved(next);
      setDraft(next);
    };
    addEventListener("storage", sync);
    return () => removeEventListener("storage", sync);
  }, []);

  const dirty = useMemo(() => !sameLayout(saved, draft), [saved, draft]);

  const mutate = useCallback((fn: (next: WidgetSlot[]) => WidgetSlot[]) => {
    setDraft((prev) => fn(prev));
  }, []);

  const move = useCallback(
    (id: WidgetId, dir: -1 | 1) => {
      mutate((prev) => {
        const i = prev.findIndex((slot) => slot.id === id);
        const j = i + dir;
        // Границы не трогаем: за пределами списка нечего двигать
        if (i < 0 || j < 0 || j >= prev.length) return prev;
        const next = [...prev];
        [next[i], next[j]] = [next[j], next[i]];
        return next;
      });
    },
    [mutate],
  );

  const remove = useCallback(
    (id: WidgetId) => mutate((prev) => prev.filter((slot) => slot.id !== id)),
    [mutate],
  );

  const resize = useCallback(
    (id: WidgetId, w: WidgetSize) =>
      mutate((prev) => prev.map((slot) => (slot.id === id ? { ...slot, w } : slot))),
    [mutate],
  );

  const add = useCallback(
    (id: WidgetId) => {
      const def = WIDGET_BY_ID[id];
      mutate((prev) => (prev.length >= MAX_WIDGETS ? prev : [...prev, { id, w: def.size }]));
    },
    [mutate],
  );

  const onDrop = useCallback(
    (targetId: WidgetId) => {
      // Раньше перестановка шла внутри setDragId(updater): в dev React вызывает
      // updater дважды, блок переставлялся и тут же возвращался на место.
      const from = dragId;
      setDragId(null);
      if (!from || from === targetId) return;
      mutate((prev) => {
        const fromI = prev.findIndex((slot) => slot.id === from);
        const toI = prev.findIndex((slot) => slot.id === targetId);
        if (fromI < 0 || toI < 0) return prev;
        const next = [...prev];
        const [moved] = next.splice(fromI, 1);
        next.splice(toI, 0, moved);
        return next;
      });
    },
    [dragId, mutate],
  );

  const openCustom = useCallback(
    (id: WidgetId) => {
      setPick(draft.find((slot) => slot.id === id)?.c);
      setCustom(id);
    },
    [draft],
  );

  const applyCustom = useCallback(() => {
    if (!custom) return;
    mutate((prev) =>
      prev.map((slot) => {
        if (slot.id !== custom) return slot;
        const { c: _old, ...rest } = slot;
        void _old;
        return pick ? { ...rest, c: pick } : rest;
      }),
    );
    setCustom(null);
  }, [custom, pick, mutate]);

  const save = useCallback(() => {
    // Неоплаченный блок в раскладке оставить нельзя: сохранив, пользователь
    // закрепит за собой блок, который завтра исчезнет после очистки хранилища
    const locked = draft.filter((slot) => !isWidgetUnlocked(WIDGET_BY_ID[slot.id], doc.purchases));
    if (locked.length > 0) {
      pushToast({
        kind: "ac",
        title: "Не сохранено",
        text: `Снимите с витрины платные блоки: ${locked
          .map((slot) => WIDGET_BY_ID[slot.id].title)
          .join(", ")}`,
      });
      return;
    }
    saveWidgetLayout(draft);
    saveWidgetOptions(opts);
    setSaved(draft);
    pushToast({ kind: "achievement", title: "Витрина сохранена" });
  }, [draft, opts, doc.purchases]);

  const undo = useCallback(() => {
    setDraft(saved);
    pushToast({ kind: "quest", title: "Изменения отменены" });
  }, [saved]);

  const reset = useCallback(() => {
    setDraft(DEFAULT_LAYOUT.map((slot) => ({ ...slot })));
  }, []);

  const hidden = WIDGETS.filter((def) => !draft.some((slot) => slot.id === def.id));

  return (
    <div className="ag-wp">
      <h2 className="ag-h2">
        <WidgetIcon name="widgets" />
        Виджеты
      </h2>
      <p className="ag-sub">
        Блоки, которые видят гости. Зажмите блок мышью и перетащите, меняйте размер и цвет, убирайте лишнее.
      </p>

      {/* --------------------------- Панель действий --------------------------- */}
      <div className="ag-card ag-wp-tool">
        {editing ? (
          <>
            <Toggle label="Кольцо списков" on={opts.rings} onChange={(v) => setOpts({ ...opts, rings: v })} />
            <Toggle label="Разделители" on={opts.sep} onChange={(v) => setOpts({ ...opts, sep: v })} />
            <span className="ag-wp-sp" />
            <button type="button" className="btn g" onClick={() => openProfileDialog("theme")}>
              <WidgetIcon name="pal" />
              Тема профиля
            </button>
            <span className={`ag-wp-state${dirty ? " is-dirty" : ""}`}>
              {dirty ? "Есть несохранённые изменения" : "Сохранено"}
            </span>
            <button type="button" className="btn g" onClick={undo} disabled={!dirty}>
              <WidgetIcon name="undo" />
              Отменить
            </button>
            <button type="button" className="btn g" onClick={reset}>
              <WidgetIcon name="undo" />
              По умолчанию
            </button>
            <button type="button" className="btn" onClick={save} disabled={!dirty}>
              <WidgetIcon name="check" />
              Сохранить
            </button>
          </>
        ) : (
          <>
            <span className="ag-wp-static">
              <WidgetIcon name="eye" />
              Так вас видят гости
            </span>
            <span className="ag-wp-sp" />
            <button type="button" className="btn g" onClick={() => openProfileDialog("theme")}>
              <WidgetIcon name="pal" />
              Тема профиля
            </button>
            {onPreview && (
              <button type="button" className="btn g" onClick={onPreview}>
                <WidgetIcon name="eye" />
                Как видят другие
              </button>
            )}
            <button type="button" className="btn" onClick={() => setEditing(true)}>
              <WidgetIcon name="gear" />
              В редактор
            </button>
          </>
        )}
      </div>

      {/* ------------------------------- Сетка ------------------------------- */}
      <div
        className={`ag-w-grid ${editing ? "is-edit" : ""} ${opts.sep ? "is-sep" : ""}`}
        data-widget-grid=""
      >
        {draft.map((slot) => {
          const def = WIDGET_BY_ID[slot.id];
          const owned = isWidgetUnlocked(def, doc.purchases);
          return (
            <article
              key={slot.id}
              className={`ag-card ag-w ${slot.w === "l" ? "is-wide" : ""} ${
                dragId === slot.id ? "is-drag" : ""
              } ${overId === slot.id && dragId && dragId !== slot.id ? "is-over" : ""}`}
              data-widget-id={slot.id}
              data-accent={slot.c || undefined}
              style={accentVars(slot.c) as React.CSSProperties | undefined}
              /* Блок берётся мышью за любое место: зажал — потянул. Кнопки в
                 панели управления остаются кнопками (клик не начинает drag). */
              draggable={editing}
              onDragStart={(event) => {
                if (!editing) return;
                setDragId(slot.id);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", slot.id);
                // Подпись у курсора: «Достижения 2×1», как на референсе
                const ghost = document.createElement("div");
                ghost.textContent = `${def.title} ${slot.w === "l" ? "2×1" : "1×1"}`;
                ghost.style.cssText =
                  "position:fixed;top:-100px;left:-100px;padding:10px 16px;border-radius:12px;background:#0d0d14;border:1px solid rgba(255,255,255,.18);color:#fff;font:700 14px system-ui,sans-serif;box-shadow:0 12px 30px rgba(0,0,0,.6)";
                document.body.appendChild(ghost);
                event.dataTransfer.setDragImage(ghost, 14, 14);
                setTimeout(() => ghost.remove(), 0);
              }}
              onDragOver={(event) => {
                if (!dragId) return;
                event.preventDefault();
                if (overId !== slot.id) setOverId(slot.id);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setOverId(null);
                onDrop(slot.id);
              }}
              onDragEnd={() => {
                setDragId(null);
                setOverId(null);
              }}
            >
              <header className="ag-w-head">
                <WidgetIcon name={def.icon} className="ag-w-ico" />
                <h3>{def.title}</h3>
                {!owned && <span className="ag-w-lock">Превью</span>}
                {editing && (
                  <div className="ag-w-tools">
                    {/* Перетаскивание живёт на самой ручке. Раньше draggable
                        стоял на карточке, а dragstart и так приходит на неё —
                        проверка «начали ли за ручку» всегда была ложной, и
                        мышь не тянула блок вовсе. */}
                    <span className="ag-w-handle" title="Потяните блок мышью" aria-hidden>
                      <WidgetIcon name="drag" />
                    </span>
                    <button type="button" onClick={() => move(slot.id, -1)} title="Влево" aria-label={`Сдвинуть «${def.title}» влево`}>
                      <WidgetIcon name="left" />
                    </button>
                    <button type="button" onClick={() => move(slot.id, 1)} title="Вправо" aria-label={`Сдвинуть «${def.title}» вправо`}>
                      <WidgetIcon name="right" />
                    </button>
                    <button
                      type="button"
                      data-size="s"
                      className={slot.w === "s" ? "is-on" : ""}
                      onClick={() => resize(slot.id, "s")}
                      aria-pressed={slot.w === "s"}
                    >
                      1×1
                    </button>
                    <button
                      type="button"
                      data-size="l"
                      className={slot.w === "l" ? "is-on" : ""}
                      onClick={() => resize(slot.id, "l")}
                      aria-pressed={slot.w === "l"}
                    >
                      2×1
                    </button>
                    <button
                      type="button"
                      onClick={() => openCustom(slot.id)}
                      title="Цвет блока"
                      aria-label={`Цвет блока «${def.title}»`}
                    >
                      <WidgetIcon name="pal" />
                      <span className="ag-w-tl">Настроить</span>
                    </button>
                    <button type="button" className="ag-w-del" onClick={() => remove(slot.id)} title="Убрать" aria-label={`Убрать «${def.title}»`}>
                      <WidgetIcon name="x" />
                    </button>
                  </div>
                )}
              </header>

              <WidgetBody id={slot.id} onOpenAchievements={onOpenAchievements} />
            </article>
          );
        })}
      </div>

      {/* ------------------------- Выбор цвета блока ------------------------- */}
      {custom && (
        <div className="ag-wp-modal" role="presentation" onClick={() => setCustom(null)}>
          <div
            className="ag-wp-dlg"
            role="dialog"
            aria-modal="true"
            aria-label={`Блок «${WIDGET_BY_ID[custom].title}»`}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Escape") setCustom(null);
            }}
          >
            <div className="ag-wp-dlg-h">
              <WidgetIcon name="gear" />
              <h4>Блок «{WIDGET_BY_ID[custom].title}»</h4>
              <button type="button" className="ag-wp-x" onClick={() => setCustom(null)} aria-label="Закрыть">
                <WidgetIcon name="x" />
              </button>
            </div>
            <p className="ag-wp-dlg-t">Акцентный цвет</p>
            <p className="ag-wp-dlg-s">Красит градиент фона блока, его кромку и значок.</p>
            <div className="ag-wp-sw-row" role="group" aria-label="Акцентный цвет">
              {WIDGET_ACCENTS.map((accent) => (
                <button
                  key={accent.id}
                  type="button"
                  className={`ag-wp-dot${pick === accent.id ? " is-on" : ""}`}
                  style={{ "--wa": accent.rgb } as React.CSSProperties}
                  aria-pressed={pick === accent.id}
                  aria-label={accent.name}
                  title={accent.name}
                  onClick={() => setPick(accent.id)}
                />
              ))}
            </div>
            <div className="ag-wp-dlg-f">
              <button type="button" className="ag-wp-link" onClick={() => setPick(undefined)}>
                Сбросить
              </button>
              <span className="ag-wp-sp" />
              <button type="button" className="ag-wp-link" onClick={() => setCustom(null)}>
                Отмена
              </button>
              <button type="button" className="btn" onClick={applyCustom}>
                Готово
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------ Палитра ------------------------------ */}
      {editing && (
        <div className="ag-wp-pal">
          <h4>ДОБАВИТЬ ВИДЖЕТ</h4>
          {hidden.length === 0 ? (
            <span className="ag-w-sub">Все виджеты уже на витрине</span>
          ) : (
            WIDGET_CATS.map((cat) => {
              const items = hidden.filter((def) => cat.ids.includes(def.id));
              if (items.length === 0) return null;
              return (
                <div key={cat.id} className="pc-cat">
                  <p className="pc-cat-t">{cat.label}</p>
                  <div className="ag-wp-pal-list">
                    {items.map((def) => {
                      const owned = isWidgetUnlocked(def, doc.purchases);
                      const price = priceOf(def.service);
                      return (
                        <button key={def.id} type="button" className={`btn g ag-wp-add ${owned ? "" : "is-locked"}`} onClick={() => add(def.id)}>
                          <WidgetIcon name={owned ? def.icon : "lock"} />
                          {def.title}
                          {!owned && <em>{price.toLocaleString("ru-RU")} AC</em>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
          <p className="ag-w-sub" style={{ marginTop: 10, fontSize: 12 }}>
            Блоки с замком продаются за AC: примерить можно в сетке, сохранить — после покупки.
          </p>
        </div>
      )}
    </div>
  );
}

function Toggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="ag-wp-tg">
      <input type="checkbox" checked={on} onChange={(event) => onChange(event.target.checked)} />
      <span className="ag-wp-sw" aria-hidden />
      {label}
    </label>
  );
}