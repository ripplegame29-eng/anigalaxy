"use client";

/**
 * «Реферальная программа» — перенос прототипа
 * `_design/Твоя_галактика___рефералка_AniGalaxy.html`.
 *
 * Что перенесено без изменений: разметка `main.wrap`, все стили
 * (сгенерированы в `referral.css` — селекторы спрятаны под `.ref-page`),
 * логика рендера карты, хранилища, экипажа и рейтинга, копирование,
 * шеринг, наклон пропуска за курсором, анимации.
 *
 * Шапка прототипа не переносится: у сайта своя.
 *
 * Данные. В прототипе заглушки — код `R8PL-9XQ2`, ссылка, ник
 * `ripplegame28`, `friends = 0` и списки `NAMES`/`TOP`. Отсюда реальные:
 * код приходит из `refCodeFor`, друзья — из `useMyReferrals`, ник — из
 * аккаунта. Остальное помечено TODO: сервера у сайта нет, а без него
 * месячный рейтинг и «демо: +1 друг» в продакшне означали бы правку
 * чужих данных. Демо-кнопка включается флагом `DEMO` ниже.
 */

import { useEffect, useRef, useState } from "react";
import { absoluteRefLink, refCodeFor, refLink, useMyReferrals } from "@/lib/referrals";
import { useAccount } from "@/lib/use-account";
import "./referral.css";

/* ----------------------------- Данные прототипа ---------------------------- */

/**
 * Рубежи: сколько друзей нужно и что за награда.
 *
 * Подарки за рубежи — те же предметы, что и в каталоге косметики, и
 * условие у них одно: `referral: n` в `lib/cosmetics.ts` (рамки) либо
 * `source: "referral", friends: n` в конфиге прогрессии (теги). Поэтому
 * рубеж не только показывает название, но и действительно открывает
 * предмет: счётчик приглашений проверяет и каталог, и выдачу в движке.
 */
const R = [
  { n: 1, t: "Первая искра", r: "common", xp: 500, it: "Тег «Сенсей»", d: 0 },
  { n: 3, t: "Тёплая орбита", r: "common", xp: 1500, it: "Рамка «Геасс»", d: 0 },
  { n: 5, t: "Бро", r: "rare", xp: 2500, it: "Эффект «Неон»", d: 0 },
  { n: 10, t: "Гильдмастер", r: "rare", xp: 5000, it: "Рамка «Маска гуля»", d: 7 },
  { n: 20, t: "Цифровая сакура", r: "epic", xp: 10000, it: "Эффект «Глитч»", d: 14 },
  { n: 30, t: "Орден созвездия", r: "epic", xp: 15000, it: "Рамка «Крылья свободы»", d: 30 },
  { n: 50, t: "Легенда AniGalaxy", r: "leg", xp: 25000, it: "Эффект «Голограмма»", d: 90 },
  { n: 100, t: "Архитектор галактики", r: "leg", xp: 50000, it: "Тег «Герой иного мира»", d: 365 },
] as const;

/**
 * Рейтинг созвездий и месяц — из прототипа.
 *
 * TODO(рефералка): данные чужого рейтинга. Сервера у сайта нет, а список
 * подписчиков месяца хранить негде. Как только появится бэкенд — брать
 * оттуда, здесь оставить только пустое состояние.
 */
const TOP: [string, number][] = [];
const MONTH = "ОКТЯБРЬ";

/** Демо-кнопка «+1 друг» — только в разработке, в продакшне её нет */
const DEMO = process.env.NODE_ENV !== "production";

const RAR: Record<string, [string, string]> = {
  common: ["ОБЫЧНЫЙ", "var(--c-common)"],
  rare: ["РЕДКИЙ", "var(--c-rare)"],
  epic: ["ЭПИЧЕСКИЙ", "var(--c-epic)"],
  leg: ["ЛЕГЕНДАРНЫЙ", "var(--c-leg)"],
};

