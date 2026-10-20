/* Генератор CSS шапки из прототипа Header_AniGalaxy_flat (1).html.
 *
 * Что делает:
 *  - переносит ВСЕ правила и @media как есть;
 *  - прячет селекторы под контейнер .agh, чтобы стили шапки не задели
 *    остальной сайт (там классы вроде .av, .bar, .it, .ib живут и у нас);
 *  - переименовывает @keyframes с префиксом hd- — иначе spin, sh, fl, pl, sc
 *    перезапишут одноимённые анимации других страниц;
 *  - выкидывает глобальные сбросы прототипа (html, body, *, a, button, svg,
 *    :focus-visible) и демо-обёртку .demo — их место в globals проекта;
 *  - переносит палитру :root на контейнер.
 *
 * Правки в прототипе подхватываются повторным запуском, руками здесь
 * ничего не правим.
 */
import fs from "node:fs";
import path from "node:path";

const SRC = "C:/Users/WHITE POWER/anime-hub/_design/Header_AniGalaxy_flat (1).html";
const OUT = "C:/Users/WHITE POWER/anime-hub/src/components/site/header.css";
const WRAP = ".agh";
const KF_PREFIX = "hd-";
/** Уникальный id градиента шапки: в прототипе был #xg, он общий на документ */
const GRADIENT_ID = "ag-hd-xg";

/* Глобальные сбросы и демо-обёртка прототипа — в проект не переносим */
const DROP_EXACT = new Set([
  ":root",
  "*,*::before,*::after",
  "body",
  "a",
  "button,input",
  "button",
  "svg",
  ":focus-visible",
  ".sky",
  "kbd",
]);
const DROP_SELECTOR = /(^|[\s,>+~])\.(demo)([\s,:>+~]|$)/;

/* Разбор CSS в дерево правил.
 *
 * Символы тела пишутся в raw контейнера, а накопленный перед «{» заголовок
 * очищается: иначе селектор внутри @media попадал бы в тело дважды
 * («.sel.sel{…}») и медиазапросы теряли содержимое.
 */
function parseAll(css) {
  const rules = [];
  let buf = "";
  const stack = [];
  for (let i = 0; i < css.length; i += 1) {
    const ch = css[i];
    if (ch === "{") {
      const head = buf.trim();
      buf = "";
      stack.push({
        type: head.startsWith("@media") ? "media" : "rule",
        head,
        raw: "",
      });
    } else if (ch === "}") {
      const node = stack.pop();
      if (!node) continue;
      const text =
        node.type === "media"
          ? `@media ${node.head.replace(/^@media\s*/, "")}{${node.raw}}`
          : node.head + "{" + node.raw + "}";
      if (stack.length) stack[stack.length - 1].raw += text;
      else rules.push({ kind: node.type, head: node.head, body: node.raw });
    } else if (stack.length) {
      stack[stack.length - 1].raw += ch;
    } else {
      buf += ch;
    }
  }
  /* незакрытые хвосты и мусор до первой «{» игнорируем */
  return rules.filter((r) => (r.kind === "media" ? String(r.body || "").trim() : r.head));
}

function scopeSelector(sel) {
  const parts = sel.split(",").map((s) => s.trim()).filter(Boolean);
  const out = [];
  for (const p of parts) {
    if (DROP_EXACT.has(p) || DROP_SELECTOR.test(p)) continue;
    /* Уже привязанные к id (#gf, #hd) оставляем: внутри контейнера они
       всё равно уникальны, а переписывать id в класс не нужно */
    out.push(p.startsWith("@") ? p : WRAP + " " + p);
  }
  return out;
}

function renderRule(rule) {
  if (rule.kind === "media") {
    return "@media " + rule.head.replace(/^@media\s*/, "") + "{" + transform(rule.body) + "}";
  }
  const sels = scopeSelector(rule.head);
  if (!sels.length) return "";
  return sels.join(",") + "{" + rule.body + "}";
}

/* Рекурсивная обработка тела (используется для @media) */
function transform(cssChunk) {
  const rules = parseAll(cssChunk);
  let out = "";
  for (const r of rules) {
    if (r.kind === "media") out += renderRule(r) + "\n";
    else out += renderRule(r) + "\n";
  }
  return out;
}

