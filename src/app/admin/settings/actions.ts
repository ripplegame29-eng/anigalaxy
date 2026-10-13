"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/admin/audit";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/require-admin";

export interface SettingsState {
  error: string | null;
  ok: string | null;
}

const IDLE: SettingsState = { error: null, ok: null };

/**
 * Действия этого файла меняют то, что читается по всему сайту, поэтому
 * проверка прав тут не формальность: без неё любой вошедший мог бы переписать
 * настройки. Экшен вызывается напрямую из формы — кнопку можно и не рисовать.
 */
async function guard() {
  return requirePermission("settings", "/admin/settings");
}

/* ---------------------------- Feature flags ---------------------------- */

/**
 * Ключ флага: строка латиницей в нижнем регистре. Проверка отсекает мусор и
 * попытки подставить произвольную строку — ключ попадает в ключ записи в БД.
 */
const FLAG_RE = /^[a-z][a-zA-Z0-9]{1,40}$/;

export async function toggleFlagAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const session = await guard();

  const key = String(formData.get("key") ?? "");
  if (!FLAG_RE.test(key)) return { ...IDLE, error: "Некорректный ключ флага" };

  const flag = await db.featureFlag.findUnique({ where: { key } });
  if (!flag) return { ...IDLE, error: "Флаг не найден" };

  const enabled = flag.enabled !== true;

  await db.featureFlag.update({
    where: { key },
    data: { enabled, updatedAt: Date.now(), updatedById: session.user.id },
  });

  await audit({
    actorId: session.user.id,
    action: "flag.toggle",
    targetType: "flag",
    targetId: key,
    summary: `Флаг «${flag.description ?? key}»: ${flag.enabled ? "включён" : "выключен"} → ${enabled ? "включён" : "выключен"}`,
    before: { enabled: flag.enabled },
    after: { enabled },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  return {
    ...IDLE,
    ok: `${flag.description ?? key}: ${enabled ? "включено" : "выключено"}`,
  };
}

export async function setFlagDescriptionAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const session = await guard();

  const key = String(formData.get("key") ?? "");
  if (!FLAG_RE.test(key)) return { ...IDLE, error: "Некорректный ключ флага" };

  const description = String(formData.get("description") ?? "").trim().slice(0, 200);

  await db.featureFlag.update({
    where: { key },
    data: { description, updatedAt: Date.now(), updatedById: session.user.id },
  });

  await audit({
    actorId: session.user.id,
    action: "flag.describe",
    targetType: "flag",
    targetId: key,
    summary: `Описание флага «${key}» изменено`,
  });

  revalidatePath("/admin/settings");
  return { ...IDLE, ok: "Описание сохранено" };
}

/* ------------------------------- Настройки ----------------------------- */

/**
 * Ключ настройки: буквы, цифры и точки (`site.title`, `moderation.limit`).
 * Точки разделяют пространства имён и делают список читаемым.
 */
const SETTING_RE = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)*$/;

/** Значение — текст, но ограничиваем длину: сюда попадают лимиты и промпты. */
const MAX_VALUE_LEN = 5000;

export async function updateSettingAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const session = await guard();

  const key = String(formData.get("key") ?? "");
  if (!SETTING_RE.test(key)) return { ...IDLE, error: "Некорректный ключ настройки" };

  const value = String(formData.get("value") ?? "");
  if (value.length > MAX_VALUE_LEN) {
    return { ...IDLE, error: `Значение длиннее ${MAX_VALUE_LEN} символов` };
  }

  const existing = await db.setting.findUnique({ where: { key } });
  if (!existing) return { ...IDLE, error: "Настройка не найдена" };

  await db.setting.update({
    where: { key },
    data: { value, updatedAt: Date.now() },
  });

  await audit({
    actorId: session.user.id,
    action: "setting.update",
    targetType: "setting",
    targetId: key,
    // Значение пишется в журнал: по умолчанию это текст (приветствие, лимит),
    // и потерять его историю нельзя — изменится, и никто не вспомнит, что было.
    before: { value: existing.value },
    after: { value },
    summary: `Настройка ${key} изменена`,
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  return { ...IDLE, ok: `${key} сохранена` };
}

/* ------------------------------ Здоровье API --------------------------- */

/** Параметров нет: useActionState вызывает с (prev, formData), лишние
 *  аргументы игнорируются, а принимать их незачем. */
export async function runHealthCheckAction(): Promise<SettingsState> {
  const session = await guard();

  const { checkAllSources } = await import("@/lib/admin/health");
  const results = await checkAllSources();

  const okCount = results.filter((r) => r.ok).length;
  const failed = results.length - okCount;

  await audit({
    actorId: session.user.id,
    action: "health.check",
    targetType: "service",
    summary: `Проверка источников: ${okCount} из ${results.length} доступны`,
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin");

  return failed === 0
    ? { ...IDLE, ok: `Все источники доступны (${okCount})` }
    : { ...IDLE, error: `Не отвечают: ${results.filter((r) => !r.ok).map((r) => r.service).join(", ")}` };
}