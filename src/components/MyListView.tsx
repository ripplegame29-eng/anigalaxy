"use client";

/**
 * «Мой список» — отдельная страница из меню.
 *
 * Не путать с вкладкой «Любимое» в профиле: там пять витринных слотов,
 * здесь полный список избранного с поиском, фильтрами, сортировкой и
 * историей просмотров — как в макете этой страницы.
 *
 * Фильтры статусов и поиск по жанру, году, рейтингу и «N / M серий»
 * работают по кэшу тайтлов (`animehub:titles:v1`). Кэш заполняется тем же
 * вызовом, что запоминает название, — при добавлении в избранное и при
 * открытии страницы тайтла. Поэтому у тайтла, который в избранном давно и
 * страницу с тех пор не открывали, часть полей будет пустой: такие тайтлы
 * под фильтр не попадают, а вместо выдуманных чисел показывается прочерк.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { openProfileDialog } from "@/lib/profile-dialog";
import { COLLECTIONS_KEY, FAVORITES_KEY, toggleFavorite } from "@/lib/collections";
import { parseList, useLocalSnapshot } from "@/lib/use-local-storage";
import { useTitles } from "@/lib/titles";
import { clearWatchHistory, timeAgo, watchStore } from "@/lib/history";
import { STATUS_LABEL, STATUS_ORDER, STATUSES_KEY, type WatchStatus } from "@/lib/statuses";
import { Poster } from "@/components/Poster";
import { WidgetIcon } from "@/components/profile/WidgetIcon";

type Sort = "new" | "name" | "rating";

/** «Любой статус» + четыре реальных статуса из statuses.ts */
type StatusFilter = WatchStatus | "any";

