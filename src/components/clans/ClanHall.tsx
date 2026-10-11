"use client";

import { useState } from "react";
import {
  CLAN_LEVELS,
  claimLevelReward,
  claimableLevels,
  cellsAtLevel,
  contribute,
  investedIn,
  levelInfo,
  levelProgress,
  toNextLevel,
  type Clan,
} from "@/lib/clans";
import { LevelRing } from "@/components/clans/LevelRing";

/**
 * Зал клана — сетка вкладов по мотивам ратуши из Clash of Clans.
 *
 * Каждый уровень открывает ещё одну клетку и даёт награду. Вклад перетекает
 * по кругу: сперва заполняется выбранная клетка, остаток уходит в следующие,
 * поэтому «переполнение» не пропадает — как в игре.
 */

const num = (value: number): string => value.toLocaleString("ru-RU");

/** Одна клетка вклада */
function Cell({
  clan,
  index,
  filled,
  goal,
  selected,
  onSelect,
}: {
  clan: Clan;
  index: number;
  filled: number;
  goal: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const percent = Math.min(100, Math.round((filled / goal) * 100));
  const done = filled >= goal;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`Клетка ${index + 1}: вложено ${filled} из ${goal}${done ? ", заполнена" : ""}`}
      aria-pressed={selected}
      className={`cl-cell ${done ? "full" : ""} ${selected ? "sel" : ""}`}
      style={{ ["--c" as string]: clan.color, ["--p" as string]: percent }}
    >
      <span className="n">{index + 1}</span>
      {/* Столбик заполнения — растёт снизу, как бак в игре */}
      <span className="fill" aria-hidden />
      {done ? (
        <span className="tick" aria-hidden>
          ✓
        </span>
      ) : (
        <span className="val">{num(filled)}</span>
      )}
    </button>
  );
}

/** Слот следующего уровня: показан, но под замком — видно, к чему идти */
function LockedCell({ clan, index, goal }: { clan: Clan; index: number; goal: number }) {
  return (
    <div
      className="cl-cell locked"
      style={{ ["--c" as string]: clan.color }}
      aria-label={`Клетка ${index + 1} откроется на следующем уровне, нужно ${num(goal)} AC`}
    >
      <span className="n">{index + 1}</span>
      <span className="lock" aria-hidden>
        🔒
      </span>
      <span className="lbl">{num(goal)}</span>
    </div>
  );
}

