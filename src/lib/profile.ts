"use client";

import { createLocalStore, dayKey, localId } from "./store";
import { isEffectLevel } from "./profile-effects";
import { levelInfo } from "./levels";
import { applyVote, normalizeCommentText, type CommentMsg } from "./comments";
import { DEFAULT_NICK_STYLE, normalizeNickStyle, type NickStyle } from "./nickname";

/**
 * Настройки профиля и локальная «геймификация»: XP, монеты, достижения,
 * дневные квесты, подарки, комментарии, чёрный список и уведомления.
 *
 * Как и аккаунт (`lib/auth.ts`), всё живёт в localStorage: сервера и базы
 * у проекта нет, об этом честно сказано в модалке входа и в профиле.
 */

/**
 * Комментарий стены профиля — тот же формат, что у комментариев тайтла
 * (`lib/comments.ts`): спойлер, ответ (один уровень), локальные голоса.
 * Старые записи без новых полей читаются как есть (все новые опциональны).
 */
export type ProfileComment = CommentMsg;

export interface ProfileGift {
  id: string;
  name: string;
  hint: string;
  coins: number;
  at: number;
  claimed: boolean;
}

export interface ProfileNotice {
  id: string;
  text: string;
  at: number;
  read: boolean;
}

/** Кому открыт профиль целиком */
export type ProfileScope = "public" | "friends" | "private";

export const SCOPE_LABEL: Record<ProfileScope, string> = {
  public: "Публичный",
  friends: "Только друзья",
  private: "Приватный",
};

export interface PrivacySettings {
  /** Профиль доступен по ссылке */
  profilePublic: boolean;
  showStats: boolean;
  showAchievements: boolean;
  showHistory: boolean;
  /** Стена комментариев на странице профиля */
  showComments: boolean;
  /** Принимаются ли заявки в друзья */
  acceptFriends: boolean;
  /**
   * Кому открыт профиль целиком. Для уровня «friends» список друзей
   * лежит в отдельном сторе (`animehub:friends:v1`): записи заводятся
   * вручную, потому что подтверждать их некому — сервера у сайта нет.
   */
  scope: ProfileScope;
}

export interface ProfileState {
  /** data-URL аватара; GIF хранится как есть (не пережимается) */
  avatar: string;
  /** Загруженные ранее аватары (последние первыми) */
  avatarHistory: string[];
  /** id пресетного фона */
  backgroundId: string;
  /** data-URL своего фона, если он выбран */
  backgroundCustom: string;
  /** id открытого титула, "" — без титула */
  titleId: string;
  /** Дополнительные выбранные титулы (мультивыбор): показываются рядом с основным */
  extraTitleIds: string[];
  /** Дополнительные экипированные теги (мультивыбор): основной — в документе прогрессии */
  extraTagIds: string[];
  /** id рамки вокруг аватара */
  frameId: string;
  /** id эффекта-частицы, "" — без частиц (одна на профиль) */
  particleFx: string;
  /** id включённого оформления профиля (виджет-декор), "" — выключено */
  decorFx: string;
  /** id включённых стилей оформления: сочетаются между собой */
  styleFx: string[];
  /** Уровень эффекта I…III — множитель количества частиц и амплитуды */
  fxLevel: 1 | 2 | 3;
  bio: string;
  /** Hex-подпись под ником (как у референса), пусто — генерируется сама */
  signature: string;
  /** Оформление отображаемого ника (услуга «Цвет ника») */
  nickStyle: NickStyle;
  /** id тайтлов на витрине */
  showcase: string[];
  xp: number;
  coins: number;
  /** Полученные достижения */
  claimed: string[];
  /** Ключ дня и полученные квесты за этот день */
  questDay: string;
  quests: string[];
  /** Серия дней с выполненными квестами */
  streak: number;
  streakDay: string;
  gifts: ProfileGift[];
  comments: ProfileComment[];
  blacklist: string[];
  notices: ProfileNotice[];
  /** Косметика, купленная за монеты */
  purchased: string[];
  privacy: PrivacySettings;
}

