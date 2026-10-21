/**
 * Маркер заголовка секции — вместо цветных «палочек».
 *
 * Плитка 30×30 в одной палитре сайта (синий → циан) с тонкой кромкой, мягким
 * свечением и штриховой иконкой. Анимация только CSS: иконка «рисуется» при
 * появлении, свечение дышит, по плитке раз в несколько секунд проходит блик.
 * Подробности и prefers-reduced-motion — в `section-mark.css`.
 */

export type MarkKind = "play" | "flame" | "spark" | "crown" | "film" | "book" | "grid";

/** Иконка выбирается по смыслу секции; по умолчанию — искра */
export function markFor(title: string): MarkKind {
  const t = title.toLowerCase();
  if (t.includes("продолжить")) return "play";
  if (t.includes("онгоинг")) return "flame";
  if (t.includes("топ") || t.includes("лучш")) return "crown";
  if (t.includes("фильм")) return "film";
  if (t.includes("манга")) return "book";
  if (t.includes("жанр")) return "grid";
  return "spark";
}

const PATHS: Record<MarkKind, React.ReactNode> = {
  play: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M10.2 8.6v6.8l5.6-3.4z" className="sm-fill" />
    </>
  ),
  flame: (
    <>
      <path d="M12 3c.6 3.2 4.6 5 4.6 9.4a4.6 4.6 0 0 1-9.2 0c0-1.7.8-2.9 1.7-3.8.3 1.2.9 1.8 1.6 2C10.4 8 10.6 5.4 12 3z" />
      <path d="M12 20.4c-1.5 0-2.4-1-2.4-2.3 0-1.3 1-2 2.4-3.4 1.4 1.4 2.4 2.1 2.4 3.4 0 1.3-.9 2.3-2.4 2.3z" className="sm-fill" />
    </>
  ),
  spark: (
    <>
      <path d="M12 3.4l1.9 5.2 5.2 1.9-5.2 1.9L12 17.6l-1.9-5.2L4.9 10.5l5.2-1.9z" />
      <path d="M18.6 16.4l.7 1.7 1.7.7-1.7.7-.7 1.7-.7-1.7-1.7-.7 1.7-.7z" className="sm-fill" />
    </>
  ),
  crown: (
    <>
      <path d="M4 8.2l4.2 3.6L12 5.4l3.8 6.4L20 8.2l-1.6 9.4H5.6z" />
      <path d="M6 20h12" />
    </>
  ),
  film: (
    <>
      <rect x="3.6" y="5.2" width="16.8" height="13.6" rx="2.4" />
      <path d="M8 5.2v13.6M16 5.2v13.6M3.6 9.8H8M3.6 14.2H8M16 9.8h4.4M16 14.2h4.4" />
    </>
  ),
  book: (
    <>
      <path d="M12 6.4C10.4 5 8 4.6 4.6 4.8v12.6c3.4-.2 5.8.2 7.4 1.6 1.6-1.4 4-1.8 7.4-1.6V4.8c-3.4-.2-5.8.2-7.4 1.6z" />
      <path d="M12 6.4V19" />
    </>
  ),
  grid: (
    <>
      <rect x="4.4" y="4.4" width="6.2" height="6.2" rx="1.6" />
      <rect x="13.4" y="4.4" width="6.2" height="6.2" rx="1.6" />
      <rect x="4.4" y="13.4" width="6.2" height="6.2" rx="1.6" />
      <rect x="13.4" y="13.4" width="6.2" height="6.2" rx="1.6" className="sm-fill" />
    </>
  ),
};

export function SectionMark({ kind }: { kind: MarkKind }) {
  return (
    <span className="sm-mark" aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {PATHS[kind]}
      </svg>
    </span>
  );
}
