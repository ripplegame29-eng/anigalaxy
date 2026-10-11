"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/admin/audit";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/require-admin";

export interface PromoState {
  error: string | null;
  ok: string | null;
}

const IDLE: PromoState = { error: null, ok: null };

/**
 * Типы промокодов.
 *
 * `premium_days` и `balance_ac` совпадают с уже работающими в проекте
 * (см. lib/premium-perks.ts). Новый тип рано или поздно перестанет
 * помещаться в эту строку — тогда понадобится отдельная таблица выдач,
 * но пока разумнее держать вид простонародный.
 */
const KINDS = ["premium_days", "balance_ac"] as const;
export const PROMO_KINDS = KINDS;

/** Код: латиница, цифры и дефис. Так его можно продиктовать по телефону. */
const CODE_RE = /^[A-Z0-9][A-Z0-9-]{2,23}$/;

const MAX_DAYS = 3650;
const MAX_AC = 1_000_000_000;

function parseId(formData: FormData): string | null {
  const id = String(formData.get("id") ?? "").trim();
  return /^[a-z0-9]{20,30}$/i.test(id) ? id : null;
}

async function guard() {
  return requirePermission("economy", "/admin/economy");
}

/* ------------------------------- Создание ------------------------------- */

export async function createPromoAction(
  _prev: PromoState,
  formData: FormData,
): Promise<PromoState> {
  const session = await guard();

  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase();

  if (!CODE_RE.test(code)) {
    return {
      ...IDLE,
      error: "Код: 3–24 символа, латиница, цифры и дефис",
    };
  }

  const kind = String(formData.get("kind") ?? "");
  if (!(KINDS as readonly string[]).includes(kind)) {
    return { ...IDLE, error: "Неизвестный тип промокода" };
  }

  const value = Number(String(formData.get("value") ?? ""));
  const ceiling = kind === "premium_days" ? MAX_DAYS : MAX_AC;
  if (!Number.isInteger(value) || value <= 0 || value > ceiling) {
    return {
      ...IDLE,
      error:
        kind === "premium_days"
          ? `Дней: от 1 до ${MAX_DAYS}`
          : `AC: от 1 до ${MAX_AC.toLocaleString("ru-RU")}`,
    };
  }

  const maxUsesRaw = String(formData.get("maxUses") ?? "").trim();
  const maxUses = maxUsesRaw === "" ? null : Number(maxUsesRaw);
  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses <= 0)) {
    return { ...IDLE, error: "Лимит активаций: целое число больше нуля или пусто" };
  }

  const existing = await db.promoCode.findUnique({ where: { code } });
  if (existing) return { ...IDLE, error: `Код ${code} уже существует` };

  const created = await db.promoCode.create({
    data: {
      code,
      kind,
      value,
      maxUses,
      perUserLimit: 1,
      description: String(formData.get("description") ?? "").trim().slice(0, 300) || null,
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  });

  await audit({
    actorId: session.user.id,
    action: "promo.create",
    targetType: "promo",
    targetId: created.id,
    summary: `Создан промокод ${code} (${kind}, ${value})`,
  });

  revalidatePath("/admin/economy");
  return { ...IDLE, ok: `Промокод ${code} создан` };
}

/* ------------------------------ Переключение ---------------------------- */

export async function togglePromoAction(
  _prev: PromoState,
  formData: FormData,
): Promise<PromoState> {
  const session = await guard();

  const id = parseId(formData);
  if (!id) return { ...IDLE, error: "Некорректный идентификатор" };

  const promo = await db.promoCode.findUnique({ where: { id } });
  if (!promo) return { ...IDLE, error: "Промокод не найден" };

  const active = !promo.active;

  await db.promoCode.update({
    where: { id },
    data: { active, updatedAt: Date.now() },
  });

  await audit({
    actorId: session.user.id,
    action: "promo.toggle",
    targetType: "promo",
    targetId: id,
    summary: `Промокод ${promo.code}: ${active ? "включён" : "выключен"}`,
    before: { active: promo.active },
    after: { active },
  });

  revalidatePath("/admin/economy");
  return { ...IDLE, ok: `${promo.code}: ${active ? "включён" : "выключен"}` };
}

