import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { AnimeGrid } from "@/components/AnimeRow";
import { Reveal } from "@/components/Reveal";
import { mangaByGenre, mangaGenres, mangaRow } from "@/lib/senku";
import type { AnimeCard } from "@/lib/types";
import "../../manga/manga-catalog.css";

export const metadata: Metadata = {
  title: "Подборки манги",
  description: "Подборки манги, манхвы и маньхуа с русским переводом: лучшее по оценке, новинки и жанровые списки.",
};

// Источник манги отвечает медленно: не собираем страницу на этапе сборки, данные кэшируются при запросе
export const dynamic = "force-dynamic";

const GENRE_BLURB: Record<string, string> = {
  боевик: "Схватки, турниры и герои, которых не остановить.",
  драма: "Истории, после которых хочется помолчать.",
  комедия: "Когда нужно просто посмеяться.",
  фэнтези: "Магия, королевства и другие миры.",
  романтика: "Чувства, которые меняют всё.",
  приключения: "Дорога, друзья и неизвестность впереди.",
  психология: "Игры разума и тонкая грань между людьми.",
  школа: "Классы, клубы и первые серьёзные решения.",
  сёнэн: "Рост, дружба и сражения за мечту.",
  исэкай: "Новая жизнь в другом мире.",
};

interface Section {
  id: string;
  title: string;
  desc: string;
  cards: AnimeCard[];
  href?: string;
}

export default async function MangaCollectionsPage() {
  const [best, hot, genres] = await Promise.all([
    mangaRow("best", 12).catch(() => [] as AnimeCard[]),
    mangaRow("hot", 12).catch(() => [] as AnimeCard[]),
    mangaGenres().catch(() => [] as { name: string; count: number }[]),
  ]);
  const top = genres.filter((g) => g.count >= 3).slice(0, 6);
  const byGenre = await Promise.all(top.map((g) => mangaByGenre(g.name, 10).catch(() => [] as AnimeCard[])));

  const sections: Section[] = [
    { id: "best", title: "Лучшее по оценке читателей", desc: "Тайтлы, которые чаще всего ставят на первое место.", cards: best, href: "/manga?sort=best" },
    { id: "hot", title: "Сейчас читают", desc: "Самое популярное в каталоге прямо сейчас.", cards: hot, href: "/manga?sort=hot" },
    ...top.map((g, i) => ({
      id: `g-${g.name}`,
      title: `Манга: ${g.name}`,
      desc: GENRE_BLURB[g.name.toLowerCase()] ?? `Лучшие тайтлы жанра «${g.name}».`,
      cards: byGenre[i],
      href: `/manga?genre=${encodeURIComponent(g.name)}&sort=best`,
    })),
  ].filter((s) => s.cards.length > 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs items={[{ label: "Подборки", href: "/collections" }, { label: "Манга" }]} />

      <div className="mg-filters mb-8" style={{ gap: 6 }}>
        <div className="mg-row">
          <Link href="/collections">Подборки аниме</Link>
          <Link href="/collections/manga" className="on" aria-current="page">
            Подборки манги
          </Link>
        </div>
      </div>

      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Подборки манги</h1>
      <p className="mt-1.5 text-sm text-muted">
        Собраны автоматически из каталога с русским переводом. Свои подборки можно создать на странице любой манги — кнопка «Подборки».
      </p>

      {sections.length === 0 ? (
        <p className="mt-8 rounded-2xl bg-white/4 px-4 py-10 text-center text-sm text-muted ring-1 ring-white/10">
          Каталог временно недоступен — обнови страницу через минуту.
        </p>
      ) : (
        sections.map((section) => (
          <Reveal key={section.id} className="mt-10">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold tracking-tight sm:text-xl">{section.title}</h2>
                <p className="mt-1 text-sm text-muted">{section.desc}</p>
              </div>
              {section.href && (
                <Link href={section.href} className="text-sm font-bold text-accent-2 hover:text-white">
                  Смотреть все
                </Link>
              )}
            </div>
            <AnimeGrid cards={section.cards} />
          </Reveal>
        ))
      )}
    </div>
  );
}
