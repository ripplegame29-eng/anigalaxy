/**
 * Общие фикстуры для тестов прогрессии.
 *
 * Импортируют СКОМПИЛИРОВАННЫЙ код из `.tsc-tests/` (см. tools/run-tests.mjs):
 * тесты — чистый JS без новых dev-зависимостей (§0.6).
 */

import { EMPTY_DOC } from "../../.tsc-tests/lib/progression/doc.js";
import { applyEvent } from "../../.tsc-tests/lib/progression/engine.js";

export const TZ = "UTC";
export const USER = "tester";

/** 10 марта 2026, `hour:minute` UTC, со сдвигом на `dayOffset` суток */
export function at(hour, minute = 0, dayOffset = 0) {
  return Date.UTC(2026, 2, 10 + dayOffset, hour, minute);
}

export function ctx(now, userId = USER) {
  return { now, tz: TZ, userId };
}

/** Чистый пустой документ (клон, не замораживается движком) */
export function freshDoc() {
  return structuredClone(EMPTY_DOC);
}

export function apply(doc, event, external = {}, now = at(12, 0), cfg = undefined) {
  return applyEvent(doc, event, external, ctx(now), cfg);
}

/**
 * «Досмотреть» серию: тики раз в 15 с (§4), пока сессия не завершится.
 * Возвращает новый документ.
 */
export function watchEpisode(doc, titleId, episodeKey, opts = {}) {
  const {
    start = at(12, 0),
    durationSec = 600,
    visible = true,
    speed = 1,
    external = {},
    cfg = undefined,
    isFinal = false,
    genres = [],
    userId = USER,
  } = opts;

  let cur = doc;
  const heartbeat = 15;
  const required = Math.round(durationSec * 0.8);
  let t = start;
  const maxTicks = Math.ceil(required / heartbeat) + 4;

  for (let i = 0; i < maxTicks; i += 1) {
    t += heartbeat * 1000;
    const res = applyEvent(
      cur,
      {
        type: "EPISODE_TICK",
        titleId,
        episodeKey,
        seconds: heartbeat,
        visible,
        speed,
        durationSec,
        isFinal,
        genres,
      },
      external,
      ctx(t, userId),
      cfg,
    );
    cur = res.doc;
    const session = cur.sessions.find((s) => s.key === `${titleId}:${episodeKey}`);
    if (session?.completedAt) break;
  }
  return cur;
}

export function sessionOf(doc, titleId, episodeKey) {
  return doc.sessions.find((s) => s.key === `${titleId}:${episodeKey}`);
}

export function xpEffects(effects) {
  return effects.filter((e) => e.type === "XP_GAINED");
}
