import { Suspense } from "react";
import type { Metadata } from "next";
import { ProfileView } from "@/components/ProfileView";

export const metadata: Metadata = {
  title: "Мой профиль",
  description:
    "Профиль AniGalaxy: аватар и фон, титулы, уровень и XP, достижения, квесты, история просмотра, избранное и подборки аниме.",
  robots: { index: false, follow: false },
};

export default function ProfilePage() {
  return (
    /* Без верхнего отступа и без горизонтальных полей: баннер в макете
       начинается сразу под шапкой и идёт от края до края. Поля и центрирование
       содержимого держит сам ProfileView — иначе зазор между шапкой и
       баннером вернётся. */
    <div>
      {/* Заголовка страницы здесь нет намеренно: его отдаёт сам ProfileView —
          ник в профиле или «Профиль не открыт», если вход не выполнен.
          Раньше здесь стоял sr-only <h1>«Мой профиль»</h1> и на странице
          оказывалось два h1. Имя страницы живёт в metadata.title. */}
      {/* `useSearchParams` читает `?tab=` — без границы Suspense сборка
          статической страницы в Next 16 падает с Missing Suspense boundary */}
      <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-8 sm:px-6"><div className="h-72 animate-pulse rounded-3xl border border-line bg-card/50" /></div>}>
        <ProfileView />
      </Suspense>
    </div>
  );
}
