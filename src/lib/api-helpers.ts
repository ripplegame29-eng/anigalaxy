import { NextResponse } from "next/server";
import { KodikError } from "./kodik";

/**
 * Единая обработка ошибок Kodik для всех Route Handlers:
 * ошибки API отдаём клиенту с тем же кодом, остальное — 502.
 */
export function handleKodikError(error: unknown): NextResponse {
  if (error instanceof KodikError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("[kodik] unexpected error:", error);
  return NextResponse.json({ error: "Не удалось получить данные" }, { status: 502 });
}
