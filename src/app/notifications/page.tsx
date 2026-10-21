import type { Metadata } from "next";
import { PageBackdrop } from "@/components/PageBackdrop";
import { NotificationsView } from "@/components/notifications/NotificationsView";

export const metadata: Metadata = {
  title: "Уведомления",
  description: "Новые уровни, достижения, теги и выход серий — все события AniGalaxy в одном месте.",
  robots: { index: false, follow: false },
};

export default function NotificationsPage() {
  return (
    <>
      <PageBackdrop variant="notices" />
      <NotificationsView />
    </>
  );
}
