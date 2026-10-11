import { Suspense } from "react";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SettingsView } from "@/components/SettingsView";

export const metadata: Metadata = {
  title: "Настройки",
  description:
    "Настройки AniGalaxy: профиль и био, внешний вид, приватность, подписка и локальная база данных — экспорт и импорт бэкапа.",
  robots: { index: false, follow: false },
};

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs items={[{ label: "Настройки" }]} />
      <div className="mt-5">
        {/* `useSearchParams` читает `?tab=` — без границы Suspense сборка
            статической страницы в Next 16 падает с Missing Suspense boundary */}
        <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl border border-line bg-card/50" />}>
          <SettingsView />
        </Suspense>
      </div>
    </div>
  );
}
