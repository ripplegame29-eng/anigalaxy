/**
 * Выгрузка всех рамок аватара в один самодостаточный HTML.
 *
 *   node tools/export-frames.mjs [путь.html]
 *   → docs/frames.html
 *
 * Источники данных (правда одна — конфиг проекта, копий тут нет):
 *   src/lib/cosmetics.ts       → FRAMES        (60, каталог)
 *   src/lib/guild-cosmetics.ts → GUILD_FRAMES  (15, рамки магазина)
 * `SHOP_FRAMES` в cosmetics.ts — это те же 15 рамок магазина, у которых
 * прописана только цена (`unlock.price`), поэтому список берём оттуда.
 *
 * ------------------------------------------------------------------ рамки
 * Рисунок рамки вшивается в страницу как инлайновый `<svg>`, а не как
 * `<img src="data:…">`. Причина — из src/lib/frame-svg.ts и из правила
 * `.ags .frame svg { overflow: visible }` в cosmetics-shop.css: файл,
 * подключённый через `<img>`, всегда обрезается по своей рамке, и широкий
 * рисунок (рамки с крыльями) уезжает за пределы холста.
 * Так в макете и в витрине магазина; `AvatarView` с `<img>` — исключение,
 * там артефакт виден пользователю на аватаре.
 *
 * Инлайн требует изоляции, иначе семьдесят четыре рамки в одном документе
 * передерут определения: `id="gl"` встречается в 54 файлах, а градиенты
 * адресуются как `url(#aura)`. Поэтому здесь — тот же приём, что в
 * frame-svg.ts, плюс то, чего там нет:
 *   - уникальные id (префикс номером рамки) — иначе `url(#…)` уехал бы к
 *     первому попавшемуся градиенту;
 *   - тело `@keyframes` и содержимое `@media` НЕ получают префикс класса:
 *     селектор `.cls to{…}` или `.cls @media …{…}` парсер отбрасывает, и
 *     анимации рамки просто не заводятся.
 * Переключатель «обрезать по холсту» возвращает `overflow: hidden` — то
 * самое поведение, что даёт `<img>` в профиле.
 *
 * Геометрия превью повторяет витрину: бокс рамки = `--sz`, аватар внутри =
 * `--sz / scale` (см. `.ags .av` в cosmetics-shop.css), то есть рамка
 * шире аватара в `scale` раз — по умолчанию 1.3, у премиумных 1.95/2.5.
 *
 * TS компилируется тем же приёмом, что в balance-sim.mjs и run-tests.mjs:
 * `npx tsc -p tsconfig.tools.json` → .tsc-tests/, дальше обычный импорт.
 */

import { spawnSync } from "node:child_process";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { esc, renderPage, toolbar } from "./_export-shell.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outFile = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.join(root, "docs", "frames.html");

/* ------------------------------------------------------------------ сборка */

const tsc = spawnSync("npx tsc -p tsconfig.tools.json", {
  cwd: root,
  stdio: "inherit",
  shell: true,
});
if (tsc.status !== 0) {
  console.error("[export-frames] сборка не удалась");
  process.exit(tsc.status ?? 1);
}

const load = (rel) => import(pathToFileURL(path.join(root, ".tsc-tests", rel)).href);

const { FRAMES, SHOP_FRAMES, RARITY_LABEL, unlockHint } = await load("lib/cosmetics.js");

/* ------------------------------------------------------------------ данные */

/**
 * Шкала косметики (4 ступени) → шкала тегов прогрессии (7). Тем же
 * отображением, что в `cosmetics.ts`: бейдж рамки должен совпадать по
 * цвету с бейджем титулов и тегов на витрине тегов.
 */
const RARITY_TO_BAG = {
  common: "COMMON",
  rare: "RARE",
  epic: "EPIC",
  legendary: "LEGENDARY",
};
const RARITY_ORDER = Object.keys(RARITY_TO_BAG);

/** Масштаб рамки: у премиумных свой, у остальных — как у всех в проекте */
const DEFAULT_SCALE = 1.3;

const COLLECTIONS = [
  { id: "catalog", label: "Каталог косметики", note: "cosmetics.FRAMES" },
  {
    id: "shop",
    label: "Рамки магазина",
    note: "cosmetics.SHOP_FRAMES → guild-cosmetics.GUILD_FRAMES",
  },
];

const toItem = (frame, collection, group) => {
  const scale = frame.scale ?? DEFAULT_SCALE;
  const search = [frame.id, frame.name, collection, unlockHint(frame.unlock)]
    .join(" ")
    .toLowerCase();
  return { frame, collection, group, scale, search };
};

