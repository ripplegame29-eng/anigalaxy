import { NextResponse } from "next/server";
import { catalog } from "@/lib/kodik";
import { handleKodikError } from "@/lib/api-helpers";

export const runtime = "nodejs";

/**
 * GET /api/kodik/top — короткий список лучших по рейтингу.
 *
 * Плитка «Аниме дня» в мега-меню каталога. Изначально там был случайный
 * тайл, но случайный из всей базы — это заведомо средний результат: в выдаче
 * много свежих и непроверенных релизов с рейтингом около нуля (на скриншоте
 * так и вышло — «★ 0.0»). Поэтому берём сортировку по рейтингу и отдаём сразу
 * несколько позиций: кнопка «Ещё» листает по этому списку, не ходя на сервер.
 *
 * Порция небольшая намеренно: каждый запрос — поход во внешний API, а держать
 * сотню карточек ради одной плитки расточительно.
 */
export async function GET() {
  try {
    const data = await catalog({ sort: "rating" });
    const cards = data.cards
      .filter((card) => (card.rating ?? 0) > 0)
      .slice(0, 12);

    if (!cards.length) {
      return NextResponse.json({ error: "Каталог не ответил" }, { status: 503 });
    }

    return NextResponse.json({ cards });
  } catch (error) {
    return handleKodikError(error);
  }
}
