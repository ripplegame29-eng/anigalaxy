import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { StoreView } from "@/components/StoreView";

export const metadata: Metadata = {
  title: "Магазин",
  description:
    "Магазин AniGalaxy: теги, титулы, фоны, рамки и эффекты за Anime Coins. Покупки за AC, редкость предметов, поиск и фильтры каталога.",
  keywords: ["магазин", "аниме", "AC", "косметика профиля", "AniGalaxy"],
};

export default function StorePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs items={[{ label: "Магазин" }]} />
      <div className="mt-5">
        <StoreView />
      </div>
    </div>
  );
}
