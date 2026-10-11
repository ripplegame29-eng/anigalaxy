import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ClansView } from "@/components/clans/ClansView";

export const metadata: Metadata = {
  title: "Кланы",
  description:
    "Кланы AniGalaxy: состав, роли и специализации, задания за реальную активность на сайте, штаб-квартира, захват территорий и лиги сезона. Клановые очки считаются из прогресса сайта, а не из отдельного счётчика.",
};

export default function ClansPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs items={[{ label: "Кланы" }]} />
      <ClansView />
    </div>
  );
}