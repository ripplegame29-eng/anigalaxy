/**
 * Хук старта сервера Next.js.
 *
 * Зачем прогрев: после перезапуска кэш в памяти пуст, и первый же
 * посетитель платит за все внешние запросы сразу. Главная дёргает шесть
 * рядов, и на замере холодного старта она отдавалась через 24 секунды —
 * по два круга двенадцатисекундного таймаута Kodik.
 *
 * Прогрев переносит эту работу на момент запуска сервера, когда рядом ещё
 * никого нет. К моменту, когда придёт первый человек, данные уже в кэше,
 * а страница отдаётся за десятки миллисекунд.
 *
 * Ошибки молча игнорируются: если Kodik лежит, сайт должен стартовать и
 * показать пустые ряды, а не упасть.
 */

export async function register(): Promise<void> {
  // Инструментация запускается и в среде браузера — там ни сети, ни базы.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Динамический импорт: kodik и mangadex читают окружение при загрузке,
  // и тянуть их в бандл edge-рантайма незачем.
  const loaded = await Promise.all([
    import("@/lib/kodik").catch(() => null),
    import("@/lib/mangadex").catch(() => null),
  ]);

  const row = loaded[0]?.row;
  const mangaRow = loaded[1]?.mangaRow;

  if (!row || !mangaRow) return;

  // Ряды главной. Список повторяет src/app/page.tsx: расхождение не ломает
  // работу, но прогрев перестанет совпадать с тем, что видит посетитель.
  const rows: { label: string; params: Record<string, string | number> }[] = [
    {
      label: "Онгоинги",
      params: {
        types: "anime,anime-serial",
        anime_status: "ongoing",
        sort: "updated_at",
        order: "desc",
        limit: 20,
      },
    },
    {
      label: "Новинки сезона",
      params: {
        types: "anime,anime-serial",
        sort: "created_at",
        order: "desc",
        year: "2025,2026",
        limit: 20,
      },
    },
    {
      label: "Топ рейтинга",
      params: {
        types: "anime,anime-serial",
        sort: "shikimori_rating",
        order: "desc",
        limit: 20,
      },
    },
    {
      label: "Аниме-фильмы",
      params: {
        types: "anime",
        sort: "kinopoisk_rating",
        order: "desc",
        limit: 20,
      },
    },
  ];

  // Не await: register() обязан вернуться быстро, иначе сервер не поднимется.
  void Promise.allSettled([
    ...rows.map((r) => row(r.label, r.params)),
    mangaRow("hot", 30),
    mangaRow("best", 30),
  ]).then((results) => {
    const ok = results.filter((r) => r.status === "fulfilled").length;
    console.log(
      `[прогрев] готово: ${ok} из ${results.length} источников` +
        (results.some((r) => r.status === "rejected")
          ? " (часть не пришла — сайт всё равно поднялся)"
          : ""),
    );
  });
}