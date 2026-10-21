"use client";

/**
 * Живой фон страницы уровней: сетка из квадратов, где вспыхивают клетки,
 * следящий за курсором свет, всплывающие искры, северное сияние и огромный
 * вращающийся циферблат. Всё ради глубины; анимации выключаются при
 * `prefers-reduced-motion` и на скрытой вкладке.
 */

import { useEffect, useRef } from "react";

const CELL = 48;
const HUES = [262, 215, 190, 42, 320];

interface Lit {
  cx: number;
  cy: number;
  t: number;
  dur: number;
  hue: number;
}
interface Ember {
  x: number;
  y: number;
  vy: number;
  vx: number;
  r: number;
  a: number;
  hue: number;
}

export function LevelsBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let last = performance.now();
    const mouse = { x: -999, y: -999, on: false };
    const lit: Lit[] = [];
    const embers: Ember[] = [];

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const spawnLit = () => {
      lit.push({
        cx: Math.floor(Math.random() * Math.ceil(w / CELL)),
        cy: Math.floor(Math.random() * Math.ceil(h / CELL)),
        t: 0,
        dur: 2.2 + Math.random() * 3.2,
        hue: HUES[Math.floor(Math.random() * HUES.length)],
      });
    };
    const spawnEmber = (anywhere: boolean): Ember => ({
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : h + 10,
      vy: 12 + Math.random() * 30,
      vx: (Math.random() - 0.5) * 10,
      r: 0.6 + Math.random() * 1.8,
      a: 0.25 + Math.random() * 0.6,
      hue: HUES[Math.floor(Math.random() * HUES.length)],
    });

    const draw = (dt: number) => {
      ctx.clearRect(0, 0, w, h);

      // вспыхивающие клетки
      if (!reduce && lit.length < 34 && Math.random() < dt * 9) spawnLit();
      for (let i = lit.length - 1; i >= 0; i--) {
        const c = lit[i];
        c.t += dt;
        if (c.t >= c.dur) {
          lit.splice(i, 1);
          continue;
        }
        const k = Math.sin((c.t / c.dur) * Math.PI);
        ctx.fillStyle = `hsla(${c.hue} 90% 62% / ${(0.02 + k * 0.17).toFixed(3)})`;
        ctx.fillRect(c.cx * CELL + 1, c.cy * CELL + 1, CELL - 1, CELL - 1);
        ctx.strokeStyle = `hsla(${c.hue} 95% 70% / ${(k * 0.35).toFixed(3)})`;
        ctx.strokeRect(c.cx * CELL + 1.5, c.cy * CELL + 1.5, CELL - 2, CELL - 2);
      }

      // свет вокруг курсора: клетки рядом подсвечиваются
      if (mouse.on) {
        const R = 190;
        const x0 = Math.max(0, Math.floor((mouse.x - R) / CELL));
        const x1 = Math.floor((mouse.x + R) / CELL);
        const y0 = Math.max(0, Math.floor((mouse.y - R) / CELL));
        const y1 = Math.floor((mouse.y + R) / CELL);
        for (let cy = y0; cy <= y1; cy++) {
          for (let cx = x0; cx <= x1; cx++) {
            const dx = cx * CELL + CELL / 2 - mouse.x;
            const dy = cy * CELL + CELL / 2 - mouse.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d > R) continue;
            const k = 1 - d / R;
            ctx.fillStyle = `hsla(${215 + k * 60} 95% 66% / ${(k * k * 0.22).toFixed(3)})`;
            ctx.fillRect(cx * CELL + 1, cy * CELL + 1, CELL - 1, CELL - 1);
          }
        }
        const g = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, R * 1.4);
        g.addColorStop(0, "rgba(120,140,255,.10)");
        g.addColorStop(1, "rgba(120,140,255,0)");
        ctx.fillStyle = g;
        ctx.fillRect(mouse.x - R * 1.4, mouse.y - R * 1.4, R * 2.8, R * 2.8);
      }

      // искры
      for (let i = 0; i < embers.length; i++) {
        const e = embers[i];
        if (!reduce) {
          e.y -= e.vy * dt;
          e.x += e.vx * dt;
          if (e.y < -10) embers[i] = spawnEmber(false);
        }
        ctx.fillStyle = `hsla(${e.hue} 100% 75% / ${e.a})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      draw(dt);
      raf = requestAnimationFrame(frame);
    };

    const onMove = (e: PointerEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.on = e.pointerType !== "touch";
    };
    const onLeave = () => {
      mouse.on = false;
    };
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduce) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };

    resize();
    for (let i = 0; i < (w < 700 ? 28 : 70); i++) embers.push(spawnEmber(true));
    for (let i = 0; i < 10; i++) spawnLit();
    if (reduce) draw(0.016);
    else raf = requestAnimationFrame(frame);

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <div className="lv-bg" aria-hidden>
      <i className="lv-aur a1" />
      <i className="lv-aur a2" />
      <i className="lv-aur a3" />
      <i className="lv-gridfx" />
      <svg className="lv-dial" viewBox="0 0 600 600">
        <g fill="none" stroke="currentColor">
          <circle cx="300" cy="300" r="290" strokeOpacity=".5" />
          <circle cx="300" cy="300" r="250" strokeOpacity=".3" strokeDasharray="2 9" />
          <circle cx="300" cy="300" r="205" strokeOpacity=".4" />
          <circle cx="300" cy="300" r="150" strokeOpacity=".25" strokeDasharray="30 12" />
          {Array.from({ length: 60 }).map((_, i) => (
            <line key={i} x1="300" y1="14" x2="300" y2={i % 5 === 0 ? 38 : 26} transform={`rotate(${i * 6} 300 300)`} strokeOpacity={i % 5 === 0 ? 0.7 : 0.3} />
          ))}
        </g>
      </svg>
      <span className="lv-num n1">100</span>
      <span className="lv-num n2">XP</span>
      <span className="lv-num n3">Ⅶ</span>
      <canvas ref={ref} className="lv-canvas" />
      <i className="lv-vig" />
    </div>
  );
}
