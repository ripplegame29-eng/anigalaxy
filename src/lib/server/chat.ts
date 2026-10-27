/**
 * Общий чат сайта: одна настоящая лента на всех игроков, без ботов.
 */

import { looksOf, NO_LOOK } from "./looks";
import { num, str, type Database } from "./sqlite";

export type ChatResult<T> = { ok: true; value: T } | { ok: false; error: string; code: string };

function fail<T>(error: string, code: string): ChatResult<T> {
  return { ok: false, error, code };
}

export interface ChatMessageRow {
  id: number;
  userId: number;
  nickname: string;
  tagId: string;
  body: string;
  createdAt: number;
  /** Адрес аватара автора или пустая строка */
  avatar?: string;
  /** Рамка аватара из каталога косметики */
  frameId?: string;
  /** id сообщения, на которое это — ответ (0 — не ответ) */
  replyTo: number;
  kind: "text" | "voice";
  audioMs: number;
  /** Пики голосовой дорожки: строка цифр 0–9 */
  wave: string;
  editedAt: number;
  deleted: boolean;
  /** Цитата исходного сообщения (подставляется в `decorate`) */
  reply?: { id: number; nickname: string; text: string; kind: "text" | "voice"; deleted: boolean } | null;
  reactions?: ChatReaction[];
}

export interface ChatReaction {
  emoji: string;
  count: number;
  mine: boolean;
}

/** Набор реакций — только он принимается сервером */
export const CHAT_EMOJI = ["👍", "❤️", "😂", "😮", "😢", "🔥", "👏", "🎉", "😍", "💀", "🙏", "👀"] as const;
export const VOICE_MAX_MS = 60_000;
export const VOICE_MAX_BYTES = 400_000;
export const EDIT_WINDOW_MS = 15 * 60_000;
const VOICE_MIMES = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/aac"];

const MAX_BODY = 300;
const TAG_ID_RE = /^[A-Za-z0-9_-]{0,40}$/;

export function addChatMessage(
  db: Database,
  userId: number,
  nickname: string,
  input: { body: string; tagId?: string; replyTo?: number },
  now = Date.now(),
): ChatResult<ChatMessageRow> {
  const body = input.body.trim();
  if (!body) return fail("Напишите сообщение", "invalid");
  if (body.length > MAX_BODY) return fail(`Сообщение — не длиннее ${MAX_BODY} символов`, "invalid");
  const tagId = input.tagId && TAG_ID_RE.test(input.tagId) ? input.tagId : "";

  // Защита от спама: не чаще 10 сообщений в минуту
  const recent = num(
    db.prepare("SELECT COUNT(*) AS c FROM chat_messages WHERE user_id = ? AND created_at > ?").get(userId, now - 60_000)?.c,
  );
  if (recent >= 10) return fail("Слишком часто — подождите немного", "rate_limit");

  const replyTo = validReply(db, input.replyTo);
  const info = db
    .prepare("INSERT INTO chat_messages (user_id, nickname, tag_id, body, created_at, reply_to) VALUES (?, ?, ?, ?, ?, ?)")
    .run(userId, nickname, tagId, body, now, replyTo);
  return {
    ok: true,
    value: blankRow({ id: num(info.lastInsertRowid), userId, nickname, tagId, body, createdAt: now, replyTo }),
  };
}

function blankRow(row: Pick<ChatMessageRow, "id" | "userId" | "nickname" | "tagId" | "body" | "createdAt"> & Partial<ChatMessageRow>): ChatMessageRow {
  return { replyTo: 0, kind: "text", audioMs: 0, wave: "", editedAt: 0, deleted: false, ...row };
}

/** Ответить можно только на существующее сообщение */
function validReply(db: Database, id: unknown): number {
  const n = Math.trunc(Number(id));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return db.prepare("SELECT id FROM chat_messages WHERE id = ?").get(n) ? n : 0;
}

