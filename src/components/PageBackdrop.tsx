/**
 * Тематический фон страницы (чисто CSS, без JS). Фиксированный слой под
 * контентом; стили — app/backdrops.css (префикс bd-).
 */
export type BackdropVariant = "quests" | "schedule" | "swipe" | "together" | "notices";

const EMBERS = Array.from({ length: 14 }, (_, i) => ({
  x: (i * 37 + 11) % 100,
  s: 3 + ((i * 5) % 4),
  d: 11 + ((i * 3) % 9),
  w: -((i * 2.3) % 14),
}));

export function PageBackdrop({ variant }: { variant: BackdropVariant }) {
  return (
    <div className={`bd bd--${variant}`} aria-hidden>
      <i className="bd-blob bd-b1" />
      <i className="bd-blob bd-b2" />
      <i className="bd-blob bd-b3" />
      <i className="bd-pattern" />
      {variant === "quests" && (
        <>
          <i className="bd-ring bd-r1" />
          <i className="bd-ring bd-r2" />
          <i className="bd-ring bd-r3" />
        </>
      )}
      {variant === "notices" && (
        <>
          <i className="bd-ring bd-n1" />
          <i className="bd-ring bd-n2" />
          <i className="bd-ring bd-n3" />
        </>
      )}
      {variant === "schedule" && (
        <>
          <i className="bd-streak bd-s1" />
          <i className="bd-streak bd-s2" />
          <i className="bd-streak bd-s3" />
        </>
      )}
      {variant === "swipe" && (
        <>
          <i className="bd-card bd-c1" />
          <i className="bd-card bd-c2" />
          <i className="bd-card bd-c3" />
        </>
      )}
      {variant === "together" && (
        <>
          <i className="bd-cone bd-k1" />
          <i className="bd-cone bd-k2" />
          <span className="bd-react">
            {["🔥", "😱", "😂", "💙", "✨", "🔥", "💙"].map((e, i) => (
              <b key={i} style={{ "--x": 8 + i * 13, "--d": `${12 + (i % 4) * 3}s`, "--w": `${-i * 2.7}s` } as React.CSSProperties}>
                {e}
              </b>
            ))}
          </span>
        </>
      )}
      <span className="bd-embers">
        {EMBERS.map((e, i) => (
          <b
            key={i}
            style={{ "--x": e.x, "--s": `${e.s}px`, "--d": `${e.d}s`, "--w": `${e.w}s` } as React.CSSProperties}
          />
        ))}
      </span>
    </div>
  );
}
