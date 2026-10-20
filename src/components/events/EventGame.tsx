"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  addLanterns,
  lanternMult,
  takeTry,
  trackLevel,
  yokaiStore,
} from "@/lib/event-yokai";
import { BURST_COLORS, burst, flyLanterns, setArenaTarget } from "@/lib/event-fx";

/**
 * Мини-игра «Лови ёкаев»: за 20 секунд ловить духов (+10) и обходить красные
 * маски (−5). Серия пойманных духов подряд поднимает множитель до ×3.
 *
 * Духи появляются каждые 420 мс и улетают вверх на 2,4–4 с — их десятки за
 * партию, поэтому они не React-узлы, а элементы, которые игра вешает в арену
 * сама и убирает по `animationend`. В состоянии React лежит только HUD.
 */

const SPIRIT_SVG = `<svg viewBox="0 0 64 64"><path d="M32 6c-12 0-20 9-20 21v28l7-5 6 6 7-6 7 6 6-6 7 5V27C52 15 44 6 32 6z" fill="#e9e2ff"/><circle cx="24" cy="26" r="4" fill="#2a1a55"/><circle cx="40" cy="26" r="4" fill="#2a1a55"/><path d="M26 38c3 3 9 3 12 0" stroke="#2a1a55" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`;

const MASK_SVG = `<svg viewBox="0 0 64 64"><path d="M10 14 20 22M54 14 44 22" stroke="#ff4f4f" stroke-width="5" stroke-linecap="round"/><circle cx="32" cy="36" r="22" fill="#d92b3a"/><path d="M20 30l8 4M44 30l-8 4" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M22 46l4-4 3 4 3-4 3 4 3-4 4 4" stroke="#fff" stroke-width="3" fill="none" stroke-linejoin="round"/></svg>`;

const ROUND = 20;
const SPAWN_MS = 420;

