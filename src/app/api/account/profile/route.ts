import { displayNameError } from "@/lib/nickname";
import { json, route, readJson } from "@/lib/server/http";

export const runtime = "nodejs";

const FIVE_YEARS_MS = 5 * 365 * 86_400_000;

function bounded(value: unknown, max: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max ? Math.floor(value) : null;
}

/**
 * Поля аккаунта, которые меняются на клиенте: отображаемое имя (купленная
 * услуга) и срок Premium. Платёжной системы пока нет, поэтому сервер лишь
 * хранит значения в разумных границах — чтобы они переезжали между устройствами.
 */
export const POST = route(
  async ({ db, request, user }) => {
    const body = await readJson(request);
    if (!body) return json({ error: "Некорректный запрос" }, 400);
    const now = Date.now();

    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : null;
    if (displayName !== null && displayName !== "" && displayNameError(displayName)) {
      return json({ error: displayNameError(displayName) }, 400);
    }
    const until = bounded(body.premiumUntil, now + FIVE_YEARS_MS);
    const since = bounded(body.premiumSince, now + 1000);
    const total = bounded(body.premiumTotalDays, 5 * 366);

    db.prepare(
      `UPDATE users SET
         display_name = COALESCE(?, display_name),
         premium_until = COALESCE(?, premium_until),
         premium_since = COALESCE(?, premium_since),
         premium_total_days = COALESCE(?, premium_total_days)
       WHERE id = ?`,
    ).run(displayName, until, since, total, user!.id);
    return json({ ok: true });
  },
  { write: true, auth: true },
);
