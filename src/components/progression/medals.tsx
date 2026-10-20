"use client";

/**
 * Медали достижений — порт трёх макетов Клода 1:1.
 *
 * В проекте эмблема (`AchievementEmblem`) — это простая иконка в кружке с
 * цветом редкости. Макеты же рисуют полноценную медаль: собственная форма
 * (шестиугольник, круг, щит, ромб, крыло, восьмиугольник, везика, арка,
 * звезда-4, звезда-12), объёмные градиенты, иконка с собственной анимацией.
 *
 * Здесь живут фигуры, иконки и палитры. Рисует всё `MedalArt`.
 *
 * Формат кода («Ночной дозор II — Страж II») и названия семейств — из тех же
 * макетов, см. `lib/progression/achievement-codes`.
 */

import { useId, type CSSProperties, type JSX } from "react";

/* ------------------------------- Геометрия ------------------------------- */

/** Точки звезды/многоугольника: n лучей, ro — наружный, ri — внутренний радиус */
export function pts(cx: number, cy: number, n: number, ro: number, ri: number, rot = -90): string {
  const out: string[] = [];
  for (let i = 0; i < n * 2; i += 1) {
    const r = i % 2 ? ri : ro;
    const a = ((rot + (i * 180) / n) * Math.PI) / 180;
    out.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return out.join(" ");
}

/** Масштаб фигуры вокруг её центра */
const T = (s: number, cx = 48, cy = 52): string =>
  `translate(${cx} ${cy}) scale(${s}) translate(${-cx} ${-cy})`;

/** Бесконечное вращение через SMIL — как в макетах */
function rot(cx: number, cy: number, dur: number, rev = false): JSX.Element {
  return (
    <animateTransform
      attributeName="transform"
      type="rotate"
      from={`${rev ? 360 : 0} ${cx} ${cy}`}
      to={`${rev ? 0 : 360} ${cx} ${cy}`}
      dur={`${dur}s`}
      repeatCount="indefinite"
    />
  );
}

/** Мерцающая звёздочка-искра */
function tw(x: number, y: number, s: number, d: number): JSX.Element {
  const k = s * 0.28;
  return (
    <g transform={`translate(${x} ${y})`}>
      <path
        className="md-tw"
        style={{ animationDelay: `${d}s` }}
        d={`M0 -${s}L${k} -${k}L${s} 0L${k} ${k}L0 ${s}L-${k} ${k}L-${s} 0L-${k} -${k}Z`}
        fill="#fff"
      />
    </g>
  );
}

/* -------------------------------- Фигуры -------------------------------- */

export type MedalShape =
  | "hexagon"
  | "circle"
  | "shield"
  | "diamond"
  | "wing"
  | "star8"
  | "octagon"
  | "vesica"
  | "arch"
  | "star4"
  | "star12";

/** Контур фигуры + во сколько раз в неё вписана внутренняя подложка */
export const SHAPES: Record<MedalShape, { outline: (s: number) => string; inner: number }> = {
  // коллекция 01 — все медали на шестиугольной подложке
  hexagon: {
    outline: () => `<polygon points="${pts(48, 52, 3, 44, 44)}"/>`,
    inner: 36 / 44,
  },
  // коллекция 02 — «разные формы»
  circle: { outline: (s) => `<circle cx="48" cy="52" r="${44 * s}"/>`, inner: 0.76 },
  shield: {
    outline: () => `<path d="M48 4L88 17V50C88 75 70 93 48 101C26 93 8 75 8 50V17Z"/>`,
    inner: 0.78,
  },
  diamond: { outline: () => `<polygon points="48,2 92,52 48,102 4,52"/>`, inner: 0.74 },
  wing: { outline: (s) => `<circle cx="48" cy="54" r="${38 * s}"/>`, inner: 0.8 },
  star8: { outline: () => `<polygon points="${pts(48, 52, 8, 48, 38)}"/>`, inner: 0.74 },
  // коллекция 03 — легендарные
  octagon: { outline: () => `<polygon points="${pts(48, 52, 8, 47, 47, -67.5)}"/>`, inner: 0.78 },
  vesica: {
    outline: () => `<path d="M48 0C92 28 94 78 48 104C2 78 4 28 48 0Z"/>`,
    inner: 0.78,
  },
  arch: {
    outline: () => `<path d="M10 98V46C10 22 27 4 48 4S86 22 86 46V98L48 103Z"/>`,
    inner: 0.8,
  },
  star4: { outline: () => `<polygon points="${pts(48, 52, 4, 50, 30)}"/>`, inner: 0.72 },
  star12: { outline: () => `<polygon points="${pts(48, 52, 12, 49, 41)}"/>`, inner: 0.8 },
};

/* -------------------------------- Иконки -------------------------------- */

export type MedalIcon =
  | "moon"
  | "sakura"
  | "bubble"
  | "fox"
  | "katana"
  | "clock"
  | "seraph"
  | "sword"
  | "planet"
  | "eye"
  | "infinity"
  | "flame"
  | "key"
  | "crescent"
  | "crown";

/** Иконки в viewBox 64×64 — перенесены из макетов без изменений */
export const ICONS: Record<MedalIcon, () => JSX.Element> = {
  // 1. Ночной дозор — луна и мерцающие звёзды
  moon: () => (
    <>
      <path d="M40 9A23 23 0 1 0 55 47A19 19 0 0 1 40 9Z" fill="#fff" />
      <circle cx="26" cy="30" r="3" fill="rgba(0,0,0,.18)" />
      <circle cx="33" cy="42" r="2" fill="rgba(0,0,0,.18)" />
      {tw(50, 16, 6, 0)}
      {tw(56, 30, 4, 0.8)}
      {tw(44, 8, 3, 1.5)}
    </>
  ),
  // 2. Первый сезон — сакура, медленно вращается
  sakura: () => (
    <>
      <g className="md-spin">
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i} transform={`rotate(${i * 72} 32 32)`}>
            <path d="M32 32C24 24 24 10 32 6C40 10 40 24 32 32Z" fill="#fff" />
            <path
              d="M32 6L32 12"
              stroke="rgba(0,0,0,.25)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
        ))}
      </g>
      <circle cx="32" cy="32" r="4.5" fill="rgba(0,0,0,.35)" />
      <circle cx="32" cy="32" r="2" fill="#fff" />
    </>
  ),
  // 3. Сэнпай — диалоговое облако с прыгающими точками
  bubble: () => (
    <>
      <path d="M12 12h40a5 5 0 0 1 5 5v22a5 5 0 0 1-5 5H34L22 55V44H12a5 5 0 0 1-5-5V17a5 5 0 0 1 5-5Z" fill="#fff" />
      <circle className="md-dot" cx="22" cy="28" r="3.4" fill="rgba(0,0,0,.5)" />
      <circle className="md-dot" style={{ animationDelay: ".18s" }} cx="32" cy="28" r="3.4" fill="rgba(0,0,0,.5)" />
      <circle className="md-dot" style={{ animationDelay: ".36s" }} cx="42" cy="28" r="3.4" fill="rgba(0,0,0,.5)" />
    </>
  ),
  // 4. Кицунэ — маска лисы с мигающими глазами
  fox: () => (
    <>
      <g className="md-sway">
        <path d="M8 8L24 20H40L56 8L55 36C52 48 44 56 32 58C20 56 12 48 9 36Z" fill="#fff" />
        <path d="M32 40L26 50H38Z" fill="rgba(0,0,0,.35)" />
        <path
          d="M14 36C17 44 22 49 28 52M50 36C47 44 42 49 36 52"
          stroke="rgba(0,0,0,.3)"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />
        <path d="M26 8L28 18M38 8L36 18" stroke="rgba(0,0,0,.25)" strokeWidth="2" strokeLinecap="round" />
      </g>
      <path className="md-blink md-glow" d="M15 28Q22 22 29 30Q22 33 15 28Z" fill="rgba(0,0,0,.65)" />
      <path className="md-blink md-glow" d="M49 28Q42 22 35 30Q42 33 49 28Z" fill="rgba(0,0,0,.65)" />
    </>
  ),
  // 5. Клинок тысячи серий — скрещённые катаны со вспышкой
  katana: () => {
    const blade = (r: number) => (
      <g transform={`rotate(${r} 32 32)`}>
        <path d="M32 2L35 10V42H29V10Z" fill="#fff" />
        <rect x="25" y="42" width="14" height="3.4" rx="1.6" fill="#fff" />
        <rect x="29.5" y="45.4" width="5" height="14" rx="1.6" fill="rgba(255,255,255,.85)" />
        <path d="M32 4V40" stroke="rgba(0,0,0,.25)" strokeWidth="1.2" />
      </g>
    );
    return (
      <>
        {blade(-40)}
        {blade(40)}
        <g transform="translate(32 25)">
          <g className="md-clash">
            <path d="M0 -10L2.6 -2.6L10 0L2.6 2.6L0 10L-2.6 2.6L-10 0L-2.6 -2.6Z" fill="#fff" />
          </g>
        </g>
      </>
    );
  },
  // 6. Хроноритм — часы с бегущими стрелками
  clock: () => (
    <>
      <circle cx="32" cy="32" r="26" stroke="#fff" strokeWidth="3.4" fill="none" />
      {Array.from({ length: 12 }, (_, i) => (
        <path
          key={i}
          d={`M32 9V${i % 3 ? 12 : 15}`}
          stroke="#fff"
          strokeWidth={i % 3 ? 1.6 : 2.6}
          strokeLinecap="round"
          transform={`rotate(${i * 30} 32 32)`}
        />
      ))}
      <g>
        <path d="M32 32V19" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" />
        {rot(32, 32, 48)}
      </g>
      <g>
        <path d="M32 32V12" stroke="rgba(255,255,255,.9)" strokeWidth="2.2" strokeLinecap="round" />
        {rot(32, 32, 4)}
      </g>
      <circle cx="32" cy="32" r="3.4" fill="#fff" />
      <circle cx="32" cy="32" r="1.4" fill="rgba(0,0,0,.4)" />
    </>
  ),
  // 7. Небесный эфир — серафим: звезда с нимбом
  seraph: () => (
    <>
      <polygon className="md-twinkle-slow" points={pts(32, 38, 5, 23, 9.5)} fill="#fff" />
      <polygon points={pts(32, 38, 5, 10, 4)} fill="rgba(0,0,0,.18)" />
      <ellipse className="md-glow" cx="32" cy="8" rx="14" ry="4" stroke="#fff" strokeWidth="2.8" fill="none" />
      {tw(8, 30, 4, 0.3)}
      {tw(56, 28, 5, 1.1)}
      {tw(54, 52, 3, 1.7)}
    </>
  ),
  // 8. Клятва воина — меч
  sword: () => (
    <>
      <path d="M32 3L36.5 13V41H27.5V13Z" fill="#fff" />
      <path d="M32 6V39" stroke="rgba(0,0,0,.22)" strokeWidth="1.3" />
      <path className="md-glint" d="M32 3L36.5 13V24H27.5V13Z" fill="#fff" opacity="0" />
      <rect x="17" y="41" width="30" height="4.4" rx="2.2" fill="#fff" />
      <rect x="29.5" y="45.4" width="5" height="12" rx="1.8" fill="rgba(255,255,255,.9)" />
      <circle cx="32" cy="60" r="3.2" fill="#fff" />
      {tw(15, 22, 5, 0)}
      {tw(50, 28, 4, 1.2)}
      {tw(46, 10, 3, 0.7)}
    </>
  ),
  // 9. Звёздный странник — планета с кольцом и спутником
  planet: () => (
    <>
      <ellipse
        cx="32"
        cy="32"
        rx="27"
        ry="8.5"
        stroke="#fff"
        strokeWidth="2.2"
        fill="none"
        transform="rotate(-22 32 32)"
      />
      <circle cx="32" cy="32" r="12.5" fill="#fff" />
      <path d="M22 28C28 24 38 25 42 29" stroke="rgba(0,0,0,.22)" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <g>
        {rot(32, 32, 7)}
        <circle cx="32" cy="5" r="3.4" fill="#fff" />
      </g>
      {tw(8, 10, 4, 0.2)}
      {tw(56, 54, 4, 1.4)}
      {tw(10, 54, 3, 0.9)}
    </>
  ),
  // 10. Врата ёкай — глаз с вертикальным зрачком
  eye: () => (
    <>
      <g>
        {rot(32, 32, 24)}
        <circle cx="32" cy="32" r="30" stroke="#fff" strokeWidth="1.6" strokeDasharray="2 6" strokeLinecap="round" fill="none" />
      </g>
      <path d="M5 32C15 16 49 16 59 32C49 48 15 48 5 32Z" stroke="#fff" strokeWidth="3" fill="rgba(255,255,255,.12)" />
      <circle cx="32" cy="32" r="10.5" fill="#fff" />
      <ellipse className="md-pupil" cx="32" cy="32" rx="3" ry="9.5" fill="rgba(0,0,0,.85)" />
      <circle cx="28.5" cy="28" r="1.8" fill="#fff" />
    </>
  ),
  // 11. Вечный зритель — бесконечность с бегущими точками
  infinity: () => {
    const d = "M32 32C26 21 10 21 10 32C10 43 26 43 32 32C38 21 54 21 54 32C54 43 38 43 32 32Z";
    return (
      <>
        <path d={d} stroke="#fff" strokeWidth="5" strokeLinejoin="round" fill="none" />
        <path d={d} stroke="rgba(0,0,0,.25)" strokeWidth="1.4" strokeLinejoin="round" fill="none" />
        <circle r="3.6" fill="#fff">
          <animateMotion dur="4s" repeatCount="indefinite" path={d} />
        </circle>
        <circle r="2.4" fill="#fff" opacity=".7">
          <animateMotion dur="4s" begin="-2s" repeatCount="indefinite" path={d} />
        </circle>
        {tw(32, 8, 5, 0.2)}
        {tw(32, 56, 4, 1.2)}
        {tw(6, 12, 3, 0.7)}
      </>
    );
  },
  // 12. Пламя феникса
  flame: () => (
    <>
      <g className="md-flame">
        <path d="M32 3C35 16 50 22 50 39C50 51 41 59 32 59C23 59 14 51 14 39C14 31 18 26 23 21C23 30 27 32 30 30C29 21 28 12 32 3Z" fill="#fff" />
      </g>
      <g className="md-flame2">
        <path d="M32 31C35 37 42 40 42 47C42 53 37 56 32 56C27 56 22 53 22 47C22 40 29 38 32 31Z" fill="rgba(0,0,0,.28)" />
      </g>
      <g className="md-flame2">
        <path d="M32 42C34 46 37 47 37 51C37 54 35 55 32 55C29 55 27 54 27 51C27 47 30 46 32 42Z" fill="rgba(255,255,255,.9)" />
      </g>
      {tw(10, 14, 4, 0)}
      {tw(55, 24, 3, 0.9)}
      {tw(52, 50, 4, 1.6)}
    </>
  ),
  // 13. Хранитель врат — ключ
  key: () => (
    <>
      <g className="md-key">
        <circle cx="21" cy="21" r="12" stroke="#fff" strokeWidth="5" fill="none" />
        <circle cx="21" cy="21" r="4" fill="#fff" className="md-glow" />
        <path d="M30 30L56 56" stroke="#fff" strokeWidth="5.4" strokeLinecap="round" />
        <path d="M44 44L51 37M51 51L58 44" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
      </g>
      {tw(52, 12, 5, 0.3)}
      {tw(10, 50, 4, 1.1)}
      {tw(56, 32, 3, 1.8)}
    </>
  ),
  // 14. Лунная владычица — полумесяц
  crescent: () => (
    <>
      <path d="M40 7A24 24 0 1 0 56 47A20 20 0 0 1 40 7Z" fill="#fff" />
      <circle cx="24" cy="30" r="3.2" fill="rgba(0,0,0,.16)" />
      <circle cx="33" cy="44" r="2.2" fill="rgba(0,0,0,.16)" />
      <g>
        {rot(32, 32, 9)}
        <circle cx="32" cy="2" r="2.8" fill="#fff" />
      </g>
      <g>
        {rot(32, 32, 14, true)}
        <circle cx="62" cy="32" r="2" fill="#fff" opacity=".8" />
      </g>
      {tw(48, 16, 6, 0)}
      {tw(56, 32, 4, 0.9)}
      {tw(44, 6, 3, 1.6)}
    </>
  ),
  // 15. Император аниме — корона
  crown: () => (
    <>
      <path d="M7 47L3 17L19 31L32 8L45 31L61 17L57 47Z" fill="#fff" />
      <rect x="7" y="49" width="50" height="7" rx="3.4" fill="#fff" />
      <polygon points="32,50 35.5,52.5 32,55 28.5,52.5" fill="rgba(0,0,0,.35)" />
      <circle className="md-gem" cx="3" cy="17" r="3.4" fill="#fff" />
      <circle className="md-gem" style={{ animationDelay: ".6s" }} cx="32" cy="8" r="3.6" fill="#fff" />
      <circle className="md-gem" style={{ animationDelay: "1.2s" }} cx="61" cy="17" r="3.4" fill="#fff" />
      <path d="M19 31L24 46M45 31L40 46M32 20V44" stroke="rgba(0,0,0,.2)" strokeWidth="1.6" strokeLinecap="round" />
      {tw(14, 6, 4, 0.2)}
      {tw(52, 6, 4, 1.1)}
      {tw(32, 62, 3, 0.8)}
    </>
  ),
};

