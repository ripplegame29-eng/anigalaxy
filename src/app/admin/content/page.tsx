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

  // Дубликаты внутри одного типа — самая частая беда этого раздела: четыре
  // одинаковых слайда выглядят как «слайдер скучный», а не как ошибка.
  const seen = new Map<string, number>();
  const duplicates: { title: string | null; kind: string; count: number }[] = [];
  for (const block of blocks) {
    // Ключ — тип и тайтл: два баннера с разными картинками дублями не считаются.
    const key = `${block.kind}::${block.title ?? ""}`;
    const next = (seen.get(key) ?? 0) + 1;
    seen.set(key, next);
    if (next === 2) {
      duplicates.push({
        title: block.title,
        kind: block.kind,
        count: blocks.filter(
          (b) => `${b.kind}::${b.title ?? ""}` === key,
        ).length,
      });
    }
  }

  return (
    <div className="ag-section" style={{ gap: 28 }}>
      <div className="ag-head">
        <div>
          <h1 className="ag-h1">Контент</h1>
          <p className="ag-sub">
            Баннеры, слайды главной и объявления — правится здесь, без правки
            кода и деплоя. На сайте сейчас {live} из {count}.
          </p>
        </div>
      </div>

      {duplicates.length > 0 ? (
        <div
          className="ag-box pad"
          style={{ borderColor: "var(--ag-ambline)", background: "var(--ag-ambbg)" }}
        >
          <b style={{ fontSize: 14, color: "var(--ag-amb)" }}>
            Повторы: {duplicates.length}
          </b>
          <p className="ag-note" style={{ marginTop: 4, color: "var(--ag-amb)" }}>
            {duplicates
              .map(
                (d) =>
                  `«${d.title ?? "без названия"}» (${CONTENT_KINDS[d.kind as ContentKind]?.label ?? d.kind}) — ${d.count} шт.`,
              )
              .join("; ")}
            . На главной они выводятся подряд, и слайдер выглядит как сломанный.
            Удалите лишние или переименуйте — тогда они станут разными слайдами.
          </p>
        </div>
      ) : null}

      <CreateBlockForm />

      {blocks.length === 0 ? (
        <div className="ag-box">
          <div className="ag-empty">Блоков пока нет. Создайте первый формой выше.</div>
        </div>
      ) : (
        <ul className="ag-section" style={{ listStyle: "none", margin: 0, padding: 0, gap: 12 }}>
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

      <p className="ag-note">
        Подсказка по полям берётся из того же описания, что проверяет сервер при
        сохранении: {Object.values(CONTENT_KINDS).length} типа блока.
      </p>
    </div>
  );
}