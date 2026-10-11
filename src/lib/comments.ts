"use client";

/**
 * Комментарии: общее ядро + хранилище комментариев тайтлов.
 *
 * Стену профиля не трогаем — она живёт в `profile.comments` (старые
 * данные и правила наград §4.1 остаются на месте). Комментарии к тайтлу
 * со страницы просмотра хранятся в `animehub:title-comments:v1`.
 *
 * Один UI (`components/comments/CommentsBlock.tsx`) работает с обоими
 * хранилищами и шлёт события движка одинаково: качество текста, кулдаун
 * и реверс при удалении от выбора хранилища не зависят.
 *
 * Демо-посев: первый визит на тайтл добавляет несколько локальных
 * комментариев-персон (честно подписано сноской в блоке), события
 * движка при этом не шлётся — без наград. Голоса 👍/👎 — локальный декор:
 * правила LIKE_* в конфиге выключены и в локальном режиме не включаются
 * (самому себе XP за лайки не начисляем — ASSUMPTIONS §22).
 *
 * Ядро — чистые функции без хранилища (тесты `tests/progression/comments.test.mjs`);
 * обёртки ниже работают через `createLocalStore`, как весь остальной сайт.
 */

import { createLocalStore, localId } from "./store";

/** Единый формат комментария (стена профиля и тайтл используют один) */
export interface CommentMsg {
  id: string;
  /** Родитель — один уровень вложенности (ответ) */
  parentId?: string;
  author: string;
  text: string;
  at: number;
  /** Текст скрыт до нажатия */
  spoiler?: boolean;
  likes?: number;
  dislikes?: number;
  myVote?: "up" | "down";
  /** false — движок отклонил награду: при удалении не откатываем */
  xpGranted?: boolean;
  /** посевной демо-комментарий: без событий движка */
  demo?: boolean;
}

/** Максимум символов в комментарии (старая норма стены) */
export const MAX_TEXT = 300;
/** Лимит комментариев на один тайтл */
export const MAX_TITLE_COMMENTS = 50;
/** Минимум символов для награды (правило сервиса §4.1) */
export const MIN_REWARD_TEXT = 20;

/* ------------------------------- Ядро ---------------------------------- */

/** Нормализация текста — та же, что была у стены: пробелы, трим, лимит */
export function normalizeCommentText(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT);
}

/** Слияние списков в один поток «сначала новые» (для кулдауна/дублей) */
export function mergeRecent(
  lists: readonly (readonly CommentMsg[])[],
  limit = 12,
): CommentMsg[] {
  const flat: CommentMsg[] = [];
  for (const list of lists) flat.push(...list);
  flat.sort((a, b) => b.at - a.at);
  return flat.slice(0, limit);
}

export type CommentSort = "new" | "old" | "top";

/** Корневые комментарии в порядке просмотра (ответы отдельно) */
export function rootsOf(list: readonly CommentMsg[], order: CommentSort): CommentMsg[] {
  const roots = list.filter((item) => !item.parentId);
  if (order === "top") {
    return roots.sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0) || b.at - a.at);
  }
  const sign = order === "old" ? 1 : -1;
  return roots.sort((a, b) => (a.at - b.at) * sign);
}

/** Ответы к корню — хронологически */
export function repliesOf(list: readonly CommentMsg[], rootId: string): CommentMsg[] {
  return list
    .filter((item) => item.parentId === rootId)
    .sort((a, b) => a.at - b.at);
}

/** id комментария + все его потомки (каскадное удаление) */
export function cascadeIds(list: readonly CommentMsg[], id: string): string[] {
  const out = [id];
  for (const item of list) {
    if (item.parentId === id) out.push(...cascadeIds(list, item.id));
  }
  return out;
}

/** Голос: повторное нажатие снимает голос, смена — переключает */
export function applyVote(item: CommentMsg, vote: "up" | "down"): CommentMsg {
  const prev = item.myVote;
  const next = prev === vote ? undefined : vote;
  return {
    ...item,
    likes: Math.max(0, (item.likes ?? 0) + (next === "up" ? 1 : 0) - (prev === "up" ? 1 : 0)),
    dislikes: Math.max(0, (item.dislikes ?? 0) + (next === "down" ? 1 : 0) - (prev === "down" ? 1 : 0)),
    myVote: next,
  };
}

/** Усечение по лимиту: старые вон, осиротевшие ответы подчищаются */
export function capList(list: readonly CommentMsg[], max = MAX_TITLE_COMMENTS): CommentMsg[] {
  if (list.length <= max) return [...list];
  const kept = [...list].sort((a, b) => b.at - a.at).slice(0, max);
  let changed = true;
  while (changed) {
    changed = false;
    const ids = new Set(kept.map((item) => item.id));
    for (let i = kept.length - 1; i >= 0; i--) {
      const parent = kept[i].parentId;
      if (parent && !ids.has(parent)) {
        kept.splice(i, 1);
        changed = true;
      }
    }
  }
  return kept.sort((a, b) => b.at - a.at);
}

