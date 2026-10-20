"use client";

import { useEffect, useRef } from "react";

/**
 * Частицы профиля на канвасе.
 *
 * Порт механики из макета `profile-effects.html` без изменений в maths:
 * у каждого режима `make` создаёт частицу, `step` двигает её и возвращает
 * false, когда её пора пересоздать, `draw` рисует. Размер частиц и
 * длительность цикла приходят уровнем эффекта (I…III).
 *
 * Отличия от макета, и почему:
 *   • `Math.random` внутри эффекта — не в рендере, поэтому правилу
 *     react-hooks/purity не противоречит: фаза на кадре React не читается;
 *   • `prefers-reduced-motion` выключает цикл целиком, а не рисует один кадр;
 *   • канвас не рисуется, пока вкладка скрыта — на `visibilitychange`.
 */

type Draw = (p: Particle, ctx: CanvasRenderingContext2D) => void;
type Step = (p: Particle, dt: number) => boolean;

interface Particle {
  [key: string]: number;
}

interface Mode {
  count: number;
  make: (init: boolean) => Particle;
  step: Step;
  draw: Draw;
}

/** Множитель уровня: частиц втрое больше на III, как в макете */
const LEVEL_COUNT = { 1: 1, 2: 2, 3: 3 } as const;

export function ProfileFx({
  mode,
  level,
  enabled,
}: {
  /** mode из каталога: sakura / fireflies / embers / snow / meteors */
  mode: string | null;
  level: 1 | 2 | 3;
  enabled: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mode || !enabled) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Математика и рисование перенесены из макета дословно
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);

    const MODES: Record<string, Mode> = {
      sakura: {
        count: 14,
        make: (init) => ({
          x: rnd(0, W), y: init ? rnd(0, H) : rnd(-40, -10), s: rnd(5, 9),
          vy: rnd(28, 55), sway: rnd(0, 6.28), sp: rnd(0.8, 1.6),
          rot: rnd(0, 6.28), vr: rnd(-1.5, 1.5), a: rnd(0.6, 0.95),
        }),
        step(p, dt) {
          p.sway += p.sp * dt;
          p.x += Math.sin(p.sway) * 24 * dt + 12 * dt;
          p.y += p.vy * dt;
          p.rot += p.vr * dt;
          return p.y < H + 20 && p.x < W + 20;
        },
        draw(p, c) {
          c.save();
          c.translate(p.x, p.y);
          c.rotate(p.rot);
          c.globalAlpha = p.a;
          const s = p.s;
          const g = c.createLinearGradient(0, -s, 0, s);
          g.addColorStop(0, "#ffd6e6");
          g.addColorStop(1, "#ff8fb8");
          c.fillStyle = g;
          c.beginPath();
          c.moveTo(0, -s);
          c.bezierCurveTo(s, -s * 0.6, s * 0.8, s * 0.8, 0, s);
          c.bezierCurveTo(-s * 0.8, s * 0.8, -s, -s * 0.6, 0, -s);
          c.fill();
          c.restore();
        },
      },
      fireflies: {
        count: 12,
        make: () => ({
          x: rnd(0, W), y: rnd(0, H), a: rnd(0, 6.28), v: rnd(8, 20),
          ph: rnd(0, 6.28), r: rnd(2, 3.5),
        }),
        step(p, dt) {
          p.a += rnd(-1.5, 1.5) * dt;
          p.x += Math.cos(p.a) * p.v * dt;
          p.y += Math.sin(p.a) * p.v * dt;
          p.ph += 2 * dt;
          if (p.x < 0) p.x = W;
          if (p.x > W) p.x = 0;
          if (p.y < 0) p.y = H;
          if (p.y > H) p.y = 0;
          return true;
        },
        draw(p, c) {
          const o = (Math.sin(p.ph) + 1) / 2;
          const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5);
          g.addColorStop(0, `rgba(200,255,120,${0.9 * o})`);
          g.addColorStop(1, "rgba(200,255,120,0)");
          c.fillStyle = g;
          c.beginPath();
          c.arc(p.x, p.y, p.r * 5, 0, 6.28);
          c.fill();
        },
      },
      embers: {
        count: 20,
        make: (init) => ({
          x: rnd(0, W), y: init ? rnd(0, H) : H + 10, vy: rnd(25, 60),
          r: rnd(1, 2.6), ph: rnd(0, 6.28), life: rnd(0.5, 1),
        }),
        step(p, dt) {
          p.y -= p.vy * dt;
          p.ph += 3 * dt;
          p.x += Math.sin(p.ph) * 14 * dt;
          p.life -= 0.12 * dt;
          return p.life > 0 && p.y > -10;
        },
        draw(p, c) {
          c.globalAlpha = Math.max(p.life, 0);
          c.fillStyle = p.life > 0.5 ? "#ffb347" : "#ff6a2a";
          c.shadowColor = "#ff7a30";
          c.shadowBlur = 8;
          c.beginPath();
          c.arc(p.x, p.y, p.r, 0, 6.28);
          c.fill();
          c.shadowBlur = 0;
          c.globalAlpha = 1;
        },
      },
      snow: {
        count: 30,
        make: (init) => ({
          x: rnd(0, W), y: init ? rnd(0, H) : -6, r: rnd(1, 3),
          vy: rnd(15, 40), ph: rnd(0, 6.28),
        }),
        step(p, dt) {
          p.y += p.vy * dt;
          p.ph += dt;
          p.x += Math.sin(p.ph) * 10 * dt;
          return p.y < H + 6;
        },
        draw(p, c) {
          c.fillStyle = "rgba(255,255,255,.85)";
          c.beginPath();
          c.arc(p.x, p.y, p.r, 0, 6.28);
          c.fill();
        },
      },
      meteors: {
        count: 3,
        make: (init) => ({
          x: rnd(W * 0.3, W * 1.2), y: rnd(-60, H * 0.4), len: rnd(70, 130),
          v: rnd(380, 560), wait: init ? rnd(0, 3) : rnd(1, 4),
        }),
        step(p, dt) {
          if (p.wait > 0) {
            p.wait -= dt;
            return true;
          }
          p.x -= p.v * dt * 0.8;
          p.y += p.v * dt * 0.6;
          return p.y < H + 40 && p.x > -140;
        },
        draw(p, c) {
          if (p.wait > 0) return;
          const dx = p.len * 0.8;
          const dy = -p.len * 0.6;
          const g = c.createLinearGradient(p.x, p.y, p.x + dx, p.y + dy);
          g.addColorStop(0, "rgba(255,255,255,.95)");
          g.addColorStop(1, "rgba(120,180,255,0)");
          c.strokeStyle = g;
          c.lineWidth = 2;
          c.beginPath();
          c.moveTo(p.x, p.y);
          c.lineTo(p.x + dx, p.y + dy);
          c.stroke();
        },
      },
    };

    const spec = MODES[mode];
    if (!spec) return;

    let W = 0;
    let H = 0;
    let parts: Particle[] = [];
    let last = 0;
    let frame = 0;
    let paused = document.hidden;

    const resize = () => {
      const host = canvas.parentElement;
      if (!host) return;
      const rect = host.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      W = rect.width;
      H = rect.height;
      canvas.width = Math.max(1, Math.round(W * dpr));
      canvas.height = Math.max(1, Math.round(H * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const reset = () => {
      parts = [];
      for (let i = 0; i < spec.count * LEVEL_COUNT[level]; i++) parts.push(spec.make(true));
    };

    const tick = (t: number) => {
      frame = requestAnimationFrame(tick);
      if (paused) return;
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      ctx.clearRect(0, 0, W, H);
      parts = parts.map((p) => (spec.step(p, dt) ? p : spec.make(false)));
      for (const p of parts) spec.draw(p, ctx);
    };

    resize();
    reset();

    const observer = new ResizeObserver(() => {
      resize();
      reset();
    });
    if (canvas.parentElement) observer.observe(canvas.parentElement);

    // Рисуем только пока вкладка видима: в фоне цикл всё равно выедал бы
    // батарею, а картинки никто не видит
    const onVisibility = () => {
      paused = document.hidden;
      if (!paused) last = performance.now();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!reduced.matches) {
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [mode, level, enabled]);

  if (!mode || !enabled) return null;
  return <canvas ref={canvasRef} className="pfx-canvas" aria-hidden />;
}
