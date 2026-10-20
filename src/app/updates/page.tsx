import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { UpdatesView } from "@/components/updates/UpdatesView";

export const metadata: Metadata = {
  title: "Обновления",
  description:
    "Публичный роадмап AniGalaxy: что уже работает, что в разработке и что в планах. Голосуйте за функции и следите за датами патчей.",
  keywords: ["обновления", "роадмап", "патчи", "AniGalaxy", "что нового"],
};

export default function UpdatesPage() {
  return (
    <>
      <div className="mx-auto max-w-4xl px-4 pt-6">
        <Breadcrumbs items={[{ label: "Обновления" }]} />
      </div>
      <UpdatesView />
    </>
  );
}