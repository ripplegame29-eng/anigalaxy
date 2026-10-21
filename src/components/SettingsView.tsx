"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isPremiumActive } from "@/lib/auth";
import { openAuthDialog } from "@/lib/auth-dialog";
import { useAccount } from "@/lib/use-account";
import { useProfile } from "@/lib/profile";
import { useLevelInfo, useProgress } from "@/lib/progression/events";
import { FRAMES } from "@/lib/cosmetics";
import { SETTINGS_TABS, SettingsPanel, type SettingsTab } from "@/components/profile/ProfileDialogs";
import { AvatarFrame } from "@/components/profile/AvatarFrame";
import { DEFAULT_PREFS, resetPrefs, updatePrefs, usePrefs, type Prefs } from "@/lib/prefs";

/** По каким словам раздел находится в поиске по настройкам */
const TAB_KEYWORDS: Record<SettingsTab, string> = {
  profile: "профиль почта email пароль привязки telegram описание био ник аккаунт",
  privacy: "приватность профиль статистика история достижения скрыть видимость",
  looks: "внешний вид тема акцент цвет звёзды фон баннер аватар рамка оформление",
  notifications: "уведомления push серии ответы награды подарки колокольчик",
  subscription: "подписка premium привилегии оплата продлить",
  player: "плеер качество скорость субтитры клавиши автоплей опенинг озвучка",
  data: "данные сессии экспорт импорт бэкап удалить аккаунт",
};

/** Готовые «сцены»: один клик меняет сразу несколько настроек */
const PRESETS: { id: string; name: string; hint: string; patch: Partial<Prefs> }[] = [
  { id: "cosmos", name: "Космос", hint: "Синий акцент, густое звёздное небо", patch: { theme: "dark", accent: "sirius", stars: 220 } },
  { id: "cinema", name: "Кинотеатр", hint: "Без отвлекающих звёзд, подсветка плеера", patch: { stars: 0, ambient: true, autoplayNext: true } },
  { id: "sakura", name: "Сакура", hint: "Розовый акцент и мягкое небо", patch: { accent: "sakura", stars: 120 } },
  { id: "minimal", name: "Минимализм", hint: "Тихий фон, ничего лишнего", patch: { stars: 0, ambient: false } },
];

function presetActive(prefs: Prefs, patch: Partial<Prefs>): boolean {
  return (Object.keys(patch) as (keyof Prefs)[]).every((key) => prefs[key] === patch[key]);
}

const SEARCH_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </svg>
);


const TAB_IDS: string[] = SETTINGS_TABS.map((item) => item.id);

/** Подпись плитки «Приватность»: все четыре тумблера согласованы или нет */
const PRIVACY_LABEL: Record<"open" | "private" | "custom", string> = {
  open: "Открытый",
  private: "Приватный",
  custom: "Пользовательский",
};

/**
 * Сколько дней осталось до конца Premium.
 *
 * Считаем через `Math.ceil` от текущего момента: подписка, истекающая
 * сегодня в 23:50, ещё сегодня действует, поэтому для неё выходит 1, а не 0.
 *
 * Функция на уровне модуля, а не внутри компонента: правило react-hooks/purity
 * запрещает читать Date.now() прямо в теле рендера (у нас уже так сделано
 * для таймеров квестов — см. resetIn() в ProfileSections).
 */
function premiumDaysLeft(until: number | undefined): number {
  if (!until) return 0;
  return Math.max(0, Math.ceil((until - Date.now()) / 86400000));
}

/** Иконки разделов настроек (штрих 24×24) — навигация как на эталоне */
const TAB_ICONS: Record<SettingsTab, ReactNode> = {
  profile: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path strokeLinecap="round" d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  looks: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="2.5" />
      <circle cx="9" cy="10" r="1.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m5.5 17.5 4-4 3 3 2.5-2.5 3.5 3.5" />
    </>
  ),
  privacy: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
  ),
  notifications: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4" />
  ),
  player: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 4l13 8-13 8z" />
  ),
  subscription: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 8.5 8 11.5 12 5l4 6.5 3.5-3-1.5 9.5h-12z" />
  ),
  data: (
    <>
      <ellipse cx="12" cy="6.5" rx="7" ry="3" />
      <path strokeLinecap="round" d="M5 6.5v11c0 1.7 3.1 3 7 3s7-1.3 7-3v-11" />
      <path strokeLinecap="round" d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />
    </>
  ),
};

