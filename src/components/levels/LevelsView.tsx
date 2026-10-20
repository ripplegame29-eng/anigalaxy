"use client";

/**
 * Страница «Уровни» — интерактивная часть.
 *
 * Визуал по мотивам animeon.cc/levels: вкладки, герой-карточка с эмблемой
 * и XP-баром, дорожка наград с вехами и разбивкой по источникам XP.
 * Все числа приходят из документа прогрессии и конфига — см. `levels-view`.
 */

import { useCallback, useMemo, useState } from "react";
import { LevelEmblem } from "@/components/LevelEmblem";
import { useLevelInfo, useProgress, progressEmit } from "@/lib/progression/events";
import {
  MILESTONES,
  TRACK_FILTERS,
  filterTrack,
  levelRewardTrack,
  pathStats,
  tomeProgress,
  tomes,
  xpHeadroom,
  xpSources,
  type TomeItem,
} from "@/lib/levels-view";
import { pushToast } from "@/lib/toasts";

/** Форматирование AC/XP без дробной части */
const num = (value: number) => Math.round(value).toLocaleString("ru-RU");

/** Человеческие тексты причин отказа движка */
const REJECT_TEXT: Record<string, string> = {
  unknown_tome: "тома больше нет",
  price_mismatch: "цена изменилась",
  tome_locked: "том ещё закрыт",
  tome_daily_limit: "том уже куплен сегодня",
  insufficient_ac: "не хватает AC",
  limit_reached: "достигнут предел",
};

