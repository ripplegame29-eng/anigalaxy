/**
 * Общий чат сайта: одна настоящая лента на всех игроков, без ботов.
 */

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
}

const MAX_BODY = 300;
const TAG_ID_RE = /^[A-Za-z0-9_-]{0,40}$/;

export function addChatMessage(
  db: Database,
  userId: number,
  nickname: string,
  input: { body: string; tagId?: string },
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

  const info = db
    .prepare("INSERT INTO chat_messages (user_id, nickname, tag_id, body, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(userId, nickname, tagId, body, now);
  return {
    ok: true,
    value: { id: num(info.lastInsertRowid), userId, nickname, tagId, body, createdAt: now },
  };
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
    body: str(row.body),
    createdAt: num(row.created_at),
  }));
}

const PROFILE_KEY = "animehub:profile:v1";

/** Добавляет к сообщениям аватар и рамку автора из его профиля */
export function withAuthors(db: Database, rows: ChatMessageRow[]): ChatMessageRow[] {
  const ids = [...new Set(rows.map((row) => row.userId))];
  if (!ids.length) return rows;
  const found = new Map<number, { avatar: string; frameId: string }>();
  const docs = db
    .prepare(
      `SELECT user_id, value, updated_at FROM user_docs WHERE doc_key = ? AND user_id IN (${ids.map(() => "?").join(",")})`,
    )
    .all(PROFILE_KEY, ...ids);
  for (const doc of docs) {
    try {
      const profile = JSON.parse(str(doc.value)) as { avatar?: unknown; frameId?: unknown };
      const raw = typeof profile.avatar === "string" ? profile.avatar : "";
      const userId = num(doc.user_id);
      const avatar = raw.startsWith("data:image/")
        ? `/api/avatar?u=${userId}&v=${num(doc.updated_at)}`
        : /^https?:\/\//.test(raw) || raw.startsWith("/")
          ? raw
          : "";
      found.set(userId, { avatar, frameId: typeof profile.frameId === "string" ? profile.frameId : "" });
    } catch {
      /* битый профиль — остаются инициалы */
    }
  }
  return rows.map((row) => ({ ...row, ...(found.get(row.userId) ?? { avatar: "", frameId: "" }) }));
}
