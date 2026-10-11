import { NextResponse } from "next/server";

import { audit } from "@/lib/admin/audit";
import { getSession } from "@/lib/auth-server";
import { db } from "@/lib/db";
import { logError } from "@/lib/logger";
import { PROMO_DAYS } from "@/lib/premium-perks";

export const runtime = "nodejs";

/**
 * POST /api/promo — активация промокода.
 *
 * Зачем этот эндпоинт. Коды, созданные в панели, до его появления не
 * работали: проверка шла по словарю `PROMO_DAYS` в браузере, и код из базы
 * просто не находился — то есть админ выпустил промокод, а игроки его не могли
 * ввести. Теперь проверка и выдача идут на сервере, где видна и база, и
 * счётчик активаций.
 *
 * Старый словарь сохранён как запасной путь: коды START / ANIGALAXY /
 * PREMIUM25 / OTAGENS разлетели по объявлениям, и ломать их переносом в базу
 * без нужды — значит отнять у игрока то, что уже работает. Для них сервер
 * только продлевает подписку, а учёт ведётся по-прежнему в localStorage.
 */

const DAY_MS = 86_400_000;

function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { ok: false, message, ...extra },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}

/** Русское склонение: 1 день, 2 дня, 5 дней. */
function daysWord(days: number): string {
  const mod10 = days % 10;
  const mod100 = days % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "дня";
  return "дней";
}

/**
 * Продление подписки.
 *
 * Считаем от сегодняшнего дня, а не от конца текущей подписки, если она ещё
 * жива: иначе «+30 дней» к активной годовой подписке тихо съедал бы месяц.
 */
function extendPremium(currentUntil: number, days: number): number {
  const now = Date.now();
  const base = currentUntil > now ? currentUntil : now;
  return base + days * DAY_MS;
}

/**
 * Добавление AC в документ прогресса.
 *
 * Зеркало, а не источник истины: клиент всё равно пришлёт свой документ, и
 * правка в нём продержится до следующей записи. Помечаем touchedByAdmin,
 * чтобы в панели эта строка отличалась от обычных.
 */
