/**
 * Содержимое блоков виджетов.
 *
 * Каждый блок читает свои данные напрямую из сторов проекта и ничего не
 * кэширует в раскладке. Поэтому виджет «Активность» не может разойтись с
 * историей просмотра, а «Достижения» — со счётчиком достижений: оба читают
 * один и тот же источник в один и тот же момент.
 *
 * Два блока — «Студии» и «Совместимость» — считают не по макету, а по
 * тому, что реально есть в браузере: распределение просмотренного по студиям
 * из кэша тайтлов и совпадение жанров избранного с планами и историей.
 * Чужих профилей у сайта нет (сервера тоже), поэтому «совместимость»
 * сравнивает списки пользователя между собой, а не его с друзьями.
 */

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { COLLECTIONS_KEY, FAVORITES_KEY, type Collection } from "@/lib/collections";
import { parseList, useLocalSnapshot } from "@/lib/use-local-storage";
import { useProfile } from "@/lib/profile";
import { watchStore } from "@/lib/history";
import { useTitles } from "@/lib/titles";
import { loadStatuses } from "@/lib/statuses";
import { collectMetrics } from "@/lib/progression/service";
import { useProgress } from "@/lib/progression/events";
import { PROGRESSION_CONFIG } from "@/lib/progression/progression.config";
import {
  buildAchievements,
  rarestUnlocked,
  rankAt,
  rankSegment,
  segmentFills,
  rankToNext,
  type AchievementItem,
} from "@/lib/progression/achievements-view";
import { AchievementCode } from "@/components/progression/AchievementCode";
import { AchievementEmblem } from "@/components/progression/AchievementEmblem";
import { StatsBlock, fmtHours, type StatCardItem } from "./StatsBlock";
import { collectStats } from "@/lib/achievements";
import { isPremiumActive } from "@/lib/auth";
import { useAccount } from "@/lib/use-account";
import { emblemMeta } from "@/lib/progression/achievements.config";
import { RANKS, RankBadge } from "@/components/progression/RankBadges";
import { Poster } from "@/components/Poster";
import { WidgetIcon } from "./WidgetIcon";
import { TierListWidget } from "./TierListWidget";
import { ArtWidget, FeaturedWidget, PickWidget } from "./Showcases";
import type { WidgetId } from "@/lib/widgets";
import { ArtworkWidget } from "./ArtworkWidget";
import { TextWidget } from "./TextWidget";
import { levelInfo } from "@/lib/levels";
import { ProfilePlaque } from "@/components/battlepass/ProfilePreview";

/** Достижения целиком: одни и те же данные для блока «Достижения» и полки */
function useAchievements(): AchievementItem[] {
  const doc = useProgress();
  return useMemo(
    () => buildAchievements(doc, collectMetrics(), PROGRESSION_CONFIG),
    [doc],
  );
}

/** Дни недели с понедельника — как в макете (Пн…Вс) */
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

