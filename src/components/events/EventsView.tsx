"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { watchStore } from "@/lib/history";
import { usePremium } from "@/lib/premium";
import { burst, flyCoins, flyLanterns, initFx, setLanternTarget } from "@/lib/event-fx";
import {
  EVENT_DAYS_LEFT_LABEL,
  EVENT_END,
  EVENT_LABEL,
  EVENT_MAX,
  EVENT_STEP,
  LANTERNS_PER_ATOM,
  MILESTONES,
  MILESTONE_GOAL,
  QUESTS,
  TRACK,
  addLanterns,
  claimQuest,
  claimReward,
  exchangeLanterns,
  fmt,
  lanternMult,
  nudgeRival,
  rivals,
  trackLevel,
  yokaiStore,
  type Rival,
} from "@/lib/event-yokai";
import { dayKey } from "@/lib/store";
import { EventGame } from "./EventGame";
import "../../app/events.css";
import { PremiumChip } from "@/components/profile/PremiumChip";

/* ───────────────────────────── Иконки макета ──────────────────────────── */

const LANTERN_SVG = `<svg viewBox="0 0 24 32" aria-hidden="true"><path d="M12 0v4" stroke="#ffc861" stroke-width="1.6" fill="none"/><rect x="9" y="3.5" width="6" height="3" rx="1" fill="#ffc861"/><path d="M12 6c7 0 10 5 10 10s-3 10-10 10S2 21 2 16 5 6 12 6z" fill="#ff5a2a"/><path d="M12 6c-3 0-4 5-4 10s1 10 4 10M12 6c3 0 4 5 4 10s-1 10-4 10" stroke="#ffb066" stroke-width=".9" fill="none"/><rect x="9" y="25.5" width="6" height="3" rx="1" fill="#ffc861"/><path d="M10 28.5v3M12 28.5v3.5M14 28.5v3" stroke="#ffc861" stroke-width="1" fill="none"/></svg>`;

/* Одна монетка на весь сайт: та же `/coin.png`, а не нарисованное золотое
   «A» — иначе атомы в событиях выглядели другой валютой. */
const COIN_SVG = `<img src="/coin.png" alt="" style="width:100%;height:100%;object-fit:contain" />`;

const FIRE_SVG = `<svg viewBox="0 0 100 120" aria-hidden="true"><path class="ev-f1" d="M50 118C20 118 8 92 22 66c4 12 12 14 14 10C30 50 44 28 52 4c4 22 26 34 30 62 8 22-4 52-32 52z" fill="#ff5a2a"/><path class="ev-f2" d="M50 118c-18 0-26-16-16-34 4 8 9 8 11 4-2-18 4-30 9-42 3 14 16 22 18 40 5 16-3 32-22 32z" fill="#ff9a3d"/><path class="ev-f3" d="M50 118c-9 0-13-9-8-19 3 4 6 4 7 1 0-8 2-13 4-19 2 8 8 11 9 20 2 9-3 17-12 17z" fill="#ffd98a"/><path class="ev-lg" d="M12 117 88 101M88 117 12 101" stroke="#3a1a10" stroke-width="8" stroke-linecap="round"/></svg>`;

const CROWN_SVG = `<svg viewBox="0 0 40 28" aria-hidden="true"><path d="M3 24 1 6l10 8 9-12 9 12 10-8-2 18z" fill="#ffc861" stroke="#fff3d6" stroke-width="1.2" stroke-linejoin="round"/><circle cx="20" cy="4" r="2" fill="#fff3d6"/></svg>`;

const FOX_MASK_SVG = `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 10 24 20h16L56 10c2 18-2 34-24 46C10 44 6 28 8 10z" fill="#f4efff"/><path d="M19 30c3 2 6 2 9 0M36 30c3 2 6 2 9 0M26 23l-3 6M38 23l3 6" stroke="#d92b3a" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M32 39v5" stroke="#2a1a55" stroke-width="3" stroke-linecap="round"/></svg>`;

