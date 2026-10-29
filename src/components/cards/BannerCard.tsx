"use client";

import { useState } from "react";
import { cardDef } from "@/lib/cards/catalog";
import { PACK, RANKS } from "@/lib/cards/config";
import { act, type CardsState } from "@/lib/cards/client";
import { GameCard } from "./GameCard";
import { Reveal, fmtLeft, toast, useBusy, useNow } from "./common";
import { Cur } from "./icons";

interface PackResult {
  offers: string[];
  chosen: { invId: number; cardId: string } | null;
  dustBack: number;
}

/** Баннер недели: герой недели с повышенным шансом и гарантией */
export function BannerCard({ s }: { s: CardsState }) {
  const b = s.events.banner;
  const def = cardDef(b.featured);
  const [busy, run] = useBusy();
  const [shown, setShown] = useState<{ cardId: string }[]>([]);
  const now = useNow(60_000);
  if (!def) return null;
  const owned = s.inventory.some((c) => c.cardId === b.featured);
  const left = Math.max(1, b.guarantee - b.counter);
  const w = s.wallet;
  const pending = !!s.pending;
  const open = (count: number) =>
    run(async () => {
      const pay = w.packs >= count ? "token" : "diamonds";
      const r = await act<{ results: PackResult[]; pending: string[] | null }>("open", { count, pay, quick: count > 1, banner: true });
      if (!r.ok) return toast(r.error, true);
      if (r.result.results.length) setShown(r.result.results.filter((x) => x.chosen).map((x) => ({ cardId: x.chosen!.cardId })));
    });
  const price = (n: number) => (w.packs >= n ? null : PACK.diamonds * (n === 1 ? 1 : 5));
  return (
    <section className="bn" aria-label="Баннер недели" style={{ ["--c" as string]: RANKS[def.rank].color }}>
      <GameCard cardId={def.id} stats={false} live />
      <div>
        <span className="cg-tag" style={{ color: "var(--cg-gold)" }}>
          Баннер недели · {fmtLeft(b.endsAt - now)}
        </span>
        <h3>{def.name}</h3>
        <p className="cg-hint" style={{ margin: 0 }}>
          {def.series} · {RANKS[def.rank].name}
          {owned ? " · уже в коллекции" : ""}
        </p>
        <div className="bn-rate">
          <span className="cg-chip">Шанс героя в паке +{Math.round(b.boost * 100)}%</span>
          <span className="cg-chip">Гарантия: не позже {b.guarantee}-го пака</span>
        </div>
        <div className="bn-gar" role="progressbar" aria-valuemin={0} aria-valuemax={b.guarantee} aria-valuenow={b.counter} aria-label="Прогресс гарантии баннера">
          <i style={{ width: `${(b.counter / b.guarantee) * 100}%` }} />
        </div>
        <p className="cg-hint" style={{ margin: "0 0 12px" }}>
          {left <= 1 ? "Герой выпадет в следующем паке баннера" : `Гарантия через ${left} паков баннера`}
        </p>
        <div className="cg-row">
          <button type="button" className="cg-btn gold" disabled={busy || pending || (price(1) !== null && w.diamonds < price(1)!)} onClick={() => void open(1)}>
            1 пак · {price(1) === null ? <><Cur k="packs" /> 1</> : <><Cur k="diamonds" /> {price(1)}</>}
          </button>
          <button type="button" className="cg-btn" disabled={busy || pending || (price(6) !== null && w.diamonds < price(6)!)} onClick={() => void open(6)}>
            6 паков · {price(6) === null ? <><Cur k="packs" /> 6</> : <><Cur k="diamonds" /> {price(6)}</>}
          </button>
        </div>
      </div>
      {shown.length > 0 && <Reveal cards={shown} title="Баннер недели" onClose={() => setShown([])} />}
    </section>
  );
}
