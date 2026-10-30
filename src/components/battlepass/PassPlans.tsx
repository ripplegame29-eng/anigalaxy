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

import { BpIcon } from "./BpIcons";
import { useCallback, useMemo } from "react";
import Link from "next/link";
import { AuthTrigger } from "@/components/AuthDialog";
import { openCheckout } from "@/lib/checkout";
import { openAuthDialog } from "@/lib/auth-dialog";
import { activatePremium, formatPremiumUntil, isPremiumActive } from "@/lib/auth";
import { useAccount } from "@/lib/use-account";
import { BATTLEPASS, bpLineTotals } from "@/lib/battlepass/logic";
import { RewardArt } from "@/components/battlepass/RewardArt";
import { EXCLUSIVE_CARDS } from "@/components/battlepass/model";
import { AE_RARITY } from "@/components/progression/AchievementEmblem";

/** Годовой тариф — им открывается сезонный пропуск (см. PassPurchase) */
const SEASON_PRICE = 1190;

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
    <p className="mt-4 text-sm text-gold">
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
    openCheckout({
      title: "Боевой пропуск",
      caption: "Разовый платёж за сезон",
      price: SEASON_PRICE,
      perks: ["Золотая линия наград сезона", "Эксклюзивная косметика и аникойны", "Награды за пройденные уровни выдаются сразу"],
      // Подписка с запасом за сезон: остаток считается от «сейчас»,
      // иначе пропуск мог бы кончиться раньше конца сезона
      onPaid: () => activatePremium(days + 30),
    });
  }, [account, premium, days]);

  const totals = useMemo(() => bpLineTotals("premium"), []);
  const fan = useMemo(
    () =>
      [...EXCLUSIVE_CARDS]
        .filter((card) => card.line === "premium")
        .sort((x, y) => y.level - x.level)
        .slice(0, 3),
    [],
  );
  const seasonName = BATTLEPASS.name.replace(/^Сезон \d+ · /, "");

  const tilt = (event: React.PointerEvent<HTMLElement>) => {
    const r = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - r.left) / r.width - 0.5;
    const y = (event.clientY - r.top) / r.height - 0.5;
    event.currentTarget.style.setProperty("--rx", `${(-y * 10).toFixed(2)}deg`);
    event.currentTarget.style.setProperty("--ry", `${(x * 14).toFixed(2)}deg`);
    event.currentTarget.style.setProperty("--gx", `${((x + 0.5) * 100).toFixed(0)}%`);
  };
  const untilt = (event: React.PointerEvent<HTMLElement>) => {
    event.currentTarget.style.setProperty("--rx", "0deg");
    event.currentTarget.style.setProperty("--ry", "0deg");
  };

  return (
    <div className="bpb-wrap">
      <div className="bpb-grid">
        {/* Карта пропуска — наклоняется за курсором */}
        <div className="bpb-stage" onPointerMove={tilt} onPointerLeave={untilt}>
          <div className="bpb-fan">
            {fan.map((card, i) => (
              <div
                key={card.key}
                className={`bpb-fc bpb-fc--${i}`}
                style={{ "--k": AE_RARITY[card.rarity].c } as React.CSSProperties}
              >
                <i className="c tl" />
                <i className="c br" />
                <span className="bpb-fc-lv">Ур. {card.level}</span>
                <div className="bpb-fc-art">
                  <RewardArt card={card} size={i === 0 ? "lg" : "md"} live={i === 0} nickname={account?.nickname ?? "Гость"} />
                </div>
                <b>{card.label}</b>
                <small>
                  {card.kind === "frame" ? "Рамка" : card.kind === "decor" ? "Оформление" : "Титул"} · {card.rarityLabel}
                </small>
                <span className="bpb-fc-sheen" />
              </div>
            ))}
            <span className="bpb-chip bpb-chip--ac">
              {/* eslint-disable-next-line @next/next/no-img-element -- монетка 20px */}
              <img src="/coin.png" alt="" width={20} height={20} /> +{totals.ac.toLocaleString("ru-RU")} AC
            </span>
            <span className="bpb-chip bpb-chip--xp">✦ +{totals.bpXp.toLocaleString("ru-RU")} XP</span>
            <span className="bpb-chip bpb-chip--it"><BpIcon name="gift" size={15} /> {totals.items} эксклюзивов</span>
          </div>
          <p className="bpb-cap">Вот что внутри нижней ленты — лучшие награды сезона</p>
        </div>

        {/* Панель покупки */}
        <div className="bpb-panel">
          <i className="c tl" />
          <i className="c tr" />
          <i className="c bl" />
          <i className="c br" />
          <p className="bpb-eyebrow">
            Сезон {BATTLEPASS.seasonId.replace("season-", "")} · {seasonName}
          </p>
          <p className="bpb-price">
            {SEASON_PRICE.toLocaleString("ru-RU")}
            <small>₽</small>
          </p>
          <p className="bpb-dates">
            разовый платёж · с {seasonStartLabel()} по{" "}
            {new Date(BATTLEPASS.to).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
          </p>

          <ul className="bpb-list">
            {[
              `Нижняя лента наград на ${rewardLevels} уровнях`,
              "Пройденные уровни забираются одной кнопкой",
              "Рамки и титулы только за этот сезон",
              "Награды не сгорают после конца сезона",
            ].map((line) => (
              <li key={line}>
                <CheckIcon className="h-4 w-4" />
                <span>{line}</span>
              </li>
            ))}
          </ul>

          {premium ? (
            <>
              <p className="bpb-ok">Пропуск активен ✓ до {formatPremiumUntil(account)}</p>
              <Link href="/battlepass" className="bpb-cta bpb-cta--ghost">
                Перейти к дорожке
              </Link>
            </>
          ) : (
            <button type="button" onClick={onBuy} disabled={days <= 0} className="bpb-cta">
              {days <= 0 ? "Сезон завершён" : `Купить пропуск за ${SEASON_PRICE.toLocaleString("ru-RU")} ₽`}
            </button>
          )}
          <p className="bpb-note">
            {premium
              ? "Подписка уже активна — продлевать пропуск не нужно."
              : days <= 0
                ? "Продажи пропуска закрыты вместе с сезоном."
                : `Подписка откроется на ${days} дн. — столько осталось в сезоне, плюс 30 дней запаса.`}
          </p>
        </div>
      </div>

      <div className="bpb-stats">
        <div>
          <b>{totals.items}</b>
          <span>эксклюзивных предметов</span>
        </div>
        <div>
          <b>{totals.ac.toLocaleString("ru-RU")}</b>
          <span>аникойнов AC</span>
        </div>
        <div>
          <b>{totals.bpXp.toLocaleString("ru-RU")}</b>
          <span>XP сезона</span>
        </div>
        <div>
          <b>{totals.levels}</b>
          <span>наградных уровней</span>
        </div>
      </div>
    </div>
  );
}
