/**
 * Боевые эффекты поля: обычные удары, умения, лечение, щиты и гибель карт.
 * Один постоянный canvas поверх стола; частицы, следы и ударные волны со свечением.
 * Цикл отрисовки работает только пока на поле есть что показывать.
 */

export interface V2 {
  x: number;
  y: number;
}
export interface BattleFx {
  /** Сбор энергии у кастера перед умением */
  charge(p: V2, fx: string, el: string): void;
  /** Снаряды от кастера к целям; удар рисуется по прилёте. Возвращает время полёта, мс */
  shoot(src: V2, dsts: V2[], fx: string, el: string, ms: number): number;
  /** Эффект умения прямо на целях (без полёта) */
  impact(p: V2, fx: string, el: string, power?: number): void;
  /** Обычная атака картой: след рывка и удар */
  strike(a: V2, b: V2, el: string, crit: boolean, kill: boolean): void;
  heal(p: V2): void;
  shield(p: V2): void;
  dot(p: V2): void;
  death(p: V2, col: string): void;
  revive(p: V2): void;
  destroy(): void;
}

interface P {
  k: 0 | 1 | 2; // 0 свечение, 1 искра-штрих, 2 осколок
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  drag: number;
  life: number;
  max: number;
  s0: number;
  s1: number;
  col: string;
  rot: number;
  vr: number;
  dl: number;
}
interface Ring {
  x: number;
  y: number;
  r0: number;
  r1: number;
  life: number;
  max: number;
  col: string;
  w: number;
  sq: number;
  dl: number;
}
interface Slash {
  x: number;
  y: number;
  ang: number;
  len: number;
  life: number;
  max: number;
  col: string;
  w: number;
  dl: number;
}
interface Beam {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  life: number;
  max: number;
  col: string;
  w: number;
  dl: number;
}
interface Shot {
  kind: string;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  t: number;
  ms: number;
  dl: number;
  arc: number;
  seed: number;
  pal: [string, string, string];
  hit: () => void;
}

const PAL: Record<string, [string, string, string]> = {
  fire: ["#ff7a2a", "#ffe9a0", "#c2220e"],
  water: ["#3fa9ff", "#d6f4ff", "#1560d8"],
  wind: ["#4fe0ae", "#e9fff6", "#149c78"],
  earth: ["#e0963f", "#ffe2a8", "#7a4a1c"],
  light: ["#ffd978", "#ffffff", "#ffb02e"],
  dark: ["#9a6bff", "#e6d8ff", "#3a1290"],
  ice: ["#8fdcff", "#f2fbff", "#3d8fe0"],
  heal: ["#5eeaa8", "#eafff4", "#1fae6c"],
  poison: ["#9be04a", "#efffc8", "#4a8a12"],
  blood: ["#ff4d6a", "#ffd6dc", "#8f0f2c"],
  shield: ["#6ac8ff", "#ecf8ff", "#2b78d8"],
  steel: ["#cfd8ee", "#ffffff", "#7b88ad"],
};
/** Умения со своей палитрой; остальные красятся стихией героя */
const FXPAL: Record<string, string> = { fire: "fire", ice: "ice", wind: "wind", rain: "water", dark: "dark", debuff: "dark", drain: "blood", poison: "poison", heal: "heal", earth: "earth", quake: "earth", shield: "shield" };
/** Вид снаряда */
const SHOT: Record<string, string> = { slash: "blade", pierce: "needle", whirl: "blade", wind: "blade", burst: "orb", fire: "orb", rain: "fall", ice: "shard", debuff: "wisp", drain: "wisp", dark: "wisp", heal: "mote", poison: "orb", beam: "beam", earth: "rock" };

const rgba = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;

