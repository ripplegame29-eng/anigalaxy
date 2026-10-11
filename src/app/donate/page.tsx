import type { Metadata } from "next";
import Image from "next/image";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { DonateCta } from "@/components/DonateCta";

export const metadata: Metadata = {
  title: "Поддержать проект",
  description:
    "Поддержи AniGalaxy и получи бонусы: 10 000 AniCoin, эксклюзивный глитч-эффект и тег «Донатер» навсегда. Акция лимитирована.",
  keywords: ["поддержать", "донат", "AniCoin", "тег донатер", "глитч-эффект"],
};

/* --------------------------- Искры и звёзды ---------------------------- */

/** Статичная позиция блёстки (без random — иначе рассинхрон гидратации) */
type SparkleSpot = { x: number; y: number; size: number; delay: number; dur?: number };

/** Блёстки вокруг кота (% от бокса) */
const CAT_SPARKLES: SparkleSpot[] = [
  { x: 4, y: 8, size: 14, delay: 0 },
  { x: 94, y: 5, size: 11, delay: 0.6 },
  { x: 101, y: 36, size: 15, delay: 1.2 },
  { x: -5, y: 42, size: 12, delay: 0.3 },
  { x: 90, y: 68, size: 10, delay: 1.8 },
  { x: 6, y: 76, size: 13, delay: 2.2 },
  { x: 44, y: -5, size: 10, delay: 1.5 },
  { x: 68, y: 99, size: 12, delay: 0.9 },
  { x: 28, y: 103, size: 9, delay: 2.6 },
  { x: 98, y: 86, size: 8, delay: 1.9 },
];

/** Восходящие искры под котом */
const CAT_RISE: SparkleSpot[] = [
  { x: 22, y: 60, size: 11, delay: 0, dur: 3.4 },
  { x: 76, y: 52, size: 9, delay: 1.4, dur: 4.0 },
  { x: 50, y: 82, size: 12, delay: 2.6, dur: 3.8 },
];

/** Редкие звёзды-искры на фоне всей страницы */
const PAGE_STARS: SparkleSpot[] = [
  { x: 6, y: 4, size: 9, delay: 0 },
  { x: 18, y: 13, size: 7, delay: 1.2 },
  { x: 88, y: 7, size: 10, delay: 0.6 },
  { x: 95, y: 21, size: 7, delay: 2.0 },
  { x: 4, y: 30, size: 8, delay: 1.6 },
  { x: 12, y: 52, size: 10, delay: 0.4 },
  { x: 91, y: 44, size: 8, delay: 2.4 },
  { x: 96, y: 63, size: 7, delay: 1.0 },
  { x: 7, y: 71, size: 9, delay: 2.8 },
  { x: 85, y: 79, size: 8, delay: 0.8 },
  { x: 15, y: 89, size: 7, delay: 1.8 },
  { x: 93, y: 93, size: 9, delay: 2.2 },
];

function SparkleField({ spots, variant = "ag-sparkle" }: { spots: SparkleSpot[]; variant?: string }) {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      {spots.map((spot, index) => (
        <span
          key={index}
          className={variant}
          style={{
            left: `${spot.x}%`,
            top: `${spot.y}%`,
            width: spot.size,
            height: spot.size,
            animationDelay: `${spot.delay}s`,
            ...(spot.dur ? { animationDuration: `${spot.dur}s` } : null),
          }}
        />
      ))}
    </span>
  );
}

/* --------------------------- Бонусы акции ------------------------------ */

const BONUSES = [
  {
    icon: "🪙",
    title: "10 000 AniCoin",
    text: "Зачислим на баланс сразу после поддержки — потратишь в магазине на теги, рамки и бонусы профиля.",
  },
  {
    icon: "✨",
    title: "Эксклюзивный глитч-эффект",
    text: "Редкое мерцание профиля, которое видят все в комментариях и списке участников. Выдаётся только в этой акции.",
  },
  {
    icon: "🏷️",
    title: "Тег «Донатер» навсегда",
    text: "Неоновый титул рядом с ником — не сгорает после акции и остаётся с тобой навсегда.",
  },
] as const;

/* ------------------------------ Страница -------------------------------- */

