/**
 * Общая оболочка страницы для инструментов выгрузки (`tools/export-*.mjs`).
 *
 * Два экспорта — теги с титулами и рамки — рисуют одно и то же: тёмную
 * витрину, липкую панель с поиском и переключателями, сетку карточек с
 * метаданными и блок сырых данных. Здесь живёт всё общее; конкретный
 * экспорт приносит только `extraCss` (свои капсулы или свои превью) и
 * `extraScript`.
 *
 * Оболочка ничего не знает про предметы — она принимает готовые куски
 * HTML, поэтому её можно переиспользовать и для следующих выгрузок.
 */

/** Экранирование текста, который попадает в атрибуты и в текст узлов */
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ESC[ch]);
}

/* ---------------------------------------------------------------------- CSS */

const SHELL_CSS = `
:root {
  --font-sans: "Manrope", "Segoe UI", system-ui, -apple-system, sans-serif;
  --bg: #07070c;
  --bg-2: #0c0d16;
  --line: #1e2436;
  --text: #e8edf7;
  --muted: #8b9ab4;
  --accent: #1f7bff;
  --accent-2: #00c8ff;
  color-scheme: dark;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background:
    radial-gradient(90% 60% at 50% -10%, #16224a 0%, transparent 60%),
    var(--bg);
  color: var(--text);
  font: 15px/1.55 var(--font-sans);
  -webkit-font-smoothing: antialiased;
}
a { color: var(--accent-2); }
code { font-family: ui-monospace, "Cascadia Code", Consolas, monospace; }

.page { max-width: 1280px; margin: 0 auto; padding: 40px 24px 80px; }

/* --- шапка --- */
.head { border-bottom: 1px solid var(--line); padding-bottom: 28px; margin-bottom: 24px; }
.head h1 {
  margin: 0 0 8px;
  font-size: clamp(26px, 4vw, 40px);
  font-weight: 900;
  letter-spacing: -0.02em;
  background: linear-gradient(100deg, var(--accent) 0%, var(--accent-2) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.head p { margin: 0; color: var(--muted); max-width: 74ch; }
.head .src { margin-top: 14px; font-size: 12.5px; color: #5f6d86; font-family: ui-monospace, "Cascadia Code", Consolas, monospace; }

/* --- панель управления --- */
.bar {
  position: sticky;
  top: 0;
  z-index: 50;
  display: flex;
  flex-wrap: wrap;
  gap: 12px 18px;
  align-items: center;
  margin: 0 -24px 28px;
  padding: 12px 24px;
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--line);
}
.bar input[type="search"] {
  flex: 1 1 240px;
  min-width: 180px;
  padding: 9px 14px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: #11131f;
  color: var(--text);
  font: inherit;
  font-size: 14px;
}
.bar input[type="search"]:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.bar .grp { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.bar .grp > span { font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }

button.chipbtn {
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: #11131f;
  color: var(--muted);
  font: inherit;
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: .04em;
}
button.chipbtn:hover { border-color: #33405c; color: var(--text); }
button.chipbtn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
button.chipbtn[aria-pressed="true"] {
  background: linear-gradient(120deg, var(--accent), var(--accent-2));
  border-color: transparent;
  color: #04101f;
}
label.switch { display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--muted); cursor: pointer; }
label.switch input { accent-color: var(--accent); width: 15px; height: 15px; }

/* --- сводка --- */
.summary { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); margin: 0 0 14px; padding: 0; list-style: none; }
.summary li { padding: 12px 14px; border-radius: 12px; border: 1px solid var(--line); background: var(--bg-2); }
.summary b { display: block; font-size: 24px; font-weight: 900; line-height: 1.1; }
.summary span { font-size: 11.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); display: flex; align-items: center; gap: 6px; }

/* --- секции --- */
.group { margin: 0 0 48px; scroll-margin-top: 76px; }
.group > h2 { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; margin: 0 0 4px; font-size: 20px; font-weight: 900; }
.group > h2 .count { font-size: 12px; font-weight: 800; padding: 3px 9px; border-radius: 999px; background: #151a29; border: 1px solid var(--line); color: var(--accent-2); }
.group > .note { margin: 0 0 20px; font-size: 12.5px; color: #5f6d86; font-family: ui-monospace, "Cascadia Code", Consolas, monospace; }

/* --- карточки --- */
.grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); }
.grid--wide { grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); }
@media (max-width: 420px) { .grid, .grid--wide { grid-template-columns: 1fr; } }

.card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px 18px 18px;
  border-radius: 16px;
  border: 1px solid var(--line);
  background: var(--bg-2);
}
.card[hidden] { display: none; }

.card-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.badge {
  font-size: 10.5px;
  font-weight: 900;
  letter-spacing: .12em;
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid currentColor;
}
.badge[data-r="COMMON"] { color: #9fb2c8; }
.badge[data-r="UNCOMMON"] { color: #4ade80; }
.badge[data-r="RARE"] { color: #38bdf8; }
.badge[data-r="EPIC"] { color: #a78bfa; }
.badge[data-r="LEGENDARY"] { color: #fbbf24; }
.badge[data-r="MYTHIC"] { color: #f472b6; }
.badge[data-r="SECRET"] { color: #ff5c5c; }
.kind { font-size: 11.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }

.desc { margin: 0; font-size: 13.5px; color: #b9c5da; }

.meta { display: grid; gap: 8px 14px; margin: 0; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
.meta > div { min-width: 0; }
.meta dt { font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: #5f6d86; }
.meta dd { margin: 2px 0 0; font-size: 12.5px; color: #cfd9ea; overflow-wrap: anywhere; }
.meta code { font-size: 11.5px; }

/* --- пусто и сырые данные --- */
.empty { padding: 40px 0; text-align: center; color: var(--muted); }
details.raw { margin-top: 8px; }
details.raw > summary { cursor: pointer; padding: 12px 16px; border-radius: 12px; border: 1px solid var(--line); background: var(--bg-2); font-weight: 800; font-size: 13.5px; }
details.raw > summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
details.raw pre {
  margin: 12px 0 0;
  padding: 16px;
  max-height: 60vh;
  overflow: auto;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: #0a0b13;
  font-family: ui-monospace, "Cascadia Code", Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
  color: #b9c5da;
}

footer.page-foot { margin-top: 40px; padding-top: 20px; border-top: 1px solid var(--line); font-size: 12px; color: #5f6d86; }
`;

