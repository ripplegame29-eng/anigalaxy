/* ============================================================
   AnimeHub — одностраничник для просмотра аниме
   База:  AniList GraphQL API (открытый, без ключа, CORS *)
   Видео: поиск роликов через Piped/Invidious-инстансы (CORS *)
          + воспроизведение официальным YouTube-плеером
   Плюс:  HLS-режим (hls.js) для своих источников m3u8/mp4
   ============================================================ */

/* ---------------- Утилиты ---------------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

let toastT = 0;
function toast(msg, ok = false) {
  const box = $("#toasts");
  const el = document.createElement("div");
  el.className = "toast" + (ok ? " ok" : "");
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; el.style.transition = ".4s"; setTimeout(() => el.remove(), 400); }, 4200);
  if (Date.now() - toastT < 400) el.remove();
  toastT = Date.now();
}

const fmtTime = (sec) => {
  if (!sec && sec !== 0) return "";
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h ? `${h} ч ${m} мин` : `${m} мин`;
};
const fmtViews = (n) => n >= 1e6 ? (n / 1e6).toFixed(1) + " млн" : n >= 1e3 ? Math.round(n / 1e3) + " тыс" : String(n || "");

/* ---------------- Конфигурация ---------------- */
const CFG = {
  anilist: "https://graphql.anilist.co",
  perPage: 24,

  // Поисковики видео (открытые API с CORS). Проверяются по очереди.
  proxies: [
    { id: "auto",        name: "Авто — по очереди",        type: "auto",       url: "" },
    { id: "piped-coffee",name: "Piped · private.coffee",   type: "piped",      url: "https://api.piped.private.coffee" },
    { id: "piped-ducks", name: "Piped · ducks.party",      type: "piped",      url: "https://pipedapi.ducks.party" },
    { id: "inv-f5",      name: "Invidious · f5.si",        type: "invidious",  url: "https://invidious.f5.si" },
    { id: "inv-mat",     name: "Invidious · materialio.us",type: "invidious",  url: "https://invidious.materialio.us" },
  ],

  // Официальные / правообладательские каналы (ищем в первую очередь)
  trusted: [
    "muse asia", "muse indonesia", "muse philippines", "muse malaysia", "muse türkiye",
    "ani-one", "anime log", "crunchyroll", "bilibili", "bilibili tv", "retrocrush",
    "hanabee", "viz media", "anitube", "anime digital network", "aniplex", "toei animation",
    "kodansha", "funimation", "sentai", "anime plus", "zakzak", "muse drama",
  ],

  genres: [
    ["Action","Экшен"],["Adventure","Приключения"],["Comedy","Комедия"],["Drama","Драма"],
    ["Fantasy","Фэнтези"],["Horror","Ужасы"],["Mahou Shoujo","Магические девочки"],["Mecha","Меха"],
    ["Music","Музыка"],["Mystery","Детектив"],["Psychological","Психология"],["Romance","Романтика"],
    ["Sci-Fi","Киберпанк"],["Slice of Life","Повседневность"],["Sports","Спорт"],["Supernatural","Сверхъестественное"],
    ["Thriller","Триллер"],["Isekai","Исэкай"],["School","Школа"],["Military","Военное"],
    ["Samurai","Самураи"],["Vampire"," Вампиры"],["Historical","Историческое"],["Space","Космос"],
    ["Super Power","Суперсилы"],["Shounen","Сёнэн"],["Seinen","Сэйнэн"],["Shoujo","Сёдзё"],
    ["Slice of Life","Комфорт"],["Parody","Пародия"],["Games","Игры"],["Martial Arts","Боевые искусства"],
    ["Harem","Гарем"],["Josei","Дзёсей"],["Kids","Детское"],["Police","Полиция"],["Tragedy","Трагедия"],
  ],
};

/* ---------------- Состояние ---------------- */
const state = {
  view: "home",
  q: "",
  page: 1,
  list: [],
  loading: false,
  media: null,       // текущее аниме (модалка/плеер)
  favorites: store.get("ah_favs", []),
  history: store.get("ah_hist", []),
  opts: store.get("ah_opts", { trusted: true, hq: true, proxy: "auto" }),
};

/* ============================================================
   1. AniList GraphQL
   ============================================================ */
const FRAG = `
fragment S on Media {
  id
  title { romaji english native }
  coverImage { extraLarge large color }
  bannerImage
  format episodes duration status season seasonYear year
  averageScore meanScore popularity genres
  description(asHtml: false)
  nextAiringEpisode { episode airingAt }
}`;

const Q = {
  list: `query ($page:Int,$perPage:Int,$sort:[MediaSort],$search:String,$genre_in:[String],$format:MediaFormat,$status:MediaStatus,$season:MediaSeason,$seasonYear:Int){
    Page(page:$page, perPage:$perPage){
      pageInfo { currentPage hasNextPage }
      media(type:ANIME, isAdult:false, sort:$sort, search:$search, genre_in:$genre_in,
            format:$format, status:$status, season:$season, seasonYear:$seasonYear){ ...S }
    }
  }${FRAG}`,

  home: `query ($page:Int,$perPage:Int,$sort:[MediaSort],$format:MediaFormat,$season:MediaSeason,$seasonYear:Int){
    Page(page:$page, perPage:$perPage){
      pageInfo { currentPage hasNextPage }
      media(type:ANIME, isAdult:false, sort:$sort, format:$format, season:$season, seasonYear:$seasonYear){ ...S }
    }
  }${FRAG}`,

  detail: `query ($id:Int){
    Media(id:$id, type:ANIME){
      ...S
      countryOfOrigin source favourites trending hashtags
      startDate { year month day } endDate { year month day }
      studios(isMain:true){ nodes { name } }
      trailer { id site }
      externalLinks { site url }
      streamingEpisodes { site title url thumbnail }
      recommendations(perPage:14, sort:RATING_DESC){ nodes { media { ...S } } }
      relations { edges { relationType node { ... on Media { ...S } } } }
    }
  }${FRAG}`,
};

