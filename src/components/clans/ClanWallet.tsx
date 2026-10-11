"use client";

import { RESOURCE_INFO, RESOURCE_LABEL, type ClanPurse, type ClanResource } from "@/lib/clans.game";

/**
 * Кошелёк клана.
 *
 * Четыре ресурса показываются рядом и подписаны: разница между «влиянием»
 * и «материалами» неочевидна, а именно из-за путаницы в таких величинах
 * ломается вся экономика. Под каждым ресурсом — откуда он берётся и на что
 * тратится, как в описании механик.
 */

const ORDER: ClanResource[] = ["xp", "influence", "materials", "prestige"];

export function num(value: number): string {
  return Math.round(value).toLocaleString("ru-RU");
}

export function ClanWallet({
  purse,
  compact = false,
}: {
  purse: ClanPurse;
  compact?: boolean;
}) {
  return (
    <div className={`cl-wallet ${compact ? "compact" : ""}`}>
      {ORDER.map((id) => {
        const info = RESOURCE_INFO[id];
        return (
          <div key={id} className="cl-wallet-cell" title={`${info.from} → ${info.spend}`}>
            <span className="glyph" aria-hidden>
              {info.glyph}
            </span>
            <span className="min-w-0">
              <b className="tabular-nums">{num(purse[id])}</b>
              {!compact && <em>{RESOURCE_LABEL[id]}</em>}
            </span>
          </div>
        );
      })}
    </div>
  );
}