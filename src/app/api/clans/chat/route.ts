import { clanIdOfUser } from "@/lib/server/clans";
import { json, readJson, route } from "@/lib/server/http";
import { num, str } from "@/lib/server/sqlite";

export const runtime = "nodejs";

const PAGE = 60;
const MAX_LEN = 500;

type Row = Record<string, unknown>;
const toMsg = (r: Row) => ({
  id: num(r.id),
  userId: num(r.user_id),
  nickname: str(r.nickname),
  role: str(r.role) || "member",
  text: str(r.text),
  at: num(r.created_at),
});

const SELECT = `SELECT c.id, c.user_id, c.text, c.created_at, u.nickname, m.role
  FROM clan_chat c JOIN users u ON u.id = c.user_id
  LEFT JOIN clan_members m ON m.clan_id = c.clan_id AND m.user_id = c.user_id`;

/** Клановый чат. GET ?after=<id> — новые сообщения (без after — последние 60) */
export const GET = route(
  ({ db, request, user }) => {
    const clanId = clanIdOfUser(db, user!.id);
    if (clanId === null) return json({ error: "Вы не в клане" }, 403);
    const after = Number(request.nextUrl.searchParams.get("after") ?? 0);
    const rows = after > 0
      ? db.prepare(`${SELECT} WHERE c.clan_id = ? AND c.id > ? ORDER BY c.id LIMIT ?`).all(clanId, after, PAGE)
      : db.prepare(`SELECT * FROM (${SELECT} WHERE c.clan_id = ? ORDER BY c.id DESC LIMIT ?) ORDER BY id`).all(clanId, PAGE);
    return json({ messages: (rows as Row[]).map(toMsg) });
  },
  { auth: true },
);

/** POST {text} — написать в чат клана (не чаще раза в 1,5 с) */
export const POST = route(
  async ({ db, request, user }) => {
    const clanId = clanIdOfUser(db, user!.id);
    if (clanId === null) return json({ error: "Вы не в клане" }, 403);
    const body = await readJson(request);
    const text = String(body?.text ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_LEN);
    if (!text) return json({ error: "Пустое сообщение" }, 400);
    const last = num(db.prepare("SELECT MAX(created_at) AS t FROM clan_chat WHERE clan_id = ? AND user_id = ?").get(clanId, user!.id)?.t);
    const now = Date.now();
    if (now - last < 1500) return json({ error: "Не так быстро" }, 429);
    const r = db.prepare("INSERT INTO clan_chat (clan_id, user_id, text, created_at) VALUES (?, ?, ?, ?)").run(clanId, user!.id, text, now);
    const row = db.prepare(`${SELECT} WHERE c.id = ?`).get(Number(r.lastInsertRowid)) as Row;
    return json({ message: toMsg(row) });
  },
  { write: true, auth: true },
);