export default function DonatePage() {
  return (
    <div className="relative overflow-hidden">
      {/* Фоновое свечение — как на странице Premium */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-gradient-to-b from-accent/18 via-accent-2/8 to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-40 top-40 h-[520px] w-[520px] rounded-full bg-accent/12 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-40 top-[45%] h-[420px] w-[420px] rounded-full bg-gold/8 blur-3xl"
        aria-hidden
      />

      {/* Звёзды-искры по фону страницы */}
      <SparkleField spots={PAGE_STARS} />

      {/* ------------------------------- Герой ------------------------------- */}
      <section className="relative px-4 pb-4 pt-8 sm:pt-10">
        <div className="mx-auto max-w-3xl">
          <Breadcrumbs items={[{ label: "Поддержать проект" }]} />
        </div>

        <div className="mx-auto max-w-3xl text-center">
          <span className="ah-shine animate-fade-in inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-accent-2 to-accent px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-white shadow-[0_12px_28px_-14px_rgba(31,123,255,1)] sm:text-xs">
            ⚡ Лимитированная акция
          </span>

          {/* Кот с ореолом, орбитой и блёстками */}
          <div className="animate-fade-up mt-7 flex justify-center" style={{ animationDelay: "0.1s" }}>
            <span className="relative inline-block">
              <span
                className="ag-halo absolute -inset-6 rounded-full bg-accent-2/25 blur-3xl"
                aria-hidden
              />
              <span className="ag-orbit" aria-hidden>
                <span className="ag-orbit-dot" />
              </span>
              <span className="ag-orbit ag-orbit-reverse" aria-hidden>
                <span className="ag-orbit-dot" />
              </span>
              <Image
                src="/donate-cat2.png"
                alt="Кот AniGalaxy с синим пламенем"
                width={800}
                height={860}
                priority
                unoptimized
                className="ag-cat-anim relative h-auto w-56 drop-shadow-[0_0_44px_rgba(0,160,255,0.35)] sm:w-72 lg:w-[320px]"
              />
              <SparkleField spots={CAT_SPARKLES} />
              <SparkleField spots={CAT_RISE} variant="ag-rise-star" />
            </span>
          </div>

          <h1
            className="animate-fade-up mt-6 bg-gradient-to-r from-white via-accent to-accent-2 bg-clip-text text-3xl font-black leading-tight text-transparent sm:text-5xl md:text-6xl"
            style={{ animationDelay: "0.2s" }}
          >
            Поддержав AniGalaxy — получи бонусы!
          </h1>

          <p
            className="animate-fade-up mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted sm:text-lg"
            style={{ animationDelay: "0.3s" }}
          >
            Поддержи проект — и забери всё сразу: <b className="text-white">10 000 AniCoin</b>,{" "}
            <b className="text-white">эксклюзивный глитч-эффект</b> и{" "}
            <b className="text-white">тег «Донатер» навсегда</b>.
          </p>
        </div>
      </section>

      {/* ----------------------------- Бонусы ------------------------------- */}
      <section className="relative mx-auto max-w-4xl px-4 pt-6" aria-label="Бонусы за поддержку">
        <div className="grid gap-4 sm:grid-cols-3">
          {BONUSES.map((bonus, index) => (
            <article
              key={bonus.title}
              className="animate-fade-up rounded-2xl border border-line bg-card/70 p-5 text-left transition hover:-translate-y-1 hover:border-accent/40 hover:shadow-[0_18px_40px_-24px_rgba(31,123,255,0.9)]"
              style={{ animationDelay: `${0.4 + index * 0.1}s` }}
            >
              <span
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-accent/25 to-accent-2/15 text-2xl ring-1 ring-white/10"
                aria-hidden
              >
                {bonus.icon}
              </span>
              <h3 className="mt-4 text-base font-black leading-snug text-white sm:text-lg">
                {bonus.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{bonus.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* --------------------------- Лимит акции ---------------------------- */}
      <section className="relative mx-auto max-w-4xl px-4 pt-4" aria-label="Лимитированная акция">
        <div
          className="animate-fade-up rounded-2xl border border-accent-2/25 bg-gradient-to-r from-accent/10 via-card/70 to-accent-2/10 p-5 sm:p-6"
          style={{ animationDelay: "0.7s" }}
        >
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-black text-white">
                <span aria-hidden>⏳</span> Акция лимитирована
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Набор действует только во время акции: как только она закончится, 10 000 AniCoin
                и глитч-эффект уйдут вместе с ней — а тег «Донатер» достанется тем, кто успел.
                Количество наборов ограничено.
              </p>
            </div>

            <div className="min-w-[220px]">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted">
                Осталось наборов акции
              </p>
              <p className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-black text-white">787</span>
                <span className="text-xs font-bold text-muted">из 2 000</span>
              </p>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="animate-progress h-full rounded-full bg-gradient-to-r from-accent-2 to-accent"
                  style={{
                    width: "39.35%",
                    animationDuration: "1.8s",
                    animationDelay: "0.9s",
                  }}
                  aria-hidden
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------- CTA -------------------------------- */}
      <DonateCta />

      {/* ------------------------------ Сноски ------------------------------ */}
      <section className="relative mx-auto max-w-4xl px-4 pb-4 pt-4 text-center">
        <p className="text-sm leading-relaxed text-muted">
          Акция лимитирована · бонусы привязываются к аккаунту, выдаются один раз и не
          передаются.
        </p>
      </section>
    </div>
  );
}
