"use client";

/**
 * Блок комментариев — единый для страницы тайтла и стены профиля.
 *
 * Визуал перенесён из макета `ag-comments.html`: аврора и градиентная
 * рамка, сегментированная сортировка, крупные аватары с уровнем,
 * карточки с тегами, кликабельными тайм-кодами, меню действий и
 * раскрывающимися ответами.
 *
 * Данные: тайтл — `lib/comments.ts` (с демо-посевом первого визита),
 * профиль — стена `profile.comments`. События движка (COMMENT_*) шлются
 * одинаково: качество/кулдаун решает сервис, реверс — движок. Голоса —
 * локальный декор без наград. Всё честно подписано сноской под композером.
 */

import { useEffect, useRef, useState } from "react";
import { AvatarFrame } from "@/components/profile/AvatarFrame";
import { AgTag } from "@/components/progression/AgTag";
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

const SORTS: { value: CommentSort; label: string }[] = [
  { value: "new", label: "Новые" },
  { value: "old", label: "Старые" },
  { value: "top", label: "Популярные" },
];

const PAGE_SIZE = 6;

/** Стабильная ссылка scope профиля (объект в рендере менялся бы каждый кадр) */
export const PROFILE_SCOPE = { kind: "profile" } as const;

/** Тон бейджа уровня — по эрам, только из палитры сайта */
const ERA_TONES = [
  "from-accent to-accent-2",
  "from-accent-2 to-mint",
  "from-mint to-accent-2",
  "from-accent-2 to-accent-2",
  "from-accent-2 to-mint",
  "from-accent-2 to-accent",
  "from-accent-2 via-rose-400 to-accent-2",
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

const ICON_CLASS = "cmx-i";

const ChatIcon = () => (
  <svg viewBox="0 0 24 24" className={ICON_CLASS} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
  </svg>
);

const SendIcon = () => (
  <svg viewBox="0 0 24 24" className={ICON_CLASS} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M22 2 11 13" />
    <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
  </svg>
);

const EyeOffIcon = () => (
  <svg viewBox="0 0 24 24" className={ICON_CLASS} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 3l18 18M10.6 6.2A9 9 0 0 1 12 6c5 0 8 6 8 6a14 14 0 0 1-2.6 3.4M6.5 7.5C4 9.2 3 12 3 12s3 6 9 6a9 9 0 0 0 3.5-.7M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </svg>
);

const ThumbIcon = () => (
  <svg viewBox="0 0 24 24" className={ICON_CLASS} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M7 11v9H4v-9zM7 11l4-8c1.6 0 2.6 1.1 2.2 2.7L12.8 9H19a2 2 0 0 1 2 2.4l-1.3 6.5A2 2 0 0 1 17.7 19H7" />
  </svg>
);

const ReplyIcon = () => (
  <svg viewBox="0 0 24 24" className={ICON_CLASS} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 6 6v3" />
  </svg>
);

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" className={ICON_CLASS} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

const CrownIcon = () => (
  <svg viewBox="0 0 24 24" className={ICON_CLASS} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z" />
  </svg>
);

const DotsIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
    <circle cx="12" cy="5" r="1.7" />
    <circle cx="12" cy="12" r="1.7" />
    <circle cx="12" cy="19" r="1.7" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

/* ------------------------------ Время видео ----------------------------- */

function videoEl(): HTMLVideoElement | null {
  if (typeof document === "undefined") return null;
  return document.querySelector<HTMLVideoElement>("video");
}

function mmss(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

/* ------------------------------ Rich-текст ------------------------------ */

const TOKEN_RE = /@([\w-]+)|(?<![\d:])(\d{1,2}):([0-5]\d)(?::([0-5]\d))?(?![\d:])/g;

function RichText({ text, onSeek }: { text: string; onSeek: (seconds: number, raw: string) => void }) {
  const lines = text.split("\n");
  return (
    <div className="cmx-tx">
      {lines.map((line, lineIndex) => {
        const nodes: React.ReactNode[] = [];
        let last = 0;
        for (const match of line.matchAll(TOKEN_RE)) {
          if (match.index > last) nodes.push(line.slice(last, match.index));
          if (match[1]) {
            nodes.push(
              <span className="cmx-at" key={`m-${lineIndex}-${match.index}`}>
                @{match[1]}
              </span>,
            );
          } else {
            const hours = match[4] !== undefined ? Number(match[2]) : 0;
            const minutes = match[4] !== undefined ? Number(match[3]) : Number(match[2]);
            const seconds = match[4] !== undefined ? Number(match[4]) : Number(match[3]);
            const total = hours * 3600 + minutes * 60 + seconds;
            const raw = match[0];
            nodes.push(
              <button
                className="cmx-tcl"
                type="button"
                key={`t-${lineIndex}-${match.index}`}
                onClick={() => onSeek(total, raw)}
                title="Перемотать плеер"
              >
                <ClockIcon />
                {raw}
              </button>,
            );
          }
          last = match.index + match[0].length;
        }
        if (last < line.length) nodes.push(line.slice(last));
        return (
          <span key={`l-${lineIndex}`}>
            {lineIndex > 0 && <br />}
            {nodes}
          </span>
        );
      })}
    </div>
  );
}

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

/** `metaFor` — функция, но карточке нужен ещё и текущий ник для меню. */
type MetaFor = ((author: string) => AuthorMeta) & { currentName?: string };

interface CardProps {
  item: CommentMsg;
  replies: CommentMsg[];
  index: number;
  nested?: boolean;
  metaFor: MetaFor;
  onReply: (item: CommentMsg) => void;
  onVote: (id: string, dir: "up" | "down") => void;
  onRemove: (id: string) => void;
  onSeek: (seconds: number, raw: string) => void;
  onNotify: (message: string) => void;
  onReport: () => void;
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
  onSeek,
  onNotify,
  onReport,
}: CardProps) {
  const [revealed, setRevealed] = useState(false);
  const [menu, setMenu] = useState(false);
  const [repliesOpen, setRepliesOpen] = useState(false);
  const meta = metaFor(item.author);

  const copyLink = () => {
    setMenu(false);
    const base = `${window.location.origin}${window.location.pathname}${window.location.search}`;
    const href = `${base}#c-${encodeURIComponent(item.id)}`;
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(href).then(
        () => onNotify("Ссылка на комментарий скопирована"),
        () => onNotify("Не удалось скопировать ссылку"),
      );
    } else {
      onNotify("Буфер обмена недоступен в этом браузере");
    }
  };

  return (
    <li
      className={`cmx-cc${nested ? " rep" : ""}`}
      id={`c-${item.id}`}
      style={{ ["--n" as string]: String(Math.min(index, 8)) }}
    >
      <div className="cmx-ca">
        <span className="cmx-av">
          <AvatarFrame
            nickname={item.author}
            avatar={meta.avatar}
            frame={meta.frameImg ? FRAMES.find((f) => f.img === meta.frameImg) : undefined}
            size="xs"
          />
          {!nested && (
            <b
              className={`cmx-lv bg-gradient-to-br ${eraTone(meta.level)}`}
              title={`Уровень ${meta.level} · эра «${eraName(meta.level)}»`}
            >
              {meta.level}
            </b>
          )}
        </span>
      </div>

      <div className="cmx-cb">
        <div className="cmx-ch">
          <b className="cmx-nm">{item.author}</b>
          {meta.tag && <AgTag tag={meta.tag} size="sm" />}
          {meta.premium && (
            <span className="cmx-pm">
              <CrownIcon />
              Premium
            </span>
          )}
          {item.spoiler && <span className="cmx-st2">Только не вскрывать</span>}
          <span className="cmx-tm">{timeAgo(item.at)}</span>

          <span
            className="cmx-kw"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setMenu(false);
            }}
          >
            <button
              type="button"
              className="cmx-kb"
              aria-label="Действия с комментарием"
              aria-expanded={menu}
              onClick={() => setMenu((open) => !open)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setMenu(false);
              }}
            >
              <DotsIcon />
            </button>
            {menu && (
              <div className="cmx-mnu" role="menu">
                <button type="button" onClick={copyLink}>
                  Скопировать ссылку
                </button>
                {item.author === metaFor.currentName && (
                  <button
                    type="button"
                    className="rd"
                    onClick={() => {
                      setMenu(false);
                      onRemove(item.id);
                    }}
                  >
                    Удалить
                  </button>
                )}
                {item.author !== metaFor.currentName && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenu(false);
                      onReport();
                    }}
                  >
                    Пожаловаться
                  </button>
                )}
              </div>
            )}
          </span>
        </div>

        {item.spoiler && !revealed ? (
          <button type="button" className="cmx-spw" onClick={() => setRevealed(true)}>
            <EyeOffIcon />
            Спойлер — нажмите, чтобы показать
          </button>
        ) : (
          <div className={item.spoiler ? "cmx-unb" : undefined}>
            <RichText text={item.text} onSeek={onSeek} />
          </div>
        )}

        <div className="cmx-ac">
          <button
            type="button"
            data-on={item.myVote === "up"}
            aria-label="Нравится"
            aria-pressed={item.myVote === "up"}
            onClick={() => onVote(item.id, "up")}
            className={`cmx-vt${item.myVote === "up" ? " on" : ""}`}
          >
            <ThumbIcon />
            <span>{item.likes ?? 0}</span>
          </button>
          <button
            type="button"
            data-on={item.myVote === "down"}
            aria-label="Не нравится"
            aria-pressed={item.myVote === "down"}
            onClick={() => onVote(item.id, "down")}
            className={`cmx-vt dn${item.myVote === "down" ? " on" : ""}`}
          >
            <ThumbIcon />
            <span>{item.dislikes ?? 0}</span>
          </button>
          <button type="button" className="cmx-rb" onClick={() => onReply(item)}>
            <ReplyIcon />
            Ответить
          </button>
        </div>

        {replies.length > 0 && (
          <button
            type="button"
            className="cmx-sr"
            onClick={() => setRepliesOpen((open) => !open)}
            aria-expanded={repliesOpen}
          >
            <ReplyIcon />
            {repliesOpen ? "Скрыть ответы" : `Показать ответы (${replies.length})`}
          </button>
        )}

        {replies.length > 0 && repliesOpen && (
          <ul className="cmx-rp">
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
                onSeek={onSeek}
                onNotify={onNotify}
                onReport={onReport}
              />
            ))}
          </ul>
        )}
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
  const [shown, setShown] = useState(PAGE_SIZE);
  const [replyTo, setReplyTo] = useState<CommentMsg | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [hasVideo, setHasVideo] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toastTimer = useRef(0);

  // Демо-посев страницы тайтла: первый визит — локальные персоны
  useEffect(() => {
    if (titleId) seedTitleComments(titleId);
  }, [titleId]);

  // Кнопка «Время» нужна только там, где на странице есть видеоплеер.
  useEffect(() => {
    const check = () => setHasVideo(Boolean(videoEl()));
    check();
    const timer = window.setInterval(check, 1500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => window.clearTimeout(toastTimer.current);
  }, []);

  const notify = (message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  };

  /** Мета автора: текущий аккаунт — реально, остальные — декор */
  const metaFor = ((author: string): AuthorMeta => {
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
  }) as MetaFor;
  metaFor.currentName = name;

  const seek = (seconds: number, raw: string) => {
    const video = videoEl();
    if (!video) {
      notify("Плеер не найден на этой странице");
      return;
    }
    try {
      video.currentTime = Math.min(Math.max(0, seconds), video.duration || seconds);
      notify(`Перемотка на ${raw}`);
    } catch {
      notify("Не удалось перемотать плеер");
    }
  };

  const insertTime = () => {
    const video = videoEl();
    if (!video) {
      notify("Плеер не найден на этой странице");
      return;
    }
    const stamp = `[${mmss(video.currentTime)}] `;
    const textarea = textareaRef.current;
    if (!textarea) {
      setDraft((value) => `${stamp}${value}`.slice(0, MAX_TEXT));
      return;
    }
    const start = textarea.selectionStart ?? draft.length;
    const end = textarea.selectionEnd ?? draft.length;
    const next = `${draft.slice(0, start)}${stamp}${draft.slice(end)}`.slice(0, MAX_TEXT);
    setDraft(next);
    requestAnimationFrame(() => {
      textarea.focus();
      const caret = Math.min(start + stamp.length, next.length);
      textarea.setSelectionRange(caret, caret);
    });
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

    if (!parentId) {
      setSort("new");
      setShown((value) => Math.max(value, PAGE_SIZE));
    }
    setDraft("");
    setSpoilerOn(false);
    setReplyTo(null);

    window.setTimeout(() => {
      document.getElementById(`c-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
  };

  const startReply = (item: CommentMsg) => {
    setReplyTo(item);
    window.setTimeout(() => {
      textareaRef.current?.focus();
      document.getElementById("cmx-compose")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 40);
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
    notify("Комментарий удалён");
  };

  const roots = rootsOf(list, sort);
  const visible = roots.slice(0, shown);
  const headingId = titleId ? `cm-h-${titleId}` : "cm-h-profile";
  const composerMeta = metaFor(name);

  return (
    <section className="cmx" aria-label="Комментарии" aria-labelledby={headingId}>
      <span className="cmx-aur" aria-hidden />

      <header className="cmx-hd">
        <h2 id={headingId}>
          <ChatIcon />
          {titleId ? "Комментарии" : "Стена"}
          <span className="cmx-cnt">{list.length}</span>
        </h2>

        <div className="cmx-sg" role="group" aria-label="Порядок комментариев">
          {SORTS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={sort === option.value ? "on" : undefined}
              aria-pressed={sort === option.value}
              onClick={() => {
                setSort(option.value);
                setShown(PAGE_SIZE);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      {/* Композер */}
      <div className="cmx-cp" id="cmx-compose">
        <div className="cmx-cpa">
          <AvatarFrame
            nickname={name}
            avatar={composerMeta.avatar}
            frame={FRAMES.find((f) => f.img === composerMeta.frameImg)}
            size="xs"
          />
        </div>

        <div className="cmx-cpb">
          {replyTo && (
            <div className="cmx-reply-note">
              <span className="truncate">
                Ответ для <b>{replyTo.author}</b>
              </span>
              <button type="button" onClick={() => setReplyTo(null)} aria-label="Отменить ответ">
                <CloseIcon />
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
              if (event.key === "Escape" && replyTo) setReplyTo(null);
            }}
            maxLength={MAX_TEXT}
            rows={2}
            placeholder={titleId ? "Поделитесь мнением об аниме…" : "Написать на стене…"}
            aria-label="Текст комментария"
            className="cmx-cpt"
          />

          <div className="cmx-cpbar">
            <button
              type="button"
              aria-pressed={spoilerOn}
              onClick={() => setSpoilerOn((on) => !on)}
              className={`cmx-tg${spoilerOn ? " on" : ""}`}
            >
              <EyeOffIcon />
              Спойлер
            </button>
            {hasVideo && (
              <button type="button" className="cmx-tg" onClick={insertTime} title="Вставить текущее время видео">
                <ClockIcon />
                Время
              </button>
            )}

            <span className={`cmx-ctr${draft.length > MAX_TEXT * 0.9 ? " lim" : ""}`}>
              <i
                className="cmx-rg"
                style={{ ["--p" as string]: String((draft.length / MAX_TEXT) * 100) }}
                aria-hidden
              />
              <em>
                {draft.length}/{MAX_TEXT}
              </em>
            </span>
            <span className="cmx-grow" />
            {replyTo && (
              <button type="button" className="cmx-gh" onClick={() => setReplyTo(null)}>
                Отмена
              </button>
            )}
            <button type="button" className="cmx-sd" onClick={send} disabled={!draft.trim()}>
              <SendIcon />
              {replyTo ? "Ответить" : "Отправить"}
            </button>
          </div>

          <div className="cmx-ht">Ctrl+Enter — быстрая отправка</div>
          {hint && <p className="cmx-hint">{hint}</p>}
        </div>
      </div>

      <p className="cmx-note">
        {titleId
          ? "Комментарии локальные: видны только в этом браузере, на сервер не уходят. Часть комментариев — демо-посев, а не живые зрители."
          : "Стена локальная: комментарии видны только в этом браузере, на сервер они не уходят."}
      </p>

      {/* Лента */}
      {visible.length === 0 ? (
        <div className="cmx-em">
          <h3>Пока тихо</h3>
          <p>
            Будьте первым — {titleId ? "поделитесь мнением об аниме" : "оставьте первый отзыв"}.
          </p>
        </div>
      ) : (
        <ul className="cmx-feed">
          {visible.map((root, index) => (
            <CommentCard
              key={root.id}
              item={root}
              replies={repliesOf(list, root.id)}
              index={index}
              metaFor={metaFor}
              onReply={startReply}
              onVote={vote}
              onRemove={remove}
              onSeek={seek}
              onNotify={notify}
              onReport={() => notify("Жалоба отмечена локально: отправки на сервер нет.")}
            />
          ))}
        </ul>
      )}

      {roots.length > shown && (
        <button type="button" className="cmx-mr" onClick={() => setShown((value) => value + PAGE_SIZE)}>
          Показать ещё ({roots.length - shown})
        </button>
      )}

      <div className={`cmx-toast${toast ? " on" : ""}`} role="status" aria-live="polite">
        {toast}
      </div>
    </section>
  );
}