const EMPTY: ProfileState = {
  avatar: "",
  avatarHistory: [],
  backgroundId: "preset-dusk",
  backgroundCustom: "",
  titleId: "",
  extraTitleIds: [],
  extraTagIds: [],
  frameId: "",
  particleFx: "",
  decorFx: "",
  styleFx: [],
  fxLevel: 1,
  bio: "",
  signature: "",
  nickStyle: DEFAULT_NICK_STYLE,
  showcase: [],
  xp: 0,
  coins: 0,
  claimed: [],
  questDay: "",
  quests: [],
  streak: 0,
  streakDay: "",
  gifts: [],
  comments: [],
  blacklist: [],
  notices: [],
  purchased: [],
  privacy: {
    profilePublic: true,
    showStats: true,
    showAchievements: true,
    showHistory: true,
    showComments: true,
    acceptFriends: true,
    scope: "public",
  },
};

function parse(raw: string): ProfileState | null {
  try {
    const parsed = JSON.parse(raw) as Partial<ProfileState>;
    if (!parsed || typeof parsed !== "object") return null;
    const privacy = (parsed.privacy ?? {}) as Partial<PrivacySettings>;
    const list = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
    return {
      ...EMPTY,
      ...parsed,
      showcase: list<string>(parsed.showcase).filter((id) => typeof id === "string").slice(0, 6),
      extraTitleIds: list<string>(parsed.extraTitleIds).filter((id) => typeof id === "string").slice(0, 11),
      extraTagIds: list<string>(parsed.extraTagIds).filter((id) => typeof id === "string").slice(0, 28),
      avatarHistory: list<string>(parsed.avatarHistory).filter((v) => typeof v === "string").slice(0, 8),
      particleFx: typeof parsed.particleFx === "string" ? parsed.particleFx : "",
      decorFx: typeof parsed.decorFx === "string" ? parsed.decorFx : "",
      /* Стили сочетаются, но список всё равно ограничен: иначе в разметку
         попадёт мусор из старого хранилища, а classes не ограничены. */
      styleFx: list<string>(parsed.styleFx).filter((id) => typeof id === "string").slice(0, 4),
      fxLevel: isEffectLevel(parsed.fxLevel) ? parsed.fxLevel : 1,
      /* Оформление ника нормализуется: из старого хранилища могли остаться
         кривые цвета или скорость 0 — и градиент просто не рисовался бы. */
      nickStyle: normalizeNickStyle(parsed.nickStyle),
      claimed: list<string>(parsed.claimed),
      quests: list<string>(parsed.quests),
      gifts: list<ProfileGift>(parsed.gifts),
      comments: list<ProfileComment>(parsed.comments),
      blacklist: list<string>(parsed.blacklist),
      notices: list<ProfileNotice>(parsed.notices),
      purchased: list<string>(parsed.purchased),
      privacy: {
        profilePublic: privacy.profilePublic ?? true,
        showStats: privacy.showStats ?? true,
        showAchievements: privacy.showAchievements ?? true,
        showHistory: privacy.showHistory ?? true,
        showComments: privacy.showComments ?? true,
        acceptFriends: privacy.acceptFriends ?? true,
        scope:
          privacy.scope === "friends" || privacy.scope === "private"
            ? privacy.scope
            : privacy.scope === "public" || privacy.scope === undefined
              ? privacy.profilePublic === false
                ? "private"
                : "public"
              : "public",
      },
    };
  } catch {
    return null;
  }
}

export const profileStore = createLocalStore<ProfileState>(
  "animehub:profile:v1",
  EMPTY,
  parse,
);

export function useProfile(): ProfileState {
  return profileStore.useStore();
}

/* ------------------------------ Мутации ------------------------------ */

export function updateProfile(patch: Partial<ProfileState>): void {
  profileStore.update((state) => ({ ...state, ...patch }));
}

function pushNotice(state: ProfileState, text: string): ProfileState {
  const notice: ProfileNotice = { id: localId("n"), text, at: Date.now(), read: false };
  return { ...state, notices: [notice, ...state.notices].slice(0, 40) };
}

/**
 * Запись в раздел «Уведомления» (§12.6) для событий движка прогрессии:
 * LEVEL_UP / ACHIEVEMENT_UNLOCKED / TAG_UNLOCKED. Движок про профиль ничего
 * не знает — сообщение собирает вызывающая сторона (service.applySideEffects).
 */
