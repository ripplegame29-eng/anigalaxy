"use client";

import { useMemo, useState } from "react";
import { ACHIEVEMENTS, SHOWCASE_MAX, rewardText, type Reward } from "@/lib/cards/progress";
import { act, type CardsState } from "@/lib/cards/client";
import { GameCard } from "./GameCard";
import { InvPicker, Panel, fmt, fmtLeft, toast, useBusy, useNow } from "./common";
import { Ico, type IcoName } from "./icons";

const rewardChips = (r: Reward) => (
  <span className="pg-rw">
    {r.diamonds ? <span className="pg-rw-i d">{fmt(r.diamonds)} алм.</span> : null}
    {r.dust ? <span className="pg-rw-i u">{fmt(r.dust)} пыли</span> : null}
    {r.scroll ? <span className="pg-rw-i s">{r.scroll} свиток</span> : null}
    {r.packs ? <span className="pg-rw-i p">{r.packs} пак{r.packs > 1 ? "а" : ""}</span> : null}
  </span>
);

const tierClass = (done: number, total: number) => (done >= total ? "gold" : done >= 2 ? "silver" : done >= 1 ? "bronze" : "");

export function ProgressTab({ s }: { s: CardsState }) {
  const [busy, run] = useBusy();
  const [picking, setPicking] = useState(false);
  const now = useNow(30_000);
  const p = s.progress;
  const inv = s.inventory;
  const showcase = useMemo(() => p.showcase.map((id) => inv.find((c) => c.id === id)).filter((c): c is NonNullable<typeof c> => !!c), [p.showcase, inv]);

  const claim = (op: string, body: Record<string, unknown>, ok: string) =>
    run(async () => {
      const r = await act(op, body);
      toast(r.ok ? ok : r.error, !r.ok);
    });
  const toggleShow = (id: number) => {
    const ids = p.showcase.includes(id) ? p.showcase.filter((x) => x !== id) : [...p.showcase, id];
    if (ids.length > SHOWCASE_MAX) return;
    void claim("showcase", { ids }, "Витрина обновлена");
  };

  const readyAch = p.achievements.filter((a) => a.done > a.claimed).length;
  const left = p.weekEndsAt - now;
  const cycle = p.streak.claimedToday ? ((p.streak.n - 1) % 7) + 1 : p.streak.n % 7;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="cg-grid2">
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
        <Panel
          title="Серия входов"
          right={
            <span className="cg-chip">
              Серия: <b>{p.streak.n}</b> дн. · рекорд {p.streak.best}
            </span>
          }
          hint={`Каждый день подряд увеличивает подарок дня: сейчас +${p.streak.bonusPct}% (максимум +50%). Пропуск дня обнуляет серию.`}
        >
          <div className="pg-days" role="list">
            {Array.from({ length: 7 }).map((_, i) => {
              const day = i + 1;
              const done = p.streak.n > 0 && (p.streak.claimedToday ? day <= cycle : day <= cycle);
              const today = p.streak.claimedToday ? day === cycle : day === cycle + 1;
              return (
                <div key={day} role="listitem" className={`pg-day ${done ? "done" : ""} ${today ? "today" : ""}`}>
                  <small>День {day}</small>
                  <Ico name={done ? "check" : "gift"} size={18} />
                </div>
              );
            })}
          </div>
          <div className="pg-ms">
            {p.streak.milestones.map((m) => (
              <div key={m.day} className={`pg-m ${m.claimed ? "claimed" : p.streak.n >= m.day ? "ready" : ""}`}>
                <b>{m.day} дн.</b>
                {rewardChips(m.reward)}
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Статистика">
          <div className="pg-stats">
            {[
              ["Героев в коллекции", `${new Set(inv.map((c) => c.cardId)).size}`],
              ["Побед в боях", fmt(s.wallet.wins)],
              ["Лучшая серия побед", fmt(p.stats.streak ?? 0)],
              ["Открыто паков", fmt(p.stats.packs ?? 0)],
              ["Заточек", fmt(p.stats.sharpen ?? 0)],
              ["Уровней умений", fmt(p.stats.skillUps ?? 0)],
            ].map(([k, v]) => (
              <div key={k} className="pg-stat">
                <b>{v}</b>
                <small>{k}</small>
              </div>
            ))}
          </div>
        </Panel>
        </div>

        <Panel title="Недельные задания" right={<span className="cg-chip">Обновление через {fmtLeft(left)}</span>}>
          <ul className="cg-list">
            {p.weekly.map((m) => (
              <li key={m.id}>
                <span className="pg-wk">
                  <span>
                    {m.text} · {fmt(m.progress)}/{fmt(m.goal)}
                  </span>
                  <i className="pg-bar">
                    <b style={{ width: `${(m.progress / m.goal) * 100}%` }} />
                  </i>
                  {rewardChips(m.reward)}
                </span>
                <button type="button" className="cg-btn sm pri" disabled={busy || m.claimed || m.progress < m.goal} onClick={() => void claim("weekly-claim", { id: m.id }, "Награда получена")}>
                  {m.claimed ? "Получено" : "Забрать"}
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel
        title="Витрина профиля"
        hint={`До ${SHOWCASE_MAX} любимых карт: их видят другие игроки в вашем профиле коллекционера.`}
        right={
          <button type="button" className="cg-btn sm" onClick={() => setPicking((v) => !v)}>
            {picking ? "Скрыть коллекцию" : "Изменить"}
          </button>
        }
      >
        <div className="pg-show">
          {Array.from({ length: SHOWCASE_MAX }).map((_, i) =>
            showcase[i] ? (
              <button key={showcase[i].id} type="button" className="pg-show-c" onClick={() => toggleShow(showcase[i].id)} aria-label="Убрать из витрины">
                <GameCard cardId={showcase[i].cardId} foil={showcase[i].foil} level={showcase[i].level} live />
              </button>
            ) : (
              <button key={i} type="button" className="cg-slot" onClick={() => setPicking(true)} style={{ cursor: "pointer" }}>
                + Карта
              </button>
            ),
          )}
        </div>
        {picking && (
          <div style={{ marginTop: 14 }}>
            <InvPicker cards={inv} selected={p.showcase} onToggle={toggleShow} max={SHOWCASE_MAX} size="xs" />
          </div>
        )}
      </Panel>

      <Panel title="Достижения" right={readyAch > 0 ? <span className="cg-chip pg-ready">Готово к получению: {readyAch}</span> : undefined}>
        <div className="pg-ach">
          {ACHIEVEMENTS.map((a) => {
            const v = p.achievements.find((x) => x.id === a.id);
            if (!v) return null;
            const next = a.tiers[Math.min(v.claimed, a.tiers.length - 1)];
            const maxed = v.claimed >= a.tiers.length;
            const ready = v.done > v.claimed;
            const prevGoal = v.claimed > 0 ? a.tiers[v.claimed - 1].goal : 0;
            const pct = maxed ? 100 : Math.max(0, Math.min(100, ((v.value - prevGoal) / (next.goal - prevGoal)) * 100));
            return (
              <article key={a.id} className={`pg-a ${tierClass(v.claimed, a.tiers.length)} ${ready ? "ready" : ""}`}>
                <span className="pg-a-ico">
                  <Ico name={a.icon as IcoName} size={22} />
                </span>
                <div className="pg-a-txt">
                  <b>{a.name}</b>
                  <small>{a.desc}</small>
                  <i className="pg-bar">
                    <b style={{ width: `${pct}%` }} />
                  </i>
                  <span className="pg-a-foot">
                    <span>{maxed ? "Все ступени пройдены" : `${fmt(Math.min(v.value, next.goal))} / ${fmt(next.goal)}`}</span>
                    <span className="pg-pips" aria-label={`Ступеней: ${v.claimed} из ${a.tiers.length}`}>
                      {a.tiers.map((_, i) => (
                        <i key={i} className={i < v.claimed ? "on" : i < v.done ? "rdy" : ""} />
                      ))}
                    </span>
                  </span>
                  {!maxed && rewardChips(next.reward)}
                </div>
                <button type="button" className="cg-btn sm pri" disabled={busy || !ready} onClick={() => void claim("ach-claim", { id: a.id }, `«${a.name}»: награда получена`)}>
                  {ready ? "Забрать" : maxed ? "MAX" : "В пути"}
                </button>
              </article>
            );
          })}
        </div>
      </Panel>

      <Panel title="Наборы по аниме" hint="Собирайте героев одного аниме: награда за половину набора и за полный набор. Герои без арта в набор не входят.">
        <div className="pg-sets">
          {p.sets.map((st) => (
            <article key={st.series} className={`pg-set ${st.owned >= st.size ? "full" : ""}`}>
              <header>
                <b>{st.series}</b>
                <span>
                  {st.owned}/{st.size}
                </span>
              </header>
              <i className="pg-bar">
                <b style={{ width: `${(st.owned / st.size) * 100}%` }} />
                <em style={{ left: `${(st.need[0] / st.size) * 100}%` }} />
              </i>
              <div className="pg-set-btns">
                {st.need.map((need, i) => (
                  <button
                    key={i}
                    type="button"
                    className="cg-btn sm"
                    disabled={busy || st.claimed[i] || st.owned < need || (i === 1 && !st.claimed[0])}
                    onClick={() => void claim("set-claim", { series: st.series, tier: i }, "Награда за набор получена")}
                  >
                    {st.claimed[i] ? "Получено" : i === 0 ? `Половина · ${need}` : `Полный · ${need}`}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      </Panel>
      <p className="cg-hint" style={{ textAlign: "center" }}>
        Награда набора: {rewardText({ diamonds: 40, dust: 100 })} за половину и {rewardText({ diamonds: 150, dust: 400, packs: 1, scroll: 1 })} за полный набор.
      </p>
    </div>
  );
}
