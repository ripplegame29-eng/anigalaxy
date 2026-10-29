import type { Metadata } from "next";
import { GachaBanner } from "@/components/GachaBanner";

export const metadata: Metadata = { title: "Варианты плашки гачи", robots: { index: false } };

/** Временная страница: все варианты фона плашки гачи. После выбора её можно удалить. */
export default function GachaPreviewPage() {
  const rows = [
    ["aurora", "Aurora: ночной сад с луной и световые осколки (по умолчанию)"],
    ["sakura", "Sakura: только сад с храмом и луной"],
    ["crystal", "Crystal: только кристальные осколки"],
  ] as const;
  return (
    <div className="mx-auto max-w-7xl space-y-16 px-4 py-12 sm:px-6">
      {rows.map(([v, label]) => (
        <div key={v}>
          <p className="mb-4 text-sm font-bold text-white/70">{label}</p>
          <GachaBanner variant={v} />
        </div>
      ))}
    </div>
  );
}
