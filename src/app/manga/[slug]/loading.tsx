/** Заглушка страницы тайтла манги */
export default function MangaTitleLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10" aria-busy="true">
      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="skeleton aspect-[2/3] w-44 shrink-0 rounded-2xl sm:w-56" />
        <div className="min-w-0 flex-1">
          <div className="skeleton h-9 w-3/4 rounded-lg" />
          <div className="skeleton mt-3 h-4 w-1/3 rounded-md" />
          <div className="mt-5 space-y-2">
            <div className="skeleton h-3.5 w-full rounded" />
            <div className="skeleton h-3.5 w-full rounded" />
            <div className="skeleton h-3.5 w-2/3 rounded" />
          </div>
          <div className="skeleton mt-6 h-12 w-48 rounded-2xl" />
        </div>
      </div>
      <div className="mt-10 space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton h-14 w-full rounded-xl" />
        ))}
      </div>
      <span className="sr-only">Загружаем тайтл…</span>
    </div>
  );
}
