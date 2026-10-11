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

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AgTag } from "@/components/progression/AgTag";
import { AvatarView } from "@/components/profile/AvatarView";
import { isPremiumActive } from "@/lib/auth";
import { FRAMES } from "@/lib/cosmetics";
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
import { LevelRing } from "@/components/battlepass/LevelRing";
import { PassPurchase } from "@/components/battlepass/PassPurchase";
import { RewardModal } from "@/components/battlepass/RewardModal";
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

  const freeTotals = useMemo(() => bpLineTotals("free"), []);
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

  return (
    <div className="bp-page relative">
      <div className="bp-bg" aria-hidden />
      <div className="bp-fog" aria-hidden />

      {barVisible && (
        <StickyBar
          level={progress.level}
          percent={progress.percent}
          premium={premium}
          claimables={claimables.length}
          onClaimAll={claimAll}
        />
      )}

      <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-5 px-4 pb-10">
        {/* Шапка сезона и покупка пропуска — рядом, как на референсе */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_330px] lg:items-start">
          <header className="bp-panel bp-hd" ref={headRef}>
            <div className="hero">
            <LevelRing level={progress.level} fraction={fraction} maxLevel={BATTLEPASS.maxLevel} />
          </div>

          <div className="min-w-0">
            <p className="eyebrow">
              СЕЗОН 1 · {BATTLEPASS.seasonId.replace("season-", "")}
            </p>
            <h1>
              {BATTLEPASS.name}
              <span>БОЕВОЙ ПРОПУСК</span>
            </h1>
            <p className="sub">
              100 уровней, две линии наград и аникойны за активность: XP сайта идёт в пропуск один в
              один, а редкие предметы — рамки, маски и титулы — только за сезон.
            </p>

            <div className="bp-xpt">
              <span>
                {progress.level >= BATTLEPASS.maxLevel
                  ? "МАКСИМУМ"
                  : `${progress.into.toLocaleString("ru-RU")} / ${progress.need.toLocaleString("ru-RU")} XP`}
              </span>
              <span>{(bp.xp + bpXpFromRewards()).toLocaleString("ru-RU")} XP всего</span>
            </div>
            <div className="bp-xpb">
              <i style={{ width: `${Math.round(fraction * 100)}%` }} />
            </div>
          </div>

          <div className="bp-act">
            <div className="bp-ac">
              БАЛАНС <b>{doc.progress.acBalance.toLocaleString("ru-RU")}</b> AC
            </div>
            <button
              type="button"
              className="bp-btn pri"
              onClick={claimAll}
              disabled={claimables.length === 0}
              style={{ background: "linear-gradient(135deg,#1c63ff,#7a4dff)", borderColor: "transparent" }}
            >
              Забрать все награды <em>{claimables.length}</em>
            </button>
            {premium ? (
              <span className="bp-btn vip on" aria-label="Premium активен">
                ✦ Premium активен
              </span>
            ) : (
              <Link href="/premium" className="bp-btn vip" style={{ display: "block", textAlign: "center" }}>
                ✦ AniGalaxy Premium
              </Link>
            )}
          </div>
        </header>

          {/* ------------------------- Покупка пропуска -------------------- */}
          <PassPurchase premium={premium} level={progress.level} totals={premiumTotals} />
        </div>

        {/* ---------------------------- Дорожка --------------------------- */}
        <Track
          statusCtx={statusCtx}
          currentLevel={progress.level}
          fraction={fraction}
          nickname={nickname}
          onOpen={(card) => setOpenKey(card.key)}
        />

        {/* ---------------------------- Эксклюзивы ------------------------- */}
        <ExclusiveShowcase statusCtx={statusCtx} nickname={nickname} onClaim={claim} onOpen={setOpenKey} />

        {/* ---------------------------- Итоги линий ------------------------ */}
        <section className="grid gap-3 sm:grid-cols-2" data-reveal>
          <LineCard
            title="Free-линия"
            totals={freeTotals}
            note="Открывается всем: AC, XP сезона, рамки и титулы на части уровней."
          />
          <LineCard
            title="Premium-линия"
            totals={premiumTotals}
            note={
              premium
                ? "Подписка активна — золотые уровни разблокированы."
                : "Нужна подписка AniGalaxy Premium."
            }
            locked={!premium}
          />
        </section>

        {/* ---------------------------- Источники XP ----------------------- */}
        <XpSources />
      </div>

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

/** Сколько XP даст выдача всех доступных пакетов (для «XP всего») */
function bpXpFromRewards(): number {
  return 0;
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
      className="animate-bp-bar-in fixed inset-x-0 top-16 z-40 px-4 pt-2"
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

/* ============================== Итоги ================================== */

function LineCard({
  title,
  totals,
  note,
  locked,
}: {
  title: string;
  totals: { ac: number; bpXp: number; items: number; levels: number };
  note: string;
  locked?: boolean;
}) {
  const isPremium = title.startsWith("Premium");
  return (
    <div
      className={`rounded-2xl border p-4 ${
        isPremium
          ? "border-gold/25 bg-gradient-to-br from-gold/[0.08] to-transparent"
          : "border-accent/20 bg-gradient-to-br from-accent/[0.07] to-transparent"
      }`}
    >
      <p className={`text-[11px] font-black uppercase tracking-wide ${isPremium ? "text-gold" : "text-accent"}`}>
        {title}
        {locked && <span className="ml-2 font-bold text-muted">· нужен Premium</span>}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1.5 font-bold text-white">
          {/* eslint-disable-next-line @next/next/no-img-element -- монетка 18px в плотной сводке, next/image даёт лишний запрос */}
          <img src="/coin.png" alt="" aria-hidden width={18} height={18} className="h-4 w-4" />
          {totals.ac.toLocaleString("ru-RU")}
        </span>
        <span className="inline-flex items-center gap-1.5 font-bold text-accent">
          <span aria-hidden>⚡</span>
          {totals.bpXp.toLocaleString("ru-RU")} XP
        </span>
        <span className="font-bold text-white">{totals.items} предм.</span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">{note}</p>
    </div>
  );
}

/* =========================== Источники XP ============================== */

function xpSources(): { icon: string; title: string; text: string }[] {
  return [
    { icon: "🔑", title: "Ежедневный вход", text: "Первый вход в день: 25 XP, серия дней и заморозка." },
    { icon: "📺", title: "Просмотр серий", text: "10 XP за каждую досмотренную серию — главный источник." },
    { icon: "💬", title: "Комментарии", text: "15 XP за первый комментарий в день и 5 XP за следующий." },
    { icon: "★", title: "Оценки и списки", text: "5 XP за оценку тайтла и 6 XP за добавление в список." },
    { icon: "✔", title: "Задания и достижения", text: "Ежедневные и еженедельные задания, ачивки — крупные порции XP." },
  ];
}

function XpSources() {
  return (
    <section className="bp-panel p-4 sm:p-5" data-reveal>
      <h2 className="font-display text-lg font-black tracking-wide text-white">⚡ Как набирать XP</h2>
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

/**
 * Витрина предметов сезона в стиле магазина: превью 3:2, редкость,
 * уровень и выдача. Только рамки, маски и титулы — AC/XP живут на дорожке.
 */
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
  const [filter, setFilter] = useState<"all" | "frame" | "tag">("all");

  const cards = filter === "all" ? EXCLUSIVE_CARDS : EXCLUSIVE_CARDS.filter((card) => card.kind === filter);
  const count = (id: "all" | "frame" | "tag") =>
    id === "all" ? EXCLUSIVE_CARDS.length : EXCLUSIVE_CARDS.filter((card) => card.kind === id).length;

  return (
    <section className="bp-panel p-4 sm:p-5" data-reveal>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-black tracking-wide text-white">💠 Эксклюзивы сезона</h2>
          <p className="mt-1 text-sm text-muted">
            {EXCLUSIVE_CARDS.length} {plural(EXCLUSIVE_CARDS.length, "предмет", "предмета", "предметов")},
            которых нет больше нигде: рамки, маски и титулы только за боевой пропуск.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Фильтр эксклюзивов">
          {(
            [
              { id: "all", label: "Все" },
              { id: "frame", label: "Рамки и маски" },
              { id: "tag", label: "Титулы" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              aria-pressed={filter === item.id}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${
                filter === item.id ? "bg-white/15 text-white" : "text-muted hover:text-white"
              }`}
            >
              {item.label} · {count(item.id)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 min-[760px]:grid-cols-3 xl:grid-cols-4">
        {cards.map((card) => {
          const status = bpRewardStatus(card.level, card.line, statusCtx);
          const canClaim = status === "claimable";
          const isPremium = card.line === "premium";
          const view = card.view;
          const frame =
            view.kind === "frame" ? FRAMES.find((item) => item.id === view.itemId) : undefined;

          return (
            <article
              key={card.key}
              className={`group relative overflow-hidden rounded-2xl bg-white/[0.03] ring-1 transition ${
                canClaim ? "ring-accent-2" : "ring-white/10 hover:ring-white/30"
              }`}
            >
              <button
                type="button"
                className="block w-full text-left"
                onClick={() => onOpen(card.key)}
                aria-label={`${card.label}, ${card.rarityLabel}, уровень ${card.level}`}
              >
                <div className="relative">
                  {card.kind === "tag" && card.view.kind === "tag" ? (
                    <span
                      className="flex aspect-[3/2] w-full items-center justify-center"
                      style={{
                        background: `radial-gradient(130% 100% at 50% 0%, ${card.view.tag.visual.c}2e, transparent 62%), #0c0d16`,
                      }}
                      aria-hidden
                    >
                      <AgTag tag={card.view.tag} size="lg" locked={status === "locked"} />
                    </span>
                  ) : (
                    <span className="flex aspect-[3/2] w-full items-center justify-center bg-[#0c0d16]">
                      <AvatarView
                        nickname={nickname}
                        frameCss={frame?.css}
                        frameImg={frame?.img}
                        className="h-20 w-20"
                        textClass="text-xl"
                      />
                    </span>
                  )}

                  <span
                    className={`absolute left-2 top-2 rounded-md px-1.5 py-0.5 text-[10px] font-black tabular-nums ring-1 ${
                      isPremium ? "bg-black/60 text-gold ring-gold/45" : "bg-black/60 text-white ring-white/25"
                    }`}
                  >
                    L{card.level}
                  </span>
                  {isPremium && (
                    <span className="absolute right-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-gold ring-1 ring-gold/45">
                      Premium
                    </span>
                  )}
                </div>

                <div className="px-3 py-2.5">
                  <p className="truncate text-[13px] font-black uppercase tracking-wide text-white">
                    {card.label}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-muted">
                    <span
                      className="inline-block h-1.5 w-1.5 rotate-45 rounded-[1px]"
                      style={{ background: AE_RARITY[card.rarity].c }}
                    />
                    <span>
                      {card.kind === "frame" ? "Рамка аватара" : "Титул"} · {card.rarityLabel}
                    </span>
                  </p>
                </div>
              </button>

              <div className="px-3 pb-3">
                {canClaim ? (
                  <button
                    type="button"
                    onClick={() => onClaim(card.line, card.level)}
                    className="bp-btn w-full !py-1.5 !text-[11px]"
                    style={{
                      background: isPremium
                        ? "linear-gradient(135deg,#ffd04d,#ff8a1f)"
                        : "linear-gradient(135deg,#34e08a,#6cf0ff)",
                      color: isPremium ? "#2a1500" : "#04140b",
                      borderColor: "transparent",
                    }}
                    aria-label={`Каталог: выдать эксклюзив L${card.level} ${card.line}`}
                  >
                    Забрать
                  </button>
                ) : status === "claimed" ? (
                  <span className="inline-block rounded-lg bg-mint/15 px-2.5 py-1 text-[11px] font-bold text-mint ring-1 ring-mint/30">
                    Получено
                  </span>
                ) : isPremium && !statusCtx.premium ? (
                  <span className="inline-block rounded-lg bg-gold/12 px-2.5 py-1 text-[11px] font-bold text-gold ring-1 ring-gold/30">
                    Нужен Premium
                  </span>
                ) : (
                  <span className="inline-block rounded-lg bg-white/8 px-2.5 py-1 text-[11px] font-bold text-muted ring-1 ring-white/12">
                    Уровень {card.level}
                  </span>
                )}
              </div>
            </article>
          );
        })}
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
