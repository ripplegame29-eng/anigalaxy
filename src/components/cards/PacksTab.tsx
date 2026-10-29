"use client";

import { useEffect, useRef, useState } from "react";
import { cardDef } from "@/lib/cards/catalog";
import { PACK, RANKS } from "@/lib/cards/config";
import { sfx } from "@/lib/cards/sound";
import { act, hasArt, type CardsState, type Pull } from "@/lib/cards/client";
import { GameCard } from "./GameCard";
import { BannerCard } from "./BannerCard";
import { PackStage, type PackPhase } from "./PackStage";
import { Panel, Reveal, ago, fmt, toast, useBusy, useNow } from "./common";
import { Cur, Ico, type CurKey } from "./icons";

interface PackResult {
  offers: string[];
  picked: number | null;
  chosen: { invId: number; cardId: string } | null;
  dustBack: number;
}

type Pay = "token" | "diamonds" | "dust";

const QUICK_KEY = "animehub:cards:quick";
const readQuick = (): boolean => {
  try {
    return window.localStorage.getItem(QUICK_KEY) === "1";
  } catch {
    return false;
  }
};
const reduced = (): boolean => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};
const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

const PAY_CUR: Record<Pay, CurKey> = { token: "packs", diamonds: "diamonds", dust: "dust" };

function Gauge({ title, left, now, max, color }: { title: string; left: number; now: number; max: number; color: string }) {
  const R = 32;
  const len = 2 * Math.PI * R;
  const done = Math.min(1, now / max);
  return (
    <div className="cg-gauge" style={{ ["--c" as string]: color }}>
      <div className="cg-ring" role="img" aria-label={`${title}: ${now} из ${max}`}>
        <svg viewBox="0 0 74 74">
          <circle className="bg" cx="37" cy="37" r={R} />
          <circle className="fg" cx="37" cy="37" r={R} style={{ ["--len" as string]: len, ["--off" as string]: len * (1 - done) }} />
        </svg>
        <b>{left <= 1 ? "1" : left}</b>
      </div>
      <div>
        <h3>{title}</h3>
        <p>{left <= 1 ? "Гарантия выпадет в следующем паке" : `Гарантия через ${left} ${left < 5 ? "пака" : "паков"}`}</p>
        <div className="lbl">
          Серия без неё: {now} из {max}
        </div>
      </div>
    </div>
  );
}

/** Цвета рамок наборов: синий, фиолетовый, золотой */
const OFFER_COLOR = ["#3aa0ff", "#b46bff", "#ffc45e"];

