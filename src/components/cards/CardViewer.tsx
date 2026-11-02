"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { CATALOG, cardDef } from "@/lib/cards/catalog";
import { CLASSES, ELEMENTS, PACK, RANKS } from "@/lib/cards/config";
import { GameCard, RankMark } from "./GameCard";
import { Portal, toast } from "./common";
import { ELEMENT_ICON, Ico } from "./icons";

const STAT_MAX = { atk: 260, def: 160, hp: 1100, spd: 120 } as const;
const powerOf = (d: { atk: number; def: number; hp: number; spd: number }) => Math.round(d.atk + d.def * 0.8 + d.hp * 0.15 + d.spd * 2);

/** Лепестковая диаграмма четырёх характеристик: атака сверху, дальше по часовой — защита, здоровье, скорость */
function Radar({ d, labels = true }: { d: { atk: number; def: number; hp: number; spd: number }; labels?: boolean }) {
  const vals = [d.atk / STAT_MAX.atk, d.def / STAT_MAX.def, d.hp / STAT_MAX.hp, d.spd / STAT_MAX.spd].map((v) => Math.min(1, Math.max(0.28, Math.sqrt(v) * 0.95)));
  const dir = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
  const R = 33;
  const pt = (i: number, k: number) => `${(50 + dir[i][0] * R * k).toFixed(1)},${(50 + dir[i][1] * R * k).toFixed(1)}`;
  const ring = (k: number) => dir.map((_, i) => pt(i, k)).join(" ");
  const shape = vals.map((v, i) => pt(i, v)).join(" ");
  const names = ["АТК", "ЗАЩ", "ЗДР", "СКР"];
  const nums = [d.atk, d.def, d.hp, d.spd];
  return (
    <svg className="cvr" viewBox="0 0 100 100" role="img" aria-label={`Атака ${d.atk}, защита ${d.def}, здоровье ${d.hp}, скорость ${d.spd}`}>
      <defs>
        <radialGradient id="cvr-g" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="var(--c)" stopOpacity=".15" />
          <stop offset="1" stopColor="var(--c)" stopOpacity=".7" />
        </radialGradient>
      </defs>
      {[1, 0.66, 0.33].map((k) => (
        <polygon key={k} className="cvr-ring" points={ring(k)} />
      ))}
      {dir.map((_, i) => (
        <line key={i} className="cvr-ax" x1="50" y1="50" x2={pt(i, 1).split(",")[0]} y2={pt(i, 1).split(",")[1]} />
      ))}
      <polygon className="cvr-fill" points={shape} fill="url(#cvr-g)" />
      {vals.map((v, i) => (
        <circle key={i} className="cvr-dot" cx={pt(i, v).split(",")[0]} cy={pt(i, v).split(",")[1]} r="1.8" />
      ))}
      {labels &&
        dir.map((dd, i) => (
          <text key={i} className="cvr-t" x={50 + dd[0] * 45} y={50 + dd[1] * 44 + 1.6} textAnchor="middle">
            <tspan className="cvr-n">{names[i]}</tspan>
            <tspan className="cvr-v" x={50 + dd[0] * 45} dy="6.2">{nums[i]}</tspan>
          </text>
        ))}
    </svg>
  );
}

/** Искры вокруг карты: положение, размер и темп считаются от номера, чтобы рендер был стабильным */
const SPARKS = Array.from({ length: 22 }, (_, i) => ({
  x: (i * 37 + 11) % 100,
  s: 2 + ((i * 5) % 4),
  d: 6 + ((i * 7) % 7),
  t: -((i * 13) % 11),
  w: ((i * 17) % 9) - 4,
}));

/**
 * Окно героя: крупная карта с наклоном по курсору и бликом, переворот на характеристики,
 * режим «Крупнее», листание по списку (← →) и слот под действия владельца.
 * Один компонент для коллекции, веера на странице паков и любых будущих мест.
 */
