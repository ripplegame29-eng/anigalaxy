"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { openBonusDialog } from "@/lib/bonus-dialog";
import { ProfileMenu, ProfileMenuPremium } from "./ProfileMenu";
import { MenuItem, useAccountItems } from "./AccountMenu";
import { useAccount } from "@/lib/use-account";
import { HeaderIconButton } from "./HeaderIconButton";
import { Logo } from "./Logo";
import { ProfileDialogHost } from "./profile/ProfileDialogHostLazy";
import { SearchBox } from "./SearchBox";

interface NavItem {
  href: string;
  label: string;
}

const NAV: NavItem[] = [
  { href: "/", label: "Главная" },
  { href: "/catalog", label: "Каталог" },
  { href: "/aniswipe", label: "AniSwipe" },
  { href: "/manga", label: "Манга" },
];

/**
 * Плашка PREMIUM в шапке рисует ProfileMenu.premiumButton (см.
 * components/ProfileMenu.tsx) — так она выглядит и ведёт себя как меню
 * профиля, а не как отдельная кнопка.
 */

/** Иконка щита со звездой — кнопка «Боевой пропуск» */
function ShieldIcon({ className = "h-[18px] w-[18px]" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 21.5s7-3.4 7-9V5.4L12 2.5 5 5.4V12.5c0 5.6 7 9 7 9Z" />
      <path d="m12 9.2.95 1.93 2.13.31-1.54 1.5.36 2.12L12 14.1l-1.9 1 .36-2.12-1.54-1.5 2.13-.31Z" />
    </svg>
  );
}

