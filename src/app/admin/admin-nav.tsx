"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { AdminSection } from "./sections";

export function AdminNav({ sections }: { sections: AdminSection[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1">
      {sections.map((section) => {
        // «/admin» активен только на себе: без проверки длины он подсвечивался
        // бы на всех вложенных страницах.
        const active =
          section.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(section.href);

        return (
          <Link
            key={section.href}
            href={section.ready ? section.href : "#"}
            aria-current={active ? "page" : undefined}
            aria-disabled={!section.ready}
            className={[
              "rounded-lg px-3 py-2 text-sm transition",
              active
                ? "bg-white/10 text-white"
                : "text-white/50 hover:bg-white/5 hover:text-white/80",
              !section.ready ? "cursor-not-allowed opacity-40" : "",
            ].join(" ")}
            title={section.ready ? undefined : "Раздел ещё не сделан"}
          >
            {section.label}
            {!section.ready ? <span className="ml-1.5 text-[10px]">скоро</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}