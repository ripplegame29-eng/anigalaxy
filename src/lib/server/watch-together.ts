/**
 * Серверные комнаты совместного просмотра.
 *
 * Раньше «комната» жила в localStorage одного браузера, поэтому приглашение
 * по ссылке не работало: у второго участника просто не было записи о ней.
 * Теперь комнаты, участники, состояние плеера и чат лежат в SQLite, а клиент
 * раз в пару секунд забирает срез (polling) и отправляет свои изменения.
 *
 * Никакой авторизации не требуется: идентификатор клиента — случайная строка,
 * которую браузер хранит в localStorage. Этого достаточно, чтобы различать
 * участников комнаты, и не нужно раскрывать аккаунт.
 */

import { num, str, transaction, type Database } from "./sqlite";

export type WtResult<T> = { ok: true; value: T } | { ok: false; error: string; code: string };

function fail<T>(error: string, code: string): WtResult<T> {
  return { ok: false, error, code };
}

/** Сколько живёт участник без запросов (вкладка закрылась — сам «выйдет») */
export const MEMBER_TTL_MS = 45_000;
/** Максимальный возраст комнаты */
export const ROOM_TTL_MS = 12 * 60 * 60 * 1000;
/** Пустая комната (все вышли) удаляется через полчаса */
const EMPTY_ROOM_TTL_MS = 30 * 60 * 1000;

/** Вместимость по типу доступа */
export const WT_LIMITS = { open: 12, link: 8 } as const;

/** Алфавит кода — без похожих символов (0/O, 1/I) */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LEN = 6;
const CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;
const CLIENT_RE = /^[A-Za-z0-9_-]{8,64}$/;
const NICK_MAX = 24;
const TITLE_MAX = 60;
const MESSAGE_MAX = 300;

export interface WtRoom {
  /** clientId того, кто управляет комнатой */
  host: string;
  /** Скорость воспроизведения, заданная ведущим */
  rate: number;
  code: string;
  title: string;
  anime: string;
  alias: string;
  poster: string;
  dub: string;
  access: "open" | "link";
  /** Номер серии (как в каталоге AniLiberty), не индекс */
  episode: number;
  /** Позиция в секундах */
  position: number;
  playing: boolean;
  /** clientId того, кто последним поменял состояние */
  by: string;
  /** Когда состояние поменялось (мс) */
  at: number;
  createdAt: number;
  viewers: number;
  limit: number;
}

export interface WtMember {
  clientId: string;
  nickname: string;
  seenAt: number;
}

export interface WtMessage {
  id: number;
  clientId: string;
  nickname: string;
  body: string;
  createdAt: number;
}

export interface WtSnapshot {
  room: WtRoom;
  members: WtMember[];
  messages: WtMessage[];
  /** Время сервера — по нему клиент понимает, насколько отстал */
  serverTime: number;
}

/** HTTP-статус по коду ошибки — чтобы роуты не дублировали switch */
export function wtStatus(code: string): number {
  switch (code) {
    case "not_found":
      return 404;
    case "full":
      return 409;
    case "not_member":
    case "not_host":
      return 403;
    case "rate_limit":
      return 429;
    default:
      return 400;
  }
}

export interface CreateRoomInput {
  clientId: string;
  nickname: string;
  title: string;
  anime: string;
  alias?: string;
  poster?: string;
  dub?: string;
  access?: "open" | "link";
}

export interface RoomStateInput {
  episode: number;
  position: number;
  playing: boolean;
  rate?: number;
}

/* ------------------------------ Утилиты ----------------------------- */

export function isValidClientId(value: unknown): value is string {
  return typeof value === "string" && CLIENT_RE.test(value);
}

export function normalizeNickname(value: unknown): string {
  const raw = typeof value === "string" ? value : "";
  // Управляющие символы и переводы строк в нике не нужны
  const clean = raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return clean.slice(0, NICK_MAX) || "Гость";
}

export function isValidRoomCode(value: unknown): value is string {
  return typeof value === "string" && CODE_RE.test(value.toUpperCase());
}

function makeCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LEN; i += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

interface RoomRow {
  id: number;
  code: string;
  title: string;
  anime: string;
  alias: string;
  poster: string;
  dub: string;
  access: "open" | "link";
  episode: number;
  position: number;
  playing: number;
  state_by: string;
  state_at: number;
  created_at: number;
  host_id: string;
  rate: number;
}

