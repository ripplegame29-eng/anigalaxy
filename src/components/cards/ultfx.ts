/**
 * Добивающие удары стихий для ультимейтов S/SS: частицы и свет на canvas.
 * Чистая отрисовка без зависимостей; эффект бьёт в центры карт-целей.
 */

export interface UltFxOpts {
  /** fire | water | wind | earth | light | dark */
  el: string;
  /** Поддержка (лечение, щит, усиление): мягкий восходящий свет вместо удара */
  aid: boolean;
  /** Длительность, мс */
  dur: number;
  /** Центры целей в координатах холста (CSS-пиксели) */
  pts: { x: number; y: number }[];
  /** Куда смотрит атакующий: 1 — слева направо */
  dir: 1 | -1;
  /** Высота карты героя, px — масштаб эффекта */
  unit: number;
  /** 1 — полный (SS), меньше — короче и скромнее (S) */
  power: number;
}

interface P {
  k: 0 | 1 | 2 | 3 | 4; // 0 свечение, 1 искра-штрих, 2 камень, 3 дым, 4 орбита
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
  a: number;
  rot: number;
  vr: number;
}
interface Ring {
  x: number;
  y: number;
  r0: number;
  r1: number;
  life: number;
  max: number;
  col: string;
  sq: number;
  w: number;
  vy: number;
}

const PAL: Record<string, [string, string, string]> = {
  fire: ["#ff7a2a", "#ffe9a0", "#c2220e"],
  water: ["#3fa9ff", "#d6f4ff", "#1560d8"],
  wind: ["#4fe0ae", "#e9fff6", "#149c78"],
  earth: ["#e0963f", "#ffe2a8", "#7a4a1c"],
  light: ["#ffd978", "#ffffff", "#ffb02e"],
  dark: ["#9a6bff", "#e6d8ff", "#3a1290"],
};

const rgba = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
const easeBack = (t: number) => {
  const x = clamp(t);
  return 1 + 2.4 * Math.pow(x - 1, 3) + 1.4 * Math.pow(x - 1, 2);
};
/** Огибающая: нарастание a→b, плато, спад c→d */
const env = (t: number, a: number, b: number, c: number, d: number) => (t <= a || t >= d ? 0 : t < b ? (t - a) / (b - a) : t <= c ? 1 : 1 - (t - c) / (d - c));

