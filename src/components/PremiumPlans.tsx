"use client";

import { useCallback, useMemo, useState } from "react";
import { AuthTrigger } from "./AuthDialog";
import { activatePremium, formatPremiumUntil, isPremiumActive } from "@/lib/auth";
import { applyPromo, PREMIUM_PERKS } from "@/lib/premium-perks";
import { openAuthDialog } from "@/lib/auth-dialog";
import { useAccount } from "@/lib/use-account";
import { openCheckout } from "@/lib/checkout";

export interface PremiumPlan {
  id: "month" | "quarter" | "year";
  title: string;
  price: number;
  oldPrice: number;
  discount: string;
  perMonth: string;
  days: number;
  badge?: string;
  /** Светлая «бумажная» карточка — как у референса у годового тарифа */
  light?: boolean;
}

/**
 * Тарифы и цены — один источник правды для витрины и для продления на
 * странице активной подписки (`PremiumStatus`).
 */
export const PLANS: PremiumPlan[] = [
  {
    id: "month",
    title: "Месяц",
    price: 99,
    oldPrice: 149,
    discount: "Скидка 33%",
    perMonth: "99 ₽/мес",
    days: 30,
  },
  {
    id: "quarter",
    title: "3 Месяца",
    price: 249,
    oldPrice: 447,
    discount: "Выгода 44%",
    perMonth: "83 ₽/мес",
    days: 90,
    badge: "ХИТ ПРОДАЖ",
  },
  {
    id: "year",
    title: "Год",
    price: 790,
    oldPrice: 1788,
    discount: "Выгода 56%",
    perMonth: "66 ₽/мес",
    days: 365,
    light: true,
  },
];

/**
 * Что показываем в карточке тарифа.
 *
 * Список не набирается руками: он собирается из `PREMIUM_PERKS`, поэтому
 * формулировки в карточках тарифов и в блоке «Твои привилегии» совпадают
 * слово в слово. Раньше тут стояли отдельные короткие строки, и они
 * разъезжались с формулировками привилегий при каждой правке.
 */
const FEATURES = PREMIUM_PERKS.map((perk) => ({ key: perk.id, text: perk.title }));

function CheckIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" aria-hidden>
      <path
        d="M13.5 4.5 6 12l-3.5-3.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Тарифные карточки страницы Premium.
 *
 * Кнопка внизу карточки живёт в трёх состояниях: не вошли → модалка входа,
 * вошли без подписки → активация, подписка есть → дата окончания.
 */
function spot(e: React.PointerEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
}

