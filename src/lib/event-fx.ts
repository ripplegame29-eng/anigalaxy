"use client";

/**
 * Эффекты страницы ивента: летящие огоньки, салют из частиц, курсорное
 * свечение.
 *
 * В макете это был один скрипт на весь документ, поэтому всё держится в
 * модуле: компонент только создаёт холсты и вызывает `initFx()`. Побочные
 * эффекты (appendChild элементов в body) в React не попадают — это микроскопика
 * длиной в доли секунды, и она рисуется напрямую в DOM, как в макете.
 */

const GOLD = ["#ffc861", "#ff8a3d", "#ff4f8b", "#fff3d6"];
const SPIRIT = ["#b9a0ff", "#e9e2ff", "#38d6ff"];
const BAD = ["#ff3b3b", "#ff8a8a", "#ff4f8b"];

const reduced = (): boolean =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const fine = (): boolean =>
  typeof window !== "undefined" &&
  window.matchMedia("(hover:hover) and (pointer:fine)").matches && !reduced();

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  l: number;
  d: number;
  r: number;
  c: string;
  sq: boolean;
  rot: number;
}

let burstCtx: CanvasRenderingContext2D | null = null;
let rafBurst = 0;
let particles: Particle[] = [];

let lanternEl: HTMLElement | null = null;
let arenaEl: HTMLElement | null = null;

/** Куда слетают фонарики (плашка счётчика) и откуда взлетают (арена) */
export function setLanternTarget(el: HTMLElement | null): void {
  lanternEl = el;
}
export function setArenaTarget(el: HTMLElement | null): void {
  arenaEl = el;
}

/** Салют частиц из точки экрана */
export function burst(
  x: number,
  y: number,
  n = 30,
  cols: string[] = GOLD,
  sp = 1,
): void {
  if (!burstCtx || reduced()) return;
  for (let i = 0; i < n; i += 1) {
    const a = Math.random() * 6.283;
    const v = (2 + Math.random() * 5) * sp;
    particles.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 2,
      l: 1,
      d: 0.012 + Math.random() * 0.014,
      r: 1.5 + Math.random() * 3,
      c: cols[i % cols.length],
      sq: Math.random() < 0.4,
      rot: Math.random() * 6,
    });
  }
  if (!rafBurst) rafBurst = requestAnimationFrame(loopBurst);
}

function loopBurst(): void {
  const ctx = burstCtx;
  if (!ctx) {
    rafBurst = 0;
    return;
  }
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  particles = particles.filter((p) => p.l > 0);
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.12;
    p.vx *= 0.985;
    p.l -= p.d;
    p.rot += 0.1;
    ctx.globalAlpha = Math.max(0, p.l);
    ctx.fillStyle = p.c;
    if (p.sq) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, 7);
      ctx.fill();
    }
  }
  if (particles.length) rafBurst = requestAnimationFrame(loopBurst);
  else {
    rafBurst = 0;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }
}

/**
 * Фонарики из точки `from` слетают к счётчику. Анимация короче секунды, её
 * видно один раз за нажатие — рисовать её через React-состояние дороже, чем
 * напрямую в DOM.
 */
export function flyLanterns(count: number, from: { x: number; y: number } | null): void {
  if (reduced() || !lanternEl) return;
  const t = lanternEl.getBoundingClientRect();
  const arena = arenaEl?.getBoundingClientRect();
  const o = from ?? (arena ? { x: arena.left + arena.width / 2, y: arena.top + arena.height / 2 } : null);
  if (!o) return;
  const dx = t.left + t.width / 2 - o.x;
  const dy = t.top + t.height / 2 - o.y;

  for (let i = 0; i < Math.min(7, Math.ceil(count / 12)); i += 1) {
    const dot = document.createElement("i");
    dot.className = "ev-fl";
    document.body.appendChild(dot);
    const x = o.x - 7;
    const y = o.y - 9;
    const anim = dot.animate(
      [
        { transform: `translate(${x}px, ${y}px) scale(1)` },
        {
          transform: `translate(${x + dx * 0.4 + (Math.random() - 0.5) * 140}px, ${y + dy * 0.4 - 90}px) scale(1.2)`,
          offset: 0.4,
        },
        { transform: `translate(${x + dx}px, ${y + dy}px) scale(0.3)`, opacity: 0.3 },
      ],
      { duration: 900 + i * 70, delay: i * 60, easing: "cubic-bezier(.5,0,.3,1)", fill: "backwards" },
    );
    anim.onfinish = () => {
      dot.remove();
      lanternEl?.classList.remove("ev-pulse");
      // Рефлоу, чтобы анимация перезапустилась
      void lanternEl?.offsetWidth;
      lanternEl?.classList.add("ev-pulse");
    };
  }
}

