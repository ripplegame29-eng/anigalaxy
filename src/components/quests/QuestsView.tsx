"use client";

/**
 * Страница квестов.
 *
 * Все данные настоящие: задания и награды — из конфига прогрессии, прогресс
 * и «забрано» — из документа прогрессии, награды выдаёт движок по событию
 * QUEST_CLAIMED. Страница ничего не начисляет сама.
 *
 * От остальных вкладок профиля отличается «Маршрутом дня»: три узла на одной
 * линии, которая заполняется по мере выполнения заданий, и кнопкой
 * «Забрать всё», закрывающей сразу все готовые квесты.
 */

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { isPremiumActive } from "@/lib/auth";
import { useAccount } from "@/lib/use-account";
import { progressEmit, useLevelInfo, useProgress } from "@/lib/progression/events";
import { PROGRESSION_CONFIG } from "@/lib/progression/progression.config";
import { BATTLEPASS, BP_MISSIONS } from "@/lib/battlepass/config";
import { bpMissionValue } from "@/lib/battlepass/logic";
import { PREMIUM_QUEST_MULT } from "@/lib/premium-perks";

type Tab = "daily" | "weekly" | "season";
type Def = (typeof PROGRESSION_CONFIG.quests.dailyPool)[number];

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const pad = (n: number) => String(n).padStart(2, "0");

/** Иконка по метрике квеста: штрих 24×24 */
function glyph(metric: string): React.ReactNode {
  if (metric.startsWith("EPISODES") || metric.startsWith("TITLES"))
    return <path d="M7 4.5v15l12-7.5z" />;
  if (metric.startsWith("MINUTES"))
    return (<><circle cx="12" cy="12" r="8" /><path d="M12 7.5V12l3 2" /></>);
  if (metric.startsWith("RATINGS"))
    return <path d="m12 4 2.4 5 5.4.7-4 3.8 1 5.4L12 16.3 7.2 18.9l1-5.4-4-3.8 5.4-.7z" />;
  if (metric.startsWith("COMMENTS"))
    return <path d="M5 6.5h14a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5h-7l-4 3v-3H5A1.5 1.5 0 0 1 3.5 15V8A1.5 1.5 0 0 1 5 6.5z" />;
  if (metric.startsWith("FAVORITES") || metric.startsWith("LIST"))
    return <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />;
  return <path d="m13 3-7 10h5l-1 8 8-11h-5z" />;
}

function Icon({ metric }: { metric: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {glyph(metric)}
    </svg>
  );
}

/** Россыпь искр из точки клика — чисто визуальный отклик на «Забрать» */
function burst(origin: HTMLElement) {
  const rect = origin.getBoundingClientRect();
  const layer = document.createElement("div");
  layer.className = "qs-burst";
  layer.style.left = `${rect.left + rect.width / 2}px`;
  layer.style.top = `${rect.top + rect.height / 2}px`;
  for (let i = 0; i < 18; i += 1) {
    const spark = document.createElement("i");
    const angle = (Math.PI * 2 * i) / 18 + Math.random() * 0.4;
    const dist = 50 + Math.random() * 70;
    spark.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
    spark.style.setProperty("--dy", `${Math.sin(angle) * dist}px`);
    spark.style.setProperty("--d", `${Math.random() * 90}ms`);
    layer.appendChild(spark);
  }
  document.body.appendChild(layer);
  window.setTimeout(() => layer.remove(), 1100);
}

