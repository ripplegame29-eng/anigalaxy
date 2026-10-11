"use client";

import Link from "next/link";
import { useCallback, useSyncExternalStore, useRef, useState } from "react";
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
  groupSignature,
} from "@/lib/profile";
import {
  BACKGROUNDS,
  FRAMES,
  TITLES,
  RARITY_LABEL,
  RARITY_CLASS,
  isUnlocked,
  titleTag,
  type Rarity,
  type UnlockContext,
} from "@/lib/cosmetics";
import { IMAGE_LIMITS, readImageFile } from "@/lib/images";
import {
  exportBackup,
  hasPreimport,
  importBackup,
  parseBackup,
  rollbackImport,
  storageStats,
} from "@/lib/backup";
import { isPremiumActive } from "@/lib/auth";
import { progressEmit, useLevelInfo, useProgress } from "@/lib/progression/events";
import { useTagSelection, useTitleSelection } from "@/lib/selection";
import { amountLabel, sourceLabel, typeLabel } from "@/lib/progression/labels";
import { PROGRESSION_CONFIG } from "@/lib/progression/progression.config";
import { CFG_RARITY_CLASS, CFG_RARITY_LABEL } from "@/lib/progression/rarity-chips";
import { AgTag } from "@/components/progression/AgTag";
import { useAccount } from "@/lib/use-account";
import { useModalBehaviour } from "@/lib/use-local-storage";
import { cpuCores, ecoActive, ecoStore, setEco, weakCpu, type EcoMode } from "@/lib/eco";
import { AvatarView } from "./AvatarView";

/* --------------------------- Каркас модалки ----------------------------- */

