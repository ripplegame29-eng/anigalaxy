import { deleteAllDocs, listDocs, putDoc } from "@/lib/server/docs";
import { flushGrants } from "@/lib/server/grants";
import { onProgressSaved } from "@/lib/server/referrals";
import { json, route, readJson } from "@/lib/server/http";

export const runtime = "nodejs";

/** Все документы игрока (клиент сверяет версии при входе) */
export const GET = route(({ db, user }) => json({ docs: listDocs(db, user!.id) }), { auth: true });

/**
 * Пакетная запись: `{ docs: [{ key, value, baseVersion? }] }`.
 * Ответ — результат по каждому ключу (версия, конфликт с серверной копией или отказ).
 * `{ wipe: true }` стирает все серверные данные игрока.
 */
export const POST = route(
  async ({ db, request, user }) => {
    const body = await readJson(request);
    if (!body) return json({ error: "Некорректный запрос" }, 400);
    if (body.wipe === true) {
      deleteAllDocs(db, user!.id);
      return json({ ok: true });
    }
    if (!Array.isArray(body.docs) || body.docs.length > 60) return json({ error: "Ожидается docs (до 60 штук)" }, 400);

    const results = body.docs.map((raw: unknown) => {
      const item = (raw ?? {}) as { key?: unknown; value?: unknown; baseVersion?: unknown };
      const key = typeof item.key === "string" ? item.key : "";
      const result = putDoc(db, user!.id, {
        key,
        value: typeof item.value === "string" ? item.value : "",
        baseVersion: typeof item.baseVersion === "number" ? item.baseVersion : undefined,
      });
      return { key, ...result };
    });
    if (results.some((r: { key: string; ok?: boolean }) => r.key === "animehub:progress:v1" && r.ok)) {
      try {
        flushGrants(db, user!.id);
      } catch (error) {
        console.error("[grants]", error);
      }
      onProgressSaved(db, user!.id);
    }
    return json({ results });
  },
  { write: true, auth: true },
);
