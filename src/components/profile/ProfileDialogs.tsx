"use client";

import Link from "next/link";
import { useCallback, useMemo, useSyncExternalStore, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  getProfileDialogState,
  closeProfileDialog,
  subscribeProfileDialog,
  getServerProfileDialogState,
  openProfileDialog,
} from "@/lib/profile-dialog";
import {
  useProfile,
  updateProfile,
  profileStore,
  groupSignature,
  customBannerStyle,
} from "@/lib/profile";
import {
  BACKGROUNDS,
  FRAMES,
  PROFILE_DECORS,
  TITLES,
  RARITY_LABEL,
  RARITY_CLASS,
  isUnlocked,
  titleTag,
  type Rarity,
  type TitleItem,
  type UnlockContext,
} from "@/lib/cosmetics";
import { MediaPicker, MediaView } from "./MediaBits";
import { deleteMedia } from "@/lib/media-store";
import { useArtwork } from "@/lib/artwork";
import { THEME_PRESETS, BG_PRESETS, activePresetId, applyBgPreset, applyThemePreset } from "@/lib/theme-presets";
import { patchTheme, resetTheme, useProfileTheme, type ProfileTheme } from "@/lib/ptheme";
import { BATTLEPASS } from "@/lib/battlepass/config";
import { IMAGE_LIMITS, readImageFile } from "@/lib/images";
import { useMyReferrals } from "@/lib/referrals";
import {
  exportBackup,
  hasPreimport,
  importBackup,
  parseBackup,
  rollbackImport,
  storageEntries,
  BACKUP_KEY_PREFIX,
} from "@/lib/backup";
import { isPremiumActive, changePassword } from "@/lib/auth";
import { syncPasswordChange } from "@/lib/cloud";
import {
  ACCENTS,
  NOTIFY_EVENTS,
  QUALITIES,
  SPEEDS,
  updatePrefs,
  usePrefs,
  type Prefs,
} from "@/lib/prefs";
import {
  eraseAccountData,
  useSessions,
  LINK_LABEL,
  addDevice,
  addFriend,
  linkAccount,
  removeDevice,
  removeFriend,
  unlinkAccount,
  useDevices,
  useFriends,
  useLinks,
  type LinkProvider,
} from "@/lib/accounts";
import { type ProfileScope } from "@/lib/profile";
import { progressEmit, useLevelInfo, useProgress } from "@/lib/progression/events";
import { useTagSelection, useTitleSelection } from "@/lib/selection";
import { amountLabel, sourceLabel, typeLabel } from "@/lib/progression/labels";
import { PROGRESSION_CONFIG } from "@/lib/progression/progression.config";
import { CFG_RARITY_CLASS, CFG_RARITY_LABEL } from "@/lib/progression/rarity-chips";
import { AgTag } from "@/components/progression/AgTag";
import { useAccount } from "@/lib/use-account";
import { clearWatchHistory, timeAgo } from "@/lib/history";
import { useModalBehaviour } from "@/lib/use-local-storage";
import { cpuCores, ecoActive, ecoStore, setEco, weakCpu, type EcoMode } from "@/lib/eco";
import { setSfxEnabled, useSfxEnabled } from "@/lib/sfx";
import { AvatarFrame } from "./AvatarFrame";
import { LevelCard } from "./ProfileSections";
import { WidgetShowcase } from "@/components/WidgetShowcase";
import {
  EFFECT_LEVEL_LABEL,
  EFFECT_LEVELS,
  PARTICLE_EFFECTS,
  STYLE_EFFECTS,
} from "@/lib/profile-effects";
import { TelegramLink } from "@/components/TelegramLink";

/* --------------------------- Каркас модалки ----------------------------- */

