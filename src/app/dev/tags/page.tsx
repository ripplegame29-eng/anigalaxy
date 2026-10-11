import type { Metadata } from "next";
import { AgTag } from "@/components/progression/AgTag";
import { PROGRESSION_CONFIG } from "@/lib/progression/progression.config";
import { effectSet, RARITY_LABEL } from "@/lib/progression/visual";

export const metadata: Metadata = {
  title: "Dev: теги",
  robots: { index: false, follow: false },
};

const SIZES = ["sm", "md", "lg"] as const;
const RARITY_ORDER = ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY", "MYTHIC", "SECRET"] as const;

export default function DevTagsPage() {
  const tags = PROGRESSION_CONFIG.tags;
  // по одному представителю каждой редкости — для визуальной проверки пола §4
  const showcase = RARITY_ORDER.map((rarity) => tags.find((tag) => tag.rarity === rarity)).filter(
    (tag) => tag !== undefined,
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-black text-white">Теги — все {tags.length}</h1>
      <p className="mt-1 text-sm text-muted">
        Проверка визуала всех тегов в размерах sm/md/lg. У COMMON эффектов меньше, у MYTHIC/SECRET —
        максимум.
      </p>

      <section className="mt-8 rounded-2xl border border-line bg-white/[0.02] p-5">
        <h2 className="text-sm font-black uppercase tracking-wider text-white">По редкости (md)</h2>
        <p className="mt-1 text-xs text-muted">Один представитель каждой редкости: чем выше редкость, тем больше слоёв.</p>
        <div className="mt-4 flex flex-wrap items-center gap-5">
          {showcase.map((tag) => (
            <div key={tag.id} className="flex flex-col items-start gap-1.5">
              <AgTag tag={tag} size="md" />
              <span className="text-[10px] uppercase tracking-wide text-muted">
                {RARITY_LABEL[tag.rarity]} · эффектов {effectSet(tag).length}
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-8 space-y-10">
        {tags.map((tag) => (
          <section key={tag.id}>
            <div className="mb-3 flex items-baseline gap-3">
              <h2 className="text-sm font-bold text-white">{tag.name}</h2>
              <span className="text-[11px] uppercase tracking-wide text-muted">{tag.rarity}</span>
              <span className="text-[11px] text-muted">{tag.description}</span>
            </div>
            <div className="flex flex-wrap items-center gap-5">
              {SIZES.map((size) => (
                <AgTag key={size} tag={tag} size={size} />
              ))}
              <AgTag tag={tag} size="md" locked />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
