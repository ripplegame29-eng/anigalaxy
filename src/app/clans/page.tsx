import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ClanApp } from "@/components/clan2/ClanApp";

export const metadata: Metadata = {
  title: "Кланы",
  description:
    "Кланы AniGalaxy: босс недели, общий сундук и казна, роли и управление составом, карта территорий и осады соперников, недельные лиги и кристаллы.",
};

export default function ClansPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs items={[{ label: "Кланы" }]} />
      <ClanApp />
    </div>
  );
}