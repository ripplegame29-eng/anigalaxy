"use client";

import { useState } from "react";
import { AltPlayer } from "./AltPlayer";

/**
 * Просмотр тайтла, которого нет в Kodik: потоки и серии берёт AniLiberty.
 * Тот же плеер, что и на обычной странице (качество, скорость, позиции).
 */
export function AniWatch({
  id,
  alias,
  title,
  titleOrig,
  year,
  malId,
  episodes,
}: {
  id: string;
  alias: string;
  title: string;
  titleOrig?: string;
  year?: number;
  malId?: number;
  episodes: { number: number; name?: string }[];
}) {
  const [episode, setEpisode] = useState(episodes[0]?.number ?? 1);
  const idx = episodes.findIndex((e) => e.number === episode);
  const hasNext = idx >= 0 && idx + 1 < episodes.length;

  return (
    <section id="watch" className="scroll-mt-24 space-y-4">
      <div className="wb-shell relative aspect-video w-full overflow-hidden rounded-2xl bg-black ring-1 ring-white/12 shadow-[0_40px_80px_-40px_rgba(0,0,0,1)]">
        <AltPlayer
          key={`${id}:${episode}`}
          query={title}
          altQuery={titleOrig}
          year={year}
          episode={episode}
          titleId={id}
          backend="anilibria"
          alias={alias}
          malId={malId}
          onBack={() => undefined}
          hasNext={hasNext}
          onNextEpisode={() => {
            if (hasNext) setEpisode(episodes[idx + 1].number);
          }}
        />
      </div>

      {episodes.length > 1 && (
        <div>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-[0.08em] text-muted">Серии</h2>
          <div className="flex flex-wrap gap-2">
            {episodes.map((e) => (
              <button
                key={e.number}
                type="button"
                onClick={() => setEpisode(e.number)}
                aria-pressed={e.number === episode}
                title={e.name}
                className={`min-h-11 min-w-11 rounded-xl px-3 text-sm font-bold tabular-nums ring-1 transition ${
                  e.number === episode ? "bg-accent text-white ring-accent" : "bg-white/[0.05] text-white/80 ring-white/10 hover:bg-white/[0.1]"
                }`}
              >
                {e.number}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
