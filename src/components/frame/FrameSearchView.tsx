"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Poster } from "@/components/Poster";
import { clockOf, findFrame, percent } from "@/lib/frame-client";
import type { FrameMatch } from "@/lib/frame-types";

type State =
  | { kind: "idle" }
  | { kind: "busy"; preview: string }
  | { kind: "done"; preview: string; matches: FrameMatch[] }
  | { kind: "error"; message: string; preview?: string };

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif";
const SURE = 0.87;

const titleOf = (m: FrameMatch) =>
  m.card?.title ?? m.names.english ?? m.names.romaji ?? m.names.native ?? "Неизвестный тайтл";

export function FrameSearchView() {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [drag, setDrag] = useState(false);
  const [url, setUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);

  const setPreview = (next: string | null) => {
    if (previewRef.current?.startsWith("blob:")) URL.revokeObjectURL(previewRef.current);
    previewRef.current = next;
  };

  const run = useCallback(async (input: File | string) => {
    const preview = typeof input === "string" ? input : URL.createObjectURL(input);
    setPreview(preview);
    setState({ kind: "busy", preview });
    try {
      const result = await findFrame(input);
      setState(
        result.matches.length
          ? { kind: "done", preview, matches: result.matches }
          : { kind: "error", message: "Ничего похожего не нашли. Попробуйте кадр почище: без субтитров и рамок.", preview },
      );
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : "Не удалось выполнить поиск.", preview });
    }
  }, []);

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
    setState({ kind: "idle" });
    setUrl("");
  };

  const busy = state.kind === "busy";
  const best = state.kind === "done" ? state.matches[0] : null;
  const rest = state.kind === "done" ? state.matches.slice(1) : [];

  return (
    <div className="fs-page">
      <div className="fs-wrap">
        <header className="fs-head">
          <p className="fs-eyebrow">Узнать аниме</p>
          <h1>Поиск по <em>кадру</em></h1>
          <p>Загрузите скриншот — найдём тайтл, серию и точную секунду сцены.</p>
        </header>

        <section
          className={`fs-drop${drag ? " is-drag" : ""}${busy ? " is-busy" : ""}${state.kind !== "idle" ? " has-img" : ""}`}
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
              <span className="fs-orb" aria-hidden>
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
              {/* eslint-disable-next-line @next/next/no-img-element -- локальный blob или внешняя ссылка пользователя */}
              <img src={state.preview} alt="Ваш кадр" />
              {busy && (
                <div className="fs-scan" aria-live="polite">
                  <i />
                  <span>Сверяем с базой аниме…</span>
                </div>
              )}
              {!busy && (
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

        {state.kind === "error" && (
          <div className="fs-error" role="alert">
            <b>Не получилось</b>
            <p>{state.message}</p>
            <button type="button" className="fs-btn" onClick={reset}>Попробовать снова</button>
          </div>
        )}

        {best && (
          <section className="fs-result" aria-label="Найденный тайтл">
            <article className="fs-best">
              <div className="fs-clip">
                {best.video ? (
                  <video src={best.video} poster={best.image} autoPlay muted loop playsInline />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- превью trace.moe
                  <img src={best.image} alt="" />
                )}
                <span className="fs-badge">{clockOf(best.at)}</span>
              </div>

              <div className="fs-info">
                <div className={`fs-sim${best.similarity >= SURE ? " sure" : ""}`}>
                  <b>{percent(best.similarity)}</b>
                  <span>{best.similarity >= SURE ? "Точное совпадение" : "Возможно, это оно"}</span>
                </div>
                <h2>{titleOf(best)}</h2>
                {best.names.native && best.card && <p className="fs-orig">{best.names.native}</p>}
                <ul className="fs-facts">
                  {best.episode != null && <li><small>Серия</small><b>{best.episode}</b></li>}
                  <li><small>Момент</small><b>{clockOf(best.from)} – {clockOf(best.to)}</b></li>
                  {best.card?.year ? <li><small>Год</small><b>{best.card.year}</b></li> : null}
                </ul>

                {best.similarity < SURE && (
                  <p className="fs-warn">Совпадение неуверенное. Для точности возьмите кадр без субтитров, логотипов и чёрных полос.</p>
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
        )}

        <p className="fs-credit">Поиск работает на открытой базе trace.moe — иногда он ошибается на редких сценах.</p>
      </div>
    </div>
  );
}
