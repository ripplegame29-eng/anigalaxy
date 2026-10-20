"use client";

/**
 * Разовое начисление дней Premium за приглашения.
 *
 * Пригласивший — другой человек с другого устройства, поэтому в момент
 * регистрации новичка его аккаунт здесь недоступен: приглашение складывается
 * в очередь под кодом (`lib/referrals.ts`). Этот компонент висит в корневом
 * макете и при загрузке страницы превращает накопившееся в дни подписки.
 *
 * Ничего не рендерит и не имеет состояния — только один вызов при монтировании.
 * Повторные вызовы безопасны: начисление идемпотентно.
 */

import { useEffect } from "react";
import { flushReferralPremium } from "@/lib/referrals";
import { pushToast } from "@/lib/toasts";

export function ReferralPremiumFlush() {
  useEffect(() => {
    const result = flushReferralPremium();
    if (!result) return;
    pushToast({
      kind: "xp",
      title: `+${result.days} дн. Premium`,
      text: `Приглашено друзей: ${result.credited}. Подписка продлена.`,
    });
  }, []);

  return null;
}
