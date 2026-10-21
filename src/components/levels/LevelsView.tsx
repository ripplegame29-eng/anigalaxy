"use client";

/**
 * Страница «Уровни» — интерактивная часть.
 *
 * Герой с живым знаком уровня, лестница эр, дорожка наград на все 100
 * уровней, планировщик пути, тома опыта и источники XP. Все числа приходят
 * из документа прогрессии и конфига; страница ничего не выдумывает.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgTag } from "@/components/progression/AgTag";
import { useLevelInfo, useProgress, progressEmit } from "@/lib/progression/events";
import { levelAcReward, totalXpFor } from "@/lib/progression/curve";
import { PROGRESSION_CONFIG } from "@/lib/progression/progression.config";
import { ERAS } from "@/lib/levels";
import { pathStats, tomeProgress, tomes, xpHeadroom, xpSources, type TomeItem } from "@/lib/levels-view";
import { pushToast } from "@/lib/toasts";
import { LevelBadge, ERA_THEME, eraIndex } from "./LevelBadge";
import { LevelsBackdrop } from "./LevelsBackdrop";
import { LevelCore } from "./LevelCore";
import "../../app/levels.css";

const MAX = PROGRESSION_CONFIG.levels.maxLevel;
const XP_PER_EPISODE = 10;

const num = (value: number) => Math.round(value).toLocaleString("ru-RU");
const percent2 = (value: number) => value.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const REJECT_TEXT: Record<string, string> = {
  unknown_tome: "тома больше нет",
  price_mismatch: "цена изменилась",
  tome_locked: "том ещё закрыт",
  tome_daily_limit: "том уже куплен сегодня",
  insufficient_ac: "не хватает AC",
  limit_reached: "достигнут предел",
};

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

const TAGS = new Map(PROGRESSION_CONFIG.tags.map((t) => [t.id, t]));
const LEVEL_TAGS = new Map(PROGRESSION_CONFIG.levelTags.map((t) => [t.level, t.tagId]));
const ALL_LEVELS = Array.from({ length: MAX }, (_, i) => i + 1);

function eraRange(i: number): [number, number] {
  const from = ERAS[i].from;
  const to = i + 1 < ERAS.length ? ERAS[i + 1].from - 1 : MAX;
  return [from, to];
}

export function LevelsView() {
  const doc = useProgress();
  const info = useLevelInfo();
  const [busy, setBusy] = useState(false);
  const [activeEra, setActiveEra] = useState(() => eraIndex(info.level));
  const railRef = useRef<HTMLDivElement>(null);
  const didInit = useRef(false);

  const path = useMemo(() => pathStats(info), [info]);
  const sources = useMemo(() => xpSources(doc), [doc]);
  const tomeList = useMemo(() => tomes(doc, info), [doc, info]);
  const tomeCount = useMemo(() => tomeProgress(doc), [doc]);
  const headroom = xpHeadroom(doc);
  const totalXp = info.start + info.into;
  const eraIdx = eraIndex(info.level);
  const theme = ERA_THEME[eraIdx];
  const nextEra = ERAS[eraIdx + 1];

  const earnedAc = useMemo(() => ALL_LEVELS.filter((l) => l <= info.level).reduce((s, l) => s + levelAcReward(l), 0), [info.level]);
  const totalAc = useMemo(() => ALL_LEVELS.reduce((s, l) => s + levelAcReward(l), 0), []);

  const scrollToLevel = useCallback((level: number, smooth = true) => {
    const rail = railRef.current;
    const el = rail?.querySelector<HTMLElement>(`[data-level="${level}"]`);
    if (!rail || !el) return;
    const left = el.offsetLeft - rail.clientWidth / 2 + el.clientWidth / 2;
    rail.scrollTo({ left: Math.max(0, left), behavior: smooth ? "smooth" : "auto" });
  }, []);

  // при открытии страницы дорожка встаёт на текущий уровень
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    const id = requestAnimationFrame(() => scrollToLevel(info.level, false));
    return () => cancelAnimationFrame(id);
  }, [info.level, scrollToLevel]);

  const onRailScroll = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const mid = rail.scrollLeft + rail.clientWidth / 2;
    const cols = rail.querySelectorAll<HTMLElement>("[data-level]");
    let best = 1;
    for (const col of cols) {
      if (col.offsetLeft <= mid) best = Number(col.dataset.level);
      else break;
    }
    const idx = eraIndex(best);
    setActiveEra((cur) => (cur === idx ? cur : idx));
  }, []);

  const nudge = (dir: -1 | 1) => railRef.current?.scrollBy({ left: dir * 620, behavior: "smooth" });

  const buyTome = useCallback((tome: TomeItem) => {
    setBusy(true);
    try {
      const res = progressEmit({ type: "TOME_PURCHASED", tomeId: tome.id, price: tome.price });
      if (res.rejected) {
        pushToast({ kind: "ac", title: "Том не куплен", text: REJECT_TEXT[res.rejected.reason] ?? res.rejected.reason });
        return;
      }
      pushToast({ kind: "xp", title: `«${tome.name}» открыт`, text: `+${tome.xp} XP` });
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <div className="lv-root" style={{ "--era": theme.glow, "--era1": theme.c1, "--era2": theme.c2 } as React.CSSProperties}>
      <LevelsBackdrop />

      <div className="lv-wrap">
        {/* ------------------------------ Вкладки ------------------------------ */}
        <div className="lv-tabs" role="tablist" aria-label="Разделы прогрессии">
          <button type="button" role="tab" aria-selected="true" className="lv-tab on">
            <LevelBadge level={info.level} size={36} state="current" rich={false} minor />
            <span>
              <b>Уровень</b>
              <small>
                {info.level} · {info.era}
              </small>
            </span>
          </button>
          <button type="button" role="tab" aria-selected="false" disabled className="lv-tab">
            <span className="lv-lock" aria-hidden>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="4" y="10" width="16" height="11" rx="2" />
                <path d="M8 10V7a4 4 0 1 1 8 0v3" />
              </svg>
            </span>
            <span>
              <b>Заточка</b>
              <small>Откроется на 10 000</small>
            </span>
          </button>
        </div>

        {/* -------------------------------- Герой ------------------------------ */}
        <section className="lv-hero" aria-label="Текущий уровень">
          <div className="lv-core">
            <LevelCore level={info.level} progress={info.percent / 100} />
          </div>

          <div className="lv-hero-copy">
            <span className="lv-era-tag">{info.era}</span>
            <h1 className="lv-h1">
              Уровень <em>{info.level}</em>
            </h1>
            <p className="lv-sub">
              Всего опыта: <b>{num(totalXp)} XP</b>
              {nextEra && (
                <>
                  {" · "}до эры «{nextEra.name}» — {nextEra.from - info.level} {plural(nextEra.from - info.level, "уровень", "уровня", "уровней")}
                </>
              )}
            </p>

            <XpBar level={info.level} percent={info.percent} into={info.into} need={info.need} left={info.left} />

            <dl className="lv-tiles">
              <div>
                <dt>До {MAX} уровня</dt>
                <dd>{num(path.toPeak)} XP</dd>
              </div>
              <div className="hot">
                <dt>AC за {Math.min(info.level + 1, MAX)} уровень</dt>
                <dd>+{num(path.acPerLevel)} AC</dd>
              </div>
              <div>
                <dt>Путь к пределу</dt>
                <dd>{percent2(path.percent)} %</dd>
              </div>
            </dl>
          </div>
        </section>

        {/* ------------------------------ Лестница эр -------------------------- */}
        <section className="lv-sec" aria-labelledby="lv-eras">
          <header className="lv-sec-h">
            <div>
              <h2 id="lv-eras">Эры</h2>
              <p>Семь ступеней мастерства: у каждой свой знак, цвет и сияние.</p>
            </div>
          </header>
          <ol className="lv-eras">
            {ERAS.map((era, i) => {
              const [from, to] = eraRange(i);
              const state = info.level > to ? "done" : info.level >= from ? "current" : "locked";
              const inEra = Math.min(100, Math.max(0, ((info.level - from + info.percent / 100) / (to - from + 1)) * 100));
              return (
                <li key={era.name}>
                  <button
                    type="button"
                    className={`lv-era ${state}`}
                    style={{ "--c": ERA_THEME[i].glow } as React.CSSProperties}
                    onClick={() => {
                      setActiveEra(i);
                      scrollToLevel(from);
                      document.getElementById("lv-rewards")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                  >
                    <LevelBadge level={from} era={i} size={96} state={state === "current" ? "current" : "done"} />
                    <b>{era.name}</b>
                    <small>{from === to ? `${from} ур.` : `${from}–${to} ур.`}</small>
                    {state === "current" ? (
                      <span className="lv-era-bar"><i style={{ width: `${inEra}%` }} /></span>
                    ) : (
                      <span className="lv-era-st">{state === "done" ? "пройдена" : "впереди"}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </section>

        {/* --------------------------- Награды за уровни ----------------------- */}
        <section className="lv-sec" id="lv-rewards" aria-labelledby="lv-rw">
          <header className="lv-sec-h">
            <div>
              <h2 id="lv-rw">Награды за уровни</h2>
              <p>Каждый уровень приносит AC, а на особых вехах открываются теги.</p>
            </div>
            <p className="lv-got">
              получено <b>{num(earnedAc)}</b> из {num(totalAc)} AC
            </p>
          </header>

          <div className="lv-chips" role="group" aria-label="Эры дорожки">
            <button type="button" className="lv-chip now" onClick={() => scrollToLevel(info.level)}>
              <i /> Сейчас
            </button>
            {ERAS.map((era, i) => (
              <button
                key={era.name}
                type="button"
                className={`lv-chip${activeEra === i ? " on" : ""}`}
                aria-pressed={activeEra === i}
                style={{ "--c": ERA_THEME[i].glow } as React.CSSProperties}
                onClick={() => {
                  setActiveEra(i);
                  scrollToLevel(era.from);
                }}
              >
                {era.name}
              </button>
            ))}
            <span className="lv-arrows">
              <button type="button" onClick={() => nudge(-1)} aria-label="Назад">‹</button>
              <button type="button" onClick={() => nudge(1)} aria-label="Вперёд">›</button>
            </span>
          </div>

          <div className="lv-rail" ref={railRef} onScroll={onRailScroll} tabIndex={0} aria-label="Дорожка наград за уровни">
            {ALL_LEVELS.map((level) => {
              const done = info.level >= level;
              const current = info.level + 1 === level;
              const you = info.level === level;
              const tagId = LEVEL_TAGS.get(level);
              const tag = tagId ? TAGS.get(tagId) : undefined;
              const big = level % 10 === 0 || Boolean(tag);
              const ei = eraIndex(level);
              const eraStart = ERAS[ei].from === level;
              const state = done ? "done" : "locked";
              return (
                <div
                  key={level}
                  data-level={level}
                  className={`lv-col${done ? " done" : ""}${current ? " next" : ""}${you ? " you" : ""}${big ? " big" : ""}`}
                  style={{ "--c": ERA_THEME[ei].glow } as React.CSSProperties}
                >
                  <div className="lv-node">
                    <LevelBadge level={level} size={eraStart ? 92 : big ? 72 : 58} state={you ? "current" : state} minor={eraStart ? false : true} />
                    {you && <span className="lv-here">вы здесь</span>}
                  </div>
                  <article className="lv-card">
                    {eraStart && <span className="lv-era-pill">эра «{ERAS[ei].name}»</span>}
                    <small>{level} уровень</small>
                    <p className="lv-ac">
                      <img src="/coin.png" alt="" width={20} height={20} />+{num(levelAcReward(level))}
                    </p>
                    {tag && (
                      <div className={`lv-tagrow${done ? "" : " off"}`}>
                        <AgTag tag={tag} />
                      </div>
                    )}
                    <em className="lv-st">
                      {done ? "получено" : current ? `ещё ${num(info.left)} XP` : `ещё ${level - info.level} ур.`}
                    </em>
                  </article>
                </div>
              );
            })}
          </div>
        </section>

        {/* ----------------------------- Планировщик --------------------------- */}
        {info.level < MAX && <Planner info={info} totalXp={totalXp} />}

        {/* ------------------------------ Тома опыта --------------------------- */}
        <section className="lv-sec" aria-labelledby="lv-tomes">
          <header className="lv-sec-h">
            <div>
              <h2 id="lv-tomes">Тома опыта</h2>
              <p>Ускорьте путь: каждый том можно купить раз в сутки.</p>
            </div>
            <p className="lv-got">
              на балансе <b>{num(doc.progress.acBalance)} AC</b>
            </p>
          </header>

          <div className="lv-gap">
            <div>
              <small>Разрыв</small>
              <b>
                До {Math.min(info.level + 1, MAX)} уровня — {num(info.left)} XP
              </b>
            </div>
            <div className="r">
              <small>Сегодня</small>
              <b>
                {tomeCount.bought} / {tomeCount.total}
              </b>
              <small>Каждый том — по одному в сутки</small>
            </div>
          </div>

          <ul className="lv-tomes">
            {tomeList.map((tome) => (
              <li key={tome.id} className={`lv-tome${tome.unlocked ? "" : " off"}`} style={{ "--t": tome.accent } as React.CSSProperties}>
                <TomeArt tome={tome} />
                <div className="lv-tome-body">
                  <div className="lv-tome-name">
                    <b>{tome.name}</b>
                    <span className="lv-pill">раз в день</span>
                    {tome.fromLevel > 0 && (
                      <span className={`lv-pill${tome.unlocked ? " ok" : ""}`}>{tome.unlocked ? "открыт" : `закроет ${tome.fromLevel} уровень`}</span>
                    )}
                  </div>
                  <p className="lv-tome-xp">
                    {num(tome.xp)} <span>XP</span>
                  </p>
                  <small>
                    ≈ {tome.episodes} {plural(tome.episodes, "серия", "серии", "серий")} просмотра
                  </small>
                </div>
                <div className="lv-tome-act">
                  {tome.unlocked && !tome.usedToday && (
                    <span className="lv-price">
                      <img src="/coin.png" alt="" width={20} height={20} />
                      {num(tome.price)}
                      {!tome.affordable && <s>/ {num(doc.progress.acBalance)}</s>}
                    </span>
                  )}
                  {!tome.unlocked ? (
                    <span className="lv-state">закрыт</span>
                  ) : tome.usedToday ? (
                    <span className="lv-state ok">куплен сегодня</span>
                  ) : tome.affordable ? (
                    <button type="button" className="lv-buy" onClick={() => buyTome(tome)} disabled={busy}>
                      Купить
                    </button>
                  ) : (
                    <span className="lv-state">не хватает {num(tome.shortBy)}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* ---------------------------- Где брать XP --------------------------- */}
        <section className="lv-sec lv-last" aria-labelledby="lv-src">
          <header className="lv-sec-h">
            <div>
              <h2 id="lv-src">Где брать XP</h2>
              <p>Бесплатные источники опыта и их дневные лимиты.</p>
            </div>
            <p className="lv-got">
              потолок за сутки{" "}
              <b>
                {num(doc.daily.xpActivity)} / {num(headroom + doc.daily.xpActivity)}
              </b>
            </p>
          </header>

          <ul className="lv-src">
            {sources.map((src) => (
              <li key={src.id} className={src.capped ? "capped" : ""}>
                <div className="lv-src-top">
                  <span>
                    <b>{src.label}</b>
                    {src.oncePerDay && <span className="lv-pill">раз в день</span>}
                  </span>
                  <strong>
                    {num(src.xp)} <small>XP</small>
                  </strong>
                </div>
                <small>
                  ≈ {src.episodes} {plural(src.episodes, "серия", "серии", "серий")} просмотра
                </small>
                {src.perDay > 1 && (
                  <div className="lv-src-bar">
                    <div>
                      <span>
                        Сегодня: {src.doneToday} из {src.perDay}
                      </span>
                      <span>{src.percent}%</span>
                    </div>
                    <i>
                      <u style={{ width: `${Math.max(src.percent, 2)}%` }} />
                    </i>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

/* --------------------------- XP-шкала в шапке --------------------------- */

function XpBar({ level, percent, into, need, left }: { level: number; percent: number; into: number; need: number; left: number }) {
  const next = Math.min(level + 1, MAX);
  const max = level >= MAX;
  const p = max ? 100 : Math.max(percent, 1.5);
  const nextEra = ERA_THEME[eraIndex(next)];
  return (
    <div className="lv-xpb" style={{ "--p": `${p}%`, "--nr": nextEra.rgb } as React.CSSProperties}>
      <div className="lv-xpb-top">
        <span>
          <b>{num(into)}</b> / {num(need)} XP
        </span>
        <span className="r">{max ? "максимум" : <>до {next} уровня — <b>{num(left)} XP</b></>}</span>
      </div>
      <div className="lv-xpb-row">
        <LevelBadge level={level} size={54} minor state="done" rich={false} />
        <div className="lv-xpb-rail" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)} aria-label={`Прогресс до уровня ${next}`}>
          <div className="lv-xpb-track">
            <span className="lv-xpb-fill">
              <span className="lv-xpb-flow" />
              {[0, 1, 2, 3, 4].map((i) => (
                <i key={i} className="lv-xpb-mote" style={{ animationDelay: `${i * 0.7}s`, top: `${22 + ((i * 29) % 56)}%` }} />
              ))}
            </span>
          </div>
          <span className="lv-xpb-marker">
            <span className="lv-xpb-pct">{Math.round(percent)}%</span>
            <i className="lv-xpb-head" />
          </span>
        </div>
        <span className={`lv-xpb-next${percent >= 90 ? " hot" : ""}`}>
          <LevelBadge level={next} size={54} minor state="locked" rich={false} />
        </span>
      </div>
    </div>
  );
}

/* ------------------------------ Планировщик ------------------------------ */

function Planner({ info, totalXp }: { info: { level: number; left: number }; totalXp: number }) {
  const min = info.level + 1;
  const [target, setTarget] = useState(() => Math.min(MAX, info.level + 5));
  const t = Math.min(MAX, Math.max(min, target));

  const calc = useMemo(() => {
    const xp = Math.max(0, totalXpFor(t) - totalXp);
    let ac = 0;
    for (let l = min; l <= t; l++) ac += levelAcReward(l);
    const tags = PROGRESSION_CONFIG.levelTags.filter((x) => x.level >= min && x.level <= t);
    const era = eraIndex(t);
    return { xp, ac, tags, era, eras: era - eraIndex(info.level) };
  }, [t, min, totalXp, info.level]);

  const presets = [
    { label: "+1", to: min },
    { label: "+5", to: info.level + 5 },
    { label: "+10", to: info.level + 10 },
    ...(ERAS[eraIndex(info.level) + 1] ? [{ label: `Эра «${ERAS[eraIndex(info.level) + 1].name}»`, to: ERAS[eraIndex(info.level) + 1].from }] : []),
    { label: `${MAX}`, to: MAX },
  ];

  return (
    <section className="lv-sec" aria-labelledby="lv-plan">
      <header className="lv-sec-h">
        <div>
          <h2 id="lv-plan">Планировщик пути</h2>
          <p>Выберите цель — посчитаем опыт, серии и награды по дороге.</p>
        </div>
      </header>

      <div className="lv-plan" style={{ "--c": ERA_THEME[calc.era].glow } as React.CSSProperties}>
        <div className="lv-plan-goal">
          <LevelBadge level={t} size={118} state="current" minor={false} era={calc.era} />
          <span>цель</span>
        </div>
        <div className="lv-plan-main">
          <label htmlFor="lv-target">
            Уровень <b>{t}</b> · {ERAS[calc.era].name}
          </label>
          <input
            id="lv-target"
            type="range"
            min={min}
            max={MAX}
            value={t}
            onChange={(e) => setTarget(Number(e.target.value))}
            style={{ "--p": `${MAX === min ? 100 : ((t - min) / (MAX - min)) * 100}%` } as React.CSSProperties}
          />
          <div className="lv-presets">
            {presets.map((p) => (
              <button key={p.label} type="button" onClick={() => setTarget(Math.min(MAX, Math.max(min, p.to)))} className={t === Math.min(MAX, Math.max(min, p.to)) ? "on" : ""}>
                {p.label}
              </button>
            ))}
          </div>
          <dl className="lv-plan-out">
            <div>
              <dt>Нужно опыта</dt>
              <dd>{num(calc.xp)} XP</dd>
            </div>
            <div>
              <dt>Это примерно</dt>
              <dd>
                {num(Math.ceil(calc.xp / XP_PER_EPISODE))} {plural(Math.ceil(calc.xp / XP_PER_EPISODE), "серия", "серии", "серий")}
              </dd>
            </div>
            <div className="hot">
              <dt>Награда по пути</dt>
              <dd>+{num(calc.ac)} AC</dd>
            </div>
            <div>
              <dt>Откроется</dt>
              <dd>
                {calc.tags.length > 0 ? `${calc.tags.length} ${plural(calc.tags.length, "тег", "тега", "тегов")}` : "—"}
                {calc.eras > 0 ? ` · новая эра` : ""}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}

/** Обложка тома: книга в цвете редкости */
function TomeArt({ tome }: { tome: TomeItem }) {
  const rank = tome.rarity === "LEGENDARY" ? 3 : tome.rarity === "EPIC" ? 2 : 1;
  return (
    <span className="lv-tome-art" aria-hidden>
      <svg viewBox="0 0 64 64" width="64" height="64">
        <defs>
          <linearGradient id={`tg-${tome.id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={tome.accent} />
            <stop offset="1" stopColor="#0a0b14" />
          </linearGradient>
        </defs>
        <path d="M10 14c8-4 15-4 22 1 7-5 14-5 22-1v36c-8-4-15-4-22 1-7-5-14-5-22-1z" fill={`url(#tg-${tome.id})`} stroke={tome.accent} strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M32 15v36" stroke="rgba(255,255,255,.35)" strokeWidth="1.4" />
        {rank >= 1 && <circle cx="32" cy="30" r="4" fill="none" stroke="#fff" strokeOpacity=".85" strokeWidth="1.4" />}
        {rank >= 2 && <path d="M32 21l2 6 6 .5-4.6 4 1.6 6L32 34l-5 3.5 1.6-6L24 27.500l6-.5z" fill="#fff" fillOpacity=".9" />}
        {rank >= 3 && (
          <>
            <circle cx="14" cy="10" r="1.6" fill="#fff" />
            <circle cx="52" cy="8" r="1.2" fill="#fff" />
            <circle cx="56" cy="20" r="1.4" fill="#fff" />
          </>
        )}
      </svg>
    </span>
  );
}
