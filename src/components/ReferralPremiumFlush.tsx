"use client";

/**
 * Рефералка в фоне: запоминает код с ссылки приглашения и подтягивает с
 * сервера состояние (друзья, рубежи). Награды выдаёт сервер, сюда они
 * приходят вместе с обычной синхронизацией; здесь лишь тост о новом друге.
 */

import { useEffect } from "react";
import { captureReferralLanding, refreshReferrals, useReferralState } from "@/lib/referrals";
import { pushToast } from "@/lib/toasts";
import { useAccount } from "@/lib/use-account";

const SEEN_KEY = "animehub:ref-seen:v1";

export function ReferralPremiumFlush() {
  const account = useAccount();
  const state = useReferralState();

  useEffect(() => {
    captureReferralLanding();
  }, []);

  useEffect(() => {
    if (!account) return;
    void refreshReferrals();
    const id = window.setInterval(() => void refreshReferrals(), 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [account]);

  const qualified = state?.qualified ?? 0;
  useEffect(() => {
    if (!state) return;
    let seen = -1;
    try {
      seen = Number(window.localStorage.getItem(SEEN_KEY) ?? "-1");
    } catch {
      /* без хранилища просто не показываем тост */
    }
    try {
      window.localStorage.setItem(SEEN_KEY, String(qualified));
    } catch {
      /* ничего */
    }
    if (seen >= 0 && qualified > seen) {
      pushToast({
        kind: "xp",
        title: "Друг засчитан",
        text: `Засчитано друзей: ${qualified}. Premium и награды рубежей уже начислены.`,
      });
    }
  }, [qualified, state]);

  return null;
}
