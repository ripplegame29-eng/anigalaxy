"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon, type IconName } from "./icons";
import "./mobile-dock.css";
import { AccountCard } from "@/components/AccountMenu";
import { useAccount } from "@/lib/use-account";
import { clearAccount } from "@/lib/auth";

/**
 * Мобильная навигация: плавающая нижняя панель (Главная, Каталог, Меню,
 * Избранное, Рандом) и полноэкранное меню-«шторка» со всеми разделами.
 * Показывается только на экранах ≤900px (см. mobile-nav.css).
 */

const svg = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {d}
  </svg>
);

const I_HOME = svg(
  <>
    <path className="f" d="M4.5 10.6 12 4l7.5 6.6V18a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2z" />
    <path d="M9.5 20v-5.2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V20" />
  </>,
);

const I_COMPASS = svg(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path className="f" d="m15.4 8.6-2 4.8-4.8 2 2-4.8z" />
  </>,
);
const I_BOOKMARK = svg(<path className="f" d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z" />);
const I_BELL = svg(<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15zM10 21h4" />);
const I_MORE = svg(<path d="M4.5 7h15M4.5 12h15M4.5 17h15" />);

interface Row {
  label: string;
  href: string;
  icon: IconName;
}

/** Разделы боковой панели «Ещё» — списком строк, как в приложении */
const SECTIONS: { title: string; rows: Row[] }[] = [
  {
    title: "Социальное",
    rows: [
      { label: "Мой профиль", href: "/profile", icon: "user" },
      { label: "Достижения", href: "/profile?tab=achievements", icon: "trophy" },
      { label: "Друзья и рефералы", href: "/referrals", icon: "users" },
      { label: "Кланы", href: "/clans", icon: "users" },
      { label: "Рейтинг", href: "/leaderboard", icon: "trophy" },
    ],
  },
  {
    title: "Контент",
    rows: [
      { label: "Каталог аниме", href: "/catalog", icon: "book" },
      { label: "Расписание", href: "/schedule", icon: "cal" },
      { label: "Манга", href: "/manga", icon: "book" },
      { label: "AniSwipe", href: "/aniswipe", icon: "spark" },
      { label: "Смотреть вместе", href: "/watch-together", icon: "together" },
      { label: "Подборки", href: "/collections", icon: "layers" },
      { label: "Карта", href: "/map", icon: "compass" },
    ],
  },
  {
    title: "Прогресс",
    rows: [
      { label: "Боевой пропуск", href: "/battlepass", icon: "pass" },
      { label: "Квесты", href: "/quests", icon: "target" },
      { label: "События", href: "/events", icon: "flame" },
      { label: "Магазин", href: "/store", icon: "store" },
    ],
  },
  {
    title: "Сайт",
    rows: [
      { label: "Обновления", href: "/updates", icon: "refresh" },
      { label: "Приложения", href: "/apps", icon: "tv" },
      { label: "Настройки", href: "/settings", icon: "gear" },
    ],
  },
];

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const account = useAccount();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [route, setRoute] = useState(pathname);

  if (route !== pathname) {
    setRoute(pathname);
    setOpen(false);
  }

  useEffect(() => {
    document.documentElement.classList.toggle("mnv-lock", open);
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("mnv-lock");
    };
  }, [open]);

  const random = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/kodik/top");
      const data = (await res.json()) as { cards?: { id: string | number }[] };
      const cards = data.cards ?? [];
      if (!cards.length) throw new Error("empty");
      const pick = cards[Math.floor(Math.random() * cards.length)];
      setOpen(false);
      router.push(`/title/${pick.id}`);
    } catch {
      router.push("/aniswipe");
    } finally {
      setBusy(false);
    }
  }, [busy, router]);

  const on = (p: string) => (p === "/" ? pathname === "/" : pathname.startsWith(p.split("?")[0]));

  return (
    <>
      <div className={`mdk-shade${open ? " on" : ""}`} aria-hidden={!open} onClick={() => setOpen(false)} />
      <aside className={`mdk-drawer${open ? " on" : ""}`} role="dialog" aria-label="Меню" aria-hidden={!open}>
        <div className="mdk-head">
          <h2>AniGalaxy</h2>
          <button type="button" className="mdk-x" aria-label="Закрыть меню" onClick={() => setOpen(false)}>
            {svg(<path d="M6 6l12 12M18 6L6 18" />)}
          </button>
        </div>
        <div className="mdk-scroll">
          <Link className="mdk-prem" href="/premium" tabIndex={open ? 0 : -1}>
            <b className="mdk-ic"><Icon name="crown" /></b>
            <span>
              <strong>Premium</strong>
              <small>Без рекламы, эффекты и бонусы</small>
            </span>
            <i aria-hidden>{svg(<path d="m9 6 6 6-6 6" />)}</i>
          </Link>
          <button type="button" className={`mdk-row${busy ? " busy" : ""}`} tabIndex={open ? 0 : -1} onClick={random}>
            <b className="mdk-ic"><Icon name="dice" /></b>
            <span>Случайное аниме</span>
            <i aria-hidden>{svg(<path d="m9 6 6 6-6 6" />)}</i>
          </button>
          {SECTIONS.map((sec, si) => (
            <section key={sec.title} data-g={si % 2 ? "b" : "a"}>
              <h3 className="mdk-sh">{sec.title}</h3>
              {sec.rows.map((r) => (
                <Link
                  key={r.href}
                  href={r.href}
                  tabIndex={open ? 0 : -1}
                  className={`mdk-row${on(r.href) ? " cur" : ""}`}
                >
                  <b className="mdk-ic"><Icon name={r.icon} /></b>
                  <span>{r.label}</span>
                  <i aria-hidden>{svg(<path d="m9 6 6 6-6 6" />)}</i>
                </Link>
              ))}
            </section>
          ))}
        </div>
        <div className="mdk-foot">
          <AccountCard onNavigate={() => setOpen(false)} />
          {account ? (
            <button
              type="button"
              className="mdk-out"
              onClick={() => {
                clearAccount();
                setOpen(false);
              }}
            >
              <Icon name="out" />
              Выйти
            </button>
          ) : null}
        </div>
      </aside>

      <nav className="mdk-bar" aria-label="Основная навигация">
        <Link href="/" className={`mdk-i${pathname === "/" ? " cur" : ""}`}>
          <b>{I_HOME}</b>
          <span>Главная</span>
        </Link>
        <Link href="/catalog" className={`mdk-i${on("/catalog") ? " cur" : ""}`}>
          <b>{I_COMPASS}</b>
          <span>Каталог</span>
        </Link>
        <Link href="/list" className={`mdk-i${on("/list") ? " cur" : ""}`}>
          <b>{I_BOOKMARK}</b>
          <span>Моё</span>
        </Link>
        {/* data-dd: окно уведомлений в шапке открывается её же делегированием */}
        <button type="button" className="mdk-i" data-dd="nt" aria-label="Уведомления">
          <b>{I_BELL}</b>
          <span>Увед.</span>
        </button>
        <button type="button" className={`mdk-i${open ? " cur" : ""}`} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <b>{I_MORE}</b>
          <span>Ещё</span>
        </button>
      </nav>
    </>
  );
}
