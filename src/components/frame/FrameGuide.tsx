"use client";

import { useState } from "react";

/**
 * Гайд «Как найти аниме по кадру». У каждого шага есть слот под скриншот:
 * положите картинку в public/frame-guide/step-1.webp … step-4.webp, и она
 * появится сама. Пока файла нет, показывается аккуратная заглушка.
 */

const STEPS = [
  {
    title: "Сделайте скриншот",
    text: "Win + Shift + S на Windows, Cmd + Shift + 4 на Mac, кнопки громкости и питания на телефоне. Кадр без интерфейса плеера работает точнее всего.",
  },
  {
    title: "Загрузите или вставьте",
    text: "Перетащите файл в рамку, нажмите Ctrl + V прямо на странице или вставьте ссылку на картинку.",
  },
  {
    title: "Получите тайтл, серию и секунду",
    text: "Мы покажем процент совпадения, серию и короткий клип сцены. Если тайтл есть в каталоге, его можно сразу смотреть.",
  },
  {
    title: "Не нашлось? Спросите ИИ",
    text: "Нажмите «Разобрать кадр с ИИ»: он опишет, что на картинке, и предложит варианты. Работает и с артами, и со сценами с субтитрами.",
  },
];

const TIPS = {
  good: ["Кадр без субтитров и логотипов", "Без чёрных полос по краям", "Чёткая картинка, без сжатия", "Сцена из самого аниме"],
  bad: ["Нарезки и AMV с эффектами", "Зеркально отражённые и обрезанные кадры", "Рисунки и арты фанатов (для них есть ИИ)", "Скриншоты с наложенным интерфейсом"],
};

function Shot({ n }: { n: number }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="fs-gshot">
      {failed ? (
        <span className="fs-gshot-ph" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
            <circle cx="9" cy="10.5" r="1.6" />
            <path d="M4 17l5-4.5 3.5 3L16 12l4 4.5" />
          </svg>
        </span>
      ) : (
        <img src={`/frame-guide/step-${n}.webp`} alt="" loading="lazy" onError={() => setFailed(true)} />
      )}
    </div>
  );
}

export function FrameGuide() {
  return (
    <section className="fs-guide" aria-labelledby="fs-guide-title">
      <header className="fs-guide-head">
        <h2 id="fs-guide-title">Как найти аниме по кадру</h2>
        <p>Четыре шага и несколько советов, чтобы результат был точным.</p>
      </header>

      <ol className="fs-steps">
        {STEPS.map((step, index) => (
          <li key={step.title} className="fs-step">
            <Shot n={index + 1} />
            <span className="fs-step-n" aria-hidden>{index + 1}</span>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </li>
        ))}
      </ol>

      <div className="fs-tips">
        <div className="fs-tip is-good">
          <h3>Что даёт точный результат</h3>
          <ul>{TIPS.good.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
        <div className="fs-tip is-bad">
          <h3>Из-за чего поиск промахивается</h3>
          <ul>{TIPS.bad.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      </div>
    </section>
  );
}