/** Детерминированный хеш строки (псевдоуровень и вариативность посева) */
export function hashString(seed: string): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) hash = ((hash << 5) + hash + seed.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

/* ---------------------------- Демо-персоны ------------------------------ */

/**
 * Локальные персоны для посева и «живости» раздела. Уровень и тег —
 * декоративные (реальные уровни считаются только для текущего аккаунта),
 * теги берутся из каталога §8, чтобы капсулы выглядели как у всех.
 */
export interface DemoPersona {
  name: string;
  level: number;
  tagId: string;
  premium: boolean;
}

export const DEMO_PERSONAS: DemoPersona[] = [
  { name: "otaku_rin", level: 23, tagId: "tag_sensei", premium: true },
  { name: "senpai_aki", level: 14, tagId: "tag_tengu", premium: true },
  { name: "neko_yuki", level: 7, tagId: "tag_outcast", premium: false },
];

const SEED_TEXTS = [
  "Бинджнул за вечер, не отрывался — дальше по сюжету только интереснее.",
  "Озвучка нормальная, субтитры читаются, смотреть можно без танцев.",
  "Первая серия зашла, посмотрю ещё пару и решу, останусь ли до конца.",
  "Рисовка держится, опенинг прям на повтор поставил.",
  "Смотрю раз в неделю с релиза — семи дней явно не хватает.",
  "Сколько людей спорят о конце, столько и мнений: мне лично зашло.",
];

const SEED_SPOILER =
  "Спойлер: досмотрите до конца титров, там сцена, ради которой стоит поглядеть.";
const SEED_REPLY =
  "Тоже такая история: второй раз пересматриваю уже с субтитрами и не жалею.";

/**
 * Демо-посев тайтла: 3 корня (один со спойлером) + ответ. Идемпотентен
 * по id — один и тот же тайтл всегда даёт одинаковый набор, повторный
 * вызов не перезаписывает (см. `seedTitleComments`).
 */
export function buildDemoSeed(titleId: string, now: number): CommentMsg[] {
  const h = hashString(titleId);
  const min = 60_000;
  const hour = 3_600_000;
  const root: CommentMsg = {
    id: `demo:${titleId}:a`,
    author: DEMO_PERSONAS[0].name,
    text: SEED_TEXTS[h % SEED_TEXTS.length],
    at: now - 45 * min,
    demo: true,
  };
  const reply: CommentMsg = {
    id: `demo:${titleId}:r`,
    parentId: root.id,
    author: DEMO_PERSONAS[2].name,
    text: SEED_REPLY,
    at: now - 42 * min,
    demo: true,
  };
  const spoiler: CommentMsg = {
    id: `demo:${titleId}:s`,
    author: DEMO_PERSONAS[1].name,
    text: SEED_SPOILER,
    spoiler: true,
    at: now - 3 * hour,
    demo: true,
  };
  const third: CommentMsg = {
    id: `demo:${titleId}:c`,
    author: DEMO_PERSONAS[(h >> 3) % DEMO_PERSONAS.length].name,
    text: SEED_TEXTS[(h >> 5) % SEED_TEXTS.length],
    at: now - 7 * hour,
    demo: true,
  };
  return [root, reply, spoiler, third];
}

/* ----------------------------- Хранилище ------------------------------- */

export const TITLE_COMMENTS_KEY = "animehub:title-comments:v1";

type TitleCommentsMap = Record<string, CommentMsg[]>;

const EMPTY: CommentMsg[] = [];

const store = createLocalStore<TitleCommentsMap>(TITLE_COMMENTS_KEY, {});

/** Стор целиком — для сверки кулдауна в `progression/service` */
export const titleCommentsStore = store;

/** Комментарии тайтла (SSR/пусто — стабильная пустая ссылка) */
export function useTitleComments(titleId: string): CommentMsg[] {
  const map = store.useStore();
  return titleId ? (map[titleId] ?? EMPTY) : EMPTY;
}

/** Свежие комментарии всех тайтлов — для проверок дублей/кулдауна */
export function titleCommentsRecent(limit = 12): CommentMsg[] {
  if (typeof window === "undefined") return EMPTY;
  return mergeRecent(Object.values(store.get()), limit);
}

/** Добавить комментарий к тайтлу; null — пустой текст */
export function addTitleComment(
  titleId: string,
  author: string,
  text: string,
  opts: { spoiler?: boolean; parentId?: string } = {},
): CommentMsg | null {
  const clean = normalizeCommentText(text);
  if (!clean || !titleId) return null;
  const item: CommentMsg = {
    id: localId("c"),
    author,
    text: clean,
    at: Date.now(),
    spoiler: opts.spoiler || undefined,
    parentId: opts.parentId,
  };
  store.update((map) => ({
    ...map,
    [titleId]: capList([item, ...(map[titleId] ?? [])]),
  }));
  return item;
}

/** Удалить комментарии (каскад считает вызывающая сторона) */
export function removeTitleComments(titleId: string, ids: readonly string[]): void {
  const drop = new Set(ids);
  store.update((map) => ({
    ...map,
    [titleId]: (map[titleId] ?? []).filter((item) => !drop.has(item.id)),
  }));
}

/** Движок отклонил награду — при удалении событие не шлём */
export function markTitleCommentNoReward(titleId: string, id: string): void {
  store.update((map) => ({
    ...map,
    [titleId]: (map[titleId] ?? []).map((item) =>
      item.id === id ? { ...item, xpGranted: false } : item,
    ),
  }));
}

/** Локальный голос (без событий движка) */
export function voteTitleComment(titleId: string, id: string, vote: "up" | "down"): void {
  store.update((map) => ({
    ...map,
    [titleId]: (map[titleId] ?? []).map((item) => (item.id === id ? applyVote(item, vote) : item)),
  }));
}

/**
 * Посев демо-комментариев при первом визите. Ключ в сторе = признак
 * того, что тайтл уже видели: пустой массив после удаления всего
 * не пересеивается.
 */
export function seedTitleComments(titleId: string, now = Date.now()): boolean {
  if (!titleId) return false;
  const map = store.get();
  if (titleId in map) return false;
  store.set({ ...map, [titleId]: buildDemoSeed(titleId, now) });
  return true;
}
