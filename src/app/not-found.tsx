import Link from "next/link";

/** Глобальная страница 404 */
export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <div className="relative grid h-24 w-24 place-items-center rounded-3xl bg-gradient-to-br from-accent/25 to-accent-2/25 ring-1 ring-white/10">
        <span className="text-4xl font-extrabold text-gradient-accent">404</span>
      </div>

      <h1 className="mt-7 text-2xl font-extrabold tracking-tight sm:text-3xl">
        Такой страницы не существует
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Возможно, тайтл был переименован или ссылка устарела. Загляните в каталог — там больше
        тридцати тысяч аниме.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className="btn-primary rounded-xl px-6 py-3 text-sm font-bold text-white">
          На главную
        </Link>
        <Link
          href="/catalog"
          className="btn-ghost rounded-xl bg-white/8 px-6 py-3 text-sm font-semibold text-white ring-1 ring-white/12 hover:bg-white/14"
        >
          Открыть каталог
        </Link>
      </div>
    </div>
  );
}
