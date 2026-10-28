/**
 * Гайд «Как найти аниме по кадру»: вертикальная лента из четырёх шагов
 * с крупными номерами и светящейся линией, под ней два списка советов.
 * Без карточек и картинок — только типографика.
 */

const STEPS = [
  {
    title: "Сделайте скриншот",
    text: (
      <>
        <kbd>Win</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd> на Windows, <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>4</kbd> на Mac,
        кнопки громкости и питания на телефоне. Кадр без интерфейса плеера работает точнее всего.
      </>
    ),
  },
  {
    title: "Загрузите или вставьте",
    text: (
      <>
        Перетащите файл в рамку, нажмите <kbd>Ctrl</kbd> + <kbd>V</kbd> прямо на странице или вставьте ссылку на картинку.
      </>
    ),
  },
  {
    title: "ИИ изучит кадр",
    text: "Люмина разглядит героев, место и детали сцены, сверит их с тем, что знает об аниме, и назовёт самые вероятные тайтлы.",
  },
  {
    title: "Смотрите сразу",
    text: "Если тайтл есть в каталоге, рядом появится кнопка: откройте аниме и продолжайте с нужной серии.",
  },
];

const TIPS = {
  good: ["Кадр без субтитров и логотипов", "Без чёрных полос по краям", "Чёткая картинка, без сжатия", "Видны лица или характерные детали"],
  bad: ["Нарезки и AMV с эффектами", "Зеркально отражённые и сильно обрезанные кадры", "Скриншоты с наложенным интерфейсом", "Тёмные и размытые сцены"],
};

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
            <span className="fs-step-n" aria-hidden>{index + 1}</span>
            <div className="fs-step-body">
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
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
