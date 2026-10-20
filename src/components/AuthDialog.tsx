"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Logo } from "./Logo";
import {
  loginAccount,
  loginTelegramDemo,
  loginTelegramVerified,
  registerAccount,
  validateNickname,
  validateEmail,
  TELEGRAM_DEMO_ACCOUNTS,
} from "@/lib/auth";
import {
  closeAuthDialog,
  getAuthDialogState,
  getServerAuthDialogState,
  openAuthDialog,
  subscribeAuthDialog,
  type AuthTab,
} from "@/lib/auth-dialog";
import { useModalBehaviour } from "@/lib/use-local-storage";

/* ------------------------------ Иконки -------------------------------- */

function UserIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function MailIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m3 7 9 6 9-6" />
    </svg>
  );
}

function LockIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="4" y="10.5" width="16" height="10.5" rx="2.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function EyeIcon({ open, className = "h-4 w-4" }: { open: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      {open ? (
        <>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
          <circle cx="12" cy="12" r="2.6" />
        </>
      ) : (
        <>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.6 6.2A9.9 9.9 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3.4 4M6.3 7.8A16.6 16.6 0 0 0 2 12s3.6 6 10 6c1.5 0 2.8-.3 4-.8" />
        </>
      )}
    </svg>
  );
}

function CheckIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" aria-hidden>
      <path
        d="M13.5 4.5 6 12l-3.5-3.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Знак Telegram (бумажный самолётик) — фирменный контур из брендбука */
function TelegramIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M21.5 3.4 2.6 10.7c-.9.35-.87 1.63.04 1.94l4.72 1.6 1.82 5.6c.26.8 1.3.99 1.84.34l2.5-3 4.7 3.46c.6.44 1.46.11 1.62-.61l3.2-15.2c.17-.8-.64-1.47-1.54-1.43ZM8.9 13.8l8.6-5.4-6.6 6.35-.24 3.1-1.76-4.05Z" />
    </svg>
  );
}

/* --------------------------- Левая панель ----------------------------- */

const PERKS = [
  "Большая библиотека и хронология франшизы",
  "Свои подборки, избранное и история просмотра",
  "Premium: 4K, без рекламы и ранний доступ",
  "Работает на телефоне, планшете и ТВ",
];

