"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { cardDef } from "@/lib/cards/catalog";
import { CLASSES, ELEMENTS, PACK, RANKS } from "@/lib/cards/config";
import { GameCard, RankMark } from "./GameCard";
import { Portal, toast } from "./common";
import { ELEMENT_ICON, Ico } from "./icons";

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
    [index, n, onIndex],
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
                <div className="cv-face back" aria-hidden={!flip}>
                  <i className="cv-bk-c a" />
                  <i className="cv-bk-c b" />
                  <i className="cv-bk-c c" />
                  <i className="cv-bk-c d" />
                  <div className="cv-bk-in">
                    <span className="cv-bk-seal" aria-hidden>
                      <RankMark rank={def.rank} />
                      <em>{rank.short}</em>
                    </span>
                    <span className="cv-back-rank">{rank.name}</span>
                    <b className="cv-bk-name">{def.name}</b>
                    <small className="cv-bk-sub">
                      {def.series} · {CLASSES[def.cls].name}
                    </small>
                    <span className="cv-bk-div" aria-hidden>
                      <i />
                    </span>
                    <ul>
                      {(
                        [
                          ["sword", "Атака", def.atk, 260],
                          ["shield", "Защита", def.def, 160],
                          ["heart", "Здоровье", def.hp, 1100],
                          ["bolt", "Скорость", def.spd, 120],
                        ] as const
                      ).map(([ic, k, v, max]) => (
                        <li key={k}>
                          <Ico name={ic} size={16} /> {k} <b>{v}</b>
                          <i style={{ ["--v" as string]: `${Math.min(100, Math.round((v / max) * 100))}%` } as CSSProperties} />
                        </li>
                      ))}
                    </ul>
                    <span className="cv-bk-chips">
                      <span>
                        <Ico name={ELEMENT_ICON[def.element]} size={13} /> {ELEMENTS[def.element].name}
                      </span>
                      <span>
                        <Ico name="target" size={13} /> {chance}% в паке
                      </span>
                    </span>
                    <p>{def.blurb}</p>
                  </div>
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
              <div className="cv-chips">
                <span className="cv-rank">
                  <i />
                  {rank.name}
                </span>
                <span className="cv-chip">
                  <Ico name={ELEMENT_ICON[def.element]} size={14} /> {ELEMENTS[def.element].name}
                </span>
              </div>
              <h2>{def.name}</h2>
              <p className="cv-sub">
                {def.series} · {CLASSES[def.cls].name}
              </p>

              <div className="cv-stats">
                <span><Ico name="sword" size={15} /><b>{def.atk}</b><small>атака</small></span>
                <span><Ico name="shield" size={15} /><b>{def.def}</b><small>защита</small></span>
                <span><Ico name="heart" size={15} /><b>{def.hp}</b><small>здоровье</small></span>
                <span><Ico name="bolt" size={15} /><b>{def.spd}</b><small>скорость</small></span>
              </div>

              <div className="cv-rows">
                <div>
                  <small>Шанс в паке</small>
                  <b>{chance}%</b>
                </div>
                <div>
                  <small>В коллекции</small>
                  <b className={owned ? "ok" : ""}>{owned ? "Есть" : "Нет"}</b>
                </div>
              </div>
              <p className="cv-quote">{def.blurb}</p>
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
