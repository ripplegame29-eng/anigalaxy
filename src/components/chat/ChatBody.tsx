"use client";

/**
 * Лента и поле ввода общего чата.
 *
 * Что умеет: ответы-цитаты с переходом к оригиналу, реакции, правка (15 минут)
 * и удаление своих сообщений, голосовые с волной и скоростью, эмодзи-панель,
 * @упоминания, ссылки, группировка по автору и разделители дней, кнопка
 * «к новым сообщениям». Данные и запросы — в `lib/chat`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AgTag } from "@/components/progression/AgTag";
import { AvatarFrame } from "@/components/profile/AvatarFrame";
import { FRAMES } from "@/lib/cosmetics";
import { PROGRESSION_CONFIG } from "@/lib/progression/progression.config";
import {
  CHAT_EDIT_WINDOW_MS,
  CHAT_EMOJI,
  CHAT_TEXT_LIMIT,
  deleteChatMessage,
  editChatMessage,
  reactChatMessage,
  sendChatMessage,
  sendChatVoice,
  type ChatMessage,
} from "@/lib/chat";
import { useVoiceRecorder } from "./use-voice-recorder";
import { fmtClock, VoiceBubble } from "./VoiceBubble";
import "./chat.css";

const QUICK = CHAT_EMOJI.slice(0, 5);

const PICKER = [
  "😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😎", "🤔", "😅", "😭", "😡",
  "🥺", "😴", "🤯", "😱", "🥳", "🤗", "😏", "🙄", "😬", "🤝", "👍", "👎",
  "👏", "🙏", "💪", "🔥", "✨", "💫", "⭐", "❤️", "💙", "💜", "🖤", "💔",
  "🎉", "🎊", "🍜", "🍙", "🍥", "🍡", "🌸", "⚔️", "👑", "🐱", "🦊", "🐉",
  "👻", "💀", "👀", "🌙", "☀️", "🌈", "🎧", "🎮", "📺", "🍿", "🫶", "🤍",
];

const tagOf = (id?: string) => (id ? PROGRESSION_CONFIG.tags.find((item) => item.id === id) : undefined);

const timeLabel = (at: number) => new Date(at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

function dayKey(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(at: number): string {
  const now = Date.now();
  if (dayKey(at) === dayKey(now)) return "Сегодня";
  if (dayKey(at) === dayKey(now - 86_400_000)) return "Вчера";
  return new Date(at).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}️?(?:‍\p{Extended_Pictographic}️?)*\s*){1,3}$/u;
const TOKEN = /(https?:\/\/[^\s<]+)|(@[\p{L}\p{N}_.-]{2,32})/gu;

/** Ссылки и @упоминания; остальное — обычный текст (никакого HTML) */
function renderText(text: string, myName: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN)) {
    const at = match.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const raw = match[0];
    if (match[1]) {
      const url = raw.replace(/[).,;!?]+$/, "");
      out.push(
        <a key={at} href={url} target="_blank" rel="noopener noreferrer nofollow" className="agc-link">
          {url.replace(/^https?:\/\//, "").slice(0, 44)}
          {url.length > 52 ? "…" : ""}
        </a>,
      );
      if (url.length < raw.length) out.push(raw.slice(url.length));
    } else {
      const mine = raw.slice(1).toLowerCase() === myName.toLowerCase();
      out.push(
        <span key={at} className={`agc-mention${mine ? " is-me" : ""}`}>
          {raw}
        </span>,
      );
    }
    last = at + raw.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const Svg = ({ d, size = 16, fill = false }: { d: string; size?: number; fill?: boolean }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={fill ? "currentColor" : "none"} stroke={fill ? "none" : "currentColor"} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

const ICON = {
  reply: "M9 14 4 9l5-5M4 9h10a6 6 0 0 1 6 6v3",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  smile: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01",
  plus: "M12 5v14M5 12h14",
  send: "M4.5 12 19 5.5 13.5 19l-2-5.5-7-1.5z",
  mic: "M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zM6 11.5a6 6 0 0 0 12 0M12 17.5V21",
  close: "M6 6l12 12M18 6 6 18",
  trash: "M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12",
  copy: "M9 9h10v11H9zM5 15V4h10",
  edit: "M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4",
  down: "M6 9l6 6 6-6",
  check: "M5 12.5l4.5 4.5L19 7.5",
};

interface Props {
  open: boolean;
  signedIn: boolean;
  myName: string;
  canModerate: boolean;
  tagId?: string;
  messages: ChatMessage[];
}

export function ChatBody({ open, signedIn, myName, canModerate, tagId, messages }: Props) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [draft, setDraft] = useState("");
  const [reply, setReply] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [stuck, setStuck] = useState(true);
  const [missed, setMissed] = useState(0);
  const seen = useRef(0);
  const voice = useVoiceRecorder();

  const flash = useCallback((text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice((current) => (current === text ? "" : current)), 3500);
  }, []);

  // ---------- прокрутка ----------
  const toBottom = useCallback((smooth = false) => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    setStuck(true);
    setMissed(0);
  }, []);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 110;
    setStuck(near);
    if (near) setMissed(0);
  };

  const lastId = messages.length ? messages[messages.length - 1].rawId : 0;
  const lastMine = messages.length ? messages[messages.length - 1].author === myName : false;

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (!el) return;
    if (seen.current === 0 || stuck || lastMine) {
      el.scrollTop = el.scrollHeight;
      setMissed(0);
    } else if (lastId > seen.current) {
      setMissed((value) => value + 1);
    }
    seen.current = lastId;
  }, [open, lastId, lastMine, stuck]);

  // ---------- закрытие всплывающих слоёв ----------
  useEffect(() => {
    if (!menuFor && !pickerFor && !emojiOpen) return;
    const close = (event: PointerEvent) => {
      if ((event.target as HTMLElement).closest(".agc-pop, .agc-tools, .agc-emoji-btn")) return;
      setMenuFor(null);
      setPickerFor(null);
      setEmojiOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menuFor, pickerFor, emojiOpen]);

  // ---------- действия ----------
  const startReply = (message: ChatMessage) => {
    setEditing(null);
    setReply(message);
    setActive(null);
    inputRef.current?.focus();
  };

  const startEdit = (message: ChatMessage) => {
    setReply(null);
    setEditing(message);
    setDraft(message.text);
    setActive(null);
    setMenuFor(null);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const cancelCompose = () => {
    setReply(null);
    setEditing(null);
    setDraft("");
  };

  const react = async (message: ChatMessage, emoji: string) => {
    setPickerFor(null);
    setActive(null);
    const error = await reactChatMessage(message.rawId, emoji);
    if (error) flash(error);
  };

  const remove = async (message: ChatMessage) => {
    setMenuFor(null);
    setActive(null);
    const error = await deleteChatMessage(message.rawId);
    if (error) flash(error);
  };

  const copy = async (message: ChatMessage) => {
    setMenuFor(null);
    try {
      await navigator.clipboard.writeText(message.text);
      flash("Скопировано");
    } catch {
      flash("Не удалось скопировать");
    }
  };

  const jumpTo = (id: number) => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-mid="${id}"]`);
    if (!el) return flash("Сообщение выше — прокрутите ленту");
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.add("is-flash");
    window.setTimeout(() => el.classList.remove("is-flash"), 1400);
  };

  const mention = (name: string) => {
    setDraft((value) => `${value}${value && !value.endsWith(" ") ? " " : ""}@${name} `);
    inputRef.current?.focus();
  };

  const submit = async () => {
    const text = draft.trim();
    if (!signedIn || !text || busy) return;
    setBusy(true);
    const error = editing
      ? await editChatMessage(editing.rawId, text)
      : await sendChatMessage(text, tagId, reply?.rawId);
    setBusy(false);
    if (error) return flash(error);
    cancelCompose();
    if (!editing) window.setTimeout(() => toBottom(true), 60);
  };

  const sendVoice = async () => {
    const clip = await voice.stop();
    if (!clip) return flash("Запись получилась пустой");
    if (clip.ms < 700) return flash("Слишком короткая запись");
    setBusy(true);
    const error = await sendChatVoice(clip.blob, clip.ms, clip.wave, tagId, reply?.rawId);
    setBusy(false);
    if (error) return flash(error);
    setReply(null);
    window.setTimeout(() => toBottom(true), 60);
  };

  // автовысота поля ввода
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [draft]);

  const insertEmoji = (emoji: string) => {
    const el = inputRef.current;
    if (!el) return setDraft((value) => (value + emoji).slice(0, CHAT_TEXT_LIMIT));
    const from = el.selectionStart ?? draft.length;
    const to = el.selectionEnd ?? draft.length;
    const next = (draft.slice(0, from) + emoji + draft.slice(to)).slice(0, CHAT_TEXT_LIMIT);
    setDraft(next);
    window.setTimeout(() => {
      el.focus();
      el.setSelectionRange(from + emoji.length, from + emoji.length);
    }, 0);
  };

  const onKey = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape" && (reply || editing)) {
      event.stopPropagation();
      return cancelCompose();
    }
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    // на телефоне Enter — новая строка, отправка кнопкой
    if (window.matchMedia("(pointer:coarse)").matches) return;
    event.preventDefault();
    void submit();
  };

  // ---------- разметка ленты ----------
  const rows = useMemo(
    () =>
      messages.map((message, index) => {
        const prev = index > 0 ? messages[index - 1] : null;
        const newDay = !prev || dayKey(prev.at) !== dayKey(message.at);
        const grouped =
          !!prev &&
          !newDay &&
          prev.author === message.author &&
          message.at - prev.at < 5 * 60_000 &&
          !message.reply &&
          !message.replyTo;
        return { message, newDay, grouped };
      }),
    [messages],
  );

  // «сейчас» для окна правки — обновляется раз в 20 секунд, а не при каждом рендере
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => setNow(Date.now()), 20_000);
    return () => window.clearInterval(timer);
  }, [open]);

  const recording = voice.state === "recording";
  const canEdit = (message: ChatMessage) =>
    message.author === myName && message.kind === "text" && !message.deleted && now - message.at < CHAT_EDIT_WINDOW_MS;

  return (
    <>
      <div ref={listRef} onScroll={onScroll} className="agc-list">
        {messages.length === 0 && (
          <div className="agc-empty">
            <span aria-hidden>💬</span>
            <b>Здесь пока тихо</b>
            <small>Напишите первым — или запишите голосовое</small>
          </div>
        )}

        {rows.map(({ message, newDay, grouped }) => {
          const self = message.author === myName;
          const tag = tagOf(message.tagId);
          const mentionsMe =
            !!myName && !self && message.text.toLowerCase().includes(`@${myName.toLowerCase()}`);
          const big = message.kind === "text" && !message.deleted && EMOJI_ONLY.test(message.text.trim());
          const isActive = active === message.id;
          return (
            <div key={message.id}>
              {newDay && (
                <div className="agc-day">
                  <span>{dayLabel(message.at)}</span>
                </div>
              )}
              <div
                data-mid={message.rawId}
                className={`agc-row${self ? " is-self" : ""}${grouped ? " is-grouped" : ""}${mentionsMe ? " is-mention" : ""}${isActive ? " is-active" : ""}`}
              >
                {!self && (
                  <Link
                    href={`/u/${encodeURIComponent(message.author)}`}
                    className="agc-ava"
                    aria-label={`Профиль ${message.author}`}
                    tabIndex={grouped ? -1 : 0}
                  >
                    {!grouped && (
                      <AvatarFrame
                        nickname={message.author}
                        avatar={message.avatar}
                        frame={message.frameId ? FRAMES.find((item) => item.id === message.frameId) : undefined}
                        size="xs"
                      />
                    )}
                  </Link>
                )}

                <div className="agc-col">
                  {!grouped && !self && (
                    <div className="agc-head">
                      <button type="button" className="agc-name" onClick={() => mention(message.author)} title="Упомянуть">
                        {message.author}
                      </button>
                      {tag && <AgTag tag={tag} size="sm" />}
                    </div>
                  )}

                  <div className="agc-bubble-wrap">
                    <div
                      className={`agc-bubble${big ? " is-big" : ""}${message.deleted ? " is-deleted" : ""}${message.kind === "voice" && !message.deleted ? " is-voice" : ""}`}
                      onClick={(event) => {
                        if ((event.target as HTMLElement).closest("a,button,.agc-voice")) return;
                        setActive((current) => (current === message.id ? null : message.id));
                      }}
                    >
                      {!message.deleted && message.reply && (
                        <button type="button" className="agc-quote" onClick={() => jumpTo(message.reply!.id)}>
                          <b>{message.reply.nickname}</b>
                          <span>
                            {message.reply.deleted ? "Сообщение удалено" : message.reply.kind === "voice" ? "🎤 Голосовое сообщение" : message.reply.text}
                          </span>
                        </button>
                      )}
                      {!message.deleted && !message.reply && message.replyTo > 0 && (
                        <span className="agc-quote is-gone">Исходное сообщение недоступно</span>
                      )}

                      {message.deleted ? (
                        <span className="agc-gone">Сообщение удалено</span>
                      ) : message.kind === "voice" ? (
                        <VoiceBubble id={message.rawId} ms={message.audioMs} wave={message.wave} />
                      ) : (
                        <p>{renderText(message.text, myName)}</p>
                      )}

                      <span className="agc-meta">
                        {message.editedAt > 0 && !message.deleted && <em>изменено</em>}
                        {timeLabel(message.at)}
                      </span>
                    </div>

                    {signedIn && !message.deleted && (
                      <div className={`agc-tools${isActive || menuFor === message.id || pickerFor === message.id ? " is-open" : ""}`}>
                        {QUICK.map((emoji) => (
                          <button key={emoji} type="button" className="agc-t-emoji" onClick={() => void react(message, emoji)} aria-label={`Реакция ${emoji}`}>
                            {emoji}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="agc-t"
                          aria-label="Все реакции"
                          onClick={() => {
                            setMenuFor(null);
                            setPickerFor((current) => (current === message.id ? null : message.id));
                          }}
                        >
                          <Svg d={ICON.plus} size={14} />
                        </button>
                        <i />
                        <button type="button" className="agc-t" aria-label="Ответить" onClick={() => startReply(message)}>
                          <Svg d={ICON.reply} size={15} />
                        </button>
                        <button
                          type="button"
                          className="agc-t"
                          aria-label="Ещё"
                          onClick={() => {
                            setPickerFor(null);
                            setMenuFor((current) => (current === message.id ? null : message.id));
                          }}
                        >
                          <Svg d={ICON.more} size={16} />
                        </button>

                        {pickerFor === message.id && (
                          <div className="agc-pop agc-pop-react">
                            {CHAT_EMOJI.map((emoji) => (
                              <button key={emoji} type="button" onClick={() => void react(message, emoji)}>
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                        {menuFor === message.id && (
                          <div className="agc-pop agc-pop-menu">
                            {message.kind === "text" && (
                              <button type="button" onClick={() => void copy(message)}>
                                <Svg d={ICON.copy} size={15} /> Копировать
                              </button>
                            )}
                            {canEdit(message) && (
                              <button type="button" onClick={() => startEdit(message)}>
                                <Svg d={ICON.edit} size={15} /> Изменить
                              </button>
                            )}
                            {(self || canModerate) && (
                              <button type="button" className="is-danger" onClick={() => void remove(message)}>
                                <Svg d={ICON.trash} size={15} /> Удалить
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {message.reactions.length > 0 && !message.deleted && (
                    <div className="agc-reacts">
                      {message.reactions.map((item) => (
                        <button
                          key={item.emoji}
                          type="button"
                          className={item.mine ? "is-mine" : undefined}
                          disabled={!signedIn}
                          onClick={() => void react(message, item.emoji)}
                          aria-label={`${item.emoji} — ${item.count}`}
                        >
                          <span>{item.emoji}</span>
                          <b>{item.count}</b>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="agc-composer">
        {!stuck && (
          <button type="button" className="agc-down" onClick={() => toBottom(true)} aria-label="К последним сообщениям">
            <Svg d={ICON.down} size={16} />
            {missed > 0 && <b>{missed > 99 ? "99+" : missed} нов.</b>}
          </button>
        )}
        {notice && (
          <p className="agc-notice" role="status">
            {notice}
          </p>
        )}
        {voice.error && (
          <p className="agc-notice is-error" role="alert" onClick={voice.clearError}>
            {voice.error}
          </p>
        )}

        {signedIn ? (
          <>
            {(reply || editing) && (
              <div className="agc-context">
                <Svg d={editing ? ICON.edit : ICON.reply} size={15} />
                <div>
                  <b>{editing ? "Редактирование" : `Ответ для ${reply!.author}`}</b>
                  <span>
                    {(editing ?? reply)!.kind === "voice" ? "🎤 Голосовое сообщение" : (editing ?? reply)!.text}
                  </span>
                </div>
                <button type="button" onClick={cancelCompose} aria-label="Отменить">
                  <Svg d={ICON.close} size={15} />
                </button>
              </div>
            )}

            {emojiOpen && !recording && (
              <div className="agc-pop agc-emoji-grid" role="listbox" aria-label="Эмодзи">
                {PICKER.map((emoji) => (
                  <button key={emoji} type="button" onClick={() => insertEmoji(emoji)}>
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            {recording ? (
              <div className="agc-rec">
                <button type="button" className="agc-rec-cancel" onClick={voice.cancel} aria-label="Отменить запись">
                  <Svg d={ICON.trash} size={17} />
                </button>
                <span className="agc-rec-dot" aria-hidden />
                <b>{fmtClock(voice.ms)}</b>
                <div className="agc-rec-wave" aria-hidden>
                  {Array.from({ length: 40 }, (_, index) => {
                    const level = voice.live[voice.live.length - 40 + index] ?? 0;
                    return <i key={index} style={{ height: `${10 + level * 90}%` }} />;
                  })}
                </div>
                <button type="button" className="agc-send" onClick={() => void sendVoice()} disabled={busy} aria-label="Отправить голосовое">
                  <Svg d={ICON.send} size={17} />
                </button>
              </div>
            ) : (
              <div className="agc-input">
                <button
                  type="button"
                  className="agc-emoji-btn"
                  onClick={() => setEmojiOpen((value) => !value)}
                  aria-label="Эмодзи"
                  aria-expanded={emojiOpen}
                >
                  <Svg d={ICON.smile} size={19} />
                </button>
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={onKey}
                  maxLength={CHAT_TEXT_LIMIT}
                  placeholder={editing ? "Измените сообщение…" : "Написать сообщение…"}
                  aria-label="Сообщение"
                />
                {draft.length > CHAT_TEXT_LIMIT - 60 && (
                  <span className={`agc-count${draft.length >= CHAT_TEXT_LIMIT ? " is-max" : ""}`}>{CHAT_TEXT_LIMIT - draft.length}</span>
                )}
                {draft.trim() || !voice.supported || editing ? (
                  <button type="button" className="agc-send" onClick={() => void submit()} disabled={!draft.trim() || busy} aria-label={editing ? "Сохранить" : "Отправить"}>
                    <Svg d={editing ? ICON.check : ICON.send} size={17} />
                  </button>
                ) : (
                  <button type="button" className="agc-send is-mic" onClick={() => void voice.start()} disabled={voice.state === "starting"} aria-label="Записать голосовое">
                    <Svg d={ICON.mic} size={18} />
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="agc-guest">Читать могут все, писать и отвечать — после входа в аккаунт</p>
        )}
      </div>
    </>
  );
}
