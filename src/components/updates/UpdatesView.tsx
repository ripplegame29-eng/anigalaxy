"use client";

/**
 * «Обновления» (`/updates`) — публичный роадмап проекта.
 *
 * Разметка, стили (`app/updates.css`) и поведение взяты из макета
 * `roadmap (1).html`: герой с кольцом готовности, счётчики, обратный отсчёт до
 * следующего патча, рейка патчей, фильтры, поиск, таймлайн патчей с голосами и
 * уведомлениями, «закрытая лаборатория» и форма идеи.
 *
 * Данные — из `lib/roadmap` (план проекта, перенесён из макета). Голоса,
 * отметки «сообщить о выходе», открытые патчи и тема живут в localStorage:
 * сервера у проекта нет, поэтому голос учитывается только в этом браузере —
 * об этом сказано в подписи под таймлайном.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import "../../app/updates.css";
import {
  CATEGORIES,
  CATEGORY_ICONS,
  FEATURES,
  ICONS,
  ICON_COLORS,
  LAB,
  PATCHES,
  PROGRESS,
  SHIPPED,
  THEME_NAMES,
  THEMES,
  featureProgress,
  formatDate,
  formatQuarter,
  patchProgress,
  plural,
  type RoadmapFeature,
  type RoadmapIcon,
} from "@/lib/roadmap";

/* ------------------------------- Хранилище ------------------------------- */

const KEYS = {
  votes: "animehub:roadmap:votes:v1",
  notify: "animehub:roadmap:notify:v1",
  open: "animehub:roadmap:open:v1",
  lab: "animehub:roadmap:lab:v1",
  theme: "animehub:roadmap:theme:v1",
} as const;

const CHANGE = "animehub:roadmap-changed";

function readStrings(key: string, fallback: string[]): string[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : fallback;
  } catch {
    return fallback;
  }
}

function readNumbers(key: string, fallback: number[]): number[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is number => typeof item === "number")
      : fallback;
  } catch {
    return fallback;
  }
}

function writeValue(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event(CHANGE));
  } catch {
    /* приватный режим: выбор просто не переживёт перезагрузку */
  }
}

const DEFAULT_OPEN = PATCHES[0].id;

/* --------------------------------- Иконки -------------------------------- */

function Icon({ name, className }: { name: RoadmapIcon; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
      dangerouslySetInnerHTML={{ __html: ICONS[name] ?? ICONS.star }}
    />
  );
}

const CHECK = (
  <svg className="rm-ck" viewBox="0 0 24 24" aria-hidden>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M7.5 12.5l3 3 6-7" pathLength="1" />
  </svg>
);

/** Плитка-«самоцвет» с анимацией по типу иконки */
function Gem({
  name,
  size = "md",
  color,
  achievement,
  delay = 0,
}: {
  name: RoadmapIcon;
  size?: "sm" | "md" | "lg";
  color?: string;
  achievement?: boolean;
  delay?: number;
}) {
  const [g1, g2] = ICON_COLORS[name] ?? ICON_COLORS.star;
  return (
    <span
      className={`rm-gem rm-${size}${achievement ? " rm-ach" : ""}`}
      data-ic={name}
      style={
        {
          "--g1": color ?? g1,
          "--g2": color ? color : g2,
          "--d": `${delay}s`,
        } as React.CSSProperties
      }
    >
      <Icon name={name} />
      {achievement && (
        <>
          <i className="rm-sp" style={{ left: "15%", top: "17%" }} />
          <i className="rm-sp" style={{ right: "13%", bottom: "19%", animationDelay: "-1s" }} />
          <i
            className="rm-sp"
            style={{ right: "22%", top: "12%", width: 3, height: 3, animationDelay: "-.5s" }}
          />
        </>
      )}
    </span>
  );
}

/* --------------------------------- Страница ------------------------------ */

const RING = 326.7;

