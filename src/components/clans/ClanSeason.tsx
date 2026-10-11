"use client";

import { useState } from "react";
import { FACTIONS, LEAGUES, leagueOf } from "@/lib/clans.game";
import { can, clanMembers, clanTier, type Clan, type ClanRole } from "@/lib/clans";
import {
  SEASON,
  seasonDaysLeft,
  setFaction,
  type ClanGameState,
} from "@/lib/clans.runtime";
import { num } from "./ClanWallet";

/**
 * Сезон и положение клана.
 *
 * Лига считается по очкам клана — тем же самым, что и место в топе. Отдельного
 * «сезонного счёта» нет намеренно: два рейтинга в одном разделе быстро
 * расходятся, и игрок перестаёт понимать, какой из них важнее.
 */

const DATE_FMT = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function ClanSeason({ clan, game }: { clan: Clan; game: ClanGameState }) {
  const days = seasonDaysLeft();
  const league = leagueOf(clan.points);
  const next = LEAGUES[LEAGUES.indexOf(league) + 1];
  const tier = clanTier(clan.points);
  const faction = FACTIONS.find((f) => f.id === game.faction) ?? FACTIONS[0];
  // Роль игрока определяет, какие решения ему вообще показывать
  const role: ClanRole = clanMembers(clan).find((m) => m.isPlayer)?.role ?? "member";
  const [message, setMessage] = useState("");

  const pct = next
    ? Math.min(100, Math.round(((clan.points - league.at) / (next.at - league.at)) * 100))
    : 100;

  const onFaction = (id: (typeof FACTIONS)[number]["id"]) => {
    const result = setFaction(id);
    if (!result.ok) setMessage(result.reason ?? "Не удалось");
    window.setTimeout(() => setMessage(""), 2600);
  };

  return (
    <div className="grid gap-4">
      <section
        data-reveal
        className="cl-reveal cl-panel cl-season p-5 sm:p-6"
        style={{ ["--c" as string]: league.color, ["--c2" as string]: clan.color }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="cl-lbl !mb-1">
              Сезон {String(SEASON.number).padStart(2, "0")}
            </p>
            <h2 className="font-accent text-2xl font-extrabold tracking-tight">{SEASON.name}</h2>
            <p className="mt-2 text-sm text-muted">
              До конца сезона: <b className="tabular-nums text-bright">{days}</b>{" "}
              {days === 1 ? "день" : days < 5 ? "дня" : "дней"} · {SEASON.days} дней всего
            </p>
          </div>
          <div className="text-right">
            <p className="cl-lbl !mb-1">Лига</p>
            <p className="font-accent text-2xl font-extrabold" style={{ color: league.color }}>
              {league.name}
            </p>
            <p className="text-xs text-muted">{tier.name}</p>
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-1.5 flex justify-between text-xs text-muted">
            <span>{num(clan.points)} очков</span>
            {next ? <span>{next.name} с {num(next.at)}</span> : <span>высшая лига</span>}
          </div>
          <div className="cl-bar" style={{ ["--p" as string]: pct }}>
            <i />
          </div>
          <p className="mt-2 text-xs text-muted">{league.perk}</p>
        </div>

        <ul className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {LEAGUES.map((item) => (
            <li
              key={item.id}
              className={`cl-league ${item.id === league.id ? "now" : ""}`}
              style={{ ["--c" as string]: item.color }}
            >
              <span className="glyph" aria-hidden>
                {item.id === "legend" ? "👑" : item.id === "diamond" ? "💎" : item.id === "gold" ? "🥇" : item.id === "silver" ? "🥈" : "🥉"}
              </span>
              <b>{item.name}</b>
              <em>{num(item.at)}</em>
            </li>
          ))}
        </ul>
      </section>

      {/* Фракция */}
      <section data-reveal className="cl-reveal cl-panel p-5 sm:p-6" style={{ ["--c" as string]: faction.color }}>
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-accent text-lg font-extrabold">Фракция клана</h3>
          <span className="text-xs text-muted">постоянный бонус всему составу</span>
        </div>
        <p className="mb-4 text-xs text-muted">{faction.motto}</p>

        <ul className="grid gap-2.5 sm:grid-cols-2">
          {FACTIONS.map((item) => (
            <li key={item.id} className={`cl-building ${item.id === faction.id ? "held" : ""}`} style={{ ["--c" as string]: item.color }}>
              <button
                type="button"
                className="flex w-full items-center gap-3 text-left"
                onClick={() => onFaction(item.id)}
                disabled={item.id === faction.id}
              >
                <span className="cl-building-glyph" aria-hidden>
                  {item.glyph}
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block text-sm text-white">{item.name}</b>
                  <em className="block text-xs not-italic text-muted">{item.perk}</em>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {message && (
          <p className="mt-3 rounded-xl bg-white/5 px-3 py-2 text-xs text-bright ring-1 ring-white/10">{message}</p>
        )}
      </section>

      {/* Журнал действий руководства */}
      <section data-reveal className="cl-reveal cl-panel p-5 sm:p-6" style={{ ["--c" as string]: clan.color }}>
        <h3 className="mb-3 font-accent text-lg font-extrabold">Журнал клана</h3>
        {game.log.length === 0 ? (
          <p className="text-sm text-muted">
            Пока пусто. Сюда попадают решения руководства: смена ролей, улучшения,
            захват регионов и выбор фракции.
          </p>
        ) : (
          <ul className="cl-log">
            {[...game.log].reverse().map((entry, i) => (
              <li key={`${entry.at}-${i}`}>
                <span className="cl-log-when">{DATE_FMT.format(entry.at)}</span>
                <span className="cl-log-text">{entry.text}</span>
                <span className="cl-log-who">{entry.who}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Право на решения */}
      <p className="text-xs leading-relaxed text-muted">
        {can(role, "editClan")
          ? "Ты — глава клана: решения по составу, базе и территории принимаешь ты."
          : can(role, "startWar")
            ? "Решения по базе и территории остаются за главой клана."
            : "Изменения в базе и составе согласуются с главой клана."}
      </p>
    </div>
  );
}