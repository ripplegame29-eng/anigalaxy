import { AniTitleClient } from "@/components/AniTitleClient";
import { AniTitleView } from "@/components/AniTitleView";
import { aniAlias } from "@/lib/ani-fallback";
import { getRelease } from "@/lib/anilibria";
import { similar } from "@/lib/kodik";
import { screenshots as shikimoriScreenshots, trailer as shikimoriTrailer, nextEpisode as shikimoriNextEpisode } from "@/lib/shikimori";

/**
 * Страница тайтла из AniLiberty — для аниме, которых нет в Kodik.
 * Данные собирает сервер; раскладка — в `AniTitleView`.
 */
export async function AniTitlePage({ id }: { id: string }) {
  const detail = await getRelease(aniAlias(id)).catch(() => null);
  // Сервер релиз не увидел (AniLiberty скрывает часть тайтлов от дата-центров): пусть спросит браузер зрителя
  if (!detail) return <AniTitleClient id={id} alias={aniAlias(id)} />;
  const card = { ...detail.card, id };

  const [shots, trailer, upcoming, similarCards] = await Promise.all([
    shikimoriScreenshots(card.shikimoriId).catch(() => []),
    shikimoriTrailer(card.shikimoriId, card.title).catch(() => null),
    shikimoriNextEpisode(card.shikimoriId).catch(() => null),
    card.genres.length ? similar(card).catch(() => []) : Promise.resolve([]),
  ]);

  return <AniTitleView id={id} detail={detail} extras={{ shots, trailer, upcoming, similar: similarCards }} />;
}
