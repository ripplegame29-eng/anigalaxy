"use client";

/** Клановый рынок: наборы паков и боевые бустеры за алмазы со скидкой клана, лимиты на неделю. */

import { useCallback, useEffect, useState } from "react";
import { MARKET, type MarketItem } from "@/lib/clan-market";
import { CLAN_ITEMS, SLOT_PACK, type ClanItem } from "@/lib/clan-rules";
import { ClanShowcase } from "./ClanShowcase";
import { CrystalPacks } from "./CrystalPacks";
import { useMemo } from "react";
import { refresh as refreshCards } from "@/lib/cards/client";
import { Ico as CardIco } from "@/components/cards/icons";
import { CrystalIcon } from "./ClanArt";
import { Btn, Panel, countdown, fmt, useClan, useNow } from "./common";

interface View { diamonds: number; bought: Record<string, number>; weekEndsAt: number }

const ART: Record<string, string> = { "pack-s": "/cards/offers/1.webp", "pack-m": "/cards/offers/2.webp", "pack-l": "/cards/offers/3.webp", };
const BOOST: Record<string, { ico: "bolt" | "shield" | "fire" | "target" | "heart"; c: string }> = {
  "b-stim": { ico: "bolt", c: "#ffb547" },
  "b-aegis": { ico: "shield", c: "#5aa8ff" },
  "b-surge": { ico: "fire", c: "#b483ff" },
  "b-focus": { ico: "target", c: "#ff6b7d" },
  "b-feather": { ico: "heart", c: "#5ee0a8" },
};

function Art({ item }: { item: MarketItem }) {
  const img = ART[item.art];
  if (img)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={img} alt="" loading="lazy" />;
  const b = BOOST[item.art];
  return (
    <span className="mk-boost" style={{ ["--bc" as string]: b.c }}>
      <CardIco name={b.ico} size={44} />
    </span>
  );
}

export function ShopTab() {
  const { me, clan, role, act } = useClan();
  const owned = useMemo(() => new Set(me.owned ?? []), [me.owned]);
  const items: readonly ClanItem[] = (me.catalog?.length ? me.catalog : CLAN_ITEMS).filter((i) => i.slot !== "banner");
  const [cbusy, setCbusy] = useState("");
  const doAct = async (key: string, action: string, body: Record<string, unknown>, ok: string) => { setCbusy(key); await act(action, body, ok); setCbusy(""); };
  const now = useNow();
  const [v, setV] = useState<View | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/clans/market", { cache: "no-store" });
      if (r.ok) setV((await r.json()) as View);
    } catch { /* повторим при покупке */ }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const buy = async (item: MarketItem) => {
    setBusy(item.id); setMsg(null);
    try {
      const r = await fetch("/api/clans/market", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: item.id }) });
      const d = (await r.json()) as View & { error?: string };
      if (r.ok) { setV(d); setMsg({ ok: true, text: `«${item.name}» в вашем запасе` }); void refreshCards(); }
      else setMsg({ ok: false, text: d.error ?? "Не получилось" });
    } catch { setMsg({ ok: false, text: "Нет связи с сервером" }); }
    setBusy("");
  };

  const card = (item: MarketItem) => {
    const n = v?.bought[item.id] ?? 0;
    const left = item.limit - n;
    const locked = clan.level < item.level;
    const poor = (v?.diamonds ?? 0) < item.price;
    const off = Math.round((1 - item.price / item.base) * 100);
    return (
      <article key={item.id} className={`mk-item${locked ? " is-locked" : ""}`}>
        <div className="mk-art"><Art item={item} /></div>
        <div className="mk-body">
          <h3>{item.name}</h3>
          <p>{item.desc}</p>
          <div className="mk-meta">
            <span>−{off}% для клана</span>
            <span>{locked ? `с ${item.level} ур. клана` : `осталось ${Math.max(0, left)} из ${item.limit}`}</span>
          </div>
        </div>
        <button type="button" className="mk-buy" disabled={locked || left <= 0 || poor || busy === item.id || !v} onClick={() => void buy(item)}>
          <span className="mk-price"><img src="/icons/cur-diamonds.webp" alt="" /> {fmt(item.price)}</span>
          <s>{fmt(item.base)}</s>
        </button>
      </article>
    );
  };

  return (
    <div className="mk">
      <Panel
        className="mk-head"
        title="Клановый рынок"
        icon="shop"
        aside={<span className="mk-bal"><img src="/icons/cur-diamonds.webp" alt="" /> <b>{v ? fmt(v.diamonds) : "…"}</b> алмазов</span>}
      >
        <p className="ca-dim">Паки и бустеры для боёв дешевле, чем в гаче. Покупаете себе: всё сразу падает в ваш запас карт. Лимиты обновятся через {v && now ? countdown(v.weekEndsAt - now) : "…"}.</p>
        {msg && <p className={msg.ok ? "mk-ok" : "ca-err"}>{msg.text}</p>}
      </Panel>

      <ClanShowcase items={items} owned={owned} equipped={me.data?.equipped ?? {}} busy={cbusy} doAct={doAct} />

      <CrystalPacks />

      <section className="mk-sec">
        <h2>Наборы героев</h2>
        <div className="mk-grid mk-grid-packs">{MARKET.filter((m) => m.group === "packs").map(card)}</div>
      </section>

      <section className="mk-sec">
        <h2>Бустеры для боя</h2>
        <div className="mk-grid">{MARKET.filter((m) => m.group === "boost").map(card)}</div>
      </section>

      <Panel title={SLOT_PACK.name} icon="roster" className="ca-slots">
        <div className="ca-slots-in">
          <div className="ca-slots-meter">
            <div className="ca-bar ca-bar-lg"><i style={{ width: `${(clan.extraSlots / SLOT_PACK.max) * 100}%` }} /></div>
            <span className="ca-dim">Сейчас мест: <b>{clan.cap}</b> · куплено дополнительных {clan.extraSlots} из {SLOT_PACK.max}</span>
          </div>
          <Btn kind="primary" disabled={role !== "leader" || clan.crystals < SLOT_PACK.crystals || clan.extraSlots >= SLOT_PACK.max} onClick={() => void act("slots", {}, "Места добавлены")}>
            <CrystalIcon size={14} /> {SLOT_PACK.crystals} · +{SLOT_PACK.slots} мест
          </Btn>
        </div>
      </Panel>
    </div>
  );
}
