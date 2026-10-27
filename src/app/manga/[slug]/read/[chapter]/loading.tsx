/** Заглушка ридера: пока приходит список страниц, держим место под ленту */
export default function ReaderLoading() {
  return (
    <div className="min-h-dvh bg-ink px-2 pb-32 pt-6 sm:px-4" aria-busy="true">
      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        <div className="skeleton mx-auto mb-2 h-4 w-56 rounded-md" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton aspect-[2/3] w-full rounded-xl" />
        ))}
      </div>
      <span className="sr-only">Загружаем главу…</span>
    </div>
  );
}
