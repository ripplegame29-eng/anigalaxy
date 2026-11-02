"use client";

import { useState } from "react";
import { cardDef } from "@/lib/cards/catalog";
import { PACK, RANKS } from "@/lib/cards/config";
import { act, type CardsState } from "@/lib/cards/client";
import { GameCard } from "./GameCard";
import { Reveal, fmtLeft, toast, useBusy, useNow } from "./common";
import { Cur, Ico } from "./icons";

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
  const pct = Math.min(100, (b.counter / b.guarantee) * 100);
  const chance = String(+(b.boost * 100).toFixed(1)).replace(".", ",");
  const priceEl = (n: number) => (
    <span className="bn-p">
      {price(n) === null ? <><Cur k="packs" size={17} /> {n}</> : <><Cur k="diamonds" size={17} /> {price(n)}</>}
    </span>
  );
  return (
    <section className="bn" aria-label="Баннер недели" style={{ ["--c" as string]: RANKS[def.rank].color }}>
      <div className="bn-art">
        <i className="bn-aura" aria-hidden />
        <GameCard cardId={def.id} stats={false} live />
      </div>
      <div className="bn-body">
        <div className="bn-top">
          <span className="bn-tag">
            <Ico name="star" size={14} /> Баннер недели
          </span>
          <span className="bn-time">{fmtLeft(b.endsAt - now)}</span>
        </div>
        <h3>{def.name}</h3>
        <p className="bn-sub">
          {def.series} · <b>{RANKS[def.rank].name}</b>
          {owned ? " · уже в коллекции" : ""}
        </p>
        <div className="bn-stats">
          <div>
            <b>+{chance}%</b>
            <span>шанс героя в паке</span>
          </div>
          <div>
            <b>{b.guarantee}</b>
            <span>паков до гарантии максимум</span>
          </div>
          <div>
            <b>{left}</b>
            <span>{left <= 1 ? "герой выпадет в следующем паке" : "паков до гарантии осталось"}</span>
          </div>
        </div>
        <div className="bn-gar" role="progressbar" aria-valuemin={0} aria-valuemax={b.guarantee} aria-valuenow={b.counter} aria-label="Прогресс гарантии баннера">
          <i style={{ width: `${pct}%` }} />
          <span>
            {b.counter} / {b.guarantee}
          </span>
        </div>
        <div className="bn-buy">
          <button type="button" className="bn-b main" disabled={busy || pending || (price(1) !== null && w.diamonds < price(1)!)} onClick={() => void open(1)}>
            <span>1 пак</span>
            {priceEl(1)}
          </button>
          <button type="button" className="bn-b" disabled={busy || pending || (price(6) !== null && w.diamonds < price(6)!)} onClick={() => void open(6)}>
            <span>6 паков</span>
            {priceEl(6)}
          </button>
        </div>
      </div>
      {shown.length > 0 && <Reveal cards={shown} title="Баннер недели" onClose={() => setShown([])} />}
    </section>
  );
}
