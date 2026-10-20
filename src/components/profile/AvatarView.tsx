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
  /**
   * Во сколько раз картинка рамки больше аватара. Не задаётся — 1.3, как у
   * всех рамок проекта (файлы 512×512 рассчитаны на круг ~77% кадра).
   * Премиум-рамки из макетов нарисованы под другую пропорцию аватара и
   * задают своё значение — см. FrameItem.scale.
   */
  frameScale,
  className = "h-16 w-16",
  textClass = "text-lg",
  /**
   * data-pm-av на обёртке аватара — за него цепляет эффекты ProfileMenu
   * (неон / глитч / радуга). Рамка косметики при этом не ломается: эффекты
   * вешают классы, а не перерисовывают аватар.
   */
  pmAvatar = false,
}: {
  nickname: string;
  avatar?: string;
  frameCss?: string;
  frameImg?: string;
  frameScale?: number;
  className?: string;
  textClass?: string;
  pmAvatar?: boolean;
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
      {...(pmAvatar ? { "data-pm-av": "" } : {})}
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
          className="pointer-events-none absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2"
          style={{ width: `${(frameScale ?? 1.3) * 100}%`, height: `${(frameScale ?? 1.3) * 100}%` }}
        />
      )}
    </span>
  );
}