export function MyListView() {
  const favoritesRaw = useLocalSnapshot(FAVORITES_KEY);
  const collectionsRaw = useLocalSnapshot(COLLECTIONS_KEY);
  const statusesRaw = useLocalSnapshot(STATUSES_KEY);
  const titles = useTitles();
  const watch = watchStore.useStore();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("new");
  const [status, setStatus] = useState<StatusFilter>("any");
  const [genre, setGenre] = useState("");
  const [year, setYear] = useState("");
  const [minRating, setMinRating] = useState("");

  const favorites = useMemo(() => parseList<string>(favoritesRaw, []), [favoritesRaw]);
  const collections = useMemo(
    () => parseList<{ id: string; name: string; animeIds: string[] }>(collectionsRaw, []),
    [collectionsRaw],
  );
  const statuses = useMemo(() => {
    try {
      const parsed = JSON.parse(statusesRaw) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, WatchStatus>)
        : {};
    } catch {
      return {} as Record<string, WatchStatus>;
    }
  }, [statusesRaw]);

  /** Сколько серий тайтла уже открывали — числитель в «N / M серий» */
  const watchedEpisodes = useMemo(() => {
    const out: Record<string, number> = {};
    for (const record of watch.records) {
      out[record.id] = (out[record.id] ?? 0) + 1;
    }
    return out;
  }, [watch.records]);

  /** Варианты фильтров — только по тому, что реально есть в кэше */
  const options = useMemo(() => {
    const genres = new Map<string, number>();
    const years = new Set<number>();
    for (const id of favorites) {
      const meta = titles[id];
      for (const g of meta?.genres ?? []) genres.set(g, (genres.get(g) ?? 0) + 1);
      if (meta?.year) years.add(meta.year);
    }
    return {
      genres: [...genres.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g).slice(0, 24),
      years: [...years].sort((a, b) => b - a),
      /** Границы рейтинга: 0…10, шаг 0.5, как в каталоге */
      maxRating: 10,
    };
  }, [favorites, titles]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const minYear = year ? Number(year) : null;
    const minScore = minRating ? Number(minRating) : null;

    const list = favorites.filter((id) => {
      const meta = titles[id];
      // Заголовок ищем и по названию, и по id: id — единственное, что
      // есть у тайтла, чей кэш ещё не заполнен
      if (q && !`${meta?.title ?? id} ${id}`.toLowerCase().includes(q)) return false;
      if (status !== "any" && statuses[id] !== status) return false;
      if (genre && !(meta?.genres ?? []).includes(genre)) return false;
      if (minYear !== null && (meta?.year ?? -1) < minYear) return false;
      if (minScore !== null && (meta?.rating ?? -1) < minScore) return false;
      return true;
    });

    if (sort === "name") {
      return [...list].sort((a, b) =>
        (titles[a]?.title ?? a).localeCompare(titles[b]?.title ?? b, "ru"),
      );
    }
    if (sort === "rating") {
      // Тайтлы без рейтинга уходят вниз, а не считаются лучшими
      return [...list].sort((a, b) => (titles[b]?.rating ?? -1) - (titles[a]?.rating ?? -1));
    }
    return list;
  }, [favorites, titles, query, sort, status, genre, year, minRating, statuses]);

  /** Есть ли смысл показывать панель фильтров: хоть один непустой */
  const hasExtraFilters = Boolean(genre || year || minRating) || status !== "any";
  const resetFilters = () => {
    setStatus("any");
    setGenre("");
    setYear("");
    setMinRating("");
  };

  return (
    <div className="ag-root">
      {/* ---------------------------- Заголовок ---------------------------- */}
      {/* Ширина своя, шире профильной: список в макете занимает всю
          страницу, колонка профиля для него слишком узкая */}
      <div className="ag-list-wrap">
        <div className="ag-list-head">
          <div>
            <h1 className="ag-h1 ag-list-h1">
              <span className="ag-lg">
                <WidgetIcon name="list" />
              </span>
              Мой <em>список</em>
            </h1>
            <small className="ag-list-sub">Отслеживайте прогресс просмотра аниме</small>
          </div>
          <div className="ag-list-acts">
            <Link href="/settings?tab=data" className="btn g">
              <WidgetIcon name="dl" />
              Экспорт / Импорт
            </Link>
            <button type="button" onClick={() => openProfileDialog("share")} className="btn g">
              <WidgetIcon name="share" />
              Поделиться
            </button>
          </div>
        </div>

        {/* ------------------------- Поиск и сортировка ------------------------ */}
        <div className="ag-card ag-ls-card">
          <div className="ag-ls-bar" style={{ marginBottom: 0 }}>
            <label className="ag-fld">
              <WidgetIcon name="search" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Поиск по списку..."
                aria-label="Поиск по списку"
              />
            </label>
            <select
              className="ag-sel"
              value={sort}
              onChange={(event) => setSort(event.target.value as Sort)}
              aria-label="Сортировка"
            >
              <option value="new">Сначала новые</option>
              <option value="name">По названию</option>
              <option value="rating">По рейтингу</option>
            </select>
          </div>

          {/* Фильтры статусов — из сторов статусов, те же значения,
              что и в кнопках на странице тайтла */}
          <div className="ag-chips" role="group" aria-label="Фильтр по статусу">
            <button
              type="button"
              className={`ag-chip ${status === "any" ? "is-on" : ""}`}
              aria-pressed={status === "any"}
              onClick={() => setStatus("any")}
            >
              Все
            </button>
            {STATUS_ORDER.map((value) => (
              <button
                key={value}
                type="button"
                className={`ag-chip ${status === value ? "is-on" : ""}`}
                aria-pressed={status === value}
                onClick={() => setStatus(value)}
              >
                {STATUS_LABEL[value]}
              </button>
            ))}
          </div>

          {/* Расширенный поиск. Значения берутся из кэша тайтлов, поэтому
              пустые списки означают «нечего фильтровать», а не ошибку */}
          <div className="ag-ls-extra">
            <label className="ag-sel-wrap">
              <span className="ag-w-sub">Жанр</span>
              <select className="ag-sel" value={genre} onChange={(e) => setGenre(e.target.value)}>
                <option value="">Любой</option>
                {options.genres.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </label>

            <label className="ag-sel-wrap">
              <span className="ag-w-sub">Год от</span>
              <select className="ag-sel" value={year} onChange={(e) => setYear(e.target.value)}>
                <option value="">Любой</option>
                {options.years.map((y) => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
            </label>

            <label className="ag-sel-wrap">
              <span className="ag-w-sub">Рейтинг от</span>
              <select className="ag-sel" value={minRating} onChange={(e) => setMinRating(e.target.value)}>
                <option value="">Любой</option>
                {[2, 4, 6, 7, 8, 9].map((v) => (
                  <option key={v} value={String(v)}>{v}.0</option>
                ))}
              </select>
            </label>

            {hasExtraFilters && (
              <button type="button" onClick={resetFilters} className="btn g ag-ls-reset">
                Сбросить фильтры
              </button>
            )}
          </div>
        </div>

        {/* ------------------------------ Список ------------------------------ */}
        <h2 className="ag-h2 ag-list-h2" style={{ marginTop: 24 }}>
          <WidgetIcon name="heart" />
          Избранное
        </h2>
        <p className="ag-sub">
          {favorites.length === 0
            ? "Список пуст"
            : `Показано ${filtered.length} из ${favorites.length} ${plural(favorites.length, "тайтла", "тайтлов", "тайтлов")}`}
          {collections.length > 0 && ` · подборок: ${collections.length}`}
        </p>

        {favorites.length === 0 ? (
          <div className="ag-card ag-big">
            <div className="ag-big-ic">
              <WidgetIcon name="heart" />
            </div>
            <b>Список пока пуст</b>
            <p>Добавьте тайтлы сердцем на странице аниме — они появятся здесь.</p>
            <Link href="/catalog" className="btn">
              <WidgetIcon name="plus" />
              Открыть каталог
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="ag-card ag-big">
            <div className="ag-big-ic">
              <WidgetIcon name="search" />
            </div>
            <b>Ничего не найдено</b>
            <p>
              {query.trim()
                ? `По запросу «${query.trim()}» в списке нет тайтлов.`
                : "Под фильтры не подошёл ни один тайтл."}
            </p>
            {(query.trim() || hasExtraFilters) && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setQuery("");
                  resetFilters();
                }}
              >
                Сбросить
              </button>
            )}
          </div>
        ) : (
          <div className="ag-list">
            {filtered.map((id) => {
              const meta = titles[id];
              const seen = watchedEpisodes[id] ?? 0;
              const total = meta?.episodesTotal ?? 0;
              return (
                <article key={id} className="ag-card ag-list-card">
                  <div className="ag-list-poster">
                    <Poster
                      src={meta?.poster}
                      alt={meta?.title ?? "Тайлт"}
                      title={meta?.title ?? "Тайлт"}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="ag-list-info">
                    {meta?.title ? (
                      <Link href={`/title/${id}`} className="ag-list-title">
                        {meta.title}
                      </Link>
                    ) : (
                      /* Название лежит в кэше тайтлов и появляется, когда
                         страницу тайтла открывают. Показывать вместо него
                         «serial-12345» — значит вывалить наружу внутренний id */
                      <span className="ag-list-title is-muted">Название не загружено</span>
                    )}

                    <div className="ag-list-tags">
                      {meta?.genres?.slice(0, 3).map((g) => (
                        <span key={g} className="ag-list-tag">{g}</span>
                      ))}
                      {meta?.year ? <span className="ag-list-tag">{meta.year}</span> : null}
                      {meta?.rating !== undefined ? (
                        <span className="ag-list-tag is-gold">{meta.rating.toFixed(1)}</span>
                      ) : null}
                    </div>

                    <div className="ag-list-row">
                      <button
                        type="button"
                        onClick={() => toggleFavorite(id)}
                        className="ag-list-btn"
                      >
                        В избранном
                      </button>
                      {/* Числитель — сколько серий открывали, знаменатель —
                          сколько вышло. Неизвестное показываем прочерком,
                          а не нулём: ноль значил бы «не смотрели вовсе» */}
                      <span className="ag-w-sub">
                        {seen > 0 || total > 0 ? `${seen} / ${total || "—"} серий` : "серии не открывались"}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* ---------------------------- Подборки ---------------------------- */}
        <h2 className="ag-h2 ag-list-h2" style={{ marginTop: 30 }}>
          <WidgetIcon name="layers" />
          Подборки
        </h2>
        {collections.length === 0 ? (
          <div className="ag-card ag-big">
            <div className="ag-big-ic">
              <WidgetIcon name="layers" />
            </div>
            <b>У вас пока нет подборок</b>
            <p>Соберите свою первую подборку любимых тайтлов.</p>
            <Link href="/catalog" className="btn">
              <WidgetIcon name="plus" />
              Создать подборку
            </Link>
          </div>
        ) : (
          <div className="ag-list">
            {collections.map((collection) => {
              /* Мозаика 2×2 из кэша тайтлов: у подборки, чьи тайтлы
                 открывали, она появляется сразу покрышками */
              const mosaic = (collection.animeIds ?? []).slice(0, 4);
              return (
                <Link
                  key={collection.id}
                  href={`/collections?c=${encodeURIComponent(collection.id)}`}
                  className="ag-card ag-list-card"
                >
                  <div className="ag-list-poster is-mosaic">
                    {mosaic.length === 0 ? (
                      <WidgetIcon name="layers" />
                    ) : (
                      mosaic.map((id) => (
                        <Poster
                          key={id}
                          src={titles[id]?.poster}
                          alt=""
                          title=""
                          className="h-full w-full object-cover"
                        />
                      ))
                    )}
                  </div>
                  <div className="ag-list-info">
                    <span className="ag-list-title">{collection.name}</span>
                    <div className="ag-list-row">
                      <span className="ag-w-sub">
                        тайтлов: {collection.animeIds?.length ?? 0}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* --------------------- История просмотров --------------------- */}
        <h2 className="ag-h2 ag-list-h2" style={{ marginTop: 34 }}>
          <WidgetIcon name="clock" />
          История просмотров
        </h2>
        <div className="ag-sh">
          <span>{watch.records.length} записей</span>
          <button
            type="button"
            onClick={() => clearWatchHistory()}
            /* Кнопка была 16px высотой — ниже минимума WCAG 2.2 AA (24px).
               Отступы -mx-2 и -my-1.5 расширяют площадь касания до 44×40,
               а отрицательные поля возвращают блок на прежнее место:
               строка заголовка не сдвигается. */
            className="-mx-2 -my-1.5 inline-flex min-h-10 items-center rounded-lg px-2 py-1.5 text-xs font-bold text-rose-300 transition hover:bg-rose-400/10 hover:text-rose-200"
          >
            Очистить историю
          </button>
        </div>

        {watch.records.length === 0 ? (
          <div className="ag-card ag-big">
            <div className="ag-big-ic">
              <WidgetIcon name="clock" />
            </div>
            <b>История пуста</b>
            <p>Запустите любую серию — здесь появится лента последних просмотров.</p>
          </div>
        ) : (
          <div className="ag-hist">
            {watch.records.slice(0, 8).map((record) => {
              /* Постер пишется в запись истории при открытии серии, но у
                 записей, сделанных до этого, его нет — берём из кэша тайтлов */
              const poster = record.poster ?? titles[record.id]?.poster;
              return (
                <article key={`${record.id}-${record.season}-${record.episode}-${record.at}`} className="ag-hist-card">
                  <div className={`ag-hist-poster${poster ? "" : " is-icon"}`}>
                    {poster ? (
                      <Poster src={poster} alt="" title={record.title} className="h-full w-full object-cover" />
                    ) : (
                      <span>{(record.title || "?").charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="ag-hist-top">
                    <span className="ag-hist-ep">Серия {record.episode}</span>
                    <span className="ag-hist-when">{timeAgo(record.at)}</span>
                  </div>
                  <div className="ag-hist-body">
                    <p className="ag-hist-title">{record.title}</p>
                    <Link href={`/title/${record.id}?s=${record.season}&ep=${record.episode}`} className="ag-hist-btn">
                      Смотреть
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/** Русское склонение для счётчика тайтлов */
function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}