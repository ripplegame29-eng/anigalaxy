"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { kindLabel, statusLabel, truncate } from "@/lib/anime";
import { recordWatch, tickWatch } from "@/lib/history";
import { rememberTitle } from "@/lib/titles";
import { usePrefs } from "@/lib/prefs";
import { PLAYER_FILTER } from "@/lib/quality";
import { progressEmit } from "@/lib/progression/events";
import type { TitleDetail, TranslationOption } from "@/lib/types";
import { AltPlayer } from "./AltPlayer";

/**
 * Источник видео в блоке просмотра:
 *   «kodik»      — встроенный плеер Kodik;
 *   «anigalaxy»  — наш плеер на прямых HLS-потоках Kodik;
 *   «anilibria»  — наш плеер на каталоге AniLiberty.
 * У «anigalaxy» и «anilibria» панель управления одна и та же.
 */
type PlayerSource = "kodik" | "anigalaxy" | "anilibria";

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
  const [switching, setSwitching] = useState(false);
  const [playerLoading, setPlayerLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  // Источник видео: Kodik (по умолчанию), AniGalaxy (HLS Kodik) или AniLiberty
  const [source, setSource] = useState<PlayerSource>("kodik");

  // Кадр Kodik показывается как отдаёт источник: кнопки «Апскейл» под
  // плеером больше нет, а вместе с ней и конвейера захвата вкладки
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const menuRef = useRef<HTMLDivElement>(null);
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

  /* ------------------------- Глубокие ссылки ------------------------- */
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const epParam = Number(sp.get("ep"));
    const sParam = Number(sp.get("s"));
    const trParam = Number(sp.get("tr"));

    if (trParam && translations.some((t) => t.id === trParam) && trParam !== transId) {
      const opt = translations.find((t) => t.id === trParam);
      if (opt) void switchTranslation(opt, { silent: true, keepEpisode: epParam || undefined, season: sParam });
      return;
    }
    // season/episode применяются в callback'е rAF: setState синхронно внутри
    // эффекта запрещён правилом react-hooks/set-state-in-effect
    const raf = requestAnimationFrame(() => {
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
    appliedTr.current = trParam;
    void switchTranslation(option, { silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studioList]);

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

  /* --------------------------- Смена озвучки -------------------------- */
  async function switchTranslation(
    option: TranslationOption,
    opts: { silent?: boolean; keepEpisode?: number; season?: number } = {},
  ) {
    setMenuOpen(false);
    if (option.id === transId && !opts.silent) return;

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

  /* --------------------------- Смена источника ----------------------- */
  function switchSource(next: PlayerSource) {
    if (next === source) return;
    // Возврат на Kodik: iframe монтируется заново — спиннер до onLoad
    if (next === "kodik") setPlayerLoading(true);
    setSource(next);
  }

  /* ----------------------------- Визуал ------------------------------- */
  const activeOption = studioList.find((t) => t.id === transId);
  const activeSeason = detail.seasons.find((s) => s.number === season) ?? detail.seasons[0];
  const episodeCount = activeSeason?.episodes.length ?? 0;

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
        const shell = document.getElementById("player-shell");
        if (shell && document.fullscreenElement) void document.exitFullscreen();
        else void shell?.requestFullscreen?.();
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
          {/* Переключатель источника: встроенный Kodik, наш плеер AniGalaxy
              на прямых HLS-потоках Kodik или каталог AniLiberty */}
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                Источник
              </span>
              <div className="flex rounded-xl bg-white/6 p-1 ring-1 ring-white/10">
                <button
                  type="button"
                  onClick={() => switchSource("kodik")}
                  aria-pressed={source === "kodik"}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                    source === "kodik"
                      ? "bg-accent text-white shadow-[0_8px_18px_-10px_rgba(31,123,255,1)]"
                      : "text-muted hover:text-white"
                  }`}
                >
                  Kodik
                </button>
                <button
                  type="button"
                  onClick={() => switchSource("anigalaxy")}
                  aria-pressed={source === "anigalaxy"}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                    source === "anigalaxy"
                      ? "bg-accent text-white shadow-[0_8px_18px_-10px_rgba(31,123,255,1)]"
                      : "text-muted hover:text-white"
                  }`}
                >
                  AniGalaxy
                </button>
                <button
                  type="button"
                  onClick={() => switchSource("anilibria")}
                  aria-pressed={source === "anilibria"}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                    source === "anilibria"
                      ? "bg-mint text-ink shadow-[0_8px_18px_-10px_rgba(61,220,151,.8)]"
                      : "text-muted hover:text-white"
                  }`}
                >
                  AniLiberty · 1080p
                </button>
              </div>
            </div>
            <span className="text-[11px] text-muted">
              {source === "kodik"
                ? "основной плеер"
                : source === "anigalaxy"
                  ? "прямые HLS-потоки"
                  : "альтернатива · HLS до 1080p"}
            </span>
          </div>

            {/* Оболочка плеера — см. AltPlayer: тот ищет своё «плеер» по этому id */}
          <div
            id="player-shell"
            className={`wb-shell relative aspect-video w-full overflow-hidden rounded-2xl bg-black ring-1 ring-white/12 shadow-[0_40px_80px_-40px_rgba(0,0,0,1)] ${
              ambient ? "ag-ambient" : ""
            }`}
          >
            {source !== "kodik" ? (
              // Наш плеер: та же панель, качество, скорости и позиции.
              // AniGalaxy играет прямые HLS-манифесты Kodik (серия известна),
              // AniLiberty — потоки найденного по названию тайтла.
              <AltPlayer
                key={`${detail.card.id}:${source}`}
                query={detail.card.title}
                altQuery={detail.card.titleOrig ?? detail.card.otherTitles?.[0]}
                year={detail.card.year}
                episode={episode}
                titleId={detail.card.id}
                backend={source === "anigalaxy" ? "kodik" : "anilibria"}
                kodikId={detail.card.id}
                season={activeSeason?.number ?? season}
                onBack={() => switchSource("kodik")}
                malId={detail.card.shikimoriId}
                nav={isSerial ? {
                  seasons: detail.seasons,
                  season: activeSeason?.number ?? season,
                  voices: studioList,
                  voiceId: transId,
                  onPickEpisode: (sn, ep) => { setSeason(sn); setEpisode(ep); },
                  onPickVoice: (id) => { const o = studioList.find((x) => x.id === id); if (o) void switchTranslation(o, { keepEpisode: episode, season: activeSeason?.number }); },
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
              <iframe
                key={playerSrc}
                ref={iframeRef}
                src={playerSrc}
                title="Плеер Kodik"
                className="absolute inset-0 h-full w-full transition-[filter] duration-500 ease-out"
                style={{ filter: PLAYER_FILTER }}
                allow="autoplay *; fullscreen *; picture-in-picture *; encrypted-media *"
                allowFullScreen
                loading="lazy"
                onLoad={() => setPlayerLoading(false)}
              />
            ) : (
              <div className="grid h-full place-items-center text-sm text-muted">
                Плеер недоступен
              </div>
            )}

            {/* Оверлей загрузки (только iframe: у альтернативы свой скелет) */}
            {playerLoading && source === "kodik" && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center bg-ink/70 backdrop-blur-sm animate-fade-in">
                <span className="h-9 w-9 animate-spin-slow rounded-full border-[3px] border-white/20 border-t-accent" />
              </div>
            )}

            {/* Скелетон при смене озвучки */}
            {switching && source === "kodik" && (
              <div className="absolute inset-0 grid place-items-center bg-ink/60 animate-fade-in">
                <span className="text-xs font-semibold uppercase tracking-widest text-muted">
                  Меняем озвучку…
                </span>
              </div>
            )}
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
                {source === "anilibria" && <> · AniLiberty</>}
                {source === "anigalaxy" && <> · AniGalaxy</>}
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
                {studioList.length || 1}
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
                <ul
                  role="listbox"
                  className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-64 overflow-y-auto rounded-xl border border-line bg-[#0d0d15]/98 p-1.5 shadow-[0_28px_60px_-24px_rgba(0,0,0,1)] backdrop-blur-xl animate-fade-in"
                >
                  {studioList.map((t) => (
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
                        {t.episodeCount ? (
                          <span className="shrink-0 text-[11px] text-muted">{t.episodeCount} эп.</span>
                        ) : null}
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

              <div className="flex items-center justify-between px-3 pt-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  Серии
                </span>
                <span className="text-[11px] text-muted">{episodeCount}</span>
              </div>

              {/* Сетка серий */}
              <div className="wb-eps max-h-[300px] overflow-y-auto p-3 lg:max-h-[460px]">
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
