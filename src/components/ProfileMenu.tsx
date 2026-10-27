"use client";

/**
 * Выпадающее меню профиля — обёртка над готовым компонентом `ProfileMenu`.
 *
 * Компонент (`lib/profile-menu.js` + `app/profile-menu.css`) написан на чистом
 * JS без зависимостей и живёт вне React: он сам строит свою разметку, сам ловит
 * клавиатуру и сам следит за видимостью. Здесь только мост к данным проекта:
 * `getProfile` читает сторы при каждом открытии (ничего не кэширует),
 * `onSelect` повторяет прежнюю навигацию.
 *
 * Триггер — та же кнопка, что была: аватар с рамкой косметики, бейдж уровня,
 * ник и шеврон. Аватар помечен `data-pm-av` — на него ProfileMenu вешает
 * выбранный эффект (неон / глитч / радуга), саму рамку не трогая.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import "../app/profile-menu.css";
// Сайд-эффект: IIFE внутри файла вешает ProfileMenu на window
import "../lib/profile-menu";
import { clearAccount, isPremiumActive } from "@/lib/auth";
import { openAuthDialog } from "@/lib/auth-dialog";
import { useAccount } from "@/lib/use-account";
import { useIsAdmin } from "@/lib/admin-client";
import { useProfile } from "@/lib/profile";
import { watchStats, watchStore } from "@/lib/history";
import { DailyLoginModal } from "./DailyLoginModal";
import { autoCollectIfNeeded, dailyView } from "@/lib/daily-login";
import { readyQuestCount, useLevelInfo, useProgress } from "@/lib/progression/events";
import { AvatarFrame } from "./profile/AvatarFrame";
import { FRAMES } from "@/lib/cosmetics";

/**
 * Пункты: id и href как было в старом меню.
 *
 * `cosmetics` ведёт на витрину `/cosmetics`, а не открывает модалку: модалка
 * внешнего вида осталась в профиле (там же включается аватар и свой фон), но
 * как главный вход она прятала каталог в окошке поверх страницы.
 */
const NAV: Record<string, string> = {
  profile: "/profile",
  list: "/list",
  shop: "/store",
  quests: "/quests",
  achievements: "/profile?tab=achievements",
  levels: "/levels",
  cosmetics: "/cosmetics",
  invite: "/referrals",
  events: "/events",
  apps: "/apps",
  notices: "/notifications",
  settings: "/settings",
  premium: "/premium",
  admin: "/admin",
};

/**
 * Типы для `lib/profileMenu.js` — он на чистом JS, поэтому контракт
 * описан здесь. Поля те же, что в шапке комментария внутри файла.
 */
interface ProfileMenuItem {
  id: string;
  label: string;
  icon: string;
  /** Заголовок группы: меняется — в меню рисуется новый раздел */
  group?: string;
  href?: string;
  badge?: number | ((p: ProfileData) => number);
}

interface ProfileMenuApi {
  init: (opts: {
    trigger: HTMLElement;
    getProfile: () => ProfileData;
    onSelect: (id: string) => void;
    onLogout: () => void;
    onEffectChange: () => void;
    note: string;
    items: ProfileMenuItem[];
    /** Ежедневный вход: цикл наград и действия (lib/daily-login) */
    daily?: { view: () => unknown; streak: number };
    /** Открыть окно ежедневного входа (React-компонент снаружи) */
    onDaily?: () => void;
  }) => { destroy: () => void };
  premiumButton: (opts: {
    container: HTMLElement;
    href: string;
    label: string;
    premium: boolean;
  }) => { remove: () => void };
  avatarHTML: (p: ProfileData, size: number, empty?: boolean) => string;
  DEFAULT_ITEMS: ProfileMenuItem[];
}

/** Данные, которые компонент запрашивает у проекта при каждом открытии */
interface ProfileData {
  name: string;
  email: string;
  premium: boolean;
  letter: string;
  avatarUrl?: string;
  level: number;
  xp: number;
  xpToNext: number;
  xpPercent: number;
  era: string;
  minutes: number;
  anime: number;
  coins: number;
}

/** Реализация с window — присваивается при импорте модуля */
declare global {
  interface Window {
    ProfileMenu?: ProfileMenuApi;
  }
}

