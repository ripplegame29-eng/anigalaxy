/**
 * Периодическая выдача отложенных заказов.
 *
 * Таймер один на процесс: `register` в dev-режиме может вызываться повторно
 * при перезапуске сервера, а два интервала выдали бы подарок дважды — впрочем,
 * `granted_at` всё равно атомарно защищает от повторной выдачи.
 */

import { dbAvailable, getDb } from "./db";
import { processDueGrants } from "./payment-orders";

const KEY = "__anigalaxy_payment_scheduler__";
const INTERVAL_MS = 60_000;
const FIRST_RUN_MS = 5_000;

interface SchedulerGlobal {
  [KEY]?: ReturnType<typeof setInterval>;
}

export function startPaymentScheduler(): void {
  const scope = globalThis as typeof globalThis & SchedulerGlobal;
  if (scope[KEY]) return;

  const tick = () => {
    if (!dbAvailable()) return;
    try {
      processDueGrants(getDb());
    } catch (error) {
      console.error("[payments] scheduler", error);
    }
  };

  const timer = setInterval(tick, INTERVAL_MS);
  timer.unref?.();
  const first = setTimeout(tick, FIRST_RUN_MS);
  first.unref?.();
  scope[KEY] = timer;
}
