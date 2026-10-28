import type { Metadata } from "next";
import { FrameSearchView } from "@/components/frame/FrameSearchView";
import { frameAiConfigured } from "@/lib/server/frame-ai";

export const metadata: Metadata = {
  title: "Поиск аниме по кадру",
  description:
    "Загрузите скриншот из аниме — AniGalaxy найдёт тайтл, серию и точный момент сцены и сразу предложит смотреть.",
};

// Включён ли ИИ-разбор, зависит от ключа в окружении сервера
export const dynamic = "force-dynamic";

export default function FramePage() {
  return <FrameSearchView aiEnabled={frameAiConfigured()} />;
}
