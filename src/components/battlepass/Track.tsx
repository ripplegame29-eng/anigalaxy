"use client";

/**
 * Дорожка наград: 100 колонок (слот Free / номер уровня / слот Premium).
 *
 * Оптимизация:
 *  - колонки завёрнуты в мемоизированные компоненты и зависят только от
 *    уровня игрока, поэтому прокрутка дорожки не вызывает ре-рендеры;
 *  - положение «окна просмотра» для ползунка обновляется в rAF и меняет
 *    состояние только когда уровень реально изменился;
 *  - эмблемные слои анимации монтируются только у наград, доступных к
 *    выдаче, — в кадре их единицы, а не 190;
 *  - `content-visibility` (в CSS) не даёт браузеру рисовать невидимые
 *    колонки.
 */

import { BpIcon } from "./BpIcons";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { AE_RARITY } from "@/components/progression/AchievementEmblem";
import { RewardArt } from "@/components/battlepass/RewardArt";
import { cardsAtLevel, ITEM_LEVELS, TRACK_CARDS, type BpRewardCard } from "@/components/battlepass/model";
import { bpRewardStatus, type BpStatusCtx } from "@/lib/battlepass/logic";

export const MAX_LEVEL = 100;
const LEVELS = Array.from({ length: MAX_LEVEL }, (_, i) => i + 1);

export interface TrackProps {
  statusCtx: BpStatusCtx;
  currentLevel: number;
  /** Прогресс внутри текущего уровня, 0…1 */
  fraction: number;
  nickname: string;
  onOpen: (card: BpRewardCard) => void;
  /** Кнопки «← / К текущему / →» и ползунок */
  children?: ReactNode;
}

/**
 * Прокрутка дорожки к уровню: колонка встаёт по центру окна.
 * Плавно — чтобы переход читался, мгновенно — для первого кадра и ресайза.
 */
export function scrollTrackTo(rail: HTMLElement | null, level: number, behavior: ScrollBehavior = "smooth") {
  if (!rail) return;
  const column = rail.querySelector<HTMLElement>(`[data-l="${level}"]`);
  if (!column) return;
  const left = Math.max(0, column.offsetLeft - rail.clientWidth / 2 + column.clientWidth / 2);
  rail.scrollTo({ left, behavior });
}

