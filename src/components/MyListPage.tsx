'use client';
/**
 * «Мой список» для AniGalaxy — самодостаточный клиентский компонент (стили внутри, без зависимостей).
 * Использование (Next.js app router):  app/list/page.tsx  →  import MyList from '@/components/MyListPage'; export default () => <MyList />;
 * Данные: передайте `initial` и `onSave` (или оставьте пустыми — тогда демо-данные и localStorage).
 * Ширина контейнера настраивается переменной --w в начале CSS (по умолчанию 1220px — как у шапки сайта).
 *
 * Горячие клавиши:  /  — поиск · Esc — закрыть · ←/→ — соседний тайтл в карточке.
 */
import { PSelect } from "@/components/PSelect";
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties, FormEvent, PointerEvent as RPE, ReactNode } from 'react';

export type Status = 'planned' | 'watching' | 'completed' | 'dropped';
export interface ListItem { id: string; title: string; poster?: string | null; eps?: number; ep: number; status: Status; rating: number; note: string; updated: number; year?: number; type?: string; genres?: string[]; href?: string }
export interface Collection { id: string; name: string; ids: string[] }
export interface HistoryEntry { id: string; title: string; image?: string | null; ep: number; when: string; href?: string }
export interface ListData { items: ListItem[]; cols: Collection[]; history: HistoryEntry[]; public: boolean }
interface Props {
  user?: { name: string }; readOnly?: boolean; catalogHref?: string; shareUrl?: string;
  initial?: ListData | null; onSave?: (d: ListData) => void | Promise<void>; onClearHistory?: () => void;
}

const ST = [
  { k: 'planned', n: 'Буду смотреть', c: '#a78bfa' }, { k: 'watching', n: 'Смотрю', c: '#22d3ee' },
  { k: 'completed', n: 'Просмотрено', c: '#34d399' }, { k: 'dropped', n: 'Брошено', c: '#fb7185' },
] as const;
const SM = Object.fromEntries(ST.map((s) => [s.k, s])) as Record<Status, (typeof ST)[number]>;
const KEY = 'anigalaxy-list:v3';
const VKEY = 'anigalaxy-list:view';
const v = (o: Record<string, string | number>) => o as CSSProperties;
const hue = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; };
/** Грубая оценка времени просмотра: фильм ≈ 100 мин, серия ≈ 24 мин */
const mins = (i: ListItem) => (i.type && /фильм|movie/i.test(i.type) ? 100 : 24);

const T0 = 1760000000000, D = 864e5;
const DEMO: ListData = {
  public: false,
  items: ([
    ['Провожающая в последний путь Фрирен', 28, 28, 'completed', 10, 'Лучшее за год. Сцена с Химмелем — слёзы.', 2023, 'ТВ Сериал', ['Фэнтези', 'Приключения']],
    ['Re:Zero. Жизнь с нуля в альтернативном мире 4', 19, 7, 'watching', 9, '', 2026, 'ТВ Сериал', ['Фэнтези', 'Драма']],
    ['Гатиакута', 13, 5, 'watching', 0, 'Стиль и экшен огонь, жду новые серии.', 2026, 'ТВ Сериал', ['Экшен']],
    ['Человек-бензопила: Резе', 1, 1, 'completed', 9, '', 2025, 'Фильм', ['Экшен', 'Хоррор']],
    ['Красная река', 24, 3, 'dropped', 5, 'Не зашёл темп.', 2026, 'ТВ Сериал', ['Драма']],
    ['Врата Штейна', 24, 0, 'planned', 0, 'Советовал друг.', 2011, 'ТВ Сериал', ['Фантастика', 'Триллер']],
    ['Стальной алхимик: Братство', 64, 64, 'completed', 10, '', 2009, 'ТВ Сериал', ['Экшен', 'Приключения']],
    ['Охотник х Охотник (2011)', 148, 0, 'planned', 0, '', 2011, 'ТВ Сериал', ['Приключения']],
  ] as const).map((a, i) => ({ id: 'a' + i, title: a[0], poster: null, eps: a[1], ep: a[2], status: a[3] as Status, rating: a[4], note: a[5], year: a[6], type: a[7], genres: [...a[8]], updated: T0 - i * D })),
  cols: [{ id: 'c1', name: 'Лучшее за год', ids: ['a0', 'a3', 'a6'] }, { id: 'c2', name: 'Вечер с друзьями', ids: ['a1', 'a5'] }],
  history: [['Провожающая в последний путь Фрирен', 'вчера'], ['Re:Zero. Жизнь с нуля в альтернативном мире 4', 'вчера'], ['Гатиакута', 'вчера'], ['Человек-бензопила: Резе', '2 дн. назад'], ['Красная река', '2 дн. назад']]
    .map((h, i) => ({ id: 'h' + i, title: h[0], image: null, ep: 1, when: h[1] })),
};

/* ───────── эффекты ───────── */
const reduced = () => typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion:reduce)').matches;

function burst(el: Element, color: string) {
  if (typeof window === 'undefined' || reduced()) return;
  const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  for (let i = 0; i < 18; i++) {
    const p = document.createElement('i'), a = (Math.PI * 2 * i) / 18 + Math.random() * 0.5, d = 40 + Math.random() * 60, s = 4 + Math.random() * 4;
    p.style.cssText = `position:fixed;z-index:10000;pointer-events:none;width:${s}px;height:${s}px;border-radius:${i % 3 ? '50%' : '2px'};left:${cx}px;top:${cy}px;background:${color};box-shadow:0 0 12px ${color}`;
    document.body.appendChild(p);
    p.animate([{ transform: 'translate(-50%,-50%) scale(1) rotate(0)', opacity: 1 }, { transform: `translate(${Math.cos(a) * d - 3}px,${Math.sin(a) * d - 3}px) scale(0) rotate(240deg)`, opacity: 0 }],
      { duration: 650 + Math.random() * 400, easing: 'cubic-bezier(.2,.8,.3,1)' }).onfinish = () => p.remove();
  }
}

function Num({ n, d = 0 }: { n: number; d?: number }) {
  const [x, setX] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (reduced()) { from.current = n; const id = requestAnimationFrame(() => setX(n)); return () => cancelAnimationFrame(id); }
    const a = from.current, t0 = performance.now(); let raf = 0;
    const f = (t: number) => {
      const p = Math.min(1, (t - t0) / 1000), val = a + (n - a) * (1 - Math.pow(1 - p, 3));
      from.current = val; setX(val); if (p < 1) raf = requestAnimationFrame(f);
    };
    raf = requestAnimationFrame(f); return () => cancelAnimationFrame(raf);
  }, [n]);
  return <b>{x.toFixed(d)}</b>;
}
function Poster({ title, poster, children }: { title: string; poster?: string | null; children?: ReactNode }) {
  return (
    <div className="al-poster" style={v({ '--h': hue(title) })}>
      {poster ? <img src={poster} alt="" loading="lazy" draggable={false} /> : <div className="al-ph">{title.trim().charAt(0)}</div>}
      <i className="al-fade" />{children}
    </div>
  );
}
function Sel({ label, value, onChange, children }: { label?: string; value: string | number; onChange: (v: string) => void; children: ReactNode }) {
  return <label className="al-fl">{label && <span>{label}</span>}<PSelect value={value} onChange={(e) => onChange(e.target.value)}>{children}</PSelect></label>;
}
function Ring({ pct, c, size = 60 }: { pct: number; c: string; size?: number }) {
  const r = 24, C = 2 * Math.PI * r;
  return (
    <span className="al-ring" style={{ width: size, height: size, color: c }}>
      <svg viewBox="0 0 60 60"><circle cx="30" cy="30" r={r} className="t" /><circle cx="30" cy="30" r={r} className="f" style={{ stroke: c, strokeDasharray: `${(C * pct) / 100} ${C}` }} /></svg>
      <b>{Math.round(pct)}%</b>
    </span>
  );
}
const Ico = ({ d, s = 22 }: { d: ReactNode; s?: number }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const I = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  rows: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></>,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8Z" />,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  note: <path d="M4 5h16M4 12h16M4 19h10" />,
  download: <><path d="M12 3v12m0 0 4-4m-4 4-4-4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></>,
  upload: <><path d="M12 15V3m0 0 4 4m-4-4-4 4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></>,
  play: <path d="m7 4 13 8-13 8V4Z" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />,
  left: <path d="m15 18-6-6 6-6" />,
  right: <path d="m9 18 6-6-6-6" />,
  down: <path d="m6 9 6 6 6-6" />,
  select: <><rect x="3" y="3" width="18" height="18" rx="5" /><path d="m8 12.5 3 3 5-6" /></>,
  copy: <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></>,
  reset: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></>,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z" />,
};
const H2 = ({ icon, children, aside }: { icon: ReactNode; children: ReactNode; aside?: ReactNode }) => (
  <div className="al-sh"><h2><span className="al-shi">{icon}</span>{children}</h2><span className="al-shl" />{aside}</div>
);

