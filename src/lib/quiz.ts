/**
 * Логика квиза AniGalaxy: раунд «Угадай тайтл по opening'у».
 *
 * Чистая функция — без React и без серверных зависимостей: на вход
 * (уже нормализованные через Kodik) карточки каталога и найденные opening'ы,
 * на выход — раунд из вопросов. Вопросы собираются на сервере (Route Handler
 * `/api/quiz`) из топ-результатов каталога; клиент только играет.
 */

import type { AnimeCard } from "./types";
import { KIND_LABELS, cardKey, dedupeCards } from "./anime";

export interface QuizOpening {
  /** Кадр opening'а (превью YouTube / Kodik) */
  src: string;
  /** Название opening'а */
  title: string;
}

/** Режим раунда: по кадру из OP или по песне из OP */
export type QuizMode = "frame" | "song";

/** Песня из opening'а: 30-секундное превью и подпись темы */
export interface QuizSong {
  /** Прямая ссылка на превью (iTunes, ~30 секунд) */
  previewUrl: string;
  /** Подпись темы: «OP1 «Yuusha» — YOASOBI» */
  theme: string;
  /** Название песни */
  song: string;
  /** Исполнитель, если удалось разобрать */
  artist?: string;
}

export interface QuizQuestion {
  id: string;
  /** Тайтл, который нужно угадать */
  card: AnimeCard;
  /** Кадр из opening'а тайтла — визуальная подсказка (режим frame) */
  op?: QuizOpening;
  /** Песня из opening'а — аудиоподсказка (режим song) */
  song?: QuizSong;
  /** Подсказка: тип/год тайтла, по которой игрок должен угадать */
  hint: string;
  /** Варианты ответа: правильный + чужие тайтлы из пула */
  options: AnimeCard[];
  /** id правильного варианта */
  answerId: string;
}

export interface QuizRound {
  id: string;
  /** Каким режимом играется раунд */
  mode: QuizMode;
  questions: QuizQuestion[];
}

const QUESTION_COUNT = 5;
const OPTION_COUNT = 4;