function asRoomRow(row: Record<string, unknown> | undefined): RoomRow | null {
  if (!row) return null;
  const access = str(row.access) === "open" ? "open" : "link";
  return {
    id: num(row.id),
    code: str(row.code),
    title: str(row.title),
    anime: str(row.anime),
    alias: str(row.alias),
    poster: str(row.poster),
    dub: str(row.dub),
    access,
    episode: num(row.episode, 1),
    position: num(row.position, 0),
    playing: num(row.playing, 0),
    state_by: str(row.state_by),
    state_at: num(row.state_at),
    created_at: num(row.created_at),
    host_id: str(row.host_id),
    rate: num(row.rate, 1) || 1,
  };
}

/** Убрать «призраков» и просроченные комнаты (вызывается на каждом запросе) */
export function cleanup(db: Database, now = Date.now()): void {
  db.prepare("DELETE FROM watch_room_members WHERE seen_at < ?").run(now - MEMBER_TTL_MS);
  db.prepare("DELETE FROM watch_rooms WHERE created_at < ?").run(now - ROOM_TTL_MS);
  // Пустая комната живёт ещё полчаса: чтобы можно было вернуться по ссылке
  db.prepare(
    `DELETE FROM watch_rooms
      WHERE created_at < ?
        AND NOT EXISTS (SELECT 1 FROM watch_room_members m WHERE m.room_id = watch_rooms.id)`,
  ).run(now - EMPTY_ROOM_TTL_MS);
}

function activeMembers(db: Database, roomId: number, now: number): WtMember[] {
  const rows = db
    .prepare(
      `SELECT client_id, nickname, seen_at FROM watch_room_members
        WHERE room_id = ? AND seen_at >= ?
        ORDER BY joined_at ASC`,
    )
    .all(roomId, now - MEMBER_TTL_MS);
  return rows.map((row) => ({
    clientId: str(row.client_id),
    nickname: str(row.nickname),
    seenAt: num(row.seen_at),
  }));
}

/**
 * Кто управляет комнатой: создатель, пока он в комнате. Если он вышел или
 * пропал, управление переходит к самому раннему из оставшихся участников —
 * иначе комната осталась бы без пульта.
 */
function hostOf(row: RoomRow, members: WtMember[]): string {
  if (members.some((m) => m.clientId === row.host_id)) return row.host_id;
  return members[0]?.clientId ?? row.host_id;
}

function toRoom(row: RoomRow, viewers: number, host: string): WtRoom {
  return {
    code: row.code,
    title: row.title,
    anime: row.anime,
    alias: row.alias,
    poster: row.poster,
    dub: row.dub,
    access: row.access,
    episode: row.episode,
    position: row.position,
    playing: row.playing === 1,
    by: row.state_by,
    at: row.state_at,
    createdAt: row.created_at,
    viewers,
    limit: WT_LIMITS[row.access],
    host,
    rate: row.rate,
  };
}

function listMessages(db: Database, roomId: number, afterId = 0): WtMessage[] {
  const rows = afterId
    ? db
        .prepare("SELECT * FROM watch_room_messages WHERE room_id = ? AND id > ? ORDER BY id ASC LIMIT 100")
        .all(roomId, afterId)
    : db
        .prepare("SELECT * FROM watch_room_messages WHERE room_id = ? ORDER BY id DESC LIMIT 60")
        .all(roomId)
        .reverse();
  return rows.map((row) => ({
    id: num(row.id),
    clientId: str(row.client_id),
    nickname: str(row.nickname),
    body: str(row.body),
    createdAt: num(row.created_at),
  }));
}

function roomByCode(db: Database, code: string): RoomRow | null {
  return asRoomRow(db.prepare("SELECT * FROM watch_rooms WHERE code = ?").get(code) ?? undefined);
}

function snapshot(db: Database, row: RoomRow, now: number, afterId = 0): WtSnapshot {
  const members = activeMembers(db, row.id, now);
  return {
    room: toRoom(row, members.length, hostOf(row, members)),
    members,
    messages: listMessages(db, row.id, afterId),
    serverTime: now,
  };
}

function amMember(db: Database, roomId: number, clientId: string, now: number): boolean {
  const row = db
    .prepare("SELECT 1 AS ok FROM watch_room_members WHERE room_id = ? AND client_id = ? AND seen_at >= ?")
    .get(roomId, clientId, now - MEMBER_TTL_MS);
  return Boolean(row);
}

/* ------------------------------ Действия ---------------------------- */

