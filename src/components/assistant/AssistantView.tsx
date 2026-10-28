"use client";

/**
 * Страница ИИ-ассистента «Нова»: чат с подбором аниме и поиском по сюжету.
 *
 * Состояние чата хранится в localStorage (последние реплики), на сервер
 * уходит только текст запроса. Ответ приходит вместе с карточками тайтлов,
 * которые уже проверены по каталогу сайта.
 */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Poster } from "@/components/Poster";
import { formatRating, kindLabel, shikimoriPoster } from "@/lib/anime";
import { openAuthDialog } from "@/lib/auth-dialog";
import { useAccount } from "@/lib/use-account";
import { useHydrated } from "@/lib/use-hydrated";

interface Pick {
  id: string;
  title: string;
  year?: number;
  poster?: string;
  shikimoriId?: number;
  rating?: number;
  kind?: Parameters<typeof kindLabel>[0];
  genres: string[];
  why: string;
}

interface Msg {
  role: "user" | "assistant";
  content: string;
  picks?: Pick[];
  /** Сообщение об ошибке: показывается, но модели в историю не уходит */
  error?: boolean;
}

const STORE_KEY = "ag-assistant-chat-v1";
const KEEP = 40;

const STARTERS = [
  {
    title: "Под настроение",
    text: "Посоветуй что-нибудь лёгкое и доброе на вечер",
    icon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
  },
  {
    title: "Поиск по сюжету",
    text: "Помоги найти аниме: школьник попадает в виртуальную игру и не может из неё выйти",
    icon: (
      <>
        <circle cx="11" cy="11" r="6.5" />
        <path d="M16 16l4.5 4.5" />
      </>
    ),
  },
  {
    title: "Что дальше",
    text: "Что посмотреть после «Атаки титанов»?",
    icon: <path d="M4 12h14M12 5l7 7-7 7" />,
  },
  {
    title: "Коротко и сильно",
    text: "Короткое аниме до 13 серий с хорошим сюжетом",
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </>
    ),
  },
];

function load(): Msg[] {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    const data = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(data)) return [];
    return data
      .filter((m): m is Msg => !!m && typeof m === "object" && typeof (m as Msg).content === "string")
      .slice(-KEEP);
  } catch {
    return [];
  }
}

function Spark({ id, className }: { id: string; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6aa8ff" />
          <stop offset="1" stopColor="#2b7fff" />
        </linearGradient>
      </defs>
      <path d="M30 6l5.4 15.6L51 27l-15.6 5.4L30 48l-5.4-15.6L9 27l15.6-5.4z" fill={`url(#${id})`} />
      <path d="M50 38l2.3 6.7 6.7 2.3-6.7 2.3L50 56l-2.3-6.7L41 47l6.7-2.3z" fill={`url(#${id})`} opacity=".75" />
    </svg>
  );
}

function PickCard({ pick }: { pick: Pick }) {
  const meta = [pick.year, kindLabel(pick.kind), pick.genres[0]].filter(Boolean).join(" · ");
  const rating = formatRating(pick.rating);
  return (
    <Link href={`/title/${pick.id}`} className="ast-pick">
      <span className="ast-pick-poster">
        <Poster
          src={pick.poster}
          fallback={pick.shikimoriId ? shikimoriPoster(pick.shikimoriId) : undefined}
          alt={pick.title}
          title={pick.title}
          sizes="96px"
          className="object-cover"
        />
      </span>
      <span className="ast-pick-body">
        <b>{pick.title}</b>
        <small>
          {meta}
          {rating ? <em>★ {rating}</em> : null}
        </small>
        {pick.why ? <span className="ast-pick-why">{pick.why}</span> : null}
        <span className="ast-pick-go">
          Смотреть
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </span>
    </Link>
  );
}