/* -------------------------------- Медали -------------------------------- */

export type MedalTier = "ЛЕГЕНДАРНОЕ" | "ТИР I" | "АБСОЛЮТ";

export interface MedalDef {
  /** id достижения в конфиге — к чему привязана медаль */
  achievementId: string;
  /** Код из макета: «Ночной дозор II — Страж II» */
  code: string;
  /** Условие из макета, словами пользователя */
  description: string;
  shape: MedalShape;
  icon: MedalIcon;
  /** Масштаб иконки */
  sc: number;
  /** Светлая часть градиента */
  c1: string;
  /** Насыщенная часть градиента */
  c2: string;
  /** Свечение: «r,g,b» */
  g: string;
  /** Подпись над названием: коллекция 03 делит медали на тиры */
  tier?: MedalTier;
  /** Достижение-исключение из коллекции 02, подсвечивается рамкой */
  legend?: boolean;
}

/**
 * Пятнадцать медалей из трёх макетов. Названия (коды) и условия — дословно 1:1.
 *
 * Девять из них переодеты в СУЩЕСТВУЮЩИЕ достижения: у них в конфиге уже был
 * ровно такой же порог, поэтому новое достижение не заводили — иначе одно
 * действие давало бы две медали и двойные очки. У таких медаль играет роль
 * оболочки, id в MEDALS совпадает с id достижения:
 *
 *   ach_night_10       «Ночной дозор II — Страж II»        30 ночных серий
 *   ach_titles_1       «Первый сезон I — Новичок I»         1 тайтл
 *   ach_comments_100   «Сэнпай III — Наставник III»        100 комментариев
 *   ach_secret_0404    «Лисья печать IV — Кицунэ IV»        пасхалка
 *   ach_episodes_1000  «Клинок тысячи серий V — Мастер V»  1000 серий
 *   ach_ratings_500    «Небесный эфир VI — Серафим VI»      500 оценок
 *   ach_minutes_10000  «Вечный зритель X — Бессмертный X»  10 000 минут
 *   ach_streak_365     «Пламя феникса IX — Возрождённый IX» 365 дней подряд
 *   ach_night_500      «Лунная владычица X — Королева ночи X» 500 ночных
 *
 * Остальные шесть пока живут только в галерее `/dev/medals`: под каждым
 * условием из макета в движке нет соответствующего счётчика (максимум минут
 * за сутки, число тайтлов в конкретном жанре, все тайные, все сезоны, «все
 * остальные достижения»). Заводить их счётчики — отдельная задача; молча
 * привязывать к несуществующей метрике нельзя, получилось бы достижение,
 * которое нельзя получить никогда.
 */
