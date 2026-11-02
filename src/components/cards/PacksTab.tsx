"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CATALOG, cardDef, isHidden } from "@/lib/cards/catalog";
import { PACK, RANKS } from "@/lib/cards/config";
import { sfx } from "@/lib/cards/sound";
import { act, hasArt, type CardsState, type Pull } from "@/lib/cards/client";
import { GameCard } from "./GameCard";
import { BannerCard } from "./BannerCard";
import { PackStage, type PackPhase } from "./PackStage";
import { Reveal, ago, fmt, toast, useBusy, useNow } from "./common";
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

/** Пять карт для веера: лучшие из коллекции, недостающие — витринные высшего ранга */
function useFan(s: CardsState): string[] {
  return useMemo(() => {
    const own = new Map<string, number>();
    for (const c of s.inventory) {
      const d = cardDef(c.cardId);
      if (d) own.set(c.cardId, Math.max(own.get(c.cardId) ?? 0, d.rank * 1000 + c.level));
    }
    const ids = [...own.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id).slice(0, 5);
    if (ids.length < 5) {
      const rest = CATALOG.filter((c) => !isHidden(c.id) && !ids.includes(c.id)).sort((a, b) => b.rank - a.rank);
      for (const c of rest) {
        if (ids.length >= 5) break;
        ids.push(c.id);
      }
    }
    /* лучшая карта в центре, остальные расходятся веером */
    const [a, b, c, d, e] = ids;
    return [d, b, a, c, e].filter((x): x is string => !!x);
  }, [s.inventory]);
}

