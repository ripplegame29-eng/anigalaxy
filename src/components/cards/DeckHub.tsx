"use client";

import { act, type CardsState } from "@/lib/cards/client";
import { cardDef } from "@/lib/cards/catalog";
import { DECK_SIZE, type CardClass } from "@/lib/cards/config";
import { CLASS_ORDER, DECK_NAME_MAX, HERO_CLASSES, bonusText } from "@/lib/cards/heroclass";
import { SPELL_COLOR, SPELL_CRAFT, SPELL_DECK, SPELL_DROP, SPELL_DUST, SPELL_KIND, SPELL_RANK, SPELL_SCROLL, STARTER_SPELLS, TACTICS, type SpellKind } from "@/lib/cards/tactics";
import { SpellArt } from "./spellart";
import { useState } from "react";
import { toast, useBusy } from "./common";
import { Cur, Ico, type IcoName } from "./icons";

export const CLASS_ICO: Record<CardClass, IcoName> = { warrior: "swords", mage: "star", tank: "shield", assassin: "bolt", support: "heart" };

function useDeckCall() {
  const [busy, run] = useBusy();
  const call = (name: string, body: Record<string, unknown>) =>
    run(async () => {
      const r = await act(name, body);
      if (!r.ok) toast(r.error, true);
    });
  return { busy, call };
}

/** Ряд из пяти колод: клик делает колоду активной */
export function DeckRail({ s }: { s: CardsState }) {
  const { busy, call } = useDeckCall();
  const { slots, active } = s.decks;
  const inv = new Map(s.inventory.map((c) => [c.id, c]));
  return (
    <div className="dk-rail" role="tablist" aria-label="Колоды">
      {slots.map((d, i) => {
        const c = HERO_CLASSES[d.cls];
        return (
          <button key={i} type="button" role="tab" aria-selected={i === active} disabled={busy} className={`dk-tile ${i === active ? "on" : ""}`} style={{ ["--c" as string]: c.color }} onClick={() => i !== active && void call("decks-use", { slot: i })}>
            <span className="dk-port" aria-hidden>
              <span className="dk-em">
                <Ico name={CLASS_ICO[d.cls]} size={26} />
              </span>
            </span>
            <span className="dk-rib">
              <b>{d.name}</b>
            </span>
            <small>
              {c.name} · {d.ids.length}/{DECK_SIZE}
            </small>
            <span className="dk-mini" aria-hidden>
              {Array.from({ length: DECK_SIZE }, (_, k) => {
                const card = inv.get(d.ids[k]);
                return <i key={k}>{card ? <img src={`/api/cards/art/${card.cardId}?w=320`} alt="" draggable={false} /> : null}</i>;
              })}
            </span>
            {i === active && <em className="dk-act">Активна</em>}
          </button>
        );
      })}
    </div>
  );
}