/* -------------------------------------------------------------------- script */

/**
 * Общий скрипт витрины: переключатели на `<html data-*>`, поиск по
 * карточкам, ленивая подстановка `data-src` и пауза анимаций капсул вне
 * экрана (селектор `.ag-tag` — из правила `data-paused` в ag-tag.css).
 *
 * Переключатель задаётся разметкой, а не вызовом из кода:
 *   `<button data-set="size" data-value="lg">`   →  <html data-size="lg">
 *   `<input type="checkbox" data-set="locked" data-value="on">` → on/off
 */
const SHELL_SCRIPT = `
(function () {
  "use strict";

  /* --- переключатели вида --- */
  document.querySelectorAll("button[data-set]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.documentElement.dataset[btn.dataset.set] = btn.dataset.value;
      document.querySelectorAll("button[data-set='" + btn.dataset.set + "']").forEach(function (other) {
        other.setAttribute("aria-pressed", String(other === btn));
      });
    });
  });

  document.querySelectorAll("input[data-set]").forEach(function (input) {
    input.addEventListener("change", function () {
      document.documentElement.dataset[input.dataset.set] = input.checked ? input.dataset.value : "off";
    });
  });

  /* --- ленивая загрузка картинок и пауза анимаций вне экрана --- */
  var lazy = document.querySelectorAll("img[data-src]");
  if ("IntersectionObserver" in window) {
    var loadIO = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (!entries[i].isIntersecting) continue;
        var img = entries[i].target;
        img.src = img.dataset.src;
        delete img.dataset.src;
        loadIO.unobserve(img);
      }
    }, { rootMargin: "300px" });
    lazy.forEach(function (el) { loadIO.observe(el); });

    // ag-tag.css гасит анимации капсулы по data-paused — тот же приём,
    // что в AgTag.tsx, только витрина длиннее страницы профиля
    var pauseIO = new IntersectionObserver(function (entries) {
      for (var j = 0; j < entries.length; j++) {
        if (entries[j].isIntersecting) entries[j].target.removeAttribute("data-paused");
        else entries[j].target.setAttribute("data-paused", "true");
      }
    }, { threshold: 0.05 });
    document.querySelectorAll(".ag-tag").forEach(function (el) { pauseIO.observe(el); });
  } else {
    lazy.forEach(function (el) { el.src = el.dataset.src; delete el.dataset.src; });
  }

  /* --- поиск по карточкам --- */
  var q = document.getElementById("q");
  if (q) {
    var cards = Array.prototype.slice.call(document.querySelectorAll(".card"));
    var groups = Array.prototype.slice.call(document.querySelectorAll(".group"));
    q.addEventListener("input", function () {
      var needle = q.value.trim().toLowerCase();
      var visible = Object.create(null);
      cards.forEach(function (card) {
        var hit = !needle || card.dataset.search.indexOf(needle) !== -1;
        card.hidden = !hit;
        if (hit) visible[card.dataset.group] = (visible[card.dataset.group] || 0) + 1;
      });
      groups.forEach(function (group) {
        var empty = group.querySelector("[data-empty]");
        if (empty) empty.hidden = (visible[group.dataset.group] || 0) > 0;
      });
    });
  }

  /* --- сырые данные: компактно в разметке, pretty при раскрытии --- */
  var raw = document.getElementById("raw");
  if (raw) {
    var payload = document.getElementById("payload").textContent;
    raw.textContent = payload;
    var pretty = false;
    raw.parentElement.addEventListener("toggle", function (e) {
      if (!e.target.open || pretty) return;
      try { raw.textContent = JSON.stringify(JSON.parse(payload), null, 2); pretty = true; } catch (err) { /* остаётся компактно */ }
    });
  }
})();
`;

