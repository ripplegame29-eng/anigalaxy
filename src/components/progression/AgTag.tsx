"use client";

/**
 * Единая тег-капсула `ag-tag` (FIX_TAGS §2–§3).
 *
 * Разметку строит чистая функция `renderTag(tag, { size })` — один источник
 * правды для шапки профиля, меню пользователя, комментариев, вкладки
 * косметики, магазина, карточек и тоста о получении. Слои и эффекты лежат
 * в `app/ag-tag.css`, данные визуала (палитра/иконка/эффекты) — в конфиге
 * тега; логика прогрессии и хранилище компонент не трогает.
 *
 * Производительность: один общий IntersectionObserver ставит невидимым
 * капсулам `data-paused` (CSS останавливает анимации) — без лишних
 * ре-рендеров. Частицы детерминированы от id тега: сервер и клиент
 * рисуют одинаково.
 */

import { useEffect, useRef, type CSSProperties, type ReactElement, type ReactNode } from "react";
import type { TagDef } from "@/lib/progression/types";
import { effectSet, particlesFor, sparkCount, spinFor } from "@/lib/progression/visual";

export type TagSize = "sm" | "md" | "lg";

const TEXT_CLASS: Record<string, string> = {
  plain: "",
  neon: "txt-neon",
  metal: "txt-metal",
  glitch: "txt-glitch",
  tremor: "txt-tremor",
};

/** эффекты, которым нужен свой слой-подложка */
const SOFT_LAYERS = new Set(["mist", "flame", "orbit"]);
const OVER_LAYERS = new Set(["border-blade", "noise"]);

export interface RenderTagOptions {
  /** `md` — шапка, `sm` — меню/комментарии/тост, `lg` — магазин/косметика */
  size?: TagSize;
  /** приглушённый вид (тег не получен) */
  locked?: boolean;
  className?: string;
  /** текст по умолчанию — название тега */
  children?: ReactNode;
}

interface TagParts {
  /** атрибуты корневого `<span>` (className/style/data-*) */
  spanProps: {
    className: string;
    style: CSSProperties;
    "data-r": string;
    "data-tag": string;
  };
  /** слои капсулы */
  body: ReactNode;
}

/**
 * Всё, что нужно корневому элементу, кроме `ref` (его нельзя отдавать
 * вспомогательной функции во время рендера — рефы читаются только в эффекте).
 */
function tagParts(tag: TagDef, options: RenderTagOptions): TagParts {
  const { size = "md", locked = false, className = "", children } = options;
  const effects = effectSet(tag);
  const has = (name: string) => effects.includes(name);
  const hasSoft = effects.some((e) => SOFT_LAYERS.has(e));
  const hasOver = effects.some((e) => OVER_LAYERS.has(e));
  // в размере sm частиц нет вовсе — только md/lg (FIX §4)
  const dots = size === "sm" ? [] : particlesFor(tag.id, sparkCount(tag));
  const label = children ?? tag.name;

  const spanProps: TagParts["spanProps"] = {
    className: [
      "ag-tag",
      `ag-tag--${size}`,
      ...effects.map((name) => `fx-${name}`),
      TEXT_CLASS[tag.visual.text ?? "plain"] ?? "",
      locked ? "ag-tag--locked" : "",
      className,
    ]
      .filter(Boolean)
      .join(" "),
    style: {
      "--c": tag.visual.c,
      "--c2": tag.visual.c2,
      "--spin": spinFor(tag.rarity),
    } as CSSProperties,
    "data-r": tag.rarity,
    "data-tag": tag.id,
  };

  const body = (
    <>
      {/* базовая цветная волна (есть у каждой капсулы) + слои backdrop-* */}
      <span className="ag-bg" aria-hidden="true" />
      {hasSoft && <span className="ag-soft" aria-hidden="true" />}
      {hasOver && <span className="ag-over" aria-hidden="true" />}
      {has("pulse") && <span className="ag-glow" aria-hidden="true" />}
      {has("runes") && (
        <svg className="ag-runes" viewBox="0 0 100 40" aria-hidden="true" focusable="false">
          <circle cx="50" cy="20" r="17" />
        </svg>
      )}
      <i className="bk tl" aria-hidden="true" />
      <i className="bk tr" aria-hidden="true" />
      <i className="bk bl" aria-hidden="true" />
      <i className="bk br" aria-hidden="true" />
      <svg
        className="ag-ico"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
        // разметка только из конфига проекта, пользовательский ввод сюда не попадает
        dangerouslySetInnerHTML={{ __html: tag.visual.icon }}
      />
      <b data-t={typeof label === "string" ? label : undefined}>{label}</b>
      {has("shine") && <span className="sh" aria-hidden="true" />}
      {dots.map((p, i) => (
        <em
          key={i}
          className="sp"
          aria-hidden="true"
          style={
            {
              "--x": p.x,
              "--y": p.y,
              "--delay": `${p.delay}s`,
              "--dur": `${p.duration}s`,
              "--sz": `${p.size}px`,
            } as CSSProperties
          }
        />
      ))}
    </>
  );

  return { spanProps, body };
}

/** Чистая разметка капсулы — тестируема и переиспользуема без DOM. */
export function renderTag(tag: TagDef, options: RenderTagOptions = {}): ReactElement {
  const { spanProps, body } = tagParts(tag, options);
  return <span {...spanProps}>{body}</span>;
}

interface AgTagProps extends RenderTagOptions {
  tag: TagDef;
}

/* один общий наблюдатель на все капсулы проекта */
let sharedObserver: IntersectionObserver | null = null;

function getObserver(): IntersectionObserver | null {
  if (typeof IntersectionObserver === "undefined") return null;
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          if (entry.isIntersecting) el.removeAttribute("data-paused");
          else el.setAttribute("data-paused", "true");
        }
      },
      { threshold: 0.05 },
    );
  }
  return sharedObserver;
}

/** Капсула с паузой анимаций, пока она вне экрана. */
export function AgTag({ tag, ...options }: AgTagProps) {
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    const observer = getObserver();
    if (!el || !observer) return;
    observer.observe(el);
    return () => observer.unobserve(el);
  }, []);

  const { spanProps, body } = tagParts(tag, options);
  return (
    <span ref={ref} {...spanProps}>
      {body}
    </span>
  );
}
