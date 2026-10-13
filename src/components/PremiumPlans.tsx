"use client";

import { useCallback, useMemo, useState } from "react";
import { AuthTrigger } from "./AuthDialog";
import { activatePremium, formatPremiumUntil, isPremiumActive } from "@/lib/auth";
import { redeemPromo } from "@/lib/promo-client";
import { openAuthDialog } from "@/lib/auth-dialog";
import { useAccount } from "@/lib/use-account";

interface Plan {
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

const PLANS: Plan[] = [
  {
    id: "month",
    title: "Месяц",
    price: 149,
    oldPrice: 199,
    discount: "Скидка 25%",
    perMonth: "149 ₽/мес",
    days: 30,
  },
  {
    id: "quarter",
    title: "3 Месяца",
    price: 349,
    oldPrice: 599,
    discount: "Выгода 42%",
    perMonth: "116 ₽/мес",
    days: 90,
    badge: "ХИТ ПРОДАЖ",
  },
  {
    id: "year",
    title: "Год",
    price: 1290,
    oldPrice: 2390,
    discount: "Выгода 46%",
    perMonth: "107 ₽/мес",
    days: 365,
    light: true,
  },
];

/**
 * Что показываем в карточке тарифа.
 *
 * Короткий список для тарифа и подробный — ниже на странице; оба из
 * одного модуля lib/premium-perks, чтобы текст не расходился с кодом.
 */
const FEATURES = [
  { text: "4K и 2K в плеере" },
  { text: "Вдвое больше за квесты и вход" },
  { text: "Клану +50% очков в заданиях" },
  { text: "Вторая линия наград боевого пропуска" },
  { text: "Эксклюзивные рамки и титулы" },
  { text: "Промокоды на дни подписки" },
];

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
export function PremiumPlans() {
  const account = useAccount();
  const premium = isPremiumActive(account);
  const [justActivated, setJustActivated] = useState<string | null>(null);

  const statusLabel = useMemo(() => formatPremiumUntil(account), [account]);

  const onSelect = useCallback(
    (plan: Plan) => {
      if (!account) {
        openAuthDialog("login");
        return;
      }
      if (premium) return;
      activatePremium(plan.days);
      setJustActivated(plan.id);
    },
    [account, premium],
  );

  return (
    <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-3 lg:gap-7">
      {PLANS.map((plan) => {
        const highlighted = plan.badge !== undefined;
        const active = premium;

        const cardClass = highlighted
          ? "relative mt-6 border border-accent/45 bg-gradient-to-b from-accent/25 to-ink-soft shadow-[0_28px_60px_-24px_rgba(31,123,255,0.65)] md:mt-0 md:scale-[1.04] md:hover:scale-[1.06]"
          : plan.light
            ? "relative overflow-hidden border border-white/60 bg-gradient-to-b from-[#f6f3ff] to-white shadow-[0_26px_52px_-20px_rgba(0,0,0,0.85)] hover:shadow-[0_30px_60px_-20px_rgba(31,123,255,0.45)]"
            : "relative overflow-hidden border border-line bg-card/90 shadow-[0_20px_46px_-24px_rgba(0,0,0,0.9)] hover:border-accent/45";

        const titleClass = plan.light ? "text-[#0f0f13]" : "text-white";
        const priceClass = plan.light ? "text-[#0f0f13]" : "text-white";
        const oldClass = plan.light ? "text-[#0f0f13]/45" : "text-muted";
        const noteClass = plan.light ? "text-[#0f0f13]/55" : "text-muted";
        const featureClass = plan.light ? "text-[#0f0f13]/80" : "text-white/75";
        const checkClass = plan.light ? "text-accent" : highlighted ? "text-accent" : "text-accent/70";

        return (
          <article
            key={plan.id}
            className={`group flex flex-col rounded-3xl p-6 transition duration-500 sm:p-7 ${cardClass}`}
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
                    plan.light ? "bg-emerald-500/15 text-emerald-700" : "bg-mint/15 text-mint"
                  }`}
                >
                  {plan.discount}
                </span>
                <span className={`text-xs ${noteClass}`}>{plan.perMonth}</span>
              </div>
            </header>

            <ul className="mt-6 flex-1 space-y-3">
              {FEATURES.map((feature) => (
                <li key={feature.text} className={`flex items-start gap-2.5 text-sm ${featureClass}`}>
                  <span
                    className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                      plan.light ? "bg-accent/12" : "bg-accent/18"
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
                  className={`inline-flex h-12 w-full items-center justify-center rounded-xl px-4 text-sm font-extrabold transition duration-300 hover:-translate-y-0.5 ${
                    highlighted
                      ? "bg-gradient-to-r from-accent-2 to-accent text-white shadow-[0_14px_30px_-12px_rgba(31,123,255,1)] hover:brightness-110"
                      : plan.light
                        ? "bg-[#0f0f13] text-white hover:bg-accent"
                        : "border border-white/15 bg-white/6 text-white hover:border-accent/60 hover:bg-accent/15"
                  }`}
                >
                  {account ? "Оформить подписку" : plan.badge ? "Войти и оформить" : "Войти и выбрать"}
                </button>
              )}

              {justActivated === plan.id && (
                <p className="mt-2.5 text-center text-xs text-mint animate-fade-in">
                  Подписка активирована — спасибо за поддержку!
                </p>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

/* ---------------------------- Промокод -------------------------------- */

/** Подсказка «чтобы оформить подписку, войдите» — исчезает после входа */
export function PremiumLoginNote() {
  const account = useAccount();
  if (account) return null;
  return (
    <p className="mt-4 text-sm text-gold">
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

/** Дни подписки за промокод живут в промокодах панели; словарь PROMO_DAYS
 *  (lib/premium-perks) остался запасным путём для гостя без аккаунта. */

/** Блок «Есть промокод?» — проверка на сервере, локальный путь как запасной */
export function PromoCode() {
  const account = useAccount();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // Асинхронный обработчик: redeemPromo ходит в сеть, и на время запроса
  // кнопку надо гасить — иначе двойной клик активирует код дважды.
  const onApply = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!account) {
        openAuthDialog("login");
        return;
      }
      if (busy) return;

      setBusy(true);
      setMessage(null);

      try {
        const result = await redeemPromo(code);
        setMessage({ ok: result.ok, text: result.message });
        if (result.ok) setCode("");
      } finally {
        setBusy(false);
      }
    },
    [account, busy, code],
  );

  return (
    <section className="rounded-3xl border border-line bg-card/70 p-6 sm:p-7">
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
            disabled={!code.trim() || busy}
            className="btn-primary h-11 shrink-0 rounded-xl px-5 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Проверяем…" : "Применить"}
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
        <p className="mt-3 text-sm text-gold/85">Войди в аккаунт, чтобы применить промокод</p>
      )}
    </section>
  );
}