export function PremiumPlans() {
  const account = useAccount();
  const premium = isPremiumActive(account);
  const [justActivated, setJustActivated] = useState<string | null>(null);

  const statusLabel = useMemo(() => formatPremiumUntil(account), [account]);

  const onSelect = useCallback(
    (plan: PremiumPlan) => {
      if (!account) {
        openAuthDialog("login");
        return;
      }
      if (premium) return;
      openCheckout({
        title: `Premium · ${plan.title}`,
        caption: plan.perMonth,
        price: plan.price,
        oldPrice: plan.oldPrice,
        perks: ["Без рекламы и приоритетная поддержка", "x2 опыт и ускоренные награды", "Эксклюзивные рамки и эффекты профиля"],
        onPaid: () => {
          activatePremium(plan.days);
          setJustActivated(plan.id);
        },
      });
    },
    [account, premium],
  );

  return (
    <>
    <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-3 lg:gap-7">
      {PLANS.map((plan) => {
        const highlighted = plan.badge !== undefined;
        const active = premium;

        const cardClass = highlighted ? "pp-plan pp-plan--hit relative mt-6 md:mt-0" : "pp-plan relative overflow-hidden";
        const titleClass = "text-white";
        const priceClass = "text-white";
        const oldClass = "text-muted";
        const noteClass = "text-muted";
        const featureClass = "text-white/75";
        const checkClass = highlighted ? "text-accent" : "text-accent/70";

        return (
          <article
            key={plan.id}
            className={`group flex flex-col rounded-3xl p-6 sm:p-7 ${cardClass}`}
            onPointerMove={spot}
          >
            {plan.badge && (
              <span className="absolute -top-3.5 left-1/2 z-10 -translate-x-1/2 rounded-full bg-gradient-to-r from-accent-2 to-accent px-5 py-1.5 text-xs font-black uppercase tracking-wider text-white shadow-[0_10px_24px_-10px_rgba(31,123,255,0.9)]">
                {plan.badge}
              </span>
            )}

            <header>
              <h3 className={`text-xl font-extrabold sm:text-2xl ${titleClass}`}>{plan.title}</h3>

              <div className="mt-3 flex flex-wrap items-baseline gap-2.5">
                <span className={`text-4xl font-black tabular-nums ${priceClass}`}>
                  {plan.price.toLocaleString("ru-RU")} ₽
                </span>
                <span className={`text-base line-through ${oldClass}`}>
                  {plan.oldPrice.toLocaleString("ru-RU")} ₽
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2.5">
                <span
                  className={`rounded-md px-2 py-1 text-[11px] font-black uppercase tracking-wide ${
                    "bg-mint/15 text-mint"
                  }`}
                >
                  {plan.discount}
                </span>
                <span className={`text-xs ${noteClass}`}>{plan.perMonth}</span>
              </div>
            </header>

            <ul className="mt-6 flex-1 space-y-3">
              {FEATURES.map((feature) => (
                <li key={feature.key} className={`flex items-start gap-2.5 text-sm ${featureClass}`}>
                  <span
                    className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                      "bg-accent/18"
                    } ${checkClass}`}
                  >
                    <CheckIcon />
                  </span>
                  <span>{feature.text}</span>
                </li>
              ))}
            </ul>

            <div className="mt-7">
              {active ? (
                <button
                  type="button"
                  disabled
                  className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-mint/40 bg-mint/12 px-4 text-sm font-extrabold text-mint"
                >
                  Активна до {statusLabel}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onSelect(plan)}
                  className={`pp-cta inline-flex h-12 w-full items-center justify-center rounded-xl px-4 text-sm font-extrabold text-white ${
                    highlighted ? "pp-cta--hit" : "pp-cta--ghost"
                  }`}
                >
                  {account ? "Оформить подписку" : plan.badge ? "Войти и оформить" : "Войти и выбрать"}
                </button>
              )}

              {justActivated === plan.id && (
                <p className="mt-2.5 text-center text-xs text-mint animate-fade-in">
                  Подписка активирована.
                </p>
              )}
            </div>
          </article>
        );
      })}
    </div>
    </>
  );
}

/* ---------------------------- Промокод -------------------------------- */

/** Подсказка «чтобы оформить подписку, войдите» — исчезает после входа */
export function PremiumLoginNote() {
  const account = useAccount();
  if (account) return null;
  return (
    <p className="mt-4 text-sm text-accent-2">
      Для оформления подписки необходимо{" "}
      <AuthTrigger
        tab="login"
        className="font-bold underline underline-offset-4 transition hover:text-white"
      >
        войти в аккаунт
      </AuthTrigger>
    </p>
  );
}

/** Дни подписки за промокод живут в PROMO_DAYS (lib/premium-perks) */

/** Блок «Есть промокод?» — как на референсе, но проверка локальная */
export function PromoCode() {
  const account = useAccount();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const onApply = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      if (!account) {
        openAuthDialog("login");
        return;
      }
      const result = applyPromo(code, (days) => {
        const next = activatePremium(days);
        return next ? next.premiumUntil ?? 0 : null;
      });
      setMessage({ ok: result.ok, text: result.message });
      if (result.ok) setCode("");
    },
    [account, code],
  );

  return (
    <section className="pp-promo rounded-3xl p-6 sm:p-7">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="max-w-md">
          <h3 className="text-lg font-extrabold text-white sm:text-xl">Есть промокод?</h3>
          <p className="mt-1 text-sm text-muted">
            Введи код — подписка продлится на несколько дней
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-accent/85">
            Каждый код работает один раз на аккаунт. Подсказка: промокоды мы
            публикуем в новостях проекта.
          </p>
        </div>

        <form onSubmit={onApply} className="flex w-full flex-col gap-2.5 sm:flex-row md:w-auto">
          <input
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
              setMessage(null);
            }}
            placeholder="ВВЕДИТЕ ПРОМОКОД"
            maxLength={24}
            autoComplete="off"
            aria-label="Промокод"
            className="h-11 min-w-0 flex-1 rounded-xl bg-white/[0.04] px-4 text-sm font-semibold uppercase tracking-wider text-white ring-1 ring-white/10 transition placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/55 sm:w-64"
          />
          <button
            type="submit"
            disabled={!code.trim()}
            className="btn-primary h-11 shrink-0 rounded-xl px-5 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Применить
          </button>
        </form>
      </div>

      {account ? (
        message && (
          <p
            className={`mt-3 text-sm animate-fade-in ${message.ok ? "text-mint" : "text-accent-2"}`}
            role="status"
          >
            {message.text}
          </p>
        )
      ) : (
        <p className="mt-3 text-sm text-accent-2/85">Войди в аккаунт, чтобы применить промокод</p>
      )}
    </section>
  );
}
