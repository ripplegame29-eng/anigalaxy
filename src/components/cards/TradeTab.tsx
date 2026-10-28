"use client";

import { useCallback, useEffect, useState } from "react";
import { cardDef } from "@/lib/cards/catalog";
import { act, view, type CardsState, type InvCard } from "@/lib/cards/client";
import { GameCard } from "./GameCard";
import { InvPicker, Panel, toast, useBusy } from "./common";

interface Trade {
  id: number;
  fromNick: string;
  toNick: string;
  give: InvCard[];
  want: InvCard[];
  note: string;
  status: string;
  resolvedAt: number;
  createdAt: number;
}
interface Trades {
  incoming: Trade[];
  outgoing: Trade[];
  history: Trade[];
}

const STATUS: Record<string, string> = { accepted: "принято", declined: "отклонено", cancelled: "отменено", pending: "ожидает" };

export function TradeTab({ s }: { s: CardsState }) {
  const [sub, setSub] = useState<"in" | "out" | "history" | "new">("in");
  const [data, setData] = useState<Trades | null>(null);
  const [busy, run] = useBusy();
  const load = useCallback(async () => {
    const r = await view<Trades>("trades");
    if (r.ok) setData(r.data);
  }, []);
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load, s.inventory.length]);

  const strip = (cards: InvCard[], title: string) => (
    <div>
      <small style={{ color: "var(--cg-mut)" }}>{title}</small>
      {cards.length === 0 ? (
        <div className="cg-hint">—</div>
      ) : (
        <div className="cg-cards xs" style={{ ["--cg-w" as string]: "84px" }}>
          {cards.map((c) => (
            <GameCard key={c.id} cardId={c.cardId} foil={c.foil} level={c.level} stats={false} />
          ))}
        </div>
      )}
    </div>
  );

  const item = (t: Trade, kind: "in" | "out" | "history") => (
    <div key={t.id} className="cg-panel" style={{ padding: 14, display: "grid", gap: 10 }}>
      <div className="cg-row" style={{ justifyContent: "space-between" }}>
        <b>
          {t.fromNick} → {t.toNick}
        </b>
        {kind === "history" && <span className="cg-tag" style={{ color: t.status === "accepted" ? "#6df0b0" : "#ff7a90" }}>{STATUS[t.status]}</span>}
      </div>
      <div className="cg-grid2" style={{ gap: 12 }}>
        {strip(t.give, kind === "in" ? "Вам отдают" : "Вы отдаёте")}
        {strip(t.want, kind === "in" ? "У вас просят" : "Вы просите")}
      </div>
      {t.note && <p className="cg-hint" style={{ margin: 0 }}>«{t.note}»</p>}
      {kind === "in" && (
        <div className="cg-row">
          <button type="button" className="cg-btn pri sm" disabled={busy} onClick={() => void run(async () => { const r = await act("trade-respond", { id: t.id, accept: true }); toast(r.ok ? "Обмен совершён" : r.error, !r.ok); void load(); })}>
            Принять
          </button>
          <button type="button" className="cg-btn danger sm" disabled={busy} onClick={() => void run(async () => { const r = await act("trade-respond", { id: t.id, accept: false }); toast(r.ok ? "Отклонено" : r.error, !r.ok); void load(); })}>
            Отклонить
          </button>
        </div>
      )}
      {kind === "out" && (
        <button type="button" className="cg-btn sm" disabled={busy} onClick={() => void run(async () => { const r = await act("trade-cancel", { id: t.id }); toast(r.ok ? "Предложение отменено" : r.error, !r.ok); void load(); })}>
          Отменить
        </button>
      )}
    </div>
  );

  return (
    <div>
      <div className="cg-sub" role="group">
        {(
          [
            ["in", `Предложения${data?.incoming.length ? ` (${data.incoming.length})` : ""}`],
            ["out", "Отправленные"],
            ["history", "История обмена"],
            ["new", "Новое предложение"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" aria-pressed={sub === id} onClick={() => setSub(id)}>
            {label}
          </button>
        ))}
      </div>
      {sub === "in" && <div style={{ display: "grid", gap: 12 }}>{data?.incoming.length ? data.incoming.map((t) => item(t, "in")) : <div className="cg-empty">Входящих предложений нет</div>}</div>}
      {sub === "out" && <div style={{ display: "grid", gap: 12 }}>{data?.outgoing.length ? data.outgoing.map((t) => item(t, "out")) : <div className="cg-empty">Вы ничего не отправляли</div>}</div>}
      {sub === "history" && <div style={{ display: "grid", gap: 12 }}>{data?.history.length ? data.history.map((t) => item(t, "history")) : <div className="cg-empty">История пуста</div>}</div>}
      {sub === "new" && <NewTrade s={s} onSent={() => { setSub("out"); void load(); }} />}
    </div>
  );
}

