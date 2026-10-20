import type { AnimeCard } from "./types";

/** Одно совпадение кадра: то, что отдаёт поиск по кадру клиенту */
export interface FrameMatch {
  /** Похожесть 0…1 */
  similarity: number;
  episode: number | null;
  /** Секунды от начала серии: начало и конец найденной сцены */
  from: number;
  to: number;
  at: number;
  /** Превью-кадр и короткий клип сцены (адреса trace.moe) */
  image: string;
  video: string;
  /** Названия из AniList */
  names: { native?: string; romaji?: string; english?: string };
  malId: number | null;
  /** Тот же тайтл в каталоге сайта — если нашёлся */
  card: AnimeCard | null;
}

export interface FrameResult {
  matches: FrameMatch[];
}
