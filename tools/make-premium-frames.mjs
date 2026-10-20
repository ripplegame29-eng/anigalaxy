/*
 * Генератор премиум-рамок из `Премиум-рамки профиля.html`
 *
 * Код прототипа перенесён 1:1: функции `wreath`, `sparks`, `petals`,
 * `dash` и правило `--g` скопированы без единой правки — меняется только
 * обёртка (вместо страницы-заглушки получается самостоятельный SVG) и
 * вызываются те четыре рамки, которые заказаны.
 *
 * Почему статичный .svg, а не React-компонент:
 * каждая рамка в проекте — файл в `public/frames/`, и `AvatarView`
 * подставляет его одним `<img>`. CSS-анимации внутри SVG, подключённого
 * через `<img>`, работают (документ изолирован, внешние ресурсы — нет),
 * а `@keyframes` из такого файла не попадают в таблицу стилей сайта и не
 * могут столкнуться с `hd-*` из шапки. Так контракт `FrameItem.img`
 * остаётся прежним, и править 13 мест вывода не нужно.
 *
 * Стили блока взяты из прототипа как есть: `.frame svg`, `.lf`, `.spin`,
 * `.tw`, `.sweep` и их `@keyframes`.
 */

import { writeFileSync, mkdirSync } from "node:fs";

const OUT_DIR = "C:/Users/WHITE POWER/anime-hub/public/frames";

/* ------------------------------------------------------------------ */
/* Код прототипа — 1:1, без изменений                                   */
/* ------------------------------------------------------------------ */

var LEAF = "M0,0C7,-9 7,-24 0,-34C-7,-24 -7,-9 0,0Z";

function wreath(id, a, b, n) {
  var s =
    '<defs><linearGradient id="' + id + '" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="' +
    a + '"/><stop offset="1" stop-color="' + b + '"/></linearGradient></defs>';
  for (var side = -1; side <= 1; side += 2) {
    for (var i = 0; i < n; i++) {
      var phi = side * (6 + i * (150 / n)), k = 1 - i / (n * 1.25);
      for (var j = 0; j < 2; j++) {
        var tilt = j ? 38 : 12, sc = (j ? 0.8 : 1) * k * 1.05, d = (i * 0.13 + j * 0.07 + (side > 0 ? 0.05 : 0)).toFixed(2);
        var rot = side > 0 ? 90 - tilt : -90 + tilt;
        s += '<g transform="rotate(' + phi + ' 100 100) translate(100 ' + (166 - j * 9) + ') rotate(' + rot + ') scale(' + sc.toFixed(2) + ')"><path class="lf" d="' + LEAF + '" fill="url(#' + id + ')" stroke="' + b + '" stroke-width=".7" style="animation-delay:' + d + 's"/></g>';
      }
    }
  }
  s += '<path class="tw" d="M100 176l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="' + b + '"/>';
  return s;
}

function sparks(c, n, r) {
  var s = '<g class="spin rev">';
  for (var i = 0; i < n; i++) {
    var t = (i / n) * 6.283, x = 100 + r * Math.cos(t), y = 100 + r * Math.sin(t);
    s += '<circle class="tw" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (1.2 + (i % 3) * 0.6) + '" fill="' + c + '" style="animation-delay:' + ((i * 0.37) % 2.4).toFixed(2) + 's"/>';
  }
  return s + "</g>";
}

function petals(id, a, b) {
  var s =
    '<defs><radialGradient id="' + id + '" cx=".5" cy="1" r="1"><stop offset="0" stop-color="' + a +
    '"/><stop offset="1" stop-color="' + b + '"/></radialGradient></defs><g class="spin">';
  for (var i = 0; i < 12; i++)
    s += '<g transform="rotate(' + i * 30 + ' 100 100) translate(100 20)"><path class="lf" d="M0,0C9,8 9,22 0,30C-9,22 -9,8 0,0Z" fill="url(#' + id + ')" stroke="' + b + '" stroke-width=".6" style="animation-delay:' + (i * 0.2).toFixed(1) + 's"/></g>';
  return s + '</g><circle cx="100" cy="100" r="58" fill="none" stroke="' + a + '" stroke-width="1" opacity=".6"/>' + sparks(a, 10, 84);
}

function dash(a, b, id) {
  return (
    '<defs><linearGradient id="' + id + '"><stop offset="0" stop-color="' + a +
    '"/><stop offset="1" stop-color="' + b + '"/></linearGradient></defs><circle cx="100" cy="100" r="62" fill="none" stroke="url(#' + id +
    ')" stroke-width="3"/><circle class="sweep" cx="100" cy="100" r="68" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-dasharray="40 390" opacity=".9"/>'
  );
}

/* ------------------------------------------------------------------ */
/* Стили — из прототипа как есть                                        */
/* ------------------------------------------------------------------ */

const STYLE = [
  /* Внешнего свечения нет: см. make-premium-frames-more.mjs — drop-shadow на
     группе .art обрезался границами viewBox и давал квадрат. */
  ".art{}",
  ".lf{animation:wave 3.2s ease-in-out infinite;transform-box:fill-box}",
  "@keyframes wave{0%,100%{opacity:.72}45%{opacity:1;filter:brightness(1.5)}}",
  ".spin{transform-origin:100px 100px;animation:rot 24s linear infinite}",
  ".spin.rev{animation-direction:reverse;animation-duration:30s}",
  "@keyframes rot{to{transform:rotate(360deg)}}",
  ".tw{animation:tw 2.4s ease-in-out infinite;transform-box:fill-box;transform-origin:center}",
  "@keyframes tw{0%,100%{opacity:.2;transform:scale(.5)}50%{opacity:1;transform:scale(1.3)}}",
  ".sweep{animation:sw 3.6s ease-in-out infinite}",
  "@keyframes sw{0%{stroke-dashoffset:0}100%{stroke-dashoffset:-460}}",
  "@media (prefers-reduced-motion:reduce){*{animation:none!important}}",
].join("");

/* ------------------------------------------------------------------ */
/* Сборка файлов                                                       */
/* ------------------------------------------------------------------ */

/* Четыре заказанные рамки. Кристалл и Неоновая орбита из прототипа
   не добавляем — их не было в задании. Порядок и вызовы — как в F. */
const FRAMES = [
  { file: "frame-lunar-feather.svg", g: "#b7a4ff", body: wreath("g1", "#8f7de0", "#f1ecff", 11) + sparks("#e8e0ff", 14, 92) },
  { file: "frame-golden-laurel.svg", g: "#ffc857", body: wreath("g2", "#b8741a", "#fff0b8", 12) + dash("#ffd978", "#b8741a", "d2") + sparks("#ffe9a8", 12, 94) },
  { file: "frame-emerald-laurel.svg", g: "#5df2b0", body: wreath("g5", "#0f8a62", "#d6ffe9", 11) + dash("#9dffd4", "#0f8a62", "d5") },
  { file: "frame-sakura.svg", g: "#ff8fb8", body: petals("g3", "#ffd1e3", "#ff6fa3") },
];

mkdirSync(OUT_DIR, { recursive: true });

for (const f of FRAMES) {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200" style="--g:' +
    f.g + '" aria-hidden="true"><style>' +
    STYLE +
    "</style>" +
    /* свечение вешаем на рисунок, а не на весь холст картинки */
    '<g class="art">' +
    f.body +
    "</g></svg>";
  writeFileSync(OUT_DIR + "/" + f.file, svg, "utf8");
  console.log("записан " + f.file + "  (" + svg.length + " байт)");
}
