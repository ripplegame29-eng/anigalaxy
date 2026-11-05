/**
 * Превью песен из opening'ов через iTunes Search API.
 *
 * Нужно для режима квиза «Угадай тайтл по песне из opening'а»: сам OP-ролик
 * на YouTube содержит видео (а на превью часто и название тайтла), а iTunes
 * отдаёт чистый 30-секундный аудиофрагмент без картинки. Ключ API не нужен.
 *
 * Поиск идёт по названию песни и исполнителю, которые мы разобрали из подписи
 * ролика Shikimori (`OP1 «Yuusha» — YOASOBI`). Результат кэшируется на сутки:
 * треки не меняются, а лимит запросов у Apple небольшой.
 */
import "server-only";

const MINUTE = 60_000;
const TTL = 24 * 60 * MINUTE;

interface ItunesSong {
  trackName?: string;
  artistName?: string;
  previewUrl?: string;
}

const cache = new Map<string, { at: number; value: string | null }>();

/** Нормализация для сравнения: регистр, пунктуация, хвосты в скобках */
function norm(value: string): string {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Одна попытка поиска в iTunes; возвращает лучший previewUrl или null */
async function search(term: string, song: string, artist?: string): Promise<string | null> {
  const res = await fetch(
    `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=8`,
    {
      headers: { "User-Agent": "AniGalaxy/1.0 (+https://anigalaxy)" },
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    },
  );
  if (!res.ok) return null;

  const data = (await res.json()) as { results?: ItunesSong[] };
  const wantedSong = norm(song);
  const wantedArtist = artist ? norm(artist) : "";

  const ranked = (data.results ?? [])
    .filter((row) => row.previewUrl)
    .map((row) => {
      const track = norm(row.trackName ?? "");
      const by = norm(row.artistName ?? "");
      let score = 0;

      if (track === wantedSong) score += 4;
      else if (track.includes(wantedSong) || wantedSong.includes(track)) score += 2;

      if (wantedArtist && (by === wantedArtist || by.includes(wantedArtist))) score += 3;

      // Караоке и каверы узнаются хуже оригинала — пусть уходят вниз
      if (/karaoke|караоке|cover|instrumental|nightcore|8d/i.test(row.trackName ?? "")) {
        score -= 5;
      }
      return { row, score };
    })
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best || best.score <= 0) return null;
  return best.row.previewUrl ?? null;
}

/**
 * 30-секундное превью песни. Сначала ищем «песня + исполнитель», затем —
 * только по названию песни: исполнитель в подписи бывает на русском.
 */
export async function songPreview(song: string, artist?: string): Promise<string | null> {
  const title = song.trim();
  if (!title) return null;

  const key = `itunes:${norm(title)}|${norm(artist ?? "")}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;

  let value: string | null = null;
  try {
    value = await search([title, artist].filter(Boolean).join(" "), title, artist);
    if (!value) value = await search(title, title);
  } catch {
    value = null;
  }

  if (cache.size > 500) cache.clear();
  cache.set(key, { at: Date.now(), value });
  return value;
}
