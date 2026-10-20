"use client";

/**
 * Ряд главной с переключателем вкладок («Онгоинги / Новинки сезона»,
 * «Горячее / Лучшее»). Два почти одинаковых ряда подряд заменены одним:
 * контент остаётся, а страница не повторяется.
 */

import { useState } from "react";
import type { AnimeCard as Card } from "@/lib/types";
import { AnimeRow } from "./AnimeRow";
import type { MarkKind } from "./SectionMark";

export interface HomeTab {
  id: string;
  label: string;
  cards: Card[];
  href: string;
}

export function HomeTabsRow({ title, mark, tabs }: { title: string; mark: MarkKind; tabs: HomeTab[] }) {
  const visible = tabs.filter((tab) => tab.cards.length > 0);
  const [active, setActive] = useState(visible[0]?.id);
  const current = visible.find((tab) => tab.id === active) ?? visible[0];
  if (!current) return null;

  return (
    <AnimeRow
      key={current.id}
      title={title}
      mark={mark}
      cards={current.cards}
      href={current.href}
      headerExtra={
        visible.length > 1 ? (
          <div className="hm-tabs" role="tablist" aria-label={title}>
            {visible.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={tab.id === current.id}
                className={tab.id === current.id ? "is-on" : ""}
                onClick={() => setActive(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : null
      }
    />
  );
}
