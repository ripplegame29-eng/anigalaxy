import { NextRequest, NextResponse } from "next/server";
import { catalog } from "@/lib/kodik";
import { handleKodikError } from "@/lib/api-helpers";
import { opening } from "@/lib/shikimori";
import { songPreview } from "@/lib/itunes";
import { cardKey } from "@/lib/anime";
import { buildRound, parseThemeName, pickCards, quizExcludeHash } from "@/lib/quiz";
import type { QuizMode, QuizOpening, QuizSong } from "@/lib/quiz";
import type { AnimeCard } from "@/lib/types";

export const runtime = "nodejs";

/** Вопросов в раунде и сколько кандидатов просматриваем, пока не наберём 5 */
const ROUND_SIZE = 5;
const PROBE_LIMIT = 48;
/** Сколько страниц Kodik читаем для пула: один тайтл = десятки озвучек */
const POOL_PAGES = 7;
/** Сколько тайтлов греем разом: Shikimori отвечает «Retry later» на пачки */
const WARM_CONCURRENCY = 2;
/** Потолок ожидания «холодных» подсказок: лучше раунд из 3–4 вопросов, чем 20 с */
const PICK_DEADLINE = 12_000;
/** Один зависший запрос не должен держать всю пачку кандидатов */
const CARD_TIMEOUT = 6_000;
/** Кадр opening'а ждём недолго — иначе берём готовый скриншот из аниме */
const FRAME_WAIT = 2_500;
/** Пустой результат (у тайтла нет кадра/песни) не перепроверяем десятки раз */
const NEGATIVE_TTL = 10 * 60_000;

/* ------------------------------ Тёплый пул ------------------------------ */

/**
 * Найденные подсказки по `cardKey`: кадр opening'а и песня не меняются, а
 * поиск по новому тайтлу стоит до ~2.5 с (Shikimori → YouTube → iTunes).
 *
 * Ключ с `value: null` означает «проверили — подсказки нет» и живёт
 * `NEGATIVE_TTL`, иначе фоновый прогрев долбил бы API по одной и той же
 * неудаче на каждом раунде.
 */
interface Cached<T> {
  value: T | null;
  at: number;
}

const frameCache = new Map<string, Cached<QuizOpening>>();
const songCache = new Map<string, Cached<QuizSong>>();
/** Идущие поиски: параллельные раунды не должны дублировать запрос */
const frameJobs = new Map<string, Promise<QuizOpening | null>>();
const songJobs = new Map<string, Promise<QuizSong | null>>();

function cacheGet<T>(map: Map<string, Cached<T>>, key: string): T | null | undefined {
  const hit = map.get(key);
  if (!hit) return undefined;
  if (!hit.value && Date.now() - hit.at > NEGATIVE_TTL) {
    map.delete(key);
    return undefined;
  }
  return hit.value;
}

function cacheSet<T>(map: Map<string, Cached<T>>, key: string, value: T | null): void {
  if (map.size > 500) map.clear();
  map.set(key, { value, at: Date.now() });
}

/** Кадр opening'а тайтла (запасной вариант — скриншот из аниме) */
async function resolveFrame(card: AnimeCard): Promise<QuizOpening | null> {
  const key = cardKey(card);
  const hit = cacheGet(frameCache, key);
  if (hit !== undefined) return hit;

  const job = frameJobs.get(key);
  if (job) return job;

  const promise = (async (): Promise<QuizOpening | null> => {
    try {
      const openingJob = opening(card.shikimoriId, card.title);
      // Запасной кадр — скриншот из аниме (не постер: он выдаёт ответ).
      // Если Shikimori подвис, не ждём его: показываем скриншот, а настоящий
      // кадр opening'а подставим в кэш, когда ответ всё-таки придёт.
      const op = await Promise.race([
        openingJob,
        new Promise<null>((done) => setTimeout(() => done(null), FRAME_WAIT)),
      ]);
      const src = op?.poster ?? card.screenshots?.[0];
      const entry: QuizOpening | null = src
        ? { src, title: op?.title ?? "Кадр из аниме" }
        : null;
      cacheSet(frameCache, key, entry);

      if (!op) {
        void openingJob
          .then((late) => {
            if (late?.poster) cacheSet(frameCache, key, { src: late.poster, title: late.title });
          })
          .catch(() => undefined);
      }

      return entry;
    } catch {
      cacheSet(frameCache, key, null);
      return null;
    } finally {
      frameJobs.delete(key);
    }
  })();

  frameJobs.set(key, promise);
  return promise;
}

