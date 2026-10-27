import {
  closeRoom,
  dashboard,
  deleteChatMessage,
  deleteComment,
  isAdmin,
  listLog,
  listRooms,
  logAction,
  nicknameOf,
  recentChat,
  recentComments,
  searchUsers,
  setBan,
  setPremiumDays,
  setRole,
  userDetail,
} from "@/lib/server/admin";
import {
  adjustBalance,
  broadcast,
  deleteUser,
  equipItem,
  killSessions,
  massGrant,
  notifyUser,
  resetPassword,
  setItem,
  updateAccount,
  type BalanceInput,
} from "@/lib/server/admin-edit";
import { analytics } from "@/lib/server/analytics";
import { clearErrors, listErrors, resolveError } from "@/lib/server/errors";
import { json, readJson, route } from "@/lib/server/http";
import { listReports, resolveReport } from "@/lib/server/social";
import { addMessage, getTicket, listAllTickets, setTicketStatus, staffUnreadCount } from "@/lib/server/tickets";
import { tg } from "@/lib/server/telegram-login";

export const runtime = "nodejs";

/** `?view=dashboard|users|user|reports|chat|comments|rooms|errors|log` — данные админ-панели, только для admin */
export const GET = route(
  ({ db, request, user }) => {
    if (!isAdmin(user)) return json({ error: "Недостаточно прав" }, 403);
    const params = request.nextUrl.searchParams;
    const view = params.get("view");
    const int = (name: string, fallback = 0) => {
      const n = Number(params.get(name));
      return Number.isFinite(n) ? n : fallback;
    };
    switch (view) {
      case "dashboard":
        return json(dashboard(db));
      case "analytics":
        return json(analytics(db, int("days", 7)));
      case "users":
        return json(
          searchUsers(db, {
            q: params.get("q") ?? "",
            filter: params.get("filter") ?? "all",
            sort: params.get("sort") ?? "new",
            offset: int("offset"),
            limit: int("limit", 30),
          }),
        );
      case "user": {
        const detail = userDetail(db, int("id"));
        return detail ? json(detail) : json({ error: "Пользователь не найден" }, 404);
      }
      case "reports":
        return json({ reports: listReports(db, params.get("status") === "resolved" ? "resolved" : "open") });
      case "tickets": {
        const st = params.get("status");
        const filter = st === "answered" || st === "closed" || st === "all" ? st : "open";
        return json({ tickets: listAllTickets(db, filter), unread: staffUnreadCount(db) });
      }
      case "ticket": {
        const r = getTicket(db, int("id"), { id: user!.id, staff: true });
        return r.ok ? json(r.value) : json({ error: r.error }, 404);
      }
      case "chat":
        return json({ messages: recentChat(db) });
      case "comments":
        return json({ comments: recentComments(db, params.get("q") ?? "") });
      case "rooms":
        return json({ rooms: listRooms(db) });
      case "errors":
        return json({
          errors: listErrors(db, { resolved: params.get("resolved") === "1", source: params.get("source") ?? "" }),
        });
      case "log":
        return json({ log: listLog(db) });
      default:
        return json({ error: "Неизвестный раздел" }, 400);
    }
  },
  { auth: true },
);

const s = (v: unknown, max = 500) => (typeof v === "string" ? v.slice(0, max) : "");
const n = (v: unknown) => (v === "" || v === null || v === undefined ? undefined : Number(v));

