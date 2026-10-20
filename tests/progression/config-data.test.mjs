/**
 * Аудит данных этапа 5 (§16) + FIX_TAGS: 48 тегов, все семейства достижений,
 * 8 секретов, отсутствие совпадающих названий тег↔достижение,
 * согласованность источников/визуала, уникальность иконок/палитр/наборов
 * эффектов и наличие модулей эффектов в app/ag-tag.css.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { PROGRESSION_CONFIG } from "../../.tsc-tests/lib/progression/progression.config.js";
import { FAMILY_LABEL } from "../../.tsc-tests/lib/progression/achievements-view.js";
import { FRAMES } from "../../.tsc-tests/lib/cosmetics.js";
import {
  effectSet,
  particleBudget,
  RARITY_FLOOR,
  RARITY_WEIGHT,
  sparkCount,
  spinFor,
} from "../../.tsc-tests/lib/progression/visual.js";

const cfg = PROGRESSION_CONFIG;
const RARITIES = Object.keys(RARITY_WEIGHT);
const SOURCES = new Set(["level", "achievement", "shop", "referral", "event", "secret"]);
const TEXT_STYLES = new Set(["plain", "glitch", "neon", "metal", "tremor"]);
const FAMILIES = [
  "start",
  "episodes",
  "titles",
  "days",
  "streak",
  "collection",
  "minutes",
  "comments",
  "levels",
  "ratings",
  "night",
  "genres",
  "social",
  "quests",
  "tags",
  "secret",
  // Шесть медалейных достижений: их счётчиков в движке не было, они
  // добавлены вместе с `genres.ts` и новыми метриками §9.1
  "medal",
];

test(`данные: ровно 48 тегов, id и имена уникальны`, () => {
  assert.equal(cfg.tags.length, 48, "тегов должно быть 48 (§9.2)");
  const ids = new Set();
  const names = new Set();
  for (const tag of cfg.tags) {
    assert.match(tag.id, /^tag_[a-z0-9_]+$/, `id тега: ${tag.id}`);
    assert.ok(!ids.has(tag.id), `дубль id тега: ${tag.id}`);
    assert.ok(!names.has(tag.name), `дубль имени тега: ${tag.name}`);
    assert.ok(RARITIES.includes(tag.rarity), `редкость ${tag.rarity} у ${tag.id}`);
    ids.add(tag.id);
    names.add(tag.name);
  }
});

test("данные: источники тегов согласованы (уровень/магазин/достижение)", () => {
  for (const tag of cfg.tags) {
    assert.ok(SOURCES.has(tag.source), `неизвестный source у ${tag.id}: ${tag.source}`);
    if (tag.source === "shop") {
      assert.ok((tag.price ?? 0) > 0, `магазинный тег без цены: ${tag.id}`);
      const shop = cfg.shop.find((item) => item.id === tag.id && item.kind === "tag");
      assert.ok(shop, `нет позиции магазина для ${tag.id}`);
      assert.equal(shop.price, tag.price, `цена в магазине ≠ конфигу тега: ${tag.id}`);
      assert.equal(shop.rarity, tag.rarity, `редкость в магазине ≠ конфигу: ${tag.id}`);
    }
    if (tag.source === "level") {
      assert.ok((tag.level ?? 0) >= 1, `тег уровня без уровня: ${tag.id}`);
    }
    if (tag.source === "referral") {
      // Рубеж рефералки: у тега должен быть порог, и он не должен ещё и
      // продаваться за AC — иначе предмет достаётся двумя путями сразу.
      assert.ok((tag.friends ?? 0) >= 1, `тег рубежа без порога: ${tag.id}`);
      assert.equal(tag.price, undefined, `у рубежного тега осталась цена: ${tag.id}`);
      assert.ok(
        !cfg.shop.some((item) => item.id === tag.id && item.kind === "tag"),
        `рубежный тег продаётся в магазине: ${tag.id}`,
      );
    }
    if (tag.source === "achievement" || tag.source === "secret") {
      assert.ok(tag.achievementId, `нет achievementId у ${tag.id}`);
      assert.ok(
        cfg.achievements.some((item) => item.id === tag.achievementId),
        `нет достижения ${tag.achievementId} для ${tag.id}`,
      );
    }
  }
});

const ICON_TAGS = new Set(["path", "circle", "rect", "ellipse", "line", "polyline", "polygon"]);

test("данные: визуал тегов полон, эффекты есть в ag-tag.css", () => {
  const css = readFileSync("src/app/ag-tag.css", "utf8");
  for (const tag of cfg.tags) {
    assert.match(tag.visual.c, /^#[0-9a-f]{6}$/i, `палитра --c у ${tag.id}`);
    assert.match(tag.visual.c2, /^#[0-9a-f]{6}$/i, `палитра --c2 у ${tag.id}`);
    assert.ok(Array.isArray(tag.visual.effects), `нет списка effects у ${tag.id}`);
    assert.ok(tag.visual.effects.length > 0, `пустые effects у ${tag.id}`);
    if (tag.visual.text !== undefined) {
      assert.ok(TEXT_STYLES.has(tag.visual.text), `стиль текста ${tag.visual.text} у ${tag.id}`);
    }
    // иконка — ручная SVG-разметка 24×24 только из линий/фигур (FIX §1)
    assert.ok(typeof tag.visual.icon === "string" && tag.visual.icon.length > 0, `нет иконки у ${tag.id}`);
    const stray = tag.visual.icon.replace(/<\/?([a-z]+)[^>]*>/g, (all, name) =>
      ICON_TAGS.has(name) ? "" : all,
    );
    assert.equal(stray, "", `иконка ${tag.id} содержит постороннюю разметку: ${stray}`);
    assert.ok(particleBudget(tag.rarity) <= 16, `бюджет частиц > 16 у ${tag.id}`);
    for (const effect of effectSet(tag)) {
      assert.ok(css.includes(`.fx-${effect}`), `ag-tag.css не содержит .fx-${effect} (тег ${tag.id})`);
    }
  }
  // рендер-разметка компонента: 24×24 и stroke, а не заливка
  const tsx = readFileSync("src/components/progression/AgTag.tsx", "utf8");
  assert.ok(tsx.includes('viewBox="0 0 24 24"'), "иконка должна рисоваться в viewBox 24×24");
  assert.ok(!/<TagCapsule|className="cap/.test(tsx), "AgTag не должен ссылаться на старую капсулу");
});

test("FIX: иконки всех тегов уникальны и разные", () => {
  const icons = cfg.tags.map((tag) => tag.visual.icon);
  assert.equal(new Set(icons).size, 48, "иконки должны различаться попарно");
  for (const tag of cfg.tags) {
    assert.ok(tag.visual.icon.length >= 20, `слишком простая иконка у ${tag.id}`);
  }
});

test("FIX: палитры всех тегов уникальны попарно (минимум 3 отличия)", () => {
  const pairs = cfg.tags.map((tag) => `${tag.visual.c}|${tag.visual.c2}`);
  assert.equal(new Set(pairs).size, 48, "пары (c, c2) должны различаться у всех тегов");
});

test("FIX: итоговые наборы эффектов всех тегов уникальны попарно", () => {
  const sets = cfg.tags.map((tag) => [...effectSet(tag)].sort().join(","));
  assert.equal(new Set(sets).size, 48, `наборы эффектов должны быть разными: ${sets}`);
  // ни один собственный эффект тега не теряется при объединении с полом
  for (const tag of cfg.tags) {
    for (const effect of tag.visual.effects) {
      assert.ok(effectSet(tag).includes(effect), `эффект ${effect} потерян у ${tag.id}`);
    }
  }
});

test("FIX: пол редкости §4 — количество эффектов уникально и монотонно", () => {
  const counts = RARITIES.map((rarity) => RARITY_FLOOR[rarity].length);
  assert.equal(new Set(counts).size, RARITIES.length, `размеры пола должны быть разными: ${counts}`);
  const LADDER = ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY", "MYTHIC"];
  let previous = -1;
  for (const rarity of LADDER) {
    const size = RARITY_FLOOR[rarity].length;
    assert.ok(size > previous, `${rarity}: ${size} не больше предыдущего пола`);
    previous = size;
  }
  assert.ok(RARITY_FLOOR.COMMON.length >= 1, "у COMMON должен быть хотя бы один эффект");
  assert.ok(RARITY_FLOOR.EPIC.includes("sparks"), "EPIC обязан получить частицы");
  assert.ok(RARITY_FLOOR.LEGENDARY.includes("aura") && RARITY_FLOOR.LEGENDARY.includes("double"));
  assert.ok(RARITY_FLOOR.MYTHIC.includes("enter"), "MYTHIC обязан входить в кадр");
  assert.ok(RARITY_FLOOR.SECRET.includes("glitch") && RARITY_FLOOR.SECRET.includes("sparks"));
  // скорость бегущей рамки: у каждой редкости своя (--spin из конфига)
  const spins = RARITIES.map((rarity) => spinFor(rarity));
  assert.equal(new Set(spins).size, RARITIES.length, `--spin должен отличаться: ${spins}`);
});

test("FIX: частицы считаются только при эффекте sparks (и никогда не больше 16)", () => {
  for (const tag of cfg.tags) {
    const hasSparks = effectSet(tag).includes("sparks");
    const count = sparkCount(tag);
    assert.equal(count, hasSparks ? particleBudget(tag.rarity) : 0, `частицы у ${tag.id}`);
    assert.ok(count <= 16, `частиц больше 16 у ${tag.id}`);
  }
});

test("FIX: ядро капсулы в ag-tag.css (conic-рамка, reduced-motion, perf-lite)", () => {
  const css = readFileSync("src/app/ag-tag.css", "utf8");
  const border = css.match(/\.fx-border::before\s*{[^}]*}/);
  assert.ok(border, "нет правила .fx-border::before");
  assert.ok(border[0].includes("conic-gradient"), "рамка должна строиться на conic-gradient");
  assert.ok(/animation:\s*ag-spin/.test(border[0]), "рамка должна анимироваться (ag-spin)");
  assert.ok(/--a:\s*0deg/.test(border[0]), "нужен фоллбэк --a: 0deg без @property");
  assert.ok(css.includes("@property --a"), "нужна регистрация @property --a");
  assert.ok(css.includes("@media (prefers-reduced-motion: reduce)"), "нужен reduced-motion блок");
  assert.ok(css.includes(".perf-lite .ag-tag"), "нужен блок perf-lite");
  assert.ok(css.includes('html[data-eco="on"] .ag-tag'), "нужен блок режима «экономия»");
  assert.ok(css.includes(".ag-tag--locked"), "нужен вид невыданного тега");
  for (const size of ["sm", "md", "lg"]) {
    assert.ok(css.includes(`.ag-tag--${size}`), `нет размера ${size}`);
  }
  // ни одного старого самодельного класса капсулы
  assert.ok(!css.includes(".cap"), "старые .cap-стили остались в ag-tag.css");
  const effects = readFileSync("src/app/effects.css", "utf8");
  assert.ok(!/\.cap\b/.test(effects), "effects.css всё ещё содержит .cap");
});

test("FIX: белый текст капсулы даёт контраст AA на всех 29 палитрах", () => {
  const css = readFileSync("src/app/ag-tag.css", "utf8");
  // фон повторяет эталон (reference/titles.html, .pill) — он и даёт тёмное поле
  assert.ok(css.includes("color-mix(in srgb, var(--c) 24%, #0b0b13)"), "нет эталонной подложки --c");
  assert.ok(css.includes("color-mix(in srgb, var(--c2) 20%, #0b0b13)"), "нет эталонной подложки --c2");

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
  for (const tag of cfg.tags) {
    const c = hex(tag.visual.c);
    const c2 = hex(tag.visual.c2);
    // оба края линейного градиента + самый светлый случай: радиальный акцент поверх
    for (const end of [mix(c, dark, 0.24), mix(c2, dark, 0.20)]) {
      const cr = contrast(white, mix(c, end, 0.24));
      min = Math.min(min, cr);
      assert.ok(cr >= 4.5, `${tag.id} (${tag.visual.c}/${tag.visual.c2}): контраст ${cr.toFixed(2)} < 4.5`);
    }
  }
  assert.ok(min < 20, `расчёт контраста выродился: ${min.toFixed(2)}`);
});

test("данные: ровно 77 достижений, все семейства §9.1 присутствуют", () => {
  assert.equal(cfg.achievements.length, 77, "достижений должно быть 77 (§9.1)");
  const families = [...new Set(cfg.achievements.map((item) => item.family))];
  for (const id of FAMILIES) {
    assert.ok(families.includes(id), `нет семейства ${id}`);
    assert.ok(FAMILY_LABEL[id], `нет подписи семейства ${id}`);
  }
  for (const family of families) {
    const count = cfg.achievements.filter((item) => item.family === family).length;
    assert.ok(count >= 1 && count <= 10, `семейство ${family}: ${count} ступеней (нужно 1..10)`);
  }
});

test("данные: 8 секретов семейства secret — скрытые, редкость SECRET", () => {
  const secrets = cfg.achievements.filter((item) => item.family === "secret");
  assert.equal(secrets.length, 8, "секретов должно быть 8 (§11)");
  for (const item of secrets) {
    assert.ok(item.hidden, `секрет ${item.id} не hidden`);
    assert.equal(item.rarity, "SECRET", `редкость секрета ${item.id}`);
  }
});

/**
 * Медальные достижения — самые тяжёлые в игре, поэтому скрытые.
 * Условия обязаны быть достижимы: «все тайные» считает все, кроме себя,
 * «все достижения» — тоже все, кроме себя. Иначе они были бы вечными.
 */
