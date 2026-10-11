"use client";

/**
 * Dev-панель прогрессии (§15 этап 7, §14 «без бэкенда»).
 *
 * Видна только в dev-сборке и только с `?dev=1` в адресе: в production
 * (`next build`) `process.env.NODE_ENV` инлайнится в `production`, условие
 * становится `false` и панель не попадает в бандл. Без бэкенда `/admin/progression`
 * не существует — панель даёт те же операции для тестов:
 *
 *  - «+N к счётчику»: `DEV_ADJUST` по ключу счётчика — после записи движок
 *    пересчитывает достижения, поэтому по кнопке реально видно, как
 *    счётчик разблокирует награду (§16 «можно показать через dev-панель»);
 *  - выдача/изъятие XP и AC: `ADMIN_GRANT` с причиной — запись в
 *    `USER_REWARDS_LOG` с источником ADMIN и реверс-суммой при списании;
 *  - ручная выдача тега: `DEV_TAG_GRANTED` → та же дорога `grantTag`,
 *    что у уровней и достижений (эффект `TAG_UNLOCKED`);
 *  - просмотр журнала наград и ближайших достижений.
 *
 * Все действия идут через `emit()` — минуя ограничения UI, но не мимо
 * движка: лимиты на запись документа, идемпотентность ключей и журнал
 * сохраняются.
 */

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { PROGRESS_KEY } from "@/lib/progression/doc";
import { levelInfoFromDoc, useProgress } from "@/lib/progression/events";
import { PROGRESSION_CONFIG } from "@/lib/progression/progression.config";
import { buildAchievements } from "@/lib/progression/achievements-view";
import { amountLabel, sourceLabel, typeLabel } from "@/lib/progression/labels";
import { collectMetrics, emit } from "@/lib/progression/service";

/* ----------------------------- Доступ к панели --------------------------- */

/** Сборка: в production условие вырезается вместе с панелью */
const DEV_BUILD = process.env.NODE_ENV === "development";

function subscribeSearch(cb: () => void): () => void {
  window.addEventListener("popstate", cb);
  return () => window.removeEventListener("popstate", cb);
}

function readSearch(): string {
  return typeof window === "undefined" ? "" : window.location.search;
}

function serverSearch(): string {
  return "";
}

/** `?dev=1` в адресной строке (SSR-снимок — пустой, панель появляется после гидратации) */
function useDevFlag(): boolean {
  const search = useSyncExternalStore(subscribeSearch, readSearch, serverSearch);
  const params = useMemo(() => new URLSearchParams(search), [search]);
  return params.get("dev") === "1";
}

/* ------------------------------ Счётчики -------------------------------- */

interface CounterPreset {
  label: string;
  /** Ключ счётчика в документе — его крутит `DEV_ADJUST` */
  counter: string;
  /** Ключ метрики в снапшоте (не всегда совпадает со счётчиком) */
  metric: string;
  /** Сколько единиц метрики содержит одна единица счётчика */
  scale?: number;
}

/** Счётчики, которые реально читает `resolveMetrics` (то, что крутит §16) */
const COUNTERS: CounterPreset[] = [
  { label: "Серии просмотрены", counter: "EPISODES_COMPLETED", metric: "EPISODES_COMPLETED" },
  { label: "Серии начаты", counter: "EPISODES_OPENED", metric: "EPISODES_STARTED" },
  { label: "Тайтлы завершены", counter: "TITLES_COMPLETED", metric: "TITLES_COMPLETED" },
  { label: "Дни на сайте", counter: "DISTINCT_DAYS", metric: "DISTINCT_DAYS" },
  { label: "Ночные серии", counter: "NIGHT_EPISODES", metric: "NIGHT_EPISODES" },
  { label: "Минуты у плеера", counter: "SECONDS_WATCHED", metric: "MINUTES_WATCHED", scale: 60 },
  { label: "Оценки", counter: "RATINGS", metric: "RATINGS" },
  { label: "Комментарии", counter: "COMMENTS_VALID", metric: "COMMENTS_VALID" },
  { label: "Лайки получено", counter: "LIKES_RECEIVED", metric: "LIKES_RECEIVED" },
  { label: "Лайки дано", counter: "LIKES_GIVEN", metric: "LIKES_GIVEN" },
  { label: "Квесты выполнены", counter: "QUESTS_DONE", metric: "QUESTS_DONE" },
  { label: "Титулов за день", counter: "MAX_TITLES_IN_DAY", metric: "MAX_TITLES_IN_DAY" },
  { label: "XP за день", counter: "MAX_XP_IN_DAY", metric: "MAX_XP_IN_DAY" },
  { label: "Смен облика за день", counter: "MAX_TAG_SWAPS_IN_DAY", metric: "MAX_TAG_SWAPS_IN_DAY" },
];