/**
 * `/settings?tab=` — страница настроек: шапка-саммари (аватар, уровень,
 * XP-шкала, AC, Premium) и общая с модалкой `SettingsPanel`.
 * Вкладка синхронизируется с URL, как на эталоне `?tab=profile`.
 */
export function SettingsView() {
  const router = useRouter();
  const params = useSearchParams();
  const account = useAccount();
  const profile = useProfile();
  const info = useLevelInfo();
  const progress = useProgress();
  const premium = isPremiumActive(account);

  const raw = params.get("tab");
  const tab: SettingsTab = raw && TAB_IDS.includes(raw) ? (raw as SettingsTab) : "profile";

  const onTabChange = useCallback(
    (next: SettingsTab) => {
      router.replace(`/settings?tab=${next}`, { scroll: false });
    },
    [router],
  );

  const frame = FRAMES.find((item) => item.id === profile.frameId);
  const pct = Math.max(0, Math.min(100, Math.round((info.into / Math.max(1, info.need)) * 100)));

  /**
   * Сколько дней осталось до конца Premium.
   *
   * Считаем от полуночи сегодня: подписка, истекающая сегодня в 23:50, ещё
   * сегодня действует, поэтому `Math.ceil` даёт для неё 1, а не 0.
   */
  const daysLeft = premiumDaysLeft(account?.premiumUntil);

  /** Итог четырёх переключателей приватности — для плитки в шапке */
  const privacyPreset: "open" | "private" | "custom" =
    profile.privacy.profilePublic &&
    profile.privacy.showStats &&
    profile.privacy.showAchievements &&
    profile.privacy.showHistory
      ? "open"
      : !profile.privacy.profilePublic &&
          !profile.privacy.showStats &&
          !profile.privacy.showAchievements &&
          !profile.privacy.showHistory
        ? "private"
        : "custom";

  const prefs = usePrefs();
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // «/» — быстрый переход к поиску по настройкам, как в больших сервисах
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const needle = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      SETTINGS_TABS.filter(
        (item) =>
          !needle ||
          `${item.label} ${item.description} ${TAB_KEYWORDS[item.id]}`.toLowerCase().includes(needle),
      ),
    [needle],
  );

  const jump = (next: SettingsTab) => {
    onTabChange(next);
    setQuery("");
  };

  /** Заполненность профиля: три простых шага, каждый ведёт в нужный раздел */
  const steps: { label: string; done: boolean; tab: SettingsTab }[] = [
    { label: "Аватар", done: Boolean(profile.avatar), tab: "looks" },
    { label: "Описание", done: Boolean(profile.bio?.trim()), tab: "profile" },
    { label: "Рамка", done: Boolean(frame), tab: "looks" },
  ];
  const doneCount = steps.filter((step) => step.done).length;
  const complete = Math.round((doneCount / steps.length) * 100);
  const R = 42;
  const CIRC = 2 * Math.PI * R;

  return (
    <div className="ag-root st-page space-y-5">
      {/* ------------------------------ Герой ------------------------------- */}
      <section className="st-hero">
        <div className="st-hero-glow" aria-hidden />
        <div className="st-hero-grid" aria-hidden />

        <div className="st-hero-main">
          <div className="st-who">
            {account ? (
              <AvatarFrame nickname={account.nickname} avatar={profile.avatar || undefined} frame={frame} size="md" />
            ) : (
              <span className="st-guest" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="8" r="3.6" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 20a7.5 7.5 0 0 1 15 0" />
                </svg>
              </span>
            )}
            <div className="min-w-0">
              <p className="st-eyebrow">Центр управления</p>
              <h1 className="st-title">
                Настройки
                {premium && <span className="st-badge">Premium</span>}
              </h1>
              <p className="st-sub">
                {account ? `${account.nickname} · ${info.era}` : "Войдите, чтобы настроить профиль"}
              </p>
            </div>
          </div>

          <div className="st-ring" role="img" aria-label={`Уровень ${info.level}, ${pct}% до следующего`}>
            <svg viewBox="0 0 100 100" aria-hidden>
              <defs>
                <linearGradient id="st-ring-g" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="var(--color-accent, #2b7fff)" />
                  <stop offset="1" stopColor="var(--color-accent-2, #22d3ee)" />
                </linearGradient>
              </defs>
              <circle cx="50" cy="50" r={R} className="st-ring-bg" />
              <circle
                cx="50"
                cy="50"
                r={R}
                className="st-ring-fg"
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC * (1 - pct / 100)}
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div>
              <small>Уровень</small>
              <b>{info.level}</b>
              <span>{info.into} / {info.need} XP</span>
            </div>
          </div>
        </div>

        <div className="st-stats">
          <div className="st-stat">
            <small>AC</small>
            <b>{progress.progress.acBalance} AC</b>
          </div>
          <div className="st-stat">
            <small>Серия</small>
            <b>{progress.progress.streakCurrent} дн.</b>
          </div>
          <div className="st-stat">
            <small>Premium</small>
            <b>{premium && account?.premiumUntil ? `ещё ${daysLeft} дн.` : "не подключён"}</b>
          </div>
          <div className="st-stat">
            <small>Рамка</small>
            <b>{frame ? frame.name : "нет"}</b>
          </div>
          <div className="st-stat">
            <small>Приватность</small>
            <b>{PRIVACY_LABEL[privacyPreset]}</b>
          </div>
        </div>

        {account ? (
          <div className="st-links">
            <Link href="/profile">Мой профиль</Link>
            <Link href="/quests">Квесты дня</Link>
            <Link href="/store">Магазин</Link>
            <Link href="/premium" className="is-gold">Premium</Link>
          </div>
        ) : (
          <div className="st-links">
            <button type="button" className="is-primary" onClick={() => openAuthDialog("login")}>Войти</button>
            <button type="button" onClick={() => openAuthDialog("register")}>Создать аккаунт</button>
          </div>
        )}
      </section>

      {/* ------------------------- Сцены оформления ------------------------- */}
      <section className="st-scenes" aria-label="Быстрые сцены">
        <header>
          <div>
            <h2>Сцены</h2>
            <p>Один клик меняет акцент, небо и плеер сразу. Всё можно подправить ниже.</p>
          </div>
          <button
            type="button"
            className="st-reset"
            onClick={() => resetPrefs()}
            disabled={presetActive(prefs, DEFAULT_PREFS)}
            title="Вернуть настройки внешнего вида и плеера к исходным"
          >
            Сбросить
          </button>
        </header>
        <div className="st-scene-row">
          {PRESETS.map((preset) => {
            const active = presetActive(prefs, preset.patch);
            return (
              <button
                key={preset.id}
                type="button"
                className={`st-scene${active ? " on" : ""}`}
                data-scene={preset.id}
                aria-pressed={active}
                onClick={() => updatePrefs(preset.patch)}
              >
                <i aria-hidden />
                <b>{preset.name}</b>
                <small>{preset.hint}</small>
              </button>
            );
          })}
        </div>
      </section>

      {/* ------------------------- Разделы + панель -------------------------- */}
      <section className="st-shell">
        <aside className="st-side">
          <label className="st-search">
            {SEARCH_ICON}
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && matches[0]) jump(matches[0].id);
                if (event.key === "Escape") {
                  setQuery("");
                  event.currentTarget.blur();
                }
              }}
              placeholder="Найти настройку"
              aria-label="Поиск по настройкам"
            />
            <kbd>/</kbd>
          </label>

          {/* min-w-0: лента разделов не должна растягивать колонку грида,
              иначе на телефоне страница скроллится вбок (см. ProfileView) */}
          <nav aria-label="Разделы настроек" className="ag-set-nav st-nav">
            {matches.length === 0 && <p className="st-none">Ничего не нашли. Попробуйте «тема», «пароль» или «субтитры».</p>}
            {matches.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => jump(item.id)}
                  aria-pressed={active}
                  aria-current={active ? "true" : undefined}
                >
                  <svg viewBox="0 0 24 24" className="ag-set-ic" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {TAB_ICONS[item.id]}
                  </svg>
                  <span>
                    <b>{item.label}</b>
                    <small>{item.description}</small>
                  </span>
                </button>
              );
            })}
          </nav>

          {account && (
            <div className="st-complete">
              <div className="st-complete-h">
                <b>Профиль заполнен</b>
                <span>{complete}%</span>
              </div>
              <div className="st-bar"><i style={{ width: `${complete}%` }} /></div>
              <div className="st-steps">
                {steps.map((step) => (
                  <button
                    key={step.label}
                    type="button"
                    className={step.done ? "done" : undefined}
                    onClick={() => onTabChange(step.tab)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      {step.done ? <path d="m5 12.5 4.5 4.5L19 7.5" /> : <circle cx="12" cy="12" r="6" />}
                    </svg>
                    {step.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        <div className="st-pane" key={tab}>
          <SettingsPanel tab={tab} onTabChange={onTabChange} hideTabs />
        </div>
      </section>
    </div>
  );
}