/** Доля пути с двумя знаками: 0,07 % */
const percent2 = (value: number) =>
  value.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function LevelsView() {
  const doc = useProgress();
  const info = useLevelInfo();
  const [filter, setFilter] = useState<string>("now");
  const [busy, setBusy] = useState(false);

  const track = useMemo(() => levelRewardTrack(info), [info.level]);
  const path = useMemo(() => pathStats(info), [info.level, info.into]);
  const sources = useMemo(() => xpSources(doc), [doc.daily.counts]);
  const visible = useMemo(() => filterTrack(track, filter, info), [track, filter, info.level]);
  const tomeList = useMemo(() => tomes(doc, info), [doc, info.level]);
  const tomeCount = useMemo(() => tomeProgress(doc), [doc.daily.counts]);
  const headroom = xpHeadroom(doc);

  // Покупка тома: UI только шлёт событие, решение принимает движок.
  // Он же вернёт причину отказа, если не хватит AC или срок вышел.
  const buyTome = useCallback((tome: TomeItem) => {
    setBusy(true);
    try {
      const res = progressEmit({ type: "TOME_PURCHASED", tomeId: tome.id, price: tome.price });
      if (res.rejected) {
        pushToast({
          kind: "ac",
          title: "Том не куплен",
          text: REJECT_TEXT[res.rejected.reason] ?? res.rejected.reason,
        });
        return;
      }
      pushToast({ kind: "xp", title: `«${tome.name}» открыт`, text: `+${tome.xp} XP` });
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <>
      {/* ------------------------------ Вкладки ------------------------------ */}
      <div className="mx-auto flex max-w-3xl gap-2 px-4 pt-6 sm:px-6" role="tablist" aria-label="Разделы прогрессии">
        <button
          type="button"
          role="tab"
          aria-selected="true"
          className="flex-1 rounded-2xl border border-accent/60 bg-accent/10 px-5 py-4 text-left"
        >
          <span className="flex items-center gap-2 text-sm font-extrabold text-white">
            <span className="grid h-6 w-8 place-items-center rounded-md bg-white/10 text-[11px] font-black text-accent-2">
              23
            </span>
            Уровень
          </span>
          <span className="mt-1 block text-xs font-semibold text-accent-2/80">
            {info.level} · {info.era}
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected="false"
          disabled
          className="flex-1 cursor-not-allowed rounded-2xl border border-line bg-card/50 px-5 py-4 text-left opacity-70"
        >
          <span className="flex items-center gap-2 text-sm font-extrabold text-muted">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <rect x="4" y="10" width="16" height="11" rx="2" />
              <path d="M8 10V7a4 4 0 1 1 8 0v3" />
            </svg>
            Заточка
          </span>
          <span className="mt-1 block text-xs font-semibold text-muted/70">Откроется на 10 000</span>
        </button>
      </div>

      {/* ------------------------------ Герой -------------------------------- */}
      <section className="mx-auto max-w-5xl px-4 pt-6 sm:px-6" aria-label="Текущий уровень">
        <div className="relative overflow-hidden rounded-[28px] border border-line bg-gradient-to-br from-card via-card to-ink p-6 sm:p-8">
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/12 blur-3xl"
            aria-hidden
          />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
            {/* Эмблема уровня */}
            <div className="shrink-0 self-center sm:self-auto">
              <div
                className="grid place-items-center rounded-3xl border border-accent/30 bg-ink/70"
                style={{ width: 168, height: 168 }}
              >
                <LevelEmblem level={info.level} percent={info.percent} size={140} />
              </div>
            </div>

            {/* Текст и XP-бар */}
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-accent-2">
                {info.era}
              </span>
              <h2 className="mt-1 text-4xl font-black tracking-tight text-white sm:text-5xl">
                Уровень {info.level}
              </h2>
              <p className="mt-1 text-sm font-semibold text-muted">
                Всего опыта: {num(info.start + info.into)} XP
              </p>

              {/* Прогресс уровня */}
              <div className="mt-5">
                <div className="flex items-baseline justify-between gap-3 text-xs font-bold">
                  <span className="text-muted">
                    {num(info.into)} / {num(info.need)} XP до {info.level + 1}
                  </span>
                  <span className="text-accent-2">{info.percent}%</span>
                </div>
                <div
                  className="mt-2 h-3 overflow-hidden rounded-full bg-ink-soft ring-1 ring-line"
                  role="progressbar"
                  aria-valuenow={info.percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Прогресс до уровня ${info.level + 1}`}
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent-2 via-accent to-accent-2 transition-[width] duration-700"
                    style={{ width: `${Math.max(info.percent, 2)}%` }}
                  />
                </div>
              </div>

              {/* Три плитки */}
              <dl className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Tile label={`До ${MILESTONES[MILESTONES.length - 1]} уровня`} value={`${num(path.toPeak)} XP`} />
                <Tile
                  label={`AC за ${info.level + 1} уровень`}
                  value={`+${num(path.acPerLevel)} AC`}
                  accent
                />
                <Tile label="Путь к пределу" value={`${percent2(path.percent)} %`} />
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------- Награды за уровни ------------------------ */}
      <section className="mx-auto max-w-5xl px-4 pt-12 sm:px-6" aria-labelledby="levels-rewards">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-accent-2">Путь к пределу</span>
            <h2 id="levels-rewards" className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
              Награды за уровни
            </h2>
          </div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">
            Получено{" "}
            <span className="text-accent-2">
              {num(track.earnedAc)} / {num(track.totalAc)} AC
            </span>
          </p>
        </div>

        {/* Фильтры вех */}
        <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Фильтр вех">
          {TRACK_FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                aria-pressed={active}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-extrabold transition ${
                  active
                    ? "border-accent bg-accent text-white shadow-[0_10px_24px_-12px_rgba(31,123,255,0.8)]"
                    : "border-line bg-card/60 text-muted hover:border-accent/50 hover:text-white"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Шкала вех */}
        <MilestoneRail current={info.level} next={track.nextLevel} />

        {/* Карточки наград */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((item) => {
            const done = info.level >= item.level;
            const current = item.level === track.nextLevel;
            return (
              <article
                key={item.level}
                className={`relative overflow-hidden rounded-2xl border p-4 text-center transition ${
                  current
                    ? "border-accent-2/70 bg-gradient-to-b from-accent-2/15 to-card shadow-[0_0_40px_-16px_rgba(32,191,255,0.9)]"
                    : done
                      ? "border-line bg-card/70"
                      : "border-line bg-ink-soft/60"
                }`}
              >
                <div className="flex justify-center">
                  <LevelEmblem level={item.level} percent={done ? 100 : 0} size={72} locked={!done} />
                </div>
                <p className="mt-3 text-xs font-black uppercase tracking-[0.12em] text-muted">
                  {item.level} уровень
                </p>
                <p className="mt-1 text-lg font-black text-accent-2">+{num(item.ac)} AC</p>
                {item.tagId && <TagChip tagId={item.tagId} done={done} />}
                <p className={`mt-2 text-[11px] font-bold ${done ? "text-mint" : "text-muted/70"}`}>
                  {done ? "получено" : "закрыто"}
                </p>
              </article>
            );
          })}
        </div>

        {visible.length === 0 && (
          <p className="mt-5 text-sm text-muted">На этом рубеже вех пока нет.</p>
        )}
      </section>

      {/* ------------------------------ Тома опыта ---------------------------- */}
      <section className="mx-auto max-w-5xl px-4 pt-14 sm:px-6" aria-labelledby="levels-tomes">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-accent-2">Ускорь путь</span>
            <h2 id="levels-tomes" className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
              Тома опыта
            </h2>
          </div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">
            На балансе{" "}
            <span className="text-accent-2">{num(doc.progress.acBalance)} AC</span>
          </p>
        </div>

        {/* Разрыв и дневной счётчик томов */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-card/60 px-5 py-4">
          <div>
            <span className="text-[11px] font-black uppercase tracking-[0.16em] text-muted">Разрыв</span>
            <p className="mt-0.5 text-sm font-extrabold text-white">
              До {info.level + 1} уровня — {num(info.left)} XP
            </p>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-black uppercase tracking-[0.16em] text-muted">Сегодня</span>
            <p className="mt-0.5 text-sm font-extrabold text-white">
              {tomeCount.bought} / {tomeCount.total}
            </p>
            <p className="text-[11px] font-bold text-muted">Каждый том — по одному в сутки</p>
          </div>
        </div>

        {/* Тома */}
        <ul className="mt-4 space-y-3">
          {tomeList.map((tome) => (
            <li
              key={tome.id}
              className="relative overflow-hidden rounded-2xl border border-line bg-card/60 px-5 py-4"
              style={{
                background: `linear-gradient(100deg, ${tome.accent}14, transparent 60%)`,
              }}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-4">
                  <TomeArt tome={tome} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-extrabold text-white">{tome.name}</span>
                      {tome.fromLevel > 0 && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] ${
                            tome.unlocked ? "bg-accent/20 text-accent-2" : "bg-white/8 text-muted"
                          }`}
                        >
                          {tome.unlocked ? "открыт" : `закроет ${tome.fromLevel} уровень`}
                        </span>
                      )}
                      <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-muted">
                        раз в день
                      </span>
                    </div>
                    <p className="mt-1 text-xl font-black" style={{ color: tome.accent }}>
                      {num(tome.xp)} <span className="text-xs font-bold text-muted">XP</span>
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-muted">
                      ≈ {tome.episodes} {plural(tome.episodes, "серия", "серии", "серий")} просмотра
                    </p>
                  </div>
                </div>

                {/* Цена и действие */}
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {tome.unlocked && !tome.usedToday && (
                    <span className="flex items-center gap-1.5 text-sm font-black text-accent-2">
                      ⚡ {num(tome.price)}
                      {!tome.affordable && (
                        <span className="text-muted">/ {num(doc.progress.acBalance)}</span>
                      )}
                    </span>
                  )}

                  {!tome.unlocked ? (
                    <span className="rounded-lg bg-white/8 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-muted">
                      закрыт
                    </span>
                  ) : tome.usedToday ? (
                    <span className="rounded-lg bg-mint/12 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-mint">
                      куплен сегодня
                    </span>
                  ) : tome.affordable ? (
                    <button
                      type="button"
                      onClick={() => buyTome(tome)}
                      disabled={busy}
                      className="rounded-lg bg-gradient-to-r from-accent to-accent-2 px-4 py-1.5 text-xs font-black uppercase tracking-[0.1em] text-white transition hover:brightness-110 disabled:opacity-50"
                    >
                      Купить
                    </button>
                  ) : (
                    <>
                      <span className="text-[10px] font-black uppercase tracking-[0.1em] text-muted">
                        не хватает {num(tome.shortBy)}
                      </span>
                      <span className="rounded-lg bg-white/8 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-muted">
                        Не хватит {num(tome.shortBy)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------------------------- Где брать XP ---------------------------- */}
      <section className="mx-auto max-w-5xl px-4 pb-16 pt-14 sm:px-6" aria-labelledby="levels-sources">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-accent-2">Бесплатно</span>
            <h2 id="levels-sources" className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
              Где брать XP
            </h2>
          </div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">
            Потолок за сутки:{" "}
            <span className="text-accent-2">
              {num(doc.daily.xpActivity)} / {num(headroom + doc.daily.xpActivity)}
            </span>
          </p>
        </div>

        {/* Источники */}
        <ul className="mt-5 space-y-3">
          {sources.map((src) => (
            <li
              key={src.id}
              className={`rounded-2xl border px-5 py-4 transition ${
                src.capped ? "border-line bg-ink-soft/50 opacity-70" : "border-line bg-card/60"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold text-white">{src.label}</span>
                  {src.oncePerDay && (
                    <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-muted">
                      раз в день
                    </span>
                  )}
                </div>
                <span className="text-lg font-black text-accent-2">
                  {num(src.xp)} <span className="text-xs font-bold text-muted">XP</span>
                </span>
              </div>

              <p className="mt-1 text-xs font-semibold text-muted">
                ≈ {src.episodes} {plural(src.episodes, "серия", "серии", "серий")} просмотра
              </p>

              {src.perDay > 1 && (
                <div className="mt-3">
                  <div className="flex items-baseline justify-between text-[11px] font-bold text-muted">
                    <span>
                      Сегодня: {src.doneToday} из {src.perDay}
                    </span>
                    <span>{src.percent}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-soft">
                    <div
                      className={`h-full rounded-full ${src.capped ? "bg-muted/60" : "bg-accent"}`}
                      style={{ width: `${Math.max(src.percent, 2)}%` }}
                    />
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

/** Обложка тома: глиф и свечение акцентного цвета */
function TomeArt({ tome }: { tome: TomeItem }) {
  const glyph = tome.rarity === "LEGENDARY" ? "✦" : tome.rarity === "EPIC" ? "❖" : "▤";
  return (
    <span
      className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border text-2xl"
      style={{
        color: tome.accent,
        borderColor: `${tome.accent}55`,
        background: `radial-gradient(circle at 50% 20%, ${tome.accent}33, transparent 70%)`,
      }}
      aria-hidden
    >
      {glyph}
    </span>
  );
}

/* ------------------------------- Подкомпоненты ---------------------------- */

/** Плитка с числом под XP-баром */
function Tile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-ink-soft/70 px-3 py-2.5 text-center sm:text-left">
      <dt className="text-[10px] font-black uppercase tracking-[0.14em] text-muted">{label}</dt>
      <dd className={`mt-0.5 text-base font-black ${accent ? "text-accent-2" : "text-white"}`}>{value}</dd>
    </div>
  );
}

/** Горизонтальная шкала вех: пройденные подсвечены, текущая — золотая */
function MilestoneRail({ current, next }: { current: number; next: number }) {
  return (
    <div className="relative mt-8 hidden sm:block" aria-hidden>
      <div className="absolute left-0 right-0 top-4 h-0.5 rounded-full bg-line" />
      <div
        className="absolute left-0 top-4 h-0.5 rounded-full bg-gradient-to-r from-accent to-accent-2"
        style={{ width: `${Math.min(100, (current / MILESTONES[MILESTONES.length - 1]) * 100)}%` }}
      />
      <ol className="relative flex justify-between">
        {MILESTONES.map((level) => {
          const done = current >= level;
          const isNext = level === next;
          return (
            <li key={level} className="flex flex-col items-center gap-2">
              <span
                className={`grid h-8 w-8 place-items-center rounded-full border-2 text-[11px] font-black transition ${
                  isNext
                    ? "border-accent-2 bg-accent-2 text-ink shadow-[0_0_24px_-4px_rgba(32,191,255,0.9)]"
                    : done
                      ? "border-accent bg-accent text-white"
                      : "border-line bg-card text-muted"
                }`}
              >
                {level}
              </span>
              {isNext && (
                <span className="rounded-full bg-accent-2/15 px-2 py-0.5 text-[10px] font-black text-accent-2">
                  Вы — {current}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Награда-тег на вехе */
function TagChip({ tagId, done }: { tagId: string; done: boolean }) {
  return (
    <span
      title={tagId}
      className={`mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
        done ? "border-mint/40 bg-mint/10 text-mint" : "border-line bg-ink-soft text-muted/70"
      }`}
    >
      {done ? "✓" : "🔒"}
      <span className="truncate">{tagId.replace(/^tag_/, "")}</span>
    </span>
  );
}

/** Русская плюрализация для «серия/серии/серий» */
function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}