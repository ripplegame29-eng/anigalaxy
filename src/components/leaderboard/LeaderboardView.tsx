"use client";

/**
 * Лидерборд AniGalaxy.
 *
 * Раньше соперники были сгенерированы на клиенте (сервера и базы игроков
 * не было). Теперь это настоящая таблица с сервера (`/api/leaderboard`):
 * только реально зарегистрированные игроки, очки — опыт за неделю или за
 * всё время. Сервер не считает часы просмотра, серии или главы манги по
 * другим игрокам, поэтому сортировка и сравнение по этим метрикам для
 * чужих строк исчезли вместе с ботами — сортировка одна, по очкам. Своя
 * строка внизу по-прежнему показывает настоящие локальные цифры профиля
 * (серии, часы, рамка, тег).
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LevelBadge } from "@/components/levels/LevelBadge";
import { FRAMES, TITLES, type TitleItem } from "@/lib/cosmetics";
import { isPremiumActive } from "@/lib/auth";
import { PROGRESSION_CONFIG } from "@/lib/progression/progression.config";
import type { TagDef } from "@/lib/progression/types";
import { useLevelInfo, useProgress } from "@/lib/progression/events";
import { useTagSelection, useTitleSelection } from "@/lib/selection";
import { useAccount } from "@/lib/use-account";
import { useProfile } from "@/lib/profile";
import { watchStats, watchStore } from "@/lib/history";
import { PRIZES } from "@/lib/leaderboard-prizes";
import { useLeaderboardBoard, type BoardMetric, type BoardRow } from "@/lib/leaderboard-cloud";
import { AvatarFrame } from "@/components/profile/AvatarFrame";
import "./leaderboard.css";
import "./leaderboard-premium.css";
import { PremiumChip } from "@/components/profile/PremiumChip";

type Period = "week" | "all";

const METRICS: { id: BoardMetric; label: string }[] = [
  { id: "xp", label: "Опыт" },
  { id: "hours", label: "Часы просмотра" },
  { id: "series", label: "Серии" },
];

/** Число и подпись под ним для выбранной метрики (часы приходят минутами) */
function metricValue(metric: BoardMetric, points: number): { value: number; unit: string } {
  if (metric === "hours") return { value: Math.floor(points / 60), unit: "часов" };
  if (metric === "series") return { value: points, unit: "серий" };
  return { value: points, unit: "опыта" };
}

const REAL_TAGS = PROGRESSION_CONFIG.tags as TagDef[];

function fmt(n: number): string {
  return Math.round(n).toLocaleString("ru-RU");
}

/** Плавный набор числа: очки «разгоняются» при появлении карточки */
function useCountUp(target: number, ms = 1100): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

function spotlight(event: React.PointerEvent<HTMLElement>) {
  const el = event.currentTarget;
  const rect = el.getBoundingClientRect();
  el.style.setProperty("--mx", `${event.clientX - rect.left}px`);
  el.style.setProperty("--my", `${event.clientY - rect.top}px`);
}

/** Аватар и рамка игрока из его профиля; без них — буквы ника */
function PlayerAvatar({ row, size }: { row: BoardRow; size: "md" | "xs" }) {
  const frame = row.frameId ? FRAMES.find((item) => item.id === row.frameId) : undefined;
  return <AvatarFrame nickname={row.nickname} avatar={row.avatar || undefined} frame={frame} size={size} />;
}

const CROWN = (
  <svg className="lb2-crown" viewBox="0 0 34 26" fill="currentColor" aria-hidden>
    <path d="M2 8l7 6 8-11 8 11 7-6-3 16H5z" />
  </svg>
);

function PodiumCard({ row, place, metric }: { row: BoardRow; place: 1 | 2 | 3; metric: BoardMetric }) {
  const shown = metricValue(metric, row.points);
  const points = useCountUp(shown.value);
  return (
    <article className={`lb2-pod p${place}`} onPointerMove={spotlight}>
      <span className="lb2-aura" aria-hidden />
      {place === 1 && CROWN}
      <span className="lb2-medal" aria-hidden>{place}</span>
      <div className="lb2-av">
        <PlayerAvatar row={row} size="md" />
      </div>
      <h3 className="lb2-name">
        <Link href={`/u/${encodeURIComponent(row.nickname)}`} className="lb2-link">
          {row.nickname}
        </Link>
      </h3>
      <div className="lb2-badges">
        <span className="lb2-lv"><LevelBadge level={row.level} size={46} state="current" minor /></span>
        {row.premium && <PremiumChip />}
      </div>
      <div className="lb2-big">
        <b>{fmt(points)}</b>
        <small>{shown.unit}</small>
      </div>
    </article>
  );
}

function Podium({ rows, metric }: { rows: BoardRow[]; metric: BoardMetric }) {
  // Порядок отрисовки: 2, 1, 3 — иначе первое место окажется не по центру
  const order = [1, 0, 2] as const;
  return (
    <section className="lb2-podium">
      {order.map((i) => {
        const row = rows[i];
        if (!row) return null;
        return <PodiumCard key={row.nickname} row={row} place={(i + 1) as 1 | 2 | 3} metric={metric} />;
      })}
    </section>
  );
}

