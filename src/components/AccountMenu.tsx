"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { clearAccount, isPremiumActive } from "@/lib/auth";
import { openAuthDialog } from "@/lib/auth-dialog";
import { useAccount } from "@/lib/use-account";
import { useProfile, unreadCount } from "@/lib/profile";
import { watchStats, watchStore } from "@/lib/history";
import { readyQuestCount, useLevelInfo, useProgress } from "@/lib/progression/events";
import { PROGRESSION_CONFIG } from "@/lib/progression/progression.config";
import { openProfileDialog } from "@/lib/profile-dialog";
import { FRAMES } from "@/lib/cosmetics";
import { AgTag } from "@/components/progression/AgTag";
import { AvatarView } from "./profile/AvatarView";

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
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
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
      <path strokeLinecap="round" d="M12 3.5v2M12 18.5v2M4.9 7.5l1.7 1M17.4 15.5l1.7 1M4.9 16.5l1.7-1M17.4 8.5l1.7-1" />
    </>,
  ),
  premium: svg(
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 7.5 7 11l5-6.5 5 6.5 3.5-3.5-1.7 10H5.2L3.5 7.5ZM6 20h12" />,
  ),
  logout: svg(
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17v1.5a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 3 18.5v-13A2.5 2.5 0 0 1 5.5 3h7A2.5 2.5 0 0 1 15 5.5V7" />
      <path strokeLinecap="round" d="M10 12h11m0 0-3-3m3 3-3 3" />
    </>,
  ),
  battlepass: svg(
    <>
      <path d="M12 21.5s7-3.4 7-9V5.4L12 2.5 5 5.4V12.5c0 5.6 7 9 7 9Z" />
    </>,
  ),
  together: svg(
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>,
  ),
};

/**
 * Разделы аккаунта.
 *
 * Список вынесен в хук, потому что он нужен в двух местах: в дропдауне
 * шапки и в мобильной шторке. Дублировать его — значит через месяц
 * забыть про один из пунктов в одной из версий.
 */
export function useAccountItems(onNavigate?: () => void): Item[] {
  const profile = useProfile();
  const progress = useProgress();

  const questBadge = readyQuestCount(progress);
  const notices = unreadCount(profile);

  const onLogout = useCallback(() => {
    clearAccount();
    onNavigate?.();
  }, [onNavigate]);

  return useMemo(
    () => [
      { kind: "link", href: "/profile", label: "Мой профиль", icon: ICONS.profile },
      { kind: "link", href: "/profile?tab=favorites", label: "Мой список", icon: ICONS.list },
      { kind: "link", href: "/store", label: "Магазин", icon: ICONS.store },
      { kind: "link", href: "/profile?tab=quests", label: "Квесты", icon: ICONS.quest, badge: questBadge },
      { kind: "link", href: "/profile?tab=achievements", label: "Достижения", icon: ICONS.trophy },
      {
        kind: "action",
        label: "Косметика",
        icon: ICONS.palette,
        onSelect: () => openProfileDialog("appearance"),
      },
      { kind: "link", href: "/profile?tab=referrals", label: "Пригласи друзей", icon: ICONS.users },
      { kind: "link", href: "/profile?tab=gifts", label: "Подарки Premium", icon: ICONS.gift },
      {
        kind: "link",
        href: "/profile?tab=notices",
        label: "Уведомления",
        icon: ICONS.bell,
        badge: notices,
      },
      { kind: "link", href: "/settings", label: "Настройки", icon: ICONS.settings },
      { kind: "link", href: "/premium", label: "Premium", icon: ICONS.premium },
      { kind: "danger", label: "Выйти", icon: ICONS.logout, onSelect: onLogout },
    ],
    [questBadge, notices, onLogout],
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
        className="btn-login w-full justify-center"
      >
        Войти
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
      <AvatarView
        nickname={account.nickname}
        avatar={profile.avatar || undefined}
        frameCss={frame?.css}
        frameImg={frame?.img}
        className="h-10 w-10"
        textClass="text-xs"
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-extrabold text-white">{account.nickname}</span>
          {premium && (
            <span className="shrink-0 rounded bg-gold/20 px-1.5 py-0.5 text-[9px] font-black tracking-wide text-gold">
              PREMIUM
            </span>
          )}
        </span>
        <span className="block text-xs text-[#8e8e93]">Открыть профиль</span>
      </span>
    </Link>
  );
}

/**
 * Аватар в шапке → дропдаун аккаунта.
 *
 * Верх — ник, почта, уровень и полоса XP; ниже — разделы профиля
 * (списки, магазин, квесты, достижения, косметика, подарки, уведомления),
 * настройки и выход.
 */
