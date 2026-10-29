"use client";

import type { CSSProperties } from "react";
/**
 * Сезонный пасс карточной игры («Сезонный свод»): герб сезона и веер ближайших наград,
 * золотая карточка премиума, дорожка из наградных карт на светящейся тропе уровней
 * и журнал очков. Логика наград прежняя — меняется только вид (стили `sv-*`).
 */

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { PASS, PASS_XP, PASS_XP_DAILY, PASS_XP_MISSION, passReward, seasonNo, type PassTrack } from "@/lib/cards/season";
import { cardDef } from "@/lib/cards/catalog";
import { RANKS } from "@/lib/cards/config";
import { rewardText, type Reward } from "@/lib/cards/progress";
import { act, type CardsState } from "@/lib/cards/client";
import { fmt, fmtLeft, toast, useBusy, useNow } from "./common";
import { Cur, Ico, ScrollArt, type IcoName } from "./icons";

const XP_ROWS: [string, string, IcoName][] = [
  ["wins", "Победа в бою", "swords"],
  ["raidHits", "Удар по рейд-боссу", "skull"],
  ["stars", "Новая звезда кампании", "star"],
  ["trades", "Обмен или сделка на аукционе", "swap"],
  ["packs", "Открытый пак", "pack"],
  ["skillUps", "Прокачка умения", "trend"],
  ["sharpen", "Заточка карты", "anvil"],
  ["evo", "Пробуждение карты", "dust"],
];

type Part = { k: "scroll" | "packs" | "diamonds" | "dust" | "card"; n: number; label: string; id?: string };

/** Состав награды: главная часть идёт крупно, остальные — строкой под ней */
function parts(r: Reward): Part[] {
  const list: Part[] = [];
  const def = r.card ? cardDef(r.card) : undefined;
  if (def) list.push({ k: "card", n: def.rank, label: def.name, id: def.id });
  if (r.scroll) list.push({ k: "scroll", n: r.scroll, label: "Свиток" });
  if (r.packs) list.push({ k: "packs", n: r.packs, label: "Паки" });
  if (r.diamonds) list.push({ k: "diamonds", n: r.diamonds, label: "Алмазы" });
  if (r.dust) list.push({ k: "dust", n: r.dust, label: "Пыль" });
  return list;
}

function PartIcon({ k, size, id }: { k: Part["k"]; size: number; id?: string }) {
  if (k === "card") return <img className="sv-face" src={`/api/cards/art/${id}`} alt="" width={size * 2} height={size * 2} draggable={false} loading="lazy" />;
  return k === "scroll" ? <ScrollArt size={Math.round(size * 1.75)} /> : <Cur k={k} size={size} />;
}

type Status = "got" | "can" | "locked";

/** Наградная карта: рамка-фольга по ленте, у вех — голографический блик */
/** Детерминированный «случайный» разброс частиц фона (без Math.random — одинаково на сервере и в браузере) */
const rnd = (i: number, k: number): number => {
  const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return v - Math.floor(v);
};
const STARS: CSSProperties[] = Array.from({ length: 46 }, (_, i) => ({
  left: `${rnd(i, 1) * 100}%`,
  top: `${rnd(i, 2) * 42}%`,
  width: 1.5 + rnd(i, 3) * 2.2,
  height: 1.5 + rnd(i, 3) * 2.2,
  animationDelay: `${-rnd(i, 4) * 6}s`,
  animationDuration: `${3 + rnd(i, 5) * 4}s`,
}));
const SPARKS: CSSProperties[] = Array.from({ length: 26 }, (_, i) => ({
  left: `${rnd(i, 6) * 100}%`,
  bottom: `${rnd(i, 7) * 20}%`,
  width: 3 + rnd(i, 8) * 3,
  height: 3 + rnd(i, 8) * 3,
  animationDelay: `${-rnd(i, 9) * 18}s`,
  animationDuration: `${12 + rnd(i, 10) * 14}s`,
}));

