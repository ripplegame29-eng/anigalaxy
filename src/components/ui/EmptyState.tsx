import type { ReactNode } from "react";

export type StateArt = "search" | "list" | "bell" | "chat" | "trophy" | "bolt" | "bug";

const ICONS: Record<StateArt, ReactNode> = {
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
      <path d="M9 11h4" />
    </>
  ),
  list: (
    <>
      <path d="M8 6h12M8 12h12M8 18h12" />
      <circle cx="4" cy="6" r="1" />
      <circle cx="4" cy="12" r="1" />
      <circle cx="4" cy="18" r="1" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" />
      <path d="M10 21h4" />
    </>
  ),
  chat: (
    <>
      <path d="M4 5h16v11H9l-5 4z" />
      <path d="M8 9h8M8 12.5h5" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
      <path d="M8 6H4.5c0 3 1.5 4.5 3.7 4.8M16 6h3.5c0 3-1.5 4.5-3.7 4.8M12 13v4M8.5 20h7M9.5 17h5" />
    </>
  ),
  bolt: <path d="M13 3 5 13.5h6L10 21l8-10.5h-6z" />,
  bug: (
    <>
      <path d="M12 8v12M7.5 11H4M20 11h-3.5M7.5 16H4.5M19.5 16h-3M8 8a4 4 0 0 1 8 0v7a4 4 0 0 1-8 0z" />
      <path d="M9.5 4.5 8 3M14.5 4.5 16 3" />
    </>
  ),
};

/** Пустое состояние: иллюстрация, заголовок, пояснение и действие. Единый вид по всему сайту */
export function EmptyState({
  art = "search",
  title,
  text,
  actions,
  compact = false,
}: {
  art?: StateArt;
  title: string;
  text?: string;
  actions?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`ui-state${compact ? " compact" : ""}`} role="status">
      <span className="ui-state-art" aria-hidden>
        <svg viewBox="0 0 24 24">{ICONS[art]}</svg>
      </span>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {actions && <div className="ui-state-actions">{actions}</div>}
    </div>
  );
}

/** Состояние ошибки: то же, но красное, с кодом для обращения в поддержку */
export function ErrorState({ title, text, actions, code }: { title: string; text?: string; actions?: ReactNode; code?: string }) {
  return (
    <div className="ui-state danger" role="alert">
      <span className="ui-state-art" aria-hidden>
        <svg viewBox="0 0 24 24">{ICONS.bug}</svg>
      </span>
      <h2>{title}</h2>
      {text && <p>{text}</p>}
      {actions && <div className="ui-state-actions">{actions}</div>}
      {code && <small>Код ошибки: {code}</small>}
    </div>
  );
}