function unlockedCount(doc: { achievements: Record<string, { unlockedAt?: number }> }): number {
  return Object.values(doc.achievements).filter((a) => (a.unlockedAt ?? 0) > 0).length;
}

/* -------------------------------- Хост ---------------------------------- */

export function DevPanel() {
  const dev = useDevFlag();
  if (!DEV_BUILD || !dev) return null;
  return <DevPanelBody />;
}

/* -------------------------------- Тело ---------------------------------- */

function DevPanelBody() {
  const doc = useProgress();
  const [open, setOpen] = useState(true);
  const [counterId, setCounterId] = useState(COUNTERS[0].counter);
  const [amountText, setAmountText] = useState("100");
  const [tagId, setTagId] = useState("");
  const [log, setLog] = useState("Панель готова: выберите операцию.");

  const level = levelInfoFromDoc(doc);
  // collectMetrics() читает внешние сторы (профиль, избранное, подборки) сам,
  // но пересчёт нужен после каждого изменения документа — зависимость от doc
  const metrics = useMemo(() => {
    void doc.schema;
    return collectMetrics();
  }, [doc]);
  const views = useMemo(() => buildAchievements(doc, metrics, PROGRESSION_CONFIG), [
    doc,
    metrics,
  ]);

  const preset = COUNTERS.find((item) => item.counter === counterId) ?? COUNTERS[0];
  const amount = Math.max(0, Math.floor(Number(amountText) || 0));
  const unlocked = unlockedCount(doc);

  const freeTags = PROGRESSION_CONFIG.tags.filter((tag) => !doc.tags[tag.id]);

  const bump = useCallback(
    (delta: number) => {
      const step = delta * (preset.scale ?? 1);
      const res = emit({ type: "DEV_ADJUST", metric: preset.counter, delta: step });
      const value = res.doc.counters[preset.counter] ?? 0;
      const gained = unlockedCount(res.doc) - unlocked;
      const levels = res.doc.progress.level - doc.progress.level;
      const bits = [`${preset.label}: ${step > 0 ? "+" : ""}${step} → ${value}`];
      if (gained > 0) bits.push(`новых достижений: ${gained}`);
      if (levels > 0) bits.push(`уровней: ${levels}`);
      setLog(bits.join(" · "));
    },
    [preset, doc, unlocked],
  );

  const grant = useCallback(
    (currency: "XP" | "AC", sign: 1 | -1) => {
      if (!amount) return;
      const value = amount * sign;
      const res = emit({ type: "ADMIN_GRANT", currency, amount: value, reason: "dev-panel" });
      const gained = unlockedCount(res.doc) - unlocked;
      const levels = res.doc.progress.level - doc.progress.level;
      const bits = [
        `${value > 0 ? "+" : ""}${value} ${currency} · баланс XP ${res.doc.progress.xpTotal}, AC ${res.doc.progress.acBalance}`,
      ];
      if (gained > 0) bits.push(`новых достижений: ${gained}`);
      if (levels > 0) bits.push(`уровней: ${levels}`);
      setLog(bits.join(" · "));
    },
    [amount, doc, unlocked],
  );

  const giveTag = useCallback(() => {
    const id = tagId || freeTags[0]?.id;
    if (!id) return;
    const res = emit({ type: "DEV_TAG_GRANTED", tagId: id });
    const def = PROGRESSION_CONFIG.tags.find((tag) => tag.id === id);
    const owned = Boolean(res.doc.tags[id]);
    const gained = unlockedCount(res.doc) - unlocked;
    const bits = [`${owned ? "Выдан тег" : "Тег не выдан"}: ${def?.name ?? id}`];
    if (gained > 0) bits.push(`новых достижений: ${gained}`);
    setLog(bits.join(" · "));
  }, [tagId, freeTags, unlocked]);

  const reset = useCallback(() => {
    if (!window.confirm("Сбросить документ прогрессии? XP, AC, достижения и журнал будут удалены."))
      return;
    window.localStorage.removeItem(PROGRESS_KEY);
    window.location.reload();
  }, []);

  const near = views
    .filter((item) => item.status === "progress")
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 6);

  const recent = [...doc.ledger].slice(-8).reverse();

  return (
    <aside
      aria-label="Dev-панель прогрессии"
      className="fixed bottom-3 left-3 z-[95] flex max-h-[80vh] w-[min(94vw,420px)] flex-col overflow-hidden rounded-2xl border border-accent/40 bg-[#0a0c12]/95 shadow-[0_18px_60px_rgba(0,0,0,0.6)] backdrop-blur"
    >
      <header className="flex items-center justify-between gap-2 border-b border-white/10 bg-accent/15 px-3 py-2">
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-white">
          Dev-панель прогрессии
        </span>
        <div className="flex items-center gap-1.5">
          <span className="rounded-md bg-black/40 px-1.5 py-0.5 text-[10px] font-bold text-accent-2">
            ?dev=1
          </span>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={open ? "Свернуть dev-панель" : "Развернуть dev-панель"}
            className="h-6 w-6 rounded-md bg-white/10 text-sm font-bold text-white hover:bg-white/20"
          >
            {open ? "–" : "+"}
          </button>
        </div>
      </header>

      {open && (
        <div className="space-y-3 overflow-y-auto p-3 text-xs text-white">
          {/* Состояние документа */}
          <section className="rounded-xl bg-white/[0.04] p-2.5 ring-1 ring-white/8">
            <h3 className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-accent-2">
              Состояние
            </h3>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
              <Row label="Режим" value={PROGRESSION_CONFIG.storageMode} />
              <Row label="Схема / конфиг" value={`${doc.schema} / ${doc.meta.configVersion}`} />
              <Row label="Уровень" value={`${level.level} · ${level.era}`} />
              <Row label="XP / остаток" value={`${doc.progress.xpTotal} / ${level.left}`} />
              <Row label="Баланс AC" value={`${doc.progress.acBalance} AC`} />
              <Row label="Серия" value={`${doc.progress.streakCurrent} дн.`} />
              <Row label="Событий" value={`${doc.meta.events}`} />
              <Row label="Записей журнала" value={`${doc.ledger.length}`} />
              <Row label="Достижений" value={`${unlocked} / ${views.length}`} />
              <Row label="Тегов" value={`${Object.keys(doc.tags).length}`} />
            </dl>
          </section>

          {/* «+N к счётчику» — показывает, как событие разблокирует награду */}
          <section className="rounded-xl bg-white/[0.04] p-2.5 ring-1 ring-white/8">
            <h3 className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-accent-2">
              +N к счётчику
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Счётчик для подкрутки"
                value={counterId}
                onChange={(event) => setCounterId(event.target.value)}
                className="min-w-0 flex-1 rounded-lg bg-white/6 px-2 py-1.5 text-xs text-white ring-1 ring-white/12 focus:outline-none focus:ring-accent"
              >
                {COUNTERS.map((item) => (
                  <option key={item.counter} value={item.counter} className="bg-[#0a0c12]">
                    {item.label}
                  </option>
                ))}
              </select>
              <span className="rounded-md bg-black/40 px-1.5 py-0.5 text-[10px] font-bold text-muted">
                {preset.metric} = {metrics[preset.metric] ?? 0}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[-1, 1, 5, 10, 100].map((delta) => (
                <button
                  key={delta}
                  type="button"
                  onClick={() => bump(delta)}
                  className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold ring-1 transition ${
                    delta < 0
                      ? "bg-white/6 text-white ring-white/15 hover:bg-white/12"
                      : "bg-accent/20 text-white ring-accent/50 hover:bg-accent/30"
                  }`}
                >
                  {delta > 0 ? `+${delta}` : delta}
                </button>
              ))}
            </div>
          </section>

          {/* Выдача/изъятие XP и AC с причиной */}
          <section className="rounded-xl bg-white/[0.04] p-2.5 ring-1 ring-white/8">
            <h3 className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-accent-2">
              Награды (причина: dev-panel)
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <input
                aria-label="Сумма награды"
                inputMode="numeric"
                value={amountText}
                onChange={(event) => setAmountText(event.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-24 rounded-lg bg-white/6 px-2 py-1.5 text-xs text-white ring-1 ring-white/12 focus:outline-none focus:ring-accent"
              />
              <button
                type="button"
                onClick={() => grant("XP", 1)}
                className="rounded-lg bg-accent/20 px-2.5 py-1.5 text-[11px] font-bold text-white ring-1 ring-accent/50 hover:bg-accent/30"
              >
                Выдать XP
              </button>
              <button
                type="button"
                onClick={() => grant("AC", 1)}
                className="rounded-lg bg-accent/20 px-2.5 py-1.5 text-[11px] font-bold text-white ring-1 ring-accent/50 hover:bg-accent/30"
              >
                Выдать AC
              </button>
              <button
                type="button"
                onClick={() => grant("AC", -1)}
                className="rounded-lg bg-white/6 px-2.5 py-1.5 text-[11px] font-bold text-white ring-1 ring-white/15 hover:bg-white/12"
              >
                Списать AC
              </button>
            </div>
          </section>

          {/* Ручная выдача тега */}
          <section className="rounded-xl bg-white/[0.04] p-2.5 ring-1 ring-white/8">
            <h3 className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-accent-2">
              Выдача тега
            </h3>
            {freeTags.length ? (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Тег для выдачи"
                  value={tagId || freeTags[0].id}
                  onChange={(event) => setTagId(event.target.value)}
                  className="min-w-0 flex-1 rounded-lg bg-white/6 px-2 py-1.5 text-xs text-white ring-1 ring-white/12 focus:outline-none focus:ring-accent"
                >
                  {freeTags.map((tag) => (
                    <option key={tag.id} value={tag.id} className="bg-[#0a0c12]">
                      {tag.name} · {tag.rarity}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={giveTag}
                  className="rounded-lg bg-accent/20 px-2.5 py-1.5 text-[11px] font-bold text-white ring-1 ring-accent/50 hover:bg-accent/30"
                >
                  Выдать тег
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-muted">Все доступные теги уже получены.</p>
            )}
          </section>

          {/* Что открывает счётчик прямо сейчас */}
          <section className="rounded-xl bg-white/[0.04] p-2.5 ring-1 ring-white/8">
            <h3 className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-accent-2">
              Ближайшие достижения
            </h3>
            {near.length ? (
              <ul className="space-y-1.5">
                {near.map((item) => (
                  <li key={item.def.id} className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] text-white/85">
                      {item.def.name}
                      <span className="ml-1 text-muted">
                        {item.progress}/{item.def.condition.threshold}
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
                        <span
                          className="block h-full rounded-full bg-gradient-to-r from-accent to-accent-2"
                          style={{ width: `${item.percent}%` }}
                        />
                      </span>
                      <span className="w-8 text-right text-[10px] font-bold text-accent-2">
                        {item.percent}%
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-muted">Нет достижений в процессе.</p>
            )}
          </section>

          {/* USER_REWARDS_LOG */}
          <section className="rounded-xl bg-white/[0.04] p-2.5 ring-1 ring-white/8">
            <h3 className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-accent-2">
              USER_REWARDS_LOG
            </h3>
            {recent.length ? (
              <ul className="space-y-1">
                {recent.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate text-white/85">
                      {typeLabel(entry.type)}
                      <span className="ml-1 text-muted">· {sourceLabel(entry.source)}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {entry.status !== "confirmed" && (
                        <span className="rounded bg-white/10 px-1 text-[9px] uppercase text-muted">
                          {entry.status}
                        </span>
                      )}
                      <span className="font-bold text-accent-2">
                        {amountLabel(entry.currency, entry.amount)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-muted">Журнал пуст.</p>
            )}
          </section>

          {/* Итог последнего действия */}
          <p
            data-dev-log
            aria-live="polite"
            className="rounded-xl bg-accent/12 px-2.5 py-2 text-[11px] leading-relaxed text-white ring-1 ring-accent/35"
          >
            {log}
          </p>

          <button
            type="button"
            onClick={reset}
            className="w-full rounded-lg bg-red-500/15 px-2.5 py-1.5 text-[11px] font-bold text-red-300 ring-1 ring-red-400/40 hover:bg-red-500/25"
          >
            Сбросить прогресс (удалить документ)
          </button>
        </div>
      )}
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className="truncate font-bold text-white">{value}</dd>
    </div>
  );
}