export function CardViewer({
  ids,
  index,
  onIndex,
  onClose,
  card,
  owned,
  children,
}: {
  ids: string[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  /** Состояние конкретной копии (если карта в коллекции) */
  card?: { foil?: boolean; level?: number; evo?: number; locked?: boolean };
  owned?: boolean;
  /** Действия владельца: умения, блокировка, в пыль, копии */
  children?: ReactNode;
}) {
  const id = ids[index];
  const def = cardDef(id);
  const [flip, setFlip] = useState(false);
  const [big, setBig] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const n = ids.length;

  const go = useCallback(
    (d: number) => {
      if (n < 2) return;
      setFlip(false);
      onIndex((index + d + n) % n);
    },
    [index, n, onIndex, setFlip],
  );

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", key);
      document.body.style.overflow = prev;
    };
  }, [go, onClose]);

  if (!def) return null;
  const rank = RANKS[def.rank];
  const chance = (PACK.weights[def.rank] / 10).toFixed(1);
  const power = powerOf(def);
  const serial = String(CATALOG.findIndex((c) => c.id === id) + 1).padStart(3, "0");
  const mates = CATALOG.filter((c) => c.series === def.series);
  const place = [...mates].sort((x, y) => powerOf(y) - powerOf(x)).findIndex((c) => c.id === id) + 1;
  const ladder = RANKS.map((r) => r.id);

  const move = (e: PointerEvent<HTMLDivElement>) => {
    const el = stage.current;
    if (!el || e.pointerType === "touch") return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty("--rx", `${((0.5 - py) * 14).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${((px - 0.5) * 18).toFixed(2)}deg`);
    el.style.setProperty("--tx", (px - 0.5).toFixed(3));
    el.style.setProperty("--ty", (py - 0.5).toFixed(3));
    el.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
    el.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
  };
  const leave = () => {
    const el = stage.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--tx", "0");
    el.style.setProperty("--ty", "0");
  };

  const share = async () => {
    const url = `${window.location.origin}/cards`;
    try {
      if (navigator.share) {
        await navigator.share({ title: def.name, text: `${def.name} — ${rank.name} карта в AniGalaxy`, url });
        return;
      }
      await navigator.clipboard.writeText(`${def.name} — ${rank.name} карта в AniGalaxy: ${url}`);
      toast("Ссылка скопирована");
    } catch {
      /* пользователь закрыл окно «поделиться» */
    }
  };

  return (
    <Portal>
      <div className="cv" data-rank={rank.key} role="dialog" aria-modal="true" aria-label={def.name} onClick={onClose} style={{ ["--c" as string]: rank.color } as CSSProperties}>
        <div className={`cv-wrap${big ? " is-big" : ""}`} onClick={(e) => e.stopPropagation()}>
          <div className="cv-left">
            <div className="cv-fx" aria-hidden>
              {SPARKS.map((p, i) => (
                <i key={i} style={{ ["--x" as string]: `${p.x}%`, ["--s" as string]: `${p.s}px`, ["--d" as string]: `${p.d}s`, ["--t" as string]: `${p.t}s`, ["--w" as string]: `${p.w}%` } as CSSProperties} />
              ))}
              <b className="cv-floor" />
            </div>
            <div ref={stage} className="cv-stage" onPointerMove={move} onPointerLeave={leave}>
              <div className={`cv-flip${flip ? " is-back" : ""}`}>
                <div className="cv-face front" key={`${id}-${card?.level ?? 0}`}>
                  <GameCard cardId={id} foil={card?.foil} level={card?.level} evo={card?.evo} locked={card?.locked} stats={false} live />
                  <i className="cv-holo" aria-hidden />
                  <i className="cv-glare" aria-hidden />
                  <i className="cv-rim" aria-hidden />
                  <i className="cv-flare" aria-hidden />
                </div>
                <div className="cv-face back fr" aria-hidden={!flip}>
                  <i className="fr-aura" aria-hidden />
                  <img className="fr-art" src="/cards/backs/rare.webp" alt="" draggable={false} />
                  <i className="fr-glow" aria-hidden />
                  <i className="fr-shine" aria-hidden />
                  <i className="fr-run" aria-hidden />
                  <i className="fr-glint" aria-hidden />
                  {[0, 1, 2, 3, 4, 5].map((k) => (
                    <i key={k} className={`fr-sp s${k}`} aria-hidden />
                  ))}
                  <span className="fr-emb">
                    <RankMark rank={def.rank} />
                    <em>{rank.short}</em>
                  </span>
                  <span className="fr-rank">{rank.name}</span>
                  <b className="fr-name" style={{ ["--fs" as string]: `${def.name.length <= 8 ? 5.2 : def.name.length <= 11 ? 4.2 : def.name.length <= 14 ? 3.4 : def.name.length <= 18 ? 2.8 : 2.3}cqw` } as CSSProperties}>{def.name}</b>
                  <small className="fr-sub">
                    {def.series} · {CLASSES[def.cls].name}
                  </small>
                  {(
                    [
                      ["sword", "Атака", def.atk, STAT_MAX.atk],
                      ["shield", "Защита", def.def, STAT_MAX.def],
                      ["heart", "Здоровье", def.hp, STAT_MAX.hp],
                      ["bolt", "Скорость", def.spd, STAT_MAX.spd],
                    ] as const
                  ).map(([ic, lb, v, mx], i) => (
                    <span key={lb} className="fr-row" style={{ ["--i" as string]: i, ["--v" as string]: `${Math.min(100, (v / mx) * 100)}%` } as CSSProperties}>
                      <Ico name={ic} size={16} />
                      <small>{lb}</small>
                      <b>{v}</b>
                      <i />
                    </span>
                  ))}
                  <span className="fr-chip l">
                    <Ico name={ELEMENT_ICON[def.element]} size={13} /> {ELEMENTS[def.element].name}
                  </span>
                  <span className="fr-chip r">{chance}% в паке</span>
                </div>
              </div>
            </div>
            <div className="cv-tools">
              <button type="button" onClick={() => setFlip((v) => !v)} aria-pressed={flip}>
                <Ico name="swap" size={15} /> Перевернуть
              </button>
              <button type="button" onClick={() => setBig((v) => !v)} aria-pressed={big}>
                <Ico name="search" size={15} /> {big ? "Меньше" : "Крупнее"}
              </button>
            </div>
          </div>

          <aside className="cv-panel" key={id}>
            <header className="cv-nav">
              <button type="button" onClick={() => go(-1)} disabled={n < 2} aria-label="Предыдущая">
                <Ico name="left" size={16} />
              </button>
              <span>
                {index + 1} из {n}
              </span>
              <button type="button" onClick={() => go(1)} disabled={n < 2} aria-label="Следующая">
                <Ico name="right" size={16} />
              </button>
              <button type="button" className="x" onClick={onClose} aria-label="Закрыть">
                <Ico name="close" size={16} />
              </button>
            </header>

            <div className="cv-body">
              <section className="cv-hero">
                <i className="cv-hero-ring" aria-hidden />
                <span className="cv-crest" aria-hidden>
                  <RankMark rank={def.rank} />
                </span>
                <div className="cv-chips">
                  <span className="cv-rank">
                    <i />
                    {rank.name}
                  </span>
                  <span className="cv-chip">
                    <Ico name={ELEMENT_ICON[def.element]} size={14} /> {ELEMENTS[def.element].name}
                  </span>
                  <span className="cv-chip">{CLASSES[def.cls].name}</span>
                </div>
                <h2>{def.name}</h2>
                <p className="cv-sub">{def.series}</p>
                <small className="cv-serial">
                  Досье № {serial} · из {CATALOG.length}
                </small>
              </section>

              <section className="cv-duo">
                <div className="cv-radar">
                  <Radar d={def} />
                </div>
                <div className="cv-power">
                  <small>Боевая мощь</small>
                  <b>{power}</b>
                  <span className="cv-pw-bar">
                    <i style={{ width: `${Math.min(100, Math.round((power / 560) * 100))}%` }} />
                  </span>
                  <p>{CLASSES[def.cls].hint}</p>
                </div>
              </section>

              <section className="cv-ladder" aria-label="Редкость">
                <header>
                  <small>Редкость</small>
                  <b>
                    {chance}% <em>шанс в паке</em>
                  </b>
                </header>
                <ol>
                  {ladder.map((r) => (
                    <li key={r} className={r === def.rank ? "on" : r < def.rank ? "past" : ""} style={{ ["--rc" as string]: RANKS[r].color } as CSSProperties}>
                      <i />
                      <span>{RANKS[r].short}</span>
                    </li>
                  ))}
                </ol>
              </section>

              <dl className="cv-facts">
                <div>
                  <dt>В коллекции</dt>
                  <dd className={owned ? "ok" : ""}>{owned ? "Есть" : "Нет"}</dd>
                </div>
                <div>
                  <dt>Героев в серии</dt>
                  <dd>{mates.length}</dd>
                </div>
                <div>
                  <dt>Место по силе в серии</dt>
                  <dd>
                    {place} <small>из {mates.length}</small>
                  </dd>
                </div>
              </dl>
              {def.blurb && <p className="cv-quote">{def.blurb}</p>}
              {children}
            </div>

            <footer className="cv-foot">
              <button type="button" className="cv-share" onClick={() => void share()}>
                <Ico name="gift" size={16} /> Поделиться
              </button>
            </footer>
          </aside>
        </div>
      </div>
    </Portal>
  );
}
