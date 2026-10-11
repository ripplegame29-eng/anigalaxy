import { Suspense } from "react";
import type { Metadata } from "next";
import { requireFeature } from "@/lib/features";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { WatchTogetherHero, WatchTogetherView } from "@/components/WatchTogetherView";

export const metadata: Metadata = {
  title: "Совместный просмотр",
  description:
    "Смотрите аниме с друзьями в одной комнате: общая пауза, общий чат и синхронный переход серий. Создайте комнату AniGalaxy за пару секунд и поделитесь ссылкой — без регистрации и бэкенда.",
  keywords: ["совместный просмотр", "комната просмотра", "смотреть аниме с друзьями", "AniGalaxy"],
};

/* ------------------------------------------------------------------ */
/*  Контент статичных секций                                           */
/* ------------------------------------------------------------------ */

/** Четыре шага «как это работает» */
const STEPS: { n: string; icon: string; title: string; text: string }[] = [
  {
    n: "01",
    icon: "plus",
    title: "Создайте комнату",
    text: "Название, тайтл, озвучка и доступ — код на шесть символов сгенерируется сразу после создания.",
  },
  {
    n: "02",
    icon: "link",
    title: "Поделитесь ссылкой",
    text: "Ссылка вида /watch-together?room=XXXXXX откроет приглашение у любого, кто по ней перейдёт.",
  },
  {
    n: "03",
    icon: "play",
    title: "Синхронный плеер",
    text: "Пауза, перемотка и переход к следующей серии происходят у всех участников одновременно.",
  },
  {
    n: "04",
    icon: "chat",
    title: "Чат и реакции",
    text: "Общий чат и эмодзи-реакции поверх плеера — обсуждать серию прямо во время просмотра.",
  },
];

/** Карточки-фичи */
interface Feature {
  icon: string;
  title: string;
  text: string;
  soon?: boolean;
}

const FEATURES: Feature[] = [
  {
    icon: "pause",
    title: "Синхронная пауза",
    text: "Ставим на паузу — замирают все: никто не отстаёт и не ловит спойлеры.",
  },
  {
    icon: "chat",
    title: "Общий чат",
    text: "Комнатный чат виден всем участникам: обсуждаете серию, не выходя из плеера.",
  },
  {
    icon: "list",
    title: "Очередь серий",
    text: "Следующую серию запускает любой участник, а остальные синхронно переходят к ней.",
  },
  {
    icon: "heart",
    title: "Реакции",
    text: "Эмодзи-всплески над плеером: видно, когда всем страшно, смешно или очень круто.",
  },
  {
    icon: "mic",
    title: "Голосовой канал",
    text: "Разговор голосом поверх плеера — уже в разработке, пока работает комнатный чат.",
    soon: true,
  },
  {
    icon: "users",
    title: "До 12 зрителей",
    text: "В открытую комнату влезет вся компания: сколько мест свободно, видно на карточке.",
  },
];

/** Частые вопросы */
const FAQ = [
  {
    question: "Нужна ли регистрация?",
    answer:
      "Нет. Комната создаётся без аккаунта: она хранится в localStorage вашего браузера, а ссылку-приглашение можно отправить сразу после создания.",
  },
  {
    question: "Как пригласить друзей?",
    answer:
      "Нажмите «Скопировать ссылку» — она ведёт на /watch-together?room=XXXXXX. У того, кто перейдёт, на странице появится блок «Вы приглашены в комнату» с кнопкой входа.",
  },
  {
    question: "Плеер действительно синхронный?",
    answer:
      "Да: плеер настоящий — серии идут по HLS из каталога AniLiberty, общие пауза, перемотка и переходы по сериям. Бэкенда нет, поэтому синк работает между вкладками одного браузера — с чужого устройства комната не откроется.",
  },
  {
    question: "Сколько человек помещается?",
    answer:
      "В открытую комнату — до 12 зрителей, в комнату по ссылке — до 8. Счётчик занятых мест виден на карточке комнаты и в панели просмотра.",
  },
  {
    question: "Где хранятся мои комнаты?",
    answer:
      "Только в вашем браузере, под ключом ag:wt:rooms. Очистка данных сайта или режим инкогнито удалят список — на других устройствах комнаты не появятся.",
  },
];

