/** Общая загрузка для разделов без своего скелетона: появляется с задержкой, чтобы не мигать */
export default function Loading() {
  return (
    <div className="ui-delayed mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10" aria-busy="true" aria-label="Загрузка">
      <div className="skeleton h-9 w-64 rounded-lg" />
      <div className="skeleton mt-3 h-4 w-80 max-w-full rounded-md" />
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="skeleton aspect-[2/3] rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
