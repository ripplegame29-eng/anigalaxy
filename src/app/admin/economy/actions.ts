"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/admin/audit";
import { db } from "@/lib/db";
import { PROGRESSION_CONFIG } from "@/lib/progression/progression.config";
import { requirePermission } from "@/lib/require-admin";

export interface EconomyState {
  error: string | null;
  ok: string | null;
}

const IDLE: EconomyState = { error: null, ok: null };

function parseId(formData: FormData): string | null {
  const id = String(formData.get("id") ?? "").trim();
  return /^[a-z0-9]{20,30}$/i.test(id) ? id : null;
}

async function guard() {
  return requirePermission("economy", "/admin/economy");
}

/* ------------------------------- Правка -------------------------------- */

/** Поля, которые админ может править руками. */
const ADJUSTABLE = new Set(["level", "acBalance", "xpTotal"] as const);
type Adjustable = (typeof ADJUSTABLE extends Set<infer T> ? T : never);

/**
 * Движок сам не пускает пересчитывать уровень: уровень — следствие накопленного
 * XP, и поднять его вручную без XP означает рассинхрон между числом и опытом
 * (следующее событие тут же «съест» разницу). Поэтому здесь правится XP, а
 * уровень пересчитывается по кривой конфига.
 *
 * Ошибиться легко, поэтому изменения всегда идут в аудит-лог: экономику
 * крутят все, а откатить можно только зная, что было до.
 */
export async function adjustProgressAction(
  _prev: EconomyState,
  formData: FormData,
): Promise<EconomyState> {
  const session = await guard();

  const id = parseId(formData);
  if (!id) return { ...IDLE, error: "Некорректный идентификатор" };

  const field = String(formData.get("field") ?? "");
  if (!ADJUSTABLE.has(field as Adjustable)) {
    return { ...IDLE, error: "Такое поле править нельзя" };
  }

  const raw = String(formData.get("value") ?? "").trim();
  const value = Number(raw);
  if (!Number.isFinite(value)) return { ...IDLE, error: "Значение должно быть числом" };
  if (value < 0) return { ...IDLE, error: "Отрицательные значения запрещены" };
  if (value > 1_000_000) return { ...IDLE, error: "Слишком большое значение" };

  const row = await db.playerProgress.findUnique({ where: { userId: id } });
  if (!row) return { ...IDLE, error: "У игрока нет прогресса на сервере" };

  let doc: Record<string, unknown>;
  try {
    doc = JSON.parse(row.doc) as Record<string, unknown>;
  } catch {
    return { ...IDLE, error: "Документ повреждён — править нельзя" };
  }

  const progress = (doc.progress ?? {}) as Record<string, unknown>;
  const before = { ...progress };

  progress[field] = value;

  if (field === "xpTotal") {
    // Уровень — следствие опыта. Пересчитываем по кривой конфига, иначе
    // в панели и на сайте разные цифры.
    progress.level = levelForXp(value);
  }

  doc.progress = progress;
  doc.touchedByAdmin = true;

  await db.playerProgress.update({
    where: { userId: id },
    data: {
      doc: JSON.stringify(doc),
      touchedByAdmin: true,
      updatedAt: Date.now(),
      revision: { increment: 1 },
    },
  });

  const user = await db.user.findUnique({
    where: { id },
    select: { nickname: true },
  });

  await audit({
    actorId: session.user.id,
    action: "progress.adjust",
    targetType: "progress",
    targetId: id,
    summary: `${user?.nickname ?? id}: ${field} ${String(before[field] ?? 0)} → ${value}`,
    before,
    after: progress,
  });

  revalidatePath("/admin/economy");
  return { ...IDLE, ok: `${user?.nickname ?? "игрок"}: ${field} = ${value}` };
}

/**
 * Уровень по накопленному XP.
 *
 * Коэффициенты кривой берём из PROGRESSION_CONFIG, а не дублируем числами:
 * если автор поднимет base или exponent, формула в панели обязана посчитать
 * то же самое, иначе админ правит «уровень 40», а сайт показывает 35.
 */
function levelForXp(xpTotal: number): number {
  const { base, exponent, maxLevel } = PROGRESSION_CONFIG.levels;

  let level = 1;
  let spent = 0;

  // Кривая монотонна, поэтому достаточно накапливать шаг за шагом: 100 итераций
  // — микросекунды, а двоичный поиск по накопленной сумме тут был бы сложнее
  // без выигрыша.
  while (level < maxLevel) {
    const cost = Math.round(base * Math.pow(level, exponent));
    if (spent + cost > xpTotal) break;
    spent += cost;
    level += 1;
  }

  return level;
}