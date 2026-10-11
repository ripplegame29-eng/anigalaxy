import { Suspense } from "react";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ProfileView } from "@/components/ProfileView";

export const metadata: Metadata = {
  title: "Мой профиль",
  description:
    "Профиль AniGalaxy: аватар и фон, титулы, уровень и XP, достижения, квесты, история просмотра, избранное и подборки аниме.",
  robots: { index: false, follow: false },
};

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs items={[{ label: "Профиль" }]} />
      <h1 className="sr-only">Мой профиль</h1>
      <div className="mt-5">
        {/* `useSearchParams` читает `?tab=` — без границы Suspense сборка
            статической страницы в Next 16 падает с Missing Suspense boundary */}
        <Suspense fallback={<div className="h-72 animate-pulse rounded-3xl border border-line bg-card/50" />}>
          <ProfileView />
        </Suspense>
      </div>
    </div>
  );
}
