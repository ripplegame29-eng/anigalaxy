"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { APP_FAQ, APP_FEATURES, APP_PLATFORMS, INSTALL_GUIDES, type AppPlatform, type AppPlatformId } from "@/lib/apps";
import "./apps.css";

/* ------------------- Установка из браузера (PWA) ------------------------ */

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    emit();
  });
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const canInstall = () => deferred !== null;
const isInstalled = () => installed || (typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches);

function detectOs(): AppPlatformId | "other" {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/windows/i.test(ua)) return "windows";
  if (/mac os/i.test(ua)) return "macos";
  if (/linux|x11/i.test(ua)) return "linux";
  return "other";
}

function useInstall() {
  const can = useSyncExternalStore(subscribe, canInstall, () => false);
  const done = useSyncExternalStore(subscribe, isInstalled, () => false);
  const os = useSyncExternalStore(() => () => undefined, detectOs, () => "other" as const);
  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    emit();
  };
  return { can, done, os, install };
}

/* ------------------------------ Иконки ---------------------------------- */

function DeviceIcon({ kind }: { kind: AppPlatform["device"] | "tablet" }) {
  return kind === "phone" ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="7" y="2.5" width="10" height="19" rx="2.6" /><path d="M10.5 18.5h3" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2.5" y="4" width="19" height="12.5" rx="2.2" /><path d="M8 20.5h8M12 16.5v4" />
    </svg>
  );
}

/** Экран телефона: настоящий сайт в мобильной вёрстке (390 px), уменьшенный под рамку */
function PhoneScreen() {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.45);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / 390));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={box} className="ap-ph-screen">
      <iframe
        src="/?embed=1"
        title="AniGalaxy на телефоне"
        loading="lazy"
        tabIndex={-1}
        style={{ transform: `scale(${scale})` }}
      />
    </div>
  );
}

/* ------------------------- Макет устройств ------------------------------- */

function DeviceStage() {
  return (
    <div className="ap-stage" aria-hidden>
      <svg className="ap-orbit" viewBox="0 0 600 600" fill="none">
        <circle cx="300" cy="300" r="270" stroke="url(#apo)" strokeWidth="1.2" strokeDasharray="2 9" />
        <circle cx="300" cy="300" r="210" stroke="url(#apo)" strokeWidth="1" opacity=".6" />
        <circle cx="300" cy="300" r="150" stroke="url(#apo)" strokeWidth="1" opacity=".35" />
        <circle cx="552" cy="212" r="5" fill="#00c8ff" /><circle cx="70" cy="388" r="4" fill="#7a8cff" />
        <defs>
          <linearGradient id="apo" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#00c8ff" /><stop offset="1" stopColor="#7a4dff" /></linearGradient>
        </defs>
      </svg>

      <div className="ap-win">
        <div className="ap-win-bar"><i /><i /><i /><span>AniGalaxy</span></div>
        <div className="ap-win-body">
          <div className="ap-scene">
            <video autoPlay muted loop playsInline preload="metadata" poster="/bgs/bg13.webp">
              <source src="/bgs/bg13.webm" type="video/webm" />
            </video>
          </div>
          <div className="ap-play"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg></div>
          <div className="ap-ctl">
            <div className="ap-seek"><i /></div>
            <div className="ap-btns"><b /><b /><b /><em>Сезоны и серии</em></div>
          </div>
        </div>
      </div>

      <div className="ap-phone">
        <div className="ap-notch" />
        <PhoneScreen />
      </div>
    </div>
  );
}

/* ------------------------------- Страница -------------------------------- */

