/**
 * Выгрузка всех тегов прогрессии и всех титулов в один самодостаточный HTML.
 *
 *   node tools/export-tags-titles.mjs [путь.html]
 *   → docs/tags-titles.html
 *
 * Источники данных (правда одна — конфиг проекта, копий тут нет):
 *   src/lib/progression/progression.config.ts → PROGRESSION_CONFIG.tags (29)
 *   src/lib/cosmetics.ts                      → TITLES          (12)
 *   src/lib/guild-cosmetics.ts                → GUILD_TITLES    (15)
 * Титулы магазина из `PROGRESSION_CONFIG.shop` (kind: "title") — это те же
 * самые 15 `gt-*`, что описаны в guild-cosmetics.ts, поэтому берём оттуда:
 * там же палитра, эффект и иконка, а в магазине только цена (она совпадает
 * с `unlock.price`).
 *
 * TS компилируется тем же приёмом, что в balance-sim.mjs и run-tests.mjs:
 * `npx tsc -p tsconfig.tools.json` → .tsc-tests/, дальше обычный импорт.
 *
 * Капсулы не «нарисованы на глаз»: разметка — порт `tagParts()` из
 * components/progression/AgTag.tsx, набор эффектов и частицы берутся
 * настоящими `effectSet` / `particlesFor` / `sparkCount` / `spinFor` из
 * lib/progression/visual.ts, стили — дословно src/app/ag-tag.css. Поэтому
 * файл открывается офлайн и совпадает с тем, что видно на сайте.
 */

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { esc, renderPage, toolbar } from "./_export-shell.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outFile = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.join(root, "docs", "tags-titles.html");

/* ------------------------------------------------------------------ сборка */

const tsc = spawnSync("npx tsc -p tsconfig.tools.json", {
  cwd: root,
  stdio: "inherit",
  shell: true,
});
if (tsc.status !== 0) {
  console.error("[export-tags-titles] сборка не удалась");
  process.exit(tsc.status ?? 1);
}

const load = (rel) => import(pathToFileURL(path.join(root, ".tsc-tests", rel)).href);

const { PROGRESSION_CONFIG } = await load("lib/progression/progression.config.js");
const { TITLES, titleTag, RARITY_LABEL: COSMETIC_RARITY, unlockHint } = await load(
  "lib/cosmetics.js",
);
const { GUILD_TITLES } = await load("lib/guild-cosmetics.js");
const { RARITY_LABEL, effectSet, particlesFor, sparkCount, spinFor } = await load(
  "lib/progression/visual.js",
);

/* ------------------------------------------------------------------ данные */

const RARITY_ORDER = ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY", "MYTHIC", "SECRET"];

/** Человекочитаемое условие получения тега прогрессии */
function tagUnlockText(tag) {
  switch (tag.source) {
    case "level":
      return `Уровень ${tag.level}`;
    case "achievement":
      return `Достижение ${tag.achievementId}`;
    case "shop":
      return `Магазин · ${tag.price} AC`;
    case "referral":
      return `Рубеж рефералки · ${tag.friends} друзей`;
    case "event":
      return `Событие ${tag.seasonId ?? "—"}`;
    case "secret":
      return "Секретный тег";
    default:
      return "—";
  }
}

const tags = PROGRESSION_CONFIG.tags.map((tag) => ({
  group: "tags",
  kind: "Тег прогрессии",
  tag,
  name: tag.name,
  rarity: tag.rarity,
  rarityLabel: RARITY_LABEL[tag.rarity] ?? tag.rarity,
  unlock: tagUnlockText(tag),
  unlocked: tag.source !== "secret",
  // источник прогрессии есть только у тегов; у титулов условие — это `unlock`
  source: tag.source,
  level: tag.level,
  achievementId: tag.achievementId,
}));

const titleItems = (items, group, kind) =>
  items.map((item) => {
    const tag = titleTag(item);
    return {
      group,
      kind,
      tag,
      name: item.name,
      rarity: tag.rarity,
      rarityLabel: COSMETIC_RARITY[item.rarity] ?? item.rarity,
      unlock: unlockHint(item.unlock),
      unlocked: Boolean(item.unlock.price),
      price: item.unlock.price,
      source: null,
      level: item.unlock.level ?? null,
      achievementId: item.unlock.achievement ?? null,
    };
  });

const cosmetics = titleItems(TITLES, "cosmetics", "Титул косметики");
const guild = titleItems(GUILD_TITLES, "guild", "Титул магазина");

const items = [...tags, ...cosmetics, ...guild];

