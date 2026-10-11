"use client";

import {
  APPLICATION_LINES,
  CANDIDATES,
  addMember,
  checkRight,
  clanMembers,
  type Clan,
  type CandidateTier,
  type ClanMember,
} from "./clans";
import { EMPTY_PURSE, REGIONS, type ClanPurse, type ClanRegion } from "./clans.game";
import {
  clanGame,
  dayKey,
  patchClanGame,
  weekKey,
  type ClanApplication,
  type ClanGameState,
  type ClanInvite,
  type ClanRelic,
} from "./clans.runtime";

/**
 * Социальный слой: заявки, приглашения, коллекция, номинации, ротация.
 *
 * Общий принцип — детерминированность по времени. Кандидаты, пришедшие
 * в заявках, номинации недели и нейтральные территории выводятся из ключа
 * дня или недели, а не бросаются кубиком: игрок не должен терять прогресс
 * из-за того, что обновил страницу в неудачный момент.
 */

/* ------------------------------------------------------------------ */
/* Лимит состава                                                        */
/* ------------------------------------------------------------------ */

/**
 * Сколько участников вмещает клан.
 *
 * Базовый потолок — 8; ветка «Сообщество» поднимает его по ступеням.
 * Это прямая связь дерева развития с составом, а не отдельная цифра.
 */
export function memberCap(game: ClanGameState): number {
  return 8 + (game.tree.community ?? 0) * 2;
}

/** Насколько полон клан */
export function rosterRoom(clan: Clan, game: ClanGameState): number {
  return Math.max(0, memberCap(game) - clanMembers(clan).length);
}

/* ------------------------------------------------------------------ */
/* Заявки                                                               */
/* ------------------------------------------------------------------ */

/** Простая детерминированная выборка: одинаковая при одном и том же дне */
function pickDay(seed: string, length: number, offset: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return (hash + offset) % length;
}

/**
 * Заявки, пришедшие за день.
 *
 * Кандидаты не повторяются и не выходят за пределы пула: иначе через
 * месяц в клане окажутся два «Рена», а игрок не сможет объяснить состав.
 */
export function dailyApplications(
  clan: Clan,
  game: ClanGameState,
  now = Date.now(),
): ClanApplication[] {
  const day = dayKey(now);
  const taken = new Set([
    ...clanMembers(clan).map((m) => m.name),
    ...game.applications.map((a) => a.name),
    ...game.invites.map((i) => i.name),
  ]);

  // В будни заявки редкие, на выходных — чаще: неделя без заявок выглядит
  // как сломанная система найма
  const weekday = new Date(now).getDay();
  const count = weekday === 0 || weekday === 6 ? 2 : 1;

  const out: ClanApplication[] = [];
  for (let i = 0; i < count; i += 1) {
    const idx = pickDay(day, CANDIDATES.length, i * 5);
    const candidate = CANDIDATES[idx];
    if (taken.has(candidate.name)) continue;
    taken.add(candidate.name);

    const lines = APPLICATION_LINES[candidate.tier as CandidateTier];
    out.push({
      id: `app-${day}-${i}`,
      name: candidate.name,
      tier: candidate.tier,
      message: lines[pickDay(day, lines.length, i)],
      // Уровень кандидата влияет на то, сколько он внесёт: сильный
      // участник — это и причина, по которой его берут
      level: 8 + ((pickDay(day, 40, i * 3) + (candidate.tier === "legenda" ? 24 : 0)) % 40),
      at: now,
    });
  }
  return out;
}

/**
 * Записать заявки дня в стор.
 *
 * Раньше они считались прямо в рендере, и кнопка «Принять» искала их в
 * сторе — то есть не находила. Поток должен быть один: кандидаты дня
 * материализуются в состояние, а интерфейс уже читает готовое.
 */
export function syncApplications(clan: Clan, now = Date.now()): void {
  const state = clanGame();
  if (state.applications.length > 0) return;

  const fresh = dailyApplications(clan, state, now);
  if (fresh.length === 0) return;
  patchClanGame((s) => ({ ...s, applications: fresh }));
}

