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
const I_GRID = svg(
  <>
    <rect className="f" x="4" y="4" width="6.5" height="6.5" rx="2" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="2" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="2" />
    <rect className="f" x="13.5" y="13.5" width="6.5" height="6.5" rx="2" />
  </>,
);
const I_HEART = svg(<path className="f" d="M12 19.6c-.3 0-.6-.1-.8-.3C7.6 16.6 4 13.5 4 9.9 4 7.7 5.7 6 7.8 6c1.6 0 3.2.9 4.2 2.4C13 6.9 14.600 6 16.200 6 18.300 6 20 7.700 20 9.900c0 3.600-3.600 6.700-7.200 9.400-.2.200-.5.300-.8.300z" />);
const I_DICE = svg(
  <>
    <rect className="f" x="4" y="4" width="16" height="16" rx="4.5" />
    <path strokeWidth="2.6" d="M8.800 8.800h.01M15.200 8.800h.01M12 12h.01M8.800 15.200h.01M15.200 15.200h.01" />
  </>,
);

interface Tile {
  label: string;
  hint: string;
  href: string;
  icon: IconName;
}

/**
 * Разделы меню сгруппированы по смыслу: двенадцать одинаковых плиток
 * подряд читались как список без начала и конца. Заголовок группы задаёт
 * и порядок чтения, и оттенок иконок (`data-g` в разметке).
 */
interface Group {
  title: string;
  tiles: Tile[];
}

const GROUPS: Group[] = [
  {
    title: "Смотреть",
    tiles: [
      { label: "AniSwipe", hint: "Свайп-подбор", href: "/aniswipe", icon: "spark" },
      { label: "Расписание", hint: "Выходы серий", href: "/schedule", icon: "cal" },
      { label: "Манга", hint: "Читалка", href: "/manga", icon: "book" },
      { label: "Вместе", hint: "Совместный просмотр", href: "/watch-together", icon: "together" },
    ],
  },
  {
    title: "Прогресс",
    tiles: [
      { label: "Боевой пропуск", hint: "Награды сезона", href: "/battlepass", icon: "pass" },
      { label: "Квесты", hint: "Задания дня", href: "/quests", icon: "target" },
      { label: "События", hint: "Ивенты", href: "/events", icon: "flame" },
      { label: "Магазин", hint: "Рамки и эффекты", href: "/store", icon: "store" },
    ],
  },
  {
    title: "Сообщество",
    tiles: [
      { label: "Кланы", hint: "Играйте вместе", href: "/clans", icon: "users" },
      { label: "Рейтинг", hint: "Лидеры сайта", href: "/leaderboard", icon: "trophy" },
      { label: "Подборки", hint: "Коллекции", href: "/collections", icon: "layers" },
      { label: "Карта", hint: "Маршруты и награды", href: "/map", icon: "compass" },
    ],
  },
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
          {GROUPS.map((g, gi) => (
            <section key={g.title} className="mnv-sec" data-g={gi + 1}>
              <h3 className="mnv-sh">{g.title}</h3>
              <div className="mnv-grid">
                {g.tiles.map((t, i) => (
                  <Link
                    key={t.href}
                    href={t.href}
                    tabIndex={open ? 0 : -1}
                    className={`mnv-tile${on(t.href) ? " cur" : ""}`}
                    style={{ "--i": gi * 4 + i } as React.CSSProperties}
                  >
                    <span className="mnv-ti"><Icon name={t.icon} /></span>
                    <span className="mnv-tt">
                      <b>{t.label}</b>
                      <small>{t.hint}</small>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
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
          <span className="mnv-orb">{open ? svg(<path d="M6 6l12 12M18 6L6 18" />) : svg(<path d="M5 8h14M5 16h9" />)}</span>
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
