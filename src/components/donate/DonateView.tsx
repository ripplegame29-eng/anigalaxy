"use client";

import { openCheckout } from "@/lib/checkout";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AgTag } from "@/components/progression/AgTag";
import { PremiumChip } from "@/components/profile/PremiumChip";
import { TITLES, titleTag } from "@/lib/cosmetics";
import { DONATE_LEFT, DONATE_TOTAL } from "@/lib/donate-campaign";
import "./donate.css";

/**
 * «Поддержать проект» — страница доната.
 *
 * Транскрипция макета `donate.html`: звёздный фон, маскот с кольцами и
 * параллаксом, три тарифа с 3D-наклоном и монетками-разлеташками, предпросмотр
 * профиля с глитч-ником и тегом «Донатер», счётчик оставшихся наборов с
 * таймером, FAQ, липкая кнопка и тост.
 *
 * Отличия от макета:
 * • классы с префиксом `don-` — в макете они generic, а такие имена в
 *   проекте заняты общими стилями (см. `donate.css`);
 * • картинки — настоящие файлы проекта: маскот `/donate-cat2.png` и монетка
 *   `/coin.png` (в макете стояли заглушки `data-i`);
 * • капсусу тега и PREMIUM-капсулу рисует проект (`AgTag`, `PremiumChip`) —
 *   в макете был вшитый кусок общих стилей `.ag-tag`;
 * • ссылка «Мой профиль» — `next/link`, а не `location.href`;
 * • текст тоста честный: оплаты у проекта нет, и обещать зачисление
 *   AC, которого не будет, нельзя.
 */

/* --------------------------------- Данные --------------------------------- */

interface Tier {
  id: string;
  name: string;
  price: number;
  coins: number;
  prem: string;
  premShort: string;
  perks: string[];
  /** акционный набор в макете обведён бегущей рамкой */
  pop?: boolean;
  max?: boolean;
  badge?: string;
}

const TIERS: Tier[] = [
  {
    id: "start",
    name: "Старт",
    price: 199,
    coins: 1200,
    prem: "1 месяц Premium",
    premShort: "1 месяц",
    perks: ["Тег «Донатер» навсегда"],
  },
  {
    id: "action",
    name: "Акционный набор",
    price: 499,
    coins: 2000,
    prem: "6 месяцев Premium",
    premShort: "6 месяцев",
    perks: ["Эксклюзивный глитч-эффект", "Тег «Донатер» навсегда"],
    pop: true,
    badge: "Выбор большинства",
  },
  {
    id: "space",
    name: "Космос",
    price: 999,
    coins: 4000,
    prem: "Premium на год",
    premShort: "целый год",
    perks: ["Всё из акционного набора", "Максимальный набор акции"],
    max: true,
  },
];

/** Дата конца акции — 5 суток и 7 часов от первого открытия страницы */
const CAMPAIGN_MS = 5 * 864e5 + 7 * 36e5;

/** Осталось наборов акции */
const LEFT = DONATE_LEFT;
const TOTAL = DONATE_TOTAL;

const nf = new Intl.NumberFormat("ru-RU");

/** Тег «Донатер» из косметики проекта — тот самый капсулой, что и в профиле */
const DONATER_TAG = titleTag(TITLES.find((t) => t.id === "t-donater") ?? TITLES[TITLES.length - 1]);

/* --------------------------------- Вид ------------------------------------ */

