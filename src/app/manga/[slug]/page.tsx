import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Poster } from "@/components/Poster";
import { Reveal } from "@/components/Reveal";
import { TitleActions } from "@/components/TitleActions";
import { mangaDetail } from "@/lib/senku";

/** Данные тайтла кэшируются на 15 минут */
export const revalidate = 900;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const detail = await mangaDetail(slug).catch(() => null);
  if (!detail) return { title: "Манга не найдена" };
  return {
    title: `${detail.title} — читать мангу онлайн`,
    description:
      detail.description?.slice(0, 160) ??
      `${detail.title}: описание, жанры и ${detail.chapters.length} глав с русским переводом.`,
  };
}

/** «Глава 12» / «Глава 7.5» / «Без номера» */
function chapterLabel(chapter: { chapter: string }): string {
  return chapter.chapter ? `Глава ${chapter.chapter}` : "Без номера";
}

export default async function MangaTitlePage({ params }: PageProps) {
  const { slug } = await params;
  const detail = await mangaDetail(slug).catch(() => null);
  if (!detail) notFound();

  const chapters = detail.chapters;
  // Читают с последней главы, поэтому показываем новые сверху
  const byNewest = [...chapters].reverse();
  const first = chapters[0];
  const last = chapters[chapters.length - 1];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs items={[{ label: "Манга", href: "/manga" }, { label: detail.title }]} />

      <div className="grid gap-6 md:grid-cols-[280px_minmax(0,1fr)] md:gap-8 lg:grid-cols-[330px_minmax(0,1fr)]">
        {/* Обложка */}
        <div className="w-[170px] sm:w-[210px] md:w-full">
          <div className="group relative aspect-[2/3] overflow-hidden rounded-2xl bg-card ring-1 ring-white/12 shadow-[0_40px_90px_-40px_rgba(0,0,0,1)] transition duration-300 hover:ring-accent/45">
            <Poster
              src={detail.poster}
              alt={detail.title}
              title={detail.title}
              priority
              sizes="(max-width: 768px) 210px, (max-width: 1024px) 280px, 330px"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.06]"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink via-ink/35 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          </div>

          {/* Чтение — только на сайте, без переходов на сторонние ресурсы */}
          <div className="mt-4 flex flex-col gap-2 max-sm:w-[calc(100vw-2rem)]">
            {last && (
              <Link
                href={`/manga/${detail.id}/read/${last.id}`}
                className="btn-primary flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                  <path d="M6 4.5v15l12-7.5-12-7.5Z" />
                </svg>
                Читать с последней
              </Link>
            )}
            {first && first.id !== last?.id && (
              <Link
                href={`/manga/${detail.id}/read/${first.id}`}
                className="btn-ghost flex items-center justify-center rounded-xl bg-white/6 px-4 py-2.5 text-sm font-semibold text-white/80 ring-1 ring-white/10 transition-colors hover:bg-white/12 hover:text-white"
              >
                С первой главы
              </Link>
            )}
          </div>

          {/* Избранное, подборки, «читать потом» и оценка — как у аниме */}
          <div className="mt-3 max-sm:w-[calc(100vw-2rem)]">
            <TitleActions
              manga
              anime={{
                id: detail.id,
                title: detail.title,
                poster: detail.poster,
                genres: detail.genres,
                year: detail.year,
                rating: detail.rating,
              }}
            />
          </div>
        </div>

        {/* Шапка тайтла */}
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {detail.year && (
              <span className="rounded-md bg-white/8 px-2.5 py-1 text-xs font-semibold text-white/75 ring-1 ring-white/10">
                {detail.year}
              </span>
            )}
            {chapters.length > 0 && (
              <span className="rounded-md bg-white/8 px-2.5 py-1 text-xs font-semibold text-white/75 ring-1 ring-white/10">
                {detail.chaptersTotal} {detail.chaptersTotal === 1 ? "глава" : "глав"}
              </span>
            )}
            {detail.follows ? (
              <span className="rounded-md bg-white/8 px-2.5 py-1 text-xs font-semibold text-white/75 ring-1 ring-white/10">
                {detail.follows.toLocaleString("ru-RU")} в избранном
              </span>
            ) : null}
          </div>

          <h1 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            <span className="text-gradient">{detail.title}</span>
          </h1>

          {detail.titleOrig && detail.titleOrig !== detail.title && (
            <p className="mt-2 text-sm text-muted">{detail.titleOrig}</p>
          )}

          {detail.rating ? (
            <div className="mt-5 inline-flex items-center gap-3 rounded-2xl bg-white/6 px-4 py-3 ring-1 ring-white/10">
              <span className="text-3xl font-extrabold tabular-nums text-gold">
                {detail.rating.toFixed(2)}
              </span>
              <span className="text-xs leading-tight text-muted">
                Рейтинг сообщества
                {detail.follows ? (
                  <>
                    <br />
                    {detail.follows.toLocaleString("ru-RU")} читателей
                  </>
                ) : null}
              </span>
            </div>
          ) : null}

          {detail.genres.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {detail.genres.map((genre) => (
                <span
                  key={genre}
                  className="rounded-lg bg-white/6 px-3 py-1.5 text-xs font-semibold text-white/70 ring-1 ring-white/10"
                >
                  {genre}
                </span>
              ))}
            </div>
          )}

          {detail.description && (
            <p className="mt-5 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-bright/75">
              {detail.description}
            </p>
          )}
        </div>
      </div>

      {/* Главы */}
      <Reveal className="mt-10">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-extrabold tracking-tight sm:text-xl">Главы</h2>
          {detail.chaptersTotal > chapters.length && (
            <span className="text-xs text-muted">
              показаны первые {chapters.length} из {detail.chaptersTotal}
            </span>
          )}
        </div>

        {chapters.length === 0 ? (
          <p className="rounded-2xl bg-white/4 px-4 py-6 text-sm text-muted ring-1 ring-white/10">
            На русский язык глав пока нет. Загляни позже — перевод появляется регулярно.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {byNewest.map((chapter) => (
              <li key={chapter.id}>
                <Link
                  href={`/manga/${detail.id}/read/${chapter.id}`}
                  className="flex items-center gap-3 rounded-xl bg-white/4 px-4 py-3 ring-1 ring-white/10 transition-colors hover:bg-accent/12 hover:ring-accent/40"
                >
                  <span className="w-[86px] shrink-0 text-sm font-semibold text-white/85">
                    {chapterLabel(chapter)}
                  </span>
                  {chapter.title && (
                    <span className="min-w-0 flex-1 truncate text-xs text-muted">
                      {chapter.title}
                    </span>
                  )}
                  {chapter.pages ? (
                    <span className="ml-auto shrink-0 text-xs tabular-nums text-muted">
                      {chapter.pages} стр.
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Reveal>
    </div>
  );
}