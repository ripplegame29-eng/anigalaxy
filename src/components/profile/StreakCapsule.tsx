"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { useProgress } from "@/lib/progression/events";
import {
  STREAK_FREEZE_MAX,
  STREAK_TIER_MAX,
  dayKey,
  formatCountdown,
  msUntilMidnight,
  pluralDays,
  streakReward,
  streakSpan,
  streakTier,
  streakWeek,
} from "@/lib/streak-capsule";

const FLAME = (
  <svg className="sc-fl" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 21c3.9 0 6.5-2.6 6.5-6 0-4.6-4.2-6.6-4.2-11.5-3.4 2-6.5 5-6.5 9.4C7.8 17.9 9.4 21 12 21z" />
    <path d="M12 21c1.7 0 2.8-1.1 2.8-2.5 0-1.9-1.9-2.8-1.9-4.8-1.5.9-2.8 2.3-2.8 4.1 0 1.8.8 3.2 1.9 3.2z" fill="none" />
  </svg>
);

const CHECK = (
  <svg className="sc-i" viewBox="0 0 24 24" aria-hidden="true">
    <path d="m6 12.5 4 4 8-9" />
  </svg>
);

const SHIELD = (
  <svg className="sc-i" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3.4l7 2.4v6.2c0 4.2-3.1 7.2-7 8.6-3.9-1.4-7-4.4-7-8.6V5.8z" fill="currentColor" fillOpacity=".18" />
  </svg>
);

const GIFT = (
  <svg className="sc-i" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3.5" y="8.5" width="17" height="4" rx="1" />
    <path d="M5 12.5V20h14v-7.5M12 8.5V20" />
  </svg>
);

const STAR = (
  <svg className="sc-i" viewBox="0 0 24 24" aria-hidden="true">
    <path d="m12 3.4 2.6 5.5 6 .7-4.4 4.1 1.2 5.9-5.4-3-5.4 3 1.2-5.9-4.4-4.1 6-.7z" />
  </svg>
);

/**
 * Капсула «Серия дней» в шапке профиля.
 *
 * Всё, что видно на капсуле, берётся из документа прогрессии: длина серии,
 * рекорд, заморозки и дата последней активности. Капсула взрослеет вместе с
 * серией — пять уровней из макета красят огонь, кольцо показывает путь до
 * следующей отметки, а со второго уровня добавляются блик и искры, с третьего —
 * орбита.
 */
export function StreakCapsule() {
  const progress = useProgress();
  const { streakCurrent, streakBest, streakFreezes, lastActiveDate } = progress.progress;

  const [open, setOpen] = useState(false);
  const [left, setLeft] = useState(() => msUntilMidnight());
  const wrapRef = useRef<HTMLSpanElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popId = useId();

  const tier = useMemo(() => streakTier(streakCurrent), [streakCurrent]);
  const span = useMemo(() => streakSpan(streakCurrent), [streakCurrent]);
  const week = useMemo(() => streakWeek(lastActiveDate, streakCurrent), [lastActiveDate, streakCurrent]);

  const today = useMemo(() => dayKey(new Date()), []);
  /** Серия засчитана сегодня, если последняя активность была сегодня. */
  const claimed = lastActiveDate === today;
  const reward = useMemo(() => streakReward(span.next), [span.next]);

  /* В макете окно закрывается кликом мимо и Escape; крестика там нет.
   Escape возвращает фокус на капсулу — иначе после закрытия фокус падал бы
   в никуда и с клавиатуры до кнопки было бы не дойти. */
  const close = useCallback(() => {
    setOpen(false);
    btnRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  // Обратный отсчёт нужен только пока окно открыто и день не засчитан:
  // перерисовывать раз в секунду скрытое окно незачем. Первое значение уже
  // задано в useState, поэтому синхронного setState в эффекте нет — тик
  // обновляет его не позже чем через секунду после открытия.
  useEffect(() => {
    if (!open || claimed) return;
    const id = window.setInterval(() => setLeft(msUntilMidnight()), 1000);
    return () => window.clearInterval(id);
  }, [open, claimed]);

  const tierClass = `sc-t${tier.index}`;
  const showSparks = tier.index >= 1;
  const showOrbit = tier.index >= 2;

  return (
    <span className="sc-wrap" ref={wrapRef} style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        ref={btnRef}
        className={`sc-chip ${tierClass}`}
        style={{ ["--p" as string]: String(Math.round(span.percent)) }}
        aria-label={`Серия: ${streakCurrent} ${pluralDays(streakCurrent)} подряд`}
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="sc-core">
          <span className="sc-ring" />
          {showOrbit && <span className="sc-orb" />}
          {FLAME}
          {showSparks && (
            <>
              <i className="sc-sp" />
              <i className="sc-sp" />
              <i className="sc-sp" />
            </>
          )}
        </span>
        <b>{streakCurrent}</b>
        {!claimed && streakCurrent > 0 && (
          <i className="sc-warn" title="Серия под угрозой" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div className={`sc-pop ${tierClass}`} id={popId} role="dialog" aria-label="Подробности серии">
          <div className="sc-ph">
            <strong>{streakCurrent}</strong>
            <span>{pluralDays(streakCurrent)} подряд</span>
          </div>

          <div className="sc-sub">
            {streakCurrent
              ? `${tier.name} · рекорд ${Math.max(streakBest, streakCurrent)}`
              : `${tier.name} · начни серию сегодня`}
          </div>

          <div className="sc-week">
            {week.days.map((day) => {
              const done = week.done.has(day.key);
              const isToday = day.key === today;
              return (
                <div className="sc-day" key={day.key}>
                  <span
                    className={`sc-dot${done ? " done" : ""}${isToday ? " today" : ""}${
                      !done && day.key < today ? " miss" : ""
                    }`}
                  >
                    {done ? CHECK : !done && day.key < today ? "–" : ""}
                  </span>
                  {day.label}
                </div>
              );
            })}
          </div>

          {span.next === null ? (
            <div className="sc-rw">
              {STAR}
              Все отметки пройдены, выше только легенда
            </div>
          ) : (
            <>
              <div className="sc-nx">
                <span>
                  До отметки в {span.next} {pluralDays(span.next)}
                </span>
                <span>ещё {span.next - streakCurrent}</span>
              </div>
              <div className="sc-bar">
                <i style={{ width: `${Math.round(span.percent)}%` }} />
              </div>
              <div className="sc-rw">
                {reward ? GIFT : null}
                {reward ? `Награда: ${reward.label}` : "На этой отметке награды нет"}
              </div>
            </>
          )}

          <div className="sc-row">
            <span>Заморозки: пропущенный день не сломает серию</span>
            <span className="sc-fz">
              {Array.from({ length: STREAK_FREEZE_MAX }, (_, i) => (
                <span key={i} className={i < streakFreezes ? "on" : ""}>
                  {SHIELD}
                </span>
              ))}
            </span>
          </div>

          {claimed ? (
            <div className="sc-state ok">
              {CHECK}
              Сегодня засчитано
            </div>
          ) : (
            <div className="sc-state risk">
              Посмотри серию, пока не сгорело
              <time>{formatCountdown(left)}</time>
            </div>
          )}
        </div>
      )}
    </span>
  );
}

/** Уровень серии как число — для подписи в alt-текстах и тестах. */
export const STREAK_TIERS_COUNT = STREAK_TIER_MAX + 1;