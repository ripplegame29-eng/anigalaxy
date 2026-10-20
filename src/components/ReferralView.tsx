"use client";

/**
 * Страница реферальной программы.
 *
 * Обёртка нужна ради Suspense: компонент читает localStorage через
 * useMyReferrals, и без границы статическая сборка страницы не пройдёт.
 */

import { Suspense } from "react";
import { ReferralPage } from "@/components/referral/ReferralPage";

export function ReferralView() {
  return (
    <Suspense fallback={null}>
      <ReferralPage />
    </Suspense>
  );
}
