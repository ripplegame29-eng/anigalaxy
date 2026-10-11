import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { PremiumLoginNote, PremiumPlans, PromoCode } from "@/components/PremiumPlans";

export const metadata: Metadata = {
  title: "Premium-подписка",
  description:
    "AniGalaxy Premium: 4K-качество, без рекламы, скачивание аниме, ранний доступ к новинкам, эксклюзивные рамки и бейджи профиля. Тарифы на месяц, квартал и год.",
  keywords: ["premium", "подписка", "аниме 4K", "AniGalaxy premium"],
};

const FAQ = [
  {
    question: "Как активировать подписку?",
    answer:
      "Войдите в аккаунт, выберите тариф и нажмите «Оформить подписку». Статус подписки сразу появится в профиле и на странице Premium.",
  },
  {
    question: "Подписка продлевается автоматически?",
    answer:
      "Нет. Мы не списываем деньги автоматически: подписка действует до указанной даты, а продлить её можно в любой момент.",
  },
  {
    question: "Где посмотреть статус и дату окончания?",
    answer:
      "В профиле — пункт «Мой профиль» в меню аккаунта справа в шапке. Там же видно, сколько осталось дней.",
  },
  {
    question: "Что входит в Premium?",
    answer:
      "4K-качество, скачивание до 50 серий в день, ранний доступ к новинкам сезона, анимированные аватары, эксклюзивные рамки и бейджи, приоритетная поддержка.",
  },
];

export default function PremiumPage() {
  return (
    <div className="relative overflow-hidden">
      {/* Фоновое свечение */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-gradient-to-b from-accent/18 via-accent-2/8 to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-40 top-40 h-[520px] w-[520px] rounded-full bg-accent/12 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-40 top-[45%] h-[420px] w-[420px] rounded-full bg-gold/8 blur-3xl"
        aria-hidden
      />

      {/* ------------------------------- Герой ------------------------------- */}
      <section className="relative px-4 pb-4 pt-8 sm:pt-10">
        <div className="mx-auto max-w-3xl">
          <Breadcrumbs items={[{ label: "Premium-подписка" }]} />
        </div>
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-accent-2 to-accent px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-white shadow-[0_12px_28px_-14px_rgba(31,123,255,1)] sm:text-xs">
            AniGalaxy Premium
          </span>

          <h1 className="mt-5 bg-gradient-to-r from-white via-accent to-accent-2 bg-clip-text text-3xl font-black leading-tight text-transparent sm:text-5xl md:text-6xl">
            Раскрой полный потенциал
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted sm:text-lg">
            Поддержи любимый проект и получи максимальный комфорт от просмотра аниме.
          </p>

          <PremiumLoginNote />
        </div>
      </section>

      {/* ------------------------------ Тарифы ------------------------------- */}
      <section className="relative mx-auto max-w-6xl px-4 pb-12 pt-10 sm:pt-14" aria-label="Тарифы">
        <PremiumPlans />
      </section>

      {/* ----------------------------- Промокод ------------------------------ */}
      <section className="relative mx-auto max-w-6xl px-4 pb-12">
        <PromoCode />
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
          Подписка не продлевается автоматически — продлить или перейти на другой тариф можно в
          любой момент, пока подписка активна.
        </p>
      </section>
    </div>
  );
}
