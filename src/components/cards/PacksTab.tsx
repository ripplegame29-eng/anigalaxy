"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cardDef } from "@/lib/cards/catalog";
import { PACK, RANKS } from "@/lib/cards/config";
import { sfx } from "@/lib/cards/sound";
import { act, type CardsState } from "@/lib/cards/client";
import { ShopTab } from "./ShopTab";
import { GameCard } from "./GameCard";
import { BannerCard } from "./BannerCard";
import { CardViewer } from "./CardViewer";
import { PackStage, type PackPhase } from "./PackStage";
import { PackHero, FAN_IDS } from "./PackHero";
import { StockPanel } from "./StockPanel";
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

/** Упаковка набора для сцены: у одиночного пака своя анимация открытия, у наборов — общий арт */
const BUNDLE_ART: ({ src: string; ar: number } | undefined)[] = [undefined, { src: "/cards/offers/2.webp?v=7", ar: 1556 / 1088 }, { src: "/cards/offers/3.webp?v=7", ar: 1706 / 1300 }];
const OFFER_COLOR = ["#3aa0ff", "#b46bff", "#4fe3ff"];

const packWord = (n: number) => (n === 1 ? "пак" : n < 5 ? "пака" : "паков");
const pctOf = (w: number) => String(w / 10).replace(".", ",");
const bar = (left: number, max: number) => Math.min(100, ((max - left) / max) * 100);
const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

