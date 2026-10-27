/**
 * Боковое меню профиля.
 *
 * Две скользящие плашки, как в макете: `.hl` едет под курсором, `.act` — под
 * активной вкладкой. Позиция берётся из offsetLeft/offsetTop кнопки.
 *
 * Меню рендерится один раз: при смене вкладки меняется только класс на
 * кнопке и координаты плашки. Пересоздавать разметку нельзя — новая плашка
 * стартовала бы с нулевого размера, и анимация обрывалась бы на глазах.
 *
 * Пересчёт положения.active повторяется на resize и после загрузки шрифтов:
 * до подстановки кириллицы у кнопок другие ширины, и плашка встала бы мимо.
 */

import Link from "next/link";
import { useCallback, useEffect, useRef } from "react";
import { VISIBLE_SECTIONS, type SectionId, type SectionMeta } from "./ProfileSections";
import { WidgetIcon } from "./WidgetIcon";

/** Иконка раздела. Взят из общего набора дизайна, а не рисуется в каждом файле */
const ICON: Record<SectionId, string> = {
  main: "grid",
  showcase: "widgets",
  favorites: "heart",
  collections: "layers",
  achievements: "trophy",
  history: "clock",
  comments: "chat",
  blacklist: "ban",
  quests: "target",
  shop: "cart",
  referrals: "user",
  notices: "bolt",
};

export function ProfileNav({
  active,
  go,
  badge,
}: {
  active: SectionId;
  go: (id: SectionId) => void;
  /** Счётчики для пунктов: готовые квесты и непрочитанные уведомления */
  badge: (meta: SectionMeta) => number;
}) {
  const navRef = useRef<HTMLElement>(null);
  const hlRef = useRef<HTMLElement>(null);
  const actRef = useRef<HTMLElement>(null);

  const place = useCallback((el: HTMLElement | null, btn: HTMLElement | null, show: boolean) => {
    if (!el || !btn) return;
    el.style.opacity = show ? "1" : "0";
    el.style.width = `${btn.offsetWidth}px`;
    el.style.height = `${btn.offsetHeight}px`;
    el.style.transform = `translate(${btn.offsetLeft}px, ${btn.offsetTop}px)`;
  }, []);

  /** Ставит активную плашку на текущую вкладку */
  const placeActive = useCallback(() => {
    const nav = navRef.current;
    if (!nav) return;
    place(actRef.current, nav.querySelector<HTMLElement>('[aria-current="true"]'), true);
  }, [place]);

  // Смена вкладки: только перестановка класса и координат
  useEffect(() => {
    placeActive();
  }, [placeActive, active]);

  // Первая раскладка и её пересчёт
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const onOver = (event: PointerEvent | FocusEvent) => {
      const btn = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-nav-item]");
      if (btn) place(hlRef.current, btn, true);
    };
    const onLeave = () => place(hlRef.current, null, false);

    nav.addEventListener("pointerover", onOver);
    nav.addEventListener("focusin", onOver);
    nav.addEventListener("pointerleave", onLeave);
    nav.addEventListener("focusout", onLeave);

    const onResize = () => placeActive();
    addEventListener("resize", onResize);

    // Шрифты грузятся асинхронно и меняют ширину подписей
    const fonts = document.fonts?.ready;
    fonts?.then(onResize).catch(() => {});

    // Плавность включаем после первой раскладки, иначе плашки приезжают
    // из нулевого размера и мигают
    const frames = requestAnimationFrame(() => requestAnimationFrame(() => {
      nav.classList.add("rdy");
      placeActive();
    }));

    return () => {
      nav.removeEventListener("pointerover", onOver);
      nav.removeEventListener("focusin", onOver);
      nav.removeEventListener("pointerleave", onLeave);
      nav.removeEventListener("focusout", onLeave);
      removeEventListener("resize", onResize);
      cancelAnimationFrame(frames);
    };
  }, [place, placeActive]);

  return (
    <nav ref={navRef} className="ag-card ag-nav" aria-label="Разделы профиля">
      <i ref={hlRef} className="hl" aria-hidden />
      <i ref={actRef} className="act" aria-hidden />
      {VISIBLE_SECTIONS.map((item) => {
        const isActive = item.id === active;
        const count = badge(item);
        const cls = `${item.fresh ? "is-new" : ""} ${isActive ? "is-on" : ""}`.trim();
        const inner = (
          <>
            <WidgetIcon name={ICON[item.id]} />
            <span style={{ flex: 1, textAlign: "left" }}>{item.label}</span>
            {count > 0 && <i>{count}</i>}
          </>
        );

        return item.href ? (
          <Link key={item.id} href={item.href} data-nav-item className={cls} style={{ display: "flex" }}>
            {inner}
          </Link>
        ) : (
          <button
            key={item.id}
            type="button"
            data-nav-item
            className={cls}
            aria-current={isActive ? "true" : undefined}
            onClick={() => go(item.id)}
          >
            {inner}
          </button>
        );
      })}
    </nav>
  );
}