function Chat({ enabled }: { enabled: boolean }) {
  const account = useAccount();
  const [msgs, setMsgs] = useState<Msg[]>(load);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(msgs.slice(-KEEP)));
    } catch {
      /* приватный режим: чат живёт до закрытия страницы */
    }
  }, [msgs]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, busy]);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || busy || !enabled) return;
      if (!account) {
        openAuthDialog("login");
        return;
      }
      const mine: Msg = { role: "user", content: text };
      const history = [...msgs, mine];
      setMsgs(history);
      setInput("");
      if (field.current) field.current.style.height = "";
      setBusy(true);
      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.content })),
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          reply?: string;
          picks?: Pick[];
          error?: string;
          code?: string;
        };
        if (res.status === 401) {
          openAuthDialog("login");
          setMsgs(history.slice(0, -1));
          setInput(text);
          return;
        }
        if (!res.ok || !data.reply) {
          setMsgs([
            ...history,
            {
              role: "assistant",
              content: data.error ?? "Что-то пошло не так. Попробуйте ещё раз.",
              error: true,
            },
          ]);
          return;
        }
        setMsgs([
          ...history,
          { role: "assistant", content: data.reply, picks: data.picks ?? [] },
        ]);
      } catch {
        setMsgs([
          ...history,
          { role: "assistant", content: "Нет связи с сервером. Проверьте интернет и повторите.", error: true },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [account, busy, enabled, msgs],
  );

  const reset = () => {
    setMsgs([]);
    setInput("");
  };

  const empty = msgs.length === 0;

  return (
    <div className="ast-wrap">
      {empty ? (
        <header className="ast-hero">
          <span className="ast-orb" aria-hidden>
            <i className="ast-ring r1" />
            <i className="ast-ring r2" />
            <i className="ast-ring r3" />
            <Spark id="ast-g1" />
          </span>
          <span className="ast-badge">
            <i />
            ИИ-помощник · бета
          </span>
          <h1 className="ast-h1">Нова — ваш ИИ-гид по аниме</h1>
          <p className="ast-lead">
            Расскажите, какое у вас настроение, опишите сюжет или сцену, которую запомнили, — и Нова подскажет, что
            посмотреть. Всё, что она советует, можно сразу открыть на AniGalaxy.
          </p>
          {!enabled ? (
            <p className="ast-soon">Нова пока настраивается и скоро будет доступна.</p>
          ) : !account ? (
            <button type="button" className="ast-login" onClick={() => openAuthDialog("login")}>
              Войти, чтобы начать
            </button>
          ) : null}
          <div className="ast-starters">
            {STARTERS.map((s) => (
              <button
                key={s.title}
                type="button"
                className="ast-starter"
                disabled={!enabled || busy}
                onClick={() => void send(s.text)}
              >
                <i className="ast-starter-ic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    {s.icon}
                  </svg>
                </i>
                <b>{s.title}</b>
                <span>{s.text}</span>
              </button>
            ))}
          </div>
        </header>
      ) : (
        <div className="ast-bar">
          <span className="ast-bar-name">
            <Spark id="ast-g2" className="ast-bar-ic" />
            Нова
          </span>
          <button type="button" className="ast-new" onClick={reset} disabled={busy}>
            Новый чат
          </button>
        </div>
      )}

      {!empty && (
        <div className="ast-log" role="log" aria-live="polite">
          {msgs.map((m, i) => (
            <div key={i} className={`ast-msg ast-${m.role}${m.error ? " ast-err" : ""}`}>
              {m.role === "assistant" && (
                <span className="ast-av">
                  <Spark id={`ast-a${i}`} />
                </span>
              )}
              <div className="ast-col">
                <p className="ast-bub">{m.content}</p>
                {m.picks && m.picks.length > 0 && (
                  <div className="ast-picks">
                    {m.picks.map((p) => (
                      <PickCard key={p.id} pick={p} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="ast-msg ast-assistant">
              <span className="ast-av">
                <Spark id="ast-typing" />
              </span>
              <div className="ast-col">
                <p className="ast-bub ast-typing" aria-label="Нова печатает">
                  <i />
                  <i />
                  <i />
                </p>
              </div>
            </div>
          )}
          <div ref={bottom} />
        </div>
      )}

      <form
        className="ast-compose"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <textarea
          ref={field}
          rows={1}
          value={input}
          maxLength={1000}
          disabled={!enabled}
          placeholder={enabled ? "Опишите сюжет или спросите, что посмотреть…" : "Нова скоро будет доступна"}
          onChange={(e) => {
            setInput(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send(input);
            }
          }}
        />
        <button type="submit" className="ast-send" disabled={!enabled || busy || !input.trim()} aria-label="Отправить">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </form>
      <p className="ast-note">Нова — ИИ и может ошибаться. Описание и серии проверяйте на странице тайтла.</p>
    </div>
  );
}

export function AssistantView({ enabled }: { enabled: boolean }) {
  // История читается из localStorage, поэтому чат монтируется только в браузере
  const mounted = useHydrated();
  return (
    <div className="ast-page">
      {mounted ? (
        <Chat enabled={enabled} />
      ) : (
        <div className="ast-wrap" aria-hidden>
          <div className="ast-hero">
            <span className="ast-orb" />
          </div>
        </div>
      )}
    </div>
  );
}
