/**
 * Аватар профиля: картинка или инициалы, опционально с рамкой из каталога
 * косметики — градиентным ободком (`frameCss`) или анимированным
 * SVG-оверлеем (`frameImg`, набор `public/frames`).
 *
 * Оверлей больше аватара (файлы 512×512 рассчитаны на круг ~77% кадра),
 * поэтому рамка обнимает аватар снаружи, а не обрезается по нему.
 */
export function AvatarView({
  nickname,
  avatar,
  frameCss,
  frameImg,
  className = "h-16 w-16",
  textClass = "text-lg",
}: {
  nickname: string;
  avatar?: string;
  frameCss?: string;
  frameImg?: string;
  className?: string;
  textClass?: string;
}) {
  const initials =
    nickname.trim().split(/[\s_-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("") ||
    nickname.slice(0, 2);

  const shell = frameCss && !frameImg ? `p-[3px] ${className}` : className;

  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center ${frameCss && !frameImg ? "overflow-hidden rounded-full" : ""} ${shell}`}
      style={frameCss && !frameImg ? { backgroundImage: frameCss } : undefined}
      aria-hidden
    >
      <span
        className={`grid h-full w-full place-items-center overflow-hidden rounded-full bg-gradient-to-br from-accent to-accent-2 text-center font-black leading-none text-white ${textClass}`}
        style={
          avatar
            ? { backgroundImage: `url(${avatar})`, backgroundSize: "cover", backgroundPosition: "center" }
            : undefined
        }
      >
        {!avatar && <span className="truncate px-1">{initials.toUpperCase()}</span>}
      </span>
      {frameImg && (
        // eslint-disable-next-line @next/next/no-img-element -- анимированный SVG-оверлей: next/image его не проигрывает
        <img
          src={frameImg}
          alt=""
          loading="lazy"
          className="pointer-events-none absolute left-1/2 top-1/2 h-[130%] w-[130%] max-w-none -translate-x-1/2 -translate-y-1/2"
        />
      )}
    </span>
  );
}
