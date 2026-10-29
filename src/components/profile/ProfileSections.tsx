"use client";

import { PSelect } from "@/components/PSelect";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { COLLECTIONS_KEY, FAVORITES_KEY, deleteCollection, toggleFavorite, type Collection } from "@/lib/collections";
import { displayNameOf, formatPremiumUntil, isPremiumActive, premiumDaysLeft, type Account } from "@/lib/auth";
import { parseList, useLocalSnapshot } from "@/lib/use-local-storage";
import { useHydrated } from "@/lib/use-hydrated";
import { useAccount } from "@/lib/use-account";
import {
  addBlocked,
  markNoticesRead,
  removeBlocked,
  unreadCount,
  updateProfile,
  useProfile,
} from "@/lib/profile";
import { absoluteRefLink, refCodeFor, referralCount, refLink, useReferralState, useReferrer } from "@/lib/referrals";
import { REFERRAL_DAYS_PER_FRIEND, REFERRAL_RULES, REFERRAL_WELCOME } from "@/lib/referral-rules";
import { clearWatchHistory, removeWatch, timeAgo, watchStore } from "@/lib/history";
import { progressEmit, useLevelInfo, useProgress } from "@/lib/progression/events";
import { collectMetrics } from "@/lib/progression/service";
import { PROGRESSION_CONFIG } from "@/lib/progression/progression.config";
import { BATTLEPASS, BP_MISSIONS } from "@/lib/battlepass/config";
import { bpCost, bpLevelFromXp, bpTotalFor } from "@/lib/battlepass/logic";
import { PREMIUM_QUEST_MULT } from "@/lib/premium-perks";
import {
  buildAchievements,
  familyChips,
  rarestUnlocked,
  unlockedLabel,
  type AchievementItem,
  type AchievementStatus,
} from "@/lib/progression/achievements-view";
import { rarityWeight, romanTier } from "@/lib/progression/visual";
import { AchievementCode } from "@/components/progression/AchievementCode";
import { useTagSelection, useTitleSelection } from "@/lib/selection";
import type { TagDef } from "@/lib/progression/types";
import { ProfileMini } from "@/components/battlepass/ProfilePreview";
import { AgTag } from "@/components/progression/AgTag";
import { CFG_RARITY_CLASS, CFG_RARITY_LABEL } from "@/lib/progression/rarity-chips";
import { DEAL_PERCENT, dailyDeal, dayIndex } from "@/lib/progression/deals";
import { ERAS, levelInfo } from "@/lib/levels";
import { collectStats } from "@/lib/achievements";
import {
  BACKGROUNDS,
  FRAMES,
  PROFILE_DECORS,
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
import { AvatarFrame, type AvSize } from "@/components/profile/AvatarFrame";
import { AchievementEmblem } from "@/components/progression/AchievementEmblem";
import { LevelBadge, ERA_THEME, eraIndex } from "@/components/levels/LevelBadge";
import { emblemMeta } from "@/lib/progression/achievements.config";
import { AchievementsGallery, badgeRarity } from "@/components/progression/AchievementsGallery";
import { AchievementBadge } from "@/components/progression/AchievementBadges";
import type { CSSProperties } from "react";
import { CommentsBlock, PROFILE_SCOPE } from "@/components/comments/CommentsBlock";
import { AvatarView } from "./AvatarView";
import { NickName } from "./NickName";
import { NickColorDialog, NicknameDialog } from "./NickServicesDialogs";
import { WidgetsPanel } from "./WidgetsPanel";
import { WidgetShowcase } from "@/components/WidgetShowcase";
import { WidgetIcon } from "./WidgetIcon";
import { AchievementsWidget } from "./Widgets";
import { PremiumChip } from "@/components/profile/PremiumChip";

export type SectionId =
  | "main"
  | "quests"
  | "showcase"
  | "favorites"
  | "collections"
  | "achievements"
  | "shop"
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
   * Пункт живёт по своему адресу, но в меню профиля не показывается.
   *
   * Так сделано с Квестами, Магазином, «Пригласи друзей» и Уведомлениями:
   * в боковом меню их нет, но разделы работают — на них ведут ссылки из меню
   * шапки, чип «Квесты дня» и кнопки в магазине. Убрать их из списка совсем
   * нельзя: ProfileView проверяет `?tab=` по этому же массиву, и прямая
   * ссылка молча упала бы на «Основное».
   */
  hidden?: boolean;
  /** Пометка NEW в меню */
  fresh?: boolean;
  /**
   * Внешний раздел. Если задан — пункт рендерится ссылкой и уводит на
   * отдельную страницу, а не переключает вкладку профиля. Так сделан
   * магазин: внутри профиля он жил отдельной вкладкой и выглядел иначе,
   * чем /store, хотя каталог был тот же. Теперь это один и тот же магазин.
   */
  href?: string;
}

/** Пункты меню профиля: порядок как в макете + разделы без сервера */
export const SECTIONS: SectionMeta[] = [
  { id: "main", label: "Основное" },
  { id: "showcase", label: "Виджеты", fresh: true },
  { id: "favorites", label: "Любимое" },
  { id: "collections", label: "Подборки", hidden: true },
  { id: "achievements", label: "Достижения" },
  { id: "history", label: "История", hidden: true },
  { id: "comments", label: "Комментарии" },
  { id: "blacklist", label: "Чёрный список" },
  // Живые разделы, скрытые из меню профиля: см. SectionMeta.hidden
  { id: "quests", label: "Квесты", badge: "quests", hidden: true },
  { id: "shop", label: "Магазин", href: "/store", hidden: true },
  { id: "referrals", label: "Пригласи друзей", hidden: true },
  { id: "notices", label: "Уведомления", badge: "notices", hidden: true },
];

/** Что показывать в боковом меню профиля */
export const VISIBLE_SECTIONS: SectionMeta[] = SECTIONS.filter((item) => !item.hidden);

export interface SectionProps {
  account: Account | null;
  go: (id: SectionId) => void;
  /**
   * Режим просмотра. Гостю (`/u/me`) блок Premium не показывается: это
   * управление подпиской — срок, переключатель и кнопка «Управлять», —
   * то есть ровно то, что гость не должен ни видеть, ни нажимать.
   */
  mode?: "owner" | "guest";
}

/** Отдельной странице переходы по вкладкам не нужны — `go` там опционален */
export type StandaloneSectionProps = Pick<SectionProps, "account"> & {
  go?: SectionProps["go"];
};

/* --------------------------- Общие фрагменты ---------------------------- */

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  // `ag-card` — карточка темы макетов. Имя не `card`: в level-emblem.css есть
  // глобальный `.card{display:flex}`, и панели получали flex-строку
  return <div className={`ag-card p-4 sm:p-5 ${className}`}>{children}</div>;
}

function Heading({
  children,
  right,
  accent = false,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
  /** Заголовок в акцентном шрифте (--font-display) — как на эталоне */
  accent?: boolean;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      {/* Внутри .ag-root оформление задаёт ag-h3 из ag-theme.css — он
          специфичнее хвостовых классов. Вне .ag-root (например, в /store)
          ag-h3 не применяется, и заголовок остаётся прежним: поэтому
          хвостовые классы оставлены, а не выброшены. */}
      <h2 className={`ag-h3 ${accent ? "font-accent" : "font-sans"} text-sm font-extrabold uppercase tracking-[0.16em] text-muted`}>
        {children}
      </h2>
      {right}
    </div>
  );
}

