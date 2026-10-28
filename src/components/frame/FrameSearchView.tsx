"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { Poster } from "@/components/Poster";
import { shikimoriPoster } from "@/lib/anime";
import { openAuthDialog } from "@/lib/auth-dialog";
import {
  FrameAuthError,
  askFrameAi,
  clockOf,
  findFrame,
  percent,
  type FrameAiPick,
  type FrameAiResult,
} from "@/lib/frame-client";
import type { FrameMatch } from "@/lib/frame-types";
import { useAccount } from "@/lib/use-account";
import { FrameGuide } from "./FrameGuide";

type State =
  | { kind: "idle" }
  | { kind: "busy"; preview: string }
  | { kind: "done"; preview: string; matches: FrameMatch[] }
  | { kind: "error"; message: string; preview?: string };

type AiState =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "done"; result: FrameAiResult }
  | { kind: "error"; message: string };

const CONFIDENCE_LABEL = { high: "Уверенно", medium: "Похоже", low: "Предположение" } as const;

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif";
const SURE = 0.87;
const GAUGE_R = 34;
const GAUGE_C = 2 * Math.PI * GAUGE_R;

const titleOf = (m: FrameMatch) =>
  m.card?.title ?? m.names.english ?? m.names.romaji ?? m.names.native ?? "Неизвестный тайтл";

/** Подсветка за курсором: кладём координаты в CSS-переменные, без перерисовок React */
function glow(event: PointerEvent<HTMLElement>) {
  const box = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty("--mx", `${event.clientX - box.left}px`);
  event.currentTarget.style.setProperty("--my", `${event.clientY - box.top}px`);
}

function Spark({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6fa8ff" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <path d="M30 6l5.4 15.6L51 27l-15.6 5.4L30 48l-5.4-15.6L9 27l15.6-5.4z" fill={`url(#${id})`} />
      <path d="M50 38l2.3 6.7 6.7 2.3-6.7 2.3L50 56l-2.3-6.7L41 47l6.7-2.3z" fill={`url(#${id})`} opacity=".75" />
    </svg>
  );
}

/** Круговой датчик совпадения: дуга «дорисовывается» при появлении */
function Gauge({ value, sure }: { value: number; sure: boolean }) {
  return (
    <span className={`fs-gauge${sure ? " sure" : ""}`}>
      <svg viewBox="0 0 80 80" aria-hidden>
        <circle className="bg" cx="40" cy="40" r={GAUGE_R} />
        <circle
          className="fg"
          cx="40"
          cy="40"
          r={GAUGE_R}
          strokeDasharray={GAUGE_C}
          strokeDashoffset={GAUGE_C * (1 - value)}
          style={{ ["--c" as string]: GAUGE_C }}
        />
      </svg>
      <b>
        {Math.round(value * 100)}
        <small>%</small>
      </b>
    </span>
  );
}

function pickHref(pick: FrameAiPick): string {
  return pick.id ? `/title/${pick.id}` : `/catalog?q=${encodeURIComponent(pick.title)}`;
}

