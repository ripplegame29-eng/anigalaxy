"use client";

/**
 * Страница активной подписки.
 *
 * Показывается на `/premium` вместо витрины тарифов, если подписка уже есть:
 * человеку с оплаченным Premium не нужны три карточки с ценами, ему нужен
 * статус — до какой даты, сколько осталось и что он получает.
 *
 * Разметка и стили — макет `premium (1).html` (циферблат с дугой остатка,
 * обратный отсчёт, автопродление, продление, привилегии, промокод). Данные
 * настоящие: срок и ник — из аккаунта, дуга — от `premiumProgress`, тарифы —
 * те же цены, что на витрине (`PLANS` в PremiumPlans), промокод — настоящий
 * `applyPromo`. Деньги за тариф не берутся: платёжных данных у проекта нет,
 * поэтому под продлением стоит прямая оговорка, а тост об активации говорит
 * то же самое — обещать списание, которого не будет, нельзя.
 *
 * Обратный отсчёт тикает раз в секунду через внешний источник: на сервере
 * `Date.now()` отличается от клиентского на минуту, и React увидел бы
 * расхождение разметки при гидрации.
 */

import { openCheckout } from "@/lib/checkout";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import "../app/premium-active.css";
import {
  activatePremium,
  isPremiumActive,
  premiumProgress,
  type Account,
} from "@/lib/auth";
import { useAccount } from "@/lib/use-account";
import {
  PREMIUM_PERKS,
  PREMIUM_QUEST_MULT,
  applyPromo,
  type PremiumIcon,
} from "@/lib/premium-perks";
import { PROGRESSION_CONFIG } from "@/lib/progression/progression.config";
import { AUTORENEW_DAYS, autoRenewEnabled, setAutoRenew } from "@/lib/premium-autorenew";
import { PLANS } from "./PremiumPlans";

const DAY = 86_400_000;

/** Иконки привилегий: ключ — как в `PremiumIcon` у lib/premium-perks */
const ICONS: Record<PremiumIcon, React.ReactNode> = {
  quality: (
    <>
      <rect x="3" y="4.5" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16.5V20" />
    </>
  ),
  boost: <path d="M13.4 3 6.4 13.4H11l-1.4 7.6 7.6-10.6h-4.6z" />,
  clan: (
    <>
      <path d="M12 3.5 20 6.5v6c0 4.4-3.4 7.6-8 8.6-4.6-1-8-4.2-8-8.6v-6z" />
      <path d="M9 12.2l2 2 4-4" />
    </>
  ),
  pass: <path d="M3.5 18h17M3.5 18 2.5 8.7 8 12.4 12 5.6l4 6.8 5.5-3.7-1 9.3z" />,
  cosmetics: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M9 10.5h.01M15 10.5h.01M9 15c1.6 1.4 4.4 1.4 6 0" />
    </>
  ),
  gifts: (
    <>
      <rect x="3.5" y="9" width="17" height="11" rx="1.6" />
      <path d="M12 9v11M3.5 13h17M12 9c-2-4-6-3-4.6-.4C8 9.6 12 9 12 9zM12 9c2-4 6-3 4.6-.4C16 9.6 12 9 12 9z" />
    </>
  ),
  tag: (
    <>
      <path d="M12 3.2 20 7v6c0 4.4-3.4 7.4-8 8.4-4.6-1-8-4-8-8.4V7z" />
      <path d="M9 12.2l2.2 2.2 4-4.2" />
    </>
  ),
};

/** Цвет иконки привилегии — круг из макета, по порядку карточек */
const ICON_COLOR: Record<PremiumIcon, string> = {
  quality: "#38d6ff",
  boost: "#61d1ff",
  clan: "#3ddc97",
  pass: "#60a5fa",
  cosmetics: "#a78bfa",
  gifts: "#22d3ee",
  tag: "#61d1ff",
};