/** Класс активной колоды: список классов и витрина способности выбранного */
export function ClassSection({ s }: { s: CardsState }) {
  const { busy, call } = useDeckCall();
  const { slots, active } = s.decks;
  const cur = slots[active];
  const def = HERO_CLASSES[cur.cls];
  const inv = new Map(s.inventory.map((c) => [c.id, c]));
  const own = cur.ids.filter((id) => cardDef(inv.get(id)?.cardId ?? "")?.cls === cur.cls).length;
  return (
    <div className="bt2-cls cg2-glass">
      <ul className="bt2-heroes" role="radiogroup" aria-label="Класс колоды">
        {CLASS_ORDER.map((k) => {
          const c = HERO_CLASSES[k];
          const on = cur.cls === k;
          return (
            <li key={k}>
              <button type="button" role="radio" aria-checked={on} disabled={busy} style={{ ["--c" as string]: c.color }} onClick={() => !on && void call("decks-save", { slot: active, cls: k })}>
                <span className="ring">
                  <img src={`/arena/cls-${CLASS_ORDER.indexOf(k)}.webp?v=4`} alt="" draggable={false} />
                </span>
                <b>{c.name}</b>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="bt2-ab" style={{ ["--c" as string]: def.color }}>
        <div className="bt2-ab-top">
          <span className="emb" aria-hidden>
            <Ico name={CLASS_ICO[cur.cls]} size={40} />
          </span>
          <div>
            <small>
              Способность класса · {def.title}
            </small>
            <h3>{def.power}</h3>
          </div>
        </div>
        <p>{def.desc}</p>
        <ul className="bt2-chips">
          <li>
            <em>Всем героям колоды</em>
            <b>{bonusText(def.all)}</b>
          </li>
          <li>
            <em>Героям класса «{def.name}»</em>
            <b>{bonusText(def.own)}</b>
          </li>
          <li className={own ? "ok" : undefined}>
            <em>Таких героев в колоде</em>
            <b>
              {own} из {DECK_SIZE}
            </b>
          </li>
        </ul>
        <label className="bt2-rn">
          <span>Название колоды</span>
          <input key={`${active}-${cur.name}`} defaultValue={cur.name} maxLength={DECK_NAME_MAX} disabled={busy} onBlur={(e) => e.target.value.trim() !== cur.name && void call("decks-save", { slot: active, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} />
        </label>
      </div>
    </div>
  );
}

type View = "all" | "own" | "new";

/** Коллекция карт боя и колода заклинаний: карты, которые игрок разыгрывает в бою (мана, рука из 3 карт) */
export function TacticsSection({ s }: { s: CardsState }) {
  const { busy, call } = useDeckCall();
  const [kind, setKind] = useState<SpellKind | "all">("all");
  const [view, setView] = useState<View>("all");
  const { slots, active } = s.decks;
  const tac = slots[active].tac;
  const own = new Set(s.spells.own);
  const fresh = new Set(s.spells.fresh);
  const ready = tac.length >= SPELL_DECK.min;
  const inDeck = tac.length ? tac : STARTER_SPELLS;
  const dust = s.wallet.dust;
  const toggle = (id: string) => {
    const next = tac.includes(id) ? tac.filter((x) => x !== id) : [...tac, id];
    if (!tac.includes(id) && next.length > SPELL_DECK.max) return toast(`В колоде заклинаний не больше ${SPELL_DECK.max} карт`, true);
    void call("decks-save", { slot: active, tac: next });
  };
  const craft = (id: string) => void call("spell-craft", { id });
  const scroll = () =>
    void call("spell-scroll", {}).then(() => undefined);
  const kinds = Object.keys(SPELL_KIND) as SpellKind[];
  const list = TACTICS.filter((d) => (kind === "all" || d.kind === kind) && (view === "all" || (view === "own" ? own.has(d.id) : fresh.has(d.id))));
  const ways: [string, string, string][] = [
    ["Победы в боях", `${Math.round(SPELL_DROP.ladder * 100)}–${Math.round(SPELL_DROP.raid * 100)}% на карту после победы: рейтинг, дуэли, кампания, рейд`, "swords"],
    ["Свиток карт боя", `${SPELL_SCROLL.count} случайные карты за ${SPELL_SCROLL.cost} пыли`, "scroll"],
    ["Создание", `Нужная карта за пыль: от ${SPELL_CRAFT[0]} до ${SPELL_CRAFT[3]}`, "anvil"],
    ["Повторы", `Дубликат сразу превращается в пыль: от ${SPELL_DUST[0]} до ${SPELL_DUST[3]}`, "dust"],
  ];
  return (
    <div className="bt2-tac">
      <div className="tac-top">
        <ul className="tac-ways">
          {ways.map(([h, d, ic]) => (
            <li key={h}>
              <Ico name={ic as IcoName} size={18} />
              <span>
                <b>{h}</b>
                <small>{d}</small>
              </span>
            </li>
          ))}
        </ul>
        <div className="tac-sum">
          <span>
            <em>Коллекция</em>
            <b>
              {own.size}
              <i>/{TACTICS.length}</i>
            </b>
          </span>
          <span className={ready ? "ok" : undefined}>
            <em>В колоде</em>
            <b>
              {inDeck.length}
              <i>/{SPELL_DECK.max}</i>
            </b>
          </span>
          <button type="button" className="cg-btn" disabled={busy || dust < SPELL_SCROLL.cost} onClick={scroll}>
            <Ico name="scroll" size={15} /> Свиток · {SPELL_SCROLL.cost} <Cur k="dust" size={14} />
          </button>
        </div>
      </div>
      <p className="tac-note">
        {ready ? "Ваша колода заклинаний собрана." : tac.length ? `Выберите ещё ${SPELL_DECK.min - tac.length} карт: пока играет стартовый набор.` : `Сейчас играет стартовый набор. Соберите свою колоду от ${SPELL_DECK.min} до ${SPELL_DECK.max} карт.`}
        {tac.length > 0 && (
          <button type="button" className="tac-reset" disabled={busy} onClick={() => void call("decks-save", { slot: active, tac: [] })}>
            Сбросить колоду
          </button>
        )}
      </p>
      <div className="tac-bar">
        <div className="tac-filter" role="tablist" aria-label="Тип карты">
          {(["all", ...kinds] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)}>
              {k === "all" ? "Все типы" : SPELL_KIND[k]}
            </button>
          ))}
        </div>
        <div className="tac-filter" role="tablist" aria-label="Коллекция">
          {([["all", "Все"], ["own", "Собранные"], ["new", `Новые${fresh.size ? ` · ${fresh.size}` : ""}`]] as [View, string][]).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => setView(k)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      {fresh.size > 0 && (
        <button type="button" className="tac-seen" disabled={busy} onClick={() => void call("spell-seen", {})}>
          Отметить новые карты просмотренными
        </button>
      )}
      <ul className="tac-grid">
        {list.map((d) => {
          const have = own.has(d.id);
          const on = have && inDeck.includes(d.id);
          const price = SPELL_CRAFT[d.rank];
          return (
            <li key={d.id}>
              <div className={`sp r-${d.rank}${on ? " on" : ""}${have ? "" : " lock"}`} style={{ ["--rc" as string]: SPELL_COLOR[d.rank] }}>
                <button type="button" className="sp-main" aria-pressed={on} disabled={busy || !have} onClick={() => toggle(d.id)} aria-label={`${d.name}, мана ${d.cost}`}>
                  <span className="sp-cost" aria-hidden>
                    {d.cost}
                  </span>
                  {fresh.has(d.id) && <em className="sp-new">Новая</em>}
                  <SpellArt id={d.id} fx={d.fx} />
                  <span className="sp-name">{d.name}</span>
                  <span className="sp-txt">{d.desc}</span>
                  <span className="sp-foot">
                    <i className="sp-gem" />
                    {SPELL_RANK[d.rank]} · {SPELL_KIND[d.kind]}
                  </span>
                  {on && <em className="sp-in">В колоде</em>}
                </button>
                {!have && (
                  <button type="button" className="sp-craft" disabled={busy || dust < price} onClick={() => craft(d.id)}>
                    Создать · {price} <Cur k="dust" size={13} />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