const GROUPS = [
  { id: "tags", label: "Теги прогрессии", note: "PROGRESSION_CONFIG.tags" },
  { id: "cosmetics", label: "Титулы косметики", note: "cosmetics.TITLES" },
  { id: "guild", label: "Титулы магазина", note: "guild-cosmetics.GUILD_TITLES" },
];

/* --------------------------------------------------------- порт AgTag.tsx */

const TEXT_CLASS = {
  plain: "",
  neon: "txt-neon",
  metal: "txt-metal",
  glitch: "txt-glitch",
  tremor: "txt-tremor",
};

/** слои-подложки и оверлеи — те же множества, что в AgTag.tsx */
const SOFT_LAYERS = new Set(["mist", "flame", "orbit"]);
const OVER_LAYERS = new Set(["border-blade", "noise"]);

/**
 * Разметка капсулы — зеркало `tagParts()` из components/progression/AgTag.tsx.
 * Единственная разница: React-элементы склеены строками, потому что здесь
 * результат уходит в статический HTML, а не в клиентский рендер.
 */
function renderTagHtml(tag, { size = "md", locked = false } = {}) {
  const effects = effectSet(tag);
  const has = (name) => effects.includes(name);
  const dots = size === "sm" ? [] : particlesFor(tag.id, sparkCount(tag));
  const label = tag.name;

  const cls = [
    "ag-tag",
    `ag-tag--${size}`,
    ...effects.map((name) => `fx-${name}`),
    TEXT_CLASS[tag.visual.text ?? "plain"] ?? "",
    locked ? "ag-tag--locked" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const style = `--c:${tag.visual.c};--c2:${tag.visual.c2};--spin:${spinFor(tag.rarity)}`;

  const layers = [`<span class="ag-bg" aria-hidden="true"></span>`];
  if (effects.some((e) => SOFT_LAYERS.has(e))) {
    layers.push(`<span class="ag-soft" aria-hidden="true"></span>`);
  }
  if (effects.some((e) => OVER_LAYERS.has(e))) {
    layers.push(`<span class="ag-over" aria-hidden="true"></span>`);
  }
  if (has("pulse")) layers.push(`<span class="ag-glow" aria-hidden="true"></span>`);
  if (has("runes")) {
    layers.push(
      `<svg class="ag-runes" viewBox="0 0 100 40" aria-hidden="true" focusable="false"><circle cx="50" cy="20" r="17"></circle></svg>`,
    );
  }
  layers.push(`<i class="bk tl" aria-hidden="true"></i>`);
  layers.push(`<i class="bk tr" aria-hidden="true"></i>`);
  layers.push(`<i class="bk bl" aria-hidden="true"></i>`);
  layers.push(`<i class="bk br" aria-hidden="true"></i>`);
  // разметка только из конфига проекта, пользовательский ввод сюда не попадает
  layers.push(
    `<svg class="ag-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${tag.visual.icon}</svg>`,
  );
  layers.push(`<b data-t="${esc(label)}">${esc(label)}</b>`);
  if (has("shine")) layers.push(`<span class="sh" aria-hidden="true"></span>`);
  for (const p of dots) {
    layers.push(
      `<em class="sp" aria-hidden="true" style="--x:${p.x};--y:${p.y};--delay:${p.delay}s;--dur:${p.duration}s;--sz:${p.size}px"></em>`,
    );
  }

  // Обёртка повторяет корень компонента AgTag: капсула внутри неё, рядом
  // окошко с описанием. Без обёртки подсказка у фаски и Гуля обрезалась бы
  // их clip-path — ровно как на сайте.
  const capsule = `<span class="${cls}" style="${style}" data-r="${esc(tag.rarity)}" data-tag="${esc(tag.id)}">${layers.join("")}</span>`;
  const tip = `<span class="ag-tip" role="tooltip">${esc(tag.description)}</span>`;
  return `<span class="ag-tag-wrap">${capsule}${tip}</span>`;
}

/* ------------------------------------------------------------------ карточки */

const SIZES = ["sm", "md", "lg"];

/** Строка размеров: активная капсула + приглушённая (тег не получен) */
function sizeRows(tag) {
  return SIZES.map(
    (size) => `<div class="row row--${size}">
      <span class="row-label">${size}</span>
      <span class="pill live-only">${renderTagHtml(tag, { size })}</span>
      <span class="pill locked-only">${renderTagHtml(tag, { size, locked: true })}</span>
    </div>`,
  ).join("");
}

function card(item) {
  const tag = item.tag;
  const own = tag.visual.effects;
  const floor = effectSet(tag).filter((e) => !own.includes(e));
  const search = [item.name, item.kind, item.unlock, tag.id, tag.description]
    .join(" ")
    .toLowerCase();

  const effectChips = [
    own.map((e) => `<code class="fx">${esc(e)}</code>`).join(""),
    floor.length
      ? `<span class="fx-floor">+ пол ${esc(tag.rarity)}: ${floor.map((e) => `<code class="fx">${esc(e)}</code>`).join("")}</span>`
      : "",
  ].join("");

  return `<article class="card card--tag" data-group="${item.group}" data-rarity="${esc(tag.rarity)}" data-search="${esc(search)}" style="--c:${tag.visual.c};--c2:${tag.visual.c2}">
  <header class="card-head">
    <span class="badge" data-r="${esc(tag.rarity)}">${esc(tag.rarity)}</span>
    <span class="kind">${esc(item.kind)}</span>
  </header>
  <div class="caps">${sizeRows(tag)}</div>
  <p class="desc">${esc(tag.description)}</p>
  <dl class="meta">
    <div><dt>Редкость</dt><dd>${esc(item.rarityLabel)}</dd></div>
    <div><dt>${item.group === "tags" ? "Получение" : "Открытие"}</dt><dd>${esc(item.unlock)}</dd></div>
    <div><dt>id</dt><dd><code>${esc(tag.id)}</code></dd></div>
    <div><dt>Текст</dt><dd>${esc(tag.visual.text ?? "plain")}</dd></div>
    <div><dt>Эффекты</dt><dd class="fx-list">${effectChips || "—"}</dd></div>
    <div><dt>Палитра</dt><dd class="pal"><i style="background:${esc(tag.visual.c)}"></i><code>${esc(tag.visual.c)}</code><i style="background:${esc(tag.visual.c2)}"></i><code>${esc(tag.visual.c2)}</code></dd></div>
    <div><dt>Иконка</dt><dd class="ico"><svg viewBox="0 0 24 24" aria-hidden="true">${tag.visual.icon}</svg><code>24×24 stroke</code></dd></div>
  </dl>
</article>`;
}

/* --------------------------------------------------------------------- CSS */

/* стили капсулы — дословно из проекта, плюс обвязка карточек */
const EXTRA_CSS = `
.card--tag {
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--c) 7%, transparent) 0%, transparent 42%),
    var(--bg-2);
}
.caps { display: flex; flex-direction: column; gap: 10px; padding: 14px; border-radius: 12px; background: #0a0b13; border: 1px solid #171c2b; }
.row { display: none; align-items: center; gap: 12px; flex-wrap: wrap; }
.row-label { flex: none; width: 26px; font-size: 10.5px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #56637c; }
.pill { display: inline-flex; max-width: 100%; }
html[data-size="sm"] .row--sm,
html[data-size="md"] .row--md,
html[data-size="lg"] .row--lg { display: flex; }
.locked-only { display: none; }
html[data-locked="on"] .live-only { display: none; }
html[data-locked="on"] .locked-only { display: inline-flex; }

.fx-list { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.fx { padding: 2px 6px; border-radius: 5px; background: #151a29; border: 1px solid #232b40; color: #9fd0ff; font-family: ui-monospace, "Cascadia Code", Consolas, monospace; font-size: 11.5px; }
.fx-floor { display: inline-flex; flex-wrap: wrap; gap: 4px; align-items: center; font-size: 10.5px; color: #56637c; }
.pal { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.pal i { width: 13px; height: 13px; border-radius: 4px; border: 1px solid #2b3450; display: inline-block; }
.pal code { font-family: ui-monospace, "Cascadia Code", Consolas, monospace; font-size: 11.5px; }
.ico { display: flex; gap: 8px; align-items: center; color: #56637c; }
.ico svg { width: 24px; height: 24px; fill: none; stroke: #cfd9ea; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.ico code { font-family: ui-monospace, "Cascadia Code", Consolas, monospace; font-size: 11.5px; color: #56637c; }
`;

/* --------------------------------------------------------------------- сборка */

const rarityCounts = new Map();
for (const item of items) rarityCounts.set(item.rarity, (rarityCounts.get(item.rarity) ?? 0) + 1);

const dump = {
  generatedAt: new Date().toISOString(),
  source: {
    tags: "src/lib/progression/progression.config.ts → PROGRESSION_CONFIG.tags",
    cosmetics: "src/lib/cosmetics.ts → TITLES",
    guild: "src/lib/guild-cosmetics.ts → GUILD_TITLES",
    styles: "src/app/ag-tag.css",
  },
  counts: { tags: tags.length, cosmetics: cosmetics.length, guild: guild.length, total: items.length },
  items: items.map((item) => ({
    group: item.group,
    kind: item.kind,
    id: item.tag.id,
    name: item.name,
    description: item.tag.description,
    rarity: item.rarity,
    rarityLabel: item.rarityLabel,
    unlock: item.unlock,
    price: item.price ?? null,
    source: item.source,
    level: item.level,
    achievementId: item.achievementId,
    palette: { c: item.tag.visual.c, c2: item.tag.visual.c2 },
    text: item.tag.visual.text ?? "plain",
    effects: item.tag.visual.effects,
    effectsTotal: effectSet(item.tag),
    icon: item.tag.visual.icon,
  })),
};

const summary = [
  ...GROUPS.map((group) => {
    const list = items.filter((item) => item.group === group.id);
    return `<li><b>${list.length}</b><span>${esc(group.label)}</span></li>`;
  }),
  ...RARITY_ORDER.filter((r) => rarityCounts.has(r)).map(
    (r) =>
      `<li><b>${rarityCounts.get(r)}</b><span><span class="badge" data-r="${r}">${r}</span>${esc(RARITY_LABEL[r])}</span></li>`,
  ),
].join("");

const sections = GROUPS.map((group) => {
  const list = items.filter((item) => item.group === group.id);
  return `<section class="group" id="g-${group.id}" data-group="${group.id}">
  <h2>${esc(group.label)} <span class="count">${list.length}</span></h2>
  <p class="note">${esc(group.note)}</p>
  <div class="grid">${list.map(card).join("\n")}</div>
  <p class="empty" data-empty="${group.id}" hidden>Ничего не найдено.</p>
</section>`;
}).join("\n");

/* Стили капсулы — оба слоя, в том же порядке, что и в `layout.tsx`:
   сначала база `ag-tag.css`, поверх неё premium-слой. Без второго слоя
   каталог показывал бы старый вид, и сравнивать его с эталоном бессмысленно. */
const CSS_FILES = ["ag-tag.css", "ag-tag-premium.css"];
const agTagCss = CSS_FILES.map((file) => {
  const css = readFileSync(path.join(root, "src", "app", file), "utf8");
  if (css.includes("</style")) throw new Error(`${file} содержит </style — нельзя инлайнить`);
  return `/* ===== ${file} ===== */\n${css}`;
}).join("\n");

const html = renderPage({
  title: "Теги и титулы — AniGalaxy",
  lede: `Полная выгрузка гаммификации AniGalaxy: ${tags.length} тегов прогрессии и ${cosmetics.length + guild.length} титулов. Капсулы отрисованы той же разметкой и теми же стилями, что на сайте — <code>src/app/ag-tag.css</code> и premium-слой <code>ag-tag-premium.css</code> вшиты в файл целиком, а эффекты и частицы посчитаны настоящими хелперами визуального слоя. Файл работает офлайн, без сети.`,
  srcNote: `node tools/export-tags-titles.mjs · ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`,
  summary,
  toolbar: toolbar({
    searchPlaceholder: "Поиск по названию, id, описанию…",
    groups: [
      {
        set: "size",
        label: "Размер",
        items: SIZES.map((size) => ({ label: size, value: size, active: size === "md" })),
      },
      {
        set: "locked",
        label: "Вид",
        items: [{ type: "switch", label: "приглушённый (не получен)", value: "on" }],
      },
    ],
  }),
  sections,
  extraCss: `${agTagCss}\n${EXTRA_CSS}`,
  attrs: { size: "md", locked: "off" },
  dump,
  dumpLabel: `Сырые данные (JSON) — ${items.length} записей`,
  footer:
    "Источники: <code>src/lib/progression/progression.config.ts</code>, " +
    "<code>src/lib/cosmetics.ts</code>, <code>src/lib/guild-cosmetics.ts</code>. " +
    "Генератор: <code>tools/export-tags-titles.mjs</code>.",
});

writeFileSync(outFile, html, "utf8");

const kb = (Buffer.byteLength(html, "utf8") / 1024).toFixed(1);
console.log(
  `[export-tags-titles] ${tags.length} тегов · ${cosmetics.length} титулов косметики · ${guild.length} титулов магазина = ${items.length}`,
);
console.log(`[export-tags-titles] ${path.relative(root, outFile) || outFile} — ${kb} КБ`);
