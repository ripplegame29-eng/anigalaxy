"use client";

/**
 * Плавающая кнопка + боковая панель общего чата (как в мессенджерах).
 *
 * Серверов у проекта нет: «онлайн» симулируется локально (`lib/chat`),
 * сообщения живут в localStorage и синхронизируются между вкладками.
 * Участники носят теги прогрессии — рядом с ником рисуется капсула
 * `ag-tag` (FIX_TAGS §2), свои сообщения подсвечиваются.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { clanLevel, useClans } from "@/lib/clans";
import { useAccount } from "@/lib/use-account";
import { useProgress } from "@/lib/progression/events";
import { PROGRESSION_CONFIG } from "@/lib/progression/progression.config";
import { AgTag } from "@/components/progression/AgTag";
import {
  CHAT_TEXT_LIMIT,
  markChatRead,
  sendChatMessage,
  startChatSimulation,
  unreadChatCount,
  useChat,
} from "@/lib/chat";

const timeLabel = (at: number): string =>
  new Date(at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

/**
 * Плавающая кнопка кланов — соседняя с чатом.
 *
 * Показывает эмблему и цвет клана игрока, а если клана нет — щит.
 * Подсказка раскрывается влево, чтобы не упираться в правый край экрана.
 */
function ClanFab() {
  const state = useClans();
  const clan = state.own;

  return (
    <Link
      href="/clans"
      aria-label={clan ? `Кланы — ${clan.name}, уровень ${clanLevel(clan.points)}` : "Кланы"}
      title={clan ? `${clan.name} [${clan.tag}] · ур. ${clanLevel(clan.points)}` : "Кланы"}
      className="group fixed bottom-4 right-[72px] z-[94] grid h-12 w-12 place-items-center rounded-2xl border border-line bg-surface/90 text-2xl shadow-[0_18px_40px_-16px_rgba(0,0,0,0.9)] backdrop-blur transition hover:scale-105 hover:ring-2 hover:ring-accent/50"
      style={
        clan
          ? {
              // Эмодзи не наследует `color`, поэтому подкрашиваем фон и рамку
              borderColor: `color-mix(in oklab, ${clan.color} 55%, transparent)`,
              background: `radial-gradient(circle at 50% 50%, color-mix(in oklab, ${clan.color} 22%, transparent), rgb(15 17 26 / 92%) 70%)`,
              boxShadow: `0 18px 40px -16px color-mix(in oklab, ${clan.color} 60%, rgb(0 0 0 / 0.9))`,
            }
          : undefined
      }
    >
      <span aria-hidden>{clan ? clan.emblem : "🛡"}</span>

      {/* Подсказка с названием и уровнем — по наведению */}
      <span className="pointer-events-none absolute right-full top-1/2 mr-2 hidden -translate-y-1/2 whitespace-nowrap rounded-xl border border-line bg-surface/95 px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition group-hover:opacity-100 md:block">
        {clan ? `${clan.name} · ур. ${clanLevel(clan.points)}` : "Кланы"}
      </span>
    </Link>
  );
}

function tagOf(id?: string) {
  return id ? PROGRESSION_CONFIG.tags.find((item) => item.id === id) : undefined;
}

