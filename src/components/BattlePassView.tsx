"use client";

/**
 * Страница боевого пропуска (§7 ТЗ): сезон, кольцо уровня, дорожка на 100
 * уровней с двумя линиями, сцена получения и витрина эксклюзивов.
 *
 * Оформление — по макету «Hueco Mundo · Battle Pass» (стеклянные панели с
 * конической рамкой, лунное кольцо уровня, ползунок дорожки, сцена заряд →
 * лучи → волны → результат). Отличие от макета: визуал каждой награды
 * настоящий из проекта (монетка AC, молния XP, капсула титула, аватар в
 * рамке), а не одна монетка на все типы.
 *
 * Компонент ничего не начисляет сам: клик шлёт в движок семантическое
 * событие `BATTLEPASS_CLAIMED` (только линия + номер уровня), суммы,
 * предметы и право выдачи движок считает по конфигу сезона
 * (`lib/battlepass`). Состояния клеток — `bpRewardStatus` и `bpLevelStatus`
 * из того же модуля, поэтому UI и выдача никогда не расходятся.
 *
 * Данные хранятся в документе прогрессии (`animehub:progress:v1`,
 * раздел `battlepass`) — той же атомарной записи, что баланс AC и журнал
 * идемпотентности.
 */

import { BpIcon } from "@/components/battlepass/BpIcons";
import { BoltIcon } from "@/components/battlepass/BoltIcon";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { isPremiumActive } from "@/lib/auth";
import { BP_MISSIONS } from "@/lib/battlepass/config";
import {
  BATTLEPASS,
  bpClaimables,
  bpLineTotals,
  bpProgress,
  bpRewardStatus,
  describeReward,
  type BpRewardStatus,
  type BpStatusCtx,
} from "@/lib/battlepass/logic";
import { AE_RARITY } from "@/components/progression/AchievementEmblem";
import { ClaimScene } from "@/components/battlepass/ClaimScene";
import { BpHero, BpOffer, type BpTab } from "@/components/battlepass/BpParts";
import { RewardArt } from "@/components/battlepass/RewardArt";
import { RewardModal } from "@/components/battlepass/RewardModal";
import { ProfilePreview, ProfileMini } from "@/components/battlepass/ProfilePreview";
import { Track } from "@/components/battlepass/Track";
import {
  EXCLUSIVE_CARDS,
  TRACK_CARDS,
  plural,
  type BpRewardCard,
} from "@/components/battlepass/model";
import { progressEmit, useProgress } from "@/lib/progression/events";
import type { BattlepassLine, ProgressEffect } from "@/lib/progression/types";
import { pushToast } from "@/lib/toasts";
import { useAccount } from "@/lib/use-account";

type ClaimEffect = Extract<ProgressEffect, { type: "BATTLEPASS_CLAIMED" }>;

/** Сцена получения: что показали и сколько пакетов выдали сверх этого */
interface SceneState {
  card: BpRewardCard;
  extra: number;
  levelAfter: number;
  levelsGained: number;
}

/* ============================== Страница ================================ */

