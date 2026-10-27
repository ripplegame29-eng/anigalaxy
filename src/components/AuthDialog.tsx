"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import "./auth-dialog.css";
import {
  validateNickname,
  validateEmail,
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
import { signIn, signUp } from "@/lib/cloud";
import { TelegramBotLogin } from "./TelegramBotLogin";
import "./telegram-login.css";
import { SIGNUP_BONUS_AC } from "@/lib/welcome-rules";

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

/* ------------------------- Сцена справа ------------------------------- */

const STARS = [
  { l: "8%", t: "14%", d: "0s" },
  { l: "90%", t: "10%", d: "1.1s" },
  { l: "96%", t: "46%", d: "2.2s" },
  { l: "3%", t: "52%", d: ".6s" },
  { l: "84%", t: "88%", d: "1.7s" },
  { l: "20%", t: "6%", d: "2.6s" },
];

/** Шапка карточки: сцена с котом справа и приветствием слева.
 *  Лежит внутри прокручиваемой области — ничего не перекрывает форму. */
function Banner({ tab, bannerRef }: { tab: AuthTab; bannerRef: React.RefObject<HTMLElement | null> }) {
  return (
    <header ref={bannerRef} className="ad-banner">
      <span className="ad-aurora" aria-hidden />
      {STARS.slice(0, 4).map((st) => (
        <span key={st.l + st.t} className="ad-bstar" style={{ left: st.l, top: st.t, animationDelay: st.d }} aria-hidden />
      ))}
      <div className="ad-scene" aria-hidden>
        <span className="ad-ring r1"><i /></span>
        <span className="ad-ring r2"><i /></span>
        <span className="ad-glow" />
        <Image className="ad-cat" src="/cat.png" alt="" width={768} height={768} sizes="200px" priority />
      </div>
      <div key={tab} className="ad-btext ad-swap">
        <span className="ad-brandline">
          <i />
          AniGalaxy
        </span>
        <h2 id="auth-title" className="ad-title">
          {tab === "login" ? "С возвращением!" : "Создай аккаунт"}
        </h2>
        <p className="ad-sub">
          {tab === "login" ? "Продолжи с того же места." : "Меньше минуты — и списки под рукой."}
        </p>
      </div>
    </header>
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
    <div className="ad-field">
      <label htmlFor={id} className="ad-label">
        {label}
      </label>
      <div className="ad-wrap">
        <span className="ad-ic">{icon}</span>
        <input
          id={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          maxLength={maxLength}
          required
        />
        {toggle && (
          <button
            type="button"
            onClick={toggle.onToggle}
            tabIndex={-1}
            aria-label={toggle.shown ? "Скрыть пароль" : "Показать пароль"}
            className="ad-eye"
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
  const shellRef = useRef<HTMLElement | null>(null);

  /** Лёгкий параллакс: кот и плашки смещаются вслед за курсором */
  const onMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const el = shellRef.current;
    if (!el) return;
    el.style.setProperty("--mx", ((event.clientX / window.innerWidth - 0.5) * 2).toFixed(3));
    el.style.setProperty("--my", ((event.clientY / window.innerHeight - 0.5) * 2).toFixed(3));
  }, []);

  /** Закрытие: сбрасываем ошибку, чтобы она не всплывала при следующем открытии */
  const close = useCallback(() => {
    setError(null);
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
    openAuthDialog(next);
  }, []);

  const busyRef = useRef(false);

  const onLogin = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (busyRef.current) return;
      busyRef.current = true;
      const result = await signIn(login, password).finally(() => {
        busyRef.current = false;
      });
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
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (busyRef.current) return;
      busyRef.current = true;
      const result = await signUp(nickname, email, regPassword, confirm).finally(() => {
        busyRef.current = false;
      });
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

  if (!state.open) return null;

  const loginReady = login.trim().length > 0 && password.length > 0;
  const registerReady =
    validateNickname(nickname) === null &&
    validateEmail(email) === null &&
    regPassword.length >= 6 &&
    confirm.length > 0;

  return (
    <div
      className="ad-root fixed inset-0 z-[120] flex items-end justify-center sm:items-center sm:p-6"
      onMouseDown={onBackdrop}
      onPointerMove={onMove}
    >
      <div className="ad-backdrop" aria-hidden />
      {STARS.map((st) => (
        <span key={st.l + st.t} className="ad-star" style={{ left: st.l, top: st.t, animationDelay: st.d }} aria-hidden />
      ))}

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        tabIndex={-1}
        className="ad-panel relative flex w-full flex-col outline-none"
      >
        {/* Форма */}
        <div className="ad-scroll relative flex min-w-0 flex-1 flex-col overflow-y-auto">
          <Banner tab={tab} bannerRef={shellRef} />

          <div className="ad-body flex flex-1 flex-col px-5 pb-7 sm:px-9">
            {/* Переключатель «Вход / Регистрация» */}
            <div className="ad-tabs" data-tab={tab}>
              {(["login", "register"] as AuthTab[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => switchTab(value)}
                  aria-pressed={tab === value}
                  className="ad-tab"
                >
                  {value === "login" ? "Вход" : "Регистрация"}
                </button>
              ))}
            </div>

            {tab === "login" ? (
              <>
              <form key="l" onSubmit={onLogin} className="ad-form ad-swap mt-6 flex flex-col gap-4">
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
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </button>

                <p className="text-center text-sm text-muted">
                  Нет аккаунта?{" "}
                  <button
                    type="button"
                    onClick={() => switchTab("register")}
                    className="ad-link"
                  >
                    Зарегистрироваться
                  </button>
                </p>
              </form>

              {/* Вход через Telegram: один настоящий виджет, без кастомной
                  кнопки-дублёра поверх него */}
              <div className="mt-5 ad-swap">
                <div className="ad-or">или войти через</div>
                <div className="ad-tg">
                  <TelegramBotLogin onDone={close} onError={setError} />
                </div>
              </div>
              </>
            ) : (
              <form key="r" onSubmit={onRegister} className="ad-form ad-swap mt-6 flex flex-col gap-4">
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

                <PasswordStrength value={regPassword} />

                <p className="text-center text-xs text-[#f5b942]">Бонус за регистрацию: +{SIGNUP_BONUS_AC} монет на счёт</p>

                {error && <ErrorBox message={error} />}

                <button
                  type="submit"
                  disabled={!registerReady}
                  className="btn-auth-submit"
                >
                  Создать аккаунт
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </button>

                <p className="text-center text-sm text-muted">
                  Уже есть аккаунт?{" "}
                  <button
                    type="button"
                    onClick={() => switchTab("login")}
                    className="ad-link"
                  >
                    Войти
                  </button>
                </p>
              </form>
            )}

            <p className="mt-6 text-center text-xs leading-relaxed text-[#566082]">
              Аккаунт и прогресс сохраняются на сервере AniGalaxy и доступны на любом устройстве
              после входа. Входя или регистрируясь, вы принимаете{" "}
              <a href="/terms" target="_blank" rel="noopener" className="underline decoration-white/20 underline-offset-2 hover:text-white">соглашение</a> и{" "}
              <a href="/privacy" target="_blank" rel="noopener" className="underline decoration-white/20 underline-offset-2 hover:text-white">политику конфиденциальности</a>.
            </p>
          </div>
        </div>

        <button
            type="button"
            onClick={close}
            aria-label="Закрыть"
            className="ad-x"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
      </div>
    </div>
  );
}

function PasswordStrength({ value }: { value: string }) {
  if (!value) return null;
  let score = 0;
  if (value.length >= 6) score++;
  if (value.length >= 10) score++;
  if (/[A-ZА-Я]/.test(value) && /[a-zа-я]/.test(value)) score++;
  if (/\d/.test(value) && /[^\w\s]/.test(value)) score++;
  const color = ["#ff5a7d", "#ffa63d", "#3ddc97", "#00c8ff"][Math.max(0, score - 1)];
  const label = ["Слишком короткий", "Простой", "Хороший", "Надёжный", "Отличный"][score];
  return (
    <div style={{ ["--c" as string]: color }}>
      <div className="ad-strength" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <i key={i} className={i < score ? "on" : ""} />
        ))}
      </div>
      <p className="mt-1.5 text-xs font-semibold" style={{ color: score ? color : "#8c97b3" }}>
        {label}
      </p>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="ad-err" role="alert">
      <b>!</b>
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
