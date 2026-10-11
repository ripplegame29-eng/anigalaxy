"use client";

import Link from "next/link";
import { useCallback, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isPremiumActive } from "@/lib/auth";
import { openAuthDialog } from "@/lib/auth-dialog";
import { useAccount } from "@/lib/use-account";
import { useProfile } from "@/lib/profile";
import { useLevelInfo, useProgress } from "@/lib/progression/events";
import { FRAMES } from "@/lib/cosmetics";
import { SETTINGS_TABS, SettingsPanel, type SettingsTab } from "@/components/profile/ProfileDialogs";
import { AvatarView } from "@/components/profile/AvatarView";

const TAB_IDS: string[] = SETTINGS_TABS.map((item) => item.id);

const CHIP =
  "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-black uppercase tracking-wide ring-1";

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
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 3.5 5.5 6.1v5.2c0 4.2 2.8 7.7 6.5 8.9 3.7-1.2 6.5-4.7 6.5-8.9V6.1z"
    />
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

  return (
    <div className="space-y-5">
      {/* ---------------------------- Шапка-саммари --------------------------- */}
      <section className="relative overflow-hidden rounded-3xl border border-line bg-card/60">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-accent/16 via-accent-2/6 to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-accent/14 blur-3xl"
          aria-hidden
        />

        <div className="relative p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              {account ? (
                <AvatarView
                  nickname={account.nickname}
                  avatar={profile.avatar || undefined}
                  frameCss={frame?.css}
                  frameImg={frame?.img}
                  className="h-16 w-16 ring-4 ring-card/80"
                  textClass="text-xl"
                />
              ) : (
                <span className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-white shadow-[0_16px_34px_-16px_rgba(31,123,255,1)]">
                  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="8" r="3.6" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 20a7.5 7.5 0 0 1 15 0" />
                  </svg>
                </span>
              )}

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <h1 className="truncate text-2xl font-black tracking-tight text-white">Настройки</h1>
                  {premium && <span className={`${CHIP} border-gold/40 bg-gold/15 text-gold`}>Premium</span>}
                </div>
                <p className="mt-0.5 truncate text-sm text-muted">
                  {account ? `${account.nickname} · ${account.email}` : "Всё локально: данные не покидают этот браузер"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className={`${CHIP} bg-accent-2/12 text-accent-2 ring-accent-2/35`}>
                {info.into} / {info.need} XP
              </span>
              <span className={`${CHIP} bg-white/8 text-muted ring-white/15`}>{info.era}</span>
              <span className={`${CHIP} bg-white/8 text-muted ring-white/15`}>
                Серия {progress.progress.streakCurrent} дн.
              </span>
              <span className={`${CHIP} bg-gold/12 text-gold ring-gold/35`}>
                {progress.progress.acBalance} AC
              </span>
            </div>
          </div>

          {/* Шкала уровня */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] font-bold text-muted">
              <span>Уровень {info.level}</span>
              <span className="font-mono">{pct}%</span>
            </div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/8 ring-1 ring-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2 shadow-[0_0_16px_rgba(0,200,255,0.45)] transition-[width] duration-700 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Быстрые переходы */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {account ? (
              <>
                <Link href="/profile" className={`${CHIP} bg-white/8 text-muted ring-white/15 transition hover:text-white`}>
                  Мой профиль
                </Link>
                <Link
                  href="/profile?tab=quests"
                  className={`${CHIP} bg-mint/12 text-mint ring-mint/35 transition hover:bg-mint/20`}
                >
                  Квесты дня
                </Link>
                <Link href="/store" className={`${CHIP} bg-white/8 text-muted ring-white/15 transition hover:text-white`}>
                  Магазин
                </Link>
                <Link
                  href="/premium"
                  className={`${CHIP} border-gold/40 bg-gold/10 text-gold transition hover:bg-gold/18`}
                >
                  Premium
                </Link>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => openAuthDialog("login")}
                  className="btn-primary rounded-xl px-4 py-2 text-xs font-bold text-white"
                >
                  Войти
                </button>
                <button
                  type="button"
                  onClick={() => openAuthDialog("register")}
                  className="btn-ghost rounded-xl px-4 py-2 text-xs font-semibold text-muted hover:text-white"
                >
                  Создать аккаунт
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ------------------------- Разделы + панель -------------------------- */}
      <section className="rounded-3xl border border-line bg-card/70 p-4 sm:p-5">
        <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
          {/* min-w-0: лента разделов не должна растягивать колонку грида,
              иначе на телефоне страница скроллится вбок (см. ProfileView) */}
          <nav
            aria-label="Разделы настроек"
            className="flex min-w-0 gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0"
          >
            {SETTINGS_TABS.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  aria-pressed={active}
                  className={`min-w-[230px] shrink-0 rounded-xl px-4 py-3 text-left transition-colors duration-200 lg:min-w-0 ${
                    active
                      ? "bg-white/[0.07] text-white ring-1 ring-white/10"
                      : "text-muted hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm font-bold">
                    <svg
                      viewBox="0 0 24 24"
                      className={`h-4 w-4 shrink-0 ${active ? "text-accent-2" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      {TAB_ICONS[item.id]}
                    </svg>
                    {item.label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                    {item.description}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="min-w-0">
            <SettingsPanel tab={tab} onTabChange={onTabChange} hideTabs />
          </div>
        </div>
      </section>
    </div>
  );
}