function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="ag-empty">
      <p>{title}</p>
      {hint && <small>{hint}</small>}
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
          tone === "gold" ? "bg-gradient-to-r from-accent-2/70 to-accent-2" : "bg-gradient-to-r from-accent to-accent-2"
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
    referrals: referralCount(),
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
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent-2/10 via-transparent to-transparent" />
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
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-2/15 text-accent-2 ring-1 ring-accent-2/40">
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="m3 8 4 3 5-6 5 6 4-3-2 11H5L3 8Z" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-extrabold text-accent-2">Premium активен</p>
              <p className="text-xs text-muted">
                Осталось {daysLeft} дн. · до {formatPremiumUntil(account)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-muted">
            ON
            <span className="relative h-5 w-9 rounded-full bg-accent-2/70">
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

/**
 * Блок уровня: эмблема, название эры, XP, полоса прогресса и кнопка
 * «История XP и AC».
 *
 * Экспортируется, потому что предпросмотр профиля показывает ровно этот
 * блок после покупки услуги «Эмблема уровня в профиле». Дублировать
 * разметку было бы верхом: разъехались бы и отступы, и формулировки.
 */
export function LevelCard() {
  const { progress } = useProfileData();
  const info = levelInfo(progress.progress.xpTotal);
  const nextEra = ERAS.find((item) => item.from > info.level);
  const ei = eraIndex(info.level);
  const emblemEra = { ...ERA_THEME[ei], n: ERAS[ei]?.name ?? info.era };
  const nextEmblemEra = ERAS[ei + 1];

  return (
    <div>
      <div className="card" style={{ "--c": emblemEra.c1, "--c2": emblemEra.c2 } as CSSProperties}>
        <LevelBadge level={info.level} size={124} state="current" rich />
        <div className="b">
          {/* h2, а не h1: заголовком страницы остаётся ник, а эмблема
              уровня — содержимое внутри карточки. Два h1 на странице
              размывали структуру документа для скринридера и SEO. */}
          <h2>
            {emblemEra.n.toUpperCase()} {info.level}
            <small>{progress.progress.xpTotal.toLocaleString("ru-RU")} XP</small>
            <em>{info.percent}%</em>
          </h2>
          <div className="bar">
            <i style={{ width: `${info.percent}%` }} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="era">
              Пробуждение: {emblemEra.n} · ещё {info.left.toLocaleString("ru-RU")} XP до уровня{" "}
              {info.level + 1}
              {nextEmblemEra ? ` · следующее пробуждение «${nextEmblemEra.name}» с ${nextEmblemEra.from} уровня` : ""}
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

      {!nextEra && (
        <p className="mt-3 max-w-[52ch] text-[11px] leading-relaxed text-muted">
          Высшее пробуждение достигнуто — дальше только рекорды.
        </p>
      )}
    </div>
  );
}


/**
 * Витрина достижений прямо на странице профиля.
 *
 * В референсе (кибер-образец) достижения лежат в общем потоке профиля —
 * рядом со статистикой и боевым пасом, — а не за отдельной вкладкой: гость
 * должен видеть их, не нажимая ничего. Здесь только четыре самых редких
 * полученных и ссылка на полный раздел; сам полный раздел живёт там же,
 * куда ведёт кнопка.
 *
 * Строки «есть у 0,0 %» из референса не переносим: доля других
 * пользователей в режиме local неизвестна (то же правило, что и в
 * `rarestUnlocked`). Вместо неё — реальные ступень семейства и редкость.
 */
export function AchievementsStrip({
  go,
  bare = false,
}: {
  go: (id: SectionId) => void;
  /**
   * Без своей карточки и заголовка — так блок становится содержимым виджета
   * «Достижения» на витрине, где заголовок уже нарисован самой ячейкой.
   */
  bare?: boolean;
}) {
  const { stats, progress } = useProfileData();
  const views = useMemo(
    () => buildAchievements(progress, collectMetrics(), PROGRESSION_CONFIG),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stats как триггер внешних сторов
    [progress, stats],
  );

  const unlocked = views.filter((item) => item.status === "unlocked");
  const rare = rarestUnlocked(views, 4);
  /**
   * Витрина всегда из четырёх карточек: самые редкие полученные идут
   * первыми, а на свежем аккаунте, где получено одно-два достижения,
   * оставшиеся места добираем следующими по редкости — иначе блок
   * вырождался бы в одну узкую карточку.
   */
  const shown =
    rare.length >= 4
      ? rare
      : [...rare, ...views.filter((item) => !rare.includes(item))].slice(0, 4);

  /** Сетка карточек — общая и для карточки, и для виджета */
  const cards = (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {shown.map((item) => (
          <button
            key={item.def.id}
            type="button"
            onClick={() => go("achievements")}
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-white/[0.03] px-2 py-3 text-center transition hover:border-accent/50"
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
              size={72}
              animated
            />
            <span className="max-w-full truncate text-[11px] font-black text-white">
              {item.disguised ? "???" : item.def.name}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wide text-muted">
              {item.disguised ? "тайный знак" : `${item.familyLabel} ${romanTier(item.tier)}`}
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ring-1 ${CFG_RARITY_CLASS[item.def.rarity]}`}
            >
              {CFG_RARITY_LABEL[item.def.rarity]}
            </span>
          </button>
        ))}
      </div>
  );

  const more = (
    <button
      type="button"
      onClick={() => go("achievements")}
      className="mt-3 w-full rounded-xl bg-white/[0.04] px-3 py-2 text-xs font-bold text-accent-2 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
    >
      Все достижения →
    </button>
  );

  // Panel не пробрасывает произвольные атрибуты, поэтому data-хук вешаем
  // на обёртку — на неё же смотрит гейт
  if (bare) {
    return (
      <div data-achievements-strip="">
        {cards}
        {more}
      </div>
    );
  }

  return (
    <div data-achievements-strip="">
      <Panel>
        <Heading
          right={
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-muted">
                Получено {unlocked.length} из {views.length}
              </span>
              <span className="text-right">
                <span className="block text-sm font-black tabular-nums text-accent-2">
                  {progress.progress.trophyPoints.toLocaleString("ru-RU")}
                </span>
                <span className="block text-[9px] font-bold uppercase tracking-wider text-muted">
                  очки славы
                </span>
              </span>
            </div>
          }
        >
          Достижения
        </Heading>

        {cards}
        {more}
      </Panel>
    </div>
  );
}

/**
 * «Основное» — четыре блока, как в макете: Premium, уровень, четыре
 * счётчика и «Серия дней» с тепловой картой.
 *
 * Раньше сюда ещё шли достижения, «О профиле» и стена комментариев. По
 * макету их тут нет, и они не потерялись: достижения — в своей вкладке,
 * комментарии — тоже, а текст «О профиле» (поле bio) показывается блоком
 * «Обо мне» на витрине. Дублировать одно и то же в двух местах незачем.
 */
function MainSection({ account, mode }: SectionProps) {
  const isGuest = mode === "guest";

  return (
    <div className="space-y-4">
      {isGuest ? null : <PremiumCard account={account} />}
      <LevelCard />
      {/* Плашки «Просмотрено / Аниме / Серии / Достижения» и панель «Серия
          дней» здесь больше нет: то же самое живёт виджетами
          «Статистика» и «Активность», их можно снять или поставить
          в разделе «Виджеты». Держать вторую копию в двух местах незачем —
          разойдутся при первой же правке числа. */}

      {/* Витрина: те же блоки, что и в разделе «Виджеты», в том порядке, в
          котором пользователь их расставил и сохранил. Гостю отдаём её без
          правки: тир-лист у чужого профиля только для чтения. */}
      <WidgetShowcase readOnly={isGuest} />
    </div>
  );
}

/* ------------------------------- Квесты --------------------------------- */

const QUEST_WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

/**
 * До ближайшего сброса дня — «чч:мм:сс».
 *
 * Считается в модуле, а не в теле рендера: правило react-hooks/purity запрещает
 * Date.now() во время рендера. Здесь это обычный вызов функции — момент
 * отрисовки фиксируется при вычислении дерева.
 */
function resetIn(): string {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  const left = Math.max(0, next.getTime() - now.getTime());
  const h = `${Math.floor(left / 3_600_000)}`.padStart(2, "0");
  const m = `${Math.floor((left % 3_600_000) / 60_000)}`.padStart(2, "0");
  const s = `${Math.floor((left % 60_000) / 1000)}`.padStart(2, "0");
  return `${h}:${m}:${s}`;
}

/** До конца сезона в днях. Даты сезона фиксированы в конфиге — Date.now()
 *  здесь допустим: значение пересчитывается при рендере, как у таймера
 *  сброса, и не влияет на разметку между сервером и клиентом текстом. */
function daysLeftSeason(): number {
  return Math.max(0, Math.ceil((BATTLEPASS.to - Date.now()) / 86_400_000));
}

function QuestsSection({ go, account }: SectionProps) {
  const { stats, progress } = useProfileData();
  const level = useLevelInfo();
  const [qTab, setQTab] = useState<"daily" | "weekly" | "pass">("daily");

  /** Текущее состояние сезона боевого пропуска — из документа, не выдумано */
  const bpXp = progress.battlepass.xp;
  const bpLevel = bpLevelFromXp(bpXp);
  /**
   * Прогресс считаем ДО следующего уровня, а не внутри текущего.
   * bpCost(level) — цена перехода с level-1 на level, поэтому «накопить
   * 1365 при цене 170» показывал бы 100% и обесценивал полосу.
   */
  const bpNextCost = bpCost(bpLevel + 1);
  const bpInto = Math.max(0, bpXp - bpTotalFor(bpLevel));
  const bpPercent = Math.min(100, Math.round((bpInto / bpNextCost) * 100));
  /** Пропуски квеста — купленные заморозки серии (услуга svc_freeze) */
  const freezeLeft = progress.purchases.filter((item) => item.itemId === "svc_freeze").length;
  const premiumOn = isPremiumActive(account);

  /** Прогресс задания сезона по его типу */
  const missionValue = (mission: (typeof BP_MISSIONS)[number]): number => {
    if (mission.kind === "bpXp") return bpXp;
    if (mission.kind === "level") return bpLevel;
    return progress.battlepass.claimed.length;
  };

  const missionsDone = BP_MISSIONS.filter((m) => missionValue(m) >= m.target).length;

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
            <p className="text-[11px] font-bold text-accent-2">+{def.ac} AC</p>
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
                ? "bg-accent-2/15 text-accent-2 ring-1 ring-accent-2/40"
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
  const dailyClaimed = progress.quests.daily.filter((item) => item.claimed).length;
  const weeklyClaimed = progress.quests.weekly.filter((item) => item.claimed).length;

  return (
    <div className="space-y-4">
      {/* ------------------------------ Герой ------------------------------ */}
      <div className="ag-card ag-q-hero">
        <div>
          <span className="ag-q-reset">
            <i aria-hidden />
            Сброс через <b>{resetIn()}</b>
          </span>
          <div className="ag-h1 ag-q-h1" style={{ marginTop: 8 }}>
            Квесты <em>галактики</em>
          </div>
          <div className="ag-q-lv">
            <div className="ag-q-lv-top">
              <span>
                <b style={{ color: "#fff" }}>{level.level}</b> {level.era}
              </span>
              <span>
                {level.into} / {level.need} XP
              </span>
            </div>
            <div className="ag-q-bar">
              <i style={{ width: `${level.percent}%` }} />
            </div>
          </div>
          <div className="ag-q-bal">
            {/* eslint-disable-next-line @next/next/no-img-element -- монетка 20px в строке баланса, next/image даёт лишний запрос */}
            <img src="/coin.png" alt="" aria-hidden width={20} height={20} className="ag-q-coin" />
            <b>{progress.progress.acBalance.toLocaleString("ru-RU")}</b> AC
            <small>AC на балансе</small>
          </div>
        </div>

        <div className="ag-q-streak">
          <span className="ag-w-cap">СЕРИЯ ДНЕЙ</span>
          <b>🔥 {progress.progress.streakCurrent} дн.</b>
          <div className="ag-q-days">
            {QUEST_WEEKDAYS.map((day, i) => (
              <i
                key={day}
                data-on={i < Math.min(progress.progress.streakCurrent, 7) ? "y" : undefined}
                title={`${day}: ${i < progress.progress.streakCurrent ? "был просмотр" : "нет"}`}
              >
                {day[0]}
              </i>
            ))}
          </div>
        </div>
      </div>

      {/* ------------------------------ Вкладки ---------------------------- */}
      <div className="ag-tabs">
        {(
          [
            ["daily", "Ежедневные", dailyClaimed],
            ["weekly", "Недельные", weeklyClaimed],
            ["pass", "Боевой пропуск", missionsDone],
          ] as const
        ).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            className={qTab === key ? "is-on" : ""}
            aria-pressed={qTab === key}
            onClick={() => setQTab(key)}
          >
            {label}
            <i>{count}</i>
          </button>
        ))}
      </div>

      {qTab === "pass" ? (
        <>
          <Panel>
            <div className="ag-q-prog">
              <h3>Прогресс сезона</h3>
              <span>
                <b>{missionsDone}</b> / {BP_MISSIONS.length} заданий
              </span>
            </div>
            <div className="ag-w-seg">
              {BP_MISSIONS.map((mission) => (
                <i key={mission.id} data-f={missionValue(mission) >= mission.target ? "y" : undefined} />
              ))}
            </div>
          </Panel>

          {/* Premium ×2 и пропуск квеста — реальные механики проекта:
              множитель живёт в premium-perks, заморозка продаётся как
              услуга svc_freeze. Ничего выдуманного, только то, что уже есть */}
          <div className="ag-card ag-q-pass">
            <div className="ag-q-pass-head">
              <span className="ag-q-pass-ic" aria-hidden>
                <WidgetIcon name="crown" />
              </span>
              <div>
                <b>
                  {premiumOn
                    ? `Premium ×${PREMIUM_QUEST_MULT} активен`
                    : "Premium не активен"}
                  <span className="ag-q-on">{premiumOn ? "ON" : "OFF"}</span>
                </b>
                <small>
                  {premiumOn
                    ? `награды за задания умножаются на ${PREMIUM_QUEST_MULT}`
                    : "без подписки награды идут без множителя"}
                </small>
              </div>
            </div>
            <div className="ag-q-frozen">
              <WidgetIcon name="clock" />
              <span>
                {freezeLeft > 0
                  ? `Пропусков квеста осталось: ${freezeLeft}`
                  : "Пропуск квеста использован"}
              </span>
              <small>— новый появится завтра</small>
            </div>
          </div>

          <div className="ag-sh">
            <h3>Задания сезона</h3>
            <span>
              {BATTLEPASS.name} · до конца {daysLeftSeason()} {plural(daysLeftSeason(), "день", "дня", "дней")}
            </span>
          </div>
          <ul className="space-y-2.5">
            {BP_MISSIONS.map((mission) => {
              const value = Math.min(missionValue(mission), mission.target);
              const percent = Math.round((value / mission.target) * 100);
              return (
                <li key={mission.id} className="rounded-xl bg-white/[0.03] px-3.5 py-3 ring-1 ring-white/8">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white">{mission.title}</p>
                      <p className="mt-0.5 text-xs text-muted">{mission.description}</p>
                    </div>
                    <span className="shrink-0 text-[11px] font-black text-mint">{percent}%</span>
                  </div>
                  <div className="mt-2.5 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <Bar percent={percent} tone="accent" />
                      <p className="mt-1 text-[11px] text-muted">
                        {value} / {mission.target}
                        {mission.kind === "level" ? " уровень" : mission.kind === "claim" ? " наград" : " XP"}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="ag-sh">
            <h3>Награды сезона</h3>
            <span>
              Ур. {bpLevel} · {bpInto} / {bpNextCost} XP до {bpLevel + 1}
            </span>
          </div>
          <div className="ag-q-bar" style={{ marginBottom: 14 }}>
            <i style={{ width: `${bpPercent}%` }} />
          </div>
          <Link href="/battlepass" className="btn w-full justify-center">
            <WidgetIcon name="trophy" />
            Открыть боевой пропуск
          </Link>
        </>
      ) : qTab === "daily" ? (
        <>
          <Panel>
            <div className="ag-q-prog">
              <h3>Прогресс дня</h3>
              <span>
                <b>{dailyClaimed}</b> / {PROGRESSION_CONFIG.quests.dailyPick} квеста
              </span>
            </div>
            <div className="ag-w-seg">
              {Array.from({ length: PROGRESSION_CONFIG.quests.dailyPick }, (_, i) => (
                <i key={i} data-f={progress.quests.daily[i]?.claimed ? "y" : undefined} />
              ))}
            </div>
          </Panel>
          <p className="ag-sub">
            Квесты обновляются каждый день по вашему часовому поясу. Награду нужно забрать вручную.
          </p>
          <ul className="space-y-2.5">{dailyRows}</ul>
        </>
      ) : (
        <>
          <Panel>
            <div className="ag-q-prog">
              <h3>Прогресс недели</h3>
              <span>
                <b>{weeklyClaimed}</b> / {PROGRESSION_CONFIG.quests.weeklyPick} задачи
              </span>
            </div>
            <div className="ag-w-seg">
              {Array.from({ length: PROGRESSION_CONFIG.quests.weeklyPick }, (_, i) => (
                <i key={i} data-f={progress.quests.weekly[i]?.claimed ? "y" : undefined} />
              ))}
            </div>
          </Panel>
          <p className="ag-sub">
            Прогресс копится за семь дней и не сбрасывается до конца недели.
          </p>
          <ul className="space-y-2.5">{weeklyRows}</ul>
        </>
      )}

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

/* ------------------------------- Виджеты -------------------------------- */

/**
 * Вкладка «Виджеты» — набор блоков, которые видит гость.
 *
 * Раньше здесь была «Витрина»: до шести тайтлов из избранного. Это простая
 * и до сих пор рабочая сущность, поэтому она не тронута — данные лежат в
 * `profile.showcase` и ничего не потеряли. Просто вкладку теперь занимают
 * блоки: они умеют разного размера, двигаться, прятаться и стоить монет.
 */
function ShowcaseSection({ go }: SectionProps) {
  return (
    <WidgetsPanel
      onPreview={() => openProfileDialog("preview")}
      onOpenAchievements={() => go("achievements")}
    />
  );
}

/* ------------------------------ Любимое --------------------------------- */

type FavSort = "name" | "new";

/** Сколько «витринных» слотов показываем, как в макете */
const FAV_SLOTS = 5;

/**
 * «Любимое» — вкладка профиля: пять слотов избранного плюс полный список.
 *
 * Ограничения в пять тайтлов здесь нет: избранное у проекта не ограничено, и
 * обрезать его значило бы тихо выкидывать данные пользователя. Пять слотов —
 * витрина, полный список живёт ниже и ничем не ограничен.
 *
 * Страница «Мой список» из меню — другая, она на /list.
 */
function FavoritesSection({ go }: SectionProps) {
  const { favorites, titles } = useProfileData();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<FavSort>("new");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = favorites.filter((id) => !q || (titles[id]?.title ?? id).toLowerCase().includes(q));
    if (sort === "new") return list;
    return [...list].sort((a, b) =>
      (titles[a]?.title ?? a).localeCompare(titles[b]?.title ?? b, "ru"),
    );
  }, [favorites, titles, query, sort]);

  const slots = favorites.slice(0, FAV_SLOTS);

  return (
    <div className="space-y-4">
      <div className="ag-h1">
        <span className="ag-lg">
          <WidgetIcon name="heart" />
        </span>
        <em>Любимое</em>
        <small>Выберите любимые тайтлы — они будут видны всем в профиле.</small>
      </div>

      <Panel>
        <div className="ag-slots">
          {Array.from({ length: FAV_SLOTS }, (_, i) => {
            const id = slots[i];
            if (!id) {
              return (
                <Link key={`empty-${i}`} href="/catalog" className="ag-slot is-empty">
                  <div>
                    <WidgetIcon name="plus" />
                    ДОБАВИТЬ
                  </div>
                </Link>
              );
            }
            return (
              <Link key={id} href={`/title/${id}`} className="ag-slot">
                <Poster
                  src={titles[id]?.poster}
                  alt={titles[id]?.title ?? "Тайлт"}
                  title={titles[id]?.title ?? "Тайлт"}
                  className="h-full w-full object-cover"
                />
                <span className="ag-slot-name">{titles[id]?.title ?? id}</span>
              </Link>
            );
          })}
        </div>

        <div className="ag-ls-bar" style={{ marginTop: 18 }}>
          <label className="ag-fld">
            <WidgetIcon name="search" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по списку"
              aria-label="Поиск по избранному"
            />
          </label>
          <PSelect
            className="ag-sel"
            value={sort}
            onChange={(event) => setSort(event.target.value as FavSort)}
            aria-label="Сортировка"
          >
            <option value="new">Сначала новые</option>
            <option value="name">По алфавиту</option>
          </PSelect>
        </div>

        {favorites.length === 0 ? (
          <Empty
            title="В избранном пусто"
            hint="Нажмите сердечко на карточке аниме — оно появится здесь и будет доступно виджетам и квестам."
          />
        ) : shown.length === 0 ? (
          <Empty title="Ничего не найдено" hint={`По запросу «${query.trim()}» в списке нет тайтлов.`} />
        ) : (
          <div className="ag-tiles">
            {shown.map((id) => (
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
            Настроить виджеты →
          </button>
        </div>
      </Panel>
    </div>
  );
}

/* ------------------------------ Подборки -------------------------------- */

function CollectionsSection({ go }: SectionProps) {
  const { collections } = useProfileData();
  const titles = useTitles();

  return (
    <div className="space-y-4">
      <div className="ag-h1">
        <span className="ag-lg">
          <WidgetIcon name="layers" />
        </span>
        <em>Подборки</em>
        <small>Свои тематические списки аниме — их видно в профиле.</small>
      </div>

      {collections.length === 0 ? (
        <div className="ag-card ag-big">
          <div className="ag-big-ic">
            <WidgetIcon name="layers" />
          </div>
          <b>У вас пока нет подборок</b>
          <p>Соберите свою первую подборку любимых тайтлов.</p>
          <Link href="/catalog" className="btn">
            <WidgetIcon name="plus" />
            Создать подборку
          </Link>
        </div>
      ) : (
        <Panel>
          <Heading right={<span className="ag-w-sub">{collections.length} подборок</span>}>
            Ваши подборки
          </Heading>
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
        </Panel>
      )}

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

/** Русское склонение «секрет» для строки о тайных знаках */
function secretWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "секрет";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "секрета";
  return "секретов";
}

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
  /** Якорь галереи — к нему ведёт «Все достижения» из виджета */
  const galleryRef = useRef<HTMLDivElement>(null);

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

  // Ранг, трофейный счёт и «самое редкое» считает виджет достижений —
  // здесь их дублировать не нужно.

  /** Последние полученные — по дате получения, до 5 штук */
  const recent = views
    .filter((item) => item.status === "unlocked" && item.unlockedAt > 0)
    .slice()
    .sort((a, b) => b.unlockedAt - a.unlockedAt)
    .slice(0, 5);

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
      {/* Виджет достижений — тот же блок, что на панели виджетов, 1:1:
          значок ранга, трофейный счёт и «самое редкое». Раньше здесь стояла
          отдельная вёрстка, где ранг был римской цифрой в пустой рамке, —
          из-за неё значок ранга на вкладке и в виджете выглядели разными. */}
      <AchievementsWidget
        onOpenAll={() => {
          setFamily("all");
          setStatus("all");
          setQuery("");
          galleryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      />

      <Panel>

        {/* Баланс и опыт — цифрами: трофеи показывают достижения, XP и AC
            двигают прогресс уровня, и в одном блоку эти шкалы путались */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl bg-white/[0.04] px-3 py-2.5">
            <p className="text-lg font-black text-white">{unlockedCount}</p>
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted">получено</p>
          </div>
          <div className="rounded-xl bg-white/[0.04] px-3 py-2.5">
            <p className="text-lg font-black text-accent-2">{inProgressCount}</p>
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted">в процессе</p>
          </div>
          <div className="rounded-xl bg-white/[0.04] px-3 py-2.5">
            <p className="text-lg font-black text-accent-2">{progress.progress.acBalance}</p>
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted">AC</p>
          </div>
          <div className="rounded-xl bg-white/[0.04] px-3 py-2.5">
            <p className="text-lg font-black text-accent-2">{progress.progress.xpTotal}</p>
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted">XP</p>
          </div>
        </div>

        {/* Последнее полученное */}
        {recent.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
              Последнее получено
            </p>
            <ul className="mt-2 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white/[0.03]">
              {recent.map((item) => (
                <li key={item.def.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(item.def.id)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-white/[0.04]"
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
                      progress={100}
                      unlocked
                      locked={false}
                      size={40}
                      animated
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold text-white">
                        {item.def.name}
                      </span>
                      <span className="block text-[10px] text-muted">
                        {unlockedLabel(item.unlockedAt)}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-black tabular-nums text-accent-2">
                      {item.def.trophy.toLocaleString("ru-RU")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
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

      {/* Галерея достижений — макет achievements-preview. Тайные знаки
          отдельной панелью больше не выносятся: у макета они отдельным
          разделом «Секретные» внутри галереи. Якорь — к нему ведёт
          «Все достижения» из виджета. */}
      <div ref={galleryRef}>
        <AchievementsGallery
        items={shown.map((item) => ({
          id: item.def.id,
          family: item.family,
          name: item.disguised ? "Тайный знак" : item.def.name,
          condition: item.disguised
            ? "тайный знак"
            : item.status === "unlocked"
              ? `+${item.def.trophy} очк. · ${unlockedLabel(item.unlockedAt)}`
              : `${item.progress} / ${item.def.condition.threshold} · ${item.percent}%`,
          rarity: badgeRarity(item.def.id, item.family),
          disguised: item.disguised,
          unlocked: item.status === "unlocked",
        }))}
        onOpen={setOpenId}
        />
      </div>

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
          {/* Бейдж — тот же, что в галерее: макет achievements-preview */}
          <AchievementBadge
            item={{
              id: def.id,
              name: def.name,
              rarity: badgeRarity(def.id, item.family),
            }}
            size={190}
            locked={item.status !== "unlocked"}
          />
          <h2 className="mt-3 text-base font-black text-white">
            <AchievementCode id={item.def.id} family={item.family} tier={item.tier} disguised={item.disguised} />
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
              <span className="text-muted">Очки славы</span>
              <span className="font-bold" style={{ color: "#2ec7ff" }}>
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

type ShopCat = "tags" | "titles" | "backgrounds" | "frames" | "decor" | "effects" | "services" | "custom";
/** Вкладка «Все» — весь каталог витрины разом */
type ShopTab = ShopCat | "all";
/** Порядок выдачи в сетке */
type ShopSort = "rar" | "asc" | "desc";

const SHOP_CATS: { id: ShopCat; label: string }[] = [
  { id: "tags", label: "Теги" },
  { id: "titles", label: "Титулы" },
  { id: "backgrounds", label: "Фоны" },
  { id: "frames", label: "Рамки" },
  { id: "decor", label: "Оформление" },
  { id: "effects", label: "Эффекты" },
  { id: "services", label: "Сервисы" },
  { id: "custom", label: "Кастомизация" },
];

/** Цветные ромбики редкости для фильтров и карточек */
const RARITY_DOT: Record<string, string> = {
  COMMON: "#9ca3af",
  UNCOMMON: "#4ade80",
  RARE: "#38bdf8",
  EPIC: "#a78bfa",
  LEGENDARY: "#24affb",
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
  svc_levelcard: `<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5 14.4 9l5.1 2-5.1 2L12 18.5 9.6 13l-5.1-2 5.1-2z"/>`,
};

/** «1 234 567» — разряды по-русски, как в макете витрины */
const nf = (n: number): string => n.toLocaleString("ru-RU").replace(/\u00a0/g, " ");

/**
 * Салют частиц из кнопки покупки — как в макете.
 * Частицы живут на самом document.body, потому что карточка их обрезает.
 */
function burst(el: HTMLElement, rgb: string): void {
  const b = el.getBoundingClientRect();
  const x = b.left + b.width / 2;
  const y = b.top + b.height / 2;
  for (let i = 0; i < 34; i++) {
    const p = document.createElement("i");
    const a = Math.random() * Math.PI * 2;
    const d = 60 + Math.random() * 120;
    const s = 3 + Math.random() * 5;
    p.style.cssText =
      `position:fixed;z-index:99;left:${x}px;top:${y}px;width:${s}px;height:${s}px;border-radius:` +
      (i % 2 ? "50%" : "2px") +
      `;pointer-events:none;background:` +
      (i % 3 ? `rgb(${rgb})` : "#fff") +
      `;box-shadow:0 0 8px rgb(${rgb})`;
    document.body.appendChild(p);
    const done = () => p.remove();
    p
      .animate(
        [
          { transform: "translate(0,0) scale(1)", opacity: 1 },
          {
            transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d + 50}px) rotate(${Math.random() * 540}deg) scale(.4)`,
            opacity: 0,
          },
        ],
        { duration: 900 + Math.random() * 500, easing: "cubic-bezier(.2,.8,.2,1)" },
      )
      .addEventListener("finish", done, { once: true });
  }
}


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
  /** во сколько раз картинка рамки больше аватара, см. FrameItem.scale */
  previewScale?: number;
  backgroundSize?: string;
  description: string;
  obtain: string;
}

export function ShopSection(_props: { title?: string } = {}) {
  const { profile, account, ctx, progress } = useProfileData();
  const info = useLevelInfo();
  const premium = isPremiumActive(account);
  const [message, setMessage] = useState<string | null>(null);
  const [pageState, setPageState] = useState<{ key: string; page: number }>({ key: "", page: 0 });
  const [cat, setCat] = useState<ShopTab>("frames");
  const [rarity, setRarity] = useState<string>("any");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ShopSort>("rar");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /* Услуги с настройкой открывают своё окно, а не кнопку «Купить»:
     покупка без выбранного ника или оформления ничего не меняет. */
  const [nickDialog, setNickDialog] = useState(false);
  const [colorDialog, setColorDialog] = useState(false);
  const openService = (id: string) => {
    if (id === "svc_nick") setNickDialog(true);
    else if (id === "svc_color") setColorDialog(true);
  };

  const balance = progress.progress.acBalance;
  const dailyAc = PROGRESSION_CONFIG.economy.dailyAcEstimate;
  const shopItem = (id: string) => PROGRESSION_CONFIG.shop.find((item) => item.id === id);
  const heldCount = (id: string) => progress.purchases.filter((item) => item.itemId === id).length;
  const boughtIds = new Set([...progress.purchases.map((item) => item.itemId), ...profile.purchased]);
  const frame = FRAMES.find((item) => item.id === profile.frameId);

  /** «Окупаемость»: сколько примерно дней активности нужно на предмет */
  const payback = (price: number) => Math.max(1, Math.ceil(price / Math.max(1, dailyAc)));

  /* Витрина дня. `now` тикает раз в секунду ради таймера, но сам акция
   * пересчитывается только на смену суток — иначе весь каталог пересобирался бы
   * каждую секунду ради цифр в обратном отсчёте. */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const mounted = useHydrated();
  const dealDay = dayIndex(now);
  /* now, а не Date.now(): impure-вызов во время рендера давал и ошибку
     линтера, и расхождение гидратации — на сервере и клиенте выходили
     разные дни. now живёт в состоянии и обновляется раз в секунду. */
  const deal = useMemo(() => dailyDeal(PROGRESSION_CONFIG.shop, now), [dealDay, now]);

  /** Цена с учётом витрины дня: у акционного предмета она снижена */
  const priceOf = useCallback(
    (id: string, base: number | undefined) => {
      if (base === undefined) return undefined;
      return deal && deal.item.id === id ? deal.price : base;
    },
    [deal],
  );

  /** Покупка уходит движку: он сверит цену с конфигом и баланс AC */
  const buy = (id: string, name: string) => {
    const item = shopItem(id);
    if (!item) return;
    const price = priceOf(item.id, item.price) ?? item.price;
    const res = progressEmit({ type: "SHOP_PURCHASED", itemId: item.id, kind: item.kind, price });
    if (res.rejected) {
      const reasons: Record<string, string> = {
        insufficient_ac: "Не хватает AC — они копятся за вход, квесты и активность",
        limit_reached: "Лимит этого предмета уже достигнут",
        price_mismatch: "Цена в конфиге изменилась — обновите страницу",
        unknown_item: "Предмет недоступен",
      };
      setMessage(reasons[res.rejected.reason] ?? "Покупка не прошла");
    } else {
      setMessage(
        price < item.price
          ? `«${name}» куплено за ${price} AC по витрине дня`
          : `«${name}» куплено за ${item.price} AC`,
      );
    }
  };

  /* ------------------------- Тексты «как получить» ----------------------- */
  const obtainForTag = (tag: (typeof PROGRESSION_CONFIG.tags)[number]): string => {
    if (tag.source === "level") return `Достичь уровня ${tag.level}`;
    if (tag.source === "shop") return `Купить за ${tag.price} AC · ~${payback(tag.price ?? 0)} дн. активности`;
    if (tag.source === "referral") {
      return `Пригласить ${tag.friends} ${plural(tag.friends ?? 0, "друга", "друзей", "друзей")}`;
    }
    const ach = PROGRESSION_CONFIG.achievements.find((a) => a.id === tag.achievementId);
    if (!ach || ach.hidden || tag.source === "secret") return "Разгадать секрет AniGalaxy";
    return `Получить достижение «${ach.name}»`;
  };

  const obtainForTitle = (item: (typeof TITLES)[number]): string => {
    if (item.unlock.premium) return "Оформить подписку Premium";
    if (item.unlock.level) return `Достичь уровня ${item.unlock.level}`;
    if (item.unlock.achievement) return "Открыть достижение каталога";
    if (item.unlock.price) return `Купить за ${item.unlock.price} AC`;
    return "Доступно всем";
  };

  const tagSourceChip = (tag: (typeof PROGRESSION_CONFIG.tags)[number]): string => {
    if (tag.source === "level") return `Уровень ${tag.level}`;
    if (tag.source === "shop") return `${tag.price} AC`;
    if (tag.source === "referral") return `${tag.friends} друзей`;
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
    price: tag.source === "shop" ? priceOf(tag.id, tag.price) : undefined,
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
      price: owned ? undefined : priceOf(item.id, cfg?.price),
      previewCss: item.css,
      backgroundSize: item.backgroundSize,
      description: "Фон шапки профиля",
      obtain: cfg
        ? `Купить за ${priceOf(item.id, cfg.price)} AC · ~${payback(priceOf(item.id, cfg.price) ?? cfg.price)} дн. активности`
        : unlockHint(item.unlock),
    };
  });

  /** Рамка из боевого пропуска: уровень и дорожка */
  const bpDecorSource = (id: string): { level: number; premium: boolean } | null => {
    for (const lv of BATTLEPASS.levels) {
      if (lv.free?.some((r) => r.kind === "decor" && r.itemId === id)) return { level: lv.level, premium: false };
      if (lv.premium?.some((r) => r.kind === "decor" && r.itemId === id)) return { level: lv.level, premium: true };
    }
    return null;
  };

  const bpFrameSource = (id: string): { level: number; premium: boolean } | null => {
    for (const lv of BATTLEPASS.levels) {
      if (lv.free?.some((r) => r.kind === "frame" && r.itemId === id)) return { level: lv.level, premium: false };
      if (lv.premium?.some((r) => r.kind === "frame" && r.itemId === id)) return { level: lv.level, premium: true };
    }
    return null;
  };

  const frameEntries: ShopEntry[] = FRAMES.map((item) => {
    const cfg = shopItem(item.id);
    const bp = cfg ? null : bpFrameSource(item.id);
    const owned = isOwned(item.id, ctx) || boughtIds.has(item.id);
    return {
      id: item.id,
      name: item.name,
      rarity: LEGACY_TO_CFG_RARITY[item.rarity],
      owned,
      active: profile.frameId === item.id,
      complete: false,
      price: owned ? undefined : priceOf(item.id, cfg?.price),
      previewCss: item.css,
      previewImg: item.img,
      previewScale: item.scale,
      description: "Рамка аватара",
      obtain: cfg
        ? `Купить за ${priceOf(item.id, cfg.price)} AC · ~${payback(priceOf(item.id, cfg.price) ?? cfg.price)} дн. активности`
        : bp
          ? `Можно получить в боевом пропуске · ${bp.level} ур. (${bp.premium ? "Premium" : "бесплатно"})`
          : unlockHint(item.unlock),
    };
  }).map((e) => (bpFrameSource(e.id) && !shopItem(e.id) ? { ...e, price: undefined } : e));

  const decorEntries: ShopEntry[] = PROFILE_DECORS.map((item) => {
    const bp = bpFrameSource(item.id) ?? bpDecorSource(item.id);
    const src = bpDecorSource(item.id);
    const claimed = src ? progress.battlepass.claimed.includes(`${BATTLEPASS.seasonId}:${src.premium ? "premium" : "free"}:${src.level}`) : false;
    const owned = boughtIds.has(item.id) || claimed;
    return {
      id: item.id,
      name: item.name,
      rarity: LEGACY_TO_CFG_RARITY[item.rarity],
      owned,
      active: profile.decorFx === item.id,
      complete: false,
      description: "Оформление профиля",
      obtain: bp
        ? `Можно получить в боевом пропуске · ${bp.level} ур. (${bp.premium ? "Premium" : "бесплатно"})`
        : "Награда боевого пропуска",
    };
  });

  const configEntries = (kind: "effect" | "service" | "custom"): ShopEntry[] =>
    PROGRESSION_CONFIG.shop.filter((item) => item.kind === kind).map((item) => {
      const held = heldCount(item.id);
      const unlimited = item.maxOwned === undefined;
      // Для постоянного предмета (`custom`, `effect`) лимит 1 — это
      // «уже куплено», а не исчерпанный запас: раньше такая карточка
      // подписывалась «Лимит», будто её больше нельзя получить.
      const oneTime = kind === "custom" || kind === "effect";
      const complete = !unlimited && held >= item.maxOwned;
      return {
        id: item.id,
        name: item.name,
        rarity: item.rarity,
        // семантика старого магазина: расходники с большим лимитом
        // (999) не становятся «Куплено» после первой покупки
        owned: oneTime ? held > 0 : held > 0 && (unlimited || complete),
        active: false,
        complete: oneTime ? false : complete,
        unlimited,
        heldLabel: unlimited || oneTime ? undefined : `${held} / ${item.maxOwned}`,
        price: oneTime && held > 0 ? undefined : complete ? undefined : item.price,
        description: item.description,
        obtain: `Купить за ${item.price} AC · ~${payback(item.price)} дн. активности`,
      };
    });

  const entriesByCat: Record<ShopCat, ShopEntry[]> = {
    tags: tagEntries,
    titles: titleEntries,
    backgrounds: backgroundEntries,
    frames: frameEntries,
    decor: decorEntries,
    effects: configEntries("effect"),
    services: configEntries("service"),
    custom: configEntries("custom"),
  };
  const entries = cat === "all" ? Object.values(entriesByCat).flat() : entriesByCat[cat];

  /* -------------------------- Фильтры и выборка -------------------------- */
  const q = query.trim().toLowerCase();
  /* Порядок макета: по редкости, затем по цене; цена учитывает витрину дня.
     Без useMemo: `entries` для вкладки «Все» собирается заново каждый рендер,
     и компилятор React справедливо ругается, что мемоизацию не сохранить.
     Каталог — порядка сотни позиций, сортировка дешевле лишнего useMemo. */
  const price = (entry: ShopEntry) => entry.price ?? entry.obtain.length * 40;
  const filtered = entries
    .filter(
      (entry) =>
        (rarity === "any" || entry.rarity === rarity) && (!q || entry.name.toLowerCase().includes(q)),
    )
    .sort((a, b) => {
      if (sort === "asc") return price(a) - price(b);
      if (sort === "desc") return price(b) - price(a);
      return rarityWeight(a.rarity) - rarityWeight(b.rarity) || price(b) - price(a);
    });
  const rarities = [...new Set(entries.map((entry) => entry.rarity))].sort(
    (a, b) => rarityWeight(a) - rarityWeight(b),
  );
  const PAGE_SIZE = 12;
  const pageKey = `${cat}|${rarity}|${q}|${sort}`;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(pageCount - 1, pageState.key === pageKey ? pageState.page : 0);
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const goPage = (next: number) => setPageState({ key: pageKey, page: Math.max(0, Math.min(pageCount - 1, next)) });
  const selected = filtered.find((entry) => entry.id === selectedId) ?? pageItems[0] ?? filtered[0];

  const switchCat = (next: ShopTab) => {
    setCat(next);
    setRarity("any");
    setQuery("");
    setSelectedId(null);
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

  /** «#rrggbb» → «r,g,b»: макет красит карточки через rgb(var(--rc)) */
  const rgbOf = (hex: string): string => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return "156,163,175";
    const n = parseInt(m[1], 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  };

  /**
   * Короткий источник предмета для строки карточки: «Уровень 5»,
   * «Достижение», «Premium». Полный «как получить» живёт в панели примерки —
   * в строке он переносился на вторую линию и ломал сетку.
   */
  const shortObtain = (entry: ShopEntry): string => {
    if (entry.price !== undefined) return `Купить за ${nf(entry.price)} AC`;
    if (entry.tagDef) {
      const tag = PROGRESSION_CONFIG.tags.find((t) => t.id === entry.id);
      return tag ? tagSourceChip(tag) : "Достижение";
    }
    if (cat === "titles") {
      const item = TITLES.find((t) => t.id === entry.id);
      if (item?.unlock.premium) return "Premium";
      if (item?.unlock.level) return `Уровень ${item.unlock.level}`;
      return "Достижение";
    }
    const bp = bpFrameSource(entry.id) ?? bpDecorSource(entry.id);
    if (bp) return `Боевой пропуск · ${bp.level} ур.`;
    return "Закрыто";
  };

  /** Превью любого предмета: рамки и аватары — готовым компонентом */
  const stagePreview = (entry: ShopEntry, size: AvSize) => {
    const item = FRAMES.find((f) => f.id === entry.id);
    if (PROFILE_DECORS.some((d) => d.id === entry.id)) {
      return (
        <span className="block w-full max-w-[300px]" style={size === "sm" ? { zoom: 0.55 } : undefined}>
          <ProfileMini nickname={account?.nickname ?? "Гость"} />
        </span>
      );
    }
    if (entry.tagDef) {
      return (
        <span className="tagstage">
          <AgTag tag={entry.tagDef} size="lg" locked={!entry.owned} />
        </span>
      );
    }
    if (item) {
      return (
        <AvatarFrame
          nickname={account?.nickname ?? "Гость"}
          avatar={profile.avatar || undefined}
          frame={item}
          size={size}
        />
      );
    }
    if (entry.previewCss) {
      return (
        <span
          className="block overflow-hidden rounded-2xl ring-1 ring-white/10"
          style={{
            width: 150,
            height: 150,
            backgroundImage: entry.previewCss,
            backgroundSize: entry.backgroundSize ?? "cover",
            backgroundPosition: "center",
          }}
        />
      );
    }
    return (
      <span className="grid place-items-center rounded-2xl bg-white/5" style={{ width: 150, height: 150 }}>
        <svg
          viewBox="0 0 24 24"
          className="text-accent-2"
          width={48}
          height={48}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: SHOP_ITEM_ICONS[entry.id] ?? "" }}
        />
      </span>
    );
  };

  /** замок/галочка в углу превью */
  const cornerBadge = (entry: ShopEntry) => (
    <span className={`st ${entry.owned ? "own" : ""} ${entry.active ? "on" : ""}`}>
      {entry.owned ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12l5 5 9-10" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
      )}
    </span>
  );

  /** Подпись под названием карточки */
  const cardSub = (entry: ShopEntry): string => {
    if (entry.active) return "Применено к профилю";
    if (entry.extra) return "Выбрано дополнительно";
    if (entry.owned) return "Уже в коллекции";
    if (entry.price === undefined && (bpFrameSource(entry.id) ?? bpDecorSource(entry.id))) return entry.description;
    return shortObtain(entry);
  };

  /** нижняя строка карточки: цена / владение / источник */
  const bottomChip = (entry: ShopEntry) => {
    if (entry.owned && PROFILE_DECORS.some((d) => d.id === entry.id)) {
      return (
        <button
          type="button"
          className={`btn ${entry.active ? "ok" : "pri"}`}
          style={{ padding: "4px 12px", fontSize: 12 }}
          onClick={(e) => {
            e.stopPropagation();
            updateProfile({
              decorFx: entry.active ? "" : entry.id,
              ...(profile.purchased.includes(entry.id) ? {} : { purchased: [...profile.purchased, entry.id] }),
            });
            setMessage(entry.active ? `«${entry.name}» выключено` : `«${entry.name}» включено в профиле`);
          }}
        >
          {entry.active ? "Выключить" : "Включить"}
        </button>
      );
    }
    if (entry.owned) {
      const label = entry.active ? "Применено" : cat === "tags" || cat === "titles" ? "Выбрано ✓" : "Куплено";
      return <span className="price own">{label}</span>;
    }
    if (entry.price !== undefined) {
      const onDeal = deal && deal.item.id === entry.id;
      return <span className={`price ${onDeal ? "sale" : ""}`}>{nf(entry.price)} AC</span>;
    }
    return (
      <span
        className="price own"
        style={{ background: "rgba(255,255,255,.06)", color: "var(--muted)", border: "1px solid var(--line)" }}
      >
        {shortObtain(entry)}
      </span>
    );
  };

  /** главное действие детальной панели */
  const panelAction = (entry: ShopEntry) => {
    /* Смена имени и оформление — не «купить и закрыть», а «купить и
       настроить»: кнопка открывает окно услуги. */
    if (entry.id === "svc_nick" || entry.id === "svc_color") {
      return (
        <button type="button" className="btn pri" onClick={() => openService(entry.id)}>
          {entry.id === "svc_nick" ? "Сменить имя" : "Настроить цвет"}
        </button>
      );
    }
    if (entry.owned) {
      if (cat === "tags" || cat === "titles") {
        const isOn = entry.active || entry.extra;
        return (
          <button type="button" className={`btn ${isOn ? "ok" : "pri"}`} onClick={() => (cat === "tags" ? toggleTag(entry.id) : toggleTitle(entry.id))}>
            {entry.active ? "Снять" : entry.extra ? "Убрать" : cat === "tags" ? "Экипировать" : "Выбрать"}
          </button>
        );
      }
      if (cat === "backgrounds" || cat === "frames") {
        return (
          <button
            type="button"
            className={`btn ${entry.active ? "ok" : "pri"}`}
            onClick={() => {
              if (cat === "backgrounds") updateProfile({ backgroundId: entry.id, backgroundCustom: "" });
              else updateProfile({ frameId: entry.id });
              setMessage(`«${entry.name}» применён`);
            }}
          >
            {entry.active ? "Сейчас применено" : "Применить"}
          </button>
        );
      }
      if (PROFILE_DECORS.some((d) => d.id === entry.id)) {
        return (
          <button
            type="button"
            className={`btn ${entry.active ? "ok" : "pri"}`}
            onClick={() => {
              updateProfile({
              decorFx: entry.active ? "" : entry.id,
              ...(profile.purchased.includes(entry.id) ? {} : { purchased: [...profile.purchased, entry.id] }),
            });
              setMessage(entry.active ? `«${entry.name}» выключено` : `«${entry.name}» включено в профиле`);
            }}
          >
            {entry.active ? "Выключить" : "Включить в профиле"}
          </button>
        );
      }
      return <span className="btn ok">Куплено</span>;
    }
    if (entry.price !== undefined) {
      return (
        <button
          type="button"
          className={`btn ${deal && deal.item.id === entry.id ? "gold" : "pri"}`}
          disabled={balance < entry.price}
          onClick={(event) => {
            burst(event.currentTarget, rgbOf(RARITY_DOT[entry.rarity] ?? "#9ca3af"));
            buy(entry.id, entry.name);
          }}
        >
          {balance < entry.price ? `Не хватает ${nf(entry.price - balance)} AC` : `Купить за ${nf(entry.price)} AC`}
        </button>
      );
    }
    return <span className="btn ok" style={{ cursor: "default" }}>{shortObtain(entry)}</span>;
  };

  /** наклон карточки за курсором — как в макете */
  const onCardMove = (event: ReactMouseEvent<HTMLElement>) => {
    const card = event.currentTarget;
    const b = card.getBoundingClientRect();
    const x = (event.clientX - b.left) / b.width - 0.5;
    const y = (event.clientY - b.top) / b.height - 0.5;
    card.style.setProperty("--mx", `${event.clientX - b.left}px`);
    card.style.setProperty("--my", `${event.clientY - b.top}px`);
    const tilt = card.querySelector<HTMLElement>(".tilt");
    if (tilt) tilt.style.transform = `rotateX(${-y * 14}deg) rotateY(${x * 14}deg) scale(1.06)`;
  };
  const onCardLeave = (event: ReactMouseEvent<HTMLElement>) => {
    const tilt = event.currentTarget.querySelector<HTMLElement>(".tilt");
    if (tilt) tilt.style.transform = "";
  };

  const ownedInCat = entries.filter((entry) => entry.owned).length;

  /** Собрано по всей косметике — прогресс коллекции макета */
  const totalAll = Object.values(entriesByCat).reduce((sum, list) => sum + list.length, 0);
  const ownedAll = Object.values(entriesByCat).reduce(
    (sum, list) => sum + list.filter((entry) => entry.owned).length,
    0,
  );
  const collectPct = totalAll > 0 ? Math.round((ownedAll / totalAll) * 100) : 0;

  /** Предмет дня: витрина прогрессии, иначе — самая дорогая рамка */
  const dealEntry: ShopEntry | undefined = deal
    ? frameEntries.find((e) => e.id === deal.item.id) ?? [...frameEntries].sort((a, b) => (b.price ?? 0) - (a.price ?? 0))[0]
    : [...frameEntries].sort((a, b) => (b.price ?? 0) - (a.price ?? 0))[0];
  const dealOwned = dealEntry ? boughtIds.has(dealEntry.id) : false;

  const left = deal ? Math.max(0, deal.endsAt - now) : 0;
  const pad2 = (n: number) => String(n).padStart(2, "0");
  /* Обратный отсчёт не рендерим до монтирования: Date.now() на сервере и
     в браузере расходится на секунды, из-за чего React сообщал о расхождении
     гидрации (в логе был «40» против «42»). Тот же приём, что у dealClock. */
  const tick = (n: number) => (mounted ? pad2(n) : "--");

  return (
    <div className="ags">
      {/* ---------------------------- Шапка-сводка --------------------------- */}
      <section className="sum">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <AvatarFrame
            nickname={account?.nickname ?? "Гость"}
            avatar={profile.avatar || undefined}
            frame={frame}
            size="xs"
          />
          <div className="who">
            <b>{account?.nickname ?? "Гость"}</b>
            <span>
              Уровень {info.level} · рамка «{frame?.name ?? "нет"}»
            </span>
          </div>
        </div>
        <div>
          <div className="prog-h">
            <span>
              <b>{ownedAll}</b> / {totalAll} предметов собрано
            </span>
            <span>{collectPct}% открыто</span>
          </div>
          <div className="bar">
            <i style={{ width: `${collectPct}%` }} />
          </div>
        </div>
        <div className="bal">
          <small>БАЛАНС</small>
          <span className="bal-row">
            {/* eslint-disable-next-line @next/next/no-img-element -- монетка 26px в шапке, next/image даёт лишний запрос */}
            <img src="/coin.png" alt="" aria-hidden width={26} height={26} className="bal-coin" />
            <b>{nf(balance)} AC</b>
          </span>
        </div>
      </section>

      {/* --------------------------- Предмет дня ----------------------------- */}
      {dealEntry && (
        <section className="hero">
          <div className="hstage">{stagePreview(dealEntry, "lg")}</div>
          <div>
            <div className="eyebrow">
              <i />
              ПРЕДМЕТ ДНЯ
            </div>
            <h2>{dealEntry.name}</h2>
            <p>
              {dealEntry.description}. Скидка действует только сегодня.
            </p>
            <div className="timer">
              <div>
                <b>{tick(Math.floor(left / 3_600_000))}</b>
                <small>ЧАС</small>
              </div>
              <div>
                <b>{tick(Math.floor((left % 3_600_000) / 60_000))}</b>
                <small>МИН</small>
              </div>
              <div>
                <b>{tick(Math.floor((left % 60_000) / 1000))}</b>
                <small>СЕК</small>
              </div>
            </div>
            <div className="buyrow">
              {dealOwned ? (
                <span className="btn ok">Куплено</span>
              ) : deal && dealEntry.price !== undefined ? (
                <>
                  <span className="old">{nf(deal.oldPrice)} AC</span>
                  <span className="new">{nf(dealEntry.price)} AC</span>
                  <span className="off">−{DEAL_PERCENT}%</span>
                  <button
                    type="button"
                    className="btn gold"
                    onClick={(event) => {
                      burst(event.currentTarget, "255,90,110");
                      buy(deal.item.id, deal.item.name);
                    }}
                  >
                    Купить
                  </button>
                </>
              ) : dealEntry.price !== undefined ? (
                <button
                  type="button"
                  className="btn pri"
                  onClick={(event) => {
                    burst(event.currentTarget, "255,90,110");
                    buy(dealEntry.id, dealEntry.name);
                  }}
                >
                  Купить за {nf(dealEntry.price)} AC
                </button>
              ) : (
                <span className="btn ok">{dealEntry.obtain}</span>
              )}
              <button
                type="button"
                className="btn"
                onClick={() => {
                  switchCat("frames");
                  setSelectedId(dealEntry.id);
                }}
              >
                Примерить
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------ Фильтры ------------------------------ */}
      <div className="filters">
        <button
          type="button"
          className={`chip ${cat === "all" ? "on" : ""}`}
          onClick={() => switchCat("all")}
        >
          Все <small>{totalAll}</small>
        </button>
        {SHOP_CATS.map((item) => {
          const all = entriesByCat[item.id];
          return (
            <button
              key={item.id}
              type="button"
              className={`chip ${cat === item.id ? "on" : ""}`}
              onClick={() => switchCat(item.id)}
            >
              {item.label} <small>{all.filter((entry) => entry.owned).length}/{all.length}</small>
            </button>
          );
        })}
      </div>

      <div className="filters">
        <button
          type="button"
          className={`chip ${rarity === "any" ? "on" : ""}`}
          onClick={() => setRarity("any")}
        >
          Все <small>{entries.length}</small>
        </button>
        {rarities.map((r) => (
          <button
            key={r}
            type="button"
            className={`chip ${rarity === r ? "on" : ""}`}
            style={{ ["--rc" as string]: rgbOf(RARITY_DOT[r] ?? "#9ca3af") }}
            onClick={() => setRarity(r)}
          >
            <i />
            {CFG_RARITY_LABEL[r] ?? r} <small>{entries.filter((entry) => entry.rarity === r).length}</small>
          </button>
        ))}
        <span className="sp" />
        <input
          className="inp"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск по косметике…"
          aria-label="Поиск по косметике"
        />
        <PSelect
          className="inp"
          value={sort}
          aria-label="Сортировка"
          onChange={(event) => setSort(event.target.value as ShopSort)}
        >
          <option value="rar">По редкости</option>
          <option value="asc">Сначала дешёвые</option>
          <option value="desc">Сначала дорогие</option>
        </PSelect>
      </div>

      <div className="layout">
        {/* ------------------------------ Сетка ------------------------------ */}
        <div className="grid">
          {filtered.length === 0 ? (
            <div className="empty">Ничего не найдено</div>
          ) : (
            pageItems.map((entry, n) => {
              const rc = rgbOf(RARITY_DOT[entry.rarity] ?? "#9ca3af");
              return (
                <article
                  key={entry.id}
                  className={`card ${selected?.id === entry.id ? "sel" : ""}`}
                  style={{ ["--rc" as string]: rc }}
                  onMouseMove={onCardMove}
                  onMouseLeave={onCardLeave}
                  onClick={() => setSelectedId(entry.id)}
                >
                  {entry.rarity === "LEGENDARY" && <span className="bord" />}
                  <div className="stage">
                    <span className="pts">
                      {Array.from({ length: 6 }, (_, k) => (
                        <i key={k} style={{ left: `${14 + k * 14}%`, animationDelay: `${k * 0.6}s` }} />
                      ))}
                    </span>
                    <span className="tilt">{stagePreview(entry, "sm")}</span>
                    {cornerBadge(entry)}
                  </div>
                  <h3>{entry.name}</h3>
                  <p className="sub">{cardSub(entry)}</p>
                  <div className="meta">
                    <span className="rar" style={{ ["--rc" as string]: rc }}>
                      {CFG_RARITY_LABEL[entry.rarity] ?? entry.rarity}
                    </span>
                    {bottomChip(entry)}
                  </div>
                </article>
              );
            })
          )}
          {pageCount > 1 && (
            <nav className="ag-pager" aria-label="Страницы каталога">
              <button type="button" onClick={() => goPage(page - 1)} disabled={page === 0} aria-label="Назад">‹</button>
              {Array.from({ length: pageCount }, (_, i) => i)
                .filter((i) => i === 0 || i === pageCount - 1 || Math.abs(i - page) <= 1)
                .map((i, idx, arr) => (
                  <span key={i} className="ag-pager-it">
                    {idx > 0 && i - arr[idx - 1] > 1 && <em>…</em>}
                    <button type="button" className={i === page ? "on" : ""} onClick={() => goPage(i)} aria-current={i === page ? "page" : undefined}>
                      {i + 1}
                    </button>
                  </span>
                ))}
              <button type="button" onClick={() => goPage(page + 1)} disabled={page >= pageCount - 1} aria-label="Дальше">›</button>
              <small>{filtered.length} шт.</small>
            </nav>
          )}
        </div>

        {/* -------------------------- Панель примерки ------------------------ */}
        <aside className="panel" style={{ ["--rc" as string]: rgbOf(RARITY_DOT[selected?.rarity ?? ""] ?? "#9ca3af") }}>
          <div
            className="pban"
            style={
              selected && cat === "backgrounds"
                ? { backgroundImage: selected.previewCss, backgroundSize: selected.backgroundSize ?? "cover" }
                : undefined
            }
          />
          <div className="pfr">{selected && stagePreview(selected, "md")}</div>
          <div className="pbody">
            {cat === "frames" ? (
              <>
                <div className="pname">
                  <NickName name={displayNameOf(account)} style={profile.nickStyle} />
                  {premium && <PremiumChip />}
                </div>
                <div className="phandle">@{account?.nickname?.toLowerCase() ?? "гость"}</div>
              </>
            ) : (
              <div style={{ height: 14 }} />
            )}

            {selected && (
              <>
                <span
                  className="rar"
                  style={{ ["--rc" as string]: rgbOf(RARITY_DOT[selected.rarity] ?? "#9ca3af") }}
                >
                  {CFG_RARITY_LABEL[selected.rarity] ?? selected.rarity}
                </span>
                <div className="ptitle">{selected.name}</div>
                <p className="psub">{selected.description}</p>
                <div className="how">
                  <small>КАК ПОЛУЧИТЬ</small>
                  <b>{selected.obtain}</b>
                </div>
                <div className="pbtn">
                  {panelAction(selected)}
                  <Link href="/profile" className="link">
                    Открыть профиль
                  </Link>
                </div>
              </>
            )}
          </div>
        </aside>
      </div>

      <div className={`toast ${message ? "on" : ""}`} role="status" aria-live="polite">
        {message}
      </div>

      <NicknameDialog open={nickDialog} onClose={() => setNickDialog(false)} onMessage={setMessage} />
      <NickColorDialog open={colorDialog} onClose={() => setColorDialog(false)} onMessage={setMessage} />

      <p className="sub" style={{ marginTop: 18, color: "var(--muted)", fontSize: 12 }}>
        В категории открыто {ownedInCat} из {entries.length}. AC копятся за ежедневный вход, квесты и
        активность — ≈ {dailyAc} AC за день.
      </p>
    </div>
  );
}

/* ---------------------------- Витрина дня -------------------------------- */

/** «ЧЧ:ММ:СС» — до полуночи, когда акция закончится */
function dealClock(now: number, endsAt: number): string {
  const left = Math.max(0, endsAt - now);
  const h = Math.floor(left / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  const s = Math.floor((left % 60_000) / 1000);
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

/**
 * Плашка «витрина дня» над сеткой каталога.
 *
 * Скидка здесь настоящая: ту же цену принимает движок (см. `lib/progression/
 * deals.ts`), поэтому кнопка не может оказаться вразрез с балансом.
 */
function DailyDealBanner({
  name,
  oldPrice,
  price,
  endsAt,
  now,
  affordable,
  onBuy,
}: {
  name: string;
  oldPrice: number;
  price: number;
  endsAt: number;
  now: number;
  affordable: boolean;
  onBuy: () => void;
}) {
  /* Обратный отсчёт зависит от момента рендера, поэтому на сервере и при
     гидрации его показывать нельзя: между отдачей HTML и гидратацией
     проходит несколько секунд, и React получал расхождение текста
     (ошибка #418). Сервер и первый рендер клиента отдают прочерк,
     сразу после монтирования React перерисовывает компонент с настоящим
     временем. Ширина не скачет — цифры моноширинные, у прочерка та же
     длина. */
  const mounted = useHydrated();

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-accent-2/30 bg-gradient-to-r from-accent-2/14 to-white/[0.02] p-3.5 transition hover:-translate-y-0.5 hover:shadow-[0_14px_34px_-12px_rgba(74,197,245,0.25)]">
      <span
        className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-lg font-black text-white/90"
        style={{
          background:
            "radial-gradient(circle at 28% 28%, #8a46ff, transparent 46%), radial-gradient(circle at 78% 78%, #2b7fff, transparent 42%), #0b0b1c",
        }}
        aria-hidden
      >
        {DEAL_PERCENT}%
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-[15px] font-black text-white">
          Витрина дня: {name}
          <span className="rounded-lg bg-accent-2 px-2 py-0.5 text-xs font-black text-[#04141a]">
            −{DEAL_PERCENT}%
          </span>
        </p>
        <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
          <s className="opacity-70">{oldPrice.toLocaleString("ru-RU")} AC</s>
          <span className="font-black text-accent-2">{price.toLocaleString("ru-RU")} AC</span>
        </p>
      </div>

      <div className="ml-auto flex items-center gap-4">
        <span className="text-right">
          <strong className="block font-black tabular-nums text-accent-2">
            {mounted ? dealClock(now, endsAt) : "\u2013\u2013:\u2013\u2013\u2013\u2013"}
          </strong>
          <span className="text-[10px] font-black uppercase tracking-[0.12em] text-accent-2/70">
            до конца акции
          </span>
        </span>
        <button
          type="button"
          onClick={onBuy}
          disabled={!affordable}
          className="btn-primary shrink-0 rounded-xl px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          {affordable ? "Купить" : `Нужно ${price - 0}`}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------- История -------------------------------- */

function HistorySection() {
  const { watch, stats } = useProfileData();

  return (
    <div className="space-y-4">
      <div className="ag-h1">
        <span className="ag-lg">
          <WidgetIcon name="clock" />
        </span>
        <em>История</em>
        <small>Продолжайте с того места, где остановились</small>
      </div>

      <div className="ag-sh">
        <span className="ag-w-sub">
          {stats.minutes} мин у плеера · {stats.titles} тайтлов · {watch.records.length} записей
        </span>
        {watch.records.length > 0 && (
          <button
            type="button"
            onClick={clearWatchHistory}
            className="text-xs font-bold text-rose-300 transition hover:text-white"
          >
            Очистить
          </button>
        )}
      </div>

      {watch.records.length === 0 ? (
        <div className="ag-card ag-big">
          <div className="ag-big-ic">
            <WidgetIcon name="clock" />
          </div>
          <b>История пуста</b>
          <p>Открытые серии появятся здесь автоматически — вместе с таймером присутствия у плеера.</p>
          <Link href="/catalog" className="btn">
            <WidgetIcon name="plus" />
            Выбрать аниме
          </Link>
        </div>
      ) : (
        <div className="ag-hist">
          {watch.records.slice(0, 40).map((record) => (
            <article key={`${record.id}-${record.season}-${record.episode}`} className="ag-hist-card">
              <div className="ag-hist-poster">
                <Poster
                  src={record.poster}
                  alt={record.title}
                  title={record.title}
                  sizes="(max-width: 640px) 50vw, 240px"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="ag-hist-top">
                <span className="ag-hist-ep">
                  {record.season > 1 ? `Сезон ${record.season} · ` : ""}Серия {record.episode}
                </span>
                <span className="ag-hist-when">{timeAgo(record.at)}</span>
              </div>
              <div className="ag-hist-body">
                <p className="ag-hist-title">{record.title}</p>
                <div className="ag-list-row">
                  <Link href={`/title/${record.id}`} className="ag-hist-btn">
                    Продолжить
                  </Link>
                  <GhostButton title="Убрать запись" danger onClick={() => removeWatch(record.id, record.episode, record.season)}>
                    {X_ICON}
                  </GhostButton>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
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

/** Русское склонение: plural(5, "день", "дня", "дней") */
function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/**
 * Раздел «Пригласи друзей».
 *
 * Раньше здесь была только ссылка и три нуля в статистике: код из `?ref=`
 * нигде не читался, поэтому приглашение нельзя было засчитать. Теперь
 * регистрация по ссылке уходит в движок (`REFERRAL_REGISTERED`), награда
 * начисляется по конфигу, а список «топ месяца» показывает, кого пригласили.
 *
 * Про «топ месяца» честно: у сайта нет сервера, поэтому приглашения с других
 * устройств сюда не попадают — в списке только то, что сделано с этого
 * браузера. Это подписано в самом блоке.
 */
/* ---------------------------- Рефералы -------------------------------- */

/**
 * Короткая карточка рефералки в профиле: код, ссылка и прогресс до ближайшего
 * рубежа. Полная программа — на странице `/referrals`; оба места читают одно
 * состояние сервера и одни и те же правила (`lib/referral-rules.ts`).
 */
/** Куда можно отправить ссылку — подписи и адреса мессенджеров */
const SHARE_LINKS = [
  { id: "tg", label: "Telegram", url: "https://t.me/share/url?url=", icon: "send" },
  { id: "vk", label: "ВКонтакте", url: "https://vk.com/share.php?url=", icon: "link" },
  { id: "wa", label: "WhatsApp", url: "https://wa.me/?text=", icon: "chat" },
] as const;

export function ReferralsSection({ account }: StandaloneSectionProps) {
  const [copied, setCopied] = useState<boolean | null>(null);
  const state = useReferralState();
  const referrer = useReferrer();

  const code = refCodeFor(account);
  const link = refLink(code);
  const friends = state?.qualified ?? 0;
  const waiting = state ? state.total - state.qualified : 0;
  const next = REFERRAL_RULES.find((rule) => friends < rule.n);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value === code ? code : absoluteRefLink(code));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-5">
      <header className="ag-ref-hero">
        <span className="ag-ref-badge">Реферальная программа</span>
        <h1>
          Собери свою <em>галактику</em>
        </h1>
        <p>
          Друг засчитывается, когда дорастёт до {state?.rules.minLevel ?? 10} уровня и посмотрит{" "}
          {state?.rules.minMinutes ?? 30} минут. Тебе — {REFERRAL_DAYS_PER_FRIEND} дня Premium за каждого и подарки за рубежи.
        </p>
      </header>

      <div className="ag-ticket">
        <span className="ag-ticket-foil" aria-hidden />
        <div className="ag-ticket-row">
          <span className="ag-w-sub">Твой пропуск в галактику</span>
          <span className="ag-ticket-live">АКТИВЕН</span>
        </div>
        <div className="ag-ticket-code">
          <span>{code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code}</span>
          <button type="button" aria-label="Скопировать код" className="ag-ticket-copy" onClick={() => void copy(code)}>
            <WidgetIcon name="copy" />
          </button>
        </div>
        <div className="ag-ticket-link">
          <span className="ag-ticket-url">
            <WidgetIcon name="link" />
            {link}
          </span>
          <button type="button" onClick={() => void copy(link)} className="btn shrink-0">
            <WidgetIcon name="copy" />
            Копировать
          </button>
        </div>
        <div className="ag-ticket-share">
          {SHARE_LINKS.map((item) => (
            <a
              key={item.id}
              href={`${item.url}${encodeURIComponent(absoluteRefLink(code))}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={item.label}
              title={item.label}
              className="ag-ticket-so"
            >
              <WidgetIcon name={item.icon} />
            </a>
          ))}
        </div>
        <div className="ag-ticket-stub">
          <span>Другу</span>
          <b>+{REFERRAL_WELCOME.days}</b>
          <span>дней Premium</span>
          <b>+{REFERRAL_WELCOME.xp}</b>
          <span>XP при старте</span>
        </div>
      </div>

      {copied !== null && (
        <p className={copied ? "text-xs text-mint" : "text-xs text-rose-300"}>
          {copied ? "Скопировано" : "Скопировать не удалось — выделите вручную"}
        </p>
      )}
      {referrer && !account && (
        <p className="ag-sub">
          Вас пригласил код <b className="text-accent-2">{referrer.code}</b> — зарегистрируйтесь, и оба получите подарок.
        </p>
      )}

      <div className="ag-ref-how">
        <span>
          Засчитано друзей: <b>{friends}</b>
          {waiting > 0 ? ` · растут: ${waiting}` : ""}
        </span>
        <span>
          {next ? (
            <>
              До рубежа «{next.title}»: ещё <b>{next.n - friends}</b>
            </>
          ) : (
            <b>Все рубежи получены</b>
          )}
        </span>
      </div>

      <Link href="/referrals" className="btn">
        Хранилище наград и рейтинг →
      </Link>
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

export function ProfileSection({ section, account, go, mode }: SectionProps & { section: SectionId }) {
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
      return <MainSection account={account} go={go} mode={mode} />;
  }
}

function AchievementsWithGo({ go }: { go: (id: SectionId) => void }) {
  return <AchievementsSection go={go} />;
}
