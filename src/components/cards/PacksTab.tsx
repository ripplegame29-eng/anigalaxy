"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CATALOG, cardDef, isHidden } from "@/lib/cards/catalog";
import { PACK, RANKS } from "@/lib/cards/config";
import { sfx } from "@/lib/cards/sound";
import { act, hasArt, type CardsState, type Pull } from "@/lib/cards/client";
import { GameCard } from "./GameCard";
import { BannerCard } from "./BannerCard";
import { CardViewer } from "./CardViewer";
import { PackStage, type PackPhase } from "./PackStage";
import { Portal, Reveal, ago, fmt, toast, useBusy, useNow } from "./common";
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

/** Цвета рамок наборов: синий, фиолетовый, золотой */
/** Упаковка набора для сцены: у одиночного пака своя анимация открытия, у наборов — общий арт */
const BUNDLE_ART: ({ src: string; ar: number } | undefined)[] = [undefined, { src: "/cards/offers/2.webp", ar: 880 / 598 }, { src: "/cards/offers/3.webp", ar: 880 / 738 }];
const OFFER_COLOR = ["#3aa0ff", "#b46bff", "#4fe3ff"];

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
  const [look, setLook] = useState<number | null>(null);
  const [gal, setGal] = useState(false);
  const now = useNow(60_000);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!gal) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setGal(false);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [gal]);

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
  const wallets = [
    { id: "token", label: "Жетоны паков", have: w.packs, per: 1, k: "packs" },
    { id: "diamonds", label: "Алмазы", have: w.diamonds, per: PACK.diamonds, k: "diamonds" },
    { id: "dust", label: "Пыль", have: w.dust, per: PACK.dust, k: "dust" },
  ] as const;
  const toShop = () => document.getElementById("pk-shop")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const bar = (left: number, max: number) => Math.min(100, ((max - left) / max) * 100);

  const renderTile = (b: (typeof bundles)[number], i: number) => {
              const l = lackOf(b);
              const gift = effectivePay === "token" ? 0 : b.n - b.pay;
              const each = Math.round(costOf(b) / b.n);
              return (
                <button
                  key={b.n}
                  type="button"
                  className="st-tile"
                  aria-pressed={sel === i}
                  disabled={!!pendingOffers || loading}
                  style={{ ["--oc" as string]: OFFER_COLOR[i] ?? OFFER_COLOR[0] }}
                  onClick={() => {
                    setSel(i);
                    setGal(false);
                  }}
                >
                  {i === bundles.length - 1 ? <span className="st-rib best">Лучшая выгода</span> : i === 1 ? <span className="st-rib">Популярный</span> : null}
                  <span className="st-art" aria-hidden>
                    <i className="st-beam" />
                    <i className="st-pad" />
                    <img src={`/cards/offers/${Math.min(i, 2) + 1}.webp`} alt="" draggable={false} loading="lazy" />
                    {gift > 0 && (
                      <span className="st-gift">
                        <Ico name="gift" size={13} />+{gift}
                      </span>
                    )}
                  </span>
                  <b className="st-n">
                    ×{b.n} <small>{packWord(b.n)}</small>
                  </b>
                  <span className="st-price">
                    {fmt(costOf(b))} <Cur k={PAY_CUR[effectivePay]} size={17} />
                  </span>
                  <span className="st-meta">
                    {b.n > 1 && effectivePay !== "token" && <span>по {fmt(each)} за пак</span>}
                    {gift > 0 && <em>−{gift} {packWord(gift)} в подарок</em>}
                    {(b.n === 1 || effectivePay === "token") && <span>{PACK.choices} карты на выбор в каждом</span>}
                  </span>
                  {l > 0 && <span className="st-lack">Не хватает {fmt(l)} {unit}</span>}
                </button>
              );
  };

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
        <div className="pk-fan" role="list" aria-label="Карты коллекции">
          {fan.map((id, i) => {
            const d = cardDef(id);
            const r = d ? RANKS[d.rank] : undefined;
            return (
              <button
                key={id}
                type="button"
                role="listitem"
                className={`pk-fan-i i${i}`}
                style={{ ["--c" as string]: r?.color, ["--i" as string]: i }}
                onClick={() => setLook(i)}
                aria-label={`${d?.name}, ${r?.name}. Открыть`}
              >
                <span className="pk-fan-c">
                  <GameCard cardId={id} stats={false} />
                  <i className="pk-fan-g" aria-hidden />
                </span>
                <b>{d?.name}</b>
                <span className="pk-fan-r">{r?.name}</span>
              </button>
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
        <div className="st" style={{ ["--oc" as string]: OFFER_COLOR[sel] ?? OFFER_COLOR[0] }}>
          <div className="st-top">
            <div className="st-wal" role="radiogroup" aria-label="Чем платить">
              {wallets.map((x) => {
                const can = Math.floor(x.have / x.per);
                return (
                  <button
                    key={x.id}
                    type="button"
                    role="radio"
                    aria-checked={effectivePay === x.id}
                    disabled={!!pendingOffers || loading}
                    onClick={() => setPay(x.id)}
                  >
                    <Cur k={x.k} size={26} />
                    <span>
                      <small>{x.label}</small>
                      <b>{fmt(x.have)}</b>
                    </span>
                    <em>{can > 0 ? `хватит на ${can} ${packWord(can)}` : x.id === "token" && w.packs < 1 ? "нет жетонов" : "не хватает"}</em>
                  </button>
                );
              })}
            </div>
            <label className="cg-switch" title="Лучшая карта из тройки забирается сразу, без выбора">
              <input type="checkbox" checked={quick} onChange={toggleQuick} />
              <i />
              Быстрое открытие
            </label>
          </div>

          <div className="st-dock" data-pick={pendingOffers ? "1" : undefined}>
            <div className="st-stage">
              {pendingOffers ? (
                <div className="cg-pickstage">
                  <div className="cg-offers">
                    {pendingOffers.map((id, i) => (
                      <GameCard key={id} cardId={id} live onClick={() => void pickCard(i)} className="cg-offer-card" />
                    ))}
                  </div>
                </div>
              ) : (
                <PackStage phase={phase} blocked={!!reason && !loading} art={BUNDLE_ART[sel]} onOpen={() => void open(bundle.n)} />
              )}
            </div>

            <div className="pk-info st-co">
              {!pendingOffers && (
                <div className="st-pick">
                  <div className="st-seg" role="group" aria-label="Набор паков">
                    {bundles.map((b, i) => (
                      <button
                        key={b.n}
                        type="button"
                        className="st-opt"
                        aria-pressed={sel === i}
                        disabled={loading}
                        style={{ ["--oc" as string]: OFFER_COLOR[i] ?? OFFER_COLOR[0] }}
                        onClick={() => setSel(i)}
                      >
                        <img src={`/cards/offers/${Math.min(i, 2) + 1}.webp`} alt="" draggable={false} />
                        <span>
                          <b>×{b.n}</b>
                          <small>{i === 0 ? "один пак" : effectivePay !== "token" && b.n > b.pay ? `+${b.n - b.pay} в подарок` : `${b.n} паков`}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                  <button type="button" className="st-all" disabled={loading} onClick={() => setGal(true)}>
                    <Ico name="grid" size={16} /> Все наборы
                  </button>
                </div>
              )}
              <div className="pk-chips">
                <span className="cg-eyebrow">Набор AniGalaxy</span>
                <span className="cg-chip">{PACK.choices} карты на выбор</span>
              </div>
              <h3>{pendingOffers ? "Выберите одну карту" : bundle.n === 1 ? "Один пак" : `Набор ×${bundle.n}`}</h3>
              {pendingOffers ? (
                <p className="pk-sub">Остальные две карты превратятся в пыль — вернётся четверть их стоимости.</p>
              ) : (
                <>
                  <dl className="st-sum">
                    <div>
                      <dt>Вы получите</dt>
                      <dd>
                        {bundle.n} {bundle.n === 1 ? "карту" : bundle.n < 5 ? "карты" : "карт"} <small>из {PACK.choices * bundle.n} на выбор</small>
                      </dd>
                    </div>
                    <div>
                      <dt>Стоимость</dt>
                      <dd>
                        {fmt(costOf(bundle))} <Cur k={PAY_CUR[effectivePay]} size={16} />
                      </dd>
                    </div>
                    {effectivePay !== "token" && bundle.n > bundle.pay && (
                      <div className="ok">
                        <dt>Экономия</dt>
                        <dd>
                          {fmt((bundle.n - bundle.pay) * (effectivePay === "diamonds" ? PACK.diamonds : PACK.dust))} <Cur k={PAY_CUR[effectivePay]} size={16} />
                        </dd>
                      </div>
                    )}
                    <div className={lack > 0 ? "bad" : undefined}>
                      <dt>Баланс после</dt>
                      <dd>
                        {fmt(haveOf)} <i aria-hidden>→</i> {lack > 0 ? "—" : fmt(haveOf - costOf(bundle))} <Cur k={PAY_CUR[effectivePay]} size={16} />
                      </dd>
                    </div>
                  </dl>
                  <ul className="pk-bul">
                    <li>
                      <Ico name="check" size={15} /> Оставляете лучшую карту, остальные уходят в пыль
                    </li>
                    <li>
                      <Ico name="check" size={15} /> {s.premium ? "Premium: шансы на редкие карты ×1,25" : "С Premium шансы на редкие карты выше на 25%"}
                    </li>
                  </ul>
                  <div className="pk-odds" aria-label="Шансы одной карты">
                    {RANKS.map((r, i) => (
                      <span key={r.id} style={{ ["--c" as string]: r.color }}>
                        <i />
                        {r.name}
                        <b>{(PACK.weights[i] / 10).toFixed(1)}%</b>
                      </span>
                    ))}
                  </div>
                  <div className="pk-act st-buy">
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
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="st-low">
            <div className="st-guar">
              <span className="pk-lbl">Гарантии</span>
              <div className="pk-gcards">
                {[
                  { t: "Эпическая и выше", left: epicLeft, now: w.pityEpic, max: PACK.pityEpic, c: RANKS[2].color },
                  { t: "Легендарная и выше", left: legendLeft, now: w.pityLegend, max: PACK.pityLegend, c: RANKS[3].color },
                ].map((g) => (
                  <div key={g.t} className="pk-gc" style={{ ["--c" as string]: g.c }}>
                    <b className="n">{g.left}</b>
                    <div>
                      <h4>{g.t}</h4>
                      <span>{g.left <= 1 ? "выпадет в следующем паке" : `${packWord(g.left)} до гарантии`}</span>
                    </div>
                    <i role="progressbar" aria-valuemin={0} aria-valuemax={g.max} aria-valuenow={g.now} aria-label={`Серия без ${g.t}`}>
                      <u style={{ width: `${bar(g.left, g.max)}%` }} />
                    </i>
                    <small>
                      Серия без неё: {g.now} из {g.max}
                    </small>
                  </div>
                ))}
              </div>
            </div>
            <div className="st-feed">
              <span className="pk-lbl">Уже нашли · {feed.length}</span>
              {feed.length === 0 ? (
                <div className="cg-empty">
                  <Ico name="trophy" size={22} />
                  Пока никого — станьте первым.
                </div>
              ) : (
                <ul className="st-feed-l">
                  {feed.map((p, i) => (
                    <FeedRow key={i} p={p} now={now} />
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="pk-sec" aria-labelledby="pk-ban-t">
        <h2 className="pk-h" id="pk-ban-t">
          <Ico name="star" size={22} /> Карта недели
        </h2>
        <BannerCard s={s} />
      </section>

      {gal && (
        <Portal>
          <div className="st-gal" role="dialog" aria-modal="true" aria-label="Выбор набора" onClick={(e) => e.target === e.currentTarget && setGal(false)}>
            <div className="st-gal-p" style={{ ["--oc" as string]: OFFER_COLOR[sel] ?? OFFER_COLOR[0] }}>
              <header>
                <div>
                  <span className="cg-eyebrow">Наборы</span>
                  <h3>Выберите набор паков</h3>
                  <p>Чем больше набор, тем выгоднее: при оплате алмазами или пылью часть паков достаётся в подарок.</p>
                </div>
                <button type="button" className="st-gal-x" aria-label="Закрыть" onClick={() => setGal(false)}>
                  <Ico name="close" size={18} />
                </button>
              </header>
              <div className="st-tiles" role="group" aria-label="Набор паков">
                {bundles.map((b, i) => renderTile(b, i))}
              </div>
              <footer>
                <span>
                  Оплата: <b>{wallets.find((x) => x.id === effectivePay)?.label}</b> · на счету <b>{fmt(haveOf)}</b> <Cur k={PAY_CUR[effectivePay]} size={15} />
                </span>
              </footer>
            </div>
          </div>
        </Portal>
      )}

      {look !== null && fan[look] && (
        <CardViewer ids={fan} index={look} onIndex={setLook} onClose={() => setLook(null)} owned={s.inventory.some((c) => c.cardId === fan[look])} />
      )}

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
