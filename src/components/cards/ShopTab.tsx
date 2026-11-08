"use client";

/**
 * Магазин карт за рубли. Витрина наборов слева, подробности справа, ниже —
 * наборы алмазов. Цены и состав берутся из общего каталога оплат; оплату
 * создаёт сервер через окно `openCheckout`, выдача — после подтверждения.
 */

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { PRODUCTS, type PaymentProduct } from "@/lib/payments/catalog";
import { openCheckout } from "@/lib/checkout";
import { cardsOfRank } from "@/lib/cards/catalog";
import { PACK, RANKS } from "@/lib/cards/config";
import { view, type CardsState } from "@/lib/cards/client";
import { GameCard } from "./GameCard";
import { fmt } from "./common";
import { Cur, CurArt, Ico } from "./icons";

const BUNDLES = ["cards-starter", "cards-legend", "cards-mythic"] as const;
const GEMS = ["cards-gems-1", "cards-gems-2", "cards-gems-3", "cards-gems-4", "cards-gems-5"] as const;

const LOOK: Record<string, { tag: string; accent: string; blurb: string; img?: string }> = {
  "cards-starter": { tag: "Только один раз", accent: "#5aa8ff", blurb: "Быстрый старт коллекции: пачка паков, пыль на улучшения и свиток заточки.", img: "/cards/pack.webp" },
  "cards-legend": { tag: "Гарантия S", accent: "#ffb020", blurb: "Сундук с гарантированной легендарной картой ранга S и паками сверху." },
  "cards-mythic": { tag: "Гарантия SS", accent: "#ff4d6d", blurb: "Высшая ступень: мифическая карта ранга SS, запас паков и свиток для SS." },
};

const rub = (n: number) => `${n.toLocaleString("ru-RU")} ₽`;
const plural = (n: number, a: string, b: string, c: string) => (n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? b : c);

/** Что внутри набора — строками для витрины и окна оплаты */
function perksOf(p: PaymentProduct): string[] {
  const b = p.cards ?? {};
  const out: string[] = [];
  if (b.cardRank) out.push(`Гарантированная карта ранга ${RANKS[b.cardRank]?.short} (${RANKS[b.cardRank]?.name.toLowerCase()})`);
  if (b.packs) out.push(`${b.packs} ${plural(b.packs, "пак", "пака", "паков")} гачи`);
  if (b.diamonds) out.push(`${fmt(b.diamonds)} алмазов`);
  if (b.dust) out.push(`${fmt(b.dust)} пыли`);
  if (b.scroll) out.push(`Свиток заточки ${RANKS[b.scrollRank ?? 1]?.short ?? ""}`);
  return out;
}

/** Ценность набора в алмазах — для честной «выгоды» */
function worth(p: PaymentProduct): number {
  const b = p.cards ?? {};
  return (b.diamonds ?? 0) + (b.packs ?? 0) * PACK.diamonds + (b.cardRank === 4 ? 2400 : b.cardRank === 3 ? 600 : 0);
}