export async function deletePromoAction(
  _prev: PromoState,
  formData: FormData,
): Promise<PromoState> {
  const session = await guard();

  const id = parseId(formData);
  if (!id) return { ...IDLE, error: "Некорректный идентификатор" };

  const promo = await db.promoCode.findUnique({
    where: { id },
    include: { _count: { select: { redemptions: true } } },
  });
  if (!promo) return { ...IDLE, error: "Промокод не найден" };

  if (promo._count.redemptions > 0) {
    // Удалять нельзя: останутся записи об активациях без промокода, и
    // статистика использования станет недостоверной. Можно выключить.
    return {
      ...IDLE,
      error: `Промокод уже активировали ${promo._count.redemptions} раз — удалить нельзя, только выключить`,
    };
  }

  await db.promoCode.delete({ where: { id } });

  await audit({
    actorId: session.user.id,
    action: "promo.delete",
    targetType: "promo",
    targetId: id,
    summary: `Удалён промокод ${promo.code}`,
  });

  revalidatePath("/admin/economy");
  return { ...IDLE, ok: `Промокод ${promo.code} удалён` };
}

/* -------------------------------- Сезоны ------------------------------- */

export async function createSeasonAction(
  _prev: PromoState,
  formData: FormData,
): Promise<PromoState> {
  const session = await guard();

  const slug = String(formData.get("slug") ?? "")
    .trim()
    .toLowerCase();
  // Идентификатор сезона подставляется в ключ прогрессии, поэтому формат
  // жёсткий: буква, дальше буквы/цифры/дефис.
  if (!/^[a-z][a-z0-9-]{0,15}$/.test(slug)) {
    return { ...IDLE, error: "Идентификатор: латиница в нижнем регистре, до 16 символов" };
  }

  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  if (!name) return { ...IDLE, error: "Название сезона обязательно" };

  const startsAt = Date.parse(String(formData.get("startsAt") ?? ""));
  const endsAt = Date.parse(String(formData.get("endsAt") ?? ""));
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt)) {
    return { ...IDLE, error: "Нужны корректные даты начала и окончания" };
  }
  if (endsAt <= startsAt) {
    return { ...IDLE, error: "Окончание должно быть позже начала" };
  }

  if (await db.season.findUnique({ where: { slug } })) {
    return { ...IDLE, error: `Сезон ${slug} уже существует` };
  }

  // Статус выводится из дат, но хранится явно — чтобы сезон можно было
  // остановить досрочно, не сдвигая границы.
  const now = Date.now();
  const status = now < startsAt ? "scheduled" : now < endsAt ? "active" : "finished";

  const created = await db.season.create({
    data: {
      slug,
      name,
      startsAt: BigInt(startsAt),
      endsAt: BigInt(endsAt),
      status,
      resetOnClose: false,
      createdAt: now,
      updatedAt: now,
    },
  });

  await audit({
    actorId: session.user.id,
    action: "season.create",
    targetType: "season",
    targetId: created.id,
    summary: `Создан сезон «${name}» (${slug})`,
  });

  revalidatePath("/admin/economy");
  return { ...IDLE, ok: `Сезон «${name}» создан (${status})` };
}

export async function setSeasonStatusAction(
  _prev: PromoState,
  formData: FormData,
): Promise<PromoState> {
  const session = await guard();

  const id = parseId(formData);
  if (!id) return { ...IDLE, error: "Некорректный идентификатор" };

  const status = String(formData.get("status") ?? "");
  if (!["scheduled", "active", "finished"].includes(status)) {
    return { ...IDLE, error: "Неизвестный статус" };
  }

  const season = await db.season.findUnique({ where: { id } });
  if (!season) return { ...IDLE, error: "Сезон не найден" };

  await db.season.update({
    where: { id },
    data: { status, updatedAt: Date.now() },
  });

  await audit({
    actorId: session.user.id,
    action: "season.status",
    targetType: "season",
    targetId: id,
    summary: `Сезон «${season.name}»: ${season.status} → ${status}`,
    before: { status: season.status },
    after: { status },
  });

  revalidatePath("/admin/economy");
  return { ...IDLE, ok: `«${season.name}»: ${status}` };
}