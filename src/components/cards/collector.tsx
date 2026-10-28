"use client";

import { useEffect, useState } from "react";
import { view } from "@/lib/cards/client";
import { GameCard } from "./GameCard";
import { Portal, fmt } from "./common";
import { Ico } from "./icons";

interface Profile {
  nickname: string;
  rating: number;
  wins: number;
  losses: number;
  distinct: number;
  total: number;
  streak: number;
  showcase: { cardId: string; foil: boolean; level: number }[];
  best: { cardId: string; foil: boolean; level: number } | null;
}

/** Профиль коллекционера: витрина, рейтинг, число героев */
export function CollectorModal({ nick, onClose }: { nick: string; onClose: () => void }) {
  const [p, setP] = useState<Profile | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    let alive = true;
    void view<Profile>("profile", `&nick=${encodeURIComponent(nick)}`).then((r) => {
      if (!alive) return;
      if (r.ok) setP(r.data);
      else setErr(r.error);
    });
    return () => {
      alive = false;
    };
  }, [nick]);
  const shown = p ? (p.showcase.length ? p.showcase : p.best ? [p.best] : []) : [];
  return (
    <Portal>
      <div className="cg-modal" role="dialog" aria-modal="true" aria-label={`Профиль: ${nick}`} onClick={onClose}>
        <div className="col-modal" onClick={(e) => e.stopPropagation()}>
          <div className="col-head">
            <span className="col-ava">{nick.slice(0, 1).toUpperCase()}</span>
            <div>
              <span className="cg-tag">Коллекционер</span>
              <h2 className="cg-h2">{nick}</h2>
            </div>
          </div>
          {err && <div className="cg-empty">{err}</div>}
          {!p && !err && <div className="cg-empty">Загрузка…</div>}
          {p && (
            <>
              <div className="col-stats">
                {[
                  ["Рейтинг", fmt(p.rating)],
                  ["Победы / поражения", `${p.wins} / ${p.losses}`],
                  ["Героев открыто", `${p.distinct}`],
                  ["Карт всего", `${p.total}`],
                  ["Серия входов", `${p.streak} дн.`],
                ].map(([k, v]) => (
                  <div key={k} className="pg-stat">
                    <b>{v}</b>
                    <small>{k}</small>
                  </div>
                ))}
              </div>
              <h3 className="sk-h">{p.showcase.length ? "Витрина" : "Лучшая карта"}</h3>
              {shown.length ? (
                <div className="col-show">
                  {shown.map((c, i) => (
                    <GameCard key={`${c.cardId}-${i}`} cardId={c.cardId} foil={c.foil} level={c.level} live />
                  ))}
                </div>
              ) : (
                <div className="cg-empty">Игрок ещё не собрал коллекцию</div>
              )}
            </>
          )}
          <div className="cg-row" style={{ justifyContent: "flex-end", marginTop: 16 }}>
            <button type="button" className="cg-btn pri" onClick={onClose}>
              <Ico name="close" size={14} /> Закрыть
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
