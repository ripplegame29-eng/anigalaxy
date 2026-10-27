import type { Metadata } from "next";
import { ImportLists } from "@/components/ImportLists";

export const metadata: Metadata = {
  title: "Перенос списков",
  description: "Перенесите списки аниме, оценки и избранное из Shikimori, MyAnimeList и других сервисов.",
  robots: { index: false, follow: false },
};

export default function ImportPage() {
  return <ImportLists />;
}
