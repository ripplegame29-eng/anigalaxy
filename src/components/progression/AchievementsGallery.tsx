"use client";

/* ============================================================
   Галерея достижений — макет achievements-preview.html.

   Разметка и стили перенесены 1:1 (`.agg-*` — скоуп макета, в
   проекте голые `.ag-*` заняты темой страниц). Данные — настоящие:
   список приходит из прогрессии, редкость берётся из emblemMeta,
   тайные знаки показываются как «секрет», как в макете.
   ============================================================ */

import { AchievementBadge, RARITY_INFO, type BadgeItem, type RarityKey } from "./AchievementBadges";
import { emblemMeta } from "@/lib/progression/achievements.config";

/** Семейство и состояние — то, что нужно галерее */
export type GalleryItem = {
  id: string;
  family: string;
  name: string;
  /** Подпись под названием: условие или ход выполнения */
  condition: string;
  rarity: RarityKey;
  /** Тайный знак: до получения название скрыто */
  disguised: boolean;
  unlocked: boolean;
};

/** Порядок и названия разделов — как в макете */
const FAMILIES: Record<string, string> = {
  start: "Старт",
  episodes: "Серии",
  titles: "Тайтлы",
  days: "Дни",
  streak: "Серии входа подряд",
  collection: "Подборки",
  ratings: "Оценки",
  comments: "Комментарии",
  level: "Уровни",
  night: "Ночные просмотры",
  genres: "Жанры",
  likes: "Лайки",
  quests: "Квесты",
  tags: "Теги",
  minutes: "Время у плеера",
  secret: "Секретные",
  medal: "Медали",
};

/**
 * Редкость для бейджа. Тайные знаки в макете имеют собственную
 * палитру `secret`, а в конфиге они помечены legendary — здесь
 * возвращаем им то, что в макете.
 */
export function badgeRarity(id: string, family: string): RarityKey {
  if (family === "secret") return "secret";
  return emblemMeta(id).rarity;
}

export function AchievementsGallery({
  items,
  onOpen,
}: {
  items: GalleryItem[];
  onOpen: (id: string) => void;
}) {
  const groups = Object.keys(FAMILIES)
    .map((key) => ({ key, label: FAMILIES[key], list: items.filter((it) => it.family === key) }))
    .filter((g) => g.list.length > 0);

  if (groups.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted">Ничего не найдено: измени фильтр или запрос.</p>
    );
  }

  return (
    <div className="agg">
      {groups.map((g) => (
        <section key={g.key} className="agg-sec">
          <h3 className="agg-h">
            {g.label} <span>{g.list.length}</span>
          </h3>
          <div className="agg-grid">
            {g.list.map((it) => {
              const info = RARITY_INFO[it.rarity];
              const badge: BadgeItem = { id: it.id, name: it.name, rarity: it.rarity };
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => onOpen(it.id)}
                  className="agg-item"
                  style={{ ["--g" as string]: info.glow }}
                  aria-label={it.disguised ? "Тайный знак" : it.name}
                >
                  <AchievementBadge item={badge} size={84} locked={!it.unlocked} />
                  <b className="agg-name">{it.disguised ? "???" : it.name}</b>
                  <span className="agg-cond">{it.condition}</span>
                  <span className="agg-rar">{info.name}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}