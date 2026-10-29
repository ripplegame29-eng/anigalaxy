"use client";

/** Магазин и казна: взнос монет, наборы кристаллов, оформление клана, места в составе. */

import { useMemo, useState } from "react";
import {
  CLAN_ITEMS,
  CRYSTAL_PACKS,
  CRYSTAL_PRICE,
  DONATE_MAX,
  DONATE_MIN,
  DONOR_TIERS,
  RARITY_NAME,
  SLOT_PACK,
  TREASURY_PRICE,
  donorTier,
  type ClanItem,
  type ItemSlot,
} from "@/lib/clan-rules";
import { CrystalIcon, DonorMedal, ItemArt } from "./ClanArt";
import { Btn, Ico, Panel, fmt, useClan } from "./common";

const SLOT_NAME: Record<ItemSlot, string> = { banner: "Знамёна", aura: "Ауры", frame: "Рамки" };
const QUICK = [100, 500, 1000, 5000];

export function ShopTab() {
  const { me, clan, role, manage, act, notify, reload } = useClan();
  const [amount, setAmount] = useState(100);
  const [busy, setBusy] = useState("");
  const owned = useMemo(() => new Set(me.owned ?? []), [me.owned]);
  const equipped = me.data?.equipped ?? {};
  const items: readonly ClanItem[] = me.catalog?.length ? me.catalog : CLAN_ITEMS;
  const tier = donorTier(me.donorRub ?? 0);
  const amountOk = Number.isFinite(amount) && amount >= DONATE_MIN && amount <= DONATE_MAX;

  const buyPack = async (pack: string) => {
    setBusy(pack);
    try {
      const res = await fetch("/api/clans/shop", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pack }) });
      const data = (await res.json().catch(() => ({}))) as { error?: string; checkoutUrl?: string; demo?: boolean };
      if (!res.ok) return notify("err", data.error ?? "Не получилось оформить заказ");
      if (typeof data.checkoutUrl === "string") {
        window.location.assign(data.checkoutUrl);
        return;
      }
      notify("ok", "Тестовая оплата: кристаллы зачислены");
      await reload();
    } catch {
      notify("err", "Нет связи с сервером");
    } finally {
      setBusy("");
    }
  };
  const doAct = async (key: string, action: string, body: Record<string, unknown>, ok: string) => {
    setBusy(key);
    await act(action, body, ok);
    setBusy("");
  };

  return (
    <div className="ca-shop">
      <Panel className="ca-treasury" title="Казна клана" icon="coin">
        <div className="ca-tre">
          <div className="ca-tre-bal">
            <b>{fmt(clan.treasury)}</b>
            <span>AC в казне</span>
          </div>
          <div className="ca-tre-form">
            <p className="ca-dim">Монеты казны тратятся на обычное и редкое оформление. Взнос списывается с вашего баланса.</p>
            <div className="ca-quick" role="group" aria-label="Быстрый выбор суммы">
              {QUICK.map((v) => (
                <button key={v} type="button" className={amount === v ? "on" : ""} onClick={() => setAmount(v)}>
                  {fmt(v)}
                </button>
              ))}
            </div>
            <div className="ca-row ca-row-nowrap">
              <input className="ca-input" type="number" inputMode="numeric" min={DONATE_MIN} max={DONATE_MAX} value={Number.isNaN(amount) ? "" : amount} onChange={(e) => setAmount(Number(e.target.value))} aria-label="Сумма взноса" />
              <Btn kind="gold" disabled={!amountOk || busy === "donate"} onClick={() => void doAct("donate", "donate", { ac: Math.floor(amount) }, "Взнос внесён в казну")}>
                Внести
              </Btn>
            </div>
            {!amountOk && (
              <small className="ca-dim">
                От {DONATE_MIN} до {fmt(DONATE_MAX)} AC за раз
              </small>
            )}
          </div>
        </div>
      </Panel>

      <Panel
        title="Кристаллы клана"
        icon="bolt"
        className="ca-crystals"
        aside={
          <span className="ca-chip">
            <CrystalIcon size={14} /> <b>{fmt(clan.crystals)}</b>
          </span>
        }
      >
        <p className="ca-dim">Кристаллы покупают только оформление и места в составе. Очки сезона, лигу и награды купить нельзя — клан растёт за счёт активности игроков.</p>
        <div className="ca-packs">
          {CRYSTAL_PACKS.map((p, i) => (
            <button key={p.id} type="button" className={`ca-pack p${i}`} disabled={!!busy} onClick={() => void buyPack(p.id)}>
              {p.note && <em>{p.note}</em>}
              <CrystalIcon size={30 + i * 6} />
              <b>{p.name}</b>
              <span>{fmt(p.crystals)}</span>
              <strong>{p.rub} ₽</strong>
            </button>
          ))}
        </div>
        <div className="ca-donor">
          {tier ? (
            <span className="ca-donor-me">
              <DonorMedal color={tier.color} size={26} /> Ваш титул: <b style={{ color: tier.color }}>{tier.name}</b>
            </span>
          ) : (
            <span className="ca-dim">Титулов спонсора пока нет.</span>
          )}
          <span className="ca-dim">{[...DONOR_TIERS].reverse().map((t) => `${t.name} от ${fmt(t.from)} ₽`).join(" · ")}</span>
        </div>
      </Panel>

      <Panel title="Оформление клана" icon="shop" className="ca-items-p" aside={!manage && <span className="ca-dim">Покупают глава и офицеры</span>}>
        {(["banner", "aura", "frame"] as const).map((slot) => (
          <div key={slot} className="ca-itemgroup">
            <h3>{SLOT_NAME[slot]}</h3>
            <div className="ca-items">
              {items
                .filter((it) => it.slot === slot)
                .map((it) => {
                  const has = owned.has(it.id);
                  const on = equipped[it.slot] === it.id;
                  const tr = it.rarity === "common" || it.rarity === "rare" ? TREASURY_PRICE[it.rarity] : 0;
                  const cr = CRYSTAL_PRICE[it.rarity];
                  return (
                    <div key={it.id} className={`ca-item r-${it.rarity}${on ? " on" : ""}${has ? " has" : ""}`}>
                      {on && <i className="ca-item-on">Надето</i>}
                      <div className="ca-item-art">
                        <ItemArt item={it} size={88} />
                      </div>
                      <b>{it.name}</b>
                      <small>{RARITY_NAME[it.rarity]}</small>
                      {has ? (
                        <Btn size="sm" kind={on ? "ghost" : "primary"} disabled={!manage || busy === it.id} onClick={() => void doAct(it.id, "equip", { slot: it.slot, itemId: on ? null : it.id }, on ? "Снято" : "Надето")}>
                          {on ? "Снять" : "Надеть"}
                        </Btn>
                      ) : (
                        <div className="ca-buy">
                          {tr > 0 && (
                            <Btn size="sm" disabled={!manage || clan.treasury < tr || busy === it.id} onClick={() => void doAct(it.id, "buy", { itemId: it.id, currency: "treasury" }, "Куплено за монеты казны")}>
                              <Ico n="coin" size={13} /> {fmt(tr)}
                            </Btn>
                          )}
                          <Btn size="sm" disabled={!manage || clan.crystals < cr || busy === it.id} onClick={() => void doAct(it.id, "buy", { itemId: it.id, currency: "crystals" }, "Куплено за кристаллы")}>
                            <CrystalIcon size={12} /> {cr}
                          </Btn>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </Panel>

      <Panel title={SLOT_PACK.name} icon="roster" className="ca-slots">
        <div className="ca-slots-in">
          <div className="ca-slots-meter">
            <div className="ca-bar ca-bar-lg">
              <i style={{ width: `${(clan.extraSlots / SLOT_PACK.max) * 100}%` }} />
            </div>
            <span className="ca-dim">
              Сейчас мест: <b>{clan.cap}</b> · куплено дополнительных {clan.extraSlots} из {SLOT_PACK.max}
            </span>
          </div>
          <Btn kind="primary" disabled={role !== "leader" || clan.crystals < SLOT_PACK.crystals || clan.extraSlots >= SLOT_PACK.max || busy === "slots"} onClick={() => void doAct("slots", "slots", {}, "Места добавлены")}>
            <CrystalIcon size={14} /> {SLOT_PACK.crystals} · +{SLOT_PACK.slots} мест
          </Btn>
        </div>
        {role !== "leader" && <small className="ca-dim">Места покупает глава клана.</small>}
      </Panel>
    </div>
  );
}