const gcache = new Map(); // кэш запросов (какао-сессия)
async function gql(query, variables = {}, useCache = true) {
  const key = query.slice(0, 60) + JSON.stringify(variables);
  if (useCache && gcache.has(key)) return gcache.get(key);

  let res;
  try {
    res = await fetch(CFG.anilist, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables }),
    });
  } catch { throw new Error("Нет связи с AniList"); }

  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 1500));
    return gql(query, variables, false);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.errors) throw new Error(json?.errors?.[0]?.message || "Ошибка AniList " + res.status);
  if (useCache) gcache.set(key, json.data);
  return json.data;
}

/* ============================================================
   2. Поиск видео (Piped / Invidious)
   ============================================================ */
async function fetchJSON(url, ms = 9000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

function normalizePiped(j) {
  return (j.items || [])
    .filter((i) => i.type === "stream" && /watch\?v=/.test(i.url || ""))
    .map((i) => ({
      id: i.url.split("v=")[1],
      title: i.title || "",
      channel: i.uploaderName || "",
      duration: i.duration || 0,
      views: i.views || 0,
      thumb: i.thumbnail || "",
      date: i.uploadedDate || "",
    }));
}
function normalizeInv(j) {
  return (Array.isArray(j) ? j : [])
    .filter((v) => v.type === "video" && v.videoId)
    .map((v) => ({
      id: v.videoId,
      title: v.title || "",
      channel: v.author || "",
      duration: v.lengthSeconds || 0,
      views: v.viewCount || 0,
      thumb: (v.videoThumbnails || []).find((t) => t.quality === "medium")?.url
          || (v.videoThumbnails || [])[0]?.url || "",
      date: v.publishedText || "",
    }));
}

async function searchVideos(query, proxyId = state.opts.proxy) {
  const order = proxyId === "auto"
    ? CFG.proxies.filter((p) => p.type !== "auto")
    : [...CFG.proxies.filter((p) => p.id === proxyId), ...CFG.proxies.filter((p) => p.type !== "auto" && p.id !== proxyId)];

  const q = encodeURIComponent(query);
  for (const p of order) {
    try {
      const url = p.type === "piped" ? `${p.url}/search?q=${q}&filter=videos`
                : p.type === "invidious" ? `${p.url}/api/v1/search?q=${q}&type=video`
                : "";
      if (!url) continue;
      const data = await fetchJSON(url);
      const out = (p.type === "piped" ? normalizePiped(data) : normalizeInv(data)).filter((v) => v.id);
      if (out.length) return out;
    } catch { /* пробуем следующий */ }
  }
  return [];
}

const isTrusted = (ch) => CFG.trusted.some((t) => (ch || "").toLowerCase().includes(t));

/* Ранжирование: официальные каналы и «сериальные» хронометражи вверху */
function rankResults(list, { media, ep }) {
  const n = +ep || 0;
  const movie = media?.format === "MOVIE";
  return list
    .map((v) => {
      let s = 0;
      if (isTrusted(v.channel)) s += 6;
      const m = v.duration / 60;
      if (movie) { if (m >= 45 && m <= 200) s += 4; }
      else { if (m >= 8 && m <= 35) s += 4; }
      if (m < 2) s -= 6;
      if (n && new RegExp(`\\bep(?:isode)?\\.?\\s*0*${n}\\b`, "i").test(v.title)) s += 3;
      s += Math.min((v.views || 0) / 1e6, 2);
      return { ...v, _s: s };
    })
    .sort((a, b) => b._s - a._s);
}

/* ============================================================
   3. Карточки и списки
   ============================================================ */
const ALT = (m) => m.title?.english || m.title?.romaji || m.title?.native || "Без названия";
const NAT = (m) => m.title?.native || m.title?.romaji || "";
const poster = (m) => m.coverImage?.extraLarge || m.coverImage?.large || "";
const banner = (m) => m.bannerImage || m.coverImage?.extraLarge || "";
const score = (m) => (m.averageScore || m.meanScore) ? Math.round((m.averageScore || m.meanScore) / 10) : null;
const FMT_RU = { TV:"TV", MOVIE:"ФИЛЬМ", OVA:"OVA", ONA:"ONA", SPECIAL:"СПЕШЛ", MUSIC:"MUSIC" };

function epLine(m) {
  if (m.nextAiringEpisode) return `<span class="ep">Эп ${m.nextAiringEpisode.episode} скоро</span>`;
  if (m.episodes) return `<span class="ep">${m.episodes} эп.</span>`;
  return m.status === "RELEASING" ? `<span class="ep">выходит</span>` : "— эп.";
}

function cardHTML(m) {
  return `
  <article class="card" data-id="${m.id}" tabindex="0">
    <div class="poster">
      <img loading="lazy" src="${esc(poster(m))}" alt="${esc(ALT(m))}" onerror="this.style.opacity=.15">
      <div class="grad"></div>
      ${score(m) ? `<span class="score">★ ${score(m)}</span>` : ""}
      <span class="fmt">${FMT_RU[m.format] || m.format || "TV"}</span>
      <div class="play"><i>▶</i></div>
    </div>
    <div class="info">
      <h4>${esc(ALT(m))}</h4>
      <p>${m.year || m.seasonYear || "—"} ${epLine(m)}</p>
    </div>
  </article>`;
}

function skeletons(n = 12) {
  return Array.from({ length: n }, () => `<div class="skel-card"><div class="sk-img"></div><div class="sk-l"></div><div class="sk-l" style="width:60%"></div></div>`).join("");
}

function fillGrid(html, append = false) {
  const g = $("#grid");
  if (append) g.insertAdjacentHTML("beforeend", html);
  else g.innerHTML = html;
}

/* ============================================================
   4. Главный экран: герой + ряды
   ============================================================ */
function renderHero(list) {
  const picks = list.slice(0, 4);
  const hero = $("#hero");
  if (!picks.length) { hero.style.display = "none"; return; }
  hero.style.display = "";
  hero.innerHTML = picks.map((m, i) => `
    <div class="hero-slide ${i === 0 ? "on" : ""}" data-i="${i}" style="background-image:url('${esc(banner(m))}')">
      <div class="hero-inner">
        <span class="hero-tag">🔥 В тренде</span>
        <h1>${esc(ALT(m))}</h1>
        <div class="hero-meta">
          ${score(m) ? `<span class="score">★ ${score(m)}</span>` : ""}
          <span>${m.year || m.seasonYear || "—"}</span>
          <span>${FMT_RU[m.format] || "TV"}</span>
          <span>${m.episodes ? m.episodes + " эп." : "—"}</span>
          <span>${(m.genres || []).slice(0, 3).join(" · ")}</span>
        </div>
        <p class="hero-desc">${esc(m.description || "")}</p>
        <div class="hero-btns">
          <button class="btn" data-action="play" data-id="${m.id}">▶ Смотреть</button>
          <button class="btn ghost" data-action="detail" data-id="${m.id}">Подробнее</button>
        </div>
      </div>
    </div>`).join("") +
    `<div class="hero-dots">${picks.map((_, i) => `<i class="${i === 0 ? "on" : ""}" data-i="${i}"></i>`).join("")}</div>`;

  clearInterval(renderHero._t);
  let idx = 0;
  const go = (i) => {
    idx = (i + picks.length) % picks.length;
    $$(".hero-slide", hero).forEach((s, k) => s.classList.toggle("on", k === idx));
    $$(".hero-dots i", hero).forEach((d, k) => d.classList.toggle("on", k === idx));
  };
  renderHero._t = setInterval(() => go(idx + 1), 7000);
  hero.onclick = (e) => {
    const d = e.target.closest(".hero-dots i");
    if (d) go(+d.dataset.i);
  };
}

const ROWS = [
  { title: "Сейчас в тренде", vars: { sort: ["TRENDING_DESC"] } },
  { title: "Популярные в этом сезоне", vars: { sort: ["POPULARITY_DESC"], season: seasonNow().s, seasonYear: seasonNow().y } },
  { title: "Лучшие по рейтингу", vars: { sort: ["SCORE_DESC"] } },
  { title: "Популярные фильмы", vars: { sort: ["POPULARITY_DESC"], format: "MOVIE" } },
];

function seasonNow() {
  const d = new Date(), m = d.getMonth() + 1, y = d.getFullYear();
  const s = m <= 3 ? "WINTER" : m <= 6 ? "SPRING" : m <= 9 ? "SUMMER" : "FALL";
  return { s, y };
}
const SEASON_RU = { WINTER:"Зима", SPRING:"Весна", SUMMER:"Лето", FALL:"Осень" };

async function loadRows() {
  const rows = $("#rows");
  rows.innerHTML = ROWS.map((r, i) => `
    <section class="row">
      <div class="row-head"><span class="bar"></span><h2>${r.title}</h2></div>
      <div class="row-scroll" id="row${i}">${skeletons(7)}</div>
    </section>`).join("");

  await Promise.all(ROWS.map(async (r, i) => {
    try {
      const d = await gql(Q.home, { page: 1, perPage: 14, ...r.vars }, true);
      const list = d.Page.media;
      if (i === 0) renderHero(list);
      $(`#row${i}`).innerHTML = list.map(cardHTML).join("") || `<div class="skel">Пусто</div>`;
    } catch (e) {
      $(`#row${i}`).innerHTML = `<div class="skel">${esc(e.message)}</div>`;
    }
  }));
}

/* ============================================================
   5. Каталог / поиск / топ / сезон / избранное / история
   ============================================================ */
function gridParams() {
  const v = state.view;
  const p = {
    page: state.page,
    sort: [$("#fSort").value],
    genre_in: $("#fGenre").value ? [$("#fGenre").value] : null,
    format: $("#fFormat").value || null,
    status: $("#fStatus").value || null,
    search: null, season: null, seasonYear: null,
  };
  if (v === "search" && state.q) { p.search = state.q; p.sort = ["SEARCH_MATCH"]; }
  if (v === "top") p.sort = ["SCORE_DESC"];
  if (v === "season") {
    const s = seasonNow();
    p.season = s.s; p.seasonYear = s.y;
    p.sort = [$("#fSort").value === "TRENDING_DESC" ? "POPULARITY_DESC" : $("#fSort").value];
  }
  return p;
}

function viewTitle() {
  const v = state.view;
  if (v === "search") return `Результаты: «${esc(state.q)}»`;
  if (v === "top") return "Лучшие аниме всех времён";
  if (v === "season") { const s = seasonNow(); return `Сезон ${SEASON_RU[s.s]} ${s.y}`; }
  if (v === "favs") return `Избранное (${state.favorites.length})`;
  if (v === "history") return `История просмотра (${state.history.length})`;
  return "Каталог";
}

async function loadGrid(append = false) {
  if (state.loading) return;
  const v = state.view;

  if (v === "favs" || v === "history") {
    const list = v === "favs" ? state.favorites : state.history.map((h) => h.media).filter(Boolean);
    fillGrid(list.length ? list.map(cardHTML).join("") : "");
    $("#emptyState").hidden = !!list.length;
    $("#btnMore").hidden = true;
    $("#discoverTitle").innerHTML = viewTitle();
    return;
  }

  if (!append) {
    state.page = 1;
    fillGrid(skeletons(16));
    $("#emptyState").hidden = true;
    $("#btnMore").hidden = true;
    $("#discoverTitle").innerHTML = viewTitle();
  }

  state.loading = true;
  $("#discoverTitle").innerHTML = viewTitle();
  try {
    const vars = gridParams();
    const d = await gql(Q.list, vars, true);
    const list = d.Page.media;
    state.list = append ? state.list.concat(list) : list;
    fillGrid(list.map(cardHTML).join(""), append);
    $("#btnMore").hidden = !d.Page.pageInfo.hasNextPage || !list.length;
    if (!state.list.length) { $("#emptyState").hidden = false; $("#emptyState").textContent = "Ничего не найдено 😔"; }
  } catch (e) {
    if (!append) fillGrid("");
    $("#emptyState").hidden = false;
    $("#emptyState").textContent = "Ошибка загрузки: " + e.message;
  } finally { state.loading = false; }
}

function setView(v, { reset = true } = {}) {
  state.view = v;
  $$("#nav a").forEach((a) => a.classList.toggle("active", a.dataset.view === v));
  const home = v === "home";
  $("#hero").hidden = !home;
  $("#rows").hidden = !home;
  $(".filters").style.display = (v === "favs" || v === "history") ? "none" : "";
  if (reset) { state.q = v === "search" ? state.q : ""; if (v !== "search") $("#searchInput").value = ""; }
  loadGrid();
  if (!home) window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ============================================================
   6. Модалка аниме
   ============================================================ */
async function openDetail(id) {
  const modal = $("#detail"), card = $("#detailCard");
  modal.hidden = false;
  card.innerHTML = `<div style="padding:60px;text-align:center" class="skel">Загружаю…</div>`;
  document.body.style.overflow = "hidden";
  try {
    const d = await gql(Q.detail, { id: +id }, true);
    const m = d.Media;
    state.media = m;
    card.innerHTML = detailHTML(m);
  } catch (e) {
    card.innerHTML = `<div style="padding:50px;text-align:center" class="skel">Не удалось загрузить: ${esc(e.message)}</div>`;
  }
}
function closeDetail() { $("#detail").hidden = true; if ($("#player").hidden) document.body.style.overflow = ""; }

function detailHTML(m) {
  const fav = state.favorites.some((f) => f.id === m.id);
  const air = m.nextAiringEpisode
    ? `Эп. ${m.nextAiringEpisode.episode} — ${new Date(m.nextAiringEpisode.airingAt * 1000).toLocaleDateString("ru-RU")}`
    : m.status === "FINISHED" ? "Завершено" : m.status === "RELEASING" ? "Выходит" : "Анонс";
  const links = (m.externalLinks || []).filter((l) => l?.url);
  const streams = (m.streamingEpisodes || []).filter((s) => s?.url);
  const rel = (m.recommendations?.nodes || []).map((n) => n.media).filter(Boolean)
    .concat((m.relations?.edges || []).map((e) => e.node).filter((n) => n?.id));
  const uniq = [...new Map(rel.map((x) => [x.id, x])).values()].slice(0, 14);

  return `
  <div class="d-banner" style="background-image:url('${esc(banner(m))}')"></div>
  <div class="d-body">
    <div class="d-head">
      <div class="d-cover"><img src="${esc(poster(m))}" alt=""></div>
      <div class="d-main">
        <h2>${esc(ALT(m))}</h2>
        <div class="d-alt">${esc(NAT(m))}</div>
        <div class="d-chips">
          ${score(m) ? `<span class="chip gold">★ ${score(m)}/10</span>` : ""}
          ${(m.genres || []).slice(0, 6).map((g) => `<span class="chip">${esc(g)}</span>`).join("")}
        </div>
        <div class="d-actions">
          <button class="btn" data-action="play" data-id="${m.id}">▶ Смотреть</button>
          <button class="btn ghost" data-action="fav" data-id="${m.id}">${fav ? "♥ В избранном" : "♡ В избранное"}</button>
          ${m.trailer?.site === "youtube" && m.trailer.id
            ? `<button class="btn ghost" data-action="trailer" data-v="${esc(m.trailer.id)}">🎬 Трейлер</button>` : ""}
        </div>
      </div>
    </div>

    <p class="d-desc" style="margin-top:22px">${(esc(m.description || "Описание отсутствует.")).replace(/\n/g, "<br>")}</p>

    <div class="d-stats">
      <div class="stat"><b>${m.episodes || "—"}</b><span>Серий</span></div>
      <div class="stat"><b>${FMT_RU[m.format] || "TV"}</b><span>Формат</span></div>
      <div class="stat"><b>${m.duration ? m.duration + " мин" : "—"}</b><span>Длина серии</span></div>
      <div class="stat"><b>${m.season ? SEASON_RU[m.season] + " " + (m.seasonYear || "") : (m.year || "—")}</b><span>Год</span></div>
      <div class="stat"><b>${m.studios?.nodes?.[0]?.name || "—"}</b><span>Студия</span></div>
      <div class="stat"><b style="font-size:14px">${esc(air)}</b><span>Эфир</span></div>
    </div>

    ${uniq.length ? `
    <div class="d-sub">
      <h3>Похожее</h3>
      <div class="rel-grid">${uniq.map(cardHTML).join("")}</div>
    </div>` : ""}

    ${(links.length || streams.length) ? `
    <div class="d-sub" style="margin-top:26px">
      <h3>Смотреть легально</h3>
      <div class="leg-list">
        ${links.slice(0, 8).map((l) => `<a class="leg" href="${esc(l.url)}" target="_blank" rel="noopener"><i>↗</i><div>${esc(l.site)}<small>Официальный сервис</small></div></a>`).join("")}
        ${streams.slice(0, 8).map((s) => `<a class="leg" href="${esc(s.url)}" target="_blank" rel="noopener"><i>▶</i><div>${esc(s.title || s.site)}<small>${esc(s.site || "")}</small></div></a>`).join("")}
      </div>
    </div>` : ""}
  </div>`;
}

/* ============================================================
   7. Избранное / история
   ============================================================ */
function summaryOf(m) {
  return {
    id: m.id, title: m.title, coverImage: m.coverImage, bannerImage: m.bannerImage,
    format: m.format, episodes: m.episodes, status: m.status, season: m.season,
    seasonYear: m.seasonYear, year: m.year, averageScore: m.averageScore, meanScore: m.meanScore,
    genres: m.genres, description: m.description, nextAiringEpisode: m.nextAiringEpisode,
  };
}
function toggleFav(id) {
  const i = state.favorites.findIndex((f) => f.id === +id);
  if (i >= 0) { state.favorites.splice(i, 1); toast("Убрано из избранного"); }
  else {
    const m = state.media?.id === +id ? state.media : state.list.find((x) => x.id === +id);
    if (m) { state.favorites.unshift(summaryOf(m)); toast("Добавлено в избранное ♥", true); }
    else { toast("Откройте карточку, чтобы добавить"); return; }
  }
  store.set("ah_favs", state.favorites);
  $("#favCount").textContent = state.favorites.length;
  if (!$("#detail").hidden && state.media) $("#detailCard").innerHTML = detailHTML(state.media);
  if (state.view === "favs") loadGrid();
}
function saveHistory(media, episode, videoId, pos = 0) {
  const h = state.history.filter((x) => x.media.id !== media.id || x.ep !== episode);
  h.unshift({ media: summaryOf(media), ep: episode, videoId, pos, ts: Date.now() });
  state.history = h.slice(0, 60);
  store.set("ah_hist", state.history);
  if (state.view === "history") loadGrid();
}

/* ============================================================
   8. ПЛЕЕР
   ============================================================ */
const Player = {
  media: null,
  ep: 1,
  dub: false,
  results: [],
  currentId: null,
  yt: null,
  ytReady: null,
  hls: null,
  mode: "yt",
  failCount: 0,
};

function loadYTApi() {
  if (window.YT?.Player) return Promise.resolve();
  if (Player.ytReady) return Player.ytReady;
  Player.ytReady = new Promise((res) => {
    window.onYouTubeIframeAPIReady = () => res();
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  });
  return Player.ytReady;
}

async function openPlayer(media, { ep = 1, videoId = null } = {}) {
  Player.media = media;
  Player.ep = ep;
  state.media = media;
  $("#player").hidden = false;
  document.body.style.overflow = "hidden";
  $("#pTitle").textContent = ALT(media);
  $("#pFav").textContent = state.favorites.some((f) => f.id === media.id) ? "♥" : "♡";
  renderEpisodes(media, ep);
  renderLegal(media);
  setTab("res");
  $("#stageHint").hidden = false;
  $("#stageHint").textContent = "Загрузка плеера…";

  if (videoId) { await mountYT(videoId); return; }
  await findEpisode();
}

async function closePlayer() {
  $("#player").hidden = true;
  document.body.style.overflow = "";
  try { Player.yt?.stopVideo?.(); Player.yt?.destroy?.(); } catch {}
  Player.yt = null;
  $("#ytHost")?.remove();
  if (!$("#ytHost")) $("#ytWrap").insertAdjacentHTML("beforeend", '<div id="ytHost"></div>');
  if (Player.hls) { Player.hls.destroy(); Player.hls = null; }
  const v = $("#video"); v.pause(); v.removeAttribute("src"); v.load();
  $("#hlsWrap").hidden = true; $("#ytWrap").hidden = false;
}

function epQuery() {
  const m = Player.media;
  const base = ALT(m);
  const parts = [`"${base}"`];
  if (m.format !== "MOVIE") parts.push("episode", Player.ep);
  if (Player.dub) parts.push("english dub");
  parts.push(m.format === "MOVIE" ? "full movie" : "");
  return parts.filter(Boolean).join(" ");
}

async function findEpisode() {
  const m = Player.media;
  setTab("res");
  $("#resList").innerHTML = `<div class="skel">Ищу видео…</div>`;
  $("#pEp").textContent = m.format === "MOVIE" ? "ФИЛЬМ" : `СЕРИЯ ${Player.ep}`;

  const nat = m.title?.romaji, en = m.title?.english;
  const queries = [epQuery()];
  if (en && nat && nat !== en) queries.push(epQuery().replace(`"${en}"`, `"${nat}"`));

  let all = [];
  for (const q of queries) {
    const r = await searchVideos(q);
    all = all.concat(r);
    const trusted = r.filter((v) => isTrusted(v.channel));
    if (trusted.length >= 2) break;
    if (!state.opts.trusted && r.length >= 6) break;
  }

  let ranked = rankResults(all.filter((v, i) => all.findIndex((x) => x.id === v.id) === i), { media: m, ep: Player.ep });
  let trustedOnly = ranked.filter((v) => isTrusted(v.channel));
  let pool = state.opts.trusted && trustedOnly.length ? trustedOnly : ranked;

  if (state.opts.trusted && !trustedOnly.length && ranked.length) {
    toast("Официальные каналы не нашли эту серию — показываю другие источники");
    pool = ranked;
  }
  Player.results = ranked;
  renderResults(pool);

  if (!pool.length) {
    $("#stageHint").hidden = false;
    $("#stageHint").innerHTML = `
      <div>Ничего не нашлось в открытом поиске.<br><br>
      <a class="btn small" target="_blank" rel="noopener"
         href="https://www.youtube.com/results?search_query=${encodeURIComponent(epQuery())}">
         Искать на YouTube ↗</a></div>`;
    toast("Видео не найдено — откройте вкладку «Легально»");
    return;
  }
  await mountYT(pool[0].id);
}

async function mountYT(videoId) {
  $("#stageHint").hidden = false;
  $("#stageHint").textContent = "Загрузка видео…";
  $("#ytWrap").hidden = false; $("#hlsWrap").hidden = true;
  Player.mode = "yt";
  Player.currentId = videoId;
  $("#qLabel").textContent = "1080p";
  $("#qBadge").textContent = "1080p";
  markActiveResult(videoId);

  await loadYTApi();
  const vars = { autoplay: 1, rel: 0, playsinline: 1, modestbranding: 1, origin: location.origin.startsWith("http") ? location.origin : undefined };
  const onReady = () => {
    $("#stageHint").hidden = true;
    if (state.opts.hq) { try { Player.yt.setPlaybackQuality("hd1080"); } catch {} }
    saveHistory(Player.media, Player.ep, videoId, 0);
  };
  const onState = (e) => {
    if (e.data === 1) { $("#stageHint").hidden = true; if (state.opts.hq) { try { Player.yt.setPlaybackQuality("hd1080"); } catch {} } }
    if (e.data === 0) nextEpisode();
  };
  const onError = () => {
    Player.failCount++;
    const idx = Player.results.findIndex((v) => v.id === videoId);
    const next = Player.results.slice(idx + 1).find((v) => !state.opts.trusted || isTrusted(v.channel)) || Player.results[idx + 1];
    if (Player.failCount < 3 && next) { toast("Этот ролик не встраивается — пробую следующий"); mountYT(next.id); }
    else {
      $("#stageHint").hidden = false;
      $("#stageHint").innerHTML = `<div>Плеер заблокировал этот ролик.<br><br>
        <a class="btn small" target="_blank" rel="noopener" href="https://www.youtube.com/watch?v=${videoId}">
        Открыть на YouTube ↗</a></div>`;
    }
  };

  if (Player.yt) { Player.yt.loadVideoById(videoId); onReady(); return; }
  Player.yt = new YT.Player("ytHost", {
    videoId, playerVars: vars,
    events: { onReady, onStateChange: onState, onError },
  });
}

/* --- HLS / свой источник --- */
async function openSource(url) {
  const v = $("#video");
  Player.mode = "hls";
  $("#ytWrap").hidden = true; $("#hlsWrap").hidden = false;
  $("#stageHint").hidden = true;
  try { Player.yt?.stopVideo?.(); } catch {}

  const isHls = /\.m3u8($|\?)/i.test(url);
  if (isHls && window.Hls?.isSupported()) {
    Player.hls?.destroy();
    Player.hls = new Hls({ capLevelToPlayerSize: false });
    Player.hls.loadSource(url);
    Player.hls.attachMedia(v);
    Player.hls.on(Hls.Events.MANIFEST_PARSED, () => {
      buildQualityMenu();
      const best = pickBestLevel();
      if (best >= 0) Player.hls.currentLevel = best;
      v.play().catch(() => {});
    });
    Player.hls.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) toast("Ошибка HLS: " + data.details); });
  } else {
    v.src = url;
    v.play().catch(() => {});
    $("#qLabel").textContent = "Авто";
    buildQualityMenu();
  }
}
function pickBestLevel() {
  const lv = Player.hls?.levels || [];
  if (!lv.length) return -1;
  let idx = lv.reduce((b, l, i) => (l.height > lv[b].height ? i : b), 0);
  const fullHd = lv.map((l, i) => ({ i, h: l.height })).filter((x) => x.h <= 1080);
  if (state.opts.hq && fullHd.length) idx = fullHd.reduce((b, x) => (x.h > fullHd[b].h ? x : b)).i;
  return idx;
}
function buildQualityMenu() {
  const menu = $("#qMenu");
  if (Player.mode !== "hls") {
    menu.innerHTML = ["hd1080", "hd720", "hd480", "default"]
      .map((q, i) => `<button data-q="${q}">${["1080p", "720p", "480p", "Авто"][i]}</button>`).join("");
    return;
  }
  const lv = Player.hls?.levels || [];
  const opts = [{ i: -1, label: "Авто (макс. 1080p)" }]
    .concat(lv.map((l, i) => ({ i, label: l.height ? l.height + "p" : (l.bitrate / 1000 | 0) + " kbps" })));
  menu.innerHTML = opts.map((o, k) =>
    `<button data-level="${o.i}" class="${(Player.hls?.autoLevelEnabled && o.i === -1) || Player.hls?.currentLevel === o.i ? "on" : ""}">${o.label}</button>`
  ).join("");
  const cur = Player.hls?.currentLevel;
  const lbl = cur >= 0 ? (lv[cur].height + "p") : "Авто";
  $("#qLabel").textContent = Player.hls?.levels?.some((l) => l.height === 1080) && (cur === -1 || lv[cur]?.height === 1080) ? "1080p" : lbl;
}

