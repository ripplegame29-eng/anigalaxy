"use client";

/**
 * Оформление боевого пропуска — отдельная страница `/battlepass/buy`.
 *
 * Устроена как страница Premium: герой, тарифная карточка, что входит,
 * FAQ. Отличие по сути — предмет ровно один (сезон), и «покупка» открывает
 * золотую линию через подписку: отдельного платёжного метода у пропуска в
 * проекте нет, поэтому кнопка ведёт в ту же подписку, но срок считается по
 * остатку сезона, а не по календарному месяцу.
 *
 * Кнопка в трёх состояниях — как на странице Premium: не вошли → модалка
 * входа, вошли без пропуска → оформление, пропуск есть → дата и сумма.
 */

import { useCallback } from "react";
import Link from "next/link";
import { AuthTrigger } from "@/components/AuthDialog";
import { openAuthDialog } from "@/lib/auth-dialog";
import { activatePremium, formatPremiumUntil, isPremiumActive } from "@/lib/auth";
import { useAccount } from "@/lib/use-account";
import { BATTLEPASS } from "@/lib/battlepass/logic";

/** Годовой тариф — им открывается сезонный пропуск (см. PassPurchase) */
const SEASON_PRICE = 1290;

function seasonStartLabel(): string {
  return new Date(BATTLEPASS.from).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
}

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

/** Подсказка «чтобы оформить пропуск, войдите» — исчезает после входа */
export function PassLoginNote() {
  const account = useAccount();
  if (account) return null;
  return (
    <p className="mt-4 text-sm text-accent-2">
      Для оформления пропуска необходимо{" "}
      <AuthTrigger
        tab="login"
        className="font-bold underline underline-offset-4 transition hover:text-white"
      >
        войти в аккаунт
      </AuthTrigger>
    </p>
  );
}

/**
 * Тарифная карточка сезона.
 *
 * `daysLeft` считается на сервере и приходит пропом: Date.now() в теле
 * клиентского компонента ловит правило чистоты рендера, а заодно это
 * гарантирует одинаковый текст при гидратации.
 */
export function PassPlans({ daysLeft }: { daysLeft: number }) {
  const account = useAccount();
  const premium = isPremiumActive(account);
  const days = daysLeft;
  const rewardLevels = BATTLEPASS.levels.length;

  const onBuy = useCallback(() => {
    if (!account) {
      openAuthDialog("login");
      return;
    }
    if (premium || days <= 0) return;
    // Даём подписку с запасом за сезон: остаток считается от «сейчас»,
    // иначе пропуск мог бы кончиться раньше конца сезона
    activatePremium(days + 30);
  }, [account, premium, days]);

  return (
    <div className="mx-auto grid max-w-3xl grid-cols-1 gap-6">
      <div className="relative overflow-hidden rounded-3xl border border-accent/45 bg-gradient-to-b from-accent/22 to-ink-soft shadow-[0_28px_60px_-24px_rgba(31,123,255,0.65)]">
        <div className="flex items-start justify-between gap-4 p-6 sm:p-8">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-accent-2">
              Сезон {BATTLEPASS.seasonId.replace("season-", "")} · {BATTLEPASS.name.replace(/^Сезон \d+ · /, "")}
            </p>
            <p className="mt-1 font-display text-4xl font-black leading-none text-white tabular-nums sm:text-5xl">
              {SEASON_PRICE.toLocaleString("ru-RU")}
              <span className="text-2xl">₽</span>
            </p>
            <p className="mt-1 text-xs font-bold text-muted">
              разовый платёж · с {seasonStartLabel()} по{" "}
              {new Date(BATTLEPASS.to).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-accent-2/15 px-2.5 py-1 text-[10px] font-black text-accent-2 ring-1 ring-accent-2/40">
            ~20% выгоднее
          </span>
        </div>

        <ul className="space-y-2 border-t border-white/10 px-6 py-5 text-sm sm:px-8">
          {[
            `Золотая линия на ${rewardLevels} наградных уровнях`,
            "Пройденные уровни можно забрать одной кнопкой",
            "Рамки, маски и титулы только за этот сезон",
            "Награды не сгорают после конца сезона",
          ].map((line) => (
            <li key={line} className="flex items-start gap-2.5 text-muted">
              <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-mint" />
              <span>{line}</span>
            </li>
          ))}
        </ul>

        <div className="px-6 pb-6 sm:px-8 sm:pb-8">
          {premium ? (
            <>
              <p className="mb-3 rounded-xl border border-mint/30 bg-mint/10 px-4 py-3 text-sm font-bold text-mint">
                Пропуск активен ✓ до {formatPremiumUntil(account)}
              </p>
              <Link
                href="/battlepass"
                className="inline-flex w-full items-center justify-center rounded-xl border border-white/12 bg-white/[0.05] px-4 py-3 text-sm font-black text-white transition hover:bg-white/10 motion-reduce:transition-none"
              >
                Перейти к дорожке
              </Link>
            </>
          ) : (
            <button
              type="button"
              onClick={onBuy}
              disabled={days <= 0}
              className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-b from-accent to-accent-2 px-4 py-3.5 text-sm font-black text-white shadow-[0_10px_30px_-10px_rgba(31,123,255,0.9)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none"
            >
              {days <= 0
                ? "Сезон завершён"
                : `Купить пропуск за ${SEASON_PRICE.toLocaleString("ru-RU")} ₽`}
            </button>
          )}
          <p className="mt-2.5 text-center text-[11px] leading-snug text-muted">
            {premium
              ? "Подписка уже активна — продлевать пропуск не нужно."
              : days <= 0
                ? "Продажи пропуска закрыты вместе с сезоном."
                : `Подписка откроется на ${days} дн. — столько осталось в сезоне, плюс 30 дней запаса.`}
          </p>
          <p className="mt-1 text-center text-[10px] leading-snug text-accent-2/80">
            Демо: платёжный шлюз не подключён, деньги не списываются — активация нужна для проверки механики.
          </p>
        </div>
      </div>
    </div>
  );
}