/** Поджиг фонарика у счётчика при обмене (другой цвет) */
export function flyCoins(count: number, from: HTMLElement | null, to: HTMLElement | null): void {
  if (reduced() || !from || !to) return;
  const a = from.getBoundingClientRect();
  const c = to.getBoundingClientRect();
  const x = a.left + a.width / 2 - 8;
  const y = a.top + a.height / 2 - 8;
  const dx = c.left + c.width / 2 - a.left - a.width / 2;
  const dy = c.top + c.height / 2 - a.top - a.height / 2;
  for (let i = 0; i < Math.min(9, Math.ceil(count / 2)); i += 1) {
    const dot = document.createElement("i");
    dot.className = "ev-fl ev-cn";
    document.body.appendChild(dot);
    const anim = dot.animate(
      [
        { transform: `translate(${x}px, ${y}px) scale(1)` },
        {
          transform: `translate(${x + dx * 0.5}px, ${y + dy * 0.5 - 50 - Math.random() * 40}px) scale(1.2)`,
          offset: 0.5,
        },
        { transform: `translate(${x + dx}px, ${y + dy}px) scale(0.5)`, opacity: 0.4 },
      ],
      { duration: 800 + i * 60, delay: i * 70, easing: "cubic-bezier(.5,0,.3,1)", fill: "backwards" },
    );
    anim.onfinish = () => {
      dot.remove();
      to.classList.remove("ev-pulse");
      void to.getBoundingClientRect();
      to.classList.add("ev-pulse");
    };
  }
  setTimeout(() => {
    const k = to.getBoundingClientRect();
    burst(k.left + k.width / 2, k.top + k.height / 2, 34);
  }, 700);
}

/**
 * Запускает фоновые эффекты: холст огоньков, холст салюта, курсорное
 * свечение, подсветку карточек и параллакс героя. Возвращает очистку.
 */