export function Track({ statusCtx, currentLevel, nickname, onOpen }: TrackProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState(currentLevel);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const frame = useRef(0);

  /**
   * Положение окна просмотра: бегунок двигается императивно (transform),
   * React-состояние меняется только при смене целого уровня — иначе на
   * каждый кадр прокрутки перерисовывалось бы дерево из 100 колонок.
   *
   * Уровень берём по центру окна — той же арифметикой, что и в
   * `scrollTrackTo`: если считать его от левого края, «уровень» и реальное
   * центрирование расходились бы на половину колонки и стрелки листали бы
   * не туда.
   */
  const sync = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const first = rail.firstElementChild as HTMLElement | null;
    const second = first?.nextElementSibling as HTMLElement | null;
    let next = 1;
    if (first && second) {
      const stride = second.offsetLeft - first.offsetLeft;
      const center = rail.scrollLeft + rail.clientWidth / 2;
      const index = stride > 0 ? Math.round((center - first.offsetLeft - first.clientWidth / 2) / stride) : 0;
      next = Math.min(MAX_LEVEL, Math.max(1, index + 1));
    }

    setLabel((prev) => (prev === next ? prev : next));
  }, []);

  const scheduleSync = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      sync();
    });
  }, [sync]);

  /* Стартовая позиция — текущий уровень; дальше окном управляет игрок */
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    scrollTrackTo(rail, currentLevel, "auto");
    sync();
    rail.addEventListener("scroll", scheduleSync, { passive: true });
    const ro = new ResizeObserver(scheduleSync);
    ro.observe(rail);
    return () => {
      rail.removeEventListener("scroll", scheduleSync);
      ro.disconnect();
      if (frame.current) cancelAnimationFrame(frame.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- позиция ставится один раз
  }, []);

  /**
   * Колесо мыши горизонтально листает дорожку.
   *
   * Слушатель нативный и не пассивный: React регистрирует `wheel` на корне
   * как пассивный, и `preventDefault()` внутри `onWheel` не работает — без
   * этого браузер просто уносил бы страницу вертикально. У краёв дорожки
   * колесо отпускаем, чтобы страница прокручивалась дальше как обычно.
   */
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    const onWheel = (event: WheelEvent) => {
      const max = rail.scrollWidth - rail.clientWidth;
      if (max <= 0) return;
      const atStart = rail.scrollLeft <= 0;
      const atEnd = rail.scrollLeft >= max - 1;
      const down = event.deltaY > 0;
      if ((down && atEnd) || (!down && atStart)) return;

      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rail.clientWidth : 1;
      rail.scrollLeft += event.deltaY * unit;
    };

    rail.addEventListener("wheel", onWheel, { passive: false });
    return () => rail.removeEventListener("wheel", onWheel);
  }, []);

  /* Перетаскивание дорожки мышью */
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const state = drag.current;
      const rail = railRef.current;
      if (!state || !rail) return;
      const dx = event.clientX - state.x;
      if (!state.moved && Math.abs(dx) > 5) {
        state.moved = true;
        rail.classList.add("grabbing");
      }
      if (state.moved) rail.scrollLeft = state.left - dx;
    };
    const onUp = () => {
      drag.current = null;
      railRef.current?.classList.remove("grabbing");
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  /**
   * Прокрутка к уровню. `instant` — при перетаскивании ползунком: там нужна
   * прямая отдача под курсором, а не плавная анимация, которую пришлось бы
   * перезапускать на каждом кадре (отсюда «тяжёлое» ощущение ползунка).
   */
  const seek = useCallback((level: number, instant = false) => {
    scrollTrackTo(railRef.current, level, instant ? "auto" : "smooth");
  }, []);

  const done = TRACK_CARDS.filter((card) => bpRewardStatus(card.level, card.line, statusCtx) === "claimed").length;
  const jumps = [1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

  return (
    <section className="bp2-sec bp-track" aria-labelledby="bp-track-title">
      <div className="bp2-shd">
        <div>
          <h2 id="bp-track-title">Награды сезона</h2>
          <p>
            Получено {done} из {TRACK_CARDS.length} · нажмите на награду — подробности и выдача
          </p>
        </div>
        <div className="bp2-chips" role="group" aria-label="Быстрый переход по уровням">
          <button type="button" className={`bp2-pl${label === currentLevel ? " on" : ""}`} onClick={() => seek(currentLevel)}>
            Сейчас
          </button>
          {jumps.map((lv) => (
            <button key={lv} type="button" className={`bp2-pl${label !== currentLevel && Math.abs(label - lv) < 5 ? " on" : ""}`} onClick={() => seek(lv)}>
              {lv}
            </button>
          ))}
        </div>
      </div>

      <div className="bp2-legend">
        <span><i />Сверху — бесплатная лента</span>
        <span><i className="g" />Снизу — лента пропуска (откроется после покупки)</span>
        <span><i className="m" />Можно забрать</span>
      </div>

      <div
        className="bp-sc"
        ref={railRef}
        data-testid="bp-rail"
        tabIndex={0}
        aria-label="Дорожка наград"
        onPointerDown={(event) => {
          if (event.pointerType !== "mouse" || event.button !== 0) return;
          const rail = railRef.current;
          if (!rail) return;
          drag.current = { x: event.clientX, left: rail.scrollLeft, moved: false };
        }}
        onClick={(event) => {
          // Клик после перетаскивания не должен открывать награду
          if (drag.current?.moved) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        onKeyDown={(event) => {
          const delta = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
          if (delta === undefined) return;
          railRef.current?.scrollBy({ left: delta * 124, behavior: "smooth" });
        }}
      >
        {LEVELS.map((level) => (
          <TrackColumn
            key={level}
            level={level}
            currentLevel={currentLevel}
            statusCtx={statusCtx}
            nickname={nickname}
            onOpen={onOpen}
          />
        ))}
      </div>

      <div className="bp2-arrows">
        <button type="button" className="bp2-arr" aria-label="Назад" onClick={() => seek(Math.max(1, label - 5))}>‹</button>
        <button type="button" className="bp2-arr" aria-label="Вперёд" onClick={() => seek(Math.min(MAX_LEVEL, label + 5))}>›</button>
      </div>
    </section>
  );
}

/** Колонка уровня: Free / номер / Premium */
const TrackColumn = memo(function TrackColumn({
  level,
  currentLevel,
  statusCtx,
  nickname,
  onOpen,
}: {
  level: number;
  currentLevel: number;
  statusCtx: BpStatusCtx;
  nickname: string;
  onOpen: (card: BpRewardCard) => void;
}) {
  const { free, premium: prem } = cardsAtLevel(level);
  const state = level === currentLevel ? "cur" : level < currentLevel ? "past" : "";
  // Колонка шире только там, где капсула титула не влезает в стандартную
  // клетку: валюта, опыт, рамки и маски остаются узкими
  const wide = free?.kind === "tag" || prem?.kind === "tag";
  return (
    <div
      className={`bp-col ${state}${wide ? " bp-col--tag" : ""}${ITEM_LEVELS.has(level) ? " key" : ""}`}
      data-l={level}
      data-level={level}
    >
      <TrackSlot card={free} statusCtx={statusCtx} nickname={nickname} onOpen={onOpen} />
      <div className="bp-num"><b>{level}</b></div>
      <TrackSlot card={prem} statusCtx={statusCtx} nickname={nickname} onOpen={onOpen} />
    </div>
  );
});

/** Слот линии: награда или заглушка «уровень без награды» */
const TrackSlot = memo(function TrackSlot({
  card,
  statusCtx,
  nickname,
  onOpen,
}: {
  card?: BpRewardCard;
  statusCtx: BpStatusCtx;
  nickname: string;
  onOpen: (card: BpRewardCard) => void;
}) {
  if (!card) {
    return (
      <div className="bp-slot" aria-hidden>
        <i className="dot" />
      </div>
    );
  }

  const status = bpRewardStatus(card.level, card.line, statusCtx);
  const canClaim = status === "claimable";
  const isPremium = card.line === "premium";
  const cls = status === "claimed" ? "got" : canClaim ? "can" : "locked";

  return (
    <div className={`bp-slot ${card.line} has`}>
      <button
        type="button"
        className={`bp-rw ${cls} ${isPremium ? "vip" : ""}`}
        style={{ "--c": AE_RARITY[card.rarity].c } as CSSProperties}
        data-card={card.key}
        aria-label={`${card.label}, ${card.rarityLabel}, уровень ${card.level}, ${
          isPremium ? "premium-линия" : "бесплатная линия"
        }, ${status === "claimable" ? "можно забрать" : status === "claimed" ? "получено" : "закрыто"}`}
        onClick={() => onOpen(card)}
      >
        {status === "locked" && <span className="bp2-lk" aria-hidden><BpIcon name="lock" size={13} /></span>}
        {status === "claimed" && <span className="bp2-lk ok" aria-hidden>✓</span>}
        {card.kind === "ac" || card.kind === "bpXp" ? (
          <>
            <span className="bp2-ic" aria-hidden>
              {card.kind === "ac" ? (
                // eslint-disable-next-line @next/next/no-img-element -- монетка 26px в плотной клетке
                <img src="/coin.png" alt="" width={26} height={26} />
              ) : (
                "✦"
              )}
            </span>
            <span className={`bp2-v${card.view.kind !== "tag" && card.view.kind !== "frame" && card.view.kind !== "decor" && String(card.view.amount).length > 3 ? " sm" : ""}`}>
              +{card.view.kind === "ac" || card.view.kind === "bpXp" ? card.view.amount.toLocaleString("ru-RU") : ""}
            </span>
            <small>{card.kind === "ac" ? "AC" : "Опыт"}</small>
          </>
        ) : (
          <>
            <RewardArt
              card={card}
              size="sm"
              live={canClaim}
              claimable={canClaim}
              locked={status === "locked" && card.view.kind !== "tag"}
              nickname={nickname}
            />
            <small className="bp2-nm">
              {card.view.kind === "tag" ? "Титул" : card.label}
            </small>
          </>
        )}
        {canClaim && <span className="bp2-take">Забрать</span>}
        {card.bundle > 1 && <span className="bp-bundle">×{card.bundle}</span>}
      </button>
    </div>
  );
});
