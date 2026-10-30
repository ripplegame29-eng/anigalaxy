"use client";

/**
 * Оформление премиум-ветки сезонного пропуска карточек — страница
 * `/cards/season/buy`, собранная по образцу `/battlepass/buy`.
 *
 * Герой и FAQ рендерит серверная страница (`src/app/cards/season/buy/page.tsx`),
 * здесь живёт тариф: веер карт сезона, наклоняемый за курсором, панель
 * покупки и сама покупка внутри игры — `act("pass-buy")`, сервер сам спишет
 * алмазы и откроет ленту. Отдельной платёжной формы нет, как и у боевого
 * пропуска; цена на витрине — маркетинговая.
 */

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { AuthTrigger } from "@/components/AuthDialog";
import { openAuthDialog } from "@/lib/auth-dialog";
import { useAccount } from "@/lib/use-account";
import { cardDef } from "@/lib/cards/catalog";
import { act, ensureLoaded, useCards } from "@/lib/cards/client";
import { PASS, passReward, type PassTrack } from "@/lib/cards/season";
import { toast, useBusy } from "./common";
import { GameCard } from "./GameCard";
import { Ico } from "./icons";
import "../../app/cards-card.css";

/** Цена премиум-ветки — та же, что на плашке сезона */
const PRICE = 1190;

/** Карты сезона для веера: [уровень, лента]; вторая запись — главная награда в центре */
const FAN: readonly (readonly [number, PassTrack])[] = [[12, "free"], [30, "premium"], [24, "free"]];

