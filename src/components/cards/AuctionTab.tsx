"use client";

import { PSelect } from "@/components/PSelect";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cardDef } from "@/lib/cards/catalog";
import { AUCTION, RANKS } from "@/lib/cards/config";
import { act, view, type CardsState } from "@/lib/cards/client";
import { GameCard } from "./GameCard";
import { InvPicker, Panel, RankFilter, Stepper, fmt, fmtLeft, toast, useBusy, useNow } from "./common";
import { Cur, Ico } from "./icons";

interface Lot {
  id: number;
  sellerId: number;
  sellerNick: string;
  cardId: string;
  foil: boolean;
  level: number;
  rank: number;
  startPrice: number;
  bid: number;
  bidderId: number;
  bidderNick: string;
  bids: number;
  endsAt: number;
  status: string;
  minNext: number;
}
interface Data {
  lots: Lot[];
  mine: { selling: Lot[]; bidding: Lot[]; closed: Lot[] };
}

export function AuctionTab({ s, me }: { s: CardsState; me: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [sub, setSub] = useState<"market" | "mine" | "sell">("market");
  const [rank, setRank] = useState(-1);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("ending");
  const [bidFor, setBidFor] = useState<Lot | null>(null);
  const [amount, setAmount] = useState(0);
  const [busy, run] = useBusy();
  const now = useNow();

  const load = useCallback(async () => {
    const r = await view<Data>("auction", `&rank=${rank}&q=${encodeURIComponent(q)}&sort=${sort}`);
    if (r.ok) setData(r.data);
  }, [rank, q, sort]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    const id = setInterval(() => void load(), 15000);
    return () => {
      clearTimeout(t);
      clearInterval(id);
    };
  }, [load, s.wallet.diamonds]);

  const openBid = (l: Lot) => {
    setBidFor(l);
    setAmount(l.minNext);
  };
  const placeBid = () =>
    run(async () => {
      if (!bidFor) return;
      const r = await act("auction-bid", { id: bidFor.id, amount });
      if (!r.ok) return toast(r.error, true);
      toast("Ставка принята");
      setBidFor(null);
      void load();
    });

  const lotCard = (l: Lot, mine = false) => {
    const d = cardDef(l.cardId);
    const left = l.endsAt - now;
    return (
      <div key={l.id} className="cg-lot">
        <GameCard cardId={l.cardId} foil={l.foil} level={l.level} />
        <div className="cg-row" style={{ justifyContent: "space-between", fontSize: 13 }}>
          <span className={`cg-timer ${left < 600_000 ? "hot" : ""}`}><Ico name="clock" size={14} /> {fmtLeft(left)}</span>
          <span style={{ color: RANKS[l.rank].color, fontWeight: 800 }}>{RANKS[l.rank].short}</span>
        </div>
        <div style={{ fontSize: 13 }}>
          {l.bid > 0 ? (
            <>
              Ставка: <b>{fmt(l.bid)} <Cur k="diamonds" /></b> · {l.bidderNick} ({l.bids})
            </>
          ) : (
            <>
              Старт: <b>{fmt(l.startPrice)} <Cur k="diamonds" /></b>
            </>
          )}
          <br />
          <small style={{ color: "var(--cg-mut)" }}>Продавец: {l.sellerNick}</small>
        </div>
        {mine ? (
          l.bids === 0 ? (
            <button type="button" className="cg-btn sm danger" disabled={busy} onClick={() => void run(async () => { const r = await act("auction-cancel", { id: l.id }); toast(r.ok ? "Лот снят" : r.error, !r.ok); void load(); })}>
              Снять лот
            </button>
          ) : null
        ) : (
          <button type="button" className="cg-btn sm pri" disabled={left <= 0 || l.sellerNick === me || l.bidderNick === me} onClick={() => openBid(l)} title={d?.name}>
            {l.bidderNick === me ? "Ваша ставка лидирует" : l.sellerNick === me ? "Ваш лот" : <>Ставка от {fmt(l.minNext)} <Cur k="diamonds" /></>}
          </button>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="cg-sub" role="group">
        {(
          [
            ["market", "Лоты"],
            ["mine", "Мои ставки и лоты"],
            ["sell", "Выставить карту"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" aria-pressed={sub === id} onClick={() => setSub(id)}>
            {label}
          </button>
        ))}
      </div>

      {sub === "market" && (
        <Panel title="Аукцион" hint={`Ставки в алмазах. Комиссия продавцу ${AUCTION.feePct}%. Ставка за последние 2 минуты продлевает торги. Перебитая ставка возвращается сразу.`}>
          <div className="cg-row" style={{ marginBottom: 12 }}>
            <input className="cg-input" placeholder="Имя персонажа или аниме" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: "1 1 200px" }} />
            <PSelect className="cg-input" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Сортировка">
              <option value="ending">Скоро закончатся</option>
              <option value="price">Дешевле</option>
              <option value="rank">Ранг выше</option>
            </PSelect>
          </div>
          <RankFilter value={rank} onChange={setRank} />
          {!data ? (
            <div className="cg-empty">Загрузка…</div>
          ) : data.lots.length === 0 ? (
            <div className="cg-empty">Лотов нет. Выставьте свою карту — это быстрый способ получить алмазы.</div>
          ) : (
            <div className="cg-lots">{data.lots.map((l) => lotCard(l))}</div>
          )}
        </Panel>
      )}

      {sub === "mine" && (
        <div style={{ display: "grid", gap: 16 }}>
          <Panel title="Мои лоты">{data && data.mine.selling.length ? <div className="cg-lots">{data.mine.selling.map((l) => lotCard(l, true))}</div> : <div className="cg-empty">У вас нет активных лотов</div>}</Panel>
          <Panel title="Мои ставки">{data && data.mine.bidding.length ? <div className="cg-lots">{data.mine.bidding.map((l) => lotCard(l))}</div> : <div className="cg-empty">Вы пока не делали ставок</div>}</Panel>
          <Panel title="Завершённые">
            {data && data.mine.closed.length ? (
              <ul className="cg-list">
                {data.mine.closed.map((l) => (
                  <li key={l.id}>
                    <span>{cardDef(l.cardId)?.name}</span>
                    <span>{l.status === "sold" ? <>продано за {fmt(l.bid)} <Cur k="diamonds" /></> : "не продано"}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="cg-empty">История пуста</div>
            )}
          </Panel>
        </div>
      )}

      {sub === "sell" && <Sell s={s} onDone={() => { setSub("mine"); void load(); }} />}

      {bidFor && (
        <div className="cg-modal" role="dialog" aria-modal="true" onClick={() => setBidFor(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ display: "grid", gap: 14, justifyItems: "center" }}>
            <div style={{ width: 180 }}>
              <GameCard cardId={bidFor.cardId} foil={bidFor.foil} level={bidFor.level} />
            </div>
            <b>{cardDef(bidFor.cardId)?.name}</b>
            <p className="cg-hint" style={{ margin: 0 }}>
              Минимальная ставка {fmt(bidFor.minNext)} <Cur k="diamonds" />. У вас {fmt(s.wallet.diamonds)} <Cur k="diamonds" />.
            </p>
            <Stepper label="Ставка" value={amount} min={bidFor.minNext} step={10} onChange={setAmount} width={200} />
            <div className="cg-row">
              <button type="button" className="cg-btn pri" disabled={busy || amount < bidFor.minNext} onClick={() => void placeBid()}>
                Сделать ставку
              </button>
              <button type="button" className="cg-btn" onClick={() => setBidFor(null)}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Sell({ s, onDone }: { s: CardsState; onDone: () => void }) {
  const [id, setId] = useState<number | null>(null);
  const [price, setPrice] = useState(100);
  const [hours, setHours] = useState(24);
  const [rank, setRank] = useState(-1);
  const [busy, run] = useBusy();
  const pool = useMemo(() => s.inventory.filter((c) => !c.locked && !c.listed), [s.inventory]);
  const card = s.inventory.find((c) => c.id === id);
  const go = () =>
    run(async () => {
      const r = await act("auction-create", { id, price, hours });
      if (!r.ok) return toast(r.error, true);
      toast("Лот выставлен");
      setId(null);
      onDone();
    });
  return (
    <div className="cg-grid2">
      <Panel title="Новый лот" hint={`Стартовая цена от ${AUCTION.minPrice} алмазов, срок от ${AUCTION.minHours} до ${AUCTION.maxHours} часов. Пока лот активен, карта заморожена. Лот без ставок можно снять.`}>
        <div style={{ display: "grid", gap: 12, justifyItems: "start" }}>
          <div style={{ width: 170 }}>{card ? <GameCard cardId={card.cardId} foil={card.foil} level={card.level} /> : <div className="cg-slot">Выберите карту</div>}</div>
          <div className="cg-field" style={{ fontSize: 13 }}>
            <span>Стартовая цена (алмазы)</span>
            <Stepper label="Стартовая цена" value={price} min={AUCTION.minPrice} step={10} onChange={setPrice} width={200} />
          </div>
          <label className="cg-row" style={{ fontSize: 13 }}>
            Срок
            <PSelect className="cg-input" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
              {[1, 6, 12, 24, 48].map((h) => (
                <option key={h} value={h}>
                  {h} ч
                </option>
              ))}
            </PSelect>
          </label>
          <button type="button" className="cg-btn gold" disabled={busy || !id} onClick={() => void go()}>
            Выставить
          </button>
        </div>
      </Panel>
      <Panel title="Ваши карты">
        <RankFilter value={rank} onChange={setRank} />
        <InvPicker cards={pool} selected={id ? [id] : []} onToggle={(x) => setId(x === id ? null : x)} max={1} size="xs" rankFilter={rank} />
      </Panel>
    </div>
  );
}