/* --- Серии --- */
function renderEpisodes(media, cur) {
  const total = media.format === "MOVIE" ? 1 : Math.min(media.episodes || 24, 1500);
  const watched = state.history.find((h) => h.media.id === media.id);
  let html = "";
  for (let i = 1; i <= total; i++) {
    html += `<button data-ep="${i}" class="${i === cur ? "on" : ""} ${watched && watched.ep === i ? "watched" : ""}">${i}</button>`;
  }
  $("#epGrid").innerHTML = html;
  $("#epNote").innerHTML = media.format === "MOVIE"
    ? "Это фильм — одна история."
    : `Всего серий: <b>${media.episodes || "неизвестно"}</b>. Нажмите номер, чтобы найти серию.`;
  const active = $(`#epGrid button.on`);
  active?.scrollIntoView({ block: "center", behavior: "smooth" });
}

function renderLegal(m) {
  const links = (m.externalLinks || []).filter((l) => l?.url);
  const streams = (m.streamingEpisodes || []).filter((s) => s?.url);
  const yt = `https://www.youtube.com/results?search_query=${encodeURIComponent(ALT(m))}`;
  const html = [
    ...links.map((l) => `<a class="leg" target="_blank" rel="noopener" href="${esc(l.url)}"><i>↗</i><div>${esc(l.site)}<small>Официальный сервис</small></div></a>`),
    ...streams.slice(0, 10).map((s) => `<a class="leg" target="_blank" rel="noopener" href="${esc(s.url)}"><i>▶</i><div>${esc(s.title || s.site)}<small>${esc(s.site || "")}</small></div></a>`),
    `<a class="leg" target="_blank" rel="noopener" href="${yt}"><i>YT</i><div>Поиск на YouTube<small>официальные каналы</small></div></a>`,
  ].join("");
  $("#legList").innerHTML = html || `<div class="skel">Нет ссылок</div>`;
}

