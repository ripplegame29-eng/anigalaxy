import { Suspense } from "react";
import type { Metadata } from "next";
import { PageBackdrop } from "@/components/PageBackdrop";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { WatchTogetherHero, WatchTogetherView } from "@/components/WatchTogetherView";

export const metadata: Metadata = {
  title: "Совместный просмотр",
  description:
    "Смотрите аниме с друзьями в одной комнате: общая пауза, общий чат и синхронный переход серий на любом устройстве. Создайте комнату AniGalaxy за пару секунд и поделитесь ссылкой — без регистрации.",
  keywords: ["совместный просмотр", "комната просмотра", "смотреть аниме с друзьями", "AniGalaxy"],
};

/** Четыре шага «как это работает» */
const STEPS = [
  { n: "1", title: "Создайте комнату", text: "Название, тайтл, озвучка и доступ." },
  { n: "2", title: "Поделитесь ссылкой", text: "Ссылка /watch-together?room=XXXXXX откроет приглашение." },
  { n: "3", title: "Включите плеер", text: "Пауза, перемотка и смена серии у всех сразу." },
  { n: "4", title: "Обсуждайте", text: "Чат комнаты рядом с плеером и реакции на кадр." },
];

/** Карточки-фичи */
const FEATURES = [
  { icon: "pause", title: "Синхронная пауза", text: "Ставим на паузу — замирают все: никто не отстаёт и не ловит спойлеры." },
  { icon: "chat", title: "Общий чат", text: "Комнатный чат виден всем участникам: обсуждаете серию, не выходя из плеера." },
  { icon: "queue", title: "Очередь серий", text: "Следующую серию запускает любой участник, а остальные синхронно переходят к ней." },
  { icon: "heart", title: "Реакции", text: "Эмодзи-всплески над плеером — быстрый способ отреагировать на кадр, не отвлекаясь от чата." },
  { icon: "mic", title: "Голосовой канал", text: "Разговор голосом поверх плеера — уже в разработке, пока работает комнатный чат.", soon: true },
  { icon: "users", title: "До 12 зрителей", text: "В открытую комнату влезет вся компания: сколько мест свободно, видно на карточке." },
];

/** Частые вопросы */
const FAQ = [
  {
    question: "Нужна ли регистрация?",
    answer:
      "Нет. Комната создаётся без аккаунта: достаточно указать ник — он виден другим участникам. Ссылку-приглашение можно отправить сразу после создания.",
  },
  {
    question: "Как пригласить друзей?",
    answer:
      "Нажмите «Скопировать ссылку» — она ведёт на /watch-together?room=XXXXXX. У того, кто перейдёт, на странице появится блок «Вы приглашены в комнату» с кнопкой входа.",
  },
  {
    question: "Плеер действительно синхронный?",
    answer:
      "Да: серии идут по HLS из каталога AniLiberty, а пауза, перемотка и переходы по сериям сохраняются на сервере и применяются у всех участников с задержкой в пару секунд. Подключайтесь с любого устройства — комната одна на всех.",
  },
  {
    question: "Сколько человек помещается?",
    answer:
      "В открытую комнату — до 12 зрителей, в комнату по ссылке — до 8. Счётчик занятых мест виден на карточке комнаты и в панели просмотра.",
  },
  {
    question: "Где хранятся комнаты?",
    answer:
      "На сервере AniGalaxy: поэтому код и ссылка работают на любом устройстве. В браузере остаётся только ваш постоянный id и ник. Комната живёт 12 часов, пустая удаляется через полчаса, а участник без запросов пропадает из списка через 45 секунд.",
  },
];

