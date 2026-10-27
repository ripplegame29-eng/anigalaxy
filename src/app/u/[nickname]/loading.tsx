/** Заглушка профиля: баннер, аватар и вкладки */
export default function ProfileLoading() {
  return (
    <div aria-busy="true">
      <div className="skeleton h-56 w-full sm:h-72" />
      <div className="mx-auto -mt-12 max-w-5xl px-4 sm:px-6">
        <div className="flex items-end gap-4">
          <div className="skeleton h-24 w-24 shrink-0 rounded-full ring-4 ring-ink sm:h-28 sm:w-28" />
          <div className="mb-2 flex-1">
            <div className="skeleton h-8 w-48 rounded-lg" />
            <div className="skeleton mt-3 h-4 w-32 rounded-md" />
          </div>
        </div>
        <div className="mt-8 flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-10 w-24 rounded-full" />
          ))}
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="skeleton h-40 rounded-2xl" />
          <div className="skeleton h-40 rounded-2xl" />
        </div>
      </div>
      <span className="sr-only">Загружаем профиль…</span>
    </div>
  );
}
