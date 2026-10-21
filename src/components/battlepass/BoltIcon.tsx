export function BoltIcon({ id = "bp-bolt" }: { id?: string }) {
  return (
    <svg className="bp-bolt-svg" viewBox="0 0 32 32" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff3c4" />
          <stop offset=".45" stopColor="#ff7a9c" />
          <stop offset="1" stopColor="#e11d48" />
        </linearGradient>
      </defs>
      <path d="M18.6 4.5 8.8 17.6h6.1l-1.5 9.9 9.8-13.4h-6.2z" fill={`url(#${id})`} />
      <path d="M18.6 4.5 8.8 17.6h6.1" stroke="#fff" strokeOpacity=".7" strokeWidth=".8" fill="none" strokeLinecap="round" />
    </svg>
  );
}
