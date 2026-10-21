"use client";

import { useState, type CSSProperties } from "react";
import { CHEST_TIERS, can } from "@/lib/clan2/data";
import { bonuses, claimChest, contribute, exchange, goalsDone, isClaimed, type ClanV2State } from "@/lib/clan2/store";
import { useProgress } from "@/lib/progression/events";
import { Bar, RoleChip, num, useNote } from "./common";

export function VaultTab({ s }: { s: ClanV2State }) {
  const clan = s.clan!;
  const ac = useProgress().progress.acBalance;
  const [custom, setCustom] = useState("");
  const [note, say] = useNote();
  const done = goalsDone(s);
  const b = bonuses(s);
  const board = [...s.members].sort((a, c) => c.weekXp - a.weekXp).slice(0, 8);
  const top = Math.max(1, board[0]?.weekXp ?? 1);

  return (
    <div className="c2-grid2">
      <div className="c2-col">
        <section className="c2-card c2-vault">
          <div className="c2-vault-top">
            <span className="coin" aria-hidden><img src="/coin.png" alt="" width={44} height={44} /></span>
            <div>
              <small>Общая казна</small>
              <b>{num(clan.vault)} AC</b>
            </div>
            <div className="r">
              <small>Влияние</small>
              <b>{num(clan.influence)}</b>
            </div>
          </div>
          <p className="c2-sub">Вклад идёт в казну и копит опыт клана и влияние (1 AC → 1 опыт, 0,5 влияния; с Premium опыта ×1,5). Ваш баланс: {num(ac)} AC.</p>
          <div className="c2-quick">
            {[50, 200, 1000].map((n) => (
              <button key={n} type="button" disabled={ac < n} onClick={() => say(contribute(n), `Внесено ${n} AC`)}>{n} AC</button>
            ))}
            <form onSubmit={(e) => { e.preventDefault(); say(contribute(Number(custom)), `Внесено ${custom} AC`); setCustom(""); }}>
              <input inputMode="numeric" placeholder="Своя сумма" value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, ""))} aria-label="Своя сумма вклада" />
              <button type="submit" disabled={!custom}>Внести</button>
            </form>
          </div>
          {can.manage(s.selfRole) && (
            <div className="c2-quick">
              <span className="lbl">Мобилизация: 10 AC казны → 6 влияния</span>
              {[100, 500].map((n) => (
                <button key={n} type="button" disabled={clan.vault < n} onClick={() => say(exchange(n), `${n} AC → ${Math.floor(n * 0.6)} влияния`)}>{n} AC</button>
              ))}
            </div>
          )}
          {note && <p className="c2-note" role="status">{note}</p>}
        </section>

        <section className="c2-card">
          <h3>Вклад участников за неделю</h3>
          <ol className="c2-board">
            {board.map((m, i) => (
              <li key={m.id} className={m.id === "self" ? "me" : ""}>
                <span className="pos">{i + 1}</span>
                <div className="grow">
                  <b>{m.name}{m.id === "self" ? " (вы)" : ""}</b>
                  <RoleChip role={m.role} />
                  <Bar pct={m.weekXp / top} label={m.name} />
                </div>
                <span className="n">{num(m.weekXp)}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="c2-card">
        <h3>Сундуки недели</h3>
        <p className="c2-sub">Выполнено целей: {done} из 3. Награда личная: каждый участник забирает её сам.{b.chest ? ` Территории дают +${b.chest}%.` : ""}</p>
        <ul className="c2-chests">
          {CHEST_TIERS.map((t) => {
            const open = done >= t.need;
            const got = isClaimed(s, t.id);
            const amount = Math.round(t.ac * (1 + b.chest / 100));
            return (
              <li key={t.id} className={`${open ? "open" : ""} ${got ? "got" : ""}`} style={{ ["--tc" as string]: t.color } as CSSProperties}>
                <span className="box" aria-hidden>{got ? "📭" : open ? "🎁" : "🔒"}</span>
                <div className="grow">
                  <b>{t.name} сундук</b>
                  <small>Нужно целей: {t.need} · награда {amount} AC</small>
                </div>
                <button type="button" disabled={!open || got} onClick={() => say(claimChest(t.id), `+${amount} AC`)}>
                  {got ? "Получено" : open ? "Забрать" : "Закрыт"}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
