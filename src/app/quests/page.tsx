import type { Metadata } from "next";
import { PageBackdrop } from "@/components/PageBackdrop";
import { QuestsView } from "@/components/quests/QuestsView";

export const metadata: Metadata = {
  title: "Квесты",
  description:
    "Ежедневные и недельные задания AniGalaxy: смотрите, оценивайте, комментируйте и забирайте XP и аникойны. Маршрут дня, серия и задания сезона на одной странице.",
  robots: { index: false, follow: false },
};

export default function QuestsPage() {
  return (
    <>
      <PageBackdrop variant="quests" />
      <QuestsView />
    </>
  );
}
