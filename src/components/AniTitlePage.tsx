import Link from "next/link";
import { notFound } from "next/navigation";
import { Poster } from "@/components/Poster";
import { AniWatch } from "@/components/AniWatch";
import { ReadMore } from "@/components/ReadMore";
import { formatRating, kindLabel, truncate } from "@/lib/anime";
import { aniAlias } from "@/lib/ani-fallback";
import { getRelease } from "@/lib/anilibria";

/** Страница тайтла из AniLiberty — для аниме, которых нет в Kodik */
export async function AniTitlePage({ id }: { id: string }) {
  const detail = await getRelease(aniAlias(id)).catch(() => null);
  if (!detail) notFound();
  const { card, episodes } = detail;
  const rating = formatRating(card.rating);
  const chips = [card.year, kindLabel(card.kind), episodes.length ? `${episodes.length} эп.` : null, rating ? `★ ${rating}` : null].filter(Boolean);

  return (
    <section className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10" aria-hidden>
        {card.poster && <Poster src={card.poster} alt="" priority sizes="100vw" className="scale-110 object-cover opacity-25 blur-3xl" />}
        <div className="absolute inset-0 bg-gradient-to-b from-ink/55 via-ink/90 to-ink" />
      </div>
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-8 sm:px-6 sm:pt-10">
        <div className="grid gap-7 md:grid-cols-[240px_minmax(0,1fr)] md:gap-9">
          <aside className="mx-auto w-full max-w-[240px] md:mx-0">
            <div className="relative aspect-[2/3] overflow-hidden rounded-3xl bg-card ring-1 ring-white/12">
              <Poster src={card.poster} alt={card.title} title={card.title} priority sizes="240px" className="object-cover" />
            </div>
          </aside>
          <div className="min-w-0 space-y-4">
            <div>
              <p className="mb-2 inline-flex rounded-full bg-white/[0.06] px-3 py-1 text-xs font-semibold text-white/70 ring-1 ring-white/10">Источник: AniLiberty</p>
              <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">{card.title}</h1>
              {card.titleOrig && card.titleOrig !== card.title && <p className="mt-1 text-sm font-semibold text-white/55">{card.titleOrig}</p>}
            </div>
            {chips.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {chips.map((c) => (
                  <span key={String(c)} className="inline-flex items-center rounded-xl bg-white/[0.05] px-3.5 py-2 text-sm font-bold tabular-nums text-white/85 ring-1 ring-white/[0.09]">
                    {c}
                  </span>
                ))}
              </div>
            )}
            {card.description && <ReadMore text={truncate(card.description, 1200) ?? card.description} />}
          </div>
        </div>

        <div className="mt-8">
          {episodes.length ? (
            <AniWatch
              id={card.id ? `ani-${card.alias}` : id}
              alias={card.alias}
              title={card.title}
              titleOrig={card.titleOrig}
              year={card.year}
              malId={card.shikimoriId}
              episodes={episodes.map((e) => ({ number: e.number, name: e.name }))}
            />
          ) : (
            <p className="rounded-2xl bg-white/[0.04] p-6 text-white/70 ring-1 ring-white/10">
              Серии этого тайтла пока недоступны. <Link href="/catalog" className="text-accent underline">Вернуться в каталог</Link>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