export function AppsView() {
  const { can, done, os, install } = useInstall();
  const [hint, setHint] = useState("");

  useEffect(() => {
    if (!hint) return;
    const t = window.setTimeout(() => setHint(""), 6000);
    return () => window.clearTimeout(t);
  }, [hint]);

  const mobile = os === "android" || os === "ios";
  const primaryLabel = done ? "Приложение уже установлено" : mobile ? "Установить на телефон" : "Установить на компьютер";

  const onPrimary = () => {
    if (done) return;
    if (can) return void install();
    setHint(
      os === "ios"
        ? "В Safari нажмите «Поделиться» → «На экран «Домой»»."
        : "Откройте меню браузера и выберите «Установить AniGalaxy» (в Chrome и Edge значок установки стоит справа в адресной строке).",
    );
  };

  return (
    <div className="ap">
      <div className="ap-sky" aria-hidden />

      <section className="ap-hero">
        <div className="ap-hero-copy">
          <p className="ap-kicker">Приложения AniGalaxy</p>
          <h1>Галактика аниме — <br />на твоём экране</h1>
          <p className="ap-lead">Свой значок, окно без вкладок и тот же аккаунт: уровень, монеты и список серий всегда с тобой.</p>
          <div className="ap-cta">
            <button type="button" className="ap-btn ap-btn-main" onClick={onPrimary} disabled={done}>
              <DeviceIcon kind={mobile ? "phone" : "desktop"} />
              {primaryLabel}
            </button>
            <a className="ap-btn ap-btn-ghost" href="#platforms">Все платформы</a>
          </div>
          {hint && <p className="ap-hint" role="status">{hint}</p>}
          <ul className="ap-facts">
            <li>Бесплатно</li><li>Тот же аккаунт</li><li>Без лишних разрешений</li>
          </ul>
        </div>
        <DeviceStage />
      </section>

      <section id="platforms" className="ap-sec">
        <header className="ap-head">
          <h2>Выбери платформу</h2>
          <p>Нативные сборки готовятся. Пока всё ставится из браузера — это занимает полминуты.</p>
        </header>
        <ul className="ap-grid">
          {APP_PLATFORMS.map((p) => {
            const ready = Boolean(p.url);
            const mine = p.id === os;
            return (
              <li key={p.id} className={`ap-card${mine ? " mine" : ""}${ready ? " ready" : ""}`}>
                <div className="ap-card-ico"><DeviceIcon kind={p.device} /></div>
                <h3>{p.name}</h3>
                <p>{p.hint}</p>
                <span className={`ap-state${ready ? " ok" : ""}`}>{ready ? `Доступно · ${p.file}` : "Скоро"}</span>
                {ready ? (
                  <a className="ap-btn ap-btn-main ap-sm" href={p.url} rel="noopener">Скачать</a>
                ) : (
                  <button type="button" className="ap-btn ap-btn-ghost ap-sm" onClick={() => document.getElementById("install")?.scrollIntoView({ behavior: "smooth" })}>
                    Установить из браузера
                  </button>
                )}
                {mine && <em className="ap-badge">Ваше устройство</em>}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="ap-sec ap-feats">
        <header className="ap-head"><h2>Зачем приложение</h2></header>
        <ul>
          {APP_FEATURES.map((f) => (
            <li key={f.title}><h3>{f.title}</h3><p>{f.text}</p></li>
          ))}
        </ul>
      </section>

      <section id="install" className="ap-sec">
        <header className="ap-head">
          <h2>Как установить из браузера</h2>
          <p>Работает уже сейчас, без магазинов приложений.</p>
        </header>
        <div className="ap-guides">
          {INSTALL_GUIDES.map((g) => (
            <article key={g.id} className={`ap-guide${(g.id === "desktop" && !mobile) || g.id === os ? " mine" : ""}`}>
              <h3>{g.title}</h3>
              <small>{g.browsers}</small>
              <ol>{g.steps.map((s) => <li key={s}>{s}</li>)}</ol>
            </article>
          ))}
        </div>
      </section>

      <section className="ap-sec ap-faq">
        <header className="ap-head"><h2>Вопросы</h2></header>
        {APP_FAQ.map((item) => (
          <details key={item.q}><summary>{item.q}</summary><p>{item.a}</p></details>
        ))}
        <p className="ap-foot">Не получилось установить? Напишите в <Link href="https://t.me/anigalaxy" rel="noopener">Telegram</Link> — поможем.</p>
      </section>
    </div>
  );
}