export function ClanHall({ clan, ac }: { clan: Clan; ac: number }) {
  const [selected, setSelected] = useState(0);
  const [flash, setFlash] = useState<number | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  const level = clan.level;
  const next = level < CLAN_LEVELS.length ? levelInfo(level + 1) : null;
  const total = cellsAtLevel(level);

  // Массив клеток держим ровно по числу открытых
  const cells = Array.from({ length: total }, (_, i) => clan.cells[i] ?? 0);
  const progress = Math.round(levelProgress(clan.cells) * 100);
  const pending = claimableLevels(clan);

  const onDonate = () => {
    const result = contribute(ac, selected);
    if (result.points > 0 || result.cells.some((v, i) => v !== clan.cells[i])) {
      setFlash(selected);
      window.setTimeout(() => setFlash(null), 700);
    }
  };

  const onClaim = () => {
    const reward = claimLevelReward(level);
    if (reward) setPicked(reward.label);
  };

  const canDonate = ac > 0 && cells.some((value, i) => value < levelInfo(i + 1).goal);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* Ратуша */}
      <section
        data-reveal
        className="cl-reveal cl-panel hall p-5 sm:p-6"
        style={{ ["--c" as string]: clan.color }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="cl-lbl !mb-1">Зал клана</p>
            <h2 className="font-accent text-xl font-extrabold">
              Уровень {level}
              {next ? (
                <span className="ml-2 text-sm font-normal text-muted">→ {next.level} на {num(next.goal)} AC</span>
              ) : (
                <span className="ml-2 text-sm font-normal text-gold">максимум</span>
              )}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="font-accent text-lg font-extrabold tabular-nums">
                {num(investedIn(clan.cells))}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted">вложено всего</div>
            </div>
            <LevelRing clan={clan} />
          </div>
        </div>

        {/* Сетка клеток */}
        <div className="cl-hall mt-5">
          <div className="cl-hall-grid" style={{ ["--cols" as string]: Math.min(total + 2, 6) }}>
            {cells.map((filled, index) => (
              <Cell
                key={index}
                clan={clan}
                index={index}
                filled={filled}
                goal={levelInfo(index + 1).goal}
                selected={selected === index}
                onSelect={() => setSelected(index)}
              />
            ))}
            {/* Две запертые клетки следующего уровня — видно, куда растёт клан */}
            {next &&
              [0, 1].map((offset) => {
                const index = total + offset;
                return index < CLAN_LEVELS.length ? (
                  <LockedCell key={index} clan={clan} index={index} goal={levelInfo(index + 1).goal} />
                ) : null;
              })}
          </div>
          <p className="mt-3 text-center text-xs text-muted">
            Выбрана клетка {selected + 1} · {num(levelInfo(selected + 1).goal)} AC
          </p>
        </div>

        {/* Прогресс уровня */}
        <div className="mt-5">
          <div className="mb-1.5 flex justify-between text-xs text-muted">
            <span>
              {next ? `До уровня ${next.level}` : "Максимальный уровень"}
            </span>
            <span className="tabular-nums">{progress}%</span>
          </div>
          <div className="cl-bar" style={{ ["--p" as string]: progress }}>
            <i />
          </div>
          {next && toNextLevel(clan.cells) > 0 && (
            <p className="mt-1.5 text-[11px] text-muted">
              Не хватает {num(toNextLevel(clan.cells))} AC до новой клетки
            </p>
          )}
        </div>

        {flash !== null && (
          <p className="mt-3 text-center text-xs font-semibold text-mint">Вклад зачислен</p>
        )}
      </section>

      {/* Панель вклада и наград */}
      <div className="grid content-start gap-4">
        <section
          data-reveal
          className="cl-reveal cl-panel p-5"
          style={{ ["--c" as string]: clan.color }}
        >
          <h3 className="cl-lbl !mb-3">Вклад в клетку</h3>

          <div className="flex items-baseline justify-between rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
            <span className="text-sm text-muted">Твоя валюта</span>
            <span className="font-accent text-lg font-extrabold tabular-nums text-gold">{num(ac)}</span>
          </div>

          <ul className="mt-3 space-y-1.5 text-xs text-muted">
            <li className="flex justify-between">
              <span>Цель клетки {selected + 1}</span>
              <span className="tabular-nums">{num(levelInfo(selected + 1).goal)} AC</span>
            </li>
            <li className="flex justify-between">
              <span>В клетке уже есть</span>
              <span className="tabular-nums">{num(cells[selected] ?? 0)} AC</span>
            </li>
            <li className="flex justify-between">
              <span>Очки за полную клетку</span>
              <span className="tabular-nums text-mint">+{num(levelInfo(selected + 1).points)}</span>
            </li>
          </ul>

          <button
            type="button"
            onClick={onDonate}
            disabled={!canDonate}
            className="cl-btn mt-4 w-full"
            style={{ ["--c" as string]: clan.color }}
          >
            {canDonate ? `Вложить ${num(ac)} AC` : "Нет валюты или клетки полны"}
          </button>

          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            Всё, что не влезло в выбранную клетку, перейдёт в следующие — ничего не пропадёт.
          </p>

          {/* Награда за текущий уровень забирается здесь — как сундук в игре */}
          {pending.includes(level) && (
            <button
              type="button"
              onClick={onClaim}
              className="cl-btn mt-3 w-full"
              style={{ ["--c" as string]: "#ffb020" }}
            >
              Забрать награду за уровень {level}
            </button>
          )}
        </section>

        {/* Награды за уровни */}
        <section
          data-reveal
          className="cl-reveal cl-panel p-5"
          style={{ ["--c" as string]: clan.color }}
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="cl-lbl !mb-0">Награды за уровни</h3>
            {pending.length > 0 && (
              <span className="rounded-md bg-accent px-2 py-0.5 text-[10px] font-bold text-white">
                {pending.length} доступно
              </span>
            )}
          </div>

          <ul className="cl-ladder">
            {[...CLAN_LEVELS].reverse().slice(0, 8).map((item) => {
              const reached = level >= item.level;
              const taken = clan.claimed.includes(item.level);
              return (
                <li
                  key={item.level}
                  className={`cl-ladder-row ${reached ? "on" : ""} ${taken ? "taken" : ""}`}
                  style={{ ["--c" as string]: clan.color }}
                >
                  <span className="lv">{item.level}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold">{item.reward.label}</span>
                    <span className="block text-[11px] text-muted">
                      {item.reward.ac ? `${num(item.reward.ac)} AC · ` : ""}+{num(item.reward.points ?? 0)} очков
                      {item.reward.item ? " · предмет" : ""}
                    </span>
                  </span>
                  {reached &&
                    (taken ? (
                      <span className="text-[11px] text-mint">✓</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => claimLevelReward(item.level)}
                        className="cl-btn sm !py-1 !text-[11px]"
                        style={{ ["--c" as string]: clan.color }}
                      >
                        Забрать
                      </button>
                    ))}
                </li>
              );
            })}
          </ul>

          {picked && (
            <p className="mt-3 rounded-xl bg-mint/12 px-3 py-2 text-center text-xs font-semibold text-mint">
              Получено: {picked}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}