function FeedRow({ p, now }: { p: Pull; now: number }) {
  const d = cardDef(p.cardId);
  const r = RANKS[p.rank];
  return (
    <li className={`pk-row${p.rank >= 4 ? " top" : ""}`} style={{ ["--c" as string]: r?.color }}>
      <Thumb cardId={p.cardId} rank={p.rank} name={d?.name ?? "?"} />
      <span className="pk-row-t">
        <b>{d?.name ?? "Карта"}</b>
        <span className="cg-tag" style={{ color: r?.color }}>
          {r?.name}
        </span>
      </span>
      <span className="pk-row-r">
        <b>{p.nick}</b>
        <small>{ago(p.at, now)}</small>
      </span>
    </li>
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

  const packWord = (n: number) => (n === 1 ? "пак" : n < 5 ? "пака" : "паков");
  const fan = useFan(s);
  const feed = [...s.pulls.today, ...s.pulls.yesterday];
  const toShop = () => document.getElementById("pk-shop")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const bar = (left: number, max: number) => Math.min(100, ((max - left) / max) * 100);

  return (
    <div className="pk-page">
      <section className="pk-hero" aria-label="Паки AniGalaxy">
        <div className="pk-hero-l">
          <span className="cg-eyebrow">Паки AniGalaxy</span>
          <h1>Откройте пак, найдите героя</h1>
          <p>В каждом паке три карты на выбор. Гарантии на эпическую и легендарную копятся, пока вы открываете паки подряд.</p>
          <button type="button" className="cg-btn" onClick={toShop}>
            <Ico name="pack" size={17} /> К магазину паков
          </button>
        </div>
        <div className="pk-fan" aria-hidden>
          {fan.map((id, i) => {
            const d = cardDef(id);
            const r = d ? RANKS[d.rank] : undefined;
            return (
              <div key={id} className={`pk-fan-i i${i}`} style={{ ["--c" as string]: r?.color }}>
                <GameCard cardId={id} stats={false} />
                <b>{d?.name}</b>
                <span>{r?.name}</span>
              </div>
            );
          })}
        </div>
        <aside className="pk-stock" aria-label="Мой запас">
          <span className="pk-lbl">Мой запас</span>
          <ul>
            <li>
              <Cur k="packs" size={22} /> <span>Жетоны паков</span> <b>{fmt(w.packs)}</b>
            </li>
            <li>
              <Cur k="diamonds" size={22} /> <span>Алмазы</span> <b>{fmt(w.diamonds)}</b>
            </li>
            <li>
              <Cur k="dust" size={22} /> <span>Пыль</span> <b>{fmt(w.dust)}</b>
            </li>
          </ul>
          <span className="pk-lbl">Ближайшие гарантии</span>
          {[
            { t: "Эпическая", left: epicLeft, max: PACK.pityEpic, c: RANKS[2].color },
            { t: "Легендарная", left: legendLeft, max: PACK.pityLegend, c: RANKS[3].color },
          ].map((g) => (
            <div key={g.t} className="pk-gbar" style={{ ["--c" as string]: g.c }}>
              <div>
                <b>{g.t}</b>
                <span>{g.left <= 1 ? "в следующем паке" : `через ${g.left} ${packWord(g.left)}`}</span>
              </div>
              <i>
                <u style={{ width: `${bar(g.left, g.max)}%` }} />
              </i>
            </div>
          ))}
        </aside>
      </section>

      <section className="pk-sec" id="pk-shop" aria-labelledby="pk-shop-t">
        <h2 className="pk-h" id="pk-shop-t">
          <Ico name="pack" size={22} /> Магазин паков
        </h2>
        <div className="pk-shop" style={{ ["--oc" as string]: OFFER_COLOR[sel] ?? OFFER_COLOR[0] }}>
          <div className="pk-pick">
            <span className="pk-lbl">Выберите набор</span>
            <div className="pk-opts" role="group" aria-label="Набор паков">
              {bundles.map((b, i) => {
                const l = lackOf(b);
                const saved = b.n - b.pay;
                return (
                  <button
                    key={b.n}
                    type="button"
                    className="pk-opt"
                    aria-pressed={sel === i}
                    disabled={!!pendingOffers || loading}
                    style={{ ["--oc" as string]: OFFER_COLOR[i] ?? OFFER_COLOR[0] }}
                    onClick={() => setSel(i)}
                  >
                    <img src={`/cards/offers/${Math.min(i, 2) + 1}.webp`} alt="" draggable={false} loading="lazy" />
                    <span className="pk-opt-t">
                      <small>{i === bundles.length - 1 ? "Лучшая выгода" : i === 0 ? "Один пак" : "Набор"}</small>
                      <b>
                        ×{b.n} {packWord(b.n)}
                      </b>
                      <span className="pk-opt-c">
                        {fmt(costOf(b))} <Cur k={PAY_CUR[effectivePay]} size={15} />
                        {saved > 0 && <em>−{saved} в подарок</em>}
                      </span>
                      {l > 0 && <span className="pk-opt-lack">Не хватает {fmt(l)} {unit}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="pk-pay">
              <span className="pk-lbl">Оплата</span>
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
              <p className="pk-note">Набор из 6 паков стоит как 5, набор из 20 — как 15. В наборах лучшую карту можно забирать автоматически: включите быстрое открытие.</p>
            </div>
          </div>

          <div className="pk-center">
            <div className="pk-title">
              <span className="cg-eyebrow">Бустер AniGalaxy</span>
              <h3>{pendingOffers ? "Выберите одну карту" : "Откройте пак"}</h3>
              <p>{pendingOffers ? "Остальные две карты превратятся в пыль — вернётся четверть их стоимости." : `В каждом паке ${PACK.choices} карты на выбор.`}</p>
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
              <div className="pk-act">
                <button type="button" className="cg-cta" disabled={loading || !!reason} onClick={() => void open(bundle.n)}>
                  {loading ? <span className="cg-spin" /> : <Ico name="pack" size={20} />}
                  {loading ? "Открываем…" : bundle.n === 1 ? "Открыть пак" : `Открыть ×${bundle.n}`}
                  <span className="price">
                    {fmt(costOf(bundle))} <Cur k={PAY_CUR[effectivePay]} size={16} />
                  </span>
                </button>
                <label className="cg-switch">
                  <input type="checkbox" checked={quick} onChange={toggleQuick} />
                  <i />
                  Быстрое открытие
                </label>
                {reason && !loading && (
                  <span className="cg-why" role="status">
                    <Ico name="ban" size={16} />
                    {reason}
                  </span>
                )}
              </div>
            )}

            <div className="pk-gar">
              <span className="pk-lbl">Гарантии</span>
              <div className="pk-gar-g">
                <Gauge title="Эпическая и выше" left={epicLeft} now={w.pityEpic} max={PACK.pityEpic} color={RANKS[2].color} />
                <Gauge title="Легендарная и выше" left={legendLeft} now={w.pityLegend} max={PACK.pityLegend} color={RANKS[3].color} />
              </div>
              <div className="pk-odds" aria-label="Шансы одной карты">
                {RANKS.map((r, i) => (
                  <span key={r.id} style={{ ["--c" as string]: r.color }}>
                    <i />
                    {r.name}
                    <b>{(PACK.weights[i] / 10).toFixed(1)}%</b>
                  </span>
                ))}
              </div>
              <p className="pk-note">{s.premium ? "Premium: шансы на редкие карты ×1,25." : "С Premium шансы на редкие карты выше на 25%."}</p>
            </div>
          </div>

          <aside className="pk-side" aria-label="Лента находок">
            <span className="pk-lbl">Уже нашли · {feed.length}</span>
            <p className="pk-note">Легендарные и мифические карты, выпавшие игрокам.</p>
            {feed.length === 0 ? (
              <div className="cg-empty">
                <Ico name="trophy" size={22} />
                Пока никого — станьте первым.
              </div>
            ) : (
              <ul className="pk-side-l">
                {feed.map((p, i) => (
                  <FeedRow key={i} p={p} now={now} />
                ))}
              </ul>
            )}
          </aside>
        </div>
      </section>

      <section className="pk-sec" aria-labelledby="pk-ban-t">
        <h2 className="pk-h" id="pk-ban-t">
          <Ico name="star" size={22} /> Баннер недели
        </h2>
        <BannerCard s={s} />
      </section>

      {chosen.length > 0 && (
        <Reveal
          cards={chosen}
          onClose={closeReveal}
          title={chosen.length === 1 ? "Новая карта в коллекции" : `Добыча: ${chosen.length} карт`}
          sub={dustBack ? `Остальные карты ушли в пыль: +${fmt(dustBack)}` : undefined}
        />
      )}
    </div>
  );
}