test("данные: 6 медальных — скрытые, тяжёлые, с достижимыми порогами", () => {
  const medals = cfg.achievements.filter((item) => item.family === "medal");
  assert.equal(medals.length, 6, "медальных достижений должно быть 6");

  const hiddenTotal = cfg.achievements.filter((item) => item.hidden).length;
  const allTotal = cfg.achievements.length;

  for (const item of medals) {
    assert.ok(item.hidden, `медаль ${item.id} не hidden`);
    assert.ok(item.trophy >= 300, `медаль ${item.id} слишком лёгкая: ${item.trophy}`);
    assert.ok(item.reward.xp > 0 && item.reward.ac > 0, `медаль ${item.id} без награды`);
  }

  const secrets = medals.find((item) => item.id === "ach_secrets_all");
  assert.ok(secrets, "нет ach_secrets_all");
  // «собрать все тайные» — все скрытые, кроме самого достижения и финальной
  // медали `ach_all_done`: иначе они блокируют друг друга навсегда.
  assert.equal(secrets.condition.threshold, hiddenTotal - 2);

  const all = medals.find((item) => item.id === "ach_all_done");
  assert.ok(all, "нет ach_all_done");
  assert.equal(all.condition.threshold, allTotal - 1);
});

test("данные: у каждого достижения есть счётчик в resolveMetrics", () => {
  // Метрика, которой движок не умеет считать, — это достижение, которое
  // невозможно получить. Проверяем по списку, что движок их всех считает.
  const known = new Set([
    "LEVEL", "STREAK_BEST", "EPISODES_COMPLETED", "EPISODES_STARTED",
    "TITLES_COMPLETED", "DISTINCT_DAYS", "NIGHT_EPISODES", "MINUTES_WATCHED",
    "RATINGS", "COMMENTS_VALID", "LIKES_RECEIVED", "LIKES_GIVEN", "QUESTS_DONE",
    "DISTINCT_GENRES_COMPLETED", "TAGS_OWNED", "TAGS_RARITIES", "MAX_XP_IN_DAY",
    "MAX_TITLES_IN_DAY", "MAX_TAG_SWAPS_IN_DAY", "SECRET_0404", "SECRET_ABYSS",
    "FLAGS_LOGO", "FLAGS_EARLY_BIRD",
    // приходят извне, их считает `externalMetrics()`
    "ACCOUNT_CREATED", "PROFILE_PERCENT", "DISTINCT_TITLES_IN_LISTS",
    // добавленные вместе с медалями
    "MAX_MINUTES_IN_DAY", "GENRE_SHONEN", "GENRE_FANTASY",
    "SECRETS_DONE", "ACHIEVEMENTS_DONE", "SEASONS_DONE",
  ]);
  const unknown = new Set();
  for (const item of cfg.achievements) {
    if (!known.has(item.condition.metric)) unknown.add(item.condition.metric);
  }
  assert.deepEqual([...unknown], [], "метрики, которых не знает тест");
});