export const MEDALS: Record<string, MedalDef> = {
  // ---- коллекция 01: обычные, шестиугольная подложка ----
  ach_night_10: {
    achievementId: "ach_night_10",
    code: "Ночной дозор II — Страж II",
    description: "Смотреть аниме после 3 часов ночи 30 раз",
    shape: "hexagon",
    icon: "moon",
    sc: 0.74,
    c1: "#a9b4ff",
    c2: "#3a3fc4",
    g: "120,130,255",
  },
  ach_titles_1: {
    achievementId: "ach_titles_1",
    code: "Первый сезон I — Новичок I",
    description: "Досмотреть первый тайтл до последней серии",
    shape: "hexagon",
    icon: "sakura",
    sc: 0.74,
    c1: "#ffc1e0",
    c2: "#d9387f",
    g: "255,120,180",
  },
  ach_comments_100: {
    achievementId: "ach_comments_100",
    code: "Сэнпай III — Наставник III",
    description: "Оставить 100 комментариев под сериями",
    shape: "hexagon",
    icon: "bubble",
    sc: 0.74,
    c1: "#8ff0d0",
    c2: "#0f9f7a",
    g: "40,220,170",
  },
  ach_secret_0404: {
    achievementId: "ach_secret_0404",
    code: "Лисья печать IV — Кицунэ IV",
    description: "Найти спрятанную пасхалку на сайте",
    shape: "hexagon",
    icon: "fox",
    sc: 0.74,
    c1: "#ffc47a",
    c2: "#d4540a",
    g: "255,150,50",
  },
  ach_episodes_1000: {
    achievementId: "ach_episodes_1000",
    code: "Клинок тысячи серий V — Мастер V",
    description: "Посмотреть 1000 эпизодов",
    shape: "hexagon",
    icon: "katana",
    sc: 0.74,
    c1: "#e9d6ff",
    c2: "#7a3fd1",
    g: "176,106,255",
  },
  // ---- коллекция 02: разные формы ----
  ach_chrono_day: {
    achievementId: "ach_chrono_day",
    code: "Хроноритм IV — Повелитель времени IV",
    description: "Посмотреть 24 часа аниме за одни сутки",
    shape: "circle",
    icon: "clock",
    sc: 0.74,
    c1: "#7df3ff",
    c2: "#0f8fb3",
    g: "60,210,255",
  },
  ach_ratings_500: {
    achievementId: "ach_ratings_500",
    code: "Небесный эфир VI — Серафим VI",
    description: "Оценить 500 тайтлов",
    shape: "wing",
    icon: "seraph",
    sc: 0.72,
    c1: "#fff0c2",
    c2: "#c28a1f",
    g: "255,215,110",
  },
  ach_genre_shonen: {
    achievementId: "ach_genre_shonen",
    code: "Клятва воина V — Рыцарь V",
    description: "Досмотреть 50 тайтлов в жанре сёнэн",
    shape: "shield",
    icon: "sword",
    sc: 0.7,
    c1: "#8dffb6",
    c2: "#0b8f4a",
    g: "50,230,130",
  },
  ach_genre_fantasy: {
    achievementId: "ach_genre_fantasy",
    code: "Звёздный странник VII — Пилигрим VII",
    description: "Посмотреть 30 тайтлов в жанре фантастики",
    shape: "diamond",
    icon: "planet",
    sc: 0.56,
    c1: "#b49cff",
    c2: "#4b2bd6",
    g: "140,110,255",
  },
  ach_secrets_all: {
    achievementId: "ach_secrets_all",
    code: "Врата ёкай VIII — Император VIII",
    description: "Собрать все скрытые достижения",
    shape: "star8",
    icon: "eye",
    sc: 0.66,
    c1: "#ff6a6a",
    c2: "#7a0610",
    g: "255,40,60",
    legend: true,
  },
  // ---- коллекция 03: легендарные ----
  ach_minutes_10000: {
    achievementId: "ach_minutes_10000",
    code: "Вечный зритель X — Бессмертный X",
    description: "Посмотреть 10 000 эпизодов",
    shape: "octagon",
    icon: "infinity",
    sc: 0.72,
    c1: "#fff0b8",
    c2: "#c28a1f",
    g: "255,210,100",
    tier: "ТИР I",
  },
  ach_streak_365: {
    achievementId: "ach_streak_365",
    code: "Пламя феникса IX — Возрождённый IX",
    description: "Заходить на сайт 365 дней подряд",
    shape: "vesica",
    icon: "flame",
    sc: 0.64,
    c1: "#ffb36b",
    c2: "#e03a0a",
    g: "255,110,40",
    tier: "ТИР I",
  },
  ach_seasons_all: {
    achievementId: "ach_seasons_all",
    code: "Хранитель врат IX — Привратник IX",
    description: "Пройти все сезонные события сайта",
    shape: "arch",
    icon: "key",
    sc: 0.64,
    c1: "#9dfcff",
    c2: "#0a7a8f",
    g: "60,230,255",
    tier: "ТИР I",
  },
  ach_night_500: {
    achievementId: "ach_night_500",
    code: "Лунная владычица X — Королева ночи X",
    description: "Посмотреть 500 серий ночью",
    shape: "star4",
    icon: "crescent",
    sc: 0.56,
    c1: "#e8e4ff",
    c2: "#6a5acd",
    g: "190,175,255",
    tier: "ТИР I",
  },
  ach_all_done: {
    achievementId: "ach_all_done",
    code: "Император аниме X — Абсолют X",
    description: "Получить все остальные достижения",
    shape: "star12",
    icon: "crown",
    sc: 0.68,
    c1: "#ffffff",
    c2: "#d4a017",
    g: "255,225,130",
    tier: "АБСОЛЮТ",
  },
};

