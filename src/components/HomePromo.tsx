"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAccount } from "@/lib/use-account";
import { isPremiumActive } from "@/lib/auth";
import { useProgress } from "@/lib/progression/events";
import { BATTLEPASS } from "@/lib/battlepass/config";
import { bpProgress } from "@/lib/battlepass/logic";
import { AgTag } from "@/components/progression/AgTag";
import { TITLES, titleTag } from "@/lib/cosmetics";
import { DONATE_LEFT, DONATE_TOTAL } from "@/lib/donate-campaign";
import "./home-promo.css";

const nf = new Intl.NumberFormat("ru-RU");

const RARITIES = [
  { id: "common", label: "Обычные", color: "#9aa3b5" },
  { id: "rare", label: "Редкие", color: "#4ac5f5" },
  { id: "epic", label: "Эпические", color: "#b05cff" },
  { id: "legendary", label: "Легендарные", color: "#ffb020" },
  { id: "mythic", label: "Мифические", color: "#ff3b5c" },
] as const;
function countRewards(line: "free" | "premium"): number {
  return BATTLEPASS.levels.reduce((n, l) => n + (l[line]?.length ?? 0), 0);
}
const DONATER_TAG = titleTag(TITLES.find((t) => t.id === "t-donater") ?? TITLES[TITLES.length - 1]);

const SEASON = BATTLEPASS.name.split("·").map((p) => p.trim());

