"use client";

import { useState } from "react";
import {
  ASSIGNABLE_ROLES,
  ROLE_LABEL,
  canEditMember,
  clanMembers,
  kickMember,
  rightsOf,
  setMemberRole,
  type Clan,
  type ClanMember,
  type ClanRole,
} from "@/lib/clans";
import { SPECIALIZATIONS, type ClanSpecialization } from "@/lib/clans.game";
import {
  canSwitchSpec,
  setSpecialization,
  specOfMember,
  type ClanGameState,
} from "@/lib/clans.runtime";
import { num } from "./ClanWallet";

/**
 * Состав клана: роли, права и специализации.
 *
 * Права показаны не списком, а тем, что реально можно сделать: у каждого
 * участника есть «выдать роль» и «исключить», и они доступны ровно тогда,
 * когда роль это позволяет. Право, которым нельзя воспользоваться, прячется
 * целиком — серый переключатель учил бы игрока нажимать на то, что не
 * работает, вместо того чтобы показать границу полномочий.
 */

const ROLE_ORDER: ClanRole[] = ["owner", "admin", "moderator", "member"];

/** Цвет роли — тот же язык, что у рангов в топе */
const ROLE_COLOR: Record<ClanRole, string> = {
  owner: "#ffb020",
  admin: "#ff4d6d",
  moderator: "#3d7dff",
  member: "#8b93a7",
};

export function ClanRoster({
  clan,
  game,
}: {
  clan: Clan;
  game: ClanGameState;
}) {
  const roster = clanMembers(clan);
  const me = roster.find((m) => m.isPlayer);
  const [message, setMessage] = useState("");
  const specOpen = canSwitchSpec(game);

  // Владелец первым, остальные — по роли и вкладу: так состав читается
  // сверху вниз по значимости, а не по порядку в массиве
  const sorted = [...roster].sort(
    (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || b.contributed - a.contributed,
  );

  const report = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 3200);
  };

  const onRole = (member: ClanMember, role: ClanRole) => {
    const result = setMemberRole(member.id, role);
    if (!result.ok) report(result.reason ?? "Не удалось");
  };

  const onKick = (member: ClanMember) => {
    if (!window.confirm(`Исключить ${member.name} из клана?`)) return;
    const result = kickMember(member.id);
    report(result.ok ? `${member.name} исключён` : (result.reason ?? "Не удалось"));
  };

  const onSpec = (member: ClanMember, spec: ClanSpecialization) => {
    const result = setSpecialization(member.id, spec);
    report(result.ok ? "Специализация назначена" : (result.reason ?? "Не удалось"));
  };

  return (
    <div className="grid gap-4">
      <section data-reveal className="cl-reveal cl-panel p-5 sm:p-6" style={{ ["--c" as string]: clan.color }}>
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <h2 className="font-accent text-lg font-extrabold">Состав клана</h2>
          <span className="text-xs text-muted">{roster.length} участников</span>
        </div>
        <p className="mb-4 text-xs text-muted">
          Роль определяет права. Специализацию меняет владелец раз в сутки — иначе
          состав можно было бы перебирать под каждое задание.
        </p>

        <ul className="grid gap-2.5">
          {sorted.map((member) => {
            const spec = specOfMember(game, member.id);
            const editable = canEditMember(me, member);
            const kickable = Boolean(me) && !member.isPlayer && me?.id !== member.id
              && rightsOf(me?.role ?? "member").includes("kickMember");

            return (
              <li key={member.id} className="cl-member">
                <span
                  className="cl-member-avatar"
                  style={{ ["--c" as string]: ROLE_COLOR[member.role] }}
                  aria-hidden
                >
                  {member.name.slice(0, 1).toUpperCase()}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-bold text-white">{member.name}</span>
                    <span
                      className="cl-role"
                      style={{ ["--c" as string]: ROLE_COLOR[member.role] }}
                    >
                      {ROLE_LABEL[member.role]}
                    </span>
                    {member.isPlayer && <span className="cl-you">это ты</span>}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    Вклад {num(member.contributed)}
                    {spec ? ` · ${SPECIALIZATIONS.find((s) => s.id === spec)?.name}` : " · без специализации"}
                    {member.joinedAt ? ` · с ${member.joinedAt}` : ""}
                  </p>

                  {editable && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {ASSIGNABLE_ROLES.map((role) => (
                        <button
                          key={role}
                          type="button"
                          className="cl-pick sm"
                          aria-pressed={member.role === role}
                          onClick={() => onRole(member, role)}
                          style={{
                            ["--c" as string]: ROLE_COLOR[role],
                            ...(member.role === role
                              ? { background: `${ROLE_COLOR[role]}33`, boxShadow: `inset 0 0 0 1px ${ROLE_COLOR[role]}` }
                              : {}),
                          }}
                        >
                          {ROLE_LABEL[role]}
                        </button>
                      ))}
                      {kickable && (
                        <button type="button" className="cl-pick sm ghost" onClick={() => onKick(member)}>
                          Исключить
                        </button>
                      )}
                    </div>
                  )}

                  {editable && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {SPECIALIZATIONS.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          title={item.perk}
                          disabled={!specOpen}
                          className="cl-pick sm"
                          aria-pressed={spec === item.id}
                          onClick={() => onSpec(member, item.id)}
                          style={{
                            ["--c" as string]: "#b06bff",
                            ...(spec === item.id
                              ? { background: "#b06bff33", boxShadow: "inset 0 0 0 1px #b06bff" }
                              : {}),
                          }}
                        >
                          {item.glyph} {item.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {message && (
          <p className="mt-3 rounded-xl bg-white/5 px-3 py-2 text-xs text-bright ring-1 ring-white/10">{message}</p>
        )}
        {!specOpen && (
          <p className="mt-3 text-xs text-muted">
            Смена специализации доступна завтра. Это ограничение защищает состав от подгонки под задания.
          </p>
        )}
      </section>

      {/* Что умечает каждая роль — легенда, чтобы права не были загадкой */}
      <section data-reveal className="cl-reveal cl-panel p-5">
        <h3 className="mb-3 font-accent text-sm font-extrabold uppercase tracking-wider text-muted">Полномочия</h3>
        <ul className="grid gap-2 sm:grid-cols-2">
          {ROLE_ORDER.map((role) => (
            <li key={role} className="rounded-xl bg-white/[0.04] px-3 py-2.5 ring-1 ring-white/10">
              <span className="cl-role" style={{ ["--c" as string]: ROLE_COLOR[role] }}>
                {ROLE_LABEL[role]}
              </span>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">{RIGHTS_TEXT[role]}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Права словами: список идентификаторов пользователю ничего не говорит */
const RIGHTS_TEXT: Record<ClanRole, string> = {
  owner: "Всё, что могут остальные, плюс роспуск клана и передача прав",
  admin: "Назначение ролей, исключение участников, редактирование клана",
  moderator: "Исключение участников и модерация состава",
  member: "Взносы, задания, экспедиции и доступ к залу",
};