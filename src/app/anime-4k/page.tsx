import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { AnimeCard } from "@/components/AnimeCard";
import { catalog } from "@/lib/kodik";
import type { AnimeCard as Card } from "@/lib/types";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  title: "Аниме в 4K смотреть онлайн",
  description:
    "Смотрите аниме онлайн с апскейлом до 4K: плеер AniGalaxy растягивает 1080p до 2160p шейдерами Anime4K в реальном времени. Лучшие тайтлы, русская озвучка, без регистрации.",
  alternates: { canonical: "/anime-4k" },
  openGraph: {
    title: "Аниме в 4K смотреть онлайн · AniGalaxy",
    description: "Апскейл Anime4K до 4K прямо в плеере: чёткие линии, свежие цвета, русская озвучка.",
    type: "website",
  },
};

// Список тайтлов берём у внешнего каталога: страницу строим при запросе, а не при сборке
export const dynamic = "force-dynamic";

const FAQ: { q: string; a: string }[] = [
  {
    q: "Это настоящее 4K?",
    a: "Источники аниме отдают видео в 1080p и ниже. В плеере AniGalaxy включается апскейл Anime4K: нейросетевые шейдеры в реальном времени растягивают кадр до 2160p и убирают «мыло» на линиях и градиентах. Это не исходное 4K-видео, а улучшение картинки на вашем экране.",
  },
  {
    q: "Как включить 4K?",
    a: "Откройте любой тайтл, в блоке «Источник» выберите «AniGalaxy», затем в настройках плеера (шестерёнка) укажите качество «4K». Для тайтлов с потоком 1080p эффект заметнее всего.",
  },
  {
    q: "Что нужно для 4K-апскейла?",
    a: "Современный браузер с WebGL (Chrome, Edge, Firefox, Safari) и видеокарта среднего уровня. Апскейл нагружает GPU, поэтому на слабых устройствах и телефонах лучше оставить «Авто» или 1080p.",
  },
  {
    q: "Нужна ли подписка?",
    a: "Нет. Апскейл до 2K и 4K открыт всем, регистрация не требуется. Premium убирает рекламу и добавляет косметику профиля.",
  },
  {
    q: "Какие озвучки доступны?",
    a: "Для большинства тайтлов есть русская озвучка и субтитры от разных студий. Любимую студию можно отметить звёздочкой: она будет включаться автоматически.",
  },
];

export default async function Anime4kPage() {
  let cards: Card[] = [];
  try {
    cards = (await catalog({ sort: "rating" })).cards.filter((c) => c.poster).slice(0, 24);
  } catch {
    cards = [];
  }

  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Аниме в 4K смотреть онлайн",
      url: `${SITE}/anime-4k`,
      inLanguage: "ru",
      mainEntity: {
        "@type": "ItemList",
        itemListElement: cards.map((c, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE}/title/${c.id}`, name: c.title })),
      },
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs items={[{ label: "Аниме в 4K" }]} />

      <header className="mb-8 max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Аниме в 4K</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-white/75">
          Плеер AniGalaxy повышает картинку до 4K прямо в браузере: шейдеры Anime4K дорисовывают чёткие контуры и сглаживают
          градиенты, поэтому даже 1080p выглядит заметно резче на большом мониторе и телевизоре. Выберите тайтл ниже, откройте
          источник «AniGalaxy» и поставьте качество «4K». Регистрация и подписка не нужны.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-white/80">
          <span className="rounded-full bg-white/8 px-3 py-1.5 ring-1 ring-white/10">Апскейл Anime4K</span>
          <span className="rounded-full bg-white/8 px-3 py-1.5 ring-1 ring-white/10">Русская озвучка</span>
          <span className="rounded-full bg-white/8 px-3 py-1.5 ring-1 ring-white/10">Бесплатно</span>
        </div>
      </header>

      <section aria-labelledby="best4k">
        <h2 id="best4k" className="mb-4 text-xl font-extrabold">
          Что посмотреть в 4K
        </h2>
        {cards.length ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {cards.map((card) => (
              <div key={card.id} className="relative">
                <AnimeCard card={card} />
                <span className="pointer-events-none absolute bottom-[3.6rem] right-2 rounded-md bg-gradient-to-r from-sky-500 to-violet-500 px-1.5 py-0.5 text-[10px] font-black text-white shadow-lg">
                  до 4K
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-white/60">
            Каталог временно недоступен — попробуйте позже или откройте <Link href="/catalog" className="underline">весь каталог</Link>.
          </p>
        )}
        <p className="mt-5 text-sm">
          <Link href="/catalog?sort=rating" className="font-bold text-accent hover:underline">
            Весь каталог по рейтингу
          </Link>
        </p>
      </section>

      <section className="mt-12 max-w-3xl" aria-labelledby="faq4k">
        <h2 id="faq4k" className="mb-4 text-xl font-extrabold">
          Вопросы и ответы
        </h2>
        <div className="space-y-3">
          {FAQ.map((f) => (
            <details key={f.q} className="group rounded-2xl bg-white/5 px-5 py-4 ring-1 ring-white/10">
              <summary className="cursor-pointer list-none text-[15px] font-bold">{f.q}</summary>
              <p className="mt-2 text-sm leading-relaxed text-white/70">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {ld.map((item, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(item).replace(/</g, "\\u003c") }} />
      ))}
    </div>
  );
}
