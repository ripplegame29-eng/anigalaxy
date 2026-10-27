import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { LevelsView } from "@/components/levels/LevelsView";

export const metadata: Metadata = {
  title: "Уровни",
  description:
    "Уровни AniGalaxy: кривая опыта 50 × L^1.2, семь эр от «Новобранца» до «Небожителя», награда аникойнов за каждый уровень и все источники XP — вход, досмотренные серии, комментарии, оценки и списки.",
  keywords: ["уровни", "XP", "опыт", "пробуждение", "AC", "аникойны", "AniGalaxy"],
};

/* --------------------------------- Страница -------------------------------- */

export default function LevelsPage() {
  return (
    <div className="relative">
      <div className="relative z-[2] mx-auto max-w-[1180px] px-6 pt-6">
        <Breadcrumbs items={[{ label: "Уровни" }]} />
      </div>

      {/* Герой, дорожка наград, планировщик, тома и источники XP */}
      <LevelsView />

      <section className="relative z-[2] mx-auto max-w-4xl px-4 pb-10 text-center">
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