/** Две плашки главной: Premium и Боевой пропуск. Свои, без iframe. */
export function HomePromo() {
  const account = useAccount();
  const premium = isPremiumActive(account);
  const doc = useProgress();
  const prog = useMemo(() => bpProgress(doc.battlepass.xp), [doc.battlepass.xp]);
  const [days, setDays] = useState<number | null>(null);
  const freeCount = countRewards("free");
  const totalCount = freeCount + countRewards("premium");

  useEffect(() => {
    const t = window.setTimeout(
      () => setDays(Math.max(0, Math.ceil((BATTLEPASS.to - Date.now()) / 86_400_000))),
      0,
    );
    return () => window.clearTimeout(t);
  }, []);

  const spot = (e: React.PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
    e.currentTarget.style.setProperty("--tx", String((e.clientX - r.left) / r.width - 0.5));
    e.currentTarget.style.setProperty("--ty", String((e.clientY - r.top) / r.height - 0.5));
  };

  return (
    <div className="hp-grid">
      {/* ------------------------- Поддержать проект ------------------------- */}
      <article className="hp-card hp-prem hp-don" onPointerMove={spot}>
        <i className="hp-bgimg" aria-hidden />
        <i className="hp-glow" aria-hidden />
        <i className="hp-gl-a" aria-hidden />
        <i className="hp-gl-b" aria-hidden />
        <svg className="hp-orbit" viewBox="0 0 400 300" preserveAspectRatio="xMaxYMax slice" fill="none" aria-hidden>
          <defs>
            <linearGradient id="hp-or1" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#ffd9a8" stopOpacity="0" />
              <stop offset=".5" stopColor="#ff9fd2" stopOpacity=".9" />
              <stop offset="1" stopColor="#b9a4ff" stopOpacity=".9" />
            </linearGradient>
            <radialGradient id="hp-or-g">
              <stop offset="0" stopColor="#fff" />
              <stop offset="1" stopColor="#ff8ad8" stopOpacity="0" />
            </radialGradient>
          </defs>
          <path id="hp-orp1" className="hp-or-l" d="M-10 292C80 250 170 262 250 206S372 98 412 40" stroke="url(#hp-or1)" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
          <path id="hp-orp2" className="hp-or-l hp-or-l--2" d="M30 304C120 268 210 270 288 222S380 140 412 96" stroke="url(#hp-or1)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <path className="hp-or-l hp-or-l--3" d="M110 306C190 286 270 276 340 238S402 184 412 160" stroke="url(#hp-or1)" strokeWidth=".8" vectorEffect="non-scaling-stroke" />
          <circle r="5" fill="url(#hp-or-g)" className="hp-or-dot">
            <animateMotion dur="7s" repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines=".4 0 .2 1"><mpath href="#hp-orp1" /></animateMotion>
          </circle>
          <circle r="3.5" fill="url(#hp-or-g)" className="hp-or-dot">
            <animateMotion dur="9s" begin="2.5s" repeatCount="indefinite" calcMode="spline" keyPoints="0;1" keyTimes="0;1" keySplines=".4 0 .2 1"><mpath href="#hp-orp2" /></animateMotion>
          </circle>
        </svg>
        <svg className="hp-flower" viewBox="0 0 80 80" fill="none" aria-hidden>
          <defs>
            <radialGradient id="hp-fl" cx=".5" cy=".5" r=".6">
              <stop offset="0" stopColor="#ffd1ea" />
              <stop offset="1" stopColor="#ff4fa0" />
            </radialGradient>
          </defs>
          {[0, 72, 144, 216, 288].map((r) => (
            <ellipse key={r} cx="40" cy="22" rx="11" ry="17" fill="url(#hp-fl)" transform={`rotate(${r} 40 40)`} />
          ))}
          <circle cx="40" cy="40" r="5" fill="#ffe8a3" />
        </svg>
        <span className="hp-petals" aria-hidden>
          {Array.from({ length: 12 }, (_, i) => (
            <b key={i} style={{ "--x": (i * 47 + 5) % 100, "--d": `${8 + (i % 5) * 1.8}s`, "--w": `${-i * 1.1}s`, "--s": `${7 + (i % 4) * 3}px`, "--r": `${(i * 37) % 360}deg` } as React.CSSProperties} />
          ))}
        </span>
        <div className="hp-heart3" aria-hidden>
          <i className="rg rg1" />
          <i className="rg rg2" />
          <svg viewBox="0 0 64 60" fill="none">
            <defs>
              <linearGradient id="hp-h3" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#ffb3d9" />
                <stop offset=".55" stopColor="#ff4f9a" />
                <stop offset="1" stopColor="#d93a8c" />
              </linearGradient>
            </defs>
            <path d="M32 56C12 42 3 32 3 20 3 11 10 4 19 4c6 0 10 3 13 8 3-5 7-8 13-8 9 0 16 7 16 16 0 12-9 22-29 36z" fill="url(#hp-h3)" />
            <path d="M14 14c-5 1-8 5-8 10" stroke="#fff" strokeOpacity=".75" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
        {[0, 1, 2, 3, 4].map((i) => (
          <u key={i} className={`hp-star hp-star--${i} hp-star3`} />
        ))}
        <div className="hp-body">
          <span className="hp-eyebrow">ПОДДЕРЖИ ПРОЕКТ</span>
          <h3>Стань частью <em>AniGalaxy</em></h3>
          <p>Поддержка помогает сайту расти. Взамен — тег «Донатер», Premium и аникойны (AC).</p>
          <div className="hp-tagrow">
            <span>Оформи сейчас — получишь</span>
            <AgTag tag={DONATER_TAG} size="sm" />
          </div>
          <div className="hp-slots">
            <div className="hp-slots-row">
              <span>Осталось наборов</span>
              <b>{nf.format(DONATE_LEFT)} <small>из {nf.format(DONATE_TOTAL)}</small></b>
            </div>
            <div
              className="hp-meter"
              style={{ "--p": DONATE_LEFT / DONATE_TOTAL } as React.CSSProperties}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={DONATE_TOTAL}
              aria-valuenow={DONATE_LEFT}
            >
              <div className="hp-meter-track" />
              <div className="hp-meter-fill" />
              <i className="hp-meter-cap" />
            </div>
            <div className="hp-meter-scale" aria-hidden>
              <span>0</span>
              <span>250</span>
              <span>500</span>
              <span>750</span>
              <span>1 000</span>
            </div>
          </div>
          <div className="hp-foot">
            <Link href="/donate" className="hp-cta hp-cta--don">
              <svg className="hp-crown-ic" viewBox="0 0 24 24" aria-hidden><path d="M3 8l4.500 4L12 5l4.500 7L21 8l-2 11H5z" fill="currentColor" /></svg>
              Поддержать проект <span aria-hidden>→</span>
            </Link>
            <span className="hp-hint">
              Тег остаётся <b>навсегда</b> · <Link href="/premium">{premium ? "Premium" : "О Premium"}</Link>
            </span>
          </div>
        </div>
      </article>

      {/* --------------------------- Боевой пропуск -------------------------- */}
      <article className="hp-card hp-pass" onPointerMove={spot}>
        <i className="hp-glow" aria-hidden />
        <div className="hp-moon" aria-hidden />
        <i className="hp-crescent" aria-hidden />
        <i className="hp-fog" aria-hidden />
        <i className="hp-hud" aria-hidden />
        <span className="hp-embers" aria-hidden>
          {Array.from({ length: 16 }, (_, i) => (
            <b key={i} style={{ "--x": (i * 41 + 11) % 100, "--d": `${7 + (i % 6) * 1.5}s`, "--w": `${-i * 0.8}s`, "--s": `${2 + (i % 3)}px` } as React.CSSProperties} />
          ))}
        </span>
        <div className="hp-body">
          <div className="hp-head">
            <span className="hp-season">
              <small>СЕЗОН</small>
              <b>{SEASON[0].replace(/\D+/g, "") || "1"}</b>
            </span>
            <div>
              <span className="hp-eyebrow hp-eyebrow--pass">БОЕВОЙ ПРОПУСК</span>
              <h3>{SEASON[1] ?? SEASON[0]}</h3>
            </div>
          </div>
          <div className="hp-stats">
            <span><b>{BATTLEPASS.maxLevel}</b> уровней</span>
            <span><b>{BATTLEPASS.levels.length}</b> наград</span>
            <span><b>{days === null ? "—" : days}</b> дн. до конца</span>
          </div>
          <p className="hp-desc">
            Бескрайняя пустыня под вечной луной. Срывай маски Пустых на каждом уровне: аникойны,
            теги и рамки — бесплатно, эксклюзивы и мифическое оформление профиля — с Premium.
          </p>
          <ul className="hp-rar" aria-label="Редкость наград">
            {RARITIES.map((r) => (
              <li key={r.id} style={{ "--c": r.color } as React.CSSProperties}>
                <i />
                {r.label}
              </li>
            ))}
          </ul>
          <div className="hp-foot">
            <Link href="/battlepass" className="hp-cta hp-cta--pass">
              Открыть пропуск <span aria-hidden>→</span>
            </Link>
            <span className="hp-hint">
              <b>{freeCount} из {totalCount}</b> предметов — бесплатно, без покупки пропуска
            </span>
          </div>
          <div className="hp-lvl">
            <div className="hp-lvl-row">
              <span>Твой уровень <b>{prog.level}</b></span>
              <em>{prog.into} / {prog.need} XP</em>
            </div>
          </div>
        </div>
        <div
          className="hp-garland"
          style={{ "--w": `${(3 + Math.min(1, (prog.level + prog.into / Math.max(1, prog.need)) / BATTLEPASS.maxLevel) * 94).toFixed(1)}%` } as React.CSSProperties}
          role="progressbar"
          aria-label="Прогресс боевого пропуска"
          aria-valuemin={0}
          aria-valuemax={BATTLEPASS.maxLevel}
          aria-valuenow={prog.level}
        >
          <i className="hp-garland-head" />
        </div>
      </article>
    </div>
  );
}
