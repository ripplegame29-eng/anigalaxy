/**
 * Типы RPG-прогрессии AniGalaxy.
 *
 * Четыре независимые сущности (не смешивать):
 *   XP  — необратимо растущий прогресс;
 *   AC  — внутренняя валюта (Anime Coins), только косметика и сервисы;
 *   Достижение — память о подвиге, хранится вечно;
 *   Тег — отображаемый статус у ника, активен один.
 *
 * Движок (`engine.ts`) чистый: (doc, event, metrics, ctx) → (doc, effects).
 * Здесь — только контракты данных; всё наполняется `progression.config.ts`.
 */

import type { NickAddons, NickStyle } from "../nickname";

/* ------------------------------ Базовые ------------------------------- */

export type Rarity =
  | "COMMON"
  | "UNCOMMON"
  | "RARE"
  | "EPIC"
  | "LEGENDARY"
  | "MYTHIC"
  | "SECRET";

/** Порядок редкостей (для сортировки и «самого редкого») */
export const RARITY_ORDER: Rarity[] = [
  "COMMON",
  "UNCOMMON",
  "RARE",
  "EPIC",
  "LEGENDARY",
  "MYTHIC",
  "SECRET",
];

export type Currency = "XP" | "AC";

/** ACTIVITY подчиняется soft-cap, EXEMPT — награды вне soft-cap */
export type RuleClass = "ACTIVITY" | "EXEMPT";

/** Режим хранилища (флагом в конфиге, логика не зависит от режима) */
export type StorageMode = "local" | "server";

/** Списки тайтлов ( XP даёт только первое добавление в каждый список ) */
export type ListKind = "favorite" | "planned" | "watched";

export type ShopKind = "tag" | "frame" | "background" | "effect" | "service" | "title" | "custom";

/** Линии наград боевого пропуска */
export type BattlepassLine = "free" | "premium";

/* ------------------------------ События -------------------------------- */

export type ProfileField = "avatar" | "bio" | "genres" | "showcase";

/**
 * Доменные события. Клиент шлёт СОБЫТИЯ («серия досмотрена»),
 * а не «дай 1000 XP» — награду считает движок по конфигу.
 */
