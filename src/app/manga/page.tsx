import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { AnimeGrid } from "@/components/AnimeRow";
import { Reveal } from "@/components/Reveal";
import "./manga-catalog.css";
import { mangaFilteredPage, mangaGenres, type MangaSort } from "@/lib/senku";

export const metadata: Metadata = {
  title: "Каталог манги",
  description:
    "Каталог манги, манхвы и маньхуа с русским переводом: свежие тайтлы, топ по рейтингу и чтение прямо на сайте.",
};

/** Данные источника меняются медленно — кэшируем страницу на 10 минут */
export const revalidate = 600;

interface PageProps {
  searchParams: Promise<{ sort?: string; page?: string; q?: string; genre?: string; status?: string }>;
}

const SORTS: { value: MangaSort; label: string }[] = [
  { value: "hot", label: "Популярное" },
  { value: "best", label: "Лучшее" },
  { value: "new", label: "Сначала новые" },
  { value: "title", label: "А–Я" },
];

const STATUSES: { value: "" | "ongoing" | "released"; label: string }[] = [
  { value: "", label: "Любой статус" },
  { value: "ongoing", label: "Выходит" },
  { value: "released", label: "Завершена" },
];

/** Сколько тайтлов на страницу каталога */
const PER_PAGE = 30;

