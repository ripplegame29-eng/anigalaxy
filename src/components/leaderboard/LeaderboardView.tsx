"use client";

/**
 * Лидерборд AniGalaxy.
 *
 * Вёрстка 1:1 по макету (anigalaxy-leaderboard.html). Отличается ровно одно,
 * и это то, ради чего страница делалась:
 *
 *   В макете рамки, теги и уровень — заглушки: круг с инициалами и оттенком
 *   `--h`, квадратные плашки-чипы и шестиугольник с числом. Здесь на их местах
 *   настоящие предметы проекта: `AvatarView` с рамкой из каталога `FRAMES`,
 *   `AgTag` с реальными тегами из `PROGRESSION_CONFIG.tags` и `LevelEmblem`.
 *   То есть на странице видно ровно те рамки и теги, которые есть в проекте.
 *
 * ЧЕСТНО ПРО ДАННЫЕ ЗРИТЕЛЕЙ: сервера и базы пользователей у проекта нет,
 * поэтому соперники — детерминированно сгенерированные строки (имя, очки,
 * серии, часы), ровно как в макете. Это не настоящие люди, и выглядеть они
 * не должны. Настоящие здесь три вещи: косметика зрителей, уровни по
 * реальной кривой XP и строка «Твоё место» — она целиком из твоего профиля.
 */

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AvatarFrame } from "@/components/profile/AvatarFrame";
import { AgTag } from "@/components/progression/AgTag";
import { LevelEmblem } from "@/components/LevelEmblem";
import { FRAMES, TITLES, titleTag, type FrameItem, type TitleItem } from "@/lib/cosmetics";
import { isPremiumActive } from "@/lib/auth";
import { PROGRESSION_CONFIG } from "@/lib/progression/progression.config";
import type { TagDef } from "@/lib/progression/types";
import { useLevelInfo, useProgress } from "@/lib/progression/events";
import { useTagSelection, useTitleSelection } from "@/lib/selection";
import { useAccount } from "@/lib/use-account";
import { useProfile } from "@/lib/profile";
import { watchStats, watchStore } from "@/lib/history";
import "./leaderboard.css";
import "./leaderboard-premium.css";
import { PremiumChip } from "@/components/profile/PremiumChip";

/* ------------------------------- Данные -------------------------------- */

const NAMES = [
  "Нова", "Kitsune9", "Мирай", "Рэйден", "Hoshi", "Tenshi", "Кайро", "Yuzu",
  "Люмен", "Orion", "Вега", "Zeno", "Аматэру", "Ронин", "Haru", "Селена",
  "Nox", "Сумрак", "Aoi", "Дракон_7", "Mitsuki", "Эхо", "Raiko", "Лунная", "Sora",
];

/** Множитель очков за период: неделя / месяц / всё время */
const PERIOD_SCALE = [1, 4.3, 28];
const TOP_POINTS = 4702;
const TOTAL_ROWS = 50;

/**
 * Сколько значков показывать у ника в строке.
 *
 * Два суммарно: один тег и один титул (если титула нет — до двух тегов).
 * Больше строка перестаёт читаться как список, а в шапке профиля и на
 * странице зрителя должно быть одно и то же.
 */
const MAX_BADGES = 2;

/** Настоящие рамки проекта (без «без рамки») */
const REAL_FRAMES = FRAMES.filter((f) => f.id !== "f-none");

/**
 * Настоящие теги проекта.
 *
 * Приведение к TagDef нужно потому, что `PROGRESSION_CONFIG.tags` — литерал,
 * и TypeScript выводит из него узкий объединённый тип. Без него предикат
 * `t is TagDef` не считается валидным, а он нужен, чтобы отбросить
 * `undefined` из `.find()`.
 */
const REAL_TAGS = PROGRESSION_CONFIG.tags as TagDef[];

interface Entry {
  rank: number;
  name: string;
  points: number;
  level: number;
  series: number;
  /** Прочитано глав манги (демо; у тебя пока 0 — учёта чтения нет) */
  chapters: number;
  hours: number;
  minutes: number;
  premium: boolean;
  /** Настоящая рамка из каталога проекта */
  frame: FrameItem | undefined;
  /** Настоящие теги проекта — компактные капсулы, как на референсе */
  tags: TagDef[];
  /** Настоящие титулы проекта — отдельными чипами */
  titles: TitleItem[];
  /** Это текущий пользователь: его строка рисуется живыми данными */
  me?: boolean;
}