/** Календарный ключ дня в местном времени: toISOString сдвигает на UTC */
function dayKeyOf(at: number): string {
  const d = new Date(at);
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Понедельник текущей недели в 00:00. Нужен как начало отсчёта сетки */
function mondayStart(now: Date): Date {
  const d = new Date(now);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
}

function EmptyWidget({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="ag-w-empty">{title}<small>{hint}</small></div>
  );
}

/* ------------------------------- Достижения ------------------------------- */

/** Число недель в карте — столько же, сколько в макете */
const HEATMAP_WEEKS = 26;

/**
 * Тепловая карта дней просмотра.
 *
 * Вынесена отдельным компонентом, потому что нужна в двух местах: блоком
 * «Активность» на витрине и карточкой «Серия дней» на «Основном». Дублировать
 * разметку значило бы через месяц получить две расходящиеся копии.
 */
export function ActivityHeatmap() {
  const watch = watchStore.useStore();

  const cells = useMemo(() => {
    // Считаем серии по дням: в WatchRecord нет длительности, только время
    // открытия, поэтому интенсивность меряется числом серий, а не минутами.
    const perDay = new Map<string, number>();
    for (const record of watch.records) {
      const key = dayKeyOf(record.at);
      perDay.set(key, (perDay.get(key) ?? 0) + 1);
    }
    const peak = Math.max(1, ...perDay.values());

    // Сетка идёт от понедельника текущей недели назад на 26 недель.
    // Календарь ведём через setDate, а не вычитанием миллисекунд: за 26
    // недель дважды случается переход на летнее время, и вычитание 24 часов
    // увело бы сетку на день относительно записей истории.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cursor = mondayStart(today);
    cursor.setDate(cursor.getDate() - (HEATMAP_WEEKS - 1) * 7);

    const out: { key: string; at: number; count: number }[] = [];
    for (let i = 0; i < HEATMAP_WEEKS * 7; i += 1) {
      if (cursor.getTime() <= today.getTime()) {
        const key = dayKeyOf(cursor.getTime());
        out.push({ key, at: cursor.getTime(), count: perDay.get(key) ?? 0 });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return { out, peak };
  }, [watch.records]);

  return (
    <div>
      <div className="ag-w-heat">
        {cells.out.map((cell) => (
          <i
            key={cell.key}
            data-l={cell.count === 0 ? undefined : levelOf(cell.count, cells.peak)}
            title={`${WEEKDAYS[(new Date(cell.at).getDay() + 6) % 7]} — ${cell.count} серий`}
          />
        ))}
      </div>
      <small className="ag-w-sub" style={{ display: "block", marginTop: 10 }}>
        Каждый квадрат — день просмотра. Чем ярче, тем больше серий вы открыли.
      </small>
    </div>
  );
}

/** Четыре ступени яркости по доле от пикового дня */
function levelOf(count: number, peak: number): 1 | 2 | 3 | 4 {
  const ratio = count / peak;
  if (ratio > 0.72) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

/* ------------------------------- Достижения ------------------------------- */

/** Системная настройка «уменьшить движение» */
function useReducedMotion(): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    // на сервере анимации нет: первый кадр отдаёт 0 у обоих
    () => false,
  );
}

/**
 * Плавный подсчёт трофейного счёта — как в макете виджета.
 *
 * Число докручивается от нуля за полторы секунды, поэтому блок не выглядит
 * пустым в первую секунду после открытия профиля. При «уменьшить движение»
 * длительность обнуляется: значение настоящее уже в первом кадре.
 */
function useCountUp(target: number, ms = 1500): number {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    const dur = reduce ? 0 : ms;
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = dur <= 0 ? 1 : Math.min(1, (t - t0) / dur);
      // затухание четвёртой степени — разгон в начале, мягкая остановка
      setValue(Math.round(target * (1 - Math.pow(1 - p, 4))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, reduce]);

  return value;
}

/**
 * Блок достижений витрины: знак ранга, трофейный счёт, сегменты и самые
 * редкие. Вёрстка — по макету виджета 1:1 (герой-строка, разделитель,
 * «самое редкое» с кнопкой перехода к полному списку).
 *
 * Намеренно живёт здесь, а не переиспользует `AchievementsStrip`: тот лежит
 * в ProfileSections, а тот уже импортирует WidgetsPanel → Widgets. Импорт в
 * обратную сторону замкнул бы модульный цикл.
 */
export function AchievementsWidget({ onOpenAll }: { onOpenAll?: () => void }) {
  const views = useAchievements();
  const doc = useProgress();

  const unlocked = views.filter((item) => item.status === "unlocked");
  const rare = rarestUnlocked(views, 4);
  // Трофейный счёт берём из документа, а не пересчитываем: так блок и
  // вкладка «Достижения» всегда показывают одно число
  const score = doc.progress.trophyPoints;
  const shown = useCountUp(score);
  const rank = rankAt(score);
  const segment = rankSegment(score);
  const fills = segmentFills(segment);
  const left = rankToNext(score);
  // Значок ранга — тот самый, что на странице рангов: индекс 0..25 в RANKS
  // совпадает с индексом в progression.config (ranks отсортированы по порогу)
  const badge = RANKS[rank.index] ?? RANKS[0];
  const nf = useMemo(() => new Intl.NumberFormat("ru-RU"), []);

  return (
    <div className="ag-aw">
      <i className="ag-aw-stars" aria-hidden />

      <header className="ag-aw-head">
        <span className="ag-aw-trophy" aria-hidden>
          <WidgetIcon name="trophy" />
        </span>
        <h4>Достижения</h4>
        <span className="ag-aw-count">· {views.length}</span>
      </header>

      <div className="ag-aw-hero">
        <div className="ag-aw-badge">
          <RankBadge rank={badge} size={108} />
        </div>

        <div className="ag-aw-info">
          <span className="ag-aw-eyebrow">РАНГ</span>
          <h5 className="ag-aw-rank">{rank.name}</h5>
          <div className="ag-aw-meta">
            <span>
              Получено <b>{unlocked.length}</b> из {views.length}
            </span>
          </div>
          <div className="ag-aw-prog">
            <div
              className="ag-aw-seg"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={segment}
            >
              {fills.map((fill, i) => (
                <i key={i} data-f={fill ? "y" : undefined} />
              ))}
            </div>
            <span className="ag-aw-next">
              {rank.next ? (
                <>
                  до <b>{rank.next.name}</b> — {nf.format(left)} <em>оч.</em>
                </>
              ) : (
                <>Высший ранг</>
              )}
            </span>
          </div>
        </div>

        <div className="ag-aw-scorebox">
          <div className="ag-aw-score">{nf.format(shown)}</div>
          <div className="ag-aw-score-label">
            <WidgetIcon name="trophy" />
            ТРОФЕЙНЫЙ СЧЁТ
          </div>
        </div>
      </div>

      <div className="ag-aw-div" />

      <div className="ag-aw-rare-head">
        <span>САМОЕ РЕДКОЕ</span>
        <i />
        {onOpenAll && (
          <button type="button" className="ag-aw-all" onClick={onOpenAll}>
            Все достижения
            <WidgetIcon name="right" />
          </button>
        )}
      </div>

      <div className="ag-aw-rare">
        {rare.map((item) => {
          const meta = emblemMeta(item.def.id);
          return (
            <article key={item.def.id} className="ag-aw-card">
              <div className="ag-aw-medal">
                <AchievementEmblem
                  achievement={{
                    id: item.def.id,
                    name: item.def.name,
                    glyph: meta.glyph,
                    tier: item.tier,
                    maxTier: meta.maxTier,
                  }}
                  rarity={meta.rarity}
                  progress={item.percent}
                  unlocked={item.status === "unlocked"}
                  locked={item.status !== "unlocked"}
                  animated
                  size={56}
                />
              </div>
              <b className="ag-aw-title">
                <AchievementCode
                  id={item.def.id}
                  family={item.family}
                  tier={item.tier}
                  disguised={item.disguised}
                />
              </b>
              <span className="ag-aw-rar">
                <i />
                {meta.rarity} · <b>{item.def.trophy}</b> оч.
              </span>
            </article>
          );
        })}
      </div>
    </div>
  );
}

/** Блок «Активность» витрины: тепловая карта + пояснение */
function ActivityWidget() {
  return <ActivityHeatmap />;
}

/* --------------------------------- Неделя --------------------------------- */

function WeekWidget() {
  const watch = watchStore.useStore();

  const buckets = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (const record of watch.records) {
      counts[(new Date(record.at).getDay() + 6) % 7] += 1;
    }
    return counts;
  }, [watch.records]);

  const peak = Math.max(1, ...buckets);

  return (
    <div className="ag-w-week">
      {buckets.map((count, i) => (
        <div key={WEEKDAYS[i]}>
          <em>{count}</em>
          <span className="ag-w-week-bar">
            <i style={{ height: `${(count / peak) * 100}%` }} />
          </span>
          {WEEKDAYS[i]}
        </div>
      ))}
    </div>
  );
}

