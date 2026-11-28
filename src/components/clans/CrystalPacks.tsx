"use client";

/** Пополнение кристаллов клана: четыре набора, оплата через общее окно оплаты сайта. */

import { CRYSTAL_PACKS, CRYSTAL_PRICE } from "@/lib/clan-rules";
import { openCheckout } from "@/lib/checkout";
import { CrystalIcon } from "./ClanArt";
import { fmt, useClan } from "./common";

function hint(n: number): string {
  const l = Math.floor(n / CRYSTAL_PRICE.legendary), e = Math.floor(n / CRYSTAL_PRICE.epic);
  if (l > 0) return `≈ ${l} легендарн. или ${e} эпич.`;
  if (e > 0) return `≈ ${e} эпический предмет`;
  return "для пополнения до нужной цены";
}

export function CrystalPacks() {
  const { clan } = useClan();
  const best = CRYSTAL_PACKS.length - 1;
  const buy = (i: number) => {
    const p = CRYSTAL_PACKS[i];
    openCheckout({
      productId: `clan-crystals-${p.id}`,
      title: `Кристаллы клана · ${p.name}`,
      caption: `Зачислим в клан «${clan.name}»`,
      price: p.rub,
      perks: [
        `${fmt(p.crystals)} кристаллов в казну клана`,
        "Эпические и легендарные ауры и рамки",
        "Дополнительные места в составе",
      ],
    });
  };
  return (
    <section className="cp" id="clan-crystals">
      <div className="cp-head">
        <span className="cp-ico"><CrystalIcon size={22} /></span>
        <div>
          <h2>Кристаллы клана</h2>
          <p>Идут в казну клана: ими платят за эпическое и легендарное оформление. Силы в боях не дают.</p>
        </div>
        <span className="cp-bal"><CrystalIcon size={13} /> <b>{fmt(clan.crystals)}</b></span>
      </div>
      <div className="cp-grid">
        {CRYSTAL_PACKS.map((p, i) => (
          <button key={p.id} type="button" className={`cp-pack${i === best ? " is-best" : ""}`} onClick={() => buy(i)} style={{ ["--n" as string]: i }}>
            {i === best && <span className="cp-tag">Выгоднее всего</span>}
            <span className="cp-gems" aria-hidden>
              {Array.from({ length: i + 1 }, (_, k) => <CrystalIcon key={k} size={30 - k * 2} />)}
            </span>
            <span className="cp-name">{p.name}</span>
            <span className="cp-amt"><b>{fmt(p.crystals)}</b>{p.note && <em>{p.note}</em>}</span>
            <span className="cp-hint">{hint(p.crystals)}</span>
            <span className="cp-price">{p.rub.toLocaleString("ru-RU")} ₽</span>
          </button>
        ))}
      </div>
    </section>
  );
}
