"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { bannerURL, posterURL } from "./art";
import type { ReleaseItem } from "@/lib/releases";

/**
 * Календарь релизов.
 *
 * Логика перенесена из макета почти как есть, но вместо сборки строк через
 * innerHTML всё рисуется React'ом. Это не спор о вкусе: `esc()` в оригинале
 * существовал только потому, что названия серий вставлялись в HTML строкой.
 * Здесь экранирование делает React, и класс с самым небезопасным способом
 * вывода просто исчезает.
 *
 * Из логики не тронуты детерминированные части: неделя считается от понедельника,
 * ближайший релиз ищется по времени выхода, счётчик обратного отсчёта идёт до
 * секунды. Они и давали макету его вид.
 */

const DAY_NAMES = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const DAY_FULL = [
  "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье",
];
const MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

/** Постоянный пустой массив для серверного снимка: useSyncExternalStore требует
 *  стабильной ссылки, иначе считает обновлением каждый рендер. */
const EMPTY: string[] = [];

const SLIDE_MS = 7000;
const FAVS_KEY = "ag_cal_favs";

type View = "day" | "list" | "week";
type Filter = "all" | "new" | "fav";

/* ------------------------------- даты ---------------------------------- */

function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // Date.getDay() отдаёт 0 = воскресенье, здесь нужно 0 = понедельник.
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Дата и время выхода серии в конкретной неделе. */
function airDate(weekStart: Date, item: ReleaseItem): Date {
  const [h, m] = item.time.split(":").map(Number);
  const d = addDays(weekStart, item.day);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

function ruPlural(n: number, a: string, b: string, c: string): string {
  const abs = Math.abs(n) % 100;
  const k = abs % 10;
  if (abs > 10 && abs < 20) return c;
  if (k > 1 && k < 5) return b;
  if (k === 1) return a;
  return c;
}

function sameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

/** Выходит ли серия в ближайшие полтора часа. */
function isHot(item: ReleaseItem, weekStart: Date): boolean {
  const minutes = (airDate(weekStart, item).getTime() - Date.now()) / 60000;
  return minutes > 0 && minutes <= 90;
}

interface Status {
  cls: "out" | "soon" | "wait";
  text: string;
}

function statusOf(item: ReleaseItem, weekStart: Date): Status {
  const diff = airDate(weekStart, item).getTime() - Date.now();
  if (diff <= 0) return { cls: "out", text: "Вышла" };

  const mins = Math.round(diff / 60000);
  if (mins < 60) return { cls: "soon", text: `через ${mins} мин` };

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return { cls: "soon", text: `через ${hrs} ч ${mins % 60} мин` };

  const days = Math.floor(hrs / 24);
  return { cls: "wait", text: `через ${days} ${ruPlural(days, "день", "дня", "дней")}` };
}

/* ------------------------------ состояние ------------------------------ */

/**
 * Избранное живёт в localStorage — это внешний источник, а не состояние React.
 *
 * Раньше оно читалось в эффекте, и это ломало правило react-hooks: после
 * гидрации всё равно следовал лишний рендер, а строка с setState в эффекте
 * — верный признак, что источник описан неверно. Здесь он описан честно:
 * снапшот отдаётся через useSyncExternalStore, а снимок кэшируется, потому
 * что разбор JSON возвращает новый массив каждый раз, и без кэша подписчик
 * считал бы обновление на каждый кадр.
 */
let favsCache: string[] | null = null;

function readFavs(): string[] {
  if (favsCache) return favsCache;
  try {
    const raw = localStorage.getItem(FAVS_KEY);
    favsCache = raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    favsCache = [];
  }
  return favsCache;
}

function writeFavs(next: string[]): void {
  favsCache = next;
  try {
    localStorage.setItem(FAVS_KEY, JSON.stringify(next));
  } catch {
    // Приватный режим: отметка просто не переживёт перезагрузку.
  }
  // Своё изменение не порождает событие storage — шлём вручную, чтобы
  // вторая вкладка тоже обновилась.
  window.dispatchEvent(new Event(FAVS_KEY));
}

function subscribeFavs(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(FAVS_KEY, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(FAVS_KEY, onChange);
  };
}

export function ReleasesView({ items }: { items: ReleaseItem[] }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [day, setDay] = useState(() => (new Date().getDay() + 6) % 7);
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<View>("day");
  const [slideIdx, setSlideIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [pointer, setPointer] = useState({ px: 0, py: 0 });
  /** Метка для скрамбла заголовка: увеличивается на каждом новом слайде. */
  const [slideTick, setSlideTick] = useState(0);

  // На сервере localStorage нет — снимок с сервера всегда пустой, и разметка
  // при гидрации не расходится.
  const favs = useSyncExternalStore(subscribeFavs, readFavs, () => EMPTY);

  const toggleFav = useCallback((id: string) => {
    const prev = readFavs();
    writeFavs(prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }, []);

  // Сейчас считается один раз на монтирование: Date.now() в теле рендера —
  // impure-вызов, из-за которого значения прыгали бы между рендерами.
  const today = useMemo(() => new Date(), []);
  const weekStart = useMemo(
    () => addDays(startOfWeek(today), weekOffset * 7),
    [today, weekOffset],
  );
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

  const visible = useMemo(() => {
    if (filter === "fav") return items.filter((i) => favs.includes(i.id));
    if (filter === "new") return items.filter((i) => i.isNew);
    return items;
  }, [items, filter, favs]);

  const todayIdx = (today.getDay() + 6) % 7;

  const stats = useMemo(
    () => ({
      week: items.length,
      today: items.filter((i) => i.day === todayIdx).length,
      fav: favs.length,
    }),
    [items, favs.length, todayIdx],
  );

  /* ------------------------------ сцена -------------------------------- */

  /** Ближайшие релизы: эта неделя и следующая, где время выхода ещё не прошло. */
  const stage = useMemo(() => {
    const base = startOfWeek(today);
    // Опорное «сейчас» берём из today, который уже посчитан на монтировании:
    // Date.now() в теле рендера — impure-вызов, и список пересобирался бы
    // на каждом проходе с разным результатом.
    const now = today.getTime();
    // Момент выхода храним числом (миллисекунды): с ним проще считать
    // разницу для обратного отсчёта и сортировки, а Date пришлось бы
    // приводить в двух местах подряд.
    const out: { item: ReleaseItem; at: number; ep: number }[] = [];

    for (let k = 0; k < 2; k += 1) {
      const ws = addDays(base, k * 7);
      for (const item of items) {
        const at = airDate(ws, item).getTime();
        if (at > now) out.push({ item, at, ep: (item.episodes ?? 1) + k });
      }
    }

    return out.sort((a, b) => a.at - b.at).slice(0, 4);
  }, [items, today]);

  /**
   * Индекс слайда зажат в границы списка.
   *
   * Раньше выход за границу «лечили» эффектом с setState — лишний рендер и
   * мигание на секунду, пока индекс выправлялся. Теперь индекс просто
   * зажимается при чтении, а состояние хранит то, что выбрал человек.
   */
  const safeIdx = Math.min(slideIdx, Math.max(0, stage.length - 1));
  const current = stage[safeIdx];

  useEffect(() => {
    if (paused || stage.length < 2) return;
    const timer = setTimeout(() => {
      setSlideIdx((i) => (i + 1) % stage.length);
      setSlideTick((t) => t + 1);
    }, SLIDE_MS);
    return () => clearTimeout(timer);
  }, [slideIdx, stage.length, paused]);

  /* ------------------------- обратный отсчёт ---------------------------- */

  /** Остаток до релиза. Обновляется каждую секунду — этого хватает, чтобы
   *  цифры менялись, но страница не перерисовывалась лишний раз. */
  const [remaining, setRemaining] = useState(() => {
    if (!current) return null;
    return Math.max(0, Math.floor((current.at - Date.now()) / 1000));
  });

  useEffect(() => {
    if (!current) return;
    const tick = () => {
      const sec = Math.floor((current.at - Date.now()) / 1000);
      setRemaining(Math.max(0, sec));
      // Релиз вышел: возвращаемся на первый слайд, иначе сцена продолжит
      // считать время до прошедшего события. Здесь, в тике таймера, а не в
      // отдельном эффекте: эффект с setState после рендера — это лишняя
      // отрисовка и предупреждение react-hooks.
      if (sec <= 0) {
        setSlideIdx(0);
        setSlideTick((t) => t + 1);
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [current]);

  /* ------------------------- навигация по неделе ------------------------ */

  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (navTimer.current) clearTimeout(navTimer.current);
  }, []);

  const changeDay = (next: number) => {
    setDay(next);
    setView("day");
  };

  /* ------------------------------ разметка ------------------------------ */

  const d = remaining ?? 0;
  const pad = (n: number) => String(n).padStart(2, "0");
  const days = Math.floor(d / 86400);
  const hours = Math.floor((d % 86400) / 3600);
  const minutes = Math.floor((d % 3600) / 60);
  const seconds = d % 60;

  const weekLabel =
    weekStart.getMonth() === weekEnd.getMonth()
      ? `${weekStart.getDate()}–${weekEnd.getDate()} ${MONTHS[weekEnd.getMonth()]}`
      : `${weekStart.getDate()} ${MONTHS[weekStart.getMonth()]} – ${weekEnd.getDate()} ${MONTHS[weekEnd.getMonth()]}`;

  const dayList = visible
    .filter((i) => i.day === day)
    .sort((a, b) => a.time.localeCompare(b.time));
  const dayDate = addDays(weekStart, day);

  const favOf = (id: string) => favs.includes(id);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: "Все" },
    { key: "new", label: "Премьеры" },
    { key: "fav", label: "Избранное" },
  ];

  const VIEWS: { key: View; label: string }[] = [
    { key: "day", label: "День" },
    { key: "list", label: "Список" },
    { key: "week", label: "Неделя" },
  ];

  return (
    <>
      <div className="crumbs">Главная / <b>Календарь релизов</b></div>

      {/* ------------------------- верхняя сцена ------------------------ */}
      {current ? (
        <section
          className={`stage${paused ? " paused" : ""}`}
          style={{ ["--px" as string]: pointer.px, ["--py" as string]: pointer.py }}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => {
            setPointer({ px: 0, py: 0 });
            setPaused(false);
          }}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setPointer({
              px: Number((((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3)),
              py: Number((((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3)),
            });
          }}
        >
          <div className="st-bgs">
            {stage.map((s, k) => (
              <div
                key={s.item.id}
                className={`st-bg${k === safeIdx ? " on" : ""}`}
                style={{ ["--img" as string]: `url('${bannerURL(s.item)}')` }}
              />
            ))}
          </div>
          <div className="st-shade" />
          <div className="st-leak" />
          <div className="st-grain" />
          <div className="st-scan" />
          <i className="hud tl" />
          <i className="hud tr" />
          <i className="hud bl" />
          <i className="hud br" />

          <div className="st-main">
            <div className="st-label">
              <span className="livedot" />
              <span>{slideIdx === 0 ? "СЛЕДУЮЩИЙ РЕЛИЗ" : "СКОРО В ЭФИРЕ"}</span>
              <em />
            </div>

            <h1 key={slideTick} className="st-title scramble" data-text={current.item.title}>
              {current.item.title}
            </h1>

            <div className="st-meta">
              {current.item.rating !== null ? (
                <span className="chip gold">★ {current.item.rating.toFixed(2)}</span>
              ) : null}
              {current.item.studio ? <span className="chip">{current.item.studio}</span> : null}
              <span className="chip">{current.ep} эп.</span>
              <span className="chip cy">
                {DAY_FULL[current.item.day]}, {current.item.time}
              </span>
              {current.item.genres.slice(0, 2).map((g) => (
                <span className="chip" key={g}>{g}</span>
              ))}
            </div>

            <div className="st-count">
              {days > 0 ? (
                <>
                  <div className="u"><b>{pad(days)}</b><span>дн</span></div>
                  <i>:</i>
                </>
              ) : null}
              <div className="u"><b>{pad(hours)}</b><span>ч</span></div>
              <i>:</i>
              <div className="u"><b>{pad(minutes)}</b><span>мин</span></div>
              <i>:</i>
              <div className="u"><b className="flip">{pad(seconds)}</b><span>сек</span></div>
            </div>

            <div className="st-actions">
              <button
                type="button"
                className={`btn ghost fx nb${favOf(current.item.id) ? " on" : ""}`}
                onClick={() => toggleFav(current.item.id)}
              >
                {favOf(current.item.id) ? "♥ В избранном" : "♡ В избранное"}
              </button>
            </div>
          </div>

          <div className="st-list">
            {stage.map((s, k) => (
              <button
                key={s.item.id}
                type="button"
                className={`st-row${k === slideIdx ? " on" : ""}`}
                onClick={() => {
                  setSlideIdx(k);
                  setSlideTick((t) => t + 1);
                }}
              >
                <span className="th" style={{ ["--img" as string]: `url('${posterURL(s.item)}')` }} />
                <span className="tx">
                  <b>{s.item.title}</b>
                  <span>{DAY_NAMES[s.item.day]} · {s.item.time} · {s.ep} эп.</span>
                </span>
                {k === safeIdx ? <span className="bar"><i /></span> : null}
              </button>
            ))}
          </div>

          <div className="st-sign">AniGalaxy</div>
        </section>
      ) : (
        <section className="stage">
          <div className="st-main">
            <h1 className="st-title">Расписание пустое</h1>
            <p style={{ color: "var(--muted)" }}>
              Добавьте релизы в панели управления — раздел «Контент».
            </p>
          </div>
        </section>
      )}

      {/* ----------------------------- счётчики -------------------------- */}
      <div className="statrow">
        <div className="stat"><b>{stats.week}</b><span>серий за неделю</span></div>
        <div className="stat"><b>{stats.today}</b><span>сегодня</span></div>
        <div className="stat"><b>{stats.fav}</b><span>в избранном</span></div>
      </div>

      {/* --------------------------- управление -------------------------- */}
      <div className="controls">
        <div className="weeknav">
          <button
            type="button"
            className="btn ghost"
            onClick={() => setWeekOffset((w) => w - 1)}
            aria-label="Предыдущая неделя"
          >
            ‹
          </button>
          <span className="weeklabel">{weekLabel}</span>
          <button
            type="button"
            className="btn ghost"
            onClick={() => setWeekOffset((w) => w + 1)}
            aria-label="Следующая неделя"
          >
            ›
          </button>
          {weekOffset !== 0 ? (
            <button type="button" className="btn ghost" onClick={() => setWeekOffset(0)}>
              Сегодня
            </button>
          ) : null}
        </div>

        <div className="right">
          <div className="seg" id="filter">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                className={filter === f.key ? "on" : ""}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="seg" id="view">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                type="button"
                className={view === v.key ? "on" : ""}
                onClick={() => setView(v.key)}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ------------------------------- дни ----------------------------- */}
      <div className="days" id="days">
        {DAY_NAMES.map((name, idx) => {
          const date = addDays(weekStart, idx);
          const count = visible.filter((i) => i.day === idx).length;
          const isToday = sameDay(date, today);
          return (
            <button
              key={idx}
              type="button"
              className={`day${isToday ? " today" : ""}${view === "day" && day === idx ? " on" : ""}`}
              onClick={() => changeDay(idx)}
            >
              <span className="dn">{name}</span>
              <span className="dd">{date.getDate()}</span>
              <span className="dc">{count} {ruPlural(count, "серия", "серии", "серий")}</span>
            </button>
          );
        })}
      </div>

      {/* ------------------------------ содержимое ------------------------ */}
      <div className="sec-title">
        <i />
        <h2 id="secTitle">
          {view === "day"
            ? `${DAY_FULL[day]}, ${dayDate.getDate()} ${MONTHS[dayDate.getMonth()]}`
            : view === "list"
              ? "Вся неделя списком"
              : "Неделя целиком"}
        </h2>
        <span id="secSub">
          {(view === "day" ? dayList.length : visible.length)}{" "}
          {ruPlural(view === "day" ? dayList.length : visible.length, "релиз", "релиза", "релизов")}
        </span>
      </div>

      <div id="content">
        {view === "day" ? (
          dayList.length > 0 ? (
            <div className="grid">
              {dayList.map((i) => (
                <Card
                  key={i.id}
                  item={i}
                  weekStart={weekStart}
                  fav={favOf(i.id)}
                  onFav={toggleFav}
                />
              ))}
            </div>
          ) : (
            <div className="empty">
              На этот день ничего не найдено
              {filter !== "all" ? " — попробуйте другой фильтр" : ""}
            </div>
          )
        ) : view === "list" ? (
          (() => {
            const sorted = [...visible].sort((a, b) => a.day - b.day || a.time.localeCompare(b.time));
            const groups = new Map<number, ReleaseItem[]>();
            for (const item of sorted) {
              const list = groups.get(item.day) ?? [];
              list.push(item);
              groups.set(item.day, list);
            }
            if (sorted.length === 0) return <div className="empty">Ничего не найдено.</div>;

            return [...groups.entries()].map(([idx, list]) => {
              const date = addDays(weekStart, idx);
              return (
                <div key={idx}>
                  <div className="sec-title" style={{ marginTop: 18 }}>
                    <i />
                    <h2 style={{ fontSize: 16 }}>
                      {DAY_FULL[idx]}, {date.getDate()} {MONTHS[date.getMonth()]}
                    </h2>
                  </div>
                  <div className="list" style={{ marginBottom: 8 }}>
                    {list.map((i) => (
                      <Row
                        key={i.id}
                        item={i}
                        weekStart={weekStart}
                        fav={favOf(i.id)}
                        onFav={toggleFav}
                      />
                    ))}
                  </div>
                </div>
              );
            });
          })()
        ) : (
          <div className="weekcols">
            {DAY_NAMES.map((name, idx) => {
              const date = addDays(weekStart, idx);
              const col = visible
                .filter((i) => i.day === idx)
                .sort((a, b) => a.time.localeCompare(b.time));
              return (
                <div key={idx} className={`col${sameDay(date, today) ? " today" : ""}`}>
                  <h4>{name}, {date.getDate()}</h4>
                  {col.map((i) => (
                    <button
                      key={i.id}
                      type="button"
                      className="mini"
                      onClick={() => changeDay(idx)}
                    >
                      <span className="p" style={{ ["--img" as string]: `url('${posterURL(i)}')` }} />
                      <span>
                        <b>{i.title}</b>
                        <span>{i.time} · {i.episodes ?? 1} эп.</span>
                      </span>
                    </button>
                  ))}
                  {col.length === 0 ? <p className="empty" style={{ padding: 16 }}>—</p> : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="note">
        Расписание повторяется каждую неделю: день и время выхода, а не конкретные
        даты. Обновляется из панели управления, раздел «Контент».
      </p>
    </>
  );
}

/* ------------------------------- карточки ------------------------------- */

function Card({
  item,
  weekStart,
  fav,
  onFav,
}: {
  item: ReleaseItem;
  weekStart: Date;
  fav: boolean;
  onFav: (id: string) => void;
}) {
  const st = statusOf(item, weekStart);
  const hot = isHot(item, weekStart);

  return (
    <article className={`card${hot ? " hot" : ""}`}>
      <div className="media" style={{ ["--img" as string]: `url('${posterURL(item)}')` }}>
        <div className="img base" />
        <div className="img ch r" />
        <div className="img ch c" />
        <div className="holo" />
        <div className="scan" />
        <div className="grad" />
        {item.rating !== null ? <span className="badge rate">★ {item.rating.toFixed(2)}</span> : null}
        {item.episodes ? <span className="badge ep">{item.episodes} эп.</span> : null}
        {hot ? <span className="live">● СКОРО</span> : null}
        <div className="tm">
          <i className={`dot ${st.cls}`} />
          {item.time}
        </div>
        <button
          type="button"
          className={`fav${fav ? " on" : ""}`}
          onClick={() => onFav(item.id)}
          aria-label={fav ? "Убрать из избранного" : "В избранное"}
        >
          {fav ? "♥" : "♡"}
        </button>
        <div className="reveal">
          <div className="gn">
            {item.genres.slice(0, 2).map((g) => <span key={g}>{g}</span>)}
          </div>
        </div>
      </div>

      <div className="info">
        <h3>{item.title}</h3>
        <div className="meta">
          {item.studio ? <span className="studio">{item.studio}</span> : null}
          <span className={`status ${st.cls}`}>{st.text}</span>
        </div>
      </div>
    </article>
  );
}

function Row({
  item,
  weekStart,
  fav,
  onFav,
}: {
  item: ReleaseItem;
  weekStart: Date;
  fav: boolean;
  onFav: (id: string) => void;
}) {
  const st = statusOf(item, weekStart);

  return (
    <article className="card">
      <div className="row-time">{item.time}</div>
      <div className="thumb" style={{ ["--img" as string]: `url('${posterURL(item)}')` }} />
      <div className="info">
        <h3>{item.title}</h3>
        <div className="meta" style={{ justifyContent: "flex-start", gap: 12 }}>
          <span className="studio">
            {item.studio}
            {item.episodes ? ` · ${item.episodes} эп.` : ""}
            {item.rating !== null ? ` · ★ ${item.rating.toFixed(2)}` : ""}
          </span>
          <span className={`status ${st.cls}`}>{st.text}</span>
        </div>
      </div>
      <button
        type="button"
        className={`row-fav${fav ? " on" : ""}`}
        onClick={() => onFav(item.id)}
        aria-label={fav ? "Убрать из избранного" : "В избранное"}
      >
        {fav ? "♥" : "♡"}
      </button>
    </article>
  );
}