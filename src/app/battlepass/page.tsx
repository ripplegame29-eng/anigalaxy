import type { Metadata } from "next";
import { BattlePassView } from "@/components/BattlePassView";
import { BATTLEPASS } from "@/lib/battlepass/config";

export const metadata: Metadata = {
  title: "Боевой пропуск",
  description:
    "Боевой пропуск AniGalaxy: сезон «Hueco Mundo» на 100 уровней, бесплатная и Premium-линии наград, XP за активность на сайте, аникойны, теги, рамки и маски с обратным отсчётом до конца сезона.",
  keywords: ["боевой пропуск", "сезон", "награды", "XP", "AC", "Premium", "AniGalaxy"],
};

/* --------------------------------- FAQ --------------------------------- */

const FAQ = [
  {
    question: "Как получать уровни боевого пропуска?",
    answer:
      "Уровни даёт XP сезона — он копится из обычной активности на сайте: просмотра серий, комментариев, оценок, списков и ежедневных входов (1 XP сайта = 1 XP пропуска), а также из XP-наград самого пропуска. Первые уровни проходятся за десятки XP, к сотому стоимость вырастает почти до тысячи — всего 100 уровней за сезон.",
  },
  {
    question: "Что за награды и где их забирать?",
    answer: `На ${BATTLEPASS.levels.length} уровнях каждой линии лежат награды: аникойны (AC), XP сезона и реальные предметы проекта — теги, рамки и маски из магазина и гардероба. Наградные уровни светятся кнопкой «Забрать» — выдача проверяется движком (уровень, линия, Premium) и повторно не выдаётся.`,
  },
  {
    question: "Почему вместо предмета я получил AC?",
    answer:
      "Если тег, рамка или маска уже есть в вашем профиле, пропуск не выдаёт дубликат — вместо него начисляется компенсация AC по конфигу сезона.",
  },
  {
    question: "Premium-линия — это отдельная покупка?",
    answer:
      "Нет, это обычная подписка AniGalaxy Premium. Нажмите «Улучшить до Premium», активируйте подписку на странице Premium — и золотая линия разблокируется сразу; без подписки обе дорожки видны, но выдаётся только бесплатная.",
  },
  {
    question: "Что будет с наградами после конца сезона?",
    answer:
      "Забранные награды остаются в профиле навсегда, а незабранные не сгорают: после обратного отсчёта их можно дозабрать в любой момент.",
  },
  {
    question: "Где хранится мой прогресс?",
    answer:
      "В документе прогрессии этого браузера — той же записи, что баланс AC, собрание тегов и история наград: XP пропуска, отметки выдачи и уровень связаны атомарно. Серверной синхронизации у проекта нет, поэтому очистка данных сайта обнуляет сезон.",
  },
];

/* ------------------------------- Страница ------------------------------- */

export default function BattlePassPage() {
  return (
    <div className="relative overflow-hidden bp2-page">
      {/* Интерактивная часть: прогресс, дорожка на 100 уровней, выдача, Premium */}
      <BattlePassView />

      {/* -------------------------------- FAQ -------------------------------- */}
      <section className="relative mx-auto max-w-4xl px-4 pb-4 pt-14" aria-labelledby="bp-faq-title">
        <h2 id="bp-faq-title" className="text-center text-2xl font-extrabold tracking-tight sm:text-3xl">
          Частые вопросы
        </h2>

        <div className="mt-7 space-y-3">
          {FAQ.map((item) => (
            <details
              key={item.question}
              data-reveal
              className="group rounded-2xl border border-line bg-card/70 px-5 py-4 transition hover:border-accent/40 open:border-accent/40"
            >
              <summary className="cursor-pointer list-none text-sm font-extrabold text-white sm:text-base">
                <span className="flex items-center justify-between gap-4">
                  {item.question}
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4 shrink-0 text-accent transition-transform group-open:rotate-45"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    aria-hidden
                  >
                    <path strokeLinecap="round" d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ----------------------------- Сноски -------------------------------- */}
      <section className="relative mx-auto max-w-4xl px-4 pb-6 pt-8 text-center" data-reveal>
        <p className="text-sm leading-relaxed text-muted">
          Прогресс сезона хранится в документе прогрессии этого браузера: XP пропуска,
          отметки выдачи и баланс AC не разъезжаются. Premium-линия открывается обычной
          подпиской AniGalaxy.
        </p>
      </section>
    </div>
  );
}
