"use client";

/**
 * Витрина оформления клана: примерочная сверху (герб клана с выбранными
 * знаменем, аурой и рамкой), под ней — вкладки и карточки предметов.
 * Клик по карточке примеряет предмет, покупка и «Надеть» — в панели справа.
 */

import { useMemo, useState } from "react";
import { CRYSTAL_PRICE, RARITY_NAME, TREASURY_PRICE, clanItem, type ClanItem, type ItemSlot } from "@/lib/clan-rules";
import "../../app/clans-shop.css";
import { CrystalIcon } from "./ClanArt";
import { BannerArt, CrestStage } from "./ClanCosmetics";
import { Btn, Ico, fmt, useClan } from "./common";

const TABS: { id: ItemSlot; label: string; hint: string }[] = [
  { id: "aura", label: "Ауры", hint: "Сияние вокруг герба" },
  { id: "frame", label: "Рамки", hint: "Оправа герба" },
];
const RANK: Record<ClanItem["rarity"], number> = { common: 0, rare: 1, epic: 2, legendary: 3 };

export function ClanShowcase({
  items,
  owned,
  equipped,
  busy,
  doAct,
}: {
  items: readonly ClanItem[];
  owned: Set<string>;
  equipped: Record<string, string>;
  busy: string;
  doAct: (key: string, action: string, body: Record<string, unknown>, ok: string) => Promise<void>;
}) {
  const { clan, manage } = useClan();
  const [tab, setTab] = useState<ItemSlot>("aura");
  /** Примерка: что показать в примерочной поверх надетого */
  const [tryOn, setTryOn] = useState<Partial<Record<ItemSlot, string>>>({});
  const [sel, setSel] = useState<string>("");

  const list = useMemo(() => items.filter((i) => i.slot === tab).sort((a, b) => RANK[a.rarity] - RANK[b.rarity]), [items, tab]);
  const pick = (it: ClanItem) => {
    setSel(it.id);
    setTryOn((t) => ({ ...t, [it.slot]: it.id }));
  };
  const look = (slot: ItemSlot) => clanItem(tryOn[slot] ?? equipped[slot] ?? "");
  const banner = look("banner");
  const aura = look("aura");
  const frame = look("frame");
  const cur = clanItem(sel) ?? list.find((i) => equipped[i.slot] === i.id) ?? list[list.length - 1];
  const fitting = Object.entries(tryOn).some(([slot, id]) => id && equipped[slot] !== id);

  const has = cur ? owned.has(cur.id) : false;
  const on = cur ? equipped[cur.slot] === cur.id : false;
  const tr = cur && (cur.rarity === "common" || cur.rarity === "rare") ? TREASURY_PRICE[cur.rarity] : 0;
  const cr = cur ? CRYSTAL_PRICE[cur.rarity] : 0;
  const ownedCount = (slot: ItemSlot) => items.filter((i) => i.slot === slot && owned.has(i.id)).length;

  return (
    <section className="cx-shop">
      <div className="cx-head">
        <div>
          <span className="cx-eye">
            <Ico n="star" size={13} /> Витрина клана
          </span>
          <h2>Оформление герба</h2>
          <p>Ауры и рамки видят все — в шапке клана, в поиске и на войне. Нажмите на предмет, чтобы примерить.</p>
        </div>
        <div className="cx-wallet">
          <span title="Монеты казны">
            <Ico n="coin" size={15} /> <b>{fmt(clan.treasury)}</b>
          </span>
          <a href="#clan-crystals" className="cx-topup" title="Пополнить кристаллы клана">
            <CrystalIcon size={13} /> <b>{fmt(clan.crystals)}</b> <i aria-hidden>+</i>
          </a>
        </div>
      </div>

      <div className="cx-fit">
        <div className={`cx-fit-stage r-${cur?.rarity ?? "common"}`}>
          <i className="cx-fit-light" aria-hidden />
          <i className="cx-fit-floor" aria-hidden />
          {banner && (
            <span className="cx-fit-banner cx-live" aria-hidden>
              <BannerArt item={banner} size={300} />
            </span>
          )}
          <span className="cx-fit-crest">
            <CrestStage clanId={clan.id} emblemId={clan.emblem} avatarV={clan.avatarV ?? 0} size={190} aura={aura} frame={frame} />
          </span>
          <span className="cx-fit-name">
            {clan.name} <em>[{clan.tag}]</em>
          </span>
          {fitting && (
            <button type="button" className="cx-fit-reset" onClick={() => { setTryOn({}); setSel(""); }}>
              <Ico n="x" size={13} /> Снять примерку
            </button>
          )}
        </div>

        {cur && (
          <aside className={`cx-info r-${cur.rarity}`}>
            <span className="cx-rar">{RARITY_NAME[cur.rarity]}</span>
            <h3>{cur.name}</h3>
            <p>{cur.desc}</p>
            <div className="cx-info-art">
              <CrestStage clanId={clan.id} emblemId={clan.emblem} avatarV={clan.avatarV ?? 0} size={120} aura={cur.slot === "aura" ? cur : undefined} frame={cur.slot === "frame" ? cur : undefined} />
            </div>
            <div className="cx-info-act">
              {has ? (
                <Btn kind={on ? "ghost" : "primary"} disabled={!manage || busy === cur.id} onClick={() => void doAct(cur.id, "equip", { slot: cur.slot, itemId: on ? null : cur.id }, on ? "Снято" : "Надето")}>
                  {on ? "Снять" : "Надеть на герб"}
                </Btn>
              ) : (
                <>
                  {tr > 0 && (
                    <Btn disabled={!manage || clan.treasury < tr || busy === cur.id} onClick={() => void doAct(cur.id, "buy", { itemId: cur.id, currency: "treasury" }, "Куплено за монеты казны")}>
                      <Ico n="coin" size={15} /> {fmt(tr)}
                    </Btn>
                  )}
                  <Btn kind="gold" disabled={!manage || clan.crystals < cr || busy === cur.id} onClick={() => void doAct(cur.id, "buy", { itemId: cur.id, currency: "crystals" }, "Куплено за кристаллы")}>
                    <CrystalIcon size={14} /> {fmt(cr)}
                  </Btn>
                </>
              )}
            </div>
            <small className="cx-note">
              {!manage
                ? "Покупают и надевают глава и офицеры"
                : has
                  ? on
                    ? "Сейчас на гербе клана"
                    : "В коллекции клана"
                  : tr > 0
                    ? "Можно оплатить монетами казны или кристаллами"
                    : clan.crystals < cr
                      ? <>Не хватает {fmt(cr - clan.crystals)} кристаллов · <a href="#clan-crystals">пополнить</a></>
                      : "Эпические и легендарные — только за кристаллы"}
            </small>
          </aside>
        )}
      </div>

      <div className="cx-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? "on" : ""} onClick={() => { setTab(t.id); setSel(""); }}>
            <b>{t.label}</b>
            <small>
              {ownedCount(t.id)}/{items.filter((i) => i.slot === t.id).length} · {t.hint}
            </small>
          </button>
        ))}
      </div>

      <div className="cx-grid">
        {list.map((it) => {
          const mine = owned.has(it.id);
          const wear = equipped[it.slot] === it.id;
          const trP = it.rarity === "common" || it.rarity === "rare" ? TREASURY_PRICE[it.rarity] : 0;
          return (
            <button key={it.id} type="button" className={`cx-card r-${it.rarity}${cur?.id === it.id ? " sel" : ""}${wear ? " wear" : ""}`} onClick={() => pick(it)}>
              <i className="cx-card-glow" aria-hidden />
              <span className="cx-card-rar">{RARITY_NAME[it.rarity]}</span>
              {wear ? <span className="cx-card-tag on">Надето</span> : mine ? <span className="cx-card-tag">Есть</span> : null}
              <span className="cx-card-art">
                <CrestStage clanId={clan.id} emblemId={clan.emblem} avatarV={clan.avatarV ?? 0} size={84} aura={it.slot === "aura" ? it : undefined} frame={it.slot === "frame" ? it : undefined} />
              </span>
              <b>{it.name}</b>
              <small>{it.desc}</small>
              <span className="cx-card-price">
                {mine ? (
                  <em>{wear ? "На гербе" : "В коллекции"}</em>
                ) : (
                  <>
                    {trP > 0 && (
                      <span>
                        <Ico n="coin" size={12} /> {fmt(trP)}
                      </span>
                    )}
                    <span className="cr">
                      <CrystalIcon size={11} /> {fmt(CRYSTAL_PRICE[it.rarity])}
                    </span>
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
