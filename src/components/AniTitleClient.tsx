"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Poster } from "@/components/Poster";
import { ReadMore } from "@/components/ReadMore";
import { WatchBox } from "@/components/WatchBox";
import { WatchButton } from "@/components/WatchButton";
import { TitleActions } from "@/components/TitleActions";
import { CommentsBlock } from "@/components/comments/CommentsBlock";
import { fetchReleaseInBrowser } from "@/lib/anilibria-browser";
import type { AniTitleDetail } from "@/lib/anilibria-map";
import { formatRating, kindLabel, statusLabel, statusTone } from "@/lib/anime";

/**
 * Страница тайтла AniLiberty, который сервер не увидел: AniLiberty скрывает часть
 * релизов от адресов дата-центров, а из браузера зрителя они открываются.
 * Данные и серии запрашиваем прямо здесь; раскладка та же, что у обычной страницы
 * (шапка, описание, плеер с выбором озвучек, комментарии).
 */
export function AniTitleClient({ id, alias }: { id: string; alias: string }) {
  const [detail, setDetail] = useState<AniTitleDetail | null | undefined>(undefined);

  useEffect(() => {
    const ctrl = new AbortController();
    void fetchReleaseInBrowser(alias, ctrl.signal).then((d) => {
      if (!ctrl.signal.aborted) setDetail(d);
    });
    return () => ctrl.abort();
  }, [alias]);

  if (detail === undefined) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-24 text-center text-sm text-white/60 sm:px-6" role="status">
        Загружаем тайтл…
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
        <h1 className="font-display text-2xl font-extrabold text-white">Такой страницы не существует</h1>
        <p className="mt-3 text-white/60">Тайтл не найден. Загляните в каталог — там больше тридцати тысяч аниме.</p>
        <Link href="/catalog" className="mt-6 inline-flex rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white">
          Открыть каталог
        </Link>
      </div>
    );
  }

  const card = { ...detail.card, id };
  const rating = formatRating(card.rating);
  const { episodes } = detail;

  return (
    <>
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10" aria-hidden>
          {card.poster && <Poster src={card.poster} alt="" priority sizes="100vw" className="scale-110 object-cover opacity-25 blur-3xl" />}
          <div className="absolute inset-0 bg-gradient-to-b from-ink/55 via-ink/90 to-ink" />
        </div>
        <div className="mx-auto max-w-7xl px-4 pb-8 pt-8 sm:px-6 sm:pb-10 sm:pt-10">
          <div className="grid gap-7 md:grid-cols-[260px_minmax(0,1fr)] md:gap-9 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-12">
            <aside className="mx-auto w-full max-w-[460px] space-y-3 md:mx-0 md:max-w-none">
              <div className="relative mx-auto aspect-[2/3] w-[210px] overflow-hidden rounded-3xl bg-card shadow-[0_40px_90px_-40px_rgba(0,0,0,1)] ring-1 ring-white/12 sm:w-[240px] md:w-full">
                <Poster src={card.poster} alt={card.title} title={card.title} priority sizes="(max-width: 768px) 240px, 320px" className="object-cover" />
              </div>
              <WatchButton id={card.id} />
              <TitleActions anime={{ id: card.id, title: card.title, poster: card.poster, genres: card.genres, year: card.year, rating: card.rating, episodesTotal: card.episodesTotal }} />
            </aside>
            <div className="min-w-0">
              <div className="mb-4 flex flex-wrap items-center gap-2.5 text-xs font-bold uppercase tracking-[0.14em]">
                {statusLabel(card.status) && (
                  <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 ring-1 backdrop-blur ${statusTone(card.status)}`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_8px_currentColor]" />
                    {statusLabel(card.status)}
                  </span>
                )}
                {kindLabel(card.kind) && <span className="text-muted">{kindLabel(card.kind)}</span>}
              </div>
              <h1 className="font-display text-[clamp(30px,5vw,58px)] font-extrabold leading-[1.05] tracking-[-0.035em] text-white">{card.title}</h1>
              {card.titleOrig && card.titleOrig !== card.title && <p className="mt-3 text-lg font-semibold text-white/60 sm:text-xl">{card.titleOrig}</p>}
              <div className="mt-6 flex flex-wrap items-center gap-2 text-sm font-bold text-white/85">
                {rating && <span className="rounded-xl bg-accent/12 px-3.5 py-2 ring-1 ring-accent/35">★ {rating}</span>}
                {card.year && <span className="rounded-xl bg-white/[0.05] px-3.5 py-2 ring-1 ring-white/[0.09]">{card.year}</span>}
                {episodes.length > 0 && <span className="rounded-xl bg-white/[0.05] px-3.5 py-2 ring-1 ring-white/[0.09]">{episodes.length} эп.</span>}
              </div>
              {card.genres.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {card.genres.slice(0, 8).map((genre) => (
                    <Link key={genre} href={`/catalog?genre=${encodeURIComponent(genre)}`} className="rounded-full bg-white/[0.05] px-3.5 py-1.5 text-[13px] font-semibold text-white/80 ring-1 ring-white/[0.09] transition hover:bg-accent/15 hover:text-white">
                      {genre}
                    </Link>
                  ))}
                </div>
              )}
              {card.description && (
                <div className="mt-7 max-w-3xl border-t border-white/[0.07] pt-6">
                  <ReadMore text={card.description} />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-4 flex items-center gap-3">
          <span className="h-6 w-1.5 rounded-full bg-accent" />
          <h2 className="text-lg font-extrabold tracking-tight sm:text-xl">Смотреть онлайн</h2>
        </div>
        {episodes.length ? (
          <WatchBox
            initialDetail={{
              card,
              isSerial: true,
              seasons: [{ number: 1, episodes: episodes.map((e) => ({ number: e.number, link: "", title: e.name })) }],
            }}
            translations={[]}
            aniStart={{ alias: card.alias, episodesTotal: card.episodesTotal ?? null }}
          />
        ) : (
          <p className="rounded-2xl bg-white/[0.04] p-6 text-white/70 ring-1 ring-white/10">Серии этого тайтла пока недоступны.</p>
        )}
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-8 sm:px-6">
        <CommentsBlock scope={{ kind: "title", titleId: card.id }} />
      </div>
    </>
  );
}
