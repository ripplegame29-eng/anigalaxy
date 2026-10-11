"use client";

import { useState } from "react";
import {
  BUILDINGS,
  REGIONS,
  RESOURCE_LABEL,
  type ClanBuilding,
  type ClanRegion,
} from "@/lib/clans.game";
import type { Clan } from "@/lib/clans";
import { grantRelic } from "@/lib/clans.social";
import {
  BRANCHES,
  BRANCH_MAX,
  branchCost,
  investInfluence,
  nextBuildingCost,
  regionLeft,
  upgradeBranch,
  upgradeBuilding,
  type ClanBranch,
  type ClanGameState,
} from "@/lib/clans.runtime";
import { clanGame } from "@/lib/clans.runtime";
import { num } from "./ClanWallet";

/**
 * База клана: здания, дерево развития и территории.
 *
 * Всё покупается строго своей валютой: здания — материалами, ветки —
 * престижем, территории — влиянием. Обмена между ресурсами нет намеренно —
 * именно он превращается в фарм-фермы и торговлю внутриигровой валютой.
 */

/** Куда вкладывать: половина того, что есть, но не больше остатка до цели */
function investStep(purse: number, left: number): number {
  return Math.max(0, Math.min(Math.floor(purse / 2), left));
}

export function ClanBase({ clan, game }: { clan: Clan; game: ClanGameState }) {
  const [message, setMessage] = useState("");
  const report = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 3000);
  };

  const onBuild = (id: ClanBuilding) => {
    const result = upgradeBuilding(id);
    if (!result.ok) report(result.reason ?? "Не удалось");
  };

  const onBranch = (id: ClanBranch) => {
    const result = upgradeBranch(id);
    if (!result.ok) report(result.reason ?? "Не удалось");
  };

  const onRegion = (id: ClanRegion) => {
    const step = investStep(game.purse.influence, regionLeft(game, id));
    if (step <= 0) {
      report(game.purse.influence <= 0 ? "Не хватает влияния" : "Регион уже под контролем");
      return;
    }
    const result = investInfluence(id, step);
    if (!result.ok) {
      report(result.reason ?? "Не удалось");
      return;
    }
    // Печать захватывается отдельно: её выдаёт тот, кто первым взял
    // регион, а не тот, кто закрыл вклад в сумме
    if (clanGame().held.includes(id)) {
      grantRelic("region-seal");
      report("Печать захвачена: " + (REGIONS.find((r) => r.id === id)?.name ?? ""));
    }
  };

  return (
    <div className="grid gap-4">
      {message && (
        <p className="cl-toast" role="status">
          {message}
        </p>
      )}

      {/* Штаб-квартира */}
      <section data-reveal className="cl-reveal cl-panel p-5 sm:p-6" style={{ ["--c" as string]: clan.color }}>
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-accent text-lg font-extrabold">Штаб-квартира</h2>
          <span className="text-xs text-muted">
            Материалов: <b className="tabular-nums text-bright">{num(game.purse.materials)}</b>
          </span>
        </div>
        <p className="mb-4 text-xs text-muted">
          Здания улучшаются материалами из экспедиций, боссов и заданий.
        </p>

        <ul className="grid gap-2.5 sm:grid-cols-2">
          {BUILDINGS.map((info) => {
            const level = game.buildings[info.id] ?? 0;
            const cost = nextBuildingCost(game, info.id);
            const afford = cost !== null && game.purse.materials >= cost;
            const pct = level >= info.max ? 100 : Math.round((level / info.max) * 100);

            return (
              <li key={info.id} className="cl-building">
                <div className="flex items-center gap-3">
                  <span className="cl-building-glyph" aria-hidden>
                    {info.glyph}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-bold text-white">{info.name}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted">
                        ур. {level}/{info.max}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">{info.perk}</p>
                  </div>
                </div>

                <div className="cl-bar mt-2.5" style={{ ["--p" as string]: pct }}>
                  <i />
                </div>

                <div className="mt-2.5 flex items-center gap-2">
                  {cost === null ? (
                    <span className="cl-quest-badge done">Максимум</span>
                  ) : (
                    <>
                      <span className="text-xs text-muted">
                        {num(cost)} {RESOURCE_LABEL.materials}
                      </span>
                      <button
                        type="button"
                        className="cl-btn sm ml-auto"
                        disabled={!afford}
                        style={{ ["--c" as string]: clan.color }}
                        onClick={() => onBuild(info.id)}
                      >
                        Улучшить
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Территории */}
      <section data-reveal className="cl-reveal cl-panel p-5 sm:p-6" style={{ ["--c" as string]: clan.color }}>
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-accent text-lg font-extrabold">Территории</h2>
          <span className="text-xs text-muted">
            Влияния: <b className="tabular-nums text-bright">{num(game.purse.influence)}</b>
          </span>
        </div>
        <p className="mb-4 text-xs text-muted">
          Влияние копится в регионе и не сгорает. Захват даёт престиж, а каждую
          неделю часть регионов снова становится нейтральной.
        </p>

        <ul className="grid gap-2.5 sm:grid-cols-2">
          {REGIONS.map((info) => {
            const invested = game.regions[info.id] ?? 0;
            const held = game.held.includes(info.id);
            const left = regionLeft(game, info.id);
            const pct = Math.min(100, Math.round((invested / info.required) * 100));

            return (
              <li key={info.id} className={`cl-building ${held ? "held" : ""}`}>
                <div className="flex items-center gap-3">
                  <span className="cl-building-glyph" aria-hidden>
                    {info.glyph}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-bold text-white">{info.name}</span>
                      {held ? (
                        <span className="cl-quest-badge done">наш</span>
                      ) : (
                        <span className="shrink-0 text-xs tabular-nums text-muted">{pct}%</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted">{info.reward}</p>
                  </div>
                </div>

                <div className="cl-bar mt-2.5" style={{ ["--p" as string]: pct }}>
                  <i />
                </div>

                <div className="mt-2.5 flex items-center gap-2">
                  {held ? (
                    <span className="text-xs text-muted">
                      Под контролем · престиж начислен
                    </span>
                  ) : (
                    <>
                      <span className="text-xs text-muted">
                        Осталось {num(left)} влияния
                      </span>
                      <button
                        type="button"
                        className="cl-btn sm ml-auto"
                        disabled={game.purse.influence <= 0}
                        style={{ ["--c" as string]: clan.color }}
                        onClick={() => onRegion(info.id)}
                      >
                        Вложить
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Дерево развития */}
      <section data-reveal className="cl-reveal cl-panel p-5 sm:p-6" style={{ ["--c" as string]: clan.color }}>
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-accent text-lg font-extrabold">Дерево развития</h2>
          <span className="text-xs text-muted">
            Престижа: <b className="tabular-nums text-bright">{num(game.purse.prestige)}</b>
          </span>
        </div>
        <p className="mb-4 text-xs text-muted">
          Ветки открывают возможности и оформление, а не боевое преимущество:
          прокачанный клан не должен выигрывать у нового только за счёт стажа.
        </p>

        <ul className="grid gap-2.5 sm:grid-cols-2">
          {BRANCHES.map((info) => {
            const level = game.tree[info.id] ?? 0;
            const cost = branchCost(level);
            const maxed = level >= BRANCH_MAX;
            const pct = Math.round((level / BRANCH_MAX) * 100);

            return (
              <li key={info.id} className="cl-building" style={{ ["--c" as string]: info.color }}>
                <div className="flex items-center gap-3">
                  <span className="cl-building-glyph" aria-hidden>
                    {info.glyph}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-bold text-white">{info.name}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted">
                        {level}/{BRANCH_MAX}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">{info.desc}</p>
                  </div>
                </div>

                <div className="cl-bar mt-2.5" style={{ ["--p" as string]: pct }}>
                  <i />
                </div>

                <div className="mt-2.5 flex items-center gap-2">
                  {maxed ? (
                    <span className="cl-quest-badge done">Прокачано</span>
                  ) : (
                    <>
                      <span className="text-xs text-muted">{num(cost)} престижа</span>
                      <button
                        type="button"
                        className="cl-btn sm ml-auto"
                        disabled={game.purse.prestige < cost}
                        style={{ ["--c" as string]: info.color }}
                        onClick={() => onBranch(info.id)}
                      >
                        Открыть
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}