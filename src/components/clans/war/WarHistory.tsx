"use client";

import { CW, type CwHistoryRow } from "@/lib/cards/clanwar";
import { Cur, Ico } from "@/components/cards/icons";
import { TrophyIcon } from "../ClanArt";
import { agoText, useNowTick } from "./shared";

const LABEL = { win: "Победа", lose: "Поражение", draw: "Ничья" } as const;

export function WarHistory({ rows }: { rows: CwHistoryRow[] }) {
  const now = useNowTick(60_000);
  if (!rows.length) return null;
  return (
    <section className="cw-card cw-hist" aria-label="История войн">
      <div className="cw-card-head">
        <h3 className="cw-h3">История войн</h3>
        <span className="cw-note">{rows.length}</span>
      </div>
      <ul className="cw-hist-list">
        {rows.map((r) => {
          const tr = CW.trophies[r.result];
          return (
            <li key={r.id} className={`cw-hist-row ${r.result}`}>
              <span className={`cw-badge ${r.result}`}>{LABEL[r.result]}</span>
              <span className="cw-hist-vs">
                <b>{r.vsName}</b>
                <small>
                  {r.size}×{r.size}
                  {r.bot ? " · отряд сервера" : ""} · {agoText(r.at, now)}
                </small>
              </span>
              <span className="cw-hist-score">
                <b>{r.scoreMine}</b>
                <i>:</i>
                <b>{r.scoreFoe}</b>
              </span>
              <span className={`cw-hist-tr ${tr >= 0 ? "up" : "down"}`}>
                <TrophyIcon size={14} />
                {tr > 0 ? `+${tr}` : tr}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Итоговый экран только что закончившейся войны. Подробностей MVP сервер пока не отдаёт — показываем награды по правилам. */
export function WarDone({ row, onClose }: { row: CwHistoryRow; onClose: () => void }) {
  const res = row.result;
  const reward = res === "win" ? CW.memberWin : res === "lose" ? CW.memberLose : CW.memberDraw;
  const title = res === "win" ? "Победа!" : res === "lose" ? "Поражение" : "Ничья";
  return (
    <section className={`cw-done ${res}`} aria-label="Итоги войны">
      <div className="cw-done-glow" aria-hidden />
      <div className="cw-done-ico" aria-hidden>
        <Ico name={res === "win" ? "crown" : res === "lose" ? "skull" : "swords"} size={44} />
      </div>
      <p className="cw-eyebrow">Война завершена</p>
      <h2 className="cw-done-title">{title}</h2>
      <div className="cw-done-score">
        <b>{row.scoreMine}</b>
        <i>:</i>
        <b>{row.scoreFoe}</b>
      </div>
      <p className="cw-done-vs">
        против «{row.vsName}» · {row.size}×{row.size}
      </p>
      <ul className="cw-done-rew">
        <li>
          <TrophyIcon size={20} />
          <b>{CW.trophies[res] > 0 ? `+${CW.trophies[res]}` : CW.trophies[res]}</b>
          <small>кубков клану</small>
        </li>
        <li>
          <Ico name="bolt" size={20} />
          <b>+{CW.clanXp[res]}</b>
          <small>опыта клана</small>
        </li>
        {reward.diamonds ? (
          <li>
            <Cur k="diamonds" size={20} />
            <b>+{reward.diamonds}</b>
            <small>алмазов бойцам</small>
          </li>
        ) : null}
        {reward.packs ? (
          <li>
            <Cur k="packs" size={20} />
            <b>+{reward.packs}</b>
            <small>пак бойцам</small>
          </li>
        ) : null}
      </ul>
      <p className="cw-note center">Награды участникам и лучшему бойцу уже выданы. Список — ниже.</p>
      <button
        type="button"
        className="cw-btn primary"
        onClick={onClose}
      >
        К новой войне
      </button>
    </section>
  );
}