export function ChatWidget({
  showClans = true,
  showChat = true,
}: {
  showClans?: boolean;
  showChat?: boolean;
}) {
  const account = useAccount();
  const chat = useChat();
  const doc = useProgress();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  // фоновый цикл «онлайна» — один на приложение
  useEffect(() => startChatSimulation(), []);

  const unread = unreadChatCount(chat);

  // открытая панель сразу читает всё новое
  useEffect(() => {
    if (open) markChatRead();
  }, [open, chat.messages.length]);

  // автоскролл к последнему сообщению
  useEffect(() => {
    const el = listRef.current;
    if (open && el) el.scrollTop = el.scrollHeight;
  }, [open, chat.messages.length]);

  // Esc закрывает панель
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const send = () => {
    if (!account) return;
    const text = draft.trim();
    if (!text) return;
    sendChatMessage(account.nickname, text, doc.progress.equippedTagId || undefined);
    setDraft("");
  };

  const online = 4 + (chat.messages.length % 5);

  return (
    <>
      {/* Плавающие кнопки: кланы слева от чата, чат справа у края.
          Кланы — раздел с вкладом и топом, он логично живёт рядом с
          общением, а не в основной навигации шапки. */}
      {!open && showClans && <ClanFab />}
      {!open && showChat && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Открыть общий чат${unread > 0 ? `, непрочитанных: ${unread}` : ""}`}
          className="fixed bottom-4 right-4 z-[94] grid h-12 w-12 place-items-center rounded-2xl border border-line bg-surface/90 text-accent-2 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.9)] backdrop-blur transition hover:scale-105 hover:ring-2 hover:ring-accent/50"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.5 10.5h7M8.5 14h4.5M21 11.6c0 4.3-4 7.4-9 7.4-1 0-2-.1-2.9-.4L4 20.5l1.3-3.6C3.9 15.6 3 13.7 3 11.6 3 7.3 7 4.6 12 4.6s9 2.7 9 7z"
            />
          </svg>
          {unread > 0 && (
            /* Контраст: белый на --accent давал 3.76 при 10px. Кегль поднят
               до 11px, а насыщенность фона снижена до --accent-strong —
               с белым это 4.7:1, и цифра остаётся читаемой. */
            <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#1f5fd0] px-1 text-[11px] font-black text-white ring-2 ring-surface">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      )}

      {/* Боковая панель (не модалка: complementary-область, чтобы не ломать
          селекторы [role="dialog"] модалок проекта) */}
      {/* aria-hidden на закрытой панели прячет её от скринридера, но оставляет
          фокусируемые элементы внутри — Lighthouse (aria-hidden-focus).
          Поэтому закрытая панель получает inert: из неё нельзя уйти
          табом и она не читается, а при открытии всё работает как обычно. */}
      <div
        role="complementary"
        aria-label="Общий чат"
        aria-hidden={!open}
        inert={!open}
        className={`fixed inset-y-0 right-0 z-[93] flex w-full flex-col border-line bg-surface/98 shadow-[-24px_0_60px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl transition-transform duration-300 sm:inset-y-3 sm:right-3 sm:w-[380px] sm:rounded-2xl sm:border ${
          open ? "translate-x-0" : "pointer-events-none translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent/15 text-accent-2 ring-1 ring-accent/30">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 10.5h7M8.5 14h4.5M21 11.6c0 4.3-4 7.4-9 7.4-1 0-2-.1-2.9-.4L4 20.5l1.3-3.6C3.9 15.6 3 13.7 3 11.6 3 7.3 7 4.6 12 4.6s9 2.7 9 7z" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-extrabold text-white">Общий чат</p>
              <p className="text-[11px] font-semibold text-mint">● {online} в сети</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Закрыть чат"
            className="grid h-8 w-8 place-items-center rounded-lg bg-white/6 text-muted ring-1 ring-white/10 transition hover:bg-white/12 hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
              <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div ref={listRef} className="flex-1 space-y-3.5 overflow-y-auto px-4 py-3">
          {chat.messages.length === 0 && (
            <p className="rounded-xl border border-dashed border-line bg-white/[0.02] px-4 py-6 text-center text-xs text-muted">
              Тихо… напишите первым
            </p>
          )}
          {chat.messages.map((message) => {
            const tag = tagOf(message.tagId);
            return (
              <div key={message.id} className={`flex items-start gap-2.5 ${message.self ? "flex-row-reverse" : ""}`}>
                <span
                  className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-black text-white ${
                    message.self ? "bg-gradient-to-br from-accent to-accent-2" : "bg-white/12"
                  }`}
                >
                  {message.author.slice(0, 2).toUpperCase()}
                </span>
                <div className={`min-w-0 max-w-[80%] ${message.self ? "text-right" : ""}`}>
                  <div className={`flex flex-wrap items-center gap-1.5 ${message.self ? "flex-row-reverse" : ""}`}>
                    <span className={`text-[11px] font-black ${message.self ? "text-accent-2" : "text-white"}`}>
                      {message.author}
                    </span>
                    {tag && <AgTag tag={tag} size="sm" />}
                    <span className="text-[10px] font-semibold text-muted">{timeLabel(message.at)}</span>
                  </div>
                  <p
                    className={`mt-1 inline-block whitespace-pre-wrap break-words rounded-xl px-3 py-1.5 text-left text-xs leading-relaxed ${
                      message.self ? "bg-accent/18 text-white ring-1 ring-accent/30" : "bg-white/6 text-white/90 ring-1 ring-white/8"
                    }`}
                  >
                    {message.text}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-line p-3">
          {account ? (
            <div className="flex items-center gap-2">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") send();
                }}
                maxLength={CHAT_TEXT_LIMIT}
                placeholder="Написать сообщение…"
                className="min-w-0 flex-1 rounded-xl bg-white/6 px-3.5 py-2.5 text-sm text-white ring-1 ring-white/10 transition placeholder:text-muted/70 focus:outline-none focus:ring-accent/60"
              />
              <button
                type="button"
                onClick={send}
                disabled={!draft.trim()}
                aria-label="Отправить"
                className="btn-primary grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white disabled:cursor-not-allowed disabled:opacity-45"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12 19 5.5 13.5 19l-2-5.5-7-1.5z" />
                </svg>
              </button>
            </div>
          ) : (
            <p className="rounded-xl bg-white/[0.04] px-3.5 py-2.5 text-center text-xs text-muted ring-1 ring-white/8">
              Читать могут все, писать — после входа в аккаунт
            </p>
          )}
          {/* text-muted/70 давал 4.01 при 10px. Полный --muted и 11px дают 6.9:1 —
          подпись в чате должна читаться, а не угадываться. */}
          <p className="mt-1.5 text-center text-[11px] text-muted">
            Серверов нет: чат локальный, «онлайн» симулируется в этом браузере
          </p>
        </div>
      </div>
    </>
  );
}
