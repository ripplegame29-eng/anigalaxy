"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon, type IconName } from "./icons";

/**
 * Мобильная навигация: плавающая нижняя панель (Главная, Каталог, Меню,
 * Избранное, Рандом) и полноэкранное меню-«шторка» со всеми разделами.
 * Показывается только на экранах ≤900px (см. mobile-nav.css).
 */

const svg = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {d}
  </svg>
);

const I_HOME = svg(<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />);
const I_GRID = svg(<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />);
const I_HEART = svg(<path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.4-7 10-7 10z" />);
const I_DICE = svg(
  <>
    <rect x="4" y="4" width="16" height="16" rx="4" />
    <path d="M9 9h.01M15 9h.01M12 12h.01M9 15h.01M15 15h.01" />
  </>,
);

interface Tile {
  label: string;
  hint: string;
  href: string;
  icon: IconName;
}

const TILES: Tile[] = [
  { label: "AniSwipe", hint: "Свайп-подбор", href: "/aniswipe", icon: "spark" },
  { label: "Расписание", hint: "Выходы серий", href: "/schedule", icon: "cal" },
  { label: "Манга", hint: "Читалка", href: "/manga", icon: "book" },
  { label: "Вместе", hint: "Совместный просмотр", href: "/watch-together", icon: "together" },
  { label: "Подборки", hint: "Коллекции", href: "/collections", icon: "layers" },
  { label: "Рейтинг", hint: "Лидеры сайта", href: "/leaderboard", icon: "trophy" },
  { label: "Боевой пропуск", hint: "Награды сезона", href: "/battlepass", icon: "pass" },
  { label: "Карта", hint: "Маршруты и награды", href: "/map", icon: "compass" },
  { label: "Квесты", hint: "Задания дня", href: "/quests", icon: "target" },
  { label: "События", hint: "Ивенты", href: "/events", icon: "flame" },
  { label: "Кланы", hint: "Играйте вместе", href: "/clans", icon: "users" },
  { label: "Магазин", hint: "Рамки и эффекты", href: "/store", icon: "store" },
];

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
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
      router.push(`/title/${pick.id}`);
    } catch {
      router.push("/aniswipe");
    } finally {
      setBusy(false);
    }
  }, [busy, router]);

  const on = (p: string) => (p === "/" ? pathname === "/" : pathname.startsWith(p));

  return (
    <>
      <div className={`mnv-sheet${open ? " on" : ""}`} aria-hidden={!open} onClick={() => setOpen(false)}>
        <div className="mnv-panel" role="dialog" aria-label="Меню" onClick={(e) => e.stopPropagation()}>
          <span className="mnv-grab" />
          <div className="mnv-top">
            <b>Меню</b>
            <button type="button" className="mnv-x" aria-label="Закрыть" onClick={() => setOpen(false)}>
              {svg(<path d="M6 6l12 12M18 6L6 18" />)}
            </button>
          </div>
          <Link className="mnv-prem" href="/premium" tabIndex={open ? 0 : -1}>
            <span className="mnv-pi"><Icon name="crown" /></span>
            <span className="mnv-pt">
              <b>Premium</b>
              <small>Без рекламы, эффекты и бонусы</small>
            </span>
            <span className="mnv-go"><Icon name="arrow" /></span>
          </Link>
          <div className="mnv-grid">
            {TILES.map((t, i) => (
              <Link
                key={t.href}
                href={t.href}
                tabIndex={open ? 0 : -1}
                className={`mnv-tile${on(t.href) ? " cur" : ""}`}
                style={{ "--i": i } as React.CSSProperties}
              >
                <span className="mnv-ti"><Icon name={t.icon} /></span>
                <b>{t.label}</b>
                <small>{t.hint}</small>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <nav className="mnv-bar" aria-label="Основная навигация">
        <Link href="/" className={`mnv-i${pathname === "/" ? " cur" : ""}`}>
          {I_HOME}
          <span>Главная</span>
        </Link>
        <Link href="/catalog" className={`mnv-i${on("/catalog") ? " cur" : ""}`}>
          {I_GRID}
          <span>Каталог</span>
        </Link>
        <button type="button" className={`mnv-i mnv-c${open ? " cur" : ""}`} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <span className="mnv-orb">{open ? svg(<path d="M6 6l12 12M18 6L6 18" />) : svg(<path d="M4 8h16M4 16h16" />)}</span>
          <span>Меню</span>
        </button>
        <Link href="/list" className={`mnv-i${on("/list") ? " cur" : ""}`}>
          {I_HEART}
          <span>Избранное</span>
        </Link>
        <button type="button" className={`mnv-i${busy ? " busy" : ""}`} onClick={random}>
          {I_DICE}
          <span>Рандом</span>
        </button>
      </nav>
    </>
  );
}
