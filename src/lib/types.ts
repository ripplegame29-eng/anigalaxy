/**
 * Типы данных Kodik API + денормализованные модели для UI.
 *
 * «Сырые» типы (Kodik*) повторяют структуру ответов kodik-api.com,
 * а модели (AnimeCard, TitleDetail) — то, что реально рендерит интерфейс.
 */

/* ------------------------------------------------------------------ */
/* Сырые ответы Kodik                                                   */
/* ------------------------------------------------------------------ */

export type KodikMediaType = "anime" | "anime-serial" | string;

export type AnimeKind = "tv" | "movie" | "ova" | "ona" | "special" | "music" | string;
export type AnimeStatus = "anons" | "ongoing" | "released" | string;

export interface KodikTranslation {
  id: number;
  title: string;
  type: "voice" | "subtitles";
}

/** Данные о тайтле, приходящие при `with_material_data=1` */
export interface MaterialData {
  title?: string;
  anime_title?: string;
  title_en?: string;
  other_titles?: string[];
  other_titles_en?: string[];
  other_titles_jp?: string[];
  anime_kind?: AnimeKind;
  anime_status?: AnimeStatus;
  all_status?: AnimeStatus;
  year?: number;
  description?: string;
  anime_description?: string;
  poster_url?: string;
  anime_poster_url?: string;
  duration?: number;
  countries?: string[];
  /** Кадры Shikimori — то же, что отдаёт публичный API, но уже в ответе Kodik */
  screenshots?: string[];
  genres?: string[];
  anime_genres?: string[];
  all_genres?: string[];
  anime_studios?: string[];
  anime_licensed_by?: string[];
  kinopoisk_rating?: number;
  kinopoisk_votes?: number;
  imdb_rating?: number;
  imdb_votes?: number;
  shikimori_rating?: number;
  shikimori_votes?: number;
  rating_mpaa?: string;
  minimal_age?: number;
  episodes_total?: number;
  episodes_aired?: number;
  premiere_world?: string;
  aired_at?: string;
}

export interface KodikEpisodeObject {
  title?: string;
  link: string;
  screenshots?: string[];
}

export interface KodikSeason {
  link: string;
  title?: string;
  episodes?: Record<string, KodikEpisodeObject | string>;
}

/** Сезоны вида { "1": { link, episodes: {...} } } */
export type KodikSeasonsMap = Record<string, KodikSeason>;

export interface KodikResult {
  id: string;
  type: KodikMediaType;
  link: string;
  title: string;
  title_orig?: string;
  other_title?: string;
  year?: number;
  quality?: string;
  translation?: KodikTranslation;
  last_season?: number;
  last_episode?: number;
  episodes_count?: number;
  seasons?: KodikSeasonsMap;
  blocked_countries?: string[];
  blocked_seasons?: "all" | Record<string, string[]> | null;
  /** id тайтла на Shikimori — ключ к кадрам, франшизе и трейлерам */
  shikimori_id?: number | string;
  kinopoisk_id?: number | string;
  imdb_id?: string;
  screenshots?: string[];
  material_data?: MaterialData;
}

export interface KodikSearchResponse {
  time: string;
  total: number;
  results: KodikResult[];
}

export interface KodikListResponse extends KodikSearchResponse {
  prev_page: string | null;
  next_page: string | null;
}

/* ------------------------------------------------------------------ */
/* Модели для UI                                                        */
/* ------------------------------------------------------------------ */