const RewardCard = memo(function RewardCard({
  level,
  track,
  status,
  reward,
  onClaim,
}: {
  level: number;
  track: PassTrack;
  status: Status;
  reward: Reward;
  onClaim: (track: PassTrack, level: number) => void;
}) {
  const list = parts(reward);
  const main = list[0];
  const rest = list.slice(1);
  return (
    <button
      type="button"
      className={`sv-card ${track} ${status}${level % 5 === 0 ? " big" : ""}`}
      aria-disabled={status !== "can"}
      aria-label={`Уровень ${level}, ${track === "premium" ? "премиум" : "бесплатная"} награда: ${rewardText(reward)}`}
      onClick={() => {
        if (status === "can") onClaim(track, level);
      }}
    >
      {main && (
        <>
          <span className="sv-gem" aria-hidden><PartIcon k={main.k} size={track === "premium" ? 28 : 26} id={main.id} /></span>
          <b className="sv-val">{main.k === "card" ? `${RANKS[main.n].short}-ранг` : `+${main.n.toLocaleString("ru-RU")}`}</b>
          <small>{main.label}</small>
        </>
      )}
      {rest.length > 0 && (
        <span className="sv-more">
          {rest.map((x) => (
            <span key={x.k} title={x.label}>
              <PartIcon k={x.k} size={12} /> {x.n}
            </span>
          ))}
        </span>
      )}
      {status === "got" && <span className="sv-stamp" aria-hidden><Ico name="check" size={14} /></span>}
      {status === "locked" && track === "premium" && <span className="sv-lock" aria-hidden><Ico name="lock" size={12} /></span>}
      {status === "can" && <span className="sv-take">Забрать</span>}
    </button>
  );
});

