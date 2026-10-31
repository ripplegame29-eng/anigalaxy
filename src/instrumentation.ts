/**
 * Фоновые задачи процесса.
 *
 * Next вызывает `register` один раз при старте сервера. Платёжному модулю
 * нужен таймер для отложенных подарков: заказ подтверждён, а выдача ждёт
 * `deliver_at`, поэтому её нельзя сделать в момент колбэка.
 */

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startPaymentScheduler } = await import("./lib/server/payment-scheduler");
  startPaymentScheduler();
}