export function runUltFx(cv: HTMLCanvasElement, o: UltFxOpts): () => void {
  const ctx = cv.getContext("2d");
  if (!ctx) return () => {};
  const dpr = Math.min(1.5, window.devicePixelRatio || 1);
  const W = cv.clientWidth || 1;
  const H = cv.clientHeight || 1;
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const U = o.unit || H * 0.4;
  const pw = clamp(o.power, 0.4, 1);
  const [C1, C2, C3] = PAL[o.el] ?? PAL.light;
  const pts = o.pts.length ? o.pts : [{ x: W * (o.dir > 0 ? 0.75 : 0.25), y: H * 0.5 }];
  const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
  const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  const ground = (p: { y: number }) => p.y + U * 0.46;

  /* спрайты мягкого свечения по цветам */
  const sprites = new Map<string, HTMLCanvasElement>();
  const spr = (col: string, core = true): HTMLCanvasElement => {
    const key = col + (core ? 1 : 0);
    let c = sprites.get(key);
    if (!c) {
      c = document.createElement("canvas");
      c.width = c.height = 96;
      const g = c.getContext("2d")!;
      const gr = g.createRadialGradient(48, 48, 0, 48, 48, 48);
      if (core) {
        gr.addColorStop(0, "rgba(255,255,255,1)");
        gr.addColorStop(0.22, rgba(col, 0.9));
      } else gr.addColorStop(0, rgba(col, 0.75));
      gr.addColorStop(0.58, rgba(col, 0.22));
      gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr;
      g.fillRect(0, 0, 96, 96);
      sprites.set(key, c);
    }
    return c;
  };

  const ps: P[] = [];
  const rings: Ring[] = [];
  let fade = 1;
  const add = (p: Partial<P> & { x: number; y: number }) => {
    if (ps.length > 900) return;
    ps.push({ k: 0, vx: 0, vy: 0, g: 0, drag: 0, life: 0, max: 0.6, s0: 10, s1: 0, col: C1, a: 1, rot: 0, vr: 0, ...p });
  };
  const ring = (x: number, y: number, r0: number, r1: number, max: number, col = C2, sq = 1, w = 3, vy = 0) => rings.push({ x, y, r0, r1, life: 0, max, col, sq, w, vy });
  const glow = (x: number, y: number, r: number, col: string, a: number, core = true) => {
    if (a <= 0 || r <= 0) return;
    ctx.globalAlpha = clamp(a * fade);
    ctx.drawImage(spr(col, core), x - r, y - r, r * 2, r * 2);
  };
  const lighter = () => (ctx.globalCompositeOperation = "lighter");
  const over = () => (ctx.globalCompositeOperation = "source-over");
  /** Ломаная молния/трещина между точками */
  const bolt = (x1: number, y1: number, x2: number, y2: number, jag: number, col: string, a: number, w: number, upTo = 1, seed?: number[]) => {
    const d = Math.hypot(x2 - x1, y2 - y1);
    const n = Math.max(3, Math.round(d / 22));
    const nx = -(y2 - y1) / d;
    const ny = (x2 - x1) / d;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    const m = Math.max(1, Math.round(n * clamp(upTo)));
    for (let i = 1; i <= m; i++) {
      const s = i / n;
      const off = i === n ? 0 : (seed ? seed[i % seed.length] : Math.random() - 0.5) * jag;
      ctx.lineTo(lerp(x1, x2, s) + nx * off, lerp(y1, y2, s) + ny * off);
    }
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = col;
    ctx.globalAlpha = clamp(a * 0.35 * fade);
    ctx.lineWidth = w * 4;
    ctx.stroke();
    ctx.strokeStyle = "#fff";
    ctx.globalAlpha = clamp(a * fade);
    ctx.lineWidth = w;
    ctx.stroke();
  };
  /** Серп-разрез: сужающийся к концам изогнутый клинок света */
  const slash = (x: number, y: number, ang: number, len: number, bow: number, thick: number, q: number, col: string) => {
    const a = q < 1 ? 1 : Math.max(0, 1 - (q - 1) / 1.1);
    if (a <= 0) return;
    const qs = clamp(q);
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const at = (s: number, off: number): [number, number] => {
      const u = (s - 0.5) * len;
      const v = (1 - Math.pow(2 * s - 1, 2)) * bow + off;
      return [x + ca * u - sa * v, y + sa * u + ca * v];
    };
    const N = 22;
    const m = Math.max(2, Math.round(N * qs));
    const pass = (k: number, fill: string, alpha: number) => {
      ctx.beginPath();
      for (let i = 0; i <= m; i++) {
        const s = i / N;
        const w = Math.sin(Math.PI * (i / m)) * thick * k * (0.35 + 0.65 * s);
        const [px, py] = at(s, w);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      for (let i = m; i >= 0; i--) {
        const s = i / N;
        const w = Math.sin(Math.PI * (i / m)) * thick * k * 0.12;
        const [px, py] = at(s, -w);
        ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.globalAlpha = clamp(alpha * a * fade);
      ctx.fill();
    };
    pass(2.6, col, 0.28);
    pass(1.5, col, 0.55);
    pass(1, "#fff", 1);
    const [hx, hy] = at(qs, 0);
    if (q < 1) glow(hx, hy, thick * 3.2, col, 0.9);
  };
  const star = (x: number, y: number, r: number, col: string, a: number) => {
    glow(x, y, r * 0.9, col, a);
    ctx.globalAlpha = clamp(a * fade);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = Math.max(1, r * 0.06);
    ctx.beginPath();
    ctx.moveTo(x - r, y);
    ctx.lineTo(x + r, y);
    ctx.moveTo(x, y - r * 1.5);
    ctx.lineTo(x, y + r * 1.5);
    ctx.stroke();
  };

  /* заранее посчитанные случайности — чтобы форма не дрожала от кадра к кадру */
  const once: Record<string, boolean> = {};
  const hit = (k: string): boolean => (once[k] ? false : (once[k] = true));
  const seeds = pts.map(() => Array.from({ length: 12 }, () => Math.random() - 0.5));
  const shards = pts.map(() =>
    Array.from({ length: 5 }, (_, j) => ({ dx: (j - 2) * 0.2 + rnd(-0.06, 0.06), h: rnd(0.75, 1.15) * (j === 2 ? 1.75 : j % 2 ? 1.25 : 0.85), w: rnd(0.13, 0.2), lean: (j - 2) * 0.16 + rnd(-0.05, 0.05), dl: Math.abs(j - 2) * 0.022 })),
  );
  const cuts = pts.map(() => Array.from({ length: 3 }, (_, k) => ({ ang: rnd(-0.5, 0.5) + (k % 2 ? 2.1 : -0.9) + k * 0.7, bow: rnd(0.12, 0.3) * (k % 2 ? -1 : 1) })));
  let time = 0;

  /* ---------------------------------- стихии ---------------------------------- */

  const fire = (t: number, n: number) => {
    lighter();
    pts.forEach((p, i) => {
      const gy = ground(p);
      const tt = t - i * 0.035;
      if (tt > 0 && tt < 0.2) {
        ctx.save();
        ctx.translate(p.x, gy);
        ctx.scale(1, 0.3);
        ctx.strokeStyle = C2;
        ctx.lineWidth = 3;
        ctx.globalAlpha = clamp((1 - tt / 0.2) * fade);
        ctx.beginPath();
        ctx.arc(0, 0, U * (0.9 - tt * 2.6), 0, 6.283);
        ctx.stroke();
        ctx.restore();
        glow(p.x, gy, U * 0.5 * (tt / 0.2), C1, 0.7);
      }
      const k = env(tt, 0.14, 0.2, 0.6, 0.86);
      if (k > 0) {
        const hh = Math.max(gy + 40, U * 3);
        const layers: [number, string, number][] = [
          [0.7, C3, 0.6],
          [0.42, C1, 0.8],
          [0.17, C2, 1],
        ];
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, W, gy + U * 0.06);
        ctx.clip();
        layers.forEach(([w, col, a], j) => {
          const ww = U * w * k * (1 + 0.1 * Math.sin(time * 34 + j * 2 + i));
          ctx.globalAlpha = clamp(a * fade);
          ctx.drawImage(spr(col, j === 2), p.x - ww, gy - hh, ww * 2, hh * 2);
        });
        ctx.restore();
        glow(p.x, gy, U * 1.25 * k, C1, 0.85);
        glow(p.x, gy, U * 0.6 * k, C2, 0.9);
        for (let q = 0; q < n * 4 * k; q++) {
          const hot = Math.random();
          add({ x: p.x + rnd(-0.26, 0.26) * U, y: gy - rnd(0, 0.2) * U, vx: rnd(-50, 50), vy: -rnd(320, 900) * (U / 200), drag: 0.6, max: rnd(0.35, 0.8), s0: rnd(0.2, 0.42) * U, s1: 0.04 * U, col: hot > 0.7 ? C2 : hot > 0.25 ? C1 : C3, a: 0.55 });
        }
        if (Math.random() < 0.7 * n) add({ k: 1, x: p.x + rnd(-0.3, 0.3) * U, y: gy - rnd(0, U), vx: rnd(-120, 120), vy: -rnd(200, 620), g: -60, max: rnd(0.6, 1.2), s0: 2.2, col: C2 });
      }
      if (tt >= 0.16 && hit(`f${i}`)) {
        ring(p.x, gy, U * 0.2, U * 1.9, 0.5, C2, 0.32, 5);
        ring(p.x, gy, U * 0.1, U * 1.2, 0.36, C1, 0.32, 9);
        for (let q = 0; q < 26; q++) {
          const a = rnd(-2.7, -0.44);
          add({ k: 1, x: p.x, y: gy, vx: Math.cos(a) * rnd(200, 800), vy: Math.sin(a) * rnd(200, 800), g: 700, max: rnd(0.4, 0.9), s0: 2.6, col: C2 });
        }
      }
    });
  };

  const water = (t: number, n: number) => {
    lighter();
    const f = easeOut(t / 0.6);
    const xf = o.dir > 0 ? lerp(0.4 * W, 1.15 * W, f) : lerp(0.6 * W, -0.15 * W, f);
    const live = env(t, 0, 0.08, 0.5, 0.64);
    if (live > 0) {
      const crest = (y: number) => xf + Math.sin(y * 0.021 + time * 9) * U * 0.07 + o.dir * (0.25 - Math.pow(y / H - 0.5, 2)) * U * 1.1;
      /* тело волны за гребнем */
      const back = xf - o.dir * W * 0.42;
      const gr = ctx.createLinearGradient(xf, 0, back, 0);
      gr.addColorStop(0, rgba(C1, 0.5));
      gr.addColorStop(0.35, rgba(C3, 0.28));
      gr.addColorStop(1, rgba(C3, 0));
      ctx.globalAlpha = clamp(live * fade);
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.moveTo(back, -10);
      for (let y = -10; y <= H + 10; y += 18) ctx.lineTo(crest(y), y);
      ctx.lineTo(back, H + 10);
      ctx.closePath();
      ctx.fill();
      const stroke = (w: number, col: string, a: number, off: number) => {
        ctx.beginPath();
        for (let y = -10; y <= H + 10; y += 14) {
          const x = crest(y) - o.dir * off;
          if (y === -10) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = col;
        ctx.lineWidth = w;
        ctx.lineCap = "round";
        ctx.globalAlpha = clamp(a * live * fade);
        ctx.stroke();
      };
      stroke(U * 0.34, C1, 0.22, U * 0.08);
      stroke(U * 0.14, C2, 0.5, U * 0.03);
      stroke(U * 0.035, "#fff", 0.95, 0);
      stroke(U * 0.02, C2, 0.5, U * 0.2);
      for (let q = 0; q < n * 9; q++) {
        const y = rnd(0, H);
        add({ x: crest(y), y, vx: o.dir * rnd(120, 520), vy: -rnd(40, 380), g: 1100, max: rnd(0.35, 0.8), s0: rnd(0.05, 0.13) * U, s1: 0.01 * U, col: Math.random() > 0.5 ? C2 : C1, a: 0.9 });
      }
    }
    pts.forEach((p, i) => {
      const passed = o.dir > 0 ? xf > p.x : xf < p.x;
      const gy = ground(p);
      if (passed && hit(`w${i}`)) {
        ring(p.x, gy, U * 0.15, U * 1.5, 0.7, C2, 0.3, 4);
        ring(p.x, gy, U * 0.1, U * 1.0, 0.5, C1, 0.3, 7);
        ring(p.x, p.y, U * 0.1, U * 0.9, 0.4, "#ffffff", 1, 3);
        for (let q = 0; q < 46; q++) {
          const a = rnd(-2.5, -0.64);
          const sp = rnd(220, 900) * (U / 200);
          add({ x: p.x + rnd(-0.2, 0.2) * U, y: p.y + rnd(0, 0.3) * U, vx: Math.cos(a) * sp + o.dir * 120, vy: Math.sin(a) * sp, g: 1500, max: rnd(0.5, 1), s0: rnd(0.06, 0.16) * U, s1: 0.01 * U, col: Math.random() > 0.4 ? C2 : C1, a: 0.95 });
        }
        for (let q = 0; q < 8; q++) add({ k: 3, x: p.x + rnd(-0.4, 0.4) * U, y: p.y + rnd(-0.3, 0.3) * U, vx: o.dir * rnd(20, 90), vy: -rnd(10, 60), max: rnd(0.7, 1.2), s0: 0.3 * U, s1: 0.9 * U, col: C2, a: 0.16 });
        once[`ws${i}`] = true;
      }
      if (once[`ws${i}`]) glow(p.x, p.y, U * 0.9, C1, 0.5 * env(t, 0, 0.3, 0.6, 0.9));
    });
  };

  const wind = (t: number, n: number) => {
    lighter();
    for (let q = 0; q < n * 2.2 * env(t, 0, 0.05, 0.7, 0.9); q++) {
      add({ k: 1, x: o.dir > 0 ? rnd(-0.2, 0.4) * W : rnd(0.6, 1.2) * W, y: rnd(0, H), vx: o.dir * rnd(1500, 2600), vy: rnd(-60, 60), max: rnd(0.25, 0.5), s0: rnd(1, 2.4), col: Math.random() > 0.5 ? C2 : C1, a: rnd(0.25, 0.6) });
    }
    pts.forEach((p, i) => {
      cuts[i].forEach((c, k) => {
        const t0 = 0.07 + i * 0.045 + k * 0.12;
        const q = (t - t0) / 0.09;
        if (q <= 0) return;
        slash(p.x, p.y, c.ang, U * 1.75, U * c.bow, U * 0.075, q, C1);
        if (hit(`s${i}${k}`)) {
          for (let j = 0; j < 12; j++) {
            const a = c.ang + rnd(-0.35, 0.35) + (Math.random() > 0.5 ? Math.PI : 0);
            add({ k: 1, x: p.x + rnd(-0.3, 0.3) * U, y: p.y + rnd(-0.3, 0.3) * U, vx: Math.cos(a) * rnd(300, 1100), vy: Math.sin(a) * rnd(300, 1100), drag: 2, max: rnd(0.25, 0.55), s0: 2, col: C2 });
          }
          glow(p.x, p.y, U * 0.9, C2, 0.7);
        }
      });
      const tf = (t - 0.6) / 0.1;
      if (tf > 0 && hit(`wf${i}`)) {
        ring(p.x, p.y, U * 0.2, U * 1.5, 0.45, C2, 1, 4);
        for (let j = 0; j < 14; j++) {
          const a = rnd(0, 6.283);
          add({ x: p.x, y: p.y, vx: Math.cos(a) * rnd(100, 500), vy: Math.sin(a) * rnd(100, 500), drag: 2.4, max: rnd(0.4, 0.8), s0: rnd(0.05, 0.12) * U, s1: 0, col: C1, a: 0.8 });
        }
      }
    });
    /* финальный разрез через всех */
    const tf = (t - 0.58) / 0.1;
    if (tf > 0) {
      const xs = pts.map((p) => p.x);
      const span = Math.max(U * 2.4, Math.max(...xs) - Math.min(...xs) + U * 2.2);
      slash(cx, cy, o.dir > 0 ? -0.16 : Math.PI + 0.16, span, -U * 0.34, U * 0.14, tf, C1);
    }
  };

  const earth = (t: number, n: number) => {
    void n;
    pts.forEach((p, i) => {
      const gy = ground(p);
      const tt = t - i * 0.04;
      /* раскалённая трещина ползёт к цели */
      const ck = env(tt, 0, 0.16, 0.66, 0.9);
      if (tt > 0 && ck > 0) {
        lighter();
        bolt(p.x - o.dir * U * 2.3, gy + U * 0.1, p.x, gy, U * 0.3, C1, ck, 2.4, tt / 0.16, seeds[i]);
        bolt(p.x, gy, p.x + o.dir * U * 0.9, gy + U * 0.05, U * 0.2, C1, ck * clamp((tt - 0.16) / 0.06), 1.8, 1, seeds[i]);
        glow(p.x, gy, U * 0.8 * clamp(tt / 0.2), C1, 0.6 * ck);
      }
      const fall = clamp((tt - 0.7) / 0.24);
      shards[i].forEach((sh) => {
        const r = easeBack((tt - 0.19 - sh.dl) / 0.13);
        if (tt < 0.19 + sh.dl) return;
        const h = sh.h * U * r * (1 - fall * 0.5);
        const bx = p.x + sh.dx * U;
        const w = sh.w * U;
        const tipX = bx + sh.lean * h;
        const tipY = gy - h;
        const mid = bx + w * 0.22;
        over();
        ctx.globalAlpha = clamp((1 - fall) * fade);
        const gl = ctx.createLinearGradient(0, tipY, 0, gy);
        gl.addColorStop(0, "#fff0cc");
        gl.addColorStop(0.3, C2);
        gl.addColorStop(0.75, C1);
        gl.addColorStop(1, C3);
        ctx.fillStyle = gl;
        ctx.beginPath();
        ctx.moveTo(bx - w, gy);
        ctx.lineTo(lerp(bx - w, tipX, 0.5) - w * 0.22, lerp(gy, tipY, 0.5));
        ctx.lineTo(tipX, tipY);
        ctx.lineTo(mid, gy);
        ctx.closePath();
        ctx.fill();
        const gd = ctx.createLinearGradient(0, tipY, 0, gy);
        gd.addColorStop(0, "#8a5a26");
        gd.addColorStop(1, "#22140a");
        ctx.fillStyle = gd;
        ctx.beginPath();
        ctx.moveTo(mid, gy);
        ctx.lineTo(tipX, tipY);
        ctx.lineTo(lerp(tipX, bx + w, 0.55) + w * 0.14, lerp(tipY, gy, 0.55));
        ctx.lineTo(bx + w, gy);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(255,246,220,0.85)";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(lerp(bx - w, tipX, 0.5) - w * 0.22, lerp(gy, tipY, 0.5));
        ctx.lineTo(tipX, tipY);
        ctx.lineTo(mid, gy);
        ctx.stroke();
      });
      if (tt >= 0.19 && tt < 0.9) {
        lighter();
        glow(p.x, gy, U * 0.95, C1, 0.55 * (1 - fall));
        glow(p.x, gy, U * 0.4, C2, 0.7 * (1 - fall));
      }
      if (tt >= 0.2 && hit(`e${i}`)) {
        ring(p.x, gy, U * 0.2, U * 1.7, 0.5, C2, 0.3, 5);
        for (let q = 0; q < 20; q++) {
          const a = rnd(-2.6, -0.54);
          const sp = rnd(260, 900) * (U / 200);
          add({ k: 2, x: p.x + rnd(-0.4, 0.4) * U, y: gy - rnd(0, 0.3) * U, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 1700, max: rnd(0.6, 1.1), s0: rnd(0.03, 0.09) * U, col: Math.random() > 0.5 ? C1 : C3, rot: rnd(0, 6), vr: rnd(-9, 9) });
        }
        for (let q = 0; q < 12; q++) add({ k: 3, x: p.x + rnd(-0.6, 0.6) * U, y: gy - rnd(0, 0.2) * U, vx: rnd(-90, 90), vy: -rnd(20, 110), max: rnd(0.7, 1.3), s0: 0.25 * U, s1: 0.85 * U, col: "#b08a5a", a: 0.22 });
        for (let q = 0; q < 14; q++) add({ k: 1, x: p.x, y: gy, vx: rnd(-500, 500), vy: -rnd(200, 800), g: 900, max: rnd(0.3, 0.7), s0: 2.2, col: C2 });
      }
    });
  };

  const light = (t: number, n: number) => {
    lighter();
    pts.forEach((p, i) => {
      const gy = ground(p);
      const tt = t - i * 0.04;
      if (tt <= 0) return;
      const sy = Math.max(U * 0.18, p.y - U * 1.25);
      /* печать в небе */
      const sk = env(tt, 0, 0.12, 0.7, 0.92);
      if (sk > 0) {
        ctx.save();
        ctx.translate(p.x, sy);
        ctx.scale(1, 0.3);
        ctx.strokeStyle = C1;
        [0.62, 0.48].forEach((rr, j) => {
          ctx.globalAlpha = clamp(sk * (j ? 0.7 : 1) * fade);
          ctx.lineWidth = j ? 1.5 : 2.5;
          ctx.beginPath();
          ctx.arc(0, 0, U * rr * easeOut(tt / 0.14), 0, 6.283);
          ctx.stroke();
        });
        ctx.rotate(time * 1.6);
        ctx.lineWidth = 2;
        for (let j = 0; j < 12; j++) {
          ctx.rotate(Math.PI / 6);
          ctx.beginPath();
          ctx.moveTo(U * 0.5, 0);
          ctx.lineTo(U * 0.6, 0);
          ctx.stroke();
        }
        ctx.restore();
        glow(p.x, sy, U * 0.5 * sk, C1, 0.7);
      }
      const k = env(tt, 0.2, 0.25, 0.62, 0.9);
      if (k > 0) {
        const fl = 1 + 0.1 * Math.sin(time * 50 + i * 3);
        const band = (w: number, col: string, a: number) => {
          const ww = U * w * k * fl;
          const gx = ctx.createLinearGradient(p.x - ww, 0, p.x + ww, 0);
          gx.addColorStop(0, rgba(col, 0));
          gx.addColorStop(0.5, rgba(col, 1));
          gx.addColorStop(1, rgba(col, 0));
          ctx.globalAlpha = clamp(a * fade);
          ctx.fillStyle = gx;
          ctx.fillRect(p.x - ww, -4, ww * 2, gy + 4);
        };
        band(0.6, C3, 0.2);
        band(0.3, C1, 0.5);
        band(0.085, "#ffffff", 1);
        glow(p.x, gy, U * 1.1 * k, C1, 0.7);
        glow(p.x, gy, U * 0.45 * k, "#ffffff", 0.9);
        ctx.strokeStyle = "#fff";
        for (let j = 0; j < 11; j++) {
          const a = -Math.PI * (0.06 + (j / 10) * 0.88);
          const len = U * (0.7 + 0.8 * Math.abs(Math.sin(j * 7.3 + time * 9))) * k;
          ctx.globalAlpha = clamp(0.5 * k * fade);
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(p.x + Math.cos(a) * U * 0.2, gy + Math.sin(a) * U * 0.07);
          ctx.lineTo(p.x + Math.cos(a) * len, gy + Math.sin(a) * len * 0.5);
          ctx.stroke();
        }
        for (let q = 0; q < n * 2.4; q++) add({ k: 0, x: p.x + rnd(-0.5, 0.5) * U, y: gy - rnd(0, 0.5) * U, vx: rnd(-30, 30), vy: -rnd(120, 520), max: rnd(0.5, 1.1), s0: rnd(0.04, 0.1) * U, s1: 0, col: Math.random() > 0.5 ? C1 : "#ffffff", a: 0.95 });
      }
      if (tt >= 0.21 && hit(`l${i}`)) {
        ring(p.x, gy, U * 0.15, U * 2, 0.55, "#ffffff", 0.3, 5);
        ring(p.x, gy, U * 0.1, U * 1.3, 0.4, C1, 0.3, 9);
        ring(p.x, sy, U * 0.3, U * 1.1, 0.4, C1, 0.3, 3);
      }
      if (k > 0.5) [0.33, 0.66].forEach((s, j) => star(p.x + (j ? 0.38 : -0.42) * U, lerp(sy, gy, s) + Math.sin(time * 5 + j) * 8, U * 0.12 * (0.6 + 0.4 * Math.sin(time * 13 + j * 2 + i)), C1, 0.9 * k));
    });
  };

  const dark = (t: number, n: number) => {
    const R = U * 0.5;
    const grow = easeOut(t / 0.26);
    const coll = clamp((t - 0.54) / 0.07);
    const rc = R * grow * (1 - coll) * (1 + 0.05 * Math.sin(time * 22));
    lighter();
    if (t < 0.61) {
      glow(cx, cy, rc * 4.2, C3, 0.9, false);
      glow(cx, cy, rc * 2.6, C1, 0.75, false);
      for (let q = 0; q < n * 5; q++) {
        const a = rnd(0, 6.283);
        const rad = rnd(1.5, 3.4) * U;
        add({ k: 4, x: a, y: rad, vx: rnd(2.6, 5.2), vy: -rnd(1.1, 2.4) * U, max: 2, s0: rnd(1.4, 3), col: Math.random() > 0.6 ? C2 : C1, a: rnd(0.5, 1) });
      }
      pts.forEach((p, i) => {
        const a = env(t, 0.1 + i * 0.03, 0.18 + i * 0.03, 0.5, 0.58);
        if (a <= 0) return;
        bolt(cx, cy, p.x, p.y, U * 0.34, C1, a * (0.6 + 0.4 * Math.random()), 1.8);
        glow(p.x, p.y, U * 0.75, C1, 0.55 * a, false);
      });
      /* аккреционное кольцо */
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.35);
      ctx.scale(1, 0.34);
      ctx.strokeStyle = C1;
      ctx.lineWidth = rc * 0.5;
      ctx.globalAlpha = clamp(0.4 * fade);
      ctx.beginPath();
      ctx.arc(0, 0, rc * 2.1, 0, 6.283);
      ctx.stroke();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = rc * 0.1;
      ctx.globalAlpha = clamp(0.9 * fade);
      ctx.beginPath();
      ctx.arc(0, 0, rc * 2.0, 0, 6.283);
      ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = C2;
      ctx.lineWidth = Math.max(1.5, rc * 0.07);
      ctx.globalAlpha = clamp(fade);
      ctx.beginPath();
      ctx.arc(cx, cy, rc * 1.04, 0, 6.283);
      ctx.stroke();
      over();
      const gb = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, rc));
      gb.addColorStop(0, "#000");
      gb.addColorStop(0.82, "#05010f");
      gb.addColorStop(1, rgba(C3, 0.9));
      ctx.globalAlpha = clamp(fade);
      ctx.fillStyle = gb;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(0.5, rc), 0, 6.283);
      ctx.fill();
      lighter();
    }
    if (t >= 0.61 && hit("d")) {
      ring(cx, cy, U * 0.1, Math.max(W, H) * 0.75, 0.6, C2, 1, 6);
      ring(cx, cy, U * 0.1, U * 2.4, 0.45, "#ffffff", 1, 3);
      ring(cx, cy, U * 0.1, U * 3.4, 0.7, C1, 0.34, 10);
      for (let i = ps.length - 1; i >= 0; i--) if (ps[i].k === 4) ps.splice(i, 1);
      for (let q = 0; q < 80; q++) {
        const a = rnd(0, 6.283);
        const sp = rnd(300, 1500) * (U / 200);
        add({ k: 1, x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 1.6, max: rnd(0.4, 0.9), s0: rnd(1.6, 3.2), col: Math.random() > 0.5 ? C2 : C1 });
      }
      pts.forEach((p) => {
        for (let q = 0; q < 7; q++) add({ k: 3, x: p.x + rnd(-0.3, 0.3) * U, y: p.y + rnd(-0.4, 0.4) * U, vx: rnd(-40, 40), vy: -rnd(10, 70), max: rnd(0.6, 1.1), s0: 0.3 * U, s1: 0.8 * U, col: C3, a: 0.3 });
      });
    }
    if (t >= 0.61) {
      const q = (t - 0.61) / 0.07;
      glow(cx, cy, U * 2.6 * (1 - clamp(q / 3)), "#ffffff", 0.9 * (1 - clamp(q / 2.2)));
      pts.forEach((p, i) => {
        cuts[i].slice(0, 2).forEach((c, k) => slash(p.x, p.y, k ? 0.9 : -0.9, U * 1.5, U * c.bow * 0.6, U * 0.06, q - k * 0.5, C1));
        glow(p.x, p.y, U * 0.9, C1, 0.7 * (1 - clamp(q / 4)), false);
      });
    }
  };

  const aid = (t: number, n: number) => {
    lighter();
    pts.forEach((p, i) => {
      const gy = ground(p);
      const k = env(t - i * 0.05, 0.02, 0.2, 0.62, 0.95);
      if (k <= 0) return;
      const ww = U * 0.46;
      const gx = ctx.createLinearGradient(p.x - ww, 0, p.x + ww, 0);
      gx.addColorStop(0, rgba(C1, 0));
      gx.addColorStop(0.5, rgba(C1, 1));
      gx.addColorStop(1, rgba(C1, 0));
      ctx.fillStyle = gx;
      ctx.globalAlpha = clamp(0.3 * k * fade);
      ctx.fillRect(p.x - ww, gy - U * 1.5, ww * 2, U * 1.5);
      glow(p.x, gy, U * 0.9 * k, C1, 0.6);
      glow(p.x, p.y, U * 0.75 * k, C2, 0.35);
      if (Math.floor(time * 7) !== Math.floor((time - 0.016) * 7)) ring(p.x, gy, U * 0.42, U * 0.3, 0.9, C2, 0.3, 2, -U * 1.1);
      for (let q = 0; q < n * 1.3; q++) add({ x: p.x + rnd(-0.4, 0.4) * U, y: gy - rnd(0, 0.3) * U, vx: rnd(-14, 14), vy: -rnd(70, 300), max: rnd(0.6, 1.3), s0: rnd(0.03, 0.08) * U, s1: 0, col: Math.random() > 0.5 ? C2 : C1, a: 0.9 });
      if (hit(`a${i}`)) {
        ring(p.x, gy, U * 0.1, U * 1.1, 0.6, C2, 0.3, 3);
      }
      star(p.x - 0.36 * U, p.y - 0.2 * U + Math.sin(time * 4) * 6, U * 0.09 * k, C2, 0.8 * k);
      star(p.x + 0.34 * U, p.y + 0.16 * U + Math.cos(time * 5) * 6, U * 0.07 * k, C2, 0.7 * k);
    });
  };

  const scene = o.aid ? aid : o.el === "fire" ? fire : o.el === "water" ? water : o.el === "wind" ? wind : o.el === "earth" ? earth : o.el === "dark" ? dark : light;

  /* ----------------------------------- цикл ----------------------------------- */
  let raf = 0;
  let last = 0;
  let start = 0;
  let dead = false;
  const frame = (now: number) => {
    if (dead) return;
    if (!start) start = last = now;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    const t = (now - start) / o.dur;
    fade = t > 0.86 ? clamp((1 - t) / 0.14) : 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);
    if (t >= 1) {
      dead = true;
      return;
    }
    scene(t, dt * 60 * pw);

    /* кольца */
    lighter();
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.life += dt;
      const q = r.life / r.max;
      if (q >= 1) {
        rings.splice(i, 1);
        continue;
      }
      r.y += r.vy * dt;
      const rad = lerp(r.r0, r.r1, easeOut(q));
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.scale(1, r.sq);
      ctx.strokeStyle = r.col;
      ctx.globalAlpha = clamp((1 - q) * 0.4 * fade);
      ctx.lineWidth = r.w * 3.2 * (1 - q * 0.6);
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(0.5, rad), 0, 6.283);
      ctx.stroke();
      ctx.strokeStyle = "#fff";
      ctx.globalAlpha = clamp((1 - q) * 0.75 * fade);
      ctx.lineWidth = Math.max(0.6, r.w * 0.45 * (1 - q));
      ctx.stroke();
      ctx.restore();
    }
    /* частицы */
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life += dt;
      const q = p.life / p.max;
      if (q >= 1) {
        ps.splice(i, 1);
        continue;
      }
      if (p.k === 4) {
        /* орбита вокруг центра: x — угол, y — радиус */
        p.x += p.vx * dt * (1 + (U * 1.2) / Math.max(20, p.y));
        p.y += p.vy * dt;
        if (p.y < U * 0.3) {
          ps.splice(i, 1);
          continue;
        }
        const px = cx + Math.cos(p.x) * p.y;
        const py = cy + Math.sin(p.x) * p.y * 0.72;
        const tx = -Math.sin(p.x);
        const ty = Math.cos(p.x) * 0.72;
        const len = 10 + (U * 26) / p.y;
        ctx.strokeStyle = p.col;
        ctx.globalAlpha = clamp(p.a * Math.min(1, q * 8) * fade);
        ctx.lineWidth = p.s0;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px - tx * len, py - ty * len);
        ctx.stroke();
        continue;
      }
      p.vy += p.g * dt;
      if (p.drag) {
        const d = Math.max(0, 1 - p.drag * dt);
        p.vx *= d;
        p.vy *= d;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const al = p.a * (1 - q) * fade;
      if (p.k === 0) {
        const s = lerp(p.s0, p.s1, q);
        ctx.globalAlpha = clamp(al);
        ctx.drawImage(spr(p.col), p.x - s, p.y - s, s * 2, s * 2);
      } else if (p.k === 1) {
        const sp = Math.hypot(p.vx, p.vy) || 1;
        const len = Math.min(240, sp * 0.055) + 2;
        ctx.strokeStyle = p.col;
        ctx.globalAlpha = clamp(al);
        ctx.lineWidth = p.s0;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - (p.vx / sp) * len, p.y - (p.vy / sp) * len);
        ctx.stroke();
      } else if (p.k === 2) {
        over();
        p.rot += p.vr * dt;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = clamp(Math.min(1, (1 - q) * 3) * fade);
        ctx.fillStyle = p.col;
        ctx.beginPath();
        ctx.moveTo(-p.s0, -p.s0 * 0.4);
        ctx.lineTo(p.s0 * 0.3, -p.s0);
        ctx.lineTo(p.s0, p.s0 * 0.2);
        ctx.lineTo(-p.s0 * 0.2, p.s0 * 0.9);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        lighter();
      } else {
        over();
        const s = lerp(p.s0, p.s1, easeOut(q));
        ctx.globalAlpha = clamp(al);
        ctx.drawImage(spr(p.col, false), p.x - s, p.y - s, s * 2, s * 2);
        lighter();
      }
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => {
    dead = true;
    cancelAnimationFrame(raf);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
  };
}
