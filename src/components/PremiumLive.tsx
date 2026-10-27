"use client";

/**
 * Живые функции Premium на странице подписки:
 *  - «Попробовать 3 дня бесплатно» для тех, кто ещё не пробовал;
 *  - «Подарок месяца» для подписчиков.
 * Обе кнопки обращаются к серверу — он сам проверяет, можно ли.
 */

import { useEffect, useState } from "react";
import { openAuthDialog } from "@/lib/auth-dialog";
import { fetchPremiumState, premiumAction, type PremiumServerState } from "@/lib/premium-cloud";
import { PREMIUM_DROP, PREMIUM_TRIAL_DAYS } from "@/lib/premium-perks";
import { pushToast } from "@/lib/toasts";
import { useAccount } from "@/lib/use-account";
import "./premium-live.css";

function usePremiumState() {
  const account = useAccount();
  const [state, setState] = useState<PremiumServerState | null>(null);
  useEffect(() => {
    if (!account) return;
    let alive = true;
    void fetchPremiumState().then((s) => alive && setState(s));
    return () => {
      alive = false;
    };
  }, [account]);
  return { account, state, setState };
}

/** Кнопка пробного периода под заголовком витрины */
export function PremiumTrial() {
  const { account, state, setState } = usePremiumState();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (account && state && !state.trial.available) return null;

  const start = async () => {
    if (!account) {
      openAuthDialog("register");
      return;
    }
    setBusy(true);
    setError("");
    const res = await premiumAction("trial");
    setBusy(false);
    if (res.ok) {
      setState(res.state);
      pushToast({ kind: "premium", title: "Premium включён", text: `Пробный период на ${PREMIUM_TRIAL_DAYS} дня. Приятного просмотра!` });
    } else setError(res.error);
  };

  return (
    <div className="pl-trial">
      <button type="button" className="pl-trial-btn" onClick={() => void start()} disabled={busy}>
        <b>Попробовать {PREMIUM_TRIAL_DAYS} дня бесплатно</b>
        <small>{account ? "Без оплаты, один раз на аккаунт" : "Создай аккаунт — и подписка включится сразу"}</small>
      </button>
      {error && <p className="pl-err">{error}</p>}
    </div>
  );
}

/** Карточка «Подарок месяца» для подписчиков */
export function PremiumDrop() {
  const { account, state, setState } = usePremiumState();
  const [busy, setBusy] = useState(false);
  if (!account || !state?.active) return null;

  const claim = async () => {
    setBusy(true);
    const res = await premiumAction("drop");
    setBusy(false);
    if (res.ok) {
      setState(res.state);
      pushToast({ kind: "ac", title: "Подарок месяца", text: `+${PREMIUM_DROP.ac} монет и заморозка серии. Данные обновятся при следующей синхронизации.` });
    } else pushToast({ kind: "quest", title: "Не получилось", text: res.error });
  };

  return (
    <section className="pl-drop">
      <div>
        <h2>Подарок месяца</h2>
        <p>
          +{PREMIUM_DROP.ac} монет и заморозка серии — раз в календарный месяц, пока подписка активна.
        </p>
      </div>
      <button type="button" disabled={busy || !state.drop.available} onClick={() => void claim()}>
        {state.drop.claimed ? "Получено в этом месяце" : "Забрать"}
      </button>
    </section>
  );
}