export type DomainEvent =
  /** Первый вход за календарный день пользователя (серия, дни, AC) */
  | { type: "SESSION_START"; tz?: string; at?: number }
  /**
   * Heartbeat плеера: 1 раз в 15 с, пока вкладка активна.
   * `durationSec`/`episodeIndex`/`isFinal`/`genres` — контекст, который умеет
   * только UI (iframe Kodik движку не доступен): по ним движок сам считает
   * засчёт серии, первый осмысленный просмотр и завершение тайтла.
   */
  | {
      type: "EPISODE_TICK";
      titleId: string;
      episodeKey: string;
      seconds: number;
      visible: boolean;
      speed: number;
      at?: number;
      /** Длительность серии, с (из данных тайтла Kodik) */
      durationSec?: number;
      /** Номер серии в тайтле (для детекции финала) */
      episodeIndex?: number;
      /** Это последняя вышедшая серия и тайтл завершён */
      isFinal?: boolean;
      genres?: string[];
    }
  /** Серия открыта в плеере (факт старта сессии) */
  | {
      type: "EPISODE_OPENED";
      titleId: string;
      episodeKey: string;
      at?: number;
      durationSec?: number;
      episodeIndex?: number;
      isFinal?: boolean;
      genres?: string[];
    }
  /** Тайтл просмотрен осмысленно (первая серия ≥ 20%) */
  | { type: "TITLE_WATCHED"; titleId: string; genres?: string[]; at?: number }
  /** Тайтл завершён (все вышедшие серии) */
  | { type: "TITLE_COMPLETED"; titleId: string; genres?: string[]; at?: number }
  /** Добавление в список */
  | { type: "LIST_ADD"; titleId: string; list: ListKind; at?: number }
  /** Оценка тайтла (изменение оценки XP не даёт) */
  | { type: "TITLE_RATED"; titleId: string; score: number; at?: number }
  /** Валидный комментарий (качество проверяет сервис до выдачи XP) */
  | { type: "COMMENT_ADDED"; commentId: string; text: string; at?: number }
  /** Удаление комментария → реверс награды */
  | { type: "COMMENT_REMOVED"; commentId: string; at?: number }
  /** Ответ на чужой комментарий */
  | { type: "COMMENT_REPLIED"; commentId: string; targetId: string; text: string; at?: number }
  /** Поставленный лайк (в режиме local выключен в конфиге) */
  | { type: "LIKE_GIVEN"; commentId: string; authorId: string; at?: number }
  /** Полученный лайк от уникального пользователя */
  | { type: "LIKE_RECEIVED"; commentId: string; fromId: string; at?: number }
  /** Одноразовое заполнение поля профиля */
  | { type: "PROFILE_FIELD"; field: ProfileField; at?: number }
  /** Профиль заполнен на 100% */
  | { type: "PROFILE_COMPLETED"; at?: number }
  /** Квест забран вручную */
  | { type: "QUEST_CLAIMED"; questId: string; at?: number }
  /** Покупка за AC (атомарно: списание + выдача) */
  | { type: "SHOP_PURCHASED"; itemId: string; kind: ShopKind; price: number; at?: number }
  /**
   * Смена отображаемого ника (услуга `svc_nick`).
   *
   * Логин и ссылка на профиль при этом не меняются — меняется только имя,
   * которое видно в профиле и комментариях. Само имя записывает UI в
   * аккаунт (`lib/auth.ts`) после того, как движок принял событие: движок
   * отвечает за AC, хранилище аккаунта — не его дело.
   */
  | { type: "NICKNAME_RENAMED"; nickname: string; price: number; at?: number }
  /**
   * Применение оформления ника (услуга `svc_color`).
   *
   * Цена — базовая плюс наценки за градиент, переливание и свечение; движок
   * пересчитывает её сам по конфигу, клиент присылает только «сколько вышло».
   */
  | { type: "NICK_COLOR_SET"; style: NickStyle; price: number; at?: number }
  | { type: "TOME_PURCHASED"; tomeId: string; price: number; at?: number }
  /** Экипирован тег */
  | { type: "TAG_EQUIPPED"; tagId: string; at?: number }
  /** Тег снят (§12.3: кнопка «Снять») */
  | { type: "UNEQUIP_TAG"; at?: number }
  /** Активирован Premium */
  | { type: "PREMIUM_ACTIVATED"; days: number; at?: number }
  /** Пасхалка: клик по скрытому элементу (target — имя элемента) */
  | { type: "EASTER_EGG"; target: string; at?: number }
  /** Выдача/изъятие админом (в local — через dev-панель, с причиной) */
  | { type: "ADMIN_GRANT"; currency: Currency; amount: number; reason: string; at?: number }
  /** Dev-панель: подкрутка счётчика для тестов */
  | { type: "DEV_ADJUST"; metric: string; delta: number; at?: number }
  /** Dev-панель: ручная выдача тега (та же дорога, что и за уровень/достижение) */
  | { type: "DEV_TAG_GRANTED"; tagId: string; at?: number }
  /**
   * Новый аккаунт зарегистрировался по реферальной ссылке.
   *
   * Клиент шлёт только код пригласившего и ник новичка: сумму и право
   * выдачи считает движок по конфигу (`economy.referralXp/Ac`), а
   * идемпотентность — ключ `REF:<refCode>:<newNick>`, чтобы повторная
   * регистрация с того же аккаунта не начисляла награду дважды.
   */
  | { type: "REFERRAL_REGISTERED"; refCode: string; newNick: string; at?: number }
  /**
   * Забрать награду уровня боевого пропуска: клиент шлёт только линию и
   * номер уровня — суммы, предметы и право выдачи считает движок по
   * конфигу сезона (`lib/battlepass`), идемпотентность — ключ в журнале.
   */
  | { type: "BATTLEPASS_CLAIMED"; line: BattlepassLine; level: number; at?: number }
  /**
   * Вклад AC в клан. Сумму считает клановая логика (сколько реально
   * поместилось в клетки), движок только проверяет баланс и списывает.
   */
  | { type: "CLAN_CONTRIBUTED"; amount: number; at?: number }
  /**
   * Награда за уровень клана: AC начисляет движок, идемпотентность — по
   * номеру уровня, чтобы повторное открытие сундука не удвоило выплату.
   */
  | { type: "CLAN_REWARD_CLAIMED"; level: number; amount: number; at?: number }
  /**
   * Личная награда из сундука сокровищницы. `key` — ключ открытия
   * (`chest:<tier>:<n>`): повторная выдача по тому же ключу отклоняется.
   */
  | { type: "CLAN_CHEST_REWARD"; key: string; amount: number; at?: number };

export type EventType = DomainEvent["type"];

/* ------------------------------ Эффекты -------------------------------- */