/* ------------------------------------------------------------------ */
/*  Иконки (тонкий штрих, как во всём интерфейсе)                      */
/* ------------------------------------------------------------------ */

const ICONS: Record<string, string[]> = {
  plus: ["M12 5v14", "M5 12h14"],
  link: [
    "M10.2 13.8a4.2 4.2 0 0 0 6 0l2.4-2.4a4.2 4.2 0 1 0-6-6L11.3 6.4",
    "M13.8 10.2a4.2 4.2 0 0 0-6 0l-2.4 2.4a4.2 4.2 0 1 0 6 6l1.3-1.3",
  ],
  play: ["M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17", "M10.3 8.7 15.5 12l-5.2 3.3z"],
  chat: [
    "M20 12.4a7.6 7.6 0 0 1-11.1 6.8L4.6 20.4l1.2-4.2A7.6 7.6 0 1 1 20 12.4z",
    "M9 11.5h6",
    "M9 14.5h3.5",
  ],
  pause: ["M9.5 6.5v11", "M14.5 6.5v11"],
  list: ["M4 7h11", "M4 12h11", "M4 17h7", "m16.5 13.5 4.5 3-4.5 3z"],
  heart: ["M12 19.5S5.2 15.4 5.2 10.4A3.9 3.9 0 0 1 12 8.2a3.9 3.9 0 0 1 6.8 2.2c0 5-6.8 9.1-6.8 9.1z"],
  mic: [
    "M12 4a2.8 2.8 0 0 1 2.8 2.8v5a2.8 2.8 0 0 1-5.6 0v-5A2.8 2.8 0 0 1 12 4z",
    "M6.5 11.5a5.5 5.5 0 0 0 11 0",
    "M12 17v3",
    "M9 20h6",
  ],
  users: [
    "M15.5 19.5v-1.7a3.5 3.5 0 0 0-3.5-3.5H7a3.5 3.5 0 0 0-3.5 3.5v1.7",
    "M10 5.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0",
    "M17 8.6a3.5 3.5 0 0 1 0 6.8",
    "M21 19.5v-1.7a3.5 3.5 0 0 0-2.6-3.4",
  ],
};

function Icon({
  name,
  className = "h-5 w-5",
  sw = 1.7,
}: {
  name: string;
  className?: string;
  sw?: number;
}) {
  const paths = ICONS[name] ?? [];
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/** Заголовок секции: цветная шкала-акцент слева, как на главной */
function SectionTitle({
  children,
  bar = "bg-accent",
}: {
  children: React.ReactNode;
  bar?: string;
}) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span className={`h-7 w-1.5 shrink-0 rounded-full ${bar}`} aria-hidden />
      <h2 className="text-lg font-extrabold tracking-tight sm:text-xl">{children}</h2>
    </div>
  );
}

/** Замена интерактивной части, пока она готовится на клиенте */
function ViewSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="skeleton h-36 rounded-3xl" />
      <div className="skeleton h-[420px] rounded-3xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-64 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Страница                                                           */
/* ------------------------------------------------------------------ */