/** Голосовое сообщение: длительность ≤ 60 с, файл ≤ 400 КБ, лимит общий с текстом */
export function addVoiceMessage(
  db: Database,
  userId: number,
  nickname: string,
  input: { data: Uint8Array; mime: string; ms: number; wave?: string; tagId?: string; replyTo?: number },
  now = Date.now(),
): ChatResult<ChatMessageRow> {
  const mime = input.mime.split(";")[0].trim().toLowerCase();
  if (!VOICE_MIMES.includes(mime)) return fail("Формат записи не поддерживается", "invalid");
  if (!input.data.byteLength) return fail("Пустая запись", "invalid");
  if (input.data.byteLength > VOICE_MAX_BYTES) return fail("Запись слишком большая", "invalid");
  const ms = Math.round(input.ms);
  if (!Number.isFinite(ms) || ms < 500) return fail("Слишком короткая запись", "invalid");
  if (ms > VOICE_MAX_MS + 1500) return fail("Голосовое — не длиннее минуты", "invalid");
  const wave = /^[0-9]{8,64}$/.test(input.wave ?? "") ? (input.wave as string) : "";
  const tagId = input.tagId && TAG_ID_RE.test(input.tagId) ? input.tagId : "";
  const recent = num(
    db.prepare("SELECT COUNT(*) AS c FROM chat_messages WHERE user_id = ? AND created_at > ?").get(userId, now - 60_000)?.c,
  );
  if (recent >= 10) return fail("Слишком часто — подождите немного", "rate_limit");

  const replyTo = validReply(db, input.replyTo);
  const info = db
    .prepare(
      "INSERT INTO chat_messages (user_id, nickname, tag_id, body, created_at, reply_to, kind, audio_ms, wave) VALUES (?, ?, ?, '', ?, ?, 'voice', ?, ?)",
    )
    .run(userId, nickname, tagId, now, replyTo, Math.min(ms, VOICE_MAX_MS), wave);
  const id = num(info.lastInsertRowid);
  db.prepare("INSERT INTO chat_audio (message_id, mime, data) VALUES (?, ?, ?)").run(id, mime, input.data);
  return {
    ok: true,
    value: blankRow({ id, userId, nickname, tagId, body: "", createdAt: now, replyTo, kind: "voice", audioMs: Math.min(ms, VOICE_MAX_MS), wave }),
  };
}

export function chatAudio(db: Database, id: number): { mime: string; data: Uint8Array } | null {
  const row = db
    .prepare(
      "SELECT a.mime, a.data FROM chat_audio a JOIN chat_messages m ON m.id = a.message_id WHERE a.message_id = ? AND m.deleted_at = 0",
    )
    .get(id);
  if (!row || !(row.data instanceof Uint8Array)) return null;
  return { mime: str(row.mime), data: row.data };
}

/** Правка своего текстового сообщения в течение 15 минут */
export function editChatMessage(db: Database, userId: number, id: number, bodyRaw: string, now = Date.now()): ChatResult<true> {
  const row = db.prepare("SELECT user_id, kind, created_at, deleted_at FROM chat_messages WHERE id = ?").get(id);
  if (!row || num(row.deleted_at)) return fail("Сообщение не найдено", "not_found");
  if (num(row.user_id) !== userId) return fail("Это чужое сообщение", "forbidden");
  if (str(row.kind) !== "text") return fail("Голосовое изменить нельзя", "invalid");
  if (now - num(row.created_at) > EDIT_WINDOW_MS) return fail("Править можно в течение 15 минут", "expired");
  const body = bodyRaw.trim();
  if (!body) return fail("Напишите сообщение", "invalid");
  if (body.length > MAX_BODY) return fail(`Сообщение — не длиннее ${MAX_BODY} символов`, "invalid");
  db.prepare("UPDATE chat_messages SET body = ?, edited_at = ? WHERE id = ?").run(body, now, id);
  return { ok: true, value: true };
}

/** Удаление: автор или администратор. Запись остаётся «следом», аудио стирается. */
export function deleteChatMessage(db: Database, userId: number, isAdminUser: boolean, id: number, now = Date.now()): ChatResult<true> {
  const row = db.prepare("SELECT user_id, deleted_at FROM chat_messages WHERE id = ?").get(id);
  if (!row || num(row.deleted_at)) return fail("Сообщение не найдено", "not_found");
  if (num(row.user_id) !== userId && !isAdminUser) return fail("Это чужое сообщение", "forbidden");
  db.prepare("UPDATE chat_messages SET deleted_at = ?, body = '' WHERE id = ?").run(now, id);
  db.prepare("DELETE FROM chat_audio WHERE message_id = ?").run(id);
  db.prepare("DELETE FROM chat_reactions WHERE message_id = ?").run(id);
  return { ok: true, value: true };
}

/** Переключает реакцию игрока; не больше 3 разных реакций на одно сообщение */
export function toggleChatReaction(db: Database, userId: number, id: number, emoji: string, now = Date.now()): ChatResult<boolean> {
  if (!(CHAT_EMOJI as readonly string[]).includes(emoji)) return fail("Такой реакции нет", "invalid");
  const msg = db.prepare("SELECT deleted_at FROM chat_messages WHERE id = ?").get(id);
  if (!msg || num(msg.deleted_at)) return fail("Сообщение не найдено", "not_found");
  const had = db.prepare("SELECT 1 AS x FROM chat_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?").get(id, userId, emoji);
  if (had) {
    db.prepare("DELETE FROM chat_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?").run(id, userId, emoji);
    return { ok: true, value: false };
  }
  const mine = num(db.prepare("SELECT COUNT(*) AS c FROM chat_reactions WHERE message_id = ? AND user_id = ?").get(id, userId)?.c);
  if (mine >= 3) return fail("Не больше трёх реакций на сообщение", "limit");
  const burst = num(db.prepare("SELECT COUNT(*) AS c FROM chat_reactions WHERE user_id = ? AND created_at > ?").get(userId, now - 60_000)?.c);
  if (burst >= 40) return fail("Слишком часто — подождите немного", "rate_limit");
  db.prepare("INSERT INTO chat_reactions (message_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?)").run(id, userId, emoji, now);
  return { ok: true, value: true };
}

