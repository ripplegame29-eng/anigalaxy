import type { Metadata } from "next";
import { FrameSearchView } from "@/components/frame/FrameSearchView";

export const metadata: Metadata = {
  title: "Поиск аниме по кадру",
  description:
    "Загрузите скриншот из аниме — AniGalaxy найдёт тайтл, серию и точный момент сцены и сразу предложит смотреть.",
};

export default function FramePage() {
  return <FrameSearchView />;
}
