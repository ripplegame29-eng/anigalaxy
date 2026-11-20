"use client";
import "../../app/clan-aura.css";
import { ClanFrameArt } from "./ClanFrames";

/**
 * Оформление клана: знамёна, ауры и рамки герба.
 *
 * Всё нарисовано SVG с градиентами — без картинок, поэтому чётко на любом
 * экране и лёгкое для сети. Анимации (вращение рун, искры, лепестки) — на
 * CSS-классах `cx-*` из clans-shop.css: в сетке магазина они стоят на паузе
 * и оживают при наведении, в шапке клана и в примерочной — играют всегда.
 */

import { useId, type ReactNode } from "react";
import type { ClanItem } from "@/lib/clan-rules";
import { Crest } from "./common";

const uid = (raw: string) => raw.replace(/[^a-zA-Z0-9_-]/g, "");

/* ------------------------------- Знамя ---------------------------------- */

function bannerMark(item: ClanItem, id: string): ReactNode {
  const w = "#fff";
  switch (item.fx) {
    case "wave":
      return (
        <g fill="none" stroke={w} strokeWidth="3.2" strokeLinecap="round" opacity=".9">
          <path d="M24 46c6-6 10-6 16 0s10 6 16 0" />
          <path d="M24 56c6-6 10-6 16 0s10 6 16 0" opacity=".7" />
          <path d="M24 66c6-6 10-6 16 0s10 6 16 0" opacity=".45" />
        </g>
      );
    case "leaf":
      return (
        <g>
          <path d="M40 34c14 6 16 22 0 36-16-14-14-30 0-36z" fill={w} opacity=".9" />
          <path d="M40 38v30M40 50l-7-5M40 57l7-5" stroke={item.b} strokeWidth="1.8" strokeLinecap="round" />
        </g>
      );
    case "sakura":
      return (
        <g className="cx-anim cx-spin-slow" style={{ transformOrigin: "40px 52px" }}>
          {[0, 72, 144, 216, 288].map((r) => (
            <path key={r} d="M40 52c-5-7-5-14 0-17 5 3 5 10 0 17z" fill={w} opacity=".95" transform={`rotate(${r} 40 52)`} />
          ))}
          <circle cx="40" cy="52" r="3.4" fill={item.b} />
        </g>
      );
    case "dragon":
      return (
        <g>
          <path d="M28 66c2-14 12-22 24-22 4 0 6 2 5 5-4-1-7 0-9 3 6 0 9 4 7 9-5-3-10-2-13 2 3 2 4 5 2 8-6-4-11-4-16-5z" fill={w} opacity=".95" />
          <circle cx="50" cy="48" r="1.6" fill={item.b} />
          <path d="M53 44l6-6M55 47l7-2" stroke={w} strokeWidth="1.6" strokeLinecap="round" />
        </g>
      );
    case "eclipse":
      return (
        <g>
          <g className="cx-anim cx-spin" style={{ transformOrigin: "40px 52px" }}>
            {Array.from({ length: 16 }, (_, i) => (
              <path key={i} d="M40 52 L38.6 30 L41.4 30Z" fill={item.a} opacity={i % 2 ? 0.55 : 0.95} transform={`rotate(${i * 22.5} 40 52)`} />
            ))}
          </g>
          <circle cx="40" cy="52" r="12.5" fill={item.a} />
          <circle cx="40" cy="52" r="11" fill="#0a0418" />
          <circle cx="36" cy="48" r="2" fill="#fff" opacity=".85" />
        </g>
      );
    case "galaxy":
      return (
        <g className="cx-anim cx-spin" style={{ transformOrigin: "40px 52px" }}>
          <path d="M40 52c10-2 14 6 8 12-8 8-24 2-22-12 2-16 24-20 32-8" fill="none" stroke={w} strokeWidth="3" strokeLinecap="round" opacity=".9" />
          <path d="M40 52c-10 2-14-6-8-12 8-8 24-2 22 12" fill="none" stroke={item.a} strokeWidth="2.4" strokeLinecap="round" opacity=".9" />
          <circle cx="40" cy="52" r="4" fill={w} />
          {[[26, 40], [56, 62], [52, 38], [28, 64]].map(([x, y], k) => (
            <circle key={k} cx={x} cy={y} r="1.3" fill={w} />
          ))}
        </g>
      );
    default:
      return (
        <path
          d="M40 34l5.2 11 12 1.5-8.9 8.2 2.4 11.9L40 60.6l-10.7 6 2.4-11.9-8.9-8.2 12-1.5z"
          fill={w}
          opacity=".95"
          filter={`url(#${id}g)`}
        />
      );
  }
}