/* ───────── компонент ───────── */
export default function MyList({ user = { name: 'otaku_rin' }, readOnly = false, catalogHref = '/catalog', shareUrl, initial, onSave, onClearHistory }: Props) {
  const [data, setData] = useState<ListData>(initial ?? DEMO);
  const [ready, setReady] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<'all' | Status>('all');
  const [q, setQ] = useState(''); const [sort, setSort] = useState('updated');
  const [genre, setGenre] = useState(''); const [yearFrom, setYearFrom] = useState(0); const [ratingFrom, setRatingFrom] = useState(0);
  const [colF, setColF] = useState<string | null>(null);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [selMode, setSelMode] = useState(false); const [sel, setSel] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null); const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<null | 'share' | 'io'>(null);
  const [newCol, setNewCol] = useState('');
  const [toast, setToast] = useState<{ t: string; undo?: () => void }>({ t: '' }); const [toastOn, setToastOn] = useState(false);
  const [histN, setHistN] = useState(10); const [hov, setHov] = useState<Status | null>(null);
  const [copied, setCopied] = useState(false); const [drag, setDrag] = useState(false);
  const [ind, setInd] = useState<{ l: number; t: number; w: number; h: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null); const tabsRef = useRef<HTMLDivElement>(null); const searchRef = useRef<HTMLInputElement>(null);
  const toastT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const saveRef = useRef<Props["onSave"]>(onSave); const skipSave = useRef(true);
  const timers = useRef<{ boot?: ReturnType<typeof setTimeout> }>({ boot: undefined });
  const link = shareUrl ?? (typeof window !== 'undefined' ? `${location.origin}/u/${encodeURIComponent(user.name)}/list` : '');

  useEffect(() => { saveRef.current = onSave; });
  useEffect(() => {
    /* Стартовое состояние приходит из localStorage, поэтому читаем его после
       первого кадра: иначе серверный снимок разойдётся с разметкой. */
    const boot = setTimeout(() => {
      if (!initial) { try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s?.items) setData(s); } catch { /* ignore */ } }
      try { const m = localStorage.getItem(VKEY); if (m === 'list' || m === 'grid') setView(m); } catch { /* ignore */ }
      setReady(true); const t = setTimeout(() => setMounted(true), 90); timers.current.boot = t;
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { clearTimeout(boot); if (timers.current.boot) clearTimeout(timers.current.boot); };
  }, []);

  /* Постеры и страницы тайтлов. У демо-данных картинок нет (poster: null),
     поэтому спрашиваем каталог Kodik по названию — как поиск в шапке — и
     подставляем настоящий постер и ссылку на страницу аниме. Ошибку молча
     не глотаем: без картинок карточки остаются цветными буквами, и это видно. */
  const [resolved, setResolved] = useState(false);
  useEffect(() => {
    if (resolved) return;
    let alive = true;
    (async () => {
      const norm = (s: string) => s.toLowerCase().replace(/[^a-zа-я0-9]+/gi, ' ').trim();
      const names = Array.from(new Set([...data.items.map((i) => i.title), ...data.history.map((h) => h.title)]));
      const found: Record<string, { poster?: string; href: string }> = {};
      for (const name of names) {
        try {
          const res = await fetch(`/api/kodik/search?${new URLSearchParams({ q: name, limit: '5' })}`);
          if (!res.ok) continue;
          const json = (await res.json()) as { results?: { id: string; title: string; poster?: string }[] };
          const rows = json.results ?? [];
          const hit = rows.find((x) => norm(x.title) === norm(name)) ?? rows[0];
          if (hit) found[name] = { poster: hit.poster, href: `/title/${hit.id}` };
        } catch { /* каталог недоступен — останутся буквы-плейсхолдеры */ }
        await new Promise((r) => setTimeout(r, 120));
      }
      if (!alive) return;
      setData((d) => ({
        ...d,
        items: d.items.map((i) => (found[i.title] ? { ...i, poster: i.poster ?? found[i.title].poster, href: i.href ?? found[i.title].href } : i)),
        history: d.history.map((h) => (found[h.title] ? { ...h, image: h.image ?? found[h.title].poster, href: h.href ?? found[h.title].href } : h)),
      }));
      setResolved(true);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.items.length, data.history.length, resolved]);
  useEffect(() => {
    if (!ready) return;
    if (skipSave.current) { skipSave.current = false; return; }
    const t = setTimeout(() => { const f = saveRef.current; if (f) f(data); else { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* ignore */ } } }, 300);
    return () => clearTimeout(t);
  }, [data, ready]);
  useEffect(() => { if (ready) { try { localStorage.setItem(VKEY, view); } catch { /* ignore */ } } }, [view, ready]);

  /* плавное появление блоков при прокрутке */
  useEffect(() => {
    const els = rootRef.current?.querySelectorAll<HTMLElement>('.rv:not(.in)'); if (!els) return;
    if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { threshold: 0.06, rootMargin: '0px 0px -30px 0px' });
    els.forEach((e) => io.observe(e)); return () => io.disconnect();
  }, [ready]);

  /* скользящий индикатор вкладок */
  useEffect(() => {
    const m = () => { const b = tabsRef.current?.querySelector<HTMLElement>('[aria-selected="true"]'); if (b) setInd({ l: b.offsetLeft, t: b.offsetTop, w: b.offsetWidth, h: b.offsetHeight }); };
    m(); window.addEventListener('resize', m); document.fonts?.ready.then(m);
    return () => window.removeEventListener('resize', m);
  }, [tab, data.items]);

  const say = (t: string, undo?: () => void) => {
    setToast({ t, undo }); setToastOn(true); clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToastOn(false), undo ? 6500 : 2000);
  };
  const upd = (id: string, patch: Partial<ListItem>, touch = true) =>
    setData((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, ...patch, ...(touch ? { updated: Date.now() } : {}) } : i)) }));
  const cur = data.items.find((i) => i.id === openId);
  const total = data.items.length;
  const cnt = (k: Status) => data.items.filter((i) => i.status === k).length;
  const genres = useMemo(() => Array.from(new Set(data.items.flatMap((i) => i.genres ?? []))).sort(), [data.items]);
  const years = useMemo(() => Array.from(new Set(data.items.map((i) => i.year).filter(Boolean) as number[])).sort((a, b) => b - a), [data.items]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase(), col = data.cols.find((c) => c.id === colF);
    return data.items.filter((i) => (tab === 'all' || i.status === tab) && (!s || i.title.toLowerCase().includes(s)) && (!genre || !!i.genres?.includes(genre))
      && (!yearFrom || (i.year ?? 0) >= yearFrom) && (!ratingFrom || i.rating >= ratingFrom) && (!col || col.ids.includes(i.id)))
      .sort((a, b) => sort === 'rating' ? b.rating - a.rating : sort === 'title' ? a.title.localeCompare(b.title, 'ru')
        : sort === 'progress' ? (b.eps ? b.ep / b.eps : 0) - (a.eps ? a.ep / a.eps : 0) : b.updated - a.updated);
  }, [data, tab, q, sort, genre, yearFrom, ratingFrom, colF]);
  const rated = data.items.filter((i) => i.rating);
  const avg = rated.length ? rated.reduce((a, i) => a + i.rating, 0) / rated.length : 0;
  const epsTotal = data.items.reduce((a, i) => a + i.ep, 0);
  const hours = data.items.reduce((a, i) => a + i.ep * mins(i), 0) / 60;
  const hist = useMemo(() => { const h = new Array<number>(10).fill(0); data.items.forEach((i) => { if (i.rating >= 1 && i.rating <= 10) h[i.rating - 1]++; }); return h; }, [data.items]);
  const hMax = Math.max(1, ...hist);
  const topGenres = useMemo(() => {
    const m = new Map<string, number>(); data.items.forEach((i) => i.genres?.forEach((g) => m.set(g, (m.get(g) || 0) + 1)));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [data.items]);
  const resume = useMemo(() => data.items.filter((i) => i.status === 'watching').sort((a, b) => b.updated - a.updated).slice(0, 3), [data.items]);
  const colName = data.cols.find((c) => c.id === colF)?.name;
  const filtersOn = !!(q || genre || yearFrom || ratingFrom || colF || tab !== 'all');
  const resetAll = () => { setQ(''); setGenre(''); setYearFrom(0); setRatingFrom(0); setColF(null); setTab('all'); };

  /* донат: сегменты кольца считаем по статусам, смещение — суммой долей выше */
  const R = 54, C = 2 * Math.PI * R;
  const segs = ST.reduce<{ s: (typeof ST)[number]; n: number; frac: number; len: number; off: number }[]>((acc, s) => {
    const n = cnt(s.k), frac = total ? n / total : 0;
    const off = -acc.reduce((a, x) => a + x.frac * C, 0);
    acc.push({ s, n, frac, len: Math.max(0, frac * C - (n && n < total ? 5 : 0)), off });
    return acc;
  }, []);

  /* действия */
  const setStatus = (it: ListItem, k: Status, el?: Element) => {
    upd(it.id, { status: k, ...(k === 'completed' && it.eps ? { ep: it.eps } : {}) });
    if (k === 'completed' && el) burst(el, SM[k].c);
  };
  const step = (it: ListItem, n: number, el?: Element) => {
    const ep = Math.max(0, Math.min(it.eps || 9999, n)), done = !!it.eps && ep === it.eps;
    upd(it.id, { ep, status: done ? 'completed' : ep > 0 && it.status === 'planned' ? 'watching' : it.status === 'completed' && it.eps && ep < it.eps ? 'watching' : it.status });
    if (done && it.status !== 'completed' && el) burst(el, SM.completed.c);
  };
  const rate = (it: ListItem, n: number, el: Element) => { upd(it.id, { rating: it.rating === n ? 0 : n }); if (n === 10 && it.rating !== 10) burst(el, '#24affb'); };
  const toggleCol = (cid: string, id: string) => setData((d) => ({ ...d, cols: d.cols.map((c) => (c.id !== cid ? c : { ...c, ids: c.ids.includes(id) ? c.ids.filter((x) => x !== id) : [...c.ids, id] })) }));
  const removeItems = (ids: string[]) => {
    const set = new Set(ids), removed = data.items.filter((i) => set.has(i.id)); if (!removed.length) return;
    const member = data.cols.map((c) => ({ id: c.id, ids: c.ids.filter((x) => set.has(x)) }));
    setData((d) => ({ ...d, items: d.items.filter((i) => !set.has(i.id)), cols: d.cols.map((c) => ({ ...c, ids: c.ids.filter((x) => !set.has(x)) })) }));
    setOpen(false);
    say(removed.length > 1 ? `Удалено тайтлов: ${removed.length}` : `«${removed[0].title}» удалён`,
      () => setData((d) => ({ ...d, items: [...d.items, ...removed], cols: d.cols.map((c) => ({ ...c, ids: [...c.ids, ...(member.find((m) => m.id === c.id)?.ids ?? [])] })) })));
  };
  const delCol = (c: Collection) => {
    const idx = data.cols.findIndex((x) => x.id === c.id);
    setData((d) => ({ ...d, cols: d.cols.filter((x) => x.id !== c.id) })); if (colF === c.id) setColF(null);
    say(`Подборка «${c.name}» удалена`, () => setData((d) => ({ ...d, cols: [...d.cols.slice(0, idx), c, ...d.cols.slice(idx)] })));
  };
  const addCol = (e: FormEvent) => {
    e.preventDefault(); const n = newCol.trim(); if (!n) return;
    setData((d) => ({ ...d, cols: [...d.cols, { id: 'c' + Date.now(), name: n, ids: [] }] })); setNewCol(''); say('Подборка создана — добавляйте в неё аниме из карточки');
  };
  const copy = () => navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); say('Ссылка скопирована'); }, () => say('Скопируйте ссылку вручную'));
  const exportJson = () => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = 'anigalaxy-list.json'; a.click(); say('Список сохранён в файл');
  };
  const importJson = async (f?: File) => {
    if (!f) return;
    try {
      const j = JSON.parse(await f.text()); if (!Array.isArray(j.items)) throw new Error();
      setData((d) => { const m = new Map(d.items.map((i) => [i.id, i])); (j.items as ListItem[]).forEach((i) => m.set(i.id, i)); return { ...d, items: Array.from(m.values()), cols: j.cols ?? d.cols }; });
      setModal(null); say('Список импортирован');
    } catch { say('Не удалось прочитать файл'); }
  };
  const openCard = (id: string) => { setOpenId(id); setOpen(true); };
  const toggleSel = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const pick = (it: ListItem) => (selMode ? toggleSel(it.id) : openCard(it.id));
  const exitSel = () => { setSelMode(false); setSel([]); };
  const bulkStatus = (k: Status) => {
    const ids = new Set(sel);
    setData((d) => ({ ...d, items: d.items.map((i) => (ids.has(i.id) ? { ...i, status: k, ...(k === 'completed' && i.eps ? { ep: i.eps } : {}), updated: Date.now() } : i)) }));
    say(`«${SM[k].n}»: ${sel.length} шт.`); exitSel();
  };
  const go = (dir: number) => {
    const i = list.findIndex((x) => x.id === openId); if (i < 0 || list.length < 2) return;
    setOpenId(list[(i + dir + list.length) % list.length].id);
  };

  /* клавиатура */
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const tg = e.target as HTMLElement | null, typing = !!tg && (/^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName) || tg.isContentEditable);
      if (e.key === 'Escape') { if (modal) setModal(null); else if (open) setOpen(false); else if (selMode) exitSel(); return; }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '/' && !open && !modal) { e.preventDefault(); searchRef.current?.focus(); }
      if (open && !modal && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) go(e.key === 'ArrowRight' ? 1 : -1);
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, modal, selMode, openId, list]);

  /* делегированные эффекты: подсветка за курсором, наклон, волна */
  const onMove = (e: RPE<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return;
    const t = (e.target as HTMLElement).closest<HTMLElement>('.fx'); if (!t) return;
    const r = t.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    t.style.setProperty('--mx', (x * 100).toFixed(1) + '%'); t.style.setProperty('--my', (y * 100).toFixed(1) + '%');
    if (t.classList.contains('tilt')) { t.style.setProperty('--ry', ((x - 0.5) * 10).toFixed(2) + 'deg'); t.style.setProperty('--rx', ((0.5 - y) * 10).toFixed(2) + 'deg'); }
  };
  const onOut = (e: RPE<HTMLDivElement>) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('.tilt');
    if (t && !t.contains(e.relatedTarget as Node | null)) { t.style.setProperty('--rx', '0deg'); t.style.setProperty('--ry', '0deg'); }
  };
  const onDown = (e: RPE<HTMLDivElement>) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('.rip');
    if (!t || (t as HTMLButtonElement).disabled || reduced()) return;
    const r = t.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2, el = document.createElement('i');
    el.className = 'al-rp'; el.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
    t.appendChild(el); setTimeout(() => el.remove(), 700);
  };

  /* ───── карточки ───── */
  const renderCard = (it: ListItem, i: number) => {
    const s = SM[it.status], pc = it.eps ? Math.min(100, Math.round((it.ep / it.eps) * 100)) : 0, on = sel.includes(it.id);
    return (
      <article key={it.id} className={'al-card fx tilt' + (on ? ' sel' : '')} tabIndex={0} style={v({ '--s': s.c, '--i': Math.min(i, 14) })}
        onClick={() => pick(it)} onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pick(it); } }}>
        <Poster title={it.title} poster={it.poster}>
          <span className="al-b tl" style={{ color: s.c }}><i />{s.n}</span>
          {selMode ? <span className={'al-ck' + (on ? ' on' : '')}><Ico d={I.check} s={14} /></span> : it.rating > 0 && <span className="al-b tr"><u>★</u> {it.rating}</span>}
          {!!it.eps && <span className="al-b bl al-ep">{it.status === 'planned' ? `${it.eps} эп.` : `${it.ep}/${it.eps} эп.`}</span>}
          {!readOnly && !selMode && (
            <div className="al-qa" onClick={(e) => e.stopPropagation()}>
              <button className="rip" aria-label="Предыдущая серия" onClick={() => step(it, it.ep - 1)}><Ico d={I.minus} s={14} /></button>
              <button className="rip pl" onClick={(e) => step(it, it.ep + 1, e.currentTarget)}>+1 эп.</button>
              <button className="rip" aria-label="Отметить просмотренным" title="Отметить просмотренным" onClick={(e) => setStatus(it, 'completed', e.currentTarget)}><Ico d={I.check} s={14} /></button>
            </div>
          )}
          {it.status !== 'planned' && !!it.eps && <span className="al-pb"><i style={{ width: pc + '%' }} /></span>}
        </Poster>
        <h3>{it.title}</h3>
        <p className="al-m">{[it.year, it.type].filter(Boolean).join(' • ')}{it.note && !readOnly && <span className="al-nt" title="Есть заметка"><Ico d={I.note} s={13} /></span>}</p>
      </article>
    );
  };
  const renderRow = (it: ListItem, i: number) => {
    const s = SM[it.status], pc = it.eps ? Math.min(100, Math.round((it.ep / it.eps) * 100)) : 0, on = sel.includes(it.id);
    return (
      <article key={it.id} className={'al-li fx glow' + (on ? ' sel' : '')} tabIndex={0} style={v({ '--s': s.c, '--i': Math.min(i, 14) })}
        onClick={() => pick(it)} onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pick(it); } }}>
        {selMode && <span className={'al-ck inl' + (on ? ' on' : '')}><Ico d={I.check} s={14} /></span>}
        <div className="al-lp"><Poster title={it.title} poster={it.poster} /></div>
        <div className="al-lt"><h3>{it.title}</h3><p className="al-m">{[it.year, it.type, it.genres?.slice(0, 2).join(', ')].filter(Boolean).join(' • ')}{it.note && !readOnly && <span className="al-nt" title="Есть заметка"><Ico d={I.note} s={13} /></span>}</p></div>
        <div className="al-lpg"><span>{it.ep}{it.eps ? ` / ${it.eps}` : ''} эп.</span><span className="al-pb s"><i style={{ width: pc + '%' }} /></span></div>
        <span className="al-chip"><i />{s.n}</span>
        <span className="al-lr">{it.rating ? <><u>★</u> {it.rating}</> : '—'}</span>
        {!readOnly && !selMode && (
          <div className="al-lq" onClick={(e) => e.stopPropagation()}>
            <button className="rip" aria-label="Предыдущая серия" onClick={() => step(it, it.ep - 1)}><Ico d={I.minus} s={14} /></button>
            <button className="rip pl" onClick={(e) => step(it, it.ep + 1, e.currentTarget)}>+1</button>
            <button className="rip" aria-label="Отметить просмотренным" onClick={(e) => setStatus(it, 'completed', e.currentTarget)}><Ico d={I.check} s={14} /></button>
          </div>
        )}
      </article>
    );
  };

  const tabs = ([{ k: 'all', n: 'Все', c: '' }, ...ST] as { k: 'all' | Status; n: string; c: string }[]);
  const curPos = cur ? list.findIndex((x) => x.id === cur.id) : -1;

  return (
    <div ref={rootRef} className={'al' + (readOnly ? ' ro' : '')} onPointerMove={onMove} onPointerOut={onOut} onPointerDown={onDown}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="al-stars" aria-hidden="true" /><div className="al-orb a" aria-hidden="true" /><div className="al-orb b" aria-hidden="true" />

      {/* ── шапка ── */}
      <header className="al-head">
        <div className="al-ttl">
          <span className="al-ico"><Ico d={I.grid} s={24} /></span>
          <div>
            <span className="al-eyebrow"><i />{readOnly ? 'Публичный список' : 'Ваша коллекция'}</span>
            <h1>{readOnly ? `Список ${user.name}` : 'Мой список'}</h1>
            <p className="al-sub">Отслеживайте прогресс просмотра аниме</p>
          </div>
        </div>
        {!readOnly && (
          <div className="al-hbtns">
            <button className="al-btn rip" onClick={() => setModal('io')}><Ico d={I.download} s={16} />Экспорт / Импорт</button>
            <button className="al-btn rip" onClick={() => setModal('share')}><Ico d={I.share} s={16} />Поделиться</button>
          </div>
        )}
      </header>

      {/* ── статистика ── */}
      <section className="al-bento rv">
        <div className="al-bc sf glow fx">
          <h5><Ico d={I.chart} s={14} />Распределение</h5>
          <div className="al-dn">
            <div className="al-dw">
              <svg viewBox="0 0 140 140" aria-hidden="true">
                <circle cx="70" cy="70" r={R} className="tr" />
                <g transform="rotate(-90 70 70)">
                  {segs.map(({ s, n, len, off }, k) => n > 0 && (
                    <circle key={s.k} cx="70" cy="70" r={R} className="sg" onClick={() => setTab(tab === s.k ? 'all' : s.k)}
                      onPointerEnter={() => setHov(s.k)} onPointerLeave={() => setHov(null)}
                      style={{ stroke: s.c, strokeDasharray: `${mounted ? len : 0} ${C}`, strokeDashoffset: off, strokeWidth: hov === s.k || tab === s.k ? 18 : 13, opacity: (hov || (tab !== 'all' ? tab : null)) && hov !== s.k && tab !== s.k ? 0.35 : 1, transitionDelay: `${k * 110}ms,0ms,0ms,0ms`, filter: `drop-shadow(0 0 6px ${s.c}88)` }} />
                  ))}
                </g>
              </svg>
              <div className="al-dtx"><Num n={total} /><small>тайтлов</small></div>
            </div>
            <div className="al-lg">
              {segs.map(({ s, n, frac }) => (
                <button key={s.k} className={tab === s.k ? 'on' : ''} style={v({ '--s': s.c })} onClick={() => setTab(tab === s.k ? 'all' : s.k)} onPointerEnter={() => setHov(s.k)} onPointerLeave={() => setHov(null)}>
                  <i /><span>{s.n}</span><b>{n}</b><em>{Math.round(frac * 100)}%</em>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="al-bc sf glow fx">
          <h5><Ico d={I.star} s={14} />Средняя оценка</h5>
          <div className="al-big">{avg ? <Num n={avg} d={1} /> : <b>—</b>}<small>/ 10</small></div>
          <div className="al-rh" aria-label="Распределение оценок">
            {hist.map((n, k) => (
              <div key={k} title={`Оценка ${k + 1}: ${n}`} className={n ? '' : 'z'}>
                <div className="al-rbw"><i style={{ height: `${Math.max(4, (n / hMax) * 100)}%`, transform: mounted ? 'scaleY(1)' : 'scaleY(0)', transitionDelay: `${k * 60 + 200}ms` }} /></div>
                <span>{k + 1}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="al-bc sf glow fx">
          <h5><Ico d={I.clock} s={14} />Время в аниме</h5>
          <div className="al-big"><Num n={epsTotal} /><small>серий</small></div>
          <div className="al-sm"><span>≈ <b><Num n={hours} /></b> ч просмотра</span>{!readOnly && <span><b><Num n={data.items.filter((i) => i.note).length} /></b> заметок</span>}</div>
          {!!topGenres.length && <div className="al-gtags">{topGenres.map(([g, n]) => <button key={g} className={genre === g ? 'on' : ''} onClick={() => setGenre(genre === g ? '' : g)}>{g} · {n}</button>)}</div>}
        </div>
      </section>

      {/* ── продолжить просмотр ── */}
      {!readOnly && resume.length > 0 && (
        <section>
          <H2 icon={<Ico d={I.play} s={16} />}>Продолжить просмотр</H2>
          <div className="al-cgrid">
            {resume.map((it, i) => {
              const pc = it.eps ? Math.round((it.ep / it.eps) * 100) : 0, left = it.eps ? it.eps - it.ep : 0;
              return (
                <article key={it.id} className="al-cc fx glow" style={v({ '--h': hue(it.title), '--i': i })} onClick={() => openCard(it.id)}>
                  <div className="al-cbg" style={it.poster ? { backgroundImage: `url("${it.poster}")` } : undefined} />
                  <div className="al-cpost"><Poster title={it.title} poster={it.poster} /></div>
                  <div className="al-cbody">
                    <span className="al-chip" style={v({ '--s': SM.watching.c })}><i />Серия {it.ep + 1}</span>
                    <h3>{it.title}</h3>
                    <p className="al-m">{it.eps ? `Осталось ${left} ${left === 1 ? 'серия' : 'серий'} · ≈ ${Math.round((left * mins(it)) / 60)} ч` : 'Продолжайте с того места, где остановились'}</p>
                    <button className="al-primary sm rip" onClick={(e) => { e.stopPropagation(); step(it, it.ep + 1, e.currentTarget); }}><Ico d={I.plus} s={14} />Серия просмотрена</button>
                  </div>
                  {!!it.eps && <Ring pct={pc} c={SM.watching.c} />}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* ── панель фильтров ── */}
      <section className="al-panel sf glow fx rv">
        <div className="al-row">
          <label className="al-search"><Ico d={I.search} s={18} /><input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по списку…" />
            {q ? <button type="button" className="al-clr" aria-label="Очистить" onClick={() => setQ('')}><Ico d={I.x} s={14} /></button> : <kbd>/</kbd>}
          </label>
          <Sel value={sort} onChange={setSort}><option value="updated">Сначала новые</option><option value="rating">По оценке</option><option value="progress">По прогрессу</option><option value="title">По названию</option></Sel>
          <div className="al-vt" data-v={view} role="group" aria-label="Вид">
            <button className={view === 'grid' ? 'on' : ''} aria-label="Сетка" title="Сетка" onClick={() => setView('grid')}><Ico d={I.grid} s={17} /></button>
            <button className={view === 'list' ? 'on' : ''} aria-label="Список" title="Список" onClick={() => setView('list')}><Ico d={I.rows} s={17} /></button>
          </div>
          {!readOnly && <button className={'al-btn rip' + (selMode ? ' on' : '')} onClick={() => (selMode ? exitSel() : setSelMode(true))}><Ico d={I.select} s={16} />Выбрать</button>}
        </div>
        <div className="al-tabs" role="tablist" ref={tabsRef}>
          {ind && <span className="al-ind" style={v({ transform: `translate(${ind.l}px,${ind.t}px)`, width: ind.w, height: ind.h, '--ic': tab === 'all' ? '#1d8cff' : SM[tab].c })} />}
          {tabs.map((s) => (
            <button key={s.k} role="tab" aria-selected={tab === s.k} className={'al-tab' + (tab === s.k ? ' on' : '')} style={s.c ? v({ '--s': s.c }) : undefined} onClick={() => setTab(s.k)}>
              {s.k !== 'all' && <i />}{s.n}<em>{s.k === 'all' ? total : cnt(s.k)}</em>
            </button>
          ))}
        </div>
        <div className="al-sep" />
        <div className="al-filters">
          <Sel label="Жанр" value={genre} onChange={setGenre}><option value="">Любой</option>{genres.map((g) => <option key={g}>{g}</option>)}</Sel>
          <Sel label="Год от" value={yearFrom} onChange={(x) => setYearFrom(+x)}><option value={0}>Любой</option>{years.map((y) => <option key={y} value={y}>{y}</option>)}</Sel>
          <Sel label="Рейтинг от" value={ratingFrom} onChange={(x) => setRatingFrom(+x)}><option value={0}>Любой</option>{[5, 6, 7, 8, 9, 10].map((r) => <option key={r} value={r}>{r}+</option>)}</Sel>
          {filtersOn && <button className="al-reset rip" onClick={resetAll}><Ico d={I.reset} s={15} />Сбросить</button>}
        </div>
      </section>

      {/* ── избранное ── */}
      <div className="rv">
        <H2 icon={<Ico d={I.heart} s={16} />}>Избранное</H2>
        <p className="al-hsub">{total ? `${list.length} из ${total} тайтлов` : 'Список пуст'} · подборок: {data.cols.length}</p>
        {colName && <button className="al-fchip" onClick={() => setColF(null)}>Подборка: {colName}<Ico d={I.x} s={13} /></button>}
      </div>
      {list.length ? (
        view === 'grid' ? <div className="al-grid">{list.map(renderCard)}</div> : <div className="al-lst">{list.map(renderRow)}</div>
      ) : (
        <div className="al-empty">
          <span className="al-ico big"><Ico d={I.heart} s={28} /></span>
          <h3>{total ? 'Ничего не найдено' : 'Список пока пуст'}</h3>
          <p>{total ? 'Измените фильтры или запрос.' : 'Добавьте тайтлы сердцем на странице аниме — они появятся здесь.'}</p>
          {total > 0 && <button className="al-primary rip" onClick={resetAll}><Ico d={I.reset} s={16} />Сбросить фильтры</button>}
          {!total && !readOnly && <a className="al-primary rip" href={catalogHref}><Ico d={I.plus} s={16} />Открыть каталог</a>}
        </div>
      )}

      {/* ── подборки ── */}
      <div className="rv">
        <H2 icon={<Ico d={I.layers} s={16} />}>Подборки</H2>
        <div className="al-cols">
          {data.cols.map((c, ci) => {
            const its = c.ids.map((id) => data.items.find((i) => i.id === id)).filter(Boolean) as ListItem[];
            return (
              <div key={c.id} className="al-colw" style={v({ '--i': ci })}>
                <button className={'al-col fx glow' + (colF === c.id ? ' on' : '')} onClick={() => setColF(colF === c.id ? null : c.id)}>
                  <span className="al-stack">
                    {(its.length ? its.slice(0, 3) : [{ id: 'x', title: c.name, poster: null } as ListItem]).map((x, k) => (
                      <span key={x.id} className="al-sk" style={v({ '--h': hue(x.title), '--k': k })}>{x.poster ? <img src={x.poster} alt="" draggable={false} /> : <b>{x.title.charAt(0)}</b>}</span>
                    ))}
                  </span>
                  <span className="al-ct"><h4>{c.name}</h4><small>тайтлов: {its.length}</small></span>
                </button>
                {!readOnly && <button className="al-cdel" aria-label="Удалить подборку" onClick={() => delCol(c)}><Ico d={I.x} s={14} /></button>}
              </div>
            );
          })}
          {!readOnly && <form className="al-new" onSubmit={addCol}><input value={newCol} onChange={(e) => setNewCol(e.target.value)} placeholder="Новая подборка…" maxLength={40} aria-label="Название подборки" /><button aria-label="Создать подборку"><Ico d={I.plus} s={18} /></button></form>}
          {readOnly && !data.cols.length && <p className="al-hsub">Подборок пока нет</p>}
        </div>
      </div>

      {/* ── история ── */}
      {!readOnly && (
        <div className="rv">
          <H2 icon={<Ico d={I.clock} s={16} />}>История просмотров</H2>
          <div className="al-hhead"><span>{data.history.length} записей</span>{!!data.history.length && <button onClick={() => { if (confirm('Очистить историю просмотров?')) { setData((d) => ({ ...d, history: [] })); onClearHistory?.(); } }}>Очистить историю</button>}</div>
          <div className="al-hist">
            {data.history.slice(0, histN).map((h, i) => {
              const body = (<>
                <div className="al-hi" style={v({ '--h': hue(h.title) })}>{h.image ? <img src={h.image} alt="" loading="lazy" /> : <b>{h.title.trim().charAt(0)}</b>}<span className="al-hp"><Ico d={I.play} s={18} /></span></div>
                <div className="al-hb"><div className="al-hm"><span>Серия {h.ep}</span><em>{h.when}</em></div><h3>{h.title}</h3></div>
              </>);
              const st = v({ '--i': i % 10 });
              return h.href ? <a key={h.id} className="al-h fx glow" href={h.href} style={st}>{body}</a> : <div key={h.id} className="al-h fx glow" style={st}>{body}</div>;
            })}
          </div>
          {data.history.length > 10 && (
            <div className="al-morew">
              {histN < data.history.length && <button className="al-btn rip" onClick={() => setHistN((n) => n + 10)}><Ico d={I.down} s={16} />Показать ещё ({Math.min(10, data.history.length - histN)})</button>}
              {histN > 10 && <button className="al-btn rip" onClick={() => setHistN(10)}>Свернуть</button>}
            </div>
          )}
        </div>
      )}

      {/* ── панель массовых действий ── */}
      <div className={'al-bar' + (selMode ? ' on' : '')} role="toolbar" aria-label="Массовые действия">
        <span className="al-bn"><b>{sel.length}</b> выбрано</span>
        <button className="al-bsm" onClick={() => setSel(sel.length === list.length ? [] : list.map((i) => i.id))}>{list.length > 0 && sel.length === list.length ? 'Снять всё' : 'Выбрать всё'}</button>
        <span className="al-bdiv" />
        {ST.map((s) => <button key={s.k} className="al-bs" style={v({ '--s': s.c })} title={s.n} disabled={!sel.length} onClick={() => bulkStatus(s.k)}><i /><span>{s.n}</span></button>)}
        <span className="al-bdiv" />
        <button className="al-bsm danger" aria-label="Удалить выбранные" disabled={!sel.length} onClick={() => { removeItems(sel); exitSel(); }}><Ico d={I.trash} s={16} /></button>
        <button className="al-bsm" onClick={exitSel}>Готово</button>
      </div>

      {/* ── карточка тайтла ──
          Шторку рисуем в body: страница живёт в <main> со своим z-index, иначе
          плавающие кнопки чата ложатся поверх подвала карточки. */}
      {mounted && createPortal(<>
      <div className={'al-veil' + (open ? ' open' : '')} onClick={() => setOpen(false)} />
      <aside className={'al-drawer' + (open ? ' open' : '')} style={v({ '--h': cur ? hue(cur.title) : 210 })} aria-hidden={!open}>
        {cur && (<>
          <div className="al-dtop">
            <span className="al-pos">{curPos >= 0 ? `${curPos + 1} / ${list.length}` : ''}</span>
            <div className="al-dnav">
              <button onClick={() => go(-1)} aria-label="Предыдущий" disabled={list.length < 2}><Ico d={I.left} s={16} /></button>
              <button onClick={() => go(1)} aria-label="Следующий" disabled={list.length < 2}><Ico d={I.right} s={16} /></button>
              <button onClick={() => setOpen(false)} aria-label="Закрыть"><Ico d={I.x} s={16} /></button>
            </div>
          </div>
          <div className="al-dh">
            <div className="al-dp"><Poster title={cur.title} poster={cur.poster} /></div>
            <div><h2>{cur.title}</h2><span className="al-mut">{[cur.year, cur.type, cur.eps ? `${cur.eps} серий` : ''].filter(Boolean).join(' • ')}</span>
              {!!cur.genres?.length && <div className="al-gl">{cur.genres.map((g) => <span key={g}>{g}</span>)}</div>}</div>
          </div>
          <div className="al-sec"><h4>Статус</h4><div className="al-seg">
            {ST.map((s) => <button key={s.k} disabled={readOnly} className={'rip' + (cur.status === s.k ? ' on' : '')} style={v({ '--s': s.c })} onClick={(e) => setStatus(cur, s.k, e.currentTarget)}><i />{s.n}</button>)}
          </div></div>
          <div className="al-sec"><h4>Прогресс <b>{cur.ep} / {cur.eps || '?'}</b></h4><div className="al-step">
            <button disabled={readOnly} aria-label="Минус серия" onClick={() => step(cur, cur.ep - 1)}><Ico d={I.minus} s={16} /></button>
            <input type="range" min={0} max={cur.eps || Math.max(cur.ep, 1)} value={cur.ep} disabled={readOnly} style={v({ '--p': (cur.eps ? (cur.ep / cur.eps) * 100 : 100) + '%' })} onChange={(e) => step(cur, +e.target.value)} />
            <button disabled={readOnly} aria-label="Плюс серия" onClick={(e) => step(cur, cur.ep + 1, e.currentTarget)}><Ico d={I.plus} s={16} /></button>
          </div></div>
          <div className="al-sec"><h4>Ваша оценка <b>{cur.rating ? `${cur.rating} / 10` : 'не выставлена'}</b></h4><div className="al-rate">
            {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((n) => <button key={n} disabled={readOnly} className={n <= cur.rating ? 'on' : ''} onClick={(e) => rate(cur, n, e.currentTarget)}>{n}</button>)}
          </div></div>
          {!readOnly && <div className="al-sec"><h4>Личная заметка</h4><textarea value={cur.note} onChange={(e) => upd(cur.id, { note: e.target.value }, false)} placeholder="Впечатления, любимые моменты, что вспомнить при пересмотре…" /></div>}
          {!!data.cols.length && <div className="al-sec"><h4>Подборки</h4><div className="al-chips">
            {data.cols.map((c) => <button key={c.id} disabled={readOnly} className={c.ids.includes(cur.id) ? 'on' : ''} onClick={() => toggleCol(c.id, cur.id)}>{c.name}</button>)}
          </div></div>}
          {!readOnly && <div className="al-dfoot"><button className="al-danger" onClick={() => removeItems([cur.id])}><Ico d={I.trash} s={15} />Удалить</button><a className="al-primary rip" href={cur.href ?? `/catalog?${new URLSearchParams({ q: cur.title })}`}><Ico d={I.play} s={15} />Смотреть</a><button className="al-primary rip" onClick={() => setOpen(false)}>Готово</button></div>}
        </>)}
      </aside>
      </>, document.body)}

      {/* ── модальные окна ── */}
      <div className={'al-modal' + (modal ? ' open' : '')} onClick={(e) => e.target === e.currentTarget && setModal(null)}>
        <div className="al-mp" role="dialog" aria-modal="true">
          <button className="al-x" onClick={() => setModal(null)} aria-label="Закрыть"><Ico d={I.x} s={16} /></button>
          {modal === 'share' && (<>
            <h3>Поделиться списком</h3>
            <p className="al-mut">Любой, у кого есть ссылка, увидит ваш список, оценки и подборки. Личные заметки и история остаются приватными.</p>
            <div className="al-link"><input readOnly value={link} onFocus={(e) => e.target.select()} /><button className="al-primary rip" onClick={copy}><Ico d={copied ? I.check : I.copy} s={15} />{copied ? 'Готово' : 'Копировать'}</button></div>
            <label className="al-sw"><input type="checkbox" checked={data.public} onChange={() => { setData((d) => ({ ...d, public: !d.public })); say(data.public ? 'Список скрыт' : 'Список теперь публичный'); }} /><span className="al-track"><i /></span>{data.public ? 'Список открыт по ссылке' : 'Список закрыт — виден только вам'}</label>
            <a className="al-guest" href="?view=public" target="_blank" rel="noopener noreferrer">Посмотреть как гость</a>
          </>)}
          {modal === 'io' && (<>
            <h3>Экспорт / Импорт</h3>
            <p className="al-mut">Сохраните список в файл или загрузите его из ранее сохранённого. При импорте записи с одинаковым id обновляются.</p>
            <button className="al-primary rip" onClick={exportJson}><Ico d={I.download} s={16} />Скачать (JSON)</button>
            <label className={'al-drop' + (drag ? ' on' : '')} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); importJson(e.dataTransfer.files?.[0]); }}>
              <Ico d={I.upload} s={26} /><b>Перетащите файл сюда</b><span>или нажмите, чтобы выбрать .json</span>
              <input type="file" accept="application/json,.json" hidden onChange={(e) => { importJson(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
          </>)}
        </div>
      </div>
      <div className={'al-toast' + (toastOn ? ' show' : '')} role="status"><span>{toast.t}</span>{toast.undo && <button onClick={() => { toast.undo?.(); setToastOn(false); }}>Отменить</button>}</div>
    </div>
  );
}

const CSS = `
@property --ang{syntax:"<angle>";inherits:false;initial-value:0deg}
.al{--ink:#f2f6ff;--mut:#8b96b5;--dim:#56638a;--line:rgba(96,140,255,.15);--line2:rgba(96,160,255,.34);--acc:#1d8cff;--cy:#22d3ee;--in:rgba(5,8,18,.85);--ib:#1b2548;--w:1220px;
  color-scheme:dark;position:relative;isolation:isolate;width:min(var(--w),calc(100% - 32px));margin:0 auto;padding:52px 0 150px;color:var(--ink);font-family:inherit}
.al *{box-sizing:border-box}
/* Шторка и затемнение живут в body (portal) — переменные темы переносим им */
.al-veil,.al-drawer{--ink:#f2f6ff;--mut:#8b96b5;--dim:#56638a;--line:rgba(96,140,255,.15);--line2:rgba(96,160,255,.34);--acc:#1d8cff;--cy:#22d3ee;--in:rgba(5,8,18,.85);--ib:#1b2548;color-scheme:dark;color:var(--ink)}
.al button,.al input,.al select,.al textarea{font:inherit;color:inherit}
.al button{cursor:pointer;-webkit-tap-highlight-color:transparent}.al button:disabled{cursor:default}
.al h1,.al h2,.al h3,.al h4,.al h5,.al p{margin:0}
.al :focus-visible{outline:2px solid var(--cy);outline-offset:2px}
.al ::selection{background:rgba(29,140,255,.45)}
.al b{font-weight:800}

/* фон */
.al::before{content:"";position:fixed;inset:0;z-index:-2;pointer-events:none;
  background-color:#04060f;background-image:radial-gradient(34% 70% at 0% 62%,rgba(76,52,214,.22),transparent 70%),radial-gradient(30% 60% at 100% 28%,rgba(24,104,230,.22),transparent 70%),radial-gradient(40% 30% at 50% 0,rgba(29,140,255,.10),transparent 70%);animation:alAur 18s ease-in-out infinite alternate}
@keyframes alAur{to{transform:scale(1.08) translate3d(-1.5%,1.5%,0)}}
.al-stars{position:absolute;inset:-20px -40px auto;height:680px;z-index:-1;pointer-events:none;opacity:.5;
  background-image:radial-gradient(1.5px 1.5px at 20px 30px,#fff,transparent),radial-gradient(1px 1px at 90px 140px,#9cc8ff,transparent),radial-gradient(1.5px 1.5px at 170px 70px,#fff,transparent),radial-gradient(1px 1px at 60px 200px,#c4b5fd,transparent);
  background-size:220px 240px,310px 270px,370px 330px,260px 300px;-webkit-mask-image:linear-gradient(#000 20%,transparent 90%);mask-image:linear-gradient(#000 20%,transparent 90%);animation:alTw 5s ease-in-out infinite alternate}
@keyframes alTw{50%{opacity:.2}}
.al-orb{position:absolute;z-index:-1;pointer-events:none;border-radius:50%;filter:blur(90px)}
.al-orb.a{width:420px;height:420px;left:-140px;top:60px;background:rgba(29,140,255,.14);animation:alFl 14s ease-in-out infinite alternate}
.al-orb.b{width:360px;height:360px;right:-120px;top:380px;background:rgba(34,211,238,.09);animation:alFl 17s ease-in-out infinite alternate-reverse}
@keyframes alFl{to{transform:translate3d(60px,50px,0) scale(1.15)}}

/* общие */
.rv{opacity:0;transform:translateY(28px);transition:opacity .85s cubic-bezier(.2,.8,.2,1),transform .85s cubic-bezier(.2,.8,.2,1)}.rv.in{opacity:1;transform:none}
.sf{position:relative;border-radius:22px;border:1px solid var(--line);background:linear-gradient(180deg,rgba(14,21,46,.78),rgba(6,9,22,.88));box-shadow:0 36px 60px -44px #000,inset 0 1px 0 rgba(255,255,255,.05);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
.glow{position:relative}
.glow::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:0;transition:opacity .35s;background:radial-gradient(480px circle at var(--mx,50%) var(--my,50%),rgba(70,150,255,.12),transparent 62%)}
.glow::after{content:"";position:absolute;inset:0;border-radius:inherit;padding:1px;pointer-events:none;opacity:0;transition:opacity .35s;background:radial-gradient(280px circle at var(--mx,50%) var(--my,50%),rgba(120,200,255,.85),transparent 70%);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}
.glow:hover::before,.glow:hover::after{opacity:1}
.rip{position:relative;overflow:hidden}
.al-rp{position:absolute;border-radius:50%;pointer-events:none;background:rgba(255,255,255,.3);transform:scale(0);animation:alRp .65s ease-out forwards}
@keyframes alRp{to{transform:scale(1);opacity:0}}
@keyframes alUp{from{opacity:0;transform:translateY(30px) scale(.96)}}
@keyframes alBlink{50%{opacity:.35}}

/* шапка */
.al-head{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap}
.al-ttl{display:flex;gap:18px;align-items:center}
.al-ico{flex:none;display:grid;place-items:center;width:58px;height:58px;border-radius:17px;color:#5aa2ff;background:linear-gradient(145deg,#0e2150,#08122c);border:1px solid rgba(37,99,235,.7);animation:alPulse 3.6s ease-in-out infinite}
.al-ico.big{width:68px;height:68px;border-radius:20px;margin:0 auto 20px;color:#5fb0ff;background:#0b1126;border-color:var(--ib);animation:alPulse 3.6s ease-in-out infinite,alBob 4s ease-in-out infinite}
@keyframes alBob{50%{translate:0 -6px}}
@keyframes alPulse{0%,100%{box-shadow:0 0 12px -4px rgba(29,140,255,.4)}50%{box-shadow:0 0 34px -2px rgba(29,140,255,.85)}}
.al-eyebrow{display:inline-flex;align-items:center;gap:8px;margin-bottom:10px;padding:6px 13px;border-radius:99px;border:1px solid rgba(34,211,238,.35);background:rgba(34,211,238,.08);color:var(--cy);font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}
.al-eyebrow i{width:6px;height:6px;border-radius:50%;background:var(--cy);box-shadow:0 0 10px var(--cy);animation:alBlink 2s infinite}
.al h1{font-size:clamp(34px,5vw,52px);font-weight:800;letter-spacing:-.03em;line-height:1.05;background:linear-gradient(90deg,#fff 0,#fff 38%,#7cc4ff 62%,#22d3ee 78%,#fff 100%);background-size:240% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:alShine 9s linear infinite}
@keyframes alShine{from{background-position:100% 0}to{background-position:-140% 0}}
.al-sub{margin-top:9px;color:var(--mut);font-size:14.5px;font-weight:600}
.al-hbtns{display:flex;gap:10px;flex-wrap:wrap}
.al-btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;padding:12px 18px;border-radius:13px;background:rgba(11,16,36,.85);border:1px solid var(--line);font-weight:700;font-size:14px;transition:.25s}
.al-btn:hover{border-color:var(--acc);box-shadow:0 0 30px -8px var(--acc);transform:translateY(-2px)}
.al-btn.on{border-color:var(--acc);background:rgba(29,140,255,.2);box-shadow:0 0 26px -8px var(--acc)}
.al-primary{position:relative;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;gap:9px;border:0;border-radius:12px;padding:12px 22px;font-weight:700;font-size:14px;color:#fff;text-decoration:none;
  background:linear-gradient(135deg,#2aa0ff,#0b72f2);box-shadow:0 0 26px -3px rgba(29,140,255,.7);transition:.25s}
.al-primary.sm{padding:9px 15px;font-size:13px;border-radius:11px}
.al-primary::after{content:"";position:absolute;inset:0;background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.4) 50%,transparent 65%);transform:translateX(-130%);transition:transform .7s;pointer-events:none}
.al-primary:hover{transform:translateY(-2px);box-shadow:0 0 40px -2px rgba(29,140,255,.95)}.al-primary:hover::after{transform:translateX(130%)}

/* статистика */
.al-bento{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:16px;margin-top:36px}
.al-bc{padding:22px 24px;overflow:hidden}
.al-bc h5{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:800;letter-spacing:.13em;text-transform:uppercase;color:var(--mut)}.al-bc h5 svg{color:var(--cy)}
.al-big{display:flex;align-items:baseline;gap:9px;margin-top:14px;font-size:48px;font-weight:800;letter-spacing:-.035em;line-height:1;background:linear-gradient(180deg,#fff,#8fc2ff);-webkit-background-clip:text;background-clip:text;color:transparent;font-variant-numeric:tabular-nums}
.al-big small{font-size:14px;font-weight:700;letter-spacing:0;-webkit-text-fill-color:var(--mut)}
.al-dn{display:flex;align-items:center;gap:24px;margin-top:12px}
.al-dw{position:relative;flex:none;width:152px;height:152px}.al-dw svg{width:100%;height:100%;overflow:visible}
.al-dw circle{fill:none}.al-dw .tr{stroke:rgba(255,255,255,.06);stroke-width:13}
.al-dw .sg{cursor:pointer;transition:stroke-dasharray 1.1s cubic-bezier(.2,.8,.2,1),stroke-width .25s,opacity .25s}
.al-dtx{position:absolute;inset:0;display:grid;place-content:center;text-align:center;pointer-events:none;font-size:30px;font-weight:800;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.al-dtx small{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--mut)}
.al-lg{display:grid;gap:4px;flex:1;min-width:0}
.al-lg button{display:grid;grid-template-columns:10px 1fr auto 38px;gap:10px;align-items:center;padding:8px 10px;border-radius:11px;border:1px solid transparent;background:none;text-align:left;font-size:13px;font-weight:700;color:var(--mut);transition:.2s}
.al-lg button:hover,.al-lg button.on{background:rgba(255,255,255,.05);color:#fff;border-color:var(--line)}
.al-lg i{width:9px;height:9px;border-radius:50%;background:var(--s);box-shadow:0 0 10px var(--s)}
.al-lg b{color:#fff;font-variant-numeric:tabular-nums}.al-lg em{font-style:normal;font-size:11px;opacity:.7;text-align:right}
.al-rh{display:flex;align-items:stretch;gap:7px;height:92px;margin-top:20px}
.al-rh>div{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0}
.al-rbw{flex:1;display:flex;align-items:flex-end;width:100%}
.al-rbw i{display:block;width:100%;border-radius:6px 6px 3px 3px;background:linear-gradient(180deg,#4db8fc,#0bb5f5);box-shadow:0 0 14px -4px #0bb5f5;transform-origin:bottom;transition:transform 1s cubic-bezier(.2,.8,.2,1)}
.al-rh .z i{background:rgba(255,255,255,.08);box-shadow:none}
.al-rh span{font-size:10px;font-weight:700;color:var(--dim)}
.al-sm{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:16px;font-size:13px;font-weight:600;color:var(--mut)}.al-sm b{color:#fff;font-variant-numeric:tabular-nums}
.al-gtags{display:flex;flex-wrap:wrap;gap:7px;margin-top:16px}
.al-gtags button{padding:6px 12px;border-radius:99px;border:1px solid var(--ib);background:rgba(255,255,255,.03);font-size:12px;font-weight:700;color:var(--mut);transition:.2s}
.al-gtags button:hover,.al-gtags button.on{color:#fff;border-color:var(--acc);background:rgba(29,140,255,.18)}

/* заголовки секций */
.al-sh{display:flex;align-items:center;gap:16px;margin:54px 0 8px}
.al-sh h2{display:flex;align-items:center;gap:12px;font-size:24px;font-weight:800;letter-spacing:-.01em;white-space:nowrap}
.al-shi{display:grid;place-items:center;width:34px;height:34px;border-radius:11px;color:var(--cy);background:rgba(34,211,238,.09);border:1px solid rgba(34,211,238,.28);box-shadow:0 0 20px -6px rgba(34,211,238,.7)}
.al-shl{flex:1;height:1px;background:linear-gradient(90deg,var(--line2),transparent)}
.al-hsub{color:var(--mut);font-size:14px;font-weight:600;margin-bottom:18px}
.al-fchip{display:inline-flex;align-items:center;gap:8px;margin:0 0 16px;padding:8px 14px;border-radius:99px;border:1px solid var(--acc);background:rgba(29,140,255,.15);font-size:13px;font-weight:700;transition:.2s}.al-fchip:hover{background:rgba(29,140,255,.28)}

/* продолжить */
.al-cgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px;margin-top:16px}
.al-cc{position:relative;overflow:hidden;display:flex;gap:18px;align-items:center;padding:16px 18px 16px 16px;border-radius:22px;cursor:pointer;border:1px solid var(--line);
  background:linear-gradient(135deg,hsl(var(--h) 50% 17%),rgba(6,9,22,.96) 72%);transition:transform .4s cubic-bezier(.2,1.2,.3,1),border-color .3s,box-shadow .3s;animation:alUp .75s cubic-bezier(.2,.8,.2,1) backwards;animation-delay:calc(var(--i)*100ms)}
.al-cc:hover{transform:translateY(-5px);border-color:var(--line2);box-shadow:0 30px 50px -30px hsl(var(--h) 80% 55%/.7)}
.al-cbg{position:absolute;inset:-30%;background-size:cover;background-position:center;filter:blur(44px) saturate(1.5);opacity:.3;pointer-events:none}
.al-cc>*{position:relative}.al-cc>.al-cbg{position:absolute}
.al-cpost{flex:none;width:86px}.al-cpost .al-poster{border-radius:14px;box-shadow:0 20px 34px -12px #000}.al-cpost .al-ph{font-size:30px}
.al-cbody{flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:8px}
.al-cbody h3{font-size:16.5px;font-weight:800;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.al-chip{display:inline-flex;align-items:center;gap:7px;padding:4px 11px;border-radius:99px;background:color-mix(in srgb,var(--s,#22d3ee) 16%,#080c1a);border:1px solid color-mix(in srgb,var(--s,#22d3ee) 40%,transparent);color:var(--s,#22d3ee);font-size:11.5px;font-weight:800;white-space:nowrap}
.al-chip i{width:6px;height:6px;border-radius:50%;background:var(--s,#22d3ee);box-shadow:0 0 8px var(--s,#22d3ee)}
.al-ring{position:relative;flex:none;display:grid;place-items:center}.al-ring svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg);overflow:visible;filter:drop-shadow(0 0 4px color-mix(in srgb,currentColor 70%,transparent))}
.al-ring circle{fill:none;stroke-width:5}.al-ring .t{stroke:rgba(255,255,255,.09)}.al-ring .f{stroke-linecap:round;transition:stroke-dasharray 1s cubic-bezier(.2,.8,.2,1)}
.al-ring b{color:#fff;font-size:12.5px;font-weight:800;font-variant-numeric:tabular-nums}

/* панель фильтров */
.al-panel{margin-top:44px;padding:18px}
.al-row{display:flex;gap:12px;align-items:stretch}
.al-search{flex:1;min-width:0;display:flex;align-items:center;gap:11px;padding:0 14px 0 16px;border-radius:13px;background:var(--in);border:1px solid var(--ib);color:var(--mut);transition:.25s}
.al-search:focus-within{border-color:var(--acc);box-shadow:0 0 30px -8px var(--acc);color:var(--ink)}
.al-search input{flex:1;min-width:0;background:none;border:0;padding:14px 0;font-size:14px;font-weight:600}.al-search input:focus{outline:0}
.al-search kbd{font:700 11px/1 inherit;padding:5px 8px;border-radius:7px;border:1px solid var(--ib);background:rgba(255,255,255,.04);color:var(--dim)}
.al-clr{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;border:0;background:rgba(255,255,255,.1);transition:.2s}.al-clr:hover{background:var(--acc)}
.al-fl{display:flex;flex-direction:column;gap:7px}
.al-fl span{font-size:12px;font-weight:700;color:var(--mut)}
.al-fl select{appearance:none;-webkit-appearance:none;height:46px;padding:0 38px 0 14px;min-width:140px;border-radius:13px;background:var(--in) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238b96b5' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") no-repeat right 14px center;border:1px solid var(--ib);font-size:14px;font-weight:700;transition:.2s;cursor:pointer}
.al-row .al-fl select{height:100%;min-height:48px}
.al-fl select:hover,.al-fl select:focus{border-color:var(--acc);outline:0}.al-fl option{background:#0b1126}
.al-vt{position:relative;display:flex;padding:4px;border-radius:13px;background:var(--in);border:1px solid var(--ib)}
.al-vt::before{content:"";position:absolute;top:4px;bottom:4px;left:4px;width:calc(50% - 4px);border-radius:9px;background:linear-gradient(135deg,rgba(42,160,255,.3),rgba(11,114,242,.2));border:1px solid rgba(29,140,255,.55);box-shadow:0 0 20px -6px var(--acc);transition:transform .45s cubic-bezier(.3,1.3,.5,1)}
.al-vt[data-v=list]::before{transform:translateX(100%)}
.al-vt button{position:relative;z-index:1;display:grid;place-items:center;width:44px;border:0;background:none;color:var(--mut);transition:color .25s}.al-vt button.on{color:#fff}
.al-tabs{position:relative;display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
.al-ind{position:absolute;left:0;top:0;border-radius:99px;pointer-events:none;border:1px solid var(--ic);background:color-mix(in srgb,var(--ic) 22%,#0a1126);box-shadow:0 0 26px -6px var(--ic);
  transition:transform .5s cubic-bezier(.3,1.2,.4,1),width .5s cubic-bezier(.3,1.2,.4,1),height .3s,border-color .3s,background .3s,box-shadow .3s}
.al-tab{position:relative;z-index:1;display:flex;align-items:center;gap:8px;padding:9px 16px;border-radius:99px;background:transparent;border:1px solid var(--ib);font-size:13px;font-weight:700;color:var(--mut);transition:color .25s,border-color .25s}
.al-tab i{width:7px;height:7px;border-radius:50%;background:var(--s);box-shadow:0 0 8px var(--s)}
.al-tab em{font-style:normal;font-size:11px;padding:1px 8px;border-radius:99px;background:rgba(255,255,255,.07)}
.al-tab:hover{color:#fff}.al-tab.on{color:#fff;border-color:transparent}
.al-sep{height:1px;background:var(--line);margin:18px 0}
.al-filters{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end}
.al-reset{display:inline-flex;align-items:center;gap:8px;height:46px;padding:0 16px;border-radius:13px;border:1px solid rgba(251,113,133,.35);background:rgba(251,113,133,.08);color:#fda4af;font-size:13px;font-weight:700;transition:.25s;animation:alUp .4s cubic-bezier(.2,.8,.2,1) backwards}
.al-reset:hover{background:rgba(251,113,133,.18);box-shadow:0 0 24px -8px #fb7185}.al-reset:hover svg{transform:rotate(-180deg)}.al-reset svg{transition:transform .5s}

/* сетка */
.al-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(176px,1fr));gap:26px 18px}
.al-card{--s:#22d3ee;position:relative;cursor:pointer;outline-offset:6px;transform:perspective(900px) rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg)) translateY(var(--ty,0px));transition:transform .25s ease-out;animation:alUp .7s cubic-bezier(.2,.8,.2,1) backwards;animation-delay:calc(var(--i)*45ms)}
.al-card:hover{--ty:-8px}
.al-poster{position:relative;aspect-ratio:2/3;border-radius:16px;overflow:hidden;background:hsl(var(--h) 45% 26%);border:1px solid rgba(255,255,255,.07);transition:box-shadow .3s}
.al-card:hover .al-poster{box-shadow:0 28px 46px -20px var(--s)}
.al-card.sel .al-poster{box-shadow:0 0 0 2px var(--acc),0 0 34px -4px var(--acc)}.al-card.sel{--ty:-4px}
.al-poster img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .8s cubic-bezier(.2,.8,.2,1)}
.al-card:hover .al-poster img{transform:scale(1.09)}
.al-ph{width:100%;height:100%;display:grid;place-items:center;font-size:46px;font-weight:800;color:rgba(255,255,255,.5);background:linear-gradient(160deg,hsl(var(--h) 60% 40%),hsl(calc(var(--h) + 40) 55% 15%))}
.al-fade{position:absolute;inset:50% 0 0;background:linear-gradient(transparent,rgba(4,6,14,.92));pointer-events:none}
.al-poster::before{content:"";position:absolute;inset:0;z-index:4;pointer-events:none;opacity:0;transition:opacity .3s;background:radial-gradient(230px circle at var(--mx,50%) var(--my,50%),rgba(120,190,255,.26),transparent 65%)}
.al-poster::after{content:"";position:absolute;inset:0;z-index:5;border-radius:inherit;padding:1.5px;pointer-events:none;opacity:0;transition:opacity .3s;
  background:conic-gradient(from var(--ang),transparent 0 55%,var(--s,#22d3ee) 80%,#fff 90%,transparent);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:alSpin 2.8s linear infinite}
@keyframes alSpin{to{--ang:360deg}}
.al-card:hover .al-poster::before,.al-card:hover .al-poster::after{opacity:1}
.al-b{position:absolute;z-index:3;display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:9px;background:rgba(6,8,18,.74);backdrop-filter:blur(8px);font-size:11px;font-weight:800;color:#e8edff}
.al-b i{width:6px;height:6px;border-radius:50%;background:currentColor;box-shadow:0 0 8px currentColor}
.al-b.tl{left:9px;top:9px}.al-b u{text-decoration:none;color:#24affb}.al-b.tr{right:9px;top:9px}.al-b.bl{left:9px;bottom:13px}
.al-ep{transition:opacity .25s}.al-card:hover .al-ep,.al-card:focus-within .al-ep{opacity:0}
.al-pb{position:absolute;z-index:3;left:0;right:0;bottom:0;height:4px;background:rgba(255,255,255,.1)}
.al-pb i{display:block;height:100%;background:var(--s);box-shadow:0 0 12px var(--s);transition:width .6s cubic-bezier(.2,.8,.2,1)}
.al-qa{position:absolute;z-index:6;left:8px;right:8px;bottom:12px;display:flex;gap:6px;opacity:0;transform:translateY(10px);transition:.3s cubic-bezier(.2,.8,.2,1)}
.al-card:hover .al-qa,.al-card:focus-within .al-qa{opacity:1;transform:none}
.al-qa button,.al-lq button{display:grid;place-items:center;height:34px;min-width:34px;padding:0 10px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:rgba(8,12,26,.82);backdrop-filter:blur(10px);font-size:12px;font-weight:800;transition:.2s}
.al-qa button.pl,.al-lq button.pl{flex:1;background:linear-gradient(135deg,#2aa0ff,#0b72f2);border-color:transparent;box-shadow:0 0 18px -4px var(--acc)}
.al-qa button:hover,.al-lq button:hover{transform:translateY(-2px);border-color:var(--acc)}
.al-ck{position:absolute;z-index:6;right:9px;top:9px;display:grid;place-items:center;width:26px;height:26px;border-radius:50%;border:2px solid rgba(255,255,255,.4);background:rgba(6,8,18,.6);color:transparent;transition:.25s}
.al-ck.on{background:var(--acc);border-color:var(--acc);color:#fff;box-shadow:0 0 20px -2px var(--acc);transform:scale(1.1)}
.al-card h3{margin-top:13px;font-size:15px;font-weight:800;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.6em}
.al-m{margin-top:5px;color:var(--mut);font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.al-nt{display:inline-flex;color:var(--cy);margin-left:auto}
.al-empty{display:flex;flex-direction:column;align-items:center;text-align:center;padding:68px 20px 74px;border-radius:28px;border:1px solid var(--line);background:linear-gradient(180deg,rgba(11,16,36,.9),rgba(6,9,20,.9))}
.al-empty h3{font-size:20px;font-weight:800;margin-bottom:8px}.al-empty p{color:var(--mut);font-size:14px;font-weight:600;margin-bottom:24px}

/* вид «список» */
.al-lst{display:grid;gap:10px}
.al-li{--s:#22d3ee;position:relative;display:grid;grid-template-columns:auto 50px minmax(0,1fr) 150px 140px 52px auto;gap:18px;align-items:center;padding:10px 16px 10px 10px;border-radius:18px;cursor:pointer;border:1px solid var(--line);background:linear-gradient(180deg,rgba(13,19,42,.85),rgba(7,10,22,.9));transition:transform .3s cubic-bezier(.2,.8,.2,1),border-color .3s,box-shadow .3s;animation:alUp .6s cubic-bezier(.2,.8,.2,1) backwards;animation-delay:calc(var(--i)*40ms)}
.al-li:hover{transform:translateX(5px);border-color:var(--line2);box-shadow:0 20px 40px -28px var(--s)}
.al-li.sel{border-color:var(--acc);box-shadow:0 0 0 1px var(--acc),0 0 30px -10px var(--acc)}
.al-li:not(:has(.al-ck)){grid-template-columns:50px minmax(0,1fr) 150px 140px 52px auto}
.al-lp .al-poster{border-radius:10px}.al-lp .al-ph{font-size:20px}
.al-lt h3{font-size:15px;font-weight:800;line-height:1.3;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}
.al-lpg{display:grid;gap:7px;font-size:12px;font-weight:700;color:var(--mut)}
.al-pb.s{position:relative;display:block;height:5px;border-radius:99px;overflow:hidden}
.al-lr{font-size:14px;font-weight:800;text-align:center}.al-lr u{text-decoration:none;color:#24affb}
.al-lq{display:flex;gap:6px}.al-lq button{height:32px}
.al-ck.inl{position:static}

/* подборки */
.al-cols{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;margin-top:18px;align-items:stretch}
.al-colw{position:relative}
.al-col{width:100%;height:100%;display:flex;gap:18px;align-items:center;padding:14px 16px;border-radius:22px;text-align:left;background:linear-gradient(180deg,rgba(11,16,36,.92),rgba(7,10,22,.92));border:1px solid var(--line);transition:.35s cubic-bezier(.2,.8,.2,1)}
.al-col:hover,.al-col.on{border-color:var(--acc);box-shadow:0 24px 44px -26px var(--acc);transform:translateY(-4px)}
.al-col.on{background:linear-gradient(180deg,rgba(18,44,100,.55),rgba(8,14,34,.9))}
.al-stack{position:relative;flex:none;width:92px;height:92px}
.al-sk{position:absolute;left:calc(var(--k)*15px);top:calc(var(--k)*3px);width:58px;height:84px;border-radius:12px;overflow:hidden;z-index:calc(3 - var(--k));display:grid;place-items:center;font-size:24px;font-weight:800;color:rgba(255,255,255,.55);
  background:linear-gradient(160deg,hsl(var(--h) 60% 40%),hsl(calc(var(--h) + 40) 55% 15%));border:1px solid rgba(255,255,255,.12);box-shadow:6px 8px 18px -6px #000;transform:rotate(calc((var(--k) - 1)*5deg));transition:transform .45s cubic-bezier(.2,1.2,.3,1)}
.al-sk img{width:100%;height:100%;object-fit:cover}
.al-col:hover .al-sk{transform:rotate(calc((var(--k) - 1)*9deg)) translateY(-4px) translateX(calc(var(--k)*3px))}
.al-ct{min-width:0}.al-col h4{font-size:15.5px;font-weight:800;word-break:break-word;margin-bottom:8px}.al-col small{font-size:12.5px;color:var(--mut);font-weight:700}
.al-cdel{position:absolute;top:10px;right:10px;z-index:2;display:grid;place-items:center;width:26px;height:26px;border-radius:50%;border:0;background:rgba(255,255,255,.08);opacity:0;transition:.2s}
.al-colw:hover .al-cdel{opacity:1}.al-cdel:hover{background:#fb7185;transform:rotate(90deg)}
.al-new{display:flex;gap:8px;align-items:center;padding:12px 14px;border-radius:22px;border:1.5px dashed #26356e;transition:.25s}
.al-new:focus-within{border-color:var(--acc);box-shadow:0 0 30px -10px var(--acc)}
.al-new input{flex:1;min-width:0;background:none;border:0;font-size:14px;font-weight:600;padding:10px 4px}.al-new input:focus{outline:0}
.al-new button{display:grid;place-items:center;width:42px;height:42px;border-radius:13px;border:0;background:linear-gradient(135deg,#2aa0ff,#0b72f2);color:#fff;box-shadow:0 0 20px -4px var(--acc);transition:.35s}.al-new button:hover{transform:rotate(90deg) scale(1.08)}

/* история */
.al-hhead{display:flex;justify-content:space-between;align-items:center;margin:12px 0 16px;color:var(--mut);font-size:13px;font-weight:700}
.al-hhead button{background:none;border:0;color:#fb7185;font-size:13px;font-weight:700;transition:.2s}.al-hhead button:hover{color:#ff9aab}
.al-hist{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:16px}
.al-h{display:block;overflow:hidden;border-radius:18px;text-decoration:none;color:inherit;background:linear-gradient(180deg,rgba(13,19,42,.95),rgba(7,10,22,.95));border:1px solid var(--line);transition:.3s;animation:alUp .6s cubic-bezier(.2,.8,.2,1) backwards;animation-delay:calc(var(--i)*55ms)}
.al-h:hover{transform:translateY(-5px);box-shadow:0 24px 44px -26px var(--acc)}
.al-hi{position:relative;aspect-ratio:16/9;overflow:hidden;display:grid;place-items:center;font-size:38px;font-weight:800;color:rgba(255,255,255,.5);background:linear-gradient(135deg,hsl(var(--h) 60% 36%),hsl(calc(var(--h) + 50) 55% 14%))}
.al-hi img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .7s}.al-h:hover .al-hi img{transform:scale(1.07)}
.al-hp{position:absolute;inset:0;display:grid;place-items:center;background:rgba(4,6,14,.45);color:#fff;opacity:0;transition:.3s}.al-hp svg{padding:12px;box-sizing:content-box;border-radius:50%;background:var(--acc);box-shadow:0 0 30px var(--acc);transform:scale(.7);transition:.35s cubic-bezier(.2,1.4,.3,1)}
.al-h:hover .al-hp{opacity:1}.al-h:hover .al-hp svg{transform:none}
.al-hb{padding:12px 14px 15px}.al-hb h3{font-size:14.5px;font-weight:800;line-height:1.3;margin-top:10px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.al-hm{display:flex;justify-content:space-between;align-items:center}
.al-hm span{padding:4px 10px;border-radius:8px;background:#04060f;border:1px solid var(--ib);font-size:11px;font-weight:800}
.al-hm em{font-style:normal;padding:4px 10px;border-radius:8px;background:#2a62d9;font-size:11px;font-weight:800;color:#e6efff;box-shadow:0 0 14px -4px #2a62d9}
.al-morew{display:flex;justify-content:center;gap:10px;margin-top:22px}

/* массовые действия */
.al-bar{position:fixed;left:50%;bottom:26px;z-index:9985;display:flex;align-items:center;gap:8px;max-width:calc(100% - 24px);overflow-x:auto;padding:10px 12px;border-radius:20px;background:rgba(10,15,34,.88);backdrop-filter:blur(18px);border:1px solid var(--line2);box-shadow:0 30px 70px -20px #000,0 0 60px -30px var(--acc);
  transform:translate(-50%,140%);opacity:0;pointer-events:none;transition:transform .5s cubic-bezier(.2,1,.3,1),opacity .3s}
.al-bar.on{transform:translate(-50%,0);opacity:1;pointer-events:auto}
.al-bn{padding:0 10px 0 6px;font-size:13px;font-weight:700;color:var(--mut);white-space:nowrap}.al-bn b{color:#fff;font-size:16px}
.al-bdiv{flex:none;width:1px;height:24px;background:var(--line2)}
.al-bs,.al-bsm{flex:none;display:inline-flex;align-items:center;gap:8px;height:38px;padding:0 13px;border-radius:12px;border:1px solid var(--ib);background:rgba(255,255,255,.04);font-size:13px;font-weight:700;white-space:nowrap;transition:.2s}
.al-bs i{width:8px;height:8px;border-radius:50%;background:var(--s);box-shadow:0 0 8px var(--s)}
.al-bs:hover:not(:disabled),.al-bsm:hover:not(:disabled){border-color:var(--s,var(--acc));background:color-mix(in srgb,var(--s,#1d8cff) 18%,#0a1126);transform:translateY(-2px)}
.al-bs:disabled,.al-bsm:disabled{opacity:.4}
.al-bsm.danger{color:#fb7185}.al-bsm.danger:hover:not(:disabled){border-color:#fb7185;background:rgba(251,113,133,.15)}

/* карточка тайтла */
.al-veil{position:fixed;inset:0;z-index:9990;background:rgba(3,5,12,.62);backdrop-filter:blur(7px);opacity:0;pointer-events:none;transition:opacity .35s}.al-veil.open{opacity:1;pointer-events:auto}
.al-drawer{--h:210;position:fixed;top:0;right:0;bottom:0;z-index:9991;width:min(480px,100%);overflow:auto;padding:24px 28px 28px;background:linear-gradient(180deg,#0d1531,#060a1a);border-left:1px solid #1b2753;box-shadow:-40px 0 90px -30px #000;transform:translateX(104%);transition:transform .55s cubic-bezier(.2,.9,.25,1)}
.al-drawer.open{transform:none}
.al-drawer::before{content:"";position:absolute;left:0;right:0;top:0;height:300px;pointer-events:none;background:radial-gradient(70% 100% at 50% 0,hsl(var(--h) 75% 48% / .42),transparent 75%)}
.al-drawer>*{position:relative}
.al-drawer.open .al-sec,.al-drawer.open .al-dh{animation:alUp .55s cubic-bezier(.2,.8,.2,1) backwards}
.al-drawer.open .al-sec:nth-of-type(1){animation-delay:.1s}.al-drawer.open .al-sec:nth-of-type(2){animation-delay:.16s}.al-drawer.open .al-sec:nth-of-type(3){animation-delay:.22s}.al-drawer.open .al-sec:nth-of-type(4){animation-delay:.28s}.al-drawer.open .al-sec:nth-of-type(5){animation-delay:.34s}
.al-dtop{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}
.al-pos{font-size:12px;font-weight:800;letter-spacing:.1em;color:var(--mut)}
.al-dnav{display:flex;gap:8px}
.al-dnav button,.al-x{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;border:1px solid var(--line);background:rgba(255,255,255,.06);transition:.3s}
.al-dnav button:hover:not(:disabled),.al-x:hover{background:rgba(255,255,255,.16);border-color:var(--line2)}.al-dnav button:disabled{opacity:.35}
.al-dnav button:last-child:hover,.al-x:hover{transform:rotate(90deg)}
.al-x{position:absolute;top:16px;right:16px;z-index:2}
.al-dh{display:flex;gap:16px;align-items:center}
.al-dp{width:88px;flex:none;border-radius:14px;overflow:hidden;box-shadow:0 18px 34px -10px #000}.al-dp .al-poster{border-radius:14px}.al-dp .al-ph{font-size:30px}
.al-dh h2{font-size:19px;font-weight:800;line-height:1.25;margin-bottom:6px}
.al-mut{color:var(--mut);font-size:13px;font-weight:600;line-height:1.6}
.al-gl{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.al-gl span{padding:3px 10px;border-radius:99px;background:rgba(255,255,255,.07);font-size:11px;font-weight:700;color:#c9d4f5}
.al-sec{margin-top:26px}
.al-sec h4{display:flex;justify-content:space-between;margin-bottom:11px;font-size:13px;font-weight:700;color:var(--mut)}.al-sec h4 b{color:#fff}
.al-seg{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.al-seg button{display:flex;align-items:center;gap:10px;padding:13px 15px;border-radius:14px;background:#0a1124;border:1px solid var(--ib);font-size:14px;font-weight:700;color:var(--mut);transition:.25s}
.al-seg i{width:9px;height:9px;border-radius:50%;background:var(--s);box-shadow:0 0 10px var(--s)}
.al-seg button:hover:not(:disabled){color:#fff;transform:translateY(-2px)}
.al-seg button.on{color:#fff;border-color:var(--s);background:color-mix(in srgb,var(--s) 20%,#0a1124);box-shadow:0 0 26px -8px var(--s)}
.al-step{display:flex;gap:12px;align-items:center}
.al-step button{display:grid;place-items:center;flex:none;width:40px;height:40px;border-radius:12px;border:1px solid var(--ib);background:#0a1124;transition:.2s}
.al-step button:hover:not(:disabled){background:var(--acc);box-shadow:0 0 20px -4px var(--acc);transform:translateY(-2px)}
.al-step input{-webkit-appearance:none;appearance:none;flex:1;height:6px;border-radius:99px;outline:0;cursor:pointer;background:linear-gradient(90deg,var(--cy),var(--acc)) 0 0/var(--p,0%) 100% no-repeat,rgba(255,255,255,.1)}
.al-step input::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:#fff;border:0;box-shadow:0 0 0 4px rgba(29,140,255,.35),0 0 18px var(--acc);transition:transform .2s}
.al-step input::-moz-range-thumb{width:20px;height:20px;border-radius:50%;background:#fff;border:0;box-shadow:0 0 0 4px rgba(29,140,255,.35),0 0 18px var(--acc)}
.al-step input:hover::-webkit-slider-thumb{transform:scale(1.18)}
.al-rate{display:flex;flex-direction:row-reverse;gap:5px}
.al-rate button{flex:1;min-width:0;aspect-ratio:1;border-radius:10px;border:1px solid var(--ib);background:#0a1124;font-size:13px;font-weight:700;color:var(--mut);transition:.15s}
.al-rate button:hover:not(:disabled),.al-rate button:hover:not(:disabled)~button,.al-rate button.on{background:linear-gradient(180deg,#4db8fc,#0bb5f5);border-color:transparent;color:#04141a}
.al-rate button:hover:not(:disabled){transform:translateY(-4px) scale(1.08);box-shadow:0 0 16px -4px #24affb}
.al-drawer textarea{width:100%;min-height:136px;resize:vertical;padding:15px;border-radius:15px;background:var(--in);border:1px solid var(--ib);font-size:14px;line-height:1.6;transition:.25s}
.al-drawer textarea:focus{outline:0;border-color:var(--acc);box-shadow:0 0 28px -8px var(--acc)}
.al-chips{display:flex;flex-wrap:wrap;gap:8px}
.al-chips button{padding:8px 15px;border-radius:99px;background:#0a1124;border:1px solid var(--ib);font-size:13px;font-weight:700;color:var(--mut);transition:.2s}
.al-chips button.on{color:#fff;border-color:var(--acc);background:rgba(29,140,255,.22);box-shadow:0 0 20px -6px var(--acc)}
.al-dfoot{display:flex;justify-content:space-between;gap:10px;margin-top:32px;padding-top:22px;border-top:1px solid var(--line)}
.al-danger{display:inline-flex;align-items:center;gap:8px;background:none;border:1px solid rgba(251,113,133,.35);color:#fb7185;border-radius:12px;padding:12px 16px;font-weight:700;font-size:14px;transition:.2s}.al-danger:hover{background:rgba(251,113,133,.14)}
.al-drawer textarea:read-only{cursor:default}

/* окна, переключатель, тост */
.al-modal{position:fixed;inset:0;z-index:9995;display:grid;place-items:center;padding:16px;background:rgba(3,5,12,.66);backdrop-filter:blur(9px);opacity:0;visibility:hidden;transition:.35s}.al-modal.open{opacity:1;visibility:visible}
.al-mp{position:relative;width:min(510px,100%);padding:30px;border-radius:26px;background:linear-gradient(170deg,#101938,#070b1b);border:1px solid #1d2a5c;box-shadow:0 60px 110px -20px #000,0 0 90px -34px var(--acc);transform:translateY(26px) scale(.94);transition:transform .45s cubic-bezier(.2,1.1,.3,1)}
.al-modal.open .al-mp{transform:none}
.al-mp h3{font-size:23px;font-weight:800;margin-bottom:8px;padding-right:40px}.al-mp .al-mut{margin-bottom:20px}
.al-link{display:flex;gap:8px;flex-wrap:wrap}
.al-link input{flex:1;min-width:0;padding:13px 15px;border-radius:13px;background:var(--in);border:1px solid var(--ib);font-size:13px;font-weight:600}
.al-drop{display:flex;flex-direction:column;align-items:center;gap:6px;margin-top:14px;padding:26px 16px;border-radius:18px;border:1.5px dashed #2a3a78;text-align:center;color:var(--mut);cursor:pointer;transition:.25s}
.al-drop b{color:#fff;font-size:14px;margin-top:6px}.al-drop span{font-size:12.5px;font-weight:600}
.al-drop:hover,.al-drop.on{border-color:var(--acc);background:rgba(29,140,255,.08);box-shadow:0 0 34px -12px var(--acc);color:var(--cy)}
.al-sw{display:flex;align-items:center;gap:12px;margin-top:20px;font-size:14px;font-weight:700;cursor:pointer}.al-sw input{position:absolute;opacity:0}
.al-track{width:46px;height:26px;border-radius:99px;background:rgba(255,255,255,.12);padding:3px;transition:.3s;flex:none}
.al-track i{display:block;width:20px;height:20px;border-radius:50%;background:#fff;transition:.3s cubic-bezier(.3,1.5,.5,1)}
.al-sw input:checked+.al-track{background:linear-gradient(135deg,#2aa0ff,#0b72f2);box-shadow:0 0 22px -2px var(--acc)}.al-sw input:checked+.al-track i{transform:translateX(20px)}
.al-sw input:focus-visible+.al-track{outline:2px solid var(--cy);outline-offset:2px}
.al-guest{display:inline-block;margin-top:20px;color:var(--cy);font-size:13px;font-weight:700;text-decoration:none}
.al-toast{position:fixed;left:50%;bottom:30px;z-index:10000;display:flex;align-items:center;gap:16px;transform:translate(-50%,30px);opacity:0;padding:13px 14px 13px 24px;border-radius:99px;background:#0e1632;border:1px solid var(--acc);font-size:14px;font-weight:700;box-shadow:0 16px 40px -10px var(--acc);transition:.4s cubic-bezier(.2,1,.3,1);pointer-events:none}
.al-toast.show{opacity:1;transform:translate(-50%,0);pointer-events:auto}
.al-toast button{padding:7px 14px;border-radius:99px;border:0;background:var(--acc);font-size:13px;font-weight:800;color:#fff;transition:.2s}.al-toast button:hover{filter:brightness(1.15)}
.al-toast:not(:has(button)){padding-right:24px}

@media (hover:none){.al-qa{opacity:1;transform:none}.al-ep{display:none}}
@media (max-width:1000px){.al-bento{grid-template-columns:1fr 1fr}.al-bento>:first-child{grid-column:1/-1}
  .al-li,.al-li:not(:has(.al-ck)){grid-template-columns:auto 46px minmax(0,1fr) auto}.al-li:not(:has(.al-ck)){grid-template-columns:46px minmax(0,1fr) auto}.al-lpg,.al-chip,.al-lq{display:none}}
@media (max-width:720px){.al{padding:30px 0 120px}.al-bento{grid-template-columns:1fr}.al-dn{flex-direction:column;align-items:stretch}.al-dw{align-self:center}
  .al-row{flex-wrap:wrap}.al-search{flex:1 1 100%}.al-row .al-fl{flex:1}.al-row .al-fl select{min-width:0;width:100%}
  .al-grid{grid-template-columns:repeat(auto-fill,minmax(146px,1fr));gap:22px 12px}.al-ico{width:48px;height:48px}.al-fl select{min-width:0;width:100%}.al-fl{flex:1 1 40%}
  .al-cgrid{grid-template-columns:1fr}.al-sh h2{font-size:20px}.al-bs span{display:none}.al-bs{padding:0 12px}.al-drawer{padding:20px}}
@media (prefers-reduced-motion:reduce){.al *,.al *::before,.al *::after{animation:none!important;transition:none!important}.rv{opacity:1;transform:none}}
`;