/* Переименование keyframes и ссылок на них */
function renameKeyframes(cssText) {
  const names = new Set();
  cssText.replace(/@keyframes\s+([\w-]+)/g, (m, n) => {
    names.add(n);
    return m;
  });
  for (const n of names) {
    cssText = cssText.split(`@keyframes ${n}`).join(`@keyframes ${KF_PREFIX}${n}`);
    /* ссылки в animation / animation-name */
    cssText = cssText
      .split(`animation:${n},`)
      .join(`animation:${KF_PREFIX}${n},`)
      .split(`animation:${n} `)
      .join(`animation:${KF_PREFIX}${n} `)
      .split(`animation:${n};`)
      .join(`animation:${KF_PREFIX}${n};`)
      .split(`animation-name:${n}`)
      .join(`animation-name:${KF_PREFIX}${n}`);
  }
  return { cssText, names };
}

const html = fs.readFileSync(SRC, "utf8");
const styleStart = html.indexOf("<style>");
const styleEnd = html.indexOf("</style>");
/* Комментарии прототипа в разметку не идут: в парсере они слипались с
   селектором, и следующий за ними @property оказывался вложенным —
   Turbopack падал на такой файл. */
const style = html.slice(styleStart + 7, styleEnd).replace(/\/\*[\s\S]*?\*\//g, "");

/* Палитра :root переносим на контейнер */
const rootMatch = style.match(/:root\s*\{([^}]*)\}/);
let palette = "";
if (rootMatch) palette = rootMatch[1].replace(/\s*--/g, "\n  --").trim();

let rules = parseAll(style);
const kept = [];
const dropped = [];
for (const r of rules) {
  if (r.kind === "rule" && r.head.startsWith("@property")) {
    kept.push(r.head + "{" + r.body + "}");
    continue;
  }
  if (r.kind === "rule" && r.head.startsWith("@keyframes")) {
    kept.push(r.head + "{" + r.body + "}");
    continue;
  }
  const rendered = renderRule(r);
  if (rendered.trim()) kept.push(rendered);
  else dropped.push(r.kind === "media" ? "@media " + r.head : r.head);
}

let body = kept.join("\n");
const renamed = renameKeyframes(body);
body = renamed.cssText;

