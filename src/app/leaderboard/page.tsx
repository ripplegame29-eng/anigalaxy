import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { LeaderboardBackdrop } from "@/components/leaderboard/LeaderboardBackdrop";
import { LeaderboardView } from "@/components/leaderboard/LeaderboardView";

export const metadata: Metadata = {
  title: "Лидерборд",
  description:
    "Лидерборд AniGalaxy: самые упорные зрители недели, месяца и всего времени. Подиум, награды за места и твоя позиция.",
  keywords: ["лидерборд", "рейтинг зрителей", "топ", "AniGalaxy"],
};

export default function LeaderboardPage() {
  return (
    <div className="relative isolate">
      <LeaderboardBackdrop />
      <div className="relative z-[1] mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <Breadcrumbs items={[{ label: "Лидерборд" }]} />
        <LeaderboardView />
      </div>
    </div>
  );
}