/** Принять заявку: кандидат входит в состав */
export function acceptApplication(
  applicationId: string,
  clan: Clan,
  game: ClanGameState,
): { ok: boolean; reason?: string } {
  const me = clanMembers(clan).find((m) => m.isPlayer);
  const check = checkRight(me, "editClan");
  if (!check.ok) return check;
  if (rosterRoom(clan, game) <= 0) {
    return { ok: false, reason: "В клане нет свободных мест" };
  }

  const application = clanGame().applications.find((a) => a.id === applicationId);
  if (!application) return { ok: false, reason: "Заявка не найдена" };

  const member: ClanMember = {
    id: `app${application.name}`,
    name: application.name,
    role: "member",
    // Вклад нового участника стартует от его уровня: это не подарок,
    // а оценка того, насколько он полезен, и она обнуляется с сезоном
    contributed: application.level * 12,
    joinedAt: dayKey(),
  };
  const added = addMember(member);
  if (!added.ok) return added;

  patchClanGame((state) => ({
    ...state,
    applications: state.applications.filter((a) => a.id !== applicationId),
    log: [
      ...state.log,
      { at: Date.now(), text: `${application.name} принят в клан`, who: "Ты" },
    ].slice(-40),
  }));
  return { ok: true };
}

/** Отклонить заявку */
export function declineApplication(applicationId: string, clan: Clan): { ok: boolean; reason?: string } {
  const me = clanMembers(clan).find((m) => m.isPlayer);
  const check = checkRight(me, "editClan");
  if (!check.ok) return check;

  patchClanGame((state) => ({
    ...state,
    applications: state.applications.filter((a) => a.id !== applicationId),
  }));
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Приглашения                                                          */
/* ------------------------------------------------------------------ */

/**
 * Кого ещё можно пригласить.
 *
 * Список зависит только от состава: состав меняется — и кандидаты меняются,
 * но при перезагрузке страницы остаются теми же.
 */
export function inviteCandidates(clan: Clan, game: ClanGameState) {
  const busy = new Set([
    ...clanMembers(clan).map((m) => m.name),
    ...game.invites.map((i) => i.name),
  ]);
  return CANDIDATES.filter((c) => !busy.has(c.name));
}

/** Пригласить кандидата */
export function invite(name: string, clan: Clan, game: ClanGameState): { ok: boolean; reason?: string } {
  const me = clanMembers(clan).find((m) => m.isPlayer);
  const check = checkRight(me, "editClan");
  if (!check.ok) return check;
  if (rosterRoom(clan, game) <= 0) return { ok: false, reason: "В клане нет свободных мест" };

  const candidate = CANDIDATES.find((c) => c.name === name);
  if (!candidate) return { ok: false, reason: "Такого кандидата нет" };

  patchClanGame((state) => ({
    ...state,
    invites: [
      ...state.invites,
      { id: `inv-${name}`, name, tier: candidate.tier, answer: "pending", at: Date.now() },
    ],
    log: [
      ...state.log,
      { at: Date.now(), text: `Приглашение отправлено: ${name}`, who: "Ты" },
    ].slice(-40),
  }));
  return { ok: true };
}

/**
 * Ответ на приглашение.
 *
 * Склонность выводится из уровня клана: чем выше очки, тем охотнее
 * кандидат соглашается. Это делает состав функцией успехов клана, а не
 * случайного броска.
 */
export function settleInvites(clan: Clan, now = Date.now()): ClanInvite[] {
  const state = clanGame();
  const pending = state.invites.filter((i) => i.answer === "pending");
  if (pending.length === 0) return [];

  const settled = pending.map((invite) => {
    const roll = pickDay(invite.id, 100, clan.points % 100);
    return { ...invite, answer: roll < 70 ? "accepted" : "declined" } as ClanInvite;
  });

  patchClanGame((s) => ({
    ...s,
    invites: s.invites.map((i) => settled.find((x) => x.id === i.id) ?? i),
    log: [
      ...s.log,
      ...settled.map((i) => ({
        at: now,
        text: i.answer === "accepted" ? `${i.name} принял приглашение` : `${i.name} отказал`,
        who: i.name,
      })),
    ].slice(-40),
  }));
  return settled;
}

/** Принявший приглашение попадает в состав */
export function acceptInvite(inviteId: string, clan: Clan, game: ClanGameState): { ok: boolean; reason?: string } {
  const me = clanMembers(clan).find((m) => m.isPlayer);
  const check = checkRight(me, "editClan");
  if (!check.ok) return check;
  if (rosterRoom(clan, game) <= 0) return { ok: false, reason: "В клане нет свободных мест" };

  const invite = clanGame().invites.find((i) => i.id === inviteId);
  if (!invite || invite.answer !== "accepted") return { ok: false, reason: "Приглашение ещё не принято" };

  const added = addMember({
    id: `inv${invite.name}`,
    name: invite.name,
    role: "member",
    contributed: 0,
    joinedAt: dayKey(),
  });
  if (!added.ok) return added;

  patchClanGame((state) => ({
    ...state,
    invites: state.invites.filter((i) => i.id !== inviteId),
    log: [...state.log, { at: Date.now(), text: `${invite.name} вступил в клан`, who: "Ты" }].slice(-40),
  }));
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Коллекция и зал славы                                                */
/* ------------------------------------------------------------------ */

/** Виды реликвий: за что они выдаются */
export const RELICS: { id: string; name: string; glyph: string; source: string }[] = [
  { id: "boss-fragment", name: "Фрагмент эмблемы босса", glyph: "🪬", source: "Рейд: первая пробитая фаза" },
  { id: "war-banner", name: "Знамя войны", glyph: "🚩", source: "Война кланов: победа" },
  { id: "map-fragment", name: "Фрагмент карты", glyph: "🗺️", source: "Поход: завершение маршрута" },
  { id: "region-seal", name: "Печать региона", glyph: "🔱", source: "Захват территории" },
  { id: "vault-key", name: "Ключ сокровищницы", glyph: "🗝️", source: "Задачи: крупная награда" },
  { id: "oath-ring", name: "Кольцо клятвы", glyph: "💍", source: "Номинация недели" },
];

/** Выдать реликвию, если такой ещё нет. Повторно не выдаётся */
export function grantRelic(id: string): boolean {
  const relic = RELICS.find((r) => r.id === id);
  if (!relic) return false;
  let granted = false;

  patchClanGame((state) => {
    if (state.collection.some((r) => r.id === id)) return state;
    granted = true;
    const item: ClanRelic = {
      id,
      name: relic.name,
      glyph: relic.glyph,
      source: relic.source,
      at: Date.now(),
    };
    return {
      ...state,
      collection: [...state.collection, item],
      trophies: [...state.trophies, { at: Date.now(), title: relic.name, detail: relic.source }].slice(-30),
    };
  });
  return granted;
}

/** Сколько реликвий из коллекции ещё не найдено */
export function missingRelics(game: ClanGameState): typeof RELICS {
  const have = new Set(game.collection.map((r) => r.id));
  return RELICS.filter((r) => !have.has(r.id));
}

/* ------------------------------------------------------------------ */
/* Номинации «Предатель или герой»                                      */
/* ------------------------------------------------------------------ */

export const NOMINATIONS: { id: string; name: string; desc: string; glyph: string }[] = [
  { id: "devoted", name: "Самый преданный", desc: "Ни разу не бросил клан в трудную минуту", glyph: "🛡️" },
  { id: "strategist", name: "Стратег сезона", desc: "Принёс клану больше всего очков за период", glyph: "♟️" },
  { id: "soul", name: "Душа клана", desc: "С кем уютнее всего в зале", glyph: "💛" },
  { id: "hunter", name: "Главный охотник", desc: "Больше всех отработал на рейдах", glyph: "🎯" },
];

/** Кто может быть номинантом: не игрок и не текущий победитель прошлой недели */
export function nominees(clan: Clan): ClanMember[] {
  return clanMembers(clan).filter((m) => !m.isPlayer);
}

export interface NominationView {
  id: string;
  name: string;
  desc: string;
  glyph: string;
  /** За кого проголосовано сейчас */
  vote: string | null;
  /** Кто лидирует — виден только после публикации */
  leader: string | null;
  revealed: boolean;
  /** Всего голосов */
  votes: number;
}

/** Срез номинаций для интерфейса */
export function nominationView(clan: Clan, now = Date.now()): NominationView[] {
  const game = clanGame();
  const state = game.nomination.week === weekKey(now)
    ? game.nomination
    : { week: weekKey(now), votes: {}, revealed: false };
  return NOMINATIONS.map((item) => {
    const vote = state.votes[item.id] ?? null;
    const counts = new Map<string, number>();
    for (const id of Object.values(state.votes)) counts.set(id, (counts.get(id) ?? 0) + 1);
    let leader: string | null = null;
    let best = 0;
    for (const [id, n] of counts) {
      if (n > best) { best = n; leader = id; }
    }
    return {
      ...item,
      vote,
      // Итоги скрыты, пока неделя не закрыта: иначе голосование идёт
      // за текущим лидером, а не за кандидатом
      leader: state.revealed ? leader : null,
      revealed: state.revealed,
      votes: state.votes[item.id] ? 1 : 0,
    };
  });
}

/** Проголосовать: один голос на номинацию, повторный меняет выбор */
export function voteNomination(id: string, memberId: string, clan: Clan): { ok: boolean; reason?: string } {
  if (!NOMINATIONS.some((n) => n.id === id)) return { ok: false, reason: "Такой номинации нет" };
  if (!nominees(clan).some((m) => m.id === memberId)) {
    return { ok: false, reason: "Этот участник не номинируется" };
  }

  patchClanGame((state) => ({
    ...state,
    nomination: {
      week: weekKey(),
      votes: { ...state.nomination.votes, [id]: memberId },
      revealed: false,
    },
  }));
  return { ok: true };
}

/**
 * Закрыть неделю номинаций.
 *
 * Победителю выдаётся кольцо клятвы — постоянный знак, а не разовая
 * награда. Голоса скрыты до этого момента.
 */
export function closeNominations(clan: Clan, now = Date.now()): string | null {
  const game = clanGame();
  if (game.nomination.revealed) return null;

  const roster = nominees(clan);
  if (roster.length === 0) return null;

  const counts = new Map<string, number>();
  for (const id of Object.values(game.nomination.votes)) counts.set(id, (counts.get(id) ?? 0) + 1);
  let winner: string | null = null;
  let best = 0;
  for (const [id, n] of counts) {
    if (n > best) { best = n; winner = id; }
  }
  if (!winner) return null;

  patchClanGame((state) => ({
    ...state,
    nomination: { ...state.nomination, revealed: true },
    log: [
      ...state.log,
      { at: now, text: `Номинация недели: ${roster.find((m) => m.id === winner)?.name ?? "—"}`, who: "Система" },
    ].slice(-40),
  }));
  grantRelic("oath-ring");
  return roster.find((m) => m.id === winner)?.name ?? null;
}

/* ------------------------------------------------------------------ */
/* Ротация территорий                                                   */
/* ------------------------------------------------------------------ */

/**
 * Какие регионы стали нейтральными на этой неделе.
 *
 * Промт требует, чтобы лидеры не удерживали карту вечно: каждую неделю
 * часть регионов снова становится нейтральной. Выбор выведен из ключа
 * недели, поэтому он одинаков при любом порядке открытия страницы.
 */
export function neutralRegions(now = Date.now()): ClanRegion[] {
  const week = weekKey(now);
  const count = 1 + (parseInt(week.replace(/\D/g, ""), 10) % 2);
  const start = pickDay(week, REGIONS.length, 0);
  return Array.from({ length: count }, (_, i) => REGIONS[(start + i) % REGIONS.length].id);
}

/**
 * Применить ротацию: вернуть нейтральные регионы в исходное состояние.
 *
 * Вызывается при открытии раздела. Ключ недели лежит в сторе, поэтому
 * повторный вызов в ту же неделю ничего не делает.
 */
export function applyTerritoryRotation(now = Date.now()): ClanRegion[] {
  const game = clanGame();
  const week = weekKey(now);
  if (game.rotation === week) return [];

  const neutral = neutralRegions(now);
  patchClanGame((state) => {
    const regions = { ...state.regions };
    const held = state.held.filter((id) => !neutral.includes(id));
    for (const id of neutral) regions[id] = 0;
    return {
      ...state,
      rotation: week,
      regions,
      held,
      log: [
        ...state.log,
        {
          at: now,
          text: `Нейтральные территории: ${neutral
            .map((id) => REGIONS.find((r) => r.id === id)?.name)
            .filter(Boolean)
            .join(", ")}`,
          who: "Система",
        },
      ].slice(-40),
    };
  });
  return neutral;
}

/* ------------------------------------------------------------------ */
/* Заглушки для интерфейса                                              */
/* ------------------------------------------------------------------ */

/** Пустой кошелёк — для мест, где кошелёк ещё не нужен */
export const NO_PURSE: ClanPurse = EMPTY_PURSE;

export type { ClanApplication, ClanInvite, ClanRelic };
