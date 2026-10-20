"use client";

/**
 * Расписание выхода серий.
 *
 * Сервер отдаёт плоский список (время выхода в ISO), а раскладка по дням
 * считается здесь, в часовом поясе зрителя: «сегодня» и «в 21:30» у разных
 * людей — разные. Поэтому до монтирования рисуется скелет.
 *
 * Что есть: герой «Ближайшая серия» с живым отсчётом, семь дней со
 * скользящим индикатором, лента дня с линией «сейчас», поиск, фильтр
 * «Из избранного» и добавление серии в календарь (.ics).
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { loadFavorites } from "@/lib/collections";
import { Poster } from "@/components/Poster";
import type { ScheduleItem } from "@/lib/schedule";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const clock = (date: Date) =>
  date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

/** «через 3 ч 12 мин» / «вышла 20 мин назад» */
function relative(ms: number): string {
  const abs = Math.abs(ms);
  const d = Math.floor(abs / DAY);
  const h = Math.floor((abs % DAY) / HOUR);
  const m = Math.floor((abs % HOUR) / MINUTE);
  const text = d > 0 ? `${d} дн. ${h} ч` : h > 0 ? `${h} ч ${m} мин` : `${Math.max(1, m)} мин`;
  return ms >= 0 ? `через ${text}` : `вышла ${text} назад`;
}

function countdown(ms: number) {
  const left = Math.max(0, ms);
  return {
    d: Math.floor(left / DAY),
    h: Math.floor((left % DAY) / HOUR),
    m: Math.floor((left % HOUR) / MINUTE),
    s: Math.floor((left % MINUTE) / 1000),
  };
}

const REMIND_KEY = "animehub:schedule:reminders";

/** Напоминания хранятся в браузере: ключ «id:серия». */
function useReminders() {
  // До монтирования страница рисует скелет (now === null), так что чтение
  // localStorage в инициализаторе не создаёт рассинхрона гидрации.
  const [set, setSet] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = JSON.parse(localStorage.getItem(REMIND_KEY) ?? "[]");
      return new Set(Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") : []);
    } catch {
      return new Set();
    }
  });
  const toggle = (key: string) =>
    setSet((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) {
        next.add(key);
        // Первый колокольчик — самое время спросить разрешение на системные уведомления
        if (typeof Notification !== "undefined" && Notification.permission === "default") {
          void Notification.requestPermission();
        }
      }
      try {
        localStorage.setItem(REMIND_KEY, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  return [set, toggle] as const;
}
const remindKey = (item: ScheduleItem) => `${item.id}:${item.episode}`;

function Bell({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={on ? "is-on" : undefined}>
      <path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}

function useNow(step: number): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, step);
    return () => window.clearInterval(timer);
  }, [step]);
  return now;
}

/* --------------------------------- герой --------------------------------- */

function Hero({ item, now, on, onToggle }: { item: ScheduleItem; now: number; on: boolean; onToggle: () => void }) {
  const target = new Date(item.at);
  const t = countdown(target.getTime() - now);
  const cells: [string, number][] = [
    ["дн.", t.d],
    ["час", t.h],
    ["мин", t.m],
    ["сек", t.s],
  ];
  return (
    <section className="sch-hero">
      {item.poster && (
        <div className="sch-hero-bg" aria-hidden>
          <Poster src={item.poster} alt="" sizes="100vw" className="object-cover" />
        </div>
      )}
      <div className="sch-hero-poster">
        <Poster src={item.poster} alt={item.title} title={item.title} sizes="180px" className="object-cover" />
      </div>
      <div className="sch-hero-body">
        <span className="sch-kicker">
          <i aria-hidden /> Ближайшая серия
        </span>
        <h2>{item.title}</h2>
        <p className="sch-hero-sub">
          Серия {item.episode}
          {item.total ? ` из ${item.total}` : ""} ·{" "}
          {target.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })},{" "}
          {clock(target)}
        </p>
        <div className="sch-timer" role="timer" aria-live="off">
          {cells.map(([label, value]) => (
            <div key={label}>
              <b key={`${label}${value}`}>{pad(value)}</b>
              <span>{label}</span>
            </div>
          ))}
        </div>
        <div className="sch-hero-actions">
          <Link href={`/title/${item.id}`} className="sch-btn is-primary">
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M8 5.14v13.72c0 .8.87 1.3 1.56.88l10.9-6.86a1.04 1.04 0 0 0 0-1.76L9.56 4.26A1.04 1.04 0 0 0 8 5.14Z" />
            </svg>
            Открыть тайтл
          </Link>
          <button type="button" className={`sch-btn sch-remind${on ? " on" : ""}`} aria-pressed={on} onClick={onToggle}>
            <Bell on={on} />
            {on ? "Напоминание включено" : "Напомнить о серии"}
          </button>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------- страница -------------------------------- */

