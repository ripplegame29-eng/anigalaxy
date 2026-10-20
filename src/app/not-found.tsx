import Link from "next/link";
import { Starfield } from "@/components/Starfield";

/**
 * Глобальная страница 404: «заблудился в галактике».
 *
 * Отсылка к названию проекта — единственное место сайта, где звёздное
 * поле (запчасть из наброска anigalaxy-galaxy-v6) живёт во весь вьюпорт.
 * Компонент клиентский и лёгкий: обычный 2D-canvas, кометы и туманности,
 * при reduced-motion анимация не запускается.
 */
export default function NotFound() {
  return (
    <>
      {/* Звёзды на весь экран; контент ниже идёт поверх (z-10). */}
      <Starfield
        className="fixed inset-0 z-0 h-full w-full opacity-70"
        density={1.2}
        comets
        nebula
      />

      <div className="relative z-10 mx-auto flex min-h-[70vh] max-w-xl flex-col items-center px-4 py-24 text-center">
        <div className="relative grid h-24 w-24 place-items-center rounded-3xl bg-gradient-to-br from-accent/25 to-accent-2/25 ring-1 ring-white/10">
          <span className="text-4xl font-extrabold text-gradient-accent">404</span>
        </div>

        <h1 className="mt-7 text-2xl font-extrabold tracking-tight sm:text-3xl">
          Заблудился в галактике
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Эта страница улетела за край известной карты: возможно, тайтл переименовали
          или ссылка устарела. Зато в каталоге вас ждут больше тридцати тысяч аниме.
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
    </>
  );
}
