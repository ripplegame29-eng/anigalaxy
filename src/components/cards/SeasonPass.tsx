"use client";

/**
 * Вкладка «Сезон» карточной игры: основной боевой пропуск сайта в стиле гачи.
 * Состояния и выдача — общие с /battlepass (движок прогресса); награды гачи
 * (паки, свитки, алмазы, пыль, карты) лежат на тех же уровнях и показаны отдельным блоком.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { isPremiumActive } from "@/lib/auth";
import { BATTLEPASS, bpClaimables, bpProgress, bpRewardStatus, type BpRewardStatus, type BpStatusCtx } from "@/lib/battlepass/logic";
import { GACHA_BP_LEVELS, gachaRewardAt } from "@/lib/battlepass/gacha";
import { cardsAtLevel, TRACK_CARDS, type BpRewardCard } from "@/components/battlepass/model";
import { RewardArt } from "@/components/battlepass/RewardArt";
import { cardDef } from "@/lib/cards/catalog";
import { RANKS } from "@/lib/cards/config";
import type { Reward } from "@/lib/cards/progress";
import { syncBpRewards } from "@/lib/cards/client";
import { progressEmit, useProgress } from "@/lib/progression/events";
import type { BattlepassLine } from "@/lib/progression/types";
import { useAccount } from "@/lib/use-account";
import { GameCard } from "./GameCard";
import { Reveal, fmt, toast, useNow } from "./common";
import { Cur, Ico, ScrollArt } from "./icons";

const LINE_NAME: Record<BattlepassLine, string> = { free: "Бесплатная", premium: "Премиум" };

/** Награда гачи в виде значков: алмазы, пыль, паки, свитки, карта */
function RewardChips({ r, dim }: { r: Reward; dim?: boolean }) {
  return (
    <span className={`sp-chips${dim ? " dim" : ""}`}>
      {r.packs ? (
        <span className="sp-chip">
          <Cur k="packs" size={15} />
          {r.packs}
        </span>
      ) : null}
      {r.scroll ? (
        <span className="sp-chip">
          <ScrollArt size={22} />
          {r.scroll}
        </span>
      ) : null}
      {r.diamonds ? (
        <span className="sp-chip">
          <Cur k="diamonds" size={15} />
          {fmt(r.diamonds)}
        </span>
      ) : null}
      {r.dust ? (
        <span className="sp-chip">
          <Cur k="dust" size={15} />
          {fmt(r.dust)}
        </span>
      ) : null}
      {r.card ? (
        <span className="sp-chip card">
          <Ico name="crown" size={14} />
          карта
        </span>
      ) : null}
    </span>
  );
}

const stateText: Record<BpRewardStatus, string> = { locked: "Закрыто", claimable: "Забрать", claimed: "Получено" };

