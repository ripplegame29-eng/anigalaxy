"use client";

import { useEffect, useState } from "react";
import { act, ensureLoaded, refresh, useCards } from "@/lib/cards/client";
import { openAuthDialog } from "@/lib/auth-dialog";
import { useAccount } from "@/lib/use-account";
import "../../app/cards.css";
import { AuctionTab } from "./AuctionTab";
import { BattleTab } from "./BattleTab";
import { CollectionTab } from "./CollectionTab";
import { ForgeTab } from "./ForgeTab";
import { PacksTab } from "./PacksTab";
import { SharpenTab } from "./SharpenTab";
import { ToastHost, fmt, fmtLeft, toast, useBusy, useNow } from "./common";
import { TradeTab } from "./TradeTab";

const TABS = [
  ["packs", "Паки"],
  ["forge", "Кузница"],
  ["sharpen", "Заточка"],
  ["battle", "Бои"],
  ["auction", "Аукцион"],
  ["trade", "Обмен"],
  ["collection", "Коллекция"],
] as const;
type TabId = (typeof TABS)[number][0];

export function CardsApp() {
  const account = useAccount();
  const { state: s, error, loading } = useCards();
  const [tab, setTab] = useState<TabId>("packs");
  const [busy, run] = useBusy();
  const [ex, setEx] = useState(5);
  const now = useNow(30_000);

  useEffect(() => {
    if (account) ensureLoaded();
  }, [account]);

  useEffect(() => {
    try {
      const saved = window.location.hash.slice(1) as TabId;
      if (TABS.some(([id]) => id === saved)) window.setTimeout(() => setTab(saved), 0);
    } catch {
      /* ignore */
    }
  }, []);

  const pick = (t: TabId) => {
    setTab(t);
    try {
      window.history.replaceState(null, "", `#${t}`);
    } catch {
      /* ignore */
    }
  };

  if (!account) {
    return (
      <div className="cg">
        <div className="cg-hero">
          <h1>Карточки AniGalaxy</h1>
          <p>Коллекционируйте героев популярных аниме, открывайте паки, улучшайте, сражайтесь отрядом 4×4, торгуйтесь на аукционе и меняйтесь с друзьями.</p>
          <div className="cg-row">
            <button type="button" className="cg-btn pri" onClick={() => openAuthDialog("register")}>
              Создать аккаунт и получить стартовый набор
            </button>
            <button type="button" className="cg-btn" onClick={() => openAuthDialog("login")}>
              Войти
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!s) {
    return (
      <div className="cg">
        <div className="cg-hero">
          <h1>Карточки AniGalaxy</h1>
          <p>{error && error !== "auth" ? `Не удалось загрузить: ${error}` : loading ? "Загружаем вашу коллекцию…" : "Нужен вход в аккаунт — войдите заново."}</p>
          {error && (
            <div>
              <button type="button" className="cg-btn pri" onClick={() => void refresh()}>
                Повторить
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const w = s.wallet;
  const energyLeft = w.nextEnergyAt ? w.nextEnergyAt - now : 0;
  const claim = () =>
    run(async () => {
      const r = await act<{ diamonds: number; dust: number; packs: number }>("daily");
      if (!r.ok) return toast(r.error, true);
      toast(`Подарок дня: ${r.result.diamonds} 💎, ${r.result.dust} пыли, ${r.result.packs} пак(а)`);
    });
  const exchange = () =>
    run(async () => {
      const r = await act<{ diamonds: number }>("exchange", { diamonds: ex });
      toast(r.ok ? `Получено ${r.result.diamonds} 💎` : r.error, !r.ok);
    });

  return (
    <div className="cg">
      <div className="cg-hero">
        <div className="cg-row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1>Карточки AniGalaxy</h1>
            <p>Герои топовых аниме: паки, кузница, заточка, бои 4×4, аукцион и обмен — всё в одном месте.</p>
          </div>
          {s.dailyReady && (
            <button type="button" className="cg-btn gold" disabled={busy} onClick={() => void claim()}>
              🎁 Подарок дня
            </button>
          )}
        </div>
        <div className="cg-wallet" aria-label="Кошелёк">
          <span className="cg-chip" title="Алмазы">💎 {fmt(w.diamonds)}</span>
          <span className="cg-chip" title="Пыль">✦ {fmt(w.dust)}</span>
          <span className="cg-chip" title="Жетоны паков">🎴 {w.packs}</span>
          <span className="cg-chip" title="Энергия боёв">
            ⚡ {w.energy}/{w.energyMax}
            {energyLeft > 0 && <small>{fmtLeft(energyLeft)}</small>}
          </span>
          <span className="cg-chip" style={{ color: s.league.color }}>{s.league.name} · {fmt(w.rating)}</span>
          <span className="cg-chip">
            <small>Обмен AC → 💎</small>
            <select className="cg-input" value={ex} onChange={(e) => setEx(Number(e.target.value))} aria-label="Сколько алмазов" style={{ padding: "3px 6px" }}>
              {[1, 5, 10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n} 💎 = {n * 12} AC
                </option>
              ))}
            </select>
            <button type="button" className="cg-btn sm" disabled={busy || s.ac < ex * 12} onClick={() => void exchange()}>
              Обменять
            </button>
            <small>у вас {fmt(s.ac)} AC</small>
          </span>
        </div>
      </div>

      <div className="cg-tabs" role="tablist" aria-label="Разделы карточек">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" id={`cg-tab-${id}`} aria-selected={tab === id} className="cg-tab" onClick={() => pick(id)}>
            {label}
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-labelledby={`cg-tab-${tab}`}>
        {tab === "packs" && <PacksTab s={s} />}
        {tab === "forge" && <ForgeTab s={s} />}
        {tab === "sharpen" && <SharpenTab s={s} />}
        {tab === "battle" && <BattleTab s={s} />}
        {tab === "auction" && <AuctionTab s={s} me={account.nickname} />}
        {tab === "trade" && <TradeTab s={s} />}
        {tab === "collection" && <CollectionTab s={s} />}
      </div>
      <ToastHost />
    </div>
  );
}
