import { Suspense } from "react";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { WatchTogetherHero, WatchTogetherView } from "@/components/WatchTogetherView";

export const metadata: Metadata = {
  title: "Совместный просмотр",
  description:
    "Смотрите аниме с друзьями в одной комнате: общая пауза, общий чат и синхронный переход серий. Создайте комнату AniGalaxy за пару секунд и поделитесь ссылкой — без регистрации и бэкенда.",
  keywords: ["совместный просмотр", "комната просмотра", "смотреть аниме с друзьями", "AniGalaxy"],
};

/** Четыре шага «как это работает» */
const STEPS = [
  { n: "1", title: "Создайте комнату", text: "Название, тайтл, озвучка и доступ." },
  { n: "2", title: "Поделитесь ссылкой", text: "Ссылка /watch-together?room=XXXXXX откроет приглашение." },
  { n: "3", title: "Включите плеер", text: "Пауза, перемотка и смена серии у всех сразу." },
  { n: "4", title: "Обсуждайте", text: "Чат и реакции прямо поверх плеера." },
];

/** Карточки-фичи */
const FEATURES = [
  { icon: "⏸", title: "Синхронная пауза", text: "Ставим на паузу — замирают все: никто не отстаёт и не ловит спойлеры.", wide: true },
  { icon: "💬", title: "Общий чат", text: "Комнатный чат виден всем участникам: обсуждаете серию, не выходя из плеера." },
  { icon: "📋", title: "Очередь серий", text: "Следующую серию запускает любой участник, а остальные синхронно переходят к ней." },
  { icon: "❤️", title: "Реакции", text: "Эмодзи-всплески над плеером: видно, когда всем страшно, смешно или очень круто." },
  { icon: "🎙️", title: "Голосовой канал", text: "Разговор голосом поверх плеера — уже в разработке, пока работает комнатный чат.", soon: true, wide: true },
  { icon: "👥", title: "До 12 зрителей", text: "В открытую комнату влезет вся компания: сколько мест свободно, видно на карточке." },
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

            <div className="wtv-feats">
              {FEATURES.map((feature) => (
                <article
                  key={feature.title}
                  className={`wtv-f${feature.wide ? " wide" : ""}`}
                >
                  <span className="wtv-f-ic" aria-hidden>
                    {feature.icon}
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
              Комнаты и список зрителей хранятся только в вашем браузере (localStorage), бэкенда нет:
              плеер стримит серии из каталога AniLiberty, а пауза и перемотка синхронизируются между
              вкладками этого браузера.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