/** Детерминированный псевдослучайный шум: без него строки менялись бы при
 *  каждом рендере и «прыгали» бы между фильтрами. */
function noise(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Генерация соперников.
 *
 * Косметика настоящая: рамки, теги и титулы берутся из каталогов проекта.
 * Сами соперники — сгенерированные строки (сервера и базы пользователей у
 * проекта нет), и подписи к их тегам тоже выдуманные: настоящие значения
 * есть только у твоей строки, она собирается отдельно.
 */
function buildRoster(period: number): Entry[] {
  const entries: Entry[] = [];
  for (let i = 0; i < TOTAL_ROWS; i++) {
    const k = (i * 7 + period * 3) % NAMES.length;
    const frame = REAL_FRAMES[Math.floor(noise(i + period * 11, 2) * REAL_FRAMES.length)];

    // Ровно один тег и один титул на строку, без повторов
    const tags: TagDef[] = [];
    for (let t = 0; tags.length < 1; t++) {
      if (t > REAL_TAGS.length) break;
      const tag = REAL_TAGS[Math.floor(noise(i * 3 + t + period * 13, 4 + t) * REAL_TAGS.length)];
      if (tag && !tags.includes(tag)) tags.push(tag);
    }

    const totalMinutes = Math.round((64 - i * 0.7) * PERIOD_SCALE[period] * 0.9 * 60);
    const title = i < 10 ? TITLES[0] : TITLES[Math.floor(noise(i + 31, period) * TITLES.length)];

    entries.push({
      rank: i + 1,
      name: NAMES[k] + (i >= NAMES.length ? `_${i + 1}` : ""),
      points: TOP_POINTS * PERIOD_SCALE[period] * Math.pow(0.982, i) * (1 - noise(i, period) * 0.01),
      level: 12 + Math.floor(noise(i + 9, period) * 70),
      series: Math.round((240 - i * 2) * PERIOD_SCALE[period] * 0.9),
      chapters: Math.round((420 - i * 3.2) * PERIOD_SCALE[period] * (0.7 + noise(i + 5, period) * 0.6)),
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60,
      premium: noise(i + 13, period) > 0.45,
      frame,
      tags,
      titles: title ? [title] : [],
    });
  }
  return entries;
}

type SortKey = "hours" | "series" | "manga" | "level";
const SORTS: { key: SortKey; label: string; unit: string }[] = [
  { key: "hours", label: "По часам", unit: "минут" },
  { key: "series", label: "По сериям", unit: "серий" },
  { key: "manga", label: "По манге", unit: "глав" },
  { key: "level", label: "По уровню", unit: "уровень" },
];

function metricOf(e: Entry, sort: SortKey): number {
  if (sort === "hours") return e.hours * 60 + e.minutes;
  if (sort === "series") return e.series;
  if (sort === "manga") return e.chapters;
  return e.level;
}

function metricText(e: Entry, sort: SortKey): string {
  if (sort === "hours") return `${fmt(e.hours)} ч`;
  return fmt(metricOf(e, sort));
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString("ru-RU");
}

/* ------------------------------ Подиум --------------------------------- */

const CROWN = (
  <svg className="lb2-crown" viewBox="0 0 34 26" fill="currentColor" aria-hidden>
    <path d="M2 8l7 6 8-11 8 11 7-6-3 16H5z" />
  </svg>
);

/** Плавный набор числа: очки «разгоняются» при появлении карточки */
function useCountUp(target: number, ms = 1100): number {
  const [value, setValue] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const base = from.current;
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(base + (target - base) * eased);
      if (t < 1) raf = requestAnimationFrame(step);
      else from.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

/** Подсветка под курсором: свет следует за мышью по карточке */
function spotlight(event: React.PointerEvent<HTMLElement>) {
  const el = event.currentTarget;
  const rect = el.getBoundingClientRect();
  el.style.setProperty("--mx", `${event.clientX - rect.left}px`);
  el.style.setProperty("--my", `${event.clientY - rect.top}px`);
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <small>{label}</small>
      <b>{value}</b>
    </div>
  );
}

function PodiumCard({ entry, place, sort, onDuel }: { entry: Entry; place: 1 | 2 | 3; sort: SortKey; onDuel: (e: Entry) => void }) {
  const points = useCountUp(sort === "hours" ? entry.hours : metricOf(entry, sort));
  return (
    <article className={`lb2-pod p${place}`} onPointerMove={spotlight}>
      <span className="lb2-aura" aria-hidden />
      {place === 1 && CROWN}
      <span className="lb2-medal" aria-hidden>{place}</span>
      <div className="lb2-av">
        <AvatarFrame nickname={entry.name} frame={entry.frame} size="md" />
      </div>
      <h3 className="lb2-name">{entry.name}</h3>
      <div className="lb2-badges">
        <span className="lb2-lv"><LevelEmblem level={entry.level} size={34} /></span>
        {entry.titles[0] && <LbBadge tag={titleTag(entry.titles[0])} />}
        {entry.premium && <PremiumChip />}
      </div>
      <div className="lb2-big">
        <b>{fmt(points)}{sort === "hours" ? " ч" : ""}</b>
        <small>{sort === "hours" ? "просмотра" : SORTS.find((x) => x.key === sort)?.unit}</small>
      </div>
      <div className="lb2-stats">
        <Stat label="Серий" value={fmt(entry.series)} />
        <Stat label="Часов" value={`${entry.hours}`} />
        <Stat label="Уровень" value={`${entry.level}`} />
      </div>
      <button type="button" className="lb2-duel-btn" onClick={() => onDuel(entry)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m14 4 6 6M4 20l7-7M9 15l-4 4M20 4l-6 6M9 9 4 4" />
        </svg>
        Бросить вызов
      </button>
    </article>
  );
}

function Podium({ entries, sort, onDuel }: { entries: Entry[]; sort: SortKey; onDuel: (e: Entry) => void }) {
  // Порядок отрисовки: 2, 1, 3 — иначе первое место окажется не по центру
  const order = [1, 0, 2] as const;
  return (
    <section className="lb2-podium">
      {order.map((i) => {
        const entry = entries[i];
        if (!entry) return null;
        return <PodiumCard key={`${sort}-${entry.name}`} entry={entry} place={(i + 1) as 1 | 2 | 3} sort={sort} onDuel={onDuel} />;
      })}
    </section>
  );
}

/* ------------------------------- Список -------------------------------- */

/**
 * Тег или титул в строке лидерборда.
 *
 * Оба показываются одним и тем же компонентом — обычным `AgTag` проекта:
 * в самом проекте титул и есть тег (`titleTag(item)` превращает его в
 * TagDef). Дизайн, анимации и эффекты не тронуты, уменьшены только
 * габариты классом `lb-tag` (см. leaderboard.css).
 *
 * Класс висит на самом теге, а не на обёртке: с `zoom` на обёртке её бокс и
 * бокс тега расходятся (у капсулы есть позиционированные слои эффектов,
 * они вылезают наружу), и капсула уезжает за пределы своей строки.
 * `width: max-content` — чтобы длинное имя не обрезалось.
 */
function LbBadge({ tag }: { tag: TagDef }) {
  return <AgTag tag={tag} size="sm" className="lb-tag" />;
}

function RankCard({ entry, max, index, sort, onDuel }: { entry: Entry; max: number; index: number; sort: SortKey; onDuel: (e: Entry) => void }) {
  const top = entry.rank <= 10;
  return (
    <li
      className={`lb2-card${entry.me ? " me" : ""}${top ? " top" : ""}`}
      style={{ "--n": index, "--w": `${((metricOf(entry, sort) / Math.max(1, max)) * 100).toFixed(1)}%` } as React.CSSProperties}
      onPointerMove={spotlight}
    >
      <span className="lb2-rank">{entry.me ? "ТЫ" : `#${entry.rank}`}</span>
      <div className="lb2-av lb2-s">
        <AvatarFrame nickname={entry.name} frame={entry.frame} size="xs" />
      </div>
      <h4 className="lb2-name lb2-s">{entry.name}</h4>
      <div className="lb2-badges lb2-s">
        <span className="lb2-lv"><LevelEmblem level={entry.level} size={28} /></span>
        {entry.tags.slice(0, 1).map((tag, i) => (
          <LbBadge key={`${entry.name}-tag-${i}`} tag={tag} />
        ))}
        {entry.premium && <PremiumChip />}
      </div>
      <div className="lb2-big lb2-s">
        <b>{metricText(entry, sort)}</b>
        <small>{sort === "hours" ? "просмотра" : SORTS.find((x) => x.key === sort)?.unit}</small>
      </div>
      <div className="lb2-meter"><i /></div>
      <div className="lb2-stats lb2-s">
        <Stat label="Серий" value={fmt(entry.series)} />
        <Stat label={sort === "manga" ? "Часов" : "Глав"} value={sort === "manga" ? `${entry.hours}ч` : fmt(entry.chapters)} />
      </div>
      {!entry.me && (
        <button type="button" className="lb2-duel-btn lb2-s" onClick={() => onDuel(entry)} aria-label={`Сравнить себя с ${entry.name}`}>
          Сравнить
        </button>
      )}
    </li>
  );
}

/** Дуэль: ты против выбранного игрока. Твои цифры настоящие, соперник — демо. */
function Duel({ me, rival, onClose }: { me: Entry; rival: Entry; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rows: { label: string; a: number; b: number; fmtv: (n: number) => string }[] = [
    { label: "Очки", a: me.points, b: rival.points, fmtv: fmt },
    { label: "Серий просмотрено", a: me.series, b: rival.series, fmtv: fmt },
    { label: "Время просмотра", a: me.hours * 60 + me.minutes, b: rival.hours * 60 + rival.minutes, fmtv: (n) => `${Math.floor(n / 60)}ч ${n % 60}м` },
    { label: "Уровень", a: me.level, b: rival.level, fmtv: fmt },
  ];
  const wins = rows.filter((row) => row.a >= row.b).length;
  const gap = Math.max(0, Math.round(rival.points - me.points));

  return (
    <div className="lb2-duel" role="dialog" aria-modal="true" aria-label={`Дуэль с ${rival.name}`} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="lb2-duel-box">
        <button type="button" className="lb2-x" onClick={onClose} aria-label="Закрыть">×</button>
        <div className="lb2-vs">
          <div>
            <AvatarFrame nickname={me.name} frame={me.frame} size="md" />
            <b>{me.name}</b>
            <small>Ты</small>
          </div>
          <span className="lb2-vs-mark">VS</span>
          <div>
            <AvatarFrame nickname={rival.name} frame={rival.frame} size="md" />
            <b>{rival.name}</b>
            <small>Место #{rival.rank}</small>
          </div>
        </div>

        <ul className="lb2-cmp">
          {rows.map((row, i) => {
            const total = Math.max(1, row.a + row.b);
            return (
              <li key={row.label} style={{ "--i": i } as React.CSSProperties}>
                <div className="lb2-cmp-h">
                  <b className={row.a >= row.b ? "win" : undefined}>{row.fmtv(row.a)}</b>
                  <span>{row.label}</span>
                  <b className={row.b > row.a ? "win" : undefined}>{row.fmtv(row.b)}</b>
                </div>
                <div className="lb2-cmp-bar">
                  <i className="a" style={{ width: `${(row.a / total) * 100}%` }} />
                  <i className="b" style={{ width: `${(row.b / total) * 100}%` }} />
                </div>
              </li>
            );
          })}
        </ul>

        <p className="lb2-verdict">
          {wins === rows.length
            ? "Ты впереди по всем показателям."
            : gap > 0
              ? `Побед в сравнении: ${wins} из ${rows.length}. До очков соперника не хватает ${fmt(gap)}.`
              : `Побед в сравнении: ${wins} из ${rows.length}. По очкам ты уже впереди.`}
        </p>
        <p className="lb2-demo">Соперник — демо-профиль: у проекта нет сервера игроков. Твои цифры настоящие.</p>
      </div>
    </div>
  );
}

function Zone({ kind }: { kind: 1 | 2 | 3 }) {
  const cls = kind === 1 ? "z1" : kind === 2 ? "z2" : "z3";
  const text =
    kind === 1 ? "Рамка и титул — до 5 места" : kind === 2 ? "Места 11–25 · опыт и AC" : "Места 26–100 · опыт и AC";
  return <li className={`lb-zone ${cls}`}>{text}</li>;
}

/* ------------------------------- Страница ------------------------------ */

export function LeaderboardView() {
  const [period, setPeriod] = useState(0);
  const [filter, setFilter] = useState<0 | 1 | 2>(0);
  const [expanded, setExpanded] = useState(false);
  const [duel, setDuel] = useState<Entry | null>(null);
  const [sort, setSort] = useState<SortKey>("hours");
  const [sortOpen, setSortOpen] = useState(false);

  const account = useAccount();
  const profile = useProfile();
  const progress = useProgress();
  const levelInfo = useLevelInfo();
  const tagSel = useTagSelection();
  const titleSel = useTitleSelection();
  const watch = watchStore.useStore();
  const stats = watchStats(watch);

  const entries = useMemo(
    () =>
      buildRoster(period)
        .sort((a, b) => metricOf(b, sort) - metricOf(a, sort) || a.rank - b.rank)
        .map((e, i) => ({ ...e, rank: i + 1 })),
    [period, sort],
  );

  const top = Math.max(1, metricOf(entries[0] ?? ({} as Entry), sort) || 1);

  /* Строка «Твоё место» — единственная по-настоящему: имя, очки, уровень,
   * серии и часы берутся из твоего профиля. Если тебя нет в первых 50, строка
   * всё равно показывается — но уже в доке внизу. */
  const meEntry: Entry = useMemo(
    () => ({
      rank: 0,
      name: account?.nickname ?? "Гость",
      points: progress.progress.xpTotal,
      level: levelInfo.level,
      series: stats.episodes,
      chapters: 0,
      hours: Math.floor(stats.minutes / 60),
      minutes: stats.minutes % 60,
      premium: isPremiumActive(account),
      frame: FRAMES.find((f) => f.id === profile.frameId),
      // Настоящие надетые теги: сначала основной, потом дополнительные.
      // Берём через хуки проекта — там уже разобрано, где лежит основной
      // тег, а где дополнительные (движок против профиля).
      tags: [
        ...tagSel.primary
          ? REAL_TAGS.filter((t): t is TagDef => t.id === tagSel.primary)
          : [],
        ...tagSel.extras
          .map((id) => REAL_TAGS.find((t): t is TagDef => t.id === id))
          .filter((t): t is TagDef => Boolean(t)),
      ].slice(0, 1),
      titles: [
        ...(titleSel.primary ? TITLES.filter((t) => t.id === titleSel.primary) : []),
        ...titleSel.extras
          .map((id) => TITLES.find((t) => t.id === id))
          .filter((t): t is TitleItem => Boolean(t)),
      ].slice(0, MAX_BADGES - 1),
      me: true,
    }),
    [account, profile, progress, levelInfo, stats, tagSel.primary, tagSel.extras, titleSel.primary, titleSel.extras],
  );

  const shown = useMemo(() => {
    const end = expanded ? TOTAL_ROWS : 25;
    return entries.slice(3, end).filter((p) => {
      if (filter === 1) return p.premium;
      if (filter === 2) return !p.premium;
      return true;
    });
  }, [entries, filter, expanded]);

  // Вставляем свою строку в список, если по очкам ты попал в показанную часть
  const rows = useMemo(() => {
    const out: Entry[] = [];
    for (const entry of shown) {
      if (!entry.me && meEntry.points > 0 && entry.rank === 1) {
        out.push({ ...meEntry, rank: 4 });
      }
      out.push(entry);
    }
    return out;
  }, [shown, meEntry]);

  /* ---------------------------- Обратный отсчёт -------------------------- */

  /* Тикает раз в полминуты, поэтому в состоянии лежит просто «сейчас», а сам
   * отсчёт считается из него через useMemo. Иначе пришлось бы писать setState
   * прямо в теле эффекта — React это справедливо запрещает. */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const left = useMemo(() => {
    // У «Всё время» итогов нет — блок счётчика скрыт
    if (period === 2) return null;
    const d = new Date(now);
    let target: number;
    if (period === 0) {
      const daysUntilMonday = ((8 - d.getUTCDay()) % 7) || 7;
      target = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + daysUntilMonday);
    } else {
      target = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
    }
    const s = Math.max(0, Math.floor((target - now) / 1000));
    return {
      d: Math.floor(s / 86400),
      h: Math.floor((s % 86400) / 3600),
      m: Math.floor((s % 3600) / 60),
    };
  }, [period, now]);

  /* Сколько очков до сотого места — для дока внизу */
  const gapTo100 = Math.max(0, Math.round((entries[99]?.points ?? 0) - meEntry.points));
  const top100 = entries[99]?.points ?? 1;
  const gapPct = Math.max(0, Math.min(100, (meEntry.points / top100) * 100));

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
            Самые упорные зрители AniGalaxy. Очки обновляются каждый день, итоги — в понедельник в 00:00 по МСК.
          </p>
        </div>

        {left && (
          <div className="lb-tm">
            <small>До итогов {period === 0 ? "недели" : "месяца"}</small>
            <div className="lb-d">
              <span>
                <b>{left.d}</b>
                <i>дней</i>
              </span>
              <span>
                <b>{String(left.h).padStart(2, "0")}</b>
                <i>часов</i>
              </span>
              <span>
                <b>{String(left.m).padStart(2, "0")}</b>
                <i>минут</i>
              </span>
            </div>
          </div>
        )}
      </section>

      {/* --------------------------- Фильтры ----------------------------- */}
      <div className="lb-bar">
        <div className="lb-seg" role="tablist">
          {["Неделя", "Месяц", "Всё время"].map((label, i) => (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={period === i}
              className={period === i ? "on" : ""}
              onClick={() => {
                setPeriod(i);
                setExpanded(false);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="lb2-sort">
          <span>Топ пользователей</span>
          <button type="button" className="lb2-sort-btn" aria-haspopup="listbox" aria-expanded={sortOpen} onClick={() => setSortOpen((v) => !v)} onBlur={() => setTimeout(() => setSortOpen(false), 120)}>
            {SORTS.find((x) => x.key === sort)?.label}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
          </button>
          {sortOpen && (
            <ul className="lb2-sort-menu" role="listbox">
              {SORTS.map((x) => (
                <li key={x.key} role="option" aria-selected={sort === x.key} className={sort === x.key ? "on" : ""} onMouseDown={() => { setSort(x.key); setSortOpen(false); setExpanded(false); }}>
                  {x.label}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="lb-chips">
          {(["Все", "Premium", "Free"] as const).map((label, i) => (
            <button
              key={label}
              type="button"
              className={filter === i ? "on" : ""}
              onClick={() => setFilter(i as 0 | 1 | 2)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ---------------------------- Подиум ------------------------------ */}
      <Podium entries={entries} sort={sort} onDuel={setDuel} />

      {/* ---------------------------- Награды ----------------------------- */}
      {period === 0 && (
        <section className="lb-lad">
          <div className="lb-lg">
            <div className="lb-lc g">
              <b>1 место</b>
              <span>8 000 XP и 1 500 AC, титул «Покоритель», золотая рамка</span>
            </div>
            <div className="lb-lc">
              <b>2–5</b>
              <span>4 000 XP и 800 AC, титул, рамка</span>
            </div>
            <div className="lb-lc">
              <b>6–10</b>
              <span>2 500 XP и 400 AC, титул</span>
            </div>
            <div className="lb-lc">
              <b>11–25</b>
              <span>1 200 XP и 200 AC</span>
            </div>
            <div className="lb-lc">
              <b>26–100</b>
              <span>400 XP и 80 AC</span>
            </div>
          </div>
          <div className="lb-note">
            <b>Демо-витрина наград:</b> сервера лидерборда и сезонных выплат нет, поэтому
            XP, AC и предметы за места сейчас не начисляются. Титула «Покоритель» и
            золотой рамки из макета в каталоге тоже нет — награды за квесты,
            достижения и боевой пропуск остаются настоящими.
          </div>
        </section>
      )}

      {/* ----------------------------- Список ----------------------------- */}
      <ol className="lb2-grid">
        {rows.length === 0 && <li className="lb-empty">Здесь пока никого нет.</li>}
        {rows.map((entry, i) => (
          // Fragment, а не div: внутри <ol> могут лежать только <li>
          <Fragment key={`${entry.name}-${entry.rank}-${i}`}>
            {filter === 0 && entry.rank === 11 && <Zone kind={2} />}
            {filter === 0 && entry.rank === 26 && <Zone kind={3} />}
            <RankCard entry={entry} max={top} index={i} sort={sort} onDuel={setDuel} />
          </Fragment>
        ))}
      </ol>

      {!expanded && (
        <button type="button" className="lb-more" onClick={() => setExpanded(true)}>
          Показать места 26–50
        </button>
      )}

      {duel && <Duel me={{ ...meEntry, rank: 0 }} rival={duel} onClose={() => setDuel(null)} />}

      {/* -------------------------- Твоё место --------------------------- */}
      <div className="lb-dock">
        <div className="lb-dk">{fmt(meEntry.points)}</div>
        <div className="lb-dx">
          <small>Твоё место</small>
          <b>{meEntry.name}</b>
          <div className="lb-gap">
            <i style={{ width: `${gapPct}%` }} />
          </div>
          <em>
            {gapTo100 > 0 ? (
              <>
                До топ-100 ещё <strong>{fmt(gapTo100)}</strong> очков
              </>
            ) : (
              <>
                Ты в топ-100: <strong>уровень {meEntry.level}</strong>, {meEntry.series} серий
              </>
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
    </div>
  );
}
