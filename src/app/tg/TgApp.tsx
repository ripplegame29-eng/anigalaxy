"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { adoptTelegramSession } from "@/lib/cloud";
import { loginTelegramVerified } from "@/lib/auth";
import { loadFavorites } from "@/lib/collections";
import { useLevelInfo } from "@/lib/progression/events";
import type { AnimeCard } from "@/lib/types";

/* ----------------------------- Telegram API ---------------------------- */

interface TgWebApp {
  initData: string;
  initDataUnsafe?: { user?: { first_name?: string; photo_url?: string } };
  ready(): void;
  expand(): void;
  close(): void;
  setHeaderColor?(c: string): void;
  setBackgroundColor?(c: string): void;
  disableVerticalSwipes?(): void;
  openLink(url: string, opts?: { try_instant_view?: boolean }): void;
  openTelegramLink(url: string): void;
  HapticFeedback?: { impactOccurred(s: string): void; selectionChanged(): void; notificationOccurred(s: string): void };
  BackButton: { show(): void; hide(): void; onClick(f: () => void): void; offClick(f: () => void): void };
}
const wa = (): TgWebApp | null => (typeof window === "undefined" ? null : ((window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp ?? null));
const tick = () => wa()?.HapticFeedback?.selectionChanged();

type Tab = "home" | "search" | "fav" | "me";
type Row = { id: string; title: string; cards: AnimeCard[] };
interface Me {
  nickname: string;
  displayName?: string;
  premiumUntil: number;
}

const GENRES = ["боевик", "фэнтези", "романтика", "комедия", "драма", "исэкай", "школа", "триллер", "фантастика", "приключения"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

async function getCards(url: string): Promise<AnimeCard[]> {
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    const d = await r.json();
    return (d.cards ?? d.results ?? []) as AnimeCard[];
  } catch {
    return [];
  }
}

/* -------------------------------- Приложение --------------------------- */

export function TgApp() {
  const [tab, setTab] = useState<Tab>("home");
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [rows, setRows] = useState<Row[]>([]);
  const [hero, setHero] = useState<AnimeCard[]>([]);
  const [genre, setGenre] = useState<string>("");
  const [genreCards, setGenreCards] = useState<AnimeCard[]>([]);
  const [open, setOpen] = useState<AnimeCard | null>(null);

  /* Оформление под Telegram и автовход по подписи */
  useEffect(() => {
    const app = wa();
    app?.ready();
    app?.expand();
    app?.setHeaderColor?.("#070b1f");
    app?.setBackgroundColor?.("#070b1f");
    app?.disableVerticalSwipes?.();
    let off = false;
    (async () => {
      try {
        const cur = await (await fetch("/api/account/me", { cache: "no-store" })).json();
        if (cur.account) return !off && setMe(cur.account);
        if (app?.initData) {
          const res = await fetch("/api/tglogin/webapp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ initData: app.initData }) });
          const d = await res.json();
          if (d.ok) {
            loginTelegramVerified({ nickname: d.nickname, telegram: d.telegram });
            await adoptTelegramSession(d.account);
            return !off && setMe(d.account);
          }
        }
      } catch {
        /* остаёмся гостем */
      }
      if (!off) setMe(null);
    })();
    return () => {
      off = true;
    };
  }, []);

  /* Ленты главной */
  useEffect(() => {
    let off = false;
    Promise.all([
      getCards("/api/kodik/top"),
      getCards("/api/kodik/list?status=ongoing&sort=rating"),
      getCards("/api/kodik/list?type=movie&sort=rating"),
      getCards("/api/kodik/list?sort=fresh"),
    ]).then(([top, ong, movies, fresh]) => {
      if (off) return;
      setHero(top.filter((c) => c.poster).slice(0, 6));
      setRows([
        { id: "ong", title: "Выходит сейчас", cards: ong },
        { id: "top", title: "Лучшее по оценкам", cards: top },
        { id: "mov", title: "Фильмы", cards: movies },
        { id: "new", title: "Свежие релизы", cards: fresh },
      ].filter((r) => r.cards.length));
    });
    return () => {
      off = true;
    };
  }, []);

  useEffect(() => {
    if (!genre) return;
    let off = false;
    getCards(`/api/kodik/list?genre=${encodeURIComponent(genre)}&sort=rating`).then((c) => !off && setGenreCards(c));
    return () => {
      off = true;
    };
  }, [genre]);

  /* Системная кнопка «назад» Telegram закрывает карточку */
  useEffect(() => {
    const app = wa();
    if (!app) return;
    const back = () => setOpen(null);
    if (open) {
      app.BackButton.show();
      app.BackButton.onClick(back);
    } else app.BackButton.hide();
    return () => app.BackButton.offClick(back);
  }, [open]);

  const pick = useCallback((card: AnimeCard) => {
    wa()?.HapticFeedback?.impactOccurred("light");
    setOpen(card);
  }, []);
  const go = (t: Tab) => {
    tick();
    setTab(t);
    document.querySelector(".tga-scroll")?.scrollTo({ top: 0 });
  };

  return (
    <div className="tga">
      <div className="tga-aurora" aria-hidden />
      <main className="tga-scroll">
        {tab === "home" && <Home hero={hero} rows={rows} genre={genre} setGenre={(g) => { tick(); setGenre(g === genre ? "" : g); }} genreCards={genreCards} onPick={pick} />}
        {tab === "search" && <Search onPick={pick} />}
        {tab === "fav" && <Favorites onPick={pick} guest={me === null} />}
        {tab === "me" && <Profile me={me} />}
      </main>
      <nav className="tga-tabs" aria-label="Разделы">
        {([
          ["home", "Главная", "M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"],
          ["search", "Поиск", "M11 4a7 7 0 1 0 4.4 12.4l4.6 4.6 1.4-1.4-4.6-4.6A7 7 0 0 0 11 4z"],
          ["fav", "Избранное", "M12 21s-8-5.4-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.600-8 11-8 11z"],
          ["me", "Профиль", "M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm-8 9a8 8 0 0 1 16 0z"],
        ] as [Tab, string, string][]).map(([id, label, d]) => (
          <button key={id} className={tab === id ? "on" : ""} onClick={() => go(id)} aria-current={tab === id}>
            <svg viewBox="0 0 24 24" aria-hidden><path d={d} /></svg>
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {open && <Sheet card={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/* --------------------------------- Главная ----------------------------- */

function Poster({ card, w = 150 }: { card: AnimeCard; w?: number }) {
  return card.poster ? (
    <Image src={card.poster} alt="" width={w} height={Math.round(w * 1.4)} sizes={`${w}px`} unoptimized className="tga-img" />
  ) : (
    <div className="tga-img tga-noimg">{card.title.slice(0, 1)}</div>
  );
}

function Tile({ card, onPick }: { card: AnimeCard; onPick: (c: AnimeCard) => void }) {
  return (
    <button className="tga-tile" onClick={() => onPick(card)}>
      <span className="tga-frame">
        <Poster card={card} />
        {card.rating ? <b className="tga-score">★ {card.rating.toFixed(1)}</b> : null}
      </span>
      <span className="tga-ttl">{card.title}</span>
      <span className="tga-sub">{[card.year, card.genres?.[0]].filter(Boolean).join(" • ")}</span>
    </button>
  );
}

function Home({ hero, rows, genre, setGenre, genreCards, onPick }: { hero: AnimeCard[]; rows: Row[]; genre: string; setGenre: (g: string) => void; genreCards: AnimeCard[]; onPick: (c: AnimeCard) => void }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (hero.length < 2) return;
    const t = window.setInterval(() => setI((n) => (n + 1) % hero.length), 6000);
    return () => window.clearInterval(t);
  }, [hero.length]);
  const cur = hero[i];
  return (
    <>
      <header className="tga-head">
        <div className="tga-logo">Ani<b>Galaxy</b></div>
        <span className="tga-pill">Смотреть аниме</span>
      </header>
      {cur ? (
        <section className="tga-hero" onClick={() => onPick(cur)}>
          {cur.poster && <Image key={cur.id} src={cur.screenshots?.[0] ?? cur.poster} alt="" fill sizes="100vw" unoptimized className="tga-hero-bg" priority />}
          <div className="tga-hero-shade" />
          <div className="tga-hero-body">
            <span className="tga-chip">{cur.rating ? `★ ${cur.rating.toFixed(1)}` : "Топ"} · {cur.year ?? ""}</span>
            <h1>{cur.title}</h1>
            <p>{cur.genres?.slice(0, 3).map(cap).join(" • ")}</p>
            <span className="tga-cta">Подробнее</span>
          </div>
          <div className="tga-dots" aria-hidden>
            {hero.map((h, n) => <i key={h.id} className={n === i ? "on" : ""} />)}
          </div>
        </section>
      ) : <div className="tga-hero tga-skel" />}

      <div className="tga-chips" role="tablist" aria-label="Жанры">
        {GENRES.map((g) => (
          <button key={g} className={g === genre ? "on" : ""} onClick={() => setGenre(g)}>{cap(g)}</button>
        ))}
      </div>

      {genre && genreCards.length > 0 && (
        <section className="tga-sec">
          <h2>{cap(genre)}</h2>
          <div className="tga-grid">{genreCards.slice(0, 18).map((c) => <Tile key={c.id} card={c} onPick={onPick} />)}</div>
        </section>
      )}

      {!genre && rows.map((r) => (
        <section className="tga-sec" key={r.id}>
          <h2>{r.title}</h2>
          <div className="tga-rail">{r.cards.slice(0, 14).map((c) => <Tile key={c.id} card={c} onPick={onPick} />)}</div>
        </section>
      ))}
      {!rows.length && <div className="tga-skel tga-skel-row" />}
    </>
  );
}

/* --------------------------------- Поиск ------------------------------- */

function Search({ onPick }: { onPick: (c: AnimeCard) => void }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<AnimeCard[] | null>(null);
  const seq = useRef(0);
  useEffect(() => {
    const text = q.trim();
    if (text.length < 2) return;
    const n = ++seq.current;
    const t = window.setTimeout(() => getCards(`/api/kodik/search?q=${encodeURIComponent(text)}&limit=18`).then((c) => n === seq.current && setRes(c)), 280);
    return () => window.clearTimeout(t);
  }, [q]);
  return (
    <>
      <header className="tga-head"><h2 className="tga-h">Поиск</h2></header>
      <label className="tga-search">
        <svg viewBox="0 0 24 24" aria-hidden><path d="M11 4a7 7 0 1 0 4.4 12.4l4.6 4.6 1.4-1.4-4.6-4.6A7 7 0 0 0 11 4z" /></svg>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Название аниме" enterKeyHint="search" autoFocus />
      </label>
      {(res === null || q.trim().length < 2) && <p className="tga-hint">Начните вводить название — например, «Атака титанов».</p>}
      {res && q.trim().length >= 2 && !res.length && <p className="tga-hint">Ничего не нашлось. Попробуйте другое написание.</p>}
      {res && q.trim().length >= 2 && res.length > 0 && <div className="tga-grid">{res.map((c) => <Tile key={c.id} card={c} onPick={onPick} />)}</div>}
    </>
  );
}

/* ------------------------------- Избранное ----------------------------- */

function Favorites({ onPick, guest }: { onPick: (c: AnimeCard) => void; guest: boolean }) {
  const [cards, setCards] = useState<AnimeCard[] | null>(null);
  useEffect(() => {
    const ids = loadFavorites().filter((id) => /^(serial|movie)-\d+$/.test(id)).slice(0, 30);
    let off = false;
    Promise.all(ids.map((id) => fetch(`/api/kodik/title?id=${id}`).then((r) => (r.ok ? r.json() : null)).then((d) => (d?.detail?.card ?? null) as AnimeCard | null).catch(() => null))).then((list) => !off && setCards(list.filter((c): c is AnimeCard => Boolean(c))));
    return () => {
      off = true;
    };
  }, []);
  return (
    <>
      <header className="tga-head"><h2 className="tga-h">Избранное</h2></header>
      {cards === null && <div className="tga-skel tga-skel-row" />}
      {cards && !cards.length && <p className="tga-hint">{guest ? "Войдите через Telegram, чтобы видеть избранное." : "Здесь появятся тайтлы, которые вы добавите в избранное."}</p>}
      {cards && cards.length > 0 && <div className="tga-grid">{cards.map((c) => <Tile key={c.id} card={c} onPick={onPick} />)}</div>}
    </>
  );
}

/* --------------------------------- Профиль ----------------------------- */

function Profile({ me }: { me: Me | null | undefined }) {
  const lv = useLevelInfo();
  const app = wa();
  const name = me?.displayName || me?.nickname || app?.initDataUnsafe?.user?.first_name || "Гость";
  const [now] = useState(() => Date.now());
  const premium = (me?.premiumUntil ?? 0) > now;
  const open = (url: string) => (app ? app.openLink(url) : window.open(url, "_blank"));
  const link = (url: string) => (app ? app.openTelegramLink(url) : window.open(url, "_blank"));
  return (
    <>
      <header className="tga-head"><h2 className="tga-h">Профиль</h2></header>
      <section className={`tga-me${premium ? " prem" : ""}`}>
        <div className="tga-ava">{app?.initDataUnsafe?.user?.photo_url ? <Image src={app.initDataUnsafe.user.photo_url} alt="" width={72} height={72} unoptimized /> : <span>{name.slice(0, 1).toUpperCase()}</span>}</div>
        <div className="tga-me-in">
          <h1>{name}</h1>
          <p>{premium ? `Premium до ${new Date(me!.premiumUntil).toLocaleDateString("ru-RU")}` : me ? "Участник AniGalaxy" : "Вход выполняется…"}</p>
        </div>
        <div className="tga-lv">
          <div className="tga-lv-top"><b>Уровень {lv.level}</b><span>{lv.era}</span></div>
          <div className="tga-bar"><i style={{ width: `${Math.max(3, lv.percent)}%` }} /></div>
          <small>До следующего: {lv.left} XP</small>
        </div>
      </section>
      <section className="tga-menu">
        <button onClick={() => open("https://anigalaxy.space/premium")}><i>👑</i><span><b>AniGalaxy Premium</b><small>Без рекламы, фоны и эффекты</small></span><em>›</em></button>
        <button onClick={() => open("https://anigalaxy.space/referrals")}><i>🎁</i><span><b>Пригласить друга</b><small>Награды за каждого приглашённого</small></span><em>›</em></button>
        <button onClick={() => open("https://anigalaxy.space/profile")}><i>🪐</i><span><b>Полный профиль</b><small>Достижения, рамки, статистика</small></span><em>›</em></button>
        <button onClick={() => link("https://t.me/anigalaxy_supp")}><i>💬</i><span><b>Поддержка</b><small>Отвечаем лично</small></span><em>›</em></button>
        <button onClick={() => link("https://t.me/anigalaxyspace")}><i>📣</i><span><b>Наш канал</b><small>Новости и подборки</small></span><em>›</em></button>
      </section>
    </>
  );
}

/* ------------------------------ Карточка тайтла ------------------------ */

function Sheet({ card, onClose }: { card: AnimeCard; onClose: () => void }) {
  const [full, setFull] = useState<AnimeCard>(card);
  useEffect(() => {
    let off = false;
    fetch(`/api/kodik/title?id=${card.id}`).then((r) => (r.ok ? r.json() : null)).then((d) => d?.detail?.card && !off && setFull({ ...card, ...d.detail.card })).catch(() => {});
    return () => {
      off = true;
    };
  }, [card]);
  const meta = useMemo(() => [full.year, full.kind, full.episodesTotal ? `${full.episodesTotal} эп.` : ""].filter(Boolean).join(" • "), [full]);
  return (
    <div className="tga-sheet-wrap" onClick={onClose}>
      <article className="tga-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={full.title}>
        <div className="tga-grab" />
        <div className="tga-sheet-top">
          <span className="tga-frame sm"><Poster card={full} w={120} /></span>
          <div>
            <h3>{full.title}</h3>
            {full.titleOrig && <p className="tga-orig">{full.titleOrig}</p>}
            <p className="tga-meta">{meta}</p>
            {full.rating ? <b className="tga-score in">★ {full.rating.toFixed(1)}</b> : null}
          </div>
        </div>
        {full.genres?.length ? <div className="tga-tags">{full.genres.slice(0, 5).map((g) => <span key={g}>{cap(g)}</span>)}</div> : null}
        {full.description && <p className="tga-desc">{full.description.replace(/\s+/g, " ").slice(0, 320)}{full.description.length > 320 ? "…" : ""}</p>}
        <a className="tga-watch" href={`/title/${full.id}`}>▶ Смотреть</a>
      </article>
    </div>
  );
}

