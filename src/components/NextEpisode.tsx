"use client";

/**
 * Плашка «Следующая серия» на странице тайтла.
 *
 * Живой обратный отсчёт до выхода серии (дни · часы · минуты · секунды),
 * дата и время в часовом поясе зрителя, полоска «сколько недели прошло» и
 * кнопка «В календарь» (файл .ics собирается на месте). Время считается
 * только в браузере — на сервере «сейчас» свой, и разметка расходилась бы.
 */

import { useEffect, useState } from "react";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function parts(ms: number) {
  const left = Math.max(0, ms);
  return {
    d: Math.floor(left / DAY),
    h: Math.floor((left % DAY) / HOUR),
    m: Math.floor((left % HOUR) / MINUTE),
    s: Math.floor((left % MINUTE) / SECOND),
  };
}

const pad = (value: number) => String(value).padStart(2, "0");

function icsDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function NextEpisode({
  at,
  episode,
  total,
  title,
}: {
  at: string;
  episode: number;
  total?: number;
  title: string;
}) {
  const target = new Date(at);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (Number.isNaN(target.getTime())) return null;

  const left = now === null ? null : target.getTime() - now;
  const out = left !== null && left <= 0;
  const t = parts(left ?? 0);
  // Серии выходят раз в неделю: полоска показывает, какая доля цикла прошла
  const cycle = left === null ? 0 : Math.min(1, Math.max(0, 1 - left / (7 * DAY)));

  const date = target.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" });
  const time = target.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

  const cells: [string, number, string][] = [
    ["дн.", t.d, "d"],
    ["час", t.h, "h"],
    ["мин", t.m, "m"],
    ["сек", t.s, "s"],
  ];

  const addToCalendar = () => {
    const end = new Date(target.getTime() + 30 * MINUTE);
    const body = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//AniGalaxy//Next episode//RU",
      "BEGIN:VEVENT",
      `UID:${icsDate(target)}-${episode}@anigalaxy`,
      `DTSTAMP:${icsDate(new Date())}`,
      `DTSTART:${icsDate(target)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:${title} — серия ${episode}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.replace(/[^\p{L}\p{N}]+/gu, "-")}-ep-${episode}.ics`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <section className="ne" aria-label={`Следующая серия: ${episode}`}>
      <header className="ne-head">
        <span className="ne-live" aria-hidden />
        <span className="ne-kicker">{out ? "Серия вышла" : "Следующая серия"}</span>
        <span className="ne-date">
          {date} · {time}
        </span>
      </header>

      <p className="ne-ep">
        <b>Серия {episode}</b>
        {total ? <span>из {total}</span> : null}
      </p>

      {out ? (
        <p className="ne-out">Она уже доступна — загляните в плеер ниже.</p>
      ) : (
        <>
          <div className="ne-cells" role="timer" aria-live="off">
            {cells.map(([label, value, key]) => (
              <div className={`ne-cell${key === "d" && t.d > 0 ? " is-lead" : ""}`} key={key}>
                <b key={`${key}${value}`}>{left === null ? "––" : pad(value)}</b>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <div className="ne-bar" aria-hidden>
            <i style={{ width: `${Math.round(cycle * 100)}%` }} />
          </div>
        </>
      )}

      <button type="button" className="ne-cal" onClick={addToCalendar}>
        <svg viewBox="0 0 24 24" aria-hidden>
          <rect x="3.5" y="5" width="17" height="15" rx="2.6" />
          <path d="M3.5 10h17M8 3v4M16 3v4M12 13.5v4M10 15.5h4" />
        </svg>
        В календарь
      </button>
    </section>
  );
}
