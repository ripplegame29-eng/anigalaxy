"use client";

import { useEffect, useRef } from "react";

const STREAK_COLORS = ["#8f7bff", "#1fb6ff", "#ff7ab6", "#ffffff", "#dbe7ff"];
const DURATION_MS = 1500;
const SESSION_KEY = "ag_warp_seen";

/**
 * Разовая «варп-вспышка» при входе на страницу: из центра разлетаются
 * полосы света — цитата разгона из наброска галактики `anigalaxy-galaxy-v6`.
 *
 * Играет один раз за сессию (sessionStorage), при reduced-motion и в фоновой
 * вкладке не играет вовсе. Слой изначально скрыт, включается из эффекта и
 * снова прячется по окончании — с React это не пересекается: у вспышки нет
 * состояния, только анимация на канвасе.
 */
export function WarpFlash() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;

    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // Приватный режим без хранилища: вспышка просто играет на визит.
    }

    if (document.hidden || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.classList.remove("hidden");

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const maxR = Math.hypot(window.innerWidth, window.innerHeight) * 0.6;
    const streaks = Array.from(
      { length: window.innerWidth < 760 ? 70 : 140 },
      () => ({
        dir: Math.random() * Math.PI * 2,
        delay: Math.random() * 0.22,
        width: 0.6 + Math.random() * 1.8,
        color: STREAK_COLORS[Math.floor(Math.random() * STREAK_COLORS.length)],
      }),
    );

    let raf = 0;
    const t0 = performance.now();

    const frame = (now: number) => {
      if (cancelled) return;
      const t = (now - t0) / DURATION_MS;
      if (t >= 1) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Слой снова пуст и прозрачен, но вернуть display:none дёшево и честно.
        canvas.classList.add("hidden");
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2.2; // чуть выше центра — по герою страницы
      const fade = 1 - Math.max(0, (t - 0.75) / 0.25);

      ctx.lineCap = "round";
      for (const s of streaks) {
        const lp = Math.min(1, Math.max(0, (t - s.delay) / 0.7));
        const alpha = Math.sin(lp * Math.PI) * fade;
        if (alpha <= 0.004) continue;

        const ease = 1 - Math.pow(1 - lp, 2.2);
        const r = ease * maxR;
        const tail = Math.min(maxR * 0.35, r * 0.5 + 40);
        const dx = Math.cos(s.dir);
        const dy = Math.sin(s.dir);

        ctx.globalAlpha = alpha * 0.75;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.width * (0.7 + ease);
        ctx.beginPath();
        ctx.moveTo(cx + dx * (r - tail), cy + dy * (r - tail));
        ctx.lineTo(cx + dx * r, cy + dy * r);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.classList.add("hidden");
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60] h-full w-full mix-blend-screen hidden"
    />
  );
}
