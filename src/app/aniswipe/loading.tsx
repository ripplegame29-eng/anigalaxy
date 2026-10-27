/** Заглушка AniSwipe: одна большая карточка по центру */
export default function AniSwipeLoading() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-10" aria-busy="true">
      <div className="skeleton aspect-[3/4] w-full rounded-3xl" />
      <div className="mt-6 flex gap-4">
        <div className="skeleton h-14 w-14 rounded-full" />
        <div className="skeleton h-14 w-14 rounded-full" />
        <div className="skeleton h-14 w-14 rounded-full" />
      </div>
      <span className="sr-only">Подбираем тайтлы…</span>
    </div>
  );
}