/**
 * Возвращаются движком. UI превращает их в тосты/записи уведомлений —
 * сам движок про UI ничего не знает.
 */
export type ProgressEffect =
  | {
      type: "XP_GAINED";
      /** Сколько запрошено по правилу */
      raw: number;
      /** Сколько зачислено с учётом soft-cap */
      credited: number;
      source: string;
      ruleClass: RuleClass;
      /** Был ли применён множитель soft-cap (×0.25) */
      reduced: boolean;
    }
  | { type: "AC_GAINED"; amount: number; source: string }
  | { type: "AC_SPENT"; amount: number; source: string; balance: number }
  | { type: "LEVEL_UP"; level: number; era: string; eraChanged: boolean; acReward: number }
  | {
      type: "ACHIEVEMENT_UNLOCKED";
      id: string;
      xp: number;
      ac: number;
      tagId?: string;
      frameId?: string;
      trophy: number;
      secret: boolean;
    }
  | { type: "TAG_UNLOCKED"; tagId: string; source: string }
  | { type: "QUEST_DONE"; questId: string; xp: number; ac: number }
  | { type: "STREAK_CHANGED"; current: number; best: number; freezeUsed: boolean }
  | {
      type: "REWARD_REVERSED";
      entryId: string;
      currency: Currency;
      amount: number;
      reason: string;
    }
  | { type: "ITEM_GRANTED"; itemId: string; kind: ShopKind }
  | {
      type: "BATTLEPASS_CLAIMED";
      line: BattlepassLine;
      level: number;
      /** Сколько AC начислено пакетом (включая компенсации за дубли) */
      ac: number;
      /** Сколько XP боевого пропуска начислено пакетом */
      bpXp: number;
      /** Выданные предметы (duplicate — вместо предмета начислен AC) */
      items: Array<{ id: string; kind: "tag" | "frame"; duplicate: boolean }>;
      /** XP пропуска после выдачи */
      xpAfter: number;
      /** Уровень пропуска после выдачи */
      levelAfter: number;
    };

/* --------------------------- Журнал наград ----------------------------- */

/**
 * USER_REWARDS_LOG — append-only журнал. Любая отмена/забирание/реверс —
 * НОВАЯ запись (`reversesId`), удаления записей не бывает.
 */
export interface LedgerEntry {
  /** id записи */
  id: string;
  currency: Currency;
  /** Тип операции: ruleId / reward id / purchase id / admin */
  type: string;
  /** Источник (EP_COMPLETE, ACHIEVEMENT, SHOP, DAILY_LOGIN, ...) */
  source: string;
  /** +начисление, −списание */
  amount: number;
  status: "confirmed" | "pending" | "reversed";
  /** Если запись — реверс, id исходной записи */
  reversesId?: string;
  /** `<ruleId>:<userId>:<entityId>[:<period>]` — UNIQUE */
  idempotencyKey: string;
  createdAt: number;
  metadata?: Record<string, string | number | boolean>;
}

/* ------------------------------ Прогресс ------------------------------- */

export interface UserProgress {
  userId: string;
  xpTotal: number;
  level: number;
  acBalance: number;
  streakCurrent: number;
  streakBest: number;
  /** Заморозки серии (покупка, максимум 2) */
  streakFreezes: number;
  /** Календарный день последней активности (YYYY-MM-DD в tz пользователя) */
  lastActiveDate: string;
  /** Часовой пояс пользователя */
  tz: string;
  /** Экипированный тег (событие TAG_EQUIPPED). Рамки/фоны живут в профиле. */
  equippedTagId: string | null;
  trophyPoints: number;
  createdAt: number;
}

/** Дневные и недельные счётчики (лимиты, soft-cap, квесты) */
export interface DailyState {
  /** Календарный день (индекс суток в tz пользователя) */
  date: number;
  /** Неделя (индекс недели в tz пользователя) */
  week: number;
  /** Сколько ACTIVITY-XP уже начислено сегодня */
  xpActivity: number;
  /** Сколько XP начислено сегодня вообще (для секрета «Перегрузка») */
  xpTotal: number;
  /** Сколько секунд досмотрено сегодня — из этого растёт рекорд суток */
  secondsWatched: number;
  /** Счётчики за день: EP_COMPLETE:3, LIST_ADD:7, COMMENT:2, ... */
  counts: Record<string, number>;
  /** Счётчики за неделю (для недельных квестов) */
  weekCounts: Record<string, number>;
}