/**
 * Куда ведёт карточка привилегии.
 *
 * Ключ — id возможности, а не иконка: у «Промокодов» и «Ежедневного
 * подарка» иконка одна, а адреса разные. У «Тега Premium» и «Ежедневного
 * подарка» отдельной страницы нет (значок живёт в шапке, бонус открывается
 * кнопкой там же) — эти карточки остаются подсказками без ссылки, а не
 * ведут в никуда.
 */
const PERK_HREF: Record<string, string | undefined> = {
  tag: undefined,
  boost: "/profile",
  pass: "/battlepass",
  cosmetics: "/cosmetics",
  daily: undefined,
  gifts: "#promo",
};

/**
 * Сколько монет в день даёт Premium.
 *
 * Считается из настоящих наград за дневные квесты (конфиг прогрессии) и множителя
 * подписки: в макете стояли круглые «+300 при активации» и «+120 в день», но
 * таких наград в проекте нет, а обещать их можно только всерьёз.
 */
const DAILY_POOL = PROGRESSION_CONFIG.quests.dailyPool;
const QUEST_COINS = Math.round(
  (DAILY_POOL.reduce((sum, quest) => sum + quest.ac, 0) / DAILY_POOL.length) * PROGRESSION_CONFIG.quests.dailyPick +
    (PROGRESSION_CONFIG.rules.SESSION_START.ac ?? 0),
);
const COINS_PER_DAY = QUEST_COINS * PREMIUM_QUEST_MULT;

const MONTHS = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

