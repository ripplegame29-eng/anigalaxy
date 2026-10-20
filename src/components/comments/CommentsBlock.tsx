"use client";

/**
 * Блок комментариев — единый для страницы тайтла и стены профиля.
 *
 * Формат по референсу (animeon): заголовок со счётчиком и сортировкой,
 * композер со спойлером и Ctrl+Enter, карточки с аватаром-рамкой, бейджом
 * уровня, тегом автора, Premium, временем, голосами 👍/👎, ответом (один
 * уровень) и меню «⋮». Спойлер раскрывается по нажатию.
 *
 * Данные: тайтл — `lib/comments.ts` (со демо-посевом первого визита),
 * профиль — стена `profile.comments`. События движка (COMMENT_*) шлются
 * одинаково: качество/кулдаун решает сервис, реверс — движок. Голоса —
 * локальный декор без наград (ASSUMPTIONS §22). Всё честно подписано
 * сноской под композером.
 */

import { useEffect, useRef, useState } from "react";
import { AvatarView } from "@/components/profile/AvatarView";
import { AgTag } from "@/components/progression/AgTag";
import { ReportButton } from "@/components/ReportButton";
import { PremiumChip } from "@/components/profile/PremiumChip";
import { FRAMES } from "@/lib/cosmetics";
import { isPremiumActive } from "@/lib/auth";
import { useAccount } from "@/lib/use-account";
import { addComment, markCommentNoReward, removeComment, useProfile, voteComment } from "@/lib/profile";
import { timeAgo } from "@/lib/history";
import { ERAS, eraName } from "@/lib/levels";
import { levelInfoFromDoc, progressEmit, useProgress } from "@/lib/progression/events";
import { PROGRESSION_CONFIG } from "@/lib/progression/progression.config";
import type { TagDef } from "@/lib/progression/types";
import {
  DEMO_PERSONAS,
  MAX_TEXT,
  MIN_REWARD_TEXT,
  addTitleComment,
  cascadeIds,
  hashString,
  markTitleCommentNoReward,
  normalizeCommentText,
  removeTitleComments,
  repliesOf,
  rootsOf,
  seedTitleComments,
  useTitleComments,
  voteTitleComment,
  type CommentMsg,
  type CommentSort,
} from "@/lib/comments";

const TAGS = PROGRESSION_CONFIG.tags;
const TAG_BY_ID = new Map(TAGS.map((tag) => [tag.id, tag]));

/** Причина отклонения награды → честная подпись под композером */
const REJECT_TEXT: Record<string, string> = {
  comment_too_short: `Опубликовано без награды: нужно минимум ${MIN_REWARD_TEXT} символов.`,
  comment_duplicate: "Опубликовано без награды: такой комментарий уже был.",
  comment_cooldown: "Опубликовано без награды: между награждаемыми комментариями минута паузы.",
};

/** Стабильная ссылка scope профиля (объект в рендере менялся бы каждый кадр) */
export const PROFILE_SCOPE = { kind: "profile" } as const;

/** Тон бейджа уровня — по эрам, только из палитры сайта */
const ERA_TONES = [
  "from-accent to-accent-2",
  "from-accent-2 to-mint",
  "from-mint to-accent-2",
  "from-gold to-accent-2",
  "from-gold to-mint",
  "from-gold to-accent",
  "from-gold via-rose-400 to-accent-2",
];

export type CommentsScope = typeof PROFILE_SCOPE | { kind: "title"; titleId: string };

function eraTone(level: number): string {
  let index = 0;
  ERAS.forEach((era, i) => {
    if (level >= era.from) index = i;
  });
  return ERA_TONES[index] ?? ERA_TONES[0];
}

/* -------------------------------- Иконки -------------------------------- */

const ICON_CLASS = "h-3.5 w-3.5";

const SendIcon = () => (
  <svg viewBox="0 0 24 24" className={ICON_CLASS} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M22 2 11 13" />
    <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
  </svg>
);

const EyeOffIcon = () => (
  <svg viewBox="0 0 24 24" className={ICON_CLASS} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <path d="M1 1l22 22" />
  </svg>
);

const ThumbIcon = () => (
  <svg viewBox="0 0 24 24" className={ICON_CLASS} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
  </svg>
);

const ReplyIcon = () => (
  <svg viewBox="0 0 24 24" className={ICON_CLASS} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M9 17 4 12l5-5" />
    <path d="M4 12h11a5 5 0 0 1 5 5v3" />
  </svg>
);

const DotsIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
    <circle cx="12" cy="5" r="1.7" />
    <circle cx="12" cy="12" r="1.7" />
    <circle cx="12" cy="19" r="1.7" />
  </svg>
);

