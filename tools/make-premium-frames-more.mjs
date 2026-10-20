/*
 * Генератор рамок из макета «Ещё рамки профиля.html»
 *
 * Код перенесён 1:1: фигуры `T`, ряды `ROWS`, функция `wreath` и весь блок
 * `@keyframes` скопированы без единой правки. Меняется только обёртка —
 * вместо страницы-заглушки получается самостоятельный SVG.
 *
 * Почему статичный .svg, а не React-компонент: каждая рамка в проекте —
 * файл в `public/frames/`, и `AvatarView` подставляет его одним `<img>`.
 * CSS-анимации внутри SVG, подключённого через `<img>`, работают (документ
 * изолирован, внешние ресурсы — нет), а `@keyframes` оттуда не попадают в
 * таблицу стилей сайта и не могут столкнуться с `hd-*` из шапки. Контракт
 * `FrameItem.img` остаётся прежним.
 *
 * viewBox 240×240 — как в макете: центры всех фигур завязаны на (120,120).
 */

import { writeFileSync, mkdirSync } from "node:fs";

const OUT_DIR = "C:/Users/WHITE POWER/anime-hub/public/frames";

/* ------------------------------------------------------------------ */
/* Код макета — 1:1, без изменений                                     */
/* ------------------------------------------------------------------ */

var T = {
  feather: { d: "M0,0C9,-5 14,-20 5,-41C3,-47 -3,-47 -5,-41C-14,-20 -9,-5 0,0Z", v: "M0,-3L0,-40M0,-12L7,-19M0,-12L-7,-19M0,-20L8,-28M0,-20L-8,-28M0,-28L6,-35M0,-28L-6,-35" },
  laurel: { d: "M0,0C9,-9 9,-27 0,-40C-9,-27 -9,-9 0,0Z", v: "M0,-3L0,-37M0,-14L5,-20M0,-14L-5,-20M0,-24L4,-29M0,-24L-4,-29" },
};
var ROWS = [{ R: 76, tilt: 36, s: 1.2 }, { R: 68, tilt: 14, s: 1.05 }, { R: 60, tilt: -10, s: 0.78 }];

function wreath(id, P, type) {
  var L = T[type], s = '<defs><linearGradient id="' + id + '" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="' + P[0] + '"/><stop offset=".55" stop-color="' + P[1] + '"/><stop offset="1" stop-color="' + P[2] + '"/></linearGradient>'
    + '<radialGradient id="' + id + 'g"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="' + P[1] + '" stop-opacity="0"/></radialGradient></defs>';
  s += '<circle cx="120" cy="120" r="66" fill="none" stroke="' + P[2] + '" stroke-opacity=".4" stroke-width="1"/>';
  var N = 11;
  ROWS.forEach(function (r, ri) {
    for (var side = -1; side <= 1; side += 2) {
      for (var i = 0; i < N; i++) {
        var phi = side * (8 + i * 14.2 + ri * 3), k = 1 - i / (N * 1.45), sc = (r.s * k).toFixed(2);
        var rot = -side * (90 + r.tilt), d = (i * 0.14 + ri * 0.2 + (side > 0 ? 0.07 : 0)).toFixed(2);
        s += '<g transform="rotate(' + phi.toFixed(1) + ' 120 120) translate(120 ' + (120 + r.R) + ') rotate(' + rot + ') scale(' + sc + ')">'
          + '<path class="f" d="' + L.d + '" fill="url(#' + id + ')" stroke="' + P[2] + '" stroke-opacity=".9" stroke-width=".8" style="animation-delay:' + d + 's"/>'
          + '<path d="' + L.v + '" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width=".6" stroke-linecap="round"/>'
          + '<path class="shine" d="' + L.d + '" fill="#fff" fill-opacity=".35" style="animation-delay:' + d + 's"/></g>';
      }
    }
  });
  s += '<circle class="run" cx="120" cy="120" r="64" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="46 360" opacity=".8"/>';
  s += '<g class="spin rev">';
  for (var i = 0; i < 18; i++) { var t = i / 18 * 6.283, rr = 104 + (i % 3) * 5;
    s += '<circle class="tw" cx="' + (120 + rr * Math.cos(t)).toFixed(1) + '" cy="' + (120 + rr * Math.sin(t)).toFixed(1) + '" r="' + (1 + (i % 3) * 0.5) + '" fill="' + P[2] + '" style="animation-delay:' + (i * 0.41 % 2.6).toFixed(2) + 's"/>'; }
  s += '</g>';
  s += '<circle cx="120" cy="206" r="16" fill="url(#' + id + 'g)" class="gem" opacity=".6"/><path class="gem" d="M120 193l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" fill="#fff"/>';
  s += '<path class="gem" d="M120 36l2.4 6 6 2.4-6 2.4-2.4 6-2.4-6-6-2.4 6-2.4z" fill="' + P[2] + '" style="animation-delay:.8s"/>';
  return s;
}

