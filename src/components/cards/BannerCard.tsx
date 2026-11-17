"use client";

import { useState } from "react";
import { cardDef } from "@/lib/cards/catalog";
import { CLASSES, ELEMENTS, PACK, RANKS } from "@/lib/cards/config";
import { act, type CardsState } from "@/lib/cards/client";
import { CardFacts } from "./CardFacts";
import { CardViewer } from "./CardViewer";
import { GameCard } from "./GameCard";
import { Reveal, fmtLeft, toast, useBusy, useNow } from "./common";
import { Cur, Ico } from "./icons";

interface PackResult {
  offers: string[];
  chosen: { invId: number; cardId: string } | null;
  dustBack: number;
}

/** Карта недели: герой недели с повышенным шансом и гарантией */
export function BannerCard({ s }: { s: CardsState }) {
  const b = s.events.banner;
  const def = cardDef(b.featured);
  const [busy, run] = useBusy();
  const [shown, setShown] = useState<{ cardId: string }[]>([]);
  const [look, setLook] = useState(false);
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
  const el = ELEMENTS[def.element];
  const priceEl = (n: number) => (
    <span className="bn2-p">
      {price(n) === null ? (
        <>
          <Cur k="packs" size={17} /> {n}
        </>
      ) : (
        <>
          <Cur k="diamonds" size={17} /> {price(n)}
        </>
      )}
    </span>
  );
  return (
    <section className="bn2" aria-label="Карта недели" style={{ ["--c" as string]: RANKS[def.rank].color }}>
      <i className="bn2-glow" aria-hidden />
      <header className="bn2-head">
        <div className="bn2-top">
          <span className="bn2-eye">
            <Ico name="star" size={13} /> Карта недели · {def.series}
          </span>
          <span className="bn2-time">
            <Ico name="clock" size={13} /> {fmtLeft(b.endsAt - now)}
          </span>
        </div>
        <h3>{def.name}</h3>
        <p className="bn2-sub">
          {RANKS[def.rank].name} · {el.name} · {CLASSES[def.cls].name}
        </p>
      </header>

      <div className="bn2-main">
        <div className="bn2-art">
          <i className="bn2-aura" aria-hidden />
          <div className="bn2-card">
            <GameCard cardId={def.id} stats={false} live />
          </div>
          <button type="button" className="bn2-look" onClick={() => setLook(true)}>
            <Ico name="eye" size={15} /> Рассмотреть карту
          </button>
          <span className="bn2-own">{owned ? "Уже в вашей коллекции" : "Пока нет в коллекции"}</span>
        </div>

        <div className="bn2-body">
          <ul className="bn2-bul">
            <li>
              Шанс героя в каждом паке выше на <b>+{chance}%</b>.
            </li>
            <li>
              Гарантия: герой выпадет не позже чем через <b>{b.guarantee}</b> паков с баннера.
            </li>
            <li>{left <= 1 ? <>Следующий пак с баннера гарантированно принесёт героя.</> : <>До гарантии осталось <b>{left}</b> паков.</>}</li>
            <li>
              Бьёт стихию «{ELEMENTS[el.beats].name}»: {CLASSES[def.cls].hint.charAt(0).toLowerCase() + CLASSES[def.cls].hint.slice(1)}.
            </li>
          </ul>

          <span className="bn2-cap">Характеристики героя</span>
          <CardFacts cardId={def.id} quote />

          <div className="bn2-prog" role="progressbar" aria-valuemin={0} aria-valuemax={b.guarantee} aria-valuenow={b.counter} aria-label="Прогресс гарантии баннера">
            <span>
              Серия баннера <b>{b.counter}</b> из {b.guarantee}
            </span>
            <i>
              <u style={{ width: `${pct}%` }} />
            </i>
          </div>

          <div className="bn2-buy">
            <button type="button" className="bn2-b main" disabled={busy || pending || (price(1) !== null && w.diamonds < price(1)!)} onClick={() => void open(1)}>
              1 пак {priceEl(1)}
            </button>
            <button type="button" className="bn2-b" disabled={busy || pending || (price(6) !== null && w.diamonds < price(6)!)} onClick={() => void open(6)}>
              6 паков {priceEl(6)}
            </button>
          </div>
          <small className="bn2-note">Платите жетонами, а если их нет, алмазами. Паки с баннера открываются как обычные: три карты на выбор.</small>
        </div>
      </div>
      {shown.length > 0 && <Reveal cards={shown} title="Карта недели" onClose={() => setShown([])} />}
      {look && <CardViewer ids={[def.id]} index={0} onIndex={() => {}} onClose={() => setLook(false)} owned={owned} />}
    </section>
  );
}
