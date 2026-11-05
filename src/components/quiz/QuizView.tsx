"use client";

/**
 * Страница квиза AniGalaxy: раунды «Угадай тайтл по opening'у».
 *
 * Два режима:
 *   - frame — кадр из opening'а;
 *   - song  — 30-секундный отрывок песни из opening'а.
 *
 * Раунд живёт на сервере (Route Handler `/api/quiz` собирает вопросы из
 * топ-результатов Kodik) и передается клиенту целиком — игрок не должен
 * знать, какие тайтлы входят в раунд. После закрытия раунда движок
 * прогрессии получает событие `QUIZ_COMPLETED` и выдает XP/AC по правилу
 * из конфига (раз в сутки).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { progressEmit } from "@/lib/progression/events";
import { PROGRESSION_CONFIG } from "@/lib/progression/progression.config";
import { quizExcludeHash } from "@/lib/quiz";
import type { QuizMode, QuizOpening, QuizRound, QuizQuestion } from "@/lib/quiz";
import type { AnimeCard } from "@/lib/types";
import "../../app/quiz.css";

type Phase = "loading" | "ready" | "revealed" | "done" | "error";

const QUIZ_RULE_ID = "QUIZ_COMPLETED";

/**
 * Тайтлы последних раундов: хеши уходят в `/api/quiz?exclude=...`, чтобы
 * новые раунды не повторяли уже показанные вопросы. Без этого пул из топов
 * каталога «засыхает» после пары игр.
 */
const RECENT_KEY = "animehub:quiz:recent";
const RECENT_LIMIT = 30;

/**
 * Громкость отрывка: превью iTunes начинаются резко и громко, поэтому по
 * умолчанию играем тише полного и запоминаем выбор игрока между раундами.
 */
const VOLUME_KEY = "animehub:quiz:volume";
const DEFAULT_VOLUME = 0.35;
/** Сколько миллисекунд поднимаем громкость от нуля до выбранной */
const FADE_MS = 700;

function readVolume(): number {
  try {
    const raw = window.localStorage.getItem(VOLUME_KEY);
    const value = raw === null ? NaN : Number(raw);
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : DEFAULT_VOLUME;
  } catch {
    return DEFAULT_VOLUME;
  }
}

/**
 * Личный рекорд по режимам: сколько правильных ответов удалось взять за
 * раунд. Хранится отдельно от прогрессии — это локальная статистика игрока.
 */
const BEST_KEY = "animehub:quiz:best";

type BestScores = Record<QuizMode, number>;

const EMPTY_BEST: BestScores = { frame: 0, song: 0 };

function readBest(): BestScores {
  try {
    const raw = window.localStorage.getItem(BEST_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<BestScores>) : {};
    const score = (value: unknown): number =>
      typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
    return { frame: score(parsed.frame), song: score(parsed.song) };
  } catch {
    return EMPTY_BEST;
  }
}

function readRecentHashes(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function rememberRound(round: QuizRound): void {
  const hashes = round.questions.map((question) => quizExcludeHash(question.card.title));
  const merged = Array.from(new Set([...hashes, ...readRecentHashes()])).slice(0, RECENT_LIMIT);
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(merged));
  } catch {
    /* localStorage недоступен — просто играем без антиповторов */
  }
}

/** Высота столбиков «волны» — фиксированный рисунок, чтобы не дёргался */
const WAVE = [30, 55, 80, 45, 95, 65, 35, 75, 100, 50, 85, 40, 70, 95, 60, 30, 80, 55, 90, 45, 75, 100, 65, 40];

/**
 * Случайный, но стабильный фрагмент кадра: точка фокуса и зум выводятся из
 * seed'а раунда/вопроса. Полный кадр из opening'а слишком легко угадать по
 * композиции и титрам, поэтому до ответа показываем увеличенную деталь —
 * лицо, глаз, силуэт или кусок фона.
 */
function frameCrop(seed: string): { x: number; y: number; zoom: number } {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const h = hash >>> 0;
  // Фокус ближе к центру и верхней трети: там чаще всего лицо/взгляд.
  // По Y держимся 33–66%: у YouTube-превью hq2 сверху и снизу чёрные полосы
  // (4:3-кадр с 16:9-контентом), и зум не должен их показывать.
  const x = 28 + (h % 45); // 28–72%
  const y = 33 + ((h >>> 8) % 34); // 33–66%
  const zoom = 1.9 + ((h >>> 16) % 70) / 100; // 1.9–2.59×
  return { x, y, zoom };
}