export interface QuestInstance {
  /** id определения квеста из конфига */
  questId: string;
  progress: number;
  done: boolean;
  claimed: boolean;
}

export interface QuestState {
  /** День, к которому относится daily-набор */
  day: number;
  daily: QuestInstance[];
  /** Неделя (индекс) для weekly-набора */
  week: number;
  weekly: QuestInstance[];
}

/** Состояние боевого пропуска (отдельная сущность: свой XP и свои отметки) */
export interface BattlepassState {
  /** id сезона, к которому относится XP (смена сезона — очистка) */
  season: string;
  /** XP боевого пропуска (продвигает по 100 уровням, не трогает XP профиля) */
  xp: number;
  /** Ключи полученных пакетов: `<season>:<line>:<level>` */
  claimed: string[];
}

/** Сессия просмотра серии (heartbeat-накопление) */
export interface WatchSession {
  /** `<titleId>:<episodeKey>` — одна активная сессия на серию */
  key: string;
  titleId: string;
  episodeKey: string;
  /** Накопленные секунды реального присутствия */
  watchedSeconds: number;
  firstAt: number;
  lastAt: number;
  maxSpeed: number;
  /** Серия засчитана (награда выдана) */
  completedAt?: number;
}

export interface AchievementState {
  progress: number;
  unlockedAt: number;
  /** Разблокировано миграцией из старой системы (награда не выдавалась) */
  migrated?: boolean;
}

export interface TagState {
  acquiredAt: number;
  source: string;
}

export interface PurchaseRecord {
  itemId: string;
  kind: ShopKind;
  price: number;
  at: number;
}

/** Состояние rate-limit (защита от потока событий) */
export interface RateState {
  /** Начало окна, мс */
  windowStart: number;
  count: number;
}

/**
 * Единый документ прогрессия. Один ключ localStorage — одна атомарная
 * запись: состояние, счётчики, журнал и идемпотентность не расходятся.
 */
export interface ProgressDoc {
  schema: number;
  progress: UserProgress;
  /** Lifetime-счётчики (EPISODES_COMPLETED, DISTINCT_DAYS, ...) */
  counters: Record<string, number>;
  /** Множества (жанры завершённых тайтлов) */
  sets: {
    genres: string[];
    /**
     * id тайтлов по жанрам: `genreTitles["Сёнэн"] = ["12","88",…]`.
     *
     * Хранятся именно id, а не счётчик: один и тот же тайтл присылает
     * `TITLE_COMPLETED` больше одного раза, и счётчик на месте события
     * посчитал бы его дважды. Со списком id повтор отсекается честно.
     */
    genreTitles: Record<string, string[]>;
  };
  daily: DailyState;
  quests: QuestState;
  /**
   * Боевой пропуск: свой XP (не путать с `progress.xpTotal` — это опыт
   * профиля) и отметки полученных пакетов наград. Одна запись в общем
   * документе — идемпотентность не разъезжается с балансом.
   */
  battlepass: BattlepassState;
  /** Активные/недавние сессии просмотра */
  sessions: WatchSession[];
  achievements: Record<string, AchievementState>;
  tags: Record<string, TagState>;
  purchases: PurchaseRecord[];
  /** USER_REWARDS_LOG (последние N записей — ограничение режима local) */
  ledger: LedgerEntry[];
  /** Флаги секретов и пасхалок */
  flags: Record<string, number>;
  rate: RateState;
  /** Отклонённые события с причиной (антиабьюз-лог) */
  rejected: Array<{ at: number; type: string; reason: string }>;
  meta: {
    configVersion: number;
    lastEventAt: number;
    /** Сколько событий обработано (для dev-панели) */
    events: number;
    /** Миграция из старых ключей выполнена */
    migrated?: boolean;
    /** Высокие отметки legacy-профиля, уже перенесённые в документ */
    legacy?: { xp: number; ac: number; streak: number };
  };
}

/* --------------------------- Определения (конфиг) ----------------------- */

export interface LevelConfig {
  base: number;
  exponent: number;
  maxLevel: number;
}

export interface SoftCapConfig {
  /** До этого предела ACTIVITY-XP 100% */
  dailyXp: number;
  /** Выше предела — доля */
  overRate: number;
  /** Абсолютиный потолок ACTIVITY в сутки */
  hardCap: number;
}