export function initFx(): () => void {
  const stop: (() => void)[] = [];

  /* ── огоньки на фоне ── */
  const embers = document.createElement("canvas");
  embers.className = "ev-fx";
  embers.setAttribute("aria-hidden", "true");
  document.body.appendChild(embers);
  const ectx = embers.getContext("2d");

  if (ectx && !reduced()) {
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, window.matchMedia("(pointer: coarse)").matches ? 1.25 : 2);
    interface Ember {
      x: number;
      y: number;
      r: number;
      v: number;
      s: number;
      c: string;
    }
    let list: Ember[] = [];
    const make = (spread: boolean): Ember => {
      const k = Math.random();
      return {
        x: Math.random() * w,
        y: spread ? Math.random() * h : h + 10,
        r: Math.random() * 2.2 + 0.6,
        v: Math.random() * 0.5 + 0.15,
        s: Math.random() * Math.PI * 2,
        c: k < 0.55 ? "#ff9a4d" : k < 0.8 ? "#ff6aa0" : "#b9a0ff",
      };
    };
    const resize = (): void => {
      w = window.innerWidth;
      h = window.innerHeight;
      embers.width = w * dpr;
      embers.height = h * dpr;
      ectx.setTransform(dpr, 0, 0, dpr, 0, 0);
      list = Array.from({ length: Math.round((w * h) / 16000) }, () => make(true));
    };
    resize();
    window.addEventListener("resize", resize);
    stop.push(() => window.removeEventListener("resize", resize));

    let alive = true;
    let raf = 0;
    const frame = (t: number): void => {
      if (!alive) return;
      ectx.clearRect(0, 0, w, h);
      for (const p of list) {
        p.y -= p.v;
        p.x += Math.sin(t / 1400 + p.s) * 0.35;
        if (p.y < -10) Object.assign(p, make(false));
        ectx.globalAlpha = 0.35 + 0.45 * Math.sin(t / 700 + p.s);
        ectx.shadowBlur = 12;
        ectx.shadowColor = p.c;
        ectx.fillStyle = p.c;
        ectx.beginPath();
        ectx.arc(p.x, p.y, p.r, 0, 7);
        ectx.fill();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const onVisibility = (): void => {
      if (document.hidden) {
        alive = false;
        cancelAnimationFrame(raf);
      } else {
        alive = true;
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    stop.push(() => {
      alive = false;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
    });
  }

  /* ── холст салюта ── */
  const fx = document.createElement("canvas");
  fx.className = "ev-fx2";
  fx.setAttribute("aria-hidden", "true");
  document.body.appendChild(fx);
  burstCtx = fx.getContext("2d");
  const dpr2 = Math.min(window.devicePixelRatio || 1, window.matchMedia("(pointer: coarse)").matches ? 1.25 : 2);
  const resizeBurst = (): void => {
    fx.width = window.innerWidth * dpr2;
    fx.height = window.innerHeight * dpr2;
    burstCtx?.setTransform(dpr2, 0, 0, dpr2, 0, 0);
  };
  resizeBurst();
  window.addEventListener("resize", resizeBurst);
  stop.push(() => window.removeEventListener("resize", resizeBurst));

  /* ── курсорное свечение, подсветка карточек, параллакс, наклон карточек ── */
  if (fine()) {
    const glow = document.createElement("div");
    glow.className = "ev-glow";
    glow.setAttribute("aria-hidden", "true");
    document.body.appendChild(glow);
    glow.style.display = "block";

    const hero = document.querySelector<HTMLElement>(".ev-hero");
    const tiltCards = Array.from(document.querySelectorAll<HTMLElement>(".ev-ex .ev-card"));
    let gx = 0;
    let gy = 0;
    let tx = 0;
    let ty = 0;

    const onMove = (event: PointerEvent): void => {
      tx = event.clientX;
      ty = event.clientY;
      const target = event.target as HTMLElement | null;
      const card = target?.closest?.<HTMLElement>(".ev-card,.ev-q");
      if (card) {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${event.clientX - r.left}px`);
        card.style.setProperty("--my", `${event.clientY - r.top}px`);
      }
      if (hero) {
        hero.style.setProperty("--px", ((event.clientX / window.innerWidth - 0.5) * 2).toFixed(3));
        hero.style.setProperty("--py", ((event.clientY / window.innerHeight - 0.5) * 2).toFixed(3));
      }
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    stop.push(() => window.removeEventListener("pointermove", onMove));

    let raf = 0;
    const follow = (): void => {
      gx += (tx - gx) * 0.12;
      gy += (ty - gy) * 0.12;
      glow.style.transform = `translate(${gx}px, ${gy}px)`;
      raf = requestAnimationFrame(follow);
    };
    raf = requestAnimationFrame(follow);
    stop.push(() => cancelAnimationFrame(raf));

    const tilts = tiltCards.map((card) => {
      const move = (event: PointerEvent): void => {
        const r = card.getBoundingClientRect();
        const x = (event.clientX - r.left) / r.width - 0.5;
        const y = (event.clientY - r.top) / r.height - 0.5;
        card.style.transform = `perspective(800px) rotateY(${x * 12}deg) rotateX(${-y * 12}deg)`;
      };
      const leave = (): void => {
        card.style.transform = "";
      };
      card.addEventListener("pointermove", move);
      card.addEventListener("pointerleave", leave);
      return () => {
        card.removeEventListener("pointermove", move);
        card.removeEventListener("pointerleave", leave);
      };
    });
    stop.push(...tilts);
    stop.push(() => glow.remove());
  }

  return () => {
    for (const fn of stop) fn();
    embers.remove();
    fx.remove();
    cancelAnimationFrame(rafBurst);
    rafBurst = 0;
    particles = [];
    burstCtx = null;
  };
}

export const BURST_COLORS = { GOLD, SPIRIT, BAD };