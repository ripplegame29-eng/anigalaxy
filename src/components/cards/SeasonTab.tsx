"use client";

/**
 * Сезонный пасс карточной игры в оформлении боевого пропуска сайта («Hueco Mundo»):
 * та же шапка (`BpHero`), дорожка с колонками уровней, карточка премиум-линии и
 * панель «Как набрать очки». Логика наград прежняя — меняется только вид.
 */

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { BpHero } from "@/components/battlepass/BpParts";
import { BpIcon } from "@/components/battlepass/BpIcons";
import { scrollTrackTo } from "@/components/battlepass/Track";
import { PASS, PASS_XP, PASS_XP_DAILY, PASS_XP_MISSION, passReward, type PassTrack } from "@/lib/cards/season";
import { rewardText, type Reward } from "@/lib/cards/progress";
import { act, type CardsState } from "@/lib/cards/client";
import { fmt, fmtLeft, toast, useBusy, useNow } from "./common";
import { Cur, Ico, type IcoName } from "./icons";

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

type Part = { k: "scroll" | "packs" | "diamonds" | "dust"; n: number; label: string };

/** Состав награды: главная часть идёт крупно, остальные — строкой под ней */
function parts(r: Reward): Part[] {
  const list: Part[] = [];
  if (r.scroll) list.push({ k: "scroll", n: r.scroll, label: "Свиток" });
  if (r.packs) list.push({ k: "packs", n: r.packs, label: "Паки" });
  if (r.diamonds) list.push({ k: "diamonds", n: r.diamonds, label: "Алмазы" });
  if (r.dust) list.push({ k: "dust", n: r.dust, label: "Пыль" });
  return list;
}

function PartIcon({ k, size }: { k: Part["k"]; size: number }) {
  return k === "scroll" ? <Ico name="scroll" size={size} style={{ color: "#ffc45e" }} /> : <Cur k={k} size={size} />;
}

type Status = "got" | "can" | "locked";

const Cell = memo(function Cell({
  level,
  track,
  status,
  reward,
  lockedLine,
  onClaim,
}: {
  level: number;
  track: PassTrack;
  status: Status;
  reward: Reward;
  lockedLine: boolean;
  onClaim: (track: PassTrack, level: number) => void;
}) {
  const list = parts(reward);
  const main = list[0];
  const rest = list.slice(1);
  const vip = track === "premium";
  const big = level % 5 === 0;
  const color = big ? "#ffc45e" : vip ? "#ff6b86" : "#9db4ff";
  return (
    <div className={`bp-slot ${track} has`}>
      <button
        type="button"
        className={`bp-rw ${status} ${vip ? "vip" : ""}`}
        style={{ "--c": color } as React.CSSProperties}
        aria-disabled={status !== "can"}
        aria-label={`Уровень ${level}, ${vip ? "премиум" : "бесплатная"} награда: ${rewardText(reward)}`}
        onClick={() => {
          if (status === "can") onClaim(track, level);
        }}
      >
        {status === "got" && <span className="bp2-lk ok" aria-hidden>✓</span>}
        {status === "locked" && (lockedLine || vip) && <span className="bp2-lk" aria-hidden><BpIcon name="lock" size={13} /></span>}
        {main && (
          <>
            <span className="bp2-ic" aria-hidden><PartIcon k={main.k} size={26} /></span>
            <span className={`bp2-v${String(main.n).length > 3 ? " sm" : ""}`}>+{main.n.toLocaleString("ru-RU")}</span>
            <small>{main.label}</small>
          </>
        )}
        {rest.length > 0 && (
          <span className="ps-more">
            {rest.map((x) => (
              <span key={x.k} title={x.label}>
                <PartIcon k={x.k} size={12} /> {x.n}
              </span>
            ))}
          </span>
        )}
        {status === "can" && <span className="bp2-take">Забрать</span>}
      </button>
    </div>
  );
});

