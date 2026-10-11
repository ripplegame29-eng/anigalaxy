"use client";

/**
 * Сцена получения награды.
 *
 * Таймлайн как в макете: заряд (дрожь ядра) → вспышка/столб/волны →
 * разлёт частиц по редкости → карточка результата. Клик в любой момент
 * пропускает анимацию, Escape/Enter закрывают. Частицы анимируются через
 * Web Animations API вне React — ре-рендеров на кадрах нет.
 *
 * При `prefers-reduced-motion` сцена сразу показывает результат.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { AE_RARITY } from "@/components/progression/AchievementEmblem";
import { RewardArt } from "@/components/battlepass/RewardArt";
import { plural, type BpRewardCard } from "@/components/battlepass/model";

const RANK = ["common", "rare", "epic", "legendary", "mythic"] as const;
const PARTICLES = [30, 45, 60, 90, 110];
const DUST = 26;

export interface ClaimSceneProps {
  card: BpRewardCard;
  /** Сколько пакетов выдано сверх показанного («Забрать всё») */
  extra?: number;
  levelAfter?: number;
  levelsGained?: number;
  nickname?: string;
  onClose: () => void;
}

export function ClaimScene({
  card,
  extra = 0,
  levelAfter,
  levelsGained = 0,
  nickname = "Гость",
  onClose,
}: ClaimSceneProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLSpanElement>(null);
  const dustRef = useRef<HTMLDivElement>(null);
  const fxRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  const [phase, setPhase] = useState<"charge" | "result">("charge");

  const R = AE_RARITY[card.rarity];
  const rank = RANK.indexOf(card.rarity);
  /** prefers-reduced-motion — в реф, значение нужно только внутри эффектов */
  const reduced = useRef(false);

  /* Пыль сцены — статичные позиции, рендерятся один раз */
  useEffect(() => {
    const host = dustRef.current;
    if (!host) return;
    const nodes: HTMLElement[] = [];
    for (let i = 0; i < DUST; i += 1) {
      const dot = document.createElement("i");
      dot.style.left = `${Math.round(Math.random() * 100)}%`;
      dot.style.top = `${Math.round(Math.random() * 100)}%`;
      dot.style.animationDelay = `${(-Math.random() * 4).toFixed(2)}s`;
      host.append(dot);
      nodes.push(dot);
    }
    return () => nodes.forEach((node) => node.remove());
  }, []);

  /* Таймлайн сцены: заряд → вспышка/столб/волны → результат */
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    reduced.current = Boolean(mq?.matches);

    const overlay = overlayRef.current;
    if (!overlay) return;

    const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

    if (mq?.matches) {
      const id = window.setTimeout(() => setPhase("result"), 0);
      timers.current.push(id);
    } else {
      later(() => coreRef.current?.classList.add("shake"), 500);
      later(() => {
        coreRef.current?.classList.remove("shake");
        coreRef.current?.classList.add("opened");
        overlay.classList.add("burst");
        flashRef.current?.classList.add("go");
      }, 1900);
      later(() => setPhase("result"), 2900);
    }

    return () => {
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
    };
  }, []);

  const burst = useCallback(() => {
    const host = fxRef.current;
    if (!host) return;
    if (reduced.current || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    host.textContent = "";
    const pal = [R.c, "#fff", R.c2, R.c3];
    const count = PARTICLES[Math.max(0, rank)];

    for (let i = 0; i < count; i += 1) {
      const p = document.createElement("span");
      const a = Math.random() * Math.PI * 2;
      const d = 120 + Math.random() * 420;
      const col = pal[i % pal.length];
      const size = 3 + Math.random() * 9;
      p.style.cssText = `color:${col};background:${col};width:${size}px;height:${size}px`;
      p.animate(
        [
          { transform: "translate(-50%,-50%) scale(0)", opacity: 0 },
          {
            transform: `translate(calc(-50% + ${Math.cos(a) * d * 0.3}px),calc(-50% + ${Math.sin(a) * d * 0.3}px)) scale(1.6)`,
            opacity: 1,
            offset: 0.15,
          },
          {
            transform: `translate(calc(-50% + ${Math.cos(a) * d}px),calc(-50% + ${Math.sin(a) * d}px)) scale(0)`,
            opacity: 0,
          },
        ],
        {
          duration: 1600 + Math.random() * 700,
          delay: Math.random() * 300,
          easing: "cubic-bezier(.2,.7,.3,1)",
          fill: "forwards",
        },
      );
      host.append(p);
    }

    /* Крупная редкость — короткая встряска вьюпорта */
    if (rank >= 3) {
      document.body.animate(
        [
          { transform: "translate(0,0)" },
          { transform: "translate(6px,3px)" },
          { transform: "translate(-6px,-3px)" },
          { transform: "translate(0,0)" },
        ],
        { duration: 450, iterations: 2 },
      );
    }
  }, [R.c, R.c2, R.c3, rank, reduced]);

  /* Частицы запускаем один раз — на первом переходе в результат */
  const burstDone = useRef(false);
  useEffect(() => {
    if (phase !== "result" || burstDone.current) return;
    burstDone.current = true;
    burst();
  }, [phase, burst]);

  /* Клик: пропустить сцену или закрыть результат */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (phase === "result") onClose();
        else setPhase("result");
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [phase, onClose]);

  const meta = [
    card.kindLabel,
    `Уровень ${levelAfter ?? card.level}`,
    card.line === "premium" ? "Premium" : "Free",
  ].join(" · ");

  return (
    <div
      ref={overlayRef}
      className={`bp-scene ${phase === "result" ? "result" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Награда получена"
      style={{ "--oc": R.c, "--oc2": R.c2, "--oc3": R.c3 } as React.CSSProperties}
      onClick={() => {
        if (phase === "result") onClose();
        else setPhase("result");
      }}
    >
      <div className="bp-dust" ref={dustRef} aria-hidden />

      <div className={`bp-stage${phase === "result" ? " hidden" : ""}`}>
        <div className="bp-beam" aria-hidden />
        <div className="bp-pillar" aria-hidden />
        <div className="bp-wave" aria-hidden />
        <div className="bp-wave two" aria-hidden />
        <div className="bp-wave three" aria-hidden />
        <span className="bp-flash" ref={flashRef} aria-hidden />
        <div className="bp-core" ref={coreRef}>
          <RewardArt card={card} size="xl" live claimable className="cimg" nickname={nickname} />
        </div>
        <div className="bp-particles" ref={fxRef} aria-hidden />
      </div>

      <div className={`bp-res ${phase === "result" ? "show" : ""}`}>
        <div className="got">{levelsGained > 0 ? `УРОВЕНЬ ${levelAfter}` : "НАГРАДА ПОЛУЧЕНА"}</div>
        <div className="rart">
          <RewardArt card={card} size="lg" live nickname={nickname} />
        </div>
        <h2>{card.label}</h2>
        <div className="rrar">{card.rarityLabel}</div>
        <div className="rmeta">{meta}</div>
        <div className="rdesc">{card.desc}</div>
        {extra > 0 && (
          <div className="more">
            + ещё {extra} {plural(extra, "пакет", "пакета", "пакетов")}
          </div>
        )}
        {levelsGained > 0 && (
          <div className="more">
            Пропуск поднялся на {levelsGained} ур. — достигнут {levelAfter}-й уровень
          </div>
        )}
        <button type="button" className="bp-btn pri w-full" onClick={onClose}>
          Продолжить
        </button>
      </div>

      <div className="hint">НАЖМИТЕ, ЧТОБЫ ПРОПУСТИТЬ</div>
    </div>
  );
}
