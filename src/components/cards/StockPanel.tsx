"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { PACK, RANKS } from "@/lib/cards/config";
import type { CardsState } from "@/lib/cards/client";
import { fmt, fmtLeft } from "./common";
import { CUR, Cur, CurArt, Ico, type CurKey } from "./icons";
import { ExchangePopover } from "./ExchangePopover";

const packWord = (n: number) => (n === 1 ? "пак" : n < 5 ? "пака" : "паков");
const bar = (left: number, max: number) => Math.min(100, ((max - left) / max) * 100);

/** Панель «Мой запас» под шапкой: четыре плитки кошелька, ближайшие гарантии и главная кнопка */
export function StockPanel({
  s,
  energyLeft,
  cta,
  hint,
  onOpen,
  disabled,
  loading,
}: {
  s: CardsState;
  energyLeft: number;
  cta: ReactNode;
  hint?: string;
  onOpen: () => void;
  disabled: boolean;
  loading: boolean;
}) {
  const w = s.wallet;
  const [exOpen, setExOpen] = useState(false);
  useEffect(() => {
    if (!exOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setExOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exOpen]);
  const canDia = Math.floor(w.diamonds / PACK.diamonds);
  const epicLeft = Math.max(0, PACK.pityEpic - w.pityEpic);
  const legLeft = Math.max(0, PACK.pityLegend - w.pityLegend);
  const tiles: { k: CurKey; name: string; sub: string; value: string; segs?: boolean }[] = [
    { k: "packs", name: "Жетоны паков", sub: "за активность", value: fmt(w.packs) },
    { k: "diamonds", name: "Алмазы", sub: canDia ? `хватит на ${canDia} ${packWord(canDia)}` : `до пака не хватает ${PACK.diamonds - w.diamonds}`, value: fmt(w.diamonds) },
    { k: "dust", name: "Пыль", sub: "для кузницы", value: fmt(w.dust) },
    { k: "energy", name: "Энергия", sub: energyLeft > 0 ? `+1 через ${fmtLeft(energyLeft)}` : "для боёв", value: `${w.energy} / ${w.energyMax}`, segs: true },
  ];
  const gar = [
    { t: "Эпическая", left: epicLeft, now: w.pityEpic, max: PACK.pityEpic, c: RANKS[2].color },
    { t: "Легендарная", left: legLeft, now: w.pityLegend, max: PACK.pityLegend, c: RANKS[3].color },
  ];
  return (
    <section className="cg2-stock cg2-glass" aria-label="Мой запас">
      <span className="cg2-sxl" aria-hidden />
      <header className="sxh">
        Мой запас
        <span className="sxhr">
          <span className="cg-popwrap">
            <button type="button" className="cg-btn sm sx-ex" aria-expanded={exOpen} onClick={() => setExOpen((v) => !v)}>
              <Ico name="swap" size={15} /> Обмен AC → <Cur k="diamonds" size={15} />
              <Ico name="down" size={13} />
            </button>
            {exOpen && <ExchangePopover ac={s.ac} diamonds={w.diamonds} onDone={() => setExOpen(false)} />}
          </span>
          <i>онлайн</i>
        </span>
      </header>
      <div className="sxbody">
        <div className="sxL">
          {tiles.map((t) => (
            <div key={t.k} className="sxr" style={{ ["--c" as string]: CUR[t.k].color } as CSSProperties}>
              <span className="sxt">
                <CurArt k={t.k} size={24} />
              </span>
              <span className="sxn">
                {t.name}
                <small>{t.sub}</small>
              </span>
              <b className="sxv">{t.value}</b>
              {t.segs && (
                <span className="sxe" aria-hidden>
                  {Array.from({ length: w.energyMax }, (_, i) => (
                    <i key={i} className={i < w.energy ? "on" : undefined} />
                  ))}
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="sxR">
          <span className="sxs">Ближайшие гарантии</span>
          <div className="sxg">
            {gar.map((g) => (
              <div key={g.t} style={{ ["--c" as string]: g.c } as CSSProperties}>
                <span>
                  <b>{g.t}</b>
                  <em>{g.left <= 1 ? "в следующем паке" : `через ${g.left} ${packWord(g.left)}`}</em>
                </span>
                <i className="pb" role="progressbar" aria-valuemin={0} aria-valuemax={g.max} aria-valuenow={g.now} aria-label={`Серия без ${g.t.toLowerCase()}`}>
                  <u style={{ width: `${bar(g.left, g.max)}%` }} />
                </i>
                <small>
                  Серия без неё: {g.now} из {g.max}
                </small>
              </div>
            ))}
          </div>
          <div className="sxc">
            <button type="button" className="cg-btn pri cg2-cta" disabled={disabled} onClick={onOpen}>
              {loading ? <span className="cg-spin" /> : <Ico name="pack" size={18} />}
              {cta}
            </button>
            {hint && <small className="sxh2">{hint}</small>}
          </div>
        </div>
      </div>
    </section>
  );
}
