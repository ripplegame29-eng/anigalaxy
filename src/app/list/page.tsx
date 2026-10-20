import { Suspense } from "react";
import type { Metadata } from "next";
import MyList from "@/components/MyListPage";

export const metadata: Metadata = {
  title: "Мой список",
  description:
    "Избранные аниме, подборки и история просмотра. Всё хранится в этом браузере.",
  robots: { index: false, follow: false },
};

export default function MyListPage() {
  return (
    /* Без верхнего отступа и полей: страница начинается под шапкой, фон
       макетов идёт от края до края. Ширину держит сам вид. */
    <div>
      {/* Вид читает localStorage при монтировании, граница Suspense нужна
          для статической сборки страницы */}
      <Suspense
        fallback={
          <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
            <div className="h-72 animate-pulse rounded-3xl border border-line bg-card/50" />
          </div>
        }
      >
        <MyList />
      </Suspense>
    </div>
  );
}