"use client";

import { useMemo, useState, type CSSProperties, type PointerEvent } from "react";
import { visibleCatalog } from "@/lib/cards/catalog";
import { DUST_VALUE, MELT, PACK, RANKS, SCROLL_DUST, type Rank } from "@/lib/cards/config";
import type { CardsState } from "@/lib/cards/client";
import { CardFacts } from "./CardFacts";
import { GameCard } from "./GameCard";
import { Ico, type IcoName } from "./icons";

const ORDER: Rank[] = [4, 3, 2, 1, 0];
const CHIPS = 24;
const pct = (w: number) => String(w / 10).replace(".", ",");

const FRAME: Record<Rank, string> = {
  0: "Простая рамка без эффектов",
  1: "Цветная рамка с лёгким свечением",
  2: "Рамка с градиентом и мягким блеском",
  3: "Золотая рамка с бегущим бликом",
  4: "Рамка с пульсирующим свечением и особым бликом",
};
const guarantee = (r: Rank): string =>
  r === 2 ? `Гарантия эпической и выше каждые ${PACK.pityEpic} паков` : r === 3 ? `Гарантия легендарной и выше каждые ${PACK.pityLegend} паков` : r === 4 ? "Гарантии нет: только удача" : r === 1 ? "Падает чаще всего вместе с обычными" : "Основа любого пака";

const FLOW: { ico: IcoName; t: string; d: string }[] = [
  { ico: "pack", t: "Откройте пак", d: `${PACK.choices} карты на выбор, у каждой своя редкость` },
  { ico: "star", t: "Оставьте лучшую", d: "Одна карта навсегда попадает в коллекцию" },
  { ico: "dust", t: "Остальные в пыль", d: "Лишние карты превращаются в пыль для кузницы" },
];

/** Пять ступеней редкости: сцена с крупной картой, шансы, награда пылью и герои ступени с отметкой «найден» */
export function RarityShowcase({ s }: { s: CardsState }) {
  const [rank, setRank] = useState<Rank>(4);
  const [pickId, setPickId] = useState<Record<number, string>>({});
  const owned = useMemo(() => new Set(s.inventory.map((c) => c.cardId)), [s.inventory]);
  const pool = useMemo(() => visibleCatalog(owned).filter((c) => c.rank === rank).sort((a, b) => Number(owned.has(b.id)) - Number(owned.has(a.id))), [owned, rank]);
  const shown = pool.find((c) => c.id === pickId[rank]) ?? pool[0];
  const have = pool.filter((c) => owned.has(c.id)).length;
  const color = RANKS[rank].color;
  const meltUp = rank < 4 ? MELT.up[rank as 0 | 1 | 2 | 3] : null;

  const tilt = (e: PointerEvent<HTMLDivElement>) => {
    const cd = e.currentTarget.querySelector<HTMLElement>(".rcd");
    if (!cd) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    cd.style.transform = `rotateY(${((x - 0.5) * 26).toFixed(1)}deg) rotateX(${((0.5 - y) * 26).toFixed(1)}deg)`;
  };
  const untilt = (e: PointerEvent<HTMLDivElement>) => {
    const cd = e.currentTarget.querySelector<HTMLElement>(".rcd");
    if (cd) cd.style.transform = "";
  };

  return (
    <section className="cg2-sec" aria-labelledby="rx-t">
      <div className="cg2-sh">
        <div>
          <span className="cg2-eye">Редкости</span>
          <h2 id="rx-t">Пять ступеней коллекции</h2>
        </div>
        <p>Чем выше редкость, тем реже карта и тем больше пыли она стоит.</p>
      </div>

      <div className="cg2-rx cg2-glass" style={{ ["--gc" as string]: color } as CSSProperties}>
        <div className="rst" onPointerMove={tilt} onPointerLeave={untilt}>
          <i className="rgl" aria-hidden />
          <div className="rcd" key={`${rank}-${shown?.id}`} style={{ ["--c1" as string]: color } as CSSProperties}>
            {shown ? <GameCard cardId={shown.id} stats={false} live={rank >= 2} /> : null}
          </div>
          {shown && (
            <div className="rcap">
              <b>{shown.name}</b>
              <span>{shown.series}</span>
              <CardFacts cardId={shown.id} />
            </div>
          )}
          <i className="rsh" aria-hidden />
        </div>

        <div className="rin">
          <div className="rls" role="tablist" aria-label="Редкость">
            {ORDER.map((r) => (
              <button key={r} type="button" role="tab" aria-selected={r === rank} className={r === rank ? "on" : undefined} style={{ ["--c" as string]: RANKS[r].color } as CSSProperties} onClick={() => setRank(r)}>
                <i />
                <span>{RANKS[r].name}</span>
                <em>{pct(PACK.weights[r])}%</em>
              </button>
            ))}
          </div>

          <div className="rdt" key={rank}>
            <div className="rtt" style={{ ["--c" as string]: color } as CSSProperties}>
              <b>{RANKS[rank].name}</b>
              <span>{FRAME[rank]}</span>
            </div>
            <div className="rgd">
              <div>
                <b>{pct(PACK.weights[rank])}%</b>
                <span>шанс за карту</span>
              </div>
              <div>
                <b>{DUST_VALUE[rank]}</b>
                <span>пыли за расщепление</span>
              </div>
              <div>
                <b>{pool.length}</b>
                <span>героев в пуле</span>
              </div>
            </div>
            <div className="rgd rgd2">
              <div>
                <b>{meltUp !== null ? `${Math.round(meltUp * 100)}%` : "—"}</b>
                <span>{meltUp !== null ? `шанс на «${RANKS[rank + 1].name.toLowerCase()}» при переплавке` : "высшая ступень, выше не переплавить"}</span>
              </div>
              <div>
                <b>{SCROLL_DUST[rank]}</b>
                <span>пыли за свиток заточки</span>
              </div>
              <div>
                <b>
                  {have}/{pool.length}
                </b>
                <span>героев у вас</span>
                <i className="rbar">
                  <u style={{ width: `${pool.length ? (have / pool.length) * 100 : 0}%` }} />
                </i>
              </div>
            </div>
            <div className="rgu">
              <Ico name="star" size={20} />
              {guarantee(rank)}
            </div>
            <div className="rhs">
              <small>
                Герои этой ступени · найдено {have} из {pool.length}
              </small>
              <div>
                {pool.slice(0, CHIPS).map((c) => (
                  <button key={c.id} type="button" className={`${owned.has(c.id) ? "ok" : ""}${c.id === shown?.id ? " cur" : ""}`} onClick={() => setPickId((p) => ({ ...p, [rank]: c.id }))} aria-pressed={c.id === shown?.id}>
                    {owned.has(c.id) ? "✓ " : ""}
                    {c.name}
                  </button>
                ))}
                {pool.length > CHIPS && <span className="more">и ещё {pool.length - CHIPS}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <ol className="cg2-flow cg2-glass" aria-label="Как это работает">
        {FLOW.map((f, i) => (
          <li key={f.t}>
            <span className="rfi">
              <Ico name={f.ico} size={22} />
              <em>{i + 1}</em>
            </span>
            <b>{f.t}</b>
            <span>{f.d}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