export function BannerArt({ item, size = 110 }: { item: ClanItem; size?: number }) {
  const id = uid(useId());
  const legendary = item.rarity === "legendary";
  return (
    <svg viewBox="0 0 80 112" width={size * (80 / 112)} height={size} aria-hidden className="cx-banner">
      <defs>
        <linearGradient id={`${id}c`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={item.a} />
          <stop offset="1" stopColor={item.b} />
        </linearGradient>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity=".32" />
          <stop offset=".22" stopColor="#fff" stopOpacity=".16" />
          <stop offset=".5" stopColor="#000" stopOpacity=".18" />
          <stop offset=".78" stopColor="#fff" stopOpacity=".14" />
          <stop offset="1" stopColor="#000" stopOpacity=".34" />
        </linearGradient>
        <linearGradient id={`${id}r`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff6dc" />
          <stop offset=".5" stopColor="#d9a744" />
          <stop offset="1" stopColor="#7a5414" />
        </linearGradient>
        <filter id={`${id}g`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* древко с навершиями */}
      <rect x="5" y="9" width="70" height="4.2" rx="2.1" fill={`url(#${id}r)`} />
      <circle cx="5" cy="11" r="4" fill={`url(#${id}r)`} />
      <circle cx="75" cy="11" r="4" fill={`url(#${id}r)`} />
      <path d="M40 2l3 5h-6z" fill={`url(#${id}r)`} />
      {/* полотно */}
      <path d="M12 13 H68 V84 L40 104 L12 84Z" fill={`url(#${id}c)`} />
      <path d="M12 13 H68 V84 L40 104 L12 84Z" fill={`url(#${id}f)`} />
      <path d="M16 17 H64 V82 L40 99 L16 82Z" fill="none" stroke={legendary ? "#ffe6a6" : "#fff"} strokeOpacity={legendary ? 0.9 : 0.45} strokeWidth="1.2" />
      {legendary && <path d="M12 13 H68 V84 L40 104 L12 84Z" fill="none" stroke={`url(#${id}r)`} strokeWidth="2.2" />}
      {bannerMark(item, id)}
      {/* кисти */}
      <path d="M12 84 l-1 10 M68 84 l1 10" stroke={`url(#${id}r)`} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="11" cy="96" r="2.2" fill={`url(#${id}r)`} />
      <circle cx="69" cy="96" r="2.2" fill={`url(#${id}r)`} />
      {item.fx === "sakura" &&
        [0, 1, 2].map((k) => (
          <path key={k} className="cx-anim cx-fall" style={{ animationDelay: `${k * -1.3}s` }} d={`M${26 + k * 14} 70c-2-3-2-6 0-7 2 1 2 4 0 7z`} fill="#fff" opacity=".85" />
        ))}
    </svg>
  );
}

/* -------------------------------- Аура ---------------------------------- */

function auraFx(item: ClanItem, id: string): ReactNode {
  switch (item.fx) {
    case "embers":
      return Array.from({ length: 9 }, (_, k) => (
        <circle
          key={k}
          className="cx-anim cx-rise"
          style={{ animationDelay: `${(k * -0.47).toFixed(2)}s` }}
          cx={22 + ((k * 37) % 56)}
          cy={78 - (k % 3) * 6}
          r={1.2 + (k % 3) * 0.6}
          fill={k % 2 ? item.a : "#fff3c4"}
        />
      ));
    case "frost":
      return (
        <g className="cx-anim cx-spin-slow" style={{ transformOrigin: "50px 50px" }}>
          {Array.from({ length: 8 }, (_, k) => (
            <g key={k} transform={`rotate(${k * 45} 50 50)`}>
              <path d="M50 4 V16 M46 8 L50 12 L54 8 M47 13 L50 15.5 L53 13" stroke={item.a} strokeWidth="1.4" fill="none" strokeLinecap="round" />
            </g>
          ))}
        </g>
      );
    case "petals":
      return (
        <g className="cx-anim cx-spin" style={{ transformOrigin: "50px 50px" }}>
          {Array.from({ length: 10 }, (_, k) => (
            <path key={k} d="M50 6c-3-4-3-8 0-9 3 1 3 5 0 9z" fill={k % 2 ? item.a : item.b} opacity=".9" transform={`rotate(${k * 36} 50 50)`} />
          ))}
        </g>
      );
    case "storm":
      return (
        <g>
          {[20, 140, 255].map((r, k) => (
            <path
              key={r}
              className="cx-anim cx-flash"
              style={{ animationDelay: `${k * -0.6}s` }}
              d="M50 3 L45 14 L52 15 L46 27"
              fill="none"
              stroke={item.a}
              strokeWidth="2.2"
              strokeLinejoin="round"
              strokeLinecap="round"
              transform={`rotate(${r} 50 50)`}
              filter={`url(#${id}g)`}
            />
          ))}
        </g>
      );
    case "aurora":
      return (
        <g className="cx-anim cx-sway" style={{ transformOrigin: "50px 50px" }} opacity=".85">
          <path d="M6 38 C24 22 40 44 56 30 S88 26 94 36" fill="none" stroke={item.a} strokeWidth="6" strokeLinecap="round" opacity=".55" filter={`url(#${id}g)`} />
          <path d="M8 66 C26 54 44 74 60 62 S86 58 94 66" fill="none" stroke={item.b} strokeWidth="5" strokeLinecap="round" opacity=".55" filter={`url(#${id}g)`} />
        </g>
      );
    case "void":
      return (
        <g>
          <g className="cx-anim cx-spin" style={{ transformOrigin: "50px 50px" }}>
            <ellipse cx="50" cy="50" rx="47" ry="16" fill="none" stroke={`url(#${id}v)`} strokeWidth="4" transform="rotate(-18 50 50)" />
          </g>
          <circle cx="50" cy="50" r="30" fill="none" stroke={item.a} strokeOpacity=".5" strokeWidth="1" />
        </g>
      );
    case "phoenix":
      return (
        <g className="cx-anim cx-breathe" style={{ transformOrigin: "50px 60px" }}>
          {[1, -1].map((dir) => (
            <g key={dir} transform={dir < 0 ? "translate(100 0) scale(-1 1)" : undefined}>
              <path d="M50 62 C64 50 80 36 98 30 C88 40 86 46 92 48 C80 50 76 56 82 60 C72 60 64 64 58 70Z" fill={`url(#${id}w)`} opacity=".95" />
              <path d="M58 60 C70 52 82 44 92 40" stroke="#fff3c4" strokeWidth="1" fill="none" opacity=".7" />
            </g>
          ))}
        </g>
      );
    default:
      return null;
  }
}

export function AuraArt({ item, size = 100, core = false }: { item: ClanItem; size?: number; core?: boolean }) {
  const id = uid(useId());
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden className="cx-aura" overflow="visible">
      <defs>
        <radialGradient id={`${id}a`} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor={item.a} stopOpacity=".85" />
          <stop offset=".45" stopColor={item.a} stopOpacity=".35" />
          <stop offset=".75" stopColor={item.b} stopOpacity=".22" />
          <stop offset="1" stopColor={item.b} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}v`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={item.a} stopOpacity="0" />
          <stop offset=".5" stopColor="#fff" />
          <stop offset="1" stopColor={item.a} stopOpacity=".2" />
        </linearGradient>
        <linearGradient id={`${id}w`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff3c4" />
          <stop offset=".4" stopColor={item.a} />
          <stop offset="1" stopColor={item.b} stopOpacity=".2" />
        </linearGradient>
        <filter id={`${id}g`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.8" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle className="cx-anim cx-pulse" style={{ transformOrigin: "50px 50px" }} cx="50" cy="50" r="50" fill={`url(#${id}a)`} />
      {item.fx === "void" && <circle cx="50" cy="50" r="22" fill="#05010c" />}
      {auraFx(item, id)}
      {/* в карточке магазина — силуэт герба, чтобы было видно, как аура его обнимает */}
      {core && (
        <g>
          <circle cx="50" cy="50" r="17" fill="#0a0f26" stroke={item.a} strokeOpacity=".7" strokeWidth="1.2" />
          <path d="M50 39 L58 43 V51 C58 56 54 60 50 62 C46 60 42 56 42 51 V43Z" fill="none" stroke={item.a} strokeOpacity=".8" strokeWidth="1.3" strokeLinejoin="round" />
        </g>
      )}
    </svg>
  );
}

/* -------------------------------- Рамка --------------------------------- */

function frameFx(item: ClanItem, id: string): ReactNode {
  const gold = `url(#${id}m)`;
  switch (item.fx) {
    case "laurel":
      return [1, -1].map((dir) => (
        <g key={dir} transform={dir < 0 ? "translate(100 0) scale(-1 1)" : undefined}>
          <path d="M50 96 C30 92 14 76 10 54" fill="none" stroke={gold} strokeWidth="1.6" />
          {Array.from({ length: 7 }, (_, k) => {
            const t = k / 6;
            const ang = 100 + t * 70;
            const r = 44;
            const x = 50 + Math.cos((ang * Math.PI) / 180) * r;
            const y = 50 + Math.sin((ang * Math.PI) / 180) * r;
            return <ellipse key={k} cx={x} cy={y} rx="5.5" ry="2.4" fill={gold} transform={`rotate(${ang + 60} ${x} ${y})`} />;
          })}
        </g>
      ));
    case "royal":
      return [0, 45, 90, 135, 180, 225, 270, 315].map((r, k) => (
        <g key={r} transform={`rotate(${r} 50 50)`}>
          <path d="M50 1.5 L54 7 L50 12.5 L46 7Z" fill={k % 2 ? gold : item.b} stroke="#fff" strokeOpacity=".7" strokeWidth=".6" />
          {k % 2 === 0 && <circle cx="50" cy="7" r="1.6" fill="#fff" opacity=".9" />}
        </g>
      ));
    case "runes":
      return (
        <g className="cx-anim cx-spin-slow" style={{ transformOrigin: "50px 50px" }}>
          <circle cx="50" cy="50" r="47" fill="none" stroke={item.a} strokeOpacity=".55" strokeWidth=".8" strokeDasharray="1 3" />
          {Array.from({ length: 12 }, (_, k) => (
            <path
              key={k}
              d={["M49 2v7l3-3", "M48 2l4 3-4 3", "M50 2v7M48 4h4", "M48 2l2 7 2-7"][k % 4]}
              stroke={item.a}
              strokeWidth="1.2"
              fill="none"
              strokeLinecap="round"
              transform={`rotate(${k * 30} 50 50)`}
              filter={`url(#${id}g)`}
            />
          ))}
        </g>
      );
    case "prism":
      return (
        <g>
          <circle className="cx-anim cx-spin" style={{ transformOrigin: "50px 50px" }} cx="50" cy="50" r="45" fill="none" stroke={`url(#${id}p)`} strokeWidth="3" />
          {[30, 150, 270].map((r) => (
            <path key={r} d="M50 0 L52.5 6 L50 12 L47.5 6Z" fill="#fff" transform={`rotate(${r} 50 50)`} filter={`url(#${id}g)`} />
          ))}
        </g>
      );
    case "crown":
      return (
        <g>
          <path d="M32 12 L36 -2 L43 7 L50 -6 L57 7 L64 -2 L68 12 Z" fill={gold} stroke="#fff6dc" strokeWidth=".8" strokeLinejoin="round" />
          {[36, 50, 64].map((x, k) => (
            <circle key={x} cx={x} cy={k === 1 ? -6 : -2} r="2.2" fill={item.b} stroke="#fff" strokeWidth=".6" />
          ))}
          <circle cx="50" cy="7" r="2.6" fill={item.b} stroke="#fff" strokeWidth=".6" />
          {[1, -1].map((dir) => (
            <path key={dir} d="M8 44 C2 36 2 26 8 18 C9 28 13 34 18 38Z" fill={gold} opacity=".9" transform={dir < 0 ? "translate(100 0) scale(-1 1)" : undefined} />
          ))}
        </g>
      );
    case "jade":
      return [45, 135, 225, 315].map((r) => (
        <g key={r} transform={`rotate(${r} 50 50)`}>
          <path d="M50 1 C54 4 54 9 50 12 C46 9 46 4 50 1Z" fill={gold} stroke="#fff" strokeOpacity=".6" strokeWidth=".6" />
        </g>
      ));
    default:
      return Array.from({ length: 12 }, (_, k) => <circle key={k} cx="50" cy="6.5" r="1.9" fill={gold} transform={`rotate(${k * 30} 50 50)`} />);
  }
}

export function FrameArt({ item, size = 100 }: { item: ClanItem; size?: number }) {
  const id = uid(useId());
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden className="cx-frame" overflow="visible">
      <defs>
        <linearGradient id={`${id}r`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={item.a} />
          <stop offset=".5" stopColor={item.b} />
          <stop offset="1" stopColor={item.a} />
        </linearGradient>
        <linearGradient id={`${id}m`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff6dc" />
          <stop offset=".45" stopColor={item.fx === "jade" || item.fx === "runes" ? item.a : "#e4b04c"} />
          <stop offset="1" stopColor={item.fx === "jade" || item.fx === "runes" ? item.b : "#7a5414"} />
        </linearGradient>
        <linearGradient id={`${id}p`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff6fb0" />
          <stop offset=".25" stopColor="#ffd36b" />
          <stop offset=".5" stopColor="#7effc4" />
          <stop offset=".75" stopColor="#7ee8ff" />
          <stop offset="1" stopColor="#b48bff" />
        </linearGradient>
        <filter id={`${id}g`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* корпус оправы: тень, кольцо, фаска */}
      <circle cx="50" cy="50" r="42.5" fill="none" stroke="#000" strokeOpacity=".45" strokeWidth="10" />
      <circle cx="50" cy="50" r="42" fill="none" stroke={item.fx === "prism" ? `url(#${id}p)` : `url(#${id}r)`} strokeWidth="7.5" />
      <circle cx="50" cy="50" r="45.6" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth=".8" />
      <circle cx="50" cy="50" r="38.4" fill="none" stroke="#fff" strokeOpacity=".3" strokeWidth=".7" />
      <path d="M17 32 A38 38 0 0 1 50 8" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="2" strokeLinecap="round" />
      {frameFx(item, id)}
    </svg>
  );
}

/** Предмет целиком — для карточек магазина */
export function CosmeticArt({ item, size = 100 }: { item: ClanItem; size?: number }) {
  if (item.slot === "banner") return <BannerArt item={item} size={size * 1.05} />;
  if (item.slot === "aura") return item.aura ? <AuraFx item={item} size={size} /> : <AuraArt item={item} size={size} core />;
  // eslint-disable-next-line @next/next/no-img-element
  if (item.motif) return <ClanFrameArt motif={item.motif} a={item.a} b={item.b} c={item.gem ?? item.a} size={size} />;
  if (item.img) return <img src={item.img} alt="" style={{ width: size, height: size, objectFit: "contain" }} />;
  return <FrameArt item={item} size={size} />;
}

/**
 * Герб с надетыми аурой и рамкой — шапка клана и примерочная магазина.
 * Аура лежит под гербом и выходит за него, рамка — сверху точно по кругу.
 */
/** Живая аура (CSS-слои из clan-aura.css): свечение, кольцо, лучи, частицы */
export function AuraFx({ item, size }: { item: ClanItem; size: number }) {
  const kind = item.aura ?? "corona";
  return (
    <span className={`xa xa-${kind}`} style={{ width: size, height: size, ["--xa1" as string]: item.a, ["--xa2" as string]: item.b }} aria-hidden>
      <i className="xa-glow" />
      <i className="xa-ring" />
      <i className="xa-ring2" />
      {Array.from({ length: 8 }, (_, k) => <i key={k} className="xa-p" style={{ ["--k" as string]: k }} />)}
    </span>
  );
}

/**
 * Герб/аватар клана с аурой и рамкой. Рамка-картинка садится как в профиле:
 * аватар — круг, картинка рамки больше него в `scale` раз и сдвинута на dx/dy.
 */
export function CrestStage({
  clanId,
  emblemId,
  size,
  aura,
  frame,
  interactive = false,
  avatarV = 0,
}: {
  clanId: number;
  emblemId?: string;
  size: number;
  aura?: ClanItem;
  frame?: ClanItem;
  interactive?: boolean;
  avatarV?: number;
}) {
  const imgFrame = frame?.img ? frame : undefined;
  const svgFrame = frame?.motif ? frame : undefined;
  const round = !!(imgFrame || svgFrame || aura);
  const inner = round ? Math.round(size * 0.6) : size;
  return (
    <span className={`cx-stage cx-live${imgFrame ? " has-imgframe" : ""}`} style={{ width: size, height: size }}>
      {aura && (
        <span className="cx-stage-aura">
          {aura.aura ? <AuraFx item={aura} size={inner * 2.1} /> : <AuraArt item={aura} size={size * 1.7} />}
        </span>
      )}
      <span className={`cx-stage-crest${round ? " is-round" : ""}`} style={{ width: inner, height: inner }}>
        <Crest clanId={clanId} emblemId={emblemId} avatarV={avatarV} size={inner} interactive={interactive} />
      </span>
      {imgFrame && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="cx-stage-imgframe"
          src={imgFrame.img}
          alt=""
          aria-hidden
          style={{ width: inner * (imgFrame.scale ?? 1.3), height: inner * (imgFrame.scale ?? 1.3), translate: `calc(-50% + ${(imgFrame.dx ?? 0) * 100}%) calc(-50% + ${(imgFrame.dy ?? 0) * 100}%)` }}
        />
      )}
      {svgFrame && (
        <span className="cx-stage-svgframe">
          <ClanFrameArt motif={svgFrame.motif!} a={svgFrame.a} b={svgFrame.b} c={svgFrame.gem ?? svgFrame.a} size={inner * (200 / 120)} />
        </span>
      )}
      {frame && !imgFrame && !svgFrame && (
        <span className="cx-stage-frame">
          <FrameArt item={frame} size={size * 1.02} />
        </span>
      )}
    </span>
  );
}