export function medalOf(achievementId: string): MedalDef | undefined {
  return MEDALS[achievementId];
}

/* --------------------------------- Рисунок -------------------------------- */

export const MEDAL_CSS = `
.md{position:relative;display:block;width:100%;height:100%;overflow:visible}
.md svg{display:block;width:100%;height:100%;overflow:visible}
.md-ring{transform-box:view-box;transform-origin:48px 52px;animation:md-spin 28s linear infinite}
.md-spin{transform-box:fill-box;transform-origin:center;animation:md-spin 22s linear infinite}
.md-flame{transform-box:fill-box;transform-origin:center bottom;animation:md-flame 2.6s ease-in-out infinite}
.md-flame2{transform-box:fill-box;transform-origin:center bottom;animation:md-flame 1.8s ease-in-out infinite;animation-delay:-.4s}
.md-key{transform-box:fill-box;transform-origin:center;animation:md-key 4s ease-in-out infinite}
.md-gem{transform-box:fill-box;transform-origin:center;animation:md-gem 2.4s ease-in-out infinite}
.md-twinkle-slow{transform-box:fill-box;transform-origin:center;animation:md-twinkle 6s ease-in-out infinite}
.md-pupil{transform-box:fill-box;transform-origin:center;animation:md-pupil 4s ease-in-out infinite}
.md-sh{animation:md-sh 4.2s ease-in-out infinite}
.md-tw{transform-box:fill-box;transform-origin:center;animation:md-tw 2.8s ease-in-out infinite}
.md-dot{transform-box:fill-box;transform-origin:center;animation:md-dot 1.2s ease-in-out infinite}
.md-sway{transform-box:fill-box;transform-origin:center top;animation:md-sway 3.4s ease-in-out infinite}
.md-blink{transform-box:fill-box;transform-origin:center;animation:md-blink 4.6s ease-in-out infinite}
.md-glow{animation:md-glow 2.4s ease-in-out infinite}
.md-clash{transform-box:fill-box;transform-origin:center;animation:md-clash 3.2s ease-in-out infinite}
.md-glint{animation:md-glint 3.6s ease-in-out infinite}
.md-card:hover .md{animation:md-float 4s ease-in-out infinite}
@keyframes md-spin{to{transform:rotate(360deg)}}
@keyframes md-float{0%,100%{translate:0 0}50%{translate:0 -5px}}
@keyframes md-tw{0%,100%{opacity:.2;transform:scale(.4) rotate(0)}50%{opacity:1;transform:scale(1) rotate(45deg)}}
@keyframes md-twinkle{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}
@keyframes md-dot{0%,100%{transform:translateY(0);opacity:.35}40%{transform:translateY(-4px);opacity:1}}
@keyframes md-blink{0%,44%,50%,100%{transform:scaleY(1)}47%{transform:scaleY(.1)}}
@keyframes md-glow{0%,100%{opacity:.6}50%{opacity:1}}
@keyframes md-sway{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
@keyframes md-clash{0%,70%,100%{opacity:0;transform:scale(0)}80%{opacity:1;transform:scale(1.4) rotate(45deg)}92%{opacity:0;transform:scale(.4) rotate(90deg)}}
@keyframes md-glint{0%,55%,100%{opacity:0}70%{opacity:.95}85%{opacity:0}}
@keyframes md-flame{0%,100%{transform:scale(1,1) skewX(0)}30%{transform:scale(.94,1.08) skewX(2deg)}65%{transform:scale(1.04,.95) skewX(-2deg)}}
@keyframes md-gem{0%,100%{transform:scale(1);opacity:.7}50%{transform:scale(1.5);opacity:1}}
@keyframes md-key{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}
@keyframes md-pupil{0%,100%{transform:scaleX(1)}50%{transform:scaleX(.45)}}
@keyframes md-sh{0%,55%{transform:translateX(0)}100%{transform:translateX(180px)}}
@media (prefers-reduced-motion:reduce){.md *{animation:none!important}}
`;