export function ShopTab({ s }: { s: CardsState }) {
  const [sel, setSel] = useState<(typeof BUNDLES)[number]>("cards-legend");
  const [bought, setBought] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    void view<{ bought: string[] }>("shop").then((r) => alive && r.ok && setBought(r.data.bought));
    return () => {
      alive = false;
    };
  }, []);

  const p = PRODUCTS[sel];
  const look = LOOK[sel];
  const done = p.once && bought.includes(p.id);
  const fan = useMemo(() => {
    const r = p.cards?.cardRank;
    if (!r) return [];
    const pool = cardsOfRank(r as 3 | 4);
    return [pool[0], pool[Math.floor(pool.length / 2)], pool[pool.length - 1]].filter(Boolean).map((c) => c.id);
  }, [p]);

  const buy = (prod: PaymentProduct) =>
    openCheckout({
      productId: prod.id,
      title: prod.title.replace(/^Гача · /, ""),
      caption: "Гача AniGalaxy · начисление сразу после оплаты",
      price: prod.price,
      oldPrice: prod.oldPrice,
      perks: perksOf(prod),
    });

  const base = PRODUCTS["cards-gems-1"];
  const baseRate = (base.cards?.diamonds ?? 1) / base.price;

  return (
    <div className="shp">
      <header className="shp-sec">
        <span className="shp-ico" aria-hidden>
          <Ico name="gift" size={20} />
        </span>
        <div>
          <h2>Магазин карт</h2>
          <p>Наборы за рубли · всё зачисляется в гачу сразу после оплаты</p>
        </div>
        <div className="shp-wallet" aria-label="Ваш баланс">
          <span>
            <Cur k="diamonds" /> {fmt(s.wallet.diamonds)}
          </span>
          <span>
            <Cur k="packs" /> {s.wallet.packs}
          </span>
          <span>
            <Cur k="dust" /> {fmt(s.wallet.dust)}
          </span>
        </div>
      </header>

      <div className="shp-panel">
        <aside className="shp-list">
          <p className="shp-eye">Выберите набор</p>
          {BUNDLES.map((id) => {
            const it = PRODUCTS[id];
            const lk = LOOK[id];
            const own = it.once && bought.includes(id);
            return (
              <button key={id} type="button" className={`shp-item${sel === id ? " on" : ""}`} style={{ "--ac": lk.accent } as CSSProperties} onClick={() => setSel(id)} aria-pressed={sel === id}>
                <span className="shp-thumb">
                  {it.cards?.cardRank ? <GameCard cardId={cardsOfRank(it.cards.cardRank as 3 | 4)[0]?.id ?? ""} stats={false} /> : <img src="/cards/pack.webp" alt="" />}
                </span>
                <span className="shp-it-t">
                  <small>{lk.tag}</small>
                  <b>{it.title.replace(/^Гача · /, "")}</b>
                  <em>{own ? "Уже куплен" : rub(it.price)}</em>
                </span>
              </button>
            );
          })}
        </aside>

        <section className="shp-main" style={{ "--ac": look.accent } as CSSProperties} aria-live="polite">
          <i className="shp-glow" aria-hidden />
          <div className="shp-art">
            {fan.length ? (
              <div className="shp-fan">
                {fan.map((id, i) => (
                  <span key={id} className={`f${i}`}>
                    <GameCard cardId={id} stats={false} live={i === 1} foil={i === 1} />
                  </span>
                ))}
              </div>
            ) : (
              <div className="shp-pack">
                <img src="/cards/pack.webp" alt="" />
                <span className="shp-x">×{p.cards?.packs ?? 0}</span>
              </div>
            )}
          </div>
          <div className="shp-info">
            <span className="shp-chip">
              <i aria-hidden /> {look.tag}
            </span>
            <h3>{p.title.replace(/^Гача · /, "")}</h3>
            <p className="shp-blurb">{look.blurb}</p>
            <ul className="shp-perks">
              {perksOf(p).map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            {p.cards?.cardRank ? (
              <div className="shp-guard">
                <p className="shp-eye">Гарантия</p>
                <div className="shp-g-row" style={{ "--rc": RANKS[p.cards.cardRank].color } as CSSProperties}>
                  <b>{RANKS[p.cards.cardRank].short}</b>
                  <span>
                    <strong>{RANKS[p.cards.cardRank].name}</strong>
                    <small>
                      Одна из {cardsOfRank(p.cards.cardRank as 3 | 4).length} карт ранга — выбирается сервером случайно. В паке шанс {p.cards.cardRank === 4 ? "0,1" : "0,4"}% за карту.
                    </small>
                  </span>
                </div>
              </div>
            ) : null}
            <div className="shp-buy">
              <button type="button" className="shp-btn" disabled={!!done} onClick={() => buy(p)}>
                {done ? "Уже куплен" : `Купить · ${rub(p.price)}`}
              </button>
              {p.oldPrice && !done ? (
                <span className="shp-old">
                  <s>{rub(p.oldPrice)}</s>
                  <em>−{Math.round((1 - p.price / p.oldPrice) * 100)}%</em>
                </span>
              ) : null}
              {worth(p) / p.price / baseRate > 1.25 && <span className="shp-val">выгоднее алмазов в {(worth(p) / p.price / baseRate).toFixed(1).replace(".", ",")} раза</span>}
            </div>
          </div>
        </section>
      </div>

      <header className="shp-sec">
        <span className="shp-ico" aria-hidden>
          <CurArt k="diamonds" size={22} />
        </span>
        <div>
          <h2>Алмазы</h2>
          <p>Пак стоит {PACK.diamonds} алмазов · чем больше набор, тем выше бонус</p>
        </div>
      </header>
      <div className="shp-gems">
        {GEMS.map((id, i) => {
          const it = PRODUCTS[id];
          const d = it.cards?.diamonds ?? 0;
          const bonus = Math.round((d / it.price / baseRate - 1) * 100);
          return (
            <button key={id} type="button" className={`shp-gem g${i}`} onClick={() => buy(it)}>
              {i === GEMS.length - 1 && <span className="shp-best">Лучшая цена</span>}
              <span className="shp-gem-art" aria-hidden>
                {Array.from({ length: Math.min(5, i + 1) }, (_, k) => (
                  <span key={k} className="shp-gm" style={{ width: 40 + i * 6, height: 40 + i * 6 }}>
                    <CurArt k="diamonds" size={40 + i * 6} />
                  </span>
                ))}
              </span>
              <b>{fmt(d)}</b>
              <small>{it.title.replace(/^Гача · /, "")}</small>
              {bonus > 0 ? <em>+{bonus}% бонус</em> : <em className="nb">≈ {Math.floor(d / PACK.diamonds)} {plural(Math.floor(d / PACK.diamonds), "пак", "пака", "паков")}</em>}
              <span className="shp-price">
                {it.oldPrice ? <s>{rub(it.oldPrice)}</s> : null}
                {rub(it.price)}
              </span>
            </button>
          );
        })}
      </div>
      <p className="shp-note">
        <Ico name="lock" size={14} /> Оплата картой или СБП через Platega. Карта гарантированного ранга выбирается на сервере в момент зачисления. Шансы обычных паков: SS 0,1%, S 0,4%, A 2,4%, B 21,5%, C 75,6% за карту; гарантия эпика — каждые {PACK.pityEpic} паков, легенды — каждые {PACK.pityLegend}.
      </p>
    </div>
  );
}
