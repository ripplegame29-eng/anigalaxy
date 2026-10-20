import { Suspense } from "react";
import type { Metadata } from "next";
import { ProfileView } from "@/components/ProfileView";

export const metadata: Metadata = {
  title: "Профиль пользователя · AniGalaxy",
  description:
    "Как профиль видят другие: баннер, аватар с рамкой, титулы и теги, уровень, достижения и виджеты — без личных разделов и кнопок владельца.",
  robots: { index: false, follow: false },
};

/**
 * Гостевой вид своего профиля — `/u/me`.
 *
 * Тот же ProfileView в режиме `guest`: реальные данные из браузера, но
 * без «Настроек», «Внешнего вида» и «Изменить фон», без подарков, истории
 * и чёрного списка, а личные числа (баланс, записи истории) скрыты.
 *
 * Отдельный адрес нужен, чтобы увидеть страницу такой, какой её видит
 * чужой человек, — в диалоге «Как видят другие» остаётся быстрый просмотр
 * без ухода с `/profile`. Когда появится сервер, в этот маршрут придёт
 * документ другого пользователя, а данные перестанут браться из localStorage.
 */
export default function GuestProfilePage() {
  return (
    <div>
      {/* Без полей и верхнего отступа — их держит сам ProfileView, иначе
          баннер отодвинется от краёв. */}
      <Suspense
        fallback={
          <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
            <div className="h-72 animate-pulse rounded-3xl border border-line bg-card/50" />
          </div>
        }
      >
        <ProfileView mode="guest" />
      </Suspense>
    </div>
  );
}