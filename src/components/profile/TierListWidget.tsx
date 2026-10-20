"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  TIERS,
  clearTiers,
  hueOf,
  placeInTier,
  readTierList,
  rememberItem,
  renameTier,
  searchCatalog,
  setTierTitle,
  tierCount,
  tierOf,
  useTierList,
  type TierItem,
} from "@/lib/tier-list";
import "./../tier-list.css";

/**
 * Виджет «Тир-лист аниме» по макету `anime-tierlist.html`.
 *
 * Ряды, карточки, перетаскивание, корзина, окно выбора, переименование рядов
 * двойным кликом — всё как в макете. Отличия два:
 *
 *   1. Каталог настоящий: `/api/kodik/search` вместо демо-списка из двадцати
 *      выдуманных названий без идентификаторов.
 *   2. В режиме гостя (чужой профиль и предпросмотр) виджет только читается:
 *      гостю нечего править в чужом тир-листе.
 *
 * Прямая работа с DOM здесь — перетаскивание карточек и разлёт частиц: их
 * десятки за жест, и гонять их через состояние React дороже, чем рисовать
 * напрямую, как в макете.
 */

interface Props {
  /** Чужой профиль: показываем тир-лист, но не даём его менять */
  readOnly?: boolean;
}

export function TierListWidget({ readOnly = false }: Props) {
  const state = useTierList();
  const [dragging, setDragging] = useState<string | null>(null);
  const [modalTier, setModalTier] = useState<number | null>(null);
  const [popped, setPopped] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const popTimer = useRef<number | null>(null);

  const total = tierCount(state);
  const rootRef = useRef<HTMLDivElement>(null);
  /** Что именно тянут: ref, а не состояние — обработчик drop должен видеть
   *  id сразу, без ожидания отрисовки */
  const dragIdRef = useRef<string | null>(null);

  /**
   * Класс `dragging` ставится прямо в DOM, а не через состояние: корзина
   * должна появиться в тот же кадр, что и движение мыши. Через React класс
   * появлялся на кадр позже, и автопроверка (и быстрые руки) попадали мимо
   * неё — в макете то же самое сделано прямой правкой класса.
   */
  const beginDrag = useCallback((id: string) => {
    setDragging(id);
    dragIdRef.current = id;
    rootRef.current?.classList.add("dragging");
  }, []);

  const endDrag = useCallback(() => {
    setDragging(null);
    dragIdRef.current = null;
    rootRef.current?.classList.remove("dragging");
  }, []);

  /* Раскладка лежит в браузере: с первого кадра её не отдать, иначе разойдёмся
     с сервером на гидрации. Флаг заодно снимает класс boot — через 1,4 с,
     как в макете, ряды въезжают со сдвигом. */
  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), 1400);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(
    () => () => {
      if (popTimer.current) window.clearTimeout(popTimer.current);
    },
    [],
  );

  /* Наклон карточки за курсором — прямой DOM, как в макете */
  useEffect(() => {
    if (readOnly || window.matchMedia("(hover:none)").matches) return;
    const onMove = (event: PointerEvent) => {
      const card = (event.target as HTMLElement).closest<HTMLElement>(".tl-card");
      if (!card || event.pointerType !== "mouse" || dragging) return;
      const r = card.getBoundingClientRect();
      const x = (event.clientX - r.left) / r.width - 0.5;
      const y = (event.clientY - r.top) / r.height - 0.5;
      card.style.setProperty("--ry", `${x * 14}deg`);
      card.style.setProperty("--rx", `${-y * 14}deg`);
    };
    const onLeave = (event: PointerEvent) => {
      const card = (event.target as HTMLElement).closest<HTMLElement>(".tl-card");
      if (!card) return;
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerout", onLeave, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerout", onLeave);
    };
  }, [dragging, readOnly]);

  /** Разлёт частиц при добавлении карточки */
  const burst = useCallback((el: Element | null, color: string) => {
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    for (let i = 0; i < 12; i += 1) {
      const dot = document.createElement("i");
      const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.5;
      const distance = 30 + Math.random() * 40;
      dot.style.cssText = `position:fixed;z-index:10000;pointer-events:none;width:6px;height:6px;border-radius:50%;left:${cx}px;top:${cy}px;background:${color};box-shadow:0 0 10px ${color}`;
      document.body.appendChild(dot);
      dot
        .animate(
          [
            { transform: "translate(-50%,-50%) scale(1)", opacity: 1 },
            {
              transform: `translate(${Math.cos(angle) * distance - 3}px,${Math.sin(angle) * distance - 3}px) scale(0)`,
              opacity: 0,
            },
          ],
          { duration: 600 + Math.random() * 300, easing: "cubic-bezier(.2,.8,.3,1)" },
        )
        .onfinish = () => dot.remove();
    }
  }, []);

  const place = useCallback(
    (id: string, tier: number, el: Element | null) => {
      const from = tierOf(readTierList(), id);
      if (from === tier) return;
      placeInTier(id, tier);
      if (tier > -1) {
        burst(el, TIERS[tier].color);
        // Пружинное появление новой карточки — как у макета
        setPopped(id);
        if (popTimer.current) window.clearTimeout(popTimer.current);
        popTimer.current = window.setTimeout(() => setPopped(null), 600);
      }
    },
    [burst],
  );

  const rows = useMemo(
    () =>
      state.rows.map((row, index) => ({
        tier: TIERS[index],
        index,
        label: state.labels[index],
        ids: row,
      })),
    [state.rows, state.labels],
  );

  return (
    <div className={`tl-root${mounted ? "" : " boot"}`} ref={rootRef}>
      <div className="tl-glow" aria-hidden="true" />
      <header className="tl-head">
        <div className="tl-headtxt">
          {readOnly ? (
            <span className="tl-title tl-title-ro">{state.title}</span>
          ) : (
            <input
              className="tl-title"
              value={state.title}
              maxLength={60}
              aria-label="Название тир-листа"
              onChange={(event) => setTierTitle(event.target.value)}
            />
          )}
          <span className="tl-count">
            {total} аниме в списке
          </span>
        </div>
        {!readOnly && (
          <button
            type="button"
            className="tl-btn"
            onClick={() => {
              if (window.confirm("Убрать все аниме из тир-листа?")) clearTiers();
            }}
          >
            Очистить
          </button>
        )}
      </header>

      <div className="tl-tiers">
        {rows.map((row) => (
          <div
            key={row.index}
            className="tl-tier"
            style={{ "--c": row.tier.color, "--i": row.index } as React.CSSProperties}
            onDragOver={(event) => {
              if (dragging) {
                event.preventDefault();
                event.currentTarget.classList.add("over");
              }
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                event.currentTarget.classList.remove("over");
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              event.currentTarget.classList.remove("over");
              const id = event.dataTransfer.getData("text/plain") || dragging;
              if (id) place(id, row.index, event.currentTarget);
              endDrag();
            }}
          >
            {readOnly ? (
              <div className="tl-label" style={{ "--c": row.tier.color } as React.CSSProperties}>
                {row.label}
              </div>
            ) : (
              <TierLabel
                value={row.label}
                color={row.tier.color}
                onSave={(next) => renameTier(row.index, next)}
              />
            )}
            <div className="tl-items">
              {row.ids.map((id) => {
                const item = state.items[id];
                if (!item) return null;
                return (
                  <TierCard
                    key={id}
                    item={item}
                    readOnly={readOnly}
                    popped={popped === id}
                    onDragStart={() => beginDrag(id)}
                    onDragEnd={endDrag}
                    onRemove={() => place(id, -1, null)}
                  />
                );
              })}
              {!readOnly && (
                <button
                  type="button"
                  className="tl-add"
                  aria-label={`Добавить аниме в ряд ${row.label}`}
                  onClick={() => setModalTier(row.index)}
                >
                  <span>+</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div
        className="tl-trash"
        onDragOver={(event) => {
          if (!dragIdRef.current) return;
          event.preventDefault();
          event.currentTarget.classList.add("over");
        }}
        onDragLeave={(event) => event.currentTarget.classList.remove("over")}
        onDrop={(event) => {
          const id = event.dataTransfer.getData("text/plain") || dragIdRef.current;
          if (!id) return;
          event.preventDefault();
          event.currentTarget.classList.remove("over");
          place(id, -1, null);
          endDrag();
        }}
      >
        Перетащите сюда, чтобы убрать
      </div>

      {modalTier !== null && (
        <TierPicker tier={modalTier} onClose={() => setModalTier(null)} />
      )}
    </div>
  );
}

/* --------------------------------- Ряд ---------------------------------- */

/** Подпись ряда: двойной клик включает правку, как в макете */
function TierLabel({
  value,
  color,
  onSave,
}: {
  value: string;
  color: string;
  onSave: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editing) return;
    const node = ref.current;
    if (!node) return;
    node.focus();
    // Выделяем текст целиком, как document.execCommand("selectAll") в макете
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [editing]);

  return (
    <div
      ref={ref}
      className="tl-label"
      title="Двойной клик — переименовать"
      style={{ "--c": color } as React.CSSProperties}
      contentEditable={editing}
      suppressContentEditableWarning
      onDoubleClick={() => setEditing(true)}
      onBlur={() => {
        setEditing(false);
        onSave(ref.current?.textContent?.trim() || "");
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          ref.current?.blur();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          if (ref.current) ref.current.textContent = value;
          ref.current?.blur();
        }
      }}
    >
      {value}
    </div>
  );
}

/* -------------------------------- Карточка -------------------------------- */

function TierCard({
  item,
  readOnly,
  popped,
  onDragStart,
  onDragEnd,
  onRemove,
}: {
  item: TierItem;
  readOnly: boolean;
  /** Только что добавленная карточка: пружинное появление из макета */
  popped: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={`tl-card${popped ? " pop" : ""}`}
      title={item.title}
      data-id={item.id}
      draggable={!readOnly}
      tabIndex={readOnly ? -1 : 0}
      style={{ "--c": hueOf(item.title) } as React.CSSProperties}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", item.id);
        event.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onKeyDown={(event) => {
        if (readOnly) return;
        if (event.key === "Delete" || event.key === "Backspace") {
          event.preventDefault();
          onRemove();
        }
      }}
    >
      {item.poster ? <img src={item.poster} alt="" loading="lazy" /> : null}
      <span className="cap">{item.title}</span>
      {!readOnly && (
        <button
          type="button"
          className="tl-x"
          aria-label={`Убрать: ${item.title}`}
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

/* --------------------------- Окно выбора аниме ---------------------------- */

/** Каталог Kodik: макет искал по демо-массиву, здесь настоящий поиск */
function TierPicker({ tier, onClose }: { tier: number; onClose: () => void }) {
  const state = useTierList();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TierItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [sessionAdds, setSessionAdds] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);
  const seq = useRef(0);

  const color = TIERS[tier].color;
  const label = state.labels[tier];

  useEffect(() => {
    openerRef.current = document.activeElement;
    document.body.style.overflow = "hidden";
    const focus = window.setTimeout(() => searchRef.current?.focus(), 80);
    return () => {
      document.body.style.overflow = "";
      window.clearTimeout(focus);
      // Возврат фокуса на кнопку «+», как в макете
      if (openerRef.current instanceof HTMLElement) openerRef.current.focus();
    };
  }, []);

  const search = useCallback(async (value: string) => {
    const id = seq.current + 1;
    seq.current = id;
    setLoading(true);
    setFailed(false);
    try {
      const found = await searchCatalog(value);
      if (seq.current !== id) return;
      for (const item of found) rememberItem(item);
      setResults(found);
      setLoading(false);
    } catch {
      if (seq.current !== id) return;
      setFailed(true);
      setLoading(false);
    }
  }, []);

  /* Поиск с задержкой, как в макете: тот же эффект открывает окно первым
     запросом (пустой строка — «покажи популярное») и debounce'ит ввод */
  useEffect(() => {
    const timer = window.setTimeout(() => void search(query), 300);
    return () => window.clearTimeout(timer);
  }, [query, search]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggle = useCallback(
    (item: TierItem) => {
      const el = gridRef.current?.querySelector<HTMLElement>(`[data-id="${item.id}"]`);
      const from = tierOf(readTierList(), item.id);
      if (from === tier) {
        placeInTier(item.id, -1);
        setSessionAdds((value) => Math.max(0, value - 1));
        return;
      }
      placeInTier(item.id, tier);
      rememberItem(item);
      setSessionAdds((value) => value + 1);
      if (el) {
        const r = el.getBoundingClientRect();
        for (let i = 0; i < 10; i += 1) {
          const angle = (Math.PI * 2 * i) / 10 + Math.random() * 0.5;
          const distance = 22 + Math.random() * 24;
          const p = document.createElement("i");
          p.style.cssText = `position:fixed;z-index:10000;pointer-events:none;width:6px;height:6px;border-radius:50%;left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;background:${color};box-shadow:0 0 10px ${color}`;
          document.body.appendChild(p);
          p
            .animate(
              [
                { transform: "translate(-50%,-50%) scale(1)", opacity: 1 },
                {
                  transform: `translate(${Math.cos(angle) * distance - 3}px,${Math.sin(angle) * distance - 3}px) scale(0)`,
                  opacity: 0,
                },
              ],
              { duration: 520 + Math.random() * 240, easing: "cubic-bezier(.2,.8,.3,1)" },
            )
            .onfinish = () => p.remove();
        }
      }
    },
    [color, tier],
  );

  return createPortal(
    <div className="tl-modal open" role="dialog" aria-modal="true" aria-labelledby="tl-mtitle">
      <div className="tl-backdrop" onClick={onClose} />
      <div className="tl-panel" style={{ "--c": color } as React.CSSProperties}>
        <div className="tl-phead">
          <h3 id="tl-mtitle" className="tl-mtitle">
            Добавить в ряд <span className="tl-chip">{label}</span>
          </h3>
          <button type="button" className="tl-close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>

        <div className="tl-sbox">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={searchRef}
            className="tl-search"
            type="search"
            placeholder="Название аниме…"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="tl-grid" ref={gridRef} aria-live="polite">
          {loading
            ? Array.from({ length: 8 }, (_, i) => <div className="tl-skel" key={i} />)
            : failed
              ? <div className="tl-empty">Каталог недоступен. Проверь соединение и повтори.</div>
              : results.length === 0
                ? <div className="tl-empty">Ничего не найдено. Попробуйте другое название.</div>
                : results.map((item, index) => {
                    const inTier = tierOf(state, item.id);
                    return (
                      <button
                        type="button"
                        key={item.id}
                        className={`tl-card${inTier > -1 ? " has" : ""}`}
                        data-id={item.id}
                        title={item.title}
                        style={
                          {
                            "--c": hueOf(item.title),
                            "--k": Math.min(index, 20),
                            "--b": inTier > -1 ? TIERS[inTier].color : undefined,
                          } as React.CSSProperties
                        }
                        onClick={() => toggle(item)}
                      >
                        {item.poster ? <img src={item.poster} alt="" loading="lazy" /> : null}
                        <span className="cap">{item.title}</span>
                        {inTier > -1 && (
                          <span className="tl-badge" style={{ background: TIERS[inTier].color }}>
                            {state.labels[inTier]}
                          </span>
                        )}
                      </button>
                    );
                  })}
        </div>

        <div className="tl-pfoot">
          <span className="tl-hint">
            {sessionAdds > 0 ? `Добавлено: ${sessionAdds}` : "Нажмите на постер, чтобы добавить"}
          </span>
          <button type="button" className="tl-btn tl-primary" onClick={onClose}>
            Готово
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}