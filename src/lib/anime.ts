import type {
  AnimeCard,
  AnimeKind,
  AnimeStatus,
  KodikResult,
} from "./types";

/* ------------------------------------------------------------------ */
/* Нормализация: сырой ответ Kodik -> модель карточки                   */
/* ------------------------------------------------------------------ */

/**
 * Превращает элемент ответа Kodik в модель карточки для UI.
 * Выбирает лучший доступный рейтинг и постер.
 */
export function toCard(r: KodikResult): AnimeCard {
  const m = r.material_data;

  // Рейтинг: для аниме приоритет у Shikimori, затем Кинопоиск, затем IMDb
  const rating =
    m?.shikimori_rating ?? m?.kinopoisk_rating ?? m?.imdb_rating;
  const ratingVotes =
    m?.shikimori_votes ?? m?.kinopoisk_votes ?? m?.imdb_votes;
  const ratingSource: AnimeCard["ratingSource"] = m?.shikimori_rating
    ? "shikimori"
    : m?.kinopoisk_rating
      ? "kinopoisk"
      : m?.imdb_rating
        ? "imdb"
        : undefined;

  const lastEpisode = r.last_episode ?? m?.episodes_aired;

  // id на Shikimori приходит строкой или числом — приводим к number
  const shikimoriId = Number(r.shikimori_id);
  const screenshots = [
    ...(r.screenshots ?? []),
    // Те же кадры Shikimori, что уже лежат в material_data — идут запасным
    // слоем, если публичный API Shikimori вдруг недоступен
    ...(m?.screenshots ?? []),
  ].filter((url, i, all) => all.indexOf(url) === i);

  return {
    id: r.id,
    title: m?.anime_title || m?.title || r.title,
    titleOrig: m?.title_en || r.title_orig,
    otherTitles: [...(m?.other_titles ?? []), ...(m?.other_titles_en ?? [])],
    year: r.year ?? m?.year,
    // Нет постера у Kodik — берём обложку Shikimori по id, а если и её нет — первый кадр
    poster:
      m?.anime_poster_url ||
      m?.poster_url ||
      (Number.isFinite(shikimoriId) && shikimoriId > 0 ? shikimoriPoster(shikimoriId) : undefined) ||
      screenshots[0],
    rating,
    ratingVotes,
    ratingSource,
    kind: m?.anime_kind,
    status: m?.anime_status ?? m?.all_status,
    genres: (m?.anime_genres?.length ? m.anime_genres : m?.genres ?? []).slice(),
    studios: m?.anime_studios?.slice(),
    lastEpisode,
    episodesTotal: m?.episodes_total ?? r.episodes_count,
    episodesAired: m?.episodes_aired,
    translation: r.translation?.title,
    description: m?.anime_description || m?.description,
    screenshots: screenshots.slice(0, 10),
    duration: m?.duration,
    shikimoriId: Number.isFinite(shikimoriId) && shikimoriId > 0 ? shikimoriId : undefined,
    // Ссылка плеера этого же тайтла — фоновое видео hero привязывается к ней
    playerLink: absoluteUrl(r.link),
  };
}

/** Обложка Shikimori по id: запасной источник, когда у Kodik нет картинки */
export function shikimoriPoster(id: number | string): string {
  return `https://shikimori.one/system/animes/original/${id}.jpg`;
}

/** Несколько карточек разом */
export function toCards(results: KodikResult[] = []): AnimeCard[] {
  return results.map(toCard);
}

/* ------------------------------------------------------------------ */
/* Дедупликация                                                        */
/* ------------------------------------------------------------------ */

/**
 * Kodik отдаёт один и тот же тайтл несколькими material-id
 * (по id на каждую озвучку/качество) — при сортировке по рейтингу
 * первая страница может состоять из 24 дублей одного аниме.
 *
 * Ключ ниже склеивает такие записи: название + год + формат.
 */
export function cardKey(card: Pick<AnimeCard, "title" | "year" | "kind">): string {
  const title = (card.title ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  return `${title}|${card.year ?? ""}|${card.kind ?? ""}`;
}

/** Убирает дубли, сохраняя первый (самый «свежий» по сортировке) вариант */
export function dedupeCards(cards: AnimeCard[]): AnimeCard[] {
  const seen = new Set<string>();
  const out: AnimeCard[] = [];
  for (const card of cards) {
    const key = cardKey(card);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(card);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Человекочитаемые подписи                                             */
/* ------------------------------------------------------------------ */

export const KIND_LABELS: Record<string, string> = {
  tv: "ТВ Сериал",
  movie: "Фильм",
  ova: "OVA",
  ona: "ONA",
  special: "Спешл",
  tv_special: "Спешл",
  music: "Клип",
  tv_13: "ТВ",
  tv_24: "ТВ",
  tv_48: "ТВ",
};

export const STATUS_LABELS: Record<AnimeStatus, string> = {
  ongoing: "Онгоинг",
  released: "Завершён",
  anons: "Анонс",
};

export const TYPE_LABELS: Record<string, string> = {
  anime: "Аниме",
  "anime-serial": "Аниме сериал",
};

export function kindLabel(kind?: AnimeKind): string | undefined {
  return kind ? (KIND_LABELS[kind] ?? kind.toUpperCase()) : undefined;
}

export function statusLabel(status?: AnimeStatus): string | undefined {
  return status ? STATUS_LABELS[status] : undefined;
}

/** Цвет бейджа статуса */
export function statusTone(status?: AnimeStatus): string {
  switch (status) {
    case "ongoing":
      return "bg-emerald-400/15 text-emerald-300 ring-emerald-400/25";
    case "anons":
      return "bg-sky-400/15 text-sky-300 ring-sky-400/25";
    default:
      return "bg-white/8 text-white/60 ring-white/15";
  }
}

/* ------------------------------------------------------------------ */
/* Форматирование чисел                                                 */
/* ------------------------------------------------------------------ */

/** 9.1 -> "9.1", 8.05 -> "8.05", 8 -> "8.0" */
export function formatRating(value?: number): string | undefined {
  if (value == null || Number.isNaN(value)) return undefined;
  const fixed = value.toFixed(2);
  return fixed.endsWith("0") ? fixed.slice(0, -1) : fixed;
}

/** 177211 -> "177 211" */
export function formatVotes(value?: number): string | undefined {
  if (value == null) return undefined;
  return value.toLocaleString("ru-RU").replace(/\u00A0/g, " ");
}

/** Обрезает длинный текст с многоточием */
export function truncate(text?: string, max = 220): string | undefined {
  if (!text) return undefined;
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max - 1).trimEnd() + "…" : clean;
}

/* ------------------------------------------------------------------ */
/* Утилиты для ссылок                                                   */
/* ------------------------------------------------------------------ */

/** Kodik отдаёт ссылки как "//kodikplayer.com/..." — приводим к https */
export function absoluteUrl(link?: string): string | undefined {
  if (!link) return undefined;
  if (link.startsWith("//")) return "https:" + link;
  return link;
}

/** Собирает query-строку из объекта, пропуская пустые значения */
export function qs(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  return sp.toString();
}