async function grantBalance(userId: string, amount: number): Promise<boolean> {
  const row = await db.playerProgress.findUnique({ where: { userId } });

  // Документа нет — создавать нечего: у нового игрока он появится с первым
  // сохранением прогресса. Считаем, что выдать удалось, иначе промокод сгорит
  // зря из-за того, что человек ещё не начал играть.
  if (!row) return true;

  let doc: Record<string, unknown>;
  try {
    doc = JSON.parse(row.doc) as Record<string, unknown>;
  } catch {
    return false;
  }

  const progress = { ...((doc.progress ?? {}) as Record<string, unknown>) };
  const current = Number(progress.acBalance ?? 0);

  if (!Number.isFinite(current)) return false;

  progress.acBalance = current + amount;
  doc.progress = progress;
  doc.touchedByAdmin = true;

  await db.playerProgress.update({
    where: { userId },
    data: {
      doc: JSON.stringify(doc),
      touchedByAdmin: true,
      updatedAt: Date.now(),
      revision: { increment: 1 },
    },
  });

  return true;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return fail("Войдите в аккаунт, чтобы активировать промокод", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Некорректный запрос");
  }

  const code = String((body as { code?: unknown })?.code ?? "")
    .trim()
    .toUpperCase();

  if (!code) return fail("Введите промокод");
  if (!/^[A-Z0-9][A-Z0-9-]{2,23}$/.test(code)) {
    return fail("Код: 3–24 символа, латиница, цифры и дефис");
  }

  const userId = session.user.id;
  const now = Date.now();

  /* ------------------------- Код из базы панели ------------------------- */

  const promo = await db.promoCode.findUnique({ where: { code } });

  if (promo) {
    if (!promo.active) {
      return fail("Промокод больше не действует");
    }

    if (promo.startsAt !== null && Number(promo.startsAt) > now) {
      return fail(
        `Промокод начнёт действовать ${new Date(Number(promo.startsAt)).toLocaleDateString("ru-RU")}`,
      );
    }

    if (promo.endsAt !== null && Number(promo.endsAt) < now) {
      return fail("Срок действия промокода истёк");
    }

    if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
      return fail("Промокод исчерпан");
    }

    const usedByMe = await db.promoRedemption.count({
      where: { promoId: promo.id, userId },
    });

    if (usedByMe >= promo.perUserLimit) {
      return fail(
        `Вы уже активировали этот промокод. Лимит — ${promo.perUserLimit} ${
          promo.perUserLimit === 1 ? "активация" : "активации"
        } на аккаунт.`,
      );
    }

    if (promo.kind === "premium_days") {
      const next = extendPremium(session.user.premiumUntil ?? 0, promo.value);
      await db.user.update({ where: { id: userId }, data: { premiumUntil: next } });
    } else {
      const granted = await grantBalance(userId, promo.value);
      if (!granted) return fail("Не удалось начислить атомы — прогресс повреждён", 500);
    }

    // Счётчик и запись активации — в одной транзакции. Иначе при падении между
    // ними игрок получил бы подписку, а код остался бы с тем же числом
    // активаций, и лимит можно было бы обойти, повторив попытку.
    await db.$transaction([
      db.promoRedemption.create({
        data: { promoId: promo.id, userId, redeemedAt: now },
      }),
      db.promoCode.update({
        where: { id: promo.id },
        data: { usedCount: { increment: 1 }, updatedAt: now },
      }),
    ]);

    await audit({
      actorId: userId,
      action: "promo.redeem",
      targetType: "promo",
      targetId: promo.id,
      summary: `${session.user.nickname} активировал ${code}: ${promo.kind === "premium_days" ? `${promo.value} дн. Premium` : `${promo.value} AC`}`,
      after: { kind: promo.kind, value: promo.value },
    });

    const gained =
      promo.kind === "premium_days"
        ? `подписка продлена на ${promo.value} ${daysWord(promo.value)}`
        : `начислено ${promo.value.toLocaleString("ru-RU")} AC`;

    // days обязателен: клиент ведёт подписку ещё и в localStorage, и без
    // числа не сможет привести локальное состояние в соответствие с сервером.
    // Расхождение выглядело бы так: на странице подписка есть, а после
    // перезагрузки пропала.
    return NextResponse.json(
      {
        ok: true,
        message: `Промокод активирован: ${gained}`,
        kind: promo.kind,
        days: promo.kind === "premium_days" ? promo.value : 0,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  /* --------------------- Старый словарь из кода сайта ------------------- */

  const legacyDays = PROMO_DAYS[code];

  if (!legacyDays) {
    // Код не найден ни в базе, ни в словаре. Это нормальный сценарий, а не
    // ошибка сервера — поэтому 200 с ok:false, а не 404: клиенту не нужно
    // различать «нет такого кода» и «сервер упал».
    return NextResponse.json(
      { ok: false, message: "Промокод не найден — проверьте написание и раскладку клавиатуры" },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const next = extendPremium(session.user.premiumUntil ?? 0, legacyDays);
  await db.user.update({ where: { id: userId }, data: { premiumUntil: next } });

  await audit({
    actorId: userId,
    action: "promo.redeem",
    targetType: "promo",
    targetId: null,
    summary: `${session.user.nickname} активировал старый код ${code}: ${legacyDays} дн. Premium`,
  });

  try {
    await logError({
      level: "info",
      source: "admin",
      operation: "promo.legacy",
      message: `Промокод ${code} активирован через старый словарь, а не через панель`,
      context: { code, userId, days: legacyDays },
    });
  } catch {
    // Журнал не должен ломать выдачу: код уже применён.
  }

  return NextResponse.json(
    {
      ok: true,
      message: `Промокод активирован: подписка продлена на ${legacyDays} ${daysWord(legacyDays)}`,
      kind: "premium_days",
      days: legacyDays,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}