function renderResults(list) {
  if (!list.length) { $("#resList").innerHTML = `<div class="skel">Нет результатов</div>`; return; }
  $("#resList").innerHTML = list.slice(0, 30).map((v) => `
    <div class="res ${v.id === Player.currentId ? "on" : ""}" data-v="${esc(v.id)}">
      <img loading="lazy" src="${esc(v.thumb.replace("hq720", "hqdefault"))}" alt="" onerror="this.style.opacity=.2">
      <div class="meta">
        <b>${esc(v.title)}</b>
        <span>${esc(v.channel)}${isTrusted(v.channel) ? `<span class="tag">офиц.</span>` : ""}
        ${v.duration ? " · " + fmtTime(v.duration) : ""}${v.views ? " · " + fmtViews(v.views) : ""}</span>
      </div>
    </div>`).join("");
}
function markActiveResult(id) {
  $$("#resList .res").forEach((r) => r.classList.toggle("on", r.dataset.v === id));
}

function setTab(name) {
  $$(".side-tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  $("#tabEp").hidden = name !== "ep";
  $("#tabRes").hidden = name !== "res";
  $("#tabLeg").hidden = name !== "leg";
}
async function goEpisode(n) {
  if (!Player.media) return;
  Player.ep = clamp(n, 1, Math.max(Player.media.episodes || 9999, 1));
  Player.failCount = 0;
  renderEpisodes(Player.media, Player.ep);
  $("#pEp").textContent = `СЕРИЯ ${Player.ep}`;
  await findEpisode();
}
function nextEpisode() {
  if (Player.media && Player.media.format !== "MOVIE" && Player.ep < (Player.media.episodes || 9999)) goEpisode(Player.ep + 1);
}

/* ============================================================
   9. События
   ============================================================ */
document.addEventListener("click", async (e) => {
  const t = e.target;

  const act = t.closest("[data-action]")?.dataset.action;
  if (act === "home") { e.preventDefault(); setView("home"); return; }
  if (act === "closeDetail") { closeDetail(); return; }
  if (act === "closeSettings") { $("#settings").hidden = true; return; }
  if (act === "detail") { openDetail(+t.closest("[data-action]").dataset.id); return; }
  if (act === "play") {
    const id = +t.closest("[data-action]").dataset.id;
    let m = state.media?.id === id ? state.media : null;
    if (!m) {
      try { m = (await gql(Q.detail, { id }, true)).Media; } catch (er) { toast(er.message); return; }
    }
    closeDetail();
    const hist = state.history.find((h) => h.media.id === id);
    openPlayer(m, { ep: hist?.ep || 1, videoId: hist?.videoId || null });
    return;
  }
  if (act === "fav") { toggleFav(+t.closest("[data-action]").dataset.id); return; }
  if (act === "trailer") {
    const v = t.closest("[data-action]").dataset.v;
    const m = state.media;
    closeDetail();
    if (m) { openPlayer(m, { videoId: v }); setTab("res"); }
    return;
  }

  const card = t.closest(".card");
  if (card && card.dataset.id) { openDetail(+card.dataset.id); return; }

  const nav = t.closest("#nav a");
  if (nav) { e.preventDefault(); setView(nav.dataset.view); return; }

  const res = t.closest(".res");
  if (res) { Player.failCount = 0; mountYT(res.dataset.v); return; }

  const ep = t.closest("#epGrid button");
  if (ep) { goEpisode(+ep.dataset.ep); return; }

  const tab = t.closest(".side-tabs button");
  if (tab) { setTab(tab.dataset.tab); return; }

  if (t.closest("#btnSettings")) { $("#settings").hidden = false; return; }
  if (t.closest("#pClose")) { closePlayer(); return; }
  if (t.closest("#pFav")) { toggleFav(Player.media.id); $("#pFav").textContent = state.favorites.some((f) => f.id === Player.media.id) ? "♥" : "♡"; return; }
  if (t.closest("#btnNext")) { goEpisode(Player.ep + 1); return; }
  if (t.closest("#btnPrev")) { goEpisode(Player.ep - 1); return; }
  if (t.closest("#btnMore")) { state.page++; loadGrid(true); return; }

  if (t.closest("#qBtn")) { const m = $("#qMenu"); buildQualityMenu(); m.hidden = !m.hidden; return; }
  const qOpt = t.closest("#qMenu button");
  if (qOpt) {
    if (Player.mode === "hls" && Player.hls) {
      Player.hls.currentLevel = +qOpt.dataset.level;
      if (+qOpt.dataset.level === -1) Player.hls.nextLevel = pickBestLevel();
      $("#qLabel").textContent = qOpt.textContent;
    } else if (qOpt.dataset.q) {
      try { Player.yt.setPlaybackQuality(qOpt.dataset.q); } catch {}
      $("#qLabel").textContent = qOpt.textContent;
      toast(qOpt.dataset.q === "hd1080"
        ? "Запрошено 1080p. Если ролик старого качества — выберите шестерёнку в самом плеере YouTube"
        : "Качество: " + qOpt.textContent, true);
    }
    $("#qMenu").hidden = true;
    return;
  }

  if (t.closest("#btnDub")) {
    Player.dub = !Player.dub;
    $("#btnDub").textContent = Player.dub ? "Даб" : "Саб";
    $("#btnDub").classList.toggle("on", Player.dub);
    findEpisode();
    return;
  }
  if (t.closest("#btnSrc")) {
    const url = prompt("Вставьте адрес источника (.m3u8 или .mp4):", "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8");
    if (url) openSource(url.trim());
    return;
  }
  if (t.closest("#btnClearCache")) { gcache.clear(); localStorage.removeItem("ah_hist"); toast("Кэш очищен", true); state.history = []; return; }
});

/* поиск */
let sT;
$("#searchInput").addEventListener("input", (e) => {
  clearTimeout(sT);
  const v = e.target.value.trim();
  sT = setTimeout(() => {
    if (v) { state.q = v; if (state.view !== "search") setView("search"); else loadGrid(); }
    else if (state.view === "search") setView("home");
  }, 420);
});

/* фильтры */
["#fGenre", "#fFormat", "#fStatus", "#fSort"].forEach((s) => $(s).addEventListener("change", () => loadGrid()));

/* настройки */
$("#optTrusted").checked = state.opts.trusted;
$("#optHq").checked = state.opts.hq;
$("#optProxy").innerHTML = CFG.proxies.map((p) => `<option value="${p.id}">${p.name}</option>`).join("");
$("#optProxy").value = state.opts.proxy;
const saveOpts = () => { state.opts = { trusted: $("#optTrusted").checked, hq: $("#optHq").checked, proxy: $("#optProxy").value }; store.set("ah_opts", state.opts); };
["#optTrusted", "#optHq", "#optProxy"].forEach((s) => $(s).addEventListener("change", saveOpts));

/* клавиатура */
document.addEventListener("keydown", (e) => {
  if (!$("#player").hidden) {
    if (e.key === "Escape") closePlayer();
    if (e.key === "ArrowRight" && Player.mode === "yt") Player.yt?.seekTo?.(Player.yt.getCurrentTime() + 5, true);
    if (e.key === "ArrowLeft" && Player.mode === "yt") Player.yt?.seekTo?.(Math.max(0, Player.yt.getCurrentTime() - 5), true);
    if (e.key.toLowerCase() === "f") ($("#player").querySelector(".stage")).requestFullscreen?.().catch(() => {});
    if (e.key === " ") { e.preventDefault(); Player.mode === "yt" ? Player.yt?.pauseVideo?.() : $("#video").paused ? $("#video").play() : $("#video").pause(); }
    return;
  }
  if (e.key === "Escape" && !$("#detail").hidden) closeDetail();
  else if (e.key === "Escape" && !$("#settings").hidden) $("#settings").hidden = true;
});

/* ============================================================
   10. Старт
   ============================================================ */
async function boot() {
  $("#favCount").textContent = state.favorites.length;
  $("#fGenre").innerHTML = `<option value="">Все жанры</option>` + CFG.genres.map(([id, ru]) => `<option value="${esc(id)}">${ru}</option>`).join("");

  document.body.insertAdjacentHTML("beforeend", `
    <footer class="foot">
      <b>AnimeHub</b> — демонстрационный одностраничник.<br>
      Данные аниме: <b>AniList GraphQL API</b> (открытый API, без ключа).
      Видео ищется через открытые Piped/Invidious-инстансы и воспроизводится <b>официальным плеером YouTube</b>
      (по умолчанию — только каналы правообладателей: Muse Asia, Ani-One, Anime Log, Crunchyroll, Bilibili, RetroCrush, VIZ).
      Во вкладке «Легально» — ссылки на лицензионные сервисы.<br>
      Никакие пиратские источники не используются. Уважайте труд авторов — смотрите лицензионно.
    </footer>`);

  await loadGrid();
  loadRows().catch((e) => toast("Не удалось загрузить ряды: " + e.message));
}
boot();
