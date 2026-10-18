"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/admin/audit";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/require-admin";

export interface ReleaseState {
  error: string | null;
  ok: string | null;
}

const IDLE: ReleaseState = { error: null, ok: null };

/** Время выхода: строго «ЧЧ:ММ». Иначе календарь молча не покажет серию. */
const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

const DAYS = [
  "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье",
];

/** Кириллица в описании не нужна, а вот id — всегда строка cuid. */
function parseId(formData: FormData): string | null {
  const id = String(formData.get("id") ?? "").trim();
  return /^[a-z0-9]{20,30}$/i.test(id) ? id : null;
}

async function guard() {
  return requirePermission("content", "/admin/content");
}

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

/** Поля, которые кладём в базу. Объявлены явно: без типа вывод расползался,
 *  и `data.genres` получал `string | undefined` вместо `string | null`. */
interface ReleaseInput {
  title: string;
  studio: string | null;
  day: number;
  time: string;
  episodes: number | null;
  rating: number | null;
  isNew: boolean;
  genres: string | null;
  poster: string | null;
  banner: string | null;
}

type Parsed = { reason: string } | { data: ReleaseInput };

/** Разбор общих полей формы. `{ reason }` означает «невалидно». */
function readFields(formData: FormData): Parsed {
  const title = field(formData, "title");
  const time = field(formData, "time");
  const dayRaw = Number(field(formData, "day"));

  if (!title) return { reason: "Название обязательно" };
  if (title.length > 160) return { reason: "Название длиннее 160 символов" };
  if (!TIME_RE.test(time)) return { reason: "Время в формате ЧЧ:ММ, например 20:30" };
  if (!Number.isInteger(dayRaw) || dayRaw < 0 || dayRaw > 6) {
    return { reason: "День недели от 0 (понедельник) до 6 (воскресенье)" };
  }

  const ratingRaw = field(formData, "rating");
  const rating = ratingRaw === "" ? null : Number(ratingRaw);
  if (rating !== null && (!Number.isFinite(rating) || rating < 0 || rating > 10)) {
    return { reason: "Оценка — число от 0 до 10" };
  }

  const episodesRaw = field(formData, "episodes");
  const episodes = episodesRaw === "" ? null : Number(episodesRaw);
  if (episodes !== null && (!Number.isInteger(episodes) || episodes < 1 || episodes > 99)) {
    return { reason: "Эпизодов в неделю — целое от 1 до 99" };
  }

  return {
    data: {
      title,
      studio: field(formData, "studio") || null,
      day: dayRaw,
      time,
      episodes,
      rating,
      isNew: formData.get("isNew") === "1",
      // Жанры приходят как «Экшен, Фэнтези» — приводим к «Экшен,Фэнтези»,
      // иначе в базе копится мусор из пробелов, а на странице — лишние чипы.
      genres: field(formData, "genres")
        .split(",")
        .map((g) => g.trim())
        .filter(Boolean)
        .join(",") || null,
      poster: field(formData, "poster") || null,
      banner: field(formData, "banner") || null,
    },
  };
}

/* -------------------------------- Создание ------------------------------ */

export async function createReleaseAction(
  _prev: ReleaseState,
  formData: FormData,
): Promise<ReleaseState> {
  const session = await guard();

  const parsed = readFields(formData);
  if ("reason" in parsed) return { ...IDLE, error: parsed.reason };

  const created = await db.release.create({
    data: { ...parsed.data, enabled: true, createdAt: Date.now(), updatedAt: Date.now() },
  });

  await audit({
    actorId: session.user.id,
    action: "release.create",
    targetType: "release",
    targetId: created.id,
    summary: `Добавлен релиз «${parsed.data.title}» — ${DAYS[parsed.data.day]}, ${parsed.data.time}`,
  });

  revalidatePath("/admin/content");
  revalidatePath("/releases");
  return { ...IDLE, ok: `«${parsed.data.title}» добавлен` };
}

/* -------------------------------- Правка -------------------------------- */

export async function updateReleaseAction(
  _prev: ReleaseState,
  formData: FormData,
): Promise<ReleaseState> {
  const session = await guard();

  const id = parseId(formData);
  if (!id) return { ...IDLE, error: "Некорректный идентификатор" };

  const parsed = readFields(formData);
  if ("reason" in parsed) return { ...IDLE, error: parsed.reason };

  const before = await db.release.findUnique({ where: { id } });
  if (!before) return { ...IDLE, error: "Релиз не найден" };

  await db.release.update({ where: { id }, data: { ...parsed.data, updatedAt: Date.now() } });

  await audit({
    actorId: session.user.id,
    action: "release.update",
    targetType: "release",
    targetId: id,
    summary: `Изменён релиз «${before.title}» → «${parsed.data.title}»`,
    before: { title: before.title, day: before.day, time: before.time },
    after: { title: parsed.data.title, day: parsed.data.day, time: parsed.data.time },
  });

  revalidatePath("/admin/content");
  revalidatePath("/releases");
  return { ...IDLE, ok: `«${parsed.data.title}» сохранён` };
}

/* ------------------------------- Вкл/выкл ------------------------------- */

export async function toggleReleaseAction(
  _prev: ReleaseState,
  formData: FormData,
): Promise<ReleaseState> {
  const session = await guard();

  const id = parseId(formData);
  if (!id) return { ...IDLE, error: "Некорректный идентификатор" };

  const row = await db.release.findUnique({ where: { id } });
  if (!row) return { ...IDLE, error: "Релиз не найден" };

  const enabled = !row.enabled;

  await db.release.update({ where: { id }, data: { enabled, updatedAt: Date.now() } });

  await audit({
    actorId: session.user.id,
    action: "release.toggle",
    targetType: "release",
    targetId: id,
    summary: `Релиз «${row.title}» ${enabled ? "вернулся в расписание" : "убран из расписания"}`,
    before: { enabled: row.enabled },
    after: { enabled },
  });

  revalidatePath("/admin/content");
  revalidatePath("/releases");
  return { ...IDLE, ok: `«${row.title}» ${enabled ? "включён" : "выключен"}` };
}

/* ------------------------------- Удаление ------------------------------- */

export async function deleteReleaseAction(
  _prev: ReleaseState,
  formData: FormData,
): Promise<ReleaseState> {
  const session = await guard();

  const id = parseId(formData);
  if (!id) return { ...IDLE, error: "Некорректный идентификатор" };

  const row = await db.release.findUnique({ where: { id } });
  if (!row) return { ...IDLE, error: "Релиз не найден" };

  await db.release.delete({ where: { id } });

  await audit({
    actorId: session.user.id,
    action: "release.delete",
    targetType: "release",
    targetId: id,
    summary: `Удалён релиз «${row.title}»`,
  });

  revalidatePath("/admin/content");
  revalidatePath("/releases");
  return { ...IDLE, ok: `«${row.title}» удалён` };
}