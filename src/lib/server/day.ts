/** Ключ календарного дня по времени сервера: `2026-10-27` */
export function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Начало дня (мс), сдвинутого на `back` дней назад от `ms` */
export function dayStart(ms: number, back = 0): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - back).getTime();
}