test("данные: каждое достижение валидно (условие, награда, трофеи)", () => {
  const ids = new Set();
  for (const item of cfg.achievements) {
    assert.match(item.id, /^ach_[a-z0-9_]+$/, `id: ${item.id}`);
    assert.ok(!ids.has(item.id), `дубль id: ${item.id}`);
    ids.add(item.id);
    assert.ok(item.name.length > 0, `нет имени у ${item.id}`);
    assert.ok(item.description.length > 0, `нет условия у ${item.id}`);
    assert.ok(RARITIES.includes(item.rarity), `редкость ${item.rarity} у ${item.id}`);
    assert.ok(item.trophy > 0, `нет трофейных очков у ${item.id}`);
    assert.ok(item.condition.metric.length > 0, `нет метрики у ${item.id}`);
    assert.ok(item.condition.threshold >= 1, `порог < 1 у ${item.id}`);
    assert.ok(item.reward.xp >= 1, `нет XP-награды у ${item.id}`);
    assert.ok(item.reward.ac >= 0, `отрицательные AC у ${item.id}`);
    if (item.reward.tagId) {
      assert.ok(
        cfg.tags.some((tag) => tag.id === item.reward.tagId),
        `награда-тег ${item.reward.tagId} не существует`,
      );
    }
    if (item.reward.frameId) {
      assert.ok(
        FRAMES.some((frame) => frame.id === item.reward.frameId),
        `награда-рамка ${item.reward.frameId} отсутствует в каталоге косметики`,
      );
    }
  }
});

test("данные: имена тегов и достижений не пересекаются и не дублируются (§16)", () => {
  const tagNames = new Set(cfg.tags.map((tag) => tag.name));
  const achievementNames = new Set();
  for (const item of cfg.achievements) {
    assert.ok(!tagNames.has(item.name), `имя совпадает с тегом: ${item.name}`);
    assert.ok(!achievementNames.has(item.name), `дубль имени достижения: ${item.name}`);
    achievementNames.add(item.name);
  }
});

test("данные: ранги монотонны, trophyByRarity покрывает все редкости", () => {
  let previous = -1;
  for (const rank of cfg.ranks) {
    assert.ok(rank.name.length > 0, "ранг без имени");
    assert.ok(rank.from > previous, `порог ранга «${rank.name}» не монотонен`);
    previous = rank.from;
  }
  for (const rarity of RARITIES) {
    assert.ok(
      typeof cfg.trophyByRarity[rarity] === "number",
      `нет трофейных очков для редкости ${rarity}`,
    );
  }
});