export function AccountMenu() {
  const account = useAccount();
  const pathname = usePathname();
  const profile = useProfile();
  const watch = watchStore.useStore();

  /**
   * Меню открыто, только пока пользователь на том же маршруте, где нажал
   * кнопку: переход по ссылке сам закрывает выпадашку — отдельного эффекта
   * с setState (его запрещает линтер) не нужно.
   */
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const open = openedAt === pathname;
  const close = useCallback(() => setOpenedAt(null), []);
  const toggle = useCallback(
    () => setOpenedAt((value) => (value === pathname ? null : pathname)),
    [pathname],
  );

  const items = useAccountItems(close);

  const watched = useMemo(() => watchStats(watch), [watch]);
  const info = useLevelInfo();
  const progress = useProgress();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  // Выход без аккаунта — только после всех хуков: условный вызов хука
  // ломает порядок между рендерами и ловится линтером
  if (!account) {
    return (
      <button type="button" onClick={() => openAuthDialog("login")} className="btn-login">
        Войти
      </button>
    );
  }

  /** Экипированный тег (§12.4): виден в выпадающем меню */
  const equippedTagId = progress.progress.equippedTagId;
  const equippedTag = equippedTagId
    ? PROGRESSION_CONFIG.tags.find((item) => item.id === equippedTagId)
    : undefined;

  const premium = isPremiumActive(account);
  const frame = FRAMES.find((item) => item.id === profile.frameId);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Меню аккаунта: ${account.nickname}, уровень ${info.level}`}
        className="btn-ghost flex h-9 items-center gap-2 rounded-full bg-white/8 pl-1 pr-2 ring-1 ring-white/12 transition hover:bg-white/14 hover:ring-accent/45"
      >
        <AvatarView
          nickname={account.nickname}
          avatar={profile.avatar || undefined}
          frameCss={frame?.css}
          frameImg={frame?.img}
          className="h-7 w-7"
          textClass="text-[11px]"
        />
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[10px] font-black text-white">
          {info.level}
        </span>
        <span className="hidden max-w-28 truncate text-xs font-bold text-white sm:block">{account.nickname}</span>
        <svg
          viewBox="0 0 24 24"
          className={`h-3.5 w-3.5 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+10px)] w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-line bg-[#050506]/97 shadow-[0_30px_70px_-25px_rgba(0,0,0,1)] backdrop-blur-xl animate-fade-in"
        >
          {/* Профиль */}
          <div className="flex items-center gap-3 bg-gradient-to-r from-white/[0.07] to-white/[0.02] p-3 ring-1 ring-white/8">
            <AvatarView
              nickname={account.nickname}
              avatar={profile.avatar || undefined}
              frameCss={frame?.css}
              frameImg={frame?.img}
              className="h-11 w-11"
              textClass="text-sm"
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-sm font-extrabold text-white">{account.nickname}</span>
                {premium && (
                  <span className="shrink-0 rounded bg-gold/20 px-1.5 py-0.5 text-[9px] font-black tracking-wide text-gold">
                    PREMIUM
                  </span>
                )}
              </span>
              <span className="block truncate text-xs text-[#8e8e93]">{account.email}</span>
            </span>
          </div>

          {/* Уровень и XP */}
          <div className="border-b border-line px-3 py-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-bold text-white">
                Уровень {info.level} · {progress.progress.xpTotal} XP
              </span>
              <span className="text-[11px] text-[#8e8e93]">{info.percent}%</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/12">
              <div
                className="h-full rounded-full bg-gradient-to-r from-white to-white/75 transition-[width] duration-700"
                style={{ width: `${info.percent}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-[#8e8e93]">
              <span>Эра: {info.era}</span>
              <span>ещё {info.left} XP</span>
            </div>
            {equippedTag && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-[0.14em] text-[#8e8e93]">Тег</span>
                <AgTag tag={equippedTag} size="sm" />
              </div>
            )}
          </div>

          {/* Мини-статистика */}
          <div className="grid grid-cols-3 gap-1 border-b border-line px-3 py-2.5 text-center">
            {[
              { label: "минут", value: watched.minutes },
              { label: "аниме", value: watched.titles },
              { label: "монет", value: progress.progress.acBalance },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg bg-white/[0.05] px-1 py-1.5 ring-1 ring-white/10">
                <p className="text-sm font-black leading-none text-white">{stat.value}</p>
                <p className="mt-0.5 text-[10px] text-[#8e8e93]">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Разделы */}
          <nav className="max-h-[55vh] space-y-0.5 overflow-y-auto p-2" aria-label="Меню профиля">
            {items.map((item) => (
              <MenuItem key={item.label} item={item} onSelect={close} />
            ))}
          </nav>

          <p className="border-t border-line px-3 py-2 text-[10px] leading-relaxed text-[#8e8e93]">
            Аккаунт хранится в этом браузере: сервера у проекта нет.
          </p>
        </div>
      )}
    </div>
  );
}