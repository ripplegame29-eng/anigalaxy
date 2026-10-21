"use client";

/**
 * Хост тостов (§12.6): подписан на эффекты движка и превращает их в
 * всплывашки. Сам по себе ничего не начисляет и не знает про документ —
 * только показывает то, что движок уже одобрил.
 *
 * Уровни/достижения/теги дублируются в раздел «Уведомления» профиля
 * (`service.applySideEffects`), поэтому тост можно пропустить — запись останется.
 */

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
          text: `Эра «${effect.era}»${effect.acReward > 0 ? ` · +${effect.acReward} AC` : ""}`,
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

const KIND_CLASS: Record<ToastItem["kind"], string> = {
  xp: "ring-accent/45 bg-accent/12 text-accent-2",
  level: "ring-gold/50 bg-gold/14 text-gold",
  achievement: "ring-gold/40 bg-gold/10 text-gold",
  tag: "ring-accent-2/45 bg-accent-2/12 text-accent-2",
  quest: "ring-rose-400/45 bg-rose-500/14 text-rose-200",
  ac: "ring-accent-2/45 bg-accent-2/12 text-accent-2",
  premium: "ring-gold/50 bg-gold/14 text-gold",
};

function ToastCard({ toast }: { toast: ToastItem }) {
  // Тост живёт сам: исчезает сам и по клику, без таймеров в рендере
  useEffect(() => {
    const timer = setTimeout(() => dismissToast(toast.id), toast.kind === "xp" ? 4200 : 7000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.kind]);

  const tagDef = toast.tagId
    ? PROGRESSION_CONFIG.tags.find((item) => item.id === toast.tagId)
    : undefined;

  return (
    <div
      className={`pointer-events-auto animate-fade-up rounded-xl px-3.5 py-3 ring-1 backdrop-blur ${KIND_CLASS[toast.kind]}`}
      style={{ animationDuration: "220ms" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black leading-tight text-white">{toast.title}</p>
          {tagDef ? (
            /* о получении тега — сама капсула, а не только название (FIX §2) */
            <div className="mt-1.5">
              <AgTag tag={tagDef} size="sm" />
            </div>
          ) : (
            toast.text && <p className="mt-0.5 text-xs leading-snug text-muted">{toast.text}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => dismissToast(toast.id)}
          aria-label="Скрыть уведомление"
          className="-mr-2 -mt-2 shrink-0 rounded-md p-2.5 text-muted transition hover:bg-white/10 hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export function ToastHost() {
  // Стабильная ссылка: подписка на эффекты живёт всё время работы страницы
  const onEffects = useCallback((effects: ProgressEffect[]) => {
    for (const effect of effects) {
      for (const toast of toastsForEffect(effect)) pushToast(toast);
    }
  }, []);

  useProgressEffects(onEffects);

  const items = useSyncExternalStore(subscribeToasts, getToasts, getServerToasts);

  return (
    <div
      className="pointer-events-none fixed bottom-4 max-[900px]:bottom-[calc(92px+env(safe-area-inset-bottom))] right-4 z-[90] flex w-[min(92vw,340px)] flex-col items-stretch gap-2"
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