const ChevronIcon = () => (
  <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

/* ------------------------------ Карточка -------------------------------- */

/** Мета автора: свой аккаунт — настоящие данные, демо/гости — декор */
interface AuthorMeta {
  avatar?: string;
  frameCss?: string;
  frameImg?: string;
  level: number;
  tag?: TagDef;
  premium: boolean;
}

interface CardProps {
  item: CommentMsg;
  replies: CommentMsg[];
  index: number;
  nested?: boolean;
  metaFor: (author: string) => AuthorMeta;
  onReply: (item: CommentMsg) => void;
  onVote: (id: string, dir: "up" | "down") => void;
  onRemove: (id: string) => void;
  /** Идентификатор тайтла для жалобы. В профиле пусто — жаловаться не на что. */
  titleId: string;
}

function CommentCard({
  item,
  replies,
  index,
  nested = false,
  metaFor,
  onReply,
  onVote,
  onRemove,
  titleId,
}: CardProps) {
  const [revealed, setRevealed] = useState(false);
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const meta = metaFor(item.author);

  return (
    <li
      className="ag-cm-item group relative rounded-2xl px-3.5 py-3 transition sm:px-4 sm:py-3.5"
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      <div className={`flex gap-3 ${nested ? "" : ""}`}>
        <div className="flex shrink-0 flex-col items-center gap-1.5">
          <AvatarView
            nickname={item.author}
            avatar={meta.avatar}
            frameCss={meta.frameCss}
            frameImg={meta.frameImg}
            className={nested ? "h-8 w-8" : "h-11 w-11"}
            textClass={nested ? "text-[9px]" : "text-xs"}
          />
          {!nested && (
            <span
              className={`ag-cm-lvl rounded-md bg-gradient-to-br ${eraTone(meta.level)} px-1.5 py-0.5 text-[10px] font-black leading-none text-white shadow`}
              title={`Уровень ${meta.level} · эра «${eraName(meta.level)}»`}
            >
              {meta.level}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="max-w-[40vw] truncate text-[13px] font-extrabold text-white sm:max-w-none">
              {item.author}
            </span>
            {meta.tag && <AgTag tag={meta.tag} size="sm" className="shrink-0" />}
            {meta.premium && <PremiumChip />}
            <span className="shrink-0 text-[11px] text-muted">{timeAgo(item.at)}</span>

            <span
              className="relative ml-auto"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setMenu(false);
              }}
            >
              <button
                type="button"
                aria-label="Действия с комментарием"
                aria-expanded={menu}
                onClick={() => setMenu((open) => !open)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setMenu(false);
                }}
                className={`grid h-6 w-6 place-items-center rounded-md transition ${
                  menu ? "bg-white/12 text-white" : "text-muted hover:bg-white/10 hover:text-white"
                }`}
              >
                <DotsIcon />
              </button>
              {menu && (
                <div className="absolute right-0 top-7 z-20 w-40 overflow-hidden rounded-lg bg-elevated py-1 ring-1 ring-white/15 shadow-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setMenu(false);
                      onRemove(item.id);
                    }}
                    className="block w-full px-3 py-2 text-left text-[11px] font-bold text-rose-300 transition hover:bg-rose-400/10 hover:text-rose-200"
                  >
                    Удалить
                  </button>

                  {/* Жалоба уходит на сервер, а не остаётся в браузере
                      автора: иначе модератор о ней не узнает. На странице
                      профиля жаловаться не на что, поэтому пункт не показываем. */}
                  {titleId ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMenu(false);
                        setReporting(true);
                      }}
                      className="block w-full px-3 py-2 text-left text-[11px] font-bold text-white/60 transition hover:bg-white/6 hover:text-white"
                    >
                      Пожаловаться
                    </button>
                  ) : null}
                </div>
              )}
            </span>
          </div>

          {item.spoiler && !revealed ? (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="ag-cm-spoil mt-2 flex w-full items-center gap-2 rounded-xl bg-accent/10 px-3.5 py-2.5 text-left text-xs font-bold text-accent-2 ring-1 ring-accent/35 transition hover:bg-accent/15 hover:ring-accent/55"
            >
              <EyeOffIcon />
              Спойлер — нажмите, чтобы показать
            </button>
          ) : (
            <p
              className={`mt-1.5 break-words text-sm leading-relaxed text-white/85 ${
                item.spoiler ? "ag-cm-reveal" : ""
              }`}
            >
              {item.text}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              data-on={item.myVote === "up"}
              aria-label="Нравится"
              aria-pressed={item.myVote === "up"}
              onClick={() => onVote(item.id, "up")}
              className={`ag-cm-vote inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold ring-1 transition ${
                item.myVote === "up"
                  ? "bg-accent/18 text-accent-2 ring-accent/45"
                  : "bg-white/6 text-muted ring-white/10 hover:text-white hover:ring-white/30"
              }`}
            >
              <ThumbIcon />
              {item.likes ?? 0}
            </button>
            <button
              type="button"
              data-on={item.myVote === "down"}
              aria-label="Не нравится"
              aria-pressed={item.myVote === "down"}
              onClick={() => onVote(item.id, "down")}
              className={`ag-cm-vote inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold ring-1 transition ${
                item.myVote === "down"
                  ? "bg-rose-500/18 text-rose-300 ring-rose-400/45"
                  : "bg-white/6 text-muted ring-white/10 hover:text-white hover:ring-white/30"
              }`}
            >
              <span className="rotate-180">
                <ThumbIcon />
              </span>
              {item.dislikes ?? 0}
            </button>
            <button
              type="button"
              onClick={() => onReply(item)}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-bold text-muted ring-1 ring-transparent transition hover:bg-white/8 hover:text-white"
            >
              <ReplyIcon />
              Ответить
            </button>
          </div>

          {reporting ? (
            <div className="mt-2">
              <ReportButton
                commentId={item.id}
                titleId={titleId}
                onClose={() => setReporting(false)}
              />
            </div>
          ) : null}

          {replies.length > 0 && (
            <ul className="mt-3 space-y-2 border-l-2 border-accent/25 pl-3">
              {replies.map((reply, replyIndex) => (
                <CommentCard
                  key={reply.id}
                  item={reply}
                  replies={[]}
                  index={replyIndex}
                  nested
                  metaFor={metaFor}
                  onReply={onReply}
                  onVote={onVote}
                  onRemove={onRemove}
                  titleId={titleId}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}

/* -------------------------------- Блок ---------------------------------- */

export function CommentsBlock({ scope }: { scope: CommentsScope }) {
  const account = useAccount();
  const profile = useProfile();
  const doc = useProgress();
  const info = levelInfoFromDoc(doc);

  const titleId = scope.kind === "title" ? scope.titleId : "";
  const name = account?.nickname ?? "Гость";
  const premium = isPremiumActive(account);
  const equippedTag = doc.progress.equippedTagId
    ? TAG_BY_ID.get(doc.progress.equippedTagId)
    : undefined;
  const frame = FRAMES.find((item) => item.id === profile.frameId);

  const titleItems = useTitleComments(titleId);
  const list = titleId ? titleItems : profile.comments;

  const [draft, setDraft] = useState("");
  const [spoilerOn, setSpoilerOn] = useState(false);
  const [sort, setSort] = useState<CommentSort>("new");
  const [replyTo, setReplyTo] = useState<CommentMsg | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Демо-посев страницы тайтла: первый визит — локальные персоны
  // (запись в стор, не setState: подписка useSyncExternalStore обновит UI)
  useEffect(() => {
    if (titleId) seedTitleComments(titleId);
  }, [titleId]);

  /** Мета автора: текущий аккаунт — реально, остальные — декор */
  const metaFor = (author: string): AuthorMeta => {
    if (author === name) {
      return {
        avatar: profile.avatar || undefined,
        frameCss: frame?.css,
        frameImg: frame?.img,
        level: info.level,
        tag: equippedTag,
        premium,
      };
    }
    const persona = DEMO_PERSONAS.find((item) => item.name === author);
    if (persona) {
      return { level: persona.level, tag: TAG_BY_ID.get(persona.tagId), premium: persona.premium };
    }
    // гость/старое имя: детерминированный декор без выдумывания тегов
    return { level: 3 + (hashString(author) % 26), premium: false };
  };

  const send = () => {
    const clean = normalizeCommentText(draft);
    if (!clean) return;
    const parentId = replyTo ? (replyTo.parentId ?? replyTo.id) : undefined;

    let id: string | null;
    if (titleId) {
      const item = addTitleComment(titleId, name, clean, { spoiler: spoilerOn, parentId });
      id = item?.id ?? null;
    } else {
      id = addComment(name, clean, { spoiler: spoilerOn, parentId });
    }
    if (!id) return;

    const result = progressEmit(
      parentId
        ? { type: "COMMENT_REPLIED", commentId: id, targetId: parentId, text: clean }
        : { type: "COMMENT_ADDED", commentId: id, text: clean },
    );

    if (result.rejected && result.rejected.type.startsWith("COMMENT")) {
      // Комментарий опубликован, но награды нет — запоминаем, чтобы при
      // удалении не откатывать то, чего не было.
      if (titleId) markTitleCommentNoReward(titleId, id);
      else markCommentNoReward(id);
      setHint(REJECT_TEXT[result.rejected.reason] ?? "Награда за комментарий не начислена.");
    } else {
      setHint(null);
    }

    setDraft("");
    setSpoilerOn(false);
    setReplyTo(null);
  };

  const startReply = (item: CommentMsg) => {
    setReplyTo(item);
    textareaRef.current?.focus();
  };

  const vote = (id: string, dir: "up" | "down") => {
    if (titleId) voteTitleComment(titleId, id, dir);
    else voteComment(id, dir);
  };

  const remove = (id: string) => {
    const ids = cascadeIds(list, id);
    if (titleId) removeTitleComments(titleId, ids);
    else ids.forEach(removeComment);

    // Награду откатываем только если её действительно давали: демо-посев
    // и отклонённые сервисом комментарии событий не порождали.
    for (const targetId of ids) {
      const target = list.find((comment) => comment.id === targetId);
      if (!target || target.demo || target.xpGranted === false) continue;
      progressEmit({ type: "COMMENT_REMOVED", commentId: targetId });
    }

    if (replyTo && ids.includes(replyTo.id)) setReplyTo(null);
  };

  const roots = rootsOf(list, sort);
  const headingId = titleId ? `cm-h-${titleId}` : "cm-h-profile";

  return (
    <section className="ag-cm" aria-label="Комментарии">
      {/* Заголовок + счётчик + сортировка */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 id={headingId} className="ag-cm-h flex items-center gap-3 text-2xl font-extrabold tracking-tight text-white sm:text-[32px]">
          <svg viewBox="0 0 24 24" className="h-6 w-6 text-accent sm:h-7 sm:w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 12a8 8 0 0 1-8 8H4l2.2-2.6A8 8 0 1 1 21 12Z" />
          </svg>
          Комментарии
          <span className="ag-cm-count text-base font-bold tracking-normal text-muted sm:text-lg">
            {list.length}
          </span>
        </h2>

        <label className="relative flex items-center gap-2">
          <span className="hidden text-[11px] text-muted sm:inline">Порядок</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as CommentSort)}
            aria-label="Сортировка комментариев"
            className="ag-cm-sel appearance-none rounded-xl py-2 pl-3.5 pr-9 text-xs font-bold text-white transition focus:outline-none"
          >
            <option value="new">Сначала новые</option>
            <option value="old">Сначала старые</option>
            <option value="top">Сначала популярные</option>
          </select>
          <ChevronIcon />
        </label>
      </div>

      {/* Композер */}
      <div className="ag-cm-compose rounded-2xl p-4 transition">
        {replyTo && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-accent/12 px-2.5 py-1.5 text-[11px] text-accent-2 ring-1 ring-accent/30">
            <span className="truncate">
              Ответ для <b className="font-extrabold">{replyTo.author}</b>
            </span>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              aria-label="Отменить ответ"
              className="grid h-5 w-5 shrink-0 place-items-center rounded text-accent-2 transition hover:bg-white/10"
            >
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              send();
            }
          }}
          maxLength={MAX_TEXT}
          rows={3}
          placeholder={
            titleId
              ? "Поделитесь мнением об аниме..."
              : `Комментарий от имени ${name}`
          }
          className="w-full resize-none bg-transparent text-sm text-white placeholder:text-muted/60 focus:outline-none"
        />

        <div className="ag-cm-bar mt-3 flex flex-wrap items-center justify-between gap-2 pt-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-pressed={spoilerOn}
              onClick={() => setSpoilerOn((on) => !on)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold ring-1 transition ${
                spoilerOn
                  ? "bg-accent/18 text-accent-2 ring-accent/45"
                  : "bg-white/6 text-muted ring-white/12 hover:text-white hover:ring-white/30"
              }`}
            >
              <EyeOffIcon />
              Спойлер
            </button>
            <span className="text-[11px] tabular-nums text-muted">
              {draft.length}/{MAX_TEXT}
            </span>
          </div>

          <button
            type="button"
            onClick={send}
            disabled={!draft.trim()}
            className="btn-primary ag-cm-send inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-xs font-bold text-white disabled:opacity-45"
          >
            <SendIcon />
            Отправить
          </button>
        </div>

        <p className="mt-2 text-[11px] text-muted">Ctrl+Enter — быстрая отправка</p>
        {hint && <p className="mt-1 text-[11px] font-bold text-accent-2">{hint}</p>}
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-muted">
        {titleId
          ? "Комментарии локальные: видны только в этом браузере, на сервер не уходят. Часть комментариев — демо-посев, а не живые зрители."
          : "Стена локальная: комментарии видны только в этом браузере, на сервер они не уходят."}
      </p>

      {/* Лента */}
      {roots.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-line bg-white/[0.02] px-5 py-8 text-center">
          <p className="text-sm font-bold text-white">Пока нет комментариев</p>
          <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-muted">
            Будьте первым — {titleId ? "поделитесь мнением об аниме" : "оставьте первый отзыв"}.
          </p>
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {roots.map((root, index) => (
            <CommentCard
              key={root.id}
              item={root}
              replies={repliesOf(list, root.id)}
              index={index}
              metaFor={metaFor}
              onReply={startReply}
              onVote={vote}
              onRemove={remove}
              titleId={titleId}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