export function UpdatesView() {
  /* Хранилище: всё, что пользователь нажимает, живёт в этом браузере */
  const [votes, setVotes] = useState<string[]>([]);
  const [notify, setNotify] = useState<string[]>([]);
  const [opened, setOpened] = useState<string[]>([DEFAULT_OPEN]);
  const [labKeys, setLabKeys] = useState<number[]>([0]);
  const [theme, setTheme] = useState("galaxy");

  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [idea, setIdea] = useState("");

  const [percent, setPercent] = useState(0);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  const timelineRef = useRef<HTMLDivElement | null>(null);
  const starsRef = useRef<HTMLCanvasElement | null>(null);
  const heroRef = useRef<HTMLElement | null>(null);
  const toastTimer = useRef(0);
  const mounted = useRef(false);

  /* ------------------------------ Чтение ключей ---------------------------- */
  useEffect(() => {
    const sync = () => {
      setVotes(readStrings(KEYS.votes, []));
      setNotify(readStrings(KEYS.notify, []));
      setOpened(readStrings(KEYS.open, [DEFAULT_OPEN]));
      setLabKeys(readNumbers(KEYS.lab, [0]));
      setTheme(readStrings(KEYS.theme, ["galaxy"])[0] ?? "galaxy");
    };
    sync();
    window.addEventListener(CHANGE, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  /* --------------------------- Кольцо и обратный отсчёт --------------------- */
  const ready = Math.round((PROGRESS.done / PROGRESS.total) * 100);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    const start = performance.now() + 300;
    const duration = 1900;
    const step = (now: number) => {
      const k = Math.max(0, Math.min(1, (now - start) / duration));
      const p = (ready / 100) * (1 - Math.pow(1 - k, 4));
      setPercent(Math.round(p * 100));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [ready]);

  useEffect(() => {
    const target = new Date(PATCHES[0].eta).getTime();
    const tick = () => {
      const ms = Math.max(0, target - Date.now());
      setCountdown({
        days: Math.floor(ms / 86_400_000),
        hours: Math.floor(ms / 3_600_000) % 24,
        minutes: Math.floor(ms / 60_000) % 60,
        seconds: Math.floor(ms / 1000) % 60,
      });
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  /* -------------------------------- Звёзды -------------------------------- */
  useEffect(() => {
    const canvas = starsRef.current;
    const hero = heroRef.current;
    if (!canvas || !hero) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let stars: { x: number; y: number; z: number; r: number; s: number; p: number; c: string }[] = [];
    let shooters: { x: number; y: number; vx: number; vy: number; l: number }[] = [];
    let mx = 0;
    let my = 0;
    let tx = 0;
    let ty = 0;
    let frame = 0;

    const resize = () => {
      const box = canvas.getBoundingClientRect();
      width = box.width;
      height = box.height;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = Array.from({ length: Math.round((width * height) / 5500) }, () => {
        const z = Math.random();
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          z,
          r: 0.3 + z * 1.3,
          s: 0.02 + z * 0.12,
          p: Math.random() * 6,
          c:
            Math.random() < 0.15
              ? Math.random() < 0.5
                ? "#9fe9ff"
                : "#c9b0ff"
              : "#fff",
        };
      });
    };

    const shoot = () => {
      shooters.push({
        x: Math.random() * width * 0.8,
        y: Math.random() * height * 0.35,
        vx: 7 + Math.random() * 4,
        vy: 3 + Math.random() * 2,
        l: 1,
      });
      window.setTimeout(shoot, 3500 + Math.random() * 4500);
    };

    const onMove = (event: PointerEvent) => {
      const box = hero.getBoundingClientRect();
      tx = (event.clientX - box.left) / box.width - 0.5;
      ty = (event.clientY - box.top) / box.height - 0.5;
    };
    const onLeave = () => {
      tx = 0;
      ty = 0;
    };

    const draw = (time: number) => {
      ctx.clearRect(0, 0, width, height);
      mx += (tx - mx) * 0.05;
      my += (ty - my) * 0.05;
      for (const star of stars) {
        if (!reduce) {
          star.y -= star.s;
          if (star.y < -2) star.y = height + 2;
        }
        ctx.globalAlpha = reduce ? 0.7 : 0.35 + 0.65 * Math.abs(Math.sin(time / (700 + star.p * 180) + star.p));
        ctx.fillStyle = star.c;
        ctx.beginPath();
        ctx.arc(star.x - mx * star.z * 28, star.y - my * star.z * 18, star.r, 0, 7);
        ctx.fill();
      }
      for (const shot of shooters) {
        shot.x += shot.vx;
        shot.y += shot.vy;
        shot.l -= 0.014;
        const gradient = ctx.createLinearGradient(shot.x, shot.y, shot.x - shot.vx * 9, shot.y - shot.vy * 9);
        gradient.addColorStop(0, `rgba(255,255,255,${Math.max(0, shot.l)})`);
        gradient.addColorStop(1, "rgba(255,255,255,0)");
        ctx.globalAlpha = 1;
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(shot.x, shot.y);
        ctx.lineTo(shot.x - shot.vx * 9, shot.y - shot.vy * 9);
        ctx.stroke();
      }
      shooters = shooters.filter((shot) => shot.l > 0);
      frame = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    hero.addEventListener("pointermove", onMove);
    hero.addEventListener("pointerleave", onLeave);
    if (!reduce) window.setTimeout(shoot, 2200);
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      hero.removeEventListener("pointermove", onMove);
      hero.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  /* --------------------------------- Тост --------------------------------- */
  const say = useCallback((text: string) => {
    setToast(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2300);
  }, []);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  /* -------------------------------- Фильтры ------------------------------- */
  const q = query.trim().toLowerCase();
  const filtering = status !== "all" || category !== "all" || Boolean(q);

  const match = useCallback(
    (feature: RoadmapFeature) => {
      if (status !== "all" && feature.status !== status) return false;
      if (category !== "all" && feature.category !== category) return false;
      if (q && !`${feature.title} ${feature.text}`.toLowerCase().includes(q)) return false;
      return true;
    },
    [status, category, q],
  );

  const byPatch = useMemo(
    () =>
      PATCHES.map((patch) => ({
        patch,
        features: patch.features
          .map((feature, index) => ({ ...feature, id: `${patch.id}.${index}` }))
          .filter(match),
      })).filter((group) => group.features.length > 0),
    [match],
  );

  /* --------------------------------- Действия ------------------------------ */

  const toggleVote = (feature: RoadmapFeature) => {
    const on = votes.includes(feature.id);
    writeValue(KEYS.votes, on ? votes.filter((id) => id !== feature.id) : [...votes, feature.id]);
    if (!on) say("Голос учтён — спасибо!");
  };

  const toggleNotify = (id: string) => {
    const on = notify.includes(id);
    writeValue(KEYS.notify, on ? notify.filter((item) => item !== id) : [...notify, id]);
    say(on ? "Отметка снята" : "Отметка сохранена в этом браузере");
  };

  const toggleOpen = (id: string) => {
    writeValue(
      KEYS.open,
      opened.includes(id) ? opened.filter((item) => item !== id) : [...opened, id],
    );
  };

  const resetFilters = () => {
    setStatus("all");
    setCategory("all");
    setQuery("");
  };

  const goToPatch = (id: string) => {
    if (!opened.includes(id)) writeValue(KEYS.open, [...opened, id]);
    resetFilters();
    timelineRef.current
      ?.querySelector<HTMLElement>(`[data-patch="${id}"]`)
      ?.scrollIntoView({ behavior: "smooth" });
  };

  const sendIdea = () => {
    const text = idea.trim();
    if (!text) {
      say("Напишите вашу идею");
      return;
    }
    setIdea("");
    say("Идея сохранена в этом браузере — отправьте её нам в Telegram");
  };

  /* Подсветка активного патча в рейке при прокрутке */
  const [activePatch, setActivePatch] = useState(DEFAULT_OPEN);
  useEffect(() => {
    const onScroll = () => {
      let current: string | null = null;
      for (const patch of PATCHES) {
        const node = timelineRef.current?.querySelector<HTMLElement>(`[data-patch="${patch.id}"]`);
        if (node && node.getBoundingClientRect().top < 220) current = patch.id;
      }
      if (current) setActivePatch(current);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const accent = THEMES[theme] ?? THEMES.galaxy;

  return (
    <div className="rm-root" data-theme={theme} style={{ "--blue": accent.blue, "--violet": accent.violet, "--cyan": accent.cyan } as React.CSSProperties}>
      <div className="rm-bgfx" aria-hidden>
        <i className="rm-aur a1" />
        <i className="rm-aur a2" />
        <i className="rm-aur a3" />
        <i className="rm-stars s1" />
        <i className="rm-stars s2" />
        <i className="rm-gridfx" />
        <div className="rm-orbits">
          <i className="o o1"><b /></i>
          <i className="o o2"><b /></i>
          <i className="o o3"><b /></i>
          <i className="o o4"><b /></i>
          <i className="rm-core" />
        </div>
        <i className="rm-horizon" />
        <i className="rm-vig" />
      </div>
      <div className="rm-wrap">
        {/* ------------------------------ Герой ----------------------------- */}
        <section className="rm-hero" ref={heroRef}>
          <div className="rm-beam" />
          <span className="rm-corner c1" />
          <span className="rm-corner c2" />
          <span className="rm-corner c3" />
          <span className="rm-corner c4" />
          <canvas className="rm-stars" ref={starsRef} aria-hidden />
          <div className="rm-grain" />

          <span className="rm-eyebrow">
            <i />
            ПУБЛИЧНЫЙ РОАДМАП
          </span>
          <h1>
            <span className="rm-l1">Куда летит</span>
            <br />
            <span className="rm-g">AniGalaxy</span>
          </h1>
          <p className="rm-sub">
            Открытый план развития платформы: что уже работает, что делаем прямо сейчас и что
            запустим дальше. Голосуйте за функции, которые нужны именно вам.
          </p>

          <div className="rm-hg">
            <div className="rm-ring">
              <i className="rm-halo" />
              <svg width="170" height="170" viewBox="0 0 120 120" aria-hidden>
                <defs>
                  <linearGradient id="rm-ring-gradient" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="var(--cyan)" />
                    <stop offset="1" stopColor="var(--violet)" />
                  </linearGradient>
                </defs>
                <circle className="rm-tk" cx="60" cy="60" r="58.5" fill="none" strokeWidth="2" />
                <circle className="rm-tr" cx="60" cy="60" r="52" fill="none" strokeWidth="9" />
                <circle
                  className="rm-pg"
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  strokeWidth="9"
                  strokeDasharray={RING}
                  strokeDashoffset={RING * (1 - percent / 100)}
                />
                <circle
                  className="rm-hd"
                  cx={60 + 52 * Math.cos((percent / 100) * Math.PI * 2)}
                  cy={60 + 52 * Math.sin((percent / 100) * Math.PI * 2)}
                  r="3.6"
                />
              </svg>
              <div className="rm-c">
                <b>{percent}%</b>
                <small>ГОТОВО</small>
              </div>
            </div>

            <div className="rm-rs">
              <div className="rm-st3">
                <div className="rm-sc rm-g">
                  <b>{PROGRESS.done}</b>
                  <small>Готово</small>
                </div>
                <div className="rm-sc rm-c">
                  <b>{PROGRESS.wip}</b>
                  <small>В разработке</small>
                </div>
                <div className="rm-sc rm-y">
                  <b>{PROGRESS.plan}</b>
                  <small>В планах</small>
                </div>
              </div>
              <div className="rm-cd">
                <small>
                  До выхода
                  <br />
                  следующего патча
                </small>
                <div className="rm-cdn">
                  {(
                    [
                      [countdown.days, "ДНЕЙ"],
                      [countdown.hours, "ЧАС"],
                      [countdown.minutes, "МИН"],
                      [countdown.seconds, "СЕК"],
                    ] as const
                  ).map(([value, label]) => (
                    <div key={label}>
                      <b className="rm-fl">{String(value).padStart(2, "0")}</b>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------- Рейка ----------------------------- */}
        <div className="rm-rail">
          <div className="rm-in">
            {PATCHES.map((patch) => (
              <button
                key={patch.id}
                type="button"
                className={`rm-rl${activePatch === patch.id ? " rm-on" : ""}`}
                style={{ "--p": `${patchProgress(patch)}%` } as React.CSSProperties}
                onClick={() => goToPatch(patch.id)}
              >
                <Gem name={patch.icon} size="sm" color={patch.color} achievement={patch.id === "ach"} />
                <span>{patch.name.replace("Патч ", "")}</span>
                <em>{patchProgress(patch)}%</em>
              </button>
            ))}
          </div>
        </div>

        {/* ---------------------------- Уже работает -------------------------- */}
        <div className="rm-sec">
          <h2>Уже работает</h2>
          <em>
            {SHIPPED.length} {plural(SHIPPED.length, ["функция", "функции", "функций"])}
          </em>
        </div>
        <div className="rm-dn">
          {SHIPPED.map(([icon, title], index) => (
            <div key={title} className="rm-dc">
              <Gem name={icon} delay={index * 0.45} />
              <span className="rm-dt">{title}</span>
              <i>{CHECK}</i>
            </div>
          ))}
        </div>

        {/* ---------------------------- Планы развития ------------------------ */}
        <div className="rm-sec">
          <h2>Планы развития</h2>
        </div>
        <div className="rm-bar">
          <div className="rm-tabs" role="group" aria-label="Статус функции">
            {(
              [
                ["all", "Все"],
                ["wip", "В разработке"],
                ["plan", "В планах"],
                ["done", "Готово"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`rm-tab${status === value ? " rm-on" : ""}`}
                onClick={() => setStatus(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="rm-srch">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4-4" />
            </svg>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Найти функцию…"
              aria-label="Поиск функции"
            />
          </div>
          <span className="rm-chip">
            <span className="rm-ci">
              <Icon name="news" />
            </span>
            Голоса хранятся в этом браузере
          </span>
        </div>

        <div className="rm-cats">
          {Object.entries(CATEGORIES).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`rm-chip${category === id ? " rm-on" : ""}`}
              onClick={() => setCategory(id)}
            >
              {id === "all" ? null : (
                <span className="rm-ci">
                  <Icon name={CATEGORY_ICONS[id]} />
                </span>
              )}
              {label}
            </button>
          ))}
        </div>

        <div className="rm-tl" ref={timelineRef}>
          {byPatch.length === 0 ? (
            <div className="rm-empty">
              <b>Ничего не найдено</b>
              Измените фильтры или поисковый запрос.
            </div>
          ) : (
            byPatch.map(({ patch, features }, groupIndex) => {
              const isOpen = opened.includes(patch.id) || filtering;
              return (
                <div
                  key={patch.id}
                  data-patch={patch.id}
                  className={`rm-pt${isOpen ? " rm-open" : ""}${patch.id === "next" ? " rm-cur" : ""}`}
                  style={
                    {
                      "--pc": patch.color,
                      animationDelay: `${groupIndex * 80}ms`,
                    } as React.CSSProperties
                  }
                >
                  <div className="rm-pi">
                    <Gem
                      name={patch.icon}
                      size="lg"
                      color={patch.color}
                      achievement={patch.id === "ach"}
                    />
                  </div>
                  <div className="rm-pc">
                    <div className="rm-ph" onClick={() => toggleOpen(patch.id)}>
                      <div>
                        <div className="rm-row">
                          <h3>{patch.name}</h3>
                          <span className={`rm-badge ${patch.status === "wip" ? "rm-wip" : "rm-plan"}`}>
                            {patch.status === "wip" ? "В РАЗРАБОТКЕ" : "В ПЛАНАХ"}
                          </span>
                        </div>
                        <p>{patch.subtitle}</p>
                      </div>
                      <div className="rm-pm">
                        <div className="rm-eta">
                          <b>{formatQuarter(patch.eta)}</b>
                          {formatDate(patch.eta)}
                        </div>
                        <button
                          type="button"
                          className={`rm-bell${notify.includes(patch.id) ? " rm-on" : ""}`}
                          title="Отметить для себя"
                          aria-label={`Отметить патч ${patch.name}`}
                          aria-pressed={notify.includes(patch.id)}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleNotify(patch.id);
                          }}
                        >
                          <Icon name="bell" />
                        </button>
                        <span className="rm-chev">▾</span>
                      </div>
                    </div>
                    <div className="rm-pp">
                      <i style={{ width: `${patchProgress(patch)}%` }} />
                    </div>
                    <div className="rm-pb">
                      <div className="rm-fg">
                        {features.map((feature) => {
                          const voted = votes.includes(feature.id);
                          return (
                            <article key={feature.id} className={`rm-fc ${feature.status}`}>
                              <div className="rm-fh">
                                <Gem
                                  name={feature.icon}
                                  achievement={patch.id === "ach"}
                                />
                                <b>{feature.title}</b>
                              </div>
                              <p>{feature.text}</p>
                              <div className="rm-ff">
                                <span className={`rm-fs ${feature.status}`}>
                                  {feature.status === "done"
                                    ? "✓ ГОТОВО"
                                    : feature.status === "wip"
                                      ? `В РАБОТЕ ${feature.progress ?? 0}%`
                                      : "В ПЛАНАХ"}
                                </span>
                                {feature.status === "wip" && (
                                  <div className="rm-mp">
                                    <i style={{ width: `${featureProgress(feature)}%` }} />
                                  </div>
                                )}
                                {feature.status !== "done" && (
                                  <button
                                    type="button"
                                    className={`rm-vb${voted ? " rm-on" : ""}`}
                                    aria-pressed={voted}
                                    onClick={() => toggleVote(feature)}
                                  >
                                    ▲ <span>{feature.votes + (voted ? 1 : 0)}</span>
                                  </button>
                                )}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* -------------------------- Закрытая лаборатория --------------------- */}
        <div className="rm-sec">
          <h2>Закрытая лаборатория</h2>
        </div>
        <div className="rm-lab">
          <h3>??? Тайный патч ???</h3>
          <p>Мы готовим кое-что особенное. Нажимайте на замки — вдруг что-то откроется.</p>
          <div className="rm-lg">
            {LAB.map((title, index) =>
              labKeys.includes(index) && title ? (
                <div key={index} className="rm-lk rm-op">
                  <Gem name="key" size="sm" />
                  <span>{title}</span>
                </div>
              ) : (
                <button
                  key={index}
                  type="button"
                  className="rm-lk"
                  onClick={() =>
                    say(
                      index % 2
                        ? "Пока закрыто… но совсем скоро"
                        : "Нужен ключ — следите за ивентами",
                    )
                  }
                >
                  <Gem name="lock" size="sm" delay={index * 0.6} />
                </button>
              ),
            )}
          </div>
        </div>

        {/* ----------------------------- Обратная связь ------------------------ */}
        <section className="rm-fb">
          <div className="rm-fbg">
            <Gem name="message" size="lg" />
          </div>
          <h2>Мы вас слушаем</h2>
          <p>
            Значительная часть этого роадмапа родилась из ваших пожеланий. Предложите идею — и она
            может попасть в ближайший патч.
          </p>
          <div className="rm-fl-row">
            <input
              value={idea}
              maxLength={100}
              onChange={(event) => setIdea(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") sendIdea();
              }}
              placeholder="Что бы вы хотели увидеть на AniGalaxy?"
              aria-label="Ваша идея"
            />
            <button type="button" className="rm-btn rm-pri" onClick={sendIdea}>
              Отправить
            </button>
          </div>
          <div className="rm-row rm-fb-links">
            <a className="rm-btn rm-gh" href="https://t.me/anialaxyspace" target="_blank" rel="noopener">
              <span className="rm-bi">
                <Icon name="send" />
              </span>
              Telegram
            </a>
            <a className="rm-btn rm-gh" href="mailto:support@anigalaxy.example">
              <span className="rm-bi">
                <Icon name="mail" />
              </span>
              Написать на почту
            </a>
            <Link className="rm-btn rm-gh" href="/premium">
              <span className="rm-bi">
                <Icon name="crown" />
              </span>
              Premium
            </Link>
          </div>
        </section>
      </div>

      {/* ------------------------------- Тост -------------------------------- */}
      <div className={`rm-toast${toast ? " rm-show" : ""}`} role="status">
        {toast}
      </div>
    </div>
  );
}

/** Сколько всего функций в роадмапе — для подписи под списком */
export const FEATURE_COUNT = FEATURES.length;