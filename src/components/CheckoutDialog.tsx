"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { closeCheckout, getCheckoutState, getServerCheckoutState, subscribeCheckout } from "@/lib/checkout";
import { useModalBehaviour } from "@/lib/use-local-storage";
import { useLinks } from "@/lib/accounts";
import "./checkout.css";

/**
 * Окно оплаты AniGalaxy — «звёздный билет».
 * Слева билет с перфорацией и голографическим бликом, справа способы
 * оплаты плитками и кнопка «удерживай для оплаты»: платёж подтверждается
 * не случайным кликом, а удержанием.
 */

type Method = "sbp" | "crypto" | "stars";
type Step = "form" | "process" | "done";

const HOLD_MS = 900;
const USDT_RATE = 95; // демо-курс, ₽ за 1 USDT
const COINS = [
  { id: "usdt-trc", label: "USDT", net: "TRC-20", rate: USDT_RATE, dp: 2 },
  { id: "usdt-ton", label: "USDT", net: "TON", rate: USDT_RATE, dp: 2 },
  { id: "ton", label: "TON", net: "TON", rate: 310, dp: 3 },
  { id: "btc", label: "BTC", net: "Bitcoin", rate: 9_000_000, dp: 6 },
];

const ic = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);
const I = {
  card: ic(<><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 10h18M7 15h3" /></>),
  sbp: ic(<path d="M4 7l8-4 8 4v6c0 4-3.4 6.8-8 8-4.6-1.2-8-4-8-8z M9 12l2 2 4-4" />),
  btc: ic(<path d="M9 5v14M9 5h5a3 3 0 0 1 0 6H9m0 0h5.5a3 3 0 0 1 0 6H9M11 3v2m3-2v2m-3 14v2m3-2v2" />),
  star: ic(<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />),
  lock: ic(<><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>),
  x: ic(<path d="M6 6l12 12M18 6L6 18" />),
  ok: ic(<path d="M5 12.5l4.5 4.5L19 7.5" />),
  hold: ic(<path d="M12 3v10m0 0l-4-4m4 4l4-4M5 20h14" />),
};

const rub = (n: number) => `${n.toLocaleString("ru-RU")} ₽`;

export function CheckoutDialog() {
  const state = useSyncExternalStore(subscribeCheckout, getCheckoutState, getServerCheckoutState);
  const { order, serial } = state;
  const [seen, setSeen] = useState<string>("");
  const [step, setStep] = useState<Step>("form");
  const [method, setMethod] = useState<Method>("sbp");
  const [coin, setCoin] = useState(COINS[0].id);
  const [holding, setHolding] = useState(false);
  const [hint, setHint] = useState(false);
  const holdTimer = useRef<number | undefined>(undefined);
  const doneTimer = useRef<number | undefined>(undefined);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const links = useLinks();
  const tg = links.some((l) => l.provider === "telegram");

  // Новый заказ — сброс в рендере, а не в эффекте
  if (state.open && serial && serial !== seen) {
    setSeen(serial);
    setStep("form");
    setHolding(false);
    setHint(false);
  }

  const close = useCallback(() => {
    window.clearTimeout(holdTimer.current);
    window.clearTimeout(doneTimer.current);
    closeCheckout();
  }, []);
  const panelRef = useModalBehaviour(state.open, close);
  useEffect(
    () => () => {
      window.clearTimeout(holdTimer.current);
      window.clearTimeout(doneTimer.current);
    },
    [],
  );

  const pay = useCallback(() => {
    if (!order) return;
    setHolding(false);
    setStep("process");
    doneTimer.current = window.setTimeout(() => {
      order.onPaid();
      setStep("done");
    }, 1700);
  }, [order]);

  const startHold = () => {
    if (step !== "form") return;
    setHolding(true);
    setHint(false);
    holdTimer.current = window.setTimeout(pay, HOLD_MS);
  };
  const stopHold = () => {
    if (step !== "form") return;
    if (holding) setHint(true);
    setHolding(false);
    window.clearTimeout(holdTimer.current);
  };

  const onTilt = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = stageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
  };

  // Модальный <dialog> делает всё вне себя неактивным, поэтому окно оплаты,
  // открытое из него (подарок Premium), живёт внутри этого диалога — иначе
  // оно оказалось бы под ним и не принимало бы клики.
  const host = useMemo(() => {
    if (!state.open || typeof document === "undefined") return null;
    return document.querySelector<HTMLElement>("dialog:modal");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serial, state.open]);

  if (!state.open || !order) return null;
  const coinInfo = COINS.find((c) => c.id === coin) ?? COINS[0];
  const starsPrice = Math.ceil(order.price / 1.8);

  const tiles: { id: Method | "card"; name: string; hint: string; icon: ReactNode; off?: string }[] = [
    { id: "sbp", name: "СБП", hint: "Без комиссии", icon: I.sbp },
    { id: "crypto", name: "Крипта", hint: "USDT · TON · BTC", icon: I.btc },
    { id: "card", name: "Карта", hint: "Visa · Mastercard · МИР", icon: I.card, off: "Скоро" },
    { id: "stars", name: "Stars", hint: "Telegram", icon: I.star, off: tg ? undefined : "Привяжи Telegram" },
  ];

  const node = (
    <div className="ck" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && step !== "process" && close()}>
      <div className={`ck-panel ck-${step}`} data-m={method} role="dialog" aria-modal="true" aria-label="Оплата" tabIndex={-1} ref={panelRef}>
        <button type="button" className="ck-x" aria-label="Закрыть" onClick={close} disabled={step === "process"}>{I.x}</button>

        {/* ------------------------------ Билет ------------------------------ */}
        <div className="ck-ticket" ref={stageRef} onPointerMove={onTilt}>
          <i className="ck-au a" aria-hidden />
          <i className="ck-au b" aria-hidden />
          <i className="ck-au c" aria-hidden />
          <Image src="/images/fox-promo.webp" alt="" aria-hidden width={560} height={560} className="ck-fox" unoptimized />
          <div className="ck-t-top">
            <span className="ck-brand">AniGalaxy</span>
            <span className="ck-serial">№ {serial}</span>
          </div>
          <h2 className="ck-t-title">{order.title}</h2>
          {order.caption && <p className="ck-t-cap">{order.caption}</p>}
          {order.perks && (
            <ul className="ck-perks">
              {order.perks.map((p) => (
                <li key={p}><span>{I.ok}</span>{p}</li>
              ))}
            </ul>
          )}
          <div className="ck-cut" aria-hidden />
          <div className="ck-t-sum">
            <span>К оплате</span>
            <div>
              {order.oldPrice ? <s>{rub(order.oldPrice)}</s> : null}
              <strong>{rub(order.price)}</strong>
            </div>
          </div>
          <div className={`ck-stamp${step === "done" ? " on" : ""}`} aria-hidden>Оплачено</div>
          {step === "done" && (
            <div className="ck-confetti" aria-hidden>
              {Array.from({ length: 28 }, (_, i) => (
                <i
                  key={i}
                  style={
                    {
                      "--x": `${(i * 37) % 100}%`,
                      "--d": `${(i % 7) * 0.09}s`,
                      "--r": `${(i * 53) % 360}deg`,
                      "--h": `${(i * 47) % 360}`,
                    } as React.CSSProperties
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* ------------------------------ Оплата ------------------------------ */}
        <div className="ck-side">
          {step === "form" && (
            <>
              <h3 className="ck-h"><span>{I.lock}</span>Как оплатить</h3>
              <div className="ck-tiles" role="radiogroup" aria-label="Способ оплаты">
                {tiles.map((t) => {
                  const off = Boolean(t.off) || t.id === "card";
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="radio"
                      aria-checked={method === t.id}
                      disabled={off}
                      data-t={t.id}
                      className={`ck-tile${method === t.id ? " on" : ""}${off ? " off" : ""}`}
                      onClick={() => setMethod(t.id as Method)}
                    >
                      <span className="ck-ti">{t.icon}</span>
                      <b>{t.name}</b>
                      <small>{t.off ?? t.hint}</small>
                    </button>
                  );
                })}
              </div>

              <div className="ck-info">
                {method === "sbp" && (
                  <p>Откроется приложение вашего банка с готовым переводом. Подтвердите в нём — доступ придёт сам.</p>
                )}
                {method === "crypto" && (
                  <>
                    <div className="ck-coins" role="radiogroup" aria-label="Монета">
                      {COINS.map((c) => (
                        <button key={c.id} type="button" role="radio" aria-checked={coin === c.id} className={coin === c.id ? "on" : ""} onClick={() => setCoin(c.id)}>
                          {c.label}<small>{c.net}</small>
                        </button>
                      ))}
                    </div>
                    <p className="ck-conv">
                      <b>{(order.price / coinInfo.rate).toFixed(coinInfo.dp)} {coinInfo.label}</b>
                      <span>≈ 1 {coinInfo.label} = {coinInfo.rate.toLocaleString("ru-RU")} ₽</span>
                    </p>
                  </>
                )}
                {method === "stars" && (
                  <p>Счёт придёт в Telegram от бота AniGalaxy. К оплате: <b>{starsPrice} ★</b></p>
                )}
              </div>

              <button
                type="button"
                className={`ck-hold${holding ? " go" : ""}`}
                onPointerDown={startHold}
                onPointerUp={stopHold}
                onPointerLeave={stopHold}
                onPointerCancel={stopHold}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.repeat) {
                    e.preventDefault();
                    pay();
                  }
                }}
                onContextMenu={(e) => e.preventDefault()}
              >
                <i aria-hidden style={{ animationDuration: `${HOLD_MS}ms` }} />
                <span className="ck-run" aria-hidden style={{ animationDuration: `${HOLD_MS}ms` }}>
                  <Image src="/images/fox-logo.webp" alt="" width={44} height={44} unoptimized />
                </span>
                <span>{I.hold}{holding ? "Держите…" : `Удерживайте — ${rub(order.price)}`}</span>
              </button>
              <p className={`ck-hint${hint ? " on" : ""}`} aria-live="polite">
                {hint ? "Нужно удерживать кнопку, пока круг не заполнится" : "Платёж подтверждается удержанием — случайный тап не спишет деньги"}
              </p>
              <p className="ck-legal">Оплачивая, вы принимаете оферту и политику конфиденциальности. Соединение защищено SSL.</p>
              <p className="ck-demo">Демо-режим: платёжный шлюз не подключён, деньги не списываются.</p>
            </>
          )}

          {step === "process" && (
            <div className="ck-state">
              <div className="ck-track" aria-hidden>
                <span className="ck-coin c1" /><span className="ck-coin c2" /><span className="ck-coin c3" />
                <Image src="/images/fox-logo.webp" alt="" width={96} height={96} unoptimized className="ck-racer" />
                <span className="ck-dust" />
                <span className="ck-ground" />
              </div>
              <b>Лисёнок несёт ваш билет</b>
              <small>Ждём подтверждение платежа…</small>
            </div>
          )}

          {step === "done" && (
            <div className="ck-state">
              <span className="ck-seal" aria-hidden>{I.ok}</span>
              <b>Всё готово</b>
              <small>{order.title} уже на вашем аккаунте</small>
              <button type="button" className="ck-ok" onClick={close}>Отлично</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
  return host ? createPortal(node, host) : node;
}
