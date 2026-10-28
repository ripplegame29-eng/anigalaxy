import type { Metadata } from "next";
import { AssistantView } from "@/components/assistant/AssistantView";
import { assistantConfigured } from "@/lib/server/assistant";
import "../assistant.css";

export const metadata: Metadata = {
  title: "ИИ-ассистент Лумина — подбор аниме и поиск по сюжету",
  description:
    "Лумина подскажет, что посмотреть: подберёт аниме под настроение, найдёт тайтл по описанию сюжета или сцены и предложит похожее. Все советы можно сразу открыть на AniGalaxy.",
  alternates: { canonical: "/assistant" },
};

// Включён ли ассистент, зависит от ключа в окружении сервера, а не от сборки
export const dynamic = "force-dynamic";

export default function AssistantPage() {
  return <AssistantView enabled={assistantConfigured()} />;
}