export function FrameSearchView({ aiEnabled = false }: { aiEnabled?: boolean }) {
  const account = useAccount();
  const [state, setState] = useState<State>({ kind: "idle" });
  const [ai, setAi] = useState<AiState>({ kind: "idle" });
  const [drag, setDrag] = useState(false);
  const [url, setUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);
  const sourceRef = useRef<File | string | null>(null);

  const setPreview = (next: string | null) => {
    if (previewRef.current?.startsWith("blob:")) URL.revokeObjectURL(previewRef.current);
    previewRef.current = next;
  };

  /** Один запрос к ИИ; 401 открывает окно входа, остальные ошибки показываются в панели */
  const runAi = useCallback(async (source: File | string) => {
    setAi({ kind: "busy" });
    try {
      setAi({ kind: "done", result: await askFrameAi(source) });
    } catch (error) {
      if (error instanceof FrameAuthError) {
        openAuthDialog("login");
        setAi({ kind: "idle" });
        return;
      }
      setAi({ kind: "error", message: error instanceof Error ? error.message : "ИИ не смог разобрать кадр." });
    }
  }, []);

  const run = useCallback(
    async (input: File | string) => {
      const preview = typeof input === "string" ? input : URL.createObjectURL(input);
      setPreview(preview);
      sourceRef.current = input;
      setState({ kind: "busy", preview });

      // ИИ и база сцен работают параллельно: ИИ узнаёт тайтл, база находит секунду
      if (aiEnabled && account) void runAi(input);
      else setAi({ kind: "idle" });

      try {
        const result = await findFrame(input);
        setState(
          result.matches.length
            ? { kind: "done", preview, matches: result.matches }
            : { kind: "error", message: "В базе сцен ничего похожего не нашли.", preview },
        );
      } catch (error) {
        setState({ kind: "error", message: error instanceof Error ? error.message : "Не удалось выполнить поиск.", preview });
      }
    },
    [account, aiEnabled, runAi],
  );

  // Ctrl+V с картинкой в буфере — на всей странице
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const file = Array.from(event.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"));
      if (file) {
        event.preventDefault();
        void run(file);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [run]);

  useEffect(() => () => setPreview(null), []);

  const pick = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void run(file);
  };

  const reset = () => {
    setPreview(null);
    sourceRef.current = null;
    setAi({ kind: "idle" });
    setState({ kind: "idle" });
    setUrl("");
  };

  const scanning = state.kind === "busy" || ai.kind === "busy";
  const best = state.kind === "done" ? state.matches[0] : null;
  const rest = state.kind === "done" ? state.matches.slice(1) : [];
  const sure = Boolean(best && best.similarity >= SURE);
  const aiResult = ai.kind === "done" ? ai.result : null;
  /** ИИ идёт первым, если база сцен не уверена: именно он «узнаёт» тайтл */
  const aiFirst = Boolean(aiResult) && (aiEnabled || !sure);
  const finished = state.kind === "done" || state.kind === "error";

  /* ------------------------------ Карточка ИИ ------------------------------ */
  const aiCard = aiResult && (
    <section
      className={`fs-air${aiFirst ? " is-primary" : ""}`}
      aria-label="Разбор кадра с помощью ИИ"
      onPointerMove={glow}
    >
      <div className="fs-air-tag">
        <span className="fs-ai-ic" aria-hidden>
          <Spark id="fs-air-g" />
        </span>
        <b>{aiFirst ? "ИИ узнал аниме" : "Мнение ИИ"}</b>
      </div>
      <p className="fs-ai-desc">{aiResult.description}</p>

      {aiResult.picks.length > 0 ? (
        <>
          <article className="fs-hero-pick">
            <div className="fs-hero-poster">
              <Poster
                src={aiResult.picks[0].poster}
                fallback={aiResult.picks[0].shikimoriId ? shikimoriPoster(aiResult.picks[0].shikimoriId) : undefined}
                alt=""
                title={aiResult.picks[0].title}
                sizes="160px"
                className="object-cover"
              />
            </div>
            <div className="fs-hero-info">
              <span className={`fs-conf is-${aiResult.picks[0].confidence}`}>{CONFIDENCE_LABEL[aiResult.picks[0].confidence]}</span>
              <h2>{aiResult.picks[0].title}</h2>
              {aiResult.picks[0].year || aiResult.picks[0].genres.length > 0 ? (
                <p className="fs-orig">{[aiResult.picks[0].year, ...aiResult.picks[0].genres].filter(Boolean).join(" · ")}</p>
              ) : null}
              {aiResult.picks[0].why ? <p className="fs-hero-why">{aiResult.picks[0].why}</p> : null}
              <div className="fs-acts">
                <Link href={pickHref(aiResult.picks[0])} className="fs-btn is-primary">
                  {aiResult.picks[0].id ? "Смотреть на AniGalaxy" : "Поискать в каталоге"}
                </Link>
              </div>
              {!aiResult.picks[0].id && <p className="fs-miss">Точного совпадения в каталоге пока нет.</p>}
            </div>
          </article>

          {aiResult.picks.length > 1 && (
            <ul className="fs-ai-list">
              {aiResult.picks.slice(1).map((p) => (
                <li key={p.id ?? p.title}>
                  <Link href={pickHref(p)} className="fs-ai-pick">
                    <span className="fs-ai-poster">
                      <Poster
                        src={p.poster}
                        fallback={p.shikimoriId ? shikimoriPoster(p.shikimoriId) : undefined}
                        alt=""
                        title={p.title}
                        sizes="56px"
                        className="object-cover"
                      />
                    </span>
                    <span className="fs-ai-info">
                      <b>{p.title}</b>
                      <span className={`fs-conf is-${p.confidence}`}>{CONFIDENCE_LABEL[p.confidence]}</span>
                      {p.why ? <small>{p.why}</small> : null}
                    </span>
                    <span className="fs-go" aria-hidden>→</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="fs-ai-none">ИИ не смог уверенно назвать аниме. Попробуйте другой кадр, лучше с лицом героя или узнаваемой сценой.</p>
      )}
      <button type="button" className="fs-btn" onClick={() => sourceRef.current && void runAi(sourceRef.current)}>
        Разобрать заново
      </button>
    </section>
  );

  /* -------------------------- Результаты базы сцен -------------------------- */
  const traceSection = best && (
    <section className="fs-result" aria-label="Совпадение по базе сцен">
      {aiResult && <h3 className="fs-sec">{sure ? "Точная сцена" : "Возможное совпадение по базе сцен"}</h3>}
      <article className="fs-best" onPointerMove={glow}>
        <div className="fs-clip">
          {best.video ? (
            <video src={best.video} poster={best.image} autoPlay muted loop playsInline />
          ) : (
            <img src={best.image} alt="" />
          )}
          <span className="fs-badge">{clockOf(best.at)}</span>
        </div>

        <div className="fs-info">
          <div className="fs-sim-row">
            <Gauge value={best.similarity} sure={sure} />
            <span className={`fs-sim-label${sure ? " sure" : ""}`}>{sure ? "Точное совпадение" : "Возможно, это оно"}</span>
          </div>
          <h2>{titleOf(best)}</h2>
          {best.names.native && best.card && <p className="fs-orig">{best.names.native}</p>}
          <ul className="fs-facts">
            {best.episode != null && <li><small>Серия</small><b>{best.episode}</b></li>}
            <li><small>Момент</small><b>{clockOf(best.from)} – {clockOf(best.to)}</b></li>
            {best.card?.year ? <li><small>Год</small><b>{best.card.year}</b></li> : null}
          </ul>

          {!sure && (
            <p className="fs-warn">Совпадение неуверенное: база сцен ошибается на кадрах с субтитрами, рамками и артами.</p>
          )}

          {best.card ? (
            <div className="fs-acts">
              <Link href={`/title/${best.card.id}`} className="fs-btn is-primary">Смотреть на AniGalaxy</Link>
              <Link href={`/title/${best.card.id}#episodes`} className="fs-btn">Открыть серии</Link>
            </div>
          ) : (
            <div className="fs-acts">
              <p className="fs-miss">Этого тайтла пока нет в нашем каталоге.</p>
              <Link href={`/catalog?q=${encodeURIComponent(best.names.romaji ?? best.names.english ?? "")}`} className="fs-btn">Поискать в каталоге</Link>
            </div>
          )}
        </div>
      </article>

      {rest.length > 0 && (
        <>
          <h3 className="fs-more">Другие варианты</h3>
          <ul className="fs-list">
            {rest.map((m, index) => (
              <li key={`${m.malId}-${index}`} style={{ ["--n" as string]: index }}>
                <div className="fs-mini">
                  {m.card ? <Poster src={m.card.poster} alt="" title={m.card.title} sizes="56px" className="object-cover" /> : null}
                </div>
                <div className="fs-mi">
                  <b>{titleOf(m)}</b>
                  <span>{m.episode != null ? `Серия ${m.episode} · ` : ""}{clockOf(m.at)}</span>
                </div>
                <div className="fs-meter"><i style={{ width: `${Math.round(m.similarity * 100)}%` }} /><em>{percent(m.similarity)}</em></div>
                {m.card && <Link href={`/title/${m.card.id}`} className="fs-go" aria-label={`Открыть «${m.card.title}»`}>→</Link>}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );

  /* Приглашение к ИИ: гостям нужен вход, а после сбоя — повтор */
  const askPanel =
    aiEnabled && finished && !aiResult && ai.kind !== "busy" ? (
      <section className="fs-ai is-hot" aria-label="Разбор кадра с помощью ИИ" onPointerMove={glow}>
        <div className="fs-ai-head">
          <span className="fs-ai-ic" aria-hidden>
            <Spark id="fs-ai-g" />
          </span>
          <div>
            <h3>{account ? "ИИ не смог разобрать кадр" : "Пусть кадр разберёт ИИ"}</h3>
            <p>
              {ai.kind === "error"
                ? ai.message
                : "ИИ смотрит на картинку, как человек: узнаёт героев и сцены, находит аниме даже по артам. Для этого нужен вход."}
            </p>
          </div>
          <button
            type="button"
            className="fs-btn is-primary"
            onClick={() => (account && sourceRef.current ? void runAi(sourceRef.current) : openAuthDialog("login"))}
          >
            {account ? "Попробовать ещё раз" : "Войти и разобрать"}
          </button>
        </div>
      </section>
    ) : null;

  return (
    <div className="fs-page">
      <div className="fs-wrap">
        <header className="fs-head">
          <span className="fs-badge-top">
            <i />
            ИИ-поиск по кадру
          </span>
          <h1>Узнайте аниме по одному кадру</h1>
          <p>Загрузите скриншот или арт: ИИ узнает тайтл, а база сцен покажет серию и точную секунду.</p>
        </header>

        <section
          className={`fs-drop${drag ? " is-drag" : ""}${scanning ? " is-busy" : ""}${state.kind !== "idle" ? " has-img" : ""}`}
          onPointerMove={glow}
          onDragOver={(event) => {
            event.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDrag(false);
            pick(event.dataTransfer.files);
          }}
        >
          {state.kind === "idle" ? (
            <div className="fs-idle">
              <i className="fs-corner tl" aria-hidden />
              <i className="fs-corner tr" aria-hidden />
              <i className="fs-corner bl" aria-hidden />
              <i className="fs-corner br" aria-hidden />
              <i className="fs-dust d1" aria-hidden />
              <i className="fs-dust d2" aria-hidden />
              <i className="fs-dust d3" aria-hidden />
              <i className="fs-dust d4" aria-hidden />
              <span className="fs-orb" aria-hidden>
                <i className="fs-ring r1" />
                <i className="fs-ring r2" />
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
                  <circle cx="12" cy="12" r="3.2" />
                </svg>
              </span>
              <h2>Перетащите кадр сюда</h2>
              <p>или вставьте из буфера обмена <kbd>Ctrl</kbd> + <kbd>V</kbd></p>
              <button type="button" className="fs-btn" onClick={() => fileRef.current?.click()}>
                Выбрать файл
              </button>
              <small>JPG, PNG, WebP, GIF · до 10 МБ</small>
            </div>
          ) : (
            <div className="fs-shot">
                            <img src={state.preview} alt="Ваш кадр" />
              {scanning && (
                <div className="fs-scan" aria-live="polite">
                  <i />
                  <b className="fs-reticle" aria-hidden />
                  <span className="fs-hud">
                    <em>Изучаю кадр…</em>
                    <em>Узнаю героев и сцену…</em>
                    <em>Сверяю с базой сцен…</em>
                  </span>
                </div>
              )}
              {!scanning && (
                <button type="button" className="fs-again" onClick={reset}>
                  Другой кадр
                </button>
              )}
            </div>
          )}
          <input ref={fileRef} type="file" accept={ACCEPT} hidden onChange={(event) => { pick(event.target.files); event.target.value = ""; }} />
        </section>

        {state.kind === "idle" && (
          <form
            className="fs-url"
            onSubmit={(event) => {
              event.preventDefault();
              if (url.trim()) void run(url.trim());
            }}
          >
            <input
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="Или вставьте ссылку на картинку"
              aria-label="Ссылка на картинку"
            />
            <button type="submit" disabled={!url.trim()}>Найти</button>
          </form>
        )}

        {/* Пока ИИ думает, а база уже ответила, показываем заглушку-«скелет» */}
        {ai.kind === "busy" && state.kind !== "busy" && (
          <div className="fs-air-skel" aria-hidden>
            <i />
            <i />
            <i />
          </div>
        )}

        {state.kind === "error" && !aiResult && !askPanel && (
          <div className="fs-error" role="alert">
            <b>Не получилось</b>
            <p>{state.message}</p>
            <button type="button" className="fs-btn" onClick={reset}>Попробовать снова</button>
          </div>
        )}

        {aiFirst && aiCard}
        {!aiEnabled && traceSection}
        {!aiFirst && aiCard}
        {state.kind === "error" && !aiResult && askPanel}
        {state.kind === "done" && !aiResult && askPanel}

        <FrameGuide />

        <p className="fs-credit">
          {aiEnabled ? "Разбор кадра выполняет Люмина, она может ошибаться на редких сценах." : "База сцен — открытый trace.moe, иногда он ошибается на редких кадрах."}
        </p>
      </div>
    </div>
  );
}
