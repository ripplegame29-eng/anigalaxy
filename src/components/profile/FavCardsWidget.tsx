"use client";

import "@/app/cards-card.css";
import "@/app/profile-studio.css";
import { useHydrated } from "@/lib/use-hydrated";
import { GameCard } from "@/components/cards/GameCard";
import { cardDef } from "@/lib/cards/catalog";
import { RANKS } from "@/lib/cards/config";
import { favKey, useFavCards } from "@/lib/favcards";
import { openStudio } from "@/lib/profile-dialog";

/**
 * Блок «Любимые карты»: до шести карт из коллекции гачи в ряд, как витрина.
 * Рисуется после монтирования — список лежит в браузере, и с первого кадра
 * он разошёлся бы с серверной разметкой.
 */
export function FavCardsWidget({ readOnly = false }: { readOnly?: boolean }) {
  const cards = useFavCards();
  const mounted = useHydrated();
  if (!mounted) return <div className="pfc-row pfc-skel" aria-hidden />;

  if (cards.length === 0) {
    return readOnly ? (
      <p className="pfc-empty">Игрок пока не выбрал любимые карты.</p>
    ) : (
      <div className="pfc-empty">
        <p>Покажите гостям лучшие карты своей коллекции — легендарки, фольгу, прокачанных героев.</p>
        <button type="button" className="btn" onClick={() => openStudio("cards")}>
          Выбрать карты
        </button>
      </div>
    );
  }

  return (
    <div className="pfc-row" data-n={cards.length}>
      {cards.map((c) => {
        const def = cardDef(c.cardId);
        const rank = def ? RANKS[def.rank] : null;
        return (
          <figure key={favKey(c)} className="pfc-item">
            <GameCard cardId={c.cardId} foil={c.foil} level={c.level} evo={c.evo} live sizes="(max-width: 640px) 30vw, 150px" />
            {def && (
              <figcaption>
                <b>{def.name}</b>
                <span style={rank ? { color: rank.color } : undefined}>
                  {rank?.name ?? ""} · ур. {c.level}
                  {c.foil ? " · фольга" : ""}
                </span>
              </figcaption>
            )}
          </figure>
        );
      })}
    </div>
  );
}