export interface XpRule {
  /** Класс (влияет на soft-cap) */
  ruleClass: RuleClass;
  /** XP за событие (базовое) */
  xp: number;
  /** AC за событие (0 если нет) */
  ac?: number;
  /** Множитель выходных/сезона (не обходит лимиты и hardCap) */
  multiplier?: number;
  /** Сколько раз в сутки это правило вообще может дать XP */
  perDay?: number;
  /** Сколько XP в сутки максимум по правилу (для лайков) */
  xpPerDay?: number;
  /** Ключ идемпотентности: 'entity' | 'day' | 'none' */
  repeat?: "entity" | "day" | "none";
  /**
   * Бакет для дневных/недельных счётчиков (по умолчанию — id правила).
   * Позволяет считать «все добавления в списки» одним числом (LIST_ADD),
   * не ломая лимиты, привязанные к конкретному правилу.
   */
  bucket?: string;
  /** Включено (false — правило есть в данных, но выключено, напр. лайки в local) */
  enabled?: boolean;
  /** Пояснение для dev-панели/журнала */
  note?: string;
}

export interface EraDef {
  /** С какого уровня */
  from: number;
  name: string;
}

export interface LevelTagDef {
  level: number;
  tagId: string;
}

export interface AchievementReward {
  xp: number;
  ac: number;
  tagId?: string;
  frameId?: string;
}

export interface AchievementDef {
  /** `ach_*` */
  id: string;
  /** Семейство (для группировки и ступени) */
  family: string;
  name: string;
  description: string;
  /** Сколько трофейных очков даёт */
  trophy: number;
  rarity: Rarity;
  condition: {
    /** Ключ в снапшоте метрик */
    metric: string;
    threshold: number;
  };
  reward: AchievementReward;
  /** Секрет: до получения показывается как «???» */
  hidden?: boolean;
  /** Выключено (например, требует серверного режима) */
  enabled?: boolean;
  /** Статус старой системы для миграции */
  legacyIds?: string[];
}

export interface TagVisual {
  /** Две опорные палитры предмета */
  c: string;
  c2: string;
  /** Библиотека эффектов из ag-tag.css (`.fx-*`) */
  effects: string[];
  /** Тип текста: plain | glitch | neon | metal | tremor */
  text?: string;
  /**
   * Иконка тега — ручная SVG-разметка 24×24 (только фигуры stroke:
   * path/circle/rect/ellipse/line), рендерится внутри `<svg viewBox="0 0 24 24">`.
   * У каждого из 29 тегов иконка своя (проверяется тестом).
   */
  icon: string;
}

export interface TagDef {
  /** `tag_*` */
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  source: "level" | "achievement" | "shop" | "referral" | "event" | "secret";
  /** Цена в магазине (только source === 'shop') */
  price?: number;
  /** Уровень, с которого открывается (source === 'level') */
  level?: number;
  /** Сколько приглашённых друзей нужно (source === 'referral') */
  friends?: number;
  /** Достижение, которым открывается (source === 'achievement' | 'secret') */
  achievementId?: string;
  visual: TagVisual;
  /** Для сезонных событий */
  seasonId?: string;
  enabled?: boolean;
}

export interface QuestDef {
  /** `qd_*` / `qw_*` */
  id: string;
  title: string;
  description: string;
  /** Метрика для прогресса (ключ снапшота) */
  metric: string;
  target: number;
  unit: string;
  xp: number;
  ac: number;
  enabled?: boolean;
}

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  kind: ShopKind;
  /** Цена в AC (для service — напр. «заморозка») */
  price: number;
  /** Редкость предмета (для отображения) */
  rarity: Rarity;
  /** Максимум покупок (1 — одноразово; заморозка — 2) */
  maxOwned?: number;
  enabled?: boolean;
}

/**
 * Том опыта: разовый платный бустер XP за AC.
 *
 * Отдельный список, а не магазин: у тома нет предмета в гардеробе, есть
 * срок жизни (сутки) и порог уровня. XP идёт мимо soft-cap — оплачено.
 */
export interface XpTomeDef {
  id: string;
  name: string;
  /** Сколько опыта даёт том */
  xp: number;
  /** Цена в AC */
  price: number;
  rarity: Rarity;
  /** С уровня какого открывается (не задан — с первого) */
  fromLevel?: number;
  /** Сколько раз в сутки можно купить (по умолчанию 1) */
  perDay?: number;
  /** Акцентный цвет карточки */
  accent: string;
  enabled?: boolean;
}

export interface SeasonDef {
  id: string;
  name: string;
  /** Диапазон активности, мс */
  from: number;
  to: number;
  /** Множитель XP для ACTIVITY-правил (не обходит cap) */
  xpMultiplier: number;
  /** Бонус AC к ежедневному входу */
  acBonus: number;
  enabled?: boolean;
}

