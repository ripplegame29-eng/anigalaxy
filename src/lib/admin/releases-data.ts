/**
 * Стартовые записи календаря релизов.
 *
 * Перенесены из демо-данных страницы (SCHEDULE в разметке). Заливается
 * один раз: если запись уже есть, она не перетирается — чтобы правки
 * администратора не затирались повторным запуском seed.
 */

const DEMO_RELEASES = [
  { title: "Реинкарнация в мече II", studio: "Studio A", day: 0, time: "20:30", episodes: 3, rating: 7.56, isNew: true, genres: "Фэнтези,Экшен" },
  { title: "Ранма 1/2, сезон 2", studio: "MAPPA", day: 0, time: "23:00", episodes: 2, rating: 7.89, isNew: false, genres: "Комедия,Романтика" },
  { title: "Нил Листон", studio: "Studio B", day: 1, time: "18:00", episodes: 2, rating: 7.57, isNew: true, genres: "Фэнтези,Драма" },
  { title: "Алая маска", studio: "Bones", day: 1, time: "22:30", episodes: 1, rating: 7.09, isNew: true, genres: "Экшен,Мистика" },
  { title: "Ночной патруль", studio: "Wit", day: 2, time: "19:15", episodes: 1, rating: 5.88, isNew: true, genres: "Триллер,Детектив" },
  { title: "Токийские мстители: финал", studio: "LIDEN", day: 2, time: "21:00", episodes: 2, rating: 7.78, isNew: false, genres: "Экшен,Драма" },
  { title: "Клинок и звёзды", studio: "Ufotable", day: 3, time: "17:45", episodes: 5, rating: 8.21, isNew: false, genres: "Экшен,Фэнтези" },
  { title: "Академия теней", studio: "Madhouse", day: 3, time: "23:30", episodes: 4, rating: 7.34, isNew: false, genres: "Школа,Мистика" },
  { title: "Принцесса Галактики", studio: "Kyoto", day: 4, time: "20:00", episodes: 1, rating: 6.95, isNew: true, genres: "Sci-Fi,Романтика" },
  { title: "Охотники за сокровищами", studio: "Toei", day: 4, time: "22:00", episodes: 6, rating: 7.12, isNew: false, genres: "Приключения,Комедия" },
  { title: "Последний рубеж", studio: "Pierrot", day: 5, time: "16:30", episodes: 8, rating: 8.03, isNew: false, genres: "Экшен,Военное" },
  { title: "Кошки-самураи", studio: "Trigger", day: 5, time: "21:30", episodes: 3, rating: 6.71, isNew: false, genres: "Комедия,Самураи" },
  { title: "Сад лунных цветов", studio: "CloverWorks", day: 6, time: "15:00", episodes: 2, rating: 7.44, isNew: false, genres: "Романтика,Драма" },
  { title: "Пустые небеса", studio: "A-1", day: 6, time: "19:30", episodes: 1, rating: 6.52, isNew: true, genres: "Sci-Fi,Триллер" },
  { title: "Хроники Звёздного моря", studio: "Shaft", day: 6, time: "23:15", episodes: 7, rating: 7.9, isNew: false, genres: "Фэнтези,Приключения" },
];

/**
 * Данные для /releases без панели: то же расписание, но отдаётся серверным
 * компонентом. Экспортируется отдельно от seed, чтобы страница не тащила
 * весь prisma/seed.ts.
 */
export { DEMO_RELEASES };

/**
 * Минимальный контракт клиента Prisma, который тут нужен.
 *
 * Тип не пишется целиком: seed вызывается из prisma/seed.ts, который не
 * входит в сборку приложения и в typescript-проект. Полный PrismaClient
 * в этом файле потребовал бы его подключения ради одной функции.
 */
interface ReleaseWriter {
  release: {
    findFirst(args: {
      where: { title: string };
      select: { id: true };
    }): Promise<{ id: string } | null>;
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
}

export async function seedReleases(db: ReleaseWriter) {
  let added = 0;

  for (const [index, item] of DEMO_RELEASES.entries()) {
    // Ищем по названию, а не по sortOrder: иначе повторный seed затрёт
    // правки, которые сделал администратор через панель.
    const existing = await db.release.findFirst({
      where: { title: item.title },
      select: { id: true },
    });

    if (existing) continue;

    await db.release.create({
      data: {
        ...item,
        sortOrder: index,
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    });

    added += 1;
  }

  return added;
}