/** Фирменные иконки возможностей: контур с градиентом, единая сетка 24×24 */
const FEATURE_ICONS: Record<string, React.ReactNode> = {
  pause: (
    <>
      <rect x="6" y="5" width="4.2" height="14" rx="1.6" />
      <rect x="13.8" y="5" width="4.2" height="14" rx="1.6" />
    </>
  ),
  chat: (
    <>
      <path d="M20.5 11.2c0 4-3.8 7-8.5 7-.9 0-1.8-.1-2.6-.3L5 19.5l1.2-3.3C4.7 15 3.5 13.2 3.5 11.2c0-4 3.8-7 8.5-7s8.5 3 8.5 7z" />
      <path d="M8.5 10.4h7M8.5 13.2h4" />
    </>
  ),
  queue: (
    <>
      <path d="M4 6.5h10M4 12h6.5M4 17.5h6.5" />
      <path d="M15.2 11.2v7.6l5.6-3.8z" />
    </>
  ),
  heart: <path d="M12 20.2C6.6 16 3.5 13 3.5 9.4 3.5 7 5.3 5.2 7.6 5.2c1.7 0 3.4.9 4.4 2.5 1-1.6 2.7-2.5 4.4-2.5 2.3 0 4.1 1.8 4.1 4.2 0 3.6-3.1 6.6-8.5 10.8z" />,
  mic: (
    <>
      <rect x="9" y="3.5" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M8.5 21h7" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8.5" r="3.3" />
      <path d="M3 19.5c.4-3.2 2.8-5 6-5s5.6 1.8 6 5" />
      <path d="M16 5.4a3.2 3.2 0 0 1 0 6.2M18 14.7c1.7.6 2.8 2.1 3 4.8" />
    </>
  ),
};

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

export default function WatchTogetherPage() {
  return (
    <div className="wtv-page">
      <PageBackdrop variant="together" />
      <div className="wtv-bgfx" aria-hidden />
      <div className="wtv-stars" aria-hidden />

      <div className="wtv-wrap">
        <div className="wtv-crumbs">
          <Breadcrumbs items={[{ label: "Совместный просмотр" }]} />
        </div>

        <WatchTogetherHero />

        <div className="wtv-main">
          <Suspense fallback={<ViewSkeleton />}>
            <WatchTogetherView />
          </Suspense>

          <section id="how-it-works" className="wtv-section" aria-label="Как это работает">
            <div className="wtv-sh">
              <div>
                <h2>Как это работает</h2>
              </div>
            </div>

            <ol className="wtv-steps">
              {STEPS.map((step) => (
                <li key={step.n} className="wtv-step">
                  <span className="wtv-step-n">{step.n}</span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="wtv-section" aria-label="Возможности">
            <div className="wtv-sh">
              <div>
                <h2>Возможности комнат</h2>
              </div>
            </div>

            <svg width="0" height="0" className="absolute" aria-hidden focusable="false">
              <defs>
                <linearGradient id="wtfg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#7cc4ff" />
                  <stop offset="0.55" stopColor="#4a8cff" />
                  <stop offset="1" stopColor="#a78bfa" />
                </linearGradient>
              </defs>
            </svg>
            <div className="wtv-feats">
              {FEATURES.map((feature) => (
                <article key={feature.title} className="wtv-f">
                  <span className="wtv-f-ic" aria-hidden>
                    <svg viewBox="0 0 24 24">{FEATURE_ICONS[feature.icon]}</svg>
                  </span>
                  {feature.soon && <span className="wtv-soon">скоро</span>}
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="wtv-section" aria-label="Частые вопросы">
            <h2 className="wtv-faq-title">Частые вопросы</h2>

            <div className="wtv-faq">
              {FAQ.map((item) => (
                <details key={item.question} className="wtv-q">
                  <summary>{item.question}</summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="wtv-section wtv-note-section">
            <p className="wtv-note">
              Комнаты, участники, состояние плеера и чат хранятся на сервере AniGalaxy. Плеер
              стримит серии из каталога AniLiberty, а пауза и перемотка доезжают до остальных
              участников поллингом раз в пару секунд — без аккаунта и без установки приложений.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
