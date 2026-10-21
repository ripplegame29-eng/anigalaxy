import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { PremiumEntry } from "@/components/PremiumEntry";
import { PerkIcon } from "@/components/PerkIcon";
import { PREMIUM_PERKS } from "@/lib/premium-perks";
import { PremiumLoginNote, PremiumPlans, PromoCode } from "@/components/PremiumPlans";

export const metadata: Metadata = {
  title: "Premium-подписка",
  description:
    "AniGalaxy Premium: удвоенные XP и AC за квесты и вход, +50% очков клану, дополнительная линия боевого пропуска, эксклюзивные рамки и тег Premium. Тарифы на месяц, квартал и год.",
  keywords: ["premium", "подписка", "AniGalaxy premium"],
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
      "Денег мы не списываем — платёжных данных у проекта нет. Тумблер «Автопродление» на странице подписки продолжает её на 30 дней, когда срок закончился, но сам платёж не производит: продлить подписку можно промокодом.",
  },
  {
    question: "Где посмотреть статус и дату окончания?",
    answer:
      "В профиле — пункт «Мой профиль» в меню аккаунта справа в шапке. Там же видно, сколько осталось дней.",
  },
  {
    question: "Что входит в Premium?",
    answer:
      "Удвоенные XP и AC за квесты и ежедневный вход, +50% очков клану, дополнительная линия наград в боевом пропуске, эксклюзивные рамки и титулы, тег Premium. Апскейл до 2K/4K в плеере открыт после первых двух серий.",
  },
];

const COMPARE: { row: string; free: string; prem: string }[] = [
  { row: "XP и AC за квесты", free: "×1", prem: "×2" },
  { row: "Награда за ежедневный вход", free: "×1", prem: "×2" },
  { row: "Очки клану", free: "базовые", prem: "+50%" },
  { row: "Боевой пропуск", free: "бесплатная лента", prem: "обе ленты наград" },
  { row: "Эксклюзивные рамки и титулы", free: "—", prem: "✓" },
  { row: "Тег Premium у ника", free: "—", prem: "✓" },
];

export default function PremiumPage() {
  return (
    <PremiumEntry>
      <div className="pp-root relative overflow-hidden">
      <div className="pp-aurora" aria-hidden />
      <div className="pp-floor" aria-hidden />
      <div className="pp-beams" aria-hidden />
      <span className="pp-sparks" aria-hidden>
        {Array.from({ length: 26 }, (_, i) => (
          <b
            key={i}
            style={
              {
                "--x": (i * 37 + 9) % 100,
                "--s": `${2 + (i % 4)}px`,
                "--d": `${10 + (i % 7) * 2}s`,
                "--w": `${-(i * 1.7)}s`,
              } as React.CSSProperties
            }
          />
        ))}
      </span>
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
        className="pointer-events-none absolute -left-40 top-[45%] h-[420px] w-[420px] rounded-full bg-accent-2/8 blur-3xl"
        aria-hidden
      />

      {/* ------------------------------- Герой ------------------------------- */}
      <section className="relative px-4 pb-4 pt-8 sm:pt-10">
        <div className="mx-auto max-w-3xl">
          <Breadcrumbs items={[{ label: "Premium-подписка" }]} />
        </div>
        <div className="mx-auto max-w-3xl text-center">
          <div className="pp-emblem" aria-hidden>
            <i className="r r1" />
            <i className="r r2" />
            <i className="r r3" />
            <svg viewBox="0 0 64 64" fill="none">
              <defs>
                <linearGradient id="pp-cr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#ffffff" />
                  <stop offset=".5" stopColor="#8fd8ff" />
                  <stop offset="1" stopColor="#6d5cff" />
                </linearGradient>
              </defs>
              <path d="M8 46 4 20l14 11 14-19 14 19 14-11-4 26z" fill="url(#pp-cr)" />
              <rect x="9" y="49" width="46" height="6" rx="3" fill="url(#pp-cr)" />
              <circle cx="32" cy="12" r="3" fill="#fff" />
              <circle cx="4" cy="20" r="2.4" fill="#fff" />
              <circle cx="60" cy="20" r="2.4" fill="#fff" />
            </svg>
          </div>
          <span className="pp-eyebrow inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-accent-2 to-accent px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-white shadow-[0_12px_28px_-14px_rgba(31,123,255,1)] sm:text-xs">
            AniGalaxy Premium
          </span>

          <h1 className="pp-h1 mt-5 bg-gradient-to-r from-white via-accent to-accent-2 bg-clip-text text-3xl font-black leading-tight text-transparent sm:text-5xl md:text-6xl">
            Раскрой полный потенциал
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted sm:text-lg">
            Поддержи любимый проект и получи максимальный комфорт от просмотра аниме.
          </p>

          <div className="pp-hero-chips">
            <span>⚡ ×2 XP и AC</span>
            <span>🛡️ +50% клану</span>
            <span>💠 Эксклюзивы</span>
            <span>🎟️ Ленты пропуска</span>
          </div>

          <PremiumLoginNote />
        </div>
      </section>

      {/* ---------------------------- Привилегии ----------------------------- */}
      <section className="relative mx-auto max-w-6xl px-4 pb-6 pt-6" aria-label="Привилегии Premium">
        <h2 className="pp-h2">Что ты получаешь</h2>
        <div className="pp-perks">
          {PREMIUM_PERKS.map((perk, i) => (
            <article key={perk.id} className="pp-perk" style={{ "--i": i } as React.CSSProperties}>
              <PerkIcon id={perk.id} />
              <h3>{perk.title}</h3>
              <p>{perk.text}</p>
              <small>{perk.where}</small>
            </article>
          ))}
        </div>
      </section>

      {/* ------------------------------ Тарифы ------------------------------- */}
      <section className="relative mx-auto max-w-6xl px-4 pb-12 pt-10 sm:pt-14" aria-label="Тарифы">
        <PremiumPlans />
      </section>

      {/* ----------------------------- Сравнение ----------------------------- */}
      <section className="relative mx-auto max-w-4xl px-4 pb-12" aria-label="Сравнение">
        <h2 className="pp-h2">Free против Premium</h2>
        <div className="pp-cmp">
          <div className="pp-cmp-h">
            <span />
            <b>Free</b>
            <b className="pr">Premium</b>
          </div>
          {COMPARE.map((r) => (
            <div key={r.row} className="pp-cmp-r">
              <span>{r.row}</span>
              <em>{r.free}</em>
              <strong>{r.prem}</strong>
            </div>
          ))}
        </div>
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
              className="pp-faq group rounded-2xl px-5 py-4"
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
          Денег мы не списываем автоматически: платёжных данных у проекта нет. Тумблер
          «Автопродление» на странице подписки лишь продолжает её ещё на 30 дней, если срок
          закончился.
        </p>
      </section>
      </div>
    </PremiumEntry>
  );
}
