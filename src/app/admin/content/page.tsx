import { CONTENT_KINDS, type ContentKind } from "@/lib/admin/content-kinds";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/require-admin";

import { BlockRow, CreateBlockForm } from "./content-controls";

export const metadata = { title: "Контент — панель AniGalaxy" };

async function loadBlocks() {
  return {
    blocks: await db.contentBlock.findMany({ orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] }),
    count: await db.contentBlock.count(),
  };
}

export default async function AdminContentPage() {
  await requirePermission("content", "/admin/content");
  const { blocks, count } = await loadBlocks();

  const live = blocks.filter((b) => b.enabled).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Контент</h1>
        <p className="mt-1 text-sm text-white/50">
          Баннеры, слайды главной и объявления — правится здесь, без правки кода
          и деплоя. На сайте сейчас {live} из {count}.
        </p>
      </div>

      <CreateBlockForm />

      {blocks.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-10 text-center text-white/40">
          Блоков пока нет. Создайте первый через форму выше.
        </p>
      ) : (
        <ul className="space-y-3">
          {blocks.map((block) => (
            <BlockRow
              key={block.id}
              id={block.id}
              kind={block.kind as ContentKind}
              title={block.title}
              payload={block.payload}
              sortOrder={block.sortOrder}
              enabled={block.enabled}
            />
          ))}
        </ul>
      )}

      <p className="text-xs text-white/35">
        Подсказка по полям берётся из того же описания, что проверяет сервер при
        сохранении: {Object.values(CONTENT_KINDS).length} типа блока.
      </p>
    </div>
  );
}