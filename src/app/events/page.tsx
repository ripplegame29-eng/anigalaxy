import type { Metadata } from "next";
import { EventsView } from "@/components/events/EventsView";

export const metadata: Metadata = {
  title: "Ночь ёкаев — ивент",
  description:
    "Сезонный ивент AniGalaxy: задания дня, мини-игра «Лови ёкаев», дорога фонариков с наградами и обмен фонариков на атомы профиля.",
  keywords: ["ивент", "Ночь ёкаев", "фонарики", "атомы", "мини-игра", "AniGalaxy"],
};

export default function EventsPage() {
  /* Без верхнего отступа и полей: страница начинается под шапкой, фон макета
     идёт от края до края. Ширину держит сам вид. */
  return <EventsView />;
}