/** Иконки рубежей — штрих 24×24, из прототипа */
const EM = [
  '<path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z"/>',
  '<circle cx="12" cy="12" r="3.2"/><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(-30 12 12)"/>',
  '<circle cx="8.5" cy="9" r="3.5"/><circle cx="16" cy="10" r="3"/><path d="M2.5 20c0-3.3 2.7-5.2 6-5.2s6 1.9 6 5.2M14.5 15c3.5-.3 7 1.2 7 5"/>',
  '<path d="M3 8l4.5 4L12 4l4.5 8L21 8l-2 11H5z"/>',
  '<circle cx="12" cy="12" r="2"/><path d="M12 10C9 5 11 2.5 12 2.5S15 5 12 10zM13.9 11.4c5-.9 7.4.9 7.1 1.9S17.7 16 13.9 12.6zM13.2 13.9c2.6 4.4 1.8 7-.3 7.2S9 19 10.9 14zM10.8 13.9c-3.7 3.3-6.4 2.6-6.7.6s2.6-3.3 6-2.6zM10.1 11.4C6.7 8.6 6.9 6 8.5 5.6S12 8 10.1 11.4z"/>',
  '<circle cx="5" cy="7" r="1.6"/><circle cx="12" cy="4" r="1.6"/><circle cx="19" cy="9" r="1.6"/><circle cx="9" cy="14" r="1.6"/><circle cx="17" cy="19" r="1.6"/><path d="M5 7l7-3 7 5-10 5 8 5"/>',
  '<path d="M8 4h8v6a4 4 0 0 1-8 0zM8 6H4v2a3 3 0 0 0 4 3M16 6h4v2a3 3 0 0 1-4 3M12 14v4M8 21h8"/>',
  '<path d="M12 12c0-2 3-2 3 0s-4 4-7 2-2-7 3-8 10 3 9 9-8 9-13 6"/><circle cx="12" cy="12" r="1.4"/>',
];

/* --------------------------------- Утилиты -------------------------------- */

const fmt = (n: number) => n.toLocaleString("ru-RU");
const esc = (s: string) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
const pl = (n: number, f: [string, string, string]) => {
  const a = n % 10;
  const b = n % 100;
  return a === 1 && b !== 11 ? f[0] : a >= 2 && a <= 4 && (b < 10 || b >= 20) ? f[1] : f[2];
};
const emb = (i: number, a = "") =>
  `<svg ${a} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${EM[i]}</svg>`;
const dayTxt = (d: number) => `+${d} ${pl(d, ["день", "дня", "дней"])} Premium`;
const hue = (i: number) => (i * 47 + 200) % 360;
const av = (n: string, i: number, s = 34) =>
  `<span class="ava" style="--h:${hue(i)};--s:${s}px">${esc(n.charAt(0).toUpperCase())}</span>`;
const CROWN = `<svg class="crown" viewBox="0 0 24 24" fill="currentColor"><path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/></svg>`;

/** Звёзды фона: детерминированно, иначе сервер и браузер разойдутся */
function makeRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STARS = (() => {
  const rnd = makeRandom(20260912);
  return Array.from({ length: 120 }, () => ({
    left: `${(rnd() * 100).toFixed(1)}vw`,
    top: `${(rnd() * 100).toFixed(1)}vh`,
    shadow: `${(rnd() * 100).toFixed(1)}vw ${(rnd() * 100).toFixed(1)}vh 0 ${rnd() < 0.15 ? 1 : 0}px rgba(200,225,255,${(rnd() * 0.7 + 0.2).toFixed(2)})`,
  }));
})();

const SHOOTS = Array.from({ length: 6 }, (_, i) => ({
  left: `${8 + i * 15}%`,
  top: `${12 + ((i * 37) % 60)}%`,
  delay: `${(i * 2.7).toFixed(1)}s`,
}));

/* --------------------------------- Компонент ------------------------------ */

