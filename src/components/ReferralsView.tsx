"use client";

/**
 * «Пригласи друзей» — отдельная страница `/referrals`.
 *
 * Не путать с вкладкой профиля `?tab=referrals`: вкладка живёт внутри
 * страницы профиля, а здесь своя, широкая — рефералка это отдельный
 * раздел с картой орбит и хранилищем наград, прятать его в колонку
 * профиля значит сжать до ничего.
 *
 * Содержимое то же, что у вкладки, — переиспользуем её, чтобы правки
 * не разъезжались: два места показали бы разное при разных правках.
 */

import { useAccount } from "@/lib/use-account";
import { ReferralsSection } from "@/components/profile/ProfileSections";

export function ReferralsView() {
  const account = useAccount();
  return (
    <div className="ag-root">
      <div className="ag-list-wrap">
        <ReferralsSection account={account} />
      </div>
    </div>
  );
}
