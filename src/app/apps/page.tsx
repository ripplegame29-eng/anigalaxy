import type { Metadata } from "next";
import { AppsView } from "@/components/apps/AppsView";

export const metadata: Metadata = {
  title: "Приложения",
  description:
    "Установите AniGalaxy на компьютер или телефон: своя иконка, полноэкранное окно без вкладок и тот же аккаунт. Windows, macOS, Linux, Android, iPhone и iPad.",
  keywords: ["приложение", "скачать", "AniGalaxy", "установить", "Android", "Windows"],
};

export default function AppsPage() {
  return <AppsView />;
}