function Thumb({ cardId, rank, name }: { cardId: string; rank: number; name: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  return (
    <span className="cg-thumb" style={{ ["--c" as string]: RANKS[rank]?.color }}>
      {hasArt(cardId) ? <img src={`/api/cards/art/${cardId}`} alt="" loading="lazy" draggable={false} /> : initials}
    </span>
  );
}

function Winners({ list, now }: { list: Pull[]; now: number }) {
  return (
    <ul className="cg-feed" style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {list.map((p, i) => {
        const d = cardDef(p.cardId);
        const r = RANKS[p.rank];
        return (
          <li key={i} className={`cg-win ${p.rank >= 4 ? "top" : ""}`} style={{ ["--c" as string]: r?.color }}>
            <Thumb cardId={p.cardId} rank={p.rank} name={d?.name ?? "?"} />
            <span className="cg-win-t">
              <b>{p.nick}</b>
              <span>{d?.name ?? "Карта"}</span>
            </span>
            <span className="cg-win-r">
              <span className="cg-tag" style={{ color: r?.color }}>
                {r?.name}
              </span>
              <small>{ago(p.at, now)}</small>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function PacksTab({ s }: { s: CardsState }) {
  const [busy, run] = useBusy();
  const [pay, setPay] = useState<Pay>("token");
  const [quick, setQuick] = useState(readQuick);
  const [sel, setSel] = useState(0);
  const [results, setResults] = useState<PackResult[]>([]);
  const [phase, setPhase] = useState<PackPhase>("idle");
  const now = useNow(60_000);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const w = s.wallet;
  const bundles = PACK.bundles;
  const bundle = bundles[sel];
  const effectivePay: Pay = pay === "token" && w.packs < 1 ? "diamonds" : pay;

  const costOf = (b: { n: number; pay: number }): number => (effectivePay === "token" ? b.n : effectivePay === "diamonds" ? PACK.diamonds * b.pay : PACK.dust * b.pay);
  const haveOf = effectivePay === "token" ? w.packs : effectivePay === "diamonds" ? w.diamonds : w.dust;
  const lackOf = (b: { n: number; pay: number }): number => Math.max(0, costOf(b) - haveOf);
  const unit = effectivePay === "token" ? "жет." : effectivePay === "diamonds" ? "алм." : "пыли";

  const pendingOffers = s.pending;
  const lack = lackOf(bundle);
  const reason = pendingOffers ? "Сначала выберите карту из тройки" : lack > 0 ? `Не хватает ${fmt(lack)} ${unit}` : "";

  const toggleQuick = () => {
    const v = !quick;
    setQuick(v);
    try {
      window.localStorage.setItem(QUICK_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  const open = (count: number) =>
    run(async () => {
      if (reason) return;
      const fast = reduced();
      setPhase("charge");
      sfx("charge");
      const t0 = Date.now();
      const r = await act<{ results: PackResult[]; pending: string[] | null }>("open", { count, pay: effectivePay, quick });
      if (!alive.current) return;
      if (!r.ok) {
        setPhase("idle");
        return toast(r.error, true);
      }
      /* анимация — только после реального ответа сервера */
      const spent = Date.now() - t0;
      if (!fast && spent < 650) await wait(650 - spent);
      if (!alive.current) return;
      setPhase("burst");
      sfx("burst");
      if (!fast) await wait(560);
      if (!alive.current) return;
      setPhase("idle");
      setResults(r.result.results);
    });

  const pickCard = (index: number) =>
    run(async () => {
      const r = await act<PackResult>("pick", { index });
      if (!r.ok) return toast(r.error, true);
      setResults([r.result]);
    });

  const chosen = results.filter((r) => r.chosen).map((r) => ({ cardId: r.chosen!.cardId }));
  const dustBack = results.reduce((a, r) => a + r.dustBack, 0);
  const closeReveal = () => setResults([]);

  const epicLeft = Math.max(0, PACK.pityEpic - w.pityEpic);
  const legendLeft = Math.max(0, PACK.pityLegend - w.pityLegend);
  const loading = phase !== "idle" || busy;

  return (
    <>
    <BannerCard s={s} />
    <div className="cg-main">
      <div className="cg-main-l">
        <section className="cg-scene" aria-label="Открытие паков">
          <div className="cg-scene-title">
            <span className="cg-eyebrow">Бустер AniGalaxy</span>
            <h2>{pendingOffers ? "Выберите одну карту" : "Откройте пак"}</h2>
            <p>{pendingOffers ? "Остальные две карты превратятся в пыль — вернётся четверть их стоимости." : `В каждом паке ${PACK.choices} карты на выбор. Гарантии на эпическую и легендарную — ниже.`}</p>
          </div>

          {pendingOffers ? (
            <div className="cg-pickstage">
              <div className="cg-offers">
                {pendingOffers.map((id, i) => (
                  <GameCard key={id} cardId={id} live onClick={() => void pickCard(i)} className="cg-offer-card" />
                ))}
              </div>
            </div>
          ) : (
            <PackStage phase={phase} blocked={!!reason && !loading} onOpen={() => void open(bundle.n)} />
          )}

          {!pendingOffers && (
            <div className="cg-act">
              <button type="button" className="cg-cta" disabled={loading || !!reason} onClick={() => void open(bundle.n)}>
                {loading ? <span className="cg-spin" /> : <Ico name="pack" size={20} />}
                {loading ? "Открываем…" : bundle.n === 1 ? "Открыть пак" : `Открыть ×${bundle.n}`}
                <span className="price">
                  {fmt(costOf(bundle))} <Cur k={PAY_CUR[effectivePay]} size={16} />
                </span>
              </button>
              {reason && !loading && (
                <span className="cg-why" role="status">
                  <Ico name="ban" size={16} />
                  {reason}
                </span>
              )}
              <div className="cg-opts">
                <label className="cg-switch">
                  <input type="checkbox" checked={quick} onChange={toggleQuick} />
                  <i />
                  Быстрое открытие
                </label>
              </div>
            </div>
          )}
        </section>

        <Panel title="Наборы и оплата" hint="Набор из 6 паков стоит как 5, набор из 20 — как 15. В наборах лучшую карту из каждого пака можно забирать автоматически — включите быстрое открытие.">
          <div className="cg-pay">
            <div className="cg-seg" role="radiogroup" aria-label="Чем платить">
              {(
                [
                  ["token", `Жетоны · ${w.packs}`, "packs"],
                  ["diamonds", `${PACK.diamonds} за пак`, "diamonds"],
                  ["dust", `${PACK.dust} за пак`, "dust"],
                ] as const
              ).map(([id, label, k]) => (
                <button key={id} type="button" role="radio" aria-checked={effectivePay === id} onClick={() => setPay(id)}>
                  <Cur k={k} size={16} /> {label}
                </button>
              ))}
            </div>
            <span className="cg-chip">
              <small>У вас</small> {fmt(haveOf)} <Cur k={PAY_CUR[effectivePay]} />
            </span>
          </div>
          <div className="cg-shop">
            {bundles.map((b, i) => {
              const l = lackOf(b);
              const saved = b.n - b.pay;
              return (
                <div key={b.n} className="cg-offer-w" data-on={sel === i ? "1" : undefined} style={{ ["--oc" as string]: OFFER_COLOR[i] ?? OFFER_COLOR[0] }}>
                  <div className="cg-offer-f">
                    <button type="button" className="cg-offer" aria-pressed={sel === i} disabled={!!pendingOffers || loading} onClick={() => setSel(i)}>
                      <span className="mark">
                        <Ico name="check" size={14} />
                      </span>
                      {i === bundles.length - 1 && <span className="ribbon">Больше всего выгоды</span>}
                      <img className="art" src={`/cards/offers/${Math.min(i, 2) + 1}.webp`} alt="" draggable={false} loading="lazy" />
                      <span className="body">
                        <span className="big">
                          ×{b.n}
                          <small>{b.n === 1 ? "пак" : "паков"}</small>
                        </span>
                        <span className="meta">
                          <span className="cost">
                            {fmt(costOf(b))} <Cur k={PAY_CUR[effectivePay]} size={16} />
                          </span>
                          {saved > 0 && <span className="save">−{saved} {saved < 5 ? "пак" : "паков"} в подарок</span>}
                        </span>
                        {l > 0 && <span className="lack">Не хватает {fmt(l)} {unit}</span>}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <aside className="cg-main-r" aria-label="Статистика паков">
        <Panel title="Гарантии" hint="Считаются паки подряд без редкой добычи.">
          <div className="cg-guar">
            <Gauge title="Эпическая и выше" left={epicLeft} now={w.pityEpic} max={PACK.pityEpic} color={RANKS[2].color} />
            <Gauge title="Легендарная и выше" left={legendLeft} now={w.pityLegend} max={PACK.pityLegend} color={RANKS[3].color} />
            <div className="cg-odds" aria-label="Шансы одной карты">
              {RANKS.map((r, i) => {
                const p = PACK.weights[i] / 10;
                return (
                  <div key={r.id} className="cg-odds-row" style={{ ["--c" as string]: r.color }}>
                    <span>{r.name}</span>
                    <span className="t">
                      <i style={{ width: `${Math.min(100, p * 1.6)}%` }} />
                    </span>
                    <em>{p.toFixed(1)}%</em>
                  </div>
                );
              })}
            </div>
            <p className="cg-hint" style={{ margin: 0 }}>
              {s.premium ? "Premium: шансы на редкие карты ×1,25." : "С Premium шансы на редкие карты выше на 25%."}
            </p>
          </div>
        </Panel>

        <Panel title="Победители" hint="Легендарные и мифические карты, выпавшие игрокам.">
          {(["today", "yesterday"] as const).map((k) => (
            <div key={k} className="cg-feed">
              <h3>{k === "today" ? "Сегодня" : "Вчера"}</h3>
              {s.pulls[k].length === 0 ? (
                <div className="cg-empty">
                  <Ico name="trophy" size={22} />
                  {k === "today" ? "Пока никого — станьте первым." : "Вчера редких находок не было."}
                </div>
              ) : (
                <Winners list={s.pulls[k]} now={now} />
              )}
            </div>
          ))}
        </Panel>
      </aside>

      {chosen.length > 0 && (
        <Reveal
          cards={chosen}
          onClose={closeReveal}
          title={chosen.length === 1 ? "Новая карта в коллекции" : `Добыча: ${chosen.length} карт`}
          sub={dustBack ? `Остальные карты ушли в пыль: +${fmt(dustBack)}` : undefined}
        />
      )}
    </div>
    </>
  );
}
