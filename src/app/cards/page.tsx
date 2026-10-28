import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CardsApp } from "@/components/cards/CardsApp";

export const metadata: Metadata = {
  title: "Карточки",
  description:
    "Коллекционные карточки аниме на AniGalaxy: паки с гарантией редких карт, переплавка, раскол, улучшение до анимированных, заточка, бои 4×4, аукцион и обмен с игроками.",
};

export default function CardsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs items={[{ label: "Карточки" }]} />
      <CardsApp />
    </div>
  );
}
