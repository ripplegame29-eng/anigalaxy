"use client";

import { SHIELD_SANDBOX, setShield, useShield } from "@/lib/shield";
import { mergeVoices, pickDefaultVoice } from "@/lib/voice-merge";
import { toggleFullscreen as toggleFs } from "@/lib/fullscreen";
import { useEffect, useMemo, useRef, useState } from "react";
import { kindLabel, statusLabel, truncate } from "@/lib/anime";
import { readAccount } from "@/lib/auth";
import { noteGuestEpisode } from "@/lib/guest-wall";
import { recordWatch, tickWatch } from "@/lib/history";
import { rememberTitle } from "@/lib/titles";
import { usePrefs } from "@/lib/prefs";
import { PLAYER_FILTER } from "@/lib/quality";
import { progressEmit } from "@/lib/progression/events";
import type {
  AniBoomMatch,
  CvhPlaylist,
  SameBandMatch,
  TitleDetail,
  TranslationOption,
} from "@/lib/types";
import { AltPlayer } from "./AltPlayer";

/**
 * Источник видео в блоке просмотра:
 *   «kodik»      — встроенный плеер Kodik;
 *   «anigalaxy»  — наш плеер на прямых HLS-потоках Kodik;
 *   «anilibria»  — наш плеер на каталоге AniLiberty;
 *   «cvh»        — CdnVideoHub (озвучки AnimeGO);
 *   «sameband»   — SameBand;
 *   «aniboom»    — AniBoom (озвучки AnimeGO, HLS).
 * У всех альтернатив панель управления одна и та же.
 */
/** Что выбрано в меню «Источник»: авто (лучшее качество) или конкретный плеер */
type SourcePick = "auto" | "anigalaxy" | "kodik" | "cvh" | "aniboom";
type PlayerSource = "kodik" | "anigalaxy" | "anilibria" | "cvh" | "sameband" | "aniboom";

/**
 * Псевдо-id озвучек альтернативных источников в общем списке студий.
 *
 * AniLiberty и SameBand — по одной дорожке, у CVH — до двадцати. Id
 * отрицательные, чтобы никогда не столкнуться с настоящими id Kodik.
 * Для CVH id стабилен: хэш от названия студии, иначе при смене серии
 * выбранная озвучка «переезжала» бы на другую.
 */
const SOURCE_LABEL: Record<SourcePick, string> = {
  auto: "Источник: авто",
  anigalaxy: "AniGalaxy",
  kodik: "Kodik",
  cvh: "CVH",
  aniboom: "AniBoom",
};
const SOURCE_ITEMS: { id: SourcePick; label: string; hint: string }[] = [
  { id: "auto", label: "Авто", hint: "лучшее качество" },
  { id: "anigalaxy", label: "AniGalaxy", hint: "наш плеер · до 4K" },
  { id: "kodik", label: "Kodik", hint: "встроенный плеер" },
  { id: "cvh", label: "CVH", hint: "1080p" },
  { id: "aniboom", label: "AniBoom", hint: "1080p" },
];

const ANILIBERTY_TR = -1;
const SAMEBAND_TR = -2;
const CVH_TR_BASE = 10_000;
const ANIBOOM_TR_BASE = 900_000;

