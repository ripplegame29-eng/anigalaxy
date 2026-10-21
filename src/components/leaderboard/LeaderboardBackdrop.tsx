"use client";

/**
 * Фон лидерборда — «арена чемпионов»: мягкие цветные свечения, внизу
 * светящийся пол уходит в перспективу, сверху изредка сыплется золотое,
 * серебряное и бронзовое конфетти, а курсор оставляет шлейф искр.
 * Анимации выключаются при `prefers-reduced-motion` и на скрытой вкладке.
 */

import { useEffect, useRef } from "react";
import "../../app/leaderboard-bg.css";

const METAL = [
  [44, 100, 62], // золото
  [210, 14, 82], // серебро
  [26, 70, 54], // бронза
  [268, 90, 70], // фиолет
  [190, 95, 62], // бирюза
];

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  s: number;
  rot: number;
  vr: number;
  sw: number;
  c: number;
  shape: 0 | 1 | 2;
}
interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  hue: number;
}

export function LeaderboardBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let w = 0;
    let h = 0;
    let raf = 0;
    let last = performance.now();
    const bits: Bit[] = [];
    const sparks: Spark[] = [];
    const mouse = { x: 0, y: 0, px: 0, py: 0, on: false };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const spawnBit = (anywhere: boolean): Bit => ({
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : -14,
      vx: (Math.random() - 0.5) * 14,
      vy: 16 + Math.random() * 34,
      s: 3 + Math.random() * 3,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 3,
      sw: Math.random() * Math.PI * 2,
      c: Math.random() < 0.5 ? 0 : Math.floor(Math.random() * METAL.length),
      shape: Math.floor(Math.random() * 3) as 0 | 1 | 2,
    });

    const draw = (dt: number) => {
      ctx.clearRect(0, 0, w, h);

      // конфетти
      for (let i = 0; i < bits.length; i++) {
        const b = bits[i];
        if (!reduce) {
          b.sw += dt * 2;
          b.x += (b.vx + Math.sin(b.sw) * 14) * dt;
          b.y += b.vy * dt;
          b.rot += b.vr * dt;
          if (b.y > h + 14) bits[i] = spawnBit(false);
        }
        const [hh, ss, ll] = METAL[b.c];
        const flip = Math.abs(Math.cos(b.rot * 1.3));
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rot);
        ctx.scale(1, 0.25 + flip * 0.75);
        ctx.fillStyle = `hsla(${hh} ${ss}% ${ll}% / ${(0.15 + flip * 0.25).toFixed(2)})`;
        if (b.shape === 0) ctx.fillRect(-b.s / 2, -b.s / 2, b.s, b.s * 0.6);
        else if (b.shape === 1) {
          ctx.beginPath();
          ctx.arc(0, 0, b.s * 0.42, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(0, -b.s * 0.6);
          ctx.lineTo(b.s * 0.45, 0);
          ctx.lineTo(0, b.s * 0.6);
          ctx.lineTo(-b.s * 0.45, 0);
          ctx.closePath();
        }
        if (b.shape === 2) ctx.fill();
        ctx.restore();
      }

      // шлейф искр за курсором
      if (mouse.on && !reduce) {
        const dist = Math.hypot(mouse.x - mouse.px, mouse.y - mouse.py);
        const n = Math.min(4, Math.ceil(dist / 14));
        for (let k = 0; k < n; k++) {
          sparks.push({
            x: mouse.x,
            y: mouse.y,
            vx: (Math.random() - 0.5) * 50,
            vy: (Math.random() - 0.7) * 50,
            life: 1,
            hue: 36 + Math.random() * 20,
          });
        }
        mouse.px = mouse.x;
        mouse.py = mouse.y;
      }
      ctx.globalCompositeOperation = "lighter";
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life -= dt * 1.4;
        if (s.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vy += 60 * dt;
        ctx.fillStyle = `hsla(${s.hue} 100% 66% / ${(s.life * 0.45).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 0.8 + s.life * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      draw(dt);
      raf = requestAnimationFrame(frame);
    };
    const onMove = (e: PointerEvent) => {
      if (!mouse.on) {
        mouse.px = e.clientX;
        mouse.py = e.clientY;
      }
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
    for (let i = 0; i < (w < 700 ? 8 : 18); i++) bits.push(spawnBit(true));
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
    <div className="lbg" aria-hidden>
      <i className="lbg-glow g1" />
      <i className="lbg-glow g2" />
      <i className="lbg-glow g3" />
      <i className="lbg-floor" />
      <canvas ref={ref} className="lbg-canvas" />
      <i className="lbg-vig" />
    </div>
  );
}
