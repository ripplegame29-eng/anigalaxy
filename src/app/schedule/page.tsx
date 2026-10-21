import type { Metadata } from "next";
import { PageBackdrop } from "@/components/PageBackdrop";
import { ScheduleView } from "@/components/schedule/ScheduleView";
import { getSchedule } from "@/lib/schedule";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Расписание выхода серий",
  description:
    "Расписание выхода новых серий аниме на неделю вперёд: время выхода в вашем часовом поясе, обратный отсчёт и быстрый переход к просмотру.",
};

export default async function SchedulePage() {
  const items = await getSchedule().catch(() => []);
  return (
    <>
      <PageBackdrop variant="schedule" />
      <ScheduleView items={items} />
    </>
  );
}
