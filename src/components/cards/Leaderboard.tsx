"use client";

/**
 * Таблица лидеров сезона: подиум с пьедесталом, сводка по топу, поиск и фильтр по лигам,
 * строки с аватаром, лигой, шкалой рейтинга и кольцом винрейта. Своя строка подсвечена,
 * в шапке — прогресс до следующей лиги.
 * Данные приходят из `view("top")` (см. `ratingTop`), оформление — стили `lb-*`.
 */

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { LEAGUES, leagueOf } from "@/lib/cards/config";
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

/** Цвета подиума: лёд, голубовато-сиреневый, фиолет — в гамме сайта, без золота */
const MEDAL = ["#7fd8ff", "#a9b8ff", "#c58bff"];
const MEDAL_NAME = ["Чемпион сезона", "Серебро", "Бронза"];

const frameOf = (id?: string) => (id ? FRAMES.find((f) => f.id === id) : undefined);
const winRate = (r: TopRow): number => (r.wins + r.losses > 0 ? Math.round((r.wins / (r.wins + r.losses)) * 100) : 0);

function Who({ r, size }: { r: TopRow; size: "xs" | "sm" | "md" }) {
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
  const [q, setQ] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  /* неделя арены начинается в понедельник 00:00 UTC (как weekIndexOf на сервере) */
  const WEEK = 7 * 86_400_000;
  const OFF = 4 * 86_400_000;
  const leftMs = Math.max(0, (Math.floor((nowMs - OFF) / WEEK) + 1) * WEEK + OFF - nowMs);
  const left = { d: Math.floor(leftMs / 86_400_000), h: Math.floor(leftMs / 3_600_000) % 24, m: Math.floor(leftMs / 60_000) % 60, s: Math.floor(leftMs / 1000) % 60 };
  const [league, setLeague] = useState<string>("all");
  const mine = me.trim().toLowerCase();
  const isMe = (r: TopRow) => mine !== "" && r.nick.toLowerCase() === mine;
  const podium = rows.slice(0, 3);
  const top20 = rows.slice(0, 20);
  const inList = rows.some(isMe);
  const myPlace = rows.find(isMe)?.place;
  // Подиум читается 2-1-3: победитель по центру и выше остальных
  const order = [1, 0, 2];

  const best = rows[0]?.rating ?? 1;
  const avg = rows.length ? Math.round(rows.reduce((a, r) => a + r.rating, 0) / rows.length) : 0;
  const fights = rows.reduce((a, r) => a + r.wins + r.losses, 0);

  const cur = leagueOf(myRating);
  const next = LEAGUES.find((l) => l.from > myRating);
  const prog = next ? Math.min(100, Math.round(((myRating - cur.from) / (next.from - cur.from)) * 100)) : 100;

  const present = useMemo(() => LEAGUES.filter((l) => top20.some((r) => leagueOf(r.rating).id === l.id)), [top20]);
  const shown = top20.filter((r) => (league === "all" || leagueOf(r.rating).id === league) && (q.trim() === "" || r.nick.toLowerCase().includes(q.trim().toLowerCase())));

  return (
    <section className="lb" aria-labelledby="lb-title">
      <i className="lb-glow" aria-hidden />
      <i className="lb-grid" aria-hidden />
      <header className="lb-hero">
        <i className="lb-hero-lines" aria-hidden />
        <i className="lb-beam" aria-hidden />
        <i className="lb-beam b2" aria-hidden />
        <i className="lb-hero-cup" aria-hidden>
          <Ico name="trophy" size={220} />
        </i>
        <div className="lb-hero-main">
          <span className="lb-live">
            <i aria-hidden /> Зал славы галактики
          </span>
          <h3 id="lb-title">
            Рейтинг
            <span>игроков</span>
          </h3>
          <p>Рейтинговые бои двигают вас по лигам — от Бронзы до Легенды. Таблица обновляется после каждого боя.</p>
          <div className="lb-timer" aria-label="До новой недели арены">
            <small>Новая неделя арены через</small>
            <div>
              {[
                [left.d, "дн"],
                [left.h, "час"],
                [left.m, "мин"],
                [left.s, "сек"],
              ].map(([v, l], i) => (
                <span key={String(l)} className="lb-tm">
                  {i > 0 && <i aria-hidden>:</i>}
                  <span className="lb-tmv">
                    <b>{String(v).padStart(2, "0")}</b>
                    <small>{l}</small>
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="lb-hero-top3" aria-label="Тройка лидеров">
          {[1, 0, 2].map((i) => {
            const r = rows[i];
            return (
              <button key={i} type="button" className={`lb-t3 p${i + 1}`} style={{ "--m": MEDAL[i] } as CSSProperties} onClick={() => r && onOpen(r.nick)} disabled={!r}>
                {i === 0 && <Ico name="crown" size={26} className="lb-t3-crown" />}
                <span className="lb-t3-ava">{r ? <Who r={r} size="sm" /> : <Ico name="user" size={24} />}</span>
                <b>{r?.nick ?? "—"}</b>
                <small>{r ? fmt(r.rating) : "место свободно"}</small>
                <em>{i + 1}</em>
              </button>
            );
          })}
        </div>
        <div className="lb-my" style={{ ["--lg" as string]: cur.color }}>
          <img className="lb-my-emb" src={`/cards/leagues/${cur.id}.webp`} alt="" aria-hidden />
          <div className="lb-my-top">
            <span>
              <small>Ваш рейтинг</small>
              <b>{fmt(myRating)}</b>
            </span>
            <em className="lb-my-lg">{cur.name}</em>
          </div>
          <div className="lb-my-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={prog} aria-label="Прогресс до следующей лиги">
            <i style={{ width: `${prog}%` }} />
          </div>
          <small className="lb-my-note">
            {next ? `До лиги «${next.name}» — ${fmt(next.from - myRating)} очков` : "Вы в высшей лиге"}
            {myPlace ? ` · место ${myPlace}` : ""}
          </small>
          <div className="lb-my-lgs" aria-hidden>
            {LEAGUES.map((l) => (
              <i key={l.id} className={l.id === cur.id ? "on" : myRating >= l.from ? "past" : ""} style={{ ["--lg" as string]: l.color }} title={l.name} />
            ))}
          </div>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="cg-empty">Рейтинг появится после первых боёв</div>
      ) : (
        <>
          <ul className="lb-stats" aria-label="Сводка по топу">
            <li>
              <Ico name="user" size={18} />
              <span>
                <b>{fmt(rows.length)}</b>
                <small>игроков в рейтинге</small>
              </span>
            </li>
            <li>
              <Ico name="crown" size={18} />
              <span>
                <b>{fmt(best)}</b>
                <small>рейтинг лидера</small>
              </span>
            </li>
            <li>
              <Ico name="trend" size={18} />
              <span>
                <b>{fmt(avg)}</b>
                <small>средний рейтинг</small>
              </span>
            </li>
            <li>
              <Ico name="swords" size={18} />
              <span>
                <b>{fmt(fights)}</b>
                <small>боёв сыграно топом</small>
              </span>
            </li>
          </ul>

          <div className="lb-podium n3">
            {order.map((i) => {
              const r = podium[i];
              const c = MEDAL[i];
              if (!r)
                return (
                  <div key={`empty${i}`} className={`lb-col p${i + 1}`} style={{ "--m": c } as CSSProperties}>
                    <div className="lb-pod empty">
                      <span className="lb-vac" aria-hidden>
                        <Ico name="trophy" size={30} />
                      </span>
                      <span className="lb-medal">{MEDAL_NAME[i]}</span>
                      <span className="lb-name">Место свободно</span>
                      <span className="lb-rec">Выигрывайте рейтинговые бои, чтобы занять его</span>
                    </div>
                    <div className="lb-step" aria-hidden>
                      <b>{i + 1}</b>
                    </div>
                  </div>
                );
              return (
                <div key={r.nick} className={`lb-col p${i + 1}`} style={{ "--m": c, "--lg": leagueOf(r.rating).color } as CSSProperties}>
                  <button type="button" className={`lb-pod${isMe(r) ? " me" : ""}`} onClick={() => onOpen(r.nick)} aria-label={`${i + 1} место: ${r.nick}, рейтинг ${r.rating}`}>
                    <i className="lb-sheen" aria-hidden />
                    {i === 0 && (
                      <span className="lb-crown" aria-hidden>
                        <Ico name="crown" size={28} />
                        <i />
                        <i />
                        <i />
                      </span>
                    )}
                    <span className="lb-ava">
                      <Who r={r} size="md" />
                    </span>
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
                  <div className="lb-step" aria-hidden>
                    <b>{i + 1}</b>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="lb-tools">
            <label className="lb-search">
              <Ico name="search" size={16} />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти игрока" aria-label="Найти игрока в рейтинге" />
            </label>
            <div className="lb-chips" role="group" aria-label="Фильтр по лиге">
              <button type="button" aria-pressed={league === "all"} onClick={() => setLeague("all")}>
                Все
              </button>
              {present.map((l) => (
                <button key={l.id} type="button" aria-pressed={league === l.id} onClick={() => setLeague(l.id)} style={{ ["--lg" as string]: l.color }}>
                  <i aria-hidden />
                  {l.name}
                </button>
              ))}
            </div>
          </div>

          <ul className="lb-list">
            <li className="lb-cols" aria-hidden>
              <span>Место</span>
              <span>Игрок</span>
              <span>Лига и рейтинг</span>
              <span>Победы</span>
              <span>Пораж.</span>
              <span>Винрейт</span>
            </li>
            {shown.length === 0 && <li className="lb-none">Никого не нашли — попробуйте другой запрос или лигу</li>}
            {shown.map((r, k) => {
              const wr = winRate(r);
              const lg = leagueOf(r.rating);
              return (
                <li key={r.nick} style={{ ["--d" as string]: `${k * 35}ms` }}>
                  <button
                    type="button"
                    className={`lb-row${isMe(r) ? " me" : ""}${r.place <= 3 ? ` top t${r.place}` : ""}`}
                    style={{ "--lg": lg.color, "--m": MEDAL[r.place - 1] ?? "transparent" } as CSSProperties}
                    onClick={() => onOpen(r.nick)}
                  >
                    <span className="lb-pl">{r.place <= 3 ? <Ico name={r.place === 1 ? "crown" : "trophy"} size={16} /> : r.place}</span>
                    <span className="lb-who">
                      <Who r={r} size="xs" />
                      <span className="lb-wt">
                        <b>
                          {r.nick}
                          {r.clan ? <em>[{r.clan}]</em> : null}
                          {isMe(r) && <u>Вы</u>}
                        </b>
                        <small>{r.wins + r.losses} боёв</small>
                      </span>
                    </span>
                    <span className="lb-rt">
                      <span>
                        <em className="lb-lgname">{lg.name}</em>
                        <b>{fmt(r.rating)}</b>
                      </span>
                      <span className="lb-bar">
                        <i style={{ width: `${Math.max(6, Math.round((r.rating / best) * 100))}%` }} />
                      </span>
                    </span>
                    <span className="lb-w">{fmt(r.wins)}</span>
                    <span className="lb-l">{fmt(r.losses)}</span>
                    <span className="lb-ring" style={{ ["--p" as string]: wr }} aria-label={`Винрейт ${wr}%`}>
                      <b>{wr}%</b>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {!inList && mine !== "" && (
            <div className="lb-you">
              <span>
                Вы пока вне двадцатки лидеров · <small>{cur.name}</small>
              </span>
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
