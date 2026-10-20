"use client";

/**
 * Что показывает `/premium`.
 *
 * Подписка активна → страница статуса: до какой даты, сколько осталось, что
 * даёт подписка. Витрина тарифов человеку с оплаченным Premium не нужна.
 *
 * Витрина приходит children'ом с сервера, а не строится здесь: она нужна для
 * SEO и для первого рендера, когда аккаунт ещё не прочитан (getServerSnapshot
 * отдаёт null). Поэтому в HTML страница тарифов есть всегда, и подменяется
 * только после гидрации.
 */

import { useEffect, type ReactNode } from "react";
import { isPremiumActive } from "@/lib/auth";
import { useAccount } from "@/lib/use-account";
import { applyAutoRenew } from "@/lib/premium-autorenew";
import { PremiumStatus } from "./PremiumStatus";

export function PremiumEntry({ children }: { children: ReactNode }) {
  const account = useAccount();

  /* Здесь, а не в PremiumStatus: тот рендерится только при активной подписке,
   * а продлевать как раз нужно истёкшую — до его монтирования дело бы не дошло. */
  useEffect(() => {
    applyAutoRenew();
  }, []);

  if (account && isPremiumActive(account)) return <PremiumStatus account={account} />;

  return <>{children}</>;
}
