/**
 * Титулы косметики (`src/lib/cosmetics.ts`): они рендерятся той же
 * капсулой `ag-tag`, что и теги прогрессии (через `titleTag`), поэтому
 * держат те же инварианты FIX_TAGS — уникальные иконки/палитры, эффекты
 * из библиотеки `ag-tag.css` и контраст AA белого текста на формуле
 * эталонного фона. Отдельно закреплён титул «Donater» (красный стиль).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { TITLES, titleTag } from "../../.tsc-tests/lib/cosmetics.js";
import { effectSet } from "../../.tsc-tests/lib/progression/visual.js";

const ICON_TAGS = new Set(["path", "circle", "rect", "ellipse", "line", "polyline", "polygon"]);
const TEXT_STYLES = new Set(["plain", "glitch", "neon", "metal", "tremor"]);

test("титулы: 15 штук, id и имена уникальны, описания заполнены, Donater присутствует", () => {
  assert.equal(TITLES.length, 15);
  const ids = new Set();
  const names = new Set();
  for (const item of TITLES) {
    assert.match(item.id, /^t-[a-z0-9-]+$/, `id титула: ${item.id}`);
    assert.ok(!ids.has(item.id), `дубль id титула: ${item.id}`);
    assert.ok(!names.has(item.name), `дубль имени титула: ${item.name}`);
    assert.ok(item.description.length >= 12, `нет описания у ${item.id}`);
    ids.add(item.id);
    names.add(item.name);
  }
  assert.ok(TITLES.some((item) => item.id === "t-donater"), "нет титула Donater");
});

test("титулы: визуал полон, эффекты есть в ag-tag.css", () => {
  const css = readFileSync("src/app/ag-tag.css", "utf8");
  for (const item of TITLES) {
    assert.match(item.visual.c, /^#[0-9a-f]{6}$/i, `палитра --c у ${item.id}`);
    assert.match(item.visual.c2, /^#[0-9a-f]{6}$/i, `палитра --c2 у ${item.id}`);
    assert.ok(item.visual.effects.length > 0, `пустые effects у ${item.id}`);
    if (item.visual.text !== undefined) {
      assert.ok(TEXT_STYLES.has(item.visual.text), `стиль текста ${item.visual.text} у ${item.id}`);
    }
    // иконка — ручная SVG-разметка 24×24 только из линий/фигур (FIX §1)
    assert.ok(item.visual.icon.length >= 20, `слишком простая иконка у ${item.id}`);
    const stray = item.visual.icon.replace(/<\/?([a-z]+)[^>]*>/g, (all, name) =>
      ICON_TAGS.has(name) ? "" : all,
    );
    assert.equal(stray, "", `иконка ${item.id} содержит постороннюю разметку: ${stray}`);
    // итоговый набор (свой эффект + пол редкости) целиком покрыт CSS
    for (const effect of effectSet(titleTag(item))) {
      assert.ok(css.includes(`.fx-${effect}`), `ag-tag.css не содержит .fx-${effect} (титул ${item.id})`);
    }
  }
});

test("титулы: иконки и палитры уникальны попарно (разноцветные)", () => {
  const icons = TITLES.map((item) => item.visual.icon);
  assert.equal(new Set(icons).size, TITLES.length, "иконки титулов должны различаться попарно");
  const pairs = TITLES.map((item) => `${item.visual.c}|${item.visual.c2}`);
  assert.equal(new Set(pairs).size, TITLES.length, "пары (c, c2) должны различаться у всех титулов");
});

test("titleTag: редкость маппится в шкалу прогрессии, id с префиксом", () => {
  const expected = { common: "COMMON", rare: "RARE", epic: "EPIC", legendary: "LEGENDARY" };
  for (const item of TITLES) {
    const tag = titleTag(item);
    assert.equal(tag.id, `title_${item.id}`);
    assert.equal(tag.name, item.name);
    assert.equal(tag.rarity, expected[item.rarity], `редкость ${item.id}`);
    assert.equal(tag.visual, item.visual, "визуал передаётся по ссылке без копий");
  }
});

test("титулы: белый текст капсулы даёт контраст AA на всех палитрах", () => {
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lum = ([r, g, b]) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const mix = (a, b, t) => a.map((v, i) => v * t + b[i] * (1 - t));
  const contrast = (fg, bg) => {
    const L1 = lum(fg);
    const L2 = lum(bg);
    const hi = Math.max(L1, L2);
    const lo = Math.min(L1, L2);
    return (hi + 0.05) / (lo + 0.05);
  };
  const dark = hex("#0b0b13");
  const white = [255, 255, 255];

  let min = Infinity;
  for (const item of TITLES) {
    const c = hex(item.visual.c);
    const c2 = hex(item.visual.c2);
    // та же формула фона, что и в config-data.test.mjs (эталон .pill)
    for (const end of [mix(c, dark, 0.24), mix(c2, dark, 0.20)]) {
      const cr = contrast(white, mix(c, end, 0.24));
      min = Math.min(min, cr);
      assert.ok(cr >= 4.5, `${item.id} (${item.visual.c}/${item.visual.c2}): контраст ${cr.toFixed(2)} < 4.5`);
    }
  }
  assert.ok(min < 20, `расчёт контраста выродился: ${min.toFixed(2)}`);
});

test("титул Donater: яркий розово-фиолетовый стиль, за Premium, редкость legendary", () => {
  const item = TITLES.find((t) => t.id === "t-donater");
  assert.ok(item, "нет титула t-donater");
  assert.equal(item.name, "Donater");
  assert.equal(item.rarity, "legendary");
  assert.equal(item.unlock.premium, true, "Donater открывается подпиской");
  assert.equal(item.visual.c, "#ff4fb8");
  assert.equal(item.visual.c2, "#8b3dff");
  assert.ok(item.visual.effects.includes("shine"), "яркий стиль — с блеском");
  assert.ok(item.visual.effects.includes("aura"), "яркий стиль — с аурой");
  // и капсула получает его корректно
  const tag = titleTag(item);
  assert.equal(tag.rarity, "LEGENDARY");
  assert.ok(effectSet(tag).includes("shine"));
});