/* ------------------------------------------------------------------- сборка */

/**
 * Собрать страницу целиком.
 *
 * @param {object} opts
 * @param {string} opts.title       заголовок документа и шапки
 * @param {string} opts.lede        абзац под заголовком
 * @param {string} opts.srcNote     строка с источниками и датой сборки
 * @param {string} opts.summary     готовые `<li>` сводки
 * @param {string} opts.toolbar     содержимое липкой панели
 * @param {string} opts.sections    готовые секции с карточками
 * @param {string} [opts.extraCss]  стили конкретного экспорта
 * @param {string} [opts.extraScript] скрипт конкретного экспорта (после общего)
 * @param {Record<string,string>} [opts.attrs] начальные `data-*` на `<html>`
 *   (состояние переключателей до первого клика)
 * @param {object} opts.dump        сырые данные страницы
 * @param {string} opts.dumpLabel   подпись блока сырых данных
 * @param {string} opts.footer      подпись подвала
 */
export function renderPage(opts) {
  const { title, lede, srcNote, summary, toolbar, sections, dump, dumpLabel, footer } = opts;
  const extraCss = opts.extraCss ?? "";
  const extraScript = opts.extraScript ?? "";
  const attrs = Object.entries(opts.attrs ?? {})
    .map(([key, value]) => ` data-${key}="${esc(value)}"`)
    .join("");

  if (extraCss.includes("</style")) throw new Error("extraCss содержит </style — нельзя инлайнить");
  if (extraScript.includes("</script")) throw new Error("extraScript содержит </script");

  return `<!doctype html>
<html lang="ru"${attrs}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="robots" content="noindex, nofollow">
<style>${SHELL_CSS}</style>
<style>${extraCss}</style>
</head>
<body>
<div class="page">

  <header class="head">
    <h1>${esc(title)}</h1>
    <p>${lede}</p>
    <p class="src">${srcNote}</p>
  </header>

  <div class="bar">
${toolbar}
  </div>

  <ul class="summary">${summary}</ul>

${sections}

  <details class="raw">
    <summary>${esc(dumpLabel)}</summary>
    <pre id="raw"></pre>
  </details>

  <footer class="page-foot">${footer}</footer>
</div>

<script type="application/json" id="payload">${JSON.stringify(dump).replace(/</g, "\\u003c")}</script>
<script>${SHELL_SCRIPT}</script>
${extraScript}
</body>
</html>
`;
}

/** Панель: поле поиска + группы переключателей. Чистая разметка. */
export function toolbar({ searchPlaceholder, groups = [] }) {
  const controls = groups
    .map((group) => {
      const items = group.items
        .map((item) =>
          item.type === "switch"
            ? `<label class="switch"><input type="checkbox" data-set="${esc(group.set)}" data-value="${esc(item.value)}"${item.checked ? " checked" : ""}> ${esc(item.label)}</label>`
            : `<button class="chipbtn" type="button" data-set="${esc(group.set)}" data-value="${esc(item.value)}" aria-pressed="${item.active ? "true" : "false"}">${esc(item.label)}</button>`,
        )
        .join("\n      ");
      return `    <div class="grp" role="group" aria-label="${esc(group.label)}">
      <span>${esc(group.label)}</span>
      ${items}
    </div>`;
    })
    .join("\n");

  return `    <input type="search" id="q" placeholder="${esc(searchPlaceholder)}" aria-label="${esc(searchPlaceholder)}">
${controls}`;
}