function DialogShell({
  title,
  subtitle,
  onClose,
  wide = false,
  full = false,
  className = "",
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  wide?: boolean;
  /**
   * Ширина колонки содержимого на настоящей странице профиля: контейнер
   * 1152 px минус боковое меню 290 и зазор 22 — около 840 px. Предпросмотр
   * берёт 896 (max-w-4xl), ближайший шаг: на 1152 блоки растягивались и
   * выглядели заметно крупнее, чем их копии на странице.
   */
  full?: boolean;
  /** Доп. класс панели — для темизации отдельных окон */
  className?: string;
  children: React.ReactNode;
}) {
  const panelRef = useModalBehaviour(true, onClose);

  return (
    <div
      className="fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto p-4 py-8 sm:items-center"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="fixed inset-0 bg-ink/85 backdrop-blur-sm" aria-hidden />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`relative w-full ${
          full ? "max-w-4xl" : wide ? "max-w-3xl" : "max-w-md"
        } ${
          // Предпросмотр длинный: держим его прямоугольником во весь экран,
          // прокручивается только содержимое. Иначе панель растёт выше
          // вьюпорта, шапка с крестиком уезжает за край и закрыть её нечем.
          full ? "flex max-h-[90vh] flex-col" : ""
        } ${className} overflow-hidden rounded-2xl border border-line bg-surface/95 p-5 shadow-[0_40px_100px_-30px_rgba(0,0,0,1)] ring-1 ring-white/10 outline-none animate-fade-in`}
      >
        <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-extrabold tracking-tight text-white">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            title="Закрыть"
            className="-m-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted ring-1 ring-transparent transition hover:bg-white/10 hover:text-white hover:ring-white/10"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        {full ? (
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">{children}</div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

/** Скрытый input для выбора файла */
function FilePicker({
  accept = "image/*",
  label,
  onFile,
  className,
}: {
  accept?: string;
  label: string;
  onFile: (file: File) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={className ?? "btn-ghost inline-flex items-center gap-2 rounded-xl bg-white/8 px-3.5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/12 hover:bg-white/14"}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" />
        </svg>
        {label}
      </button>
    </>
  );
}

function useUnlockContext(): UnlockContext {
  const profile = useProfile();
  const account = useAccount();
  const referrals = useMyReferrals();
  return {
    level: useLevelInfo().level,
    premium: isPremiumActive(account),
    claimed: profile.claimed,
    purchased: profile.purchased,
    referrals: referrals.filter((item) => item.qualified).length,
  };
}

function useProfileDialog() {
  return useSyncExternalStore(subscribeProfileDialog, getProfileDialogState, getServerProfileDialogState);
}

/** Сообщение об ошибке загрузки файла */
function Note({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "error" | "ok" }) {
  const toneClass =
    tone === "error" ? "text-rose-300" : tone === "ok" ? "text-mint" : "text-muted";
  return <p className={`mt-3 text-xs leading-relaxed ${toneClass}`}>{children}</p>;
}

/** Новый аватар — в начало истории без дублей, не больше шести */
function pushAvatarHistory(list: string[], data: string): string[] {
  return [data, ...list.filter((item) => item !== data)].slice(0, 6);
}

/* ------------------------------- Эффекты -------------------------------- */

/** Цвет редкости для карточек эффектов */
const FXM_RARITY: Record<string, string> = { COMMON: "#9aa4b2", RARE: "#38bdf8", EPIC: "#a78bfa", LEGENDARY: "#fbbf24" };

type FxTab = "decor" | "particle" | "style" | "tag" | "frame";

/** Окно «Эффекты»: сцена с предпросмотром слева, вкладки с карточками справа */
function EffectsDialog() {
  const profile = useProfile();
  const doc = useProgress();
  const account = useAccount();
  const panelRef = useModalBehaviour(true, closeProfileDialog);
  const [tab, setTab] = useState<FxTab>("decor");
  const ctx = useUnlockContext();
  const tagSel = useTagSelection();
  const owned = new Set([...doc.purchases.map((item) => item.itemId), ...profile.purchased]);
  /* Теги и рамки — только доступные игроку: закрытые здесь не показываем */
  const ownedTags = PROGRESSION_CONFIG.tags.filter((tag) => Boolean(doc.tags[tag.id]));
  const ownedFrames = FRAMES.filter((item) => isUnlocked(item.unlock, ctx));
  const tagCount = (tagSel.primary ? 1 : 0) + tagSel.extras.length;
  const claimed = new Set(doc.battlepass.claimed);
  const frame = FRAMES.find((item) => item.id === profile.frameId);
  const nickname = account?.nickname ?? "Гость";

  const decors = PROFILE_DECORS.map((item) => {
    const bp = BATTLEPASS.levels.find(
      (lv) => lv.free?.some((r) => r.kind === "decor" && r.itemId === item.id) || lv.premium?.some((r) => r.kind === "decor" && r.itemId === item.id),
    );
    const premium = Boolean(bp?.premium?.some((r) => r.kind === "decor" && r.itemId === item.id));
    const has = owned.has(item.id) || (bp ? claimed.has(`${BATTLEPASS.seasonId}:${premium ? "premium" : "free"}:${bp.level}`) : false);
    return { item, bp, has, on: profile.decorFx === item.id };
  });

  const toggleDecor = (id: string, on: boolean) =>
    updateProfile({
      decorFx: on ? "" : id,
      ...(profile.purchased.includes(id) ? {} : { purchased: [...profile.purchased, id] }),
    });
  const toggleStyle = (id: string) => {
    const on = profile.styleFx.includes(id);
    updateProfile({ styleFx: on ? profile.styleFx.filter((x) => x !== id) : [...profile.styleFx, id].slice(0, 4) });
  };

  const activeParticle = PARTICLE_EFFECTS.find((item) => item.id === profile.particleFx);
  const activeStyles = STYLE_EFFECTS.filter((item) => profile.styleFx.includes(item.id));
  const activeDecor = decors.find((d) => d.on);
  const accent = FXM_RARITY[activeParticle?.rarity ?? "RARE"];

  const tabs: { id: FxTab; label: string; count: string }[] = [
    { id: "decor", label: "Оформление", count: activeDecor ? "1" : "0" },
    { id: "particle", label: "Частицы", count: activeParticle ? "1" : "0" },
    { id: "style", label: "Стили", count: `${activeStyles.length}/4` },
    { id: "tag", label: "Теги", count: String(tagCount) },
    { id: "frame", label: "Рамки", count: String(ownedFrames.length) },
  ];

  const Card = ({ id, name, desc, rarity, has, on, meta, onClick }: { id: string; name: string; desc: string; rarity: string; has: boolean; on: boolean; meta: string; onClick: () => void }) => (
    <button
      key={id}
      type="button"
      disabled={!has}
      onClick={onClick}
      aria-pressed={on}
      className={`fxm-card ${on ? "is-on" : ""} ${has ? "" : "is-lock"}`}
      style={{ ["--c" as string]: FXM_RARITY[rarity] ?? "#9aa4b2" }}
    >
      <span className="fxm-card-top">
        <i className="fxm-dot" />
        <span className="fxm-state">
          {on ? "Надето" : has ? "Доступно" : "🔒"}
        </span>
      </span>
      <b>{name}</b>
      <small>{desc}</small>
      <em>{on ? "Нажмите, чтобы снять" : meta}</em>
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto p-4 py-8 sm:items-center"
      onMouseDown={(event) => event.target === event.currentTarget && closeProfileDialog()}
    >
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md" aria-hidden />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Эффекты" tabIndex={-1} className="fxm" style={{ ["--ac" as string]: accent }}>
        <i className="fxm-glow" aria-hidden />
        <header className="fxm-head">
          <div>
            <h2>Эффекты</h2>
            <p>Соберите атмосферу своего профиля</p>
          </div>
          <button type="button" onClick={closeProfileDialog} aria-label="Закрыть" className="fxm-x">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4"><path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </header>

        <div className="fxm-body">
          <aside className="fxm-stage">
            <div className="fxm-scene" data-p={activeParticle?.mode ?? "none"}>
              <span className="fxm-pts" aria-hidden>
                {Array.from({ length: 14 }, (_, k) => (
                  <i key={k} style={{ ["--i" as string]: k }} />
                ))}
              </span>
              <AvatarFrame nickname={nickname} avatar={profile.avatar || undefined} frame={frame} size="md" />
              <p className="fxm-nick">{nickname}</p>
            </div>
            <ul className="fxm-sum">
              <li><span>Оформление</span><b>{activeDecor?.item.name ?? "—"}</b></li>
              <li><span>Частица</span><b>{activeParticle?.name ?? "—"}</b></li>
              <li><span>Стили</span><b>{activeStyles.length ? activeStyles.map((x) => x.name).join(", ") : "—"}</b></li>
              <li><span>Теги</span><b>{tagCount ? `Выбрано: ${tagCount}` : "—"}</b></li>
              <li><span>Рамка</span><b>{frame && frame.id !== "f-none" ? frame.name : "—"}</b></li>
            </ul>
            <div className="fxm-lvl">
              <p>Сила эффектов</p>
              <div role="group" aria-label="Уровень эффекта">
                {EFFECT_LEVELS.map((value) => (
                  <button key={value} type="button" aria-pressed={profile.fxLevel === value} className={profile.fxLevel >= value ? "on" : ""} onClick={() => updateProfile({ fxLevel: value })}>
                    {EFFECT_LEVEL_LABEL[value]}
                  </button>
                ))}
              </div>
              <small>Уровень умножает частицы и амплитуду стилей</small>
            </div>
          </aside>

          <section className="fxm-main">
            <nav className="fxm-tabs" role="tablist">
              {tabs.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
                  {t.label}
                  <em>{t.count}</em>
                </button>
              ))}
            </nav>

            <div className="fxm-grid" hidden={tab === "tag" || tab === "frame"}>
              {tab === "decor" &&
                decors.map(({ item, bp, has, on }) =>
                  Card({
                    id: item.id,
                    name: item.name,
                    desc: "Луна, лепестки, фонари и красная плашка уровня вокруг шапки профиля",
                    rarity: "LEGENDARY",
                    has,
                    on,
                    meta: has ? "Нажмите, чтобы надеть" : `Боевой пропуск${bp ? ` · ${bp.level} ур.` : ""}`,
                    onClick: () => toggleDecor(item.id, on),
                  }),
                )}

              {tab === "particle" && (
                <>
                  {Card({ id: "none", name: "Без частиц", desc: "Чистый фон", rarity: "COMMON", has: true, on: profile.particleFx === "", meta: "Нажмите, чтобы выбрать", onClick: () => updateProfile({ particleFx: "" }) })}
                  {PARTICLE_EFFECTS.map((item) => {
                    const has = owned.has(item.id);
                    return Card({
                      id: item.id,
                      name: item.name,
                      desc: item.description,
                      rarity: item.rarity,
                      has,
                      on: profile.particleFx === item.id,
                      meta: has ? "Нажмите, чтобы надеть" : `${item.price} AC · в магазине`,
                      onClick: () => updateProfile({ particleFx: item.id }),
                    });
                  })}
                </>
              )}

              {tab === "style" &&
                STYLE_EFFECTS.map((item) => {
                  const has = owned.has(item.id);
                  return Card({
                    id: item.id,
                    name: item.name,
                    desc: item.description,
                    rarity: item.rarity,
                    has,
                    on: profile.styleFx.includes(item.id),
                    meta: has ? "Можно сочетать до 4" : `${item.price} AC · в магазине`,
                    onClick: () => toggleStyle(item.id),
                  });
                })}
            </div>

            {tab === "tag" && (
              <div className="fxm-chips" role="group" aria-label="Теги">
                {ownedTags.length === 0 ? (
                  <p className="fxm-empty">Открытых тегов пока нет — они выдаются за достижения, уровни и в магазине.</p>
                ) : (
                  <>
                    {tagCount > 0 && (
                      <button
                        type="button"
                        className="fxm-clear"
                        onClick={() => {
                          progressEmit({ type: "UNEQUIP_TAG" });
                          updateProfile({ extraTagIds: [] });
                        }}
                      >
                        Снять все теги
                      </button>
                    )}
                    {ownedTags.map((tag) => {
                      const main = tagSel.primary === tag.id;
                      const extra = tagSel.extras.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          aria-pressed={main || extra}
                          title={main ? "Основной тег" : extra ? "Дополнительный тег" : "Нажмите, чтобы надеть"}
                          className={`fxm-chip${main ? " is-main" : extra ? " is-on" : ""}`}
                          onClick={() => tagSel.toggle(tag)}
                        >
                          <AgTag tag={tag} size="sm" />
                          <small>{main ? "Основной" : extra ? "Дополнительный" : "Надеть"}</small>
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            )}

            {tab === "frame" && (
              <div className="fxm-frames" role="group" aria-label="Рамки">
                {ownedFrames.map((item) => {
                  const on = profile.frameId === item.id || (!profile.frameId && item.id === "f-none");
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={on}
                      className={`fxm-frame${on ? " is-on" : ""}`}
                      onClick={() => updateProfile({ frameId: item.id })}
                    >
                      <AvatarFrame nickname={nickname} avatar={profile.avatar || undefined} frame={item} size="md" />
                      <span>{item.name}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <footer className="fxm-foot">
              <span>Закрытое открывается в магазине косметики</span>
              <Link href="/cosmetics" onClick={closeProfileDialog}>Открыть магазин</Link>
            </footer>
          </section>
        </div>
      </div>
    </div>
  );
}

/* --------------------------- Тема профиля ------------------------------- */

function ThemeSlider({ label, value, min, max, unit = "", onChange }: { label: string; value: number; min: number; max: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <label className="pc-row">
      <span>{label}</span>
      <input type="range" className="pc-range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <b>{value}{unit}</b>
    </label>
  );
}

/** Окно «Тема профиля»: фон страницы, боковые арты, стекло карточек, акцент */
function ThemeDialog() {
  const t = useProfileTheme();
  const art = useArtwork();
  const panelRef = useModalBehaviour(true, closeProfileDialog);
  const [tab, setTab] = useState<"presets" | "bgs" | "custom">("presets");
  const activeId = activePresetId(art.slots[0]?.media);

  const set = (fn: (x: ProfileTheme) => ProfileTheme) => patchTheme((x) => ({ ...fn(x), on: true }));

  return (
    <div className="fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto p-4 py-8 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && closeProfileDialog()}>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md" aria-hidden />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Тема профиля" tabIndex={-1} className="pc-theme">
        <header>
          <div>
            <h2>Тема профиля</h2>
            <p>Фон страницы, боковые арты и стиль карточек — всё видно сразу</p>
          </div>
          <label className="pc-sw">
            <input type="checkbox" checked={t.on} onChange={(e) => patchTheme((x) => ({ ...x, on: e.target.checked }))} />
            <i />
            <span>{t.on ? "Включена" : "Выключена"}</span>
          </label>
          <button type="button" className="pc-x" onClick={closeProfileDialog} aria-label="Закрыть">×</button>
        </header>

        <div className="pc-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "presets"} className={tab === "presets" ? "on" : ""} onClick={() => setTab("presets")}>Готовые сборки</button>
          <button type="button" role="tab" aria-selected={tab === "bgs"} className={tab === "bgs" ? "on" : ""} onClick={() => setTab("bgs")}>Живые фоны</button>
          <button type="button" role="tab" aria-selected={tab === "custom"} className={tab === "custom" ? "on" : ""} onClick={() => setTab("custom")}>Свои настройки</button>
        </div>

        {tab === "presets" && (
          <div className="pc-presets">
            {THEME_PRESETS.map((p) => {
              const on = t.on && activeId === p.id;
              return (
                <button key={p.id} type="button" className={`pc-preset ${on ? "is-on" : ""}`} style={{ ["--c" as string]: p.accent }} onClick={() => applyThemePreset(p)}>
                  <span className="pc-preset-go">{on ? "Применена" : "Применить"}</span>
                  <span className="pc-preset-pv"><img src={p.poster} alt="" loading="lazy" /></span>
                  <span className="pc-preset-in">
                    <b>{p.name}</b>
                    <small>{p.tag}</small>
                    <em><i />Акцент и фон подобраны</em>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {tab === "bgs" && (
          <>
            <div className="pc-presets is-bgs">
              {BG_PRESETS.map((b) => {
                const on = t.on && t.bg.media === b.file;
                return (
                  <button key={b.id} type="button" className={`pc-preset ${on ? "is-on" : ""}`} style={{ ["--c" as string]: b.accent }} onClick={() => applyBgPreset(b)}>
                    <span className="pc-preset-go">{on ? "Фон включён" : "Поставить"}</span>
                    <span className="pc-preset-pv is-wide"><img src={b.poster} alt="" loading="lazy" /></span>
                    <span className="pc-preset-in"><b>{b.name}</b></span>
                  </button>
                );
              })}
            </div>
            <p className="pc-note">Фон двигается на всей странице профиля. Затемнение и размытие — на вкладке «Свои настройки».</p>
          </>
        )}

        {tab === "custom" && <div className="pc-theme-body">
          <section>
            <h4>Фон страницы</h4>
            <div className="pc-pv">{t.bg.media ? <MediaView id={t.bg.media} fit={t.bg.fit} /> : <span>Картинка, гиф или видео</span>}</div>
            <MediaPicker current={t.bg.media} label="Загрузить фон" onChange={(id) => set((x) => ({ ...x, bg: { ...x.bg, media: id } }))} />
            <ThemeSlider label="Затемнение" value={t.bg.dim} min={0} max={90} unit="%" onChange={(v) => set((x) => ({ ...x, bg: { ...x.bg, dim: v } }))} />
            <ThemeSlider label="Размытие" value={t.bg.blur} min={0} max={24} unit="px" onChange={(v) => set((x) => ({ ...x, bg: { ...x.bg, blur: v } }))} />
            <div className="pc-seg">
              <button type="button" className={t.bg.fit === "cover" ? "on" : ""} onClick={() => set((x) => ({ ...x, bg: { ...x.bg, fit: "cover" } }))}>Заполнить</button>
              <button type="button" className={t.bg.fit === "contain" ? "on" : ""} onClick={() => set((x) => ({ ...x, bg: { ...x.bg, fit: "contain" } }))}>Вписать</button>
            </div>
          </section>

          {(["left", "right"] as const).map((side) => (
            <section key={side}>
              <h4>{side === "left" ? "Левый арт" : "Правый арт"}</h4>
              <div className="pc-pv is-tall">{t[side].media ? <MediaView id={t[side].media} fit="contain" /> : <span>Боковая гифка</span>}</div>
              <MediaPicker current={t[side].media} label="Загрузить арт" onChange={(id) => set((x) => ({ ...x, [side]: { ...x[side], media: id } }))} />
              <ThemeSlider label="Ширина" value={t[side].width} min={6} max={30} unit="%" onChange={(v) => set((x) => ({ ...x, [side]: { ...x[side], width: v } }))} />
              <ThemeSlider label="Яркость" value={t[side].opacity} min={10} max={100} unit="%" onChange={(v) => set((x) => ({ ...x, [side]: { ...x[side], opacity: v } }))} />
            </section>
          ))}

          <section>
            <h4>Карточки</h4>
            <ThemeSlider label="Прозрачность" value={t.glass.opacity} min={20} max={100} unit="%" onChange={(v) => set((x) => ({ ...x, glass: { ...x.glass, opacity: v } }))} />
            <ThemeSlider label="Стекло (blur)" value={t.glass.blur} min={0} max={30} unit="px" onChange={(v) => set((x) => ({ ...x, glass: { ...x.glass, blur: v } }))} />
            <ThemeSlider label="Скругление" value={t.radius} min={4} max={32} unit="px" onChange={(v) => set((x) => ({ ...x, radius: v }))} />
            <label className="pc-row">
              <span>Акцентный цвет</span>
              <input type="color" className="pc-color" value={t.accent || "#ff3d62"} onChange={(e) => set((x) => ({ ...x, accent: e.target.value }))} />
              {t.accent ? <button type="button" className="pc-btn is-ghost" onClick={() => patchTheme((x) => ({ ...x, accent: "" }))}>Сбросить</button> : <b>по умолчанию</b>}
            </label>
            <label className="pc-row">
              <span>Плавное движение артов</span>
              <input type="checkbox" checked={t.float} onChange={(e) => patchTheme((x) => ({ ...x, float: e.target.checked }))} />
            </label>
          </section>
        </div>}

        <footer>
          <button type="button" className="pc-btn is-ghost" onClick={() => { for (const m of [t.bg.media, t.left.media, t.right.media]) if (m) void deleteMedia(m); resetTheme(); }}>Сбросить всё</button>
          <button type="button" className="pc-btn" onClick={closeProfileDialog}>Готово</button>
        </footer>
      </div>
    </div>
  );
}

/* ------------------------------- Аватары -------------------------------- */

/** Окно аватаров: загрузить новый или вернуть один из прежних */
function AvatarDialog() {
  const profile = useProfile();
  const account = useAccount();
  const [message, setMessage] = useState<{ text: string; tone: "error" | "ok" } | null>(null);
  const frame = FRAMES.find((item) => item.id === profile.frameId);
  const nickname = account?.nickname ?? "Гость";
  const history = profile.avatar && !profile.avatarHistory.includes(profile.avatar)
    ? [profile.avatar, ...profile.avatarHistory]
    : profile.avatarHistory;

  const onFile = useCallback(async (file: File) => {
    const result = await readImageFile(file, { maxDim: 512, maxMb: IMAGE_LIMITS.avatar });
    if (!result.ok) {
      setMessage({ text: result.error, tone: "error" });
      return;
    }
    updateProfile({ avatar: result.data, avatarHistory: pushAvatarHistory(profileStore.get().avatarHistory, result.data) });
    progressEmit({ type: "PROFILE_FIELD", field: "avatar" });
    setMessage({ text: result.animated ? "GIF-аватар сохранён как есть" : "Аватар обновлён", tone: "ok" });
  }, []);

  return (
    <DialogShell title="Аватар" subtitle="Загрузите новый или вернитесь к прежнему" onClose={closeProfileDialog} className="ag-avdlg">
      <div className="ag-avdlg-hero">
        <span className="ag-avdlg-glow" aria-hidden />
        <AvatarFrame nickname={nickname} avatar={profile.avatar || undefined} frame={frame} size="md" />
        <div className="min-w-0">
          <p className="truncate text-base font-black text-white">{nickname}</p>
          <p className="text-[11px] text-muted">Так вас видят другие</p>
        </div>
      </div>

      <FilePicker label="Загрузить новый аватар" onFile={(file) => void onFile(file)} className="ag-avdlg-up" />
      {message && <Note tone={message.tone}>{message.text}</Note>}

      <p className="mb-2 mt-5 text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Мои загрузки · {history.length}</p>
      {history.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-xs text-muted">
          Здесь появятся аватары, которые вы загрузите
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2.5">
          {history.map((src) => {
            const active = profile.avatar === src;
            return (
              <div key={src.slice(-40) + src.length} className={`ag-avdlg-cell ${active ? "is-on" : ""}`}>
                <button
                  type="button"
                  aria-label="Применить аватар"
                  onClick={() => updateProfile({ avatar: src })}
                  className="block aspect-square w-full overflow-hidden rounded-2xl"
                >
                  
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
                {active && <span className="ag-avdlg-tick">Сейчас</span>}
                {!active && (
                  <button
                    type="button"
                    aria-label="Удалить из загрузок"
                    className="ag-avdlg-del"
                    onClick={() => updateProfile({ avatarHistory: profile.avatarHistory.filter((item) => item !== src) })}
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {profile.avatar && (
        <button
          type="button"
          onClick={() => updateProfile({ avatar: "" })}
          className="mt-4 w-full rounded-xl border border-dashed border-line px-3 py-2.5 text-xs font-semibold text-muted transition hover:border-white/25 hover:text-white"
        >
          Вернуть стандартный аватар
        </button>
      )}
    </DialogShell>
  );
}

/* ----------------------------- Смена фона ------------------------------- */

/**
 * Вкладка «Эффекты» в гардеробе.
 *
 * Две независимые оси, как в макете: частица выбирается одна, стиль можно
 * включать несколько сразу. Уровень I…III — множитель, он не продаётся и
 * меняется свободно.
 *
 * Надеть можно только купленное: эффект, которого нет в покупках, показан
 * замком и ведёт в магазин. Иначе стиль работал бы до оплаты.
 */
function EffectsPanel() {
  const profile = useProfile();
  const doc = useProgress();
  const owned = new Set([...doc.purchases.map((item) => item.itemId), ...profile.purchased]);

  const toggleStyle = (id: string) => {
    const on = profile.styleFx.includes(id);
    updateProfile({
      styleFx: on ? profile.styleFx.filter((x) => x !== id) : [...profile.styleFx, id].slice(0, 4),
    });
  };

  const cell = (active: boolean) =>
    `flex flex-col items-center gap-2 rounded-xl px-2 py-3 text-center transition ${
      active ? "ring-2 ring-accent-2" : "ring-1 ring-white/10 hover:ring-white/30"
    }`;

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
          Частица · одна на профиль
        </p>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => updateProfile({ particleFx: "" })}
            className={`${cell(profile.particleFx === "")} bg-white/[0.04]`}
          >
            <span className="text-lg">—</span>
            <span className="truncate text-[11px] font-bold text-white">Нет</span>
          </button>
          {PARTICLE_EFFECTS.map((item) => {
            const has = owned.has(item.id);
            const active = profile.particleFx === item.id;
            return (
              <button
                key={item.id}
                type="button"
                disabled={!has}
                onClick={() => updateProfile({ particleFx: item.id })}
                className={`${cell(active)} bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-45`}
              >
                <span className="text-[11px] font-black text-muted">{has ? "" : "🔒"}</span>
                <span className="truncate text-[11px] font-bold text-white">{item.name}</span>
                <span className={`text-[10px] font-bold ${has ? "text-mint" : "text-accent-2"}`}>
                  {has ? "надето" : `${item.price} AC`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
          Стиль · можно сочетать
        </p>
        <div className="grid grid-cols-4 gap-2">
          {STYLE_EFFECTS.map((item) => {
            const has = owned.has(item.id);
            const active = profile.styleFx.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                disabled={!has}
                onClick={() => toggleStyle(item.id)}
                className={`${cell(active)} bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-45`}
              >
                <span className="text-[11px] font-black text-muted">{has ? "" : "🔒"}</span>
                <span className="truncate text-[11px] font-bold text-white">{item.name}</span>
                <span className={`text-[10px] font-bold ${has ? "text-mint" : "text-accent-2"}`}>
                  {has ? "стиль" : `${item.price} AC`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
          Уровень эффекта
        </p>
        <div className="flex gap-2">
          {EFFECT_LEVELS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => updateProfile({ fxLevel: value })}
              aria-pressed={profile.fxLevel === value}
              className={`h-9 flex-1 rounded-xl text-xs font-bold transition ${
                profile.fxLevel === value
                  ? "bg-accent-deep text-white ring-1 ring-accent/50"
                  : "bg-white/6 text-muted ring-1 ring-white/10 hover:text-white"
              }`}
            >
              {EFFECT_LEVEL_LABEL[value]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Уровень умножает количество частиц и амплитуду стилей. Покупается отдельно
          и не расходуется.
        </p>
      </div>
    </div>
  );
}

/** Редактор своего баннера: тянуть — двигать, ползунок/колесо — масштаб */
function BannerEditor() {
  const profile = useProfile();
  const zoom = profile.bgZoom ?? 1;
  const x = profile.bgX ?? 50;
  const y = profile.bgY ?? 50;
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const clamp = (v: number) => Math.min(100, Math.max(0, v));

  const onDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { px: event.clientX, py: event.clientY, x, y };
  };
  const onMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = box.current;
    if (!d || !el) return;
    const rect = el.getBoundingClientRect();
    /* Чем больше масштаб, тем медленнее «едет» кадр относительно пальца */
    const k = zoom > 1 ? 100 / ((zoom - 1) * rect.width) : 0;
    const kv = zoom > 1 ? 100 / ((zoom - 1) * rect.height) : 0;
    updateProfile({
      bgX: clamp(d.x - (event.clientX - d.px) * k * 1.0),
      bgY: clamp(d.y - (event.clientY - d.py) * Math.max(kv, k) * 1.0),
    });
  };
  const onUp = () => {
    drag.current = null;
  };
  const setZoom = (value: number) => updateProfile({ bgZoom: Math.min(4, Math.max(1, value)) });

  return (
    <div className="mt-4 rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
      <div
        ref={box}
        className="h-28 w-full cursor-grab touch-none select-none rounded-xl ring-1 ring-white/15 active:cursor-grabbing"
        style={customBannerStyle(profile)}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={(event) => setZoom(zoom - event.deltaY * 0.002)}
        role="img"
        aria-label="Предпросмотр баннера: перетащите, чтобы сдвинуть"
      />
      <p className="mt-2 text-[11px] text-muted">Перетаскивайте картинку, чтобы сдвинуть. Колесо мыши или ползунок — масштаб.</p>
      <label className="mt-2 flex items-center gap-3 text-xs font-bold text-white">
        Масштаб
        <input
          type="range"
          min={1}
          max={4}
          step={0.05}
          value={zoom}
          onChange={(event) => setZoom(Number(event.target.value))}
          className="h-1 flex-1 accent-[var(--accent-2,#4ac5f5)]"
        />
        <span className="w-10 text-right tabular-nums text-muted">{Math.round(zoom * 100)}%</span>
      </label>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {[
          ["← →", "Центр по горизонтали", { bgX: 50 }],
          ["↑ ↓", "Центр по вертикали", { bgY: 50 }],
          ["Сброс", "Сбросить масштаб и положение", { bgZoom: 1, bgX: 50, bgY: 50 }],
        ].map(([label, title, patch]) => (
          <button
            key={String(title)}
            type="button"
            title={String(title)}
            onClick={() => updateProfile(patch as Parameters<typeof updateProfile>[0])}
            className="rounded-lg bg-white/8 px-2 py-1.5 text-[11px] font-bold text-white ring-1 ring-white/12 transition hover:bg-white/16"
          >
            {String(label)}
          </button>
        ))}
      </div>
    </div>
  );
}

function BackgroundDialog() {
  const profile = useProfile();
  const ctx = useUnlockContext();
  const [message, setMessage] = useState<{ text: string; tone: "error" | "ok" } | null>(null);

  const onFile = useCallback(async (file: File) => {
    const result = await readImageFile(file, { maxDim: 1600, maxMb: IMAGE_LIMITS.background });
    if (!result.ok) {
      setMessage({ text: result.error, tone: "error" });
      return;
    }
    updateProfile({ backgroundId: "custom", backgroundCustom: result.data, bgZoom: 1, bgX: 50, bgY: 50 });
    setMessage({ text: "Свой фон применён — подвиньте и приблизьте его ниже", tone: "ok" });
  }, []);

  return (
    <DialogShell title="Изменить фон" subtitle="Баннер вверху страницы профиля" onClose={closeProfileDialog}>
      <FilePicker label="Загрузить свой" onFile={(file) => void onFile(file)} />

      {message && <Note tone={message.tone}>{message.text}</Note>}

      {profile.backgroundId === "custom" && profile.backgroundCustom && <BannerEditor />}

      <div className="mt-4 space-y-2">
        <div className="grid grid-cols-3 gap-2">
          {BACKGROUNDS.map((item) => {
            const active = profile.backgroundId === item.id;
            const owned = isUnlocked(item.unlock, ctx);
            return (
              <button
                key={item.id}
                type="button"
                disabled={!owned}
                onClick={() => updateProfile({ backgroundId: item.id, backgroundCustom: "" })}
                aria-label={`Применить фон «${item.name}»`}
                className={`group relative overflow-hidden rounded-xl text-left ring-1 transition disabled:cursor-not-allowed disabled:opacity-45 ${
                  active ? "ring-2 ring-accent-2" : "ring-white/12 hover:ring-white/35"
                }`}
              >
                <span className="block h-16 w-full" style={{ background: item.css }} />
                <span className="flex items-center justify-between gap-1 px-2 py-1.5">
                  <span className="truncate text-[11px] font-bold text-white">{item.name}</span>
                  {active && (
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-accent-2" fill="none" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 5 5L19 7" />
                    </svg>
                  )}
                </span>
                {!owned && (
                  <span className="absolute inset-x-0 bottom-8 bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white/80">
                    {item.unlock.price ? `${item.unlock.price} AC` : `уровень ${item.unlock.level ?? "?"}`}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {profile.backgroundId === "custom" && (
          <button
            type="button"
            onClick={() => updateProfile({ backgroundId: "preset-dusk", backgroundCustom: "" })}
            className="w-full rounded-xl border border-dashed border-line px-3 py-2.5 text-xs font-semibold text-muted transition hover:border-white/25 hover:text-white"
          >
            Снять свой фон
          </button>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
        <span className="text-xs text-muted">Пресеты открываются по уровню и AC</span>
        <button
          type="button"
          onClick={() => openProfileDialog("appearance")}
          className="btn-ghost inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-accent-2 hover:bg-accent-2/12"
        >
          Открыть всю витрину
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m0 0-5-5m5 5-5 5" />
          </svg>
        </button>
      </div>
    </DialogShell>
  );
}

/* ----------------------- Выбор тега и титула (меню) --------------------- */

function TitleDialog() {
  const ctx = useUnlockContext();
  const doc = useProgress();
  const tagSel = useTagSelection();
  const titleSel = useTitleSelection();
  const [message, setMessage] = useState<string | null>(null);

  const ownedCount = Object.keys(doc.tags).length;
  const ownedTitles = TITLES.filter((item) => isUnlocked(item.unlock, ctx));
  const lockedTitles = TITLES.filter((item) => !isUnlocked(item.unlock, ctx));
  const selectedCount = (tagSel.primary ? 1 : 0) + tagSel.extras.length;

  const toggleTag = (tag: (typeof PROGRESSION_CONFIG.tags)[number]) => {
    const wasSelected = tagSel.isSelected(tag.id);
    tagSel.toggle(tag);
    setMessage(wasSelected ? "Тег снят" : "Тег выбран");
  };

  const clearTags = () => {
    progressEmit({ type: "UNEQUIP_TAG" });
    updateProfile({ extraTagIds: [] });
    setMessage("Все теги сняты");
  };

  return (
    <DialogShell
      title="Теги и титулы"
      subtitle="Капсулы подсвечиваются рядом с ником — выбирайте открытые"
      onClose={closeProfileDialog}
      wide
    >
      {message && <Note tone="ok">{message}</Note>}

      <div className="max-h-[56vh] space-y-5 overflow-y-auto pr-1">
        {/* Все теги прогрессии: 29 из конфига, невидимых здесь нет */}
        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
              Теги · открыто {ownedCount} из {PROGRESSION_CONFIG.tags.length} · выбрано {selectedCount}
            </p>
            {selectedCount > 0 && (
              <button
                type="button"
                onClick={clearTags}
                className="shrink-0 rounded-lg bg-white/8 px-2.5 py-1 text-[11px] font-bold text-white ring-1 ring-white/15 transition hover:bg-white/16"
              >
                Снять все
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PROGRESSION_CONFIG.tags.map((tag) => {
              const owned = Boolean(doc.tags[tag.id]);
              const main = tagSel.primary === tag.id;
              const extra = tagSel.extras.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  disabled={!owned}
                  onClick={() => toggleTag(tag)}
                  title={tagSourceHint(tag)}
                  aria-pressed={main || extra}
                  className={`flex items-center justify-center rounded-xl bg-white/[0.04] px-2 py-2.5 ring-1 transition disabled:cursor-not-allowed ${
                    main
                      ? "ring-2 ring-accent-2"
                      : extra
                        ? "ring-2 ring-mint/60"
                        : owned
                          ? "ring-white/10 hover:bg-white/[0.07] hover:ring-white/30"
                          : "opacity-70 ring-white/8"
                  }`}
                >
                  <AgTag tag={tag} size="sm" locked={!owned} />
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            Можно выбрать несколько: первый — основной, остальные — дополнительные; повторный
            клик снимает. Приглушённые ещё не открыты — подсказка «как получить» под курсором,
            магазинные покупаются за AC во вкладке «Теги» витрины.
          </p>
        </section>

        {/* Титулы косметики — те же капсулы, другой каталог */}
        <section>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
            Титулы · открыто {ownedTitles.length} из {TITLES.length}
          </p>
          {ownedTitles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-white/[0.02] p-5 text-center">
              <p className="text-xs text-muted">Открытых титулов пока нет — они падают за достижения и Premium</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => updateProfile({ titleId: "", extraTitleIds: [] })}
                aria-pressed={!titleSel.primary && titleSel.extras.length === 0}
                className={`flex items-center justify-center rounded-xl px-3 py-2.5 text-xs font-bold ring-1 transition ${
                  !titleSel.primary && titleSel.extras.length === 0
                    ? "bg-accent-deep text-white ring-accent"
                    : "bg-white/6 text-muted ring-white/12 hover:text-white"
                }`}
              >
                Без титула
              </button>
              {ownedTitles.map((item) => {
                const main = titleSel.primary === item.id;
                const extra = titleSel.extras.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => titleSel.toggle(item, true)}
                    aria-pressed={main || extra}
                    className={`flex items-center justify-center rounded-xl bg-white/[0.04] px-2 py-2.5 ring-1 transition ${
                      main ? "ring-2 ring-accent-2" : extra ? "ring-2 ring-mint/60" : "ring-white/10 hover:bg-white/[0.07] hover:ring-white/30"
                    }`}
                  >
                    <AgTag tag={titleTag(item)} size="sm" />
                  </button>
                );
              })}
            </div>
          )}

          {lockedTitles.length > 0 && (
            <div className="mt-3 space-y-1.5 border-t border-line pt-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Ещё не открыты</p>
              <ul className="space-y-1.5">
                {lockedTitles.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-2"
                  >
                    <AgTag tag={titleTag(item)} size="sm" locked />
                    <span className="shrink-0 text-right text-[11px] text-muted">
                      {item.unlock.price
                        ? `${item.unlock.price} AC`
                        : item.unlock.level
                          ? `уровень ${item.unlock.level}`
                          : item.unlock.premium
                            ? "нужен Premium"
                            : "за достижение"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <div className="mt-4 flex justify-end border-t border-line pt-3">
        <button
          type="button"
          onClick={() => openProfileDialog("appearance")}
          className="btn-ghost inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-accent-2 hover:bg-accent-2/12"
        >
          Открыть всю витрину
        </button>
      </div>
    </DialogShell>
  );
}

/* ----------------------------- Внешний вид ------------------------------ */

type WardrobeTab = "tag" | "background" | "title" | "frame" | "avatar" | "effects";

const WARDROBE_TABS: { id: WardrobeTab; label: string }[] = [
  { id: "tag", label: "Теги" },
  { id: "background", label: "Фоны" },
  { id: "title", label: "Титулы" },
  { id: "frame", label: "Рамки" },
  { id: "effects", label: "Эффекты" },
  { id: "avatar", label: "Аватар" },
];

/** Редкости тегов прогрессии (шкала COMMON…SECRET шире, чем у косметики) */
const TAG_RARITY_FILTERS: { id: string; label: string }[] = [
  { id: "any", label: "Любая" },
  { id: "COMMON", label: "Обычный" },
  { id: "UNCOMMON", label: "Необычный" },
  { id: "RARE", label: "Редкий" },
  { id: "EPIC", label: "Эпический" },
  { id: "LEGENDARY", label: "Легендарный" },
  { id: "MYTHIC", label: "Мифический" },
  { id: "SECRET", label: "Секрет" },
];

/** Подсказка «как получить» для тега (источник — конфиг) */
function tagSourceHint(tag: (typeof PROGRESSION_CONFIG.tags)[number]): string {
  if (tag.source === "level") return `Уровень ${tag.level ?? "?"}`;
  if (tag.source === "shop") return `${tag.price ?? 0} AC`;
  if (tag.source === "referral") return `${tag.friends ?? 0} друзей`;
  if (tag.source === "achievement" || tag.source === "secret") {
    const achievement = PROGRESSION_CONFIG.achievements.find(
      (item) => item.id === tag.achievementId,
    );
    if (!achievement) return "Тайный знак";
    return achievement.hidden ? "За «???»" : `За «${achievement.name}»`;
  }
  return "Событие";
}

/**
 * Подсказка «как получить» для титула — по образцу tagSourceHint.
 *
 * Общий `unlockHint` из косметики отдаёт «за достижение» без названия:
 * в карточке это ни о чём не говорит, у тегов же стоит «За «Первая
 * серия»». Названия достижений берём из конфига прогрессии.
 *
 * Про «За тайное достижение»: id достижений у титулов сейчас не совпадают
 * с конфигом (watch-1 против ach_episodes_1), поэтому названия нет. Формулировка
 * намеренно общая — называть несуществующее достижение тайным значит врать;
 * сам разрыв вынесен отдельным вопросом, а не замаскирован текстом.
 */
function titleSourceHint(item: TitleItem): string {
  if (item.unlock.price) return `${item.unlock.price} AC`;
  if (item.unlock.premium) return "нужен Premium";
  if (item.unlock.achievement) {
    const achievement = PROGRESSION_CONFIG.achievements.find(
      (a) => a.id === item.unlock.achievement,
    );
    if (achievement) return achievement.hidden ? "За «???»" : `За «${achievement.name}»`;
    return "за достижение";
  }
  if (item.unlock.level) return `Уровень ${item.unlock.level}`;
  return "доступно всем";
}

const RARITIES: { id: Rarity | "any"; label: string }[] = [
  { id: "any", label: "Любая" },
  { id: "common", label: "Обычный" },
  { id: "rare", label: "Редкий" },
  { id: "epic", label: "Эпический" },
  { id: "legendary", label: "Легендарный" },
];

function AppearanceDialog() {
  const profile = useProfile();
  const account = useAccount();
  const ctx = useUnlockContext();
  const doc = useProgress();
  const [tab, setTab] = useState<WardrobeTab>("background");
  const [rarity, setRarity] = useState<Rarity | "any">("any");
  const [tagRarity, setTagRarity] = useState<string>("any");
  const [message, setMessage] = useState<string | null>(null);

  const nickname = account?.nickname ?? "Гость";
  const frame = FRAMES.find((item) => item.id === profile.frameId);
  const level = useLevelInfo();
  const title = TITLES.find((item) => item.id === profile.titleId);

  /* --------------------------- Теги (§12.3) --------------------------- */
  const tagSel = useTagSelection();
  const titleSel = useTitleSelection();
  const equippedTag = PROGRESSION_CONFIG.tags.find(
    (item) => item.id === tagSel.primary,
  );
  const extraTags = tagSel.extras
    .map((id) => PROGRESSION_CONFIG.tags.find((item) => item.id === id))
    .filter((item): item is (typeof PROGRESSION_CONFIG.tags)[number] => Boolean(item));
  const extraTitles = titleSel.extras
    .map((id) => TITLES.find((item) => item.id === id))
    .filter((item): item is (typeof TITLES)[number] => Boolean(item));
  const balance = doc.progress.acBalance;
  const ownedTags = Object.keys(doc.tags).length;

  /** Экипировка/снятие уходят движку — он пишет их в документ */
  const toggleTag = (tag: (typeof PROGRESSION_CONFIG.tags)[number]) => {
    const wasSelected = tagSel.isSelected(tag.id);
    tagSel.toggle(tag);
    setMessage(wasSelected ? "Тег снят" : "Тег выбран");
  };

  /** Титулы носятся так же, как теги, и подтверждаются так же */
  const toggleTitle = (item: TitleItem, owned: boolean) => {
    const wasSelected = titleSel.isSelected(item.id);
    titleSel.toggle(item, owned);
    setMessage(wasSelected ? "Титул снят" : "Титул выбран");
  };

  const buyTag = (id: string, name: string, price: number) => {
    const res = progressEmit({ type: "SHOP_PURCHASED", itemId: id, kind: "tag", price });
    if (res.rejected) {
      setMessage(
        res.rejected.reason === "insufficient_ac"
          ? "Не хватает AC — они копятся за вход, квесты и активность"
          : "Покупка не прошла",
      );
    } else {
      setMessage(`Тег «${name}» куплен за ${price} AC — экипируйте`);
    }
  };

  const onAvatar = useCallback(async (file: File) => {
    const result = await readImageFile(file, { maxDim: 512, maxMb: IMAGE_LIMITS.avatar });
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    updateProfile({ avatar: result.data, avatarHistory: pushAvatarHistory(profileStore.get().avatarHistory, result.data) });
    // Аватар — внешний критерий заполненности профиля, XP считает движок
    progressEmit({ type: "PROFILE_FIELD", field: "avatar" });
    setMessage(result.animated ? "GIF-аватар сохранён как есть" : "Аватар обновлён");
  }, []);

  const passRarity = (value: Rarity) => rarity === "any" || value === rarity;

  return (
    <DialogShell
      title="Внешний вид"
      subtitle="Примерочная: так профиль выглядит для гостей"
      onClose={closeProfileDialog}
      wide
      className="ag-wardrobe"
    >
      {/* Примерочная: фон сцены — выбранный фон профиля, как на странице */}
      <div
        className="aw-stage rounded-2xl border border-line bg-gradient-to-b from-accent/12 to-transparent p-4"
        style={{ ["--aw-bg" as string]: BACKGROUNDS.find((item) => item.id === profile.backgroundId)?.css ?? "none" }}
      >
        <div className="flex items-center gap-3">
          <AvatarFrame
  nickname={nickname}
  avatar={profile.avatar || undefined}
  frame={frame}
  size="md"
/>
          <div className="min-w-0">
            <p className="truncate text-lg font-black text-white">{nickname}</p>
            <p className="truncate text-xs text-muted">@{nickname.toLowerCase()}</p>
            {/* Значки у ника: один тег и один титул, оба классом `pf-badge`.
                Раньше здесь выводились все надетые (до 30 штук) — строка
                превращалась в простыню и переставала читаться. Масштаб тот
                же, что в лидерборде: `.pf-badge` в ag-theme.css. */}
            {(equippedTag || title) && (
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {equippedTag && <AgTag tag={equippedTag} size="md" className="pf-badge" />}
                {title && <AgTag tag={titleTag(title)} size="md" className="pf-badge" />}
              </div>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="rounded-md bg-accent-2/15 px-1.5 py-0.5 text-[10px] font-black text-accent-2">
                УРОВЕНЬ {level.level}
              </span>
              <span className="rounded-md bg-white/8 px-1.5 py-0.5 text-[10px] font-bold text-muted">{level.era}</span>
            </div>
            {/* Загрузка аватара — прямо в блоке примерки: раньше кнопка жила
                во вкладке «Аватар» и в неё приходилось заходить отдельно. */}
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <FilePicker
                label={profile.avatar ? "Заменить аватар" : "Загрузить аватар"}
                onFile={(file) => void onAvatar(file)}
              />
              {profile.avatar && (
                <button
                  type="button"
                  onClick={() => {
                    updateProfile({ avatar: "" });
                    setMessage("Аватар сброшен");
                  }}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-muted transition hover:text-white"
                >
                  Убрать
                </button>
              )}
              <span className="text-[11px] text-muted">JPG, PNG, WebP, GIF · до {IMAGE_LIMITS.avatar} МБ</span>
            </div>
          </div>
        </div>
      </div>

      {/* Категории */}
      <div className="aw-bar mt-4 flex flex-wrap items-center gap-2">
        <div className="aw-tabs flex flex-wrap gap-1 rounded-xl bg-white/6 p-1 ring-1 ring-white/10">
          {WARDROBE_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                tab === item.id ? "bg-accent-deep text-white" : "text-muted hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab !== "avatar" && tab !== "tag" && (
          <div className="aw-rar ml-auto flex gap-1 rounded-xl bg-white/6 p-1 ring-1 ring-white/10">
            {RARITIES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setRarity(item.id)}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${
                  rarity === item.id ? "bg-white/15 text-white" : "text-muted hover:text-white"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {message && <Note tone="ok">{message}</Note>}

      {/* Сетка предметов */}
      <div className="aw-scroll mt-3 max-h-[46vh] overflow-y-auto pr-1">
        {tab === "avatar" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <FilePicker label={profile.avatar ? "Заменить аватар" : "Загрузить аватар"} onFile={(file) => void onAvatar(file)} />
              {profile.avatar && (
                <button
                  type="button"
                  onClick={() => updateProfile({ avatar: "" })}
                  className="btn-ghost rounded-xl bg-white/8 px-3.5 py-2.5 text-sm font-semibold text-rose-300 ring-1 ring-white/12 hover:bg-rose-400/12"
                >
                  Удалить
                </button>
              )}
            </div>
            <p className="text-xs leading-relaxed text-muted">
              Поддерживаются JPEG, PNG, WebP и GIF — анимация сохраняется как есть. Статичные картинки
              ужимаются до 512 px. Максимум {IMAGE_LIMITS.avatar} МБ.
            </p>
            <p className="text-xs leading-relaxed text-muted">
              Всё хранится в этом браузере: сервера у проекта нет, поэтому картинка не уедет на другой
              устройство и не увидит никто, кроме вас.
            </p>
          </div>
        )}

        {tab === "tag" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1">
              {TAG_RARITY_FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTagRarity(item.id)}
                  className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${
                    tagRarity === item.id
                      ? "bg-white/15 text-white"
                      : "text-muted hover:text-white"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div data-wardrobe-grid="" className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {PROGRESSION_CONFIG.tags
                .filter((tag) => tagRarity === "any" || tag.rarity === tagRarity)
                .map((tag) => {
                  const owned = Boolean(doc.tags[tag.id]);
                  const main = tagSel.primary === tag.id;
                  const extra = tagSel.extras.includes(tag.id);
                  const price = tag.price ?? 0;
                  return (
                    <div
                      key={tag.id}
                      className={`flex flex-col items-center gap-2 rounded-xl bg-white/[0.04] px-2.5 py-3 text-center ring-1 transition ${
                        main ? "ring-2 ring-accent-2" : extra ? "ring-2 ring-mint/60" : "ring-white/10"
                      }`}
                    >
                      <AgTag tag={tag} size="md" locked={!owned} />
                      <span className="max-w-full truncate text-[11px] font-bold text-white">
                        {tag.name}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ring-1 ${CFG_RARITY_CLASS[tag.rarity]}`}
                      >
                        {CFG_RARITY_LABEL[tag.rarity]}
                      </span>
                      <span className="min-h-[14px] text-[10px] leading-tight text-muted">
                        {tagSourceHint(tag)}
                      </span>
                      {main ? (
                        <button
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className="w-full rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white ring-1 ring-white/15 transition hover:bg-white/16"
                        >
                          Снять
                        </button>
                      ) : extra ? (
                        <button
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className="w-full rounded-lg bg-mint/15 px-2.5 py-1.5 text-[11px] font-bold text-mint ring-1 ring-mint/35 transition hover:bg-mint/25"
                        >
                          Выбран ✓
                        </button>
                      ) : owned ? (
                        <button
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className="btn-primary w-full rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-white"
                        >
                          Экипировать
                        </button>
                      ) : tag.source === "shop" && tag.price !== undefined ? (
                        <button
                          type="button"
                          disabled={balance < price}
                          onClick={() => buyTag(tag.id, tag.name, price)}
                          className="btn-primary w-full rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          Купить {price} AC
                        </button>
                      ) : (
                        <span className="w-full rounded-lg bg-white/6 px-2.5 py-1.5 text-[10px] font-bold text-muted ring-1 ring-white/10">
                          Не получен
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>
            <p className="text-xs leading-relaxed text-muted">
              Тег — подпись из конфига прогрессии, выбранные видны рядом с ником. Можно носить
              несколько сразу: первый становится основным (его видят движок и комментарии),
              остальные — дополнительными. Магазинные теги покупаются за AC, остальные
              открываются уровнем, достижениями и секретами.
            </p>
          </div>
        )}

        {tab === "background" && (
          <div className="aw-grid grid grid-cols-2 gap-2 sm:grid-cols-3">
            {BACKGROUNDS.filter((item) => passRarity(item.rarity)).map((item) => {
              const owned = isUnlocked(item.unlock, ctx);
              const active = profile.backgroundId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!owned}
                  onClick={() => updateProfile({ backgroundId: item.id, backgroundCustom: "" })}
                  data-rarity={item.rarity}
                  className={`aw-card overflow-hidden rounded-xl text-left ring-1 transition disabled:cursor-not-allowed disabled:opacity-45 ${
                    active ? "is-on ring-2 ring-accent-2" : "ring-white/12 hover:ring-white/35"
                  }`}
                >
                  <span className="aw-thumb block h-20 w-full" style={{ background: item.css }} />
                  <span className="flex items-center justify-between gap-2 px-2 py-2">
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-bold text-white">{item.name}</span>
                      <span className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ring-1 ${RARITY_CLASS[item.rarity]}`}>
                        {RARITY_LABEL[item.rarity]}
                      </span>
                    </span>
                    {active && (
                      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-accent-2" fill="none" stroke="currentColor" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 5 5L19 7" />
                      </svg>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {tab === "title" && (
          <div className="space-y-3">
            {/* Карточка титула устроена как карточка тега: капсула, имя,
                редкость, условие открытия и отдельная кнопка действия.
                Раньше титул был одной большой кнопкой без подписи и без
                подсказки — выбрать его можно было, но нельзя было понять,
                чем он отличается от соседних и почему некоторые закрыты. */}
            {/* data-wardrobe-grid — общий крючок для гейтов: теги и титулы
                проверяются одним селектором и должны выглядеть одинаково */}
            <div data-wardrobe-grid="" className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {TITLES.filter((item) => passRarity(item.rarity)).map((item) => {
                const owned = isUnlocked(item.unlock, ctx);
                const main = titleSel.primary === item.id;
                const extra = titleSel.extras.includes(item.id);
                return (
                  <div
                    key={item.id}
                    className={`flex flex-col items-center gap-2 rounded-xl bg-white/[0.04] px-2.5 py-3 text-center ring-1 transition ${
                      main ? "ring-2 ring-accent-2" : extra ? "ring-2 ring-mint/60" : "ring-white/10"
                    }`}
                  >
                    <AgTag tag={titleTag(item)} size="md" locked={!owned} />
                    <span className="max-w-full truncate text-[11px] font-bold text-white">
                      {item.name}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ring-1 ${RARITY_CLASS[item.rarity]}`}
                    >
                      {RARITY_LABEL[item.rarity]}
                    </span>
                    <span className="min-h-[14px] text-[10px] leading-tight text-muted">
                      {titleSourceHint(item)}
                    </span>
                    {main ? (
                      <button
                        type="button"
                        onClick={() => toggleTitle(item, owned)}
                        className="w-full rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white ring-1 ring-white/15 transition hover:bg-white/16"
                      >
                        Снять
                      </button>
                    ) : extra ? (
                      <button
                        type="button"
                        onClick={() => toggleTitle(item, owned)}
                        className="w-full rounded-lg bg-mint/15 px-2.5 py-1.5 text-[11px] font-bold text-mint ring-1 ring-mint/35 transition hover:bg-mint/25"
                      >
                        Выбран ✓
                      </button>
                    ) : owned ? (
                      <button
                        type="button"
                        onClick={() => toggleTitle(item, owned)}
                        className="btn-primary w-full rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-white"
                      >
                        Экипировать
                      </button>
                    ) : (
                      <span className="w-full rounded-lg bg-white/6 px-2.5 py-1.5 text-[10px] font-bold text-muted ring-1 ring-white/10">
                        Не получен
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs leading-relaxed text-muted">
              Титулы тоже носятся по несколько: первый выбранный — основной, остальные
              показываются рядом с ним. Повторный клик снимает.
            </p>
          </div>
        )}

        {tab === "effects" && <EffectsPanel />}

        {tab === "frame" && (
          <div className="aw-grid aw-frames grid grid-cols-3 gap-2">
            {FRAMES.filter((item) => passRarity(item.rarity)).map((item) => {
              const owned = isUnlocked(item.unlock, ctx);
              const active = profile.frameId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!owned}
                  onClick={() => updateProfile({ frameId: item.id })}
                  className={`aw-card flex flex-col items-center gap-2 rounded-xl bg-white/[0.04] px-2 py-3 ring-1 transition disabled:cursor-not-allowed disabled:opacity-45 ${
                    active ? "is-on ring-2 ring-accent-2" : "ring-white/10 hover:ring-white/30"
                  }`}
                >
                  <AvatarFrame
  nickname={nickname}
  avatar={profile.avatar || undefined}
  frame={item}
  size="md"
/>
                  <span className="truncate text-[11px] font-bold text-white">{item.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="aw-foot mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
        <span className="text-xs text-muted">
          Открыто предметов:{" "}
          {ownedTags +
            ctx.purchased.length + TITLES.filter((i) => isUnlocked(i.unlock, ctx)).length +
            FRAMES.filter((i) => isUnlocked(i.unlock, ctx)).length +
            BACKGROUNDS.filter((i) => isUnlocked(i.unlock, ctx)).length}
        </span>
        <Link
          href="/store"
          onClick={closeProfileDialog}
          className="btn-ghost inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-accent-2 hover:bg-accent-2/12"
        >
          Магазин за AC
        </Link>
      </div>
    </DialogShell>
  );
}

/* ------------------------------ Настройки ------------------------------- */

export type SettingsTab =
  | "profile"
  | "privacy"
  | "looks"
  | "notifications"
  | "subscription"
  | "player"
  | "data";

export const SETTINGS_TABS: { id: SettingsTab; label: string; description: string }[] = [
  { id: "profile", label: "Профиль", description: "Почта, пароль, привязки и описание" },
  { id: "privacy", label: "Приватность", description: "Кто видит профиль, статистику и историю" },
  { id: "looks", label: "Внешний вид", description: "Тема, акцент, фото, баннер и звёзды" },
  { id: "notifications", label: "Уведомления", description: "Что присылать и куда" },
  { id: "subscription", label: "Подписка", description: "Premium и его привилегии" },
  { id: "player", label: "Плеер", description: "Качество, скорость, субтитры, клавиши" },
  { id: "data", label: "Данные", description: "Сессии, экспорт и удаление аккаунта" },
];

/** Темы оформления макета */
const THEMES: { id: Prefs["theme"]; title: string }[] = [
  { id: "dark", title: "Тёмная" },
  { id: "light", title: "Светлая" },
  { id: "system", title: "Системная" },
];

const THEME_ICONS: Record<Prefs["theme"], ReactNode> = {
  dark: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />
    </svg>
  ),
  light: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" />
    </svg>
  ),
  system: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 21h8M12 16v5" />
    </svg>
  ),
};

/** Горячие клавиши плеера: подписи в том виде, в каком их видит человек */
const HOTKEYS: { id: keyof Prefs["keys"]; title: string; keys: string[] }[] = [
  { id: "play", title: "Пауза / продолжить", keys: ["Space"] },
  { id: "seek", title: "Перемотка ±10 сек", keys: ["←", "→"] },
  { id: "volume", title: "Громкость", keys: ["↑", "↓"] },
  { id: "fullscreen", title: "Полный экран", keys: ["F"] },
  { id: "skip", title: "Пропустить опенинг", keys: ["S"] },
  { id: "next", title: "Следующая серия", keys: ["N"] },
];

/** Режим «экономия» (§14): ручной выбор переопределяет автоматику по ядрам */
const ECO_OPTIONS: { id: EcoMode; label: string }[] = [
  { id: "auto", label: "Авто" },
  { id: "on", label: "Всегда" },
  { id: "off", label: "Выкл" },
];

/* --------------------- Примитивы страницы настроек --------------------- */

/**
 * Блок настроек: иконка, заголовок, пояснение — как в макете.
 *
 * Классы свои (`ag-set-*`), поэтому одинаково выглядят и на странице
 * `/settings`, и в модалке, и не задевают ничего в остальном интерфейсе.
 *
 * Иконка принимается готовым штрихом (`<path>`, `<circle>`…), поэтому
 * оборачиваем её в `<svg>` сами — иначе React выведет неизвестные теги
 * прямо в DOM и страница упадёт.
 */
function SetBlock({
  icon,
  title,
  hint,
  aside,
  children,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="ag-set">
      <header className="ag-set-h">
        <span className="ag-set-hi" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            {icon}
          </svg>
        </span>
        <div>
          <h2>{title}</h2>
          <p>{hint}</p>
        </div>
        {aside}
      </header>
      {children}
    </section>
  );
}

/**
 * Строка блока: слева название и пояснение, справа управление.
 *
 * `icon` — всегда штрих SVG (оборачивается в `<svg>` здесь), `lead` —
 * произвольный узел вместо иконки: кружок с буквой, логотип, значок.
 */
function SetRow({
  icon,
  lead,
  title,
  hint,
  children,
}: {
  icon?: ReactNode;
  lead?: ReactNode;
  title: string;
  hint: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="ag-set-r">
      <span className="ag-set-ri" aria-hidden="true">
        {lead ?? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            {icon}
          </svg>
        )}
      </span>
      <div className="ag-set-rx">
        <b>{title}</b>
        <small>{hint}</small>
      </div>
      {children}
    </div>
  );
}

/** Состояние разрешения браузера на уведомления */
type PushState = "unsupported" | "default" | "granted" | "denied";

/**
 * Разрешение на уведомления читаем лениво: `Notification` на сервере нет,
 * и обращение к нему в теле рендера уронило бы страницу при сборке.
 */
function initialPushState(): PushState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission as PushState;
}

/** Запрос разрешения делается в компоненте: ответ приходит асинхронно,
 *  и показать его можно только через setState */

/** Фраза, которую надо ввести для необратимого удаления */
const ERASE_PHRASE = "УДАЛИТЬ";

interface PaymentRow {
  id: string;
  title: string;
  at: number;
  amount: string;
}

/**
 * История операций для блока «История платежей».
 *
 * Источник — журнал покупок движка (`doc.purchases`): покупки предметов за
 * AC и покупки Premium. Это настоящие траты этого браузера, а не чеки:
 * платёжных систем у сайта нет, имитировать их значило бы выдумать
 * данные, которых не было.
 */
function buildPayments(doc: ReturnType<typeof useProgress>): PaymentRow[] {
  return doc.purchases
    .filter((item) => typeof item.at === "number" && item.at > 0)
    .map((item) => {
      const def = PROGRESSION_CONFIG.shop.find((entry) => entry.id === item.itemId);
      return {
        id: `${item.itemId}-${item.at}`,
        title: def?.name ?? item.itemId,
        at: item.at,
        amount: `${item.price} AC`,
      };
    })
    .sort((a, b) => b.at - a.at);
}

/** Значок-галочка для статуса «настроено» */
const OK_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12l4.5 4.5L19 7" />
  </svg>
);

/** Три уровня доступа к профилю — как в макете */
const SCOPES: { id: ProfileScope; title: string; hint: string }[] = [
  { id: "public", title: "Открытый", hint: "Профиль виден всем, активность и списки открыты." },
  { id: "friends", title: "Только друзья", hint: "Профиль видят друзья, остальным — нет." },
  { id: "private", title: "Приватный", hint: "Профиль скрыт, активность и списки не показываются." },
];

/** Иконки привязанных аккаунтов */
const LINK_ICONS = {
  google: <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18v14H3zM3 7l9 6 9-6" />,
  telegram: (
    <>
      <path d="M21 3L3 10.5l6 2.5 2.5 6.5 3-4.5L19 19z" />
      <path d="M9 13l12-10" />
    </>
  ),
} as const;

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <div className="ag-set-r">
      <span className="min-w-0">
        <span className="block text-sm font-bold text-white">{label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted">{hint}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`ag-tg ${checked ? "on" : ""}`}
      >
        <span />
      </button>
    </div>
  );
}

/**
 * Содержимое настроек (пилюли вкладок + панели) — общий код модалки
 * `SettingsDialog` и страницы `/settings?tab=` (панель контролируется снаружи)
 */
export function SettingsPanel({
  tab,
  onTabChange,
  inDialog = false,
  hideTabs = false,
}: {
  tab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  /** В модалке контент ограничен по высоте и прокручивается, на странице — нет */
  inDialog?: boolean;
  /** На странице вкладки рендерит сайдбар снаружи — прячем пилюли */
  hideTabs?: boolean;
}) {
  const profile = useProfile();
  const account = useAccount();
  const eco = ecoStore.useStore();
  const sfxOn = useSfxEnabled();
  const [draftBio, setDraftBio] = useState(profile.bio);
  const [draftSignature, setDraftSignature] = useState(profile.signature);
  const [message, setMessage] = useState<string | null>(null);

  /* --------------------------- Новые настройки --------------------------- */

  const prefs = usePrefs();
  const doc = useProgress();
  const links = useLinks();
  const devices = useDevices();
  const friends = useFriends();
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwError, setPwError] = useState<string | null>(null);
  const [linkDraft, setLinkDraft] = useState<{ provider: LinkProvider; handle: string }>({
    provider: "google",
    handle: "",
  });
  const [linkError, setLinkError] = useState<string | null>(null);
  const [deviceLabel, setDeviceLabel] = useState("");
  const [deviceCode, setDeviceCode] = useState("");
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [friendDraft, setFriendDraft] = useState("");
  const [friendMutual, setFriendMutual] = useState(true);
  const [friendError, setFriendError] = useState<string | null>(null);
  const [pushState, setPushState] = useState<PushState>(() => initialPushState());

  /**
   * Сессии и платежи — реальные записи этого браузера.
   *
   * Сессию различать нечем (сервера нет), поэтому она всегда одна; платежи
   * берутся из журнала покупок движка — это настоящие траты, а не чеки.
   */
  const sessions = useSessions();
  const payments = useMemo(() => buildPayments(doc), [doc]);

  /** Браузер спрашивает сам; мы только запоминаем ответ */
  const requestPush = useCallback(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    void Notification.requestPermission().then((permission) => {
      setPushState(permission as PushState);
    });
  }, []);

  const premium = isPremiumActive(account);
  const initials = account?.nickname.slice(0, 2).toUpperCase() ?? "";

  /**
   * Пресеты приватности — три уровня доступа, как в макете. «Только
   * друзья» в макете означает «видят взаимные подписчики»; друзей
   * заводит сам пользователь (см. accounts.ts), потому что подтвердить
   * заявку без сервера некому.
   */
  const setScope = useCallback(
    (next: ProfileScope) => {
      updateProfile({
        privacy: {
          ...profile.privacy,
          scope: next,
          profilePublic: next !== "private",
          showStats: next === "public",
          showAchievements: next !== "private",
          showHistory: next !== "private",
        },
      });
    },
    [profile.privacy],
  );

  const scope = profile.privacy.scope ?? "public";

  const save = useCallback(() => {
    const bio = draftBio.slice(0, 300);
    updateProfile({
      bio,
      signature: draftSignature.replace(/\s+/g, "").slice(0, 32).toUpperCase(),
    });
    // Правило «био» платит только за осмысленный текст (внешний критерий
    // сервиса — от 20 символов), иначе награда ушла бы за пустое поле
    if (bio.trim().length >= 20) progressEmit({ type: "PROFILE_FIELD", field: "bio" });
    setMessage("Сохранено");
  }, [draftBio, draftSignature]);

  const onBanner = useCallback(async (file: File) => {
    const result = await readImageFile(file, { maxDim: 1600, maxMb: IMAGE_LIMITS.background });
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    updateProfile({ backgroundId: "custom", backgroundCustom: result.data, bgZoom: 1, bgX: 50, bgY: 50 });
    setMessage("Баннер обновлён");
  }, []);

  const onAvatar = useCallback(async (file: File) => {
    const result = await readImageFile(file, { maxDim: 512, maxMb: IMAGE_LIMITS.avatar });
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    updateProfile({ avatar: result.data });
    // Аватар — внешний критерий заполненности профиля, XP считает движок
    progressEmit({ type: "PROFILE_FIELD", field: "avatar" });
    setMessage(result.animated ? "GIF-аватар сохранён как есть" : "Аватар обновлён");
  }, []);

  /* ---------------------- Локальная «база данных» ---------------------- */

const EMPTY_STATS: { count: number; bytes: number } = { count: 0, bytes: 0 };

/**
 * Снимок объёма хранилища для плитки «Ключей / объём».
 *
 * Через `useSyncExternalStore`, а не `useState(() => storageStats())`: на
 * сервере localStorage нет, и инициализатор useState на клиенте при
 * гидратации уже посчитал бы настоящие 10 ключей против нулей в
 * серверном HTML. React на такое отвечает перегенерацией дерева и
 * предупреждением о расхождении — то есть страница «Данные» каждый раз
 * ругалась бы в консоль. Серверный снимок здесь честно нулевой, а
 * настоящие числа приходят вторым рендером.
 */
function useStorageStats(): { count: number; bytes: number } {
  const cache = useRef<{ raw: string; stats: { count: number; bytes: number } } | null>(null);

  const getSnapshot = useCallback(() => {
    const entries = storageEntries();
    let count = 0;
    let bytes = 0;
    const parts: string[] = [];
    for (const [key, value] of entries ?? []) {
      if (!key.startsWith(BACKUP_KEY_PREFIX)) continue;
      count += 1;
      bytes += key.length + value.length;
      // Отпечаток для сравнения: сам объём stats меняется при каждом
      // вызове, а useSyncExternalStore требует стабильную ссылку
      parts.push(key, String(value.length));
    }
    const raw = parts.join("|");
    if (!cache.current || cache.current.raw !== raw) {
      cache.current = { raw, stats: { count, bytes } };
    }
    return cache.current.stats;
  }, []);

  const getServerSnapshot = useCallback(() => EMPTY_STATS, []);

  const subscribe = useCallback((onChange: () => void) => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith(BACKUP_KEY_PREFIX)) onChange();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

  /** Снимок хранилища для плитки «Ключей/объём» — обновляется при изменении базы */
  const stats = useStorageStats();
  const [canRollback, setCanRollback] = useState(() => hasPreimport());
  const fileRef = useRef<HTMLInputElement | null>(null);

  const onExport = useCallback(() => {
    const result = exportBackup();
    setMessage(result.ok ? `Бэкап сохранён: ${result.value} ключей` : result.error);
  }, []);

  const onImportFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 8_000_000) {
      setMessage("Файл слишком большой (лимит 8 МБ)");
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      setMessage("Не удалось прочитать файл");
      return;
    }
    const parsed = parseBackup(text);
    if (!parsed.ok) {
      setMessage(parsed.error);
      return;
    }
    const result = importBackup(parsed.value);
    if (!result.ok) {
      setMessage(result.error);
      setCanRollback(hasPreimport());
      return;
    }
    // Все сторы читают localStorage на старте — после перезагрузки данные новые
    window.location.reload();
  }, []);

  const onRollback = useCallback(() => {
    const result = rollbackImport();
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    window.location.reload();
  }, []);

  return (
    <div data-settings-panel>
      {!hideTabs && (
        <div className="flex flex-wrap gap-1 rounded-xl bg-white/6 p-1 ring-1 ring-white/10">
          {SETTINGS_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              aria-pressed={tab === item.id}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                tab === item.id ? "bg-accent-deep text-white" : "text-muted hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {message && <Note tone="ok">{message}</Note>}

      <div className={inDialog ? "mt-4 max-h-[52vh] overflow-y-auto pr-1" : hideTabs ? "" : "mt-4"}>
        {tab === "profile" && (
          <div className="space-y-4">
            <SetBlock
              icon={
                <>
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="m3.5 7 8.5 6 8.5-6" />
                </>
              }
              title="Email адрес"
              hint="Адрес для входа и восстановления доступа"
              aside={<span className="ag-set-st ok">{OK_ICON} Почта подтверждена</span>}
            >
              <div className="ag-set-cur">
                <small>Текущий адрес</small>
                <b>{account?.email ?? "—"}</b>
              </div>
              <p className="ag-set-hint">
                Подтверждение письмом устроить нечем — почта никуда не отправляется, поэтому
                адрес меняется только вместе с аккаунтом.
              </p>
            </SetBlock>

            <SetBlock
              icon={
                <>
                  <rect x="5" y="11" width="14" height="9" rx="2" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V8a4 4 0 0 1 8 0v3" />
                </>
              }
              title="Смена пароля"
              hint="Используйте надёжный пароль, который не применяете на других сайтах"
            >
              <p className="ag-set-warn">
                После смены пароля выйдете из аккаунта на всех устройствах, включая это.
                Войти заново нужно будет с новым паролем.
              </p>
              <label className="ag-set-fl" htmlFor="pw-current">
                <span className="ag-set-lb">Текущий пароль</span>
                <input
                  id="pw-current"
                  type="password"
                  autoComplete="current-password"
                  value={pw.current}
                  onChange={(event) => setPw({ ...pw, current: event.target.value })}
                />
              </label>
              <label className="ag-set-fl" htmlFor="pw-next">
                <span className="ag-set-lb">Новый пароль</span>
                <input
                  id="pw-next"
                  type="password"
                  autoComplete="new-password"
                  value={pw.next}
                  onChange={(event) => setPw({ ...pw, next: event.target.value })}
                />
                <span className="ag-set-hint">Минимум 8 символов, заглавная, строчная, цифра</span>
              </label>
              <label className="ag-set-fl" htmlFor="pw-confirm">
                <span className="ag-set-lb">Подтвердите пароль</span>
                <input
                  id="pw-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={pw.confirm}
                  onChange={(event) => setPw({ ...pw, confirm: event.target.value })}
                />
              </label>
              <div className="ag-set-acts">
                <button
                  type="button"
                  className="ag-set-btn"
                  onClick={() => {
                    const result = changePassword(pw.current, pw.next, pw.confirm);
                    if (!result.ok) {
                      setPwError(result.error);
                      return;
                    }
                    void syncPasswordChange(pw.current, pw.next);
                    setPwError(null);
                    setPw({ current: "", next: "", confirm: "" });
                    setMessage("Пароль обновлён");
                  }}
                >
                  Обновить пароль
                </button>
              </div>
              {pwError && <p className="ag-set-warn">{pwError}</p>}
            </SetBlock>

            <SetBlock
              icon={
                <>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
                </>
              }
              title="Привязанные аккаунты"
              hint="Управляйте способами входа в аккаунт"
              aside={<span className="ag-set-st ok">{OK_ICON} Google: {links.filter((l) => l.provider === "google").length} из 1</span>}
            >
              <TelegramLink />
              {links.filter((link) => link.provider === "google").map((link) => (
                <SetRow
                  key={link.provider}
                  icon={LINK_ICONS[link.provider]}
                  title={LINK_LABEL[link.provider]}
                  hint={`${link.handle} · привязан ${timeAgo(link.at)}`}
                >
                  <button
                    type="button"
                    className="ag-set-btn danger"
                    onClick={() => unlinkAccount(link.provider)}
                  >
                    Отвязать
                  </button>
                </SetRow>
              ))}

              <div className="ag-set-rowform">
                <select
                  className="ag-set-in"
                  value={linkDraft.provider}
                  onChange={(event) =>
                    setLinkDraft({ ...linkDraft, provider: event.target.value as LinkProvider })
                  }
                  aria-label="Сервис"
                >
                  <option value="google">Google</option>
                </select>
                <input
                  value={linkDraft.handle}
                  onChange={(event) => setLinkDraft({ ...linkDraft, handle: event.target.value })}
                  placeholder={linkDraft.provider === "google" ? "почта Google" : "юзернейм Telegram"}
                  aria-label="Аккаунт сервиса"
                />
                <button
                  type="button"
                  className="ag-set-btn"
                  onClick={() => {
                    const error = linkAccount(linkDraft.provider, linkDraft.handle);
                    setLinkError(error);
                    if (!error) setLinkDraft({ provider: linkDraft.provider, handle: "" });
                  }}
                >
                  Привязать
                </button>
              </div>
              {linkError && <p className="ag-set-warn">{linkError}</p>}
              <p className="ag-set-hint">
                Привязка Google пока сохраняется только в этом браузере: подтверждения от
                сервиса нет. Telegram привязывается по-настоящему, через бота.
              </p>
            </SetBlock>

            <SetBlock
              icon={
                <>
                  <rect x="3" y="6" width="18" height="12" rx="2" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8" />
                </>
              }
              title="Телевизоры"
              hint="Устройства, подключённые как второй экран"
              aside={devices.length > 0 ? <span className="ag-set-st ok">{OK_ICON} {devices.length}</span> : undefined}
            >
              <div className="ag-set-rowform">
                <input
                  value={deviceLabel}
                  onChange={(event) => setDeviceLabel(event.target.value)}
                  placeholder="Название: Гостиная"
                  aria-label="Название устройства"
                  maxLength={32}
                />
                <input
                  value={deviceCode}
                  onChange={(event) => setDeviceCode(event.target.value.toUpperCase())}
                  placeholder="XXXX-XXXX"
                  aria-label="Код подключения"
                  maxLength={9}
                />
                <button
                  type="button"
                  className="ag-set-btn"
                  onClick={() => {
                    const error = addDevice(deviceLabel, deviceCode);
                    setDeviceError(error);
                    if (!error) {
                      setDeviceLabel("");
                      setDeviceCode("");
                    }
                  }}
                >
                  Подключить
                </button>
              </div>
              {deviceError && <p className="ag-set-warn">{deviceError}</p>}

              {devices.length === 0 ? (
                <div className="ag-set-empty">
                  <b>Нет привязанных телевизоров</b>
                  <small>
                    Откройте AniGalaxy на телевизоре и введите его код подключения — устройство
                    появится здесь.
                  </small>
                </div>
              ) : (
                <ul className="ag-set-list">
                  {devices.map((device) => (
                    <li key={device.code}>
                      <b>{device.label}</b>
                      <span className="ag-w-sub">{device.code}</span>
                      <button
                        type="button"
                        className="ag-set-btn danger"
                        onClick={() => removeDevice(device.code)}
                      >
                        Отключить
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="ag-set-hint">
                Обмена кодами по сети нет — код вводится вручную с того же устройства.
              </p>
            </SetBlock>

            <SetBlock
              icon={
                <>
                  <circle cx="12" cy="8" r="3.6" />
                  <path strokeLinecap="round" d="M4.5 20a7.5 7.5 0 0 1 15 0" />
                </>
              }
              title="О себе"
              hint="Описание и подпись — их видно в публичном профиле"
            >
              <SetRow
                lead={<span className="ag-set-avatar">{initials}</span>}
                title={account?.nickname ?? "Гость"}
                hint={account?.email ?? "Аккаунт не создан"}
              >
                <span className="ag-set-note">Вход по почте и паролю</span>
              </SetRow>
              <label className="ag-set-fl" htmlFor="bio">
                <span className="ag-set-lb">О себе</span>
                <textarea
                  id="bio"
                  value={draftBio}
                  onChange={(event) => setDraftBio(event.target.value)}
                  maxLength={300}
                  rows={3}
                  placeholder="Пара слов о вкусах и настроении"
                />
                <span className="ag-set-cnt">{draftBio.length}/300</span>
              </label>

              <label className="ag-set-fl" htmlFor="signature">
                <span className="ag-set-lb">Hex-подпись</span>
                <input
                  id="signature"
                  value={draftSignature}
                  onChange={(event) => setDraftSignature(event.target.value)}
                  maxLength={32}
                  spellCheck={false}
                  placeholder="Пусто — будет сгенерирована автоматически"
                />
              </label>

              <p className="ag-set-hint">
                Подпись хранится рядом с профилем и показывается в шапке страницы тем же шрифтом,
                что и остальные hex-коды достижений.
              </p>

              <div className="ag-set-acts">
                <button type="button" onClick={save} className="ag-set-btn">Сохранить</button>
              </div>
            </SetBlock>
          </div>
        )}

        {tab === "looks" && (
          <div className="space-y-4">
            <SetBlock
              icon={
                <>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 10v4h3l4 3.5v-11L8 10z" />
                  <path strokeLinecap="round" d="M15.5 9.5a3.5 3.5 0 0 1 0 5M18 7a7 7 0 0 1 0 10" />
                </>
              }
              title="Звуки интерфейса"
              hint="Тихие сигналы на кнопках, наградах и действиях"
            >
              <Toggle
                checked={sfxOn}
                onChange={setSfxEnabled}
                label="Включить звуки"
                hint="Короткие тоны без файлов. Можно выключить в любой момент"
              />
            </SetBlock>

            <SetBlock
              icon={
                <>
                  <rect x="4" y="5" width="16" height="14" rx="2.5" />
                  <circle cx="9" cy="10" r="1.5" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="m5.5 17.5 4-4 3 3 2.5-2.5 3.5 3.5" />
                </>
              }
              title="Фото профиля"
              hint="Показывается в профиле, в меню и в списках"
            >
              <div className="ag-set-acts">
                <FilePicker label={profile.avatar ? "Заменить" : "Выбрать файл"} onFile={(file) => void onAvatar(file)} />
                {profile.avatar && (
                  <button
                    type="button"
                    onClick={() => updateProfile({ avatar: "" })}
                    className="ag-set-btn danger"
                  >
                    Удалить
                  </button>
                )}
              </div>
              <p className="ag-set-hint">
                Макс. {IMAGE_LIMITS.avatar} МБ · JPEG, PNG, WebP, GIF · рекомендуется 400×400 px
              </p>
            </SetBlock>

            <SetBlock
              icon={
                <>
                  <rect x="3" y="4" width="18" height="12" rx="2" />
                  <path strokeLinecap="round" d="M8 20h8" />
                </>
              }
              title="Баннер профиля"
              hint="Растянутая полоса во всю ширину вверху страницы профиля"
            >
              <div className="ag-set-acts">
                <FilePicker label={profile.backgroundCustom ? "Заменить" : "Выбрать файл"} onFile={(file) => void onBanner(file)} />
                {profile.backgroundCustom && (
                  <button
                    type="button"
                    onClick={() => updateProfile({ backgroundId: "preset-dusk", backgroundCustom: "" })}
                    className="ag-set-btn danger"
                  >
                    Снять
                  </button>
                )}
              </div>
              <p className="ag-set-hint">
                Макс. {IMAGE_LIMITS.background} МБ · JPEG, PNG, WebP, GIF · рекомендуется 1200×400 px
              </p>
            </SetBlock>

            <SetBlock
              icon={
                <>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 17a8 8 0 1 1 16 0M12 17l4-5" />
                </>
              }
              title="Эффекты и производительность"
              hint="Режим экономии гасит декоративные анимации — как системная настройка «уменьшить движение»"
            >
              <div className="ag-set-opts">
                {ECO_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setEco(option.id)}
                    aria-pressed={eco === option.id}
                    className={`ag-set-op ${eco === option.id ? "on" : ""}`}
                  >
                    <b>{option.label}</b>
                    <small>
                      {option.id === "auto"
                        ? "Телефоны — упрощённые, ПК — полные"
                        : option.id === "on"
                          ? "Экономия батареи и нагрева"
                          : "Максимум визуала, греет батарею"}
                    </small>
                    <i aria-hidden="true" />
                  </button>
                ))}
              </div>
              <p className="ag-set-hint">
                Сейчас: {ecoActive() ? "экономия включена, анимации сокращены" : "полные анимации"}
                {eco === "auto" ? (weakCpu() ? " · по автоматике" : " · автоматика не сработала") : " · вручную"}
                {cpuCores() > 0 && ` · ядер: ${cpuCores()}`}
              </p>
            </SetBlock>

            <SetBlock
              icon={
                <>
                  <rect x="3" y="4" width="18" height="16" rx="2.5" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9h18M9 9v11" />
                </>
              }
              title="Витрина и титул"
              hint="Порядок блоков на странице профиля и подпись над ником"
            >
              <div className="ag-set-acts">
                <button
                  type="button"
                  onClick={() => openProfileDialog("appearance")}
                  className="ag-set-btn"
                >
                  Открыть витрину
                </button>
                <button
                  type="button"
                  onClick={() => openProfileDialog("title")}
                  className="ag-set-btn"
                >
                  Выбрать титул
                </button>
              </div>
              <p className="ag-set-hint">
                Титулы и рамки покупаются за AC в магазине; здесь выбирается только то, что уже куплено.
              </p>
            </SetBlock>
            <SetBlock
              icon={
                <>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.5-2s0-2.5 1.5-2.5H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3z" />
                  <circle cx="7.5" cy="11" r="1" />
                  <circle cx="10" cy="7" r="1" />
                  <circle cx="15" cy="7.5" r="1" />
                </>
              }
              title="Тема оформления"
              hint="Выберите, как выглядит AniGalaxy"
            >
              <div className="ag-set-opts">
                {THEMES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`ag-set-op is-icon ${prefs.theme === item.id ? "on" : ""}`}
                    aria-pressed={prefs.theme === item.id}
                    onClick={() => updatePrefs({ theme: item.id })}
                  >
                    <span className="ag-set-big">{THEME_ICONS[item.id]}</span>
                    <b>{item.title}</b>
                    <i aria-hidden="true" />
                  </button>
                ))}
              </div>
              <p className="ag-set-hint">
                Тема красит страницы профиля, списка, настроек и магазина — те, что свёрстаны по
                макетам. Шапка и остальной сайт остаются тёмными: их оформление задано отдельно.
              </p>
            </SetBlock>

            <SetBlock
              icon={
                <>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.5-2s0-2.5 1.5-2.5H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3z" />
                  <circle cx="7.5" cy="11" r="1" />
                  <circle cx="10" cy="7" r="1" />
                  <circle cx="15" cy="7.5" r="1" />
                </>
              }
              title="Акцентный цвет"
              hint="Цвет интерфейса, используемый для кнопок и акцентов"
            >
              <div className="ag-set-swatches">
                {ACCENTS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`ag-set-sw ${prefs.accent === item.id ? "on" : ""}`}
                    aria-pressed={prefs.accent === item.id}
                    onClick={() => updatePrefs({ accent: item.id })}
                    style={{ background: `linear-gradient(135deg, ${item.a}, ${item.b})` }}
                  >
                    <span aria-hidden="true" />
                    <b>{item.name}</b>
                  </button>
                ))}
              </div>
              <p className="ag-set-hint">
                Цвет применяется сразу — кнопки, рамки и подсветка перекрасятся по всему сайту.
              </p>
            </SetBlock>

            <SetBlock
              icon={
                <>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
                </>
              }
              title="Звёздное небо"
              hint="Фон AniGalaxy можно подстроить под себя"
            >
              <label className="ag-set-rng">
                <b>Количество звёзд</b>
                <input
                  type="range"
                  min={0}
                  max={320}
                  step={10}
                  value={prefs.stars}
                  onChange={(event) => updatePrefs({ stars: Number(event.target.value) })}
                />
                <output>{prefs.stars}</output>
              </label>
            </SetBlock>
          </div>
        )}

        {tab === "notifications" && (
          <div className="space-y-4">
            <SetBlock
              icon={
                <>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4" />
                </>
              }
              title="Что присылать"
              hint="Выберите, о чём сообщать и куда. Изменения сохраняются сразу."
            >
              <div className="ag-set-channels">
                <span>В приложении</span>
                <span>Telegram</span>
                <span>Email</span>
              </div>

              {NOTIFY_EVENTS.map((item) => (
                <div key={item.id} className="ag-set-nrow">
                  <SetRow title={item.title} hint={<>{item.hint}{item.locked && <em className="ag-set-lock">{item.locked}</em>}</>}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={prefs.notify[item.id]}
                      aria-label={item.title}
                      className={`ag-tg ${prefs.notify[item.id] ? "on" : ""}`}
                      onClick={() =>
                        updatePrefs({ notify: { ...prefs.notify, [item.id]: !prefs.notify[item.id] } })
                      }
                    >
                      <span />
                    </button>
                  </SetRow>
                  <div className="ag-set-dash" aria-hidden>—</div>
                  <div className="ag-set-dash" aria-hidden>—</div>
                </div>
              ))}

              <div className="ag-set-sub">
                <Toggle
                  checked={prefs.notifyWatchingOnly}
                  onChange={(value) => updatePrefs({ notifyWatchingOnly: value })}
                  label="Только из списка «Смотрю»"
                  hint="Не присылать новые серии тайтлов из списка «Запланировано»"
                />
                <Toggle
                  checked={prefs.notifyFavouriteDubs}
                  onChange={(value) => updatePrefs({ notifyFavouriteDubs: value })}
                  label="Только любимые озвучки"
                  hint="Присылать новую серию, только когда она вышла в одной из ваших любимых озвучек"
                />
              </div>
            </SetBlock>

            <SetBlock
              icon={
                <>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4" />
                </>
              }
              title="Уведомления на этом устройстве"
              hint="Разрешение браузера на показ всплывающих плашек"
            >
              <SetRow
                title="Всплывающие уведомления"
                hint="Плашка «Получено достижение» во время просмотра и на сайте. Сами достижения засчитываются в любом случае."
              >
                <button
                  type="button"
                  className={`ag-set-btn ${pushState === "granted" ? "is-ok" : ""}`}
                  disabled={pushState === "granted" || pushState === "unsupported"}
                  onClick={requestPush}
                >
                  {pushState === "granted"
                    ? "Разрешено"
                    : pushState === "denied"
                      ? "Запрещено в браузере"
                      : pushState === "unsupported"
                        ? "Не поддерживается"
                        : "Разрешить"}
                </button>
              </SetRow>
              <p className="ag-set-hint">
                Сервера нет, поэтому приходят только события этого браузера: новое достижение,
                серия, конец подписки. Telegram и Email отмечены прочерками — отправлять туда
                нечем.
              </p>
            </SetBlock>
          </div>
        )}

        {tab === "player" && (
          <div className="space-y-4">
            <SetBlock
              icon={
                <>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 4l13 8-13 8z" />
                </>
              }
              title="Качество по умолчанию"
              hint="Плеер сам выберет это разрешение, если оно есть у серии"
            >
              <div className="ag-set-opts">
                {QUALITIES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`ag-set-op is-icon ${prefs.quality === item.id ? "on" : ""}`}
                    aria-pressed={prefs.quality === item.id}
                    onClick={() => updatePrefs({ quality: item.id })}
                  >
                    <b>{item.label}</b>
                    {item.premium && <em className="ag-set-soon">PREMIUM</em>}
                    <i aria-hidden="true" />
                  </button>
                ))}
              </div>
              <p className="ag-set-hint">
                Если выбранного качества нет — плеер возьмёт ближайшее меньшее.
              </p>
            </SetBlock>

            <SetBlock
              icon={
                <>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 2L4 14h7l-1 8 9-12h-7z" />
                </>
              }
              title="Поведение плеера"
              hint="Как плеер ведёт себя во время просмотра"
            >
              <Toggle
                checked={prefs.autoplayNext}
                onChange={(value) => updatePrefs({ autoplayNext: value })}
                label="Автопереход на следующую серию"
                hint="Через 10 секунд после титров"
              />
              <Toggle
                checked={prefs.skipOp}
                onChange={(value) => updatePrefs({ skipOp: value })}
                label="Пропускать опенинги"
                hint="Кнопка «Пропустить» нажмётся сама"
              />
              <Toggle
                checked={prefs.rememberDub}
                onChange={(value) => updatePrefs({ rememberDub: value })}
                label="Запоминать озвучку"
                hint="Плеер продолжит с той озвучке, что вы выбрали последней"
              />
              <Toggle
                checked={prefs.ambient}
                onChange={(value) => updatePrefs({ ambient: value })}
                label="Подсветка в кинозале"
                hint="Свет от видео мягко заливает фон вокруг плеера"
              />
              <SetRow title="Скорость по умолчанию" hint="Применяется ко всем сериям">
                <select
                  className="ag-set-in sm"
                  value={prefs.speed}
                  onChange={(event) => updatePrefs({ speed: event.target.value as Prefs["speed"] })}
                  aria-label="Скорость воспроизведения"
                >
                  {SPEEDS.map((value) => (
                    <option key={value} value={value}>{value === "1" ? "1×" : `${value}×`}</option>
                  ))}
                </select>
              </SetRow>
            </SetBlock>

            <SetBlock
              icon={
                <>
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 14h4M13 14h4M7 10h2M12 10h5" />
                </>
              }
              title="Субтитры"
              hint="Размер и фон текста"
            >
              <div className="ag-set-subs">
                <span
                  style={{
                    fontSize: `${Math.round(prefs.subtitleSize * 0.62)}px`,
                    textShadow: prefs.subtitleBg ? "0 2px 6px rgba(0,0,0,.9)" : "none",
                  }}
                >
                  Вот так будут выглядеть субтитры
                </span>
              </div>
              <label className="ag-set-rng">
                <b>Размер</b>
                <input
                  type="range"
                  min={14}
                  max={34}
                  value={prefs.subtitleSize}
                  onChange={(event) => updatePrefs({ subtitleSize: Number(event.target.value) })}
                />
                <output>{prefs.subtitleSize} px</output>
              </label>
              <Toggle
                checked={prefs.subtitleBg}
                onChange={(value) => updatePrefs({ subtitleBg: value })}
                label="Фон под текстом"
                hint="Полупрозрачная плашка улучшает читаемость"
              />
            </SetBlock>

            <SetBlock
              icon={
                <>
                  <rect x="2" y="6" width="20" height="12" rx="2" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />
                </>
              }
              title="Горячие клавиши"
              hint="Всё, что можно сделать, не касаясь мыши"
            >
              <div className="ag-set-keys">
                {HOTKEYS.map((item) => (
                  <div key={item.id} className="ag-set-key">
                    <span>{item.title}</span>
                    <span>
                      {item.keys.map((key) => (
                        <kbd key={key}>{key}</kbd>
                      ))}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={prefs.keys[item.id]}
                      aria-label={item.title}
                      className={`ag-tg sm ${prefs.keys[item.id] ? "on" : ""}`}
                      onClick={() =>
                        updatePrefs({ keys: { ...prefs.keys, [item.id]: !prefs.keys[item.id] } })
                      }
                    >
                      <span />
                    </button>
                  </div>
                ))}
              </div>
              <p className="ag-set-hint">
                Клавиши работают на странице тайтла, когда фокус не в поле ввода.
              </p>
            </SetBlock>
          </div>
        )}

        {tab === "privacy" && (
          <div className="space-y-4">
            <SetBlock
              icon={
                <>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
                </>
              }
              title="Быстрая настройка"
              hint="Выберите готовый набор — точные настройки можно поправить ниже"
            >
              <div className="ag-set-opts">
                {SCOPES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`ag-set-op ${scope === item.id ? "on" : ""}`}
                    aria-pressed={scope === item.id}
                    onClick={() => setScope(item.id)}
                  >
                    <b>{item.title}</b>
                    <small>{item.hint}</small>
                    <i aria-hidden="true" />
                  </button>
                ))}
              </div>
              <p className="ag-set-hint">
                В «Приватном» заявки в друзья остаются включёнными: иначе новых друзей
                завести не выйдет, и уровень «Только друзья» станет недоступен.
              </p>
            </SetBlock>

            <SetBlock
              icon={
                <>
                  <circle cx="9" cy="8" r="4" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2 20c0-3.5 3-5.5 7-5.5M18 14v6M15 17h6" />
                </>
              }
              title="Друзья"
              hint="Кому открыт профиль на уровне «Только друзья»"
              aside={<span className="ag-set-st ok">{OK_ICON} {friends.length}</span>}
            >
              <div className="ag-set-rowform">
                <input
                  value={friendDraft}
                  onChange={(event) => setFriendDraft(event.target.value)}
                  placeholder="Никнейм друга"
                  aria-label="Никнейм друга"
                  maxLength={32}
                />
                <label className="ag-set-check">
                  <input
                    type="checkbox"
                    checked={friendMutual}
                    onChange={(event) => setFriendMutual(event.target.checked)}
                  />
                  взаимный
                </label>
                <button
                  type="button"
                  className="ag-set-btn"
                  onClick={() => {
                    const error = addFriend(friendDraft, friendMutual);
                    setFriendError(error);
                    if (!error) setFriendDraft("");
                  }}
                >
                  Добавить
                </button>
              </div>
              {friendError && <p className="ag-set-warn">{friendError}</p>}

              {friends.length === 0 ? (
                <div className="ag-set-empty">
                  <b>Друзей пока нет</b>
                  <small>
                    Добавьте никнейм — и при уровне «Только друзья» профиль будет виден ему,
                    а остальным нет.
                  </small>
                </div>
              ) : (
                <ul className="ag-set-list">
                  {friends.map((friend) => (
                    <li key={friend.nickname}>
                      <b>{friend.nickname}</b>
                      <span className="ag-w-sub">{friend.mutual ? "взаимный" : "односторонний"}</span>
                      <button
                        type="button"
                        className="ag-set-btn danger"
                        onClick={() => removeFriend(friend.nickname)}
                      >
                        Убрать
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="ag-set-hint">
                Заявки подтверждать некому — сервера у сайта нет, поэтому список ведётся вручную
                самим пользователем.
              </p>
            </SetBlock>

            <SetBlock
              icon={
                <>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
                  <circle cx="12" cy="12" r="3" />
                </>
              }
              title="Что видно в профиле"
              hint="Блоки, которые показываются посетителям вашей страницы"
            >
              <SetRow
                title="Профиль"
                hint="Кто может открыть вашу страницу"
              >
                <select
                  className="ag-set-in sm"
                  value={scope}
                  onChange={(event) => setScope(event.target.value as "public" | "friends" | "private")}
                  aria-label="Кто видит профиль"
                >
                  <option value="public">Публичный</option>
                  <option value="friends">Только друзья</option>
                  <option value="private">Приватный</option>
                </select>
              </SetRow>
              <Toggle
                checked={profile.privacy.profilePublic}
                onChange={(value) => setScope(value ? "public" : "private")}
                label="Профиль по ссылке"
                hint="Ссылку на страницу можно передавать другим"
              />
              <Toggle
                checked={profile.privacy.showStats}
                onChange={(value) => updateProfile({ privacy: { ...profile.privacy, showStats: value } })}
                label="Статистика"
                hint="Минуты просмотра, тайтлы и серии в разделе «Основное»"
              />
              <Toggle
                checked={profile.privacy.showHistory}
                onChange={(value) => updateProfile({ privacy: { ...profile.privacy, showHistory: value } })}
                label="История просмотров"
                hint="Последние открытые серии в публичном профиле"
              />
              <Toggle
                checked={profile.privacy.showAchievements}
                onChange={(value) => updateProfile({ privacy: { ...profile.privacy, showAchievements: value } })}
                label="Достижения"
                hint="Список открытых наград в публичном профиле"
              />
              <Toggle
                checked={profile.privacy.showComments}
                onChange={(value) => updateProfile({ privacy: { ...profile.privacy, showComments: value } })}
                label="Комментарии к профилю"
                hint="Записи, которые другие оставляют на вашей стене"
              />
              <Toggle
                checked={profile.privacy.acceptFriends}
                onChange={(value) => updateProfile({ privacy: { ...profile.privacy, acceptFriends: value } })}
                label="Заявки в друзья"
                hint="Могут ли другие добавлять вас в друзья"
              />
              <p className="ag-set-hint">Настройки приватности сохраняются автоматически.</p>
            </SetBlock>
          </div>
        )}

        {tab === "subscription" && (
          <div className="space-y-4">
            <SetBlock
              icon={
                <>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 8.5 8 11.5 12 5l4 6.5 3.5-3-1.5 9.5h-12z" />
                </>
              }
              title="Ваша подписка"
              hint={premium ? "Спасибо, что поддерживаете AniGalaxy!" : "Подписка открывает рамки, титулы и привилегии"}
              aside={
                <span className={`ag-set-st ${premium ? "gold" : "warn"}`}>
                  {premium ? "PREMIUM" : "! Не подключён"}
                </span>
              }
            >
              <SetRow
                icon={
                  <>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 8.5 8 11.5 12 5l4 6.5 3.5-3-1.5 9.5h-12z" />
                  </>
                }
                title={premium ? "Подписка активна" : "Подписки нет"}
                hint={
                  premium && account?.premiumUntil
                    ? `Действует до ${new Date(account.premiumUntil).toLocaleDateString("ru-RU")}`
                    : "Подписка открывает рамки, титулы и расширенные возможности"
                }
              >
                <span className="ag-set-note">
                  {account?.premiumUntil
                    ? new Date(account.premiumUntil).toLocaleDateString("ru-RU")
                    : "—"}
                </span>
              </SetRow>
              <div className="ag-set-acts">
                <Link
                  href="/premium"
                  onClick={closeProfileDialog}
                  className="btn-premium glow-ring flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold"
                >
                  {premium ? "Продлить подписку" : "Оформить Premium"}
                </Link>
              </div>
              <p className="ag-set-hint">
                Аккаунт и подписка хранятся только в этом браузере — платёжных систем у сайта нет.
              </p>
            </SetBlock>

            <SetBlock
              icon={
                <>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5" />
                </>
              }
              title="История платежей"
              hint="Покупки в магазине и операции с подпиской"
            >
              {payments.length === 0 ? (
                <div className="ag-set-empty">
                  <b>Пока нет платежей</b>
                  <small>Здесь появятся покупки Premium и купленные предметы</small>
                </div>
              ) : (
                <ul className="ag-set-list">
                  {payments.slice(0, 12).map((item) => (
                    <li key={item.id}>
                      <b>{item.title}</b>
                      <span className="ag-w-sub">{new Date(item.at).toLocaleDateString("ru-RU")}</span>
                      <span className="ag-set-sum">{item.amount}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="ag-set-hint">
                Платёжных систем у сайта нет, поэтому здесь не чеки, а операции из этого
                браузера: покупки предметов и покупки Premium.
              </p>
            </SetBlock>

            <SetBlock
              icon={
                <>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
                </>
              }
              title="СБП — подарок к подписке"
              hint="Система безопасного подключения — бесплатно на весь срок подписки"
            >
              <p className="ag-set-pt">
                Система безопасного подключения выдаётся при оплате подписки и активируется
                автоматически в течение нескольких минут. Если вы уже оплатили, а ссылка
                не появилась — напишите в поддержку.
              </p>
              <div className="ag-set-acts">
                <Link
                  href="/premium"
                  onClick={closeProfileDialog}
                  className="btn-premium glow-ring flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold"
                >
                  Оформить подписку
                </Link>
              </div>
            </SetBlock>
          </div>
        )}

        {tab === "data" && (
          <div className="space-y-4">
            <SetBlock
              icon={
                <>
                  <rect x="3" y="4" width="18" height="12" rx="2" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8M12 16v5" />
                </>
              }
              title="Активные сессии"
              hint="Устройства, на которых выполнен вход в аккаунт"
              aside={<span className="ag-set-st ok">{OK_ICON} {sessions.length}</span>}
            >
              {sessions.map((session) => (
                <SetRow
                  key={session.id}
                  icon={
                    <>
                      <rect x="3" y="4" width="18" height="12" rx="2" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8M12 16v5" />
                    </>
                  }
                  title={`${session.browser} · ${session.os}`}
                  hint={session.current ? "Сейчас онлайн · это устройство" : `Был ${timeAgo(session.at)}`}
                >
                  <span className="ag-set-note">{session.current ? "Это устройство" : ""}</span>
                </SetRow>
              ))}
              <p className="ag-set-hint">
                Сессии различаются на сервере, а сервера нет — здесь всегда одна строка,
                это устройство. «Выйти на всех остальных» означала бы обещание, которое
                механизм не выполняет, поэтому её нет.
              </p>
            </SetBlock>

            <SetBlock
              icon={
                <>
                  <ellipse cx="12" cy="6.5" rx="7" ry="3" />
                  <path strokeLinecap="round" d="M5 6.5v11c0 1.7 3.1 3 7 3s7-1.3 7-3v-11" />
                  <path strokeLinecap="round" d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />
                </>
              }
              title="Данные и перенос"
              hint="Профиль, прогресс, покупки, история и чат хранятся в этом браузере"
              aside={<span className="ag-set-st ok">{OK_ICON} Ключей: {stats.count}</span>}
            >
              <p className="ag-set-hint">
                Объём базы: {(stats.bytes / 1024).toFixed(1).replace(".", ",")} КБ. Экспорт упакует всё в один
                JSON-файл — импорт вернёт данные обратно, даже на другом устройстве.
              </p>

              <div className="ag-set-acts">
                <button type="button" onClick={onExport} className="ag-set-btn">
                  Экспорт бэкапа (.json)
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="ag-set-btn"
                >
                  Импорт из файла
                </button>
                {canRollback && (
                  <button type="button" onClick={onRollback} className="ag-set-btn">
                    Откатить последний импорт
                  </button>
                )}
              </div>

              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                aria-hidden
                tabIndex={-1}
                onChange={onImportFile}
              />

              <p className="ag-set-hint">
                Импорт заменяет данные сайта на содержимое файла, а текущее состояние
                перед этим сохраняется в снимок — «Откатить последний импорт» вернёт его.
              </p>
            </SetBlock>

            <SetBlock
              icon={
                <>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l10 18H2zM12 10v5M12 18v.5" />
                </>
              }
              title="Опасная зона"
              hint="Эти действия нельзя отменить"
            >
              <SetRow
                icon={
                  <>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l10 18H2zM12 10v5M12 18v.5" />
                  </>
                }
                title="Очистить историю просмотров"
                hint="Список аниме, оценки и прогресс останутся"
              >
                <button
                  type="button"
                  onClick={clearWatchHistory}
                  className="ag-set-btn danger"
                >
                  Очистить
                </button>
              </SetRow>
              <SetRow
                icon={
                  <>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l10 18H2zM12 10v5M12 18v.5" />
                  </>
                }
                title="Удалить аккаунт"
                hint="Профиль, прогресс и косметика будут удалены навсегда"
              >
                <button
                  type="button"
                  className="ag-set-btn danger solid"
                  onClick={() => {
                    setMessage(null);
                    closeProfileDialog();
                    openProfileDialog("erase");
                  }}
                >
                  Удалить
                </button>
              </SetRow>
              <p className="ag-set-hint">
                Удаление стирает все ключи этого браузера. Восстановить данные после него
                можно только импортом бэкапа — поэтому перед удалением имеет смысл
                выгрузить копию.
              </p>
            </SetBlock>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Модалка подтверждения удаления.
 *
 * Отдельная от панели, потому что действие необратимо: подтверждение
 * вводом фразы не должно стоять рядом с кнопкой «Экспорт», где её
 * легко нажать по привычке. Пока фраза не совпадает, кнопка неактивна.
 */
function EraseAccountDialog() {
  const [phrase, setPhrase] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const ok = phrase.trim().toUpperCase() === ERASE_PHRASE;

  const erase = useCallback(() => {
    const removed = eraseAccountData();
    setResult(`Удалено ключей: ${removed}. Страница обновится.`);
    // Перезагрузка обязательна: часть сторов держит снимок в памяти, и без
    // неё на экране остались бы данные, которых на диске уже нет
    setTimeout(() => window.location.reload(), 900);
  }, []);

  return (
    <DialogShell title="Удалить аккаунт" subtitle="Действие необратимо" onClose={closeProfileDialog}>
      <div className="space-y-3">
        <Note tone="error">
          Будут стёрты профиль, прогресс, покупки, история просмотров, списки и все
          настройки этого браузера. Восстановление — только из бэкапа.
        </Note>

        {result ? (
          <Note tone="ok">{result}</Note>
        ) : (
          <>
            <label className="ag-set-fl">
              <span className="ag-set-lb">
                Введите <b>{ERASE_PHRASE}</b>, чтобы подтвердить
              </span>
              <input
                value={phrase}
                onChange={(event) => setPhrase(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                aria-label="Подтверждение удаления"
              />
            </label>
            <div className="ag-set-acts">
              <button type="button" disabled={!ok} onClick={erase} className="ag-set-btn danger solid">
                Удалить навсегда
              </button>
              <button type="button" className="ag-set-btn" onClick={closeProfileDialog}>
                Отмена
              </button>
            </div>
          </>
        )}
      </div>
    </DialogShell>
  );
}

/** Модалка настроек: та же панель, но со своей историей вкладок и прокруткой */
function SettingsDialog() {
  const [tab, setTab] = useState<SettingsTab>("profile");
  return (
    <DialogShell title="Настройки" subtitle="Всё локальное: данные не покидают этот браузер" onClose={closeProfileDialog} wide>
      <SettingsPanel tab={tab} onTabChange={setTab} inDialog />
    </DialogShell>
  );
}

/* ------------------------------- Поделиться ----------------------------- */

function ShareDialog() {
  const account = useAccount();
  const [copied, setCopied] = useState<boolean | null>(null);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const link = account ? `${origin}/u/${encodeURIComponent(account.nickname)}` : `${origin}/profile`;

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }, [link]);

  return (
    <DialogShell title="Поделиться профилем" subtitle={account ? `@${account.nickname.toLowerCase()}` : undefined} onClose={closeProfileDialog}>
      <div className="flex gap-2">
        <input
          readOnly
          value={link}
          onFocus={(event) => event.target.select()}
          className="min-w-0 flex-1 rounded-xl bg-card px-3 py-2.5 font-mono text-xs text-white ring-1 ring-white/10 focus:outline-none focus:ring-accent/60"
        />
        <button type="button" onClick={() => void copy()} className="btn-primary shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold text-white">
          Копировать
        </button>
      </div>

      {copied === true && <Note tone="ok">Ссылка скопирована</Note>}
      {copied === false && (
        <Note tone="error">
          Не удалось скопировать — скопируйте вручную: {link}
        </Note>
      )}

      <Note>
        {account
          ? "Ссылка открывает публичный профиль на AniGalaxy. Что на нём видно, зависит от настроек приватности."
          : "Войдите в аккаунт — тогда появится публичная ссылка на ваш профиль."}
      </Note>
    </DialogShell>
  );
}

/* --------------------------- Как видят другие --------------------------- */

function PreviewDialog() {
  const profile = useProfile();
  const account = useAccount();
  const ctx = useUnlockContext();

  const nickname = account?.nickname ?? "Гость";
  const doc = useProgress();
  const unlockedCount = Object.values(doc.achievements).filter((item) => item.unlockedAt > 0).length;
  const frame = FRAMES.find((item) => item.id === profile.frameId);
  const title = TITLES.find((item) => item.id === profile.titleId);
  const signature = groupSignature(profile.signature || "CAFEBABE");
  const bgItem = BACKGROUNDS.find((b) => b.id === profile.backgroundId) ?? BACKGROUNDS[0];
  const equippedTag = PROGRESSION_CONFIG.tags.find((item) => item.id === doc.progress.equippedTagId);
  const extraTags = profile.extraTagIds
    .map((id) => PROGRESSION_CONFIG.tags.find((item) => item.id === id))
    .filter((item): item is (typeof PROGRESSION_CONFIG.tags)[number] => Boolean(item));
  const extraTitles = profile.extraTitleIds
    .map((id) => TITLES.find((item) => item.id === id))
    .filter((item): item is (typeof TITLES)[number] => Boolean(item));
  /**
   * Блок уровня с эмблемой показываем всем — ровно как на «Основном».
   * Раньше он открывался только купившим услугу `svc_levelcard`, но в самом
   * профиле блок и так виден бесплатно: предпросмотр расходился с реальной
   * страницей и показывал гостю меньше, чем он увидит на самом деле.
   */

  return (
    <DialogShell
      title="Предпросмотр профиля"
      subtitle="Так вас видят другие пользователи"
      onClose={closeProfileDialog}
      full
    >
      <div className="overflow-hidden rounded-2xl border border-line">
        <div
          className="h-24 w-full"
          style={
            profile.backgroundCustom
              ? customBannerStyle(profile)
              : { backgroundImage: bgItem.css, backgroundSize: bgItem.backgroundSize ?? "auto" }
          }
        />
        <div className="-mt-8 px-4 pb-4">
          <AvatarFrame
  nickname={nickname}
  avatar={profile.avatar || undefined}
  frame={frame}
  size="md"
/>
          <p className="mt-2 truncate text-xl font-black text-white">{nickname}</p>
          <p className="truncate text-xs text-muted">@{nickname.toLowerCase()}</p>

          {/* Плашки «PREMIUM / УРОВЕНЬ N / эра» убраны: ниже стоит блок
              уровня, где уровень и эра уже показаны полными словами с
              полосой прогресса. Дубль в двух видах путал. */}

          {(equippedTag || title) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {equippedTag && <AgTag tag={equippedTag} size="md" className="pf-badge" />}
              {title && <AgTag tag={titleTag(title)} size="md" className="pf-badge" />}
            </div>
          )}

          {profile.bio && <p className="mt-3 text-sm leading-relaxed text-white/85">{profile.bio}</p>}

          {/* Блок уровня: тот же, что на «Основном», — без покупки */}
          <div className="mt-3" data-preview-level-card="">
            <LevelCard />
          </div>

          {/* Витрина виджетов — тоже как на «Основном»: предпросмотр должен
              показывать ровно то, что увидит гость, иначе он не поймёт, как
              он выглядит. `ag-root` обязателен — оформление виджетов в
              ag-theme.css привязано к нему, и без него блоки выходят голыми. */}
          <div className="ag-root mt-3" data-preview-widgets="">
            <WidgetShowcase readOnly />
          </div>

          <div className="mt-3 flex flex-wrap gap-1 font-mono text-[10px] tracking-[0.18em] text-muted">
            {signature.map((group) => (
              <span key={group}>{group}</span>
            ))}
          </div>

          {profile.privacy.showStats && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-white/[0.04] px-2 py-2 text-center">
                <p className="text-sm font-black text-white">{profile.showcase.length}</p>
                <p className="text-[10px] text-muted">на витрине</p>
              </div>
              <div className="rounded-lg bg-white/[0.04] px-2 py-2 text-center">
                <p className="text-sm font-black text-white">{unlockedCount}</p>
                <p className="text-[10px] text-muted">наград</p>
              </div>
              <div className="rounded-lg bg-white/[0.04] px-2 py-2 text-center">
                <p className="text-sm font-black text-white">{doc.progress.xpTotal}</p>
                <p className="text-[10px] text-muted">XP</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <Note>
        {profile.privacy.profilePublic
          ? "Профиль публичный — ссылку можно передавать."
          : "Профиль скрыт настройками приватности."}{" "}
        Предметы открыты: {ctx.purchased.length} куплено за AC.{" "}
        {/* Быстрый просмотр остаётся здесь, а отдельная страница нужна для
            длинного содержимого: в диалоге страница обрезана по высоте. */}
        <Link
          href="/u/me"
          className="font-bold text-accent-2 underline underline-offset-2 hover:text-white"
        >
          Открыть гостевую страницу целиком
        </Link>
      </Note>
    </DialogShell>
  );
}

/* ------------------------------- Хост ----------------------------------- */

/**
 * «История XP и AC» (§12.5): журнал USER_REWARDS_LOG — что, когда и за что.
 * Только чтение: отмены делаются движком отдельной записью (`reversesId`).
 */
function RewardsDialog() {
  const doc = useProgress();
  const entries = [...doc.ledger].sort((a, b) => b.createdAt - a.createdAt);

  const confirmed = doc.ledger.filter((entry) => entry.status !== "reversed");
  const earnedXp = confirmed
    .filter((entry) => entry.currency === "XP" && entry.amount > 0)
    .reduce((sum, entry) => sum + entry.amount, 0);
  const earnedAc = confirmed
    .filter((entry) => entry.currency === "AC" && entry.amount > 0)
    .reduce((sum, entry) => sum + entry.amount, 0);
  const spentAc = confirmed
    .filter((entry) => entry.currency === "AC" && entry.amount < 0)
    .reduce((sum, entry) => sum - entry.amount, 0);

  const totals = [
    { label: "получено XP", value: `+${earnedXp}`, tone: "text-accent-2" },
    { label: "получено AC", value: `+${earnedAc}`, tone: "text-accent-2" },
    { label: "потрачено AC", value: `−${spentAc}`, tone: "text-muted" },
  ];

  return (
    <DialogShell title="История XP и AC" subtitle="Журнал наград: что, когда и за что" onClose={closeProfileDialog} wide>
      <div className="grid grid-cols-3 gap-2">
        {totals.map((item) => (
          <div key={item.label} className="rounded-xl bg-white/[0.04] px-3 py-2 text-center">
            <p className={`text-sm font-black ${item.tone}`}>{item.value}</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-muted">{item.label}</p>
          </div>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-line px-5 py-8 text-center">
          <p className="text-sm font-bold text-white">Записей пока нет</p>
          <p className="mt-1 text-xs text-muted">Награды появятся здесь сразу после первого события.</p>
        </div>
      ) : (
        <ul className="mt-4 max-h-[52vh] space-y-1.5 overflow-y-auto pr-1">
          {entries.map((entry) => {
            const reversed = entry.status === "reversed";
            const reason = entry.metadata?.reason;
            return (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] px-3 py-2 ring-1 ring-white/[0.06]"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-white">
                    {typeLabel(entry.type)}
                    {entry.source !== entry.type ? ` · ${sourceLabel(entry.source)}` : ""}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-muted">
                    {new Date(entry.createdAt).toLocaleString("ru-RU", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {reversed ? " · отменено" : ""}
                    {typeof reason === "string" && reason ? ` · ${reason}` : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-xs font-black ${
                    reversed
                      ? "text-muted line-through"
                      : entry.amount < 0
                        ? "text-white/70"
                        : entry.currency === "AC"
                          ? "text-accent-2"
                          : "text-mint"
                  }`}
                >
                  {amountLabel(entry.currency, entry.amount)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </DialogShell>
  );
}

/**
 * Единая точка модалок профиля.
 *
 * Рендерится через портал в `document.body`: хост смонтирован в шапке, а у
 * шапки всегда есть `backdrop-filter` (blur). По спецификации такой элемент
 * становится containing block для `position: fixed` потомков — из-за этого
 * `fixed inset-0` привязывался к полоске шапки высотой 64px, и окна
 * уезжали выше экрана (видна была только кромка). Портал в body даёт
 * модалкам собственный stacking context на верхнем уровне документа.
 */
export function ProfileDialogHost() {
  const state = useProfileDialog();
  if (!state.open || typeof document === "undefined") return null;

  let dialog: React.ReactNode = null;
  switch (state.kind) {
    case "background":
      dialog = <BackgroundDialog />;
      break;
    case "title":
      dialog = <TitleDialog />;
      break;
    case "appearance":
      dialog = <AppearanceDialog />;
      break;
    case "effects":
      dialog = <EffectsDialog />;
      break;
    case "avatar":
      dialog = <AvatarDialog />;
      break;
    case "theme":
      dialog = <ThemeDialog />;
      break;
    case "settings":
      dialog = <SettingsDialog />;
      break;
    case "share":
      dialog = <ShareDialog />;
      break;
    case "preview":
      dialog = <PreviewDialog />;
      break;
    case "rewards":
      dialog = <RewardsDialog />;
      break;
    case "erase":
      dialog = <EraseAccountDialog />;
      break;
    default:
      dialog = null;
  }

  if (!dialog) return null;
  return createPortal(dialog, document.body);
}
