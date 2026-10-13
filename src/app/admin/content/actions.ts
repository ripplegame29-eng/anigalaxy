"use server";

import { revalidatePath } from "next/cache";

import {
  allowedFields,
  CONTENT_KINDS,
  requiredFields,
  URL_FIELDS,
  type ContentKind,
} from "@/lib/admin/content-kinds";
import { audit, pick } from "@/lib/admin/audit";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/require-admin";

export interface ContentState {
  error: string | null;
  ok: string | null;
}

const IDLE: ContentState = { error: null, ok: null };

const BLOCK_FIELDS = ["enabled", "sortOrder", "title", "payload"] as const;

/**
 * Типы блоков.
 *
 * Список закрытый: `kind` попадает в путь выборки на сайте, и произвольное
 * значение означало бы «включить то, чего не существует». Новый тип добавляется
 * здесь и в CONTENT_KINDS в src/lib/admin/content.ts.
 */
const KINDS = new Set(["hero_slide", "banner", "notice"]);

function parseId(formData: FormData): string | null {
  const id = String(formData.get("id") ?? "").trim();
  return /^[a-z0-9]{20,30}$/i.test(id) ? id : null;
}

async function guard() {
  return requirePermission("content", "/admin/content");
}

/**
 * Проверяет, что payload — валидный JSON нужной формы.
 *
 * Именно проверка, а не «положить строку и hope for the best»: страница сайта
 * читает эти поля и рендерит напрямую. Ошибка здесь превратилась бы в
 * упавшую главную, а не в аккуратное сообщение в панели.
 *
 * Список полей берётся из CONTENT_KINDS, а не дублируется здесь: две копии
 * схемы разъезжаются, и через неделю панель принимала бы блок, который сайт
 * не умеет отрисовать.
 */
function validatePayload(kind: string, raw: string): string | null {
  if (!(kind in CONTENT_KINDS)) return `Неизвестный тип блока: ${kind}`;
  const typed = kind as ContentKind;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return "payload — невалидный JSON";
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return "payload должен быть объектом JSON";
  }

  const obj = parsed as Record<string, unknown>;
  const allowed = allowedFields(typed);

  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) return `В payload нет поля «${key}» для типа ${kind}`;
  }

  for (const key of requiredFields(typed)) {
    if (typeof obj[key] !== "string" || (obj[key] as string).trim() === "") {
      return `Поле «${key}» обязательно и должно быть непустой строкой`;
    }
  }

  for (const key of allowed) {
    if (obj[key] !== undefined && typeof obj[key] !== "string") {
      return `Поле «${key}» должно быть строкой`;
    }
  }

  // Ссылки идут в href/src: запрещаем javascript:, чтобы админ не мог по
  // неосторожности положить блок со скриптом в шапку сайта.
  for (const key of URL_FIELDS) {
    const value = obj[key];
    if (typeof value !== "string" || value === "") continue;
    const trimmed = value.trim();
    if (/^\s*javascript:/i.test(trimmed) || /^\s*data:/i.test(trimmed)) {
      return `Поле «${key}»: схема javascript:/data: запрещена`;
    }
  }

  return null;
}

export async function createBlockAction(
  _prev: ContentState,
  formData: FormData,
): Promise<ContentState> {
  const session = await guard();

  const kind = String(formData.get("kind") ?? "");
  if (!KINDS.has(kind)) return { ...IDLE, error: "Неизвестный тип блока" };

  const payload = String(formData.get("payload") ?? "");
  const payloadError = validatePayload(kind, payload);
  if (payloadError) return { ...IDLE, error: payloadError };

  const title = String(formData.get("title") ?? "").trim().slice(0, 200) || null;
  const now = Date.now();

  const created = await db.contentBlock.create({
    data: { kind, title, payload, enabled: false, sortOrder: 0, createdAt: now, updatedAt: now },
  });

  await audit({
    actorId: session.user.id,
    action: "content.create",
    targetType: "content",
    targetId: created.id,
    summary: `Создан блок «${title ?? kind}» (${kind})`,
    after: pick(created, BLOCK_FIELDS),
  });

  revalidatePath("/admin/content");
  return { ...IDLE, ok: "Блок создан. Пока выключен — включите его, когда будет готов." };
}

export async function updateBlockAction(
  _prev: ContentState,
  formData: FormData,
): Promise<ContentState> {
  const session = await guard();

  const id = parseId(formData);
  if (!id) return { ...IDLE, error: "Некорректный идентификатор" };

  const block = await db.contentBlock.findUnique({ where: { id } });
  if (!block) return { ...IDLE, error: "Блок не найден" };

  const payload = String(formData.get("payload") ?? "");
  const payloadError = validatePayload(block.kind, payload);
  if (payloadError) return { ...IDLE, error: payloadError };

  const title = String(formData.get("title") ?? "").trim().slice(0, 200) || null;

  const sortRaw = String(formData.get("sortOrder") ?? "0");
  const sortOrder = Number(sortRaw);
  if (!Number.isInteger(sortOrder)) {
    return { ...IDLE, error: "Порядок — целое число" };
  }

  const updated = await db.contentBlock.update({
    where: { id },
    data: { title, payload, sortOrder, updatedAt: Date.now() },
  });

  await audit({
    actorId: session.user.id,
    action: "content.update",
    targetType: "content",
    targetId: id,
    summary: `Изменён блок «${title ?? block.title ?? block.kind}»`,
    before: pick(block, BLOCK_FIELDS),
    after: pick(updated, BLOCK_FIELDS),
  });

  revalidatePath("/admin/content");
  return { ...IDLE, ok: "Сохранено" };
}

export async function toggleBlockAction(
  _prev: ContentState,
  formData: FormData,
): Promise<ContentState> {
  const session = await guard();

  const id = parseId(formData);
  if (!id) return { ...IDLE, error: "Некорректный идентификатор" };

  const block = await db.contentBlock.findUnique({ where: { id } });
  if (!block) return { ...IDLE, error: "Блок не найден" };

  const enabled = !block.enabled;

  const updated = await db.contentBlock.update({
    where: { id },
    data: { enabled, updatedAt: Date.now() },
  });

  await audit({
    actorId: session.user.id,
    action: "content.toggle",
    targetType: "content",
    targetId: id,
    summary: `Блок «${block.title ?? block.kind}»: ${block.enabled ? "выключен" : "включён"} → ${enabled ? "включён" : "выключен"}`,
    before: pick(block, BLOCK_FIELDS),
    after: pick(updated, BLOCK_FIELDS),
  });

  revalidatePath("/admin/content");
  return { ...IDLE, ok: enabled ? "Блок включён" : "Блок выключен" };
}

export async function deleteBlockAction(
  _prev: ContentState,
  formData: FormData,
): Promise<ContentState> {
  const session = await guard();

  const id = parseId(formData);
  if (!id) return { ...IDLE, error: "Некорректный идентификатор" };

  const block = await db.contentBlock.findUnique({ where: { id } });
  if (!block) return { ...IDLE, error: "Блок не найден" };

  await db.contentBlock.delete({ where: { id } });

  await audit({
    actorId: session.user.id,
    action: "content.delete",
    targetType: "content",
    targetId: id,
    summary: `Удалён блок «${block.title ?? block.kind}»`,
    // В before кладём payload: удалённое содержимое — единственное, по чему
    // его можно восстановить.
    before: pick(block, BLOCK_FIELDS),
  });

  revalidatePath("/admin/content");
  return { ...IDLE, ok: "Блок удалён" };
}