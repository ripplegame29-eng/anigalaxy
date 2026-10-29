"use client";

/**
 * Таблица лидеров сезона: подиум для тройки лучших и список ниже — аватар с рамкой,
 * лига, тег клана, полоса рейтинга и счёт боёв. Своя строка подсвечена.
 * Данные приходят из `view("top")` (см. `ratingTop`), оформление — стили `lb-*`.
 */

import type { CSSProperties } from "react";
import { leagueOf } from "@/lib/cards/config";
import { FRAMES } from "@/lib/cosmetics";
import { AvatarFrame } from "@/components/profile/AvatarFrame";
import { fmt } from "./common";
import { Ico } from "./icons";

export interface TopRow {
  place: number;
  userId?: number;
  nick: string;
  rating: number;
  wins: number;
  losses: number;
  avatar?: string;
  frameId?: string;
  clan?: string;
}

const MEDAL = ["#ffc45e", "#c9d4ea", "#d98a52"];
const MEDAL_NAME = ["Чемпион сезона", "Серебро", "Бронза"];

const frameOf = (id?: string) => (id ? FRAMES.find((f) => f.id === id) : undefined);
const winRate = (r: TopRow): number => (r.wins + r.losses > 0 ? Math.round((r.wins / (r.wins + r.losses)) * 100) : 0);

function Who({ r, size }: { r: TopRow; size: "xs" | "md" }) {
  return <AvatarFrame nickname={r.nick} avatar={r.avatar} frame={frameOf(r.frameId)} size={size} />;
}

export function Leaderboard({
  rows,
  me,
  myRating,
  onOpen,
}: {
  rows: TopRow[];
  me: string;
  myRating: number;
  onOpen: (nick: string) => void;
}) {
  const mine = me.trim().toLowerCase();
  const isMe = (r: TopRow) => mine !== "" && r.nick.toLowerCase() === mine;
  const topRating = Math.max(1, rows[0]?.rating ?? 1);
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3, 20);
  const inList = rows.some(isMe);
  // Подиум читается 2-1-3: победитель по центру и выше остальных
  const order = podium.length === 3 ? [1, 0, 2] : podium.map((_, i) => i);

  return (
    <section className="lb" aria-labelledby="lb-title">
      <i className="lb-glow" aria-hidden />
      <header className="lb-head">
        <div>
          <span className="cg-eyebrow">Рейтинг боёв</span>
          <h3 id="lb-title">Лидеры сезона</h3>
          <p>Лучшие стратеги арены. Рейтинг растёт с победами в рейтинговых боях и обновляется после каждого боя.</p>
        </div>
        <div className="lb-me">
          <small>Ваш рейтинг</small>
          <b>{fmt(myRating)}</b>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="cg-empty">Рейтинг появится после первых боёв</div>
      ) : (
        <>
          <div className={`lb-podium n${podium.length}`}>
            {order.map((i) => {
              const r = podium[i];
              const c = MEDAL[i];
              return (
                <button
                  key={r.nick}
                  type="button"
                  className={`lb-pod p${i + 1}${isMe(r) ? " me" : ""}`}
                  style={{ "--m": c, "--lg": leagueOf(r.rating).color } as CSSProperties}
                  onClick={() => onOpen(r.nick)}
                  aria-label={`${i + 1} место: ${r.nick}, рейтинг ${r.rating}`}
                >
                  <i className="lb-sheen" aria-hidden />
                  <b className="lb-big" aria-hidden>{i + 1}</b>
                  {i === 0 && <span className="lb-crown" aria-hidden><Ico name="crown" size={26} /></span>}
                  <span className="lb-ava"><Who r={r} size="md" /></span>
                  <span className="lb-medal">{MEDAL_NAME[i]}</span>
                  <span className="lb-name">
                    {r.nick}
                    {r.clan ? <em>[{r.clan}]</em> : null}
                  </span>
                  <span className="lb-league">{leagueOf(r.rating).name}</span>
                  <span className="lb-rate">
                    <Ico name="trophy" size={18} /> {fmt(r.rating)}
                  </span>
                  <span className="lb-rec">
                    {r.wins} побед · {r.losses} пораж. · {winRate(r)}%
                  </span>
                </button>
              );
            })}
          </div>

          {rest.length > 0 && (
            <ul className="lb-list">
              <li className="lb-cols" aria-hidden>
                <span>Место</span>
                <span>Игрок</span>
                <span>Рейтинг</span>
                <span>Бои</span>
              </li>
              {rest.map((r, k) => (
                <li key={r.nick} style={{ ["--d" as string]: `${k * 35}ms` }}>
                  <button
                    type="button"
                    className={`lb-row${isMe(r) ? " me" : ""}`}
                    style={{ "--lg": leagueOf(r.rating).color } as CSSProperties}
                    onClick={() => onOpen(r.nick)}
                  >
                    <span className="lb-pl">{r.place}</span>
                    <span className="lb-who">
                      <Who r={r} size="xs" />
                      <span className="lb-wt">
                        <b>
                          {r.nick}
                          {isMe(r) && <u>Вы</u>}
                        </b>
                        <small>
                          <i aria-hidden />
                          {leagueOf(r.rating).name}
                          {r.clan ? ` · [${r.clan}]` : ""}
                        </small>
                      </span>
                    </span>
                    <span className="lb-rt">
                      <b>{fmt(r.rating)}</b>
                      <span className="lb-bar"><i style={{ width: `${Math.max(6, (r.rating / topRating) * 100)}%` }} /></span>
                    </span>
                    <span className="lb-rc">
                      <b>{r.wins}</b>
                      <small>/ {r.losses}</small>
                      <em>{winRate(r)}%</em>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!inList && mine !== "" && (
            <div className="lb-you">
              <span>Вы пока вне двадцатки лидеров</span>
              <b>
                <Ico name="trophy" size={15} /> {fmt(myRating)}
              </b>
            </div>
          )}
        </>
      )}
    </section>
  );
}
