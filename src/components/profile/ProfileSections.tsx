"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { COLLECTIONS_KEY, FAVORITES_KEY, deleteCollection, toggleFavorite, type Collection } from "@/lib/collections";
import { formatPremiumUntil, isPremiumActive, premiumDaysLeft, type Account } from "@/lib/auth";
import { parseList, useLocalSnapshot } from "@/lib/use-local-storage";
import { useAccount } from "@/lib/use-account";
import {
  addBlocked,
  claimGift,
  markNoticesRead,
  removeBlocked,
  toggleShowcase,
  unreadCount,
  updateProfile,
  useProfile,
} from "@/lib/profile";
import { clearWatchHistory, removeWatch, timeAgo, watchStore } from "@/lib/history";
import { progressEmit, useProgress } from "@/lib/progression/events";
import { collectMetrics, syncLegacyDelta } from "@/lib/progression/service";
import { PROGRESSION_CONFIG } from "@/lib/progression/progression.config";
import {
  buildAchievements,
  familyChips,
  rankAt,
  rankSegment,
  rankToNext,
  rarestUnlocked,
  segmentFills,
  unlockedLabel,
  type AchievementItem,
  type AchievementStatus,
} from "@/lib/progression/achievements-view";
import { rarityWeight, romanTier } from "@/lib/progression/visual";
import { useTagSelection, useTitleSelection } from "@/lib/selection";
import type { TagDef } from "@/lib/progression/types";
import { AgTag } from "@/components/progression/AgTag";
import { CFG_RARITY_CLASS, CFG_RARITY_LABEL } from "@/lib/progression/rarity-chips";
import { ERAS, levelInfo } from "@/lib/levels";
import { collectStats, type StatsBundle } from "@/lib/achievements";
import {
  BACKGROUNDS,
  FRAMES,
  TITLES,
  isOwned,
  isUnlocked,
  titleTag,
  unlockHint,
  type UnlockContext,
} from "@/lib/cosmetics";
import { useTitles } from "@/lib/titles";
import { openProfileDialog } from "@/lib/profile-dialog";
import { Poster } from "@/components/Poster";
import { AchievementEmblem } from "@/components/progression/AchievementEmblem";
import { LevelEmblem } from "@/components/LevelEmblem";
import { emblemMeta } from "@/lib/progression/achievements.config";
import { ERAS as EMBLEM_ERAS, eraOf } from "@/lib/levelEmblem";
import type { CSSProperties } from "react";
import { CommentsBlock, PROFILE_SCOPE } from "@/components/comments/CommentsBlock";
import { AvatarView } from "./AvatarView";
import { StatsBlock, fmtHours, type StatCardItem } from "./StatsBlock";

export type SectionId =
  | "main"
  | "quests"
  | "showcase"
  | "favorites"
  | "collections"
  | "achievements"
  | "shop"
  | "gifts"
  | "history"
  | "comments"
  | "blacklist"
  | "referrals"
  | "notices";

export interface SectionMeta {
  id: SectionId;
  label: string;
  badge?: "quests" | "notices";
  /**
   * Внешний раздел. Если задан — пункт рендерится ссылкой и уводит на
   * отдельную страницу, а не переключает вкладку профиля. Так сделан
   * магазин: внутри профиля он жил отдельной вкладкой и выглядел иначе,
   * чем /store, хотя каталог был тот же. Теперь это один и тот же магазин.
   */
  href?: string;
}

/** Пункты меню профиля: порядок как в референсе + разделы без сервера */
export const SECTIONS: SectionMeta[] = [
  { id: "main", label: "Основное" },
  { id: "showcase", label: "Витрина" },
  { id: "favorites", label: "Любимое" },
  { id: "collections", label: "Подборки" },
  { id: "achievements", label: "Достижения" },
  { id: "gifts", label: "Подарки" },
  { id: "history", label: "История" },
  { id: "comments", label: "Комментарии" },
  { id: "blacklist", label: "Чёрный список" },
  { id: "quests", label: "Квесты", badge: "quests" },
  { id: "shop", label: "Магазин", href: "/store" },
  { id: "referrals", label: "Пригласи друзей" },
  { id: "notices", label: "Уведомления", badge: "notices" },
];

export interface SectionProps {
  account: Account | null;
  go: (id: SectionId) => void;
}