export interface RankDef {
  /** Порог трофейных очков */
  from: number;
  name: string;
}

/** Правила зачёта серии (§4.3): heartbeat-присутствие, а не позиция ползунка */
export interface WatchConfig {
  /** Как часто плеер шлёт heartbeat, с */
  heartbeatSec: number;
  /** Зазор без heartbeat дольше этого — пауза, с */
  gapPauseSec: number;
  /** Доля времени, которую нужно набрать для засчитывания серии */
  requiredFraction: number;
  /** Номинал серии, если Kodik не отдал длительность, с */
  nominalEpisodeSec: number;
  /** Серии короче этого не считаются эпизодом, с */
  minEpisodeSec: number;
  /** Максимальная скорость (серверный режим; iframe-плеер её не отдаёт) */
  maxSpeed: number;
}

export interface EconomyConfig {
  /** Ежедневный вход */
  dailyLoginXp: number;
  dailyLoginAc: number;
  /** Бонус каждые 7 дней серии */
  streakEveryDays: number;
  streakBonusAc: number;
  /** Награда за уровень: AC = levelAcBase + levelAcPerLevel × L */
  levelAcBase: number;
  levelAcPerLevel: number;
  /** Бонус каждый 10-й уровень: levelAcEvery10 × (L / 10) */
  levelAcEvery10: number;
  /** Подарок за новый уровень: выпадает при LEVEL_UP, забирается вручную */
  levelGiftAc: number;
  levelGiftName: string;
  levelGiftHint: string;
  /** Награда за приглашённого друга (раздел «Пригласи друзей») */
  referralXp: number;
  referralAc: number;
  /** Дней Premium сверху: пригласившему продлевают подписку */
  referralPremiumDays: number;
  /** Стоимость «заморозки серии» и лимит */
  freezePrice: number;
  freezeMax: number;
  /** Ориентир «окупаемости»: сколько AC в среднем за день */
  dailyAcEstimate: number;
}

/** Профиль темпа для балансового симулятора (§5) */
export interface SimProfile {
  id: string;
  label: string;
  /** Среднесуточный XP активности профиля (§5: 90 / 220 / 600) */
  xpPerDay: number;
}

/** Целевой коридор §5: дни, в которые игрок профиля должен достичь уровня */
export interface SimTarget {
  /** id профиля из `sim.profiles` */
  profile: string;
  level: number;
  /** Нижняя граница окна в днях (для точных ориентиров — равна верхней) */
  minDays: number;
  /** Верхняя граница окна в днях */
  maxDays: number;
}

export interface SimConfig {
  /** Допуск §5 к каждому коридору (0.25 = ±25%) */
  tolerance: number;
  /**
   * Форма накопления одноразового пула XP достижений: доля пути к L100 в
   * степень `shape`. Большие награды сидят на поздних порогах (1000–2000 серий,
   * 365 дней и серий, 500 оценок, 10 000 минут), поэтому к середине пути
   * получено заметно меньше половины пула.
   */
  achievementShape: number;
  profiles: SimProfile[];
  targets: SimTarget[];
}

/** Наценки за опции оформления ника и число бесплатных применений подписки */
export interface NicknameConfig {
  /** Сколько раз Premium покрывает услугу полностью (одноразовый флаг) */
  freeUses: number;
  addons: NickAddons;
}

export interface ProgressionConfig {
  version: number;
  /** local = LocalStore (IndexedDB недоступен синхронно в этом проекте), server — заглушка */
  storageMode: StorageMode;
  timezonePolicy: "user_tz";
  levels: LevelConfig;
  softCap: SoftCapConfig;
  economy: EconomyConfig;
  nickname: NicknameConfig;
  watch: WatchConfig;
  eras: EraDef[];
  levelTags: LevelTagDef[];
  rules: Record<string, XpRule>;
  achievements: AchievementDef[];
  tags: TagDef[];
  quests: { dailyPool: QuestDef[]; dailyPick: number; weeklyPool: QuestDef[]; weeklyPick: number };
  shop: ShopItem[];
  tomes: XpTomeDef[];
  seasons: SeasonDef[];
  ranks: RankDef[];
  /** Редкость → трофейные очки (если у достижения не заданы явно) */
  trophyByRarity: Record<Rarity, number>;
  /** Балансовый симулятор (§5, §16) — читает tools/balance-sim.mjs */
  sim: SimConfig;
}