export function DonateView() {
  const [selected, setSelected] = useState(1);
  const [withPack, setWithPack] = useState(true);
  const [toast, setToast] = useState(false);
  const [ctaHidden, setCtaHidden] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mascotRef = useRef<HTMLDivElement | null>(null);
  const spotRef = useRef<HTMLDivElement | null>(null);
  const balRef = useRef<HTMLElement | null>(null);
  const fillRef = useRef<HTMLElement | null>(null);
  const timerRefs = useRef<(HTMLElement | null)[]>([]);
  const tierRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const tier = TIERS[selected];

  /* ------------------------------ Звёздный фон --------------------------- */
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const cx = cv.getContext("2d");
    if (!cx) return;

    const pointer = { x: 0, y: 0 };
    let stars: { x: number; y: number; z: number; p: number }[] = [];

    const size = () => {
      cv.width = window.innerWidth;
      cv.height = window.innerHeight;
      stars = Array.from({ length: Math.min(180, window.innerWidth / 8) }, () => ({
        x: Math.random() * cv.width,
        y: Math.random() * cv.height,
        z: Math.random() * 0.8 + 0.2,
        p: Math.random() * 6,
      }));
    };

    size();
    window.addEventListener("resize", size);

    let frame = 0;
    const loop = (t: number) => {
      cx.clearRect(0, 0, cv.width, cv.height);
      for (const s of stars) {
        s.y += s.z * 0.15;
        if (s.y > cv.height) s.y = 0;
        const a = 0.4 + 0.6 * Math.abs(Math.sin(t / 1200 + s.p));
        cx.fillStyle = `rgba(255,200,235,${a * s.z})`;
        cx.beginPath();
        cx.arc(s.x - pointer.x * 30 * s.z, s.y - pointer.y * 30 * s.z, s.z * 1.6, 0, 7);
        cx.fill();
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", size);
    };
  }, []);

  /* ------------------- Параллакс маскота и пятно за курсором -------------- */
  useEffect(() => {
    const move = (event: MouseEvent) => {
      const mascot = mascotRef.current;
      if (mascot) {
        const x = event.clientX / window.innerWidth - 0.5;
        const y = event.clientY / window.innerHeight - 0.5;
        mascot.style.transform = `rotateY(${x * 14}deg) rotateX(${-y * 14}deg)`;
      }
      const spot = spotRef.current;
      if (spot) {
        spot.style.left = `${event.clientX}px`;
        spot.style.top = `${event.clientY}px`;
      }
    };
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, []);

  /* ------------------------- Счётчик баланса ---------------------------- */
  useEffect(() => {
    const el = balRef.current;
    if (!el) return;
    const to = withPack ? tier.coins : 0;
    const from = Number(el.dataset.v ?? 0);
    el.dataset.v = String(to);
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 900);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = nf.format(Math.round(from + (to - from) * e));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [withPack, tier.coins]);

  /* ------------------- Прогресс акции — когда блок виден ---------------- */
  useEffect(() => {
    const fill = fillRef.current;
    if (!fill || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        fill.style.width = `${(LEFT / TOTAL) * 100}%`;
        observer.disconnect();
      }
    });
    observer.observe(fill);
    return () => observer.disconnect();
  }, []);

  /* -------------- Липкая кнопка уходит, когда виден подвал -------------- */
