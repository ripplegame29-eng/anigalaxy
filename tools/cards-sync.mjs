/**
 * Загрузка артов персонажей для карточек с AniList (публичный GraphQL API).
 *
 *   node tools/cards-sync.mjs            — скачать недостающие арты
 *   node tools/cards-sync.mjs --force    — перекачать все
 *   node tools/cards-sync.mjs --ambiguous — перекачать героев с одиночным именем (Haku, Ban, Karin…)
 *                                           с проверкой аниме: нужно, если у кого-то арт от тёзки
 *   node tools/cards-sync.mjs naruto-uzumaki  — только указанные id
 *
 * Файлы кладутся в data/cards-art/<id>.jpg (сервер делает то же самое сам в фоне). Пока файла нет, на карточке
 * рисуется стильная заглушка с инициалами. Скрипт можно запускать сколько
 * угодно раз: уже скачанное пропускается.
 */

import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "data", "cards-art");
mkdirSync(outDir, { recursive: true });

const src = readFileSync(path.join(root, "src", "lib", "cards", "catalog.ts"), "utf8");
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const seen = new Set();
const cards = [];
for (const line of src.split("\n")) {
  const m = /^[0-4]\|([^|]+)\|([^|]+)\|([^|]*)\|/.exec(line);
  if (!m) continue;
  let id = slug(m[2]);
  while (seen.has(id)) id += "-x";
  seen.add(id);
  cards.push({ id, name: m[1], search: m[2], series: m[3] });
}

const args = process.argv.slice(2);
const force = args.includes("--force");
const ambiguous = args.includes("--ambiguous");
const only = args.filter((a) => !a.startsWith("--"));
const todo = cards.filter((c) => (only.length ? only.includes(c.id) : true) && (force || (ambiguous && !/\s/.test(c.search.trim())) || !existsSync(path.join(outDir, `${c.id}.jpg`))));
console.log(`Карт в каталоге: ${cards.length}, к загрузке: ${todo.length}`);

const SERIES_KEYS = {
  "Наруто": ["naruto"],
  "Ван-Пис": ["one piece"],
  "Блич": ["bleach"],
  "Атака титанов": ["shingeki", "attack on titan"],
  "Истребитель демонов": ["kimetsu", "demon slayer"],
  "Магическая битва": ["jujutsu"],
  "Тетрадь смерти": ["death note"],
  "Стальной алхимик": ["fullmetal", "hagane"],
  "Охотник х Охотник": ["hunter x hunter"],
  "Драгонболл": ["dragon ball"],
  "Моя геройская академия": ["boku no hero", "my hero"],
  "Ванпанчмен": ["one punch", "one-punch"],
  "Мастера Меча Онлайн": ["sword art"],
  "Токийский гуль": ["tokyo ghoul"],
  "Семья шпиона": ["spy x family", "spy×family"],
  "Человек-бензопила": ["chainsaw"],
  "Провожающая в последний путь Фрирен": ["frieren", "sousou"],
  "Re:Zero": ["re:zero"],
  "Коносуба": ["kono subarashii", "konosuba"],
  "Хвост Феи": ["fairy tail"],
  "Чёрный клевер": ["black clover"],
  "Евангелион": ["evangelion"],
  "Врата Штейна": ["steins"],
  "Волейбол!!": ["haikyuu"],
  "Доктор Стоун": ["dr. stone", "dr stone"],
  "Судьба": ["fate"],
  "Ковбой Бибоп": ["cowboy bebop"],
  "Моб Психо 100": ["mob psycho"],
  "Невероятные приключения ДжоДжо": ["jojo"],
  "Код Гиасс": ["code geass"],
  "Поднятие уровня в одиночку": ["solo leveling", "ore dake"],
  "Оши но Ко": ["oshi no ko"],
  "Оверлорд": ["overlord"],
  "Гинтама": ["gintama"],
  "Семь смертных грехов": ["nanatsu", "seven deadly"],
  "О моём перерождении в слизь": ["slime", "tensei shitara"],
  "Хеллсинг": ["hellsing"],
  "Берсерк": ["berserk"],
  "Токийские мстители": ["tokyo revengers"],
  "Синяя тюрьма": ["blue lock"],
  "Пламенная бригада": ["fire force", "enen no shouboutai"],
};
const QUERY = `query ($q: String) { Page(page: 1, perPage: 15) { characters(search: $q, sort: FAVOURITES_DESC) { image { large } name { full alternative } media(perPage: 6, sort: POPULARITY_DESC) { nodes { title { romaji english } } } } } }`;