/**
 * Медаль целиком: пунктирное кольцо, объёмная фигура, подложка, блик и
 * иконка.
 *
 * Идентификаторы градиентов берутся из `useId()`, а не из пропса: в SVG
 * ссылка `url(#id)` резолвится в ПЕРВЫЙ элемент с таким id во всём документе,
 * поэтому два градиента с одинаковым id красят друг друга. На странице всегда
 * несколько медалей, и индекс извне рано или поздно повторится — так что id
 * должен быть уникальным по построению, а не по договорённости.
 */
export function MedalArt({
  medal,
  size = 96,
  dimmed = false,
}: {
  medal: MedalDef;
  size?: number;
  /** Не получено — гасим цвет, но форму оставляем */
  dimmed?: boolean;
}) {
  // useId даёт «:r1:» или ««r1»» — в id SVG допустимы только буквы, цифры,
  // дефис и подчёркивание, поэтому выкидываем всё остальное
  const uid = `md${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const S = SHAPES[medal.shape];
  const outer = S.outline(1);
  const inner = S.outline(S.inner);
  const clipInner = S.outline(S.inner);
  const icon = ICONS[medal.icon]();
  const vars = { "--md-g": medal.g } as CSSProperties;

  return (
    <span className="md" style={{ ...vars, width: size, height: (size * 104) / 96 }}>
      <style>{MEDAL_CSS}</style>
      <svg viewBox="0 0 96 104" fill="none" aria-hidden style={dimmed ? { opacity: 0.32, filter: "grayscale(.55)" } : undefined}>
        <defs>
          <linearGradient id={`${uid}f`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={medal.c1} />
            <stop offset=".55" stopColor={medal.c2} />
            <stop offset="1" stopColor="#0b0a14" />
          </linearGradient>
          <radialGradient id={`${uid}g`} cx=".5" cy=".35" r=".8">
            <stop offset="0" stopColor={medal.c2} stopOpacity=".6" />
            <stop offset="1" stopColor="#07060f" />
          </radialGradient>
          <linearGradient id={`${uid}h`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset=".5" stopColor="#fff" stopOpacity=".55" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`${uid}c`}>
            <g dangerouslySetInnerHTML={{ __html: clipInner }} />
          </clipPath>
        </defs>

        {/* пунктирное кольцо-шестерёнка, медленно крутится */}
        <g className="md-ring" dangerouslySetInnerHTML={{ __html: dashedRingHtml(medal.shape, medal.c1) }} />

        {/* корпус и подложка */}
        <g dangerouslySetInnerHTML={{ __html: outer.replace(/^<(\w+)/, `<$1 fill="url(#${uid}f)" stroke-linejoin="round" transform="${T(1)}"`) }} />
        <g
          dangerouslySetInnerHTML={{
            __html: inner.replace(
              /^<(\w+)/,
              `<$1 fill="url(#${uid}g)" stroke="rgba(255,255,255,.4)" stroke-width="1.2" stroke-linejoin="round" transform="${T(S.inner)}"`,
            ),
          }}
        />

        {/* блик, обрезанный по подложке */}
        <g clipPath={`url(#${uid}c)`}>
          <ellipse cx="48" cy="30" rx="30" ry="16" fill="#fff" opacity=".1" />
          <g transform="rotate(20 48 52)">
            <rect className="md-sh" x="-40" y="0" width="26" height="110" fill={`url(#${uid}h)`} />
          </g>
        </g>

        {/* иконка */}
        <g transform={`translate(${48 - 32 * medal.sc} ${52 - 32 * medal.sc}) scale(${medal.sc})`}>{icon}</g>
      </svg>
    </span>
  );
}

/** Кольцо из макета: тот же контур, что у фигуры, но штриховой и крупнее */
function dashedRingHtml(shape: MedalShape, color: string): string {
  const S = SHAPES[shape];
  return S.outline(1).replace(
    /^<(\w+)/,
    `<$1 fill="none" stroke="${color}" stroke-opacity=".55" stroke-width="1" stroke-dasharray="3 5" stroke-linecap="round" transform="${T(1.09)}"`,
  );
}

/** Отдельный кольцевой слой — используется в превью-галерее */
export function MedalRing({ medal }: { medal: MedalDef }) {
  return (
    <g
      className="md-ring"
      dangerouslySetInnerHTML={{ __html: dashedRingHtml(medal.shape, medal.c1) }}
    />
  );
}