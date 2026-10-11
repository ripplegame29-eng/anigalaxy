import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReaderShell } from "@/components/manga/ReaderShell";
import { chapterPages, mangaDetail } from "@/lib/mangadex";

/** Главы часто обновляются переводами — перечитываем почаще */
export const revalidate = 3600;

interface PageProps {
  params: Promise<{ slug: string; chapter: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, chapter } = await params;
  const [detail, pages] = await Promise.all([
    mangaDetail(slug).catch(() => null),
    chapterPages(chapter).catch(() => null),
  ]);
  if (!detail || !pages) return { title: "Глава не найдена" };

  const index = detail.chapters.findIndex((c) => c.id === chapter);
  const meta = index >= 0 ? detail.chapters[index] : undefined;
  return {
    title: `${detail.title} — глава ${meta?.chapter ?? "?"}`,
    description: `Читать ${detail.title} онлайн: ${meta?.title ?? `глава ${meta?.chapter ?? ""}`}, ${pages.urls.length} страниц.`,
  };
}

export default async function ReadPage({ params }: PageProps) {
  const { slug, chapter } = await params;
  const [detail, pages] = await Promise.all([
    mangaDetail(slug).catch(() => null),
    chapterPages(chapter).catch(() => null),
  ]);
  if (!detail) notFound();

  // Глава могла быть скрыта переводчиком: отдаём страницу-заглушку,
  // но не 404 — ссылка на тайтл остаётся рабочей
  const index = detail.chapters.findIndex((c) => c.id === chapter);
  const meta = index >= 0 ? detail.chapters[index] : undefined;

  // Навигация по главам: массив уже отсортирован по номеру
  const prev = index > 0 ? detail.chapters[index - 1] : undefined;
  const next = index >= 0 && index < detail.chapters.length - 1 ? detail.chapters[index + 1] : undefined;

  return (
    <ReaderShell
      mangaId={detail.id}
      mangaTitle={detail.title}
      chapterLabel={meta?.chapter ?? "—"}
      chapterTitle={meta?.title}
      pages={pages?.urls ?? []}
      prevChapter={prev ? { id: prev.id, label: prev.chapter || "без номера" } : undefined}
      nextChapter={next ? { id: next.id, label: next.chapter || "без номера" } : undefined}
    />
  );
}