/** Выбирает персонажа нужного аниме среди тёзок (Haku из Наруто, а не из «Пламенной бригады») */
function pickImage(search, series, chars) {
  const q = search.toLowerCase().trim();
  const keys = SERIES_KEYS[series];
  let best = null;
  for (const c of chars) {
    const url = c.image?.large;
    if (!url || url.includes("default")) continue;
    const names = [c.name?.full, ...(c.name?.alternative ?? [])].filter(Boolean).map((n) => n.toLowerCase());
    const nameScore = names.some((n) => n === q) ? 3 : names.some((n) => n.split(/\s+/).includes(q) || n.startsWith(q) || q.startsWith(n)) ? 2 : names.some((n) => n.includes(q)) ? 1 : 0;
    const titles = (c.media?.nodes ?? []).flatMap((m) => [m.title?.romaji, m.title?.english]).filter(Boolean).map((t) => t.toLowerCase());
    const seriesOk = !keys || titles.some((t) => keys.some((k) => t.includes(k)));
    if (!seriesOk || nameScore === 0) continue;
    const score = nameScore + (keys ? 3 : 0);
    if (!best || score > best.score) best = { url, score };
  }
  return best ? best.url : null;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function find(search, series) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: QUERY, variables: { q: search } }),
      signal: AbortSignal.timeout(10000),
    });
    if (res.status === 429) {
      await sleep(Number(res.headers.get("retry-after") ?? 30) * 1000 + 500);
      continue;
    }
    const text = await res.text();
    if (!res.ok) throw new Error(`AniList вернул HTTP ${res.status}: ${text.replace(/\s+/g, " ").slice(0, 160)}`);
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`AniList вернул не JSON: ${text.replace(/\s+/g, " ").slice(0, 160)}`);
    }
    if (json?.errors?.length) throw new Error(`AniList: ${json.errors[0].message}`);
    return pickImage(search, series, json?.data?.Page?.characters ?? []);
  }
  throw new Error("AniList ограничил запросы (HTTP 429) — подождите несколько минут и запустите снова");
}

/** Запасные написания имени: AniList пишет японские имена по-разному (Shouko/Shoko, Jiro/Jirou) */
/** Точные id персонажей на MyAnimeList (= id на Shikimori) для тех, кого поиск находит неверно */
const MAL_IDS = { "sung-jinwoo": 174185 };

