import Link from "next/link";

import { AdminFooterLink } from "./AdminFooterLink";
import type { FeatureKey } from "@/lib/features";
import { Logo } from "./Logo";

const GENRES = [
  "Фэнтези",
  "Экшен",
  "Романтика",
  "Комедия",
  "Драма",
  "Приключения",
  "Фантастика",
  "Детектив",
];

const NAV = [
  { href: "/", label: "Главная" },
  { href: "/catalog", label: "Каталог аниме" },
  { href: "/catalog?status=ongoing", label: "Онгоинги" },
  { href: "/manga", label: "Каталог манги", feature: "manga" as const },
  { href: "/clans", label: "Кланы", feature: "clans" as const },
  { href: "/releases", label: "Календарь релизов", feature: "releases" as const },
  { href: "/catalog?sort=rating", label: "Топ рейтинга" },
  { href: "/catalog?type=movie", label: "Аниме-фильмы" },
  { href: "/premium", label: "Premium-подписка", feature: "premium" as const },
];

export function Footer({ features }: { features?: Partial<Record<FeatureKey, boolean>> }) {
  return (
    <footer className="relative z-[1] mt-20 border-t border-line bg-ink-soft/80">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          {/* Бренд */}
          <div>
            <Logo />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
              Твой проводник в мире аниме: свежие релизы, онгоинги и классика. Удобный выбор серий
              и озвучек, быстрый поиск и фильтры — на любом устройстве.
            </p>
            <div className="mt-5 flex items-center gap-2 text-xs text-muted/80">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-mint/12 px-2.5 py-1.5 text-mint ring-1 ring-mint/25">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint" />
                Онлайн
              </span>
              <span className="rounded-lg bg-white/6 px-2.5 py-1.5 ring-1 ring-white/10">
                HD-качество
              </span>
            </div>
          </div>

          {/* Навигация */}
          <div>
            <h3 className="mb-4 text-sm font-extrabold uppercase tracking-wider text-white/90">
              Навигация
            </h3>
            <ul className="space-y-2.5">
              {NAV.filter((item) => !item.feature || features?.[item.feature] !== false).map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="btn-ghost text-sm text-muted hover:text-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Жанры */}
          <div>
            <h3 className="mb-4 text-sm font-extrabold uppercase tracking-wider text-white/90">
              Популярные жанры
            </h3>
            <div className="flex flex-wrap gap-2">
              {GENRES.map((g) => (
                <Link
                  key={g}
                  href={`/catalog?genre=${encodeURIComponent(g)}`}
                  className="btn-ghost rounded-lg bg-white/6 px-3 py-1.5 text-xs font-semibold text-muted ring-1 ring-white/10 hover:bg-accent/15 hover:text-white hover:ring-accent/40"
                >
                  {g}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-line pt-6 text-xs text-muted/85 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p>© {new Date().getFullYear()} AniGalaxy. Все права на контент принадлежат правообладателям.</p>
            <p>Видео предоставляется сторонними сервисами хранения.</p>
          </div>
          {/* Ссылка рендерится только для тех, у кого есть серверная сессия
              с правом `panel`. Неавторизованным — пусто. */}
          <AdminFooterLink />
        </div>
      </div>
    </footer>
  );
}