export default async function WatchTogetherPage() {
  // Тумблер «watchTogether» в панели «Настройки». Выключенная механика — 404.
  await requireFeature("watchTogether");
  return (
    <div className="relative overflow-hidden">
      {/* Фоновое свечение — как на страницах Premium и «Поддержать» */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-gradient-to-b from-accent/18 via-accent-2/8 to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-40 top-40 h-[520px] w-[520px] rounded-full bg-accent/12 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-40 top-[45%] h-[420px] w-[420px] rounded-full bg-accent-2/10 blur-3xl"
        aria-hidden
      />

      {/* ------------------------------- Герой ------------------------------- */}
      <section className="relative px-4 pb-6 pt-8 sm:pt-10">
        <div className="mx-auto max-w-3xl">
          <Breadcrumbs items={[{ label: "Совместный просмотр" }]} />
        </div>

        <div className="mx-auto max-w-3xl text-center">
          <span className="animate-fade-in inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-accent-2 to-accent px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-white shadow-[0_12px_28px_-14px_rgba(31,123,255,1)] sm:text-xs">
            👥 Смотрим вместе
          </span>

          <h1 className="animate-fade-up mt-5 bg-gradient-to-r from-white via-accent to-accent-2 bg-clip-text text-3xl leading-tight font-black text-transparent sm:text-5xl md:text-6xl">
            Совместный просмотр
          </h1>

          <p className="animate-fade-up mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted sm:text-lg">
            Смотрите аниме с друзьями в одной комнате: общая пауза, чат и синхронный переход серий.
          </p>

          {/* Счётчики и кнопки — клиентский компонент (дрейф чисел в эффекте) */}
          <WatchTogetherHero />
        </div>
      </section>

      {/* ------------------- Интерактив: комната, поиск, список ------------------ */}
      <div className="relative mx-auto max-w-7xl px-4 pb-12 sm:px-6">
        {/* `useSearchParams` читает `?room=` — без границы Suspense сборка
            статической страницы в Next 16 падает с Missing Suspense boundary */}
        <Suspense fallback={<ViewSkeleton />}>
          <WatchTogetherView />
        </Suspense>
      </div>

      {/* --------------------------- Как это работает -------------------------- */}
      <section
        id="how-it-works"
        aria-label="Как это работает"
        className="relative mx-auto max-w-6xl scroll-mt-24 px-4 pb-12"
      >
        <SectionTitle>Как это работает</SectionTitle>

        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li
              key={step.n}
              className="animate-fade-up relative overflow-hidden rounded-2xl border border-line bg-card/70 p-5 transition hover:-translate-y-1 hover:border-accent/40 hover:shadow-[0_18px_40px_-24px_rgba(31,123,255,0.9)]"
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <span
                className="absolute -top-1 right-3 text-5xl font-black text-white/6"
                aria-hidden
              >
                {step.n}
              </span>
              <span
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-accent/25 to-accent-2/15 text-white ring-1 ring-white/10"
                aria-hidden
              >
                <Icon name={step.icon} className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-base leading-snug font-black text-white sm:text-lg">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ----------------------------- Возможности ---------------------------- */}
      <section aria-label="Возможности" className="relative mx-auto max-w-6xl px-4 pb-12">
        <SectionTitle bar="bg-accent-2">Возможности комнат</SectionTitle>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <article
              key={feature.title}
              className="animate-fade-up rounded-2xl border border-line bg-card/70 p-5 transition hover:-translate-y-1 hover:border-accent-2/45 hover:shadow-[0_18px_40px_-24px_rgba(0,200,255,0.8)]"
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent/25 to-accent-2/15 text-white ring-1 ring-white/10"
                  aria-hidden
                >
                  <Icon name={feature.icon} className="h-5 w-5" />
                </span>
                {feature.soon && (
                  <span className="rounded-lg border border-gold/40 bg-gold/12 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-gold">
                    скоро
                  </span>
                )}
              </div>
              <h3 className="mt-4 text-base leading-snug font-black text-white sm:text-lg">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{feature.text}</p>
            </article>
          ))}
        </div>
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
      <section className="relative mx-auto max-w-4xl px-4 pt-8 pb-10 text-center">
        <p className="text-sm leading-relaxed text-muted">
          Комнаты и список зрителей хранятся только в вашем браузере (localStorage), бэкенда нет:
          плеер стримит серии из каталога AniLiberty, а пауза и перемотка синхронизируются между
          вкладками этого браузера.
        </p>
      </section>
    </div>
  );
}