/* --------------------------- Общие фрагменты ---------------------------- */

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-line bg-card/70 p-4 sm:p-5 ${className}`}>{children}</div>
  );
}

function Heading({
  children,
  right,
  accent = false,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
  /** Заголовок в акцентном шрифте Dela — как заголовки карточек на эталоне */
  accent?: boolean;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className={`${accent ? "font-accent" : "font-sans"} text-sm font-extrabold uppercase tracking-[0.16em] text-muted`}>{children}</h2>
      {right}
    </div>
  );
}

function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-white/[0.02] px-5 py-10 text-center">
      <p className="text-sm font-bold text-white">{title}</p>
      {hint && <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-muted">{hint}</p>}
    </div>
  );
}

function Bar({
  percent,
  tone = "accent",
  shine = false,
}: {
  percent: number;
  tone?: "accent" | "gold";
  /** Блик-проход по заполненной части (XP-бар §12.1) */
  shine?: boolean;
}) {
  const value = Math.max(0, Math.min(100, percent));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className={`h-full rounded-full transition-[width] duration-700 ${
          tone === "gold" ? "bg-gradient-to-r from-gold/70 to-gold" : "bg-gradient-to-r from-accent to-accent-2"
        } ${shine ? "ah-shine" : ""}`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

/** Плитка тайтла: ссылка на страницу просмотра + постер, если он известен */
function AnimeTile({
  id,
  action,
}: {
  id: string;
  action?: React.ReactNode;
}) {
  const titles = useTitles();
  const meta = titles[id];
  const label = meta?.title ?? id;

  return (
    <div className="group relative overflow-hidden rounded-xl border border-line bg-surface ring-1 ring-white/5 transition hover:ring-accent/50">
      <Link href={`/title/${id}`} className="block">
        <span className="relative block aspect-[2/3] w-full overflow-hidden bg-gradient-to-br from-accent/35 to-accent-2/20">
          <Poster
            src={meta?.poster}
            alt={label}
            title={label}
            sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 12vw"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        </span>
        <span className="block truncate px-2 py-2 text-[11px] font-bold text-white/90">{label}</span>
      </Link>
      {action && <span className="absolute right-1.5 top-1.5">{action}</span>}
    </div>
  );
}

function GhostButton({
  children,
  onClick,
  danger = false,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`grid h-7 w-7 place-items-center rounded-lg bg-black/70 text-white ring-1 ring-white/20 backdrop-blur transition hover:ring-white/60 ${
        danger ? "hover:text-rose-300" : ""
      }`}
    >
      {children}
    </button>
  );
}

const X_ICON = (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3">
    <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
  </svg>
);

/* ----------------------------- Общие данные ----------------------------- */

function useProfileData() {
  const profile = useProfile();
  const account = useAccount();
  const watch = watchStore.useStore();
  const titles = useTitles();
  const collectionsRaw = useLocalSnapshot(COLLECTIONS_KEY);
  const favoritesRaw = useLocalSnapshot(FAVORITES_KEY);
  const progress = useProgress();

  const collections = useMemo(() => parseList<Collection>(collectionsRaw, []), [collectionsRaw]);
  const favorites = useMemo(() => parseList<string>(favoritesRaw, []), [favoritesRaw]);

  const stats = useMemo(
    () =>
      collectStats(
        profile,
        watch,
        collections,
        favorites.length,
        isPremiumActive(account),
        account?.createdAt ?? 0,
      ),
    [profile, watch, collections, favorites.length, account],
  );

  const ctx: UnlockContext = {
    level: levelInfo(progress.progress.xpTotal).level,
    premium: isPremiumActive(account),
    claimed: profile.claimed,
    purchased: profile.purchased,
  };

  return { profile, account, watch, titles, collections, favorites, stats, ctx, progress };
}

/* ------------------------------ Основное -------------------------------- */

function PremiumCard({ account }: { account: Account | null }) {
  const premium = isPremiumActive(account);
  const daysLeft = premiumDaysLeft(account);

  if (!premium) {
    return (
      <Panel className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-gold/10 via-transparent to-transparent" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-base font-extrabold text-white">Premium не подключён</p>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-muted">
              Подписка открывает рамки, титулы и расширенный профиль. Оплата в этом демо не производится —
              всё хранится в браузере.
            </p>
          </div>
          <Link href="/premium" className="btn-premium glow-ring rounded-xl px-4 py-2.5 text-sm font-bold">
            Оформить Premium
          </Link>
        </div>
      </Panel>
    );
  }

  return (
    <Panel className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-gold/14 via-transparent to-transparent" />
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gold/15 text-gold ring-1 ring-gold/40">
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="m3 8 4 3 5-6 5 6 4-3-2 11H5L3 8Z" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-extrabold text-gold">Premium активен</p>
              <p className="text-xs text-muted">
                Осталось {daysLeft} дн. · до {formatPremiumUntil(account)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-muted">
            ON
            <span className="relative h-5 w-9 rounded-full bg-gold/70">
              <span className="absolute right-0.5 top-0.5 h-4 w-4 rounded-full bg-white" />
            </span>
          </span>
          <Link href="/premium" className="btn-ghost rounded-xl bg-white/8 px-3.5 py-2.5 text-xs font-bold text-white ring-1 ring-white/12 hover:bg-white/14">
            Управлять
          </Link>
        </div>
      </div>

      <div className="relative mt-4 grid grid-cols-2 gap-2 border-t border-line pt-3 sm:grid-cols-4">
        {[
          ["Рамки", "8 шт."],
          ["Титулы", `${TITLES.filter((i) => i.unlock.premium).length} шт.`],
          ["Фоны", "все пресеты"],
          ["Уровни", "без лимита"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-white/[0.04] px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted">{label}</p>
            <p className="text-xs font-bold text-white">{value}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function LevelCard() {
  const { progress } = useProfileData();
  const info = levelInfo(progress.progress.xpTotal);
  const nextEra = ERAS.find((item) => item.from > info.level);
  const emblemEra = EMBLEM_ERAS[eraOf(info.level)];
  const nextEmblemEra = EMBLEM_ERAS[eraOf(info.level) + 1];

  return (
    <div>
      <div className="card" style={{ "--c": emblemEra.c, "--c2": emblemEra.c2 } as CSSProperties}>
        <LevelEmblem level={info.level} percent={info.percent} size={120} />
        <div className="b">
          <h1>
            {emblemEra.n.toUpperCase()} {info.level}
            <small>{progress.progress.xpTotal.toLocaleString("ru-RU")} XP</small>
            <em>{info.percent}%</em>
          </h1>
          <div className="bar">
            <i style={{ width: `${info.percent}%` }} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="era">
              Эра: {emblemEra.n} · форма: {emblemEra.sh} · ещё {info.left.toLocaleString("ru-RU")} XP до уровня{" "}
              {info.level + 1}
              {nextEmblemEra ? ` · следующая эра «${nextEmblemEra.n}» с ${nextEmblemEra.from} уровня` : ""}
            </div>
            <button
              type="button"
              onClick={() => openProfileDialog("rewards")}
              className="shrink-0 rounded-xl bg-white/8 px-3 py-2 text-[11px] font-bold text-white ring-1 ring-white/12 transition hover:bg-white/14 hover:ring-white/30"
            >
              История XP и AC
            </button>
          </div>
        </div>
      </div>

      <p className="mt-3 max-w-[52ch] text-[11px] leading-relaxed text-muted">
        XP начисляется за достижения, дневные квесты и активность в профиля.
        {!nextEra ? " Высшая эра достигнута — дальше только рекорды." : ""}
      </p>
    </div>
  );
}

function StatsGrid({ stats, go, visible }: { stats: StatsBundle; go: (id: SectionId) => void; visible: boolean }) {
  const cards = useMemo<StatCardItem[]>(
    () => [
      {
        label: "Просмотрено",
        value: Math.floor(stats.minutes / 60),
        icon: "clock",
        color: "#5b7cff",
        color2: "#9a6bff",
        format: fmtHours,
        onClick: () => go("history"),
      },
      {
        label: "Аниме",
        value: stats.titles,
        icon: "tv",
        color: "#1fd6a0",
        color2: "#18a0ff",
        onClick: () => go("favorites"),
      },
      {
        label: "Серий",
        value: stats.episodes,
        icon: "play",
        color: "#38b6e8",
        color2: "#5b7cff",
        onClick: () => go("history"),
      },
      {
        label: "Достижения",
        value: stats.claims,
        icon: "trophy",
        color: "#ffc233",
        color2: "#ff8a1f",
        onClick: () => go("achievements"),
      },
    ],
    [stats.minutes, stats.titles, stats.episodes, stats.claims, go],
  );

  return (
    <div>
      <StatsBlock cards={cards} />
      {!visible && (
        <p className="mt-2 text-[11px] text-muted">Статистика скрыта в приватности — её не видят гости профиля.</p>
      )}
    </div>
  );
}

function MainSection({ account, go }: SectionProps) {
  const { profile, stats } = useProfileData();

  return (
    <div className="space-y-4">
      <PremiumCard account={account} />
      <LevelCard />
      <StatsGrid stats={stats} go={go} visible={profile.privacy.showStats} />

      <Panel>
        <Heading
          right={
            <button
              type="button"
              onClick={() => openProfileDialog("settings")}
              className="text-xs font-bold text-accent-2 transition hover:text-white"
            >
              Настройки
            </button>
          }
        >
          О профиле
        </Heading>
        <p className="text-xs leading-relaxed text-muted">
          Аккаунт, статистика, достижения и косметика хранятся только в этом браузере: сервера и базы данных
          у проекта нет. Пароль сохраняется как баз64-хэш и защищает данные лишь формально.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openProfileDialog("share")}
            className="btn-ghost rounded-xl bg-white/8 px-3.5 py-2 text-xs font-bold text-white ring-1 ring-white/12 hover:bg-white/14"
          >
            Поделиться
          </button>
          <button
            type="button"
            onClick={() => openProfileDialog("preview")}
            className="btn-ghost rounded-xl bg-white/8 px-3.5 py-2 text-xs font-bold text-white ring-1 ring-white/12 hover:bg-white/14"
          >
            Как видят другие
          </button>
        </div>
      </Panel>
    </div>
  );
}

/* ------------------------------- Квесты --------------------------------- */

function QuestsSection({ go }: SectionProps) {
  const { stats, progress } = useProfileData();

  /** Забрать награду квеста — движок сам проверит готовность и выдаст XP/AC */
  const claim = (questId: string) => {
    progressEmit({ type: "QUEST_CLAIMED", questId });
  };

  /**
   * Строка квеста: определение (заголовок/цель/награда) — из конфига,
   * прогресс и отметка «забрано» — из документа прогрессии.
   */
  const questRow = (
    inst: (typeof progress.quests.daily)[number],
    def: (typeof PROGRESSION_CONFIG.quests.dailyPool)[number] | undefined,
  ) => {
    if (!def) return null;
    const target = Math.max(1, def.target);
    const percent = Math.min(100, Math.round((inst.progress / target) * 100));
    const ready = inst.done && !inst.claimed;

    return (
      <li key={inst.questId} className="rounded-xl bg-white/[0.03] px-3.5 py-3 ring-1 ring-white/8">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-white">{def.title}</p>
            <p className="mt-0.5 text-xs text-muted">{def.description}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[11px] font-bold text-accent-2">+{def.xp} XP</p>
            <p className="text-[11px] font-bold text-gold">+{def.ac} AC</p>
          </div>
        </div>

        <div className="mt-2.5 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <Bar percent={percent} tone={inst.claimed ? "gold" : "accent"} />
            <p className="mt-1 text-[11px] text-muted">
              {Math.min(inst.progress, target)} / {target} {def.unit}
            </p>
          </div>
          <button
            type="button"
            disabled={!ready}
            onClick={() => claim(inst.questId)}
            className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
              inst.claimed
                ? "bg-gold/15 text-gold ring-1 ring-gold/40"
                : ready
                  ? "btn-primary text-white"
                  : "bg-white/6 text-muted ring-1 ring-white/10"
            }`}
          >
            {inst.claimed ? "Забрано" : ready ? "Забрать" : "В процессе"}
          </button>
        </div>
      </li>
    );
  };

  const dailyRows = progress.quests.daily.map((inst) =>
    questRow(inst, PROGRESSION_CONFIG.quests.dailyPool.find((q) => q.id === inst.questId)),
  );
  const weeklyRows = progress.quests.weekly.map((inst) =>
    questRow(inst, PROGRESSION_CONFIG.quests.weeklyPool.find((q) => q.id === inst.questId)),
  );
  const claimedCount =
    [...progress.quests.daily, ...progress.quests.weekly].filter((item) => item.claimed).length;

  return (
    <div className="space-y-4">
      <Panel>
        <Heading right={<span className="text-xs font-bold text-gold">Серия: {progress.progress.streakCurrent} дн.</span>}>
          Квесты дня
        </Heading>
        <p className="mb-3 text-xs leading-relaxed text-muted">
          День выбирается из конфига и обнуляется каждый день по вашему часовому поясу. Награда
          забирается вручную — XP и монеты начисляет движок прогрессии.
        </p>
        <ul className="space-y-2.5">{dailyRows}</ul>
      </Panel>

      <Panel>
        <Heading>Квесты недели</Heading>
        <p className="mb-3 text-xs leading-relaxed text-muted">
          Две недельные задачи: прогресс копится за семь дней и не сбрасывается до конца недели.
        </p>
        <ul className="space-y-2.5">{weeklyRows}</ul>
      </Panel>

      <Panel>
        <Heading
          right={
            <button type="button" onClick={() => go("achievements")} className="text-xs font-bold text-accent-2 hover:text-white">
              Все достижения
            </button>
          }
        >
          Достижения дня
        </Heading>
        <div className="flex flex-wrap gap-2 text-xs text-muted">
          <span className="rounded-lg bg-white/6 px-2.5 py-1.5 ring-1 ring-white/10">
            Забрано квестов: {claimedCount}
          </span>
          <span className="rounded-lg bg-white/6 px-2.5 py-1.5 ring-1 ring-white/10">Минут сегодня: {stats.minutesToday}</span>
          <span className="rounded-lg bg-white/6 px-2.5 py-1.5 ring-1 ring-white/10">Серий сегодня: {stats.episodesToday}</span>
        </div>
      </Panel>
    </div>
  );
}

/* ------------------------------- Витрина -------------------------------- */

const MAX_SHOWCASE = 6;

