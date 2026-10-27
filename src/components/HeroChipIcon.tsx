/** Премиальные SVG-иконки для плашек в шапке страницы Premium (стили — premium-page.css, .hc-*) */
type Name = "bolt" | "shield" | "gem" | "ticket";

const STOPS: Record<Name, [string, string, string]> = {
  bolt: ["#fff3c4", "#ffc23a", "#ff8a3d"],
  shield: ["#e6fbff", "#6fe0ff", "#3b82ff"],
  gem: ["#f3ebff", "#b99bff", "#7a5cff"],
  ticket: ["#ffe9f1", "#ff9cc2", "#ff5f9e"],
};

export function HeroChipIcon({ name }: { name: Name }) {
  const id = `hc-${name}`;
  const [a, b, c] = STOPS[name];
  let body: React.ReactNode;
  switch (name) {
    case "bolt":
      body = (
        <path d="M13.5 2 5 13.4h6.2L10 22l9-12.1h-6.3z" fill={`url(#${id})`} fillOpacity=".22" stroke={`url(#${id})`} strokeWidth="1.7" strokeLinejoin="round" />
      );
      break;
    case "shield":
      body = (
        <>
          <path d="M12 2.5 4.5 5.4v6.1c0 4.8 3.1 8.3 7.5 10 4.4-1.7 7.5-5.2 7.5-10V5.4z" fill={`url(#${id})`} fillOpacity=".2" stroke={`url(#${id})`} strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M12 8.2v6M9 11.2h6" stroke={`url(#${id})`} strokeWidth="1.7" strokeLinecap="round" />
        </>
      );
      break;
    case "gem":
      body = (
        <>
          <path d="M6.2 3.5h11.6L22 9.4 12 21 2 9.4z" fill={`url(#${id})`} fillOpacity=".2" stroke={`url(#${id})`} strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M2 9.4h20M9.2 3.5 7.6 9.4 12 21l4.4-11.6-1.6-5.9" stroke={`url(#${id})`} strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round" />
        </>
      );
      break;
    default:
      body = (
        <>
          <path d="M3 8.2A2.2 2.2 0 0 1 5.2 6h13.6A2.2 2.2 0 0 1 21 8.2v1.9a2 2 0 0 0 0 3.8v1.9a2.2 2.2 0 0 1-2.2 2.2H5.2A2.2 2.2 0 0 1 3 15.8v-1.9a2 2 0 0 0 0-3.8z" fill={`url(#${id})`} fillOpacity=".2" stroke={`url(#${id})`} strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M14.5 7.6v1.8M14.5 11.1v1.8M14.5 14.6v1.8" stroke={`url(#${id})`} strokeWidth="1.6" strokeLinecap="round" />
        </>
      );
  }
  return (
    <svg className={`hc-ic hc-${name}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs>
        <linearGradient id={id} x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={a} />
          <stop offset=".5" stopColor={b} />
          <stop offset="1" stopColor={c} />
        </linearGradient>
      </defs>
      {body}
    </svg>
  );
}