/** Иконка «два человека» — кнопка «Совместный просмотр» */
function TogetherIcon({ className = "h-[18px] w-[18px]" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

/** Иконка подарка — кнопка «Ежедневный бонус» */
function GiftIcon({ className = "h-[18px] w-[18px]" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 12v10H4V12" />
      <rect x="2" y="7" width="20" height="5" rx="1" />
      <path d="M12 22V7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7Z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7Z" />
    </svg>
  );
}

/**
 * Зафиксированная шапка поверх hero-слайдера: полупрозрачное стекло с
 * backdrop-blur, логотип, навигация, живой поиск, кнопки PREMIUM / Войти
 * и мобильное меню.
 *
 * Пока пользователь вверху страницы — фон почти прозрачный (видео слайдера
 * видно сквозь стекло), после прокрутки стекло уплотняется.
 */
export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(pathname);

  // Тень/подложка появляются после прокрутки
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Следим за текущим URL, чтобы подсветить активный пункт меню
  useEffect(() => {
    const sync = () => setCurrentUrl(pathname + window.location.search);
    sync();
    window.addEventListener("pushstate", sync);
    window.addEventListener("popstate", sync);
    const t = setTimeout(sync, 0);
    return () => {
      window.removeEventListener("pushstate", sync);
      window.removeEventListener("popstate", sync);
      clearTimeout(t);
    };
  }, [pathname]);

  // Закрываем мобильное меню и поиск при переходе. Корректируем состояние
  // прямо во время рендера (рецепт react.dev «You Might Not Need an Effect»):
  // так нет лишнего цикла рендера, который даёт setState внутри useEffect
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setMenuOpen(false);
    setSearchOpen(false);
  }

  const isActive = (href: string) =>
    currentUrl === href || (currentUrl.split("?")[0] === href && !href.includes("?"));

  /** Шторка закрывается по Escape и не крутит страницу под собой */
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const hasAccount = Boolean(useAccount());
  const accountItems = useAccountItems(closeMenu);

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled || menuOpen
          ? "glass border-b border-line shadow-[0_16px_40px_-30px_rgba(0,0,0,1)]"
          : "border-b border-white/8 bg-ink/35 backdrop-blur-xl backdrop-saturate-150"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Logo />

        {/* Десктопная навигация */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Основная навигация">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={`btn-ghost rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                isActive(item.href)
                  ? "bg-white/10 text-white"
                  : "text-muted hover:bg-white/6 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Поиск (desktop) */}
        <div className="ml-auto hidden flex-1 justify-end md:flex">
          <SearchBox />
        </div>

        {/* PREMIUM + Войти (desktop) */}
        <div className="ml-auto hidden items-center gap-2.5 md:ml-0 md:flex">
          {/* Быстрые действия: иконки без текста, при наведении (и при фокусе
              с клавиатуры) — маленькое окошко с описанием. Начиная с lg,
              чтобы на md не сжимать поиск до нуля */}
          <div className="hidden items-center gap-2 lg:flex">
            <HeaderIconButton
              href="/battlepass"
              label="Боевой пропуск"
              hint="Сезонные награды, задания и уровни"
              ariaLabel="Боевой пропуск"
            >
              <ShieldIcon />
            </HeaderIconButton>

            <HeaderIconButton
              href="/watch-together"
              label="Совместный просмотр"
              hint="Смотрите аниме вместе с друзьями в реальном времени"
              ariaLabel="Совместный просмотр"
            >
              <TogetherIcon />
            </HeaderIconButton>

            <HeaderIconButton
              label="Ежедневный бонус"
              hint="Колесо фортуны — 3 бесплатных крутки"
              ariaLabel="Ежедневный бонус"
              onClick={openBonusDialog}
            >
              <GiftIcon />
            </HeaderIconButton>
          </div>

          {/* Плашка PREMIUM — из того же компонента, что и меню профиля */}
          <ProfileMenuPremium />
          <ProfileMenu />
        </div>

        {/* Поиск (mobile) */}
        <button
          type="button"
          onClick={() => setSearchOpen((v) => !v)}
          aria-label="Открыть поиск"
          aria-expanded={searchOpen}
          className="btn-ghost ml-auto grid h-10 w-10 place-items-center rounded-xl bg-white/6 text-white/80 ring-1 ring-white/10 hover:bg-white/12 md:hidden"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.2-3.2" strokeLinecap="round" />
          </svg>
        </button>

        {/* Бургер */}
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Меню"
          aria-expanded={menuOpen}
          className="btn-ghost grid h-10 w-10 place-items-center rounded-xl bg-white/6 text-white/80 ring-1 ring-white/10 hover:bg-white/12 md:hidden"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            {menuOpen ? (
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {/* Модалки профиля (фон, титул, внешний вид, настройки) */}
      <ProfileDialogHost />

      {/* Мобильный поиск */}
      {searchOpen && (
        <div className="border-t border-line px-4 py-3 md:hidden animate-fade-in">
          <SearchBox mobile />
        </div>
      )}

      {/*
        Мобильная шторка.

        Раньше бургер открывал плоский список разделов сайта, и с телефона
        было не добраться до «Мой профиль», «Магазина» и «Квестов» — они
        жили только в дропдауне шапки, который на узком экране не помещался.
        Теперь это боковая панель: разделы сайта, затем разделы аккаунта,
        а неавторизованному — кнопка «Войти».
      */}
      {menuOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          {/* Затемнение: страница под шторкой остаётся читаемой, но уходит
              на второй план, как в референсных мобильных меню */}
          <button
            type="button"
            aria-label="Закрыть меню"
            onClick={closeMenu}
            className="absolute inset-0 h-full w-full cursor-default bg-black/55 backdrop-blur-[2px] animate-fade-in"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Меню"
            className="absolute inset-y-0 right-0 flex w-[min(84vw,21.5rem)] animate-drawer flex-col overflow-hidden border-l border-line bg-[#08080c]/98 shadow-[-24px_0_60px_-20px_rgba(0,0,0,1)]"
          >
            {/* Шапка шторки: логотип и крестик */}
            <div className="flex h-16 shrink-0 items-center justify-between gap-3 px-4">
              <Logo />
              <button
                type="button"
                onClick={closeMenu}
                aria-label="Закрыть"
                className="btn-ghost grid h-10 w-10 place-items-center rounded-xl bg-white/6 text-white/80 ring-1 ring-white/10 hover:bg-white/12"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Скролл: список длинный, а экран телефонный */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-6">
{/* То же меню профиля, что в шапке: на мобильном дропдаун в шапке не
                помещается, поэтому он живёт в шторке. После выбора пункта
                шторку закрываем — иначе она остаётся поверх перехода */}
              <div className="px-4">
                <ProfileMenu onAfterSelect={closeMenu} />
              </div>

              {/* Разделы сайта */}
              <p className="mb-1.5 mt-5 px-5 text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
                Разделы
              </p>
              <nav className="grid gap-0.5 px-2" aria-label="Разделы сайта">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMenu}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                      isActive(item.href)
                        ? "bg-accent/15 text-white ring-1 ring-accent/30"
                        : "text-[#c6c6cb] hover:bg-white/6 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
                {/* Кланы — раздел первого класса, но в шапке его нет:
                    кнопка живёт рядом с чатом. В меню он нужен, иначе
                    с телефона до него не дойти */}
                <Link
                  href="/clans"
                  onClick={closeMenu}
                  aria-current={isActive("/clans") ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                    isActive("/clans")
                      ? "bg-accent/15 text-white ring-1 ring-accent/30"
                      : "text-[#c6c6cb] hover:bg-white/6 hover:text-white"
                  }`}
                >
                  Кланы
                </Link>
                <Link
                  href="/battlepass"
                  onClick={closeMenu}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#c6c6cb] transition-colors hover:bg-white/6 hover:text-white"
                >
                  Боевой пропуск
                </Link>
                <Link
                  href="/watch-together"
                  onClick={closeMenu}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#c6c6cb] transition-colors hover:bg-white/6 hover:text-white"
                >
                  Смотреть вместе
                </Link>
              </nav>

              {/* Разделы аккаунта — только авторизованному. Гостю они
                  были видны, хотя заканчивались редиректом на вход: список
                  обещал разделы, которых у него нет */}
              {hasAccount && (
                <>
                  <p className="mb-1.5 mt-5 px-5 text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
                    Сообщество
                  </p>
                  <nav className="grid gap-0.5 px-2" aria-label="Разделы аккаунта">
                    {accountItems.map((item) => (
                      <MenuItem key={item.label} item={item} onSelect={closeMenu} />
                    ))}
                  </nav>
                </>
              )}
            </div>

            {/* Подвал шторки. Ссылок на юридические документы у проекта нет,
                а выдуманные страницы в меню — это тупики, поэтому здесь только
                та же строка, что в футере сайта */}
            <div className="shrink-0 border-t border-line px-5 py-3">
              <p className="text-[11px] leading-relaxed text-muted">
                © 2026 AniGalaxy. Все права на контент принадлежат правообладателям.
              </p>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
