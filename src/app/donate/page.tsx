import type { Metadata } from "next";
import { requireFeature } from "@/lib/features";
import { DonateView } from "@/components/donate/DonateView";

export const metadata: Metadata = {
  title: "Поддержать проект",
  description:
    "Поддержи AniGalaxy и получи бонусы: AniCoin, Premium и тег «Донатер» навсегда. Три набора — от 199 ₽, акция лимитирована.",
  keywords: ["поддержать", "донат", "AniCoin", "тег донатер", "глитч-эффект"],
};

/**
 * Страница доната целиком рисует `DonateView` вместе с макетом: у неё своя
 * палитра, звёздный фон и липкая кнопка — общей разметки, как у разделов
 * каталога, здесь нет.
 */
export default async function DonatePage() {
  // Тумблер «donate» в панели «Настройки». Выключенная механика — 404.
  await requireFeature("donate");
  return <DonateView />;
}