useEffect(() => {
    const footer = document.querySelector("footer");
    if (!footer || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setCtaHidden(Boolean(entry?.isIntersecting)),
      // чуть заранее, чтобы полоса ушла до того, как подвал дойдёт до низа
      { rootMargin: "0px 0px -90px" },
    );
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  /* ------------------------------- Таймер ------------------------------- */
  useEffect(() => {
    // Отсчёт всегда от момента открытия страницы: сервер и клиент считают
    // разное, поэтому разметка отдаётся нулями и заполняется здесь.
    const end = Date.now() + CAMPAIGN_MS;
    const tick = () => {
      let left = Math.max(0, end - Date.now());
      [864e5, 36e5, 6e4, 1e3].forEach((unit, i) => {
        const cell = timerRefs.current[i];
        if (cell) cell.textContent = String(Math.floor(left / unit)).padStart(2, "0");
        left %= unit;
      });
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  /* ---------------------------- Разлёт монет ---------------------------- */
  const burst = useCallback((x: number, y: number, n: number, spread = 220) => {
    const root = rootRef.current;
    if (!root) return;
    for (let i = 0; i < n; i++) {
      const coin = document.createElement("img");
      coin.src = "/coin.png";
      coin.alt = "";
      coin.className = "don-pc";
      coin.style.left = `${x}px`;
      coin.style.top = `${y}px`;
      coin.style.setProperty("--dx", `${(Math.random() - 0.5) * spread * 2}px`);
      coin.style.setProperty("--dy", `${-Math.random() * spread - 40}px`);
      coin.style.setProperty("--rt", `${Math.random() * 720 - 360}deg`);
      coin.style.animationDelay = `${Math.random() * 0.15}s`;
      root.appendChild(coin);
      window.setTimeout(() => coin.remove(), 1800);
    }
  }, []);

  /* ------------------------------ Тарифы -------------------------------- */
  const pickTier = (index: number) => {
    setSelected(index);
    const box = tierRefs.current[index]?.getBoundingClientRect();
    if (box) burst(box.left + box.width / 2, box.top + 60, 10);
  };

  const onTierMove = (event: React.MouseEvent<HTMLButtonElement>) => {
    const el = event.currentTarget;
    const r = el.getBoundingClientRect();
    const x = (event.clientX - r.left) / r.width;
    const y = (event.clientY - r.top) / r.height;
    el.style.setProperty("--ry", `${(x - 0.5) * 10}deg`);
    el.style.setProperty("--rx", `${(0.5 - y) * 10}deg`);
    el.style.setProperty("--mx", `${x * 100}%`);
    el.style.setProperty("--my", `${y * 100}%`);
  };

  const onTierLeave = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.style.setProperty("--rx", "0deg");
    event.currentTarget.style.setProperty("--ry", "0deg");
  };

  /* ------------------------------- Покупка ------------------------------ */
  const buy = () => {
    openCheckout({
      title: `Поддержка · ${tier.name}`,
      caption: `${nf.format(tier.coins)} AC · ${tier.prem}`,
      price: tier.price,
      onPaid: () => {
        setToast(true);
        burst(window.innerWidth / 2, window.innerHeight / 2, 40, 420);
      },
    });
  };

  /* ------------------------------- Разметка ----------------------------- */
  return (
    <div className="don-page" ref={rootRef}>
      <div className="don-scene" aria-hidden />
      <div className="don-sakura" aria-hidden>
        {Array.from({ length: 16 }, (_, i) => (
          <i
            key={i}
            style={{
              ["--x" as string]: `${(i * 37) % 100}%`,
              ["--s" as string]: `${10 + ((i * 7) % 12)}px`,
              ["--d" as string]: `${11 + ((i * 5) % 9)}s`,
              ["--dl" as string]: `-${(i * 13) % 17}s`,
            }}
          />
        ))}
      </div>
      <canvas className="don-stars" id="stars" ref={canvasRef} aria-hidden />
      <div className="don-spot" ref={spotRef} aria-hidden />

      <div className="don-main">
        <div className="don-aurora" aria-hidden />

        <section className="don-hero">
          <span className="don-live">
            <i />
            Лимитированная акция
          </span>

          <div className="don-mascot" id="mascot" ref={mascotRef}>
            <div className="don-ring" />
            <div className="don-ring don-b" />
            <Image src="/donate-cat2.png" alt="Маскот AniGalaxy" width={520} height={560} priority unoptimized />
          </div>

          <h1>Поддержав AniGalaxy — получи бонусы!</h1>
          <p className="don-sub">
            Забери сразу: <b>AC</b>, <b>эксклюзивный глитч-эффект</b> и тег <b>«Донатер» навсегда</b>.
          </p>
        </section>

        <section className="don-tiers" aria-label="Выбор набора">
          {TIERS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={`don-tier${item.pop ? " don-pop" : ""}${item.max ? " don-max" : ""}`}
              aria-pressed={selected === index}
              ref={(el) => {
                tierRefs.current[index] = el;
              }}
              onClick={() => pickTier(index)}
              onMouseMove={onTierMove}
              onMouseLeave={onTierLeave}
            >
              {item.badge && <span className="don-badge">{item.badge}</span>}
              <h3>{item.name}</h3>
              <div className="don-price">{item.price} ₽</div>
              <div className="don-coins">
                <Image className="don-ci" src="/coin.png" alt="" aria-hidden width={44} height={44} />
                <span className="don-amt">
                  <b className="don-money">{nf.format(item.coins)}</b>
                  <small>AC</small>
                </span>
              </div>
              <div className="don-prem2">
                <PremiumChip />
                <b>{item.premShort}</b>
              </div>
              <ul>
                {item.perks.map((perk) => (
                  <li key={perk}>{perk}</li>
                ))}
              </ul>
            </button>
          ))}
        </section>

        <section className="don-grid2">
          <div className="don-card" id="prev">
            <h2>Так будет выглядеть твой профиль</h2>
            <p className="don-d">Глитч видят все — в комментариях и списке участников.</p>
            <div className={`don-profile${withPack ? " don-on" : ""}`}>
              <div className="don-ava">🌙</div>
              <div>
                <span className={`don-nick${withPack ? " don-glitch" : ""}`} data-t="otaku_rin">
                  otaku_rin
                </span>
                <span className="don-dn">
                  <AgTag tag={DONATER_TAG} size="sm" />
                </span>
                <span className="don-pb">
                  <PremiumChip />
                </span>
              </div>
            </div>
            <div className="don-toggle">
              <button type="button" className={withPack ? "don-act" : ""} onClick={() => setWithPack(true)}>
                С набором
              </button>
              <button type="button" className={!withPack ? "don-act" : ""} onClick={() => setWithPack(false)}>
                Сейчас
              </button>
            </div>
            <div className="don-bal">
              <span>
                <Image unoptimized
                  className="don-ci"
                  style={{ width: 24, height: 24, verticalAlign: "-6px", marginRight: 6 }}
                  src="/coin.png"
                  alt=""
                  aria-hidden
                  width={24}
                  height={24}
                />
                Баланс после поддержки
              </span>
              <b className="don-money" ref={balRef} data-v="0">
                0
              </b>
            </div>
          </div>

          <div className="don-card don-scar">
            <h2>Акция лимитирована</h2>
            <p className="don-d">
              Когда акция закончится, AC и глитч-эффект уйдут с ней. Тег останется у тех, кто успел.
            </p>
            <div>
              Осталось наборов
              <div className="don-big">
                <span className="don-money">{nf.format(LEFT)}</span>
                <small>из {nf.format(TOTAL)}</small>
              </div>
            </div>
            <div className="don-bar">
              <i ref={fillRef} />
            </div>
            <div className="don-timer" id="timer">
              {["дней", "часов", "минут", "секунд"].map((label, i) => (
                <div key={label}>
                  <b
                    ref={(el) => {
                      timerRefs.current[i] = el;
                    }}
                  >
                    00
                  </b>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <div className="don-note">
              <svg className="don-bolt" viewBox="0 0 32 32" aria-hidden>
                <defs>
                  <linearGradient id="don-bg" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#fff3c4" />
                    <stop offset=".45" stopColor="#ff7ac8" />
                    <stop offset="1" stopColor="#8b5cff" />
                  </linearGradient>
                </defs>
                <circle className="don-bolt-r" cx="16" cy="16" r="14.5" />
                <circle className="don-bolt-r2" cx="16" cy="16" r="11" />
                <path className="don-bolt-z" d="M18.6 4.5 8.8 17.6h6.1l-1.5 9.9 9.8-13.4h-6.2z" fill="url(#don-bg)" />
                <path d="M18.6 4.5 8.8 17.6h6.1" stroke="#fff" strokeOpacity=".7" strokeWidth=".8" fill="none" strokeLinecap="round" />
              </svg>
              <span>
                Каждый набор выдаётся один раз на аккаунт. <b>Все {nf.format(TOTAL)} наборов ещё доступны.</b>
              </span>
            </div>
          </div>
        </section>

        <section className="don-card don-faq">
          <h2>Частые вопросы</h2>
          <details>
            <summary>Когда придут AC?</summary>
            <p>Сразу после оплаты — баланс обновится автоматически.</p>
          </details>
          <details>
            <summary>Что останется после окончания акции?</summary>
            <p>
              Тег «Донатер» остаётся навсегда. Глитч-эффект и бонус AC выдаются только во время акции.
            </p>
          </details>
          <details>
            <summary>На что потратить AC?</summary>
            <p>В магазине: теги, рамки аватара и бонусы профиля.</p>
          </details>
        </section>
      </div>

      <div className={`don-cta${ctaHidden ? " don-hide" : ""}`}>
        <div className="don-sum">
          {tier.name}
          <small>
            {tier.price} ₽ · {nf.format(tier.coins)} AC · {tier.prem}
          </small>
        </div>
        <Link className="don-ghost" href="/profile">
          Мой профиль
        </Link>
        <button type="button" className="don-btn" onClick={buy}>
          Поддержать проект
        </button>
      </div>

      <div className={`don-toast${toast ? " don-show" : ""}`} role="dialog" aria-modal="true" aria-label="Спасибо за поддержку">
        <div>
          <Image unoptimized
            className="don-ci"
            style={{ width: 90, height: 90, animation: "don-flip 3s infinite" }}
            src="/coin.png"
            alt=""
            aria-hidden
            width={90}
            height={90}
          />
          <h3>Спасибо за поддержку!</h3>
          <p style={{ color: "var(--mute)" }}>
            Набор «{tier.name}» — {nf.format(tier.coins)} AC и {tier.prem}. Оплата пока не подключена,
            зачисление появится вместе с ней.
          </p>
          <button type="button" className="don-btn" style={{ marginTop: 20 }} onClick={() => setToast(false)}>
            Отлично
          </button>
        </div>
      </div>
    </div>
  );
}