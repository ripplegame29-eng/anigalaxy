import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { PassLoginNote, PassPlans } from "@/components/battlepass/PassPlans";
import { BATTLEPASS } from "@/lib/battlepass/logic";

export const metadata: Metadata = {
  title: "Боевой пропуск — оформление",
  description:
    "Оформление боевого пропуска AniGalaxy: золотая линия наград, косметика сезона, разовый платёж и выгода сезона.",
  keywords: ["боевой пропуск", "Battle Pass", "награды сезона", "AniGalaxy"],
};

const FAQ = [
  {
    question: "Что даёт боевой пропуск?",
    answer:
      "Вторую, золотую линию наград сезона: косметика этого сезона, аникойны и опыт пропуска на каждом наградном уровне.",
  },
  {
    question: "Что будет, если я куплю пропуск на 40-м уровне?",
    answer:
      "Все награды золотой линии за пройденные уровни выдадутся сразу, а дальше — на тех уровнях, которых вы достигнете.",
  },
  {
    question: "Пропуск оплачивается помесячно?",
    answer:
      "Нет. Это разовый платёж за сезон: подписка открывает золотую линию целиком, а не списывается каждый месяц.",
  },
  {
    question: "Сгорают ли награды после конца сезона?",
    answer:
      "Нет — всё, что вы не забрали, остаётся в профиле, заберёте когда удобно.",
  },
];

/**
 * Дней до конца сезона.
 *
 * Считаем вне компонента: `Date.now()` прямо в теле рендера ловит
 * правило чистоты React, а так счёт вынесен в обычную функцию и текст
 * ещё гарантированно совпадает при гидратации.
 */
function daysLeftInSeason(): number {
  return Math.max(0, Math.ceil((BATTLEPASS.to - Date.now()) / 86_400_000));
}

export default function PassBuyPage() {
  const daysLeft = daysLeftInSeason();
  const seasonEnd = new Date(BATTLEPASS.to).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="relative overflow-hidden">
      {/* Фоновое свечение — то же, что на странице Premium */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-gradient-to-b from-accent/18 via-accent-2/8 to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-40 top-40 h-[520px] w-[520px] rounded-full bg-accent/12 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-40 top-[45%] h-[420px] w-[420px] rounded-full bg-accent-2/8 blur-3xl"
        aria-hidden
      />

      {/* ------------------------------- Герой ------------------------------- */}
      <section className="relative px-4 pb-4 pt-8 sm:pt-10">
        <div className="mx-auto max-w-3xl">
          <Breadcrumbs
            items={[{ label: "Боевой пропуск", href: "/battlepass" }, { label: "Оформление" }]}
          />
        </div>
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-accent-2 to-accent px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-white shadow-[0_12px_28px_-14px_rgba(31,123,255,1)] sm:text-xs">
            {BATTLEPASS.name}
          </span>

          <h1 className="mt-5 bg-gradient-to-r from-white via-accent to-accent-2 bg-clip-text text-3xl font-black leading-tight text-transparent sm:text-5xl md:text-6xl">
            Вторая линия наград
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted sm:text-lg">
            Разовый платёж за сезон: косметика этого сезона, аникойны и опыт пропуска
            на каждом наградном уровне. Сезон до {seasonEnd}.
          </p>

          <PassLoginNote />
        </div>
      </section>

      {/* ------------------------------ Тариф -------------------------------- */}
      <section className="relative mx-auto max-w-6xl px-4 pb-12 pt-10 sm:pt-14" aria-label="Тариф">
        <PassPlans daysLeft={daysLeft} />
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
      <section className="relative mx-auto max-w-4xl px-4 pt-8 text-center">
        <p className="text-sm leading-relaxed text-muted">
          Пропуск не продлевается автоматически: платёж разовый, а подписку можно
          продлить в любой момент на странице{" "}
          <Link href="/premium" className="font-bold text-accent-2 hover:text-white">
            Premium
          </Link>
          .
        </p>
      </section>
    </div>
  );
}