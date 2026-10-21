"use client";

import { useState, type CSSProperties } from "react";
import { can } from "@/lib/clan2/data";
import { BACKGROUNDS, DECORATIONS, EMBLEM_ITEMS, RARITY_COLOR, RARITY_LABEL, emblemOf, priceOf, type ShopItem } from "@/lib/clan2/shop";
import { buyItem, equip, isOwned, type ClanV2State } from "@/lib/clan2/store";
import { EmblemArt } from "./EmblemArt";
import { num, useNote } from "./common";

const CATS = [
  { id: "background", label: "Фоны", items: BACKGROUNDS },
  { id: "emblem", label: "Эмблемы", items: EMBLEM_ITEMS },
  { id: "decoration", label: "Декор", items: DECORATIONS },
] as const;

export function ShopTab({ s }: { s: ClanV2State }) {
  const clan = s.clan!;
  const [cat, setCat] = useState<(typeof CATS)[number]["id"]>("background");
  const [note, say] = useNote();
  const manage = can.manage(s.selfRole);
  const items = CATS.find((c) => c.id === cat)!.items;

  const isOn = (it: ShopItem) => it.category === "background" ? (s.equipped.background ?? "clan-bg-standard") === it.id : it.category === "emblem" ? s.equipped.emblem === it.id : s.equipped.decos.includes(it.id);

  return (
    <div className="c2-wrapcol">
      <section className="c2-card c2-shop-head">
        <div>
          <h2>Лавка клана</h2>
          <p className="c2-sub">Покупка навсегда, установка бесплатная. Оформление ничего не даёт в играх — только внешний вид. Платит общая казна: AC или престиж.</p>
        </div>
        <div className="c2-wallets">
          <span><img src="/coin.png" alt="" width={20} height={20} /> {num(clan.vault)} AC</span>
          <span>✦ {num(clan.prestige)} престижа</span>
        </div>
      </section>
      <nav className="c2-subtabs" role="tablist">
        {CATS.map((c) => (
          <button key={c.id} role="tab" aria-selected={cat === c.id} onClick={() => setCat(c.id)}>{c.label} <i>{c.items.length}</i></button>
        ))}
      </nav>
      {note && <p className="c2-note" role="status">{note}</p>}
      {!manage && <p className="c2-err">Покупать и менять оформление могут офицеры и глава.</p>}
      <ul className="c2-shop">
        {items.map((it) => {
          const owned = isOwned(s, it.id);
          const on = isOn(it);
          const { currency, price } = it.id === "clan-bg-standard" ? { currency: "vault" as const, price: 0 } : priceOf(it);
          const emb = it.category === "emblem" ? emblemOf(it.id) : undefined;
          return (
            <li key={it.id} className={on ? "on" : ""} style={{ ["--rc" as string]: RARITY_COLOR[it.rarity] } as CSSProperties}>
              <div className="prev">
                {it.category === "background" && <span className="bgp" style={{ background: it.css, backgroundSize: it.backgroundSize }} />}
                {emb && <EmblemArt emblem={emb} size={116} interactive={false} />}
                {it.category === "decoration" && <span className="decop" style={{ ["--c" as string]: clan.color } as CSSProperties}><i className={`deco-${it.deco}`} /></span>}
              </div>
              <b>{it.name}</b>
              <small>{RARITY_LABEL[it.rarity]}</small>
              <p>{it.description}</p>
              {owned ? (
                <button type="button" disabled={!manage} className={on ? "act on" : "act"} onClick={() => say(equip(it.id, it.category === "decoration" ? !on : true), on ? "Снято" : "Установлено")}>
                  {on ? (it.category === "decoration" ? "Выключить" : "Установлено") : "Установить"}
                </button>
              ) : (
                <button type="button" disabled={!manage || (currency === "vault" ? clan.vault : clan.prestige) < price} onClick={() => say(buyItem(it.id), `Куплено: ${it.name}`)}>
                  {num(price)} {currency === "vault" ? "AC" : "✦"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
