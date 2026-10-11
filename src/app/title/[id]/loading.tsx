/** Скелетон страницы тайтла */
export default function TitleLoading() {
  return (
    <div>
      <div className="border-b border-line">
        <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-9">
          <div className="skeleton h-4 w-52 rounded" />
          <div className="mt-6 grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
            <div className="skeleton aspect-[2/3] w-[150px] rounded-2xl sm:w-[180px] md:w-full" />
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="skeleton h-6 w-20 rounded-md" />
                <div className="skeleton h-6 w-24 rounded-md" />
              </div>
              <div className="skeleton h-9 w-2/3 rounded-lg" />
              <div className="skeleton h-4 w-1/3 rounded-md" />
              <div className="flex gap-3">
                <div className="skeleton h-16 w-32 rounded-2xl" />
                <div className="skeleton h-16 flex-1 rounded-2xl" />
              </div>
              <div className="space-y-2">
                <div className="skeleton h-4 w-full rounded" />
                <div className="skeleton h-4 w-5/6 rounded" />
                <div className="skeleton h-4 w-4/6 rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="skeleton aspect-video rounded-2xl" />
          <div className="skeleton h-[320px] rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