export function SeasonTab({ s }: { s: CardsState }) {
  const p = s.events.pass;
  const [busy, run] = useBusy();
  const now = useNow(60_000);
  const railRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const [label, setLabel] = useState(Math.max(1, p.level));
  const here = Math.max(1, p.level);

  const claim = useCallback(
    (track: PassTrack, level: number) =>
      run(async () => {
        const r = await act<{ reward: Reward; count: number }>("pass-claim", { track, level });
        toast(r.ok ? `Награда пасса: ${rewardText(r.result.reward)}` : r.error, !r.ok);
      }),
    [run],
  );
  const buy = () =>
    run(async () => {
      const r = await act("pass-buy");
      toast(r.ok ? "Премиум-ветка открыта" : r.error, !r.ok);
    });

  const levels = Array.from({ length: PASS.levels }, (_, i) => i + 1);
  const availableFree = levels.filter((l) => l <= p.level && !p.free.includes(l)).length;
  const availablePrem = p.bought ? levels.filter((l) => l <= p.level && !p.premium.includes(l)).length : 0;
  const claimable = availableFree + availablePrem;
  const maxed = p.level >= PASS.levels;
  const pct = maxed ? 100 : Math.min(100, (p.into / PASS.xpPerLevel) * 100);
  const premSum = levels.reduce(
    (a, l) => {
      const r = passReward(l, "premium");
      return { diamonds: a.diamonds + (r.diamonds ?? 0), packs: a.packs + (r.packs ?? 0), scroll: a.scroll + (r.scroll ?? 0) };
    },
    { diamonds: 0, packs: 0, scroll: 0 },
  );
  const doneCount = p.free.length + p.premium.length;
  const totalCount = PASS.levels * 2;
  const nextBig = levels.find((l) => l > p.level && l % 5 === 0) ?? null;

  const scrollTo = useCallback((level: number, behavior: ScrollBehavior = "smooth") => {
    const rail = railRef.current;
    const col = rail?.querySelector<HTMLElement>(`[data-l="${Math.min(PASS.levels, Math.max(1, level))}"]`);
    if (!rail || !col) return;
    rail.scrollTo({ left: Math.max(0, col.offsetLeft - rail.clientWidth / 2 + col.clientWidth / 2), behavior });
  }, []);

  /* Дорожка: стартуем с текущего уровня; колесо и перетаскивание листают её горизонтально */
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    scrollTo(here, "auto");
    const sync = () => {
      const first = rail.firstElementChild as HTMLElement | null;
      const second = first?.nextElementSibling as HTMLElement | null;
      if (!first || !second) return;
      const stride = second.offsetLeft - first.offsetLeft;
      const center = rail.scrollLeft + rail.clientWidth / 2;
      const idx = stride > 0 ? Math.round((center - first.offsetLeft - first.clientWidth / 2) / stride) : 0;
      setLabel(Math.min(PASS.levels, Math.max(1, idx + 1)));
    };
    const onWheel = (e: WheelEvent) => {
      const max = rail.scrollWidth - rail.clientWidth;
      if (max <= 0) return;
      const down = e.deltaY > 0;
      if ((down && rail.scrollLeft >= max - 1) || (!down && rail.scrollLeft <= 0)) return;
      e.preventDefault();
      rail.scrollLeft += e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? rail.clientWidth : 1);
    };
    const onMove = (e: PointerEvent) => {
      const st = drag.current;
      if (!st) return;
      const dx = e.clientX - st.x;
      if (!st.moved && Math.abs(dx) > 5) {
        st.moved = true;
        rail.classList.add("grabbing");
      }
      if (st.moved) rail.scrollLeft = st.left - dx;
    };
    const onUp = () => {
      drag.current = null;
      rail.classList.remove("grabbing");
    };
    rail.addEventListener("scroll", sync, { passive: true });
    rail.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    sync();
    return () => {
      rail.removeEventListener("scroll", sync);
      rail.removeEventListener("wheel", onWheel);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- стартовая позиция ставится один раз
  }, []);

  const status = (l: number, track: PassTrack): Status => {
    const done = (track === "free" ? p.free : p.premium).includes(l);
    if (done) return "got";
    return l <= p.level && (track === "free" || p.bought) ? "can" : "locked";
  };
  const claimAll = () =>
    void run(async () => {
      await claim("free", 0);
      if (p.bought) await claim("premium", 0);
    });
  const jumps = [1, 5, 10, 15, 20, 25, 30];

  return (
    <div className="sv">
      <div className="sv-bg" aria-hidden>
        <i className="sv-aur" />
        <i className="sv-rays" />
        <svg className="sv-compass" viewBox="0 0 800 800" fill="none">
          <g className="sv-c-out">
            <circle cx="400" cy="400" r="392" />
            <circle cx="400" cy="400" r="372" strokeDasharray="1.5 15.5" strokeWidth="9" />
            <circle cx="400" cy="400" r="340" />
          </g>
          <g className="sv-c-in">
            <circle cx="400" cy="400" r="270" strokeDasharray="3 9" />
            <circle cx="400" cy="400" r="210" />
            <path d="M400 20v760M20 400h760" />
            <path d="M400 70l34 296 296 34-296 34-34 296-34-296-296-34 296-34z" />
            <path d="M131 131l138 138M669 131L531 269M131 669l138-138M669 669L531 531" />
          </g>
        </svg>
        {STARS.map((x, i) => (
          <i key={`s${i}`} className="sv-st" style={x} />
        ))}
        <i className="sv-bg-fog" />
        <i className="sv-bg-fog f2" />
        <i className="sv-vig" />
        {SPARKS.map((x, i) => (
          <i key={`p${i}`} className="sv-sp" style={x} />
        ))}
      </div>
      {/* ------------------------------ Герб сезона ------------------------------ */}
      <div className="sv-stage">
      <section className={`sv-hero${p.bought ? " is-prem" : ""}`}>
        <i className="sv-sky" aria-hidden />
        <i className="sv-clouds" aria-hidden />
        <i className="sv-sea" aria-hidden />
        <i className="sv-art" aria-hidden />

        <div className="sv-crest" style={{ "--p": Math.round((p.level / PASS.levels) * 100) } as CSSProperties} aria-label={`Уровень ${p.level} из ${PASS.levels}`}>
          <div className="sv-hex">
            <div className="sv-hex-in">
              <small>Уровень</small>
              <b>{p.level}</b>
              <small>из {PASS.levels}</small>
            </div>
          </div>
        </div>

        <div className="sv-main">
          <span className="cg-eyebrow">Сезон {seasonNo(p.season)} · наградной путь</span>
          <h2 className="sv-title">
            Сезонный <em>пропуск</em>
          </h2>
          <p className="sv-sub">Поднимайся по уровням за бои, паки, кампанию и рейды. Две ветки наград — бесплатная и премиум.</p>

          <div className="sv-prog">
            <div className="sv-prog-top">
              <span>{maxed ? "Максимальный уровень" : `Уровень ${p.level} → ${p.level + 1}`}</span>
              <b>{maxed ? `${fmt(p.xp)} оч.` : `${p.into} / ${PASS.xpPerLevel} оч.`}</b>
            </div>
            <div className="sv-bar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
              <i style={{ width: `${pct}%` }} />
            </div>
          </div>

          <ul className="sv-facts">
            <li>
              <Ico name="clock" size={16} />
              <span>До конца сезона</span>
              <b>{fmtLeft(p.endsAt - now)}</b>
            </li>
            <li className={claimable > 0 ? "hot" : ""}>
              <Ico name="gift" size={16} />
              <span>К получению</span>
              <b>{claimable}</b>
            </li>
            <li className={p.bought ? "gold" : ""}>
              <Ico name={p.bought ? "crown" : "lock"} size={16} />
              <span>Премиум</span>
              <b>{p.bought ? "Активен" : "Закрыт"}</b>
            </li>
          </ul>
        </div>
      </section>
      {p.bought && (
        <section className="sv-offer on">
          <span className="sv-crown" aria-hidden><Ico name="crown" size={26} /></span>
          <div>
            <h3>Премиум-лента открыта</h3>
            <p>
              Все {PASS.levels} наградных уровней нижней ленты ваши: {premSum.diamonds.toLocaleString("ru-RU")} алмазов, {premSum.packs} паков и {premSum.scroll} свитков.
              Незабранное не сгорит до конца сезона.
            </p>
          </div>
        </section>
      )}
      </div>

      {/* --------------------------------- Премиум -------------------------------- */}
      {!p.bought && (
        <section className="sv-offer">
          <i className="sv-sweep" aria-hidden />
          <span className="sv-crown" aria-hidden><Ico name="crown" size={34} /></span>
          <div className="sv-offer-t">
            <span className="sv-kick">Премиум-лента</span>
            <h3>Откройте вторую ленту наград</h3>
            <ul>
              <li><Ico name="check" size={14} /> {premSum.diamonds.toLocaleString("ru-RU")} алмазов по ходу трека — выше цены пасса</li>
              <li><Ico name="check" size={14} /> {premSum.packs} паков и {premSum.scroll} свитков улучшения</li>
              <li><Ico name="check" size={14} /> Пройденные уровни выдаются сразу</li>
              <li><Ico name="check" size={14} /> Действует до конца сезона</li>
            </ul>
          </div>
          <div className="sv-offer-b">
            <div className="sv-price">
              {p.price} <Cur k="diamonds" size={22} />
            </div>
            <button type="button" className="sv-buy" disabled={busy || s.wallet.diamonds < p.price} onClick={() => void buy()}>
              <Ico name="crown" size={16} /> Открыть премиум
            </button>
            <small>{s.wallet.diamonds < p.price ? `Не хватает ${p.price - s.wallet.diamonds} алмазов` : p.level > 1 ? `Уровни до ${p.level} выдадим сразу` : "Награды сразу"}</small>
          </div>
        </section>
      )}

      {/* ---------------------------------- Дорожка -------------------------------- */}
      <section className="sv-track" aria-labelledby="sv-track-title">
        <div className="sv-th">
          <div>
            <h3 id="sv-track-title">Награды сезона</h3>
            <p>
              Получено {doneCount} из {totalCount}
              {nextBig ? ` · следующая веха — уровень ${nextBig}` : ""}
            </p>
          </div>
          <div className="sv-th-r">
            <div className="sv-jumps" role="group" aria-label="Быстрый переход по уровням">
              <button type="button" className={label === here ? "on" : ""} onClick={() => scrollTo(here)}>
                Сейчас
              </button>
              {jumps.map((lv) => (
                <button key={lv} type="button" className={label !== here && Math.abs(label - lv) < 3 ? "on" : ""} onClick={() => scrollTo(lv)}>
                  {lv}
                </button>
              ))}
            </div>
            <button type="button" className="sv-all" onClick={claimAll} disabled={busy || claimable === 0}>
              <Ico name="gift" size={22} />
              <span>
                <b>Забрать всё</b>
                <small>Доступно: {claimable}</small>
              </span>
            </button>
          </div>
        </div>

        <ul className="sv-legend">
          <li><i />Бесплатная лента — сверху</li>
          <li><i className="g" />Премиум-лента — снизу{p.bought ? "" : " (после покупки)"}</li>
          <li><i className="m" />Можно забрать</li>
        </ul>

        <div className="sv-railw">
          <div
            className="sv-rail"
            ref={railRef}
            tabIndex={0}
            aria-label="Дорожка наград"
            onPointerDown={(e) => {
              if (e.pointerType !== "mouse" || e.button !== 0) return;
              const rail = railRef.current;
              if (rail) drag.current = { x: e.clientX, left: rail.scrollLeft, moved: false };
            }}
            onClickCapture={(e) => {
              if (drag.current?.moved) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            onKeyDown={(e) => {
              const d = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
              if (d !== undefined) railRef.current?.scrollBy({ left: d * 120, behavior: "smooth" });
            }}
          >
            {levels.map((l) => (
              <div key={l} data-l={l} className={`sv-col${l < p.level ? " past" : ""}${l === p.level ? " cur" : ""}${l % 5 === 0 ? " key" : ""}`}>
                <RewardCard level={l} track="free" status={status(l, "free")} reward={passReward(l, "free")} onClaim={(t, lv) => void claim(t, lv)} />
                <div className="sv-node"><b><span>{l}</span></b></div>
                <RewardCard level={l} track="premium" status={status(l, "premium")} reward={passReward(l, "premium")} onClaim={(t, lv) => void claim(t, lv)} />
              </div>
            ))}
          </div>
          <button type="button" className="sv-arr l" aria-label="Назад" onClick={() => scrollTo(label - 4)}>‹</button>
          <button type="button" className="sv-arr r" aria-label="Вперёд" onClick={() => scrollTo(label + 4)}>›</button>
        </div>
      </section>

      {/* ---------------------------------- Журнал -------------------------------- */}
      <section className="sv-ledger">
        <h3>Как набрать очки</h3>
        <p>Каждые {PASS.xpPerLevel} очков открывают следующий уровень.</p>
        <ul>
          {[
            { k: "daily", label: "Подарок дня", ico: "gift" as IcoName, n: PASS_XP_DAILY },
            { k: "mission", label: "Выполненное задание дня", ico: "target" as IcoName, n: PASS_XP_MISSION },
            ...XP_ROWS.map(([k, label, ico]) => ({ k, label, ico, n: PASS_XP[k] })),
          ].map((row) => (
            <li key={row.k}>
              <span className="sv-li"><Ico name={row.ico} size={16} /></span>
              <span>{row.label}</span>
              <i aria-hidden />
              <b>+{row.n}</b>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
