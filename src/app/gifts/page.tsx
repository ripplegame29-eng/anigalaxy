import type { Metadata } from "next";
import { GiftsView } from "@/components/gifts/GiftsView";

export const metadata: Metadata = {
  title: "Подарки",
  description: "Подарки AniGalaxy за новые уровни и события профиля: открывайте коробки и забирайте AC на баланс.",
  robots: { index: false, follow: false },
};

export default function GiftsPage() {
  return <GiftsView />;
}