const items = [
  ...FRAMES.map((frame) => toItem(frame, "Каталог", "catalog")),
  ...SHOP_FRAMES.map((frame) => toItem(frame, "Магазин", "shop")),
];

/* --------------------------------------------------- инлайн разметка рамки */

const prepared = new Map();
const read = new Map();

function frameFile(img) {
  const hit = read.get(img);
  if (hit) return hit;
  const file = path.join(root, "public", img.replace(/^\//, ""));
  let result;
  try {
    result = {
      file,
      svg: readFileSync(file, "utf8"),
      kb: Math.round((statSync(file).size / 1024) * 10) / 10,
    };
  } catch {
    throw new Error(`нет файла рамки: ${img} (ожидался ${path.relative(root, file)})`);
  }
  read.set(img, result);
  return result;
}

/** Индекс закрывающей скобки, парной открывающей в позиции `from` */
function matchingBrace(s, from) {
  let depth = 0;
  for (let i = from; i < s.length; i += 1) {
    if (s[i] === "{") depth += 1;
    else if (s[i] === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return s.length - 1;
}

/**
 * Изолирует CSS внутри файла рамки: селекторы получают префикс класса,
 * имена `@keyframes` — уникальный суффикс.
 *
 * Тело `@keyframes` и содержимое at-rule с блоком (`@media`,
 * `@supports`) намеренно не префиксуются: `.agf1 to{…}` и
 * `.agf1 @media …{…}` — невалидный CSS, который парсер выбрасывает целиком,
 * вместе с анимациями и правилом prefers-reduced-motion.
 */
function scopeCss(css, cls) {
  const renamed = new Map();
  let out = css.replace(/@keyframes\s+([\w-]+)/g, (_m, name) => {
    if (!renamed.has(name)) renamed.set(name, `${cls}-${name}`);
    return `@keyframes ${renamed.get(name)}`;
  });
  for (const [from, to] of renamed) {
    // ссылки на анимацию живут в `animation: <имя> …`
    out = out.replace(new RegExp(`:\\s*${from}\\b`, "g"), `:${to}`);
  }

  const walk = (chunk) => {
    let result = "";
    let i = 0;
    while (i < chunk.length) {
      const brace = chunk.indexOf("{", i);
      if (brace < 0) {
        result += chunk.slice(i);
        break;
      }
      const head = chunk.slice(i, brace);
      const end = matchingBrace(chunk, brace);
      const body = chunk.slice(brace + 1, end);
      const trimmed = head.trim();
      let scoped;
      if (/^@(keyframes|font-face)/i.test(trimmed)) scoped = head;
      else if (trimmed.startsWith("@")) scoped = head.replace(trimmed, walk(body));
      else scoped = head.replace(trimmed, trimmed.split(",").map((s) => `.${cls} ${s.trim()}`).join(", "));
      result += `${scoped}{${body}}`;
      i = end + 1;
    }
    return result;
  };

  return walk(out);
}

/**
 * Готовит `<svg>` рамки к вставке в документ. Отличие от
 * `prepareFrame()` из src/lib/frame-svg.ts — уникальные id: в наборе
 * `id="gl"` повторяется 54 раза, и без переименования `url(#gl)` у всех
 * рамок вёл бы к одному фильтру.
 */
function prepareFrameSvg(img, uid) {
  const hit = prepared.get(img);
  if (hit) return hit;

  const { svg: source, kb } = frameFile(img);
  const cls = `agf${uid}`;
  const ids = new Map();
  const uniq = (id) => {
    if (!ids.has(id)) ids.set(id, `${id}-${uid}`);
    return ids.get(id);
  };

  // id и ссылки на них — сперва, чтобы переименование попало и в <style>
  let svg = source
    .replace(/\sid="([^"]+)"/g, (_m, id) => ` id="${uniq(id)}"`)
    .replace(/url\(#([^)]+)\)/g, (_m, id) => `url(#${uniq(id)})`)
    .replace(/((?:xlink:)?href=)"#([^"]+)"/g, (_m, attr, id) => `${attr}"#${uniq(id)}"`);

  svg = svg
    .replace(/<style>([\s\S]*?)<\/style>/g, (_m, css) => `<style>${scopeCss(css, cls)}</style>`)
    // размеры задаёт CSS витрины, как в prepareFrame()
    .replace(/^<svg\b/, `<svg class="${cls}"`)
    .replace(/\s(width|height)="\d+"/g, "");

  const result = { svg, kb, cls };
  prepared.set(img, result);
  return result;
}

/* ------------------------------------------------------------------ карточки */

const SIZES = ["sm", "md", "lg"];

let frameUid = 0;

function preview(item) {
  const { frame, scale } = item;
  if (!frame.img) {
    return `<div class="preview preview--empty" style="--scale:${scale}">
      <span class="av" aria-hidden="true">AG</span>
      <span class="preview-note">пусто — рамки нет</span>
    </div>`;
  }
  frameUid += 1;
  return `<div class="preview" style="--scale:${scale}">
      <span class="av" aria-hidden="true">AG</span>
      ${prepareFrameSvg(frame.img, frameUid).svg}
    </div>`;
}

function card(item) {
  const { frame, scale, collection, group } = item;
  const rarity = RARITY_TO_BAG[frame.rarity] ?? "COMMON";
  const kb = frame.img ? frameFile(frame.img).kb : null;

  return `<article class="card card--frame" data-group="${group}" data-rarity="${esc(rarity)}" data-search="${esc(item.search)}">
  ${preview(item)}
  <header class="card-head">
    <span class="badge" data-r="${esc(rarity)}">${esc(rarity)}</span>
    <span class="kind">${esc(frame.name)}</span>
  </header>
  <dl class="meta">
    <div><dt>Редкость</dt><dd>${esc(RARITY_LABEL[frame.rarity] ?? frame.rarity)}</dd></div>
    <div><dt>Открытие</dt><dd>${esc(unlockHint(frame.unlock))}</dd></div>
    <div><dt>id</dt><dd><code>${esc(frame.id)}</code></dd></div>
    <div><dt>Масштаб</dt><dd>${scale === DEFAULT_SCALE ? `${scale} (по умолчанию)` : esc(String(scale))}</dd></div>
    <div><dt>Файл</dt><dd>${frame.img ? `<code>${esc(frame.img)}</code> · ${kb} КБ` : "—"}</dd></div>
    <div><dt>Коллекция</dt><dd>${esc(collection)}</dd></div>
  </dl>
</article>`;
}

/* --------------------------------------------------------------------- CSS */

const EXTRA_CSS = `
/* --- размер аватара --- */
html[data-size="sm"] .grid--frames { grid-template-columns: repeat(auto-fill, minmax(196px, 1fr)); }
html[data-size="md"] .grid--frames { grid-template-columns: repeat(auto-fill, minmax(272px, 1fr)); }
html[data-size="lg"] .grid--frames { grid-template-columns: repeat(auto-fill, minmax(410px, 1fr)); }
html[data-size="sm"] .preview { --av: 56px; }
html[data-size="md"] .preview { --av: 88px; }
html[data-size="lg"] .preview { --av: 144px; }

.card--frame {
  align-items: center;
  text-align: center;
  gap: 16px;
  /* 74 анимированных svg: невидимые карточки не рендерим вовсе */
  content-visibility: auto;
  contain-intrinsic-size: auto 300px;
}
.card--frame .card-head { justify-content: center; }
.card--frame .meta { width: 100%; text-align: left; }
.card--frame .meta > div:nth-child(n + 4) { opacity: .82; }

/* --- превью: та же математика, что в .ags .frame / .ags .av --- */
.preview {
  --av: 88px;
  --scale: 1.3;
  --stage: #0a0b13;
  position: relative;
  display: grid;
  place-items: center;
  /* бокс рамки = av × scale; рисунок выходит за холст 512×512, поэтому
     сцена ровно такая и не обрезает ничего лишнего */
  width: calc(var(--av) * var(--scale) + 20px);
  height: calc(var(--av) * var(--scale) + 20px);
  border-radius: 16px;
  background: var(--stage);
  border: 1px solid var(--line);
}
html[data-stage="light"] .preview { --stage: #e9edf6; border-color: #cfd7e8; }
html[data-stage="dark"] .preview { --stage: #0a0b13; }

/* рамка — инлайновый svg, а не картинка: overflow:visible выпускает крылья
   за пределы холста (та же причина, что в cosmetics-shop.css) */
.preview > svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}
/* а это уже то, что даёт <img> в AvatarView: обрезка по холсту */
html[data-clip="on"] .preview > svg { overflow: hidden; }

.av {
  width: var(--av);
  height: var(--av);
  border-radius: 50%;
  overflow: hidden;
  display: grid;
  place-items: center;
  font-weight: 900;
  font-size: calc(var(--av) * 0.3);
  color: #fff;
  background: linear-gradient(135deg, #1f7bff, #00c8ff);
}
.preview--empty .av { box-shadow: inset 0 0 0 1px #2b3450; }
.preview-note {
  position: absolute;
  bottom: 6px;
  font-size: 10px;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: #56637c;
}
html[data-stage="light"] .preview-note { color: #7d8798; }
`;

/* --------------------------------------------------------------------- сборка */

const rarityCounts = new Map();
for (const { frame } of items) {
  rarityCounts.set(frame.rarity, (rarityCounts.get(frame.rarity) ?? 0) + 1);
}

const dump = {
  generatedAt: new Date().toISOString(),
  source: {
    catalog: "src/lib/cosmetics.ts → FRAMES",
    shop: "src/lib/cosmetics.ts → SHOP_FRAMES (guild-cosmetics.GUILD_FRAMES)",
    files: "public/frames/*.svg — вшиты в страницу инлайновым <svg>",
  },
  defaultScale: DEFAULT_SCALE,
  counts: {
    catalog: FRAMES.length,
    shop: SHOP_FRAMES.length,
    total: items.length,
    withoutImage: items.filter((item) => !item.frame.img).length,
    withCustomScale: items.filter((item) => item.scale !== DEFAULT_SCALE).length,
  },
  items: items.map(({ frame, scale, collection, group }) => ({
    group,
    collection,
    id: frame.id,
    name: frame.name,
    rarity: frame.rarity,
    rarityLabel: RARITY_LABEL[frame.rarity] ?? frame.rarity,
    unlock: unlockHint(frame.unlock),
    unlockRaw: frame.unlock,
    scale,
    customScale: frame.scale != null,
    img: frame.img ?? null,
    css: frame.css ?? null,
  })),
};

const summary = [
  `<li><b>${items.length}</b><span>рамок всего</span></li>`,
  ...COLLECTIONS.map(
    (group) =>
      `<li><b>${items.filter((item) => item.group === group.id).length}</b><span>${esc(group.label)}</span></li>`,
  ),
  ...RARITY_ORDER.filter((r) => rarityCounts.has(r)).map(
    (r) =>
      `<li><b>${rarityCounts.get(r)}</b><span><span class="badge" data-r="${RARITY_TO_BAG[r]}">${RARITY_TO_BAG[r]}</span>${esc(RARITY_LABEL[r])}</span></li>`,
  ),
].join("");

const sections = COLLECTIONS.map((group) => {
  const list = items.filter((item) => item.group === group.id);
  return `<section class="group" id="g-${group.id}" data-group="${group.id}">
  <h2>${esc(group.label)} <span class="count">${list.length}</span></h2>
  <p class="note">${esc(group.note)}</p>
  <div class="grid grid--frames">${list.map(card).join("\n")}</div>
  <p class="empty" data-empty="${group.id}" hidden>Ничего не найдено.</p>
</section>`;
}).join("\n");

const html = renderPage({
  title: "Рамки аватара — AniGalaxy",
  lede: `Все ${items.length} рамок каталога и магазина на настоящих SVG-файлах из <code>public/frames</code>. Рисунок вшит инлайном (как в витрине магазина), поэтому анимации живут и крылья серафима не срезаны; переключатель «обрезать по холсту» показывает то, что видит пользователь в профиле — там <code>AvatarView</code> подключает рамку через <code>&lt;img&gt;</code>, а файл в <code>&lt;img&gt;</code> всегда обрезается по своей рамке. Превью повторяет витрину: аватар <code>--sz / scale</code> внутри бокса <code>--sz</code>.`,
  srcNote: `node tools/export-frames.mjs · ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`,
  summary,
  toolbar: toolbar({
    searchPlaceholder: "Поиск по названию, id, условию…",
    groups: [
      {
        set: "size",
        label: "Аватар",
        items: SIZES.map((size) => ({ label: size, value: size, active: size === "md" })),
      },
      {
        set: "stage",
        label: "Фон",
        items: [
          { label: "тёмный", value: "dark", active: true },
          { label: "светлый", value: "light", active: false },
        ],
      },
      {
        set: "clip",
        label: "Холст",
        items: [{ type: "switch", label: "обрезать по 512×512 (как <img>)", value: "on" }],
      },
    ],
  }),
  sections,
  extraCss: EXTRA_CSS,
  attrs: { size: "md", stage: "dark", clip: "off" },
  dump,
  dumpLabel: `Сырые данные (JSON) — ${items.length} рамок`,
  footer:
    "Источники: <code>src/lib/cosmetics.ts</code>, <code>src/lib/guild-cosmetics.ts</code>, " +
    "файлы <code>public/frames/*.svg</code>. Изоляция стилей — по мотивам " +
    "<code>src/lib/frame-svg.ts</code>. Генератор: <code>tools/export-frames.mjs</code>.",
});

writeFileSync(outFile, html, "utf8");

const kb = (Buffer.byteLength(html, "utf8") / 1024).toFixed(1);
console.log(
  `[export-frames] ${FRAMES.length} рамок каталога · ${SHOP_FRAMES.length} рамок магазина = ${items.length}, svg вшито ${prepared.size}`,
);
console.log(`[export-frames] ${path.relative(root, outFile) || outFile} — ${kb} КБ`);
