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

import { Fragment, useEffect, useMemo, useState } from "react";
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

function fmt(n: number): string {
  return Math.round(n).toLocaleString("ru-RU");
}

/* ------------------------------ Подиум --------------------------------- */

const CROWN = (
  <svg className="lb-crown" width="36" height="28" viewBox="0 0 34 26" fill="currentColor" aria-hidden>
    <path d="M2 8l7 6 8-11 8 11 7-6-3 16H5z" />
  </svg>
);

function Podium({ entries }: { entries: Entry[] }) {
  // Порядок отрисовки: 2, 1, 3 — иначе первое место окажется не по центру
  const order = [1, 0, 2];
  return (
    <section className="lb-podium">
      {order.map((i) => {
        const p = entries[i];
        if (!p) return null;
        const place = i + 1;
        return (
          <div key={p.name} className={`lb-pod lb-p${place}`}>
            {place === 1 && CROWN}
            <div className="lb-orb">
              <AvatarFrame
  nickname={p.name}
  frame={p.frame}
  size="xs"
/>
            </div>
            <div className="lb-pod-n">{p.name}</div>
            {p.titles[0] && <div className="lb-pod-tt">{p.titles[0].name}</div>}
            <div className="lb-pod-p">{fmt(p.points)}</div>
            <div className="lb-pod-s">
              Ур. {p.level} · серия {Math.round(24 - i * 2)} дн.
            </div>
            <div className="lb-ped">{place}</div>
          </div>
        );
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

function Row({ entry, max }: { entry: Entry; max: number }) {
  return (
    <li
      className={`lb-row${entry.me ? " me" : ""}`}
      style={
        {
          "--w": `${((entry.points / max) * 100).toFixed(1)}%`,
          "--d": "0s",
        } as React.CSSProperties
      }
    >
      <span className="lb-rk">{entry.rank}</span>

      {/* Настоящая рамка проекта вместо круга с инициалами */}
      <AvatarFrame
  nickname={entry.name}
  frame={entry.frame}
  size="xs"
/>

      <div className="lb-nm">
        <div className="lb-l1">
          <b>{entry.name}</b>
          {/* Один тег и один титул — тем же AgTag, что и в профиле */}
          {entry.tags.map((tag, i) => (
            <LbBadge key={`${entry.name}-tag-${i}`} tag={tag} />
          ))}
          {entry.titles.map((title, i) => (
            <LbBadge key={`${entry.name}-title-${i}`} tag={titleTag(title)} />
          ))}
          {entry.premium && <span className="lb-chip pr">PREMIUM</span>}
        </div>

        {/* Статистика: иконка + значение, через «+» и вертикальную черту */}
        <div className="lb-sub">
          <span className="lb-stat" title="Серий просмотрено">
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
            </svg>
            {entry.series}
          </span>
          <i className="lb-plus">+</i>
          <span className="lb-stat" title="Время просмотра">
            <svg viewBox="0 0 24 24" aria-hidden>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            {entry.hours}ч {entry.minutes}м
          </span>
          <i className="lb-plus">+</i>
          <span className="lb-stat" title="Очки">
            <svg viewBox="0 0 24 24" aria-hidden>
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="3.2" />
            </svg>
            {fmt(entry.points)}
          </span>
        </div>
      </div>

      {/* Настоящая эмблема уровня проекта вместо шестиугольника с числом */}
      <div className="lb-lv">
        <LevelEmblem level={entry.level} size={46} />
      </div>

      <div className="lb-pt">
        <b>{fmt(entry.points)}</b>
        <small>очков</small>
      </div>
    </li>
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

  const account = useAccount();
  const profile = useProfile();
  const progress = useProgress();
  const levelInfo = useLevelInfo();
  const tagSel = useTagSelection();
  const titleSel = useTitleSelection();
  const watch = watchStore.useStore();
  const stats = watchStats(watch);

  const entries = useMemo(() => buildRoster(period), [period]);

  const top = entries[0]?.points ?? 1;

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
      <Podium entries={entries} />

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
      <ol className="lb-rows">
        {rows.length === 0 && <li className="lb-empty">Здесь пока никого нет.</li>}
        {rows.map((entry, i) => (
          // Fragment, а не div: внутри <ol> могут лежать только <li>
          <Fragment key={`${entry.name}-${entry.rank}-${i}`}>
            {filter === 0 && entry.rank === 5 && <Zone kind={1} />}
            {filter === 0 && entry.rank === 11 && <Zone kind={2} />}
            {filter === 0 && entry.rank === 26 && <Zone kind={3} />}
            <Row entry={entry} max={top} />
          </Fragment>
        ))}
      </ol>

      {!expanded && (
        <button type="button" className="lb-more" onClick={() => setExpanded(true)}>
          Показать места 26–50
        </button>
      )}

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