/** Карточка тайтла — всё, что нужно сетке/слайдеру */
export interface AnimeCard {
  id: string;
  title: string;
  titleOrig?: string;
  otherTitles?: string[];
  year?: number;
  poster?: string;
  /** Основной рейтинг: сначала Shikimori, затем Кинопоиск, затем IMDb */
  rating?: number;
  ratingVotes?: number;
  ratingSource?: "shikimori" | "kinopoisk" | "imdb";
  kind?: AnimeKind;
  status?: AnimeStatus;
  genres: string[];
  studios?: string[];
  /** Номер последней доступной серии */
  lastEpisode?: number;
  /** Для манги: сколько глав доступно на русском */
  chapterCount?: number;
  episodesTotal?: number;
  episodesAired?: number;
  translation?: string;
  description?: string;
  screenshots?: string[];
  duration?: number;
  /**
   * Ссылка страницы плеера Kodik для ЭТОГО тайтла (`//kodikplayer.com/...`).
   */
  playerLink?: string;
  /**
   * id на Shikimori (`shikimori_id` из Kodik). Через него страница тайтла
   * тянет кадры, хронологию франшизы и трейлеры с YouTube.
   */
  shikimoriId?: number;
  /**
   * Локальный фоновый ролик hero для ЭТОГО тайтла (`/video/*.mp4`).
   * Кладётся вручную в `page.tsx` рядом с id — так видео гарантированно
   * соответствует своему слайду, даже если часть тайтлов отфильтруется.
   */
  heroVideo?: string;
  /** Источник — манга (Senku/InkStory и т.п.), а не аниме Kodik */
  manga?: boolean;
}

/** Озвучка (студия перевода), найденная на странице плеера Kodik */
export interface TranslationOption {
  /** id перевода в Kodik или отрицательный синтетический id альтернативы */
  id: number;
  title: string;
  type: "voice" | "subtitles";
  /** id материала, в котором зашита эта озвучка (напр. serial-75157) */
  mediaId: string;
  /** Сколько серий доступно в этой озвучке */
  episodeCount?: number;
  /** Выбрана ли сейчас (для первого рендера) */
  current?: boolean;
  /** Откуда дорожка: Kodik (не задано), AniLiberty, CVH или SameBand */
  provider?: "anilibria" | "cvh" | "sameband" | "aniboom";
  /** Название студии внутри CVH (для резолва серии) */
  studio?: string;
  /** Страница тайтла SameBand (для резолва серий) */
  url?: string;
  /** Максимальное качество дорожки (720 у Kodik, 1080 у остальных) */
  quality?: number;
  /** Дорожки той же студии из других источников — запасные, если эта не играет */
  fallbacks?: TranslationOption[];
}

/** Озвучка CVH: сколько серий ею закрыто в плейлисте */
export interface CvhStudio {
  name: string;
  episodes: number;
  seasons: number[];
  /** Дорожка помечена как субтитры, а не голос */
  subtitles: boolean;
}

/** Сгруппированный плейлист CVH — ответ `/api/cvh/playlist` */
export interface CvhPlaylist {
  shikimori: string;
  seasons: number[];
  episodesTotal: number;
  studios: CvhStudio[];
}

/** Совпадение тайтла на SameBand (по названию и году) */
export interface SameBandMatch {
  url: string;
  title: string;
  poster?: string;
  year?: number;
  description?: string;
}

/** Одна дорожка AniBoom, найденная на странице плеера AnimeGO */
export interface AniBoomVoice {
  label: string;
  translationId: number;
  /** Embed-URL AniBoom; в нём уже есть токен видео и translation */
  embed: string;
}

/** Подтверждённый тайтл AnimeGO + его дорожки AniBoom */
export interface AniBoomMatch {
  animeId: string;
  title: string;
  year?: number;
  episodesTotal?: number;
  voices: AniBoomVoice[];
}

export interface EpisodeRef {
  number: number;
  link: string;
  title?: string;
}

export interface SeasonRef {
  number: number;
  title?: string;
  episodes: EpisodeRef[];
}

/** Полная модель страницы просмотра */
export interface TitleDetail {
  card: AnimeCard;
  /** true — сериал (есть серии), false — фильм */
  isSerial: boolean;
  seasons: SeasonRef[];
  /** Резервная ссылка плеера (если серии не пришли) */
  playerLink?: string;
  /** Доступные озвучки (заполняется на сервере страницы) */
  translations?: TranslationOption[];
}

/** Параметры каталога, приходящие из URL */
export interface CatalogQuery {
  q?: string;
  type?: "all" | "serial" | "movie";
  kind?: string;
  status?: string;
  genre?: string;
  yearFrom?: number;
  yearTo?: number;
  sort?: string;
  cursor?: string;
}
