"use client";

import { ROLES, ROLE_ORDER, can, levelFromXp, memberCap, type Role } from "@/lib/clan2/data";
import { acceptApplicant, declineApplicant, kick, setRole, transferLead, type ClanV2State } from "@/lib/clan2/store";
import { RoleChip, num, useNote } from "./common";

export function RosterTab({ s }: { s: ClanV2State }) {
  const [note, say] = useNote();
  const clan = s.clan!;
  const cap = memberCap(levelFromXp(clan.xp));
  const me = ROLES[s.selfRole].rank;
  const manage = can.manage(s.selfRole);
  const sorted = [...s.members].sort((a, b) => ROLES[b.role].rank - ROLES[a.role].rank || b.totalXp - a.totalXp);

  const ranksBelow = ROLE_ORDER.filter((r) => ROLES[r].rank < me && r !== "leader");

  return (
    <div className="c2-grid2 roster">
      <section className="c2-card">
        <div className="c2-rhead">
          <h3>Состав</h3>
          <span>{s.members.length} / {cap} · места растут с уровнем клана</span>
        </div>
        <ul className="c2-members">
          {sorted.map((m) => {
            const mine = m.id === "self";
            const editable = manage && !mine && ROLES[m.role].rank < me;
            return (
              <li key={m.id} className={mine ? "me" : ""}>
                <span className="av" aria-hidden>{m.name.slice(0, 1).toUpperCase()}</span>
                <div className="grow">
                  <b>{m.name}{mine ? " (вы)" : ""}</b>
                  <small>{num(m.totalXp)} опыта всего · {num(m.weekXp)} за неделю</small>
                </div>
                {editable ? (
                  <span className="act">
                    <select aria-label={`Роль: ${m.name}`} value={m.role} onChange={(e) => say(setRole(m.id, e.target.value as Role), "Роль изменена")}>
                      {[...ranksBelow, m.role].filter((r, i, a) => a.indexOf(r) === i).map((r) => (
                        <option key={r} value={r}>{ROLES[r].name}</option>
                      ))}
                    </select>
                    <button type="button" className="danger" onClick={() => say(kick(m.id), `${m.name} исключён`)}>Исключить</button>
                    {s.selfRole === "leader" && <button type="button" onClick={() => window.confirm(`Передать главенство игроку ${m.name}?`) && say(transferLead(m.id), "Главенство передано")}>Передать главенство</button>}
                  </span>
                ) : (
                  <RoleChip role={m.role} />
                )}
              </li>
            );
          })}
        </ul>
        {note && <p className="c2-note" role="status">{note}</p>}
      </section>

      <div className="c2-col">
        <section className="c2-card">
          <h3>Заявки на вступление</h3>
          {!manage ? (
            <p className="c2-sub">Заявки рассматривают офицеры и глава.</p>
          ) : s.applicants.length === 0 ? (
            <p className="c2-sub">Новых заявок нет. Кандидаты появляются, пока клан открыт и есть свободные места.</p>
          ) : (
            <ul className="c2-apps">
              {s.applicants.map((a) => (
                <li key={a.id}>
                  <div className="grow">
                    <b>{a.name} <em>· {a.level} ур.</em></b>
                    <small>{a.note}</small>
                  </div>
                  <button type="button" onClick={() => say(acceptApplicant(a.id), `${a.name} принят`)}>Принять</button>
                  <button type="button" className="ghost" onClick={() => say(declineApplicant(a.id), "Заявка отклонена")}>Отклонить</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="c2-card">
          <h3>Роли</h3>
          <ul className="c2-roles">
            {ROLE_ORDER.map((r) => (
              <li key={r}><RoleChip role={r} /><small>{ROLES[r].perk}</small></li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
