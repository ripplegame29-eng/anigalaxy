import type { Metadata } from "next";

import { requireFeature } from "@/lib/features";
import { listReleases, releaseStats } from "@/lib/releases";

import { ReleasesView } from "./releases-view";
import "./releases.css";

/**
 * Календарь релизов.
 *
 * Страница динамическая: расписание лежит в базе и правится из панели, а
 * ближайший релиз и обратный отсчёт считаются от «сейчас» — кешировать
 * такое нельзя, иначе через минуту страница показывала бы прошедшую премьеру.
 */

export const metadata: Metadata = {
  title: "Календарь релизов",
  description:
    "Расписание выхода серий по дням недели: время премьер, студии, жанры и обратный отсчёт до ближайшего релиза.",
};

export const dynamic = "force-dynamic";

export default async function ReleasesPage() {
  // Тумблер «Релизы» в панели «Настройки»: страницу можно снять целиком,
  // не выкатывая код.
  await requireFeature("releases");

  const items = await listReleases();
  const stats = releaseStats(items);

  return (
    /*
     * Обёртка шириной во весь экран нужна для двух вещей.
     *
     * Первая — область видимости стилей: .card, .btn, .grid и ещё двадцать
     * классов календаря совпадают с классами сайта, и без .rl всё это
     * перекрашивало бы остальные страницы.
     *
     * Вторая — фон. В макете он стоял на body, а здесь тело сайта общее:
     * красивые радиальные пятна должны лежать под содержимым страницы, но
     * не съедать фон всего сайта. На .wrap (1280px) градиент обрезался бы
     * колонкой, поэтому полотно вынесено в отдельный слой на всю ширину.
     */
    <div className="rl">
      <main className="wrap">
        <ReleasesView items={items} />

        <p className="note">
          Всего в расписании: {stats.total}. Премьер и новых сезонов: {stats.premieres}.
          {stats.avg > 0 ? ` Средняя оценка: ${stats.avg}.` : ""}
        </p>
      </main>
    </div>
  );
}