export function SeasonTab({ s }: { s: CardsState }) {
  const p = s.events.pass;
  const [busy, run] = useBusy();
  const now = useNow(60_000);
  const heroRef = useRef<HTMLElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const [label, setLabel] = useState(Math.max(1, p.level));

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
  const fraction = p.level >= PASS.levels ? 1 : Math.min(1, p.into / PASS.xpPerLevel);
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

  /* Дорожка: стартуем с текущего уровня; колесо и перетаскивание листают её горизонтально */
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    scrollTrackTo(rail, Math.max(1, p.level), "auto");
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

  const seek = (level: number) => scrollTrackTo(railRef.current, Math.min(PASS.levels, Math.max(1, level)));
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
    <div className="bp-page bp2 bp-season">
      <BpHero
        tab="rewards"
        onTab={() => undefined}
        level={p.level}
        maxLevel={PASS.levels}
        fraction={fraction}
        into={p.into}
        need={PASS.xpPerLevel}
        xpLeftToFinal={0}
        claimables={claimable}
        totalCards={totalCount}
        missionsDone={0}
        missionsTotal={0}
        heroRef={heroRef}
        variant={{
          kicker: `Сезонный пасс · Сезон ${p.season % 100}`,
          title: "Сезонный пасс",
          sub: "Очки идут за бои, паки, кампанию, рейд, обмены и подарок дня. Три десятка уровней, две ленты наград — бесплатная и премиум.",
          unit: "оч.",
          endsAt: p.endsAt,
          tiles: [
            { icon: <BpIcon name="gift" />, label: "К получению", value: `${claimable} наград`, hot: claimable > 0 },
            { icon: <BpIcon name="hourglass" />, label: "До конца сезона", value: fmtLeft(p.endsAt - now) },
            { icon: <BpIcon name={p.bought ? "crown" : "lock"} />, label: "Премиум", value: p.bought ? "Активен" : "Закрыт" },
          ],
        }}
      />

      <div className="bp-season-main">
        {p.bought ? (
          <div className="bp2-card bp2-offer on">
            <div>
              <span className="bp2-gk">Премиум-лента</span>
              <h2>Премиум активен</h2>
              <p className="bp2-offer-p">
                Нижняя лента открыта целиком: {PASS.levels} наградных уровней — {premSum.diamonds.toLocaleString("ru-RU")} алмазов,{" "}
                {premSum.packs} паков и {premSum.scroll} свитков. Забирайте на дорожке — ничего не сгорит до конца сезона.
              </p>
            </div>
          </div>
        ) : (
          <div className="bp2-card bp2-offer">
            <div>
              <span className="bp2-gk">Вторая лента наград</span>
              <h2>Откройте полный трек сезона</h2>
              <div className="bp2-pk">
                <div>
                  <i><BpIcon name="gem" size={24} /></i>
                  <span>{premSum.diamonds.toLocaleString("ru-RU")} алмазов по ходу трека — окупает цену пропуска</span>
                </div>
                <div>
                  <i><BpIcon name="puzzle" size={24} /></i>
                  <span>{premSum.packs} паков и {premSum.scroll} свитков улучшения сверх бесплатной ленты</span>
                </div>
                <div>
                  <i><BpIcon name="crown" size={24} /></i>
                  <span>Нижняя лента на всех {PASS.levels} уровнях — пройденные уровни выдаются сразу</span>
                </div>
                <div>
                  <i>⌛</i>
                  <span>Покупка действует до конца сезона: {fmtLeft(p.endsAt - now)}</span>
                </div>
              </div>
            </div>
            <div className="bp2-buy">
              <small>Премиум-лента · сезон {p.season % 100}</small>
              <div className="bp2-price">
                {p.price} <small><Cur k="diamonds" size={18} /></small>
              </div>
              <div className="bp2-old">
                <span>Разовая покупка · весь сезон</span>
                <span>{p.level > 1 ? `Ур. ${p.level} выдадим сразу` : "Награды сразу"}</span>
              </div>
              <button type="button" className="bp2-btn gold" disabled={busy || s.wallet.diamonds < p.price} onClick={() => void buy()}>
                Открыть премиум
              </button>
              {s.wallet.diamonds < p.price && <small>Не хватает {p.price - s.wallet.diamonds} алмазов</small>}
            </div>
          </div>
        )}

        <div className="bp2-claimbar">
          <span>
            Алмазы <b>{fmt(s.wallet.diamonds)}</b>
          </span>
          <button type="button" className="bp2-btn" onClick={claimAll} disabled={busy || claimable === 0}>
            Забрать все награды <em>{claimable}</em>
          </button>
        </div>

        <section className="bp2-sec bp-track" aria-labelledby="ps-track-title">
          <div className="bp2-shd">
            <div>
              <h2 id="ps-track-title">Награды сезона</h2>
              <p>
                Получено {doneCount} из {totalCount}
                {nextBig ? ` · следующая крупная награда — уровень ${nextBig}` : ""}
              </p>
            </div>
            <div className="bp2-chips" role="group" aria-label="Быстрый переход по уровням">
              <button type="button" className={`bp2-pl${label === Math.max(1, p.level) ? " on" : ""}`} onClick={() => seek(Math.max(1, p.level))}>
                Сейчас
              </button>
              {jumps.map((lv) => (
                <button key={lv} type="button" className={`bp2-pl${label !== Math.max(1, p.level) && Math.abs(label - lv) < 3 ? " on" : ""}`} onClick={() => seek(lv)}>
                  {lv}
                </button>
              ))}
            </div>
          </div>

          <div className="bp2-legend">
            <span><i />Сверху — бесплатная лента</span>
            <span><i className="g" />Снизу — премиум-лента{p.bought ? "" : " (откроется после покупки)"}</span>
            <span><i className="m" />Можно забрать</span>
          </div>

          <div
            className="bp-sc"
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
              if (d !== undefined) railRef.current?.scrollBy({ left: d * 100, behavior: "smooth" });
            }}
          >
            {levels.map((l) => (
              <div
                key={l}
                data-l={l}
                className={`bp-col ${l === p.level ? "cur" : l < p.level ? "past" : ""}${l % 5 === 0 ? " key" : ""}`}
              >
                <Cell level={l} track="free" status={status(l, "free")} reward={passReward(l, "free")} lockedLine={false} onClaim={(t, lv) => void claim(t, lv)} />
                <div className="bp-num"><b>{l}</b></div>
                <Cell level={l} track="premium" status={status(l, "premium")} reward={passReward(l, "premium")} lockedLine={!p.bought} onClaim={(t, lv) => void claim(t, lv)} />
              </div>
            ))}
          </div>

          <div className="bp2-arrows">
            <button type="button" className="bp2-arr" aria-label="Назад" onClick={() => seek(label - 4)}>‹</button>
            <button type="button" className="bp2-arr" aria-label="Вперёд" onClick={() => seek(label + 4)}>›</button>
          </div>
        </section>

        <section className="bp-panel p-4 sm:p-5">
          <h2 className="font-display text-lg font-black tracking-wide text-white">Как набрать очки</h2>
          <p className="mt-1 text-sm text-muted">Каждые {PASS.xpPerLevel} очков открывают следующий уровень пасса.</p>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { k: "daily", label: "Подарок дня", ico: "gift" as IcoName, n: PASS_XP_DAILY },
              { k: "mission", label: "Выполненное задание дня", ico: "target" as IcoName, n: PASS_XP_MISSION },
              ...XP_ROWS.map(([k, label, ico]) => ({ k, label, ico, n: PASS_XP[k] })),
            ].map((row) => (
              <div key={row.k} className="ps-src">
                <span className="ps-src-i"><Ico name={row.ico} size={20} /></span>
                <p>{row.label}</p>
                <b>+{row.n}</b>
              </div>
            ))}
          </div>
        </section>

        <p className="bp2-foot">Награды пасса остаются с вами: незабранные не сгорают до конца сезона.</p>
      </div>
    </div>
  );
}