/* -------------------------------- Любимое --------------------------------- */

function FavoriteWidget() {
  const raw = useLocalSnapshot(FAVORITES_KEY);
  const titles = useTitles();
  const favorites = useMemo(() => parseList<string>(raw, []).slice(0, 5), [raw]);

  if (favorites.length === 0) {
    return <EmptyWidget title="Список пуст" hint="Добавьте тайтлы сердцем на странице аниме — здесь появятся первые пять." />;
  }

  return (
    <div className="ag-w-slots">
      {favorites.map((id) => (
        <div key={id} className="ag-w-slot">
          <Poster
            src={titles[id]?.poster}
            alt={titles[id]?.title ?? "Тайлт"}
            title={titles[id]?.title ?? "Тайлт"}
            className="h-full w-full object-cover"
          />
        </div>
      ))}
      {favorites.length < 5 && <div className="ag-w-slot is-empty">+</div>}
    </div>
  );
}

/* ------------------------------- Подборки --------------------------------- */

function CollectionsWidget() {
  const raw = useLocalSnapshot(COLLECTIONS_KEY);
  const collections = useMemo(() => parseList<Collection>(raw, []), [raw]);

  if (collections.length === 0) {
    return <EmptyWidget title="Подборок пока нет" hint="Соберите первую на странице любого тайтла — кнопка «В подборку»." />;
  }

  return (
    <ul className="ag-w-coll">
      {collections.slice(0, 4).map((item) => (
        <li key={item.id}>
          <b>{item.name}</b>
          <span className="ag-w-sub">
            тайтлов: {item.animeIds.length}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------- Обо мне --------------------------------- */

function AboutWidget() {
  const profile = useProfile();
  const text = profile.bio.trim();

  if (!text) {
    return <EmptyWidget title="Подпись пустая" hint="Заполните «О себе» в настройках профиля — текст появится здесь." />;
  }

  return <p className="ag-w-about">{text}</p>;
}

/* ------------------------------ Хронология -------------------------------- */

function ChronologyWidget() {
  const watch = watchStore.useStore();
  const recent = watch.records.slice(0, 3);

  if (recent.length === 0) {
    return <EmptyWidget title="Просмотров ещё не было" hint="Запустите любую серию — здесь появится лента последних просмотров." />;
  }

  return (
    <ol className="ag-w-tl">
      {recent.map((record) => (
        <li key={`${record.id}-${record.season}-${record.episode}-${record.at}`}>
          {record.title}
          <small>
            серия {record.episode} · {new Date(record.at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
          </small>
        </li>
      ))}
    </ol>
  );
}

/* -------------------------------- Студии ---------------------------------- */

/**
 * Распределение просмотренного по студиям.
 *
 * Студии приходят из карточки Kodik и кладутся в кэш тайтлов тем же
 * вызовом `rememberTitle`, который запоминает название. Считаем серии, а не
 * тайтлы: одна серия — одно открытие, а тайтл мог быть открыт десять раз,
 * и «доля студии» должна отражать реальное время зрителя.
 *
 * Таитлы, чьи студии неизвестны, в знаменатель не идут, но их количество
 * показывается честно: иначе 90% «пустых» серий выглядели бы как 100%
 * приходящихся на две студии.
 */
function StudiosWidget() {
  const watch = watchStore.useStore();
  const titles = useTitles();

  const { rows, unknownEpisodes, totalEpisodes } = useMemo(() => {
    const counts = new Map<string, number>();
    let unknown = 0;
    let total = 0;
    for (const record of watch.records) {
      total += 1;
      const studios = titles[record.id]?.studios ?? [];
      // Тайтл без студий (манга, старые записи кэша) — в счётчик не идёт
      if (studios.length === 0) {
        unknown += 1;
        continue;
      }
      // Несколько студий на тайтл — делим серию поровну, иначе сумма долей
      // разъезжается с единицей; округление добираем на первой же студии
      const share = 1 / studios.length;
      studios.forEach((name, index) => {
        const add = index === 0 ? 1 - share * (studios.length - 1) : share;
        counts.set(name, (counts.get(name) ?? 0) + add);
      });
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { rows: sorted, unknownEpisodes: unknown, totalEpisodes: total };
  }, [watch.records, titles]);

  if (totalEpisodes === 0) {
    return <EmptyWidget title="Просмотров ещё не было" hint="Запустите серию — и здесь появится разбивка по студиям." />;
  }

  if (rows.length === 0) {
    return (
      <EmptyWidget
        title="Студии не определены"
        hint={`Ни для одной из ${totalEpisodes} серий в кэше нет студии. Они появляются у тайтлов с аниме-карточкой, когда страницу тайтла открывают.`}
      />
    );
  }

  return (
    <>
      <ul className="ag-w-bars">
        {rows.map(([name, value]) => {
          const share = Math.round((value / rows.reduce((s, [, v]) => s + v, 0)) * 100);
          return (
            <li key={name}>
              <span className="ag-w-sub" title={name}>{name}</span>
              <span className="ag-w-bar"><i style={{ width: `${share}%` }} /></span>
              <b>{share}%</b>
            </li>
          );
        })}
      </ul>
      {unknownEpisodes > 0 && (
        <p className="ag-w-note">Студии неизвестны для {unknownEpisodes} из {totalEpisodes} серий — в доли не вошли.</p>
      )}
    </>
  );
}

/* ---------------------------- Трофейная полка ------------------------------ */

function ShelfWidget() {
  const views = useAchievements();
  const unlocked = views.filter((item) => item.status === "unlocked");
  const top = [...unlocked]
    .sort((a, b) => b.def.trophy - a.def.trophy || a.def.name.localeCompare(b.def.name))
    .slice(0, 3);

  if (top.length === 0) {
    return <EmptyWidget title="Полка пуста" hint="Первое открытое достижение встанет сюда." />;
  }

  return (
    <div className="ag-w-shelf">
      {top.map((item) => (
        <div key={item.def.id} title={`${item.def.name} · ${item.def.trophy} 🏆`}>
          <AchievementEmblem
            achievement={{
              id: item.def.id,
              name: item.def.name,
              glyph: emblemMeta(item.def.id).glyph,
              tier: item.tier,
              maxTier: emblemMeta(item.def.id).maxTier,
            }}
            rarity={emblemMeta(item.def.id).rarity}
            progress={100}
            unlocked
            locked={false}
            animated
            size={40}
          />
        </div>
      ))}
    </div>
  );
}

/* -------------------------------- Подарки --------------------------------- */

function GiftsWidget() {
  const profile = useProfile();
  const gifts = profile.gifts;

  if (gifts.length === 0) {
    return <EmptyWidget title="Подарков нет" hint="Другие зрители смогут дарить вам предметы из каталога." />;
  }

  return (
    <ul className="ag-w-coll">
      {gifts.slice(0, 4).map((gift) => (
        <li key={gift.id}>
          <b>{gift.name}</b>
          <span className="ag-w-sub">{gift.claimed ? "получен" : "не получен"}</span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------ Совместимость ------------------------------ */

/** Коэффициент Жаккара: |A∩B| / |A∪B| — доля общих жанров, 0…100 % */
function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const item of a) if (b.has(item)) shared += 1;
  return Math.round((shared / (a.size + b.size - shared)) * 100);
}

/**
 * Совпадение вкусов между собственными списками.
 *
 * В макете блок сравнивает профиль с друзьями, но сервера у сайта нет и
 * чужих профилей тоже — сравнивать не с кем. Вместо выдуманных «друзей»
 * здесь честное сравнение того, что есть: жанры из избранного против
 * жанров планов и против жанров истории. Числа настоящие, считаются из
 * кэша тайтлов; совпадение нужно ровно для того, для чего в макете искали
 * «совместимость» — понять, насколько ваши планы совпадают с вкусом.
 */
function CompatWidget() {
  const favoritesRaw = useLocalSnapshot(FAVORITES_KEY);
  const watch = watchStore.useStore();
  const titles = useTitles();
  const statuses = useMemo(() => loadStatuses(), []);

  const rows = useMemo(() => {
    const favorites = parseList<string>(favoritesRaw, []);
    const genresOf = (ids: Iterable<string>): Set<string> => {
      const out = new Set<string>();
      for (const id of ids) for (const g of titles[id]?.genres ?? []) out.add(g);
      return out;
    };

    const favoritesGenres = genresOf(favorites);
    const planned = Object.entries(statuses)
      .filter(([, status]) => status === "planned")
      .map(([id]) => id);
    const watched = new Set(watch.records.map((record) => record.id));

    return {
      favoritesGenres,
      plannedGenres: genresOf(planned),
      watchedGenres: genresOf(watched),
      plannedCount: planned.length,
      watchedCount: watched.size,
    };
  }, [favoritesRaw, titles, statuses, watch.records]);

  /** Жанры, которые встречаются и в избранном, и в планах, — их видно сразу */
  const shared = useMemo(
    () => [...rows.favoritesGenres].filter((g) => rows.plannedGenres.has(g)).slice(0, 5),
    [rows.favoritesGenres, rows.plannedGenres],
  );

  if (rows.favoritesGenres.size === 0) {
    return (
      <EmptyWidget
        title="Нечего сравнивать"
        hint="Добавьте тайтлы в избранное — жанры из них и станут базой для сравнения с планами и историей."
      />
    );
  }

  return (
    <>
      <ul className="ag-w-compat">
        <li>
          <span className="ag-w-sub">Избранное ↔ планы</span>
          <b>{overlap(rows.favoritesGenres, rows.plannedGenres)}%</b>
          <span className="ag-w-sub">планов: {rows.plannedCount}</span>
        </li>
        <li>
          <span className="ag-w-sub">Избранное ↔ история</span>
          <b>{overlap(rows.favoritesGenres, rows.watchedGenres)}%</b>
          <span className="ag-w-sub">тайтлов: {rows.watchedCount}</span>
        </li>
      </ul>
      {shared.length > 0 ? (
        <p className="ag-w-note">Общие жанры: {shared.join(", ")}</p>
      ) : (
        <p className="ag-w-note">
          Общих жанров с планами нет. Сравнение идёт по жанрам в кэше тайтлов — у тайтлов,
          чьи жанры ещё не загружены, в базу они не попадают.
        </p>
      )}
    </>
  );
}

/* ------------------------------- Роутинг ---------------------------------- */
/* ------------------------------- Статистика ------------------------------- */

/**
 * Блок «Просмотрено / Аниме / Серии / Достижения» — тот же StatsBlock, что
 * стоит в шапке профиля. Отдельная копия карточек разошлась бы с шапкой при
 * первой же правке числа, поэтому переиспользуем компонент.
 *
 * Карточки некликабельные: в шапке они ведут в разделы профиля, а у виджета
 * своего места нет — и делать ссылку «в никуда» было бы обещанием.
 *
 * Приватность проверяется здесь же: раньше её держал блок на главной
 * странице профиля, и с его удалением скрытые числа утекли бы гостям
 * через виджет.
 */
function StatsWidget() {
  const profile = useProfile();
  const watch = watchStore.useStore();
  const collectionsRaw = useLocalSnapshot(COLLECTIONS_KEY);
  const favoritesRaw = useLocalSnapshot(FAVORITES_KEY);
  const account = useAccount();
  const progress = useProgress();

  const stats = useMemo(
    () =>
      collectStats(
        profile,
        watch,
        parseList<Collection>(collectionsRaw, []),
        parseList<string>(favoritesRaw, []).length,
        isPremiumActive(account),
        account?.createdAt ?? 0,
      ),
    [profile, watch, collectionsRaw, favoritesRaw, account],
  );

  /* Достижения считаем по документу прогрессии: легаси-каталог знает только
     28 старых достижений, и виджет показывал «3», когда в профиле было уже
     5 из 77. */
  const unlocked = Object.values(progress.achievements).filter(
    (item) => item.unlockedAt > 0,
  ).length;

  const cards = useMemo<StatCardItem[]>(
    () => [
      { label: "Просмотрено", value: Math.floor(stats.minutes / 60), icon: "clock", color: "#5b7cff", color2: "#9a6bff", format: fmtHours },
      { label: "Аниме", value: stats.titles, icon: "tv", color: "#1fd6a0", color2: "#18a0ff" },
      { label: "Серий", value: stats.episodes, icon: "play", color: "#38b6e8", color2: "#5b7cff" },
      { label: "Достижения", value: unlocked, icon: "trophy", color: "#33bbff", color2: "#1fdfff" },
    ],
    [stats.minutes, stats.titles, stats.episodes, unlocked],
  );

  if (!profile.privacy.showStats) {
    return (
      <div>
        <p className="text-[11px] text-muted">
          Статистика скрыта в приватности — её не видят гости профиля.
        </p>
      </div>
    );
  }

  return <StatsBlock cards={cards} className="ag-w-stats" />;
}

/** Плашка уровня «Хуэко Мундо»: живые уровень, серии и часы; открыта наградой пропуска */
function LevelPlaqueWidget() {
  const profile = useProfile();
  const doc = useProgress();
  const watch = watchStore.useStore();
  const has =
    profile.purchased.includes("decor-hueco-mundo") ||
    doc.purchases.some((item) => item.itemId === "decor-hueco-mundo") ||
    doc.battlepass.claimed.some((key) => key.endsWith(":100") && key.includes(":premium:"));
  if (!has) {
    return (
      <p className="text-[11px] text-muted">
        Плашка открывается наградой 100 уровня боевого пропуска — оформление «Хуэко Мундо».
      </p>
    );
  }
  const info = levelInfo(doc.progress.xpTotal);
  return (
    <div className="ag-w-plaque">
      <ProfilePlaque level={info.level} series={watch.records.length} hours={Math.floor(watch.seconds / 3600)} percent={info.percent} />
    </div>
  );
}

const BODIES: Record<WidgetId, (props: { readOnly?: boolean }) => React.JSX.Element> = {
  ach: () => <AchievementsWidget />,
  act: ActivityWidget,
  fav: FavoriteWidget,
  week: WeekWidget,
  coll: CollectionsWidget,
  about: AboutWidget,
  chrono: ChronologyWidget,
  stud: StudiosWidget,
  shelf: ShelfWidget,
  gifts: GiftsWidget,
  compat: CompatWidget,
  stats: StatsWidget,
  /* Тир-лист единственный редактируемый блок: гостю показываем его, но
     править чужой тир-лист нельзя */
  tier: ({ readOnly }) => <TierListWidget readOnly={readOnly} />,
  feat: ({ readOnly }) => <FeaturedWidget readOnly={readOnly} />,
  art: ({ readOnly }) => <ArtWidget readOnly={readOnly} />,
  pick: ({ readOnly }) => <PickWidget readOnly={readOnly} />,
  level: LevelPlaqueWidget,
  artwork: ({ readOnly }) => <ArtworkWidget readOnly={readOnly} />,
  text: ({ readOnly }) => <TextWidget readOnly={readOnly} />,
};


export function WidgetBody({
  id,
  readOnly = false,
  onOpenAchievements,
}: {
  id: WidgetId;
  /** Чужой профиль: блоки показываются, но не редактируются */
  readOnly?: boolean;
  /** Кнопка «Все достижения» в блоке достижений → раздел «Достижения» */
  onOpenAchievements?: () => void;
}) {
  const Body = BODIES[id];
  if (id === "ach" && onOpenAchievements) {
    return <AchievementsWidget onOpenAll={onOpenAchievements} />;
  }
  return <Body readOnly={readOnly} />;
}
