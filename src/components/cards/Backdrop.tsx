/** Многослойный фон гачи: арт, аврора, лучи, туман, лепестки, искры, зерно. Только CSS-анимации. */
const PETALS = Array.from({ length: 18 }, (_, i) => ({
  l: (i * 37 + 11) % 100,
  s: 8 + ((i * 7) % 9),
  d: 14 + ((i * 5) % 12),
  o: -((i * 3.1) % 20),
  w: 30 + ((i * 13) % 60),
  h: i % 3,
}));
const SPARKS = Array.from({ length: 14 }, (_, i) => ({
  x: i % 2 ? 4 + ((i * 11) % 22) : 74 + ((i * 11) % 22),
  y: 62 + ((i * 17) % 34),
  d: 2.4 + ((i * 3) % 4),
  o: -((i * 1.3) % 6),
  s: 2 + (i % 3),
}));

export function Backdrop() {
  return (
    <div className="gx-bd" aria-hidden>
      <i className="bd-art" />
      <i className="bd-aur a1" />
      <i className="bd-aur a2" />
      <i className="bd-moon" />
      <i className="bd-rays" />
      <i className="bd-mist m1" />
      <i className="bd-mist m2" />
      {PETALS.map((p, i) => (
        <b key={i} className={`bd-pt h${p.h}`} style={{ left: `${p.l}%`, width: p.s, height: p.s * 1.3, animationDuration: `${p.d}s`, animationDelay: `${p.o}s`, ["--sw" as string]: `${p.w}px` }} />
      ))}
      {SPARKS.map((p, i) => (
        <u key={i} className="bd-sp" style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.s, height: p.s, animationDuration: `${p.d}s`, animationDelay: `${p.o}s` }} />
      ))}
      <i className="bd-vig" />
      <i className="bd-grain" />
    </div>
  );
}
