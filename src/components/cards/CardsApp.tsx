"use client";

import { useEffect, useRef, useState } from "react";
import { act, ensureLoaded, refresh, useCards, type CardsState } from "@/lib/cards/client";
import { CATALOG } from "@/lib/cards/catalog";
import { openAuthDialog } from "@/lib/auth-dialog";
import { useAccount } from "@/lib/use-account";
import "../../app/cards.css";
import "../../app/cards-card.css";
import "../../app/cards-stage.css";
import "../../app/cards-tabs.css";
import "../../app/cards-battle.css";
import "../../app/cards-skills.css";
import "../../app/cards-ult.css";
import "../../app/cards-progress.css";
import "../../app/cards-campaign.css";
import "../../app/cards-season.css";
import "../../app/cards-arsenal.css";
import "../../app/cards-shop.css";
import "../../app/cards-v2.css";
import "../../app/cards-arena2.css";
import "../../app/cards-arena3.css";
import "../../app/cards-result.css";
import "../../app/cards-battlefx.css";
import "../../app/cards-mobile.css";
import { AuctionTab } from "./AuctionTab";
import { BattleTab } from "./BattleTab";
import { CardsBackdrop } from "./CardsBackdrop";
import { CollectionTab } from "./CollectionTab";
import { ForgeTab } from "./ForgeTab";
import { PacksTab } from "./PacksTab";
import { ProgressTab } from "./ProgressTab";
import { SeasonTab } from "./SeasonTab";
import { TierTab } from "./TierTab";
import { SharpenTab } from "./SharpenTab";
import { ToastHost, toast } from "./common";
import { TabIco, type IcoName } from "./icons";
import { TradeTab } from "./TradeTab";

const TABS: readonly (readonly [string, string, IcoName])[] = [
  ["packs", "Паки", "pack"],
  ["forge", "Кузница", "anvil"],
  ["sharpen", "Заточка", "star"],
  ["battle", "Бои", "swords"],
  ["auction", "Аукцион", "tag"],
  ["trade", "Обмен", "swap"],
  ["collection", "Коллекция", "grid"],
  ["progress", "Прогресс", "trophy"],
  ["season", "Сезон", "crown"],
  ["tiers", "Тир-лист", "grid"],
] as const;
type TabId = "packs" | "forge" | "sharpen" | "battle" | "auction" | "trade" | "collection" | "progress" | "season" | "tiers";

const NOTIFY_KEY = "animehub:cards:notify";
const canNotify = (): boolean => {
  try {
    return typeof Notification !== "undefined" && Notification.permission === "granted" && window.localStorage.getItem(NOTIFY_KEY) === "1";
  } catch {
    return false;
  }
};

/** Тосты и системные уведомления: энергия восстановлена, нападение на защиту, итоги аукциона, предложение обмена */
function useGameNotices(s: CardsState | null, enabled: boolean): void {
  const prev = useRef<{ d: number; a: number; t: number; full: boolean } | null>(null);
  useEffect(() => {
    if (!s) return;
    const n = s.events.notices;
    const full = s.wallet.energy >= s.wallet.energyMax;
    const p = prev.current;
    prev.current = { d: n.defenses, a: n.auctions, t: n.trades, full };
    if (!p) return;
    const list: [string, string][] = [];
    if (n.defenses > p.d) list.push(["На вас напали", "Ваш отряд защищался, пока вы были не в сети — загляните в журнал боёв."]);
    if (n.auctions > p.a) list.push(["Итоги аукциона", "Один из ваших лотов завершился."]);
    if (n.trades > p.t) list.push(["Предложение обмена", "Вам прислали карты на обмен."]);
    if (full && !p.full) list.push(["Энергия восстановлена", "Можно снова идти в бой."]);
    for (const [title, body] of list) {
      toast(`${title}. ${body}`);
      if (enabled && document.hidden) {
        try {
          new Notification(`AniGalaxy · ${title}`, { body, tag: `cg-${title}`, icon: "/favicon.ico" });
        } catch {
          /* ignore */
        }
      }
    }
  }, [s, enabled]);
}


function Intro({ children }: { children: React.ReactNode }) {
  return (
    <div className="cg">
      <section className="cg-hero2">
        <div>
          <span className="cg-eyebrow">ANIGALAXY COLLECTION</span>
          <h1>Коллекция</h1>
          {children}
        </div>
      </section>
    </div>
  );
}

