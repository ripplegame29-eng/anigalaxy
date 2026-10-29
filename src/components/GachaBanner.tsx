import Image from "next/image";
import Link from "next/link";

/**
 * Плашка гачи на главной: ведёт в раздел карточек.
 * Статичная картинка (без клиентского кода), узкая и по центру — чтобы не
 * перегружать главную и не спорить с Premium-плашками наверху.
 */
export function GachaBanner() {
  return (
    <section aria-label="Гача и коллекция карточек">
      <Link
        href="/cards"
        aria-label="Гача и коллекция: открыть карточки с любимыми персонажами"
        className="group relative mx-auto block w-full max-w-[900px] overflow-hidden rounded-[28px] bg-[#04050c] ring-1 ring-white/10 shadow-[0_30px_80px_-40px_rgba(80,90,255,0.7)] transition duration-300 hover:-translate-y-0.5 hover:ring-accent/55 hover:shadow-[0_40px_100px_-40px_rgba(110,120,255,0.9)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
      >
        <Image
          src="/banners/gacha.webp"
          alt="AniGalaxy Гача: открой карточки с любимыми персонажами. Собирай, развивай, получай"
          width={1631}
          height={866}
          sizes="(max-width: 940px) 100vw, 900px"
          className="h-auto w-full transition duration-500 group-hover:scale-[1.015]"
        />
      </Link>
    </section>
  );
}
