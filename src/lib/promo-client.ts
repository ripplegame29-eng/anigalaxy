/**
 * Активация промокода на клиенте.
 *
 * Порядок важен: сначала сервер, и только если он недоступен — локальный
 * словарь. Обратный порядок сломал бы главное: код, созданный в панели,
 * сервер знает, а браузерный словарь — нет, и клиент ответил бы «не найден»,
 * не дав серверу ни шанса.
 *
 * Запасной путь нужен для гостя без серверной сессии: у него нет аккаунта в
 * базе, писать нечего, и промокод должен по-прежнему работать как раньше.
 */

import { activatePremium } from "@/lib/auth";
import { applyPromo, type PromoResult } from "@/lib/premium-perks";

interface PromoResponse {
  ok: boolean;
  message: string;
  kind?: string;
  days?: number;
}

export async function redeemPromo(code: string): Promise<PromoResult> {
  const trimmed = code.trim();
  if (!trimmed) {
    return { ok: false, message: "Введите промокод", days: 0 };
  }

  let response: Response;

  try {
    response = await fetch("/api/promo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: trimmed }),
    });
  } catch {
    // Сеть отвалилась: лучше отдать локальный путь, чем показать ошибку
    // соединения — промокод из публичного объявления при этом сработает.
    return localFallback(trimmed);
  }

  // 401 — серверной сессии нет. Это не «код неверен», это другой режим
  // работы: гость. Настоящую ошибку активации показываем только если сессия
  // есть и сервер сказал «нет».
  if (response.status === 401) {
    return localFallback(trimmed);
  }

  let data: PromoResponse;

  try {
    data = (await response.json()) as PromoResponse;
  } catch {
    return {
      ok: false,
      message: "Сервер не ответил корректно. Попробуйте ещё раз.",
      days: 0,
    };
  }

  if (!data.ok) {
    return { ok: false, message: data.message, days: 0 };
  }

  // Подписку сервер продлил у себя. Прогресс клиента живёт в localStorage, и
  // без зеркала после перезагрузки подписка выглядела бы пропавшей.
  if (data.kind === "premium_days" && data.days && data.days > 0) {
    activatePremium(data.days);
  }

  return { ok: true, message: data.message, days: data.days ?? 0 };
}

/** Прежнее поведение: словарь PROMO_DAYS и учёт применений в localStorage. */
function localFallback(code: string): PromoResult {
  return applyPromo(code, (days) => {
    const next = activatePremium(days);
    return next ? next.premiumUntil ?? 0 : null;
  });
}