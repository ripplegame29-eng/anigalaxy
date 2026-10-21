"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { ROLES, levelProgress } from "@/lib/clan2/data";
import { itemOf, emblemOf } from "@/lib/clan2/shop";
import type { TerritoryId } from "@/lib/clan2/data";
import { EmblemArt } from "./EmblemArt";
import { WarTab } from "./WarTab";
import { ShopTab } from "./ShopTab";
import { TreasuryTab } from "./TreasuryTab";
import { disbandClan, leaveClan, syncClan, useClan2 } from "@/lib/clan2/store";
import { useProgress } from "@/lib/progression/events";
import { useAccount } from "@/lib/use-account";
import { weekIndexOf, dayIndex } from "@/lib/progression/time";
import { ClansBackdrop } from "./ClansBackdrop";
import { Bar, Emblem, num, useNote } from "./common";
import { Citadel, type TabId } from "./Citadel";
import { EventsTab } from "./EventsTab";
import { LandTab } from "./LandTab";
import { RosterTab } from "./RosterTab";
import { VaultTab } from "./VaultTab";
import { Landing } from "./Landing";
import "../../app/clan2.css";
import "../../app/clan2-war.css";

const TABS: { id: TabId; label: string }[] = [
  { id: "citadel", label: "Цитадель" },
  { id: "events", label: "Рейд недели" },
  { id: "land", label: "Территории" },
  { id: "roster", label: "Состав" },
  { id: "war", label: "Война" },
  { id: "vault", label: "Сундук и казна" },
  { id: "treasury", label: "Сокровищница" },
  { id: "shop", label: "Лавка" },
];

export function ClanApp() {
  const s = useClan2();
  const account = useAccount();
  const selfName = account?.displayName || account?.nickname || "Вы";
  const doc = useProgress();
  const [tab, setTab] = useState<TabId>("citadel");
  const [note, say] = useNote();
  const [preset, setPreset] = useState<{ rivalId: string; stake: TerritoryId } | null>(null);
  const assault = useCallback((rivalId: string, stake: TerritoryId) => { setPreset({ rivalId, stake }); setTab("war"); }, []);

  /* Мир клана идёт по часам и по реальной активности на сайте */
  useEffect(() => {
    // Серии за неделю берём из документа прогрессии — единственного источника активности
    const today = dayIndex(Date.now(), doc.progress.tz);
    const fresh = doc.daily.date === today && doc.daily.week === weekIndexOf(today);
    const episodes = fresh ? (doc.daily.weekCounts.EP_COMPLETE ?? 0) : 0;
    syncClan(episodes);
    const id = window.setInterval(() => syncClan(episodes), 60_000);
    return () => window.clearInterval(id);
  }, [doc, s.clan?.id]);

  const clan = s.clan;
  const lp = clan ? levelProgress(clan.xp) : null;
  const bg = s.equipped.background ? itemOf(s.equipped.background) : undefined;
  const customBg = !!bg?.css && bg.id !== "clan-bg-standard";
  const art = s.equipped.emblem ? emblemOf(s.equipped.emblem) : undefined;
  const decos = s.equipped.decos.map((d) => itemOf(d)?.deco).filter(Boolean) as string[];
  const skin: CSSProperties = customBg ? { background: bg!.css, backgroundSize: bg!.backgroundSize } : {};

  return (
    <div className="c2-page" style={{ ["--c" as string]: clan?.color ?? "#4d8bff", ...skin } as CSSProperties}>
      {customBg ? <div className="c2-veil" style={bg?.veil ? { background: bg.veil } : undefined} aria-hidden /> : <ClansBackdrop color={clan?.color} />}
      <div className="c2-wrap">
        <header className={`c2-head ${decos.map((d) => `deco-${d}`).join(" ")}`}>
          {clan && art ? <span className={`c2-art ${decos.filter((d) => /frame|halo|trail/.test(d)).map((d) => `deco-${d}`).join(" ")}`}><EmblemArt emblem={art} size={84} /></span> : clan ? <Emblem clan={clan} size={68} /> : <Emblem clan={{ emblem: "🛡️", color: "#4d8bff" }} size={68} />}
          <div className="grow">
            <small className="c2-kicker">Кланы · сезон 01</small>
            <h1>{clan ? clan.name : "Кланы AniGalaxy"}</h1>
            <p>
              {clan
                ? `[${clan.tag}] · ${ROLES[s.selfRole].glyph} ${ROLES[s.selfRole].name}${clan.motto ? ` · «${clan.motto}»` : ""}`
                : "Собирайте отряд, бейте боссов, захватывайте карту и делите награды"}
            </p>
          </div>
          {clan && lp && (
            <div className="c2-lvl">
              <div><b>Уровень {lp.level}</b><small>{num(lp.into)} / {num(lp.need)} · ✦ {num(clan!.prestige)}</small></div>
              <Bar pct={lp.pct} label="Опыт клана" />
            </div>
          )}
        </header>

        {!clan ? (
          <Landing selfName={selfName} />
        ) : (
          <>
            <nav className="c2-tabs" role="tablist" aria-label="Разделы клана">
              {TABS.map((t) => (
                <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
                  {t.label}
                  {t.id === "roster" && s.applicants.length > 0 && <i className="dot" />}
                  {t.id === "war" && s.war && !s.war.result && <i className="dot live" />}
                </button>
              ))}
            </nav>
            {tab === "citadel" && <Citadel s={s} onGo={setTab} />}
            {tab === "events" && <EventsTab s={s} />}
            {tab === "land" && <LandTab s={s} onAssault={assault} />}
            {tab === "roster" && <RosterTab s={s} />}
            {tab === "vault" && <VaultTab s={s} />}
            {tab === "war" && <WarTab s={s} preset={preset} />}
            {tab === "treasury" && <TreasuryTab s={s} />}
            {tab === "shop" && <ShopTab s={s} />}

            <footer className="c2-foot">
              {s.selfRole === "leader" ? (
                <button type="button" onClick={() => window.confirm("Распустить клан? Казна, территории и состав исчезнут.") && say(disbandClan())}>Распустить клан</button>
              ) : (
                <button type="button" onClick={() => window.confirm("Покинуть клан?") && say(leaveClan())}>Покинуть клан</button>
              )}
              {note && <span role="status">{note}</span>}
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
