"use client";

/**
 * Аккаунт в шапке и мобильной шторке.
 *
 * Выпадающее меню профиля переехало в готовый компонент `ProfileMenu`
 * (обёртка — components/ProfileMenu.tsx, сам компонент — lib/profile-menu.js).
 * Здесь осталось то, что используется мобильной шторкой: карточка аккаунта,
 * пункт списка разделов и сам список. Их удалять нельзя — без них шторка
 * теряет разделы профиля.
 */

import Link from "next/link";
import { useCallback, useMemo } from "react";
import { clearAccount, isPremiumActive } from "@/lib/auth";
import { openAuthDialog } from "@/lib/auth-dialog";
import { useAccount } from "@/lib/use-account";
import { useProfile } from "@/lib/profile";
import { readyQuestCount, useProgress } from "@/lib/progression/events";
import { FRAMES } from "@/lib/cosmetics";
import { AvatarFrame } from "./profile/AvatarFrame";

/** Пункты меню: разделы профиля открываем ссылкой, модалки — через стор */
export type Item =
  | { kind: "link"; href: string; label: string; icon: React.ReactNode; badge?: number }
  | { kind: "action"; label: string; icon: React.ReactNode; onSelect: () => void }
  | { kind: "danger"; label: string; icon: React.ReactNode; onSelect: () => void };

export function MenuItem({ item, onSelect }: { item: Item; onSelect: () => void }) {
  const className = `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
    item.kind === "danger"
      ? "text-[#f14c4c] hover:bg-[#f14c4c]/12"
      : "text-[#c6c6cb] hover:bg-white/8 hover:text-white"
  }`;

  const content = (
    <>
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/6 text-current ring-1 ring-white/10">
        {item.icon}
      </span>
      <span className="flex-1 truncate">{item.label}</span>
      {"badge" in item && item.badge ? (
        <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-accent px-1.5 text-[10px] font-black text-white">
          {item.badge}
        </span>
      ) : null}
    </>
  );

  if (item.kind === "link") {
    return (
      <Link href={item.href} onClick={onSelect} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={() => { item.onSelect(); onSelect(); }} className={className}>
      {content}
    </button>
  );
}

const svg = (path: React.ReactNode) => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
    {path}
  </svg>
);

export const ICONS = {
  profile: svg(
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </>,
  ),
  list: svg(
    <>
      <path strokeLinecap="round" d="M4 6h10M4 12h10M4 18h7" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m17 14 3 3-3 3" />
    </>,
  ),
  store: svg(
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16l-1 11H5L4 8Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>,
  ),
  quest: svg(
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" />
      <path strokeLinecap="round" d="M12 15v5m-3-2h6" />
    </>,
  ),
  trophy: svg(
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path strokeLinecap="round" d="M7 6H4v1a4 4 0 0 0 4 4M17 6h3v1a4 4 0 0 1-4 4M9 20h6M12 14v6" />
    </>,
  ),
  palette: svg(
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.9 2-2 0-.6-.3-1-.7-1.4-.4-.4-.6-.8-.6-1.3 0-1 .9-1.8 1.9-1.8H16a5 5 0 0 0 5-5c0-3.9-4-6.5-9-6.5Z" />
      <circle cx="7.5" cy="11.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="7.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="8" r="1.1" fill="currentColor" stroke="none" />
    </>,
  ),
  users: svg(
    <>
      <circle cx="9" cy="9" r="3.2" />
      <path strokeLinecap="round" d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 6.5a3 3 0 0 1 0 5.6M17.5 19a5.4 5.4 0 0 0-2-4.2" />
    </>,
  ),
  gift: svg(
    <>
      <rect x="3.5" y="9" width="17" height="11" rx="1.6" />
      <path strokeLinecap="round" d="M3.5 13h17M12 9v11" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9c-2.5 0-4.5-.6-4.5-2.4S9.5 4 12 9Zm0 0c2.5 0 4.5-.6 4.5-2.4S14.5 4 12 9Z" />
    </>,
  ),
  bell: svg(
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.5 16V10a5.5 5.5 0 0 1 11 0v6l1.5 2H5l1.5-2Z" />
      <path strokeLinecap="round" d="M10 19.5a2 2 0 0 0 4 0" />
    </>,
  ),
  settings: svg(
    <>
      <circle cx="12" cy="12" r="3" />
      <path strokeLinecap="round" d="M12 3.5v2M12 18.5v2M4.9 7.5l1 1M17.4 15.5l1 1M4.9 16.5l1-1M17.4 8.5l1-1" />
    </>,
  ),
  premium: svg(
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 7.5 7 11l5-6.5 5 6.5 3.5-3.5-1.7 10H5.2L3.5 7.5ZM6 20h12" />
  ),
  logout: svg(
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17v1.5a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 3 18.5v-13A2.5 2.5 0 0 1 5.5 3h7A2.5 2.5 0 0 1 15 5.5V7" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 12h11m0 0-3-3m3 3-3 3" />
    </>,
  ),
};