/** 30-секундное превью песни из opening'а тайтла */
async function resolveSong(card: AnimeCard): Promise<QuizSong | null> {
  const key = cardKey(card);
  const hit = cacheGet(songCache, key);
  if (hit !== undefined) return hit;

  const job = songJobs.get(key);
  if (job) return job;

  const promise = (async (): Promise<QuizSong | null> => {
    try {
      const op = await opening(card.shikimoriId, card.title);
      const parsed = op ? parseThemeName(op.title) : null;
      const previewUrl = parsed ? await songPreview(parsed.song, parsed.artist) : null;
      const entry: QuizSong | null =
        op && parsed && previewUrl
          ? { previewUrl, theme: op.title, song: parsed.song, artist: parsed.artist }
          : null;
      cacheSet(songCache, key, entry);
      return entry;
    } catch {
      cacheSet(songCache, key, null);
      return null;
    } finally {
      songJobs.delete(key);
    }
  })();

  songJobs.set(key, promise);
  return promise;
}

let warming = false;

/**
 * Прогрев пула в фоне: пока игрок читает вопрос, сервер ищет подсказки для
 * следующих раундов. Параллельность мала намеренно — Shikimori и YouTube
 * начинают отвечать «Retry later», когда их дёргают пачками.
 */
async function warmPool(cards: AnimeCard[]): Promise<void> {
  if (warming) return;
  warming = true;
  try {
    for (let i = 0; i < cards.length; i += WARM_CONCURRENCY) {
      const pair = cards.slice(i, i + WARM_CONCURRENCY);
      await Promise.all(
        pair.map((card) => Promise.all([resolveFrame(card), resolveSong(card)])),
      );
    }
  } finally {
    warming = false;
  }
}

/* ------------------------------ Подбор раунда ---------------------------- */

function isWarm(mode: QuizMode, card: AnimeCard): boolean {
  const key = cardKey(card);
  return mode === "song"
    ? Boolean(cacheGet(songCache, key))
    : Boolean(cacheGet(frameCache, key));
}

function resolve(mode: QuizMode, card: AnimeCard): Promise<unknown> {
  return mode === "song" ? resolveSong(card) : resolveFrame(card);
}

/** Резолв карточки с потолком: зависший источник не блокирует пачку */
function withTimeout(card: AnimeCard, mode: QuizMode, ms: number): Promise<unknown> {
  return Promise.race([
    resolve(mode, card),
    new Promise<null>((done) => setTimeout(() => done(null), ms)),
  ]);
}

/**
 * Карточки для раунда: сначала те, у кого подсказка уже найдена (отдаются
 * мгновенно), остальные добираются партиями, пока не наберётся `ROUND_SIZE`.
 * Общее ожидание ограничено `PICK_DEADLINE`, а каждая карточка — `CARD_TIMEOUT`:
 * поиск нового opening'а упирается в Shikimori/YouTube, и один зависший
 * запрос не должен ни держать пачку, ни растягивать раунд на 20 секунд.
 */
async function pickReady(
  mode: QuizMode,
  candidates: AnimeCard[],
  deadline: number,
): Promise<AnimeCard[]> {
  const ready: AnimeCard[] = [];
  const cold: AnimeCard[] = [];
  for (const card of candidates) {
    (isWarm(mode, card) ? ready : cold).push(card);
  }

  while (ready.length < ROUND_SIZE && cold.length) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;

    const batch = cold.splice(0, 5);
    const resolved = await Promise.all(
      batch.map((card) => withTimeout(card, mode, Math.min(CARD_TIMEOUT, remaining))),
    );
    batch.forEach((card, i) => {
      if (resolved[i]) ready.push(card);
    });
  }

  return ready.slice(0, ROUND_SIZE);
}

/**
 * Кандидаты раунда: из свежего пула (без недавно показанных тайтлов), а если
 * после исключения подсказок не хватает — добираем из полного каталога.
 * Антиповтор работает как предпочтение, а не как жёсткое правило: пустой
 * раунд хуже, чем один повтор.
 */
