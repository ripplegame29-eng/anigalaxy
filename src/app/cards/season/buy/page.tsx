import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SeasonBuy, SeasonLoginNote } from "@/components/cards/SeasonBuy";
import { PASS, seasonEnd, seasonNo, seasonOf } from "@/lib/cards/season";
import "../../../cards-campaign.css";

export const metadata: Metadata = {
  title: "Сезонный пропуск — оформление",
  description:
    "Оформление премиум-ветки сезонного пропуска карточек AniGalaxy: вторая лента наград, карта сезона, алмазы, паки и свитки на 30 уровнях.",
  keywords: ["сезонный пропуск", "battle pass", "аниме карточки", "AniGalaxy"],
};

const FAQ = [
  {
    question: "Что даёт премиум пропуска?",
    answer:
      "Вторую ленту наград сезона: на каждом премиум-уровне — алмазы, паки, свитки улучшения и пыль, а на финальном 30-м уровне — легендарная карта сезона S-ранга.",
  },
  {
    question: "Что будет, если я открою премиум на 15-м уровне?",
    answer:
      "Все премиум-награды за уже пройденные уровни выдадутся сразу, дальше — по мере прокачки на дорожке сезона.",
  },
  {
    question: "Премиум оплачивается помесячно?",
    answer:
      "Нет. Платёж разовый за весь сезон: премиум-лента открывается целиком на все 30 уровней и не списывает платёж каждые несколько дней.",
  },
  {
    question: "Сгорают ли награды после конца сезона?",
    answer:
      "Незабранное доступно до конца сезона — забрать можно в любой момент, а всё полученное остаётся в коллекции навсегда.",
  },
];

/**
 * Номер сезона, дней до конца и дата финала. Считаем вне компонента, как на
 * странице боевого пропуска: гарантированно одинаковый текст при гидратации
 * и совпадает с расчётом серверного состояния пасса (`seasonOf`/`seasonEnd`).
 */
const season = seasonOf(Date.now());
const seasonNum = seasonNo(season);
const daysLeft = Math.max(0, Math.ceil((seasonEnd(season) - Date.now()) / 86_400_000));
const endLabel = new Date(seasonEnd(season)).toLocaleDateString("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default function SeasonPassBuyPage() {
  return (
    <div className="svb-root relative overflow-hidden">
      {/* ------------------------------- Герой ------------------------------- */}
      <section className="svb-hero relative px-4 pb-6 pt-8 sm:pt-10">
        <div className="svb-bg" aria-hidden />
        <div className="svb-fog" aria-hidden />
        <div className="svb-rays" aria-hidden />
        <span className="svb-ash" aria-hidden>
          {Array.from({ length: 24 }, (_, i) => (
            <b
              key={i}
              style={
                {
                  "--x": (i * 29 + 7) % 100,
                  "--s": `${2 + (i % 3)}px`,
                  "--d": `${9 + (i % 7) * 2}s`,
                  "--w": `${-(i * 1.9)}s`,
                } as React.CSSProperties
              }
            />
          ))}
        </span>
        <div className="relative mx-auto max-w-3xl">
          <Breadcrumbs items={[{ label: "Карточки", href: "/cards" }, { label: "Оформление" }]} />
        </div>
        <div className="relative mx-auto max-w-3xl text-center">
          <span className="svb-pill">Сезонный пропуск · Сезон {seasonNum}</span>

          <h1 className="svb-h1">
            Полный <span>трек сезона</span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-white/70 sm:text-lg">
            Разовый платёж за сезон: вторая лента наград — алмазы, паки, свитки и
            эксклюзивная карта на {PASS.levels} уровнях. Сезон до {endLabel}.
          </p>

          <SeasonLoginNote />
        </div>
      </section>

      {/* ------------------------------ Тариф -------------------------------- */}
      <section className="relative mx-auto max-w-6xl px-4 pb-12 pt-10 sm:pt-14" aria-label="Тариф">
        <SeasonBuy daysLeft={daysLeft} seasonNum={seasonNum} endLabel={endLabel} />
      </section>

      {/* -------------------------------- FAQ -------------------------------- */}
      <section className="relative mx-auto max-w-4xl px-4 pb-4">
        <h2 className="text-center text-2xl font-extrabold tracking-tight sm:text-3xl">
          Частые вопросы
        </h2>

        <div className="mt-7 space-y-3">
          {FAQ.map((item) => (
            <details
              key={item.question}
              className="svb-faq group rounded-2xl px-5 py-4"
            >
              <summary className="cursor-pointer list-none text-sm font-extrabold text-white sm:text-base">
                <span className="flex items-center justify-between gap-4">
                  {item.question}
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4 shrink-0 text-gold transition-transform group-open:rotate-45"
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
      <section className="relative mx-auto max-w-4xl px-4 pt-8 text-center">
        <p className="text-sm leading-relaxed text-muted">
          Премиум не продлевается автоматически: платёж разовый и действует до
          конца сезона ({endLabel}). Забрать награды можно на дорожке{" "}
          <Link href="/cards" className="font-bold text-gold hover:text-white">
            сезона карточек
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