/** Подпись тайтла для подсказки: «Фильм · 2019» / «ТВ Сериал · 2024» */
export function quizHint(card: AnimeCard): string {
  const kind =
    (card.kind && KIND_LABELS[card.kind]) ||
    (card.status === "ongoing" ? "Онгоинг" : undefined) ||
    "Фильм";
  const year = card.year ? ` · ${card.year}` : "";
  return `${kind}${year}`;
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Разбирает подпись OP-ролика на песню и исполнителя.
 *
 * Shikimori отдаёт названия вида `OP1 «Yuusha» — YOASOBI`, YouTube-поиск —
 * `Frieren | Yuusha by YOASOBI`. Для iTunes-поиска достаточно вытащить
 * «Yuusha» и «YOASOBI»: если что-то не распозналось, вернём null и вопрос
 * просто не попадёт в песенный раунд.
 */
export function parseThemeName(name: string): { song: string; artist?: string } | null {
  let text = name.replace(/\s+/g, " ").trim();
  if (!text) return null;

  // «OP1 …», «ED2 …», «Opening 1: …» — префикс нумерации не нужен
  text = text
    .replace(/^(?:op|ed|оп|opening|ending|опенинг|эндинг)\s*\d*\s*[:\-–—]?\s*/i, "")
    .trim();

  // YouTube часто пишет «Аниме | Песня …» — берём часть после последней черты
  const pipe = text.lastIndexOf("|");
  if (pipe >= 0) text = text.slice(pipe + 1).trim();

  // «Song» — Artist (формат Shikimori). В японских подписях кавычек бывает
  // несколько («Аниме» … «Песня») — песня всегда последняя.
  const quotes = [...text.matchAll(/[«"“]([^»"”]{1,100})[»"”]/g)];
  if (quotes.length) {
    const last = quotes[quotes.length - 1];
    const song = last[1].trim();
    const rest = text
      .slice((last.index ?? 0) + last[0].length)
      .replace(/^\s*(?:[—–/-]|by)\s*/i, "")
      .trim();
    if (song) return { song, artist: cleanArtist(rest || undefined) };
  }

  // Song by Artist
  const by = /^(.{2,100}?)\s+by\s+(.{1,100})$/i.exec(text);
  if (by) {
    const song = by[1].trim();
    const artist = cleanArtist(by[2]);
    if (song && artist) return { song, artist };
  }

  // Song — Artist (длинное тире или дефис с пробелами)
  const dashed = /^(.{2,100}?)\s+[—–-]\s+(.{1,100})$/.exec(text);
  if (dashed) {
    const song = dashed[1].trim();
    const artist = cleanArtist(dashed[2]);
    if (song && artist) return { song, artist };
  }

  return null;
}

/** Убирает хвосты вида «(SPECIAL MV)», «(EN)», «(TV Size)» у исполнителя */
function cleanArtist(value?: string): string | undefined {
  if (!value) return undefined;
  const clean = value
    .replace(/\s*\((?:special\s*mv|mv|en|rus|tv|short|full|official)[^)]*\)\s*$/i, "")
    .replace(/\s+(?:special\s*mv|mv)$/i, "")
    .trim();
  return clean || undefined;
}

/**
 * Компактный хеш названия тайтла для списка недавных вопросов.
 *
 * Клиент запоминает показанные тайтлы в localStorage и присылает их в
 * `/api/quiz?exclude=...` — сервер не ставит эти тайтлы в новые раунды.
 * Хеш нужен, чтобы не тащить в URL длинные названия на кириллице, а ключом
 * берётся только название: один и тот же тайтл встречается в каталоге
 * несколькими записями (другой формат, год или озвучка), и по ним же он
 * не должен повторяться в раундах.
 */
export function quizExcludeHash(title: string): string {
  const key = (title ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

/** Подборка уникальных карточек из пула — по одному тайтлу на вопрос */
export function pickCards(cards: AnimeCard[], count: number): AnimeCard[] {
  const pool = dedupeCards(cards).filter((card) => card.title);
  const picked: AnimeCard[] = [];
  const used = new Set<string>();
  const total = Math.min(count, pool.length);

  while (picked.length < total) {
    const candidates = shuffle(pool).filter((card) => !used.has(cardKey(card)));
    if (!candidates.length) break;
    const card = candidates[0];
    used.add(cardKey(card));
    picked.push(card);
  }

  return picked;
}

/**
 * Собирает раунд из `count` вопросов «Угадай тайтл по opening'у» по карточкам
 * пула (у которых уже есть найденные opening'ы). Правильный ответ держится при
 * себе и попадает в варианты вместе с дистракторами — игроку предлагается
 * выбрать один из четырёх.
 *
 * `pickedCards` — уже выбранные вопросы. Сервер ищет opening'и именно для них,
 * поэтому передаёт список сюда: иначе раунд заново тасует пул и кадры
 * opening'ов достаются не тем карточкам (а то и вовсе не достаются).
 */
export function buildRound(
  cards: AnimeCard[],
  count = QUESTION_COUNT,
  openings: Map<string, QuizOpening> = new Map(),
  pickedCards?: AnimeCard[],
  songs: Map<string, QuizSong> = new Map(),
  mode: QuizMode = "frame",
): QuizRound {
  const pool = dedupeCards(cards).filter((card) => card.title);
  const picked = pickedCards?.length ? pickedCards : pickCards(pool, count);

  const questions: QuizQuestion[] = picked.map((card, index) => {
    const distractors = shuffle(
      pool.filter((c) => cardKey(c) !== cardKey(card)),
    ).slice(0, OPTION_COUNT - 1);
    const options = shuffle([card, ...distractors]).slice(0, OPTION_COUNT);
    return {
      id: `q${index + 1}`,
      card,
      // В каждом режиме отдаём только свою подсказку: кадр не должен
      // случайно выдать ответ в песенном раунде и наоборот.
      op: mode === "frame" ? openings.get(cardKey(card)) : undefined,
      song: mode === "song" ? songs.get(cardKey(card)) : undefined,
      hint: quizHint(card),
      options,
      answerId: card.id,
    };
  });

  const id = `quiz-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  return { id, mode, questions };
}
