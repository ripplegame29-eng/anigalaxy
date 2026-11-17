"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { view } from "@/lib/cards/client";
import { LEAGUES, RANKS, leagueOf } from "@/lib/cards/config";
import { FRAMES } from "@/lib/cosmetics";
import { AvatarFrame } from "@/components/profile/AvatarFrame";
import { GameCard } from "./GameCard";
import { Portal, fmt } from "./common";
import { Ico, type IcoName } from "./icons";

interface Mini {
  cardId: string;
  foil: boolean;
  level: number;
}
interface Profile {
  nickname: string;
  since?: number;
  avatar?: string;
  frameId?: string;
  rating: number;
  place?: number;
  wins: number;
  losses: number;
  winStreak?: number;
  distinct: number;
  totalCards?: number;
  total: number;
  byRank?: number[];
  packs?: number;
  streak: number;
  achievements?: { id: string; name: string; icon: string; done: number; max: number }[];
  showcase: Mini[];
  best: Mini | null;
  top?: Mini[];
}

const TIER_C = ["#5aa8ff", "#5eeaa8", "#b46bff", "#ffc233", "#ff5c8a"];

/** Профиль игрока гачи: аватар и рамка, любимые карты, достижения, статистика боёв и коллекции */
export function CollectorModal({ nick, onClose, onChallenge }: { nick: string; onClose: () => void; onChallenge?: (nick: string) => void }) {
  const [p, setP] = useState<Profile | null>(null);
  const [err, setErr] = useState("");
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    let alive = true;
    void view<Profile>("profile", `&nick=${encodeURIComponent(nick)}`).then((r) => {
      if (!alive) return;
      if (r.ok) setP(r.data);
      else setErr(r.error);
    });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => {
      alive = false;
      window.removeEventListener("keydown", onKey);
    };
  }, [nick]);

  const fav = p ? (p.showcase.length ? p.showcase : (p.top ?? (p.best ? [p.best] : [])).slice(0, 3)) : [];
  const lg = p ? leagueOf(p.rating) : LEAGUES[0];
  const games = p ? p.wins + p.losses : 0;
  const wr = games ? Math.round(((p?.wins ?? 0) / games) * 100) : 0;
  const ach = p?.achievements ?? [];
  const achDone = ach.reduce((a, x) => a + x.done, 0);
  const achMax = ach.reduce((a, x) => a + x.max, 0) || 1;
  const frame = p?.frameId ? FRAMES.find((f) => f.id === p.frameId) : undefined;

  const stat = (ico: IcoName, label: string, value: string, c: string) => (
    <div className="pf-st" style={{ "--c": c } as CSSProperties}>
      <span className="pf-st-ico">
        <Ico name={ico} size={20} />
      </span>
      <span>
        <small>{label}</small>
        <b>{value}</b>
      </span>
    </div>
  );

  return (
    <Portal>
      <div className="cg-modal ow-bg" role="dialog" aria-modal="true" aria-label={`Профиль: ${nick}`} onClick={onClose}>
        <div className="pf" style={{ "--lg": lg.color } as CSSProperties} onClick={(e) => e.stopPropagation()}>
          <i className="pf-glow" aria-hidden />
          <button type="button" className="ow-x" aria-label="Закрыть" onClick={onClose}>
            <Ico name="close" size={16} />
          </button>
          <header className="pf-head">
            <span className="pf-ava">
              <AvatarFrame nickname={nick} avatar={p?.avatar || undefined} frame={frame} size="md" />
            </span>
            <div className="pf-id">
              <h2>{p?.nickname ?? nick}</h2>
              <span className="pf-title">
                Лига: <b>{lg.name}</b>
                {p?.place ? <> · место {p.place}</> : null}
              </span>
              <small>
                <Ico name="trophy" size={13} /> {fmt(p?.rating ?? 0)} рейтинга
                {p?.since ? ` · в игре с ${new Date(p.since).toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}` : ""}
              </small>
            </div>
          </header>

          {err && <div className="cg-empty">{err}</div>}
          {!p && !err && <div className="cg-empty">Загрузка профиля…</div>}
          {p && (
            <>
              <section className="pf-box">
                <h4>{p.showcase.length ? "Любимые карты" : "Лучшие карты"}</h4>
                {fav.length ? (
                  <div className="pf-fav">
                    {fav.slice(0, 3).map((c, i) => (
                      <span key={`${c.cardId}-${i}`}>
                        <GameCard cardId={c.cardId} foil={c.foil} level={c.level} live={i === 0} stats={false} />
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="cg-empty">Игрок ещё не собрал коллекцию</div>
                )}
              </section>

              {ach.length > 0 && (
                <section className="pf-box">
                  <h4>
                    Достижения{" "}
                    <em>
                      {achDone} / {achMax}
                    </em>
                  </h4>
                  <i className="pf-bar" aria-hidden>
                    <em style={{ width: `${(achDone / achMax) * 100}%` }} />
                  </i>
                  <div className="pf-ach">
                    {ach.map((a) => (
                      <span key={a.id} className={a.done ? "on" : ""} title={`${a.name}: ступень ${a.done} из ${a.max}`} style={{ "--c": TIER_C[Math.min(4, Math.max(0, a.done - 1))] } as CSSProperties}>
                        <Ico name={a.icon as IcoName} size={20} />
                        {a.done > 0 && <i>{a.done}</i>}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              <section className="pf-box">
                <h4>Статистика боёв</h4>
                <div className="pf-grid">
                  {stat("trophy", "Победы", fmt(p.wins), "#3fe0a0")}
                  {stat("skull", "Поражения", fmt(p.losses), "#ff5c7a")}
                  {stat("target", "Винрейт", `${wr}%`, "#b46bff")}
                  {stat("fire", "Лучшая серия", String(p.winStreak ?? 0), "#ffb020")}
                </div>
              </section>

              <section className="pf-box">
                <h4>
                  Коллекция{" "}
                  <em>
                    {p.distinct}
                    {p.totalCards ? ` / ${p.totalCards}` : ""}
                  </em>
                </h4>
                {p.totalCards ? (
                  <i className="pf-bar" aria-hidden>
                    <em style={{ width: `${(p.distinct / p.totalCards) * 100}%` }} />
                  </i>
                ) : null}
                <div className="pf-ranks">
                  {[4, 3, 2, 1, 0].map((r) => (
                    <span key={r} style={{ "--rc": RANKS[r].color } as CSSProperties}>
                      <b>{RANKS[r].short}</b>
                      <em>{p.byRank?.[r] ?? 0}</em>
                    </span>
                  ))}
                </div>
                <div className="pf-mini">
                  <span>
                    <b>{fmt(p.total)}</b> карт всего
                  </span>
                  <span>
                    <b>{fmt(p.packs ?? 0)}</b> паков открыто
                  </span>
                  <span>
                    <b>{p.streak}</b> дн. лучшая серия входов
                  </span>
                </div>
              </section>
            </>
          )}
          {onChallenge && (
            <div className="pf-act">
              <button type="button" className="shp-btn" onClick={() => onChallenge(nick)}>
                <Ico name="swords" size={15} /> Бросить вызов
              </button>
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}