/** Последние сообщения (по возрастанию id); afterId — только то, что новее */
export function listChatMessages(db: Database, limit = 60, afterId = 0): ChatMessageRow[] {
  const rows = afterId
    ? db
        .prepare("SELECT * FROM chat_messages WHERE id > ? ORDER BY id ASC LIMIT ?")
        .all(afterId, Math.min(Math.max(limit, 1), 200))
    : db
        .prepare("SELECT * FROM chat_messages ORDER BY id DESC LIMIT ?")
        .all(Math.min(Math.max(limit, 1), 200))
        .reverse();
  return rows.map((row) => ({
    id: num(row.id),
    userId: num(row.user_id),
    nickname: str(row.nickname),
    tagId: str(row.tag_id),
    body: str(row.deleted_at ? "" : row.body),
    createdAt: num(row.created_at),
    replyTo: num(row.reply_to),
    kind: str(row.kind) === "voice" ? "voice" : "text",
    audioMs: num(row.audio_ms),
    wave: str(row.wave),
    editedAt: num(row.edited_at),
    deleted: num(row.deleted_at) > 0,
  }));
}

function reactionsFor(db: Database, ids: number[], viewerId: number): Map<number, ChatReaction[]> {
  const out = new Map<number, ChatReaction[]>();
  if (!ids.length) return out;
  const marks = ids.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT message_id, emoji, user_id FROM chat_reactions WHERE message_id IN (${marks}) ORDER BY created_at ASC`)
    .all(...ids);
  for (const row of rows) {
    const id = num(row.message_id);
    const list = out.get(id) ?? [];
    const emoji = str(row.emoji);
    let entry = list.find((item) => item.emoji === emoji);
    if (!entry) {
      entry = { emoji, count: 0, mine: false };
      list.push(entry);
    }
    entry.count += 1;
    if (num(row.user_id) === viewerId) entry.mine = true;
    out.set(id, list);
  }
  return out;
}

/** Добавляет цитаты и реакции к сообщениям (viewerId — кто смотрит, 0 — гость) */
export function decorate(db: Database, rows: ChatMessageRow[], viewerId = 0): ChatMessageRow[] {
  const reactions = reactionsFor(db, rows.map((row) => row.id), viewerId);
  const replyIds = [...new Set(rows.map((row) => row.replyTo).filter(Boolean))];
  const replies = new Map<number, NonNullable<ChatMessageRow["reply"]>>();
  if (replyIds.length) {
    const marks = replyIds.map(() => "?").join(",");
    for (const row of db.prepare(`SELECT id, nickname, body, kind, deleted_at FROM chat_messages WHERE id IN (${marks})`).all(...replyIds)) {
      const deleted = num(row.deleted_at) > 0;
      replies.set(num(row.id), {
        id: num(row.id),
        nickname: str(row.nickname),
        text: deleted ? "" : str(row.body).slice(0, 110),
        kind: str(row.kind) === "voice" ? "voice" : "text",
        deleted,
      });
    }
  }
  return rows.map((row) => ({
    ...row,
    reply: row.replyTo ? (replies.get(row.replyTo) ?? null) : undefined,
    reactions: reactions.get(row.id) ?? [],
  }));
}

/** Лёгкая сводка по последним сообщениям: то, что может измениться после показа */
export function chatPatches(db: Database, viewerId: number, limit = 80): { id: number; r: ChatReaction[]; e: number; d: boolean; b?: string }[] {
  const rows = listChatMessages(db, limit);
  const reactions = reactionsFor(db, rows.map((row) => row.id), viewerId);
  return rows.map((row) => ({
    id: row.id,
    r: reactions.get(row.id) ?? [],
    e: row.editedAt,
    d: row.deleted,
    ...(row.editedAt ? { b: row.body } : {}),
  }));
}

/** Добавляет к сообщениям аватар и рамку автора из его профиля */
export function withAuthors(db: Database, rows: ChatMessageRow[]): ChatMessageRow[] {
  const looks = looksOf(db, rows.map((row) => row.userId));
  return rows.map((row) => ({ ...row, ...(looks.get(row.userId) ?? NO_LOOK) }));
}
