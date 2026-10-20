import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ShopSection } from "@/components/profile/ProfileSections";

export const metadata: Metadata = {
  title: "Косметика",
  description:
    "Косметика AniGalaxy: аватары, рамки, фоны профиля, титулы, теги и эффекты. Витрина с примеркой, поиском и фильтрами по редкости — соберите свою коллекцию.",
  keywords: ["косметика", "рамки", "титулы", "фоны профиля", "аниме аватар", "AniGalaxy"],
};

/**
 * Витрина косметики.
 *
 * Каталог не переписывается здесь: это тот же `ShopSection`, что и в магазине
 * (герой с аватаром и XP, «Собрано N/M», вкладки со счётчиками, поиск,
 * фильтры редкости, сетка и панель примерки). Вторая копия того же каталога
 * разъехалась бы с первой на первом же новом предмете.
 *
 * Разница с `/store` одна: магазин продаёт AC пакетами и держит баланс,
 * здесь только коллекция и примерка.
 *
 * `.ag-root` обязателен — `ShopSection` намеренно его не ставит (его ставит
 * `StoreView`), а без него не применяются темы разделов.
 */
export default function CosmeticsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs items={[{ label: "Косметика" }]} />

      {/* Заголовок страницы. Раньше его не было вовсе: ни Breadcrumbs,
          ни карточка профиля внутри ShopSection заголовком не являются.
          Классы — те же, что на /catalog, чтобы страницы выглядели
          одинаково. */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Косметика</h1>
        <p className="mt-1.5 text-sm text-muted">
          Аватары, рамки, фоны и знаки — всё, чем можно оформить профиль.
        </p>
      </div>

      <div className="ag-root">
        <ShopSection />
      </div>
    </div>
  );
}