const OVERRIDES = {
  Jugo: ["Juugo", "Jūgo"],
  "Sung Jinwoo": ["Sung Jin-Woo", "Jinwoo Sung"],
  "Shoko Ieiri": ["Shouko Ieiri", "Ieiri Shouko"],
  "Barragan Luisenbarn": ["Baraggan Louisenbairn", "Baraggan"],
  "Zeref Dragneel": ["Zeref"],
};
function variants(name) {
  const set = new Set([name, ...(OVERRIDES[name] ?? [])]);
  const parts = name.split(/\s+/);
  if (parts.length === 2) set.add(`${parts[1]} ${parts[0]}`);
  for (const v of [...set]) {
    set.add(v.replace(/ou/gi, "o").replace(/oo/gi, "o").replace(/uu/gi, "u"));
    set.add(v.replace(/o(?=[^aeiouy]|\b)/g, "ou"));
  }
  return [...set];
}
/** Второй источник — MyAnimeList через Jikan: выручает, когда AniList не находит персонажа */
async function findJikan(name) {
  for (const v of variants(name).slice(0, 3)) {
    try {
      const res = await fetch(`https://api.jikan.moe/v4/characters?q=${encodeURIComponent(v)}&order_by=favorites&sort=desc&limit=1`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
      if (res.status === 429) {
        await sleep(2500);
        continue;
      }
      if (!res.ok) continue;
      const json = await res.json();
      const url = json?.data?.[0]?.images?.jpg?.image_url;
      if (url && !url.includes("questionmark")) return url;
    } catch {
      /* сеть недоступна — пробуем следующий вариант */
    }
    await sleep(500);
  }
  return null;
}

/** Shikimori: работает без VPN, понимает и английские, и русские имена.
 *  Каждого кандидата проверяем по списку его аниме, иначе вместо героя можно получить тёзку. */
async function findShikimori(names, series) {
  const keys = SERIES_KEYS[series];
  const get = async (path) => {
    for (const host of ["https://shikimori.one", "https://shikimori.io"]) {
      try {
        const res = await fetch(`${host}${path}`, { headers: { Accept: "application/json", "User-Agent": "AniGalaxy art sync" }, signal: AbortSignal.timeout(8000) });
        if (res.status === 429) {
          await sleep(1500);
          continue;
        }
        if (res.ok) return { host, data: await res.json() };
      } catch {
        /* хост недоступен — пробуем зеркало */
      }
    }
    return null;
  };
  for (const n of names) {
    const found = await get(`/api/characters/search?search=${encodeURIComponent(n)}&limit=4`);
    for (const cand of (found?.data ?? []).slice(0, 3)) {
      const path = cand?.image?.original;
      if (!path || path.includes("missing")) continue;
      if (keys) {
        await sleep(250);
        const detail = await get(`/api/characters/${cand.id}`);
        const titles = (detail?.data?.animes ?? []).flatMap((a) => [a.name, a.russian]).filter(Boolean).map((t) => t.toLowerCase());
        if (!titles.some((t) => keys.some((k) => t.includes(k)))) continue;
      }
      return path.startsWith("http") ? path : `${found.host}${path}`;
    }
    await sleep(350);
  }
  return null;
}

async function findByMalId(id) {
  for (const host of ["https://shikimori.one", "https://shikimori.io"]) {
    try {
      const res = await fetch(`${host}/api/characters/${id}`, { headers: { Accept: "application/json", "User-Agent": "AniGalaxy art sync" }, signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const path = (await res.json())?.image?.original;
      if (path && !path.includes("missing")) return path.startsWith("http") ? path : `${host}${path}`;
    } catch {
      /* пробуем зеркало */
    }
  }
  return null;
}

async function findAny(name, ru, series, id) {
  if (MAL_IDS[id]) {
    const exact = await findByMalId(MAL_IDS[id]);
    if (exact) return exact;
  }
  const multi = /\s/.test(name.trim());
  // у одиночных имён (Haku, Ban, Karin) запасные источники не знают аниме и подсунут тёзку
  const fromShiki = multi ? await findShikimori([...variants(name).slice(0, 2), ru].filter(Boolean), series) : null;
  if (fromShiki) return fromShiki;
  for (const v of variants(name)) {
    const url = await find(v, series);
    if (url && !url.includes("default.jpg")) return url;
    await sleep(400);
  }
  return null;
}

let ok = 0;
const failed = [];
for (const [i, c] of todo.entries()) {
  try {
    const url = await findAny(c.search, c.name, c.series, c.id);
    if (!url || url.includes("default.jpg")) throw new Error(`персонаж «${c.search}» не найден на AniList`);
    const img = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!img.ok) throw new Error(`HTTP ${img.status}`);
    writeFileSync(path.join(outDir, `${c.id}.jpg`), Buffer.from(await img.arrayBuffer()));
    ok += 1;
    console.log(`[${i + 1}/${todo.length}] ✓ ${c.name}`);
  } catch (e) {
    failed.push(c.id);
    console.log(`[${i + 1}/${todo.length}] ✗ ${c.name} — ${e.message}`);
  }
  await sleep(750);
}
console.log(`Готово: скачано ${ok}, не найдено ${failed.length}${failed.length ? ` (${failed.join(", ")})` : ""}`);
if (failed.length === todo.length && todo.length) console.log("Похоже, нет доступа к AniList — проверьте интернет/VPN и запустите ещё раз.");