export function EventGame({
  premium,
  notify,
  onLevel,
}: {
  premium: boolean;
  notify: (message: string) => void;
  onLevel: (level: number) => void;
}) {
  const state = yokaiStore.useStore();
  const arenaRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const comboRef = useRef<HTMLDivElement>(null);
  const scoreRef = useRef(0);
  const leftRef = useRef(ROUND);
  const runningRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const streakRef = useRef(0);

  const [running, setRunning] = useState(false);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(ROUND);
  const [combo, setCombo] = useState("");
  const [summary, setSummary] = useState<{ title: string; text: string } | null>(null);

  /* Таймеры партии снимаются при размонтировании: иначе интервалы продолжат
     спамить духами в разобранную страницу */
  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) window.clearInterval(id);
    timersRef.current = [];
  }, []);
  useEffect(() => clearTimers, [clearTimers]);
  useEffect(() => {
    const arena = arenaRef.current;
    if (arena) setArenaTarget(arena);
    return () => setArenaTarget(null);
  }, []);

  const spawn = useCallback(() => {
    const arena = arenaRef.current;
    if (!arena || !runningRef.current) return;
    const bad = Math.random() < 0.25;
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "ev-sp";
    dot.style.cssText = `left:${Math.random() * (arena.clientWidth - 56)}px;top:${arena.clientHeight - 20}px;animation-duration:${2.4 + Math.random() * 1.6}s;--c:${bad ? "#ff3b3b" : "#b9a0ff"}`;
    dot.innerHTML = bad ? MASK_SVG : SPIRIT_SVG;
    dot.setAttribute("aria-label", bad ? "Красная маска" : "Дух");
    dot.addEventListener("animationend", () => dot.remove());
    arena.appendChild(dot);
  }, []);

  const finish = useCallback(() => {
    runningRef.current = false;
    clearTimers();
    document.querySelectorAll(".ev-sp").forEach((el) => el.remove());
    setRunning(false);

    const mult = lanternMult(premium);
    const reward = Math.min(90, Math.floor(scoreRef.current * 0.4)) * mult;
    setSummary({
      title: `Ты набрал ${scoreRef.current} очков`,
      text: reward
        ? `Награда: +${reward} фонариков${premium ? " (Premium ×2)" : ""}`
        : "Попробуй ещё, духи ждут",
    });
    if (!reward) return;
    const { added, levelUp } = addLanterns(reward);
    flyLanterns(added, null);
    notify(added > 0 ? `+${added} фонариков` : "Фонарики уже на максимуме");
    if (levelUp) onLevel(trackLevel(yokaiStore.get().lan));
  }, [clearTimers, notify, onLevel, premium]);

  const start = useCallback(() => {
    if (!takeTry()) {
      notify("Попытки на сегодня закончились");
      return;
    }
    streakRef.current = 0;
    runningRef.current = true;
    scoreRef.current = 0;
    leftRef.current = ROUND;
    setScore(0);
    setLeft(ROUND);
    setCombo("");
    setSummary(null);
    setRunning(true);
    comboRef.current?.classList.remove("ev-on");

    const bar = barRef.current;
    if (bar) {
      bar.style.transition = "none";
      bar.style.width = "100%";
      void bar.offsetWidth;
      bar.style.transition = `width ${ROUND}s linear`;
      bar.style.width = "0";
    }

    timersRef.current.push(window.setInterval(spawn, SPAWN_MS));
    timersRef.current.push(
      window.setInterval(() => {
        leftRef.current -= 1;
        setLeft(Math.max(0, leftRef.current));
        if (leftRef.current <= 0) finish();
      }, 1000),
    );
  }, [finish, notify, spawn]);

  /* Попадания идут через делегирование: духов в DOM десятки, вешать на каждый
     обработчик — дороже, чем один слушатель на арену */
  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>(".ev-sp");
      if (!target || !runningRef.current) return;
      const bad = target.getAttribute("aria-label") === "Красная маска";
      const arena = arenaRef.current;
      if (!arena) return;

      if (bad) {
        streakRef.current = 0;
        setCombo("");
        comboRef.current?.classList.remove("ev-on");
        arena.classList.remove("ev-bad");
        void arena.offsetWidth;
        arena.classList.add("ev-bad");
        window.setTimeout(() => arena.classList.remove("ev-bad"), 380);
        burst(event.clientX, event.clientY, 22, BURST_COLORS.BAD, 0.8);
      } else {
        streakRef.current += 1;
        const mult = 1 + Math.min(2, Math.floor(streakRef.current / 5));
        if (mult > 1) scoreRef.current += 10 * (mult - 1);
        burst(event.clientX, event.clientY, 16, BURST_COLORS.SPIRIT, 0.8);
        if (streakRef.current >= 3) {
          setCombo(`×${mult} · ${streakRef.current} подряд`);
          comboRef.current?.classList.add("ev-on");
        }
      }

      scoreRef.current = Math.max(0, scoreRef.current + (bad ? -5 : 10));
      setScore(scoreRef.current);
      const pop = document.createElement("div");
      pop.className = "ev-pop";
      pop.textContent = bad ? "−5" : "+10";
      pop.style.cssText = `left:${target.offsetLeft + 10}px;top:${target.offsetTop}px;color:${
        bad ? "#ff5c7c" : "#ffc861"
      }`;
      arena.appendChild(pop);
      window.setTimeout(() => pop.remove(), 800);
      target.classList.add("ev-hit");
      window.setTimeout(() => target.remove(), 300);
    },
    [],
  );

  const tries = state.tries;
  const msgHidden = running;

  /* Вне партии полоса времени пустая: макет сбрасывал её по мутации класса,
     здесь — по факту остановки */
  useEffect(() => {
    if (running) return;
    const bar = barRef.current;
    if (!bar) return;
    bar.style.transition = "none";
    bar.style.width = "0";
  }, [running]);

  return (
    <div className="ev-card ev-game">
      <div className="ev-gh">
        <div>
          <h2>Лови ёкаев</h2>
          <p className="ev-d" style={{ margin: 0 }}>
            20 секунд. Жми на духов, но обходи красные маски — они отнимают очки.
          </p>
        </div>
        <div className="ev-stats">
          <div className="ev-pill">
            <small>Очки</small>
            <span>{score}</span>
          </div>
          <div className="ev-pill">
            <small>Время</small>
            <span>{running ? left : ROUND}</span>
          </div>
          <div className="ev-pill">
            <small>Попытки</small>
            <span>{tries}</span>
          </div>
        </div>
      </div>

      <div className="ev-arena" ref={arenaRef} onPointerDown={onPointerDown}>
        <div className="ev-tbar" ref={barRef} />
        <div className="ev-combo" ref={comboRef}>
          {combo}
        </div>
        <div className={`ev-msg${msgHidden ? " ev-hide" : ""}`}>
          <div>
            <h2 style={{ fontSize: 22 }}>{summary?.title ?? "Готов?"}</h2>
            <p>
              {summary?.text ??
                "Три попытки в день. За каждого духа фонарики, чем больше очков, тем больше награда."}
            </p>
          </div>
          <div>
            <button type="button" className="ev-btn" onClick={start} disabled={tries < 1}>
              {tries > 0 ? "Начать охоту" : "До завтра"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}