/** «14 января 2027 г.» — как в макете */
function formatFull(ms: number): string {
  const date = new Date(ms);
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()} г.`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function CrownIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M3.5 18h17M3.5 18 2.5 8.7 8 12.4 12 5.6l4 6.8 5.5-3.7-1 9.3z" />
    </svg>
  );
}

function PerkIcon({ name }: { name: PremiumIcon }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      {ICONS[name]}
    </svg>
  );
}

/* ------------------------------ Обратный отсчёт ----------------------------- */

/* Часы — внешний источник, который тикает сам, поэтому читается через
   useSyncExternalStore, а не через state плюс setInterval в эффекте.
   Раньше здесь стояли `useState(0)` и `setNow(Date.now())` прямо в useEffect:
   это убирало расхождение гидрации (React #418), но спорило с правилом
   react-hooks/set-state-in-effect. Через useSyncExternalStore нет ни setState,
   ни лишнего рендера, а сервер и клиент при гидрации дают одинаковую
   разметку: React берёт getServerSnapshot (0) и сразу перерисовывает
   компонент с настоящим временем. */
function subscribeClock(onStoreChange: () => void) {
  const id = window.setInterval(onStoreChange, 1000);
  return () => window.clearInterval(id);
}

/* Снимок с точностью до секунды: Date.now() меняется каждую миллисекунду,
   и useSyncExternalStore на таком источнике входил бы в бесконечный цикл
   перерисовок. */
function readClock() {
  return Math.floor(Date.now() / 1000);
}

/* На сервере часов нет — отдаём ноль, чтобы разметка сервера и клиента
   совпала при гидрации. */
function readClockOnServer() {
  return 0;
}

/**
 * Ячейка обратного отсчёта с короткой анимацией при смене цифры (`tick`).
 * Класс вешается из состояния, а не через reflow: на сервере его нет, поэтому
 * гидрация не замечает разницы.
 */
function TickBox({ value, label }: { value: number; label: string }) {
  const [kick, setKick] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setKick(true);
    const id = window.setTimeout(() => setKick(false), 350);
    return () => window.clearTimeout(id);
  }, [value]);

  return (
    <div>
      <b className={kick ? "pra-tick" : undefined}>{pad(value)}</b>
      <span>{label}</span>
    </div>
  );
}

/* -------------------------------- Звёздное поле -------------------------------- */

/**
 * Фон макета: медленно ползущие звёзды на canvas.
 *
 * Рисуем только на Pointer-fine/нормальном движении: при `prefers-reduced-motion`
 * фон остаётся статичным, а на вкладке в фоне анимация встаёт на паузу.
 */
function useStarfield() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let stars: { x: number; y: number; r: number; p: number; v: number }[] = [];
    let frame = 0;
    let running = !document.hidden && !reduce;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = Array.from({ length: Math.round((width * height) / 9000) }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.3 + 0.2,
        p: Math.random() * 6,
        v: Math.random() * 0.15 + 0.03,
      }));
    };

    const paint = (time: number) => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#bcd8ff";
      for (const star of stars) {
        ctx.globalAlpha = 0.35 + 0.45 * Math.sin(time / 900 + star.p);
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, 7);
        ctx.fill();
      }
    };

    const step = (time: number) => {
      for (const star of stars) star.y = (star.y + star.v) % height;
      paint(time);
      frame = requestAnimationFrame(step);
    };

    const loop = () => {
      if (!running) return;
      frame = requestAnimationFrame(step);
    };

    const onVisibility = () => {
      running = !document.hidden && !reduce;
      if (running) loop();
      else cancelAnimationFrame(frame);
    };

    resize();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    if (running) loop();
    else paint(0);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return ref;
}

export function PremiumStatus({ account }: { account: Account }) {
  const current = useAccount();
  const live = current ?? account;

  /* Тумблер читается лениво: на сервере localStorage нет. */
  const [renew, setRenew] = useState(() => autoRenewEnabled());
  const [toast, setToast] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string>(PLANS[1].id);
  const [promoCode, setPromoCode] = useState("");
  const [promoMsg, setPromoMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [promoBad, setPromoBad] = useState(false);

  const nowSec = useSyncExternalStore(subscribeClock, readClock, readClockOnServer);
  const now = nowSec * 1000;

  const starsRef = useStarfield();
  const dialRef = useRef<HTMLDivElement | null>(null);

  const showToast = useCallback((text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  const until = live.premiumUntil ?? 0;
  const leftMs = Math.max(0, until - now);
  const daysLeft = Math.max(0, Math.floor(leftMs / DAY));

  const { percent } = useMemo(() => premiumProgress(live), [live]);

  const clock = useMemo(() => {
    const s = Math.floor(leftMs / 1000);
    return {
      days: Math.floor(s / 86400),
      hours: Math.floor((s % 86400) / 3600),
      minutes: Math.floor((s % 3600) / 60),
      seconds: s % 60,
    };
  }, [leftMs]);

  const plan = useMemo(
    () => PLANS.find((item) => item.id === planId) ?? PLANS[1],
    [planId],
  );

  /** Дуга циферблата: сколько периода осталось, 754 — длина окружности */
  const arcOffset = 754 * (1 - Math.max(0, Math.min(1, percent / 100)));

  /* Наклон циферблата за курсором — как в макете. Слушатель на окне, а не на
     блоке страницы: макет реагирует на курсор везде, и кнопка у нас
     перекрывается шапкой с footer'ом. */
  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const dial = dialRef.current;
    if (!dial) return;
    const onMove = (event: PointerEvent) => {
      const x = (event.clientX / window.innerWidth - 0.5) * 14;
      const y = (event.clientY / window.innerHeight - 0.5) * -14;
      dial.style.transform = `perspective(800px) rotateY(${x}deg) rotateX(${y}deg)`;
    };
    const onLeave = () => {
      dial.style.transform = "";
    };
    window.addEventListener("pointermove", onMove);
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  /* Подсветка карточек за курсором (`--mx/--my` в макете) */
  const onSpotMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--mx", `${event.clientX - box.left}px`);
    event.currentTarget.style.setProperty("--my", `${event.clientY - box.top}px`);
  }, []);

  const onToggleRenew = () => {
    const next = !renew;
    setRenew(next);
    setAutoRenew(next);
    showToast(next ? "Автопродление включено" : "Автопродление выключено");
  };

  /** Продление на выбранный тариф: оплата в общем окне, подписка — после неё */
  const onExtend = () => {
    openCheckout({
      title: `Premium · ${plan.title}`,
      caption: `Продление · ${plan.perMonth}`,
      price: plan.price,
      oldPrice: plan.oldPrice,
      onPaid: () => {
        activatePremium(plan.days);
        showToast(`Подписка продлена на ${plan.days} дн.`);
      },
    });
  };

  const onApplyPromo = (event: React.FormEvent) => {
    event.preventDefault();
    setPromoBad(false);
    const result = applyPromo(promoCode, (days) => {
      const next = activatePremium(days);
      return next ? next.premiumUntil ?? 0 : null;
    });
    setPromoMsg({ ok: result.ok, text: result.message });
    if (!result.ok) {
      setPromoBad(true);
      return;
    }
    setPromoCode("");
    showToast("Промокод применён");
  };

  if (!isPremiumActive(live)) return null;

  return (
    <>
      <canvas ref={starsRef} className="pra-stars" aria-hidden />

      <div className="pra-page">
        <div className="pra-aurora" aria-hidden />

        {/* ------------------------------- Hero ------------------------------ */}
        <header className="pra-hero">
          <div className="pra-dial" ref={dialRef}>
            <svg viewBox="0 0 300 300" aria-hidden>
              <defs>
                <linearGradient id="pra-arc-gradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#2f8bff" />
                  <stop offset=".55" stopColor="#38d6ff" />
                  <stop offset="1" stopColor="#8a6bff" />
                </linearGradient>
              </defs>
              <circle className="pra-orbit2" cx="150" cy="150" r="144" />
              <circle className="pra-track" cx="150" cy="150" r="120" />
              <circle
                className="pra-arc"
                cx="150"
                cy="150"
                r="120"
                style={{ strokeDashoffset: arcOffset }}
              />
              <g className="pra-moon">
                <circle cx="150" cy="6" r="5" fill="#8a6bff" />
                <circle cx="150" cy="6" r="10" fill="#8a6bff33" />
              </g>
            </svg>
            <div className="pra-core">
              <CrownIcon className="pra-crownicon" />
              <div className="pra-days">{daysLeft}</div>
              <small>дней осталось</small>
            </div>
          </div>

          <div className="pra-status">
            <i />
            Premium активен
          </div>

          <h1 className="pra-h1">{live.nickname}, ты Premium!</h1>

          <p className="pra-sub">
            Подписка действует до <b>{formatFull(until)}</b>
          </p>

          <div
            className="pra-clock"
            role="timer"
            aria-label="Время до конца подписки"
          >
            <TickBox value={clock.days} label="дней" />
            <TickBox value={clock.hours} label="часов" />
            <TickBox value={clock.minutes} label="минут" />
            <TickBox value={clock.seconds} label="секунд" />
          </div>
        </header>

        {/* ------------------- Автопродление и продление -------------------- */}
        <div className="pra-row2">
          <section className="pra-card pra-ar pra-spot" onPointerMove={onSpotMove}>
            <div className="pra-sw">
              <div>
                <h2 className="pra-h2">Автопродление</h2>
                <p className="pra-d" style={{ margin: 0 }}>
                  {renew
                    ? `Включено — истёкшая подписка продлится на ${AUTORENEW_DAYS} дней`
                    : `Выключено — подписка закончится ${formatFull(until)}`}
                </p>
              </div>
              <button
                type="button"
                className="pra-tog"
                role="switch"
                aria-checked={renew}
                aria-label="Автопродление"
                onClick={onToggleRenew}
              />
            </div>
            <div className="pra-note">
              {renew
                ? `Денег мы не списываем: если срок закончился, подписка просто продлится ещё на ${AUTORENEW_DAYS} дней при следующем открытии страницы. Отключить можно в любой момент.`
                : "Включи, чтобы Premium не прерывался: продлим на 30 дней после конца срока, а отключить можно в один клик."}
            </div>
          </section>

          <section className="pra-card pra-spot" onPointerMove={onSpotMove}>
            <h2 className="pra-h2">Продлить подписку</h2>
            <p className="pra-d">Дни добавятся к текущему сроку, ничего не сгорит.</p>

            <div className="pra-plans">
              {PLANS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="pra-plan"
                  aria-pressed={item.id === plan.id}
                  onClick={() => setPlanId(item.id)}
                >
                  <em>−{Math.round((1 - item.price / item.oldPrice) * 100)}%</em>
                  <b>{item.title}</b>
                  <span className="pra-pr">
                    {item.price.toLocaleString("ru-RU")} ₽{" "}
                    <s>{item.oldPrice.toLocaleString("ru-RU")} ₽</s>
                  </span>
                </button>
              ))}
            </div>

            <div className="pra-bonus">
              <div>
                <b>+{COINS_PER_DAY}</b> AC в день за квесты и вход — ×
                {PREMIUM_QUEST_MULT} к обычному
              </div>
              <div>
                <b>+50%</b> очков клану и отдельная линия наград в пропуске
              </div>
              <small>
                до {(COINS_PER_DAY * plan.days).toLocaleString("ru-RU")} AC за период,
                если забирать все квесты · {plan.perMonth}
              </small>
            </div>

            <div className="pra-sum">
              <div>
                <small>Новая дата окончания</small>
                <b>{formatFull(Math.max(until, now) + plan.days * DAY)}</b>
              </div>
              <button type="button" className="pra-btn" onClick={onExtend}>
                Продлить за {plan.price.toLocaleString("ru-RU")} ₽
              </button>
            </div>

            <div className="pra-note" style={{ marginTop: 16 }}>
              Оплата откроется в защищённом окне. Подписка продлится сразу после платежа.
            </div>
          </section>
        </div>

        {/* ----------------------------- Привилегии --------------------------- */}
        <section className="pra-section">
          <h2 className="pra-h2" style={{ marginBottom: 16 }}>
            Твои привилегии
          </h2>
          <div className="pra-perks">
            {PREMIUM_PERKS.map((perk) => {
              const href = PERK_HREF[perk.id];
              const body = (
                <>
                  <div className="pra-ic">
                    <PerkIcon name={perk.icon} />
                  </div>
                  <h3>{perk.title}</h3>
                  {perk.text ? <p>{perk.text}</p> : null}
                  <span className="pra-go">{perk.where}</span>
                </>
              );
              const style = { "--k": ICON_COLOR[perk.icon] } as React.CSSProperties;
              return href ? (
                <Link key={perk.id} href={href} className="pra-card pra-perk pra-spot" style={style}>
                  {body}
                </Link>
              ) : (
                <div key={perk.id} className="pra-card pra-perk" style={style}>
                  {body}
                </div>
              );
            })}
          </div>
        </section>

        {/* ------------------------------ Промокод ---------------------------- */}
        <section className="pra-section">
          <div className="pra-card pra-promo pra-spot" id="promo" onPointerMove={onSpotMove}>
            <div>
              <h2 className="pra-h2">Есть промокод?</h2>
              <p className="pra-d" style={{ margin: 0 }}>
                Введи код — подписка продлится на несколько дней
              </p>
              <p className="pra-hint">
                Каждый код работает один раз на аккаунт.
                <br />
                Подсказка: промокоды мы публикуем в новостях проекта.
              </p>
            </div>
            <div>
              <form className={`pra-pf${promoBad ? " pra-bad" : ""}`} onSubmit={onApplyPromo}>
                <input
                  value={promoCode}
                  onChange={(event) => {
                    setPromoCode(event.target.value);
                    setPromoMsg(null);
                    setPromoBad(false);
                  }}
                  placeholder="Введи промокод"
                  maxLength={24}
                  autoComplete="off"
                  aria-label="Промокод"
                />
                <button type="submit" className="pra-btn" disabled={!promoCode.trim()}>
                  Применить
                </button>
              </form>
              <div className={`pra-msg ${promoMsg ? (promoMsg.ok ? "pra-ok" : "pra-err") : ""}`} aria-live="polite">
                {promoMsg?.text ?? ""}
              </div>
            </div>
          </div>
        </section>

        <div className="pra-bottom">
          <Link href="/profile">Мой профиль →</Link>
        </div>
      </div>

      <div className={`pra-toast${toast ? " pra-show" : ""}`} role="status">
        {toast}
      </div>
    </>
  );
}