export function QuizView() {
  const [mode, setMode] = useState<QuizMode>("frame");
  const [round, setRound] = useState<QuizRound | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [index, setIndex] = useState(0);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [pickedCorrect, setPickedCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [best, setBest] = useState<BestScores>(EMPTY_BEST);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [isRecord, setIsRecord] = useState(false);
  const [copied, setCopied] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  /** Актуальная громкость: фейд-ин и обработчики читают её без ре-рендера */
  const volumeRef = useRef(DEFAULT_VOLUME);
  /** Идущий фейд-ин: интервал отменяем при паузе и ручной регулировке */
  const fadeRef = useRef<number | null>(null);

  const question: QuizQuestion | null = round?.questions[index] ?? null;
  const total = round?.questions.length ?? 0;
  const song = question?.song;
  const rule = PROGRESSION_CONFIG.rules[QUIZ_RULE_ID];
  const bestScore = best[mode];

  const cancelFade = useCallback(() => {
    if (fadeRef.current !== null) {
      window.clearInterval(fadeRef.current);
      fadeRef.current = null;
    }
  }, []);

  const stopAudio = useCallback(() => {
    cancelFade();
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = volumeRef.current;
    }
    setPlaying(false);
    setAudioProgress(0);
  }, [cancelFade]);

  /* ------------------------------ Загрузка раунда --------------------------- */
  const loadRound = useCallback(
    async (nextMode: QuizMode) => {
      setPhase("loading");
      setIndex(0);
      setPickedId(null);
      setPickedCorrect(null);
      setScore(0);
      setAnswers({});
      setIsRecord(false);
      setCopied(false);
      stopAudio();
      try {
        const params = new URLSearchParams({ mode: nextMode });
        const recent = readRecentHashes();
        if (recent.length) params.set("exclude", recent.join(","));
        const res = await fetch(`/api/quiz?${params.toString()}`, {
          signal: AbortSignal.timeout(25000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { round?: QuizRound };
        const next = data?.round;
        if (!next || next.questions.length === 0) throw new Error("empty round");
        rememberRound(next);
        setRound(next);
        setPhase("ready");
      } catch {
        setRound(null);
        setPhase("error");
      }
    },
    [stopAudio],
  );

  useEffect(() => {
    // Синхронный вызов из эффекта триггерит `react-hooks/set-state-in-effect`:
    // ленивый сетап таймера — тот же приём, что и в CommandPalette.
    const id = window.setTimeout(() => void loadRound(mode), 0);
    return () => window.clearTimeout(id);
  }, [loadRound, mode]);

  /* ------------------------------ Аудиоплеер ------------------------------- */
  // Сохранённую громкость читаем после монтирования: обращение к localStorage
  // в рендере ломает SSR-гидрацию
  useEffect(() => {
    const id = window.setTimeout(() => {
      const saved = readVolume();
      volumeRef.current = saved;
      setVolume(saved);
      if (audioRef.current) audioRef.current.volume = saved;
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  // Личный рекорд читаем так же — после монтирования, без SSR-расхождений
  useEffect(() => {
    const id = window.setTimeout(() => setBest(readBest()), 0);
    return () => window.clearTimeout(id);
  }, []);

  // Новый отрывок — сразу выставляем выбранную громкость: иначе браузер
  // начинает с 100% и первый удар опенинга бьёт по ушам
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    cancelFade();
    audio.volume = volumeRef.current;
  }, [song?.previewUrl, cancelFade]);

  const fadeIn = useCallback(
    (audio: HTMLAudioElement) => {
      cancelFade();
      const target = volumeRef.current;
      // 0% — играем молча, чтобы «выключить звук» не требовало паузы
      audio.volume = 0;
      if (target <= 0) return;

      const started = performance.now();
      fadeRef.current = window.setInterval(() => {
        const t = Math.min(1, (performance.now() - started) / FADE_MS);
        audio.volume = target * t;
        if (t >= 1) cancelFade();
      }, 40);
    },
    [cancelFade],
  );

  const changeVolume = useCallback(
    (value: number) => {
      const next = Math.min(1, Math.max(0, value));
      volumeRef.current = next;
      setVolume(next);
      cancelFade();
      if (audioRef.current) audioRef.current.volume = next;
      try {
        window.localStorage.setItem(VOLUME_KEY, String(next));
      } catch {
        // Приватный режим — просто не запоминаем выбор
      }
    },
    [cancelFade],
  );

  const toggleAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      fadeIn(audio);
      void audio.play().catch(() => {
        cancelFade();
        setPlaying(false);
      });
    } else {
      cancelFade();
      audio.pause();
      audio.volume = volumeRef.current;
    }
  }, [cancelFade, fadeIn]);

  /* ------------------------------ Ответы ---------------------------------- */
  const answer = useCallback(
    (option: AnimeCard) => {
      if (phase !== "ready" || !round || pickedId) return;
      const current = round.questions[index];
      const correct = option.id === current.answerId;
      setPickedId(option.id);
      setPickedCorrect(correct);
      setAnswers((prev) => ({ ...prev, [current.id]: correct }));
      const nextScore = score + (correct ? 1 : 0);
      setScore(nextScore);
      stopAudio();

      if (index === round.questions.length - 1) {
        // Раунд закрыт — выдаём награду через движок прогрессии
        const record = nextScore > (best[mode] ?? 0);
        if (record) {
          const updated: BestScores = { ...best, [mode]: nextScore };
          setBest(updated);
          try {
            window.localStorage.setItem(BEST_KEY, JSON.stringify(updated));
          } catch {
            // Приватный режим — рекорд просто не сохранится
          }
        }
        setIsRecord(record);
        progressEmit({
          type: "QUIZ_COMPLETED",
          quizId: round.id,
          correct: nextScore,
          total: round.questions.length,
        });
        setPhase("done");
      } else {
        setPhase("revealed");
      }
    },
    [phase, pickedId, round, index, score, best, mode, stopAudio],
  );

  const next = useCallback(() => {
    if (phase !== "revealed" || !round) return;
    stopAudio();
    setIndex((i) => i + 1);
    setPickedId(null);
    setPickedCorrect(null);
    setPhase("ready");
  }, [phase, round, stopAudio]);

  const share = useCallback(async () => {
    const label = mode === "frame" ? "кадр из OP" : "песня из OP";
    const text = `AniGalaxy · Квиз (${label}): ${score}/${total} правильных`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Буфер обмена недоступен — просто не подтверждаем копирование
    }
  }, [score, total, mode]);

  // Горячие клавиши: 1–4 — ответ, Space — отрывок, Enter — дальше/новый раунд
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) {
        return;
      }
      const onButton = target?.tagName === "BUTTON";

      if (phase === "ready" && question) {
        const digit = Number(event.key);
        if (Number.isInteger(digit) && digit >= 1 && digit <= question.options.length) {
          event.preventDefault();
          answer(question.options[digit - 1]);
          return;
        }
        if (event.code === "Space" && song && !onButton) {
          event.preventDefault();
          toggleAudio();
        }
        return;
      }

      if (phase === "revealed" && (event.key === "Enter" || event.key.toLowerCase() === "n")) {
        event.preventDefault();
        next();
        return;
      }

      if (phase === "done" && event.key === "Enter") {
        event.preventDefault();
        void loadRound(mode);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, question, song, answer, next, toggleAudio, loadRound, mode]);

  /* --------------------------------- Экран --------------------------------- */
  const isLast = round ? index === round.questions.length - 1 : false;
  const progressNow = index + (phase === "revealed" ? 1 : 0);
  const progressPct = total > 0 ? Math.round((progressNow / total) * 100) : 0;
  const clue: QuizOpening | undefined = question?.op;
  // Кадр фокусируем по seed'у раунда: при ре-рендере фрагмент не «прыгает»
  const crop = question
    ? frameCrop(`${round?.id ?? ""}:${question.id}:${question.card.id}`)
    : null;

  const renderBody = () => {
    if (phase === "loading") {
      return (
        <div className="qg-skeleton" role="status" aria-live="polite">
          <span className="qg-sr">Собираем раунд про тайтлы…</span>
          <div className="qg-skel-progress" />
          <div className="qg-skel-card">
            <div className="qg-skel-line is-short" />
            <div className="qg-skel-frame" />
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="qg-skel-line" />
            ))}
          </div>
        </div>
      );
    }

    if (phase === "error") {
      return (
        <div className="qg-empty">
          Не удалось собрать раунд. Проверь соединение и попробуй ещё раз.
          <div style={{ marginTop: 14 }}>
            <button type="button" className="qg-cta" onClick={() => void loadRound(mode)}>
              Повторить
            </button>
          </div>
        </div>
      );
    }

    if (phase === "done") {
      const pct = total > 0 ? Math.round((score / total) * 100) : 0;
      return (
        <div className="qg-result">
          <p className="qg-hint">Раунд закрыт</p>
          <div className="qg-ring" style={{ "--qg-pct": `${pct}%` } as CSSProperties}>
            <div className="qg-ring-inner">
              <b>
                {score}
                <span>/{total}</span>
              </b>
              <small>{pct}%</small>
            </div>
          </div>
          {isRecord ? <span className="qg-record">Новый рекорд режима</span> : null}
          <p>
            {score === total
              ? "Идеальный раунд! Ты — энциклопедия AniGalaxy."
              : score >= Math.ceil(total / 2)
                ? "Хороший результат! Следующий раунд будет не хуже."
                : "Не печалься — каждый раунд учит. Следующий шанс будет!"}
          </p>

          {round ? (
            <ol className="qg-review" aria-label="Разбор ответов">
              {round.questions.map((item, i) => {
                const ok = answers[item.id] === true;
                return (
                  <li key={item.id} className={ok ? "is-ok" : "is-bad"}>
                    <span className="qg-review-ic" aria-hidden="true">
                      {ok ? "✓" : "✗"}
                    </span>
                    <span className="qg-review-n">{i + 1}</span>
                    <span className="qg-review-title">{item.card.title}</span>
                  </li>
                );
              })}
            </ol>
          ) : null}

          <div className="qg-result-actions">
            <button type="button" className="qg-cta" onClick={() => void loadRound(mode)}>
              Ещё раунд
            </button>
            <button type="button" className="qg-cta secondary" onClick={() => void share()}>
              {copied ? "Скопировано" : "Поделиться"}
            </button>
          </div>
          <p className="qg-note">
            +{rule.xp} XP · +{rule.ac ?? 0} AC за раунд · повтор награды — раз в сутки
          </p>
          {bestScore > 0 ? (
            <p className="qg-note">Лучший результат режима: {bestScore} правильных</p>
          ) : null}
        </div>
      );
    }

    if (!round || !question) {
      return (
        <div className="qg-empty">
          Ничего не нашли — попробуем собрать раунд ещё раз.
          <div style={{ marginTop: 14 }}>
            <button type="button" className="qg-cta" onClick={() => void loadRound(mode)}>
              Повторить
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="qg-stage">
        <div
          className="qg-progress"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span>
            Вопрос <b>{index + 1}</b> из {total}
          </span>
          <div className="qg-track">
            <i style={{ width: `${progressPct}%` }} />
          </div>
          <span>
            {progressPct}% · {score} ✓
          </span>
        </div>

        <div className={`qg-card${pickedCorrect === false ? " shake" : ""}`}>
          <p className="qg-hint">{question.hint}</p>
          {/* Название — это правильный ответ: до ответа не показываем даже размытым,
              иначе его угадывают по длине и силуэту букв */}
          {phase === "ready" ? (
            <h2 className="qg-title is-hidden" aria-label="Название скрыто до ответа">
              <span aria-hidden="true">???</span>
            </h2>
          ) : (
            <h2 className="qg-title">{question.card.title}</h2>
          )}

          {song ? (
            <div className={`qg-audio${playing ? " is-playing" : ""}`}>
              <button
                type="button"
                className="qg-play"
                onClick={toggleAudio}
                aria-label={playing ? "Пауза" : "Слушать отрывок"}
              >
                <span className={playing ? "qg-pause-ic" : "qg-play-ic"} aria-hidden />
              </button>
              <div className="qg-audio-body">
                <div className="qg-wave" aria-hidden="true">
                  {WAVE.map((height, i) => (
                    <i key={i} style={{ height: `${height}%`, animationDelay: `${i * 0.05}s` }} />
                  ))}
                </div>
                <div className="qg-audio-track">
                  <i style={{ width: `${Math.round(audioProgress * 100)}%` }} />
                </div>
                <p className="qg-audio-note">
                  {playing ? "Играет отрывок из opening'а" : "Нажми, чтобы послушать отрывок"}
                </p>
                <div className="qg-volume">
                  <span className="qg-volume-ic" aria-hidden="true" />
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={Math.round(volume * 100)}
                    onChange={(event) => changeVolume(Number(event.currentTarget.value) / 100)}
                    aria-label="Громкость отрывка"
                    title={`Громкость: ${Math.round(volume * 100)}%`}
                  />
                  <span className="qg-volume-val">{Math.round(volume * 100)}%</span>
                </div>
              </div>
              <audio
                ref={audioRef}
                src={song.previewUrl}
                preload="none"
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => {
                  cancelFade();
                  setPlaying(false);
                  setAudioProgress(0);
                }}
                onTimeUpdate={(event) => {
                  const audio = event.currentTarget;
                  setAudioProgress(audio.duration > 0 ? audio.currentTime / audio.duration : 0);
                }}
              />
            </div>
          ) : clue ? (
            <div
              className={`qg-frame${phase === "ready" ? " is-zoomed" : ""}`}
              role="img"
              aria-label={
                phase === "ready"
                  ? "Увеличенный фрагмент кадра из opening'а"
                  : "Кадр из opening'а"
              }
              style={{
                backgroundImage: `url("${clue.src}")`,
                backgroundSize:
                  phase === "ready" && crop ? `${Math.round(crop.zoom * 100)}% auto` : "100% auto",
                backgroundPosition:
                  phase === "ready" && crop ? `${crop.x}% ${crop.y}%` : "50% 50%",
              }}
            />
          ) : null}

          {phase === "revealed" && song ? <p className="qg-theme">{song.theme}</p> : null}

          <div className="qg-options">
            {question.options.map((option, i) => {
              const isAnswer = option.id === question.answerId;
              const isPicked = option.id === pickedId;
              const isWrongPick = isPicked && !isAnswer;
              const cls = [
                "qg-option",
                isAnswer && phase === "revealed" ? "is-right" : "",
                isWrongPick ? "is-wrong" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <button key={option.id} type="button" className={cls} disabled={phase === "revealed"} onClick={() => answer(option)}>
                  <span className="qg-ic">{String.fromCharCode(65 + i)}</span>
                  <span>{option.title}</span>
                  {isAnswer && phase === "revealed" ? (
                    <small className="qg-mark is-ok">✓ Верно</small>
                  ) : null}
                  {isWrongPick ? <small className="qg-mark is-bad">✗</small> : null}
                </button>
              );
            })}
          </div>

          {phase === "revealed" ? (
            <button type="button" className="qg-cta" onClick={next}>
              {isLast ? "Забрать награду" : "Дальше"}
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="qg-page">
      <div className="qg-wrap">
        <section className="qg-hero">
          <div>
            <p className="qg-eyebrow">AniGalaxy · Квиз</p>
            <h1>
              Угадай <em>тайтл</em>
            </h1>
            <p className="qg-lead">
              {mode === "frame"
                ? "Показываем увеличенный фрагмент кадра из opening'а — лицо, взгляд или деталь. Угадывай тайтл из четырёх вариантов; после ответа кадр раскроется целиком. Пять вопросов в раунде, награда XP и анимокоинов за закрытие."
                : "Включаем 30-секундный отрывок песни из opening'а — угадывай тайтл из четырёх вариантов. Пять вопросов в раунде, награда XP и анимокоинов за закрытие."}
            </p>
            <div className="qg-stats">
              <span className="qg-stat">
                <b>5</b> вопросов
              </span>
              <span className="qg-stat">
                <b>4</b> варианта
              </span>
              <span className="qg-stat">
                <b>
                  +{rule.xp} XP
                </b>{" "}
                · +{rule.ac ?? 0} AC
              </span>
              {bestScore > 0 ? (
                <span className="qg-stat is-best">
                  <b>{bestScore}</b> лучший
                </span>
              ) : null}
            </div>
            <div className="qg-modes" role="tablist" aria-label="Режим квиза">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "frame"}
                className={`qg-mode${mode === "frame" ? " is-active" : ""}`}
                onClick={() => setMode("frame")}
              >
                <b>Кадр из OP</b>
                <span>Угадай по фрагменту</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "song"}
                className={`qg-mode${mode === "song" ? " is-active" : ""}`}
                onClick={() => setMode("song")}
              >
                <b>Песня из OP</b>
                <span>Угадай по отрывку</span>
              </button>
            </div>
            <p className="qg-keys">
              {mode === "song"
                ? "1–4 — ответ · Space — послушать · Enter — дальше"
                : "1–4 — ответ · Enter — дальше"}
            </p>
          </div>
        </section>
        {renderBody()}
      </div>
    </div>
  );
}
