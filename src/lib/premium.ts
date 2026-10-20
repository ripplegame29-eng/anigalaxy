"use client";

import { isPremiumActive, premiumDaysLeft } from "@/lib/auth";
import { useAccount } from "@/lib/use-account";
import { PREMIUM_CLAN_MULT, PREMIUM_QUEST_MULT } from "@/lib/premium-perks";

export {
  FREE_HQ_EPISODES,
  PREMIUM_CLAN_MULT,
  PREMIUM_PERKS,
  PREMIUM_QUEST_MULT,
  PREMIUM_QUALITIES,
  hqFreeForEpisode,
  qualityNeedsPremium,
  type PremiumPerk,
} from "@/lib/premium-perks";

/**
 * Состояние подписки для интерфейса.
 *
 * Множители отдаём вместе с флагом, чтобы компоненты не собирали
 * «а если Premium?» в каждом месте заново.
 */
export function usePremium() {
  const account = useAccount();
  const active = isPremiumActive(account);
  return {
    account,
    active,
    daysLeft: premiumDaysLeft(account),
    /** Множитель начислений: 1 у пользователя без подписки */
    questMult: active ? PREMIUM_QUEST_MULT : 1,
    clanMult: active ? PREMIUM_CLAN_MULT : 1,
  };
}