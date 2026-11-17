import type { Metadata } from "next";
import { CardsPreview } from "@/components/cards/CardsPreview";

export const metadata: Metadata = { title: "Карточки — превью", robots: { index: false, follow: false } };

/** Превью карточек всех рангов без входа в аккаунт. Только для разработки. */
export default function CardsPreviewPage() {
  return <CardsPreview />;
}
