"use client";

/**
 * Тир-лист карт: ряды рангов SS → C, у каждой карты — сколько у неё владельцев.
 * Нажатие открывает страницу карты с владельцами по числу копий;
 * нажатие на игрока — его профиль.
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { cardDef } from "@/lib/cards/catalog";
import { RANKS } from "@/lib/cards/config";
import { view } from "@/lib/cards/client";
import { FRAMES } from "@/lib/cosmetics";
import { AvatarFrame } from "@/components/profile/AvatarFrame";
import { GameCard } from "./GameCard";
import { CollectorModal } from "./collector";
import { Portal, fmt } from "./common";
import { Ico } from "./icons";

interface TierCard {
  id: string;
  rank: number;
  copies: number;
  owners: number;
}
interface Owner {
  place: number;
  nick: string;
  copies: number;
  level: number;
  foil: boolean;
  avatar: string;
  frameId: string;
}
interface Owners {
  cardId: string;
  copies: number;
  owners: number;
  firstFound: number;
  firstNick: string;
  list: Owner[];
}

const ROWS = [4, 3, 2, 1, 0];
const LIMIT = 5;

export function TierTab() {
  const [data, setData] = useState<{ players: number; cards: TierCard[] } | null>(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"rare" | "pop">("rare");
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [card, setCard] = useState<string | null>(null);
  const [nick, setNick] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void view<{ players: number; cards: TierCard[] }>("tiers").then((r) => {
      if (!alive) return;
      if (r.ok) setData(r.data);
      else setErr(r.error);
    });
    return () => {
      alive = false;
    };
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    return ROWS.map((rank) => {
      const list = data.cards
        .filter((c) => c.rank === rank)
        .filter((c) => {
          if (!term) return true;
          const d = cardDef(c.id);
          return !!d && (d.name.toLowerCase().includes(term) || d.series.toLowerCase().includes(term));
        })
        .sort((a, b) => (sort === "rare" ? a.owners - b.owners || a.copies - b.copies : b.owners - a.owners || b.copies - a.copies));
      return { rank, list, found: list.filter((c) => c.owners > 0).length };
    });
  }, [data, q, sort]);

  const total = data?.cards.length ?? 0;
  const found = data?.cards.filter((c) => c.owners > 0).length ?? 0;

  return (
    <div className="tl">
      <header className="shp-sec">
        <span className="shp-ico" aria-hidden>
          <Ico name="grid" size={20} />
        </span>
        <div>
          <h2>Тир-лист карт</h2>
          <p>Сколько игроков владеет каждой картой. Нажмите на карту — откроются её владельцы.</p>
        </div>
      </header>

      <div className="tl-top">
        <div className="tl-sum">
          <span>
            <b>{fmt(found)}</b>
            <small>из {fmt(total)} карт уже найдены</small>
          </span>
          <span>
            <b>{fmt(data?.players ?? 0)}</b>
            <small>коллекционеров</small>
          </span>
          <i className="tl-bar" aria-hidden>
            <em style={{ width: `${total ? (found / total) * 100 : 0}%` }} />
          </i>
        </div>
        <label className="lb-search tl-search">
          <Ico name="search" size={16} />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Герой или аниме" aria-label="Поиск карты" />
        </label>
        <div className="lb-chips" role="group" aria-label="Порядок">
          <button type="button" aria-pressed={sort === "rare"} onClick={() => setSort("rare")}>
            Самые редкие
          </button>
          <button type="button" aria-pressed={sort === "pop"} onClick={() => setSort("pop")}>
            Популярные
          </button>
        </div>
      </div>

      {err && <div className="cg-empty">{err}</div>}
      {!data && !err && <div className="cg-empty">Загрузка тир-листа…</div>}

      {rows.map(({ rank, list, found: f }) => {
        if (!list.length) return null;
        const r = RANKS[rank];
        const all = !!open[rank];
        const shown = all ? list : list.slice(0, LIMIT);
        return (
          <section key={rank} className="tl-row" style={{ "--rc": r.color } as CSSProperties} aria-label={`Ранг ${r.short}`}>
            <div className="tl-rank">
              <b>{r.short}</b>
              <small>{r.name}</small>
              <em>
                {f}/{list.length}
              </em>
            </div>
            <div className="tl-cards">
              {shown.map((c, i) => (
                <button key={c.id} type="button" className={`tl-card${c.owners ? "" : " none"}`} style={{ ["--d" as string]: `${Math.min(i, 20) * 25}ms` }} onClick={() => setCard(c.id)} aria-label={`${cardDef(c.id)?.name}: владельцев ${c.owners}`}>
                  <span className="tl-art">
                    <img src={`/api/cards/art/${c.id}`} alt="" loading="lazy" decoding="async" draggable={false} />
                  </span>
                  <span className="tl-badge">
                    <Ico name="user" size={11} />
                    {c.owners}
                  </span>
                  <span className="tl-nm">{cardDef(c.id)?.name}</span>
                </button>
              ))}
              {list.length > LIMIT && (
                <button type="button" className="tl-more" onClick={() => setOpen((o) => ({ ...o, [rank]: !all }))}>
                  <b>{all ? "−" : `+${list.length - LIMIT}`}</b>
                  <small>{all ? "Свернуть" : "Показать все"}</small>
                </button>
              )}
            </div>
          </section>
        );
      })}

      {card && <OwnersModal cardId={card} onClose={() => setCard(null)} onPlayer={(n) => setNick(n)} />}
      {nick && <CollectorModal nick={nick} onClose={() => setNick(null)} />}
    </div>
  );
}

export function OwnersModal({ cardId, onClose, onPlayer }: { cardId: string; onClose: () => void; onPlayer: (nick: string) => void }) {
  const [d, setD] = useState<Owners | null>(null);
  const [err, setErr] = useState("");
  const def = cardDef(cardId);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    let alive = true;
    void view<Owners>("owners", `&id=${encodeURIComponent(cardId)}`).then((r) => {
      if (!alive) return;
      if (r.ok) setD(r.data);
      else setErr(r.error);
    });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => {
      alive = false;
      window.removeEventListener("keydown", onKey);
    };
  }, [cardId]);
  if (!def) return null;
  const r = RANKS[def.rank];
  return (
    <Portal>
      <div className="cg-modal ow-bg" role="dialog" aria-modal="true" aria-label={def.name} onClick={onClose}>
        <div className="ow" style={{ "--rc": r.color } as CSSProperties} onClick={(e) => e.stopPropagation()}>
          <i className="ow-glow" aria-hidden />
          <button type="button" className="ow-x" aria-label="Закрыть" onClick={onClose}>
            <Ico name="close" size={16} />
          </button>
          <div className="ow-hero">
            <div className="ow-card">
              <GameCard cardId={cardId} live />
            </div>
            <div className="ow-id">
              <span className="ow-rank">
                {r.short} · {r.name}
              </span>
              <h3>{def.name}</h3>
              <small>{def.series}</small>
              <div className="ow-stats">
                <span>
                  <b>{fmt(d?.owners ?? 0)}</b>
                  <small>владельцев</small>
                </span>
                <span>
                  <b>{fmt(d?.copies ?? 0)}</b>
                  <small>копий</small>
                </span>
                <span>
                  <b>{def.atk}</b>
                  <small>атака</small>
                </span>
                <span>
                  <b>{def.hp}</b>
                  <small>здоровье</small>
                </span>
              </div>
              {d?.firstNick && (
                <p className="ow-first">
                  <Ico name="flag" size={13} /> Первым нашёл <b>{d.firstNick}</b> · {new Date(d.firstFound).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
                </p>
              )}
            </div>
          </div>

          <div className="ow-head">
            <p className="shp-eye">Владельцы</p>
            <small>по количеству копий</small>
          </div>
          {err && <div className="cg-empty">{err}</div>}
          {!d && !err && <div className="cg-empty">Загрузка…</div>}
          {d && d.list.length === 0 && <div className="cg-empty">Эту карту ещё никто не нашёл. Станьте первым!</div>}
          {d && d.list.length > 0 && (
            <ol className="ow-list">
              {d.list.map((o) => (
                <li key={o.nick}>
                  <button type="button" className={`ow-row${o.place === 1 ? " top" : ""}`} onClick={() => onPlayer(o.nick)}>
                    <span className="ow-pl">{o.place === 1 ? <Ico name="crown" size={18} /> : o.place}</span>
                    <AvatarFrame nickname={o.nick} avatar={o.avatar || undefined} frame={o.frameId ? FRAMES.find((f) => f.id === o.frameId) : undefined} size="xs" />
                    <span className="ow-nk">
                      <b>{o.nick}</b>
                      <small>
                        ур. {o.level}
                        {o.foil ? " · фольга" : ""}
                      </small>
                    </span>
                    <span className="ow-n">×{o.copies}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </Portal>
  );
}