function ShowcaseSection({ go }: SectionProps) {
  const { profile, favorites } = useProfileData();
  const chosen = profile.showcase;
  const available = favorites.filter((id) => !chosen.includes(id));

  return (
    <div className="space-y-4">
      <Panel>
        <Heading right={<span className="text-xs font-bold text-muted">{chosen.length} / {MAX_SHOWCASE}</span>}>
          На витрине
        </Heading>
        {chosen.length === 0 ? (
          <Empty
            title="Витрина пуста"
            hint="Выберите до шести тайтлов из избранного — они будут показаны в верхней части профиля."
          />
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {chosen.map((id) => (
              <AnimeTile
                key={id}
                id={id}
                action={
                  <GhostButton title="Убрать с витрины" onClick={() => toggleShowcase(id)}>
                    {X_ICON}
                  </GhostButton>
                }
              />
            ))}
          </div>
        )}
      </Panel>

      <Panel>
        <Heading
          right={
            <button type="button" onClick={() => go("favorites")} className="text-xs font-bold text-accent-2 hover:text-white">
              Открыть избранное
            </button>
          }
        >
          Добавить на витрину
        </Heading>
        {available.length === 0 ? (
          <Empty title="Выбирать нечего" hint="Сначала добавьте тайтлы в избранное — кнопкой сердца на странице аниме." />
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {available.slice(0, 12).map((id) => (
              <AnimeTile
                key={id}
                id={id}
                action={
                  <GhostButton
                    title="На витрину"
                    onClick={() => {
                      toggleShowcase(id);
                      progressEmit({ type: "PROFILE_FIELD", field: "showcase" });
                    }}
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" d="M12 5v14M5 12h14" />
                    </svg>
                  </GhostButton>
                }
              />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ------------------------------ Любимое --------------------------------- */

function FavoritesSection({ go }: SectionProps) {
  const { favorites } = useProfileData();

  return (
    <Panel>
      <Heading right={<span className="text-xs font-bold text-muted">{favorites.length} тайтлов</span>}>
        Любимое
      </Heading>
      {favorites.length === 0 ? (
        <Empty
          title="В избранном пусто"
          hint="Нажмите сердечко на карточке аниме — оно появится здесь и откроется для витрины и квестов."
        />
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-6">
          {favorites.map((id) => (
            <AnimeTile
              key={id}
              id={id}
              action={
                <GhostButton title="Убрать из избранного" danger onClick={() => toggleFavorite(id)}>
                  {X_ICON}
                </GhostButton>
              }
            />
          ))}
        </div>
      )}
      <div className="mt-4 border-t border-line pt-3">
        <button type="button" onClick={() => go("showcase")} className="text-xs font-bold text-accent-2 hover:text-white">
          Расставить витрину →
        </button>
      </div>
    </Panel>
  );
}

/* ------------------------------ Подборки -------------------------------- */

function CollectionsSection({ go }: SectionProps) {
  const { collections } = useProfileData();
  const titles = useTitles();

  return (
    <div className="space-y-4">
      <Panel>
        <Heading right={<span className="text-xs font-bold text-muted">{collections.length} подборок</span>}>
          Подборки
        </Heading>
        {collections.length === 0 ? (
          <Empty
            title="Подборок пока нет"
            hint="Создайте первую на странице аниме — кнопка «В подборку» рядом с сердечком."
          />
        ) : (
          <ul className="space-y-3">
            {collections.map((collection) => (
              <li key={collection.id} className="rounded-xl bg-white/[0.03] px-3.5 py-3 ring-1 ring-white/8">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">{collection.name}</p>
                    <p className="text-[11px] text-muted">
                      {collection.animeIds.length} тайтл. · {new Date(collection.createdAt).toLocaleDateString("ru-RU")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteCollection(collection.id)}
                    className="shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-rose-300 ring-1 ring-rose-400/30 transition hover:bg-rose-400/10"
                  >
                    Удалить
                  </button>
                </div>

                {collection.animeIds.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {collection.animeIds.slice(0, 12).map((id) => (
                      <Link
                        key={id}
                        href={`/title/${id}`}
                        className="max-w-[10rem] truncate rounded-lg bg-white/8 px-2 py-1 text-[11px] font-semibold text-white/85 ring-1 ring-white/10 transition hover:bg-white/14 hover:text-white"
                      >
                        {titles[id]?.title ?? id}
                      </Link>
                    ))}
                    {collection.animeIds.length > 12 && (
                      <span className="rounded-lg px-2 py-1 text-[11px] text-muted">+{collection.animeIds.length - 12}</span>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <Heading
          right={
            <button type="button" onClick={() => go("favorites")} className="text-xs font-bold text-accent-2 hover:text-white">
              Любимое
            </button>
          }
        >
          Как это работает
        </Heading>
        <p className="text-xs leading-relaxed text-muted">
          Подборки создаются на странице тайтла и хранятся в этом браузере. Несколько подборок могут
          содержать один и тот же тайтл.
        </p>
      </Panel>
    </div>
  );
}

/* ----------------------------- Достижения ------------------------------- */

/** Фильтр по состоянию (§12.2: фильтры + поиск) */
const ACH_STATUS: { id: "all" | AchievementStatus; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "unlocked", label: "Полученные" },
  { id: "progress", label: "В процессе" },
  { id: "locked", label: "Закрытые" },
];

/**
 * Раздел достижений (§12.2) — целиком из конфига прогрессии: ранг и
 * трофейный счёт, сегментная шкала, «Получено X из N», «самое редкое»,
 * сетка со ступенями и редкостью, фильтры+поиск, отдельный блок «Тайные
 * знаки» и модалка с условием/датой. Награды выдаёт движок автоматически
 * при разблокировке — кнопок «Забрать» здесь больше нет.
 */
function AchievementsSection({ go }: { go: (id: SectionId) => void }) {
  const { stats, progress } = useProfileData();
  const [family, setFamily] = useState("all");
  const [status, setStatus] = useState<"all" | AchievementStatus>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  // stats — реактивный триггер внешних сторов (профиль, избранное,
  // подборки): collectMetrics() читает их сам, но пересчёт нужен после
  // каждого их изменения.
  const views = useMemo(
    () => buildAchievements(progress, collectMetrics(), PROGRESSION_CONFIG),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stats как триггер внешних сторов
    [progress, stats],
  );

  const main = views.filter((item) => item.family !== "secret");
  const secrets = views.filter((item) => item.family === "secret");
  const unlockedCount = views.filter((item) => item.status === "unlocked").length;
  const inProgressCount = views.filter((item) => item.status === "progress").length;
  const secretCount = secrets.filter((item) => item.status === "unlocked").length;

  const trophy = progress.progress.trophyPoints;
  const rank = rankAt(trophy);
  const segment = rankSegment(trophy);
  const fills = segmentFills(segment);
  const rare = rarestUnlocked(views, 4);

  const chips = familyChips(views, false);
  const needle = query.trim().toLowerCase();
  const shown = main.filter((item) => {
    if (family !== "all" && item.family !== family) return false;
    if (status !== "all" && item.status !== status) return false;
    if (needle) {
      // неполученные секреты не выдают себя поиском по имени
      if (item.disguised) return false;
      const hay = `${item.def.name} ${item.def.description}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  const open = openId ? (views.find((item) => item.def.id === openId) ?? null) : null;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="space-y-4">
      <Panel>
        <Heading
          right={
            <span className="text-xs font-bold text-muted">
              Получено {unlockedCount} из {views.length}
            </span>
          }
        >
          Достижения
        </Heading>

        {/* Ранг и трофейные очки */}
        <div className="rounded-2xl border border-line bg-white/[0.03] p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-gold/15 px-2 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-gold ring-1 ring-gold/40">
                {rank.name}
              </span>
              <span className="text-xs font-bold text-muted">
                <span className="text-gold">{trophy}</span> трофейных очков
              </span>
            </div>
            <span className="text-[11px] text-muted">
              {rank.next
                ? `До ранга «${rank.next.name}» — ${rankToNext(trophy)} очк.`
                : "Высший ранг достигнут"}
            </span>
          </div>
          <div
            className="mt-2.5 flex gap-1"
            role="progressbar"
            aria-valuenow={segment}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Прогресс ранга: ${segment}%`}
          >
            {fills.map((fill, i) => (
              <span key={i} className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-accent to-accent-2 transition-[width] duration-500"
                  style={{ width: `${fill}%` }}
                />
              </span>
            ))}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl bg-white/[0.04] px-3 py-2.5">
            <p className="text-lg font-black text-white">{unlockedCount}</p>
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted">получено</p>
          </div>
          <div className="rounded-xl bg-white/[0.04] px-3 py-2.5">
            <p className="text-lg font-black text-accent-2">{inProgressCount}</p>
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted">в процессе</p>
          </div>
          <div className="rounded-xl bg-white/[0.04] px-3 py-2.5">
            <p className="text-lg font-black text-gold">{progress.progress.acBalance}</p>
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted">монет</p>
          </div>
          <div className="rounded-xl bg-white/[0.04] px-3 py-2.5">
            <p className="text-lg font-black text-accent-2">{progress.progress.xpTotal}</p>
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted">XP</p>
          </div>
        </div>

        {/* Самое редкое: по редкости и трофеям, без выдуманных процентов */}
        {rare.length > 0 && (
          <div className="mt-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
              Самое редкое
            </p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {rare.map((item) => (
                <button
                  key={item.def.id}
                  type="button"
                  onClick={() => setOpenId(item.def.id)}
                  className="flex items-center gap-2 rounded-xl border border-line bg-white/[0.03] px-2 py-1.5 text-left transition hover:border-accent/50"
                >
                  <AchievementEmblem
                    achievement={{
                      id: item.def.id,
                      name: item.def.name,
                      glyph: emblemMeta(item.def.id).glyph,
                      tier: item.tier,
                      maxTier: emblemMeta(item.def.id).maxTier,
                    }}
                    rarity={emblemMeta(item.def.id).rarity}
                    progress={item.percent}
                    unlocked={item.status === "unlocked"}
                    locked={item.disguised || item.status === "locked"}
                    size={56}
                    animated
                  />
                  <span className="min-w-0">
                    <span className="block max-w-[150px] truncate text-[11px] font-bold text-white">
                      {item.def.name}
                    </span>
                    <span
                      className={`block text-[10px] font-bold ${CFG_RARITY_CLASS[item.def.rarity]}`}
                    >
                      {CFG_RARITY_LABEL[item.def.rarity]}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Поиск и фильтр по состоянию */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск достижения…"
            aria-label="Поиск достижения"
            className="h-9 w-full rounded-xl border border-line bg-white/[0.04] px-3 text-xs text-white placeholder:text-muted focus:border-accent/60 focus:outline-none sm:w-52"
          />
          {ACH_STATUS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setStatus(item.id)}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${
                status === item.id
                  ? "bg-accent-deep text-white"
                  : "bg-white/6 text-muted ring-1 ring-white/10 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Фильтр по семействам */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setFamily("all")}
            className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${
              family === "all"
                ? "bg-accent-deep text-white"
                : "bg-white/6 text-muted ring-1 ring-white/10 hover:text-white"
            }`}
          >
            Все
          </button>
          {chips.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFamily(item.id)}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${
                family === item.id
                  ? "bg-accent-deep text-white"
                  : "bg-white/6 text-muted ring-1 ring-white/10 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </Panel>

      {/* Сетка достижений */}
      {shown.length === 0 ? (
        <Empty title="Ничего не найдено" hint="Измените фильтр или введите другой запрос поиска" />
      ) : (
        <div className="flex flex-col gap-3">
          {shown.map((item) => (
            <button
              key={item.def.id}
              type="button"
              onClick={() => setOpenId(item.def.id)}
              className={`relative rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${
                item.status === "unlocked"
                  ? "border-accent/40 bg-accent/8"
                  : item.status === "progress"
                    ? "border-gold/40 bg-gold/8"
                    : "border-line bg-card/70 hover:border-white/25"
              }`}
            >
              <div className="flex items-start gap-3">
                <AchievementEmblem
                  achievement={{
                    id: item.def.id,
                    name: item.def.name,
                    glyph: emblemMeta(item.def.id).glyph,
                    tier: item.tier,
                    maxTier: emblemMeta(item.def.id).maxTier,
                  }}
                  rarity={emblemMeta(item.def.id).rarity}
                  progress={item.percent}
                  unlocked={item.status === "unlocked"}
                  locked={item.disguised || item.status === "locked"}
                  size={92}
                  animated
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-white">
                        {item.disguised ? "???" : item.def.name}
                      </p>
                      <p className="mt-0.5 text-[11px] font-bold text-muted">
                        {item.familyLabel} · ступень {romanTier(item.tier)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ring-1 ${CFG_RARITY_CLASS[item.def.rarity]}`}
                      >
                        {CFG_RARITY_LABEL[item.def.rarity]}
                      </span>
                      <span className="text-[11px] font-bold text-gold">
                        +{item.def.trophy} очк. · +{item.def.reward.xp} XP · +{item.def.reward.ac} AC
                      </span>
                    </div>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    {item.disguised ? "Тайный знак — условие не подсказывается" : item.def.description}
                  </p>
                  <div className="mt-2.5">
                    {item.status === "unlocked" ? (
                      <p className="text-[11px] font-bold text-mint">
                        Получено {unlockedLabel(item.unlockedAt)} · +{item.def.trophy} очк.
                      </p>
                    ) : (
                      <>
                        <Bar
                          percent={item.percent}
                          tone={item.status === "progress" ? "gold" : "accent"}
                        />
                        <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted">
                          <span>
                            {item.progress} / {item.def.condition.threshold}
                          </span>
                          <span className="font-bold">{item.percent}%</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Тайные знаки: до получения — «???» */}
      <Panel>
        <Heading
          right={
            <span className="text-xs font-bold text-muted">
              {secretCount} / {secrets.length}
            </span>
          }
        >
          Тайные знаки
        </Heading>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {secrets.map((item) => (
            <button
              key={item.def.id}
              type="button"
              onClick={() => setOpenId(item.def.id)}
              className="flex flex-col items-center gap-1.5 rounded-xl border border-line bg-white/[0.03] px-2 py-3 text-center transition hover:border-accent/50"
            >
              <AchievementEmblem
                achievement={{
                  id: item.def.id,
                  name: item.def.name,
                  glyph: emblemMeta(item.def.id).glyph,
                  tier: item.tier,
                  maxTier: emblemMeta(item.def.id).maxTier,
                }}
                rarity={emblemMeta(item.def.id).rarity}
                progress={item.percent}
                unlocked={item.status === "unlocked"}
                locked={item.disguised || item.status === "locked"}
                size={56}
                animated
              />
              <span className="max-w-full truncate text-[11px] font-bold text-white">
                {item.disguised ? "???" : item.def.name}
              </span>
              <span className="text-[10px] text-muted">
                {item.status === "unlocked" ? `+${item.def.trophy} очк.` : "тайный знак"}
              </span>
            </button>
          ))}
        </div>
      </Panel>

      <div className="flex justify-between text-xs text-muted">
        <span>Всего наград доступно: {views.length}</span>
        <button
          type="button"
          onClick={() => go("quests")}
          className="font-bold text-accent-2 hover:text-white"
        >
          Дневные квесты →
        </button>
      </div>

      {open && <AchievementDialog item={open} onClose={() => setOpenId(null)} />}
    </div>
  );
}

/** Модалка достижения: медаль, условие, прогресс, награда, дата (§12.2) */
function AchievementDialog({ item, onClose }: { item: AchievementItem; onClose: () => void }) {
  const def = item.def;
  const rewardTag = def.reward.tagId
    ? PROGRESSION_CONFIG.tags.find((tag) => tag.id === def.reward.tagId)
    : undefined;
  const rewardFrame = def.reward.frameId
    ? FRAMES.find((frame) => frame.id === def.reward.frameId)
    : undefined;
  const rewards = [`+${def.reward.xp} XP`, `+${def.reward.ac} AC`];
  if (rewardTag) rewards.push(`тег «${rewardTag.name}»`);
  if (rewardFrame) rewards.push(`рамка «${rewardFrame.name}»`);

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={item.disguised ? "Тайный знак" : def.name}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/72 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm rounded-2xl border border-line bg-card p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center">
          <AchievementEmblem
            achievement={{
              id: def.id,
              name: def.name,
              glyph: emblemMeta(def.id).glyph,
              tier: item.tier,
              maxTier: emblemMeta(def.id).maxTier,
            }}
            rarity={emblemMeta(def.id).rarity}
            progress={item.percent}
            unlocked={item.status === "unlocked"}
            locked={item.disguised || item.status === "locked"}
            size={230}
            animated
            tilt
          />
          <h2 className="mt-3 text-base font-black text-white">
            {item.disguised ? "???" : def.name}
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5">
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ring-1 ${CFG_RARITY_CLASS[def.rarity]}`}
            >
              {CFG_RARITY_LABEL[def.rarity]}
            </span>
            <span className="rounded-md bg-white/6 px-1.5 py-0.5 text-[10px] font-bold text-muted ring-1 ring-white/10">
              {item.familyLabel} · ступень {romanTier(item.tier)}
            </span>
          </div>

          <div className="mt-3 w-full rounded-xl bg-white/[0.04] p-3 text-left">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Условие</p>
            <p className="mt-0.5 text-xs leading-relaxed text-white">
              {item.disguised ? "Тайный знак — условие не подсказывается" : def.description}
            </p>

            <div
              className="mt-2 font-bold"
              style={{
                color: item.status === "unlocked" ? "#34e08a" : "var(--color-muted)",
              }}
            >
              {item.disguised
                ? "Закрыто"
                : item.status === "unlocked"
                  ? `Получено ${unlockedLabel(item.unlockedAt)}`
                  : item.status === "progress"
                    ? `Выполнено на ${item.percent}%`
                    : "Закрыто"}
            </div>

            <div className="mt-2 flex justify-between text-xs">
              <span className="text-muted">Награда</span>
              <span className="font-bold" style={{ color: "#18c8ff" }}>
                +{def.reward.xp} XP · +{def.reward.ac} AC
              </span>
            </div>
            <div className="mt-1 flex justify-between text-xs">
              <span className="text-muted">Трофеи</span>
              <span className="font-bold" style={{ color: "#ffb02e" }}>
                +{def.trophy}
              </span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-xl bg-white/8 px-4 py-2.5 text-xs font-bold text-white ring-1 ring-white/10 transition hover:bg-white/12"
        >
          Закрыть
        </button>
      </div>
    </div>
  );
}

/* ------------------------------- Магазин -------------------------------- */

/**
 * Витрина в формате каталога (референс animeon.cc/cosmetics): категории
 * со счётчиками, поиск и фильтры редкости с цветными ромбиками, карточки
 * с квадратным превью (тег/титул — капсула `ag-tag` с бегущей рамкой,
 * FIX_TAGS §2) и детальная панель с описанием и блоком «Как получить».
 * Витрина ничего не начисляет сама: покупки и экипировка уходят движку
 * (`progressEmit`) и профилю (`updateProfile`).
 */

type ShopCat = "tags" | "titles" | "backgrounds" | "frames" | "effects" | "services";

const SHOP_CATS: { id: ShopCat; label: string }[] = [
  { id: "tags", label: "Теги" },
  { id: "titles", label: "Титулы" },
  { id: "backgrounds", label: "Фоны" },
  { id: "frames", label: "Рамки" },
  { id: "effects", label: "Эффекты" },
  { id: "services", label: "Сервисы" },
];

/** Цветные ромбики редкости для фильтров и карточек */
const RARITY_DOT: Record<string, string> = {
  COMMON: "#9ca3af",
  UNCOMMON: "#4ade80",
  RARE: "#38bdf8",
  EPIC: "#a78bfa",
  LEGENDARY: "#fbbf24",
  MYTHIC: "#f472b6",
  SECRET: "#e5e7eb",
};

/** Шкала косметики (4) → шкала прогрессии (7) */
const LEGACY_TO_CFG_RARITY: Record<string, string> = {
  common: "COMMON",
  rare: "RARE",
  epic: "EPIC",
  legendary: "LEGENDARY",
};

/** Иконки-превью эффектов и сервисов (ручные, 24×24 stroke) */
const SHOP_ITEM_ICONS: Record<string, string> = {
  "fx-sparks": `<path d="M12 3l1.7 4.6 4.3 1.6-4.3 1.6L12 15.4l-1.7-4.6L6 9.2l4.3-1.6z"/><path d="M18.4 14.6l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9z"/>`,
  "fx-holo": `<rect x="4" y="5" width="16" height="11" rx="2"/><path d="M8 9h8M8 12h5M9.5 19h5"/>`,
  svc_freeze: `<path d="M12 3v18"/><path d="m5 7.5 14 9"/><path d="m19 7.5-14 9"/><path d="M12 3 9.7 5.3M12 3l2.3 2.3M12 21l-2.3-2.3M12 21l2.3-2.3"/>`,
  svc_nick: `<path d="M4 20l1-4L16.6 4.4a2.1 2.1 0 0 1 3 3L8 19z"/><path d="m14.5 6.5 3 3"/>`,
  svc_color: `<path d="M12 3.5a8.5 8.5 0 1 0 0 17h.9a2.6 2.6 0 0 0 0-5.2h-1.4a2 2 0 0 1 0-4H17a4 4 0 0 0 4-4c0-2.4-4-3.8-9-3.8z"/><circle cx="8.2" cy="9.4" r="1.1"/><circle cx="12" cy="7.6" r="1.1"/><circle cx="15.8" cy="9.4" r="1.1"/>`,
};

interface ShopEntry {
  id: string;
  name: string;
  /** редкость в шкале прогрессии (COMMON…SECRET) */
  rarity: string;
  owned: boolean;
  /** экипирован/выбран прямо сейчас (основной) */
  active: boolean;
  /** выбран как дополнительный (мультивыбор) */
  extra?: boolean;
  /** лимит исчерпан (сервисы) */
  complete: boolean;
  /** предмет без лимита (эффекты): кнопка цены остаётся и после покупки */
  unlimited?: boolean;
  heldLabel?: string;
  price?: number;
  tagDef?: TagDef;
  previewCss?: string;
  previewImg?: string;
  backgroundSize?: string;
  description: string;
  obtain: string;
}

export function ShopSection({ title = "Магазин" }: { title?: string } = {}) {
  const { profile, account, ctx, progress } = useProfileData();
  const [message, setMessage] = useState<string | null>(null);
  const [cat, setCat] = useState<ShopCat>("tags");
  const [rarity, setRarity] = useState<string>("any");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const balance = progress.progress.acBalance;
  const dailyAc = PROGRESSION_CONFIG.economy.dailyAcEstimate;
  const shopItem = (id: string) => PROGRESSION_CONFIG.shop.find((item) => item.id === id);
  const heldCount = (id: string) => progress.purchases.filter((item) => item.itemId === id).length;
  const boughtIds = new Set([...progress.purchases.map((item) => item.itemId), ...profile.purchased]);

  /** «Окупаемость»: сколько примерно дней активности нужно на предмет */
  const payback = (price: number) => Math.max(1, Math.ceil(price / Math.max(1, dailyAc)));

  /** Покупка уходит движку: он сверит цену с конфигом и баланс AC */
  const buy = (id: string, name: string) => {
    const item = shopItem(id);
    if (!item) return;
    const res = progressEmit({ type: "SHOP_PURCHASED", itemId: item.id, kind: item.kind, price: item.price });
    if (res.rejected) {
      const reasons: Record<string, string> = {
        insufficient_ac: "Не хватает AC — они копятся за вход, квесты и активность",
        limit_reached: "Лимит этого предмета уже достигнут",
        price_mismatch: "Цена в конфиге изменилась — обновите страницу",
        unknown_item: "Предмет недоступен",
      };
      setMessage(reasons[res.rejected.reason] ?? "Покупка не прошла");
    } else {
      setMessage(`«${name}» куплено за ${item.price} AC`);
    }
  };

  /* ------------------------- Тексты «как получить» ----------------------- */
  const obtainForTag = (tag: (typeof PROGRESSION_CONFIG.tags)[number]): string => {
    if (tag.source === "level") return `Достичь уровня ${tag.level}`;
    if (tag.source === "shop") return `Купить за ${tag.price} AC · ~${payback(tag.price ?? 0)} дн. активности`;
    const ach = PROGRESSION_CONFIG.achievements.find((a) => a.id === tag.achievementId);
    if (!ach || ach.hidden || tag.source === "secret") return "Разгадать секрет AniGalaxy";
    return `Получить достижение «${ach.name}»`;
  };

  const obtainForTitle = (item: (typeof TITLES)[number]): string => {
    if (item.unlock.premium) return "Оформить подписку Premium";
    if (item.unlock.level) return `Достичь уровня ${item.unlock.level}`;
    if (item.unlock.achievement) return "Открыть достижение каталога";
    if (item.unlock.price) return `Купить за ${item.unlock.price} монет`;
    return "Доступно всем";
  };

  const tagSourceChip = (tag: (typeof PROGRESSION_CONFIG.tags)[number]): string => {
    if (tag.source === "level") return `Уровень ${tag.level}`;
    if (tag.source === "shop") return `${tag.price} AC`;
    if (tag.source === "secret") return "Секрет";
    return "Достижение";
  };

  /* ------------------------------ Каталоги ------------------------------ */
  const equippedTagId = progress.progress.equippedTagId;
  const extraTagIds = profile.extraTagIds;
  const extraTitleIds = profile.extraTitleIds;

  const tagEntries: ShopEntry[] = PROGRESSION_CONFIG.tags.map((tag) => ({
    id: tag.id,
    name: tag.name,
    rarity: tag.rarity,
    owned: Boolean(progress.tags[tag.id]),
    active: equippedTagId === tag.id,
    extra: extraTagIds.includes(tag.id),
    complete: false,
    price: tag.source === "shop" ? tag.price : undefined,
    tagDef: tag,
    description: tag.description,
    obtain: obtainForTag(tag),
  }));

  const titleEntries: ShopEntry[] = TITLES.map((item) => ({
    id: item.id,
    name: item.name,
    rarity: LEGACY_TO_CFG_RARITY[item.rarity],
    owned: isUnlocked(item.unlock, ctx),
    active: profile.titleId === item.id,
    extra: extraTitleIds.includes(item.id),
    complete: false,
    tagDef: titleTag(item),
    description: item.description,
    obtain: obtainForTitle(item),
  }));

  const backgroundEntries: ShopEntry[] = BACKGROUNDS.map((item) => {
    const cfg = shopItem(item.id);
    const owned = isOwned(item.id, ctx) || boughtIds.has(item.id);
    return {
      id: item.id,
      name: item.name,
      rarity: LEGACY_TO_CFG_RARITY[item.rarity],
      owned,
      active: profile.backgroundId === item.id && !profile.backgroundCustom,
      complete: false,
      price: owned ? undefined : cfg?.price,
      previewCss: item.css,
      backgroundSize: item.backgroundSize,
      description: "Фон шапки профиля",
      obtain: cfg ? `Купить за ${cfg.price} AC · ~${payback(cfg.price)} дн. активности` : unlockHint(item.unlock),
    };
  });

  const frameEntries: ShopEntry[] = FRAMES.map((item) => {
    const cfg = shopItem(item.id);
    const owned = isOwned(item.id, ctx) || boughtIds.has(item.id);
    return {
      id: item.id,
      name: item.name,
      rarity: LEGACY_TO_CFG_RARITY[item.rarity],
      owned,
      active: profile.frameId === item.id,
      complete: false,
      price: owned ? undefined : cfg?.price,
      previewCss: item.css,
      previewImg: item.img,
      description: "Рамка аватара",
      obtain: cfg ? `Купить за ${cfg.price} AC · ~${payback(cfg.price)} дн. активности` : unlockHint(item.unlock),
    };
  });

  const configEntries = (kind: "effect" | "service"): ShopEntry[] =>
    PROGRESSION_CONFIG.shop.filter((item) => item.kind === kind).map((item) => {
      const held = heldCount(item.id);
      const unlimited = item.maxOwned === undefined;
      const complete = !unlimited && held >= item.maxOwned;
      return {
        id: item.id,
        name: item.name,
        rarity: item.rarity,
        // семантика старого магазина: расходники с большим лимитом
        // (999) не становятся «Куплено» после первой покупки
        owned: held > 0 && (unlimited || complete),
        active: false,
        complete,
        unlimited,
        heldLabel: unlimited ? undefined : `${held} / ${item.maxOwned}`,
        price: complete ? undefined : item.price,
        description: item.description,
        obtain: `Купить за ${item.price} AC · ~${payback(item.price)} дн. активности`,
      };
    });

  const entriesByCat: Record<ShopCat, ShopEntry[]> = {
    tags: tagEntries,
    titles: titleEntries,
    backgrounds: backgroundEntries,
    frames: frameEntries,
    effects: configEntries("effect"),
    services: configEntries("service"),
  };
  const entries = entriesByCat[cat];

  /* -------------------------- Фильтры и выборка -------------------------- */
  const q = query.trim().toLowerCase();
  const filtered = entries.filter(
    (entry) =>
      (rarity === "any" || entry.rarity === rarity) && (!q || entry.name.toLowerCase().includes(q)),
  );
  const rarities = [...new Set(entries.map((entry) => entry.rarity))].sort(
    (a, b) => rarityWeight(a) - rarityWeight(b),
  );
  const selected = filtered.find((entry) => entry.id === selectedId) ?? filtered[0];
  const selIndex = selected ? filtered.indexOf(selected) : -1;

  const switchCat = (next: ShopCat) => {
    setCat(next);
    setRarity("any");
    setQuery("");
    setSelectedId(null);
  };

  const cycle = (dir: number) => {
    if (filtered.length === 0) return;
    const next = (selIndex + dir + filtered.length) % filtered.length;
    setSelectedId(filtered[next].id);
  };

  /* ------------------------------ Действия ------------------------------- */
  const tagSel = useTagSelection();
  const titleSel = useTitleSelection();
  const toggleTag = (id: string) => {
    const tag = PROGRESSION_CONFIG.tags.find((item) => item.id === id);
    if (!tag) return;
    const wasSelected = tagSel.isSelected(id);
    tagSel.toggle(tag);
    setMessage(wasSelected ? "Тег снят" : "Тег выбран");
  };
  const toggleTitle = (id: string) => {
    const item = TITLES.find((t) => t.id === id);
    if (!item) return;
    const wasSelected = titleSel.isSelected(id);
    titleSel.toggle(item, true);
    setMessage(wasSelected ? "Титул снят" : "Титул выбран");
  };

  /* ------------------------------ Превью -------------------------------- */
  const preview = (entry: ShopEntry) => {
    if (entry.tagDef) {
      const c = entry.tagDef.visual.c;
      return (
        <span
          className="flex aspect-[3/2] w-full items-center justify-center overflow-hidden"
          style={{ background: `radial-gradient(130% 100% at 50% 0%, ${c}2e, transparent 62%), #0c0d16` }}
        >
          <AgTag tag={entry.tagDef} size="lg" locked={!entry.owned} />
        </span>
      );
    }
    if (cat === "backgrounds") {
      return (
        <span
          className="block aspect-[3/2] w-full"
          style={{ backgroundImage: entry.previewCss, backgroundSize: entry.backgroundSize ?? "cover", backgroundPosition: "center" }}
        />
      );
    }
    if (cat === "frames") {
      return (
        <span className="flex aspect-[3/2] w-full items-center justify-center bg-[#0c0d16]">
          <AvatarView
            nickname={account?.nickname ?? "Гость"}
            avatar={profile.avatar || undefined}
            frameCss={entry.previewCss}
            frameImg={entry.previewImg}
            className="h-16 w-16"
            textClass="text-lg"
          />
        </span>
      );
    }
    return (
      <span className="flex aspect-[3/2] w-full items-center justify-center bg-[#0c0d16]">
        <svg
          viewBox="0 0 24 24"
          className="h-9 w-9 text-accent-2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: SHOP_ITEM_ICONS[entry.id] ?? "" }}
        />
      </span>
    );
  };

  /** замок/галочка в углу превью */
  const cornerBadge = (entry: ShopEntry) =>
    entry.owned ? (
      <span className="grid h-6 w-6 place-items-center rounded-lg bg-mint/20 text-mint ring-1 ring-mint/40">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3">
          <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 5 5L19 7" />
        </svg>
      </span>
    ) : (
      <span className="grid h-6 w-6 place-items-center rounded-lg bg-black/55 text-white/70 ring-1 ring-white/20">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 1 1 8 0v3" />
        </svg>
      </span>
    );

  /** нижняя строка карточки: источник / цена / статус */
  const bottomChip = (entry: ShopEntry) => {
    if (cat === "tags") {
      const tag = PROGRESSION_CONFIG.tags.find((t) => t.id === entry.id);
      const label = entry.active ? "Экипирован" : entry.extra ? "Выбран ✓" : entry.owned ? "Открыт" : tag ? tagSourceChip(tag) : "";
      return (
        <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ring-1 ${entry.active ? "bg-accent-2/15 text-accent-2 ring-accent-2/40" : entry.extra ? "bg-mint/15 text-mint ring-mint/35" : "bg-white/8 text-muted ring-white/15"}`}>
          {label}
        </span>
      );
    }
    if (cat === "titles") {
      const item = TITLES.find((t) => t.id === entry.id);
      const label = entry.active
        ? "Основной"
        : entry.extra
          ? "Выбран ✓"
          : entry.owned
            ? "Открыт"
            : item?.unlock.premium
              ? "Premium"
              : item?.unlock.level
                ? `Уровень ${item.unlock.level}`
                : "Достижение";
      return (
        <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ring-1 ${entry.active ? "bg-accent-2/15 text-accent-2 ring-accent-2/40" : entry.extra ? "bg-mint/15 text-mint ring-mint/35" : "bg-white/8 text-muted ring-white/15"}`}>
          {label}
        </span>
      );
    }
    if (entry.complete) {
      return <span className="inline-block rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-bold text-white">Лимит</span>;
    }
    if (entry.owned && !entry.unlimited) {
      return <span className="inline-block rounded bg-mint/15 px-1.5 py-0.5 text-[10px] font-bold text-mint ring-1 ring-mint/30">Куплено</span>;
    }
    if (entry.price !== undefined) {
      return (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            buy(entry.id, entry.name);
          }}
          className="btn-primary rounded-lg px-2.5 py-1 text-[11px] font-bold text-white"
        >
          {entry.price} AC
        </button>
      );
    }
    return <span className="inline-block rounded bg-white/6 px-1.5 py-0.5 text-[10px] font-bold text-muted ring-1 ring-white/10">Закрыто</span>;
  };

  /** главное действие детальной панели */
  const panelAction = (entry: ShopEntry) => {
    if (cat === "tags") {
      if (entry.active || entry.extra) {
        return (
          <button type="button" onClick={() => toggleTag(entry.id)} className="w-full rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/16">
            {entry.active ? "Снять" : "Убрать"}
          </button>
        );
      }
      if (entry.owned) {
        return (
          <button type="button" onClick={() => toggleTag(entry.id)} className="btn-primary w-full rounded-xl px-4 py-2.5 text-sm font-bold text-white">
            Экипировать
          </button>
        );
      }
      if (entry.price !== undefined) {
        return (
          <button type="button" disabled={balance < entry.price} onClick={() => buy(entry.id, entry.name)} className="btn-primary w-full rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45">
            Купить {entry.price} AC
          </button>
        );
      }
      return <span className="block rounded-xl bg-white/6 px-4 py-2.5 text-center text-xs font-bold text-muted ring-1 ring-white/10">Не получен</span>;
    }
    if (cat === "titles") {
      if (entry.active || entry.extra) {
        return (
          <button type="button" onClick={() => toggleTitle(entry.id)} className="w-full rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/16">
            {entry.active ? "Снять" : "Убрать"}
          </button>
        );
      }
      if (entry.owned) {
        return (
          <button type="button" onClick={() => toggleTitle(entry.id)} className="btn-primary w-full rounded-xl px-4 py-2.5 text-sm font-bold text-white">
            Выбрать
          </button>
        );
      }
      return <span className="block rounded-xl bg-white/6 px-4 py-2.5 text-center text-xs font-bold text-muted ring-1 ring-white/10">Закрыто</span>;
    }
    if (cat === "backgrounds" || cat === "frames") {
      if (entry.owned) {
        return (
          <button
            type="button"
            onClick={() => {
              if (cat === "backgrounds") updateProfile({ backgroundId: entry.id, backgroundCustom: "" });
              else updateProfile({ frameId: entry.id });
              setMessage(`«${entry.name}» применён`);
            }}
            className="btn-primary w-full rounded-xl px-4 py-2.5 text-sm font-bold text-white"
          >
            Применить
          </button>
        );
      }
      if (entry.price !== undefined) {
        return (
          <button type="button" disabled={balance < entry.price} onClick={() => buy(entry.id, entry.name)} className="btn-primary w-full rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45">
            Купить {entry.price} AC
          </button>
        );
      }
      return <span className="block rounded-xl bg-white/6 px-4 py-2.5 text-center text-xs font-bold text-muted ring-1 ring-white/10">Закрыто</span>;
    }
    if (entry.complete) {
      return <span className="block rounded-xl bg-accent/20 px-4 py-2.5 text-center text-xs font-bold text-white">Лимит исчерпан</span>;
    }
    if (entry.price !== undefined) {
      return (
        <button type="button" disabled={balance < entry.price} onClick={() => buy(entry.id, entry.name)} className="btn-primary w-full rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45">
          Купить {entry.price} AC
        </button>
      );
    }
    return null;
  };

  const ownedInCat = entries.filter((entry) => entry.owned).length;

  return (
    <div className="space-y-4">
      <Panel>
        <Heading
          accent
          right={
            <span className="bg-gradient-to-r from-accent-2 to-accent bg-clip-text text-sm font-black text-transparent">
              {balance} AC
            </span>
          }
        >
          {title}
        </Heading>
        {message && <p className="text-xs text-mint">{message}</p>}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[264px_minmax(0,1fr)]">
        {/* -------------------- Сайдбар: Касса и разделы -------------------- */}
        {/* min-w-0 обязателен: лента разделов магазина — горизонтальный
            скролл, её min-content равен сумме шести пилюль по 190px. Без
            min-w-0 колонка грида не сжимается, и страница уезжает вбок. */}
        <div className="min-w-0 space-y-4">
          <Panel>
            <Heading accent>Касса</Heading>
            <p className="bg-gradient-to-r from-accent-2 to-accent bg-clip-text text-2xl font-black text-transparent">
              {balance} AC
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              ≈ {dailyAc} AC за день активности: ежедневный вход, квесты и просмотры пополняют кассу.
            </p>
          </Panel>

          <Panel>
            <Heading accent>Разделы магазина</Heading>
            <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
              {SHOP_CATS.map((item) => {
                const all = entriesByCat[item.id];
                const ownedCount = all.filter((entry) => entry.owned).length;
                const active = cat === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => switchCat(item.id)}
                    aria-pressed={active}
                    className={`flex min-w-[190px] shrink-0 items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-left text-sm font-bold transition-colors duration-200 lg:min-w-0 ${
                      active
                        ? "bg-white/[0.07] text-white ring-1 ring-white/10"
                        : "text-muted hover:bg-white/[0.04] hover:text-white"
                    }`}
                  >
                    <span>{item.label}</span>
                    <span className="text-[11px] opacity-70">
                      {ownedCount}/{all.length}
                    </span>
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel>
            <Heading accent>Как это работает</Heading>
            <ul className="space-y-1.5 text-xs leading-relaxed text-muted">
              <li>• AC копятся за ежедневный вход, квесты и активность — и тратятся на предметы.</li>
              <li>• Титулы и теги за уровни, подписку и достижения открываются сами, покупать их не нужно.</li>
              <li>• «Лимит» на карточке — запас предмета исчерпан.</li>
            </ul>
          </Panel>
        </div>

        {/* ---------------------------- Каталог ----------------------------- */}
        <div className="min-w-0">
          <Panel>
            <div className="flex flex-wrap items-center gap-2">
          <div className="relative ml-auto min-w-0 flex-1 sm:flex-none">
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" d="m20 20-3.5-3.5" />
            </svg>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по магазину…"
              className="w-full rounded-xl bg-white/6 py-2 pl-9 pr-3 text-xs font-semibold text-white ring-1 ring-white/10 transition placeholder:text-muted/70 focus:outline-none focus:ring-accent/60 sm:w-56"
            />
          </div>
        </div>

        {/* Фильтры редкости */}
        <div className="mt-3 flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setRarity("any")}
            className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${rarity === "any" ? "bg-white/15 text-white" : "text-muted hover:text-white"}`}
          >
            Любая
          </button>
          {rarities.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRarity(r)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${rarity === r ? "bg-white/15 text-white" : "text-muted hover:text-white"}`}
            >
              <span className="inline-block h-1.5 w-1.5 rotate-45 rounded-[1px]" style={{ background: RARITY_DOT[r] ?? "#9ca3af" }} />
              {CFG_RARITY_LABEL[r] ?? r}
            </button>
          ))}
        </div>

        {/* Детальная панель — горизонтальная, над сеткой (колонка профиля узкая) */}
        {selected && (
          <aside className="mt-4 rounded-2xl border border-line bg-surface/80 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
                {SHOP_CATS.find((c) => c.id === cat)?.label}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Предыдущий"
                  onClick={() => cycle(-1)}
                  className="grid h-6 w-6 place-items-center rounded-md bg-white/8 text-white ring-1 ring-white/12 transition hover:bg-white/15"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="m14 6-6 6 6 6" /></svg>
                </button>
                <span className="min-w-12 text-center text-[11px] font-bold text-muted">{selIndex + 1} / {filtered.length}</span>
                <button
                  type="button"
                  aria-label="Следующий"
                  onClick={() => cycle(1)}
                  className="grid h-6 w-6 place-items-center rounded-md bg-white/8 text-white ring-1 ring-white/12 transition hover:bg-white/15"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="m10 6 6 6-6 6" /></svg>
                </button>
              </div>
            </div>

            <div className="mt-3 sm:flex sm:items-start sm:gap-4">
              <div className="overflow-hidden rounded-xl ring-1 ring-white/10 sm:w-60 sm:shrink-0">{preview(selected)}</div>
              <div className="mt-3 min-w-0 flex-1 sm:mt-0">
                <p className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: RARITY_DOT[selected.rarity] ?? "#9ca3af" }}>
                  <span className="inline-block h-1.5 w-1.5 rotate-45 rounded-[1px]" style={{ background: RARITY_DOT[selected.rarity] ?? "#9ca3af" }} />
                  {CFG_RARITY_LABEL[selected.rarity] ?? selected.rarity}
                </p>
                <p className="mt-1 text-lg font-black uppercase tracking-wide text-white">{selected.name}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">{selected.description}</p>
                {selected.tagDef && <p className="mt-1 text-[11px] font-semibold text-muted">Появится рядом с ником</p>}

                <div className="mt-3 rounded-xl bg-white/[0.04] px-3 py-2.5 ring-1 ring-white/10">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Как получить</p>
                  <p className="mt-0.5 text-xs font-bold leading-relaxed text-white">{selected.obtain}</p>
                </div>

                <div className="mt-3 sm:max-w-64">{panelAction(selected)}</div>
              </div>
            </div>
          </aside>
        )}

        {/* Карточки */}
        {filtered.length === 0 ? (
          <Empty title="Ничего не найдено" hint="Попробуйте другую редкость или сотрите запрос" />
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 min-[700px]:grid-cols-3">
            {filtered.map((entry) => (
              <div
                key={entry.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedId(entry.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") setSelectedId(entry.id);
                }}
                className={`cursor-pointer overflow-hidden rounded-2xl bg-white/[0.03] ring-1 transition ${
                  selected?.id === entry.id ? "ring-2 ring-accent-2" : "ring-white/10 hover:ring-white/30"
                }`}
              >
                <div className="relative">
                  {preview(entry)}
                  <span className="absolute right-2 top-2">{cornerBadge(entry)}</span>
                </div>
                <div className="px-3 py-2.5">
                  <p className="truncate text-[13px] font-black uppercase tracking-wide text-white">{entry.name}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-[11px] font-bold" style={{ color: RARITY_DOT[entry.rarity] ?? "#9ca3af" }}>
                    <span className="inline-block h-1.5 w-1.5 rotate-45 rounded-[1px]" style={{ background: RARITY_DOT[entry.rarity] ?? "#9ca3af" }} />
                    {CFG_RARITY_LABEL[entry.rarity] ?? entry.rarity}
                    {entry.heldLabel && <span className="text-muted">· {entry.heldLabel}</span>}
                  </p>
                  <div className="mt-2">{bottomChip(entry)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

            <p className="mt-3 text-[11px] text-muted">
              В категории открыто {ownedInCat} из {entries.length}. Клик по карточке — описание и путь
              открытия в панели выше.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- Подарки -------------------------------- */

function GiftsSection() {
  const { profile } = useProfileData();
  const pending = profile.gifts.filter((gift) => !gift.claimed);
  const taken = profile.gifts.filter((gift) => gift.claimed);

  return (
    <div className="space-y-4">
      <Panel>
        <Heading right={<span className="text-xs font-bold text-muted">{pending.length} ждут</span>}>
          Подарки
        </Heading>
        {profile.gifts.length === 0 ? (
          <Empty
            title="Подарков пока нет"
            hint="Подарки падают за новые уровни и за события в профиле. Забирайте их здесь — внутри монеты."
          />
        ) : (
          <ul className="space-y-2.5">
            {profile.gifts.map((gift) => (
              <li key={gift.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3.5 py-3 ring-1 ring-white/8">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">{gift.name}</p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {gift.hint} · {timeAgo(gift.at)}
                  </p>
                </div>
                {gift.claimed ? (
                  <span className="shrink-0 rounded-lg bg-white/6 px-2.5 py-1.5 text-[11px] font-bold text-muted ring-1 ring-white/10">
                    Забрано
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      claimGift(gift.id);
                      // монеты подарка → баланс AC сразу, без перезагрузки
                      syncLegacyDelta();
                    }}
                    className="btn-primary shrink-0 rounded-lg px-3 py-2 text-[11px] font-bold text-white"
                  >
                    Забрать +{gift.coins}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {taken.length > 0 && (
        <Panel>
          <Heading>Уже забрано</Heading>
          <div className="flex flex-wrap gap-2 text-[11px] text-muted">
            {taken.map((gift) => (
              <span key={gift.id} className="rounded-lg bg-white/6 px-2.5 py-1.5 ring-1 ring-white/10">
                {gift.name} · +{gift.coins}
              </span>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

/* ------------------------------- История -------------------------------- */

function HistorySection() {
  const { watch, stats } = useProfileData();

  return (
    <div className="space-y-4">
      <Panel>
        <Heading
          right={
            watch.records.length > 0 ? (
              <button
                type="button"
                onClick={clearWatchHistory}
                className="text-[11px] font-bold text-rose-300 transition hover:text-white"
              >
                Очистить
              </button>
            ) : undefined
          }
        >
          История просмотра
        </Heading>

        <div className="mb-3 flex flex-wrap gap-2 text-[11px] text-muted">
          <span className="rounded-lg bg-white/6 px-2.5 py-1.5 ring-1 ring-white/10">{stats.minutes} мин у плеера</span>
          <span className="rounded-lg bg-white/6 px-2.5 py-1.5 ring-1 ring-white/10">{stats.titles} тайтлов</span>
          <span className="rounded-lg bg-white/6 px-2.5 py-1.5 ring-1 ring-white/10">{watch.records.length} записей</span>
        </div>

        {watch.records.length === 0 ? (
          <Empty title="История пуста" hint="Открытые серии появятся здесь автоматически — вместе с таймером присутствия у плеера." />
        ) : (
          <ul className="space-y-2">
            {watch.records.slice(0, 40).map((record) => (
              <li
                key={`${record.id}-${record.season}-${record.episode}`}
                className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5 ring-1 ring-white/8"
              >
                <span className="relative block h-11 w-9 shrink-0 overflow-hidden rounded-md bg-gradient-to-br from-accent/40 to-accent-2/25">
                  <Poster src={record.poster} alt={record.title} title={record.title} sizes="36px" className="object-cover" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white">{record.title}</p>
                  <p className="text-[11px] text-muted">
                    Сезон {record.season} · Серия {record.episode} · {timeAgo(record.at)}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/title/${record.id}`}
                    className="rounded-lg bg-white/8 px-2.5 py-1.5 text-[11px] font-bold text-white ring-1 ring-white/10 transition hover:bg-white/14"
                  >
                    Продолжить
                  </Link>
                  <GhostButton title="Убрать запись" danger onClick={() => removeWatch(record.id, record.episode, record.season)}>
                    {X_ICON}
                  </GhostButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

/* ----------------------------- Комментарии ------------------------------ */

/**
 * Стена профиля оформлена единым блоком комментариев (`CommentsBlock`):
 * тот же вид, что на странице тайтла, — заголовок со счётчиком,
 * сортировка, композер со спойлером, карточки с бейджем уровня, тегом,
 * голосами и ответами.
 */
function CommentsSection() {
  return <CommentsBlock scope={PROFILE_SCOPE} />;
}

/* ---------------------------- Чёрный список ----------------------------- */

function BlacklistSection() {
  const { profile } = useProfileData();
  const [draft, setDraft] = useState("");

  const add = () => {
    addBlocked(draft);
    setDraft("");
  };

  return (
    <Panel>
      <Heading right={<span className="text-xs font-bold text-muted">{profile.blacklist.length}</span>}>
        Чёрный список
      </Heading>

      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && add()}
          placeholder="Никнейм пользователя"
          className="min-w-0 flex-1 rounded-xl bg-card px-3 py-2.5 text-sm text-white ring-1 ring-white/10 placeholder:text-muted/60 focus:outline-none focus:ring-accent/60"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="btn-primary shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-45"
        >
          Добавить
        </button>
      </div>

      {profile.blacklist.length === 0 ? (
        <div className="mt-3">
          <Empty title="Список пуст" hint="Добавьте ник — он останется в этом браузере и будет подсвечен в интерфейсе." />
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {profile.blacklist.map((name) => (
            <li key={name} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3.5 py-2.5 ring-1 ring-white/8">
              <span className="flex min-w-0 items-center gap-2.5">
                <AvatarView nickname={name} className="h-8 w-8" textClass="text-xs" />
                <span className="truncate text-sm font-bold text-white">{name}</span>
              </span>
              <button
                type="button"
                onClick={() => removeBlocked(name)}
                className="shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-rose-300 ring-1 ring-rose-400/30 transition hover:bg-rose-400/10"
              >
                Убрать
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        Фильтрация комментариев других пользователей недоступна: комментарии других людей на сайте нет —
        это локальная демонстрация списка.
      </p>
    </Panel>
  );
}

/* --------------------------- Пригласи друзей ---------------------------- */

function ReferralsSection({ account }: SectionProps) {
  const [copied, setCopied] = useState<boolean | null>(null);

  const code = useMemo(() => {
    const base = (account?.nickname ?? "guest").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    const tail = (account?.createdAt ?? 0).toString(36).toUpperCase().slice(-4);
    return `${base}${tail}` || "ANIGALAXY";
  }, [account]);

  const link = `${typeof window === "undefined" ? "" : window.location.origin}/?ref=${code}`;

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }, [link]);

  return (
    <div className="space-y-4">
      <Panel>
        <Heading right={<span className="text-xs font-bold text-gold">{code}</span>}>
          Пригласи друзей
        </Heading>
        <p className="text-xs leading-relaxed text-muted">
          Ссылка с вашим кодом. Референсный проект начисляет за приглашения монеты и достижения — здесь
          счётчика пришедших гостей нет, потому что аккаунты других людей никуда не отправляются.
        </p>

        <div className="mt-3 flex gap-2">
          <input
            readOnly
            value={link}
            onFocus={(event) => event.target.select()}
            className="min-w-0 flex-1 rounded-xl bg-card px-3 py-2.5 font-mono text-xs text-white ring-1 ring-white/10 focus:outline-none"
          />
          <button type="button" onClick={() => void copy()} className="btn-primary shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold text-white">
            Копировать
          </button>
        </div>

        {copied === true && <p className="mt-2 text-xs text-mint">Ссылка скопирована</p>}
        {copied === false && <p className="mt-2 text-xs text-rose-300">Скопировать не удалось — выделите ссылку вручную</p>}
      </Panel>

      <Panel>
        <Heading>Статистика приглашений</Heading>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "пришло", value: 0 },
            { label: "подтвердили", value: 0 },
            { label: "монет получено", value: 0 },
          ].map((item) => (
            <div key={item.label} className="rounded-xl bg-white/[0.04] px-3 py-2.5 text-center">
              <p className="text-lg font-black text-white">{item.value}</p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted">{item.label}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

/* ----------------------------- Уведомления ------------------------------ */

function NoticesSection() {
  const { profile } = useProfileData();

  return (
    <Panel>
      <Heading
        right={
          unreadCount(profile) > 0 ? (
            <button type="button" onClick={markNoticesRead} className="text-[11px] font-bold text-accent-2 hover:text-white">
              Прочитать все
            </button>
          ) : undefined
        }
      >
        Уведомления
      </Heading>

      {profile.notices.length === 0 ? (
        <Empty title="Пока тихо" hint="Здесь появятся новые уровни, подарки и отметки о наградах." />
      ) : (
        <ul className="space-y-2">
          {profile.notices.map((notice) => (
            <li
              key={notice.id}
              className={`flex items-start gap-3 rounded-xl px-3.5 py-3 ring-1 ${
                notice.read ? "bg-white/[0.02] ring-white/8" : "bg-accent/10 ring-accent/35"
              }`}
            >
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notice.read ? "bg-white/25" : "bg-accent-2"}`} />
              <div className="min-w-0">
                <p className="text-sm leading-relaxed text-white/90">{notice.text}</p>
                <p className="mt-0.5 text-[11px] text-muted">{timeAgo(notice.at)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ------------------------------ Маршрутизация --------------------------- */

export function ProfileSection({ section, account, go }: SectionProps & { section: SectionId }) {
  switch (section) {
    case "quests":
      return <QuestsSection account={account} go={go} />;
    case "showcase":
      return <ShowcaseSection account={account} go={go} />;
    case "favorites":
      return <FavoritesSection account={account} go={go} />;
    case "collections":
      return <CollectionsSection account={account} go={go} />;
    case "achievements":
      return <AchievementsWithGo go={go} />;
    case "shop":
      /* В меню профиля пункт «Магазин» — ссылка на /store, поэтому во
         вкладку эту сюда попасть нельзя. Вкладка осталась запасным
         вариантом для прямой ссылки вида ?tab=shop. */
      return <ShopSection />;
    case "gifts":
      return <GiftsSection />;
    case "history":
      return <HistorySection />;
    case "comments":
      return <CommentsSection />;
    case "blacklist":
      return <BlacklistSection />;
    case "referrals":
      return <ReferralsSection account={account} go={go} />;
    case "notices":
      return <NoticesSection />;
    default:
      return <MainSection account={account} go={go} />;
  }
}

function AchievementsWithGo({ go }: { go: (id: SectionId) => void }) {
  return <AchievementsSection go={go} />;
}