export function BattlePassView() {
  const doc = useProgress();
  const account = useAccount();
  const premium = isPremiumActive(account);
  const nickname = account?.nickname ?? "Гость";

  const bp = doc.battlepass;
  const progress = useMemo(() => bpProgress(bp.xp), [bp.xp]);
  const claimed = useMemo(() => new Set(bp.claimed), [bp.claimed]);
  const statusCtx = useMemo<BpStatusCtx>(
    () => ({ xp: bp.xp, premium, claimed }),
    [bp.xp, premium, claimed],
  );
  const claimables = useMemo(() => bpClaimables(statusCtx), [statusCtx]);

  const [tab, setTab] = useState<BpTab>("rewards");
  const [scene, setScene] = useState<SceneState | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const busy = useRef(false);

  const cardByKey = useMemo(
    () => new Map(TRACK_CARDS.map((card) => [card.key, card] as const)),
    [],
  );
  const openCard = openKey ? (cardByKey.get(openKey) ?? null) : null;
  const openStatus: BpRewardStatus | null = openCard ? bpRewardStatus(openCard.level, openCard.line, statusCtx) : null;

  /** Клик по награде: в движок уходит только семантика, всё остальное — там */
  const claim = useCallback(
    (line: BattlepassLine, level: number) => {
      if (busy.current) return;
      const card = cardByKey.get(`${line}:${level}`);
      if (!card) return;
      const before = progress.level;
      const res = progressEmit({ type: "BATTLEPASS_CLAIMED", line, level });
      const effect = res.effects.find((item): item is ClaimEffect => item.type === "BATTLEPASS_CLAIMED");
      if (!effect) {
        pushToast({ kind: "ac", title: "Награда недоступна", text: rejectText(res.rejected?.reason) });
        return;
      }
      setOpenKey(null);
      setScene({
        card,
        extra: 0,
        levelAfter: effect.levelAfter,
        levelsGained: Math.max(0, effect.levelAfter - before),
      });
    },
    [cardByKey, progress.level],
  );

  /** Забрать всё доступное одним действием — движок выдаёт пакеты по порядку */
  const claimAll = useCallback(() => {
    if (busy.current) return;
    if (claimables.length === 0) {
      pushToast({
        kind: "xp",
        title: "Пока нечего забирать",
        text: "Набирайте XP — новые уровни откроются автоматически",
      });
      return;
    }
    const before = progress.level;
    const effects: ClaimEffect[] = [];
    for (const item of claimables) {
      const res = progressEmit({ type: "BATTLEPASS_CLAIMED", ...item });
      const effect = res.effects.find((entry): entry is ClaimEffect => entry.type === "BATTLEPASS_CLAIMED");
      if (effect) effects.push(effect);
    }
    if (effects.length === 0) {
      pushToast({ kind: "ac", title: "Награда недоступна", text: "Обновите страницу и попробуйте снова" });
      return;
    }
    const levelAfter = Math.max(...effects.map((item) => item.levelAfter));
    // Показываем самую «крупную» награду из пакета — по редкости, затем уровню
    const best =
      claimables
        .map((item) => cardByKey.get(`${item.line}:${item.level}`))
        .filter((card): card is BpRewardCard => Boolean(card))
        .sort((a, b) => b.level - a.level)[0] ?? null;
    setOpenKey(null);
    if (best) {
      setScene({
        card: best,
        extra: Math.max(0, effects.length - 1),
        levelAfter,
        levelsGained: Math.max(0, levelAfter - before),
      });
    }
  }, [claimables, cardByKey, progress.level]);

  const premiumTotals = useMemo(() => bpLineTotals("premium"), []);

  /* Липкий статус-бар: появляется, когда шапка ушла из вида */
  const headRef = useRef<HTMLElement>(null);
  const [barVisible, setBarVisible] = useState(false);
  useEffect(() => {
    const head = headRef.current;
    if (!head || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry) setBarVisible(!entry.isIntersecting);
    });
    io.observe(head);
    return () => io.disconnect();
  }, []);

  /* Вход секций при прокрутке — класс дописывается в DOM, без ре-рендеров */
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const nodes = document.querySelectorAll<HTMLElement>("[data-reveal]");
    if (nodes.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("bp-revealed");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -6% 0px" },
    );
    nodes.forEach((node) => io.observe(node));
    return () => io.disconnect();
  }, []);

  /* Демо-версия пропуска держала прогресс в `ag:bp:*` — ключи осиротели */
  useEffect(() => {
    for (const key of ["ag:bp:xp", "ag:bp:claimed", "ag:bp:quests"]) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* приватный режим — не критично */
      }
    }
  }, []);

  /* Сцена и модалка не должны листать страницу под собой */
  useEffect(() => {
    if (!scene && !openCard) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [scene, openCard]);

  const fraction = progress.level >= BATTLEPASS.maxLevel ? 1 : progress.percent / 100;

  const bpLevel = progress.level;
  const missionValue = (m: (typeof BP_MISSIONS)[number]) =>
    m.kind === "bpXp" ? bp.xp : m.kind === "level" ? bpLevel : bp.claimed.length;
  const missionsDone = BP_MISSIONS.filter((m) => missionValue(m) >= m.target).length;
  const xpLeftToFinal = Math.max(0, progress.totalMax - progress.totalDone);

  return (
    <div className="bp-page bp2 relative">
      {barVisible && (
        <StickyBar
          level={progress.level}
          percent={progress.percent}
          premium={premium}
          claimables={claimables.length}
          onClaimAll={claimAll}
        />
      )}

      <BpHero
        tab={tab}
        onTab={setTab}
        level={progress.level}
        maxLevel={BATTLEPASS.maxLevel}
        fraction={fraction}
        into={progress.into}
        need={progress.need}
        xpLeftToFinal={xpLeftToFinal}
        claimables={claimables.length}
        totalCards={TRACK_CARDS.length}
        missionsDone={missionsDone}
        missionsTotal={BP_MISSIONS.length}
        heroRef={headRef}
      />

      <main className="bp2-w bp2-main">
        {tab === "rewards" ? (
          <>
            <BpOffer premium={premium} level={progress.level} totals={premiumTotals} />

            <div className="bp2-claimbar">
              <span>
                Баланс <b>{doc.progress.acBalance.toLocaleString("ru-RU")}</b> AC
              </span>
              <button type="button" className="bp2-btn" onClick={claimAll} disabled={claimables.length === 0}>
                Забрать все награды <em>{claimables.length}</em>
              </button>
            </div>

            <Track
              statusCtx={statusCtx}
              currentLevel={progress.level}
              fraction={fraction}
              nickname={nickname}
              onOpen={(card) => setOpenKey(card.key)}
            />

            <ExclusiveShowcase statusCtx={statusCtx} nickname={nickname} onClaim={claim} onOpen={setOpenKey} />

            <XpSources />
          </>
        ) : (
          <section className="bp2-sec">
            <div className="bp2-shd">
              <div>
                <h2>Задания сезона</h2>
                <p>
                  Засчитываются сами · выполнено {missionsDone} из {BP_MISSIONS.length}
                </p>
              </div>
              <Link href="/quests" className="bp2-btn ghost">
                Ежедневные квесты
              </Link>
            </div>
            <div className="bp2-tk">
              {BP_MISSIONS.map((mission) => {
                const value = Math.min(missionValue(mission), mission.target);
                const pct = Math.round((value / mission.target) * 100);
                const done = value >= mission.target;
                const unit = mission.kind === "level" ? "ур." : mission.kind === "claim" ? "наград" : "XP";
                return (
                  <div key={mission.id} className={`bp2-tq${done ? " done" : ""}`}>
                    <div className="ck">{done ? "✓" : "✦"}</div>
                    <div>
                      <b>{mission.title}</b>
                      <p>{mission.description}</p>
                      <div className="bp2-bar sm">
                        <i style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <span className="xp">
                      {value} / {mission.target} {unit}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <p className="bp2-foot">Награды и прогресс сезона сохраняются в этом браузере.</p>
      </main>

      {/* Модалка и сцена живут вне потока — поверх всей страницы */}
      <RewardModal
        card={openCard}
        status={openStatus}
        premium={premium}
        nickname={nickname}
        onClaim={claim}
        onClose={() => setOpenKey(null)}
      />
      {scene && (
        <ClaimScene
          card={scene.card}
          extra={scene.extra}
          levelAfter={scene.levelAfter}
          levelsGained={scene.levelsGained}
          nickname={nickname}
          onClose={() => {
            setScene(null);
            busy.current = false;
          }}
        />
      )}
    </div>
  );
}

/* ============================ Статус-бар ================================ */

function StickyBar({
  level,
  percent,
  premium,
  claimables,
  onClaimAll,
}: {
  level: number;
  percent: number;
  premium: boolean;
  claimables: number;
  onClaimAll: () => void;
}) {
  return (
    <section
      aria-label="Статус боевого пропуска"
      /* top-[78px] — высота новой шапки (padding-top 12 + капсула .hi 66).
         Раньше здесь было top-16: 64 px от прежней фиксированной шапки. */
      className="animate-bp-bar-in fixed inset-x-0 top-[78px] z-40 px-4 pt-2"
    >
      <div className="bp-panel mx-auto flex max-w-6xl items-center gap-3 px-3 py-2 sm:gap-4 sm:px-4">
        <div className="flex shrink-0 items-baseline gap-1">
          <span className="hidden text-[10px] font-black uppercase tracking-wide text-muted sm:inline">
            Ур.
          </span>
          <span className="font-display text-lg leading-none text-white tabular-nums">{level}</span>
          <span className="text-[10px] font-bold text-muted">/100</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="bp-xpt !mb-1">
            <span className="truncate">Уровень заполнен на {percent}%</span>
          </div>
          <div className="bp-xpb !h-2">
            <i style={{ width: `${percent}%` }} />
          </div>
        </div>

        {premium && (
          <span className="hidden shrink-0 text-[11px] font-black text-gold md:inline">✦ Premium</span>
        )}

        <button
          type="button"
          onClick={onClaimAll}
          disabled={claimables === 0}
          className="bp-btn shrink-0 !px-3 !py-1.5 !text-xs"
          style={{ background: "linear-gradient(135deg,#1c63ff,#7a4dff)", borderColor: "transparent" }}
        >
          {claimables > 0 ? `Забрать (${claimables})` : "Забрать"}
        </button>
      </div>
    </section>
  );
}

/* =========================== Источники XP ============================== */

function xpSources(): { icon: string; title: string; text: string }[] {
  return [
    { icon: "🔑", title: "Ежедневный вход", text: "Первый вход в день: 25 XP, серия дней и заморозка." },
    { icon: "📺", title: "Просмотр серий", text: "10 XP за каждую досмотренную серию — главный источник." },
    { icon: "💬", title: "Комментарии", text: "15 XP за первый комментарий в день и 5 XP за следующий." },
    { icon: "★", title: "Оценки и списки", text: "5 XP за оценку тайтла и 3–5 XP за добавление в список." },
    { icon: "✔", title: "Задания и достижения", text: "Ежедневные и еженедельные задания, ачивки — крупные порции XP." },
  ];
}

function XpSources() {
  return (
    <section className="bp-panel p-4 sm:p-5" data-reveal>
      <h2 className="font-display text-lg font-black tracking-wide text-white"><BoltIcon id="bp-bolt-h" /> Как набирать XP</h2>
      <p className="mt-1 text-sm text-muted">
        Любой опыт сайта идёт в пропуск один в один — XP из наград сезона капает поверх.
      </p>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
        {xpSources().map((card) => (
          <div key={card.title} className="rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/8">
            <p className="text-xl" aria-hidden>
              {card.icon}
            </p>
            <p className="mt-1.5 text-sm font-bold">{card.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">{card.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ============================ Эксклюзивы ============================== */

function ExclusiveShowcase({
  statusCtx,
  nickname,
  onClaim,
  onOpen,
}: {
  statusCtx: BpStatusCtx;
  nickname: string;
  onClaim: (line: BattlepassLine, level: number) => void;
  onOpen: (key: string) => void;
}) {
  const [kind, setKind] = useState<"all" | "frame" | "tag">("all");
  const [rarity, setRarity] = useState<"all" | BpRewardCard["rarity"]>("all");

  const rarities = useMemo(() => {
    const order: BpRewardCard["rarity"][] = ["mythic", "legendary", "epic", "rare", "common"];
    return order.filter((r) => EXCLUSIVE_CARDS.some((card) => card.rarity === r));
  }, []);

  const cards = EXCLUSIVE_CARDS.filter(
    (card) => (kind === "all" || card.kind === kind) && (rarity === "all" || card.rarity === rarity),
  );
  const count = (id: "all" | "frame" | "tag") =>
    id === "all" ? EXCLUSIVE_CARDS.length : EXCLUSIVE_CARDS.filter((card) => card.kind === id).length;

  const [profileOpen, setProfileOpen] = useState(false);

  /* Супер-приз — самый высокий предмет сезона */
  const top = useMemo(
    () => [...EXCLUSIVE_CARDS].sort((a, b) => b.level - a.level || (a.line === "premium" ? -1 : 1))[0],
    [],
  );

  return (
    <section className="bp2-card bp2-ex" data-reveal>
      {profileOpen && <ProfilePreview nickname={nickname} onClose={() => setProfileOpen(false)} />}
      <div className="bp2-shd">
        <div>
          <h2>Эксклюзивы сезона</h2>
          <p>
            {EXCLUSIVE_CARDS.length} {plural(EXCLUSIVE_CARDS.length, "предмет", "предмета", "предметов")} · только в этом сезоне
          </p>
        </div>
      </div>

      <div className="bp2-fb">
        <div className="bp2-chips" role="group" aria-label="Тип предмета">
          {(
            [
              { id: "all", label: "Всё" },
              { id: "frame", label: "Рамки" },
              { id: "tag", label: "Титулы" },
            ] as const
          ).map((item) => (
            <button key={item.id} type="button" onClick={() => setKind(item.id)} className={`bp2-pl${kind === item.id ? " on" : ""}`}>
              {item.label} · {count(item.id)}
            </button>
          ))}
        </div>
        <div className="bp2-chips" role="group" aria-label="Редкость">
          <button type="button" onClick={() => setRarity("all")} className={`bp2-pl${rarity === "all" ? " on" : ""}`}>
            Любая редкость
          </button>
          {rarities.map((r) => (
            <button key={r} type="button" onClick={() => setRarity(r)} className={`bp2-pl${rarity === r ? " on" : ""}`}>
              {AE_RARITY[r].n}
            </button>
          ))}
        </div>
      </div>

      <div className="bp2-exg">
        {top && (
          <aside className="bp2-sup">
            <span className="bp2-badge"><BpIcon name="crown" size={16} /> Супер-приз · {top.level} уровень</span>
            <div className="bp2-pv">
              <ProfileMini nickname={nickname} />
            </div>
            <small>
              {top.kindLabel} · {top.rarityLabel}
            </small>
            <h3>{top.label}</h3>
            <p>{top.desc}</p>
            <button type="button" className="bp2-btn" onClick={() => setProfileOpen(true)}>
              Как это выглядит в профиле
            </button>
          </aside>
        )}

        <div className="bp2-grid">
          {cards.map((card) => {
            const status = bpRewardStatus(card.level, card.line, statusCtx);
            const canClaim = status === "claimable";
            const isPremium = card.line === "premium";
            return (
              <article
                key={card.key}
                className={`bp2-ix${canClaim ? " can" : ""}`}
                style={{ "--k": AE_RARITY[card.rarity].c } as React.CSSProperties}
              >
                <button
                  type="button"
                  className="art"
                  onClick={() => onOpen(card.key)}
                  aria-label={`${card.label}, ${card.rarityLabel}, уровень ${card.level}`}
                >
                  <RewardArt card={card} size="md" live={canClaim} locked={status === "locked"} nickname={nickname} />
                  <span className="lv2">{status === "claimed" ? "✓" : <BpIcon name="lock" size={13} />} {card.level} ур.</span>
                  {isPremium && <span className="pm">Пропуск</span>}
                </button>
                <div className="im">
                  <small>
                    {card.kind === "frame" ? "Рамка" : card.kind === "decor" ? "Оформление" : "Титул"} · {card.rarityLabel}
                  </small>
                  <b>{card.label}</b>
                  {canClaim && (
                    <button type="button" className="bp2-claim" onClick={() => onClaim(card.line, card.level)}>
                      Забрать
                    </button>
                  )}
                  {status === "claimed" && <em className="got">Получено</em>}
                  {!canClaim && status !== "claimed" && isPremium && !statusCtx.premium && <em>Нужен пропуск</em>}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ============================ Общее ==================================== */

/** Рамка из палитры редкости — для клеток дорожки и витрины */
export function rarityColor(rarity: BpRewardCard["rarity"]): string {
  return AE_RARITY[rarity].c;
}

/** Описание награды для тостов и модалки */
export function rewardLabel(reward: Parameters<typeof describeReward>[0]): string {
  return describeReward(reward).label;
}

/** Отказ движка → человеческий текст */
function rejectText(reason?: string): string {
  const map: Record<string, string> = {
    bp_level_locked: "Уровень ещё не достигнут",
    bp_already_claimed: "Награда уже получена",
    bp_premium_required: "Нужна подписка AniGalaxy Premium",
    bp_season_inactive: "Сезон завершён",
  };
  return (reason && map[reason]) || "Попробуйте позже";
}