function RankRow({ row, max, index, metric }: { row: BoardRow; max: number; index: number; metric: BoardMetric }) {
  const shownValue = metricValue(metric, row.points);
  const top = row.rank <= 10;
  return (
    <li
      className={`lb2-card${top ? " top" : ""}`}
      style={{ "--n": index, "--w": `${((row.points / Math.max(1, max)) * 100).toFixed(1)}%` } as React.CSSProperties}
      onPointerMove={spotlight}
    >
      <span className="lb2-rank">{`#${row.rank}`}</span>
      <div className="lb2-av lb2-s">
        <PlayerAvatar row={row} size="xs" />
      </div>
      <h4 className="lb2-name lb2-s">
        <Link href={`/u/${encodeURIComponent(row.nickname)}`} className="lb2-link">
          {row.nickname}
        </Link>
      </h4>
      <div className="lb2-badges lb2-s">
        <span className="lb2-lv"><LevelBadge level={row.level} size={34} state="current" rich={false} minor /></span>
        {row.premium && <PremiumChip />}
      </div>
      <div className="lb2-big lb2-s">
        <b>{fmt(shownValue.value)}</b>
        <small>{shownValue.unit}</small>
      </div>
      <div className="lb2-meter"><i /></div>
    </li>
  );
}

function Zone({ kind }: { kind: 2 | 3 }) {
  const cls = kind === 2 ? "z2" : "z3";
  const text = kind === 2 ? "Места 11–25" : "Места 26–100";
  return <li className={`lb-zone ${cls}`}>{text}</li>;
}

/* ------------------------------- Страница ------------------------------ */

