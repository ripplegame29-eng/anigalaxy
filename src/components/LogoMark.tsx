import Image from "next/image";

/**
 * Знак AniGalaxy — маскот.
 *
 * Раньше здесь был нарисованный в SVG знак-монограмма «A» с орбитой и
 * искрой. Теперь это персонаж проекта (публичный/cat-mascot.png):
 * файл прозрачный, рисуется как обычная картинка, размер задаёт
 * вызывающий через className.
 *
 * Подменять картинку можно без правок кода: достаточно положить свой файл
 * по пути public/cat-mascot.png. Генерируется он скриптом
 * tools/make-mascot.mjs (уменьшение исходника до размера шапки).
 *
 * Пропсы width/height обязательны: без них next/image не может
 * зарезервировать место, и при загрузке шапка прыгает.
 */
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/cat-mascot.png"
      alt=""
      width={192}
      height={128}
      sizes="44px"
      className={className}
      aria-hidden="true"
      /* Логотип стоит в шапке над сгибом: грузим сразу, иначе Next
         ругается на LCP в консоли */
      priority
    />
  );
}