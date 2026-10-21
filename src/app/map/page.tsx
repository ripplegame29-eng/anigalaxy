import type { Metadata } from "next";
import { AnimeMapView } from "@/components/map/AnimeMapView";

export const metadata: Metadata = {
  title: "Карта аниме",
  description:
    "Маршруты по лучшим тайтлам: смотрите аниме по цепочке, открывайте следующие узлы карты и получайте аникойны и опыт.",
};

export default function MapPage() {
  return <AnimeMapView />;
}
