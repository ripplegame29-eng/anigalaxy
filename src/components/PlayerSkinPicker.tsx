"use client";

import { useState } from "react";
import { unlockHint, type UnlockContext } from "@/lib/cosmetics";
import { isPremiumActive } from "@/lib/auth";
import { PLAYER_SKINS, selectPlayerSkin, skinOwned, skinPurchaseId, usePlayerSkin, type PlayerSkin } from "@/lib/player-skins";
import { useLevelInfo } from "@/lib/progression/events";
import { purchaseItem, useProfile } from "@/lib/profile";
import { useMyReferrals } from "@/lib/referrals";
import { useAccount } from "@/lib/use-account";
import "./player-skins.css";

const RARITY: Record<string, string> = { common: "Обычный", rare: "Редкий", epic: "Эпический", legendary: "Легендарный" };

function useCtx(): UnlockContext {
  const profile = useProfile();
  const account = useAccount();
  const referrals = useMyReferrals();
  return {
    level: useLevelInfo().level,
    premium: isPremiumActive(account),
    claimed: profile.claimed,
    purchased: profile.purchased,
    referrals: referrals.filter((r) => r.qualified).length,
  };
}

/** Мини-макет плеера: те же переменные, что у настоящего скина */
function Mock({ id }: { id: string }) {
  return (
    <div className="ps-mock" data-pskin={id} aria-hidden>
      <span className="ps-skip">Пропустить опенинг</span>
      <div className="ps-bar"><i /></div>
      <div className="ps-row"><b /><b /><b /><em /></div>
    </div>
  );
}

export function PlayerSkinPicker({ onClose }: { onClose: () => void }) {
  const ctx = useCtx();
  const profile = useProfile();
  const current = usePlayerSkin();
  const [msg, setMsg] = useState("");

  const act = (skin: PlayerSkin, owned: boolean) => {
    if (owned) {
      selectPlayerSkin(skin.id);
      setMsg("");
      return;
    }
    const price = skin.unlock.price;
    if (!price) return;
    if (profile.coins < price) return setMsg(`Не хватает монет: нужно ${price} AC`);
    if (purchaseItem(skinPurchaseId(skin.id), price)) selectPlayerSkin(skin.id);
  };

  return (
    <div className="ps-overlay" role="dialog" aria-label="Оформление плеера" onClick={onClose}>
      <div className="ps-panel" onClick={(e) => e.stopPropagation()}>
        <header>
          <h3>Оформление плеера</h3>
          <button type="button" aria-label="Закрыть" onClick={onClose}>×</button>
        </header>
        {msg && <p className="ps-msg" role="status">{msg}</p>}
        <div className="ps-grid">
          {PLAYER_SKINS.map((skin) => {
            const owned = skinOwned(skin, ctx);
            const on = current === skin.id && owned;
            return (
              <article key={skin.id} className={`ps-card r-${skin.rarity}${on ? " on" : ""}`}>
                <Mock id={skin.id} />
                <h4>{skin.name}</h4>
                <p>{skin.tagline}</p>
                <small>{RARITY[skin.rarity]}</small>
                <button type="button" disabled={!owned && !skin.unlock.price} onClick={() => act(skin, owned)}>
                  {on ? "Выбрано" : owned ? "Выбрать" : skin.unlock.price ? `Купить · ${skin.unlock.price} AC` : unlockHint(skin.unlock)}
                </button>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