async function pickRoundCards(
  mode: QuizMode,
  pool: AnimeCard[],
  full: AnimeCard[],
  canRetry: boolean,
): Promise<AnimeCard[]> {
  // Один бюджет на все проходы: иначе ретраи удваивали бы ожидание и
  // упирались в клиентский таймаут
  const deadline = Date.now() + PICK_DEADLINE;
  const collected = new Map<string, AnimeCard>();
  const merge = (cards: AnimeCard[]): void => {
    for (const card of cards) collected.set(quizExcludeHash(card.title), card);
  };

  merge(await pickReady(mode, pickCards(pool, Math.min(PROBE_LIMIT, pool.length)), deadline));
  if (collected.size >= ROUND_SIZE || !canRetry) {
    return [...collected.values()].slice(0, ROUND_SIZE);
  }

  // Второй заход по свежему пулу: выборка другая, антиповтор сохранён.
  // Нужен песенному режиму — там подсказка есть не у каждого тайтла.
  merge(
    await pickReady(
      mode,
      pickCards(pool, Math.min(PROBE_LIMIT, pool.length)),
      deadline + 2_500,
    ),
  );
  if (collected.size >= ROUND_SIZE) return [...collected.values()].slice(0, ROUND_SIZE);

  // Совсем не хватило — добираем по полному каталогу (повтор лучше пустоты)
  merge(
    await pickReady(
      mode,
      pickCards(full, Math.min(PROBE_LIMIT, full.length)),
      deadline + 4_000,
    ),
  );
  return [...collected.values()].slice(0, ROUND_SIZE);
}

/**
 * GET /api/quiz?mode=frame|song&exclude=hash,hash — раунд квиза AniGalaxy.
 *
 * Вопросы собираются на сервере из широкого пула каталога Kodik:
 *   - frame — угадать тайтл по увеличенному фрагменту кадра opening'а;
 *   - song  — угадать тайтл по 30-секундному отрывку песни из opening'а.
 *
 * `exclude` — хеши недавно показанных тайтлов (см. `quizExcludeHash`): без них
 * раунды собирались бы из одних и тех же топ-тайтлов каталога.
 */
export async function GET(request: NextRequest) {
  try {
    const mode: QuizMode =
      request.nextUrl.searchParams.get("mode") === "song" ? "song" : "frame";

    // Широкий пул: Kodik отдаёт десятки озвучек на тайтл, поэтому страниц
    // читаем с запасом — иначе раунды собирались бы из 60 топ-тайтлов.
    // Сортировка `fresh` (created_at) даёт ~35 новых тайтлов на страницу,
    // тогда как `rating` группирует озвучки и приносит всего ~10.
    const { cards } = await catalog({ sort: "fresh" }, 260, POOL_PAGES);

    const excludeRaw = request.nextUrl.searchParams.get("exclude") ?? "";
    const exclude = new Set(excludeRaw.split(",").filter(Boolean));
    const fresh = exclude.size
      ? cards.filter((card) => !exclude.has(quizExcludeHash(card.title)))
      : cards;
    const pool = fresh.length >= 24 ? fresh : cards;

    const picked = await pickRoundCards(mode, pool, cards, exclude.size > 0);
    // Прогрев запускаем после сборки раунда: иначе фоновые запросы отбирают
    // лимит Shikimori у тех карточек, что нужны прямо сейчас
    void warmPool(pool).catch(() => undefined);

    if (!picked.length) {
      return NextResponse.json(
        {
          error:
            mode === "song"
              ? "Не удалось найти песни из opening'ов — попробуй ещё раз"
              : "Не удалось найти кадры — попробуй ещё раз",
        },
        { status: 503 },
      );
    }

    if (mode === "song") {
      const songs = new Map<string, QuizSong>();
      for (const card of picked) {
        const entry = cacheGet(songCache, cardKey(card));
        if (entry) songs.set(cardKey(card), entry);
      }
      const ready = picked.filter((card) => songs.has(cardKey(card)));
      if (!ready.length) {
        return NextResponse.json(
          { error: "Не удалось найти песни из opening'ов — попробуй ещё раз" },
          { status: 503 },
        );
      }
      const round = buildRound(cards, ready.length, new Map(), ready, songs, "song");
      return NextResponse.json({ round });
    }

    const openings = new Map<string, QuizOpening>();
    for (const card of picked) {
      const entry = cacheGet(frameCache, cardKey(card));
      if (entry) openings.set(cardKey(card), entry);
    }
    const ready = picked.filter((card) => openings.has(cardKey(card)));
    if (!ready.length) {
      return NextResponse.json(
        { error: "Не удалось найти кадры — попробуй ещё раз" },
        { status: 503 },
      );
    }
    const round = buildRound(cards, ready.length, openings, ready, new Map(), "frame");
    return NextResponse.json({ round });
  } catch (error) {
    return handleKodikError(error);
  }
}
