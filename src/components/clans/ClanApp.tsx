"use client";

/**
 * Клановый хаб: оболочка со вкладками. Данные — только с сервера (src/lib/clans/client.ts).
 * Выбранная вкладка хранится в хэше URL (#war) и в localStorage как запасной вариант.
 */

import "../../app/clans-aaa.css";
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { leagueOf, type ClanRole } from "@/lib/clan-rules";
import { clanAct, useClanDonate, useClanWar, useMyClan } from "@/lib/clans/client";
import { useAccount } from "@/lib/use-account";
import { ClanDonateTab } from "./ClanDonateTab";
import { ClansBackdrop } from "./ClansBackdrop";
import { ClanWarTab } from "./ClanWarTab";
import { ClanHero, OverviewTab } from "./Citadel";
import { Landing } from "./Landing";
import { LeagueTab } from "./LeagueTab";
import { RosterTab } from "./RosterTab";
import { ShopTab } from "./ShopTab";
import { ClanCtx, Ico, Skeleton, type ClanCtxValue, type TabId } from "./common";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "overview", label: "Обзор", icon: "overview" },
  { id: "war", label: "Война", icon: "war" },
  { id: "donate", label: "Донат", icon: "donate" },
  { id: "roster", label: "Состав", icon: "roster" },
  { id: "league", label: "Лига", icon: "league" },
  { id: "shop", label: "Магазин", icon: "shop" },
];
const IDS = TABS.map((t) => t.id) as string[];
const LS_KEY = "animehub:clans:tab:v1";

/* Вкладка = хэш URL (приоритет) → localStorage → «Обзор» */
const tabSubs = new Set<() => void>();
function readTab(): TabId {
  try {
    const h = window.location.hash.replace("#", "");
    if (IDS.includes(h)) return h as TabId;
  } catch {
    /* нет window.location */
  }
  try {
    const s = window.localStorage.getItem(LS_KEY);
    if (s && IDS.includes(s)) return s as TabId;
  } catch {
    /* приватный режим */
  }
  return "overview";
}
function subscribeTab(cb: () => void): () => void {
  tabSubs.add(cb);
  window.addEventListener("hashchange", cb);
  return () => {
    tabSubs.delete(cb);
    window.removeEventListener("hashchange", cb);
  };
}
function writeTab(id: TabId): void {
  try {
    window.history.replaceState(null, "", `#${id}`);
  } catch {
    /* ignore */
  }
  try {
    window.localStorage.setItem(LS_KEY, id);
  } catch {
    /* ignore */
  }
  tabSubs.forEach((f) => f());
}

export function ClanApp() {
  const account = useAccount();
  const { me, ready, reload } = useMyClan();
  const tab = useSyncExternalStore(subscribeTab, readTab, () => "overview" as TabId);
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; text: string; key: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((kind: "ok" | "err", text: string) => {
    if (timer.current) clearTimeout(timer.current);
    setFlash({ kind, text, key: Date.now() });
    timer.current = setTimeout(() => setFlash(null), kind === "err" ? 7000 : 3200);
  }, []);
  const go = useCallback((id: TabId) => {
    writeTab(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  const act = useCallback(
    async (action: string, body: Record<string, unknown> = {}, okText = "") => {
      const r = await clanAct(action, body);
      if (r.ok) {
        if (okText) notify("ok", okText);
      } else notify("err", r.error);
      return r.ok;
    },
    [notify],
  );

  const clan = me?.clan ?? null;
  const role: ClanRole = (me?.members?.find((m) => m.userId === me.uid)?.role ?? "member") as ClanRole;
  const ctx: ClanCtxValue | null = useMemo(
    () => (me && clan ? { me, clan, role, manage: role === "leader" || role === "officer", go, act, notify, reload } : null),
    [me, clan, role, go, act, notify, reload],
  );

  const flashEl = flash && (
    <div key={flash.key} className={`ca-toast ca-toast-${flash.kind}`} role={flash.kind === "err" ? "alert" : "status"}>
      <Ico n={flash.kind === "err" ? "alert" : "check"} size={18} />
      <span>{flash.text}</span>
      <button type="button" onClick={() => setFlash(null)} aria-label="Закрыть">
        <Ico n="x" size={16} />
      </button>
    </div>
  );

  if (!ready && account) {
    return (
      <div className="ca">
        <ClansBackdrop color="#ffc65a" />
        <div className="ca-root ca-load">
          <Skeleton h={260} />
          <Skeleton h={64} />
          <Skeleton h={320} />
        </div>
      </div>
    );
  }

  if (!ctx || !clan) {
    return (
      <div className="ca">
        <ClansBackdrop color="#ffc65a" />
        <div className="ca-root">
          <Landing guest={!account} onDone={() => go("overview")} />
        </div>
        {flashEl}
      </div>
    );
  }

  return (
    <ClanCtx.Provider value={ctx}>
      <div className="ca">
        <ClansBackdrop color={leagueOf(clan.league).color} />
        <div className="ca-root" style={{ ["--lc" as string]: leagueOf(clan.league).color, ["--lc2" as string]: leagueOf(clan.league).deep }}>
          <ClanHero compact={tab !== "overview"} />
          <Rail tab={tab} onPick={go} />
          <main className="ca-main" id="ca-main" key={tab}>
            {tab === "overview" && <OverviewTab />}
            {tab === "war" && <ClanWarTab />}
            {tab === "donate" && <ClanDonateTab />}
            {tab === "roster" && <RosterTab />}
            {tab === "league" && <LeagueTab />}
            {tab === "shop" && <ShopTab />}
          </main>
        </div>
        {flashEl}
      </div>
    </ClanCtx.Provider>
  );
}

/** Верхняя рейка вкладок (десктоп) и нижняя панель (мобильный) — один и тот же <nav> */
function Rail({ tab, onPick }: { tab: TabId; onPick: (t: TabId) => void }) {
  const { me } = useMyClan();
  const { war } = useClanWar();
  const { donate } = useClanDonate();
  const badges: Partial<Record<TabId, number>> = {};
  const w = war?.war;
  if (w && w.phase === "battle" && (w.me?.attacksLeft ?? 0) > 0) badges.war = w.me!.attacksLeft;
  const help = (donate?.requests ?? []).filter((r) => !r.mine && r.canGive > 0 && r.got < r.want).length;
  if (help) badges.donate = help;
  const g = me?.goals;
  if (g?.eligible) {
    const n = g.reached.filter((t) => !g.claimed.includes(t)).length;
    if (n) badges.overview = n;
  }
  return (
    <nav className="ca-rail" aria-label="Разделы клана">
      <div className="ca-rail-in" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? "on" : ""}
            onClick={() => onPick(t.id)}
          >
            <Ico n={t.icon} size={22} stroke={tab === t.id ? 2.2 : 1.8} />
            <span>{t.label}</span>
            {badges[t.id] ? <i className="ca-badge">{badges[t.id]}</i> : null}
          </button>
        ))}
      </div>
    </nav>
  );
}