function CheckIcon({ className = "h-4 w-4" }: { className?: string }) {
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

/** Подсказка «войдите, чтобы оформить пропуск» — исчезает после входа */
export function SeasonLoginNote() {
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

interface Sums {
  diamonds: number;
  packs: number;
  scroll: number;
}

export function SeasonBuy({ daysLeft, seasonNum, endLabel }: { daysLeft: number; seasonNum: number; endLabel: string }) {
  const s = useCards();
  const account = useAccount();
  const [busy, run] = useBusy();

  useEffect(() => ensureLoaded(), []);

  /** Суммы наград по каждой ленте и всего — детерминированная математика из конфига */
  const sums = useMemo(() => {
    const acc = { free: { diamonds: 0, packs: 0, scroll: 0 } as Sums, premium: { diamonds: 0, packs: 0, scroll: 0 } as Sums };
    for (const l of Array.from({ length: PASS.levels }, (_, i) => i + 1)) {
      for (const track of ["free", "premium"] as const) {
        const r = passReward(l, track);
        acc[track].diamonds += r.diamonds ?? 0;
        acc[track].packs += r.packs ?? 0;
        acc[track].scroll += r.scroll ?? 0;
      }
    }
    return {
      ...acc,
      all: {
        diamonds: acc.free.diamonds + acc.premium.diamonds,
        packs: acc.free.packs + acc.premium.packs,
        scroll: acc.free.scroll + acc.premium.scroll,
      } satisfies Sums,
    };
  }, []);

  /** Веер карт сезона: определение карты берём из каталога, если она есть */
  const fan = useMemo(
    () =>
      FAN.flatMap(([level, track]) => {
        const card = passReward(level, track).card;
        const def = card ? cardDef(card) : undefined;
        return def ? [{ level, track, def }] : [];
      }),
    [],
  );
  const seasonCard = fan.find((c) => c.track === "premium")?.def;

  const bought = !!s.state?.events.pass.bought;

  const onBuy = () =>
    run(async () => {
      if (!account) {
        openAuthDialog("login");
        return;
      }
      const r = await act("pass-buy");
      toast(r.ok ? "Премиум-ветка открыта — награды ждут на дорожке" : r.error, !r.ok);
    });

  return (
    <div className="svb-wrap">
      <div className="svb-grid">
        {/* ------------------ Веер наград — наклоняется за курсором ------------------ */}
        <div
          className="svb-stage"
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const x = (e.clientX - r.left) / r.width - 0.5;
            const y = (e.clientY - r.top) / r.height - 0.5;
            e.currentTarget.style.setProperty("--rx", `${(-y * 10).toFixed(2)}deg`);
            e.currentTarget.style.setProperty("--ry", `${(x * 14).toFixed(2)}deg`);
          }}
          onPointerLeave={(e) => {
            e.currentTarget.style.setProperty("--rx", "0deg");
            e.currentTarget.style.setProperty("--ry", "0deg");
          }}
        >
          <div className="svb-fan">
            {fan.map((c, i) => (
              <div key={`${c.track}-${c.level}`} className={`svb-fc svb-fc--${i}`}>
                <span className={`svb-fc-level${c.track === "premium" ? " pm" : ""}`}>
                  Ур. {c.level} · {c.track === "premium" ? "премиум-лента" : "бесплатная лента"}
                </span>
                <GameCard cardId={c.def.id} live stats={false} />
              </div>
            ))}
            <span className="svb-chip svb-chip--dia">
              <Ico name="diamond" size={14} /> +{sums.all.diamonds.toLocaleString("ru-RU")} алмазов
            </span>
            <span className="svb-chip svb-chip--pack">
              <Ico name="pack" size={14} /> +{sums.all.packs} паков
            </span>
            <span className="svb-chip svb-chip--card">
              <Ico name="crown" size={14} /> {seasonCard ? `Карта сезона — ${seasonCard.name}` : "Карты сезона"}
            </span>
          </div>
          <p className="svb-cap">Вот что лежит на двух лентах — ценности и карты сезона</p>
        </div>

        {/* ----------------------------- Панель покупки ----------------------------- */}
        <div className="svb-panel">
          <p className="svb-eyebrow">Сезонный пропуск · Сезон {seasonNum}</p>
          <p className="svb-price">
            {PRICE.toLocaleString("ru-RU")}
            <small>₽</small>
          </p>
          <p className="svb-dates">разовый платёж · действует до {endLabel}</p>

          <ul className="svb-list">
            <li>
              <CheckIcon />
              <span>Полный премиум-трек — {PASS.levels} наградных уровней</span>
            </li>
            <li>
              <CheckIcon />
              <span>
                {sums.premium.diamonds.toLocaleString("ru-RU")} алмазов, {sums.premium.packs} паков и{" "}
                {sums.premium.scroll} свитков улучшения по премиум-ленте
              </span>
            </li>
            <li>
              <CheckIcon />
              <span>Пройденные уровни выдадутся сразу при покупке</span>
            </li>
            <li>
              <CheckIcon />
              <span>Незабранное не сгорит до конца сезона</span>
            </li>
          </ul>

          {bought ? (
            <>
              <p className="svb-ok">Премиум активен ✓ — забирайте награды на дорожке</p>
              <Link href="/cards" className="svb-cta svb-cta--ghost">
                К дорожке сезона
              </Link>
            </>
          ) : (
            <button type="button" className="svb-cta" disabled={busy} onClick={onBuy}>
              Открыть премиум за {PRICE.toLocaleString("ru-RU")} ₽
            </button>
          )}
          <p className="svb-note">
            {bought
              ? "Премиум уже открыт — оформлять снова не нужно."
              : account
                ? `Оформление проходит внутри игры · премиум действует оставшиеся ${daysLeft} дн. сезона.`
                : "Войдите в аккаунт — оформление займёт пару секунд."}
          </p>
        </div>
      </div>

      {/* -------------------------------- Статистика ------------------------------- */}
      <div className="svb-stats">
        <div>
          <b>{PASS.levels}</b>
          <span>наградных уровней</span>
        </div>
        <div>
          <b>{sums.all.diamonds.toLocaleString("ru-RU")}</b>
          <span>алмазов на лентах</span>
        </div>
        <div>
          <b>{sums.all.packs}</b>
          <span>паков</span>
        </div>
        <div>
          <b>{fan.length}</b>
          <span>карты сезона</span>
        </div>
      </div>
    </div>
  );
}
