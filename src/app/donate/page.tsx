import type { Metadata } from "next";
import { DonateView } from "@/components/donate/DonateView";

export const metadata: Metadata = {
  title: "Поддержать проект",
  description:
    "Поддержи AniGalaxy и получи бонусы: AC, Premium и тег «Донатер» навсегда. Три набора — от 199 ₽, акция лимитирована.",
  keywords: ["поддержать", "донат", "AC", "аникойны", "тег донатер", "глитч-эффект"],
};

/**
 * Страница доната целиком рисует `DonateView` вместе с макетом: у неё своя
 * палитра, звёздный фон и липкая кнопка — общей разметки, как у разделов
 * каталога, здесь нет.
 */
export default function DonatePage() {
  return <DonateView />;
}