export function QuestsView() {
  const account = useAccount();
  const progress = useProgress();
  const level = useLevelInfo();
  const premium = isPremiumActive(account);
  const [tab, setTab] = useState<Tab>("daily");
  const [now, setNow] = useState<number | null>(null);
  const claimRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const cfg = PROGRESSION_CONFIG.quests;
  const find = (id: string): Def | undefined =>
    cfg.dailyPool.find((q) => q.id === id) ?? cfg.weeklyPool.find((q) => q.id === id);

  const daily = progress.quests.daily;
  const weekly = progress.quests.weekly;

  const rows = (list: typeof daily) =>
    list
      .map((inst) => ({ inst, def: find(inst.questId) }))
      .filter((row): row is { inst: (typeof daily)[number]; def: Def } => Boolean(row.def));

  const dailyRows = rows(daily);
  const weeklyRows = rows(weekly);
  const all = [...dailyRows, ...weeklyRows];

  const ready = all.filter(({ inst }) => inst.done && !inst.claimed);
  const open = all.filter(({ inst }) => !inst.claimed);
  const potentialXp = open.reduce((sum, { def }) => sum + def.xp, 0);
  const potentialAc = open.reduce((sum, { def }) => sum + def.ac, 0);
  const mult = premium ? PREMIUM_QUEST_MULT : 1;

  const dailyClaimed = dailyRows.filter(({ inst }) => inst.claimed).length;
  const dailyDone = dailyRows.filter(({ inst }) => inst.done).length;
  const weeklyClaimed = weeklyRows.filter(({ inst }) => inst.claimed).length;

  const left = useMemo(() => {
    if (now === null) return null;
    const next = new Date(now);
    next.setHours(24, 0, 0, 0);
    const ms = Math.max(0, next.getTime() - now);
    return { h: Math.floor(ms / 3_600_000), m: Math.floor((ms % 3_600_000) / 60_000), s: Math.floor((ms % 60_000) / 1000), pct: 1 - ms / 86_400_000 };
  }, [now]);

  const claim = (id: string, el: HTMLElement | null) => {
    if (el) burst(el);
    progressEmit({ type: "QUEST_CLAIMED", questId: id });
  };
  const claimMission = (id: string, el: HTMLElement | null) => {
    if (el) burst(el);
    progressEmit({ type: "BP_MISSION_CLAIMED", missionId: id });
  };
  const claimAll = () => {
    if (claimRef.current) burst(claimRef.current);
    for (const { inst } of ready) progressEmit({ type: "QUEST_CLAIMED", questId: inst.questId });
    for (const mission of missionsReady) progressEmit({ type: "BP_MISSION_CLAIMED", missionId: mission.id });
  };

  /* --------------------------- Сезон (пропуск) --------------------------- */
  const missionValue = (m: (typeof BP_MISSIONS)[number]) => bpMissionValue(m, progress.battlepass);
  const missionsClaimedIds = progress.battlepass.missions ?? [];
  const missionsClaimed = BP_MISSIONS.filter((m) => missionsClaimedIds.includes(m.id)).length;
  const missionsReady = BP_MISSIONS.filter((m) => missionValue(m) >= m.target && !missionsClaimedIds.includes(m.id));
  const daysLeftSeason = now === null ? 0 : Math.max(0, Math.ceil((BATTLEPASS.to - now) / 86_400_000));

  const R = 44;
  const CIRC = 2 * Math.PI * R;

  const questCard = (row: { inst: (typeof daily)[number]; def: Def }, index: number) => {
    const { inst, def } = row;
    const target = Math.max(1, def.target);
    const value = Math.min(inst.progress, target);
    const pct = Math.round((value / target) * 100);
    const isReady = inst.done && !inst.claimed;
    return (
      <li
        key={inst.questId}
        className={`qs-card${isReady ? " is-ready" : ""}${inst.claimed ? " is-claimed" : ""}`}
        style={{ ["--n" as string]: index, ["--p" as string]: `${pct}%` }}
      >
        <span className="qs-ic"><Icon metric={def.metric} /></span>
        <div className="qs-body">
          <div className="qs-top">
            <h3>{def.title}</h3>
            <div className="qs-rew">
              <b>+{def.xp * mult} XP</b>
              <b className="ac">+{def.ac * mult} AC</b>
            </div>
          </div>
          <p>{def.description}</p>
          <div className="qs-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <i />
          </div>
          <div className="qs-foot">
            <span>{value} / {target} {def.unit}</span>
            <button
              type="button"
              disabled={!isReady}
              onClick={(event) => claim(inst.questId, event.currentTarget)}
              className={inst.claimed ? "done" : isReady ? "go" : undefined}
            >
              {inst.claimed ? "Забрано ✓" : isReady ? "Забрать" : `${pct}%`}
            </button>
          </div>
        </div>
      </li>
    );
  };

  return (
    <div className="qs-page">
      <div className="qs-wrap">
        {/* ------------------------------ Герой ------------------------------ */}
        <header className="qs-hero">
          <div className="qs-hero-glow" aria-hidden />
          <div className="qs-hero-main">
            <p className="qs-eyebrow">Задания</p>
            <h1>Квесты <em>галактики</em></h1>
            <p className="qs-lead">Смотрите, оценивайте, комментируйте — и забирайте опыт и аникойны.</p>

            <div className="qs-timer" role="timer" aria-label="До сброса ежедневных квестов">
              <small>Сброс через</small>
              <div>
                {left ? (
                  <>
                    <b>{pad(left.h)}</b><i>:</i><b>{pad(left.m)}</b><i>:</i><b key={left.s}>{pad(left.s)}</b>
                  </>
                ) : (
                  <b>--:--:--</b>
                )}
              </div>
              <span className="qs-day-bar"><i style={{ width: `${Math.round((left?.pct ?? 0) * 100)}%` }} /></span>
            </div>
          </div>

          <div className="qs-hero-side">
            <div className="qs-ring" role="img" aria-label={`Уровень ${level.level}`}>
              <svg viewBox="0 0 100 100" aria-hidden>
                <defs>
                  <linearGradient id="qs-ring-g" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#2b7fff" />
                    <stop offset="1" stopColor="#22d3ee" />
                  </linearGradient>
                </defs>
                <circle cx="50" cy="50" r={R} className="bg" />
                <circle cx="50" cy="50" r={R} className="fg" strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - level.percent / 100)} transform="rotate(-90 50 50)" />
              </svg>
              <div><small>Уровень</small><b>{level.level}</b><span>{level.into} / {level.need} XP</span></div>
            </div>
            <div className="qs-chips">
              <span><small>AC</small><b>{progress.progress.acBalance.toLocaleString("ru-RU")}</b></span>
              <span><small>Серия</small><b>{progress.progress.streakCurrent} дн.</b></span>
              <span className={premium ? "gold" : undefined}><small>Награды</small><b>×{mult}</b></span>
            </div>
          </div>
        </header>

        {/* ---------------------------- Маршрут дня --------------------------- */}
        <section className="qs-route" aria-label="Маршрут дня">
          <div className="qs-route-head">
            <div>
              <h2>Маршрут дня</h2>
              <p>
                {dailyRows.length === 0
                  ? "Квесты появятся после первого захода сегодня."
                  : dailyClaimed === dailyRows.length
                    ? "Маршрут пройден — все награды забраны. Новый откроется завтра."
                    : `Выполнено ${dailyDone} из ${dailyRows.length}, забрано ${dailyClaimed}.`}
              </p>
            </div>
            <button
              ref={claimRef}
              type="button"
              className="qs-all"
              disabled={ready.length + missionsReady.length === 0}
              onClick={claimAll}
            >
              {ready.length + missionsReady.length > 0 ? `Забрать всё · ${ready.length + missionsReady.length}` : "Нечего забирать"}
            </button>
          </div>

          <ol className="qs-path" style={{ ["--fill" as string]: `${dailyRows.length > 1 ? Math.max(0, (dailyDone - 0) / dailyRows.length) * 100 : 0}%` }}>
            {dailyRows.map(({ inst, def }, i) => (
              <li key={inst.questId} className={inst.claimed ? "is-claimed" : inst.done ? "is-done" : undefined}>
                <span className="qs-node">
                  {inst.claimed ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 12.5 4 4 8-9" /></svg>
                  ) : (
                    <Icon metric={def.metric} />
                  )}
                </span>
                <b>{def.title}</b>
                <small>{i + 1} / {dailyRows.length}</small>
              </li>
            ))}
            <li className={`qs-finish${dailyRows.length > 0 && dailyClaimed === dailyRows.length ? " is-claimed" : ""}`}>
              <span className="qs-node">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 4h10v4a5 5 0 0 1-10 0z" /><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 13v4M8.5 20h7" /></svg>
              </span>
              <b>Финиш</b>
              <small>все забраны</small>
            </li>
          </ol>

          <div className="qs-potential">
            <span>Ещё можно получить</span>
            <b>+{potentialXp * mult} XP</b>
            <b className="ac">+{potentialAc * mult} AC</b>
            {!premium && (
              <Link href="/premium" className="qs-up">с Premium ×{PREMIUM_QUEST_MULT}: +{potentialXp * PREMIUM_QUEST_MULT} XP, +{potentialAc * PREMIUM_QUEST_MULT} AC</Link>
            )}
          </div>
        </section>

        {/* ------------------------------ Вкладки ----------------------------- */}
        <div className="qs-tabs" role="tablist" style={{ ["--i" as string]: tab === "daily" ? 0 : tab === "weekly" ? 1 : 2 }}>
          <span className="qs-tab-ind" aria-hidden />
          {(
            [
              ["daily", "Ежедневные", `${dailyClaimed}/${dailyRows.length}`],
              ["weekly", "Недельные", `${weeklyClaimed}/${weeklyRows.length}`],
              ["season", "Сезон", `${missionsClaimed}/${BP_MISSIONS.length}`],
            ] as const
          ).map(([key, label, count]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "on" : undefined} onClick={() => setTab(key)}>
              {label}<i>{count}</i>
            </button>
          ))}
        </div>

        <div className="qs-pane" key={tab}>
          {tab === "daily" && (
            <>
              <p className="qs-note">Квесты обновляются каждый день по вашему часовому поясу. Награду нужно забрать вручную.</p>
              {dailyRows.length ? <ul className="qs-list">{dailyRows.map(questCard)}</ul> : <p className="qs-empty">Квесты дня ещё не выданы — откройте любую страницу сайта и вернитесь.</p>}
            </>
          )}
          {tab === "weekly" && (
            <>
              <p className="qs-note">Прогресс копится семь дней и не сбрасывается до конца недели.</p>
              {weeklyRows.length ? <ul className="qs-list">{weeklyRows.map(questCard)}</ul> : <p className="qs-empty">Недельные задания ещё не выданы.</p>}
            </>
          )}
          {tab === "season" && (
            <>
              <p className="qs-note">{BATTLEPASS.name} · до конца сезона {daysLeftSeason} дн. Прогресс засчитывается сам, награду нужно забрать вручную.</p>
              <ul className="qs-list">
                {BP_MISSIONS.map((mission, index) => {
                  const value = Math.min(missionValue(mission), mission.target);
                  const pct = Math.round((value / mission.target) * 100);
                  const done = value >= mission.target;
                  const claimed = missionsClaimedIds.includes(mission.id);
                  const isReady = done && !claimed;
                  return (
                    <li key={mission.id} className={`qs-card${isReady ? " is-ready" : ""}${claimed ? " is-claimed" : ""}`} style={{ ["--n" as string]: index, ["--p" as string]: `${pct}%` }}>
                      <span className="qs-ic"><Icon metric="SEASON" /></span>
                      <div className="qs-body">
                        <div className="qs-top">
                          <h3>{mission.title}</h3>
                          <div className="qs-rew">
                            <b>+{mission.xp * mult} XP</b>
                            <b className="ac">+{mission.ac * mult} AC</b>
                          </div>
                        </div>
                        <p>{mission.description}</p>
                        <div className="qs-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><i /></div>
                        <div className="qs-foot">
                          <span>{value} / {mission.target}{mission.kind === "level" ? " уровень" : mission.kind === "claim" ? " наград" : " XP"}</span>
                          <button
                            type="button"
                            disabled={!isReady}
                            onClick={(event) => claimMission(mission.id, event.currentTarget)}
                            className={claimed ? "done" : isReady ? "go" : undefined}
                          >
                            {claimed ? "Забрано ✓" : isReady ? "Забрать" : `${pct}%`}
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <Link href="/battlepass" className="qs-pass">Открыть боевой пропуск</Link>
            </>
          )}
        </div>

        {/* ------------------------------ Неделя ------------------------------ */}
        <section className="qs-week" aria-label="Серия дней">
          <div>
            <h2>Серия дней</h2>
            <p>{progress.progress.streakCurrent > 0 ? `Уже ${progress.progress.streakCurrent} дн. подряд — не прерывайте.` : "Начните серию сегодня: достаточно досмотреть одну серию."}</p>
          </div>
          <div className="qs-days">
            {WEEKDAYS.map((day, i) => (
              <i key={day} data-on={i < Math.min(progress.progress.streakCurrent, 7) ? "y" : undefined}>{day}</i>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