export function ProfileMenu({ onAfterSelect }: { onAfterSelect?: () => void }) {
  const account = useAccount();
  const isAdmin = useIsAdmin();
  const profile = useProfile();
  const info = useLevelInfo();
  const progress = useProgress();
  const watch = watchStore.useStore();
  const router = useRouter();

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<{ destroy: () => void } | null>(null);
  const [dailyOpen, setDailyOpen] = useState(false);

  const watched = watchStats(watch);

  // Гостю меню не нужно: вместо него кнопка «Войти», как и раньше
  const frame = FRAMES.find((item) => item.id === profile.frameId);

  // getProfile читает сторы на момент открытия, поэтому держим свежие
  // значения в ref. Обновляем его эффектом без зависимостей (после каждого
  // рендера), а не в теле рендера — правило react-hooks/refs запрещает
  // обращаться к ref во время рендера, а перенос в зависимости пересоздавал бы
  // меню на каждый тик
  const dataRef = useRef({ account, profile, info, progress, watched });
  useEffect(() => {
    dataRef.current = { account, profile, info, progress, watched };
  });

  // Автосбор из настроек ежедневного входа: если тумблер включён, награда
  // зачисляется при загрузке страницы, а не только когда окно открыли.
  useEffect(() => {
    if (!account) return;
    autoCollectIfNeeded(isPremiumActive(account));
  }, [account]);

  useEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    // Локальная ссылка: внутри замыкания account уже не сужается
    const me = account;
    if (!me) return;
    const PM = window.ProfileMenu;
    if (!PM) return;

    // Всё, что меняется со временем, читаем из dataRef внутри колбэков:
    // так эффект зависит только от факта аккаунта и не пересоздаёт меню
    menuRef.current = PM.init({
      trigger,
      note: "Аккаунт и прогресс сохраняются на сервере AniGalaxy.",
      // Ежедневный вход: окно рисует React-компонент, меню только состояние
      daily: { view: dailyView, streak: profile.streak },
      onDaily: () => setDailyOpen(true),
      getProfile: () => {
        const { account, profile, info, progress, watched } = dataRef.current;
        return {
          name: account?.nickname ?? "Гость",
          email: account?.email ?? "",
          premium: account ? isPremiumActive(account) : false,
          letter: (account?.nickname.trim().charAt(0) ?? "Г").toUpperCase(),
          avatarUrl: profile.avatar || undefined,
          level: info.level,
          xp: progress.progress.xpTotal,
          xpToNext: info.left,
          xpPercent: info.percent,
          era: info.era,
          minutes: watched.minutes,
          anime: watched.titles,
          coins: progress.progress.acBalance,
        };
      },
      // Значки на пунктах считаем здесь: квесты меняются часто,
      // а getProfile вызывается только при открытии
      items: [
        ...PM.DEFAULT_ITEMS,
        ...(isAdmin ? [{ id: "admin", label: "Админ-панель", icon: "shield", group: "Ещё" }] : []),
      ].map((item: ProfileMenuItem) => {
        const { progress } = dataRef.current;
        return {
          ...item,
          href: NAV[item.id],
          badge: item.id === "quests" ? readyQuestCount(progress) : undefined,
        };
      }),
      onSelect: (id: string) => {
        // «Выйти» обрабатывает сам компонент, сюда не приходит
        const href = NAV[id];
        if (href) router.push(href);
        onAfterSelect?.();
      },
      onLogout: () => clearAccount(),
      // Эффект аватара — отдельная от рамки косметики вещь: компонент сам
      // пишет его в pm_effect, а проект хранит рамку в profile.frameId.
      // Дублирования нет — это разные слои одного аватара.
      onEffectChange: () => {},
    });

    return () => {
      menuRef.current?.destroy();
      menuRef.current = null;
    };
    // Сторы читаются внутри колбэков через dataRef, поэтому в зависимостях
    // только сам факт аккаунта
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, isAdmin]);

  if (!account) {
    return (
      <button type="button" onClick={() => openAuthDialog("login")} className="btn-login">
        Войти
      </button>
    );
  }

  return (
    <>
      {dailyOpen ? (
        <DailyLoginModal
          open
          premium={isPremiumActive(account)}
          onClose={() => setDailyOpen(false)}
        />
      ) : null}
      <button
      ref={triggerRef}
      type="button"
      aria-haspopup="menu"
      aria-label={`Меню аккаунта: ${account.nickname}, уровень ${info.level}`}
      className="btn-ghost flex h-9 items-center gap-2 rounded-full bg-white/8 pl-1 pr-2 ring-1 ring-white/12 transition hover:bg-white/14 hover:ring-accent/45"
    >
      {/* data-pm-av — за него цепляет эффекты ProfileMenu; рамка косметики
          остаётся как была, компонент её не перерисовывает */}
      <AvatarFrame
  nickname={account.nickname}
  avatar={profile.avatar || undefined}
  frame={frame}
  size="xs"
/>
      <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[10px] font-black text-white">
        {info.level}
      </span>
      <span className="hidden max-w-28 truncate text-xs font-bold text-white sm:block">
        {account.nickname}
      </span>
      <svg
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5 text-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
      </svg>
    </button>
    </>
  );
}

/**
 * Плашка PREMIUM в шапке — через `ProfileMenu.premiumButton`, как просил ТЗ.
 *
 * Компонент создаёт кнопку сам и кладёт её в переданный контейнер; здесь
 * это просто `<span>`. Снимаем старую кнопку при размонтировании и при
 * смене статуса подписки — иначе `pm-pbtn-on` останется от прошлого значения.
 */
export function ProfileMenuPremium() {
  const account = useAccount();
  const premium = account ? isPremiumActive(account) : false;
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const PM = window.ProfileMenu;
    const box = ref.current;
    if (!PM || !box) return;
    box.innerHTML = "";
    const el = PM.premiumButton({ container: box, href: "/premium", label: "Premium", premium });
    return () => {
      el?.remove();
    };
  }, [premium]);

  return <span ref={ref} aria-label="Premium-подписка" />;
}
