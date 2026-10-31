import { displayNameError } from "@/lib/nickname";
import { json, route, readJson } from "@/lib/server/http";
import { findUserById, toPublic } from "@/lib/server/users";

export const runtime = "nodejs";

/**
 * Профиль аккаунта, который можно менять из браузера.
 *
 * Здесь только отображаемое имя. Срок Premium — серверное право: его выдают
 * оплата через Platega, промо-механики и администратор. Присланные клиентом
 * `premiumUntil`/`premiumSince`/`premiumTotalDays` намеренно игнорируются,
 * иначе подписку можно было бы продлить обычным запросом.
 */
export const POST = route(
  async ({ db, request, user }) => {
    const body = await readJson(request);
    if (!body) return json({ error: "Некорректный запрос" }, 400);

    if (typeof body.displayName === "string") {
      const displayName = body.displayName.trim();
      if (displayName !== "" && displayNameError(displayName)) {
        return json({ error: displayNameError(displayName) }, 400);
      }
      db.prepare("UPDATE users SET display_name = ? WHERE id = ?").run(displayName, user!.id);
    }

    const fresh = findUserById(db, user!.id);
    return json({ ok: true, account: fresh ? toPublic(fresh) : null });
  },
  { write: true, auth: true },
);