export function addNotice(text: string): void {
  // Уведомления только у вошедших игроков (ключ аккаунта — тот же, что в auth.ts)
  if (typeof window !== "undefined" && !window.localStorage.getItem("animehub:account:v1")) return;
  profileStore.update((state) => pushNotice(state, text));
}

/** Начисляет XP и возвращает true, если уровень вырос */
export function addXp(amount: number): boolean {
  if (amount <= 0) return false;
  const before = profileStore.get().xp;
  const levelBefore = levelInfo(before).level;
  let leveledUp = false;
  profileStore.update((state) => {
    const xp = state.xp + amount;
    const info = levelInfo(xp);
    let next: ProfileState = { ...state, xp };
    if (info.level > levelBefore) {
      leveledUp = true;
      next = pushNotice(
        next,
        `Новый уровень ${info.level}! Открыта «эра: ${info.era}».`,
      );
    }
    return next;
  });
  return leveledUp;
}

export function addCoins(amount: number): void {
  if (amount <= 0) return;
  profileStore.update((state) => ({ ...state, coins: state.coins + amount }));
}

/** Списывает монеты; false — если не хватает */
export function spendCoins(amount: number): boolean {
  const state = profileStore.get();
  if (amount <= 0 || state.coins < amount) return false;
  profileStore.update((current) => ({ ...current, coins: current.coins - amount }));
  return true;
}

/** Покупка предмета за монеты; false — если уже куплен или не хватает */
export function purchaseItem(id: string, price: number): boolean {
  const state = profileStore.get();
  if (state.purchased.includes(id) || state.coins < price) return false;
  profileStore.update((current) => ({
    ...current,
    coins: current.coins - price,
    purchased: [...current.purchased, id],
  }));
  return true;
}

export function pushGift(gift: Omit<ProfileGift, "id" | "at" | "claimed">): void {
  profileStore.update((state) => ({
    ...state,
    gifts: [{ ...gift, id: localId("g"), at: Date.now(), claimed: false }, ...state.gifts].slice(0, 40),
  }));
}

export function claimGift(id: string): void {
  profileStore.update((state) => {
    const gift = state.gifts.find((item) => item.id === id);
    if (!gift || gift.claimed) return state;
    return {
      ...state,
      coins: state.coins + gift.coins,
      gifts: state.gifts.map((item) => (item.id === id ? { ...item, claimed: true } : item)),
    };
  });
}

/** Отметка полученного достижения (награду начисляет вызывающая сторона) */
export function markClaimed(achievementId: string): void {
  profileStore.update((state) =>
    state.claimed.includes(achievementId)
      ? state
      : { ...state, claimed: [...state.claimed, achievementId] },
  );
}

/* --------------------------- Дневные квесты --------------------------- */

/** Сбрасывает список выполненных квестов при смене дня */
export function rollQuests(): void {
  const today = dayKey();
  profileStore.update((state) =>
    state.questDay === today ? state : { ...state, questDay: today, quests: [] },
  );
}

export function claimQuest(questId: string, xp: number, coins: number): void {
  profileStore.update((state) => {
    const today = dayKey();
    const fresh = state.questDay === today ? state.quests : [];
    if (fresh.includes(questId)) return state;

    // Серия дней: вчерашний день продолжает серию, пропуск — сброс
    const yesterday = dayKey(new Date(Date.now() - 86_400_000));
    const streak = state.streakDay === yesterday ? state.streak + 1 : state.streakDay === today ? state.streak : 1;

    return {
      ...state,
      questDay: today,
      quests: [...fresh, questId],
      xp: state.xp + xp,
      coins: state.coins + coins,
      streak,
      streakDay: today,
    };
  });
}

export function isQuestClaimed(state: ProfileState, questId: string): boolean {
  return state.questDay === dayKey() && state.quests.includes(questId);
}

/* ------------------------------ Комментарии ---------------------------- */