export function SeasonPass() {
  const doc = useProgress();
  const account = useAccount();
  const premium = isPremiumActive(account);
  const bp = doc.battlepass;
  const now = useNow(60_000);

  const progress = useMemo(() => bpProgress(bp.xp), [bp.xp]);
  const claimed = useMemo(() => new Set(bp.claimed), [bp.claimed]);
  const ctx = useMemo<BpStatusCtx>(() => ({ xp: bp.xp, premium, claimed }), [bp.xp, premium, claimed]);
  const claimables = useMemo(() => bpClaimables(ctx), [ctx]);
  const [reveal, setReveal] = useState<string[] | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  /* Награды гачи выдаёт сервер, когда забранный уровень попал в синхронизированный прогресс */
  const claimedCount = bp.claimed.length;
  useEffect(() => {
    if (!account) return;
    let alive = true;
    const run = async () => {
      const res = await syncBpRewards();
      if (!alive || !res || res.count === 0) return;
      toast(`Награды гачи получены: ${res.count}`);
      if (res.cards.length) setReveal(res.cards);
    };
    const timers = [400, 4000, 15000].map((ms) => window.setTimeout(() => void run(), ms));
    return () => {
      alive = false;
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [account, claimedCount]);

  /* Дорожка при открытии встаёт на текущий уровень */
  useEffect(() => {
    const box = scroller.current;
    const cur = box?.querySelector<HTMLElement>(`[data-lv="${Math.max(1, progress.level)}"]`);
    if (box && cur) box.scrollLeft = Math.max(0, cur.offsetLeft - box.clientWidth / 2 + cur.clientWidth / 2);
    // только при открытии
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const claimOne = useCallback((line: BattlepassLine, level: number) => {
    const res = progressEmit({ type: "BATTLEPASS_CLAIMED", line, level });
    if (!res.effects.some((e) => e.type === "BATTLEPASS_CLAIMED")) toast("Награда недоступна", true);
  }, []);

  const claimAll = useCallback(() => {
    if (!claimables.length) return toast("Пока нечего забирать");
    for (const it of claimables) progressEmit({ type: "BATTLEPASS_CLAIMED", ...it });
    toast(`Забрано наград: ${claimables.length}`);
  }, [claimables]);

  const daysLeft = Math.max(0, Math.ceil((BATTLEPASS.to - now) / 86_400_000));
  const pct = progress.level >= BATTLEPASS.maxLevel ? 100 : progress.percent;
  const ringC = 2 * Math.PI * 52;
  const cards = useMemo(
    () =>
      GACHA_BP_LEVELS.flatMap((level) =>
        (["free", "premium"] as const).flatMap((line) => {
          const id = gachaRewardAt(level, line)?.card;
          return id ? [{ id, level, line }] : [];
        }),
      ),
    [],
  );

  const levels = useMemo(() => [...new Set(TRACK_CARDS.map((c) => c.level))], []);

  return (
    <div className="sp">
      <section className="sp-hero">
        <div className="sp-ring" aria-label={`Уровень ${progress.level} из ${BATTLEPASS.maxLevel}`}>
          <svg viewBox="0 0 120 120" aria-hidden>
            <circle cx="60" cy="60" r="52" className="bg" />
            <circle cx="60" cy="60" r="52" className="fg" strokeDasharray={ringC} strokeDashoffset={ringC * (1 - pct / 100)} transform="rotate(-90 60 60)" />
          </svg>
          <div>
            <small>уровень</small>
            <b>{progress.level}</b>
            <span>из {BATTLEPASS.maxLevel}</span>
          </div>
        </div>
        <div className="sp-info">
          <span className="cg-eyebrow">{BATTLEPASS.name}</span>
          <h2>Сезонный пропуск</h2>
          <p>
            Один пропуск на всё: XP сайта и действия в гаче — бои, паки, рейды — двигают уровни. На уровнях лежат награды сайта и награды карточной игры: паки, свитки, алмазы, пыль и герои.
          </p>
          <div className="sp-xp">
            <div className="sp-xp-top">
              <span>
                {progress.level >= BATTLEPASS.maxLevel ? "Максимальный уровень" : `${fmt(progress.into)} / ${fmt(progress.need)} XP до уровня ${progress.level + 1}`}
              </span>
              <b>{pct}%</b>
            </div>
            <div className="sp-bar">
              <i style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="sp-stats">
            <span>
              <Ico name="clock" size={15} />
              <b>{daysLeft}</b> дн. до конца
            </span>
            <span>
              <Ico name="gift" size={15} />
              <b>{claimables.length}</b> к получению
            </span>
            <span className={premium ? "on" : ""}>
              <Ico name={premium ? "crown" : "lock"} size={15} />
              {premium ? "Премиум-линия открыта" : "Премиум-линия закрыта"}
            </span>
          </div>
        </div>
        <div className="sp-act">
          <button type="button" className="cg-btn pri lg" disabled={!claimables.length} onClick={claimAll}>
            Забрать всё{claimables.length ? ` · ${claimables.length}` : ""}
          </button>
          {!premium && (
            <Link href="/premium" className="cg-btn">
              Открыть премиум
            </Link>
          )}
          <Link href="/battlepass" className="sp-link">
            Полная страница пропуска
          </Link>
        </div>
      </section>

      <section className="sp-sec">
        <header className="sp-sh">
          <div>
            <h3>Дорожка наград</h3>
            <p>Уровни 1–{BATTLEPASS.maxLevel}. Синий значок на клетке — вместе с наградой сайта вы получите награду гачи.</p>
          </div>
          <div className="sp-legend">
            <span>
              <i className="f" />
              Бесплатная
            </span>
            <span>
              <i className="p" />
              Премиум
            </span>
          </div>
        </header>
        <div className="sp-track" ref={scroller}>
          {levels.map((level) => {
            const at = cardsAtLevel(level);
            const reached = level <= progress.level;
            return (
              <div key={level} data-lv={level} className={`sp-lv${reached ? " reached" : ""}${level === progress.level ? " cur" : ""}`}>
                <div className="sp-n">{level}</div>
                {(["free", "premium"] as const).map((line) => {
                  const card = at[line];
                  if (!card) return <div key={line} className={`sp-cell ${line} empty`} />;
                  const st = bpRewardStatus(level, line, ctx) ?? "locked";
                  return <Cell key={line} card={card} st={st} onClaim={() => claimOne(line, level)} />;
                })}
              </div>
            );
          })}
        </div>
      </section>

      <section className="sp-sec">
        <header className="sp-sh">
          <div>
            <h3>Награды гачи</h3>
            <p>Выдаются вместе с наградой уровня: после получения клетки на дорожке.</p>
          </div>
        </header>

        <div className="sp-hero-cards">
          {cards.map(({ id, level, line }) => {
            const st = bpRewardStatus(level, line, ctx) ?? "locked";
            const def = cardDef(id);
            if (!def) return null;
            return (
              <div key={id} className={`sp-hc ${st}`}>
                <div className="sp-hc-card">
                  <GameCard cardId={id} stats={false} locked={st === "locked"} />
                  {st === "claimed" && <span className="sp-got">Получена</span>}
                </div>
                <span className="sp-hc-rank" style={{ color: RANKS[def.rank].color }}>
                  {RANKS[def.rank].name}
                </span>
                <small>
                  Уровень {level} · {LINE_NAME[line]}
                </small>
              </div>
            );
          })}
        </div>

        <div className="sp-gl-grid">
          {GACHA_BP_LEVELS.map((level) => {
            const f = gachaRewardAt(level, "free");
            const p = gachaRewardAt(level, "premium");
            const sf = f ? (bpRewardStatus(level, "free", ctx) ?? "locked") : null;
            const sp = p ? (bpRewardStatus(level, "premium", ctx) ?? "locked") : null;
            const can = sf === "claimable" || sp === "claimable";
            return (
              <div key={level} className={`sp-gl${can ? " can" : ""}`}>
                <div className="sp-gl-top">
                  <b>Уровень {level}</b>
                  {can && (
                    <button
                      type="button"
                      className="sp-take"
                      onClick={() => {
                        if (sf === "claimable") claimOne("free", level);
                        if (sp === "claimable") claimOne("premium", level);
                      }}
                    >
                      Забрать
                    </button>
                  )}
                </div>
                {f && sf && (
                  <div className={`sp-gl-row ${sf}`}>
                    <span className="sp-gl-l">Бесплатно</span>
                    <RewardChips r={f} dim={sf === "locked"} />
                    {sf === "claimed" && <Ico name="check" size={14} className="ok" />}
                  </div>
                )}
                {p && sp && (
                  <div className={`sp-gl-row prem ${sp}`}>
                    <span className="sp-gl-l">Премиум</span>
                    <RewardChips r={p} dim={sp === "locked"} />
                    {sp === "claimed" ? <Ico name="check" size={14} className="ok" /> : sp === "locked" && !premium && level <= progress.level ? <Ico name="lock" size={13} /> : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {reveal && <Reveal cards={reveal.map((cardId) => ({ cardId }))} onClose={() => setReveal(null)} title="Награда сезона" sub="Карты добавлены в коллекцию" />}
    </div>
  );
}

function Cell({ card, st, onClaim }: { card: BpRewardCard; st: BpRewardStatus; onClaim: () => void }) {
  return (
    <button type="button" className={`sp-cell ${card.line} ${st} sp-k-${card.kind}`} disabled={st !== "claimable"} onClick={onClaim} title={`${card.kindLabel}: ${card.label}${card.gacha ? ` · гача: ${card.gacha}` : ""}`}>
      <span className="sp-art">
        <span className="bp2">
          <RewardArt card={card} size="sm" nickname="Вы" />
        </span>
      </span>
      <span className="sp-lab">{card.label}</span>
      {card.bundle > 1 && <span className="sp-bn">+{card.bundle - 1}</span>}
      {card.gacha && <span className="sp-gx" aria-label="Есть награда гачи" />}
      <em>{stateText[st]}</em>
    </button>
  );
}
