"use client";

/**
 * Превью профиля с наградами сезона: так аватар, рамка и титул выглядят
 * в профиле, когда собраны супер-призы. Это пример оформления, а не данные
 * аккаунта — цифры и «Любимое» в нём условные, и на карточке это подписано.
 */

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties } from "react";

import { AgTag } from "@/components/progression/AgTag";
import { AvatarFrame } from "@/components/profile/AvatarFrame";
import { BpIcon } from "@/components/battlepass/BpIcons";
import { EXCLUSIVE_CARDS } from "@/components/battlepass/model";
import { FRAMES } from "@/lib/cosmetics";

/** Фонарь: простой SVG с мерцающим свечением */
function Lantern({ delay = 0 }: { delay?: number }) {
  return (
    <svg className="pv2-lamp" viewBox="0 0 40 64" aria-hidden style={{ "--d": `${delay}s` } as CSSProperties}>
      <defs>
        <linearGradient id={`pv2-lg-${delay}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffb3a0" />
          <stop offset=".5" stopColor="#ff3d62" />
          <stop offset="1" stopColor="#7d0b24" />
        </linearGradient>
      </defs>
      <path d="M20 0v10" stroke="#ffd9a0" strokeWidth="1.6" />
      <rect x="11" y="9" width="18" height="4" rx="1.5" fill="#2a0a12" stroke="#ffd9a0" strokeOpacity=".6" />
      <path d="M12 13h16c4 4 5 12 0 24H12C7 25 8 17 12 13z" fill={`url(#pv2-lg-${delay})`} />
      <path d="M16 14c-3 7-3 16 0 23M24 14c3 7 3 16 0 23" stroke="#ffd9a0" strokeOpacity=".35" fill="none" />
      <rect x="12" y="37" width="16" height="4" rx="1.5" fill="#2a0a12" stroke="#ffd9a0" strokeOpacity=".6" />
      <path d="M20 41v9m-3 0h6l-3 8z" fill="#ffd9a0" fillOpacity=".8" />
    </svg>
  );
}


/** Плавный счётчик: число «набегает» при открытии превью */
function CountUp({ to }: { to: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      const raf = requestAnimationFrame(() => setV(to));
      return () => cancelAnimationFrame(raf);
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0 - 450) / 1300);
      setV(Math.round(to * (1 - Math.pow(1 - Math.max(0, k), 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{v.toLocaleString("ru-RU")}</>;
}


/** Адская бабочка (дзигокутё): крылья машут, по краю тлеет красный */
function HellButterfly({ cls }: { cls: string }) {
  return (
    <span className={`pv2-bf ${cls}`} aria-hidden>
      <svg viewBox="0 0 40 30">
        <g className="pv2-wing pv2-wing-l">
          <path d="M20 15C14 4 4 0 1 5c-2 6 6 12 19 10z" />
          <path d="M20 16C12 18 6 26 11 28c5 1 9-5 9-12z" />
        </g>
        <g className="pv2-wing pv2-wing-r">
          <path d="M20 15C26 4 36 0 39 5c2 6-6 12-19 10z" />
          <path d="M20 16c8 2 14 10 9 12-5 1-9-5-9-12z" />
        </g>
        <path d="M20 9v14" stroke="#ff6b88" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/** Лунный серп «Гецуга Тенсё»: пролетает по плашке раз в несколько секунд */
function Getsuga() {
  return (
    <svg className="pv2-slash" viewBox="0 0 170 90" aria-hidden>
      <defs>
        <linearGradient id="pv2-gt" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#8a0a25" stopOpacity="0" />
          <stop offset=".5" stopColor="#ff3d62" />
          <stop offset="1" stopColor="#fff" />
        </linearGradient>
      </defs>
      <path d="M2 86C36 14 112 -6 166 10 108 16 52 40 2 86z" fill="url(#pv2-gt)" />
    </svg>
  );
}

/** Выбор самых высоких рамки и титула сезона — общий для превью и мини-витрины */
function useTopRewards() {
  return useMemo(() => {
    const byLevel = [...EXCLUSIVE_CARDS].sort((a, b) => b.level - a.level);
    const frameCard = byLevel.find((c) => c.view.kind === "frame" && FRAMES.some((f) => f.id === (c.view as { itemId?: string }).itemId));
    const frame = frameCard ? FRAMES.find((f) => f.id === (frameCard.view as { itemId?: string }).itemId) : undefined;
    const tagCard = byLevel.find((c) => c.view.kind === "tag");
    return { frameCard, frame, tagCard };
  }, []);
}

/** Плашка уровня с живыми данными: уровень, серии, часы и полоса опыта */
export function ProfilePlaque({ level, series, hours, percent }: { level: number; series: number; hours: number; percent: number }) {
  return (
    <section
      className="pv2-pl"
      style={{ ["--p" as string]: `${Math.max(2, Math.min(100, percent))}%` }}
      aria-label={`Уровень ${level}, ${series} серий, ${hours} часов`}
    >
      <div className="pv2-pl-stage" aria-hidden>
        <div className="pv2-pl-art" />
        <i className="pv2-pl-moon" />
        <i className="pv2-pl-ring" />
        <i className="pv2-pl-crest" />
        <i className="pv2-pl-eye" />
        <span className="pv2-pl-mist m1" />
        <span className="pv2-pl-mist m2" />
        <span className="pv2-pl-embers">
          {Array.from({ length: 14 }, (_, i) => (
            <i key={i} style={{ ["--i" as string]: i }} />
          ))}
        </span>
      </div>
      <div className="pv2-pl-lvl" aria-hidden>
        <b>{level}</b>
      </div>
      <div className="pv2-pl-stat s1" aria-hidden>
        <b>
          <CountUp to={series} />
        </b>
        <small>серий</small>
      </div>
      <div className="pv2-pl-stat s2" aria-hidden>
        <b>
          <CountUp to={hours} />
        </b>
        <small>часов</small>
      </div>
      <div className="pv2-pl-bar" aria-hidden>
        <i />
      </div>
      <span className="pv2-pl-spark" aria-hidden />
    </section>
  );
}

/** Сезонное оформление в живом профиле: луна, лепестки и лента за шапкой профиля */
export function ProfileDecor() {
  return (
    <div className="pv2-decor" aria-hidden>
      <i className="pv2-moon pv2-moon-d" />
      <span className="pv2-fx">
        {Array.from({ length: 12 }, (_, i) => (
          <i key={i} style={{ ["--i" as string]: i }} />
        ))}
      </span>
      <div className="pv2-strip pv2-strip-d">
        <span>虚圏</span> HUECO MUNDO <span>虚圏</span>
      </div>
    </div>
  );
}

/** Мини-витрина супер-приза: аватар в рамке и титул на сцене сезона */
export function ProfileMini({ nickname }: { nickname: string }) {
  const { frame, tagCard } = useTopRewards();
  return (
    <div className="pv2-mini" aria-hidden>
      <span className="pv2-mini-bg" />
      <i className="pv2-moon pv2-moon-s" />
      <span className="pv2-fx">
        {Array.from({ length: 8 }, (_, i) => (
          <i key={i} style={{ ["--i" as string]: i }} />
        ))}
      </span>
      <div className="pv2-card">
        <div className="pv2-card-head">
          <AvatarFrame nickname={nickname} frame={frame} size="sm" />
          <div className="pv2-card-who">
            <b className="pv2-mini-nick">{nickname}</b>
            <span className="pv2-card-rank">Ранг III · Хуэко Мундо</span>
            {tagCard && tagCard.view.kind === "tag" && <AgTag tag={tagCard.view.tag} size="sm" />}
          </div>
          <span className="pv2-card-lvl">100</span>
        </div>
        <div className="pv2-card-stats">
          <span><b>1 284</b><i>серий</i></span>
          <span><b>512</b><i>тайтлов</i></span>
          <span><b>47</b><i>отзывов</i></span>
        </div>
        <div className="pv2-card-tabs">
          <span>Любимое</span>
          <span>Списки</span>
          <span>Награды</span>
        </div>
      </div>
      <i className="pv2-mlamp pv2-mlamp-l" />
      <i className="pv2-mlamp pv2-mlamp-r" />
      <span className="pv2-expand" aria-hidden>⤢</span>
    </div>
  );
}

export function ProfilePreview({ nickname, onClose }: { nickname: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const { frameCard, frame, tagCard } = useTopRewards();

  /* Портал в body: предки с transform (анимация появления секции) ломают position:fixed */
  const [host, setHost] = useState<HTMLElement | null>(null);
  // Портал: document доступен только на клиенте, поэтому хост берём после монтирования
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setHost(document.body), []);
  if (!host) return null;

  return createPortal(
    <div className="pv2-ov" role="dialog" aria-modal="true" aria-label="Профиль с наградами сезона" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pv2-wrap">
        <div className="pv2-top">
          <span className="pv2-badge">
            <BpIcon name="crown" size={16} /> Супер-приз сезона
          </span>
          <button type="button" className="pv2-x" aria-label="Закрыть" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="pv2-stage">
          <article
            className="pv2-card"
            onPointerMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              e.currentTarget.style.setProperty("--tx", String(((e.clientX - r.left) / r.width - 0.5).toFixed(3)));
              e.currentTarget.style.setProperty("--ty", String(((e.clientY - r.top) / r.height - 0.5).toFixed(3)));
            }}
            onPointerLeave={(e) => {
              e.currentTarget.style.setProperty("--tx", "0");
              e.currentTarget.style.setProperty("--ty", "0");
            }}
          >
            <div className="pv2-bg" aria-hidden />
            <span className="pv2-mist" aria-hidden />
            <span className="pv2-embers" aria-hidden>
              {Array.from({ length: 16 }, (_, i) => (
                <i key={i} style={{ ["--i" as string]: i }} />
              ))}
            </span>
            <i className="pv2-moon" aria-hidden />
            <span className="pv2-fx" aria-hidden>
              {Array.from({ length: 14 }, (_, i) => (
                <i key={i} style={{ ["--i" as string]: i }} />
              ))}
            </span>

            <div className="pv2-strip pv2-strip-t" aria-hidden>
              <span>虚圏</span> HUECO MUNDO <span>虚圏</span>
            </div>

            <header className="pv2-head">
              <AvatarFrame nickname={nickname} frame={frame} size="md" />
              <div className="pv2-who">
                <h3>{nickname}</h3>
                <small>РАНГ III · ХУЭКО МУНДО</small>
                {tagCard && tagCard.view.kind === "tag" && (
                  <span className="pv2-tag">
                    <AgTag tag={tagCard.view.tag} size="sm" />
                  </span>
                )}
              </div>
            </header>

            <ProfilePlaque level={100} series={1284} hours={512} percent={100} />

            <section className="pv2-fav">
              <h4>
                <BpIcon name="crown" size={15} /> Любимое <em>· 3</em>
              </h4>
              <div className="pv2-favs">
                {["Блич", "Тетрадь смерти", "Сага о Винланде"].map((t, i) => (
                  <div key={t} style={{ ["--n" as string]: i } as CSSProperties}>
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            </section>

            <span className="pv2-note">Пример оформления профиля</span>
          </article>
        </div>

        <p className="pv2-cap">
          В превью: <b>оформление «Хуэко Мундо»</b>
          {frameCard || tagCard ? ", " : null}
          {frameCard ? <b>рамка {frameCard.label}</b> : null}
          {frameCard && tagCard ? " и " : null}
          {tagCard ? <b>титул {tagCard.label}</b> : null} — самые высокие награды сезона.
        </p>
      </div>
    </div>,
    host,
  );
}
