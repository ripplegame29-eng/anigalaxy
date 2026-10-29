"use client";

import { useEffect, useRef } from "react";
import { PASS, PASS_XP, PASS_XP_DAILY, PASS_XP_MISSION, passReward, type PassTrack } from "@/lib/cards/season";
import { rewardText, type Reward } from "@/lib/cards/progress";
import { act, type CardsState } from "@/lib/cards/client";
import { Panel, fmt, fmtLeft, toast, useBusy, useNow } from "./common";
import { Cur, Ico } from "./icons";

const XP_ROWS: [string, string][] = [
  ["wins", "Победа в бою"],
  ["raidHits", "Удар по рейд-боссу"],
  ["stars", "Новая звезда кампании"],
  ["trades", "Обмен или сделка на аукционе"],
  ["packs", "Открытый пак"],
  ["skillUps", "Прокачка умения"],
  ["sharpen", "Заточка карты"],
  ["evo", "Пробуждение карты"],
];

function RewardChips({ r }: { r: Reward }) {
  return (
    <span className="ps-rw">
      {r.diamonds ? <span><Cur k="diamonds" size={13} /> {r.diamonds}</span> : null}
      {r.dust ? <span><Cur k="dust" size={13} /> {r.dust}</span> : null}
      {r.packs ? <span><Cur k="packs" size={13} /> {r.packs}</span> : null}
      {r.scroll ? <span title={rewardText(r)}><Ico name="scroll" size={13} /> {r.scroll}</span> : null}
    </span>
  );
}

export function SeasonTab({ s }: { s: CardsState }) {
  const p = s.events.pass;
  const [busy, run] = useBusy();
  const now = useNow(60_000);
  const cur = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    cur.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, []);

  const claim = (track: PassTrack, level: number) =>
    run(async () => {
      const r = await act<{ reward: Reward; count: number }>("pass-claim", { track, level });
      toast(r.ok ? `Награда пасса: ${rewardText(r.result.reward)}` : r.error, !r.ok);
    });
  const buy = () =>
    run(async () => {
      const r = await act("pass-buy");
      toast(r.ok ? "Премиум-ветка открыта" : r.error, !r.ok);
    });

  const levels = Array.from({ length: PASS.levels }, (_, i) => i + 1);
  const availableFree = levels.filter((l) => l <= p.level && !p.free.includes(l)).length;
  const availablePrem = p.bought ? levels.filter((l) => l <= p.level && !p.premium.includes(l)).length : 0;
  const pct = Math.min(100, (p.into / PASS.xpPerLevel) * 100);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section className="ps-hero">
        <div>
          <span className="cg-eyebrow">Сезон {p.season % 100}</span>
          <h2 className="ps-title">Сезонный пасс</h2>
          <p className="cg-hint" style={{ margin: 0 }}>
            Очки идут за бои, паки, кампанию, рейд, обмены и подарок дня. До конца сезона: {fmtLeft(p.endsAt - now)}.
          </p>
        </div>
        <div className="ps-lvl" aria-label={`Уровень ${p.level} из ${PASS.levels}`}>
          <b>{p.level}</b>
          <small>/ {PASS.levels}</small>
        </div>
        <div className="ps-bar">
          <div className="ps-bar-top">
            <span>{p.level >= PASS.levels ? "Максимальный уровень" : `До уровня ${p.level + 1}`}</span>
            <span>
              {p.level >= PASS.levels ? fmt(p.xp) : `${p.into} / ${PASS.xpPerLevel}`} оч.
            </span>
          </div>
          <div className="ps-track" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
            <i style={{ width: `${p.level >= PASS.levels ? 100 : pct}%` }} />
          </div>
        </div>
        <div className="cg-row">
          {!p.bought && (
            <button type="button" className="cg-btn gold" disabled={busy || s.wallet.diamonds < p.price} onClick={() => void buy()}>
              <Ico name="crown" size={15} /> Премиум-ветка · {p.price} <Cur k="diamonds" />
            </button>
          )}
          <button type="button" className="cg-btn pri" disabled={busy || availableFree + availablePrem === 0} onClick={() => void run(async () => { await claim("free", 0); if (p.bought) await claim("premium", 0); })}>
            Забрать всё ({availableFree + availablePrem})
          </button>
        </div>
      </section>

      <Panel title="Награды" hint={p.bought ? "Обе ветки открыты." : "Бесплатная ветка доступна всем; премиум-ветка даёт больше паков, свитков и алмазов."}>
        <div className="ps-grid" role="list">
          <div className="ps-legend">
            <span />
            <span>Бесплатно</span>
            <span className="prem"><Ico name="crown" size={13} /> Премиум</span>
          </div>
          <ol className="ps-cols">
            {levels.map((l) => {
              const reached = l <= p.level;
              const rf = passReward(l, "free");
              const rp = passReward(l, "premium");
              const doneF = p.free.includes(l);
              const doneP = p.premium.includes(l);
              return (
                <li key={l} ref={l === Math.max(1, p.level) ? cur : undefined} className={`ps-col ${reached ? "reached" : ""} ${l % 5 === 0 ? "big" : ""}`}>
                  <b className="ps-n">{l}</b>
                  <button type="button" className={`ps-cell ${doneF ? "done" : ""}`} disabled={busy || !reached || doneF} onClick={() => void claim("free", l)} aria-label={`Уровень ${l}, бесплатная награда: ${rewardText(rf)}`}>
                    <RewardChips r={rf} />
                    {doneF && <Ico name="check" size={14} />}
                  </button>
                  <button type="button" className={`ps-cell prem ${doneP ? "done" : ""} ${p.bought ? "" : "lock"}`} disabled={busy || !reached || doneP || !p.bought} onClick={() => void claim("premium", l)} aria-label={`Уровень ${l}, премиум-награда: ${rewardText(rp)}`}>
                    <RewardChips r={rp} />
                    {doneP ? <Ico name="check" size={14} /> : !p.bought ? <Ico name="lock" size={12} /> : null}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </Panel>

      <Panel title="Как набрать очки">
        <ul className="cg-list">
          <li>
            <span>Подарок дня</span>
            <b>+{PASS_XP_DAILY}</b>
          </li>
          <li>
            <span>Выполненное задание дня</span>
            <b>+{PASS_XP_MISSION}</b>
          </li>
          {XP_ROWS.map(([k, label]) => (
            <li key={k}>
              <span>{label}</span>
              <b>+{PASS_XP[k]}</b>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
