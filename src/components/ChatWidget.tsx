"use client";

/**
 * Плавающая кнопка + боковая панель общего чата (как в мессенджерах).
 *
 * Лента настоящая, одна на всех игроков (`lib/chat`, сервер). Читать
 * может любой гость, писать — только вошедшие. Участники носят теги
 * прогрессии — рядом с ником рисуется капсула `ag-tag` (FIX_TAGS §2),
 * свои сообщения подсвечиваются.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMyClan } from "@/lib/clans/client";
import { useAccount } from "@/lib/use-account";
import { useProgress } from "@/lib/progression/events";
import { ChatBody } from "@/components/chat/ChatBody";
import { markChatRead, unreadChatCount, useChatMessages, useChatRead } from "@/lib/chat";

/**
 * Плавающая кнопка кланов — соседняя с чатом.
 *
 * Показывает эмблему и цвет клана игрока, а если клана нет — щит.
 * Подсказка раскрывается влево, чтобы не упираться в правый край экрана.
 */
function ClanFab() {
  const clan = useMyClan().me?.clan ?? null;

  return (
    <Link
      href="/clans"
      aria-label={clan ? `Кланы — ${clan.name}, уровень ${clan.level}` : "Кланы"}
      title={clan ? `${clan.name} [${clan.tag}] · ур. ${clan.level}` : "Кланы"}
      className="ag-fab ag-fab--clan group fixed bottom-4 right-[72px] z-[94] grid h-12 w-12 place-items-center rounded-2xl border border-line bg-surface/90 text-2xl shadow-[0_18px_40px_-16px_rgba(0,0,0,0.9)] backdrop-blur transition hover:scale-105 hover:ring-2 hover:ring-accent/50"
    >
      <span aria-hidden>{clan ? "⚔️" : "🛡"}</span>

      {/* Подсказка с названием и уровнем — по наведению */}
      <span className="pointer-events-none absolute right-full top-1/2 mr-2 hidden -translate-y-1/2 whitespace-nowrap rounded-xl border border-line bg-surface/95 px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition group-hover:opacity-100 md:block">
        {clan ? `${clan.name} · ур. ${clan.level}` : "Кланы"}
      </span>
    </Link>
  );
}

export function ChatWidget() {
  const account = useAccount();
  const messages = useChatMessages();
  const read = useChatRead();
  const doc = useProgress();
  const [open, setOpen] = useState(false);

  const myName = account?.nickname ?? "";
  const unread = unreadChatCount(messages, read, myName);

  // открытая панель сразу читает всё новое
  useEffect(() => {
    if (open) markChatRead();
  }, [open, messages.length]);

  // На телефоне открытый чат — на весь экран: страница под ним не прокручивается
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    root.classList.add("ag-chat-open");
    return () => root.classList.remove("ag-chat-open");
  }, [open]);

  /**
   * Кнопки чата и кланов уезжают вниз, пока страница листается вниз, и
   * возвращаются при движении вверх. Иначе на телефоне они висят над
   * контентом правого нижнего угла (оценка тайтла, сетка серий) и
   * перехватывают нажатия.
   */
  useEffect(() => {
    let last = window.scrollY;
    let frame = 0;
    const apply = () => {
      frame = 0;
      const y = Math.max(0, window.scrollY);
      const d = y - last;
      if (Math.abs(d) > 6) {
        document.documentElement.classList.toggle("ag-fab-hide", d > 0 && y > 120);
        last = y;
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
      document.documentElement.classList.remove("ag-fab-hide");
    };
  }, []);

  // Esc закрывает панель
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Плавающие кнопки: кланы слева от чата, чат справа у края.
          Кланы — раздел с вкладом и топом, он логично живёт рядом с
          общением, а не в основной навигации шапки. */}
      {!open && <ClanFab />}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Открыть общий чат${unread > 0 ? `, непрочитанных: ${unread}` : ""}`}
          className="ag-fab ag-fab--chat fixed bottom-4 right-4 z-[94] grid h-12 w-12 place-items-center rounded-2xl border border-line bg-surface/90 text-accent-2 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.9)] backdrop-blur transition hover:scale-105 hover:ring-2 hover:ring-accent/50"
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
        className={`ag-chat-panel fixed inset-y-0 right-0 z-[93] flex w-full flex-col overscroll-contain border-line bg-surface/98 shadow-[-24px_0_60px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl transition-transform duration-300 sm:inset-y-3 sm:right-3 sm:w-[380px] sm:rounded-2xl sm:border ${
          open ? "translate-x-0" : "pointer-events-none translate-x-[calc(100%+2rem)]"
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent/15 text-accent-2 ring-1 ring-accent/30">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 10.5h7M8.5 14h4.5M21 11.6c0 4.3-4 7.4-9 7.4-1 0-2-.1-2.9-.4L4 20.5l1.3-3.6C3.9 15.6 3 13.7 3 11.6 3 7.3 7 4.6 12 4.6s9 2.7 9 7z" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-extrabold text-white">Общий чат</p>
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" aria-hidden />
                Лента обновляется вживую
              </p>
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

        <ChatBody
          open={open}
          signedIn={!!account}
          myName={myName}
          canModerate={false}
          tagId={doc.progress.equippedTagId || undefined}
          messages={messages}
        />
      </div>
    </>
  );
}