export function createBattleFx(cv: HTMLCanvasElement, unitH: () => number): BattleFx {
  const out = cv.getContext("2d");
  const buf = document.createElement("canvas");
  const ctx = buf.getContext("2d");
  const b1 = document.createElement("canvas");
  const g1 = b1.getContext("2d");
  const noop: BattleFx = { charge() {}, shoot: () => 0, impact() {}, strike() {}, heal() {}, shield() {}, dot() {}, death() {}, revive() {}, destroy() {} };
  if (!out || !ctx || !g1) return noop;

  let W = 1;
  let H = 1;
  let dpr = 1;
  const fit = () => {
    dpr = Math.min(1.5, window.devicePixelRatio || 1);
    W = cv.clientWidth || 1;
    H = cv.clientHeight || 1;
    const w = Math.round(W * dpr);
    const h = Math.round(H * dpr);
    if (cv.width !== w || cv.height !== h) {
      cv.width = buf.width = w;
      cv.height = buf.height = h;
      b1.width = Math.max(1, w >> 2);
      b1.height = Math.max(1, h >> 2);
    }
  };
  fit();
  const U = () => unitH() || H * 0.4;

  const sprites = new Map<string, HTMLCanvasElement>();
  const spr = (col: string): HTMLCanvasElement => {
    let c = sprites.get(col);
    if (!c) {
      c = document.createElement("canvas");
      c.width = c.height = 64;
      const g = c.getContext("2d")!;
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, "rgba(255,255,255,1)");
      gr.addColorStop(0.2, rgba(col, 0.9));
      gr.addColorStop(0.55, rgba(col, 0.24));
      gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
      sprites.set(col, c);
    }
    return c;
  };

  const ps: P[] = [];
  const rings: Ring[] = [];
  const slashes: Slash[] = [];
  const beams: Beam[] = [];
  const shots: Shot[] = [];
  let flash = 0;
  let flashCol = "#ffffff";
  let raf = 0;
  let last = 0;
  let dead = false;

  const add = (p: Partial<P> & { x: number; y: number; col: string }) => {
    if (ps.length > 900) ps.splice(0, 60);
    ps.push({ k: 0, vx: 0, vy: 0, g: 0, drag: 2, life: 0, max: 0.5, s0: 10, s1: 0, rot: 0, vr: 0, dl: 0, ...p });
  };
  const ring = (r: Partial<Ring> & { x: number; y: number; col: string }) => rings.push({ r0: 4, r1: 80, life: 0, max: 0.4, w: 3, sq: 1, dl: 0, ...r });
  const burst = (x: number, y: number, n: number, col: string[], sp: [number, number], o: Partial<P> = {}, cone?: { a: number; w: number }) => {
    for (let i = 0; i < n; i++) {
      const a = cone ? cone.a + rnd(-cone.w, cone.w) : rnd(0, TAU);
      const v = rnd(sp[0], sp[1]);
      add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, col: col[i % col.length], ...o, max: (o.max ?? 0.5) * rnd(0.7, 1.25), s0: (o.s0 ?? 10) * rnd(0.7, 1.3) });
    }
  };
  const kick = () => {
    if (dead || raf) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };
  const lit = (col: string, v: number) => {
    flash = Math.max(flash, v);
    flashCol = col;
  };

  /* ------------------------------ удары по цели ------------------------------ */
  const hitSlash = (p: V2, pal: [string, string, string], dir: number, pw: number) => {
    const u = U();
    const base = dir > 0 ? -0.6 : Math.PI + 0.6;
    const n = pw > 1.2 ? 3 : 2;
    for (let i = 0; i < n; i++) slashes.push({ x: p.x + rnd(-6, 6), y: p.y + rnd(-6, 6), ang: base + (i - (n - 1) / 2) * 1.05 + rnd(-0.12, 0.12), len: u * (0.78 + 0.18 * pw), life: 0, max: 0.26, col: i % 2 ? pal[1] : pal[0], w: u * 0.075 * pw, dl: i * 0.06 });
    burst(p.x, p.y, Math.round(16 * pw), [pal[1], pal[0], "#ffffff"], [u * 1.6, u * 4.6], { k: 1, max: 0.34, s0: u * 0.11, drag: 3.2, g: u * 3 }, { a: dir > 0 ? 0 : Math.PI, w: 1.15 });
    burst(p.x, p.y, 6, [pal[0]], [u * 0.2, u * 0.9], { max: 0.36, s0: u * 0.36, s1: u * 0.1, drag: 4 });
    add({ x: p.x, y: p.y, col: pal[1], max: 0.16, s0: u * 1.25 * pw, s1: u * 0.35 });
    ring({ x: p.x, y: p.y, col: pal[1], r0: u * 0.1, r1: u * 0.72 * pw, max: 0.3, w: 3.5 });
  };
  const hitBlast = (p: V2, pal: [string, string, string], pw: number) => {
    const u = U();
    add({ x: p.x, y: p.y, col: pal[1], max: 0.2, s0: u * 1.7 * pw, s1: u * 0.5 });
    burst(p.x, p.y, Math.round(14 * pw), [pal[0], pal[2], pal[0]], [u * 0.3, u * 1.5], { max: 0.6, s0: u * 0.5, s1: u * 0.16, drag: 3.4, g: -u * 0.5 });
    burst(p.x, p.y, Math.round(22 * pw), [pal[1], pal[0]], [u * 1.2, u * 4.2], { k: 1, max: 0.5, s0: u * 0.09, drag: 2.6, g: u * 2.6 });
    burst(p.x, p.y, 8, [pal[1]], [u * 0.2, u * 0.8], { max: 0.9, s0: u * 0.07, s1: 0, drag: 1.2, g: -u * 1.1 });
    ring({ x: p.x, y: p.y, col: pal[1], r0: u * 0.12, r1: u * 0.95 * pw, max: 0.36, w: 4.5 });
    ring({ x: p.x, y: p.y, col: pal[0], r0: u * 0.08, r1: u * 0.62 * pw, max: 0.5, w: 2, dl: 0.06 });
  };
  const hitShatter = (p: V2, pal: [string, string, string], pw: number) => {
    const u = U();
    add({ x: p.x, y: p.y, col: pal[1], max: 0.18, s0: u * 1.3 * pw, s1: u * 0.3 });
    burst(p.x, p.y, Math.round(14 * pw), [pal[1], pal[0], pal[2]], [u * 1.0, u * 3.4], { k: 2, max: 0.62, s0: u * 0.085, drag: 2.2, g: u * 4.2, vr: 9 });
    burst(p.x, p.y, 10, [pal[1]], [u * 0.3, u * 1.2], { max: 0.5, s0: u * 0.08, s1: 0, drag: 2 });
    ring({ x: p.x, y: p.y, col: pal[1], r0: u * 0.1, r1: u * 0.8 * pw, max: 0.32, w: 3 });
  };
  const hitCurse = (p: V2, pal: [string, string, string], pw: number) => {
    const u = U();
    ring({ x: p.x, y: p.y, col: pal[0], r0: u * 0.9 * pw, r1: u * 0.1, max: 0.3, w: 3 });
    for (let i = 0; i < 14; i++) {
      const a = rnd(0, TAU);
      const d = u * rnd(0.5, 0.85);
      add({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, vx: -Math.cos(a) * d * 3.2, vy: -Math.sin(a) * d * 3.2, col: i % 2 ? pal[0] : pal[2], max: 0.3, s0: u * 0.2, s1: u * 0.05, drag: 0.4 });
    }
    burst(p.x, p.y, Math.round(12 * pw), [pal[0], pal[2]], [u * 0.2, u * 1.0], { max: 0.75, s0: u * 0.46, s1: u * 0.2, drag: 2.6, g: -u * 0.7, dl: 0.26 });
    burst(p.x, p.y, 12, [pal[1], pal[0]], [u * 0.8, u * 2.6], { k: 1, max: 0.42, s0: u * 0.08, drag: 2.4, dl: 0.26 });
    ring({ x: p.x, y: p.y, col: pal[1], r0: u * 0.1, r1: u * 0.78 * pw, max: 0.36, w: 3, dl: 0.26 });
    add({ x: p.x, y: p.y, col: pal[1], max: 0.18, s0: u * 1.2, s1: u * 0.3, dl: 0.26 });
  };
  const hitQuake = (p: V2, pal: [string, string, string], pw: number) => {
    const u = U();
    const gy = p.y + u * 0.44;
    ring({ x: p.x, y: gy, col: pal[1], r0: u * 0.15, r1: u * 1.15 * pw, max: 0.42, w: 4, sq: 0.3 });
    ring({ x: p.x, y: gy, col: pal[0], r0: u * 0.1, r1: u * 0.8 * pw, max: 0.55, w: 2, sq: 0.3, dl: 0.08 });
    burst(p.x, gy, Math.round(14 * pw), [pal[2], pal[0], pal[2]], [u * 1.6, u * 4.0], { k: 2, max: 0.75, s0: u * 0.1, drag: 1.4, g: u * 7, vr: 8 }, { a: -Math.PI / 2, w: 0.75 });
    burst(p.x, gy, 10, [pal[0], pal[2]], [u * 0.3, u * 1.1], { max: 0.8, s0: u * 0.5, s1: u * 0.22, drag: 2.6, g: -u * 0.35 }, { a: -Math.PI / 2, w: 1.4 });
    add({ x: p.x, y: p.y, col: pal[1], max: 0.16, s0: u * 1.2, s1: u * 0.3 });
  };
  const hitAid = (p: V2, pal: [string, string, string], pw: number) => {
    const u = U();
    const gy = p.y + u * 0.42;
    ring({ x: p.x, y: gy, col: pal[0], r0: u * 0.2, r1: u * 0.62, max: 0.7, w: 3, sq: 0.3 });
    ring({ x: p.x, y: p.y, col: pal[1], r0: u * 0.2, r1: u * 0.7 * pw, max: 0.5, w: 2 });
    for (let i = 0; i < 20; i++) add({ x: p.x + rnd(-u * 0.34, u * 0.34), y: gy - rnd(0, u * 0.3), vy: -u * rnd(0.9, 2.1), vx: rnd(-10, 10), col: i % 3 ? pal[0] : pal[1], max: rnd(0.6, 1.1), s0: u * rnd(0.05, 0.12), s1: 0, drag: 0.6, dl: rnd(0, 0.3) });
    add({ x: p.x, y: p.y, col: pal[0], max: 0.5, s0: u * 1.3, s1: u * 0.8 });
  };
  const doImpact = (p: V2, fx: string, el: string, pw = 1, dir = 1) => {
    const pal = PAL[FXPAL[fx] ?? el] ?? PAL.light;
    if (fx === "heal" || fx === "buff" || fx === "shield" || fx === "taunt") hitAid(p, pal, pw);
    else if (fx === "fire" || fx === "burst" || fx === "beam" || fx === "rain") hitBlast(p, pal, pw);
    else if (fx === "ice") hitShatter(p, pal, pw);
    else if (fx === "dark" || fx === "debuff" || fx === "drain" || fx === "poison") hitCurse(p, pal, pw);
    else if (fx === "earth" || fx === "quake") hitQuake(p, pal, pw);
    else hitSlash(p, pal, dir, pw);
    lit(pal[0], 0.12 * pw);
    kick();
  };

  /* ---------------------------------- кадр ---------------------------------- */
  const stepShot = (s: Shot, dt: number): boolean => {
    if (s.dl > 0) {
      s.dl -= dt;
      return true;
    }
    const u = U();
    const t0 = s.t;
    s.t = Math.min(1, s.t + (dt * 1000) / s.ms);
    const dx = s.tx - s.sx;
    const dy = s.ty - s.sy;
    const L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L;
    const ny = dx / L;
    const at = (t: number): V2 => {
      const e = s.kind === "needle" || s.kind === "fall" ? t * t : t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      let off = Math.sin(Math.PI * e) * s.arc;
      if (s.kind === "wisp") off += Math.sin(e * 9 + s.seed) * u * 0.1 * (1 - e);
      return { x: s.sx + dx * e + nx * off, y: s.sy + dy * e + ny * off };
    };
    const a = at(t0);
    const b = at(s.t);
    const sub = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 7));
    const [c1, c2, c3] = s.pal;
    for (let i = 0; i < sub; i++) {
      const f = i / sub;
      const x = a.x + (b.x - a.x) * f;
      const y = a.y + (b.y - a.y) * f;
      if (s.kind === "orb" || s.kind === "rock") {
        add({ x, y, col: c1, max: 0.34, s0: u * 0.24, s1: u * 0.04, vx: rnd(-14, 14), vy: rnd(-14, 14) });
        if (Math.random() < 0.5) add({ k: 1, x, y, col: c2, max: 0.3, s0: u * 0.06, vx: -dx / L * rnd(40, 160) + rnd(-50, 50), vy: -dy / L * rnd(40, 160) + rnd(-50, 50), g: u * 1.5 });
        if (Math.random() < 0.35) add({ x, y, col: c3, max: 0.5, s0: u * 0.2, s1: u * 0.3, vx: rnd(-10, 10), vy: -rnd(10, 40) });
      } else if (s.kind === "wisp") {
        add({ x, y, col: i % 2 ? c1 : c3, max: 0.42, s0: u * 0.2, s1: u * 0.02, vx: rnd(-10, 10), vy: rnd(-10, 10) });
      } else if (s.kind === "mote") {
        add({ x: x + rnd(-5, 5), y: y + rnd(-5, 5), col: i % 2 ? c1 : c2, max: 0.5, s0: u * 0.11, s1: 0, vy: -rnd(8, 30) });
      } else if (s.kind === "shard") {
        add({ x, y, col: c1, max: 0.24, s0: u * 0.14, s1: u * 0.02 });
        if (Math.random() < 0.3) add({ x, y, col: c2, max: 0.5, s0: u * 0.045, s1: 0, vx: rnd(-30, 30), vy: rnd(-30, 30) });
      } else {
        add({ x, y, col: c1, max: 0.2, s0: u * 0.15, s1: u * 0.02 });
      }
    }
    if (s.t >= 1) {
      s.hit();
      return false;
    }
    return true;
  };
  const drawShot = (g: CanvasRenderingContext2D, s: Shot) => {
    if (s.dl > 0) return;
    const u = U();
    const dx = s.tx - s.sx;
    const dy = s.ty - s.sy;
    const L = Math.hypot(dx, dy) || 1;
    const e = s.kind === "needle" || s.kind === "fall" ? s.t * s.t : s.t < 0.5 ? 2 * s.t * s.t : 1 - Math.pow(-2 * s.t + 2, 2) / 2;
    const off = Math.sin(Math.PI * e) * s.arc;
    const x = s.sx + dx * e + (-dy / L) * off;
    const y = s.sy + dy * e + (dx / L) * off;
    const ang = Math.atan2(dy, dx);
    const [c1, c2] = s.pal;
    g.save();
    g.translate(x, y);
    if (s.kind === "blade") {
      g.rotate(ang + s.t * 16 + s.seed);
      for (let i = 0; i < 2; i++) {
        g.rotate(Math.PI * i);
        g.beginPath();
        g.arc(0, 0, u * 0.24, -1.2, 1.2);
        g.arc(u * 0.1, 0, u * 0.2, 1.0, -1.0, true);
        g.closePath();
        g.fillStyle = rgba(i ? c1 : c2, 0.95);
        g.fill();
      }
    } else if (s.kind === "needle" || s.kind === "shard" || s.kind === "fall") {
      g.rotate(ang);
      const len = u * (s.kind === "shard" ? 0.3 : 0.62);
      const w = u * (s.kind === "shard" ? 0.075 : 0.035);
      const gr = g.createLinearGradient(-len, 0, len * 0.3, 0);
      gr.addColorStop(0, rgba(c1, 0));
      gr.addColorStop(0.7, rgba(c1, 0.9));
      gr.addColorStop(1, "#ffffff");
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(-len, 0);
      g.lineTo(0, -w);
      g.lineTo(len * 0.3, 0);
      g.lineTo(0, w);
      g.closePath();
      g.fill();
    } else {
      const r = u * (s.kind === "mote" ? 0.16 : s.kind === "wisp" ? 0.24 : 0.34);
      g.drawImage(spr(c1), -r, -r, r * 2, r * 2);
      g.drawImage(spr(c2), -r * 0.5, -r * 0.5, r, r);
    }
    g.restore();
  };

  const frame = (now: number) => {
    raf = 0;
    if (dead) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    fit();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";

    for (let i = shots.length - 1; i >= 0; i--) if (!stepShot(shots[i], dt)) shots.splice(i, 1);
    for (const s of shots) drawShot(ctx, s);

    /* лучи */
    for (let i = beams.length - 1; i >= 0; i--) {
      const b = beams[i];
      if (b.dl > 0) {
        b.dl -= dt;
        continue;
      }
      b.life += dt;
      const t = b.life / b.max;
      if (t >= 1) {
        beams.splice(i, 1);
        continue;
      }
      const k = t < 0.18 ? t / 0.18 : 1 - (t - 0.18) / 0.82;
      ctx.lineCap = "round";
      ctx.strokeStyle = rgba(b.col, 0.5 * k);
      ctx.lineWidth = b.w * 2.6 * k;
      ctx.beginPath();
      ctx.moveTo(b.sx, b.sy);
      ctx.lineTo(b.tx, b.ty);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${0.95 * k})`;
      ctx.lineWidth = b.w * k;
      ctx.stroke();
    }

    /* росчерки клинка */
    for (let i = slashes.length - 1; i >= 0; i--) {
      const s = slashes[i];
      if (s.dl > 0) {
        s.dl -= dt;
        continue;
      }
      s.life += dt;
      const t = s.life / s.max;
      if (t >= 1) {
        slashes.splice(i, 1);
        continue;
      }
      const head = clamp(t / 0.45);
      const tail = clamp((t - 0.3) / 0.7);
      const a = -s.len / 2 + s.len * tail;
      const b = -s.len / 2 + s.len * head;
      const w = s.w * (1 - tail * 0.7);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.ang);
      const bow = s.len * 0.1;
      ctx.beginPath();
      ctx.moveTo(a, 0);
      ctx.quadraticCurveTo((a + b) / 2, -bow - w, b, 0);
      ctx.quadraticCurveTo((a + b) / 2, -bow + w * 0.35, a, 0);
      ctx.closePath();
      ctx.fillStyle = rgba(s.col, 0.9 * (1 - tail));
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(a, 0);
      ctx.quadraticCurveTo((a + b) / 2, -bow - w * 0.4, b, 0);
      ctx.quadraticCurveTo((a + b) / 2, -bow, a, 0);
      ctx.closePath();
      ctx.fillStyle = `rgba(255,255,255,${0.95 * (1 - tail)})`;
      ctx.fill();
      ctx.restore();
    }

    /* кольца ударной волны */
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      if (r.dl > 0) {
        r.dl -= dt;
        continue;
      }
      r.life += dt;
      const t = r.life / r.max;
      if (t >= 1) {
        rings.splice(i, 1);
        continue;
      }
      const e = 1 - Math.pow(1 - t, 3);
      const rad = Math.max(0.5, r.r0 + (r.r1 - r.r0) * e);
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.scale(1, r.sq);
      ctx.strokeStyle = rgba(r.col, 0.9 * (1 - t));
      ctx.lineWidth = r.w * (1 - t * 0.7) + 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, rad, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    /* частицы */
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      if (p.dl > 0) {
        p.dl -= dt;
        continue;
      }
      p.life += dt;
      const t = p.life / p.max;
      if (t >= 1) {
        ps.splice(i, 1);
        continue;
      }
      const d = Math.exp(-p.drag * dt);
      p.vx *= d;
      p.vy = p.vy * d + p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      const al = t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88;
      const s = p.s0 + (p.s1 - p.s0) * t;
      if (p.k === 0) {
        ctx.globalAlpha = al;
        ctx.drawImage(spr(p.col), p.x - s, p.y - s, s * 2, s * 2);
      } else if (p.k === 1) {
        const v = Math.hypot(p.vx, p.vy) || 1;
        const len = Math.min(s * 4, v * 0.05) + s * 0.6;
        ctx.globalAlpha = al;
        ctx.strokeStyle = p.col;
        ctx.lineWidth = Math.max(1, s * 0.22);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - (p.vx / v) * len, p.y - (p.vy / v) * len);
        ctx.stroke();
      } else {
        ctx.globalAlpha = al;
        ctx.globalCompositeOperation = "source-over";
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.col;
        ctx.beginPath();
        ctx.moveTo(-s, -s * 0.5);
        ctx.lineTo(s * 0.7, -s * 0.8);
        ctx.lineTo(s, s * 0.4);
        ctx.lineTo(-s * 0.4, s * 0.9);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.beginPath();
        ctx.moveTo(-s, -s * 0.5);
        ctx.lineTo(s * 0.7, -s * 0.8);
        ctx.lineTo(0, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.globalCompositeOperation = "lighter";
      }
    }
    ctx.globalAlpha = 1;

    /* вывод: сцена + свечение + короткая вспышка кадра */
    out.setTransform(1, 0, 0, 1, 0, 0);
    out.clearRect(0, 0, cv.width, cv.height);
    out.globalCompositeOperation = "source-over";
    out.drawImage(buf, 0, 0);
    g1.clearRect(0, 0, b1.width, b1.height);
    g1.drawImage(buf, 0, 0, b1.width, b1.height);
    out.globalCompositeOperation = "lighter";
    out.globalAlpha = 0.75;
    out.drawImage(b1, 0, 0, cv.width, cv.height);
    out.globalAlpha = 1;
    if (flash > 0.004) {
      out.fillStyle = rgba(flashCol, flash);
      out.fillRect(0, 0, cv.width, cv.height);
      flash *= Math.exp(-14 * dt);
    } else flash = 0;
    out.globalCompositeOperation = "source-over";

    if (ps.length || rings.length || slashes.length || beams.length || shots.length || flash > 0) raf = requestAnimationFrame(frame);
    else out.clearRect(0, 0, cv.width, cv.height);
  };

  return {
    charge(p, fx, el) {
      const pal = PAL[FXPAL[fx] ?? el] ?? PAL.light;
      const u = U();
      for (let i = 0; i < 18; i++) {
        const a = rnd(0, TAU);
        const d = u * rnd(0.45, 0.8);
        add({ k: i % 3 ? 0 : 1, x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, vx: -Math.cos(a) * d * 3.4, vy: -Math.sin(a) * d * 3.4, col: i % 2 ? pal[0] : pal[1], max: 0.28, s0: u * 0.1, s1: u * 0.03, drag: 0.3, dl: rnd(0, 0.08) });
      }
      ring({ x: p.x, y: p.y, col: pal[0], r0: u * 0.75, r1: u * 0.18, max: 0.26, w: 2.5 });
      add({ x: p.x, y: p.y, col: pal[0], max: 0.42, s0: u * 0.5, s1: u * 1.1, dl: 0.1 });
      ring({ x: p.x, y: p.y + u * 0.42, col: pal[1], r0: u * 0.15, r1: u * 0.6, max: 0.4, w: 2, sq: 0.3, dl: 0.12 });
      kick();
    },
    shoot(src, dsts, fx, el, ms) {
      const kind = SHOT[fx];
      const pal = PAL[FXPAL[fx] ?? el] ?? PAL.light;
      const u = U();
      let any = false;
      dsts.forEach((d, i) => {
        const self = Math.hypot(d.x - src.x, d.y - src.y) < 4;
        const dir = d.x >= src.x ? 1 : -1;
        const hit = () => doImpact(d, fx, el, 1, dir);
        if (!kind || self) {
          setTimeout(() => !dead && hit(), i * 70);
          return;
        }
        any = true;
        if (kind === "beam") {
          beams.push({ sx: src.x, sy: src.y, tx: d.x, ty: d.y, life: 0, max: 0.42, col: pal[0], w: u * 0.09, dl: (ms * 0.45 + i * 70) / 1000 });
          add({ x: src.x, y: src.y, col: pal[1], max: 0.4, s0: u * 0.7, s1: u * 0.2, dl: (ms * 0.3) / 1000 });
          setTimeout(() => !dead && hit(), ms * 0.5 + i * 70);
          return;
        }
        if (kind === "fall") {
          for (let j = 0; j < 4; j++) {
            const x = d.x + (j - 1.5) * u * 0.16;
            shots.push({ kind, sx: x - dir * u * 0.3, sy: d.y - u * 1.5, tx: x, ty: d.y + rnd(-u * 0.12, u * 0.12), t: 0, ms: ms * 0.7, dl: (i * 70 + j * 60) / 1000, arc: 0, seed: 0, pal, hit: j === 3 ? hit : () => burst(x, d.y, 6, [pal[1], pal[0]], [u * 0.6, u * 1.8], { k: 1, max: 0.3, s0: u * 0.07, g: u * 3 }) });
          }
          return;
        }
        const n = kind === "blade" && (fx === "whirl" || fx === "wind") ? 2 : kind === "mote" ? 3 : 1;
        for (let j = 0; j < n; j++) {
          const arc = kind === "rock" ? -dir * u * 0.5 : kind === "needle" || kind === "shard" ? 0 : (j % 2 ? 1 : -1) * u * rnd(0.12, 0.3) * (n > 1 ? 1.4 : 1);
          shots.push({ kind, sx: src.x, sy: src.y, tx: d.x, ty: d.y, t: 0, ms, dl: (i * 70 + j * 50) / 1000, arc, seed: rnd(0, 6), pal, hit: j === n - 1 ? hit : () => {} });
        }
        if (fx === "drain") setTimeout(() => !dead && shots.push({ kind: "wisp", sx: d.x, sy: d.y, tx: src.x, ty: src.y, t: 0, ms, dl: 0, arc: u * 0.2, seed: rnd(0, 6), pal: PAL.heal, hit: () => hitAid(src, PAL.heal, 0.8) }) && kick(), ms + i * 70 + 60);
      });
      /* вспышка выстрела у кастера */
      if (any) {
        add({ x: src.x, y: src.y, col: pal[1], max: 0.2, s0: u * 0.8, s1: u * 0.2 });
        ring({ x: src.x, y: src.y, col: pal[0], r0: u * 0.1, r1: u * 0.5, max: 0.28, w: 2.5 });
      }
      kick();
      return any ? ms : 0;
    },
    impact(p, fx, el, power = 1) {
      doImpact(p, fx, el, power);
    },
    strike(a, b, el, crit, kill) {
      const pal = PAL[el] ?? PAL.steel;
      const u = U();
      const dir = b.x >= a.x ? 1 : -1;
      const pw = kill ? 1.5 : crit ? 1.35 : 1;
      /* след рывка */
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      for (let i = 0; i < 34; i++) {
        const f = i / 34;
        add({ k: i % 3 === 0 ? 1 : 0, x: a.x + dx * f + rnd(-4, 4), y: a.y + dy * f + rnd(-u * 0.26, u * 0.26), col: i % 2 ? pal[0] : pal[1], max: 0.34, s0: u * (i % 3 === 0 ? 0.12 : 0.2) * (0.5 + f * 0.5), s1: 0, vx: -dir * rnd(60, 260), drag: 3, dl: f * 0.03 });
      }
      hitSlash(b, pal, dir, pw);
      if (crit || kill) {
        ring({ x: b.x, y: b.y, col: "#ffffff", r0: u * 0.1, r1: u * 1.2, max: 0.34, w: 5 });
        burst(b.x, b.y, 14, ["#ffffff", pal[1]], [u * 2.5, u * 6], { k: 1, max: 0.36, s0: u * 0.14, drag: 3 });
        add({ x: b.x, y: b.y, col: "#ffffff", max: 0.14, s0: u * 2.1, s1: u * 0.6 });
        lit("#ffffff", crit && kill ? 0.3 : 0.2);
      } else lit(pal[0], 0.08);
      kick();
    },
    heal(p) {
      hitAid(p, PAL.heal, 1);
      kick();
    },
    shield(p) {
      const u = U();
      const pal = PAL.shield;
      /* шестигранный купол */
      for (let k = 0; k < 2; k++) ring({ x: p.x, y: p.y, col: k ? pal[1] : pal[0], r0: u * (0.25 + k * 0.1), r1: u * (0.62 + k * 0.06), max: 0.5 + k * 0.15, w: 3 - k, dl: k * 0.08 });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + 0.52;
        add({ x: p.x + Math.cos(a) * u * 0.6, y: p.y + Math.sin(a) * u * 0.6, col: pal[1], max: 0.6, s0: u * 0.12, s1: 0, dl: 0.15 + i * 0.03 });
      }
      add({ x: p.x, y: p.y, col: pal[0], max: 0.5, s0: u * 1.1, s1: u * 0.7 });
      kick();
    },
    dot(p) {
      const u = U();
      const pal = PAL.fire;
      burst(p.x, p.y + u * 0.2, 12, [pal[0], pal[1], pal[2]], [u * 0.2, u * 0.9], { max: 0.6, s0: u * 0.2, s1: u * 0.04, drag: 2, g: -u * 1.6 }, { a: -Math.PI / 2, w: 1.1 });
      burst(p.x, p.y, 8, [pal[1]], [u * 0.6, u * 1.6], { k: 1, max: 0.4, s0: u * 0.06, g: -u * 1.2 });
      kick();
    },
    death(p, col) {
      const u = U();
      const c = /^#[0-9a-f]{6}$/i.test(col) ? col : "#8fb0ff";
      add({ x: p.x, y: p.y, col: "#ffffff", max: 0.22, s0: u * 1.9, s1: u * 0.5 });
      burst(p.x, p.y, 26, [c, "#2a3050", "#d8e2ff", c], [u * 0.8, u * 3.6], { k: 2, max: 0.95, s0: u * 0.1, drag: 1.6, g: u * 5, vr: 10 });
      burst(p.x, p.y, 20, [c, "#ffffff"], [u * 1.2, u * 4.5], { k: 1, max: 0.5, s0: u * 0.1, drag: 2.6 });
      burst(p.x, p.y, 10, [c], [u * 0.2, u * 0.9], { max: 1.1, s0: u * 0.5, s1: u * 0.25, drag: 2.4, g: -u * 0.5 });
      for (let i = 0; i < 12; i++) add({ x: p.x + rnd(-u * 0.3, u * 0.3), y: p.y + rnd(-u * 0.4, u * 0.4), vy: -u * rnd(0.5, 1.4), col: i % 2 ? c : "#ffffff", max: rnd(0.9, 1.5), s0: u * 0.06, s1: 0, drag: 0.5, dl: rnd(0.15, 0.5) });
      ring({ x: p.x, y: p.y, col: "#ffffff", r0: u * 0.15, r1: u * 1.3, max: 0.45, w: 5 });
      ring({ x: p.x, y: p.y, col: c, r0: u * 0.1, r1: u * 0.9, max: 0.6, w: 2.5, dl: 0.08 });
      lit(c, 0.16);
      kick();
    },
    revive(p) {
      const u = U();
      const pal = PAL.light;
      beams.push({ sx: p.x, sy: p.y - u * 2.2, tx: p.x, ty: p.y + u * 0.45, life: 0, max: 0.7, col: pal[0], w: u * 0.22, dl: 0 });
      hitAid(p, pal, 1.2);
      burst(p.x, p.y, 16, [pal[1], pal[0]], [u * 0.8, u * 2.6], { k: 1, max: 0.5, s0: u * 0.09, drag: 2.4, dl: 0.12 });
      lit(pal[0], 0.14);
      kick();
    },
    destroy() {
      dead = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}
