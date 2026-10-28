import { AssistantError } from "@/lib/server/assistant";
import { describeFrame, frameAiConfigured, takeFrameAiQuota } from "@/lib/server/frame-ai";
import { json, route } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 6 * 1024 * 1024;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/**
 * POST /api/frame/ai — multipart: `file` (картинка до 6 МБ) или `url`.
 * Только для вошедших: у модели есть дневные лимиты, анонимный доступ
 * исчерпал бы их за минуты.
 */
export const POST = route(
  async ({ request, user }) => {
    if (!frameAiConfigured()) return json({ error: "ИИ-разбор ещё не подключён", code: "not_configured" }, 503);

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return json({ error: "Некорректный запрос", code: "bad_input" }, 400);
    }

    let image = "";
    const file = form.get("file");
    const url = form.get("url");
    if (file instanceof File) {
      if (!TYPES.has(file.type)) return json({ error: "Подходят JPG, PNG, WebP и GIF.", code: "bad_input" }, 415);
      if (file.size > MAX_BYTES) return json({ error: "Файл больше 6 МБ.", code: "bad_input" }, 413);
      image = `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
    } else if (typeof url === "string" && /^https?:\/\//i.test(url.trim())) {
      image = url.trim();
    } else {
      return json({ error: "Добавьте картинку или ссылку на неё.", code: "bad_input" }, 400);
    }

    if (!takeFrameAiQuota(user!.id)) {
      return json({ error: "Слишком много разборов подряд. Попробуйте через пару минут.", code: "rate_limit" }, 429);
    }

    try {
      return json(await describeFrame(image));
    } catch (error) {
      if (error instanceof AssistantError) return json({ error: error.message, code: error.code }, error.status);
      throw error;
    }
  },
  { write: true, auth: true },
);
