"use client";

/** Лига: таблица недели с зонами, обратный отсчёт, итоги прошлых недель, лестница лиг и наград. */

import { LEAGUES, MIN_RANKED_MEMBERS, MOVE_FRACTION, SEASON_REWARDS, leagueOf, rewardForRank } from "@/lib/clan-rules";
import { LeagueBadge, TrophyIcon } from "./ClanArt";
import { Ico, Panel, countdown, fmt, useClan, useNow } from "./common";

export function LeagueTab() {
  const { me, clan } = useClan();
  const now = useNow();
  const lg = leagueOf(clan.league);
  const table = me.table ?? [];
  const mine = table.find((r) => r.clanId === clan.id);
  const left = me.season && now ? me.season.endsAt - now : 0;
  const reward = mine ? rewardForRank(mine.rank) : undefined;
  const results = me.results ?? [];

  return (
    <div className="ca-league">
      <Panel className="ca-lg-hero">
        <div className="ca-lg-hero-in">
          <LeagueBadge league={clan.league} size={96} />
          <div className="ca-lg-hero-t">
            <span className="ca-eyebrow">Лига недели</span>
            <h2 className="ca-display ca-lg-name">{lg.name}</h2>
            <p className="ca-dim">
              {mine ? (
                <>
                  Вы на <b>{mine.rank}</b> месте · {fmt(mine.points)} очков
                  {mine.zone === "up" && <span className="ca-zone up"> ▲ зона повышения</span>}
                  {mine.zone === "down" && <span className="ca-zone down"> ▼ зона понижения</span>}
                </>
              ) : (
                `В рейтинг попадают кланы от ${MIN_RANKED_MEMBERS} игроков.`
              )}
            </p>
          </div>
          <div className="ca-lg-timer">
            <Ico n="clock" size={18} />
            <b>{me.season && now ? countdown(left) : "…"}</b>
            <span>до итогов недели</span>
          </div>
        </div>
        {clan.members < MIN_RANKED_MEMBERS && (
          <p className="ca-note">
            <Ico n="alert" size={16} /> В клане {clan.members} из {MIN_RANKED_MEMBERS} игроков — пока вы вне рейтинга и наград за место.
          </p>
        )}
      </Panel>

      <Panel title={`Таблица · «${lg.name}»`} icon="league" className="ca-lg-table" aside={<span className="ca-dim">топ-{Math.round(MOVE_FRACTION * 100)}% вверх · низ {Math.round(MOVE_FRACTION * 100)}% вниз</span>}>
        <ol className="ca-table">
          {table.map((r) => (
            <li key={r.clanId} className={`${r.clanId === clan.id ? "me " : ""}${r.zone}`}>
              <span className="n">{r.rank <= 3 ? <i className={`medal m${r.rank}`}>{r.rank}</i> : r.rank}</span>
              <span className="nm">
                <b>{r.name}</b> <small>[{r.tag}]</small>
                <em>
                  ур. {r.level} · {r.members} игр.
                </em>
              </span>
              <span className="pt">{fmt(r.points)}</span>
              <span className="zn" aria-label={r.zone === "up" ? "Зона повышения" : r.zone === "down" ? "Зона понижения" : ""}>
                {r.zone === "up" ? <Ico n="up" size={16} stroke={2.4} /> : r.zone === "down" ? <Ico n="down" size={16} stroke={2.4} /> : null}
              </span>
            </li>
          ))}
          {table.length === 0 && <li className="ca-empty-row">В этой лиге пока нет кланов в рейтинге.</li>}
        </ol>
        <div className="ca-legend">
          <span className="up">
            <i /> Повышение
          </span>
          <span>
            <i /> Остаётесь
          </span>
          <span className="down">
            <i /> Понижение
          </span>
        </div>
      </Panel>

      <Panel title="Награды за место" icon="star" className="ca-rewards">
        <ul className="ca-ladder-r">
          {SEASON_REWARDS.map((r) => {
            const on = reward?.label === r.label;
            return (
              <li key={r.label} className={on ? "me" : ""}>
                <b className="rk">{r.label}</b>
                <span>
                  <small>игроку</small> {r.memberAc} AC
                </span>
                <span>
                  <small>в казну</small> {fmt(r.treasuryAc)} AC
                </span>
                <span className="tr">
                  {r.trophies ? (
                    <>
                      <TrophyIcon size={15} /> +{r.trophies}
                    </>
                  ) : (
                    "—"
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel title="Лестница лиг" icon="up" className="ca-leagues">
        <ol className="ca-lgs">
          {LEAGUES.map((l) => (
            <li key={l.id} className={l.id === clan.league ? "cur" : l.id < clan.league ? "past" : ""} style={{ ["--lc" as string]: l.color }}>
              <LeagueBadge league={l.id} size={l.id === clan.league ? 62 : 46} />
              <span>{l.name}</span>
            </li>
          ))}
        </ol>
      </Panel>

      <Panel title="Итоги прошлых недель" icon="clock" className="ca-history" aside={<span className="ca-dim"><TrophyIcon size={14} /> {fmt(clan.trophies)}</span>}>
        {results.length === 0 ? (
          <p className="ca-empty-row">Первые итоги появятся после завершения недели.</p>
        ) : (
          <ul className="ca-hist">
            {results.map((r) => (
              <li key={r.season}>
                <LeagueBadge league={r.league} size={34} />
                <div>
                  <b>{r.rank} место</b>
                  <small>
                    Неделя {r.season} · {fmt(r.points)} очк.
                  </small>
                </div>
                <span className={`ca-mv ${r.move > 0 ? "up" : r.move < 0 ? "down" : ""}`}>
                  {r.move > 0 ? "▲ повышение" : r.move < 0 ? "▼ понижение" : "без изменений"}
                </span>
                {r.trophies > 0 && (
                  <span className="ca-tr-g">
                    <TrophyIcon size={14} /> +{r.trophies}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