const REWARD_ICON: Record<"atoms" | "premiumDays", string> = {
  atoms: '<circle cx="12" cy="12" r="8"/><path d="M12 7v10M7 12h10"/>',
  premiumDays: '<path d="M3.5 18h17M3.5 18 2.5 8.7 8 12.4 12 5.6l4 6.8 5.5-3.7-1 9.3z"/>',
};

const pad = (n: number): string => String(n).padStart(2, "0");

/* ──────────────────────── Плавный счётчик фонариков ───────────────────── */

/** Докручивает число за ~0,9 с, чтобы счётчик не прыгал на десятки сразу */
function useCountUp(value: number, duration = 900): number {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Без анимации значение всё равно обновляется, но не в том же кадре:
      // синхронный setState прямо в эффекте линтер считает каскадным рендером
      fromRef.current = to;
      const id = window.setTimeout(() => setShown(to), 0);
      return () => window.clearTimeout(id);
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number): void => {
      const k = Math.min(1, (t - t0) / duration);
      const next = from + (to - from) * (1 - Math.pow(1 - k, 3));
      setShown(next);
      if (k < 1) raf = requestAnimationFrame(step);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return shown;
}

/* ─────────────────────────────── Страница ─────────────────────────────── */

export function EventsView() {
  const state = yokaiStore.useStore();
  const watch = watchStore.useStore();
  const { active: premium } = usePremium();

  const rootRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const lanternRef = useRef<HTMLDivElement>(null);
  const lvupRef = useRef<HTMLDivElement>(null);
  const atomBoxRef = useRef<HTMLDivElement>(null);
  const lanternBoxRef = useRef<HTMLDivElement>(null);

  const [toast, setToast] = useState("");
  const [levelBanner, setLevelBanner] = useState<number | null>(null);
  const [sticky, setSticky] = useState(false);
  /** null до монтирования: время на сервере и в браузере разное, и отсчёт,
   *  посчитанный при рендере, ронял гидратацию. До первого тика — нули */
  const [now, setNow] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "pr">("all");
  const [pool, setPool] = useState<Rival[]>(rivals);
  const [exchange, setExchange] = useState(0);

  const mult = lanternMult(premium);
  const level = trackLevel(state.lan);
  const shownLanterns = useCountUp(state.lan);

  const notify = useCallback((message: string) => {
    setToast(message);
  }, []);

  /* Тост живёт 2,6 с — как в макете. Таймер держим в ref, чтобы частая
     смена текста не плодила интервалы */
  const toastTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!toast) return;
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2600);
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, [toast]);

  /* ── обратный отсчёт: первый тик — сразу, дальше раз в секунду ── */
  useEffect(() => {
    const first = window.setTimeout(() => setNow(Date.now()), 0);
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, []);

  const left = now === null ? 0 : Math.max(0, EVENT_END - now);
  const clock = {
    d: Math.floor(left / 86_400_000),
    h: pad(Math.floor(left / 3_600_000) % 24),
    m: pad(Math.floor(left / 60_000) % 60),
    s: pad(Math.floor(left / 1000) % 60),
  };

  /* ── фоновые эффекты: огоньки, салют, курсорное свечение ── */
  useEffect(() => initFx(), []);

  /* ── раскрытие секций при прокрутке ── */
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const sections = Array.from(main.querySelectorAll<HTMLElement>(".ev-section"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("ev-in");
          io.unobserve(entry.target);
        }
      },
      { threshold: 0.08 },
    );
    for (const section of sections) io.observe(section);
    return () => io.disconnect();
  }, []);

  /* ── липкая полоса: под шапкой сайта, а не поверх неё ── */
  useEffect(() => {
    const onScroll = (): void => setSticky(window.scrollY > 460);
    const measure = (): void => {
      const root = rootRef.current;
      if (!root) return;
      const header = document.querySelector<HTMLElement>(".agh");
      root.style.setProperty("--ev-top", `${header?.offsetHeight ?? 0}px`);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
    };
  }, []);

  /* ── дорога подкручивается к текущему уровню ── */
  useEffect(() => {
    const track = trackRef.current;
    const current = track?.querySelector<HTMLElement>(".ev-lv.ev-cur");
    if (!track || !current) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollTo({ left: current.offsetLeft - 24, behavior: reduce ? "auto" : "smooth" });
  }, [level]);

  /* ── демо-рейтинг: соперников подкидывает браузер ── */
  useEffect(() => {
    let step = 0;
    const id = window.setInterval(() => {
      step += 1;
      setPool((list) => nudgeRival(list, step));
    }, 4200);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setLanternTarget(lanternRef.current);
    return () => setLanternTarget(null);
  }, []);

  /* ── награды: счёт, салют, баннер нового уровня ── */
  const celebrate = useCallback(
    (n: number, origin: { x: number; y: number } | null): number => {
      const { added, levelUp } = addLanterns(n);
      flyLanterns(added, origin);
      if (levelUp) {
        const fresh = trackLevel(yokaiStore.get().lan);
        setLevelBanner(fresh);
        window.setTimeout(() => setLevelBanner(null), 2300);
        burst(
          window.innerWidth / 2,
          window.innerHeight * 0.36,
          100,
          ["#ffc861", "#ff8a3d", "#ff4f8b", "#fff3d6"],
          1.7,
        );
        window.navigator.vibrate?.(60);
      }
      return added;
    },
    [],
  );

  const questProgress = useMemo(() => {
    const today = dayKey();
    return {
      ep: watch.dayEpisodes,
      gm: state.played,
      rw: state.rwDay === today ? 1 : 0,
      xc: state.xcDay === today ? 1 : 0,
    } as Record<string, number>;
  }, [watch.dayEpisodes, state.played, state.rwDay, state.xcDay]);

  /* ── рейтинг ── */
  const board = useMemo(() => {
    const me = { n: "Ты", me: true, h: 25, v: state.lan, pr: premium } as Rival & { me: true };
    const base = filter === "all" ? pool : pool.filter((item) => item.pr);
    const list = premium || filter === "all" ? [...base, me] : base;
    return [...list].sort((a, b) => b.v - a.v || (("me" in a ? 1 : 0) - ("me" in b ? 1 : 0)));
  }, [filter, pool, premium, state.lan]);
  const top = board[0]?.v || 1;

  const canExchange = Math.floor(state.lan / LANTERNS_PER_ATOM);
  /* Ползунок мог остаться выше доступного после траты: показываем и считаем
     по фактически доступному, а не по устаревшему состоянию ползунка */
  const want = Math.min(exchange, canExchange);

  return (
    <div className="ev-root ev-js" ref={rootRef}>
      <div className="ev-main" ref={mainRef}>
        {/* ───────────────────────────── Герой ───────────────────────────── */}
        <header className="ev-hero">
          <div className="ev-moon" />
          <div className="ev-fog" />
          <div className="ev-hang ev-a"><i /></div>
          <div className="ev-hang ev-b"><i /></div>
          <div className="ev-hang ev-c"><i /></div>
          <div className="ev-hang ev-d"><i /></div>
          <svg className="ev-torii" viewBox="0 0 600 300" aria-hidden="true">
            <path d="M20 70c80 22 180 30 280 30s200-8 280-30l-14 34c-80 20-170 28-266 28S94 124 34 104z" />
            <rect x="64" y="118" width="472" height="18" rx="3" />
            <rect x="118" y="100" width="26" height="200" />
            <rect x="456" y="100" width="26" height="200" />
            <rect x="284" y="96" width="32" height="42" />
          </svg>
          <div className="ev-jp">妖怪の夜</div>
          <span className="ev-tag">
            <i />
            {EVENT_DAYS_LEFT_LABEL}
          </span>
          <h1>{EVENT_LABEL}</h1>
          <p className="ev-lead">
            Ночью на AniGalaxy открываются врата в мир духов. Лови ёкаев, собирай фонарики и
            забирай награды, которых больше не будет.
          </p>
          <div className="ev-clock" role="timer" aria-label="До конца ивента">
            <div><b>{clock.d}</b><span>дней</span></div>
            <div><b>{clock.h}</b><span>часов</span></div>
            <div><b>{clock.m}</b><span>минут</span></div>
            <div><b>{clock.s}</b><span>секунд</span></div>
          </div>
        </header>

        {/* ───────────────────────── Твои фонарики ───────────────────────── */}
        <section className="ev-section">
          <div className="ev-card ev-me">
            <div className="ev-lan" ref={lanternRef} dangerouslySetInnerHTML={{ __html: LANTERN_SVG }} />
            <div>
              <h3>Твои фонарики</h3>
              <div className="ev-cnt">
                <span>{fmt(shownLanterns)}</span>
                <small>/ {fmt(EVENT_MAX)}</small>
              </div>
              <div className="ev-bar">
                <span style={{ width: `${(state.lan / EVENT_MAX) * 100}%` }} />
              </div>
              <div className="ev-bl">
                <span>Уровень {level} из {TRACK.length}</span>
                <span>{level >= TRACK.length ? "Максимум" : `До уровня ${level + 1}: ${EVENT_STEP - (state.lan % EVENT_STEP)}`}</span>
              </div>
              {premium ? (
                <span className="ev-x2">Premium: ×2 фонарика за задания и игру</span>
              ) : (
                <span className="ev-x2" style={{ background: "#8a5cff12", borderColor: "#8a5cff55", color: "#c9b6ff" }}>
                  Без Premium фонарики капают без множителя
                </span>
              )}
            </div>
          </div>
        </section>

        {/* ───────────────────────── Задания ночи ───────────────────────── */}
        <section className="ev-section" data-k="任務">
          <h2>Задания ночи</h2>
          <p className="ev-d">Обновляются каждый день. Фонарики идут в общий прогресс.</p>
          <div className="ev-qs">
            {QUESTS.map((quest) => {
              const cur = Math.min(quest.goal, questProgress[quest.id] ?? 0);
              const done = cur >= quest.goal;
              const got = Boolean(state.q[quest.id]);
              const reward = quest.lanterns * mult;
              return (
                <div className="ev-q" key={quest.id}>
                  <div className="ev-ic">
                    <svg viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: quest.icon }} />
                  </div>
                  <div>
                    <h4>{quest.title}</h4>
                    <p>
                      {quest.note} · {cur}/{quest.goal}
                    </p>
                    <div className="ev-pb">
                      <i style={{ width: `${Math.min(100, (cur / quest.goal) * 100)}%` }} />
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`ev-btn${got ? " ev-done" : ""}`}
                    disabled={!done || got}
                    onClick={(event) => {
                      const result = claimQuest(quest.id, premium);
                      if (!result.ok) {
                        notify(result.message);
                        return;
                      }
                      const r = event.currentTarget.getBoundingClientRect();
                      const added = celebrate(result.lanterns, {
                        x: r.left + r.width / 2,
                        y: r.top + r.height / 2,
                      });
                      notify(added > 0 ? `+${added} фонариков` : "Фонарики уже на максимуме");
                      burst(r.left + r.width / 2, r.top + r.height / 2, 18);
                    }}
                  >
                    {got ? "Получено" : `+${reward}`}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* ───────────────────────── Лови ёкаев ─────────────────────────── */}
        <section className="ev-section" data-k="狩">
          <EventGame premium={premium} notify={notify} onLevel={(fresh) => {
            const banner = lvupRef.current;
            if (!banner) return;
            setLevelBanner(fresh);
            window.setTimeout(() => setLevelBanner(null), 2300);
          }} />
        </section>

        {/* ─────────────────────── Дорога фонариков ──────────────────────── */}
        <section className="ev-section" data-k="道">
          <h2>Дорога фонариков</h2>
          <p className="ev-d">
            Каждые {EVENT_STEP} фонариков открывают новый уровень. Линия Premium даёт вторую награду.
          </p>
          <div className="ev-track" ref={trackRef}>
            {TRACK.map((tier, index) => {
              const n = index + 1;
              const opened = n <= level;
              const cell = (kind: "free" | "prem") => {
                const reward = kind === "free" ? tier.free : tier.prem;
                const list = kind === "free" ? state.free : state.prem;
                const got = list.includes(n);
                const locked = !opened || (kind === "prem" && !premium);
                return (
                  <div
                    className={`ev-rw${kind === "prem" ? " ev-p" : ""}${locked ? " ev-lock" : ""}${got ? " ev-got" : ""}`}
                    style={{ "--c": kind === "prem" ? "#b9a0ff" : "#ff8a3d" } as React.CSSProperties}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      dangerouslySetInnerHTML={{ __html: REWARD_ICON[reward.atoms ? "atoms" : "premiumDays"] }}
                    />
                    {reward.label}
                    {locked ? null : (
                      <button
                        type="button"
                        disabled={got}
                        onClick={(event) => {
                          const r = event.currentTarget.getBoundingClientRect();
                          burst(r.left + r.width / 2, r.top + r.height / 2, 30);
                          const result = claimReward(kind, n);
                          notify(result.message);
                        }}
                      >
                        {got ? "Получено" : "Забрать"}
                      </button>
                    )}
                  </div>
                );
              };
              return (
                <div className={`ev-lv${n === level + 1 ? " ev-cur" : ""}`} key={n}>
                  <b>УР. {n}</b>
                  <div className="ev-lab">Бесплатно</div>
                  {cell("free")}
                  <div className="ev-lab">Premium</div>
                  {cell("prem")}
                </div>
              );
            })}
          </div>
        </section>

        {/* ───────────────────────── Костёр ивента ───────────────────────── */}
        <section className="ev-section" data-k="篝火">
          <div className="ev-card ev-goal">
            <div className="ev-fire" style={{ "--f": (0.45 + 0.6 * Math.min(1, state.lan / MILESTONE_GOAL)).toFixed(2) } as React.CSSProperties}>
              <span dangerouslySetInnerHTML={{ __html: FIRE_SVG }} />
            </div>
            <h2>Костёр ивента</h2>
            <p className="ev-d">
              Зажигают костёр все, кто играет в ивент. Общего счётчика по всем игрокам пока
              нет — полоса показывает ваши фонарики, а отметки ниже это плановые рубежи для
              всего сайта.
            </p>
            <div className="ev-cnt" style={{ fontSize: 30 }}>
              <span>{fmt(state.lan)}</span>
              <small>/ {fmt(MILESTONE_GOAL)}</small>
            </div>
            <div className="ev-bar">
              <span style={{ width: `${Math.min(100, (state.lan / MILESTONE_GOAL) * 100)}%` }} />
            </div>
            <div className="ev-ms">
              {MILESTONES.map((ms) => (
                <div className={state.lan >= ms.at ? "ev-ok" : ""} key={ms.at}>
                  <b>{fmt(ms.at / 1000)}K</b>
                  {ms.label}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ───────────────────────── Лидеры ночи ─────────────────────────── */}
        <section className="ev-section" data-k="頂">
          <h2>Лидеры ночи</h2>
          <div className="ev-lbt" role="group" aria-label="Фильтр рейтинга">
            <button
              type="button"
              className={filter === "all" ? "ev-on" : ""}
              aria-pressed={filter === "all"}
              onClick={() => setFilter("all")}
            >
              Все игроки
            </button>
            <button
              type="button"
              className={filter === "pr" ? "ev-on" : ""}
              aria-pressed={filter === "pr"}
              onClick={() => setFilter("pr")}
            >
              Premium
            </button>
          </div>

          <div className="ev-pod">
            {([1, 0, 2] as const).map((pick) => {
              const place = pick + 1;
              const player = board[pick];
              return (
                <div className={`ev-pd ev-p${place}`} key={place}>
                  {place === 1 ? (
                    <span className="ev-crown" dangerouslySetInnerHTML={{ __html: CROWN_SVG }} />
                  ) : null}
                  <div className="ev-who">
                    <div className="ev-ring">
                      <div
                        className="ev-ava"
                        style={{ "--s": pick ? "62px" : "76px", "--h": player?.h ?? 25 } as React.CSSProperties}
                      >
                        {(player?.n ?? "—").slice(0, 2).toUpperCase()}
                      </div>
                    </div>
                    <div className="ev-pn">
                      {player?.n ?? "—"}
                      {"me" in (player ?? {}) ? <span className="ev-you">ты</span> : null}
                    </div>
                    <div className="ev-pv">
                      {fmt(player?.v ?? 0)}
                      <i className="ev-ld" />
                    </div>
                  </div>
                  <div className="ev-ped">
                    <b>{place}</b>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="ev-card ev-lb">
            <div className="ev-lbl">
              {board.slice(3, 10).map((player, i) => (
                <div
                  className={`ev-lr${"me" in player ? " ev-me" : ""}`}
                  key={player.n}
                  style={{ "--i": i } as React.CSSProperties}
                >
                  <div className="ev-rk">{i + 4}</div>
                  <div className="ev-ava" style={{ "--s": "40px", "--h": player.h } as React.CSSProperties}>
                    {player.n.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="ev-nm">
                      <span>{player.n}</span>
                      <span className="ev-lvc">Ур. {Math.min(10, Math.floor(player.v / EVENT_STEP))}</span>
                      {player.pr ? <PremiumChip /> : null}
                    </div>
                    <div className="ev-pb">
                      <i style={{ "--w": `${Math.max(2, (player.v / top) * 100)}%` } as React.CSSProperties} />
                    </div>
                  </div>
                  <div className="ev-vl">
                    {fmt(player.v)}
                    <i className="ev-ld" />
                  </div>
                </div>
              ))}
            </div>
            {(() => {
              const mine = board.findIndex((player) => "me" in player);
              if (mine < 0) return null;
              if (mine < 10) return null;
              const player = board[mine];
              return (
                <div className="ev-lbme">
                  <div className="ev-lr ev-st ev-me" style={{ "--i": 0 } as React.CSSProperties}>
                    <div className="ev-rk">{mine + 1}</div>
                    <div className="ev-ava" style={{ "--s": "40px", "--h": player.h } as React.CSSProperties}>
                      {player.n.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="ev-nm">
                        <span>{player.n}</span>
                        <span className="ev-lvc">Ур. {Math.min(10, Math.floor(player.v / EVENT_STEP))}</span>
                        {player.pr ? <PremiumChip /> : null}
                      </div>
                      <div className="ev-pb">
                        <i style={{ "--w": `${Math.max(2, (player.v / top) * 100)}%` } as React.CSSProperties} />
                      </div>
                    </div>
                    <div className="ev-vl">
                      {fmt(player.v)}
                      <i className="ev-ld" />
                    </div>
                  </div>
                </div>
              );
            })()}
            <p className="ev-lbh">
              {(() => {
                const mine = board.findIndex((player) => "me" in player);
                if (mine === 0) return "Ты лидер ночи. Удержи первое место!";
                if (mine < 0)
                  return premium
                    ? `До 10-го места не хватает ${fmt(board[9].v - state.lan + 1)} фонариков`
                    : "Стань Premium, чтобы попасть в этот список.";
                return `До ${mine}-го места не хватает ${fmt(board[mine - 1].v - state.lan + 1)} фонариков`;
              })()}
            </p>
          </div>
        </section>

        {/* ─────────────────────── Эксклюзивы ивента ────────────────────── */}
        <section className="ev-section" data-k="限定">
          <h2>Эксклюзивы ивента</h2>
          <p className="ev-d">
            Дизайн призов. Таких рамок и титулов в каталоге косметики пока нет, поэтому наградами на
            дороге стали AC и дни Premium — их сайт действительно выдаёт.
          </p>
          <div className="ev-ex">
            <div className="ev-card">
              <div className="ev-av" style={{ "--fr": "conic-gradient(#ff4f8b,#ff8a3d,#ffc861,#ff4f8b)", "--fg": "#ff4f8b" } as React.CSSProperties}>
                <span dangerouslySetInnerHTML={{ __html: FOX_MASK_SVG }} />
              </div>
              <h4>Рамка «Кицунэ»</h4>
              <p>Лисий огонь. Уровень 5, Premium</p>
            </div>
            <div className="ev-card">
              <div className="ev-av" style={{ "--fr": "conic-gradient(#8a5cff,#38d6ff,#8a5cff)", "--fg": "#8a5cff" } as React.CSSProperties}>
                <span dangerouslySetInnerHTML={{ __html: FOX_MASK_SVG }} />
              </div>
              <h4>Рамка «Призрачный огонь»</h4>
              <p>Уровень 10, бесплатно</p>
            </div>
            <div className="ev-card">
              <div className="ev-ttl">Охотник на ёкаев</div>
              <h4>Титул события</h4>
              <p>Уровень 8, Premium</p>
            </div>
          </div>
        </section>

        {/* ───────────────────── Обмен фонариков на AC ───────────────────── */}
        <section className="ev-section" data-k="交換">
          <h2>Обмен фонариков</h2>
          <p className="ev-d">
            Фонарики можно обменять на AC профиля — их же видно в магазине. Курс: {LANTERNS_PER_ATOM} фонариков = 1 AC.
          </p>
          <div className="ev-card ev-xc">
            <div className="ev-xs">
              <div className="ev-xb ev-a" ref={lanternBoxRef}>
                <span dangerouslySetInnerHTML={{ __html: LANTERN_SVG }} />
                <div>
                  <small>Фонариков к обмену</small>
                  <b>{fmt(state.lan)}</b>
                </div>
              </div>
              <div className="ev-xm" aria-hidden="true">
                <svg viewBox="0 0 44 24"><path d="M4 12h34M28 4l10 8-10 8" /></svg>
              </div>
              <div className="ev-xb ev-c" ref={atomBoxRef}>
                <span dangerouslySetInnerHTML={{ __html: COIN_SVG }} />
                <div>
                  <small>Получишь AC</small>
                  <b>{fmt(want)}</b>
                </div>
              </div>
            </div>
            <div className="ev-xctl">
              <div>
                <label htmlFor="xr">Сколько AC получить</label>
                <input
                  id="xr"
                  type="range"
                  min={0}
                  max={canExchange}
                  value={want}
                  disabled={canExchange < 1}
                  onChange={(event) => setExchange(Number(event.target.value))}
                />
                <div className="ev-xinfo">
                  <span>
                    {want > 0
                      ? `Спишется ${fmt(want * LANTERNS_PER_ATOM)} фонариков`
                      : canExchange > 0
                        ? "Двигай ползунок"
                        : "Недостаточно фонариков"}
                  </span>
                  <span>AC обменяно за ивент: <em>{fmt(state.ac)}</em></span>
                </div>
              </div>
              <button
                type="button"
                className="ev-btn"
                disabled={want < 1}
                onClick={() => {
                  const atoms = exchangeLanterns(want);
                  if (!atoms) return;
                  setExchange(0);
                  notify(`Обмен выполнен: +${atoms} AC`);
                  flyCoins(atoms, lanternBoxRef.current, atomBoxRef.current);
                }}
              >
                Обменять
              </button>
            </div>
            <p className="ev-xhint" hidden={canExchange > 0}>
              Пока нечего менять: забери фонарики за задания, игру и награды с дороги.
            </p>
          </div>
        </section>
      </div>

      {/* ── Тост, липкая полоса, баннер уровня ── */}
      <div className={`ev-toast${toast ? " ev-show" : ""}`} role="status">
        {toast}
      </div>
      <div className={`ev-sb${sticky ? " ev-on" : ""}`}>
        <b>{EVENT_LABEL}</b>
        <span>
          <em>{fmt(state.lan)}</em> фонариков · до конца <em>{clock.d} д {clock.h} ч</em>
        </span>
      </div>
      <div className={`ev-lvup${levelBanner ? " ev-show" : ""}`} aria-hidden="true">
        <small>Новый уровень</small>
        <b>{levelBanner ?? 1}</b>
      </div>
    </div>
  );
}