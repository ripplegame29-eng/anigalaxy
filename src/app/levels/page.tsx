import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { LevelsView } from "@/components/levels/LevelsView";

export const metadata: Metadata = {
  title: "Уровни",
  description:
    "Уровни AniGalaxy: кривая опыта 50 × L^1.2, семь эр от «Новичка» до «Трансцендента», награда аникойнов за каждый уровень и все источники XP — вход, досмотренные серии, комментарии, оценки и списки.",
  keywords: ["уровни", "XP", "опыт", "эры", "AC", "аникойны", "AniGalaxy"],
};

/* --------------------------------- Страница -------------------------------- */

export default function LevelsPage() {
  return (
    <div className="relative overflow-hidden">
      {/* Фоновое свечение — как на /battlepass и /premium */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-gradient-to-b from-accent/10 via-accent/6 to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-40 top-48 h-[520px] w-[520px] rounded-full bg-accent-2/8 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-40 top-[55%] h-[420px] w-[420px] rounded-full bg-accent-2/8 blur-3xl"
        aria-hidden
      />

      {/* --------------------------------- Герой ------------------------------ */}
      <section className="relative px-4 pb-2 pt-8 sm:pt-10">
        <div className="mx-auto max-w-5xl">
          <Breadcrumbs items={[{ label: "Уровни" }]} />
        </div>

        <div className="mx-auto mt-6 max-w-5xl animate-bp-hero-in text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-accent-2 via-accent to-accent-2 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-white shadow-[0_12px_28px_-14px_rgba(32,191,255,0.7)] sm:text-xs">
            Путь к пределу
          </span>

          <h1 className="mt-5 bg-gradient-to-r from-white via-accent-2 to-accent-2 bg-clip-text text-3xl font-black leading-tight text-transparent sm:text-5xl">
            Уровни
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted sm:text-lg">
            Сто уровней и семь эр — от «Новичка» до «Трансцендента». Опыт капает за
            активность на сайте, а за каждый пройденный уровень падает аникойны.
          </p>
        </div>
      </section>

      {/* Вкладки, текущий уровень, награды, источники XP */}
      <LevelsView />

      {/* -------------------------------- Сноски ------------------------------ */}
      <section className="relative mx-auto max-w-4xl px-4 pb-6 text-center" data-reveal>
        <p className="text-sm leading-relaxed text-muted">
          Кривая опыта — <code className="text-accent-2">50 × L^1.2</code>: первые уровни
          проходятся за десятки XP, к сотому стоимость вырастает почти до шести тысяч.
          Награды и дневные лимиты считает движок прогрессии, поэтому они совпадают с
          журналом наград и балансом AC.
        </p>
      </section>
    </div>
  );
}