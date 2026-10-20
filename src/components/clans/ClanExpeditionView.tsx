"use client";

import { useState } from "react";
import { RESOURCE_LABEL, ROUTES, routeOf, type ClanResource, type ExpeditionRoute } from "@/lib/clans.game";
import type { Clan } from "@/lib/clans";
import { expeditionHint, startExpedition, switchRoute } from "@/lib/clans.events";
import type { ClanGameState } from "@/lib/clans.runtime";
import { num } from "./ClanWallet";

/**
 * Поход клана: карта, маршрут и добыча.
 *
 * Главное правило, которое видно из интерфейса: уже собранное не отнимают.
 * Смена маршрута меняет только будущие события и множитель добычи — плашка
 * «secured» показывает, сколько получено и неприкосновенно.
 */

export function ClanExpeditionView({
  clan,
  game,
}: {
  clan: Clan;
  game: ClanGameState;
}) {
  const [message, setMessage] = useState("");
  const say = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 3000);
  };

  const exp = game.expedition;

  if (!exp) {
    return (
      <div className="grid gap-4">
        <section
          data-reveal
          className="cl-reveal cl-panel p-5 sm:p-6"
          style={{ ["--c" as string]: clan.color }}
        >
          <h2 className="font-accent text-lg font-extrabold">Поход клана</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Отряд выбирает маршрут и двигается по карте. Каждый этап требует суточной
            нормы активности на сайте, между этапами встречаются ловушки, мини-боссы и
            сокровищницы. Финал — босс маршрута.
          </p>
        </section>

        <div className="grid gap-3 sm:grid-cols-3">
          {ROUTES.map((route) => (
            <button
              key={route.id}
              type="button"
              className="cl-building text-left"
              style={{ ["--c" as string]: route.id === "abyss" ? "#ff4d6d" : route.id === "hunter" ? "#20bfff" : "#00c2a8" }}
              onClick={() => {
                const result = startExpedition(route.id);
                say(result.ok ? `Поход по маршруту «${route.name}»` : (result.reason ?? "Не удалось"));
              }}
            >
              <div className="flex items-center gap-3">
                <span className="cl-building-glyph" aria-hidden>
                  {route.glyph}
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block text-sm text-white">{route.name}</b>
                  <em className="block text-xs not-italic text-muted">{route.desc}</em>
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span>{route.days} дней</span>
                <span>успех {route.success}%</span>
                <span>добыча ×{route.rewardMul}</span>
              </div>
            </button>
          ))}
        </div>
        {message && (
          <p className="cl-toast" role="status">
            {message}
          </p>
        )}
      </div>
    );
  }

  const info = routeOf(exp.route);
  const done = exp.progress;
  const pct = Math.round((done / info.days) * 100);
  const event = exp.event;
  const eventPct = event ? Math.min(100, Math.round((exp.eventProgress / event.goal) * 100)) : 100;

  return (
    <div className="grid gap-4">
      <section
        data-reveal
        className={`cl-reveal cl-panel cl-exp p-5 sm:p-6 ${exp.finished ? (exp.outcome === "success" ? "won" : "lost") : ""}`}
        style={{ ["--c" as string]: clan.color }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="cl-lbl !mb-1">
              {exp.finished ? (exp.outcome === "success" ? "Поход завершён" : "Поход сорвался") : "Поход идёт"}
            </p>
            <h2 className="flex items-center gap-2 font-accent text-xl font-extrabold">
              <span aria-hidden>{info.glyph}</span> {info.name}
            </h2>
            <p className="mt-1 text-sm text-muted">{expeditionHint(exp.route)}</p>
          </div>
          <div className="text-right">
            <p className="cl-lbl !mb-1">Участок</p>
            <p className="font-accent text-2xl font-extrabold tabular-nums">
              {done}/{info.days}
            </p>
          </div>
        </div>

        {/* Карта маршрута: пройденные участки, текущий и будущие */}
        <ol className="cl-route mt-5" aria-label="Карта маршрута">
          {Array.from({ length: info.days }, (_, i) => i + 1).map((stage) => (
            <li
              key={stage}
              className={`cl-node ${stage < done ? "past" : stage === done ? "here" : ""}`}
            >
              <span className="dot" />
              <em>{stage}</em>
            </li>
          ))}
        </ol>
        <div className="cl-bar mt-3" style={{ ["--p" as string]: pct }}>
          <i />
        </div>

        {!exp.finished && (
          <div className="mt-4 flex flex-wrap gap-2">
            {ROUTES.filter((route) => route.id !== exp.route).map((route) => (
              <button
                key={route.id}
                type="button"
                className="cl-pick"
                title={route.desc}
                onClick={() => {
                  const result = switchRoute(route.id as ExpeditionRoute);
                  say(
                    result.ok
                      ? `Маршрут изменён на «${route.name}». Добыча, уже собранная, остаётся.`
                      : (result.reason ?? "Не удалось"),
                  );
                }}
                style={{ ["--c" as string]: route.id === "abyss" ? "#ff4d6d" : route.id === "hunter" ? "#20bfff" : "#00c2a8" }}
              >
                {route.glyph} Сменить на «{route.name}»
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Событие этапа */}
      {event && (
        <section data-reveal className="cl-reveal cl-panel p-5" style={{ ["--c" as string]: "#b06bff" }}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="cl-building-glyph" aria-hidden>
                {event.glyph}
              </span>
              <div>
                <h3 className="text-sm font-extrabold text-white">{event.title}</h3>
                <p className="text-xs text-muted">{event.text}</p>
              </div>
            </div>
            <span className="cl-quest-badge">
              {num(exp.eventProgress)} / {num(event.goal)}
            </span>
          </div>

          <div className="cl-bar mt-3" style={{ ["--p" as string]: exp.eventDone ? 100 : eventPct }}>
            <i />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            {exp.eventDone ? (
              <span className="cl-quest-badge done">Событие закрыто</span>
            ) : (
              <span className="text-muted">
                Активность за сегодня: <b className="tabular-nums text-bright">{num(exp.today)}</b>
              </span>
            )}
            {Object.entries(event.reward).map(([key, value]) => (
              <span key={key} className="cl-pick sm">
                +{num(value as number)} {RESOURCE_LABEL[key as ClanResource]}
              </span>
            ))}
            {event.penalty > 0 && (
              <span className="cl-pick sm ghost">
                штраф при срыве: {num(event.penalty)}
              </span>
            )}
          </div>
        </section>
      )}

      {/* Добыча */}
      <section data-reveal className="cl-reveal cl-panel p-5" style={{ ["--c" as string]: clan.color }}>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-accent text-sm font-extrabold uppercase tracking-wider text-muted">
            Добыча отряда
          </h3>
          <span className="text-xs text-muted">
            {exp.finished
              ? exp.outcome === "success"
                ? "Передана в казну клана"
                : "Часть добычи потеряна на финальном боссе"
              : "Будет передана в казну по завершении"}
          </span>
        </div>
        <div className="cl-wallet">
          {(Object.keys(RESOURCE_LABEL) as ClanResource[]).map((key) => (
            <div key={key} className="cl-wallet-cell">
              <span className="glyph" aria-hidden>
                {key === "xp" ? "⚡" : key === "influence" ? "🔷" : key === "materials" ? "🧱" : "👑"}
              </span>
              <span className="min-w-0">
                <b className="tabular-nums">{num(exp.loot[key] ?? 0)}</b>
                <em>{RESOURCE_LABEL[key]}</em>
              </span>
            </div>
          ))}
        </div>

        {exp.finished && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="cl-pick"
              onClick={() => {
                const result = startExpedition(exp.route);
                say(result.ok ? "Новый поход начат" : (result.reason ?? "Не удалось"));
              }}
              style={{ ["--c" as string]: clan.color }}
            >
              Новый поход
            </button>
            {ROUTES.filter((route) => route.id !== exp.route).map((route) => (
              <button
                key={route.id}
                type="button"
                className="cl-pick"
                onClick={() => {
                  const result = startExpedition(route.id as ExpeditionRoute);
                  say(result.ok ? `Поход по маршруту «${route.name}»` : (result.reason ?? "Не удалось"));
                }}
                style={{ ["--c" as string]: route.id === "abyss" ? "#ff4d6d" : route.id === "hunter" ? "#20bfff" : "#00c2a8" }}
              >
                {route.glyph} «{route.name}»
              </button>
            ))}
          </div>
        )}
      </section>

      {message && (
        <p className="cl-toast" role="status">
          {message}
        </p>
      )}
    </div>
  );
}