/** Кольцо гарантии: заливается после появления на экране */
function Ring({ pct, color, ready }: { pct: number; color: string; ready: boolean }) {
  return (
    <svg viewBox="0 0 80 80" aria-hidden style={{ ["--cl" as string]: color } as CSSProperties}>
      <circle className="t" cx="40" cy="40" r="36" />
      <circle className="f" cx="40" cy="40" r="36" style={{ strokeDashoffset: ready ? 226 - (226 * pct) / 100 : 226 }} />
    </svg>
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
  const [ring, setRing] = useState(false);
  const now = useNow(60_000);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const id = window.requestAnimationFrame(() => setRing(true));
    return () => {
      alive.current = false;
      window.cancelAnimationFrame(id);
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

  const fan = FAN_IDS.filter((id) => !!cardDef(id));
  const feed = [...s.pulls.today, ...s.pulls.yesterday];
  const energyLeft = w.nextEnergyAt ? w.nextEnergyAt - now : 0;
  const wallets = [
    { id: "token", label: "Жетоны паков", have: w.packs, per: 1, k: "packs" },
    { id: "diamonds", label: "Алмазы", have: w.diamonds, per: PACK.diamonds, k: "diamonds" },
    { id: "dust", label: "Пыль", have: w.dust, per: PACK.dust, k: "dust" },
  ] as const;

  /* лента для бегущей строки: две одинаковые половины, чтобы цикл был бесшовным */
  const tickBase = feed.length ? Array.from({ length: Math.ceil(8 / feed.length) }, () => feed).flat() : [];
  const tick = [...tickBase, ...tickBase];
  const lastFind = feed[0];
  const lastDef = lastFind ? cardDef(lastFind.cardId) : undefined;

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
          <img src={`/cards/offers/${Math.min(i, 2) + 1}.webp?v=7`} alt="" draggable={false} loading="lazy" />
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
          {gift > 0 && (
            <em>
              −{gift} {packWord(gift)} в подарок
            </em>
          )}
          {(b.n === 1 || effectivePay === "token") && <span>{PACK.choices} карты на выбор в каждом</span>}
        </span>
        {l > 0 && (
          <span className="st-lack">
            Не хватает {fmt(l)} {unit}
          </span>
        )}
      </button>
    );
  };

  const pickEl = !pendingOffers && (
    <div className="st-pick">
      <div className="st-seg" role="group" aria-label="Набор паков">
        {bundles.map((b, i) => (
          <button key={b.n} type="button" className="st-opt" aria-pressed={sel === i} disabled={loading} style={{ ["--oc" as string]: OFFER_COLOR[i] ?? OFFER_COLOR[0] }} onClick={() => setSel(i)}>
            <img src={`/cards/offers/${Math.min(i, 2) + 1}.webp?v=7`} alt="" draggable={false} />
            <span>
              <b>×{b.n}</b>
              <small>{i === 0 ? "один пак" : effectivePay !== "token" && b.n > b.pay ? `+${b.n - b.pay} в подарок` : `${b.n} паков`}</small>
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  const stageEl = (
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
  );

  const guar = [
    { t: "Эпическая и выше", left: epicLeft, now: w.pityEpic, max: PACK.pityEpic, c: RANKS[2].color },
    { t: "Легендарная и выше", left: legendLeft, now: w.pityLegend, max: PACK.pityLegend, c: RANKS[3].color },
  ];

  return (
    <div className="pk-page cg2-page">
      <PackHero onShop={() => scrollTo("pk-shop")} onWeek={() => scrollTo("pk-week")} onLook={setLook} />

      <StockPanel
        s={s}
        energyLeft={energyLeft}
        loading={loading}
        disabled={loading || !!reason}
        hint={!loading && reason ? reason : undefined}
        onOpen={() => void open(bundle.n)}
        cta={
          <>
            {bundle.n === 1 ? "Открыть пак" : `Открыть ×${bundle.n}`}
            <small>
              {fmt(costOf(bundle))} <Cur k={PAY_CUR[effectivePay]} size={14} />
            </small>
          </>
        }
      />

      <section className="cg2-sec" id="pk-week" aria-labelledby="pk-ban-t">
        <div className="cg2-sh">
          <div>
            <span className="cg2-eye">Карта недели</span>
            <h2 id="pk-ban-t">Герой в центре внимания</h2>
          </div>
        </div>
        <BannerCard s={s} />
      </section>

      <section className="cg2-sec" id="pk-shop" aria-labelledby="pk-shop-t">
        <div className="cg2-sh">
          <div>
            <span className="cg2-eye">Магазин паков</span>
            <h2 id="pk-shop-t">Выберите набор</h2>
          </div>
          <p>Чем больше набор, тем больше паков в подарок.</p>
        </div>
        <div className="st cg2-glass" style={{ ["--oc" as string]: OFFER_COLOR[sel] ?? OFFER_COLOR[0] }}>
          <div className="st-top">
            <div className="st-wal" role="radiogroup" aria-label="Чем платить">
              {wallets.map((x) => {
                const can = Math.floor(x.have / x.per);
                return (
                  <button key={x.id} type="button" role="radio" aria-checked={effectivePay === x.id} disabled={!!pendingOffers || loading} onClick={() => setPay(x.id)}>
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
            {stageEl}

            <div className="pk-info st-co">
              {pickEl}
              <span className="cg2-eye">{pendingOffers ? "Ваш выбор" : bundle.n === 1 ? "Стандарт" : `Набор ×${bundle.n}`}</span>
              <h3>{pendingOffers ? "Выберите одну карту" : bundle.n === 1 ? "Один пак" : `${bundle.n} ${packWord(bundle.n)}`}</h3>
              {pendingOffers ? (
                <p className="pk-sub">Остальные две карты превратятся в пыль: вернётся часть их стоимости.</p>
              ) : (
                <>
                  <div className="cg2-price">
                    <b>{fmt(costOf(bundle))}</b>
                    <Cur k={PAY_CUR[effectivePay]} size={22} />
                    <small>{effectivePay === "token" ? "жетонов" : effectivePay === "diamonds" ? "алмазов" : "пыли"}</small>
                  </div>
                  <dl className="st-sum">
                    <div>
                      <dt>Вы получите</dt>
                      <dd>
                        {bundle.n} {bundle.n === 1 ? "карту" : bundle.n < 5 ? "карты" : "карт"} <small>из {PACK.choices * bundle.n} на выбор</small>
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
                  <div className="cg2-spec" role="img" aria-label="Шансы одной карты">
                    {RANKS.map((r, i) => (
                      <i key={r.id} style={{ ["--w" as string]: Math.max(PACK.weights[i] / 10, 3), ["--c" as string]: r.color } as CSSProperties} title={`${r.name} ${pctOf(PACK.weights[i])}%`} />
                    ))}
                  </div>
                  <div className="cg2-leg">
                    {RANKS.map((r, i) => (
                      <span key={r.id} style={{ ["--c" as string]: r.color } as CSSProperties}>
                        <i aria-hidden>●</i> {r.name} <b>{pctOf(PACK.weights[i])}%</b>
                      </span>
                    ))}
                  </div>
                  <ul className="pk-bul">
                    <li>
                      <Ico name="check" size={15} /> Оставляете лучшую карту, остальные уходят в пыль
                    </li>
                    <li>
                      <Ico name="check" size={15} /> {s.premium ? "Premium: шансы на редкие карты ×1,25" : "С Premium шансы на редкие карты выше на 25%"}
                    </li>
                  </ul>
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
            <div className="cg2-gar">
              {guar.map((g) => (
                <div key={g.t} className="cg2-gr" style={{ ["--cl" as string]: g.c } as CSSProperties}>
                  <Ring pct={bar(g.left, g.max)} color={g.c} ready={ring} />
                  <div>
                    <h3>
                      {g.left} {packWord(g.left)}
                    </h3>
                    <p>
                      до гарантии {g.t.toLowerCase()}
                      <br />
                      Серия без неё: {g.now} из {g.max}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="cg2-found">
              <Ico name="trophy" size={18} />
              {lastFind ? (
                <span>
                  Последняя находка: <b style={{ color: RANKS[lastFind.rank]?.color }}>{lastDef?.name ?? "карта"}</b> · {lastFind.nick}, {ago(lastFind.at, now)}
                </span>
              ) : (
                <span>Из последних находок пока никого. Станьте первым.</span>
              )}
            </div>
          </div>
        </div>
      </section>

      <ShopTab />

      <section className="cg2-sec" aria-labelledby="pk-feed-t">
        <div className="cg2-sh">
          <div>
            <span className="cg2-eye">Лента находок</span>
            <h2 id="pk-feed-t">Герои, которых нашли только что</h2>
          </div>
        </div>
        {tick.length === 0 ? (
          <div className="cg2-glass cg2-feed-empty">Пока никого. Первая находка появится здесь.</div>
        ) : (
          <div className="cg2-glass cg2-tick" aria-label="Недавние находки игроков">
            <div className="tk">
              {tick.map((p, i) => {
                const d = cardDef(p.cardId);
                const r = RANKS[p.rank];
                return (
                  <div key={i} aria-hidden={i >= tickBase.length}>
                    <i style={{ ["--c1" as string]: r?.color }}>{r?.short}</i>
                    <span>
                      {d?.name ?? "Карта"}
                      <br />
                      <small>
                        {r?.name} · {p.nick} · {ago(p.at, now)}
                      </small>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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

      {look !== null && fan[look] && <CardViewer ids={fan} index={look} onIndex={setLook} onClose={() => setLook(null)} owned={s.inventory.some((c) => c.cardId === fan[look])} />}

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