export function LeaderboardView() {
  const [periodPick, setPeriod] = useState<Period>("week");
  const [metric, setMetric] = useState<BoardMetric>("xp");
  // Часы и серии копятся за всё время, недельной таблицы у них нет
  const period: Period = metric === "xp" ? periodPick : "all";
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState<0 | 1 | 2>(0);

  const account = useAccount();
  const profile = useProfile();
  const progress = useProgress();
  const levelInfo = useLevelInfo();
  const tagSel = useTagSelection();
  const titleSel = useTitleSelection();
  const watch = watchStore.useStore();
  const stats = watchStats(watch);

  const board = useLeaderboardBoard(period, metric);

  const filteredRows = useMemo(
    () =>
      board.rows.filter((row) => {
        if (filter === 1) return row.premium;
        if (filter === 2) return !row.premium;
        return true;
      }),
    [board.rows, filter],
  );

  const podium = filteredRows.slice(0, 3);
  const shown = filteredRows.slice(3, expanded ? 100 : 25);
  const top = Math.max(1, filteredRows[0]?.points ?? 1);

  /* Своя строка — настоящие локальные цифры профиля (рамка, тег, часы,
   * серии); очки и место за неделю приходят с сервера, если есть аккаунт. */
  const me = useMemo(
    () => ({
      points:
        metric === "hours"
          ? stats.minutes
          : metric === "series"
            ? stats.episodes
            : period === "week"
              ? (board.me?.points ?? 0)
              : progress.progress.xpTotal,
      level: levelInfo.level,
      premium: isPremiumActive(account),
      series: stats.episodes,
      hours: Math.floor(stats.minutes / 60),
      minutes: stats.minutes % 60,
      frame: FRAMES.find((f) => f.id === profile.frameId),
      tags: [
        ...(tagSel.primary ? REAL_TAGS.filter((t): t is TagDef => t.id === tagSel.primary) : []),
        ...tagSel.extras.map((id) => REAL_TAGS.find((t): t is TagDef => t.id === id)).filter((t): t is TagDef => Boolean(t)),
      ].slice(0, 1),
      titles: [
        ...(titleSel.primary ? TITLES.filter((t) => t.id === titleSel.primary) : []),
        ...titleSel.extras.map((id) => TITLES.find((t) => t.id === id)).filter((t): t is TitleItem => Boolean(t)),
      ].slice(0, 1),
    }),
    [account, profile, progress, levelInfo, stats, period, metric, board.me, tagSel.primary, tagSel.extras, titleSel.primary, titleSel.extras],
  );

  const myName = account?.nickname ?? "Гость";
  const myRank = metric === "xp" && period === "week" ? board.me?.rank ?? null : null;

  /* ---------------------------- Обратный отсчёт -------------------------- */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const left = useMemo(() => {
    if (period === "all") return null;
    const d = new Date(now);
    const daysUntilMonday = ((8 - d.getUTCDay()) % 7) || 7;
    const target = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + daysUntilMonday);
    const s = Math.max(0, Math.floor((target - now) / 1000));
    return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60) };
  }, [period, now]);

  const lastRow = filteredRows[filteredRows.length - 1];
  const cutoff = filteredRows.length >= 100 ? filteredRows[99] : lastRow;
  const gapTo100 = account && cutoff ? Math.max(0, Math.round(cutoff.points - me.points)) : 0;
  const inTop = account ? myRank !== null && (cutoff ? me.points >= cutoff.points : true) : false;

  return (
    <div className="lb">
      {/* ------------------------------ Герой ------------------------------ */}
      <section className="lb-hero">
        <div>
          <div className="lb-eb">
            <i />
            Сезон идёт
          </div>
          <h1 className="lb-h1">Лидерборд</h1>
          <p className="lb-lead">
            Настоящие игроки AniGalaxy. Очки — опыт за неделю. Итоги — в понедельник в 00:00 по UTC (03:00 по Москве).
          </p>
        </div>

        {left && (
          <div className="lb-tm">
            <small>До итогов недели</small>
            <div className="lb-d">
              <span><b>{left.d}</b><i>дней</i></span>
              <span><b>{String(left.h).padStart(2, "0")}</b><i>часов</i></span>
              <span><b>{String(left.m).padStart(2, "0")}</b><i>минут</i></span>
            </div>
          </div>
        )}
      </section>

      {/* --------------------------- Фильтры ----------------------------- */}
      <div className="lb-bar">
        <div className="lb-seg" role="tablist" aria-label="Что считаем">
          {METRICS.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={metric === m.id}
              className={metric === m.id ? "on" : ""}
              onClick={() => {
                setMetric(m.id);
                setExpanded(false);
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
        {metric === "xp" && (
        <div className="lb-seg" role="tablist" aria-label="Период">
          {(["week", "all"] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={period === p}
              className={period === p ? "on" : ""}
              onClick={() => {
                setPeriod(p);
                setExpanded(false);
              }}
            >
              {p === "week" ? "Неделя" : "Всё время"}
            </button>
          ))}
        </div>
        )}
        <div className="lb-chips">
          {(["Все", "Premium", "Free"] as const).map((label, i) => (
            <button key={label} type="button" className={filter === i ? "on" : ""} onClick={() => setFilter(i as 0 | 1 | 2)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ---------------------------- Подиум ------------------------------ */}
      {podium.length > 0 && <Podium rows={podium} metric={metric} />}

      {/* ---------------------------- Награды ----------------------------- */}
      {period === "week" && (
        <section className="lb-lad">
          <div className="lb-lg">
            {PRIZES.map((p, i) => (
              <div key={p.place} className={`lb-lc${i === 0 ? " g" : ""}`}>
                <b>{p.place}</b>
                <span>{p.text}</span>
              </div>
            ))}
          </div>
          <div className="lb-note">
            <b>Как считаются места:</b> очки недели — это XP, набранный с понедельника, среди реальных игроков сайта.
            Когда неделя закрывается, место определяется среди 100 лучших, а XP и AC начисляются сами, титулы и рамки
            появляются в профиле.
          </div>
        </section>
      )}

      {/* ----------------------------- Список ----------------------------- */}
      {board.ready && filteredRows.length === 0 ? (
        <p className="lb-empty">
          {metric === "xp" ? <>Пока никто не набрал очков {period === "week" ? "за эту неделю" : "за всё время"} — будьте первым.</> : "Пока никто не посмотрел ни одной серии с аккаунтом — будьте первым."}
        </p>
      ) : (
        <ol className="lb2-grid">
          {shown.map((row, i) => (
            <Zone3Wrap key={`${row.nickname}-${row.rank}`} row={row} index={i} top={top} metric={metric} />
          ))}
        </ol>
      )}

      {!expanded && filteredRows.length > 25 && (
        <button type="button" className="lb-more" onClick={() => setExpanded(true)}>
          Показать места 26–100
        </button>
      )}

      {/* -------------------------- Твоё место --------------------------- */}
      {account && (
        <div className="lb-dock">
          <div className="lb-dk">{fmt(metricValue(metric, me.points).value)}</div>
          <div className="lb-dx">
            <small>Твоё место{myRank ? ` · #${myRank}` : ""}</small>
            <b>{myName}</b>
            <div className="lb-gap">
              <i style={{ width: `${Math.max(0, Math.min(100, (me.points / top) * 100))}%` }} />
            </div>
            <em>
              {!inTop && gapTo100 > 0 ? (
                <>До топа ещё <strong>{fmt(metricValue(metric, gapTo100).value)}</strong> {metricValue(metric, gapTo100).unit === "опыта" ? "очков" : metricValue(metric, gapTo100).unit}</>
              ) : (
                <>Уровень {me.level}, {me.series} серий</>
              )}
            </em>
          </div>
          <Link href="/" className="lb-up">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
            <span>Наверх</span>
          </Link>
        </div>
      )}
    </div>
  );
}

/** Зона-разделитель перед строкой + сама строка (вставляется в <ol>) */
function Zone3Wrap({ row, index, top, metric }: { row: BoardRow; index: number; top: number; metric: BoardMetric }) {
  return (
    <>
      {row.rank === 11 && <Zone kind={2} />}
      {row.rank === 26 && <Zone kind={3} />}
      <RankRow row={row} max={top} index={index} metric={metric} />
    </>
  );
}
