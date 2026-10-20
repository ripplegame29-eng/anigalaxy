import type { Metadata } from "next";
import RankGallery from "@/components/progression/RankBadges";

export const metadata: Metadata = {
  title: "Ранги — превью",
  robots: { index: false, follow: false },
};

/**
 * Превью всех 26 рангов. Только для разработки: рядом с `dev/levels` и
 * `dev/tags`, чтобы посмотреть значки и их анимации без захода в профиль.
 */
export default function RanksPreviewPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-black text-white">26 рангов</h1>
      <p className="mb-8 text-sm text-muted">
        Наведи на значок — он наклоняется за курсором.
      </p>
      <RankGallery />
    </div>
  );
}
