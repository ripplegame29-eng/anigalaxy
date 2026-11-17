"use client";

import "../../app/cards-card.css";
import "../../app/cards.css";
import "../../app/cards-stage.css";
import "../../app/cards-tabs.css";
import "../../app/cards-battle.css";
import "../../app/cards-skills.css";
import "../../app/cards-ult.css";
import "../../app/cards-progress.css";
import "../../app/cards-campaign.css";
import "../../app/cards-season.css";
import "../../app/cards-arsenal.css";
import "../../app/cards-shop.css";
import "../../app/cards-v2.css";
import "../../app/cards-arena2.css";
import "../../app/cards-arena3.css";
import "../../app/cards-result.css";
import "../../app/cards-battlefx.css";
import { CATALOG, cardsOfRank } from "@/lib/cards/catalog";
import { useState } from "react";
import { CardViewer } from "./CardViewer";
import { GameCard } from "./GameCard";

const ranks = [4, 3, 2, 1, 0] as const;

/** Превью карточек: по 3 героя каждого ранга, затем компактная сетка. */
export function CardsPreview() {
  const [view, setView] = useState<number | null>(null);
  const ids = [9, 20, 80, 200, 400].map((n) => CATALOG[n - 1].id);
  return (
    <div className="cg" style={{ padding: 24, color: "#fff" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {ids.map((id, i) => (
          <button key={id} type="button" onClick={() => setView(i)} style={{ padding: "6px 12px", border: "1px solid #456", borderRadius: 8 }}>
            Окно: {id}
          </button>
        ))}
      </div>
      {view !== null && <CardViewer ids={ids} index={view} onIndex={setView} onClose={() => setView(null)} />}
      <h1 style={{ fontWeight: 900, fontSize: 22, marginBottom: 12 }}>Карточки · {CATALOG.length} героев</h1>
      {ranks.map((r) => (
        <div key={r} style={{ display: "flex", gap: 22, margin: "18px 0", flexWrap: "wrap" }}>
          {cardsOfRank(r).slice(0, 3).map((c, i) => (
            <div key={c.id} style={{ width: 230 }}>
              <GameCard cardId={c.id} stats={i !== 1} live={i === 0} foil={i === 2} level={i === 2 ? 4 : 1} />
            </div>
          ))}
        </div>
      ))}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(110px,1fr))", gap: 10, marginTop: 28 }}>
        {CATALOG.slice(0, 48).map((c) => (
          <GameCard key={c.id} cardId={c.id} stats={false} />
        ))}
      </div>
    </div>
  );
}
