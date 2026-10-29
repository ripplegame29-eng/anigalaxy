"use client";

import { useCallback, useEffect, useState } from "react";
import { cardDef } from "@/lib/cards/catalog";
import { BATTLE } from "@/lib/cards/config";
import { STAGES, STAR_TEXT, chapterReward, stageReward, type ChapterView } from "@/lib/cards/campaign";
import { rewardText } from "@/lib/cards/progress";
import { RAID_TIERS, type RaidView } from "@/lib/cards/raid";
import { act, view, type CardsState } from "@/lib/cards/client";
import type { BattleReport } from "./Arena";
import { GameCard } from "./GameCard";
import { Panel, ago, fmt, fmtLeft, toast, useBusy, useNow } from "./common";
import { Cur, Ico } from "./icons";

type Report = BattleReport;

function Stars({ n, size = 16 }: { n: number; size?: number }) {
  return (
    <span className="cp-stars" aria-label={`Звёзд: ${n} из 3`}>
      {[0, 1, 2].map((i) => (
        <Ico key={i} name="star" size={size} className={i < n ? "on" : ""} />
      ))}
    </span>
  );
}

/* --------------------------------- кампания -------------------------------- */
export function CampaignView({ s, onReport }: { s: CardsState; onReport: (r: Report) => void }) {
  const [list, setList] = useState<ChapterView[] | null>(null);
  const [cur, setCur] = useState(0);
  const [busy, run] = useBusy();
  const w = s.wallet;
  const deckReady = w.deck.length >= 4;

  const load = useCallback(async () => {
    const r = await view<ChapterView[]>("campaign");
    if (r.ok) setList(r.data);
  }, []);
  useEffect(() => {
    let alive = true;
    void view<ChapterView[]>("campaign").then((r) => {
      if (alive && r.ok) {
        setList(r.data);
        const open = r.data.filter((c) => c.unlocked);
        setCur((c) => (c === 0 ? Math.max(0, open.findIndex((x) => !x.cleared)) : c));
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!list) return <div className="cg-empty">Загрузка кампании…</div>;
  const ch = list[cur] ?? list[0];
  const total = list.reduce((a, c) => a + c.stars, 0);
  const max = list.reduce((a, c) => a + c.maxStars, 0);

  const go = (st: number, training: boolean) =>
    run(async () => {
      const r = await act<Report>("camp-fight", { chapter: ch.id, stage: st, training });
      if (!r.ok) return toast(r.error, true);
      onReport(r.result);
      void load();
    });
  const claim = (tier: 0 | 1) =>
    run(async () => {
      const r = await act<{ reward: Parameters<typeof rewardText>[0] }>("camp-claim", { chapter: ch.id, tier });
      toast(r.ok ? `Награда главы: ${rewardText(r.result.reward)}` : r.error, !r.ok);
      void load();
    });

  return (
    <div className="cp">
      <div className="cp-chapters" role="tablist" aria-label="Главы">
        {list.map((c) => (
          <button key={c.id} type="button" role="tab" aria-selected={cur === c.id} disabled={!c.unlocked} className={`cp-chap ${c.cleared ? "done" : ""}`} onClick={() => setCur(c.id)}>
            <small>Глава {c.id + 1}</small>
            <b>{c.series}</b>
            <span>
              {c.unlocked ? (
                <>
                  <Ico name="star" size={12} /> {c.stars}/{c.maxStars}
                </>
              ) : (
                <Ico name="lock" size={12} />
              )}
            </span>
          </button>
        ))}
      </div>
      <Panel
        title={`Глава ${ch.id + 1}: ${ch.series}`}
        hint={`Победа даёт ★. Ещё по звезде за победу не позже 8-го раунда и за бой без потерь. Всего в кампании: ${total}/${max} ★.`}
        right={<Stars n={Math.round((ch.stars / ch.maxStars) * 3)} size={18} />}
      >
        <ol className="cp-stages">
          {ch.stages.map((st) => (
            <li key={st.stage} className={`cp-stage ${st.boss ? "boss" : ""} ${st.unlocked ? "" : "locked"}`}>
              <div className="cp-no">{st.boss ? <Ico name="skull" size={18} /> : st.stage + 1}</div>
              <div className="cp-enemy">
                {st.enemy.map((e, i) => (
                  <GameCard key={i} cardId={e.cardId} level={e.level} stats={false} className={st.boss && i === 0 ? "cp-boss" : ""} />
                ))}
              </div>
              <div className="cp-info">
                <b>{st.boss ? "Босс главы" : `Этап ${st.stage + 1}`}</b>
                <Stars n={st.stars} />
                <small>{st.stars === 0 ? `Первая победа: ${rewardText(stageReward(ch.id, st.stage))}` : STAR_TEXT[Math.min(st.stars, 2)] && st.stars < 3 ? `Следующая ★: ${STAR_TEXT[st.stars]}` : "Пройдено на максимум"}</small>
              </div>
              <div className="cp-act">
                <button type="button" className="cg-btn pri sm" disabled={busy || !st.unlocked || !deckReady || w.energy < BATTLE.energyCost} onClick={() => void go(st.stage, false)}>
                  В бой · <Cur k="energy" /> {BATTLE.energyCost}
                </button>
                <button type="button" className="cg-btn sm" disabled={busy || !st.unlocked || !deckReady} onClick={() => void go(st.stage, true)}>
                  Тренировка
                </button>
              </div>
            </li>
          ))}
        </ol>
        {!deckReady && <p className="cg-hint">Соберите отряд из 4 героев на вкладке «Рейтинг».</p>}
        <div className="cp-claims">
          {([0, 1] as const).map((t) => {
            const ok = t === 0 ? ch.cleared : ch.stars >= ch.maxStars;
            return (
              <div key={t} className="cp-claim">
                <span>
                  <b>{t === 0 ? "Глава пройдена" : `Все ${ch.maxStars} звёзд`}</b>
                  <small>{rewardText(chapterReward(ch.id, t))}</small>
                </span>
                <button type="button" className="cg-btn gold sm" disabled={busy || !ok || ch.claimed[t]} onClick={() => void claim(t)}>
                  {ch.claimed[t] ? "Получено" : "Забрать"}
                </button>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

/* ----------------------------------- рейд ---------------------------------- */
export function RaidPanel({ s, onReport }: { s: CardsState; onReport: (r: Report) => void }) {
  const [v, setV] = useState<RaidView | null>(null);
  const [busy, run] = useBusy();
  const now = useNow(1000);
  const w = s.wallet;
  const load = useCallback(async () => {
    const r = await view<RaidView>("raid");
    if (r.ok) setV(r.data);
  }, []);
  useEffect(() => {
    let alive = true;
    void view<RaidView>("raid").then((r) => alive && r.ok && setV(r.data));
    return () => {
      alive = false;
    };
  }, []);
  if (!v) return <div className="cg-empty">Загрузка рейда…</div>;
  const def = cardDef(v.boss);
  const pct = Math.max(0, Math.min(100, (v.hp / v.maxHp) * 100));
  const fight = () =>
    run(async () => {
      const r = await act<Report>("raid-fight");
      if (!r.ok) return toast(r.error, true);
      onReport(r.result);
      void load();
    });
  const claim = () =>
    run(async () => {
      const r = await act<{ reward: Parameters<typeof rewardText>[0] }>("raid-claim");
      toast(r.ok ? `Награда рейда: ${rewardText(r.result.reward)}` : r.error, !r.ok);
      void load();
    });
  const claimable = RAID_TIERS.filter((t, i) => v.mine.damage >= t.damage && i >= v.mine.claimed).length > 0 || (v.defeated && !v.defeatClaimed && v.mine.damage > 0);
  return (
    <div className="cg-grid2">
      <Panel title="Рейд-босс недели" hint={`Босс общий для всех игроков. Каждый удар — бой на ${fmt(v.fightHp)} здоровья отряда против босса; нанесённый урон списывается с общего запаса. До конца: ${fmtLeft(v.endsAt - now)}.`}>
        <div className="rd-boss">
          <GameCard cardId={v.boss} level={1} stats={false} live />
          <div className="rd-meta">
            <h3>{def?.name ?? "Босс"}</h3>
            <p className="cg-hint">{def?.series}</p>
            <div className="rd-hp" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Здоровье босса">
              <i style={{ width: `${pct}%` }} />
              <span>
                {fmt(v.hp)} / {fmt(v.maxHp)}
              </span>
            </div>
            {v.defeated && <p className="rd-down">Босс повержен — все участники получают бонус.</p>}
            <div className="cg-row">
              <button type="button" className="cg-btn pri" disabled={busy || v.defeated || v.hitsLeft <= 0 || w.deck.length < 4 || w.energy < BATTLE.energyCost} onClick={() => void fight()}>
                Ударить · <Cur k="energy" /> {BATTLE.energyCost}
              </button>
              <span className="cg-chip">Попыток сегодня: {v.hitsLeft}</span>
              <span className="cg-chip">Ваш урон: {fmt(v.mine.damage)}</span>
            </div>
          </div>
        </div>
      </Panel>
      <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
        <Panel title="Награды по урону" right={<button type="button" className="cg-btn gold sm" disabled={busy || !claimable} onClick={() => void claim()}>Забрать</button>}>
          <ul className="cg-list rd-tiers">
            {RAID_TIERS.map((t, i) => (
              <li key={t.damage} className={v.mine.damage >= t.damage ? "ok" : ""}>
                <span>
                  <b>{fmt(t.damage)} урона</b>
                  <br />
                  <small>{rewardText(t.reward)}</small>
                </span>
                {i < v.mine.claimed ? <Ico name="check" size={16} /> : v.mine.damage >= t.damage ? <small>можно забрать</small> : <small>{fmt(t.damage - v.mine.damage)} осталось</small>}
              </li>
            ))}
            <li className={v.defeated ? "ok" : ""}>
              <span>
                <b>Босс повержен</b>
                <br />
                <small>{rewardText(v.defeatReward)}</small>
              </span>
              {v.defeatClaimed ? <Ico name="check" size={16} /> : <small>{v.defeated ? "можно забрать" : "общая цель"}</small>}
            </li>
          </ul>
        </Panel>
        <Panel title="Таблица урона">
          {v.top.length === 0 ? (
            <div className="cg-empty">Пока никто не ударил — будьте первым</div>
          ) : (
            <ul className="cg-list">
              {v.top.map((t, i) => (
                <li key={t.nick}>
                  <span>
                    <b>#{i + 1}</b> {t.nick}
                  </span>
                  <span>
                    {fmt(t.damage)} · {t.hits} уд.
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ----------------------------- дуэли и журнал ------------------------------ */
interface LogRow {
  id: number;
  kind: string;
  opp: string;
  win: boolean;
  delta: number;
  title: string;
  at: number;
}
const KIND: Record<string, string> = { ladder: "Рейтинг", duel: "Дуэль", defense: "Защита", campaign: "Кампания", raid: "Рейд" };

export function DuelPanel({ s, onReport, onProfile, nick, setNick }: { s: CardsState; onReport: (r: Report) => void; onProfile: (n: string) => void; nick: string; setNick: (v: string) => void }) {
  const [log, setLog] = useState<LogRow[] | null>(null);
  const [busy, run] = useBusy();
  const now = useNow(30_000);
  const w = s.wallet;
  const load = useCallback(async () => {
    const r = await view<LogRow[]>("battlelog");
    if (r.ok) setLog(r.data);
  }, []);
  useEffect(() => {
    let alive = true;
    void view<LogRow[]>("battlelog").then((r) => alive && r.ok && setLog(r.data));
    return () => {
      alive = false;
    };
  }, []);
  const send = () =>
    run(async () => {
      const r = await act<Report>("challenge", { nick });
      if (!r.ok) return toast(r.error, true);
      onReport(r.result);
      void load();
    });
  const replay = (id: number) =>
    run(async () => {
      const r = await view<Report>("replay", `&id=${id}`);
      if (!r.ok) return toast(r.error, true);
      onReport({ ...r.data, training: true });
    });
  return (
    <div className="cg-grid2">
      <Panel title="Вызов игрока" hint="Бой идёт против сохранённого отряда соперника — он не обязан быть онлайн. Победа даёт награды и рейтинг, поражение меньше штрафует. Один и тот же игрок доступен раз в 30 минут.">
        <form
          className="cg-row"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <input className="cg-input" placeholder="Ник соперника" value={nick} maxLength={32} onChange={(e) => setNick(e.target.value)} aria-label="Ник соперника" />
          <button type="submit" className="cg-btn pri" disabled={busy || !nick.trim() || w.deck.length < 4 || w.energy < BATTLE.energyCost}>
            Бросить вызов · <Cur k="energy" /> {BATTLE.energyCost}
          </button>
          {nick.trim() && (
            <button type="button" className="cg-btn" onClick={() => onProfile(nick.trim())}>
              Профиль
            </button>
          )}
        </form>
      </Panel>
      <Panel title="Журнал боёв" hint="Последние 40 боёв, включая защиту, пока вы были не в сети. Любой можно пересмотреть.">
        {!log ? (
          <div className="cg-empty">Загрузка…</div>
        ) : log.length === 0 ? (
          <div className="cg-empty">Боёв пока нет</div>
        ) : (
          <ul className="cg-list bl-list">
            {log.map((l) => (
              <li key={l.id} className={l.win ? "win" : "lose"}>
                <span>
                  <b className="bl-res">{l.win ? "Победа" : "Поражение"}</b> · {KIND[l.kind] ?? l.kind}
                  <br />
                  <small>
                    {l.title || (l.opp ? `против ${l.opp}` : "")} · {ago(l.at, now)}
                    {l.delta ? ` · рейтинг ${l.delta > 0 ? "+" : ""}${l.delta}` : ""}
                  </small>
                </span>
                <button type="button" className="cg-btn sm" disabled={busy} onClick={() => void replay(l.id)}>
                  <Ico name="eye" size={14} /> Повтор
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

export { STAGES };
