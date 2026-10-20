/*
 * Генератор рамок из макета «Рамки профиля: варианты.html»
 *
 * Код перенесён 1:1: функции `D`, `star`, `sparks`, `ring`, `seraph`,
 * `flame`, `seal`, `moths`, константы `FE`/`FV` и весь блок `@keyframes`
 * скопированы без единой правки. Меняется только обёртка.
 *
 * Особенность: в `moths` используется SMIL `<animateTransform>`. Он
 * работает в SVG, подключённом через `<img>`, — проверено в браузере.
 *
 * viewBox 240×240 — центры фигур завязаны на (120,120), как в макете.
 */

import { writeFileSync, mkdirSync } from "node:fs";

const OUT_DIR = "C:/Users/WHITE POWER/anime-hub/public/frames";

/* ------------------------------------------------------------------ */
/* Код макета — 1:1, без изменений                                     */
/* ------------------------------------------------------------------ */

function D(id, P) { return '<defs><linearGradient id="' + id + '" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="' + P[0] + '"/><stop offset=".55" stop-color="' + P[1] + '"/><stop offset="1" stop-color="' + P[2] + '"/></linearGradient></defs>' }
function star(x, y, s, c, d) { return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><path class="tw" fill="' + c + '" style="animation-delay:' + d + 's" d="M0-6L1.6-1.6L6 0L1.6 1.6L0 6L-1.6 1.6L-6 0L-1.6-1.6Z"/></g>' }
function sparks(c, n, r) { var s = '<g class="spin rev">'; for (var i = 0; i < n; i++) { var t = i / n * 6.283, rr = r + (i % 3) * 5; s += '<circle class="tw" cx="' + (120 + rr * Math.cos(t)).toFixed(1) + '" cy="' + (120 + rr * Math.sin(t)).toFixed(1) + '" r="' + (1 + (i % 3) * 0.5) + '" fill="' + c + '" style="animation-delay:' + (i * 0.41 % 2.6).toFixed(2) + 's"/>' } return s + '</g>' }
function ring(c, r, dash) { return '<circle cx="120" cy="120" r="' + r + '" fill="none" stroke="' + c + '" stroke-opacity=".5"/><circle class="run" cx="120" cy="120" r="' + r + '" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="' + (dash || '46 360') + '" opacity=".8"/>' }
var FE = 'M0,0C7,-4 11,-16 4,-34C2,-38 -2,-38 -4,-34C-11,-16 -7,-4 0,0Z', FV = 'M0,-3L0,-32M0,-12L5,-18M0,-12L-5,-18M0,-21L5,-27M0,-21L-5,-27';

function seraph(id, P, o) {
  function wing() { var s = '<g class="flap" style="transform-origin:62px 130px">';
    [0, 1, 2].slice(0, o.rows).forEach(function (L) { for (var i = 0; i < 10; i++) {
      var a = [-100, -90, -82][L] + i * [10.5, 9, 7.5][L], sc = [2.2, 1.4, 0.85][L] - i * [0.1, 0.07, 0.04][L], px = [60, 68, 74][L], py = [128, 136, 142][L], d = (i * 0.15 + L * 0.3).toFixed(2);
      s += '<g transform="translate(' + px + ' ' + py + ') rotate(' + a + ') scale(' + (sc * o.w).toFixed(2) + ' ' + sc.toFixed(2) + ')"><path class="f" d="' + FE + '" fill="url(#' + id + ')" stroke="' + P[2] + '" stroke-opacity=".9" stroke-width=".7" style="animation-delay:' + d + 's"/><path d="' + FV + '" stroke="#fff" stroke-opacity=".5" stroke-width=".5" fill="none"/><path class="shine" d="' + FE + '" fill="#fff" fill-opacity=".35" style="animation-delay:' + d + 's"/></g>'
    } });
    return s + '</g>' }
  var halo = o.crown ? '<path d="M96 40L100 22L110 32L120 16L130 32L140 22L144 40Z" fill="none" stroke="' + P[2] + '" stroke-width="2" stroke-linejoin="round" class="pulse"/>'
    : '<ellipse class="pulse" cx="120" cy="34" rx="28" ry="7" fill="none" stroke="' + (o.hc || P[2]) + '" stroke-width="2.5" stroke-dasharray="' + (o.dash || 'none') + '"/><ellipse cx="120" cy="34" rx="28" ry="7" fill="none" stroke="#fff" stroke-width="1" opacity=".8" stroke-dasharray="' + (o.dash || 'none') + '"/>';
  /* Рисунок серафима шире холста: крылья выходят за 240 единиц, и карточка
     режет их по краям. Сжимаем весь рисунок к центру — крылья, кольцо, нимб
     и искры вместе, но после <defs>, чтобы градиенты не трогать. После
     этого холст снова ровно 240×240 и ничего не вылезает. */
  return D(id, P) +
    '<g transform="translate(120 120) scale(0.8) translate(-120 -120)">' +
    '<g>' + wing() + '</g><g transform="translate(240 0) scale(-1 1)">' + wing() + '</g>' + ring(P[2], 64) + halo + sparks(P[2], 16, 108) + star(120, 206, 1.6, '#fff', 0) +
    '</g>';
}
function flame(id, P, o) {
  var s = D(id, P) + '<circle cx="120" cy="120" r="64" fill="none" stroke="' + P[1] + '" stroke-width="2" opacity=".8"/>';
  var FL = 'M0,0C10,-6 13,-20 2,-44C1,-33 -5,-29 -8,-20C-11,-10 -6,-4 0,0Z', n = o.n, st = 360 / n;
  for (var k = 0; k < n; k++) s += '<g transform="rotate(' + k * st + ' 120 120) translate(120 58) scale(' + o.s + ')"><path class="fl" d="' + FL + '" fill="url(#' + id + ')" style="animation-delay:' + (k * 0.17 % 1.3).toFixed(2) + 's"/></g>';
  for (var k = 0; k < n; k++) s += '<g transform="rotate(' + (k * st + st / 2) + ' 120 120) translate(120 60) scale(' + (o.s * 0.64).toFixed(2) + ')"><path class="fl" d="' + FL + '" fill="' + P[2] + '" opacity=".85" style="animation-delay:' + (k * 0.23 % 1.3).toFixed(2) + 's"/></g>';
  if (o.inner) s += '<g class="spin fast"><circle cx="120" cy="120" r="58" fill="none" stroke="' + P[2] + '" stroke-width="1" stroke-dasharray="2 6" opacity=".8"/></g>';
  return s + sparks(P[2], o.sp || 20, 100);
}
function seal(id, P, o) {
  function tri(r, rot, n) { var p = []; for (var i = 0; i < n; i++) { var t = (rot + i * 360 / n - 90) * Math.PI / 180; p.push((120 + r * Math.cos(t)).toFixed(1) + ',' + (120 + r * Math.sin(t)).toFixed(1)) } return '<polygon points="' + p.join(' ') + '" fill="none" stroke="' + P[1] + '" stroke-width="1.2" stroke-linejoin="round"/>' }
  var G = ['M0-4V4M-3-1L0-4L3-1', 'M-3-4L3 4M3-4L-3 4', 'M-3-4V4M3-4V4M-3 0H3'], s = D(id, P) + ring(P[2], 62, '30 360')
    + '<circle cx="120" cy="120" r="70" fill="none" stroke="' + P[1] + '" stroke-width="1" stroke-dasharray="3 5"/><circle cx="120" cy="120" r="94" fill="none" stroke="' + P[1] + '" stroke-opacity=".6"/>';
  if (o.rays) { s += '<g class="spin fast">'; for (var i = 0; i < 16; i++) s += '<path d="M120 12L123 26H117Z" fill="' + P[2] + '" opacity=".9" transform="rotate(' + i * 22.5 + ' 120 120)"/>'; s += '</g>' }
  s += '<g class="spin fast">' + (o.sq ? tri(80, 0, 4) + tri(80, 45, 4) : tri(80, 0, 3) + tri(80, 180, 3)) + '</g><g class="spin rev">';
  for (var i = 0; i < 24; i++) s += '<g transform="rotate(' + i * 15 + ' 120 120) translate(120 33)"><path d="' + G[i % 3] + '" fill="none" stroke="' + P[2] + '" stroke-width="1.4" stroke-linecap="round" class="pulse" style="animation-delay:' + (i * 0.13).toFixed(2) + 's"/></g>';
  return s + '</g>' + sparks(P[2], 10, 108) + star(120, 214, 1.4, '#fff', 0.3);
}
function moths(id, P, o) {
  var s = D(id, P) + ring(P[2], 64, '40 362') + '<g class="spin ' + (o.fast || 'fast') + '">', n = o.n;
  for (var k = 0; k < n; k++) {
    s += '<g transform="rotate(' + k * 360 / n + ' 120 120) translate(120 22) scale(' + o.s + ')"><g><animateTransform attributeName="transform" type="scale" values="1 1;.3 1;1 1" dur="' + o.dur + 's" begin="' + (k * 0.2) + 's" repeatCount="indefinite"/>'
      + '<path d="M0 0C-16-16-26-4-16 4C-22 10-10 18 0 5Z" fill="url(#' + id + ')" stroke="' + P[2] + '" stroke-width=".8"/><path d="M0 0C16-16 26-4 16 4C22 10 10 18 0 5Z" fill="url(#' + id + ')" stroke="' + P[2] + '" stroke-width=".8"/>'
      + (o.tail ? '<path d="M-8 6L-12 18M8 6L12 18" stroke="' + P[2] + '" stroke-width=".9" fill="none"/>' : '')
      + '<path d="M-9-5L-3 0M9-5L3 0" stroke="#fff" stroke-opacity=".6" stroke-width=".7"/></g><ellipse cx="0" cy="4" rx="1.3" ry="6" fill="#fff"/></g>';
  }
  return s + '</g>' + sparks(P[2], 22, 102) + star(120, 208, 1.4, '#fff', 0);
}

/* ------------------------------------------------------------------ */
/* Стили — из макета как есть                                          */
/* ------------------------------------------------------------------ */

const STYLE = [
  /* Внешнего свечения нет: см. make-premium-frames-more.mjs — drop-shadow на
     группе .art обрезался границами viewBox и давал квадрат. */
  ".art{}",
  ".f{animation:wave 3.4s ease-in-out infinite}",
  "@keyframes wave{0%,100%{opacity:.8}40%{opacity:1}}",
  ".shine{animation:shine 3.4s ease-in-out infinite}",
  "@keyframes shine{0%,100%{opacity:0}40%{opacity:.8}}",
  ".spin{transform-origin:120px 120px;animation:rot 28s linear infinite}",
  ".spin.rev{animation-direction:reverse;animation-duration:40s}",
  ".spin.fast{animation-duration:14s}",
  "@keyframes rot{to{transform:rotate(360deg)}}",
  ".tw{animation:tw 2.6s ease-in-out infinite;transform-box:fill-box;transform-origin:center}",
  "@keyframes tw{0%,100%{opacity:.15;transform:scale(.4)}50%{opacity:1;transform:scale(1.3)}}",
  ".run{transform-origin:120px 120px;animation:rot 5s linear infinite}",
  ".flap{animation:flap 3.6s ease-in-out infinite}",
  "@keyframes flap{0%,100%{transform:rotate(0)}50%{transform:rotate(-5deg)}}",
  ".fl{transform-box:fill-box;transform-origin:50% 100%;animation:fl 1.3s ease-in-out infinite}",
  "@keyframes fl{0%,100%{transform:scale(1,1)}50%{transform:scale(.86,1.2)}}",
  ".pulse{animation:pl 3s ease-in-out infinite}",
  "@keyframes pl{0%,100%{opacity:.55}50%{opacity:1}}",
  "@media (prefers-reduced-motion:reduce){*{animation:none!important}}",
].join("");

/* ------------------------------------------------------------------ */
/* Список рамок — из макета как есть                                   */
/* ------------------------------------------------------------------ */

/* Крылья серафима длиннее холста 240×240: в макете у svg стоял
 * overflow:visible, и перья вылезали наружу. У файла, открытого через <img>,
 * холст всегда обрезает рисунок, поэтому у серафимов он шире.
 *
 * Запас 46, а не ровно по габаритам пера: капать надо ещё и на подсветку
 * (drop-shadow до 16 единиц). Без запаса перья упирались в край холста и
 * читались как срезанные по вертикали. */
const F = [
  { n: "Синее пламя", g: "#4f8bff", h: flame, p: ["#10208a", "#3a8bff", "#bfeaff"], o: { n: 18, s: 1.1, inner: 1 } },
  { n: "Призрачный огонь", g: "#5dffa8", h: flame, p: ["#06503a", "#2fe08a", "#e6ffe0"], o: { n: 24, s: 0.9, sp: 30 } },
  { n: "Золотая печать", g: "#ffc857", h: seal, p: ["#8a5210", "#f3c14e", "#fff3c4"], o: { rays: 1, sq: 1 } },
  { n: "Багровая печать", g: "#ff4f5f", h: seal, p: ["#6a0a1a", "#ff4f5f", "#ffd6da"], o: {} },
  { n: "Золотые бабочки", g: "#ffc857", h: moths, p: ["#a8620f", "#f6c35a", "#fff6d6"], o: { n: 4, s: 1.15, dur: 0.9, tail: 1 } },
  { n: "Лунные мотыльки", g: "#bcd4ff", h: moths, p: ["#4a5a9a", "#bcd0ff", "#ffffff"], o: { n: 5, s: 0.9, dur: 0.55, fast: "rev" } },
];

/* Латинские id — по правилам проекта без кириллицы в путях. */
const SLUG = {
  "Синее пламя": "blue-flame",
  "Призрачный огонь": "ghost-flame",
  "Золотая печать": "golden-seal",
  "Багровая печать": "crimson-seal",
  "Золотые бабочки": "golden-moths",
  "Лунные мотыльки": "lunar-moths",
};

/* ------------------------------------------------------------------ */

mkdirSync(OUT_DIR, { recursive: true });

F.forEach(function (f, i) {
  const slug = SLUG[f.n];
  if (!slug) { console.error("нет slug для «" + f.n + "»"); process.exit(1); }
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + (f.vb || "0 0 240 240") + '" width="240" height="240" style="--g:' + f.g +
    '" aria-hidden="true"><style>' +
    STYLE +
    "</style>" +
    /* свечение вешаем на рисунок, а не на весь холст картинки */
    '<g class="art">' +
    f.h("w" + i, f.p, f.o) +
    "</g></svg>";
  writeFileSync(OUT_DIR + "/frame-" + slug + ".svg", svg, "utf8");
  console.log("записан frame-" + slug + ".svg  (" + svg.length + " байт)  " + f.n);
});