/** Действия админ-панели: тело `{action, ...}` */
export const POST = route(
  async ({ db, request, user }) => {
    if (!isAdmin(user)) return json({ error: "Недостаточно прав" }, 403);
    const body = await readJson(request);
    if (!body) return json({ error: "Некорректный запрос" }, 400);
    const id = Number(body.id);
    const action = String(body.action ?? "");
    const target = Number.isFinite(id) ? nicknameOf(db, id) : "";

    const fail = (error: string) => json({ ok: false, error }, 400);
    const okWith = (log: string, extra: Record<string, unknown> = {}) => {
      logAction(db, user, action, Number.isFinite(id) ? id : 0, target, log);
      return json({ ok: true, ...extra });
    };
    const fromResult = (result: { ok: boolean; error?: string }, log: string) => (result.ok ? okWith(log) : fail(result.error ?? "Не удалось"));

    switch (action) {
      case "ban": {
        const days = Number(body.days) || 0;
        return fromResult(setBan(db, user, id, days), days > 0 ? `бан на ${days} дн.${s(body.reason, 120) ? ` — ${s(body.reason, 120)}` : ""}` : "бан снят");
      }
      case "premium": {
        const days = Number(body.days) || 0;
        return fromResult(setPremiumDays(db, id, days), days > 0 ? `Premium +${days} дн.` : "Premium снят");
      }
      case "role":
        return fromResult(setRole(db, user, id, String(body.role ?? "")), `роль → ${String(body.role)}`);
      case "resolve": {
        const result = resolveReport(db, user.id, user.role, id);
        return fromResult(result.ok ? { ok: true } : { ok: false, error: result.error }, `жалоба #${id} закрыта`);
      }
      case "ticketReply": {
        const r = addMessage(db, id, { id: user.id, staff: true }, s(body.text, 2000));
        if (!r.ok) return fail(r.error);
        notifyUser(db, r.value.ownerId, `Поддержка ответила на обращение «${r.value.subject.slice(0, 60)}»`);
        const tgRow = db.prepare("SELECT telegram_id FROM users WHERE id = ?").get(r.value.ownerId);
        if (tgRow?.telegram_id) {
          void tg("sendMessage", { chat_id: Number(tgRow.telegram_id), text: `💬 Поддержка AniGalaxy ответила на обращение «${r.value.subject.slice(0, 60)}». Откройте сайт, чтобы прочитать.` });
        }
        return okWith(`ответ в обращении #${id}`);
      }
      case "ticketStatus": {
        const status = body.status === "closed" ? "closed" : "open";
        const r = setTicketStatus(db, id, { id: user.id, staff: true }, status);
        return r.ok ? okWith(`обращение #${id}: ${status === "closed" ? "закрыто" : "открыто заново"}`) : fail(r.error);
      }
      case "deleteChat":
        return fromResult(deleteChatMessage(db, id), `сообщение чата #${id} удалено`);
      case "deleteComment":
        return fromResult(deleteComment(db, id), `комментарий #${id} удалён`);
      case "closeRoom":
        return fromResult(closeRoom(db, id), `комната #${id} закрыта`);

      case "account": {
        const r = updateAccount(db, user, id, {
          nickname: typeof body.nickname === "string" ? body.nickname : undefined,
          displayName: typeof body.displayName === "string" ? body.displayName : undefined,
          email: typeof body.email === "string" ? body.email : undefined,
          bio: typeof body.bio === "string" ? body.bio : undefined,
          signature: typeof body.signature === "string" ? body.signature : undefined,
          resetAvatar: body.resetAvatar === true,
          clearBackground: body.clearBackground === true,
        });
        return r.ok ? okWith(r.value) : fail(r.error);
      }
      case "balance": {
        const input: BalanceInput = {
          ac: n(body.ac),
          xp: n(body.xp),
          trophy: n(body.trophy),
          freezes: n(body.freezes),
          battlepassXp: n(body.battlepassXp),
          setAc: n(body.setAc),
          setXp: n(body.setXp),
          setLevel: n(body.setLevel),
          setStreak: n(body.setStreak),
          setTrophy: n(body.setTrophy),
          setFreezes: n(body.setFreezes),
          note: s(body.note, 120),
          notify: body.notify !== false,
        };
        const r = adjustBalance(db, user, id, input);
        return r.ok ? okWith(r.value) : fail(r.error);
      }
      case "item": {
        const r = setItem(db, user, id, String(body.kind ?? ""), String(body.itemId ?? ""), body.grant !== false, {
          equip: body.equip === true,
          progress: n(body.progress),
          notify: body.notify !== false,
          label: s(body.label, 80),
        });
        return r.ok ? okWith(r.value) : fail(r.error);
      }
      case "equip": {
        const r = equipItem(db, id, String(body.kind ?? ""), String(body.itemId ?? ""));
        return r.ok ? okWith(`${String(body.kind)}: ${String(body.itemId) || "снято"}`) : fail(r.error);
      }
      case "notify": {
        const r = notifyUser(db, id, s(body.text, 300));
        return r.ok ? okWith(s(body.text, 120)) : fail(r.error);
      }
      case "password": {
        const r = resetPassword(db, user, id, typeof body.password === "string" ? body.password : undefined);
        if (!r.ok) return fail(r.error);
        logAction(db, user, action, id, target, "пароль сброшен");
        return json({ ok: true, password: r.value });
      }
      case "sessions": {
        const r = killSessions(db, id);
        return r.ok ? okWith(`сессий закрыто: ${r.value}`, { closed: r.value }) : fail(r.error);
      }
      case "deleteUser": {
        const r = deleteUser(db, user, id);
        return r.ok ? okWith(`аккаунт ${r.value} удалён`) : fail(r.error);
      }
      case "broadcast": {
        const r = broadcast(db, String(body.audience ?? "all"), s(body.text, 300));
        return r.ok ? okWith(`рассылка (${String(body.audience)}): ${r.value} получателей`, { count: r.value }) : fail(r.error);
      }
      case "massGrant": {
        const r = massGrant(db, user, String(body.audience ?? "all"), {
          ac: n(body.ac),
          xp: n(body.xp),
          premiumDays: n(body.premiumDays),
          note: s(body.note, 120),
          notify: body.notify !== false,
        });
        return r.ok
          ? okWith(`выдача (${String(body.audience)}): AC ${n(body.ac) ?? 0}, XP ${n(body.xp) ?? 0}, Premium ${n(body.premiumDays) ?? 0} дн. → ${r.value}`, { count: r.value })
          : fail(r.error);
      }
      case "errorResolve":
        return resolveError(db, id) ? json({ ok: true }) : fail("Ошибка не найдена");
      case "errorClear": {
        const count = clearErrors(db, body.onlyResolved === true);
        return okWith(`журнал ошибок очищен: ${count}`, { count });
      }
      default:
        return json({ error: "Неизвестное действие" }, 400);
    }
  },
  { write: true, auth: true },
);
