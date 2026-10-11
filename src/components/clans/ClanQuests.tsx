"use client";

import { useState } from "react";
import type { Clan } from "@/lib/clans";
import { RESOURCE_LABEL, RESOURCE_INFO, type ClanResource } from "@/lib/clans.game";
import { claimQuest, questViews, type ClanGameState } from "@/lib/clans.runtime";
import { num } from "./ClanWallet";

/**
 * Клановые задания.
 *
 * Прогресс берётся из активности на сайте — просмотренных серий, прочитанных
 * глав, открытых достижений, — поэтому задание нельзя «выполнить», не
 * сделав ничего на сайте. Награда выдаётся один раз за период: повторный
 * клик по кнопке не даёт второй раз.
 */

export function ClanQuests({
  clan,
  game,
}: {
  clan: Clan;
  game: ClanGameState;
}) {
  const views = questViews(game);
  const [toast, setToast] = useState("");

  const daily = views.filter((v) => v.quest.period === "daily");
  const weekly = views.filter((v) => v.quest.period === "weekly");

  const claim = (id: string, reward: ClanResource, amount: number) => {
    const got = claimQuest(id);
    if (!got) {
      setToast("Награда уже получена");
    } else {
      setToast(`+${num(amount)} ${RESOURCE_LABEL[reward]}`);
    }
    window.setTimeout(() => setToast(""), 2600);
  };

  return (
    <div className="grid gap-4">
      {toast && (
        <p className="cl-toast" role="status">
          {toast}
        </p>
      )}

      {(
        [
          { title: "Ежедневные", hint: "Обновляются в полночь", items: daily },
          { title: "Еженедельные", hint: "Обновляются в понедельник", items: weekly },
        ] as const
      ).map((group) => (
        <section
          key={group.title}
          data-reveal
          className="cl-reveal cl-panel p-5 sm:p-6"
          style={{ ["--c" as string]: clan.color }}
        >
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-accent text-lg font-extrabold">{group.title}</h2>
            <span className="text-xs text-muted">{group.hint}</span>
          </div>

          <ul className="grid gap-2.5">
            {group.items.map((view) => {
              const { quest } = view;
              const pct = Math.round(view.pct * 100);
              return (
                <li
                  key={quest.id}
                  className={`cl-quest ${view.done ? (view.claimed ? "done" : "ready") : ""}`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-white">{quest.name}</span>
                        {view.overflow > 0 && view.claimed && (
                          <span className="cl-quest-over">перевыполнено на {view.overflow}</span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted">
                        {view.progress} / {quest.goal} {quest.unit} ·{" "}
                        <span style={{ color: RESOURCE_INFO[quest.reward].glyph === "🔷" ? "#7dd3fc" : undefined }}>
                          +{num(quest.amount)} {RESOURCE_LABEL[quest.reward]}
                        </span>
                      </p>
                    </div>

                    {view.claimed ? (
                      <span className="cl-quest-badge done">Получено</span>
                    ) : view.done ? (
                      <button
                        type="button"
                        className="cl-btn sm"
                        style={{ ["--c" as string]: clan.color }}
                        onClick={() => claim(quest.id, quest.reward, quest.amount)}
                      >
                        Забрать
                      </button>
                    ) : (
                      <span className="cl-quest-badge">{pct}%</span>
                    )}
                  </div>

                  <div className="cl-bar mt-2.5" style={{ ["--p" as string]: pct }}>
                    <i />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <p className="text-xs leading-relaxed text-muted">
        Задания считают только уникальные действия: перечитывание одной главы и
        пересмотр одной серии не приносят клану второй раз то же самое.
      </p>
    </div>
  );
}