export function ScheduleView({ items }: { items: ScheduleItem[] }) {
  const now = useNow(1000);
  const [selected, setSelected] = useState(0);
  const [query, setQuery] = useState("");
  const [onlyFav, setOnlyFav] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [reminders, toggleReminder] = useReminders();
  const [onlyRemind, setOnlyRemind] = useState(false);

  useEffect(() => {
    const read = () => setFavorites(new Set(loadFavorites()));
    read();
    window.addEventListener("animehub:favorites-changed", read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("animehub:favorites-changed", read);
      window.removeEventListener("storage", read);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (item) => (!q || item.title.toLowerCase().includes(q)) && (!onlyFav || favorites.has(item.id)) && (!onlyRemind || reminders.has(remindKey(item))),
    );
  }, [items, query, onlyFav, favorites, onlyRemind, reminders]);

  // Семь дней от «сегодня» — по местному времени зрителя
  const todayKey = now === null ? null : dayKey(new Date(now));
  const days = useMemo(() => {
    if (todayKey === null) return [];
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(base.getTime() + index * DAY);
      date.setHours(0, 0, 0, 0);
      return { date, key: dayKey(date) };
    });
  }, [todayKey]);

  const byDay = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    for (const item of filtered) {
      const key = dayKey(new Date(item.at));
      (map.get(key) ?? map.set(key, []).get(key)!).push(item);
    }
    return map;
  }, [filtered]);

  if (now === null) {
    return (
      <div className="sch-page">
        <div className="sch-wrap">
          <div className="sch-skel" />
        </div>
      </div>
    );
  }

  const upcoming = items.find((item) => new Date(item.at).getTime() > now);
  const day = days[selected];
  const list = day ? (byDay.get(day.key) ?? []) : [];
  const firstUpcoming = list.findIndex((item) => new Date(item.at).getTime() > now);

  return (
    <div className="sch-page">
      <div className="sch-wrap">
        <header className="sch-head">
          <div>
            <p className="sch-eyebrow">Календарь релизов</p>
            <h1>Расписание</h1>
            <p className="sch-lead">
              Новые серии идущих аниме на неделю вперёд. Время показано в вашем часовом поясе.
            </p>
          </div>
          <div className="sch-tools">
            <label className="sch-search">
              <svg viewBox="0 0 24 24" aria-hidden>
                <circle cx="11" cy="11" r="6.5" />
                <path d="m20 20-4.2-4.2" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Найти аниме"
                aria-label="Поиск по расписанию"
              />
            </label>
            <button
              type="button"
              className={`sch-fav${onlyFav ? " on" : ""}`}
              aria-pressed={onlyFav}
              onClick={() => setOnlyFav((v) => !v)}
              title="Показывать только тайтлы из избранного"
            >
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
              </svg>
              Избранное
            </button>
            <button
              type="button"
              className={`sch-fav${onlyRemind ? " on" : ""}`}
              aria-pressed={onlyRemind}
              onClick={() => setOnlyRemind((v) => !v)}
              title="Показывать только серии с напоминанием"
            >
              <Bell on={onlyRemind} />
              Напоминания{reminders.size ? ` · ${reminders.size}` : ""}
            </button>
          </div>
        </header>

        {upcoming && !query && !onlyFav && !onlyRemind && <Hero item={upcoming} now={now} on={reminders.has(remindKey(upcoming))} onToggle={() => toggleReminder(remindKey(upcoming))} />}

        <nav className="sch-days" aria-label="Дни недели" style={{ ["--i" as string]: selected }}>
          <span className="sch-ind" aria-hidden />
          {days.map((d, index) => {
            const count = byDay.get(d.key)?.length ?? 0;
            return (
              <button
                key={d.key}
                type="button"
                className={index === selected ? "on" : undefined}
                aria-pressed={index === selected}
                onClick={() => setSelected(index)}
              >
                <span className="sch-dow">
                  {index === 0
                    ? "Сегодня"
                    : index === 1
                      ? "Завтра"
                      : d.date.toLocaleDateString("ru-RU", { weekday: "short" })}
                </span>
                <b>{d.date.getDate()}</b>
                <em className={count ? "has" : undefined}>{count || "–"}</em>
              </button>
            );
          })}
        </nav>

        <section className="sch-day" key={day?.key} aria-label="Серии дня">
          {day && (
            <h3 className="sch-day-title">
              {day.date.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}
              <span>{list.length ? `${list.length} ${list.length === 1 ? "серия" : "серий"}` : ""}</span>
            </h3>
          )}

          {list.length === 0 ? (
            <div className="sch-empty">
              <svg viewBox="0 0 120 120" aria-hidden>
                <rect x="22" y="26" width="76" height="72" rx="14" />
                <path d="M22 50h76M44 18v16M76 18v16M46 76l10 10 20-22" />
              </svg>
              <h4>В этот день серий нет</h4>
              <p>
                {query || onlyFav || onlyRemind
                  ? "Попробуйте убрать фильтры или выбрать другой день."
                  : "Загляните в другой день — расписание обновляется каждые несколько минут."}
              </p>
            </div>
          ) : (
            <ol className="sch-list">
              {list.map((item, index) => {
                const at = new Date(item.at);
                const diff = at.getTime() - now;
                const out = diff <= 0;
                return (
                  <li key={item.id} style={{ ["--n" as string]: index }}>
                    {index === firstUpcoming && selected === 0 && firstUpcoming > 0 && (
                      <div className="sch-now" aria-hidden>
                        <i /> сейчас {clock(new Date(now))}
                      </div>
                    )}
                    <article className={`sch-card${out ? " is-out" : ""}${diff > 0 && diff < HOUR ? " is-soon" : ""}`}>
                      <time className="sch-time" dateTime={item.at}>
                        {clock(at)}
                      </time>
                      <Link href={`/title/${item.id}`} className="sch-poster" tabIndex={-1} aria-hidden>
                        <Poster src={item.poster} alt="" title={item.title} sizes="84px" className="object-cover" />
                      </Link>
                      <div className="sch-info">
                        <Link href={`/title/${item.id}`} className="sch-name">
                          {item.title}
                        </Link>
                        <p className="sch-ep">
                          Серия {item.episode}
                          {item.total ? <span> из {item.total}</span> : null}
                          {item.rating ? <b className="sch-rate">★ {item.rating.toFixed(1)}</b> : null}
                        </p>
                        {item.genres.length > 0 && (
                          <div className="sch-tags">
                            {item.genres.map((genre) => (
                              <span key={genre}>{genre}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="sch-side">
                        <span className="sch-rel">{out ? `вышла ${relative(diff).replace("вышла ", "")}` : relative(diff)}</span>
                        <div className="sch-acts">
                          <button
                            type="button"
                            className={reminders.has(remindKey(item)) ? "on" : undefined}
                            onClick={() => toggleReminder(remindKey(item))}
                            aria-pressed={reminders.has(remindKey(item))}
                            aria-label="Напомнить о серии"
                            title={reminders.has(remindKey(item)) ? "Убрать напоминание" : "Напомнить о серии"}
                          >
                            <Bell on={reminders.has(remindKey(item))} />
                          </button>
                          <Link href={`/title/${item.id}`} className="sch-go" aria-label={`Открыть «${item.title}»`}>
                            <svg viewBox="0 0 24 24" aria-hidden>
                              <path d="M5 12h14m-6-6 6 6-6 6" />
                            </svg>
                          </Link>
                        </div>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
