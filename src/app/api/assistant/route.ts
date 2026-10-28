import { json, readJson, route } from "@/lib/server/http";
import {
  AssistantError,
  askAssistant,
  assistantConfigured,
  cleanTurns,
  takeAssistantQuota,
} from "@/lib/server/assistant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Ответ модели + поиск по каталогу могут идти десятки секунд
export const maxDuration = 60;

export const POST = route(
  async ({ request, user }) => {
    if (!assistantConfigured()) {
      return json({ error: "ИИ-ассистент ещё не подключён", code: "not_configured" }, 503);
    }
    const body = await readJson(request);
    const turns = cleanTurns(body?.messages);
    if (!turns.length) return json({ error: "Напишите вопрос", code: "bad_input" }, 400);

    if (!takeAssistantQuota(user!.id)) {
      return json({ error: "Слишком много вопросов подряд. Передохните пару минут.", code: "rate_limit" }, 429);
    }

    try {
      return json(await askAssistant(turns));
    } catch (error) {
      if (error instanceof AssistantError) {
        return json({ error: error.message, code: error.code }, error.status);
      }
      throw error;
    }
  },
  { write: true, auth: true },
);