function DialogShell({
  title,
  subtitle,
  onClose,
  wide = false,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  wide?: boolean;
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
          wide ? "max-w-3xl" : "max-w-md"
        } overflow-hidden rounded-2xl border border-line bg-surface/95 p-5 shadow-[0_40px_100px_-30px_rgba(0,0,0,1)] ring-1 ring-white/10 outline-none animate-fade-in`}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-extrabold tracking-tight text-white">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="-m-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted ring-1 ring-transparent transition hover:bg-white/10 hover:text-white hover:ring-white/10"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        {children}
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
  return {
    level: useLevelInfo().level,
    premium: isPremiumActive(account),
    claimed: profile.claimed,
    purchased: profile.purchased,
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

/* ----------------------------- Смена фона ------------------------------- */

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
    updateProfile({ backgroundId: "custom", backgroundCustom: result.data });
    setMessage({ text: "Свой фон применён", tone: "ok" });
  }, []);

  return (
    <DialogShell title="Изменить фон" subtitle="Баннер вверху страницы профиля" onClose={closeProfileDialog}>
      <FilePicker label="Загрузить свой" onFile={(file) => void onFile(file)} />

      {message && <Note tone={message.tone}>{message.text}</Note>}

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
                    {item.unlock.price ? `${item.unlock.price} монет` : `уровень ${item.unlock.level ?? "?"}`}
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
        <span className="text-xs text-muted">Пресеты открываются по уровню и монетам</span>
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
                        ? `${item.unlock.price} монет`
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

type WardrobeTab = "tag" | "background" | "title" | "frame" | "avatar";

const WARDROBE_TABS: { id: WardrobeTab; label: string }[] = [
  { id: "tag", label: "Теги" },
  { id: "background", label: "Фоны" },
  { id: "title", label: "Титулы" },
  { id: "frame", label: "Рамки" },
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
  if (tag.source === "achievement" || tag.source === "secret") {
    const achievement = PROGRESSION_CONFIG.achievements.find(
      (item) => item.id === tag.achievementId,
    );
    if (!achievement) return "Тайный знак";
    return achievement.hidden ? "За «???»" : `За «${achievement.name}»`;
  }
  return "Событие";
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
    updateProfile({ avatar: result.data });
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
    >
      {/* Примерочная */}
      <div className="rounded-2xl border border-line bg-gradient-to-b from-accent/12 to-transparent p-4">
        <div className="flex items-center gap-3">
          <AvatarView
            nickname={nickname}
            avatar={profile.avatar || undefined}
            frameCss={frame?.css}
            frameImg={frame?.img}
            className="h-14 w-14"
            textClass="text-base"
          />
          <div className="min-w-0">
            <p className="truncate text-lg font-black text-white">{nickname}</p>
            <p className="truncate text-xs text-muted">@{nickname.toLowerCase()}</p>
            {/* выбранные теги и титулы: основной — крупный, остальные — sm,
                служебные чипы строкой ниже */}
            {(equippedTag || extraTags.length > 0 || title || extraTitles.length > 0) && (
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {equippedTag && <AgTag tag={equippedTag} size="md" />}
                {extraTags.map((item) => (
                  <AgTag key={item.id} tag={item} size="sm" />
                ))}
                {title && <AgTag tag={titleTag(title)} size="sm" />}
                {extraTitles.map((item) => (
                  <AgTag key={item.id} tag={titleTag(item)} size="sm" />
                ))}
              </div>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="rounded-md bg-accent-2/15 px-1.5 py-0.5 text-[10px] font-black text-accent-2">
                УРОВЕНЬ {level.level}
              </span>
              <span className="rounded-md bg-white/8 px-1.5 py-0.5 text-[10px] font-bold text-muted">{level.era}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Категории */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-xl bg-white/6 p-1 ring-1 ring-white/10">
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
          <div className="ml-auto flex gap-1 rounded-xl bg-white/6 p-1 ring-1 ring-white/10">
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
      <div className="mt-3 max-h-[46vh] overflow-y-auto pr-1">
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

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {BACKGROUNDS.filter((item) => passRarity(item.rarity)).map((item) => {
              const owned = isUnlocked(item.unlock, ctx);
              const active = profile.backgroundId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!owned}
                  onClick={() => updateProfile({ backgroundId: item.id, backgroundCustom: "" })}
                  className={`overflow-hidden rounded-xl text-left ring-1 transition disabled:cursor-not-allowed disabled:opacity-45 ${
                    active ? "ring-2 ring-accent-2" : "ring-white/12 hover:ring-white/35"
                  }`}
                >
                  <span className="block h-20 w-full" style={{ background: item.css }} />
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
          <div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TITLES.filter((item) => passRarity(item.rarity)).map((item) => {
                const owned = isUnlocked(item.unlock, ctx);
                const main = titleSel.primary === item.id;
                const extra = titleSel.extras.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={!owned}
                    onClick={() => titleSel.toggle(item, owned)}
                    className={`flex flex-col items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-3 text-center ring-1 transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      main ? "ring-2 ring-accent-2" : extra ? "ring-2 ring-mint/60" : "ring-white/10 hover:ring-white/30"
                    }`}
                  >
                    <AgTag tag={titleTag(item)} size="md" locked={!owned} />
                    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ring-1 ${RARITY_CLASS[item.rarity]}`}>
                      {main ? "Основной" : extra ? "Выбран ✓" : RARITY_LABEL[item.rarity]}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Титулы тоже носятся по несколько: первый выбранный — основной, остальные
              показываются рядом с ним. Повторный клик снимает.
            </p>
          </div>
        )}

        {tab === "frame" && (
          <div className="grid grid-cols-3 gap-2">
            {FRAMES.filter((item) => passRarity(item.rarity)).map((item) => {
              const owned = isUnlocked(item.unlock, ctx);
              const active = profile.frameId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!owned}
                  onClick={() => updateProfile({ frameId: item.id })}
                  className={`flex flex-col items-center gap-2 rounded-xl bg-white/[0.04] px-2 py-3 ring-1 transition disabled:cursor-not-allowed disabled:opacity-45 ${
                    active ? "ring-2 ring-accent-2" : "ring-white/10 hover:ring-white/30"
                  }`}
                >
                  <AvatarView nickname={nickname} avatar={profile.avatar || undefined} frameCss={item.css} frameImg={item.img} className="h-12 w-12" textClass="text-sm" />
                  <span className="truncate text-[11px] font-bold text-white">{item.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
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
          Магазин за монеты
        </Link>
      </div>
    </DialogShell>
  );
}

/* ------------------------------ Настройки ------------------------------- */

export type SettingsTab = "profile" | "looks" | "privacy" | "subscription" | "data";

export const SETTINGS_TABS: { id: SettingsTab; label: string; description: string }[] = [
  { id: "profile", label: "Профиль", description: "Описание, hex-подпись и аккаунт" },
  { id: "looks", label: "Внешний вид", description: "Фото, баннер, витрина и анимации" },
  { id: "privacy", label: "Приватность", description: "Кто видит профиль, статистику и историю" },
  { id: "subscription", label: "Подписка", description: "Premium и его привилегии" },
  { id: "data", label: "Данные", description: "Экспорт и импорт локальной базы" },
];

/** Режим «экономия» (§14): ручной выбор переопределяет автоматику по ядрам */
const ECO_OPTIONS: { id: EcoMode; label: string }[] = [
  { id: "auto", label: "Авто" },
  { id: "on", label: "Всегда" },
  { id: "off", label: "Выкл" },
];

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
    <div className="flex items-start justify-between gap-4 rounded-xl bg-white/[0.03] px-3.5 py-3">
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
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-accent" : "bg-white/12"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${checked ? "left-[22px]" : "left-0.5"}`}
        />
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
  const [draftBio, setDraftBio] = useState(profile.bio);
  const [draftSignature, setDraftSignature] = useState(profile.signature);
  const [message, setMessage] = useState<string | null>(null);

  const premium = isPremiumActive(account);
  const initials = account?.nickname.slice(0, 2).toUpperCase() ?? "";

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
    updateProfile({ backgroundId: "custom", backgroundCustom: result.data });
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

  /** Снимок хранилища для карточки «Ключей/объём» — меняется только после импорта (reload) */
  const [stats] = useState(() => storageStats());
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
            <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3.5 py-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-accent to-accent-2 text-xs font-black text-white">
                {initials}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-white">{account?.nickname}</span>
                <span className="block truncate text-xs text-muted">{account?.email}</span>
              </span>
            </div>

            <div>
              <label htmlFor="bio" className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-muted">
                О себе
              </label>
              <textarea
                id="bio"
                value={draftBio}
                onChange={(event) => setDraftBio(event.target.value)}
                maxLength={300}
                rows={3}
                placeholder="Пара слов о вкусах и настроении"
                className="w-full resize-none rounded-xl bg-card px-3 py-2.5 text-sm text-white ring-1 ring-white/10 transition placeholder:text-muted/60 focus:outline-none focus:ring-accent/60"
              />
              <p className="mt-1 text-right text-[11px] text-muted">{draftBio.length}/300</p>
            </div>

            <div>
              <label htmlFor="signature" className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-muted">
                Hex-подпись
              </label>
              <input
                id="signature"
                value={draftSignature}
                onChange={(event) => setDraftSignature(event.target.value)}
                maxLength={32}
                spellCheck={false}
                placeholder="Пусто — будет сгенерирована автоматически"
                className="w-full rounded-xl bg-card px-3 py-2.5 font-mono text-sm uppercase tracking-[0.2em] text-white ring-1 ring-white/10 transition placeholder:normal-case placeholder:tracking-normal placeholder:text-muted/60 focus:outline-none focus:ring-accent/60"
              />
            </div>

            <button type="button" onClick={save} className="btn-primary rounded-xl px-5 py-2.5 text-sm font-bold text-white">
              Сохранить
            </button>
          </div>
        )}

        {tab === "looks" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-line bg-white/[0.02] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Фото профиля</p>
              <p className="mt-1 text-xs text-muted">Рекомендуется 400×400 px · GIF поддерживаются</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <FilePicker label={profile.avatar ? "Заменить" : "Выбрать файл"} onFile={(file) => void onAvatar(file)} />
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
              <p className="mt-2 text-[11px] text-muted">Макс. {IMAGE_LIMITS.avatar} МБ · JPEG, PNG, WebP, GIF</p>
            </div>

            <div className="rounded-xl border border-line bg-white/[0.02] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Баннер профиля</p>
              <p className="mt-1 text-xs text-muted">Отображается вверху страницы · рекомендуется 1200×400 px</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <FilePicker label={profile.backgroundCustom ? "Заменить" : "Выбрать файл"} onFile={(file) => void onBanner(file)} />
                {profile.backgroundCustom && (
                  <button
                    type="button"
                    onClick={() => updateProfile({ backgroundId: "preset-dusk", backgroundCustom: "" })}
                    className="btn-ghost rounded-xl bg-white/8 px-3.5 py-2.5 text-sm font-semibold text-rose-300 ring-1 ring-white/12 hover:bg-rose-400/12"
                  >
                    Снять
                  </button>
                )}
              </div>
              <p className="mt-2 text-[11px] text-muted">Макс. {IMAGE_LIMITS.background} МБ · JPEG, PNG, WebP, GIF</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openProfileDialog("appearance")}
                className="btn-ghost rounded-xl bg-white/8 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/12 hover:bg-white/14"
              >
                Открыть витрину
              </button>
              <button
                type="button"
                onClick={() => openProfileDialog("title")}
                className="btn-ghost rounded-xl bg-white/8 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/12 hover:bg-white/14"
              >
                Выбрать титул
              </button>
            </div>

            <div className="rounded-xl border border-line bg-white/[0.02] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Режим экономии</p>
              <p className="mt-1 text-xs text-muted">
                Гасит декоративные анимации — как системная настройка «уменьшить движение». Автоматика включает его на
                машинах с 4 ядрами и меньше{cpuCores() > 0 ? ` (ваша: ${cpuCores()})` : ""}.
              </p>
              <div className="mt-3 flex flex-wrap gap-1 rounded-xl bg-white/6 p-1 ring-1 ring-white/10">
                {ECO_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setEco(option.id)}
                    aria-pressed={eco === option.id}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      eco === option.id ? "bg-accent-deep text-white" : "text-muted hover:text-white"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted" data-eco-status>
                Сейчас: {ecoActive() ? "экономия включена, анимации сокращены" : "полные анимации"}
                {eco === "auto" ? (weakCpu() ? " · по автоматике" : " · автоматика не сработала") : " · вручную"}
              </p>
            </div>
          </div>
        )}

        {tab === "privacy" && (
          <div className="space-y-2">
            <Toggle
              checked={profile.privacy.profilePublic}
              onChange={(value) => updateProfile({ privacy: { ...profile.privacy, profilePublic: value } })}
              label="Публичный профиль"
              hint="Ссылку на профиль можно передавать другим"
            />
            <Toggle
              checked={profile.privacy.showStats}
              onChange={(value) => updateProfile({ privacy: { ...profile.privacy, showStats: value } })}
              label="Показывать статистику"
              hint="Минуты просмотра, тайтлы и серии в разделе «Основное»"
            />
            <Toggle
              checked={profile.privacy.showAchievements}
              onChange={(value) => updateProfile({ privacy: { ...profile.privacy, showAchievements: value } })}
              label="Показывать достижения"
              hint="Список открытых наград в публичном профиле"
            />
            <Toggle
              checked={profile.privacy.showHistory}
              onChange={(value) => updateProfile({ privacy: { ...profile.privacy, showHistory: value } })}
              label="Показывать историю"
              hint="Последние открытые серии в публичном профиле"
            />
            <p className="!mt-3 text-xs leading-relaxed text-muted">
              Настройки действуют только для предпросмотра «Как видят другие»: сайта-сервера нет,
              поэтому реальным гостям показывать профиль некому.
            </p>
          </div>
        )}

        {tab === "subscription" && (
          <div className="space-y-3">
            <div className={`rounded-xl border px-4 py-3 ${premium ? "border-gold/40 bg-gold/10" : "border-line bg-white/[0.03]"}`}>
              <p className={`text-sm font-extrabold ${premium ? "text-gold" : "text-white"}`}>
                {premium ? "Premium активен" : "Premium не подключён"}
              </p>
              <p className="mt-1 text-xs text-muted">
                {premium && account?.premiumUntil
                  ? `Действует до ${new Date(account.premiumUntil).toLocaleDateString("ru-RU")}`
                  : "Подписка открывает рамки, титулы и расширенные возможности"}
              </p>
            </div>
            <Link
              href="/premium"
              onClick={closeProfileDialog}
              className="btn-premium glow-ring flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold"
            >
              {premium ? "Продлить подписку" : "Оформить Premium"}
            </Link>
            <p className="text-xs leading-relaxed text-muted">
              Аккаунт и подписка хранятся только в этом браузере — это демо-режим без сервера.
            </p>
          </div>
        )}

        {tab === "data" && (
          <div className="space-y-3">
            <div className="rounded-xl border border-line bg-white/[0.03] px-4 py-3">
              <p className="text-sm font-extrabold text-white">Локальная база данных</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Профиль, прогресс, покупки, история и чат хранятся в этом браузере.
                Экспорт упакует всё в один JSON-файл — импорт вернёт данные обратно,
                даже на другом устройстве.
              </p>
              <p className="mt-2 text-[11px] font-bold text-muted">
                Ключей: {stats.count} · объём:{" "}
                {(stats.bytes / 1024).toFixed(1).replace(".", ",")} КБ
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={onExport}
                className="btn-primary rounded-xl px-4 py-2.5 text-sm font-bold text-white"
              >
                Экспорт бэкапа (.json)
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="rounded-xl bg-white/[0.06] px-4 py-2.5 text-sm font-bold text-white ring-1 ring-white/12 transition hover:bg-white/10"
              >
                Импорт из файла
              </button>
              {canRollback && (
                <button
                  type="button"
                  onClick={onRollback}
                  className="rounded-xl bg-white/[0.06] px-4 py-2.5 text-sm font-bold text-accent-2 ring-1 ring-accent-2/40 transition hover:bg-accent-2/10 sm:col-span-2"
                >
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

            <p className="text-xs leading-relaxed text-muted">
              Импорт заменяет данные сайта на содержимое файла, а текущее состояние
              перед этим сохраняется в снимок — «Откатить последний импорт» вернёт его.
            </p>
          </div>
        )}
      </div>
    </div>
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
  const link = `${typeof window === "undefined" ? "" : window.location.origin}/profile`;

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
        Профиль живёт в этом браузере, поэтому по ссылке его увидите только вы на этом устройстве.
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
  const level = useLevelInfo();
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

  return (
    <DialogShell title="Предпросмотр профиля" subtitle="Так вас видят другие пользователи" onClose={closeProfileDialog}>
      <div className="overflow-hidden rounded-2xl border border-line">
        <div
          className="h-24 w-full"
          style={
            profile.backgroundCustom
              ? { backgroundImage: `url(${profile.backgroundCustom})`, backgroundSize: "cover", backgroundPosition: "center" }
              : { backgroundImage: bgItem.css, backgroundSize: bgItem.backgroundSize ?? "auto" }
          }
        />
        <div className="-mt-8 px-4 pb-4">
          <AvatarView nickname={nickname} avatar={profile.avatar || undefined} frameCss={frame?.css} frameImg={frame?.img} className="h-16 w-16 ring-4 ring-surface" textClass="text-lg" />
          <p className="mt-2 truncate text-xl font-black text-white">{nickname}</p>
          <p className="truncate text-xs text-muted">@{nickname.toLowerCase()}</p>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {isPremiumActive(account) && (
              <span className="rounded-md bg-gold/15 px-1.5 py-0.5 text-[10px] font-black text-gold">PREMIUM</span>
            )}
            <span className="rounded-md bg-accent-2/15 px-1.5 py-0.5 text-[10px] font-black text-accent-2">УРОВЕНЬ {level.level}</span>
            <span className="rounded-md bg-white/8 px-1.5 py-0.5 text-[10px] font-bold text-muted">{level.era}</span>
          </div>

          {(equippedTag || extraTags.length > 0 || title || extraTitles.length > 0) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {equippedTag && <AgTag tag={equippedTag} size="md" />}
              {extraTags.map((item) => (
                <AgTag key={item.id} tag={item} size="sm" />
              ))}
              {title && <AgTag tag={titleTag(title)} size="sm" />}
              {extraTitles.map((item) => (
                <AgTag key={item.id} tag={titleTag(item)} size="sm" />
              ))}
            </div>
          )}

          {profile.bio && <p className="mt-3 text-sm leading-relaxed text-white/85">{profile.bio}</p>}

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
        Предметы открыты: {ctx.purchased.length} куплено за монеты.
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
    { label: "получено AC", value: `+${earnedAc}`, tone: "text-gold" },
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
                          ? "text-gold"
                          : "text-accent-2"
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
    default:
      dialog = null;
  }

  if (!dialog) return null;
  return createPortal(dialog, document.body);
}
