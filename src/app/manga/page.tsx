import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { AnimeGrid } from "@/components/AnimeRow";
import { Reveal } from "@/components/Reveal";
import { mangaCatalogPage, type MangaSort } from "@/lib/senku";

export const metadata: Metadata = {
  title: "Каталог манги",
  description:
    "Каталог манги, манхвы и маньхуа с русским переводом: свежие тайтлы, топ по рейтингу и чтение прямо на сайте.",
};

/** Данные источника меняются медленно — кэшируем страницу на 10 минут */
export const revalidate = 600;

interface PageProps {
  searchParams: Promise<{ sort?: string; page?: string; q?: string }>;
}

const SORTS: { value: MangaSort; label: string }[] = [
  { value: "hot", label: "Горячие новинки" },
  { value: "best", label: "Лучшее" },
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
  const sort: MangaSort = sp.sort === "best" ? "best" : "hot";
  // Запрос держим в URL: ссылку с поиском можно переслать, кнопка «назад»
  // возвращает к прежнему запросу, а страницы не теряют фильтр
  const query = (sp.q ?? "").slice(0, 80);

  // Смещение берём постранично: MangaDex отдаёт максимум 100 тайтлов,
  // поэтому на третьей странице он закончится — покажем «дальше нет»
  const rawPage = Number(sp.page ?? 1);
  const page = Number.isFinite(rawPage) && rawPage > 1 ? Math.floor(rawPage) : 1;
  const offset = (page - 1) * PER_PAGE;

  const { cards, hasMore, total } = await mangaCatalogPage(sort, offset, PER_PAGE, query).catch(() => ({
    cards: [],
    hasMore: false,
    total: 0,
  }));

  const shownFrom = offset + 1;
  const shownTo = offset + cards.length;
  // Ссылки сортировки и страниц должны сохранять запрос, иначе любой клик
  // по сортировке молча сбрасывал бы поиск
  const qs = (patch: Record<string, string | number>) => {
    const params = new URLSearchParams();
    params.set("sort", sort);
    if (query) params.set("q", query);
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
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs items={[{ label: "Манга" }]} />

      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          {query ? `Поиск: ${query}` : "Каталог манги"}
        </h1>
        <p className="mt-1.5 text-sm text-muted">
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
              {cards.length} тайтлов с русским переводом — читается прямо на сайте
            </>
          ) : (
            "Каталог временно недоступен — попробуйте позже"
          )}
        </p>
      </div>

      {/* Поиск: обычная форма без JS, поэтому работает и с отключённым скриптом */}
      <form action="/manga" method="get" role="search" className="mb-6">
        <input type="hidden" name="sort" value={sort} />
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 basis-52">
            <svg
              viewBox="0 0 24 24"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
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
              className="w-full rounded-xl bg-white/6 py-3 pl-10 pr-3 text-sm font-semibold text-white ring-1 ring-white/10 transition placeholder:text-muted/70 focus:outline-none focus:ring-accent/60"
            />
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <button
              type="submit"
              className="btn-primary flex-1 rounded-xl px-5 py-3 text-sm font-bold text-white sm:flex-none"
            >
              Найти
            </button>
            {query && (
              <Link
                href={qs({ page: 1, q: "" })}
                className="btn-ghost flex-1 rounded-xl bg-white/6 px-4 py-3 text-sm font-semibold text-white/80 ring-1 ring-white/10 transition-colors hover:bg-white/12 hover:text-white sm:flex-none"
              >
                Сбросить
              </Link>
            )}
          </div>
        </div>
      </form>

      {/* Сортировка */}
      <div className="mb-8 flex flex-wrap items-center gap-2">
        {SORTS.map((option) => {
          const active = sort === option.value;
          return (
            <Link
              key={option.value}
              href={qs({ sort: option.value, page: 1 })}
              aria-current={active ? "page" : undefined}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ring-1 transition-colors ${
                active
                  ? "bg-accent/20 text-white ring-accent/50"
                  : "bg-white/6 text-muted ring-white/10 hover:bg-white/12 hover:text-white"
              }`}
            >
              {option.label}
            </Link>
          );
        })}
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
  );
}