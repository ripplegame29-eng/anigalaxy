/**
 * ИИ-разбор кадра для /frame: когда trace.moe не нашёл сцену (арт, кадр с
 * субтитрами, редкий момент), модель с поддержкой изображений смотрит на
 * картинку, описывает её и предлагает, из какого аниме она.
 *
 * Работает через OpenRouter. Модель по умолчанию — бесплатная
 * nvidia/nemotron-3.5-super-vl:free, её можно заменить переменной
 * OPENROUTER_VISION_MODEL. Названия из ответа сверяются с каталогом сайта.
 */

import { AssistantError, OPENROUTER_URL, findInCatalog, postJson, str } from "@/lib/server/assistant";

const DEFAULT_VISION_MODEL = "nvidia/nemotron-3.5-super-vl:free";

export type Confidence = "high" | "medium" | "low";

export interface FramePick {
  /** null — ИИ назвал тайтл, но в каталоге сайта его нет */
  id: string | null;
  title: string;
  year?: number;
  poster?: string;
  shikimoriId?: number;
  genres: string[];
  why: string;
  confidence: Confidence;
}

export interface FrameAiResult {
  description: string;
  picks: FramePick[];
}

export function frameAiConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

const PROMPT = `Ты — эксперт по аниме. Тебе показывают кадр или арт. Определи, из какого он аниме.

Верни только JSON такого вида, без текста вокруг:
{"description": "1–2 предложения по-русски: что изображено на кадре", "guesses": [{"title": "название по-русски", "alt": "оригинальное название латиницей", "confidence": "high|medium|low", "why": "по каким признакам ты так решил, одной фразой"}]}

Правила:
- Предлагай от 0 до 3 вариантов, самый вероятный первым.
- confidence: high — узнал персонажа или сцену, medium — похоже по стилю и деталям, low — предположение.
- Не выдумывай. Если не уверен или это не аниме (фото, мем, игра), верни пустой список guesses и честно скажи об этом в description.
- Называй только аниме, в существовании которых уверен.`;

const CONFIDENCE = new Set<Confidence>(["high", "medium", "low"]);

function parseVision(text: string): { description: string; guesses: Record<string, unknown>[] } {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  try {
    if (start < 0 || end <= start) throw new Error("нет JSON");
    const parsed = JSON.parse(text.slice(start, end + 1)) as { description?: unknown; guesses?: unknown };
    return {
      description: str(parsed.description, 400),
      guesses: Array.isArray(parsed.guesses) ? (parsed.guesses as Record<string, unknown>[]) : [],
    };
  } catch {
    throw new AssistantError("ИИ ответил не по формату. Попробуйте ещё раз или возьмите другой кадр.", "upstream", 502);
  }
}

/** `image` — адрес картинки или data:-URL с base64 */
export async function describeFrame(image: string): Promise<FrameAiResult> {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) throw new AssistantError("ИИ-разбор ещё не подключён", "not_configured", 503);

  const data = (await postJson(
    OPENROUTER_URL,
    { Authorization: `Bearer ${key}`, "HTTP-Referer": "https://anigalaxy.space", "X-Title": "AniGalaxy" },
    {
      model: process.env.OPENROUTER_VISION_MODEL?.trim() || DEFAULT_VISION_MODEL,
      temperature: 0.3,
      max_tokens: 1500,
      messages: [
        { role: "system", content: PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Из какого это аниме?" },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ],
    },
  )) as { choices?: { message?: { content?: string | null } }[] } | null;

  const { description, guesses } = parseVision(data?.choices?.[0]?.message?.content ?? "");

  const wanted = guesses
    .slice(0, 3)
    .map((g) => ({
      title: str(g.title, 120),
      alt: str(g.alt, 120),
      why: str(g.why, 220),
      confidence: (CONFIDENCE.has(g.confidence as Confidence) ? g.confidence : "low") as Confidence,
    }))
    .filter((g) => g.title);

  const found = await Promise.all(wanted.map((g) => findInCatalog(g.title, g.alt)));

  // Догадки ИИ показываем все: даже если тайтла нет в каталоге, пользователю
  // важно узнать, что это за аниме. Совпавшие с каталогом ведут на страницу тайтла.
  const seen = new Set<string>();
  const picks: FramePick[] = [];
  found.forEach((card, i) => {
    const mark = card ? card.id : `t:${wanted[i].title.toLowerCase()}`;
    if (seen.has(mark)) return;
    seen.add(mark);
    picks.push({
      id: card?.id ?? null,
      title: card?.title ?? wanted[i].title,
      year: card?.year,
      poster: card?.poster,
      shikimoriId: card?.shikimoriId,
      genres: card?.genres.slice(0, 3) ?? [],
      why: wanted[i].why,
      confidence: wanted[i].confidence,
    });
  });

  return { description: description || "ИИ не смог описать этот кадр.", picks };
}

/* ------------------------------ Лимиты ----------------------------------- */

const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 8;
const hits = new Map<number, number[]>();

export function takeFrameAiQuota(userId: number, now = Date.now()): boolean {
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(userId, recent);
    return false;
  }
  recent.push(now);
  hits.set(userId, recent);
  return true;
}