export function CardsApp() {
  const account = useAccount();
  const { state: s, error, loading } = useCards();
  const [tab, setTab] = useState<TabId>("packs");
  const tries = useRef(0);
  const [notify, setNotify] = useState(false);
  useGameNotices(s, notify);

  useEffect(() => {
    if (account) ensureLoaded();
  }, [account]);

  useEffect(() => {
    const t = window.setTimeout(() => setNotify(canNotify()), 0);
    return () => window.clearTimeout(t);
  }, []);

  /* лёгкий опрос, пока вкладка открыта: энергия, нападения, аукцион */
  useEffect(() => {
    if (!account) return;
    const id = window.setInterval(() => {
      if (!document.hidden || canNotify()) void refresh();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [account]);

  useEffect(() => {
    try {
      const saved = window.location.hash.slice(1);
      if (TABS.some(([id]) => id === saved)) window.setTimeout(() => setTab(saved as TabId), 0);
    } catch {
      /* ignore */
    }
  }, []);

  /* арт подтягивается сервером в фоне — обновляем, пока он не докачался */
  const artCount = s?.art.length ?? 0;
  useEffect(() => {
    if (!s || artCount + (s.hidden?.length ?? 0) >= CATALOG.length) return;
    const id = window.setInterval(() => {
      if (document.hidden || tries.current > 40) return;
      tries.current += 1;
      void refresh();
    }, 25_000);
    return () => window.clearInterval(id);
  }, [s, artCount]);

  const pick = (t: TabId) => {
    if (t === "battle" && s && s.events.notices.defenses > 0) void act("notices-seen", { kind: "defense" });
    if (t === "auction" && s && s.events.notices.auctions > 0) void act("notices-seen", { kind: "auction" });
    setTab(t);
    try {
      window.history.replaceState(null, "", `#${t}`);
    } catch {
      /* ignore */
    }
  };

  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const n = (i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length;
    pick(TABS[n][0] as TabId);
    document.getElementById(`cg-tab-${TABS[n][0]}`)?.focus();
  };

  if (!account) {
    return (
      <Intro>
        <p>Коллекционируйте героев популярных аниме, открывайте паки, улучшайте, сражайтесь отрядом 4×4, торгуйтесь на аукционе и меняйтесь с друзьями.</p>
        <div className="cg-hero-actions" style={{ marginTop: 22 }}>
          <button type="button" className="cg-btn pri lg" onClick={() => openAuthDialog("register")}>
            Создать аккаунт и получить стартовый набор
          </button>
          <button type="button" className="cg-btn lg" onClick={() => openAuthDialog("login")}>
            Войти
          </button>
        </div>
      </Intro>
    );
  }

  if (!s) {
    return (
      <Intro>
        <p>{error && error !== "auth" ? `Не удалось загрузить: ${error}` : loading ? "Загружаем вашу коллекцию…" : "Нужен вход в аккаунт — войдите заново."}</p>
        {error && (
          <div className="cg-hero-actions" style={{ marginTop: 18 }}>
            <button type="button" className="cg-btn pri" onClick={() => void refresh()}>
              Повторить
            </button>
          </div>
        )}
      </Intro>
    );
  }

  const nt = s.events.notices;
  const badges: Record<string, number> = { battle: nt.defenses, auction: nt.auctions, trade: nt.trades };
  return (
    <div className="cg cg2" data-tab={tab}>
      <CardsBackdrop />
      <div className="cg-nav" role="tablist" aria-label="Разделы карточек">
        {TABS.map(([id, label], i) => (
          <button key={id} type="button" role="tab" id={`cg-tab-${id}`} aria-selected={tab === id} tabIndex={tab === id ? 0 : -1} className="cg-tab" onClick={() => pick(id as TabId)} onKeyDown={(e) => onTabKey(e, i)}>
            <TabIco id={id} size={22} />
            {label}
            {badges[id] ? <span className="cg-badge" aria-label={`Новых: ${badges[id]}`}>{badges[id]}</span> : null}
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-labelledby={`cg-tab-${tab}`} key={tab} className="cg-enter">
        {tab === "packs" && <PacksTab s={s} />}
        {tab === "forge" && <ForgeTab s={s} />}
        {tab === "sharpen" && <SharpenTab s={s} />}
        {tab === "battle" && <BattleTab s={s} />}
        {tab === "auction" && <AuctionTab s={s} me={account.nickname} />}
        {tab === "trade" && <TradeTab s={s} />}
        {tab === "collection" && <CollectionTab s={s} />}
        {tab === "progress" && <ProgressTab s={s} />}
        {tab === "season" && <SeasonTab s={s} />}
        {tab === "tiers" && <TierTab />}
      </div>
      <ToastHost />
    </div>
  );
}