function NewTrade({ s, onSent }: { s: CardsState; onSent: () => void }) {
  const [nick, setNick] = useState("");
  const [theirs, setTheirs] = useState<InvCard[] | null>(null);
  const [realNick, setRealNick] = useState("");
  const [give, setGive] = useState<number[]>([]);
  const [want, setWant] = useState<number[]>([]);
  const [note, setNote] = useState("");
  const [busy, run] = useBusy();

  const find = () =>
    run(async () => {
      const r = await view<{ nickname: string; cards: InvCard[] }>("user", `&nick=${encodeURIComponent(nick)}`);
      if (!r.ok) return toast(r.error, true);
      setTheirs(r.data.cards);
      setRealNick(r.data.nickname);
      setWant([]);
    });
  const send = () =>
    run(async () => {
      const r = await act("trade", { to: realNick, give, want, note });
      if (!r.ok) return toast(r.error, true);
      toast(want.length ? "Предложение отправлено" : "Подарок отправлен — ждёт принятия");
      onSent();
    });
  const tg = (list: number[], set: (v: number[]) => void) => (id: number) => set(list.includes(id) ? list.filter((x) => x !== id) : list.length < 6 ? [...list, id] : list);
  const mine = s.inventory.filter((c) => !c.locked && !c.listed);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Panel title="Кому" hint="Укажите ник игрока. Можно обменяться картами или просто подарить — оставьте правую сторону пустой.">
        <div className="cg-row">
          <input className="cg-input" placeholder="Ник игрока" value={nick} onChange={(e) => setNick(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void find()} />
          <button type="button" className="cg-btn pri" disabled={busy || nick.trim().length < 3} onClick={() => void find()}>
            Найти
          </button>
          {realNick && <span className="cg-chip">{realNick}</span>}
        </div>
      </Panel>
      {theirs && (
        <div className="cg-grid2">
          <Panel title={`Вы отдаёте (${give.length}/6)`}>
            <InvPicker cards={mine} selected={give} onToggle={tg(give, setGive)} max={6} size="xs" />
          </Panel>
          <Panel title={`Вы просите у ${realNick} (${want.length}/6)`}>
            <InvPicker cards={theirs} selected={want} onToggle={tg(want, setWant)} max={6} size="xs" empty="У игрока нет свободных карт" />
          </Panel>
        </div>
      )}
      {theirs && (
        <div className="cg-row">
          <input className="cg-input" placeholder="Сообщение (необязательно)" maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} style={{ flex: "1 1 260px" }} />
          <button type="button" className="cg-btn gold" disabled={busy || (!give.length && !want.length)} onClick={() => void send()}>
            {want.length ? `Предложить обмен ${give.length}⇄${want.length}` : `Подарить ${give.length}`}
          </button>
        </div>
      )}
      {give.length > 0 && <p className="cg-hint">Отданные карты заморожены, пока игрок не ответит. Среди них: {give.map((id) => cardDef(s.inventory.find((c) => c.id === id)?.cardId ?? "")?.name).join(", ")}.</p>}
    </div>
  );
}