function hash32(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Повторы для озвучек CVH/SameBand/AniBoom.
 *
 * Первый запрос уходит сразу. Если он упал — повторяем в фоне через 3 с,
 * затем ещё через 6 с, но не ждём эти повторы перед показом уже полученных
 * озвучек. Поздний успех просто добавляет источник в список.
 */
const BACKGROUND_RETRY_DELAYS = [3000, 6000] as const;

function fetchJsonWithBackgroundRetry<T>(
  url: string,
  signal: AbortSignal,
  onData: (data: T) => void,
): () => void {
  let timer: number | undefined;
  let stopped = false;

  const stop = () => {
    stopped = true;
    if (timer !== undefined) window.clearTimeout(timer);
  };

  const scheduleRetry = (retryIndex: number) => {
    if (stopped || signal.aborted || retryIndex >= BACKGROUND_RETRY_DELAYS.length) return;
    timer = window.setTimeout(() => {
      timer = undefined;
      void attempt(retryIndex + 1);
    }, BACKGROUND_RETRY_DELAYS[retryIndex]);
  };

  const attempt = async (retryIndex: number) => {
    if (stopped || signal.aborted) return;

    let res: Response;
    try {
      res = await fetch(url, { signal });
    } catch {
      if (!stopped && !signal.aborted) scheduleRetry(retryIndex);
      return;
    }

    if (res.ok) {
      let data: T;
      try {
        data = (await res.json()) as T;
      } catch {
        if (!stopped && !signal.aborted) scheduleRetry(retryIndex);
        return;
      }
      if (!stopped && !signal.aborted) onData(data);
      return;
    }

    // 4xx кроме 429 повторять бессмысленно.
    if (res.status >= 400 && res.status < 500 && res.status !== 429) return;
    scheduleRetry(retryIndex);
  };

  void attempt(0);
  return stop;
}

function cvhVoiceId(studio: string): number {
  return -(CVH_TR_BASE + (hash32(studio) % 800_000));
}

/**
 * AniBoom-дорожки держим отдельными записями: у CVH уже есть те же студии,
 * и их id используются в глубоких ссылках. Слияние «по названию» сделало бы
 * старые `?tr=` нерабочими, поэтому в title добавляется «· AniBoom».
 */
function aniboomVoiceId(animeId: string, translationId: number): number {
  const hash = hash32(`${animeId}:${translationId}`);
  return -(ANIBOOM_TR_BASE + (hash % 400_000));
}

function isAltSource(
  source: PlayerSource,
): source is "anilibria" | "cvh" | "sameband" | "aniboom" {
  return (
    source === "anilibria" ||
    source === "cvh" ||
    source === "sameband" ||
    source === "aniboom"
  );
}

/**
 * Блок просмотра: плеер Kodik + боковая панель со студиями озвучки
 * и выбором серий (как на высокобюджетных стримингах).
 *
 * Данные о сериях приходят с сервера, при смене озвучки — догружаются
 * через /api/kodik/title, после чего список серий обновляется сам.
 */
export function WatchBox({
  initialDetail,
  translations,
}: {
  initialDetail: TitleDetail;
  translations: TranslationOption[];
}) {
  const [detail, setDetail] = useState<TitleDetail>(initialDetail);
  /**
   * Список озвучек, перезапрошенный на клиенте.
   *
   * Сервер отдаёт его вместе со страницей, но разбор страницы плеера Kodik
   * может не удаться — тогда приходит одна строка, и меню выглядит так,
   * будто озвучек больше нет. Список помечается id тайтла: при переходе на
   * другой тайтл старый не подставляется.
   */
  const [reloaded, setReloaded] = useState<{ id: string; list: TranslationOption[] } | null>(null);
  const [transId, setTransId] = useState<number | null>(
    translations.find((t) => t.current)?.id ?? translations[0]?.id ?? null,
  );
  const [season, setSeason] = useState<number>(initialDetail.seasons[0]?.number ?? 1);
  const [episode, setEpisode] = useState<number>(1);
  const shield = useShield();
  const [switching, setSwitching] = useState(false);
  const [playerLoading, setPlayerLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  // Источник видео: Kodik (по умолчанию), AniGalaxy (HLS Kodik),
  // AniLiberty, CVH или SameBand
  const [source, setSource] = useState<PlayerSource>("anigalaxy");
  const [sourcePick, setSourcePick] = useState<SourcePick>("auto");
  const [sourceMenuOpen, setSourceMenuOpen] = useState(false);
  /**
   * Релиз AniLiberty, подтверждённый по id Shikimori. Помечен id тайтла:
   * при смене озвучки материал меняется, и старый релиз не подставится.
   */
  const [aniMatch, setAniMatch] = useState<{ titleId: string; alias: string; episodesTotal: number | null } | null>(null);
  /** Плейлист CVH: сезоны и студии, ключ — shikimori id */
  const [cvh, setCvh] = useState<{ shikimori: number; playlist: CvhPlaylist } | null>(null);
  /** Подтверждённый тайтл SameBand: поиск идёт по названию/году */
  const [sameband, setSameband] = useState<{ key: string; match: SameBandMatch } | null>(null);
  /** Тайтл AnimeGO + дорожки AniBoom, найденные по названию/году */
  const [aniboom, setAniboom] = useState<{ key: string; match: AniBoomMatch } | null>(null);
  /** Куда вернуться, когда зритель уйдёт с альтернативного источника */
  const sourceBeforeAlt = useRef<PlayerSource>("anigalaxy");
  /** Озвучка Kodik, выбранная до переключения на альтернативу */
  const transIdBeforeAlt = useRef<number | null>(null);

  // Кадр Kodik показывается как отдаёт источник: кнопки «Апскейл» под
  // плеером больше нет, а вместе с ней и конвейера захвата вкладки
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const epsRef = useRef<HTMLDivElement>(null);
  /** Пропускаем первую запись URL, пока не применены глубокие ссылки */
  const skipUrlSync = useRef(true);
  /**
   * Контекст текущей серии для движка прогрессии. Держим его в ref, чтобы
   * интервал heartbeat (создаётся один раз) не терял актуальные значения.
   */
  const progressRef = useRef<{
    titleId: string;
    episodeKey: string;
    isFinal: boolean;
    episodeIndex?: number;
    genres: string[];
    durationSec?: number;
  } | null>(null);

  const isSerial = detail.isSerial;
  const titleId = initialDetail.card.id;
  const studioList =
    reloaded && reloaded.id === titleId && reloaded.list.length > 1 ? reloaded.list : translations;

  /* ------------------- Подстраховка списка озвучек --------------------- */
  useEffect(() => {
    if (translations.length > 1) return;
    let cancelled = false;
    let timer: number | undefined;
    const id = initialDetail.card.id;

    const load = (attempt: number) => {
      void fetch(`/api/kodik/translations?id=${encodeURIComponent(id)}&fresh=1`)
        .then((res) => (res.ok ? (res.json() as Promise<{ translations?: TranslationOption[] }>) : null))
        .then((data) => {
          if (cancelled) return;
          const list = data?.translations ?? [];
          if (list.length > 1) {
            setReloaded({ id, list });
            return;
          }
          // Первый запрос может прийтись на пересборку маршрута или на
          // холодный ответ Kodik — одна попытка оставила бы меню урезанным.
          if (attempt === 0) timer = window.setTimeout(() => load(1), 1500);
        })
        .catch(() => {
          if (!cancelled && attempt === 0) timer = window.setTimeout(() => load(1), 1500);
        });
    };

    load(0);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [initialDetail.card.id, translations.length]);

  /* ------------------- Озвучка AniLiberty: подбор --------------------- */
  /**
   * Раньше AniLiberty был отдельной кнопкой источника и искал тайтл по
   * названию — на «Чёрный клевер» открывалось чужое аниме. Теперь релиз
   * подтверждается по id Shikimori, и озвучка появляется в списке
   * студий только тогда, когда это точно тот же тайтл.
   */
  useEffect(() => {
    const anime = detail.card;
    const id = anime.shikimoriId;
    if (!id) return;
    const names = [anime.title, anime.titleOrig, anime.otherTitles?.[0]]
      .filter((name): name is string => Boolean(name));
    if (!names.length) return;

    let cancelled = false;
    const params = new URLSearchParams({ id: String(id) });
    names.slice(0, 3).forEach((name, i) => params.set(i === 0 ? "q" : `q${i + 1}`, name));
    void fetch(`/api/anilibria/match?${params}`)
      .then((res) => (res.ok ? (res.json() as Promise<{ match?: { alias: string; episodesTotal: number | null } | null }>) : null))
      .then((data) => {
        if (cancelled || !data?.match?.alias) return;
        setAniMatch({ titleId: anime.id, alias: data.match.alias, episodesTotal: data.match.episodesTotal });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [detail.card]);

  /* ------------------------- CVH: озвучки ---------------------------- */
  /**
   * CVH-плейлист привязан к shikimori_id. Он даёт до двадцати студий на
   * тайтл; добавляем их в общий список озвучек и переключаем источник на
   * CVH. Если плейлиста нет — источник просто не предлагается.
   */
  useEffect(() => {
    const id = detail.card.shikimoriId;
    if (!id) return;
    const controller = new AbortController();
    const stop = fetchJsonWithBackgroundRetry<{ playlist?: CvhPlaylist }>(
      `/api/cvh/playlist?shikimori=${id}`,
      controller.signal,
      (data) => {
        if (controller.signal.aborted) return;
        if (data?.playlist?.studios.length) {
          setCvh({ shikimori: id, playlist: data.playlist });
        }
      },
    );
    return () => {
      stop();
      controller.abort();
    };
  }, [detail.card.shikimoriId]);

  /* ---------------------- SameBand: подбор тайтла --------------------- */
  /**
   * У SameBand нет Shikimori id, поэтому подбираем по нормализованному
   * названию и году. Ключ включает название/год: при смене озвучки Kodik
   * материал меняется, но тайтл остаётся тем же — лишний поиск не нужен.
   */
  const samebandKey = `${detail.card.title}|${detail.card.year ?? ""}|${detail.card.titleOrig ?? ""}|${(detail.card.otherTitles ?? []).join("\u0001")}`;
  useEffect(() => {
    const card = detail.card;
    const names = [card.title, card.titleOrig, ...(card.otherTitles ?? [])]
      .filter((name): name is string => Boolean(name))
      .slice(0, 3);
    if (!names.length) return;

    const controller = new AbortController();
    const params = new URLSearchParams({ q: names[0] });
    if (card.year) params.set("year", String(card.year));
    names.slice(1).forEach((name, index) => params.set(`q${index + 2}`, name));

    const stop = fetchJsonWithBackgroundRetry<{ match?: SameBandMatch | null }>(
      `/api/sameband/match?${params}`,
      controller.signal,
      (data) => {
        if (controller.signal.aborted) return;
        if (data?.match) setSameband({ key: samebandKey, match: data.match });
      },
    );
    return () => {
      stop();
      controller.abort();
    };
    // samebandKey уже содержит название, год и оригинальное название
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [samebandKey]);

  /* ------------------------ AniBoom: подбор тайтла -------------------- */
  /**
   * AniBoom живёт внутри AnimeGO: сначала ищем точное название (с годом,
   * чтобы не открыть второй сезон), затем берём озвучки из плеера AnimeGO.
   * Как и SameBand, ключ включает все названия — при смене озвучки Kodik
   * материал тот же, повторный поиск не нужен.
   */
  const aniboomKey = `${detail.card.title}|${detail.card.year ?? ""}|${detail.card.titleOrig ?? ""}|${(detail.card.otherTitles ?? []).join("\u0001")}`;
  useEffect(() => {
    const card = detail.card;
    const names = [card.title, card.titleOrig, ...(card.otherTitles ?? [])]
      .filter((name): name is string => Boolean(name))
      .slice(0, 4);
    if (!names.length) return;

    const controller = new AbortController();
    const params = new URLSearchParams({ q: names[0] });
    if (card.year) params.set("year", String(card.year));
    names.slice(1).forEach((name, index) => params.set(`q${index + 2}`, name));

    const stop = fetchJsonWithBackgroundRetry<{ match?: AniBoomMatch | null }>(
      `/api/aniboom/match?${params}`,
      controller.signal,
      (data) => {
        if (controller.signal.aborted) return;
        if (data?.match) setAniboom({ key: aniboomKey, match: data.match });
      },
    );
    return () => {
      stop();
      controller.abort();
    };
    // aniboomKey уже содержит название, год и альтернативные названия
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aniboomKey]);

  /* ------------------------ Закрытие меню кликом ---------------------- */
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [menuOpen]);

  /* --------------------------- Ссылка плеера -------------------------- */
  const playerSrc = useMemo(() => {
    if (!isSerial) return detail.playerLink;

    const activeSeason = detail.seasons.find((s) => s.number === season) ?? detail.seasons[0];
    const ep = activeSeason?.episodes.find((e) => e.number === episode) ?? activeSeason?.episodes[0];
    return ep?.link ?? detail.playerLink;
  }, [detail, episode, isSerial, season]);

  // Спиннер, пока iframe грузится заново: сброс при смене ссылки делаем
  // паттерном «adjust state during render» — без setState внутри эффекта
  const [loadingSrc, setLoadingSrc] = useState(playerSrc);
  if (playerSrc !== loadingSrc) {
    setLoadingSrc(playerSrc);
    setPlayerLoading(true);
  }

  /* ---------------------- Смена ссылки в адресной строке --------------- */
  useEffect(() => {
    // Первый рендер пропускаем: глубокие ссылки ещё применяются
    if (skipUrlSync.current) {
      skipUrlSync.current = false;
      return;
    }
    const sp = new URLSearchParams(window.location.search);
    if (transId) sp.set("tr", String(transId));
    if (isSerial) {
      sp.set("s", String(season));
      sp.set("ep", String(episode));
    } else {
      sp.delete("s");
      sp.delete("ep");
    }
    const query = sp.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [transId, season, episode, isSerial]);

  /* ------------------------ История просмотра -------------------------- */
  useEffect(() => {
    // Запоминаем тайтл для плиток профиля и фиксируем открытие серии.
    // Жанры и студии кладём в кэш: из них виджеты считают распределение
    // просмотренного, а в самом плеере Kodik их всё равно не отдаёт.
    rememberTitle({
      id: detail.card.id,
      title: detail.card.title,
      poster: detail.card.poster,
      genres: detail.card.genres,
      studios: detail.card.studios,
      year: detail.card.year,
      rating: detail.card.rating,
      episodesTotal: detail.card.episodesTotal,
    });
    recordWatch({
      id: detail.card.id,
      title: detail.card.title,
      season,
      episode,
      poster: detail.card.poster,
    });

    // Контекст серии для движка прогрессии: длительность/жанры/финал
    // iframe Kodik отдать не может, их собирает только UI.
    const lastSeason = detail.seasons[detail.seasons.length - 1];
    const lastEpisodeNum = lastSeason?.episodes[lastSeason.episodes.length - 1]?.number;
    const ctx = {
      titleId: detail.card.id,
      episodeKey: isSerial ? `s${season}e${episode}` : "movie",
      isFinal: isSerial ? season === lastSeason?.number && episode === lastEpisodeNum : true,
      episodeIndex: isSerial ? episode : 1,
      genres: detail.card.genres ?? [],
      durationSec: detail.card.duration ? detail.card.duration * 60 : undefined,
    };
    progressRef.current = ctx;
    progressEmit({ type: "EPISODE_OPENED", ...ctx });
    if (!readAccount()) noteGuestEpisode(`${ctx.titleId}:${ctx.episodeKey}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    detail.card.id,
    detail.card.title,
    detail.card.poster,
    detail.card.genres,
    detail.card.duration,
    detail.isSerial,
    season,
    episode,
  ]);

  /**
   * Минуты просмотра: чужой iframe Kodik прочитать нельзя, поэтому время
   * считаем по присутствию на странице — раз в 15 секунд, пока вкладка
   * активна. Ровно это же значение крутится в дневном квесте.
   */
  useEffect(() => {
    const timer = window.setInterval(() => {
      const visible = document.visibilityState === "visible";
      if (visible) tickWatch(15);
      // Heartbeat для движка прогрессии тем же ритмом: в фоне браузер
      // троттлит setInterval до ~1 раза в минуту, лимит событий не задеваем.
      const ctx = progressRef.current;
      if (ctx) progressEmit({ type: "EPISODE_TICK", ...ctx, seconds: 15, visible, speed: 1 });
    }, 15_000);
    return () => window.clearInterval(timer);
  }, []);

  /** Подтверждённый релиз — только для тайтла, который открыт сейчас */
  const ani = aniMatch && aniMatch.titleId === detail.card.id ? aniMatch : null;

  /** CVH-плейлист активен только для текущего shikimori id */
  const cvhActive =
    cvh && cvh.shikimori === detail.card.shikimoriId ? cvh.playlist : null;

  /** SameBand-совпадение активно только для текущего названия/года */
  const sb = sameband && sameband.key === samebandKey ? sameband.match : null;

  /** AniBoom-совпадение активно только для текущего названия/года */
  const ab = aniboom && aniboom.key === aniboomKey ? aniboom.match : null;

  /**
   * Студии Kodik + альтернативы. AniLiberty — одна дорожка, SameBand — одна,
   * CVH — до двадцати (id стабильны: хэш от названия студии).
   */
  const cvhVoices: TranslationOption[] = (cvhActive?.studios ?? []).map((studio) => ({
    id: cvhVoiceId(studio.name),
    title: studio.name,
    type: studio.subtitles ? "subtitles" : "voice",
    mediaId: "",
    episodeCount: studio.episodes,
    provider: "cvh",
    studio: studio.name,
  }));

  /**
   * AniBoom не сливаем с CVH: у тех же студий разные id, а старые
   * глубокие ссылки CVH должны продолжать работать. Суффикс в названии
   * делает ключ уникальным и объясняет, какой источник выбран.
   */
  const aniboomVoices: TranslationOption[] = ab
    ? ab.voices.map((voice) => ({
        id: aniboomVoiceId(ab.animeId, voice.translationId),
        title: `${voice.label} · AniBoom`,
        type: /субтитр/i.test(voice.label) ? "subtitles" : "voice",
        mediaId: "",
        episodeCount: ab.episodesTotal,
        provider: "aniboom",
        studio: voice.label,
        url: voice.embed,
      }))
    : [];

  const samebandVoice: TranslationOption | null = sb
    ? {
        id: SAMEBAND_TR,
        title: "SameBand",
        type: "voice",
        mediaId: "",
        provider: "sameband",
        url: sb.url,
      }
    : null;

  /**
   * Один общий список озвучек: одинаковые студии из разных источников
   * схлопываются в запись с лучшим качеством (1080p у CVH/AniLiberty/SameBand
   * против 720p у Kodik), уникальные студии Kodik добавляются как есть.
   */
  const mergedVoices: TranslationOption[] = mergeVoices(studioList, [
    ...(ani
      ? [
          {
            id: ANILIBERTY_TR,
            title: "AniLiberty",
            type: "voice" as const,
            mediaId: "",
            episodeCount: ani.episodesTotal ?? undefined,
            provider: "anilibria" as const,
          },
        ]
      : []),
    ...cvhVoices,
    ...aniboomVoices,
    ...(samebandVoice ? [samebandVoice] : []),
  ]);

  /** Список озвучек зависит от выбранного в меню источника */
  const voiceList: TranslationOption[] =
    sourcePick === "auto"
      ? mergedVoices
      : sourcePick === "cvh"
        ? mergeVoices([], cvhVoices)
        : sourcePick === "aniboom"
          ? mergeVoices([], aniboomVoices)
          : mergeVoices(studioList, []);

  /** Релиз ещё не подтверждён — играем из Kodik, а не ищем по названию */
  const playSource: PlayerSource =
    (source === "anilibria" && !ani) ||
    (source === "cvh" && !cvhActive) ||
    (source === "sameband" && !sb) ||
    (source === "aniboom" && !ab)
      ? "anigalaxy"
      : source;

  /* --------------------------- Смена озвучки -------------------------- */
  async function switchTranslation(
    option: TranslationOption,
    opts: { silent?: boolean; keepEpisode?: number; season?: number } = {},
  ) {
    setMenuOpen(false);
    if (!opts.silent) userPicked.current = true;
    if (option.id === transId && !opts.silent) return;

    // Дорожка альтернативного источника: материал Kodik не меняем, только
    // переключаем плеер. Запоминаем, куда вернуться, если зритель выберет
    // обычную озвучку Kodik.
    if (option.provider) {
      if (!isAltSource(source)) {
        sourceBeforeAlt.current = source;
        transIdBeforeAlt.current = transId;
      }
      setTransId(option.id);
      setSource(option.provider);
      return;
    }

    // Возврат с альтернативного плеера на голос Kodik/AniGalaxy
    if (isAltSource(source)) {
      const back = isAltSource(sourceBeforeAlt.current) ? "anigalaxy" : sourceBeforeAlt.current;
      if (back === "kodik") setPlayerLoading(true);
      setSource(back);
    }

    setTransId(option.id);

    // Тот же материал — правим только серию/сезон, без запроса
    if (option.mediaId === detail.card.id) {
      if (opts.season && detail.seasons.some((s) => s.number === opts.season)) setSeason(opts.season);
      if (opts.keepEpisode) setEpisode(opts.keepEpisode);
      return;
    }

    setSwitching(true);
    try {
      const res = await fetch(`/api/kodik/title?id=${encodeURIComponent(option.mediaId)}`);
      if (!res.ok) return;
      const data = (await res.json()) as { detail: TitleDetail };
      const next = data.detail;

      setDetail(next);
      const nextSeason = opts.season && next.seasons.some((s) => s.number === opts.season)
        ? opts.season
        : (next.seasons[0]?.number ?? 1);
      setSeason(nextSeason);

      const seasonObj = next.seasons.find((s) => s.number === nextSeason);
      const wanted = opts.keepEpisode ?? episode;
      const exists = seasonObj?.episodes.some((e) => e.number === wanted);
      setEpisode(exists ? wanted : (seasonObj?.episodes[0]?.number ?? 1));
    } catch {
      /* сеть подвела — остаёмся на текущей озвучке */
    } finally {
      setSwitching(false);
    }
  }

  /* ------------------------- Глубокие ссылки ------------------------- */
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const epParam = Number(sp.get("ep"));
    const sParam = Number(sp.get("s"));
    const trParam = Number(sp.get("tr"));

    // setState синхронно внутри эффекта запрещён правилом
    // react-hooks/set-state-in-effect — применяем в следующем кадре.
    const raf = requestAnimationFrame(() => {
      if (trParam && translations.some((t) => t.id === trParam) && trParam !== transId) {
        const opt = translations.find((t) => t.id === trParam);
        if (opt) void switchTranslation(opt, { silent: true, keepEpisode: epParam || undefined, season: sParam });
        return;
      }
      if (sParam && initialDetail.seasons.some((s) => s.number === sParam)) setSeason(sParam);
      if (epParam) setEpisode(epParam);
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Глубокая ссылка вида ?tr=910 после догрузки списка.
   *
   * На первом проходе список может быть урезан, и нужной озвучки в нём нет —
   * тогда ссылка «молча» не срабатывает. Повторяем попытку, когда список
   * догрузился, но ровно один раз на параметр.
   */
  const appliedTr = useRef<number | null>(null);
  useEffect(() => {
    if (translations.length > 1) return;
    const trParam = Number(new URLSearchParams(window.location.search).get("tr"));
    if (!trParam || appliedTr.current === trParam) return;
    const option = studioList.find((item) => item.id === trParam);
    if (!option) return;
    const raf = requestAnimationFrame(() => {
      appliedTr.current = trParam;
      void switchTranslation(option, { silent: true });
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studioList]);

  /* --------------------------- Смена источника ----------------------- */
  function switchSource(next: PlayerSource) {
    if (next === source) return;

    // Кнопкой источника тоже выбирается дорожка альтернативы — держим
    // список озвучек в согласии с тем, что реально играет.
    if (isAltSource(next)) {
      let nextTransId: number;
      if (next === "anilibria") {
        if (!ani) return;
        nextTransId = ANILIBERTY_TR;
      } else if (next === "sameband") {
        if (!sb) return;
        nextTransId = SAMEBAND_TR;
      } else if (next === "aniboom") {
        const first =
          aniboomVoices.find((item) => item.type === "voice") ?? aniboomVoices[0];
        if (!first) return;
        nextTransId = first.id;
      } else {
        const first = cvhVoices.find((item) => item.type === "voice") ?? cvhVoices[0];
        if (!first) return;
        nextTransId = first.id;
      }

      if (!isAltSource(source)) {
        sourceBeforeAlt.current = source;
        transIdBeforeAlt.current = transId;
      }
      setTransId(nextTransId);
    } else if (isAltSource(source)) {
      setTransId(transIdBeforeAlt.current);
    }

    // Возврат на Kodik: iframe монтируется заново — спиннер до onLoad
    if (next === "kodik") setPlayerLoading(true);
    setSource(next);
  }

  /** Выбор плеера в меню «Источник» */
  function pickSourceMenu(next: SourcePick) {
    setSourcePick(next);
    setSourceMenuOpen(false);
    if (next === "auto") {
      const best = pickDefaultVoice(mergedVoices, studioList.find((t) => t.id === transId)?.title);
      if (best) void switchTranslation(best, { silent: true, keepEpisode: episode, season });
      return;
    }
    if (next === "cvh" || next === "aniboom") {
      switchSource(next);
      return;
    }
    // Kodik / AniGalaxy: озвучки Kodik, различается только плеер
    const kodikTr = isAltSource(source) ? transIdBeforeAlt.current : transId;
    switchSource(next);
    if (!studioList.some((t) => t.id === kodikTr)) setTransId(studioList[0]?.id ?? null);
  }

  /* --------------------- Глубокая ссылка на альтернативу --------------- */
  /**
   * `?tr=-10000` (CVH), `?tr=-2` (SameBand), `?tr=-1` (AniLiberty).
   * Список альтернатив появляется асинхронно, поэтому ждём, пока нужный id
   * окажется в voiceList. Для положительных id Kodik работает эффект выше.
   */
  const appliedProviderTr = useRef<string | null>(null);
  /** Зритель сам выбрал озвучку — автовыбор 1080p больше не вмешивается */
  const userPicked = useRef(false);
  /**
   * Запоминаем `tr` с первого клиентского рендера. Синхронизация адреса
   * ниже может перезаписать его до того, как загрузится список CVH, а
   * глубокая ссылка всё равно должна примениться.
   */
  const [initialProviderTr] = useState<number | null | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    const param = Number(new URLSearchParams(window.location.search).get("tr"));
    return Number.isFinite(param) && param < 0 ? param : null;
  });
  const initialProviderCardId = useRef(detail.card.id);
  const providerTrKey = voiceList.map((item) => item.id).join(",");
  useEffect(() => {
    const trParam = initialProviderTr;
    if (!trParam) return;
    if (detail.card.id !== initialProviderCardId.current) return;
    // Пока зритель сам не выбрал источник — иначе не перебиваем его выбор
    if (isAltSource(source)) return;
    const option = voiceList.find((item) => item.id === trParam && item.provider);
    if (!option) return;
    const key = `${detail.card.id}:${trParam}`;
    if (appliedProviderTr.current === key) return;
    appliedProviderTr.current = key;
    void switchTranslation(option, { silent: true, keepEpisode: episode, season });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerTrKey, detail.card.id, source]);

  /**
   * Автовыбор: как только подтянулись дорожки 1080p, включаем лучшую —
   * ту же студию, что играла у Kodik, а если такой нет, первую по списку.
   */
  useEffect(() => {
    if (userPicked.current || initialProviderTr) return;
    if (detail.card.id !== initialDetail.card.id || isAltSource(source)) return;
    const best = pickDefaultVoice(voiceList, studioList.find((t) => t.id === transId)?.title);
    if (!best || !best.provider) return;
    const raf = requestAnimationFrame(() => {
      void switchTranslation(best, { silent: true, keepEpisode: episode, season });
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerTrKey]);

  /* ----------------------------- Визуал ------------------------------- */
  const activeOption = voiceList.find((t) => t.id === transId);
  const activeSeason = detail.seasons.find((s) => s.number === season) ?? detail.seasons[0];
  const episodeCount = activeSeason?.episodes.length ?? 0;
  const epList = activeSeason?.episodes ?? [];
  const epIdx = epList.findIndex((e) => e.number === episode);
  const prevEp = epIdx > 0 ? epList[epIdx - 1] : undefined;
  const nextEp = epIdx >= 0 && epIdx < epList.length - 1 ? epList[epIdx + 1] : undefined;

  /** Текущая серия всегда в кадре сетки: у длинных тайтлов она уходила за прокрутку */
  useEffect(() => {
    const box = epsRef.current;
    const cur = box?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!box || !cur) return;
    box.scrollTop = Math.max(0, cur.offsetTop - box.clientHeight / 2 + cur.offsetHeight / 2);
  }, [episode, season, switching]);

  /**
   * Горячие клавиши и подсветка кинозала из настроек.
   *
   * Внутри iframe Kodik нельзя ни остановить видео, ни сменить скорость —
   * это чужой документ. Поэтому из шести клавиш реально работают те, что
   * управляют страницей: следующая серия и полный экран. Остальные
   * включаются тумблерами и подействуют на альтернативный HLS-плеер,
   * который живёт на том же origin и слушается команд извне.
   */
  const prefs = usePrefs();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (target?.isContentEditable) return;

      const key = event.key.toLowerCase();
      if (prefs.keys.next && key === "n") {
        const eps = activeSeason?.episodes ?? [];
        const i = eps.findIndex((e) => e.number === episode);
        if (i >= 0 && i + 1 < eps.length) {
          event.preventDefault();
          setEpisode(eps[i + 1].number);
        }
        return;
      }
      if (prefs.keys.fullscreen && (key === "f" || key === "а")) {
        event.preventDefault();
        void toggleFs(document.getElementById("player-shell"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prefs.keys.next, prefs.keys.fullscreen, activeSeason, episode]);

  /** Подсветка кинозала: мягкий свет вокруг плеера, когда он включён */
  const ambient = prefs.ambient;

  return (
    <section id="watch" className="scroll-mt-24">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
        {/* ------------------------- Плеер ------------------------- */}
        <div className="min-w-0">
          {/* Выбор плеера: авто (лучшее качество) или конкретный источник */}
          <div className="wb-src relative mb-2.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={sourceMenuOpen}
              onClick={() => setSourceMenuOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-xl bg-white/6 px-3.5 py-2 text-xs font-bold text-white ring-1 ring-white/10 transition hover:bg-white/10"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-white/70" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
                <path d="M3 8h18v12H3zM3 8l2-4h4l-2 4M10 8l2-4h4l-2 4M17 8l2-4h2" />
              </svg>
              {SOURCE_LABEL[sourcePick]}
              <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 transition ${sourceMenuOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {sourceMenuOpen && (
              <>
                <button type="button" aria-label="Закрыть меню" className="fixed inset-0 z-30 cursor-default" onClick={() => setSourceMenuOpen(false)} />
                <ul role="listbox" aria-label="Источник" className="absolute left-0 top-[calc(100%+6px)] z-40 min-w-[220px] rounded-xl border border-line bg-[#0d0d15]/98 p-1.5 shadow-[0_28px_60px_-24px_rgba(0,0,0,1)] backdrop-blur-xl animate-fade-in">
                  {SOURCE_ITEMS.map((item) => {
                    const available =
                      item.id === "auto" ||
                      (item.id === "cvh" ? cvhVoices.length > 0 : item.id === "aniboom" ? aniboomVoices.length > 0 : studioList.length > 0);
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={sourcePick === item.id}
                          disabled={!available}
                          onClick={() => pickSourceMenu(item.id)}
                          className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                            sourcePick === item.id ? "bg-accent/20 text-white ring-1 ring-accent/40" : "text-white/80 hover:bg-white/8 hover:text-white"
                          }`}
                        >
                          <span>{item.label}</span>
                          <span className="text-[11px] font-medium text-muted">{available ? item.hint : "нет для тайтла"}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>

            {/* Сцена: на телефоне плеер во всю ширину и липнет под шапкой,
              чтобы список серий листался, пока серия идёт */}
          <div className="wb-stage">
          {/* Оболочка плеера — см. AltPlayer: тот ищет своё «плеер» по этому id */}
          <div
            id="player-shell"
            className={`wb-shell relative aspect-video w-full overflow-hidden rounded-2xl bg-black ring-1 ring-white/12 shadow-[0_40px_80px_-40px_rgba(0,0,0,1)] ${
              ambient ? "ag-ambient" : ""
            }`}
          >
            {playSource !== "kodik" ? (
              // Наш плеер: та же панель, качество, скорости и позиции.
              // AniGalaxy играет прямые HLS-манифесты Kodik (серия известна),
              // AniLiberty — потоки релиза, подтверждённого по id Shikimori.
              <AltPlayer
                key={`${detail.card.id}:${playSource}`}
                query={detail.card.title}
                altQuery={detail.card.titleOrig ?? detail.card.otherTitles?.[0]}
                year={detail.card.year}
                episode={episode}
                titleId={detail.card.id}
                backend={playSource === "anigalaxy" ? "kodik" : playSource}
                alias={playSource === "anilibria" ? ani?.alias : undefined}
                cvhId={detail.card.shikimoriId}
                cvhStudio={playSource === "cvh" ? activeOption?.studio : undefined}
                samebandUrl={playSource === "sameband" ? sb?.url : undefined}
                aniboomUrl={playSource === "aniboom" ? activeOption?.url : undefined}
                kodikId={detail.card.id}
                season={activeSeason?.number ?? season}
                onBack={() => switchSource("kodik")}
                malId={detail.card.shikimoriId}
                nav={isSerial ? {
                  seasons: detail.seasons,
                  season: activeSeason?.number ?? season,
                  voices: voiceList,
                  voiceId: transId,
                  onPickEpisode: (sn, ep) => { setSeason(sn); setEpisode(ep); },
                  onPickVoice: (id) => { const o = voiceList.find((x) => x.id === id); if (o) void switchTranslation(o, { keepEpisode: episode, season: activeSeason?.number }); },
                } : undefined}
                hasNext={(activeSeason?.episodes.findIndex((e) => e.number === episode) ?? -1) + 1 > 0 && (activeSeason?.episodes.findIndex((e) => e.number === episode) ?? -1) + 1 < (activeSeason?.episodes.length ?? 0)}
                onNextEpisode={() => {
                  const eps = activeSeason?.episodes ?? [];
                  const i = eps.findIndex((e) => e.number === episode);
                  if (i >= 0 && i + 1 < eps.length) setEpisode(eps[i + 1].number);
                }}
              />
            ) : playerSrc ? (
              // Без `*` Chrome трактует имя как «только для своего origin» и
              // cross-site кадру Kodik выдаёт отказ («Disallowed by permissions
              // policy»): полноэкранный режим, автозапуск и PiP не работали.
              <>
                <iframe
                  key={`${playerSrc}:${shield ? "s" : "o"}`}
                  ref={iframeRef}
                  src={playerSrc}
                  title="Плеер Kodik"
                  className="absolute inset-0 h-full w-full transition-[filter] duration-500 ease-out"
                  style={{ filter: PLAYER_FILTER }}
                  allow="autoplay *; fullscreen *; picture-in-picture *; encrypted-media *"
                  sandbox={shield ? SHIELD_SANDBOX : undefined}
                  allowFullScreen
                  loading="lazy"
                  onLoad={() => setPlayerLoading(false)}
                />
                <button
                  type="button"
                  onClick={() => { setPlayerLoading(true); setShield(!shield); }}
                  aria-pressed={shield}
                  title={shield ? "Щит включён: всплывающие окна и редиректы блокируются. Нажмите, если видео не запускается." : "Щит выключен — включить блокировку всплывающей рекламы"}
                  className={`absolute left-2 top-2 z-10 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold backdrop-blur transition ${shield ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/40" : "bg-black/55 text-white/70 ring-1 ring-white/15"}`}
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3z" /></svg>
                  Щит {shield ? "вкл" : "выкл"}
                </button>
              </>
            ) : (
              <div className="grid h-full place-items-center text-sm text-muted">
                Плеер недоступен
              </div>
            )}

            {/* Оверлей загрузки (только iframe: у альтернативы свой скелет) */}
            {playerLoading && playSource === "kodik" && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center bg-ink/70 backdrop-blur-sm animate-fade-in">
                <span className="h-9 w-9 animate-spin-slow rounded-full border-[3px] border-white/20 border-t-accent" />
              </div>
            )}

            {/* Скелетон при смене озвучки */}
            {switching && playSource === "kodik" && (
              <div className="absolute inset-0 grid place-items-center bg-ink/60 animate-fade-in">
                <span className="text-xs font-semibold uppercase tracking-widest text-muted">
                  Меняем озвучку…
                </span>
              </div>
            )}
          </div>
          </div>

          {/* Подпись под плеером */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {detail.card.title}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {isSerial
                  ? `Сезон ${activeSeason?.number ?? 1} · Серия ${episode} из ${episodeCount}`
                  : "Полная версия"}
                {activeOption && <> · {activeOption.title}</>}
                {playSource === "anilibria" && <> · AniLiberty</>}
                {playSource === "anigalaxy" && <> · AniGalaxy</>}
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted">
              <span className="rounded-md bg-white/6 px-2 py-1 ring-1 ring-white/10">
                {kindLabel(detail.card.kind) ?? "Видео"}
              </span>
              {statusLabel(detail.card.status) && (
                <span className="rounded-md bg-white/6 px-2 py-1 ring-1 ring-white/10">
                  {statusLabel(detail.card.status)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ------------------- Боковая панель ------------------- */}
        <aside className="wb-aside flex min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface/75 backdrop-blur-sm">
          {/* Озвучка */}
          <div className="border-b border-line p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                Студия озвучки
              </span>
              <span className="rounded-md bg-white/6 px-1.5 py-0.5 text-[10px] font-semibold text-muted ring-1 ring-white/10">
                {voiceList.length || 1}
              </span>
            </div>

            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={menuOpen}
                className="btn-ghost flex w-full items-center justify-between gap-2 rounded-xl bg-white/7 px-3 py-2.5 text-left text-sm font-semibold text-white ring-1 ring-white/12 hover:bg-white/12"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-mint shadow-[0_0_10px_rgba(61,220,151,.9)]" />
                  <span className="truncate">{activeOption?.title ?? "Озвучка"}</span>
                </span>
                <svg
                  viewBox="0 0 24 24"
                  className={`h-4 w-4 shrink-0 text-muted transition-transform ${menuOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                >
                  <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {menuOpen && (
                <button type="button" aria-label="Закрыть список озвучек" className="wb-vback" onClick={() => setMenuOpen(false)} />
              )}
              {menuOpen && (
                <ul
                  role="listbox"
                  className="wb-vmenu absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-64 overflow-y-auto rounded-xl border border-line bg-[#0d0d15]/98 p-1.5 shadow-[0_28px_60px_-24px_rgba(0,0,0,1)] backdrop-blur-xl animate-fade-in"
                >
                  <li className="wb-vhead" aria-hidden>
                    <span>Студия озвучки</span>
                    <button type="button" tabIndex={-1} onClick={() => setMenuOpen(false)}>Готово</button>
                  </li>
                  {voiceList.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={t.id === transId}
                        onClick={() => switchTranslation(t)}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition-colors ${
                          t.id === transId
                            ? "bg-accent/20 text-white ring-1 ring-accent/40"
                            : "text-white/75 hover:bg-white/8 hover:text-white"
                        }`}
                      >
                        <span className="truncate font-semibold">{t.title}</span>
                        <span className="flex shrink-0 items-center gap-2 text-[11px] text-muted">
                          {t.episodeCount ? <span>{t.episodeCount} эп.</span> : null}
                          {t.quality ? (
                            <span className={`rounded px-1.5 py-0.5 font-bold ${t.quality >= 1080 ? "bg-mint/20 text-mint" : "bg-white/10"}`}>
                              {t.quality >= 1080 ? "FHD" : `${t.quality}p`}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Серии */}
          {isSerial ? (
            <div className="flex min-h-0 flex-1 flex-col">
              {/* Сезоны */}
              {detail.seasons.length > 1 && (
                <div className="rail flex gap-2 overflow-x-auto border-b border-line px-3 py-2.5">
                  {detail.seasons.map((s) => (
                    <button
                      key={s.number}
                      type="button"
                      onClick={() => {
                        setSeason(s.number);
                        setEpisode(s.episodes[0]?.number ?? 1);
                      }}
                      className={`btn-ghost shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold ring-1 ${
                        s.number === season
                          ? "bg-accent/20 text-white ring-accent/50"
                          : "bg-white/5 text-muted ring-white/10 hover:text-white"
                      }`}
                    >
                      Сезон {s.number}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between gap-2 px-3 pt-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  Серии
                </span>
                <div className="wb-epnav">
                  <button
                    type="button"
                    aria-label="Предыдущая серия"
                    disabled={!prevEp}
                    onClick={() => prevEp && setEpisode(prevEp.number)}
                  >
                    ‹
                  </button>
                  <span>
                    {episode} <small>из {episodeCount}</small>
                  </span>
                  <button
                    type="button"
                    aria-label="Следующая серия"
                    disabled={!nextEp}
                    onClick={() => nextEp && setEpisode(nextEp.number)}
                  >
                    ›
                  </button>
                </div>
              </div>

              {/* Сетка серий */}
              <div ref={epsRef} className="wb-eps max-h-[300px] overflow-y-auto p-3 lg:max-h-[460px]">
                {switching ? (
                  <div className="grid grid-cols-5 gap-2">
                    {Array.from({ length: 15 }).map((_, i) => (
                      <div key={i} className="skeleton h-9 rounded-lg" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-5 gap-2 sm:grid-cols-6 lg:grid-cols-5">
                    {activeSeason?.episodes.map((ep) => {
                      const active = ep.number === episode;
                      return (
                        <button
                          key={ep.number}
                          type="button"
                          onClick={() => setEpisode(ep.number)}
                          title={truncate(ep.title, 60) ?? `Серия ${ep.number}`}
                          aria-pressed={active}
                          className={`wb-ep btn-ghost h-10 rounded-lg text-sm font-bold tabular-nums ring-1 transition-all ${
                            active ? "wb-ep--on" : ""} ${
                            active
                              ? "bg-gradient-to-br from-accent to-accent-2 text-white ring-transparent shadow-[0_10px_22px_-12px_rgba(31,123,255,1)]"
                              : "bg-white/5 text-white/75 ring-white/10 hover:bg-white/12 hover:text-white"
                          }`}
                        >
                          {ep.number}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 text-sm text-muted">
              <p className="font-semibold text-white">Полный фильм</p>
              <p className="mt-1">
                Длительность: {detail.card.duration ? `${detail.card.duration} мин.` : "неизвестно"}.
                Выберите озвучку выше — плеер переключится автоматически.
              </p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
