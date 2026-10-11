"use client";

import { useEffect, useState } from "react";
import { TIER_LABEL, type CandidateTier } from "@/lib/clans";
import type { Clan } from "@/lib/clans";
import {
  acceptApplication,
  acceptInvite,
  declineApplication,
  invite,
  inviteCandidates,
  memberCap,
  rosterRoom,
  settleInvites,
  syncApplications,
} from "@/lib/clans.social";
import { clanGame, useClanGame, type ClanGameState } from "@/lib/clans.runtime";
import { num } from "./ClanWallet";

/**
 * Заявки и приглашения.
 *
 * Заявки приходят сами — они выведены из даты, а не из случайного броска,
 * и повторяются при перезагрузке страницы. Приглашение, наоборот, игрок
 * отправляет сам и получает ответ: склонность кандидата выводится из
 * очков клана, поэтому состав — следствие успехов, а не лотереи.
 */
export function ClanRecruit({ clan, game }: { clan: Clan; game: ClanGameState }) {
  const [, setTick] = useState(0);
  const [message, setMessage] = useState("");

  const room = rosterRoom(clan, game);
  const cap = memberCap(game);
  const canInvite = room > 0;

  // Заявки дня материализуются в стор: кнопка «Принять» работает с
  // сохранёнными, а не с посчитанными на лету
  useEffect(() => {
    syncApplications(clan);
  }, [clan]);

  const say = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 3200);
  };

  // Ответы на приглашения приходят сами: один тик на раздел
  const settle = () => {
    const settled = settleInvites(clan);
    if (settled.length > 0) setTick((n) => n + 1);
  };

  const applications = game.applications;
  const candidates = inviteCandidates(clan, game).slice(0, 4);
  const pendingInvites = game.invites;

  return (
    <section
      data-reveal
      className="cl-reveal cl-panel p-5 sm:p-6"
      style={{ ["--c" as string]: clan.color }}
    >
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-accent text-sm font-extrabold uppercase tracking-wider text-muted">
          Набор в клан
        </h3>
        <span className="text-xs text-muted">
          мест {num(room)} из {cap} · потолок растёт веткой «Сообщество»
        </span>
      </div>

      {message && (
        <p className="cl-toast mb-3" role="status">
          {message}
        </p>
      )}

      {/* Входящие заявки */}
      {applications.length > 0 && (
        <ul className="mb-4 grid gap-2">
          {applications.map((application) => (
            <li key={application.id} className="cl-war-task">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <b className="text-sm text-white">{application.name}</b>
                    <span className="cl-role" style={{ ["--c" as string]: "#b06bff" }}>
                      {TIER_LABEL[application.tier as CandidateTier]}
                    </span>
                    <span className="text-xs tabular-nums text-muted">ур. {application.level}</span>
                  </div>
                  <p className="mt-0.5 text-xs italic text-muted">«{application.message}»</p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    className="cl-pick sm"
                    disabled={room <= 0}
                    style={{ ["--c" as string]: clan.color }}
                    onClick={() => {
                      const result = acceptApplication(application.id, clan, game);
                      if (result.ok) {
                        say(`${application.name} принят в клан`);
                        settle();
                      } else {
                        say(result.reason ?? "Не удалось");
                      }
                    }}
                  >
                    Принять
                  </button>
                  <button
                    type="button"
                    className="cl-pick sm ghost"
                    onClick={() => {
                      declineApplication(application.id, clan);
                      say("Заявка отклонена");
                    }}
                  >
                    Отклонить
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Отправленные приглашения */}
      {pendingInvites.length > 0 && (
        <ul className="mb-4 grid gap-2">
          {pendingInvites.map((item) => (
            <li key={item.id} className="cl-war-task">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <b className="text-sm text-white">{item.name}</b>
                {item.answer === "accepted" ? (
                  <div className="flex items-center gap-2">
                    <span className="cl-quest-badge done">согласился</span>
                    <button
                      type="button"
                      className="cl-pick sm"
                      disabled={room <= 0}
                      style={{ ["--c" as string]: clan.color }}
                      onClick={() => {
                        const result = acceptInvite(item.id, clan, game);
                        say(result.ok ? `${item.name} вступил в клан` : (result.reason ?? "Не удалось"));
                      }}
                    >
                      Впустить
                    </button>
                  </div>
                ) : item.answer === "declined" ? (
                  <span className="cl-quest-badge">отказал</span>
                ) : (
                  <button
                    type="button"
                    className="cl-pick sm"
                    onClick={() => {
                      settle();
                      say("Ждём ответа");
                    }}
                  >
                    Проверить ответ
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Кого можно пригласить */}
      <p className="mb-2 text-xs text-muted">
        Свободных кандидатов: {candidates.length}. Чем выше очки клана, тем охотнее
        они соглашаются.
      </p>
      {canInvite ? (
        <div className="flex flex-wrap gap-1.5">
          {candidates.map((candidate) => (
            <button
              key={candidate.name}
              type="button"
              className="cl-pick"
              onClick={() => {
                const result = invite(candidate.name, clan, game);
                if (result.ok) {
                  settle();
                  say(`Приглашение отправлено: ${candidate.name}`);
                } else {
                  say(result.reason ?? "Не удалось");
                }
              }}
            >
              {candidate.name} · {TIER_LABEL[candidate.tier as CandidateTier]}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted">
          Свободных мест нет. Прокачай ветку «Сообщество» на вкладке «База» —
          она поднимает потолок состава.
        </p>
      )}
    </section>
  );
}

/** Состояние набора отдельно: нужно перечитывать стор кланов при смене состава */
export function useRecruitState() {
  return { game: useClanGame(), current: clanGame() };
}