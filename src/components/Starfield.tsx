"use client";

import { useEffect, useRef } from "react";

/**
 * Лёгкое звёздное поле — «запчасть» из наброска галактики.
 *
 * Обычный 2D-canvas без WebGL: мерцающие звёзды, медленный дрейф и,
 * по желанию, редкие кометы-штрихи. Дешевле полноценного полёта на
 * два порядка, поэтому его можно постелить под контент обычных страниц
 * (404, hero), не боясь за батарейку слабых устройств.
 *
 * Позиционирование задаёт родитель через className (absolute/fixed) —
 * сам canvas растягивается на родителя, фон прозрачный.
 */

/** Палитра звёзд: белый с редкими холодными и тёплыми акцентами. */
const PALETTE = [
  "#ffffff",
  "#ffffff",
  "#dbe7ff",
  "#9bc8ff",
  "#c4b8ff",
  "#ffe9c4",
  "#ffb8dc",
];

/** Туманности: цвет и базовый радиус в долях меньшей стороны. */
const NEBULAE: { x: number; y: number; r: number; color: string }[] = [
  { x: 0.16, y: 0.24, r: 0.9, color: "23, 140, 255" },
  { x: 0.78, y: 0.68, r: 1.1, color: "124, 58, 237" },
  { x: 0.6, y: 0.16, r: 0.7, color: "255, 122, 182" },
];

interface Star {
  /** Доли ширины/высоты — при resize раскладка сохраняется. */
  fx: number;
  fy: number;
  r: number;
  color: string;
  /** Базовая яркость и фаза мерцания. */
  a: number;
  tw: number;
  phase: number;
  /** Дрейф, px/сек, в экранных пикселях. */
  vx: number;
  vy: number;
}

interface Comet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
}

type StarfieldProps = {
  className?: string;
  /** Множитель плотности: 1 — норма, 0.5 — вдвое реже. */
  density?: number;
  /** Редкие кометы-штрихи, как в наброске галактики. */
  comets?: boolean;
  /** Мягкие цветные пятна-туманности под звёздами. */
  nebula?: boolean;
};

export function Starfield({
  className,
  density = 1,
  comets = false,
  nebula = false,
}: StarfieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced = Boolean(
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    );
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let stars: Star[] = [];
    const cometPool: Comet[] = [];
    let raf = 0;
    let last = 0;

    /* Детерминированного ГСЧ хватает: раскладка не обязана совпадать
     * между загрузками, лишь бы не мигала в пределах визита. */
    const rand = Math.random;

    const build = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.min(
        240,
        Math.max(28, Math.round(((w * h) / 11000) * density)),
      );
      stars = Array.from({ length: count }, () => {
        const depth = rand(); // дальние — мельче и тусклее
        return {
          fx: rand(),
          fy: rand(),
          r: 0.5 + depth * 1.6 + (rand() < 0.05 ? 1.2 : 0),
          color: PALETTE[Math.floor(rand() * PALETTE.length)],
          a: 0.35 + depth * 0.55,
          tw: 0.4 + rand() * 1.8,
          phase: rand() * Math.PI * 2,
          vx: (rand() - 0.5) * 4,
          vy: (rand() - 0.5) * 2.4,
        };
      });
    };

    const spawnComet = () => {
      const fromTop = rand() < 0.75;
      const speed = 380 + rand() * 420;
      const angle = (fromTop ? 0.55 : 0.95) + (rand() - 0.5) * 0.25;
      const dirX = rand() < 0.5 ? -1 : 1;
      cometPool.push({
        x: w * (0.1 + rand() * 0.8),
        y: fromTop ? -20 : h * (rand() * 0.4),
        vx: Math.cos(angle) * speed * dirX,
        vy: Math.sin(angle > 1 ? 2 - angle : angle) * speed,
        life: 0,
        max: 1.1 + rand() * 0.7,
      });
    };

    const drawNebula = (time: number, staticFrame: boolean) => {
      const m = Math.min(w, h);
      for (const n of NEBULAE) {
        const pulse = staticFrame ? 1 : 1 + Math.sin(time * 0.00022 + n.x * 9) * 0.1;
        const r = n.r * m * 0.5 * pulse;
        const g = ctx.createRadialGradient(n.x * w, n.y * h, 0, n.x * w, n.y * h, r);
        g.addColorStop(0, `rgba(${n.color}, 0.10)`);
        g.addColorStop(1, `rgba(${n.color}, 0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
    };

    /* Один кадр: staticFrame — стартовая раскладка без анимации. */
    const paint = (time: number, dt: number, staticFrame: boolean) => {
      ctx.clearRect(0, 0, w, h);
      if (nebula) drawNebula(time, staticFrame);

      for (const s of stars) {
        if (!staticFrame) {
          s.fx += (s.vx * dt) / w;
          s.fy += (s.vy * dt) / h;
          // Смещения в пределах кадра: звёзды не «уплывают».
          if (s.fx > 1.02) s.fx -= 1.04;
          if (s.fx < -0.02) s.fx += 1.04;
          if (s.fy > 1.02) s.fy -= 1.04;
          if (s.fy < -0.02) s.fy += 1.04;
        }
        const x = s.fx * w;
        const y = s.fy * h;
        const twinkle = staticFrame
          ? 1
          : 0.72 + 0.28 * Math.sin(time * 0.001 * s.tw + s.phase);
        ctx.globalAlpha = Math.min(1, s.a * twinkle);
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (comets && !staticFrame) {
        for (let i = cometPool.length - 1; i >= 0; i -= 1) {
          const c = cometPool[i];
          c.life += dt;
          if (c.life > c.max) {
            cometPool.splice(i, 1);
            continue;
          }
          c.x += c.vx * dt;
          c.y += c.vy * dt;
          const fade = Math.sin((c.life / c.max) * Math.PI);
          const speed = Math.hypot(c.vx, c.vy) || 1;
          const tx = c.x - (c.vx / speed) * 170;
          const ty = c.y - (c.vy / speed) * 170;
          const grad = ctx.createLinearGradient(c.x, c.y, tx, ty);
          grad.addColorStop(0, `rgba(255, 255, 255, ${0.85 * fade})`);
          grad.addColorStop(0.3, `rgba(155, 200, 255, ${0.4 * fade})`);
          grad.addColorStop(1, "rgba(155, 200, 255, 0)");
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.8;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(c.x, c.y);
          ctx.lineTo(tx, ty);
          ctx.stroke();
        }
        // Не чаще раза в ~12 секунд, максимум одна в кадре.
        if (cometPool.length === 0 && rand() < dt * 0.085) spawnComet();
      }
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      paint(now, dt, false);
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      cancelAnimationFrame(raf);
      last = performance.now();
      if (reduced) {
        paint(last, 0, true); // одна статичная раскладка без анимации
      } else {
        raf = requestAnimationFrame(frame);
      }
    };

    const onVisibility = () => {
      // В фоновой вкладке анимация не нужна; вернулись — сбросили dt.
      if (document.hidden) cancelAnimationFrame(raf);
      else start();
    };

    build();
    start();
    const ro = new ResizeObserver(() => {
      build();
      if (reduced) paint(performance.now(), 0, true);
    });
    ro.observe(canvas);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [density, comets, nebula]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden
      style={{ pointerEvents: "none" }}
    />
  );
}
