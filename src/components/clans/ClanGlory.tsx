"use client";

import { useState } from "react";
import type { Clan } from "@/lib/clans";
import {
  NOMINATIONS,
  RELICS,
  closeNominations,
  missingRelics,
  nominees,
  nominationView,
  voteNomination,
} from "@/lib/clans.social";
import type { ClanGameState } from "@/lib/clans.runtime";
import { num } from "./ClanWallet";

/**
 * Слава: коллекция клана, зал славы и номинации недели.
 *
 * Трофеи писались в стор с прошлого этапа, но их было негде увидеть —
 * мёртвые данные в хранилище. Здесь они становятся видимой частью раздела.
 *
 * Номинации тайные: итоги видны только после закрытия недели. Открытое
 * голосование превращается в погоню за текущим лидером, а не в выбор.
 */

const DATE_FMT = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function ClanGlory({ clan, game }: { clan: Clan; game: ClanGameState }) {
  const [message, setMessage] = useState("");
  const views = nominationView(clan);
  const roster = nominees(clan);
  const missing = missingRelics(game);
  const revealed = views[0]?.revealed ?? false;

  const say = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 3200);
  };

  const close = () => {
    const winner = closeNominations(clan);
    if (winner) {
      say(`Номинация недели: ${winner}. В коллекцию добавлено кольцо клятвы.`);
    } else {
      say("Голосов ещё нет — закрыть нечего");
    }
  };

  return (
    <div className="grid gap-4">
      {/* Номинации */}
      <section
        data-reveal
        className="cl-reveal cl-panel p-5 sm:p-6"
        style={{ ["--c" as string]: "#ffb020" }}
      >
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-accent text-lg font-extrabold">Предатель или герой</h2>
          <span className="text-xs text-muted">
            {revealed ? "итоги недели опубликованы" : "голосование тайное до конца недели"}
          </span>
        </div>
        <p className="mb-4 text-xs leading-relaxed text-muted">
          Номинации не про предательство: четыре номинации, одна клятва каждую неделю.
          Победитель получает постоянный знак, а не разовую награду.
        </p>

        {roster.length === 0 ? (
          <p className="text-sm text-muted">Номинировать некого: в клане нет участников кроме тебя.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {views.map((view) => (
              <li key={view.id} data-nomination className={`cl-building ${view.vote ? "held" : ""}`}>
                <div className="flex items-center gap-3">
                  <span className="cl-building-glyph" aria-hidden>
                    {view.glyph}
                  </span>
                  <div className="min-w-0 flex-1">
                    <b className="block text-sm text-white">{view.name}</b>
                    <em className="block text-xs not-italic text-muted">{view.desc}</em>
                  </div>
                </div>

                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {roster.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      className="cl-pick sm"
                      aria-pressed={view.vote === member.id}
                      disabled={revealed}
                      onClick={() => {
                        const result = voteNomination(view.id, member.id, clan);
                        if (!result.ok) say(result.reason ?? "Не удалось");
                      }}
                      style={{
                        ["--c" as string]: "#ffb020",
                        ...(view.vote === member.id
                          ? { background: "#ffb02033", boxShadow: "inset 0 0 0 1px #ffb020" }
                          : {}),
                      }}
                    >
                      {member.name}
                    </button>
                  ))}
                </div>

                <p className="mt-2 text-xs text-muted">
                  {revealed && view.leader
                    ? `Лидирует ${roster.find((m) => m.id === view.leader)?.name ?? "—"}`
                    : view.vote
                      ? "Голос принят, результат увидишь в конце недели"
                      : "Никто ещё не проголосовал"}
                </p>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" className="cl-pick" style={{ ["--c" as string]: "#ffb020" }} onClick={close}>
            Закрыть неделю
          </button>
          {message && (
            <p className="cl-toast" role="status">
              {message}
            </p>
          )}
        </div>
      </section>

      {/* Коллекция */}
      <section data-reveal className="cl-reveal cl-panel p-5 sm:p-6" style={{ ["--c" as string]: clan.color }}>
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-accent text-lg font-extrabold">Коллекция клана</h2>
          <span className="text-xs text-muted">
            найдено {RELICS.length - missing.length} из {RELICS.length}
          </span>
        </div>
        <p className="mb-4 text-xs text-muted">
          Реликвии выдаются один раз и не сгорают: смена сезона не отнимает то,
          что уже найдено.
        </p>

        <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {RELICS.map((relic) => {
            const owned = game.collection.find((r) => r.id === relic.id);
            return (
              <li key={relic.id} data-relic className={`cl-building ${owned ? "held" : ""}`} style={{ ["--c" as string]: clan.color }}>
                <div className="flex items-center gap-3">
                  <span className="cl-building-glyph" aria-hidden>
                    {owned ? relic.glyph : "❔"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <b className={`block text-sm ${owned ? "text-white" : "text-muted"}`}>
                      {owned ? relic.name : "Не найдено"}
                    </b>
                    <em className="block text-xs not-italic text-muted">{relic.source}</em>
                    {owned && (
                      <em className="block text-[10px] not-italic text-muted">
                        получено {DATE_FMT.format(owned.at)}
                      </em>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Зал славы */}
      <section data-reveal className="cl-reveal cl-panel p-5 sm:p-6" style={{ ["--c" as string]: clan.color }}>
        <h2 className="mb-1 font-accent text-lg font-extrabold">Зал славы</h2>
        <p className="mb-4 text-xs text-muted">
          Прошлые победы остаются здесь навсегда: сезон меняет рейтинг, но не историю.
        </p>

        {game.trophies.length === 0 ? (
          <p className="text-sm text-muted">
            Пока пусто. Победы в войнах, пробитые фазы босса и завершённые походы
            попадают сюда автоматически.
          </p>
        ) : (
          <ul className="cl-log">
            {[...game.trophies].reverse().map((entry, i) => (
              <li key={`${entry.at}-${i}`}>
                <span className="cl-log-when">{DATE_FMT.format(entry.at)}</span>
                <span className="cl-log-text">{entry.title}</span>
                <span className="cl-log-who">{entry.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Номинации прошлых недель — справочно, без действий */}
      <p className="text-xs leading-relaxed text-muted">
        Каждая неделя приносит {NOMINATIONS.length} номинации и одну награду. Голоса не
        переносятся: каждую неделю списки чистые, а результат прошлой остаётся в
        зале славы.
      </p>
    </div>
  );
}

export { num };