/* ------------------------------------------------------------------ */
/* Стили — из макета как есть                                          */
/* ------------------------------------------------------------------ */

const STYLE = [
  /* Внешнего свечения нет: группа .art занимает почти весь холст, её
     drop-shadow упирался в границы viewBox, и файл, отрисованный через
     <img>, обрезался по рамке — свечение выходило квадратом. */
  ".art{}",
  ".f{animation:wave 3.4s ease-in-out infinite}",
  "@keyframes wave{0%,100%{opacity:.78}40%{opacity:1}}",
  ".shine{animation:shine 3.4s ease-in-out infinite}",
  "@keyframes shine{0%,100%{opacity:0}40%{opacity:.85}}",
  ".spin{transform-origin:120px 120px;animation:rot 28s linear infinite}",
  ".spin.rev{animation-direction:reverse;animation-duration:40s}",
  "@keyframes rot{to{transform:rotate(360deg)}}",
  ".tw{animation:tw 2.6s ease-in-out infinite;transform-box:fill-box;transform-origin:center}",
  "@keyframes tw{0%,100%{opacity:.15;transform:scale(.4)}50%{opacity:1;transform:scale(1.3)}}",
  ".run{animation:run 5s linear infinite}",
  "@keyframes run{to{transform:rotate(360deg)}}",
  ".run{transform-origin:120px 120px}",
  ".gem{animation:gem 2.2s ease-in-out infinite;transform-box:fill-box;transform-origin:center}",
  "@keyframes gem{50%{transform:scale(1.25);opacity:.8}}",
  "@media (prefers-reduced-motion:reduce){*{animation:none!important}}",
].join("");

/* ------------------------------------------------------------------ */
/* Список рамок — из макета как есть                                   */
/* ------------------------------------------------------------------ */

const F = [
  { n: "Рубиновый лавр", g: "#ff4f6a", type: "laurel", p: ["#7a0f2a", "#ff5c7a", "#ffe1e8"] },
  { n: "Сапфировая ночь", g: "#5b8bff", type: "feather", p: ["#101f6e", "#4f7cff", "#e6eeff"] },
  { n: "Аметист", g: "#c05bff", type: "feather", p: ["#3a0f7a", "#b565ff", "#f6e6ff"] },
  { n: "Платина", g: "#cfd8ff", type: "feather", p: ["#5c6585", "#b8c2e6", "#ffffff"] },
  { n: "Бирюзовый лавр", g: "#2fe3d0", type: "laurel", p: ["#06645e", "#2fd9c6", "#e0fffb"] },
  { n: "Закат", g: "#ff8a4f", type: "feather", p: ["#b0204f", "#ff7f5a", "#fff0d0"] },
  { n: "Обсидиан", g: "#ffcf6a", type: "laurel", p: ["#14101f", "#5b4a7a", "#ffd978"] },
  { n: "Королевский пурпур", g: "#ffc857", type: "laurel", p: ["#4a1a8a", "#8a52e0", "#ffe08a"] },
];

/* Латинские id — по правилам проекта без кириллицы в путях. */
const SLUG = {
  "Рубиновый лавр": "ruby-laurel",
  "Сапфировая ночь": "sapphire-night",
  Аметист: "amethyst",
  Платина: "platinum",
  "Бирюзовый лавр": "turquoise-laurel",
  Закат: "sunset",
  Обсидиан: "obsidian",
  "Королевский пурпур": "royal-purple",
};

/* ------------------------------------------------------------------ */

mkdirSync(OUT_DIR, { recursive: true });

F.forEach(function (f, i) {
  const slug = SLUG[f.n];
  if (!slug) { console.error("нет slug для «" + f.n + "»"); process.exit(1); }
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240" style="--g:' + f.g +
    '" aria-hidden="true"><style>' +
    STYLE +
    "</style>" +
    /* свечение вешаем на рисунок, а не на весь холст картинки */
    '<g class="art">' +
    wreath("w" + i, f.p, f.type) +
    "</g></svg>";
  writeFileSync(OUT_DIR + "/frame-" + slug + ".svg", svg, "utf8");
  console.log("записан frame-" + slug + ".svg  (" + svg.length + " байт)  " + f.n);
});