/**
 * Разделы аккаунта.
 *
 * Список вынесен в хук, потому что он нужен в двух местах: в мобильной
 * шторке. Дублировать его — значит через месяц забыть про один из пунктов в
 * одной из версий.
 */
export function useAccountItems(onNavigate?: () => void): Item[] {
  const progress = useProgress();

  const questBadge = readyQuestCount(progress);

  const onLogout = useCallback(() => {
    clearAccount();
    onNavigate?.();
  }, [onNavigate]);

  return useMemo(
    () => [
      { kind: "link", href: "/profile", label: "Мой профиль", icon: ICONS.profile },
      { kind: "link", href: "/list", label: "Мой список", icon: ICONS.list },
      { kind: "link", href: "/referrals", label: "Пригласить друзей", icon: ICONS.users },
      { kind: "link", href: "/store", label: "Магазин", icon: ICONS.store },
      { kind: "link", href: "/profile?tab=quests", label: "Квесты", icon: ICONS.quest, badge: questBadge },
      { kind: "link", href: "/profile?tab=achievements", label: "Достижения", icon: ICONS.trophy },
      { kind: "link", href: "/cosmetics", label: "Косметика", icon: ICONS.palette },
      { kind: "link", href: "/profile?tab=referrals", label: "Пригласи друзей", icon: ICONS.users },
      { kind: "link", href: "/profile?tab=gifts", label: "Подарки Premium", icon: ICONS.gift },
      /* Уведомлений в меню нет: колокольчик с их счётчиком уже стоит в шапке,
         второй вход в то же место только путает. */
      { kind: "link", href: "/settings", label: "Настройки", icon: ICONS.settings },
      { kind: "link", href: "/premium", label: "Premium", icon: ICONS.premium },
      { kind: "danger", label: "Выйти", icon: ICONS.logout, onSelect: onLogout },
    ],
    [questBadge, onLogout],
  );
}

/**
 * Карточка аккаунта для мобильной шторки: аватар, ник и переход в профиль.
 *
 * Неавторизованному вместо карточки показывается кнопка «Войти» —
 * иначе на телефоне не было бы ни одного входа в аккаунт: бургер открывал
 * только навигацию по сайту.
 */
export function AccountCard({ onNavigate }: { onNavigate?: () => void }) {
  const account = useAccount();
  const profile = useProfile();

  if (!account) {
    return (
      <button
        type="button"
        onClick={() => {
          openAuthDialog("login");
          onNavigate?.();
        }}
        className="flex w-full items-center gap-3 rounded-2xl border border-accent/35 bg-accent/10 px-3.5 py-3 text-left transition hover:border-accent/60 hover:bg-accent/16 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
      >
        {/* Значок в круге — как в референсном меню: он читается и при
            взгляде мельком, текст подсказывает только вблизи */}
        <span
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/18 text-accent-2 ring-1 ring-accent/30"
        >
          <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4M9 11l5-5m0 0-5 5m5-5v8" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-white">Войти в аккаунт</span>
          <span className="mt-0.5 block text-[11px] leading-snug text-muted">
            История просмотра, избранное и прогресс
          </span>
        </span>
      </button>
    );
  }

  const frame = FRAMES.find((item) => item.id === profile.frameId);
  const premium = isPremiumActive(account);

  return (
    <Link
      href="/profile"
      onClick={onNavigate}
      className="flex items-center gap-3 rounded-2xl bg-white/[0.06] p-2.5 ring-1 ring-white/10 transition hover:bg-white/[0.1]"
    >
      <AvatarFrame
  nickname={account.nickname}
  avatar={profile.avatar || undefined}
  frame={frame}
  size="xs"
/>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-extrabold text-white">{account.nickname}</span>
          {premium && (
            <span className="shrink-0 rounded bg-accent-2/20 px-1.5 py-0.5 text-[9px] font-black tracking-wide text-accent-2">
              PREMIUM
            </span>
          )}
        </span>
        <span className="block text-xs text-[#8e8e93]">Открыть профиль</span>
      </span>
    </Link>
  );
}