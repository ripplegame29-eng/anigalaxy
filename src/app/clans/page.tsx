import type { Metadata } from "next";
import { requireFeature } from "@/lib/features";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ClansView } from "@/components/clans/ClansView";

export const metadata: Metadata = {
  title: "Кланы",
  description:
    "Кланы AniGalaxy: состав, роли и специализации, задания за реальную активность на сайте, штаб-квартира, захват территорий и лиги сезона. Клановые очки считаются из прогресса сайта, а не из отдельного счётчика.",
};

export default async function ClansPage() {
  // Тумблер «clans» в панели «Настройки». Выключенная механика — 404.
  await requireFeature("clans");
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs items={[{ label: "Кланы" }]} />
      <ClansView />
    </div>
  );
}