/** Добавляет комментарий на стену и возвращает его id (null — если пусто) */
export function addComment(
  author: string,
  text: string,
  opts: { spoiler?: boolean; parentId?: string } = {},
): string | null {
  const clean = normalizeCommentText(text);
  if (!clean) return null;
  const id = localId("c");
  profileStore.update((state) => ({
    ...state,
    comments: [
      {
        id,
        author,
        text: clean,
        at: Date.now(),
        spoiler: opts.spoiler || undefined,
        parentId: opts.parentId,
      },
      ...state.comments,
    ].slice(0, 60),
  }));
  return id;
}

export function removeComment(id: string): void {
  profileStore.update((state) => ({
    ...state,
    comments: state.comments.filter((item) => item.id !== id),
  }));
}

/**
 * Движок отклонил награду за комментарий (качество/дубль/кулдаун):
 * при удалении такого комментария событие COMMENT_REMOVED не шлём,
 * чтобы не откатывать несуществующую награду.
 */
export function markCommentNoReward(id: string): void {
  profileStore.update((state) => ({
    ...state,
    comments: state.comments.map((item) =>
      item.id === id ? { ...item, xpGranted: false } : item,
    ),
  }));
}

/** Локальный голос на стене — без событий движка (LIKE_* выключены) */
export function voteComment(id: string, vote: "up" | "down"): void {
  profileStore.update((state) => ({
    ...state,
    comments: state.comments.map((item) => (item.id === id ? applyVote(item, vote) : item)),
  }));
}

/* --------------------------- Чёрный список ---------------------------- */

export function addBlocked(nickname: string): void {
  const clean = nickname.trim().slice(0, 32);
  if (!clean) return;
  profileStore.update((state) =>
    state.blacklist.some((item) => item.toLowerCase() === clean.toLowerCase())
      ? state
      : { ...state, blacklist: [...state.blacklist, clean] },
  );
}

export function removeBlocked(nickname: string): void {
  profileStore.update((state) => ({
    ...state,
    blacklist: state.blacklist.filter((item) => item !== nickname),
  }));
}

/* ------------------------------ Уведомления ---------------------------- */

export function markNoticesRead(): void {
  profileStore.update((state) =>
    state.notices.some((notice) => !notice.read)
      ? { ...state, notices: state.notices.map((notice) => ({ ...notice, read: true })) }
      : state,
  );
}

export function setNoticeRead(id: string, read: boolean): void {
  profileStore.update((state) => ({
    ...state,
    notices: state.notices.map((notice) => (notice.id === id ? { ...notice, read } : notice)),
  }));
}

export function removeNotice(id: string): void {
  profileStore.update((state) => ({
    ...state,
    notices: state.notices.filter((notice) => notice.id !== id),
  }));
}

export function clearNotices(): void {
  profileStore.update((state) => (state.notices.length ? { ...state, notices: [] } : state));
}

export function unreadCount(state: ProfileState): number {
  return state.notices.filter((notice) => !notice.read).length;
}

/* ------------------------------ Витрина -------------------------------- */

export function toggleShowcase(id: string): void {
  profileStore.update((state) => {
    const inside = state.showcase.includes(id);
    const next = inside
      ? state.showcase.filter((item) => item !== id)
      : [...state.showcase, id].slice(0, 6);
    return { ...state, showcase: next };
  });
}

/* ------------------------------- Подпись -------------------------------- */

const HEX = "0123456789ABCDEF";

/**
 * Hex-подпись под ником. Задана в профиле — используется как есть,
 * иначе детерминированно выводится из ника и даты регистрации.
 */
export function signatureFor(state: ProfileState, nickname: string, createdAt: number): string {
  if (state.signature) return state.signature.toUpperCase().replace(/\s+/g, "");
  let seed = Math.floor(createdAt / 1000) + nickname.length * 31;
  let out = "";
  for (let i = 0; i < 32; i += 1) {
    seed = (seed * 1103515245 + 12345 + i * 7919) % 2147483647;
    out += HEX[seed % 16];
  }
  return out;
}

/** Каноничный вид: группы по 4 символа */
export function groupSignature(value: string): string[] {
  const clean = value.toUpperCase().replace(/[^0-9A-F]/g, "");
  const out: string[] = [];
  for (let i = 0; i < clean.length; i += 4) out.push(clean.slice(i, i + 4));
  return out;
}
