import type { Metadata } from "next";
import { catalog } from "@/lib/kodik";
import { dedupeCards } from "@/lib/anime";
import { AniSwipeView } from "@/components/aniswipe/AniSwipeView";

export const metadata: Metadata = {
  title: "AniSwipe",
  description:
    "Свайп-подборка аниме: листайте карточки, сохраняйте понравившееся и подбирайте тайтлы вместе с другом.",
};

export default async function AniSwipePage() {
  const [rating, fresh] = await Promise.all([
    catalog({ sort: "rating" }).catch(() => ({ cards: [], total: 0, next: null })),
    catalog({ sort: "fresh" }).catch(() => ({ cards: [], total: 0, next: null })),
  ]);

  const cards = dedupeCards([...rating.cards, ...fresh.cards]);

  return <AniSwipeView cards={cards} />;
}
