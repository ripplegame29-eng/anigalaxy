"use client";

/** Состав клана: вклад за неделю, роли, исключение, описание, выход. */

import { useState } from "react";
import { MEMBER_WEEK_CAP, MIN_MEMBER_GAIN, type ClanRole } from "@/lib/clan-rules";
import { CrownIcon } from "./ClanArt";
import { Avatar, Btn, Ico, Panel, RoleBadge, fmt, useClan } from "./common";

const ORDER: Record<ClanRole, number> = { leader: 0, officer: 1, member: 2 };

export function RosterTab() {
  const { me, clan, role, manage, act } = useClan();
  const [confirm, setConfirm] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState(clan.description);

  const members = [...(me.members ?? [])].sort((a, b) => ORDER[a.role] - ORDER[b.role] || b.gain - a.gain);
  const scale = Math.max(MIN_MEMBER_GAIN * 2, ...members.map((m) => m.gain));
  const active = members.filter((m) => m.gain >= MIN_MEMBER_GAIN).length;
  const total = members.reduce((s, m) => s + Math.min(m.gain, MEMBER_WEEK_CAP), 0);

  const run = async (key: string, action: string, body: Record<string, unknown>, ok: string) => {
    if (confirm !== key) return setConfirm(key);
    setConfirm(null);
    await act(action, body, ok);
  };

  return (
    <div className="ca-stack">
      <div className="ca-kpis">
        <div className="ca-kpi">
          <Ico n="roster" size={20} />
          <b>
            {clan.members}/{clan.cap}
          </b>
          <span>в составе</span>
        </div>
        <div className="ca-kpi">
          <Ico n="bolt" size={20} />
          <b>
            {active}/{members.length}
          </b>
          <span>активны за неделю</span>
        </div>
        <div className="ca-kpi">
          <Ico n="up" size={20} />
          <b>{fmt(total)}</b>
          <span>опыта за неделю</span>
        </div>
      </div>

      <Panel
        title="Описание клана"
        icon="edit"
        aside={
          manage &&
          !editing && (
            <Btn size="sm" onClick={() => { setDesc(clan.description); setEditing(true); }}>
              Изменить
            </Btn>
          )
        }
      >
        {editing ? (
          <div className="ca-form">
            <textarea className="ca-input" value={desc} maxLength={280} rows={3} onChange={(e) => setDesc(e.target.value)} aria-label="Описание клана" />
            <div className="ca-row">
              <Btn
                kind="primary"
                onClick={async () => {
                  if (await act("update", { description: desc }, "Описание сохранено")) setEditing(false);
                }}
              >
                Сохранить
              </Btn>
              <Btn onClick={() => setEditing(false)}>Отмена</Btn>
              <small className="ca-dim">{desc.length}/280</small>
            </div>
          </div>
        ) : (
          <p className={clan.description ? "" : "ca-dim"}>{clan.description || "Описание не заполнено."}</p>
        )}
      </Panel>

      <Panel title="Состав и вклад за неделю" icon="roster" aside={<span className="ca-dim">порог награды — {MIN_MEMBER_GAIN}</span>}>
        <ul className="ca-roster">
          {members.map((m) => {
            const mine = m.userId === me.uid;
            const canRole = role === "leader" && m.role !== "leader";
            const canKick = m.role !== "leader" && !mine && (role === "leader" || (role === "officer" && m.role === "member"));
            const ok = m.gain >= MIN_MEMBER_GAIN;
            return (
              <li key={m.userId} className={`${mine ? "me " : ""}${m.role}`}>
                <div className="ca-m-id">
                  <Avatar name={m.nickname} size={44} />
                  <div className="ca-m-name">
                    <b>
                      {m.role === "leader" && <CrownIcon size={15} />} {m.nickname}
                      {mine && <span className="ca-you">вы</span>}
                    </b>
                    <RoleBadge role={m.role} />
                  </div>
                </div>
                <div className="ca-m-gain">
                  <div className="ca-gbar" aria-hidden>
                    <i className={ok ? "ok" : ""} style={{ width: `${Math.min(100, (m.gain / scale) * 100)}%` }} />
                    <u style={{ left: `${(MIN_MEMBER_GAIN / scale) * 100}%` }} />
                  </div>
                  <b className={ok ? "ok" : ""}>{fmt(m.gain)}</b>
                </div>
                {(canRole || canKick) && (
                  <div className="ca-m-act">
                    {canRole && (
                      <Btn size="sm" onClick={() => void run(`r${m.userId}`, "role", { userId: m.userId, role: m.role === "officer" ? "member" : "officer" }, m.role === "officer" ? "Офицер разжалован" : "Назначен офицером")}>
                        {confirm === `r${m.userId}` ? "Точно?" : m.role === "officer" ? "Снять" : "В офицеры"}
                      </Btn>
                    )}
                    {canKick && (
                      <Btn size="sm" kind="danger" onClick={() => void run(`k${m.userId}`, "kick", { userId: m.userId }, "Игрок исключён")}>
                        {confirm === `k${m.userId}` ? "Исключить?" : "Исключить"}
                      </Btn>
                    )}
                    {(confirm === `r${m.userId}` || confirm === `k${m.userId}`) && (
                      <Btn size="sm" onClick={() => setConfirm(null)} aria-label="Отмена">
                        <Ico n="x" size={14} />
                      </Btn>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel className="ca-leave">
        <div className="ca-leave-in">
          <div>
            <b>Покинуть клан</b>
            <p className="ca-dim">
              {role === "leader" && clan.members > 1 ? "Вы глава: власть перейдёт к другому игроку клана." : "Вы всегда сможете вступить снова, пока есть места."}
            </p>
          </div>
          {confirm === "leave" ? (
            <div className="ca-row">
              <Btn kind="danger" onClick={() => void run("leave", "leave", {}, "Вы вышли из клана")}>
                Да, выйти
              </Btn>
              <Btn onClick={() => setConfirm(null)}>Остаться</Btn>
            </div>
          ) : (
            <Btn kind="danger" onClick={() => setConfirm("leave")}>
              <Ico n="logout" size={17} /> Выйти из клана
            </Btn>
          )}
        </div>
      </Panel>
    </div>
  );
}
