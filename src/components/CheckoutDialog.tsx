"use client";

import { useCallback, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { closeCheckout, getCheckoutState, getServerCheckoutState, subscribeCheckout } from "@/lib/checkout";
import { flushBeforePayment } from "@/lib/cloud";
import { useModalBehaviour } from "@/lib/use-local-storage";
import "./checkout.css";

/**
 * Окно оплаты AniGalaxy — «звёздный билет».
 *
 * Способы оплаты выбирает Platega на своей странице: здесь только состав
 * заказа и кнопка перехода. Цену и товар сервер проверяет по каталогу,
 * поэтому подменить сумму в запросе нельзя.
 */

type Step = "form" | "creating";

const ic = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);
const I = {
  card: ic(<><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 10h18M7 15h3" /></>),
  sbp: ic(<path d="M4 7l8-4 8 4v6c0 4-3.4 6.8-8 8-4.6-1.2-8-4-8-8z M9 12l2 2 4-4" />),
  btc: ic(<path d="M9 5v14M9 5h5a3 3 0 0 1 0 6H9m0 0h5.5a3 3 0 0 1 0 6H9M11 3v2m3-2v2m-3 14v2m3-2v2" />),
  lock: ic(<><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>),
  x: ic(<path d="M6 6l12 12M18 6L6 18" />),
  ok: ic(<path d="M5 12.5l4.5 4.5L19 7.5" />),
  arrow: ic(<path d="M5 12h14m0 0-5-5m5 5-5 5" />),
};

const rub = (n: number) => `${n.toLocaleString("ru-RU")} ₽`;

const METHODS = [
  { id: "sbp", name: "СБП", hint: "по QR-коду", icon: I.sbp },
  { id: "card", name: "Карта", hint: "Visa · Mastercard · МИР", icon: I.card },
  { id: "crypto", name: "Крипта", hint: "USDT · TON · BTC", icon: I.btc },
] as const;

export function CheckoutDialog() {
  const state = useSyncExternalStore(subscribeCheckout, getCheckoutState, getServerCheckoutState);
  const { order, serial } = state;
  const [seen, setSeen] = useState<string>("");
  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState("");
  const stageRef = useRef<HTMLDivElement | null>(null);

  // Новый заказ — сброс в рендере, а не в эффекте
  if (state.open && serial && serial !== seen) {
    setSeen(serial);
    setStep("form");
    setError("");
  }

  const close = useCallback(() => {
    if (step === "creating") return;
    closeCheckout();
  }, [step]);
  const panelRef = useModalBehaviour(state.open, close);

  const onTilt = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = stageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
  };

  const pay = useCallback(async () => {
    if (!order || step === "creating") return;
    setStep("creating");
    setError("");
    try {
      // Сначала досылаем прогресс: после оплаты сервер обновит документы,
      // и старый локальный прогресс не должен уехать поверх выдачи.
      await flushBeforePayment();
      const response = await fetch("/api/payments/platega/create", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: order.productId,
          withPack: order.withPack,
          giftMode: order.gift?.mode,
          recipient: order.gift?.recipient,
          giftCount: order.gift?.count,
          promoCode: order.gift?.promoCode,
          deliverAt: order.gift?.deliverAt,
        }),
      });
      const data = (await response.json().catch(() => null)) as { url?: unknown; error?: unknown } | null;
      if (response.status === 401) {
        setStep("form");
        setError("Сессия закончилась. Войдите в аккаунт и попробуйте снова.");
        return;
      }
      if (!response.ok || typeof data?.url !== "string" || !data.url) {
        setStep("form");
        setError(typeof data?.error === "string" ? data.error : "Не удалось создать платёж. Попробуйте ещё раз.");
        return;
      }
      window.location.assign(data.url);
    } catch {
      setStep("form");
      setError("Нет связи с сервером оплаты. Проверьте интернет и попробуйте ещё раз.");
    }
  }, [order, step]);

  // Модальный <dialog> делает всё вне себя неактивным, поэтому окно оплаты,
  // открытое из него (подарок Premium), живёт внутри этого диалога — иначе
  // оно оказалось бы под ним и не принимало бы клики.
  const host = useMemo(() => {
    if (!state.open || typeof document === "undefined") return null;
    return document.querySelector<HTMLElement>("dialog:modal");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serial, state.open]);

  if (!state.open || !order) return null;

  const node = (
    <div className="ck" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && step !== "creating" && close()}>
      <div className={`ck-panel ck-${step}`} role="dialog" aria-modal="true" aria-label="Оплата" tabIndex={-1} ref={panelRef}>
        <button type="button" className="ck-x" aria-label="Закрыть" onClick={close} disabled={step === "creating"}>{I.x}</button>

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
        </div>

        {/* ------------------------------ Оплата ------------------------------ */}
        <div className="ck-side">
          {step === "form" && (
            <>
              <h3 className="ck-h"><span>{I.lock}</span>Безопасная оплата</h3>
              <div className="ck-tiles ck-tiles--static" aria-label="Способы оплаты на странице Platega">
                {METHODS.map((method) => (
                  <div key={method.id} className="ck-tile" data-t={method.id}>
                    <span className="ck-ti">{method.icon}</span>
                    <b>{method.name}</b>
                    <small>{method.hint}</small>
                  </div>
                ))}
              </div>

              <div className="ck-info">
                <p>
                  Сумма и состав заказа проверены на сервере. На следующем шаге откроется
                  защищённая страница <b>Platega</b>, где можно выбрать удобный способ оплаты.
                </p>
              </div>

              <button type="button" className="ck-hold ck-pay" onClick={() => void pay()}>
                <span>{I.arrow}Перейти к оплате — {rub(order.price)}</span>
              </button>
              <p className="ck-hint">
                Откроется страница Platega. Доступ придёт автоматически после подтверждения платежа.
              </p>
              {error && <p className="ck-error" role="alert">{error}</p>}
              <p className="ck-legal">Оплачивая, вы принимаете оферту и политику конфиденциальности. Соединение защищено SSL.</p>
            </>
          )}

          {step === "creating" && (
            <div className="ck-state">
              <div className="ck-orbit" aria-hidden><i /><i /><i /></div>
              <b>Готовим оплату</b>
              <small>Создаём защищённый платёж в Platega…</small>
            </div>
          )}
        </div>
      </div>
    </div>
  );
  return host ? createPortal(node, host) : node;
}