/** Русские окончания: 1 тайтл, 2 тайтла, 5 тайтлов */
function plural(n: number, one: string, few: string, many: string): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  const mod10 = n % 10;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export default async function MangaCatalogPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const sort: MangaSort = sp.sort === "best" || sp.sort === "new" || sp.sort === "title" ? sp.sort : "hot";
  const genre = (sp.genre ?? "").slice(0, 40);
  const status = sp.status === "ongoing" || sp.status === "released" ? sp.status : "";
  // Запрос держим в URL: ссылку с поиском можно переслать, кнопка «назад»
  // возвращает к прежнему запросу, а страницы не теряют фильтр
  const query = (sp.q ?? "").slice(0, 80);

  // Смещение берём постранично: MangaDex отдаёт максимум 100 тайтлов,
  // поэтому на третьей странице он закончится — покажем «дальше нет»
  const rawPage = Number(sp.page ?? 1);
  const page = Number.isFinite(rawPage) && rawPage > 1 ? Math.floor(rawPage) : 1;
  const offset = (page - 1) * PER_PAGE;

  const [{ cards, hasMore, total }, genres] = await Promise.all([
    mangaFilteredPage(sort, offset, PER_PAGE, query, { genre: genre || undefined, status: status || undefined }).catch(() => ({
      cards: [],
      hasMore: false,
      total: 0,
    })),
    mangaGenres().catch(() => [] as { name: string; count: number }[]),
  ]);

  const shownFrom = offset + 1;
  const shownTo = offset + cards.length;
  // Ссылки сортировки и страниц должны сохранять запрос, иначе любой клик
  // по сортировке молча сбрасывал бы поиск
  const qs = (patch: Record<string, string | number>) => {
    const params = new URLSearchParams();
    params.set("sort", sort);
    if (query) params.set("q", query);
    if (genre) params.set("genre", genre);
    if (status) params.set("status", status);
    for (const [key, value] of Object.entries(patch)) {
      // Страница 1 в URL не нужна: без неё адрес канонический и его не
      // отличает поиск от обычного обхода каталога
      // Пустое значение — это «убрать параметр»: так работает сброс поиска.
      // Без этого «Сбросить» собирал бы ссылку с тем же запросом
      if ((key === "page" && Number(value) <= 1) || value === "") params.delete(key);
      else params.set(key, String(value));
    }
    return `/manga?${params.toString()}`;
  };

  return (
    <div className="cat-page">
    <div className="cat-wrap">
      <div className="cat-crumbs">
        <Breadcrumbs items={[{ label: "Манга" }]} />
      </div>

      <div>
        <h1 className="cat-h1">
          {query ? `Поиск: ${query}` : "Каталог манги"}
        </h1>
        <p className="cat-found">
          {query ? (
            total > 0 ? (
              <>
                найдено {total} {plural(total, "тайтл", "тайтла", "тайтлов")} по запросу «{query}»
                {page > 1 && <> · показаны {shownFrom}–{shownTo}</>}
              </>
            ) : (
              <>ничего не нашлось. Попробуй часть названия или оригинальное имя тайтла.</>
            )
          ) : cards.length > 0 ? (
            <>
              {page > 1 && <span>{shownFrom}–{shownTo} · </span>}
              {cards.length} тайтлов с русским переводом — читается прямо на сайте{hasMore && <> · ≈ всего {total}</>}
            </>
          ) : (
            "Каталог временно недоступен — попробуйте позже"
          )}
        </p>
      </div>

      {/* Поиск: обычная форма без JS, поэтому работает и с отключённым скриптом */}
      <form action="/manga" method="get" role="search" className="mb-3.5">
        <input type="hidden" name="sort" value={sort} />
        {genre && <input type="hidden" name="genre" value={genre} />}
        {status && <input type="hidden" name="status" value={status} />}
        <div className="mg-search">
          <div className="mg-sb">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              name="q"
              defaultValue={query}
              key={query}
              maxLength={80}
              placeholder="Поиск по названию или оригиналу…"
              aria-label="Поиск по каталогу манги"
            />
          </div>
          <button type="submit" className="mg-go">
            Найти
          </button>
          {query && (
            <Link href={qs({ page: 1, q: "" })} className="mg-reset">
              Сбросить
            </Link>
          )}
        </div>
      </form>

      {/* Фильтры: сортировка, статус и жанры — в стиле каталога аниме */}
      <div className="mg-filters mb-8">
        <div className="mg-top">
        <div className="mg-row">
          <span className="mg-lab">Статус</span>
          {STATUSES.map((option) => (
            <Link
              key={option.value || "any"}
              href={qs({ status: option.value, page: 1 })}
              aria-current={status === option.value ? "page" : undefined}
              className={status === option.value ? "on" : undefined}
            >
              {option.label}
            </Link>
          ))}
        </div>
        <div className="mg-row">
          <span className="mg-lab">Сортировка</span>
          {SORTS.map((option) => (
            <Link
              key={option.value}
              href={qs({ sort: option.value, page: 1 })}
              aria-current={sort === option.value ? "page" : undefined}
              className={sort === option.value ? "on" : undefined}
            >
              {option.label}
            </Link>
          ))}
        </div>
        </div>
        {genres.length > 0 && (
          <div className="mg-row mg-genres">
            <span className="mg-lab">Жанр</span>
            <Link href={qs({ genre: "", page: 1 })} className={!genre ? "on" : undefined}>
              Все
            </Link>
            {genres.slice(0, 40).map((item) => (
              <Link
                key={item.name}
                href={qs({ genre: item.name, page: 1 })}
                aria-current={genre === item.name ? "page" : undefined}
                className={genre === item.name ? "on" : undefined}
              >
                {item.name}
                <small>{item.count}</small>
              </Link>
            ))}
          </div>
        )}
      </div>

      {cards.length > 0 ? (
        <Reveal>
          <AnimeGrid cards={cards} />
        </Reveal>
      ) : query ? (
        <div className="rounded-2xl bg-white/4 px-4 py-12 text-center ring-1 ring-white/10">
          <p className="font-accent text-lg font-extrabold text-white">
            По запросу «{query}» ничего нет
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            В каталоге только тайтлы с русским переводом. Попробуй название без
            уточнения, оригинальное имя или сокращение — «Берсерк», «Berserk».
          </p>
          <Link
            href={qs({ page: 1 })}
            className="btn-ghost mt-5 inline-flex rounded-xl bg-white/6 px-5 py-2.5 text-sm font-semibold text-white/80 ring-1 ring-white/10 transition-colors hover:bg-white/12 hover:text-white"
          >
            Весь каталог
          </Link>
        </div>
      ) : (
        <p className="rounded-2xl bg-white/4 px-4 py-10 text-center text-sm text-muted ring-1 ring-white/10">
          Не удалось загрузить каталог. Обнови страницу через минуту.
        </p>
      )}

      {/* Постраничная навигация */}
      {cards.length > 0 && (page > 1 || hasMore) && (
        <nav className="mt-10 flex items-center justify-center gap-3" aria-label="Страницы каталога">
          {page > 1 ? (
            <Link
              href={qs({ page: page - 1 })}
              className="btn-ghost rounded-xl bg-white/6 px-5 py-2.5 text-sm font-semibold text-white/80 ring-1 ring-white/10 transition-colors hover:bg-white/12 hover:text-white"
            >
              ← Назад
            </Link>
          ) : null}
          <span className="text-sm tabular-nums text-muted">Страница {page}</span>
          {hasMore ? (
            <Link
              href={qs({ page: page + 1 })}
              className="btn-ghost rounded-xl bg-white/6 px-5 py-2.5 text-sm font-semibold text-white/80 ring-1 ring-white/10 transition-colors hover:bg-white/12 hover:text-white"
            >
              Вперёд →
            </Link>
          ) : null}
        </nav>
      )}
    </div>
    </div>
  );
}
