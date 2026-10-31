import Image from "next/image";

/**
 * Знак AniGalaxy — маскот.
 *
 * Персонаж проекта (public/cat-mascot.png):
 * файл прозрачный, рисуется как обычная картинка, размер задаёт
 * вызывающий через className.
 *
 * Пропсы width/height обязательны: без них next/image не может
 * зарезервировать место, и при загрузке шапка прыгает.
 */
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/mascot.png"
      alt=""
      width={200}
      height={215}
      sizes="48px"
      className={className}
      aria-hidden="true"
      /* Логотип стоит в шапке над сгибом: грузим сразу, иначе Next
         ругается на LCP в консоли */
      priority
    />
  );
}