export function ReferralPage() {
  const account = useAccount();
  const invited = useMyReferrals();

  const code = refCodeFor(account);
  /** Число друзей — настоящее, из хранилища; demoAdd добавляет демо-кнопка */
  const invitedCount = invited.length;
  const [demoAdd, setDemoAdd] = useState(0);
  const friends = invitedCount + demoAdd;
  const [sel, setSel] = useState<number | null>(null);
  const [lastAdd, setLastAdd] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const svRef = useRef<SVGSVGElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const miniRef = useRef<HTMLDivElement>(null);
  const vaultRef = useRef<HTMLDivElement>(null);
  const teamRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const youRef = useRef<HTMLDivElement>(null);
  const tcRef = useRef<HTMLSpanElement>(null);
  const gotRef = useRef<HTMLElement>(null);
  const sFRef = useRef<HTMLElement>(null);
  const sXRef = useRef<HTMLElement>(null);
  const sDRef = useRef<HTMLElement>(null);
  const ticketRef = useRef<HTMLDivElement>(null);
  const toastRef = useRef<HTMLDivElement>(null);
  const copyBtnRef = useRef<HTMLButtonElement>(null);
  const rafRef = useRef<number | null>(null);
  const curRef = useRef<Record<string, number>>({});
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Настоящие ники приглашённых; порядок — от свежих к старым */
  const names = invited.map((item) => item.nick);

  /**
   * Меньше движения спрашиваем в момент использования, а не в состоянии:
   * значение нужно только обработчикам и рендерам, и держать его в state
   * значило бы читать matchMedia при рендере — расхождение с сервером.
   */
  const reduced = () =>
    typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------ Счётчики ------------------------------- */

  const countTo = (el: HTMLElement | null, key: string, to: number) => {
    if (!el) return;
    const from = curRef.current[key] ?? 0;
    curRef.current[key] = to;
    if (reduced() || from === to) {
      el.textContent = fmt(to);
      return;
    }
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 700);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(Math.round(from + (to - from) * e));
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);
  };

  /* -------------------------------- Рендеры ------------------------------- */

  const updateSel = () => {
    const current = sel ?? (() => {
      const i = R.findIndex((r) => r.n > friends);
      return i < 0 ? R.length - 1 : i;
    })();
    const r = R[current];
    if (!r) return;
    const left = Math.max(0, r.n - friends);
    const mini = miniRef.current;
    if (mini) {
      mini.style.setProperty("--rc", RAR[r.r][1]);
      mini.innerHTML =
        `<span class="e">${emb(current)}</span>` +
        `<div style="min-width:0"><b>×${r.n} ${esc(r.t)}</b>` +
        `<small>+${fmt(r.xp)} XP · ${esc(r.it)}${r.d ? " · " + dayTxt(r.d) : ""}</small></div>` +
        `<div class="r ${left ? "" : "d"}">${left ? `ещё ${left} ${pl(left, ["друг", "друга", "друзей"])}` : "получено ✓"}</div>`;
    }
    rootRef.current?.querySelectorAll<SVGGElement>(".ring,.pl,.vc").forEach((el) => {
      el.classList.toggle("sel", Number(el.dataset.i) === current);
    });
  };

  const renderMap = () => {
    const sv = svRef.current;
    if (!sv) return;
    let g = `<defs><radialGradient id="ag-ref-core" cx="50%" cy="40%"><stop offset="0" stop-color="#3a8bff"/><stop offset="1" stop-color="#0b1a42"/></radialGradient></defs>`;
    R.forEach((r, i) => {
      const rad = 80 + i * 29;
      const C = 2 * Math.PI * rad;
      const prev = i ? R[i - 1].n : 0;
      const fr = Math.max(0, Math.min(1, (friends - prev) / (r.n - prev)));
      g += `<g class="ring${friends >= r.n ? " done" : ""}" data-i="${i}" style="--rc:${RAR[r.r][1]}"><circle class="base" cx="310" cy="310" r="${rad}"/><circle class="prog" cx="310" cy="310" r="${rad}" stroke-dasharray="${(C * fr).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 310 310)"/><circle class="hit" cx="310" cy="310" r="${rad}"/></g>`;
    });
    R.forEach((r, i) => {
      const rad = 80 + i * 29;
      const a = ((i * 137.5) % 360) * (Math.PI / 180);
      const px = 310 + rad * Math.cos(a);
      const py = 310 + rad * Math.sin(a);
      const prev = i ? R[i - 1].n : 0;
      const k = Math.min(10, Math.max(0, Math.min(friends, r.n) - prev));
      let st = "";
      for (let j = 0; j < k; j += 1) {
        const b = a + ((j + 1) * 2 * Math.PI) / (k + 1);
        st += `<circle class="fs${lastAdd && friends <= r.n && friends > prev && j === k - 1 ? " new" : ""}" cx="${(310 + rad * Math.cos(b)).toFixed(1)}" cy="${(310 + rad * Math.sin(b)).toFixed(1)}" r="3.2" style="animation-delay:-${(j * 0.7).toFixed(1)}s"/>`;
      }
      g += `<g class="orb${i % 2 ? " rv" : ""}" style="--d:${70 + i * 16}s;--rc:${RAR[r.r][1]}">${st}<g class="pl${friends >= r.n ? "" : " lk"}" data-i="${i}"><circle class="pc" cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="13"/><svg x="${(px - 8).toFixed(1)}" y="${(py - 8).toFixed(1)}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${EM[i]}</svg></g></g>`;
    });
    g += `<circle class="pulse" cx="310" cy="310" r="44"/><g class="core"><circle cx="310" cy="310" r="42" fill="url(#ag-ref-core)"/><circle cx="310" cy="310" r="42" fill="none" stroke="#ff4d5e" stroke-width="3"/></g><text x="310" y="322" text-anchor="middle" class="cnick" font-weight="800" font-size="34" fill="#fff">${esc((account?.nickname ?? "R").slice(0, 1).toUpperCase())}</text>`;
    sv.innerHTML = g;
    setLastAdd(false);
    updateSel();
  };

  const renderStats = () => {
    const dn = R.filter((r) => friends >= r.n);
    countTo(sFRef.current, "f", friends);
    countTo(sXRef.current, "x", dn.reduce((s, r) => s + r.xp, 0));
    countTo(sDRef.current, "d", friends * 3 + dn.reduce((s, r) => s + r.d, 0));
    if (gotRef.current) gotRef.current.textContent = String(dn.length);
  };

  const renderVault = () => {
    const el = vaultRef.current;
    if (!el) return;
    el.innerHTML = R.map((r, i) => {
      const done = friends >= r.n;
      const left = r.n - friends;
      return `<button class="vc ${done ? "done" : "lock"} ${r.r === "leg" ? "leg" : ""}" data-i="${i}" style="--rc:${RAR[r.r][1]}" aria-label="${esc(r.t)}">
  <div class="art"><span class="n">×${r.n}</span><span class="rr">${RAR[r.r][0]}</span>${emb(i)}<svg class="lk" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg></div>
  <div class="bd2"><h4>${esc(r.t)}</h4><div class="cs"><span>+${fmt(r.xp)} XP</span><span>${esc(r.it)}</span>${r.d ? `<span>${dayTxt(r.d)}</span>` : ""}</div>
  <div class="stt">${done ? "Получено ✓" : `Ещё ${left} ${pl(left, ["друг", "друга", "друзей"])}`}</div></div></button>`;
    }).join("");
    el.querySelectorAll<HTMLButtonElement>(".vc").forEach((b) => {
      b.onclick = () => {
        setSel(Number(b.dataset.i));
        updateSel();
        mapRef.current?.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "center" });
      };
    });
  };

  const renderTeam = () => {
    if (tcRef.current) tcRef.current.textContent = String(friends);
    const t = teamRef.current;
    if (!t) return;
    if (!friends) {
      t.innerHTML = `<div class="empty"><svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="32" cy="32" r="6"/><ellipse cx="32" cy="32" rx="26" ry="10" transform="rotate(-25 32 32)" stroke-dasharray="3 5"/><circle cx="52" cy="22" r="2" fill="currentColor"/></svg>Здесь пока тихо.<br>Отправь пропуск первому другу, и он появится в экипаже.</div>`;
      return;
    }
    t.innerHTML = Array.from({ length: Math.min(friends, 8) }, (_, k) => {
      const n = names[k] ?? `Друг ${friends - k}`;
      return `<div class="tm" ${k ? 'style="animation:none"' : ""}>${av(n, k)}<div class="i"><b>${esc(n)}</b><span>Засчитан · +3 дня Premium</span></div><span class="tag gb" style="padding:3px 10px;letter-spacing:0">★</span></div>`;
    }).join("");
  };

  const renderRating = () => {
    const top = topRef.current;
    const you = youRef.current;
    if (!top || !you) return;

    /* TODO(рефералка): подставить ответ бэкенда, когда он появится */
    if (TOP.length === 0) {
      top.innerHTML = `<div class="empty">Рейтинг за месяц пока пуст. Он появится, когда у проекта появится сервер.</div>`;
      you.innerHTML = "";
      return;
    }

    const [a, b, c] = TOP;
    const pd = (p: number, x: [string, number], k: number, s: number) =>
      `<div class="p p${p}"><div class="pw">${av(x[0], k, s)}</div><b>${esc(x[0])}${CROWN}</b><small><em>${x[1]}</em> друзей</small><span class="rkn">#${p}</span></div>`;
    top.innerHTML =
      `<div class="pod">${pd(2, b, 2, 62)}${pd(1, a, 1, 80)}${pd(3, c, 3, 54)}</div>` +
      TOP.slice(3)
        .map((x, i) => `<div class="lr"><span class="rb" style="--w:${(x[1] / TOP[0][1]) * 100}%"></span><span class="rk">${i + 4}</span>${av(x[0], i + 4)}<b>${esc(x[0])}${CROWN}</b><span class="c">${x[1]}</span></div>`)
        .join("");

    const rank = TOP.filter((x) => x[1] > friends).length + 1;
    const inTop = rank <= TOP.length;
    const need = TOP[TOP.length - 1][1] - friends + 1;
    const nick = account?.nickname ?? "Вы";
    you.innerHTML =
      `<span class="rk" style="border-color:rgba(43,127,255,.6);color:#fff">${inTop ? rank : "—"}</span>` +
      `${av(nick, 0)}<b>${esc(nick)}<small>${inTop ? "ты в топе месяца" : `ещё ${need} ${pl(need, ["друг", "друга", "друзей"])} до топ-${TOP.length}`}</small></b><span class="c">${friends}</span>`;
  };

  const renderAll = () => {
    renderMap();
    renderStats();
    renderVault();
    renderTeam();
    renderRating();
    updateSel();
  };

  useEffect(() => {
    renderAll();
  }, [renderAll]);

  /* ----------------------------- Слушатели карты -------------------------- */

  useEffect(() => {
    const sv = svRef.current;
    const tip = tipRef.current;
    const mapEl = mapRef.current;
    if (!sv || !tip || !mapEl) return;

    const onClick = (e: Event) => {
      const h = (e.target as Element).closest("[data-i]");
      if (h) setSel(Number((h as HTMLElement).dataset.i));
    };
    const onMove = (e: PointerEvent) => {
      const h = (e.target as Element).closest("[data-i]");
      if (!h) {
        tip.classList.remove("on");
        return;
      }
      const r = R[Number((h as HTMLElement).dataset.i)];
      if (!r) return;
      const b = mapEl.getBoundingClientRect();
      tip.textContent = `×${r.n} · ${r.t} · ${RAR[r.r][0].toLowerCase()}`;
      tip.classList.add("on");
      tip.style.left = Math.min(b.width - tip.offsetWidth - 8, e.clientX - b.left + 14) + "px";
      tip.style.top = e.clientY - b.top - 34 + "px";
    };
    const onLeave = () => tip.classList.remove("on");

    sv.addEventListener("click", onClick);
    sv.addEventListener("pointermove", onMove);
    sv.addEventListener("pointerleave", onLeave);
    return () => {
      sv.removeEventListener("click", onClick);
      sv.removeEventListener("pointermove", onMove);
      sv.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  /* ------------------------------ Наклон билета --------------------------- */

  useEffect(() => {
    const tk = ticketRef.current;
    if (!tk || reduced() || !matchMedia("(hover:hover)").matches) return;
    const move = (e: PointerEvent) => {
      const b = tk.getBoundingClientRect();
      const x = (e.clientX - b.left) / b.width;
      const y = (e.clientY - b.top) / b.height;
      tk.style.setProperty("--ry", (x - 0.5) * 8 + "deg");
      tk.style.setProperty("--rx", (0.5 - y) * 8 + "deg");
      tk.style.setProperty("--px", x * 100 + "%");
      tk.style.setProperty("--py", y * 100 + "%");
    };
    const leave = () => {
      tk.style.setProperty("--rx", "0deg");
      tk.style.setProperty("--ry", "0deg");
    };
    tk.addEventListener("pointermove", move);
    tk.addEventListener("pointerleave", leave);
    return () => {
      tk.removeEventListener("pointermove", move);
      tk.removeEventListener("pointerleave", leave);
    };
  }, []);

  /* ---------------------------- Копирование и шеринг ----------------------- */

  /* В рендер идёт относительная ссылка: на сервере window нет, и абсолютный
     адрес вышел бы другим, чем на клиенте. Полный собирается по клику. */
  const url = refLink(code).replace(/^\//, "");

  const toast = (m: string) => {
    const el = toastRef.current;
    if (!el) return;
    el.textContent = m;
    el.classList.add("on");
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => el.classList.remove("on"), 2200);
  };

  const copyText = async (s: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(s);
      return true;
    } catch {
      /* Запасной путь для браузеров без буфера обмена — как в прототипе */
      const x = document.createElement("textarea");
      x.value = s;
      x.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(x);
      x.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      x.remove();
      return ok;
    }
  };

  const onCopyLink = async () => {
    const b = copyBtnRef.current;
    await copyText(absoluteRefLink(code));
    b?.classList.add("ok");
    const label = b?.querySelector("span");
    if (label) label.textContent = "Скопировано ✓";
    toast("Ссылка скопирована");
    setTimeout(() => {
      b?.classList.remove("ok");
      const back = b?.querySelector("span");
      if (back) back.textContent = "Копировать";
    }, 1800);
  };

  const onCopyCode = async () => {
    await copyText(code);
    toast("Код скопирован");
  };

  /* ------------------------------- Демо-режим ----------------------------- */

  const onDemo = () => {
    const next = friends + 1;
    setDemoAdd(next - invitedCount);
    setLastAdd(true);
    setSel(null);
    const r = R.find((x) => x.n === next);
    toast(r ? `Рубеж ×${r.n} закрыт: «${r.t}»` : `Новая звезда на орбите: друзей ${next}`);
  };

  /* Чистим таймеры и кадры при размонтировании */
  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const shareText = encodeURIComponent("Залетай в AniGalaxy: +7 дней Premium по моему пропуску");

  return (
    <div className="ref-page" ref={rootRef}>
      {/* Фоновые слои прототипа. В макете они fixed: мы привязываем их к
          странице — иначе negative z-index уводил бы их под фон сайта */}
      <div className="sky" aria-hidden />
      <div className="stars" style={{ boxShadow: STARS.map((s) => s.shadow).join(",") }} aria-hidden />
      {SHOOTS.map((s, i) => (
        <i key={i} className="shoot" style={{ left: s.left, top: s.top, animationDelay: s.delay }} aria-hidden />
      ))}

      <main className="wrap">
        <section className="hero">
          <div>
            <span className="tag gb">РЕФЕРАЛЬНАЯ ПРОГРАММА</span>
            <h1>Собери свою <em>галактику</em></h1>
            <p className="lead">Каждый друг загорается звездой на твоей орбите. Закрывай кольца-рубежи, открывай косметику, XP и до года Premium. Награды приходят сами, без кнопок.</p>
            <div className="ticket" id="ticket" ref={ticketRef}><span className="foil" /><span className="nt n1" /><span className="nt n2" />
              <div className="t1">
                <div className="tr"><span className="lab">Твой пропуск в галактику</span><span className="on">АКТИВЕН</span></div>
                <div className="tcode"><span id="code">{code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code}</span><button onClick={() => void onCopyCode()} aria-label="Скопировать код"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></svg></button></div>
                <div className="tl"><div className="in"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg><span id="url">{url}</span></div>
                  <button className="btn" ref={copyBtnRef} onClick={() => void onCopyLink()}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></svg><span>Копировать</span></button></div>
                <div className="ts">
                  <a className="so" href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${shareText}`} target="_blank" rel="noopener noreferrer" aria-label="Telegram"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 3L3 10.5l6 2.5 2.5 6.5 3-4.5L19 19z" /><path d="M9 13l12-10" /></svg></a>
                  <a className="so" href={`https://vk.com/share.php?url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" aria-label="ВКонтакте"><svg viewBox="0 0 24 24"><text x="12" y="16.5" textAnchor="middle" fontFamily="var(--font-body),sans-serif" fontWeight="800" fontSize="12.5" fill="currentColor">VK</text></svg></a>
                  <a className="so" href={`https://wa.me/?text=${shareText}%20${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20l1.2-4A8.5 8.5 0 1 1 8 18.8z" /><path d="M9 9.5c.5 2.5 2.5 4.5 5.5 5.5l1.2-1.4-2-1-.8.8c-1-.4-1.8-1.2-2.2-2.2l.8-.8-1-2z" /></svg></a>
                  {/* TODO(рефералка): QR подключим вместе с генератором кодов на бэкенде */}
                  <button className="so" onClick={() => toast("QR-код подключим при встраивании в проект")} aria-label="QR-код"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3M21 14v1M14 21h2M19 18v3h2" /></svg></button>
                </div>
              </div>
              <div className="stub"><span className="lab" style={{ color: "#9fb6e0" }}>Другу</span><b>+7</b><span>дней Premium</span><b style={{ fontSize: 22 }}>+500</b><span>XP при старте</span></div>
            </div>
            <div className="how"><span><b>+3 дня Premium</b> тебе за каждого друга</span><span>Друг засчитывается на <b>10 уровне</b></span></div>
          </div>

          <div className="card map" id="map" ref={mapRef} aria-label="Карта орбит">
            <div className="hud"><div className="hc"><b id="sF" ref={sFRef}>0</b><span>ДРУЗЕЙ</span></div><div className="hc"><b id="sX" ref={sXRef}>0</b><span>XP ЗАРАБОТАНО</span></div><div className="hc"><b id="sD" ref={sDRef}>0</b><span>ДНЕЙ PREMIUM</span></div></div>
            <svg className="sv" id="sv" ref={svRef} viewBox="0 0 620 620" role="img" aria-label="Орбиты рубежей" />
            <div className="mini" id="mini" ref={miniRef} /><div className="tip" id="tip" ref={tipRef} />
          </div>
        </section>

        <section className="sec"><span className="lab">Как это работает</span><h2 className="h2">Три шага до первой звезды</h2>
          <div className="steps">
            <div className="card step"><div className="no">1</div><b>Отправь пропуск</b><span>Скопируй ссылку или код и поделись с другом в Telegram, VK или WhatsApp.</span></div>
            <div className="card step"><div className="no">2</div><b>Друг дорастает до 10 уровня</b><span>Нужно достичь уровня и посмотреть хотя бы 30 минут. Так награды защищены от ботов и накруток.</span></div>
            <div className="card step"><div className="no">3</div><b>Звезда загорается</b><span>Друг появляется на твоей орбите, +3 дня Premium и награды рубежей приходят автоматически.</span></div>
          </div>
        </section>

        <section className="sec"><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}><div><span className="lab">8 рубежей, от искры до архитектора</span><h2 className="h2">Хранилище наград</h2></div><span className="tag gb" style={{ letterSpacing: ".04em", fontSize: 13 }}>Получено <b id="got" ref={gotRef} style={{ margin: "0 4px" }}>0</b>/8</span></div>
          <div className="vault" id="vault" ref={vaultRef} /></section>

        <section className="sec"><span className="lab">Люди и рейтинг</span><h2 className="h2">Экипаж и созвездия</h2>
          <div className="g3">
            <div className="card"><div className="ph"><span>Твой экипаж</span><span className="cnt" id="tc" ref={tcRef}>0</span></div><div id="team" ref={teamRef} /></div>
            <div className="card" style={{ overflow: "hidden" }}><div className="ph"><span>Рейтинг созвездий</span><span className="mo">{MONTH}</span></div><div id="top" ref={topRef} /><div className="lr you" id="you" ref={youRef} /></div>
          </div>
        </section>
      </main>

      {DEMO && <button className="demo" id="demo" onClick={onDemo}>Демо: +1 друг</button>}
      <div className="toast" id="toast" ref={toastRef} />
    </div>
  );
}
