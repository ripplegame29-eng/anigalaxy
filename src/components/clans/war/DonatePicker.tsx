"use client";

import { PSelect } from "@/components/PSelect";
import { useMemo, useState } from "react";
import { CATALOG } from "@/lib/cards/catalog";
import { CLASSES, ELEMENTS, RANKS, type CardClass, type Element } from "@/lib/cards/config";
import { DONATE } from "@/lib/cards/clanwar";
import { GameCard } from "@/components/cards/GameCard";
import { ELEMENT_ICON, Ico } from "@/components/cards/icons";
import { Sheet, UnitThumb, useCardArt } from "./shared";

const PAGE = 36;

/** Выбор героя C–A и количества копий для запроса клану */
export function DonatePicker({ onClose, onSubmit }: { onClose: () => void; onSubmit: (cardId: string, want: number) => Promise<string | null> }) {
  const snap = useCardArt();
  const [q, setQ] = useState("");
  const [rank, setRank] = useState(-1);
  const [el, setEl] = useState<Element | "">("");
  const [cls, setCls] = useState<CardClass | "">("");
  const [series, setSeries] = useState("");
  const [sel, setSel] = useState("");
  const [want, setWant] = useState(1);
  const [limit, setLimit] = useState(PAGE);
  const [fopen, setFopen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // список скрытых героев приходит вместе с состоянием карт
  const hiddenSig = (snap.state?.hidden ?? []).join(",");
  const pool = useMemo(() => {
    const hid = new Set(hiddenSig.split(","));
    return CATALOG.filter((c) => c.rank <= DONATE.maxRank && !hid.has(c.id));
  }, [hiddenSig]);
  const seriesList = useMemo(() => [...new Set(pool.map((c) => c.series))].sort((a, b) => a.localeCompare(b, "ru")), [pool]);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return pool.filter(
      (c) =>
        (rank < 0 || c.rank === rank) &&
        (!el || c.element === el) &&
        (!cls || c.cls === cls) &&
        (!series || c.series === series) &&
        (!t || c.name.toLowerCase().includes(t) || c.search.toLowerCase().includes(t) || c.series.toLowerCase().includes(t)),
    );
  }, [pool, q, rank, el, cls, series]);
  const picked = pool.find((c) => c.id === sel);
  const touched = !!(q || rank >= 0 || el || cls || series);

  async function submit() {
    if (!picked || busy) return;
    setBusy(true);
    setErr("");
    const e = await onSubmit(picked.id, want);
    setBusy(false);
    if (e) setErr(e);
  }

  return (
    <Sheet
      wide
      onClose={onClose}
      title="Запросить карты"
      sub={`Герои рангов C, B и A · от 1 до ${DONATE.maxWant} копий · запрос живёт ${DONATE.requestMs / 3_600_000} ч`}
      footer={
        <div className="dn-pick-foot">
          {picked ? (
            <div className="dn-pick-sel">
              <UnitThumb cardId={picked.id} size={44} />
              <span>
                <b>{picked.name}</b>
                <small>
                  {RANKS[picked.rank].name} · {picked.series}
                </small>
              </span>
            </div>
          ) : (
            <p className="cw-note">Выберите героя из списка</p>
          )}
          <div className="dn-step" role="group" aria-label="Сколько копий">
            <button type="button" onClick={() => setWant((w) => Math.max(1, w - 1))} disabled={want <= 1} aria-label="Меньше">
              <Ico name="down" size={18} style={{ transform: "rotate(90deg)" }} />
            </button>
            <output aria-live="polite">×{want}</output>
            <button type="button" onClick={() => setWant((w) => Math.min(DONATE.maxWant, w + 1))} disabled={want >= DONATE.maxWant} aria-label="Больше">
              <Ico name="plus" size={18} />
            </button>
          </div>
          <button type="button" className="cw-btn primary lg" disabled={!picked || busy} onClick={() => void submit()}>
            {busy ? "Отправляем…" : "Запросить"}
          </button>
          {err ? (
            <p className="cw-err" role="alert">
              {err}
            </p>
          ) : null}
        </div>
      }
    >
      <div className="dn-filters">
        <div className="dn-row">
          <label className="dn-search">
            <Ico name="target" size={16} />
            <input
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setLimit(PAGE);
              }}
              placeholder="Имя героя или тайтл"
              aria-label="Поиск героя"
            />
          </label>
          <button type="button" className={`dn-ftoggle ${touched ? "has" : ""}`} aria-expanded={fopen} onClick={() => setFopen((v) => !v)}>
            Фильтры{touched ? " •" : ""}
          </button>
        </div>
      </div>
      <div className={`dn-fpanel ${fopen ? "open" : ""}`}>
        <div className="dn-chips" role="group" aria-label="Ранг">
          {[-1, 0, 1, 2].map((r) => (
            <button key={r} type="button" aria-pressed={rank === r} className="dn-chip" style={r >= 0 ? { ["--chip-c" as string]: RANKS[r].color } : undefined} onClick={() => { setRank(r); setLimit(PAGE); }}>
              {r < 0 ? "Все" : RANKS[r].short}
            </button>
          ))}
        </div>
        <div className="dn-chips" role="group" aria-label="Стихия">
          {(Object.keys(ELEMENTS) as Element[]).map((k) => (
            <button key={k} type="button" aria-pressed={el === k} aria-label={ELEMENTS[k].name} title={ELEMENTS[k].name} className="dn-chip ico" onClick={() => { setEl(el === k ? "" : k); setLimit(PAGE); }}>
              <Ico name={ELEMENT_ICON[k]} size={17} />
            </button>
          ))}
        </div>
        <div className="dn-chips" role="group" aria-label="Класс">
          {(Object.keys(CLASSES) as CardClass[]).map((k) => (
            <button key={k} type="button" aria-pressed={cls === k} title={CLASSES[k].hint} className="dn-chip" onClick={() => { setCls(cls === k ? "" : k); setLimit(PAGE); }}>
              {CLASSES[k].name}
            </button>
          ))}
        </div>
        <PSelect className="dn-select" value={series} onChange={(e) => { setSeries(e.target.value); setLimit(PAGE); }} aria-label="Тайтл">
          <option value="">Все тайтлы ({seriesList.length})</option>
          {seriesList.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </PSelect>
      </div>
      <div className="dn-count">
        <span>Найдено: {list.length}</span>
        {touched ? (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setRank(-1);
              setEl("");
              setCls("");
              setSeries("");
            }}
          >
            Сбросить
          </button>
        ) : null}
      </div>

      {list.length ? (
        <div className="dn-grid" role="listbox" aria-label="Герои">
          {list.slice(0, limit).map((c) => (
            <div key={c.id} role="option" aria-selected={sel === c.id} className="dn-cell">
              <GameCard cardId={c.id} stats={false} selected={sel === c.id} onClick={() => { setSel(c.id); setErr(""); }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="cw-empty small">
          <p>Никого не нашли — попробуйте убрать часть фильтров.</p>
        </div>
      )}
      {list.length > limit ? (
        <button type="button" className="cw-btn ghost wide" onClick={() => setLimit((l) => l + PAGE)}>
          Показать ещё · {list.length - limit}
        </button>
      ) : null}
    </Sheet>
  );
}
