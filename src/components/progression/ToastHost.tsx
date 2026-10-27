"use client";

/**
 * Хост тостов (§12.6): подписан на эффекты движка и превращает их в
 * всплывашки. Сам по себе ничего не начисляет и не знает про документ —
 * только показывает то, что движок уже одобрил.
 *
 * Уровни/достижения/теги дублируются в раздел «Уведомления» профиля
 * (`service.applySideEffects`), поэтому тост можно пропустить — запись останется.
 */

import { playSfx } from "@/lib/sfx";
import "./toast.css";
import { BP_MISSIONS } from "@/lib/battlepass/config";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { AgTag } from "@/components/progression/AgTag";
import { sourceLabel } from "@/lib/progression/labels";
import { useProgressEffects } from "@/lib/progression/events";
import { PROGRESSION_CONFIG } from "@/lib/progression/progression.config";
import type { ProgressEffect } from "@/lib/progression/types";
import {
  dismissToast,
  getServerToasts,
  getToasts,
  pushToast,
  subscribeToasts,
  type ToastInput,
  type ToastItem,
} from "@/lib/toasts";

/** Эффект движка → тост(ы). Чистая функция — тестируется без DOM. */
export function toastsForEffect(effect: ProgressEffect): ToastInput[] {
  switch (effect.type) {
    case "XP_GAINED": {
      if (effect.credited <= 0) return [];
      const reason = sourceLabel(effect.source);
      return [
        {
          kind: "xp",
          title: `+${effect.credited} XP`,
          // §4.4: при soft-cap пользователь должен понимать, почему меньше
          text: effect.reduced ? `${reason} · опыт ×0,25 до завтра` : reason,
        },
      ];
    }
    case "LEVEL_UP":
      return [
        {
          kind: "level",
          title: `Уровень ${effect.level}!`,
          text: `Пробуждение «${effect.era}»${effect.acReward > 0 ? ` · +${effect.acReward} AC` : ""}`,
        },
      ];
    case "ACHIEVEMENT_UNLOCKED": {
      const def = PROGRESSION_CONFIG.achievements.find((item) => item.id === effect.id);
      if (!def) return [];
      const parts: string[] = [];
      if (effect.xp > 0) parts.push(`+${effect.xp} XP`);
      if (effect.ac > 0) parts.push(`+${effect.ac} AC`);
      return [{ kind: "achievement", title: "Достижение получено", text: `«${def.name}»${parts.length ? ` · ${parts.join(" + ")}` : ""}` }];
    }
    case "QUEST_DONE": {
      const title =
        PROGRESSION_CONFIG.quests.dailyPool.find((q) => q.id === effect.questId)?.title ??
        PROGRESSION_CONFIG.quests.weeklyPool.find((q) => q.id === effect.questId)?.title ??
        BP_MISSIONS.find((m) => m.id === effect.questId)?.title ??
        "Задание";
      const parts: string[] = [];
      if (effect.xp > 0) parts.push(`+${effect.xp} XP`);
      if (effect.ac > 0) parts.push(`+${effect.ac} AC`);
      return [{ kind: "quest", title: "Награда за задание", text: `«${title}»${parts.length ? ` · ${parts.join(" + ")}` : ""}` }];
    }
    case "TAG_UNLOCKED": {
      const def = PROGRESSION_CONFIG.tags.find((item) => item.id === effect.tagId);
      if (!def) return [];
      return [{ kind: "tag", title: "Новый тег", text: `«${def.name}»`, tagId: def.id }];
    }
    default:
      return [];
  }
}

const ico = (d: string, fill = false) => (
  <svg viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"} stroke={fill ? "none" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

/** Иконка медальона по типу тоста */
const KIND_ICON: Record<ToastItem["kind"], React.ReactNode> = {
  xp: ico("M13 2 4.5 13.5H11L10 22l8.5-11.5H12.5z", true),
  level: ico("M12 3.5 19 12h-4.2v8.5H9.2V12H5z", true),
  achievement: ico("M8 4h8v5a4 4 0 0 1-8 0V4ZM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7"),
  tag: ico("M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.4 1.4 0 0 1 0 2l-6.7 6.7a1.4 1.4 0 0 1-2 0L3.5 12.2ZM8 8h.01"),
  quest: ico("m5 12.5 4.5 4.5L19 7.5"),
  ac: ico("M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17ZM12 8v8M9.5 10.5h4a1.5 1.5 0 0 1 0 3h-3"),
  premium: ico("M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8Z", true),
};

function ToastCard({ toast }: { toast: ToastItem }) {
  // Тост живёт сам: исчезает сам и по клику, без таймеров в рендере
  const life = toast.kind === "xp" ? 4200 : 7000;
  useEffect(() => {
    const timer = setTimeout(() => dismissToast(toast.id), life);
    return () => clearTimeout(timer);
  }, [toast.id, life]);

  const tagDef = toast.tagId
    ? PROGRESSION_CONFIG.tags.find((item) => item.id === toast.tagId)
    : undefined;

  return (
    <div className={`tst tst--${toast.kind} pointer-events-auto`} style={{ ["--life" as string]: `${life}ms` }}>
      <span className="tst-ic">{KIND_ICON[toast.kind]}</span>
      <div className="min-w-0">
        <p className="tst-t">{toast.title}</p>
        {tagDef ? (
          /* о получении тега — сама капсула, а не только название (FIX §2) */
          <div className="mt-1.5">
            <AgTag tag={tagDef} size="sm" />
          </div>
        ) : (
          toast.text && <p className="tst-s">{toast.text}</p>
        )}
      </div>
      <button type="button" onClick={() => dismissToast(toast.id)} aria-label="Скрыть уведомление" className="tst-x">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
      <span className="tst-bar" aria-hidden>
        <i />
      </span>
    </div>
  );
}

export function ToastHost() {
  // Стабильная ссылка: подписка на эффекты живёт всё время работы страницы
  const onEffects = useCallback((effects: ProgressEffect[]) => {
    let shown = false;
    for (const effect of effects) {
      for (const toast of toastsForEffect(effect)) {
        pushToast(toast);
        shown = true;
      }
    }
    if (shown) playSfx("reward");
  }, []);

  useProgressEffects(onEffects);

  const items = useSyncExternalStore(subscribeToasts, getToasts, getServerToasts);

  return (
    <div
      className="pointer-events-none fixed bottom-4 max-[900px]:bottom-[calc(140px+env(safe-area-inset-bottom))] right-4 z-[96] flex w-[min(92vw,340px)] flex-col items-stretch gap-2"
      role="status"
      aria-live="polite"
      aria-label="Уведомления о наградах"
    >
      {items.map((toast) => (
        <ToastCard key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
