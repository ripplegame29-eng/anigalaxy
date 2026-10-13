"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { AdminSection } from "./sections";

/**
 * Боковое меню панели.
 *
 * Отдельный клиентский компонент только ради активного пункта: на сервере
 * pathname неизвестен, а без подсветки «где я сейчас» в семи разделах
 * ориентироваться нечем.
 *
 * Заголовки групп («Сообщество», «Сайт», «Система») не хранятся отдельно:
 * повтор подряд идущие разделы с одинаковым `group` и образуют группу.
 * Отдельный список заголовков пришлось бы синхронизировать вручную, и он
 * разъезжается при добавлении раздела.
 */

interface NavEntry {
  section: AdminSection;
  /** Показать заголовок группы перед этой ссылкой. */
  showGroup: boolean;
}

function groupEntries(sections: AdminSection[]): NavEntry[] {
  const out: NavEntry[] = [];
  let previous: string | null | undefined;

  for (const section of sections) {
    const showGroup = section.group !== previous;
    out.push({ section, showGroup });
    previous = section.group;
  }

  return out;
}

export function AdminNav({
  sections,
  badges,
}: {
  sections: AdminSection[];
  /** Счётчики рядом с пунктами: непрочитанные ошибки и т. п. */
  badges?: Record<string, number>;
}) {
  const pathname = usePathname();
  const entries = useMemo(() => groupEntries(sections), [sections]);

  // Активен раздел-родитель, а не только точное совпадение: на /admin/users
  // пункт «Пользователи» должен остаться подсвеченным.
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <nav className="ag-nav" aria-label="Разделы панели">
      {entries.map(({ section, showGroup }) => {
        const count = badges?.[section.href];

        return (
          <div key={section.href} style={{ display: "contents" }}>
            {showGroup && section.group ? (
              <span className="ag-grp">{section.group}</span>
            ) : null}

            <Link
              href={section.href}
              className="ag-navlink"
              aria-current={isActive(section.href) ? "page" : undefined}
              title={section.hint}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: section.icon }} />
              {section.label}
              {count !== undefined ? (
                <span className={`ag-badge${count ? "" : " zero"}`}>
                  {count > 99 ? "99+" : count}
                </span>
              ) : null}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}