/** Открытые комнаты с живыми участниками — для списка на странице */
export function listOpenRooms(db: Database, now = Date.now()): WtRoom[] {
  cleanup(db, now);
  const rows = db
    .prepare(
      `SELECT r.* FROM watch_rooms r
        WHERE r.access = 'open'
          AND EXISTS (
            SELECT 1 FROM watch_room_members m
             WHERE m.room_id = r.id AND m.seen_at >= ?
          )
        ORDER BY r.created_at DESC
        LIMIT 24`,
    )
    .all(now - MEMBER_TTL_MS)
    .map((row) => asRoomRow(row))
    .filter((row): row is RoomRow => Boolean(row));

  return rows.map((row) => {
    const members = activeMembers(db, row.id, now);
    return toRoom(row, members.length, hostOf(row, members));
  });
}

export function createRoom(
  db: Database,
  input: CreateRoomInput,
  now = Date.now(),
): WtResult<WtSnapshot> {
  const clientId = input.clientId;
  if (!isValidClientId(clientId)) return fail("Некорректный клиент", "invalid_client");

  const nickname = normalizeNickname(input.nickname);
  const anime = (input.anime ?? "").trim().slice(0, 120);
  if (!anime) return fail("Выберите аниме из поиска", "invalid");

  const title = (input.title ?? "").trim().slice(0, TITLE_MAX) || `Смотрим «${anime}»`;
  const access: "open" | "link" = input.access === "open" ? "open" : "link";

  cleanup(db, now);

  const created = transaction(db, () => {
    let code = makeCode();
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const exists = db.prepare("SELECT 1 AS ok FROM watch_rooms WHERE code = ?").get(code);
      if (!exists) break;
      code = makeCode();
    }

    const info = db
      .prepare(
        `INSERT INTO watch_rooms
           (code, title, anime, alias, poster, dub, access, episode, position, playing, state_by, state_at, created_at, host_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, 0, ?, ?, ?, ?)`,
      )
      .run(
        code,
        title,
        anime,
        (input.alias ?? "").slice(0, 200),
        (input.poster ?? "").slice(0, 500),
        (input.dub ?? "").slice(0, 60),
        access,
        clientId,
        now,
        now,
        clientId,
      );

    db.prepare(
      `INSERT INTO watch_room_members (room_id, client_id, nickname, joined_at, seen_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(num(info.lastInsertRowid), clientId, nickname, now, now);

    const row = roomByCode(db, code);
    if (!row) throw new Error("комната не создалась");
    return row;
  });

  return { ok: true, value: snapshot(db, created, now) };
}

/** Срез комнаты по коду. `clientId` — отметиться присутствием, `afterId` — только новые сообщения */
export function readRoom(
  db: Database,
  code: string,
  opts: { clientId?: string; afterId?: number } = {},
  now = Date.now(),
): WtResult<WtSnapshot> {
  const normalized = typeof code === "string" ? code.toUpperCase() : "";
  if (!isValidRoomCode(normalized)) return fail("Некорректный код комнаты", "invalid_code");

  cleanup(db, now);
  const row = roomByCode(db, normalized);
  if (!row) return fail("Комната не найдена или уже закрыта", "not_found");

  const clientId = opts.clientId;
  if (clientId && isValidClientId(clientId) && amMember(db, row.id, clientId, now)) {
    db.prepare("UPDATE watch_room_members SET seen_at = ? WHERE room_id = ? AND client_id = ?").run(
      now,
      row.id,
      clientId,
    );
  }

  return { ok: true, value: snapshot(db, row, now, Math.max(0, opts.afterId ?? 0)) };
}

/** Вход в комнату: проверяем вместимость и запоминаем ник */
export function joinRoom(
  db: Database,
  code: string,
  input: { clientId: string; nickname: string },
  now = Date.now(),
): WtResult<WtSnapshot> {
  if (!isValidClientId(input.clientId)) return fail("Некорректный клиент", "invalid_client");
  const normalized = typeof code === "string" ? code.toUpperCase() : "";
  if (!isValidRoomCode(normalized)) return fail("Некорректный код комнаты", "invalid_code");

  cleanup(db, now);
  const row = roomByCode(db, normalized);
  if (!row) return fail("Комната не найдена или уже закрыта", "not_found");

  const nickname = normalizeNickname(input.nickname);
  const members = activeMembers(db, row.id, now);
  const already = members.find((member) => member.clientId === input.clientId);

  if (!already && members.length >= WT_LIMITS[row.access]) {
    return fail("В комнате нет свободных мест", "full");
  }

  if (already) {
    db.prepare("UPDATE watch_room_members SET nickname = ?, seen_at = ? WHERE room_id = ? AND client_id = ?").run(
      nickname,
      now,
      row.id,
      input.clientId,
    );
  } else {
    db.prepare(
      `INSERT INTO watch_room_members (room_id, client_id, nickname, joined_at, seen_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(row.id, input.clientId, nickname, now, now);
  }

  return { ok: true, value: snapshot(db, row, now) };
}

export function leaveRoom(db: Database, code: string, clientId: string, now = Date.now()): WtResult<true> {
  if (!isValidClientId(clientId)) return fail("Некорректный клиент", "invalid_client");
  const normalized = typeof code === "string" ? code.toUpperCase() : "";
  cleanup(db, now);
  const row = roomByCode(db, normalized);
  if (!row) return fail("Комната не найдена", "not_found");

  db.prepare("DELETE FROM watch_room_members WHERE room_id = ? AND client_id = ?").run(row.id, clientId);
  const left = db.prepare("SELECT COUNT(*) AS c FROM watch_room_members WHERE room_id = ?").get(row.id);
  if (num(left?.c) === 0) {
    db.prepare("DELETE FROM watch_rooms WHERE id = ?").run(row.id);
  }
  return { ok: true, value: true };
}

/** Обновить состояние плеера (пауза, перемотка, серия) */
export function setRoomState(
  db: Database,
  code: string,
  clientId: string,
  state: RoomStateInput,
  now = Date.now(),
): WtResult<WtSnapshot> {
  if (!isValidClientId(clientId)) return fail("Некорректный клиент", "invalid_client");
  const normalized = typeof code === "string" ? code.toUpperCase() : "";
  if (!isValidRoomCode(normalized)) return fail("Некорректный код комнаты", "invalid_code");

  cleanup(db, now);
  const row = roomByCode(db, normalized);
  if (!row) return fail("Комната не найдена или уже закрыта", "not_found");
  if (!amMember(db, row.id, clientId, now)) return fail("Сначала войдите в комнату", "not_member");

  if (hostOf(row, activeMembers(db, row.id, now)) !== clientId) {
    return fail("Управляет создатель комнаты", "not_host");
  }

  const episode = Math.min(10_000, Math.max(1, Math.round(Number(state.episode) || 1)));
  const position = Math.min(86_400, Math.max(0, Number(state.position) || 0));
  const playing = state.playing ? 1 : 0;
  const rate = Math.min(4, Math.max(0.25, Number(state.rate) || row.rate || 1));

  db.prepare(
    `UPDATE watch_rooms
        SET episode = ?, position = ?, playing = ?, rate = ?, state_by = ?, state_at = ?
      WHERE id = ?`,
  ).run(episode, position, playing, rate, clientId, now, row.id);
  db.prepare("UPDATE watch_room_members SET seen_at = ? WHERE room_id = ? AND client_id = ?").run(
    now,
    row.id,
    clientId,
  );

  const updated = roomByCode(db, normalized);
  if (!updated) return fail("Комната не найдена", "not_found");
  return { ok: true, value: snapshot(db, updated, now) };
}

export function addRoomMessage(
  db: Database,
  code: string,
  clientId: string,
  body: string,
  now = Date.now(),
): WtResult<WtMessage> {
  if (!isValidClientId(clientId)) return fail("Некорректный клиент", "invalid_client");
  const normalized = typeof code === "string" ? code.toUpperCase() : "";
  cleanup(db, now);
  const row = roomByCode(db, normalized);
  if (!row) return fail("Комната не найдена", "not_found");
  if (!amMember(db, row.id, clientId, now)) return fail("Сначала войдите в комнату", "not_member");

  const text = String(body ?? "").trim();
  if (!text) return fail("Напишите сообщение", "invalid");
  if (text.length > MESSAGE_MAX) return fail(`Сообщение — не длиннее ${MESSAGE_MAX} символов`, "invalid");

  // Антиспам: не больше 6 сообщений за 20 секунд с одного клиента
  const recent = num(
    db
      .prepare(
        "SELECT COUNT(*) AS c FROM watch_room_messages WHERE room_id = ? AND client_id = ? AND created_at > ?",
      )
      .get(row.id, clientId, now - 20_000)?.c,
  );
  if (recent >= 6) return fail("Слишком часто — подождите немного", "rate_limit");

  const member = db
    .prepare("SELECT nickname FROM watch_room_members WHERE room_id = ? AND client_id = ?")
    .get(row.id, clientId);
  const nickname = normalizeNickname(member?.nickname);

  const info = db
    .prepare(
      `INSERT INTO watch_room_messages (room_id, client_id, nickname, body, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(row.id, clientId, nickname, text, now);

  db.prepare("UPDATE watch_room_members SET seen_at = ? WHERE room_id = ? AND client_id = ?").run(
    now,
    row.id,
    clientId,
  );

  return {
    ok: true,
    value: { id: num(info.lastInsertRowid), clientId, nickname, body: text, createdAt: now },
  };
}