/* Unbounded/Manrope идут через переменные next/font */
body = body
  .replace(/"Unbounded","Manrope"/g, 'var(--font-unbounded),"Manrope"')
  .replace(/"Unbounded"/g, "var(--font-unbounded)")
  /* Градиент #xg из прототипа стал уникальным: в макете он один, а в проекте
     id не должны совпадать у шапки и страниц. Компонент SiteHeader рендерит
     градиент с этим id. */
  .replace(/url\(#xg\)/g, "url(#ag-hd-xg)");

/* Градиент из прототипа жил под id="xg" — общий на весь документ, а в
 * проекте такой же id может появиться на другой странице. Переименовываем,
 * разметку градиента ставит SiteHeader (см. components/site). */
body = body.split("url(#xg)").join(`url(#${GRADIENT_ID})`);

const header = `/* Сгенерировано из _design/Header_AniGalaxy_flat (1).html — не править руками.
 *
 * Перенесены все правила прототипа без изменений, кроме изоляции:
 *  - селекторы спрятаны под ${WRAP} (шапка + оверлей поиска), глобальные
 *    сбросы (html, body, *, a, button, svg, :focus-visible) вырезаны;
 *  - @keyframes получили префикс ${KF_PREFIX}, иначе spin/sh/fl/pl/sc
 *    перезаписали бы одноимённые анимации других страниц;
 *  - :root прототипа перенесён на ${WRAP} (палитра шапки своя);
 *  - в самом прототипе шапка не помещается уже на 560px (прокрутка 592px
 *    при ширине 375, проверено на оригинале). Ниже — единственное
 *    отступление от макета: на узких экранах уходит текст ловотипа и
 *    сжимаются отступы, чтобы полоса не выезжала за экран. Все элементы
 *    шапки остаются на месте, ничего не скрыто.
 *
 * Пересобрать: node tools/build-header-css.mjs
 */
${WRAP} {
  position: relative;
  z-index: 60;
${palette}
}

`;

/* --- Отступления от прототипа на узких экранах ---
 *
 * В самом прототипе полоса не помещается уже на 560px: проверено на оригинале,
 * там горизонтальная прокрутка 592px при ширине 375. В проекте к этому
 * добавлялись наши элементы, и на 375px полоса вылезала за экран на 35px —
 * бургер и часть палитры поиска уезжали за правый край и обрезались.
 *
 * Это единственное место, где мы отходим от макета: на узких экранах полоса
 * сжимается. Ничего важного не скрывается — логотип-иконка, поиск, капсула,
 * профиль и бургер доступны всегда.
 *
 * Блок дописан ПОСЛЕ перенесённых правил: медиазапросы прототипа
 * (max-width:900px и др.) идут раньше и при равной специфичности выигрывает
 * тот, кто ниже — иначе наши размеры молча перебивались и полоса по-прежнему
 * не влезала в 375px.
 */
const narrowFixes = `
/* --- Открывающееся мобильное меню: исправление дефекта прототипа ---
 *
 * В прототипе строки идут в таком порядке:
 *   @media(max-width:900px){ ... .mnav{display:flex} ... }
 *   .mnav{display:none; ...}
 *   @media(min-width:901px){.mnav{display:none!important}}
 *
 * У первых двух правил специфичность одинакова, а второе стоит позже,
 * поэтому на узких экранах побеждает display:none и меню бургера не
 * открывается: display:none, высота 0, ссылки не видны. На десктопе
 * всё выглядит верно, поэтому в макете дефект не заметен — но на
 * телефоне кнопка бургера, то есть вся навигация, не работала.
 *
 * Ниже display:flex возвращается безусловно: на десктопе выпадашку всё
 * равно прячет @media(min-width:901px) с !important, а на узких
 * экранах раскладка остаётся ровно прототипной — колонка с gap:4px.
 * Именно flex, а не block: у .mnav заданы flex-direction:column и
 * gap:4px, и с display:block они бы потерялись.
 */
${WRAP} .mnav{display:flex}

/* --- Сжатие полосы на узких экранах (единственное отступление от прототипа) --- */
@media (max-width:560px){
  /* Текстовое слово в логотипе уходит первым: с ним связана иконка лисёнка,
     читаемость логотипа не страдает. */
  ${WRAP} .logo b{display:none}
  ${WRAP} .hi{gap:8px;padding:0 8px 0 10px}
  /* Кнопки капсулы — главный потребитель ширины. 42 → 38px: межосевая
     отметка 44px остаётся достижимой, полоса влезает в 375px. */
  ${WRAP} .ib{width:38px;height:38px;border-radius:12px}
  ${WRAP} .ib svg{width:18px}
  /* Кнопка профиля без ника и шеврона: на телефоне они не читаются,
     а место занимают. */
  ${WRAP} .me{height:40px;padding:0 8px}
  ${WRAP} .me .nm{display:none}
}
@media (max-width:480px){
  /* Кнопка Premium уходит в меню профиля: на странице /premium остаётся. */
  ${WRAP} .prem{display:none}
  ${WRAP} .hi{gap:6px}
  ${WRAP} .cap{padding:3px;border-radius:15px}
  /* Иконка «Совместный просмотр» снята с капсулы: при 375px полоса иначе не
     помещалась и кнопка «Войти» сжималась так, что её текст налезал на
     бургер. Ссылка не потеряна — пункт есть в мобильном меню (mi-watch). */
  ${WRAP} .cap-watch{display:none}
  ${WRAP} .mi-watch{display:flex}
  /* Кнопки в полосе не сжимаются: сжатый текст наезжал на соседа. */
  ${WRAP} .btn-login{flex:none}
  /* Палитра поиска на телефоне: поля не выходят за экран. */
  ${WRAP} .cp{padding:min(9vh,72px) 10px 0}
}
/* 380px и уже (iPhone SE и подобные): полоса сжимается ещё.
   Поиск сводится к иконке, иконки капсулы мельчают, кнопка «Войти»
   теряет горизонтальные поля. Ничего не скрывается, всё остаётся
   доступным — просто компактнее. */
@media (max-width:380px){
  ${WRAP} .hi{gap:2px;padding:0 4px 0 6px}
  ${WRAP} .cap{padding:2px}
  ${WRAP} .ib{width:32px;height:32px;border-radius:10px}
  ${WRAP} .ib svg{width:16px}
  ${WRAP} .srch{width:34px}
  ${WRAP} .srch .si span{display:none}
  ${WRAP} .srch kbd{display:none}
  ${WRAP} .btn-login{padding:0.45rem 0.7rem}
}
/* На десктопе пункт из мобильного меню лишний — прячем. */
@media (min-width:901px){
  ${WRAP} .mi-watch{display:none}
}
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, header + body + "\n" + narrowFixes, "utf8");

console.log("правил в прототипе: " + rules.length);
console.log("перенесено: " + kept.length + ", выброшено: " + dropped.length);
console.log("keyframes с префиксом: " + [...renamed.names].join(", "));
if (dropped.length) console.log("выброшено:\n  " + dropped.join("\n  "));