function Aside() {
  return (
    <div className="relative hidden w-[42%] shrink-0 flex-col justify-between overflow-hidden border-r border-white/8 bg-gradient-to-b from-accent/28 via-accent-2/12 to-transparent p-8 lg:flex">
      {/* Декоративные blob'ы */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-accent/30 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -right-16 top-1/3 h-64 w-64 rounded-full bg-accent-2/25 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute bottom-0 left-1/4 h-56 w-56 rounded-full bg-mint/12 blur-3xl" aria-hidden />
      <span
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
          backgroundSize: "34px 34px",
        }}
        aria-hidden
      />

      <div className="relative">
        <Logo />
      </div>

      <div className="relative">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/85 ring-1 ring-white/15">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint" />
          Аккаунт AniGalaxy
        </span>
        <h2 className="mt-4 text-[26px] font-extrabold leading-tight tracking-tight text-white">
          Смотри аниме, собирай коллекцию
        </h2>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/70">
          Огромная библиотека, высокое качество и удобный просмотр на любом устройстве — вход
          сохраняет подборки, избранное и статус подписки.
        </p>

        <ul className="mt-6 space-y-3">
          {PERKS.map((perk) => (
            <li key={perk} className="flex items-start gap-2.5 text-sm text-white/85">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/25 text-accent ring-1 ring-accent/45">
                <CheckIcon />
              </span>
              {perk}
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-xs text-white/45">
        Аккаунт хранится локально в этом браузере — серверу данные не передаются.
      </p>
    </div>
  );
}

/* ------------------------------ Поля ---------------------------------- */

interface FieldProps {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: string;
  maxLength?: number;
  icon: React.ReactNode;
  toggle?: { shown: boolean; onToggle: () => void };
}

function Field({
  id,
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  maxLength,
  icon,
  toggle,
}: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-muted">
        {label}
      </label>
      <div className="group relative">
        <span className="pointer-events-none absolute left-3.5 top-3.5 text-muted transition-colors group-focus-within:text-accent">
          {icon}
        </span>
        <input
          id={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          maxLength={maxLength}
          required
          className={`h-12 w-full rounded-xl bg-white/[0.04] text-sm text-white ring-1 ring-white/10 transition placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/55 ${
            toggle ? "pl-11 pr-11" : "pl-11 pr-4"
          }`}
        />
        {toggle && (
          <button
            type="button"
            onClick={toggle.onToggle}
            tabIndex={-1}
            aria-label={toggle.shown ? "Скрыть пароль" : "Показать пароль"}
            className="absolute right-3.5 top-3.5 text-muted transition hover:text-white"
          >
            <EyeIcon open={toggle.shown} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------------------- Модалка --------------------------------- */

export function AuthDialog() {
  const state = useSyncExternalStore(
    subscribeAuthDialog,
    getAuthDialogState,
    getServerAuthDialogState,
  );

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Открыт ли выбор демо-аккаунта Telegram (вкладка «Вход») */
  const [tgOpen, setTgOpen] = useState(false);
  const [tgRealOpen, setTgRealOpen] = useState(false);
  const tgContainerRef = useRef<HTMLDivElement | null>(null);

  /** Закрытие: сбрасываем ошибку, чтобы она не всплывала при следующем открытии */
  const close = useCallback(() => {
    setError(null);
    setTgOpen(false);
    closeAuthDialog();
  }, []);
  const panelRef = useModalBehaviour(state.open, close);

  const tab: AuthTab = state.tab;

  const onBackdrop = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) close();
    },
    [close],
  );

  const switchTab = useCallback((next: AuthTab) => {
    setError(null);
    setTgOpen(false);
    openAuthDialog(next);
  }, []);

  const onLogin = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      const result = loginAccount(login, password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setLogin("");
      setPassword("");
      close();
    },
    [login, password, close],
  );

  const onRegister = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      const result = registerAccount(nickname, email, regPassword, confirm);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setNickname("");
      setEmail("");
      setRegPassword("");
      setConfirm("");
      close();
    },
    [nickname, email, regPassword, confirm, close],
  );

  const onTelegram = useCallback(
    (username: string) => {
      const result = loginTelegramDemo(username);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setTgOpen(false);
      setLogin("");
      setPassword("");
      close();
    },
    [close],
  );

  useEffect(() => {
    if (!tgRealOpen || !tgContainerRef.current) return;
    const container = tgContainerRef.current;
    container.innerHTML = "";
    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "anigalaxy_bot";

    (window as unknown as { onTelegramAuth?: (user: unknown) => void }).onTelegramAuth = async (user) => {
      try {
        const response = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(user),
        });
        const data = await response.json();
        if (!response.ok || !data.ok) {
          setError(data.error || "Не удалось войти через Telegram");
          return;
        }
        const result = loginTelegramVerified({ nickname: data.nickname, telegram: data.telegram });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setError(null);
        setTgRealOpen(false);
        setTgOpen(false);
        close();
      } catch {
        setError("Не удалось связаться с сервером");
      }
    };

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "medium");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [tgRealOpen, close]);

  if (!state.open) return null;

  const loginReady = login.trim().length > 0 && password.length > 0;
  const registerReady =
    validateNickname(nickname) === null &&
    validateEmail(email) === null &&
    regPassword.length >= 6 &&
    confirm.length > 0;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center sm:p-6"
      onMouseDown={onBackdrop}
    >
      <div className="absolute inset-0 bg-ink/88 backdrop-blur-sm" aria-hidden />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        tabIndex={-1}
        className="relative flex h-full w-full overflow-hidden bg-ink-soft outline-none sm:h-[640px] sm:max-h-[calc(100vh-3rem)] sm:w-[900px] sm:rounded-3xl sm:border sm:border-white/10 sm:shadow-[0_40px_100px_-30px_rgba(0,0,0,1)]"
      >
        <Aside />

        {/* Форма */}
        <div className="relative flex min-w-0 flex-1 flex-col overflow-y-auto">
          <button
            type="button"
            onClick={close}
            aria-label="Закрыть"
            className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full text-muted ring-1 ring-transparent transition hover:bg-white/10 hover:text-white hover:ring-white/10"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>

          <div className="flex flex-1 flex-col px-5 pb-8 pt-10 sm:px-10 sm:pt-12">
            {/* Переключатель «Вход / Регистрация» */}
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/[0.05] p-1 ring-1 ring-white/10">
              {(["login", "register"] as AuthTab[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => switchTab(value)}
                  aria-pressed={tab === value}
                  className={`rounded-lg px-3 py-2 text-sm font-extrabold transition ${
                    tab === value
                      ? "bg-gradient-to-r from-accent to-accent-2 text-white shadow-[0_8px_20px_-10px_rgba(31,123,255,1)]"
                      : "text-muted hover:text-white"
                  }`}
                >
                  {value === "login" ? "Вход" : "Регистрация"}
                </button>
              ))}
            </div>

            <div className="mt-7">
              <h2 id="auth-title" className="text-2xl font-extrabold tracking-tight text-white sm:text-[28px]">
                {tab === "login" ? "С возвращением!" : "Создай аккаунт"}
              </h2>
              <p className="mt-1.5 text-sm text-muted">
                {tab === "login"
                  ? "Войди, чтобы продолжить с того же места."
                  : "Это займёт меньше минуты — и все твои списки будут под рукой."}
              </p>
            </div>

            {tab === "login" ? (
              <>
              <form onSubmit={onLogin} className="mt-6 flex flex-col gap-4">
                <Field
                  id="auth-login"
                  label="Никнейм или почта"
                  type="text"
                  value={login}
                  onChange={setLogin}
                  placeholder="hunter"
                  autoComplete="username"
                  maxLength={64}
                  icon={<UserIcon />}
                />
                <Field
                  id="auth-password"
                  label="Пароль"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={setPassword}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  maxLength={72}
                  icon={<LockIcon />}
                  toggle={{
                    shown: showPassword,
                    onToggle: () => setShowPassword((value) => !value),
                  }}
                />

                {error && <ErrorBox message={error} />}

                <button
                  type="submit"
                  disabled={!loginReady}
                  className="btn-auth-submit"
                >
                  Войти
                </button>

                <p className="text-center text-sm text-muted">
                  Нет аккаунта?{" "}
                  <button
                    type="button"
                    onClick={() => switchTab("register")}
                    className="font-bold text-accent transition hover:text-white"
                  >
                    Зарегистрироваться
                  </button>
                </p>

                {/* Разделение двух разных входов. Эта форма проверяет
                    localStorage-аккаунт (см. lib/auth.ts), а /login — серверную
                    сессию в базе. Раньше единственным входом в админку был
                    прямой заход на /login, и первый же сотрудник вводил свои
                    данные сюда и получал «Аккаунт не найден». */}
                <p className="mt-4 border-t border-white/10 pt-4 text-center text-xs text-muted/80">
                  Сотрудник сайта?{" "}
                  <a
                    href="/login"
                    className="font-bold text-accent transition hover:text-white"
                  >
                    Войти в панель управления
                  </a>
                </p>
              </form>

              {/* Демо-вход через Telegram: без токена бота подпись не проверить,
                  поэтому аккаунт создаётся локально — это подписано в UI */}
              <div className="mt-5">
                <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.14em] text-muted/70">
                  <span className="h-px flex-1 bg-white/10" aria-hidden />
                  или
                  <span className="h-px flex-1 bg-white/10" aria-hidden />
                </div>

                <button
                  type="button"
                  onClick={() => setTgRealOpen((value) => !value)}
                  aria-label="Войти через Telegram"
                  className="mt-3 flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#2AABEE] px-4 py-3 text-sm font-extrabold text-white transition hover:bg-[#229ED9] active:scale-[0.99]"
                >
                  <TelegramIcon className="h-4.5 w-4.5" />
                  Войти через Telegram
                </button>

                {tgRealOpen && (
                  <div ref={tgContainerRef} className="mt-3 flex justify-center rounded-xl border border-white/10 bg-white/[0.03] p-3" />
                )}

                {!tgOpen ? (
                  <button
                    type="button"
                    onClick={() => setTgOpen(true)}
                    aria-label="Войти через Telegram (демо)"
                    className="mt-3 flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#2AABEE] px-4 py-3 text-sm font-extrabold text-white transition hover:bg-[#229ED9] active:scale-[0.99]"
                  >
                    <TelegramIcon className="h-4.5 w-4.5" />
                    Продолжить через Telegram
                    <span className="rounded bg-black/20 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide">
                      демо
                    </span>
                  </button>
                ) : (
                  <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 animate-fade-in">
                    <p className="text-xs font-extrabold text-white">
                      Выберите аккаунт <span className="font-bold text-muted">· демо-вход</span>
                    </p>
                    <div className="mt-2 space-y-1.5">
                      {TELEGRAM_DEMO_ACCOUNTS.map((acc) => (
                        <button
                          key={acc.username}
                          type="button"
                          onClick={() => onTelegram(acc.username)}
                          aria-label={`Войти как @${acc.username}`}
                          className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left ring-1 ring-white/8 transition hover:bg-white/8 hover:ring-accent/45"
                        >
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#2AABEE] to-[#229ED9] text-xs font-black text-white">
                            {acc.name.slice(0, 1)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold text-white">{acc.name}</span>
                            <span className="block truncate text-xs text-muted">@{acc.username}</span>
                          </span>
                          <svg
                            viewBox="0 0 24 24"
                            className="h-3.5 w-3.5 shrink-0 text-muted"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.4"
                            aria-hidden
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="m9 6 6 6-6 6" />
                          </svg>
                        </button>
                      ))}
                    </div>
                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setTgOpen(false)}
                        className="text-xs font-bold text-muted transition hover:text-white"
                      >
                        ← Назад
                      </button>
                      <span className="text-right text-[10px] leading-tight text-muted/70">
                        без бота: аккаунт создаётся локально
                      </span>
                    </div>
                  </div>
                )}
              </div>
              </>
            ) : (
              <form onSubmit={onRegister} className="mt-6 flex flex-col gap-4">
                <Field
                  id="auth-nickname"
                  label="Никнейм"
                  type="text"
                  value={nickname}
                  onChange={setNickname}
                  placeholder="hunter"
                  autoComplete="username"
                  maxLength={32}
                  icon={<UserIcon />}
                />
                <Field
                  id="auth-email"
                  label="Почта"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="you@example.com"
                  autoComplete="email"
                  maxLength={64}
                  icon={<MailIcon />}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    id="auth-reg-password"
                    label="Пароль"
                    type={showPassword ? "text" : "password"}
                    value={regPassword}
                    onChange={setRegPassword}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    maxLength={72}
                    icon={<LockIcon />}
                    toggle={{
                      shown: showPassword,
                      onToggle: () => setShowPassword((value) => !value),
                    }}
                  />
                  <Field
                    id="auth-confirm"
                    label="Ещё раз"
                    type={showPassword ? "text" : "password"}
                    value={confirm}
                    onChange={setConfirm}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    maxLength={72}
                    icon={<LockIcon />}
                  />
                </div>

                {error && <ErrorBox message={error} />}

                <button
                  type="submit"
                  disabled={!registerReady}
                  className="btn-auth-submit"
                >
                  Создать аккаунт
                </button>

                <p className="text-center text-sm text-muted">
                  Уже есть аккаунт?{" "}
                  <button
                    type="button"
                    onClick={() => switchTab("login")}
                    className="font-bold text-accent transition hover:text-white"
                  >
                    Войти
                  </button>
                </p>
              </form>
            )}

            <p className="mt-5 text-center text-xs leading-relaxed text-muted/70">
              Аккаунт создаётся только в этом браузере: проект работает без сервера, данные никуда
              не отправляются.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-accent-2/35 bg-accent-2/10 px-3.5 py-3 text-sm text-accent-2 animate-fade-in">
      <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-accent-2/25 text-xs font-bold">
        !
      </span>
      <p>{message}</p>
    </div>
  );
}

/**
 * Кнопка, открывающая модалку авторизации из серверных страниц
 * (страница Premium, профиль): сам диалог живёт в шапке.
 */
export function AuthTrigger({
  tab = "login",
  className,
  children,
}: {
  tab?: AuthTab;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={() => openAuthDialog(tab)} className={className}>
      {children}
    </button>
  );
}
