"use client";

/* ============================================================
   Бейджи достижений AniGalaxy.

   Перенос макета achievements-preview.html 1:1: те же иконки (viewBox
   0 0 64 64, белые, своя анимация у каждой), та же сборка медали из
   слоёв по редкости и та же маска по контуру. Правки только технические:
   импорты вместо React.createElement, типы вместо неявных any, CSS
   вынесен в achievements.css вместо инлайна в каждом бейдже.
   ============================================================ */

import {
  Fragment,
  createElement as ce,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";

/** Пропсы общих кусков иконок */
type Part = { children?: ReactNode };

/* мини-замена framer-motion: только то, что нужно бейджу (наклон и блик за курсором) */
const mkv = (v: number | string) => {
  const s = new Set<() => void>();
  return {
    v,
    s,
    set(x: number | string) {
      this.v = x;
      s.forEach((f) => f());
    },
    sub(f: () => void) {
      s.add(f);
      return () => {
        s.delete(f);
      };
    },
  };
};
type MV = Omit<ReturnType<typeof mkv>, "v"> & { v: number | string };
/** Хранилище значения создаётся один раз на компонент. Через useState с
 *  ленивым инициализатором, а не useRef(...).current: чтение ref во время
 *  рендера запрещено (react-hooks lint). */
const useMotionValue = (v: number): MV => {
  const [store] = useState(() => mkv(v));
  return store;
};
const useSpring = (m: MV, _options?: Record<string, number>): MV => m;
type Range = readonly [number, number];
type OutRange = readonly [number, number] | readonly [string, string];
const useTransform = (
  src: MV | MV[],
  a: Range | ((values: number[]) => number | string),
  b?: OutRange | ((values: number[]) => string),
): MV =>
  useMemo(() => {
    const d = mkv(0);
    const srcs = Array.isArray(src) ? src : [src];
    const comp = () => {
      const cur = srcs[0].v;
      if (typeof a === "function") {
        d.v = a(srcs.map((x) => Number(x.v)));
      } else if (!b || typeof b === "function") {
        d.v = b ? b(srcs.map((x) => Number(x.v))) : 0;
      } else {
        const from = Number(cur);
        const t = (from - a[0]) / (a[1] - a[0]);
        const unit = typeof b[0] === "string" ? b[0].replace(/[-\d.]/g, "") : "";
        const n0 = parseFloat(String(b[0]));
        const n1 = parseFloat(String(b[1]));
        d.v = unit ? n0 + (n1 - n0) * t + unit : n0 + (n1 - n0) * t;
      }
      d.s.forEach((f) => f());
    };
    srcs.forEach((x) => x.sub(comp));
    comp();
    return d;
    // Как в макете: подписка на движение создаётся один раз
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

type MotionStyle = {
  rotateX?: MV;
  rotateY?: MV;
  background?: MV;
} & Record<string, unknown>;
type MotionProps = {
  style?: MotionStyle;
  initial?: Record<string, number | string>;
  animate?: Record<string, number | string>;
  transition?: Record<string, number | string>;
} & Record<string, unknown>;

const mk = (tag: string) => function M(props: MotionProps) {
  const { style = {}, initial, animate, transition, ...rest } = props;
  const el = useRef<HTMLElement>(null);
  const { rotateX, rotateY, background, ...plain } = style;
  useEffect(() => {
    const apply = () => {
      if (!el.current) return;
      if (rotateX && rotateY) {
        el.current.style.transform = "rotateX(" + rotateX.v + "deg) rotateY(" + rotateY.v + "deg)";
      }
      if (background) el.current.style.background = String(background.v);
    };
    apply();
    const un = [rotateX, rotateY, background]
      .filter((x): x is MV => Boolean(x))
      .map((x) => x.sub(apply));
    return () => un.forEach((f) => f());
  }, []);
  return ce(tag, { ...rest, ref: el, style: plain as CSSProperties });
};
const motion = { div: mk("div"), span: mk("span") };

const W = "#fff";
const D = "rgba(0,0,0,.3)";
const DK = "rgba(0,0,0,.55)";
const pts = (cx: number, cy: number, n: number, ro: number, ri: number, rot = -90): string => Array.from({ length: n * 2 }, (_, i) => {
    const r = i % 2 ? ri : ro;
    const a = ((rot + (i * 180) / n) * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
}).join(" ");
const ray = (cx: number, cy: number, a: number, r1: number, r2: number): string => {
    const t = (a * Math.PI) / 180;
    return `M${(cx + r1 * Math.cos(t)).toFixed(1)} ${(cy + r1 * Math.sin(t)).toFixed(1)}L${(cx + r2 * Math.cos(t)).toFixed(1)} ${(cy + r2 * Math.sin(t)).toFixed(1)}`;
};
const Dot = ({ x, y, r = 2, d = 0 }: { x: number; y: number; r?: number; d?: number }) => (ce("circle", { cx: x, cy: y, r: r, fill: "#fff", className: "ab-twinkle", style: { animationDelay: `${d}s` } }));
/** невидимый круг: держит центр вращения группы в (32,32) */
const Anchor = ({ r = 27 }: { r?: number }) => ce("circle", { cx: "32", cy: "32", r: r, fill: "none" });
const Txt = ({ children, x = 32, y, size = 20, fill = W }: { children?: ReactNode; x?: number; y: number; size?: number; fill?: string }) => (ce("text", { x: x, y: y, textAnchor: "middle", fontSize: size, fontWeight: 800, fill: fill, style: { fontFamily: "var(--font-display)" } }, children));
const Flame = ({ cx = 32, cy = 32, s = 1, d = 0, fill = W, inner = true }: { cx?: number; cy?: number; s?: number; d?: number; fill?: string; inner?: boolean }) => (ce("g", { transform: `translate(${cx - 32 * s} ${cy - 31 * s}) scale(${s})` },
    ce("g", { className: "ab-flick", style: { animationDelay: `${d}s` } },
        ce("path", { d: "M32 4C35 15 50 21 50 38C50 50 42 58 32 58S14 50 14 38C14 30 19 26 22 18C26 22 27 26 28 30C30 22 28 12 32 4Z", fill: fill }),
        inner && ce("path", { d: "M32 31C35 40 42 42 42 49C42 55 37 58 32 58S22 55 22 49C22 42 29 40 32 31Z", fill: "rgba(255,120,40,.7)" }))));
const Heart = ({ cx = 32, cy = 34, s = 1, fill = W, d = 0 }: { cx?: number; cy?: number; s?: number; fill?: string; d?: number }) => (ce("g", { transform: `translate(${cx - 32 * s} ${cy - 33.5 * s}) scale(${s})` },
    ce("path", { d: "M32 56C12 42 6 30 10 20c3-8 15-9 22 1 7-10 19-9 22-1 4 10-2 22-22 36Z", fill: fill, className: "ab-beat", style: { animationDelay: `${d}s` } })));
const Wing = ({ x = 28, y = 40, len = 14, angles = [75, 50, 25, 0] }: { x?: number; y?: number; len?: number; angles?: number[] }) => (ce(Fragment, null, [false, true].map((m) => (ce("g", { key: String(m), transform: m ? "translate(64 0) scale(-1 1)" : undefined }, angles.map((a) => (ce("ellipse", { key: a, cx: x - len, cy: y, rx: len, ry: 4.2, transform: `rotate(${a} ${x} ${y})`, fill: W }))))))));
const Cal = ({ children }: Part) => (ce(Fragment, null,
    ce("rect", { x: "8", y: "12", width: "48", height: "44", rx: "6", fill: W }),
    ce("path", { d: "M8 18a6 6 0 0 1 6-6h36a6 6 0 0 1 6 6v8H8Z", fill: "rgba(0,0,0,.28)" }),
    ce("rect", { x: "19", y: "6", width: "5", height: "12", rx: "2.5", fill: W }),
    ce("rect", { x: "40", y: "6", width: "5", height: "12", rx: "2.5", fill: W }),
    children));
const Doc = ({ children }: Part) => (ce(Fragment, null,
    ce("path", { d: "M14 6h26l12 12v38a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z", fill: W }),
    ce("path", { d: "M40 6l12 12H40Z", fill: "rgba(0,0,0,.25)" }),
    children));
const Bubble = ({ children }: Part) => (ce("g", { className: "ab-bob" },
    ce("path", { d: "M10 14a6 6 0 0 1 6-6h32a6 6 0 0 1 6 6v22a6 6 0 0 1-6 6H30L18 54V42h-2a6 6 0 0 1-6-6Z", fill: W }),
    children));
const SHIELD = "M32 6l22 8v16c0 14-9 22-22 28C19 52 10 44 10 30V14Z";
const GLASS = "M18 12h28c0 11-8 15-8 20s8 9 8 20H18c0-11 8-15 8-20s-8-9-8-20Z";

const ICONS: Record<string, ReactElement> = {
    /* ---------- Старт ---------- */
    ach_start_account: (ce(Fragment, null,
        ce("g", { className: "ab-bob" },
            ce("circle", { cx: "32", cy: "22", r: "10", fill: W }),
            ce("path", { d: "M12 56c0-13 8-20 20-20s20 7 20 20Z", fill: W })),
        ce(Dot, { x: 52, y: 12, r: 2, d: 0.2 }),
        ce(Dot, { x: 12, y: 14, r: 1.6, d: 0.9 }))),
    ach_start_profile: (ce(Fragment, null,
        ce("rect", { x: "6", y: "12", width: "52", height: "36", rx: "5", fill: W }),
        ce("circle", { cx: "21", cy: "26", r: "5.5", fill: D }),
        ce("path", { d: "M12 41c0-6 4-9 9-9s9 3 9 9Z", fill: D }),
        ce("path", { d: "M35 22h16M35 29h16M35 36h9", stroke: D, strokeWidth: "2.6", strokeLinecap: "round" }),
        ce("g", { className: "ab-beat" },
            ce("circle", { cx: "48", cy: "46", r: "10", fill: W, stroke: "rgba(0,0,0,.35)", strokeWidth: "2" }),
            ce("path", { d: "M43 46l4 4 7-8", stroke: DK, strokeWidth: "3", strokeLinecap: "round", strokeLinejoin: "round", fill: "none" })))),
    ach_start_first_anime: (ce(Fragment, null,
        ce("circle", { cx: "32", cy: "32", r: "24", stroke: W, strokeWidth: "3.4" }),
        ce("circle", { cx: "32", cy: "32", r: "24", stroke: W, strokeWidth: "1.6", className: "ab-ping" }),
        ce("polygon", { points: "26,20 26,44 46,32", fill: W, className: "ab-beat" }))),
    /* ---------- Серии ---------- */
    ach_episodes_1: (ce(Fragment, null,
        ce("rect", { x: "8", y: "16", width: "48", height: "34", rx: "6", stroke: W, strokeWidth: "3.4" }),
        ce("polygon", { points: "27,24 27,42 42,33", fill: W, className: "ab-beat" }),
        ce("path", { d: "M22 58h20M32 50v8", stroke: W, strokeWidth: "3.2", strokeLinecap: "round" }),
        ce("path", { d: "M24 8l8 6 8-6", stroke: W, strokeWidth: "2.6", strokeLinecap: "round", strokeLinejoin: "round", className: "ab-wobble" }))),
    ach_episodes_10: (ce(Fragment, null,
        ce("rect", { x: "10", y: "30", width: "44", height: "26", rx: "5", fill: W }),
        ce("polygon", { points: "28,36 28,50 40,43", fill: D, className: "ab-beat" }),
        ce(Flame, { cx: 20, cy: 20, s: 0.34, d: 0.1 }),
        ce(Flame, { cx: 32, cy: 16, s: 0.44, d: 0.3 }),
        ce(Flame, { cx: 44, cy: 20, s: 0.34, d: 0.5 }))),
    ach_episodes_50: (ce("g", { className: "ab-blink" },
        ce("path", { d: "M4 32C14 12 50 12 60 32C50 52 14 52 4 32Z", stroke: W, strokeWidth: "3.4", strokeLinejoin: "round" }),
        ce("circle", { cx: "32", cy: "32", r: "12", fill: W }),
        ce("polygon", { points: "29,26 29,38 38,32", fill: D }))),
    ach_episodes_100: (ce(Fragment, null,
        ce("circle", { cx: "32", cy: "32", r: "27", stroke: W, strokeWidth: "2.4", strokeDasharray: "6 5", className: "ab-dash" }),
        ce("g", { className: "ab-beat" },
            ce(Txt, { y: 41, size: 24 }, "100")))),
    ach_episodes_500: (ce(Fragment, null,
        ce(Flame, { cx: 32, cy: 32, s: 1 }),
        ce("path", { d: "M35 20L24 36h8l-3 12 12-18h-8l2-10Z", fill: DK, className: "ab-flick" }))),
    ach_episodes_2000: (ce(Fragment, null,
        ce("g", { className: "ab-streak" },
            ce("polygon", { points: "4,16 4,48 26,32", fill: W }),
            ce("polygon", { points: "28,16 28,48 50,32", fill: W })),
        ce("path", { d: "M57 18v28", stroke: W, strokeWidth: "4.4", strokeLinecap: "round", className: "ab-twinkle" }))),
    /* ---------- Тайтлы ---------- */
    ach_titles_10: (ce(Fragment, null,
        ce("path", { d: "M13 6v54", stroke: W, strokeWidth: "3.8", strokeLinecap: "round" }),
        ce("g", { className: "ab-sway" },
            ce("rect", { x: "16", y: "8", width: "38", height: "28", rx: "2", fill: W }),
            [0, 1, 2].flatMap((r) => [0, 1, 2, 3].map((c) => (r + c) % 2 ? ce("rect", { key: `${r}${c}`, x: 16 + c * 9.5, y: 8 + r * 9.33, width: "9.5", height: "9.33", fill: D }) : null))),
        ce(Dot, { x: 52, y: 50, r: 1.8, d: 0.6 }))),
    ach_titles_50: (ce(Fragment, null,
        ce("g", { className: "ab-cheer" },
            ce("rect", { x: "8", y: "10", width: "48", height: "14", rx: "3", fill: W })),
        ce("path", { d: "M12 28h40v24a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4Z", fill: W }),
        ce("rect", { x: "24", y: "35", width: "16", height: "5", rx: "2.5", fill: D }),
        ce(Dot, { x: 54, y: 8, r: 1.6, d: 0.4 }))),
    ach_titles_100: (ce(Fragment, null,
        ce("path", { d: "M32 16C24 10 14 10 6 13v38c8-3 18-3 26 3 8-6 18-6 26-3V13c-8-3-18-3-26 3Z", fill: W }),
        ce("path", { d: "M32 16v38", stroke: D, strokeWidth: "2.4" }),
        ce("path", { d: "M12 22h14M12 29h14M12 36h10", stroke: D, strokeWidth: "2.4", strokeLinecap: "round" }),
        ce("polygon", { points: pts(45, 32, 5, 8, 3.4), fill: D, className: "ab-beat" }))),
    /* ---------- Дни ---------- */
    ach_days_7: (ce(Cal, null,
        ce("g", { className: "ab-beat" },
            ce(Txt, { y: 51, size: 24, fill: DK }, "7")))),
    ach_days_30: (ce(Cal, null,
        [0, 1, 2].flatMap((r) => [0, 1, 2, 3, 4].map((c) => r === 2 && c === 4 ? null : (ce("circle", { key: `${r}${c}`, cx: 16 + c * 8, cy: 34 + r * 9, r: "2.2", fill: DK, className: "ab-twinkle", style: { animationDelay: `${(r * 5 + c) * 0.12}s` } })))),
        ce("path", { d: "M44 52l3 3 6-7", stroke: DK, strokeWidth: "2.8", strokeLinecap: "round", strokeLinejoin: "round", fill: "none", className: "ab-beat" }))),
    ach_days_100: (ce(Fragment, null,
        ce("path", { d: "M32 6L4 30h9v26h38V30h9Z", fill: W }),
        ce("rect", { x: "26", y: "42", width: "12", height: "14", rx: "2", fill: D }),
        ce("g", { transform: "translate(32 32) scale(.5) translate(-32 -33.5)" },
            ce("path", { d: "M32 56C12 42 6 30 10 20c3-8 15-9 22 1 7-10 19-9 22-1 4 10-2 22-22 36Z", fill: D, className: "ab-beat" })))),
    ach_days_365: (ce(Fragment, null,
        ce("circle", { cx: "32", cy: "32", r: "9", fill: W }),
        ce("ellipse", { cx: "32", cy: "32", rx: "26", ry: "10", stroke: W, strokeWidth: "2.4", transform: "rotate(-25 32 32)" }),
        ce("g", { className: "ab-spin", style: { animationDuration: "6s" } },
            ce(Anchor, { r: 26 }),
            ce("circle", { cx: "32", cy: "6", r: "3.2", fill: W })))),
    /* ---------- Серии входа ---------- */
    ach_streak_3: (ce(Fragment, null,
        ce(Flame, { cx: 32, cy: 32, s: 0.95 }),
        ce(Txt, { y: 50, size: 18, fill: DK }, "3"))),
    ach_streak_7: (ce(Fragment, null,
        ce("g", { className: "ab-spin", style: { animationDuration: "10s" } },
            ce(Anchor, { r: 27 }),
            [...Array(7)].map((_, i) => {
                const a = (i * 360) / 7;
                return ce("circle", { key: i, cx: 32 + 26 * Math.cos((a * Math.PI) / 180), cy: 32 + 26 * Math.sin((a * Math.PI) / 180), r: "2.6", fill: W });
            })),
        ce(Flame, { cx: 32, cy: 33, s: 0.58 }))),
    ach_streak_14: (ce(Fragment, null,
        ce(Flame, { cx: 20, cy: 36, s: 0.62 }),
        ce(Flame, { cx: 44, cy: 36, s: 0.62, d: 0.35 }),
        ce(Dot, { x: 32, y: 10, r: 2, d: 0.2 }))),
    ach_streak_30: (ce(Fragment, null,
        ce("circle", { cx: "32", cy: "32", r: "28", stroke: W, strokeWidth: "2.2", strokeDasharray: "5 5", className: "ab-dash" }),
        ce(Flame, { cx: 32, cy: 26, s: 0.6 }),
        ce(Txt, { y: 53, size: 13 }, "30"))),
    ach_streak_100: (ce(Fragment, null,
        ce("path", { d: SHIELD, fill: W }),
        ce(Flame, { cx: 32, cy: 32, s: 0.5, fill: DK, inner: false }))),
    /* ---------- Подборки ---------- */
    ach_collection_1: (ce("g", { className: "ab-cheer" },
        ce("path", { d: "M16 6h32v52L32 44 16 58Z", fill: W }),
        ce("polygon", { points: pts(32, 22, 5, 8, 3.4), fill: D, className: "ab-beat" }))),
    ach_collection_25: (ce(Fragment, null,
        ce("g", { transform: "rotate(-16 32 54)" },
            ce("rect", { x: "17", y: "9", width: "30", height: "42", rx: "4.5", fill: W, opacity: ".45", className: "ab-fan" })),
        ce("g", { transform: "rotate(16 32 54)" },
            ce("rect", { x: "17", y: "9", width: "30", height: "42", rx: "4.5", fill: W, opacity: ".7", className: "ab-fan", style: { animationDelay: "-1.4s" } })),
        ce("rect", { x: "17", y: "12", width: "30", height: "42", rx: "4.5", fill: W }),
        ce("polygon", { points: pts(32, 31, 5, 9.5, 4), fill: D, className: "ab-beat" }),
        ce("path", { d: "M24 46h16", stroke: D, strokeWidth: "2.2", strokeLinecap: "round" }))),
    ach_collection_100: (ce(Fragment, null,
        ce("rect", { x: "10", y: "14", width: "9", height: "40", rx: "1.5", fill: W }),
        ce("rect", { x: "21", y: "22", width: "9", height: "32", rx: "1.5", fill: W, className: "ab-fan" }),
        ce("rect", { x: "32", y: "8", width: "10", height: "46", rx: "1.5", fill: W }),
        ce("rect", { x: "44", y: "20", width: "9", height: "34", rx: "1.5", fill: W }),
        ce("path", { d: "M12.5 22h4M34.5 16h5M46.5 28h4", stroke: D, strokeWidth: "2.2", strokeLinecap: "round" }),
        ce("rect", { x: "6", y: "54", width: "52", height: "4", rx: "2", fill: W }))),
    ach_collection_500: (ce(Fragment, null,
        ce("g", { className: "ab-cheer" },
            ce("path", { d: "M8 30V22a14 14 0 0 1 14-14h20a14 14 0 0 1 14 14v8Z", fill: W })),
        ce("path", { d: "M8 33h48v21a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3Z", fill: W }),
        ce("rect", { x: "28", y: "28", width: "8", height: "12", rx: "2", fill: D }),
        ce("path", { d: "M8 33h48", stroke: D, strokeWidth: "2" }),
        ce(Dot, { x: 32, y: 4, r: 2, d: 0.3 }))),
    ach_collection_1000: (ce(Fragment, null,
        ce("rect", { x: "12", y: "6", width: "40", height: "52", rx: "5", fill: W }),
        ce("path", { d: "M12 23h40M12 40h40", stroke: D, strokeWidth: "2.2" }),
        [10, 27, 44].map((y, i) => (ce("rect", { key: y, x: "26", y: y, width: "12", height: "4.4", rx: "2.2", fill: D, className: "ab-twinkle", style: { animationDelay: `${i * 0.3}s` } }))))),
    /* ---------- Оценки ---------- */
    ach_ratings_10: (ce(Fragment, null,
        ce("polygon", { points: pts(26, 27, 5, 20, 8.4), fill: W, strokeLinejoin: "round", className: "ab-beat" }),
        ce("g", { className: "ab-pen" },
            ce("g", { transform: "rotate(45 48 46)" },
                ce("rect", { x: "45", y: "32", width: "6", height: "22", rx: "2", fill: W }),
                ce("polygon", { points: "45,54 51,54 48,61", fill: W }))))),
    ach_ratings_50: (ce(Doc, null,
        ce("path", { d: "M20 26h20M20 33h24", stroke: D, strokeWidth: "2.6", strokeLinecap: "round" }),
        [22, 32, 42].map((x, i) => (ce("polygon", { key: x, points: pts(x, 47, 5, 5, 2.2), fill: D, className: "ab-twinkle", style: { animationDelay: `${i * 0.25}s` } }))))),
    ach_ratings_100: (ce("g", { className: "ab-wobble" },
        ce("circle", { cx: "28", cy: "28", r: "17", stroke: W, strokeWidth: "4" }),
        ce("polygon", { points: pts(28, 29, 5, 9.5, 4), fill: W, className: "ab-beat" }),
        ce("path", { d: "M41 41L57 57", stroke: W, strokeWidth: "5.6", strokeLinecap: "round" }))),
    /* ---------- Комментарии ---------- */
    ach_comments_1: (ce(Bubble, null,
        ce(Txt, { y: 33, size: 26, fill: DK }, "!"))),
    ach_comments_50: (ce(Fragment, null,
        ce("path", { d: "M8 6h28a5 5 0 0 1 5 5v16a5 5 0 0 1-5 5H20l-8 8v-8H8a5 5 0 0 1-5-5V11a5 5 0 0 1 5-5Z", fill: W, opacity: ".7" }),
        ce("path", { d: "M28 24h28a5 5 0 0 1 5 5v16a5 5 0 0 1-5 5h-4v8l-8-8H28a5 5 0 0 1-5-5V29a5 5 0 0 1 5-5Z", fill: W, stroke: "rgba(0,0,0,.3)", strokeWidth: "2" }),
        [34, 42, 50].map((x, i) => (ce("circle", { key: x, cx: x, cy: "37", r: "2.8", fill: D, className: "ab-type", style: { animationDelay: `${i * 0.18}s` } }))))),
    ach_comments_500: (ce(Fragment, null,
        ce("g", { className: "ab-wobble" },
            ce("path", { d: "M10 24h14l22-12v40L24 40H10a2 2 0 0 1-2-2V26a2 2 0 0 1 2-2Z", fill: W }),
            ce("path", { d: "M14 40l4 14h8l-3-14", fill: W })),
        ce("path", { d: "M51 24c4 4 4 12 0 16", stroke: W, strokeWidth: "3", strokeLinecap: "round", className: "ab-twinkle" }),
        ce("path", { d: "M57 17c7 8 7 22 0 30", stroke: W, strokeWidth: "3", strokeLinecap: "round", className: "ab-twinkle", style: { animationDelay: ".4s" } }))),
    ach_comments_1000: (ce(Bubble, null,
        ce("path", { d: "M20 38l-2-14 9 7 5-10 5 10 9-7-2 14Z", fill: DK, className: "ab-beat" }))),
    /* ---------- Уровни ---------- */
    ach_level_5: (ce(Fragment, null,
        ce("g", { className: "ab-cheer" },
            ce("path", { d: "M32 4L48 22H38v12H26V22H16Z", fill: W })),
        ce(Txt, { y: 56, size: 22 }, "5"))),
    ach_level_10: (ce(Fragment, null,
        ce("circle", { cx: "32", cy: "20", r: "18", stroke: W, strokeWidth: "2.2", className: "ab-ping" }),
        ce("g", { className: "ab-cheer" },
            ce("path", { d: "M32 6L45 20H37v10H27V20H19Z", fill: W })),
        ce(Txt, { y: 56, size: 22 }, "10"))),
    ach_level_25: (ce(Fragment, null,
        ce("path", { d: "M16 22l16-14 16 14M16 36l16-14 16 14", stroke: W, strokeWidth: "5", strokeLinecap: "round", strokeLinejoin: "round", className: "ab-cheer" }),
        ce(Txt, { y: 57, size: 20 }, "25"))),
    ach_level_50: (ce(Fragment, null,
        ce(Wing, { x: 26, y: 26, len: 13, angles: [70, 45, 20] }),
        ce("path", { d: "M32 6L42 18H36v12H28V18H22Z", fill: W, className: "ab-cheer" }),
        ce(Txt, { y: 57, size: 20 }, "50"))),
    ach_level_100: (ce(Fragment, null,
        ce("path", { d: "M14 30l-2-18 10 8 10-14 10 14 10-8-2 18Z", fill: W, className: "ab-beat" }),
        ce("rect", { x: "14", y: "33", width: "36", height: "4", rx: "2", fill: W }),
        ce(Txt, { y: 58, size: 20 }, "100"),
        ce(Dot, { x: 6, y: 14, r: 1.8, d: 0.2 }),
        ce(Dot, { x: 58, y: 14, r: 1.8, d: 0.8 }))),
    /* ---------- Ночные ---------- */
    ach_night_100: (ce(Fragment, null,
        ce("path", { d: "M12 58V22C12 12 20 6 32 6s20 6 20 16v36Z", fill: W }),
        ce("polygon", { points: "12,8 24,14 14,22", fill: W }),
        ce("polygon", { points: "52,8 40,14 50,22", fill: W }),
        ce("g", { className: "ab-blink" },
            ce("circle", { cx: "22", cy: "28", r: "9", fill: D }),
            ce("circle", { cx: "42", cy: "28", r: "9", fill: D }),
            ce("circle", { cx: "22", cy: "28", r: "4", fill: W }),
            ce("circle", { cx: "42", cy: "28", r: "4", fill: W })),
        ce("polygon", { points: "28,36 36,36 32,44", fill: DK }),
        ce("path", { d: "M20 50l6 4 6-4 6 4 6-4", stroke: D, strokeWidth: "2.4", strokeLinecap: "round", strokeLinejoin: "round", fill: "none" }))),
    /* ---------- Жанры ---------- */
    ach_genres_5: (ce("g", { className: "ab-wobble" },
        ce("circle", { cx: "28", cy: "28", r: "18", stroke: W, strokeWidth: "4" }),
        ce(Txt, { x: 28, y: 37, size: 24 }, "?"),
        ce("path", { d: "M41 41L57 57", stroke: W, strokeWidth: "5.6", strokeLinecap: "round" }))),
    ach_genres_15: (ce(Fragment, null,
        ce("circle", { cx: "32", cy: "32", r: "24", stroke: W, strokeWidth: "3.4" }),
        ce("ellipse", { cx: "32", cy: "32", rx: "10", ry: "24", stroke: W, strokeWidth: "2.4", className: "ab-turn" }),
        ce("path", { d: "M8 32h48M12 20h40M12 44h40", stroke: W, strokeWidth: "2.2", strokeLinecap: "round" }))),
    ach_genres_25: (ce(Fragment, null,
        ce("circle", { cx: "33", cy: "32", r: "15", fill: W }),
        ce("circle", { cx: "33", cy: "32", r: "9.5", stroke: D, strokeWidth: "2", className: "ab-beat" }),
        ce("path", { d: "M7 8v13M12 8v13M17 8v13", stroke: W, strokeWidth: "2.6", strokeLinecap: "round" }),
        ce("path", { d: "M7 21c0 5 2.5 7 5 7s5-2 5-7M12 28v28", stroke: W, strokeWidth: "2.8", strokeLinecap: "round", fill: "none" }),
        ce("path", { d: "M55 8c-5 4-6 14-6 22h6Z", fill: W }),
        ce("path", { d: "M55 30v26", stroke: W, strokeWidth: "3", strokeLinecap: "round" }))),
    /* ---------- Лайки (выключены) ---------- */
    ach_likes_10: ce(Heart, { cx: 32, cy: 34, s: 1 }),
    ach_likes_100: (ce(Fragment, null,
        ce(Heart, { cx: 32, cy: 34, s: 1 }),
        ce("polygon", { points: pts(32, 32, 5, 10, 4.2), fill: D, className: "ab-beat" }))),
    ach_likes_1000: (ce(Fragment, null,
        ce("circle", { cx: "32", cy: "32", r: "16", stroke: W, strokeWidth: "2", className: "ab-ping" }),
        ce("circle", { cx: "32", cy: "32", r: "16", stroke: W, strokeWidth: "2", className: "ab-ping", style: { animationDelay: "1s" } }),
        ce(Heart, { cx: 32, cy: 33, s: 0.55 }),
        ce("g", { className: "ab-spin", style: { animationDuration: "12s" } },
            ce(Anchor, { r: 27 }),
            [...Array(8)].map((_, i) => {
                const a = (i * 45 * Math.PI) / 180;
                return ce("circle", { key: i, cx: 32 + 26 * Math.cos(a), cy: 32 + 26 * Math.sin(a), r: "2.2", fill: W });
            })))),
    /* ---------- Квесты ---------- */
    ach_quests_10: (ce(Fragment, null,
        ce("rect", { x: "12", y: "6", width: "40", height: "52", rx: "4", fill: W }),
        ce("path", { d: "M20 16h24M20 49h16", stroke: D, strokeWidth: "2.6", strokeLinecap: "round" }),
        ce("path", { d: "M21 32l7 7 14-16", stroke: DK, strokeWidth: "4.4", strokeLinecap: "round", strokeLinejoin: "round", fill: "none", strokeDasharray: "34", className: "ab-write" }))),
    ach_quests_50: (ce(Doc, null,
        ce("path", { d: "M20 26h18M20 33h22", stroke: D, strokeWidth: "2.6", strokeLinecap: "round" }),
        ce("polygon", { points: "36,53 34,63 40,59", fill: "rgba(0,0,0,.3)" }),
        ce("polygon", { points: "48,53 50,63 44,59", fill: "rgba(0,0,0,.3)" }),
        ce("circle", { cx: "42", cy: "46", r: "9", fill: "rgba(0,0,0,.4)" }),
        ce("polygon", { points: pts(42, 46, 5, 5.5, 2.4), fill: W, className: "ab-beat" }))),
    ach_quests_200: (ce(Fragment, null,
        ce("path", { d: SHIELD, fill: W }),
        ce("rect", { x: "30", y: "14", width: "4", height: "26", rx: "1.5", fill: DK }),
        ce("rect", { x: "23", y: "38", width: "18", height: "3.5", rx: "1.7", fill: DK }),
        ce("rect", { x: "30.3", y: "41", width: "3.4", height: "9", fill: DK }),
        ce(Dot, { x: 52, y: 8, r: 1.8, d: 0.3 }))),
    /* ---------- Теги ---------- */
    ach_tags_5: (ce("g", { className: "ab-swing" },
        ce("path", { d: "M32 24V19a5 5 0 1 1 5 5", stroke: W, strokeWidth: "3.4", strokeLinecap: "round", fill: "none" }),
        ce("path", { d: "M32 25L6 46c-2 2-1 5 2 5h48c3 0 4-3 2-5Z", fill: W }))),
    ach_tags_15: (ce(Fragment, null,
        ce("path", { d: "M6 8h52l4 14H2Z", fill: W }),
        ce("path", { d: "M15 8l-2 14M25 8l-1 14M36 8l1 14M46 8l2 14", stroke: D, strokeWidth: "2.4" }),
        ce("rect", { x: "8", y: "26", width: "48", height: "30", rx: "3", stroke: W, strokeWidth: "3" }),
        ce("g", { className: "ab-swing" },
            ce("path", { d: "M26 32h14l6 6v14H26Z", fill: W }),
            ce("circle", { cx: "31", cy: "37", r: "1.8", fill: D })))),
    ach_tags_29: (ce(Fragment, null,
        ce("path", { d: "M8 10a2 2 0 0 1 2-2h20a4 4 0 0 1 3 1.2L56 32a4 4 0 0 1 0 5.6L37.6 56a4 4 0 0 1-5.6 0L9.2 33A4 4 0 0 1 8 30Z", fill: W }),
        ce("circle", { cx: "18", cy: "18", r: "3.2", fill: D }),
        ce("path", { d: "M26 31l6 6 11-12", stroke: DK, strokeWidth: "4.4", strokeLinecap: "round", strokeLinejoin: "round", fill: "none", className: "ab-beat" }))),
    /* ---------- Время у плеера ---------- */
    ach_minutes_60: (ce(Fragment, null,
        ce("circle", { cx: "32", cy: "32", r: "25", stroke: W, strokeWidth: "3.6" }),
        ce("path", { d: "M32 11v4M53 32h-4M32 53v-4M11 32h4", stroke: W, strokeWidth: "3", strokeLinecap: "round" }),
        ce("path", { d: "M32 32L44 26", stroke: W, strokeWidth: "3.6", strokeLinecap: "round" }),
        ce("g", { className: "ab-spin", style: { animationDuration: "6s" } },
            ce("circle", { cx: "32", cy: "32", r: "18", fill: "none" }),
            ce("path", { d: "M32 32V16", stroke: W, strokeWidth: "3.2", strokeLinecap: "round" })),
        ce("circle", { cx: "32", cy: "32", r: "3", fill: W }))),
    ach_minutes_300: (ce(Fragment, null,
        ce("rect", { x: "13", y: "7", width: "38", height: "5", rx: "2.5", fill: W }),
        ce("rect", { x: "13", y: "52", width: "38", height: "5", rx: "2.5", fill: W }),
        ce("path", { d: GLASS, stroke: W, strokeWidth: "3", strokeLinejoin: "round" }),
        ce("path", { d: "M22 15h20c-1 5-4 8-7 11h-6c-3-3-6-6-7-11Z", fill: W, className: "ab-drain" }),
        ce("path", { d: "M22 49h20c-1-5-5-8-10-8s-9 3-10 8Z", fill: W, className: "ab-fill" }),
        ce("path", { d: "M32 27v16", stroke: W, strokeWidth: "1.6", strokeDasharray: "2 3", className: "ab-dash" }))),
    ach_minutes_1000: (ce(Fragment, null,
        ce("rect", { x: "6", y: "8", width: "52", height: "38", rx: "5", stroke: W, strokeWidth: "3.4" }),
        ce("path", { d: "M24 58h16M32 46v12", stroke: W, strokeWidth: "3.2", strokeLinecap: "round" }),
        ce("circle", { cx: "32", cy: "27", r: "6", fill: W, className: "ab-beat" }),
        ce("g", { className: "ab-spin", style: { animationDuration: "14s" } },
            ce("circle", { cx: "32", cy: "27", r: "15", fill: "none" }),
            [...Array(8)].map((_, i) => (ce("path", { key: i, d: ray(32, 27, i * 45, 10, 14), stroke: W, strokeWidth: "2.4", strokeLinecap: "round" })))))),
    ach_minutes_3000: (ce(Fragment, null,
        [...Array(24)].map((_, i) => (ce("path", { key: i, d: ray(32, 32, i * 15, i % 6 === 0 ? 20 : 22, 27), stroke: W, strokeWidth: i % 6 === 0 ? 3.2 : 2, strokeLinecap: "round" }))),
        ce("g", { className: "ab-spin", style: { animationDuration: "12s" } },
            ce("circle", { cx: "32", cy: "32", r: "16", fill: "none" }),
            ce("path", { d: "M32 32V19", stroke: W, strokeWidth: "2.6", strokeLinecap: "round" })),
        ce(Txt, { y: 53, size: 11 }, "24\u0447"))),
    /* ---------- Секретные ---------- */
    ach_secret_return: (ce("g", { className: "ab-spin", style: { animationDuration: "8s" } },
        ce(Anchor, { r: 26 }),
        ce("path", { d: "M32 32a3 3 0 0 1 6 0a8 8 0 0 1-16 0a13 13 0 0 1 26 0a18 18 0 0 1-36 0a23 23 0 0 1 46 0", stroke: W, strokeWidth: "3.2", strokeLinecap: "round", fill: "none" }))),
    ach_secret_overload: (ce(Fragment, null,
        ce("circle", { cx: "32", cy: "32", r: "26", stroke: W, strokeWidth: "2", className: "ab-ping" }),
        ce("path", { d: "M36 4L14 36h14l-4 24 26-34H36Z", fill: W, strokeLinejoin: "round", className: "ab-flick" }))),
    ach_secret_harvest: (ce("g", { className: "ab-swing" },
        ce("path", { d: "M44 10C30 6 16 12 8 26C22 20 34 20 46 26Z", fill: W }),
        ce("path", { d: "M44 14L28 60", stroke: W, strokeWidth: "3.8", strokeLinecap: "round" }),
        ce(Dot, { x: 54, y: 14, r: 1.8, d: 0.4 }))),
    ach_secret_easter: (ce(Fragment, null,
        ce("g", { className: "ab-wobble" },
            ce("path", { d: "M32 6C20 6 12 26 12 38a20 20 0 0 0 40 0C52 26 44 6 32 6Z", fill: W }),
            ce("path", { d: "M12 38l8 5 8-7 8 7 8-7 8 7", stroke: D, strokeWidth: "3", strokeLinecap: "round", strokeLinejoin: "round", fill: "none" }),
            ce("circle", { cx: "26", cy: "24", r: "2.6", fill: D }),
            ce("circle", { cx: "38", cy: "22", r: "2", fill: D }),
            ce("circle", { cx: "32", cy: "52", r: "2.4", fill: D })),
        ce(Dot, { x: 54, y: 10, r: 1.8, d: 0.3 }))),
    ach_secret_early: (ce(Fragment, null,
        ce("path", { d: "M4 46h56", stroke: W, strokeWidth: "3.6", strokeLinecap: "round" }),
        ce("path", { d: "M18 46a14 14 0 0 1 28 0Z", fill: W, className: "ab-beat" }),
        [-165, -135, -105, -75, -45, -15].map((a) => (ce("path", { key: a, d: ray(32, 46, a, 19, 25), stroke: W, strokeWidth: "2.8", strokeLinecap: "round", className: "ab-twinkle", style: { animationDelay: `${(a + 165) / 300}s` } }))),
        ce("g", { className: "ab-bob" },
            ce("path", { d: "M42 12q4-5 8 0M50 12q4-5 8 0", stroke: W, strokeWidth: "2.6", strokeLinecap: "round", fill: "none" })))),
    ach_secret_rarity: (ce(Fragment, null,
        ce("polygon", { points: "14,10 50,10 60,26 32,58 4,26", fill: W, strokeLinejoin: "round", className: "ab-beat" }),
        ce("path", { d: "M4 26h56M22 10l-6 16 16 32M42 10l6 16-16 32M32 10l-10 16M32 10l10 16", stroke: D, strokeWidth: "2", strokeLinejoin: "round", fill: "none" }),
        ce(Dot, { x: 56, y: 8, r: 2, d: 0.3 }),
        ce(Dot, { x: 8, y: 8, r: 1.6, d: 0.9 }))),
    ach_secret_restyle: (ce(Fragment, null,
        ce("g", { className: "ab-spin", style: { animationDuration: "7s" } },
            ce("circle", { cx: "32", cy: "32", r: "26", fill: "none" }),
            ce("path", { d: "M12 32a20 20 0 0 1 34-14", stroke: W, strokeWidth: "3.4", strokeLinecap: "round", fill: "none" }),
            ce("polygon", { points: "53,24 40,25 48,12", fill: W }),
            ce("g", { transform: "rotate(180 32 32)" },
                ce("path", { d: "M12 32a20 20 0 0 1 34-14", stroke: W, strokeWidth: "3.4", strokeLinecap: "round", fill: "none" }),
                ce("polygon", { points: "53,24 40,25 48,12", fill: W }))),
        ce("circle", { cx: "32", cy: "32", r: "9", fill: W }),
        ce("circle", { cx: "28.5", cy: "30", r: "1.6", fill: DK }),
        ce("circle", { cx: "35.5", cy: "30", r: "1.6", fill: DK }),
        ce("path", { d: "M27.5 35q4.5 4 9 0", stroke: DK, strokeWidth: "1.8", strokeLinecap: "round", fill: "none" }))),
    /* ============ МЕДАЛИ (15) ============ */
    /* Первый сезон: сакура */
    ach_titles_1: (ce(Fragment, null,
        ce("g", { className: "ab-spin", style: { animationDuration: "24s" } },
            ce(Anchor, { r: 27 }),
            [0, 72, 144, 216, 288].map((a) => (ce("path", { key: a, d: "M32 32C24 24 24 12 32 6C40 12 40 24 32 32Z", fill: W, transform: `rotate(${a} 32 32)` })))),
        ce("circle", { cx: "32", cy: "32", r: "4", fill: D, className: "ab-beat" }),
        ce(Dot, { x: 8, y: 52, r: 1.8, d: 0.3 }),
        ce(Dot, { x: 56, y: 12, r: 1.6, d: 0.9 }))),
    /* Ночной дозор: полная луна */
    ach_night_10: (ce(Fragment, null,
        ce("g", { className: "ab-bob" },
            ce("circle", { cx: "32", cy: "32", r: "22", fill: W }),
            ce("circle", { cx: "24", cy: "26", r: "4.4", fill: D }),
            ce("circle", { cx: "39", cy: "36", r: "5.4", fill: D }),
            ce("circle", { cx: "26", cy: "43", r: "2.8", fill: D })),
        ce(Dot, { x: 8, y: 10, r: 1.8, d: 0.2 }),
        ce(Dot, { x: 56, y: 14, r: 1.5, d: 0.8 }),
        ce(Dot, { x: 54, y: 54, r: 1.6, d: 1.3 }))),
    /* Сэнпай: облако с точками */
    ach_comments_100: (ce("g", { className: "ab-bob" },
        ce("g", { transform: "translate(0 6)" },
            ce("path", { d: "M18 44a10 10 0 0 1-1-20 14 14 0 0 1 27-3 11 11 0 0 1 3 22Z", fill: W }),
            [24, 32, 40].map((x, i) => (ce("circle", { key: x, cx: x, cy: "34", r: "3", fill: D, className: "ab-type", style: { animationDelay: `${i * 0.18}s` } })))))),
    /* Лисья печать: маска кицунэ */
    ach_secret_0404: (ce(Fragment, null,
        ce("path", { d: "M8 10l14 8c6-2 14-2 20 0l14-8-4 22c-2 12-10 22-20 26-10-4-18-14-20-26Z", fill: W }),
        ce("g", { className: "ab-blink" },
            ce("path", { d: "M16 30l10 4M48 30l-10 4", stroke: DK, strokeWidth: "3.2", strokeLinecap: "round" })),
        ce("path", { d: "M14 40c4 0 7 2 9 5M50 40c-4 0-7 2-9 5", stroke: D, strokeWidth: "2.6", strokeLinecap: "round", fill: "none" }),
        ce("ellipse", { cx: "32", cy: "46", rx: "3.6", ry: "2.6", fill: DK }),
        ce("circle", { cx: "32", cy: "24", r: "3", fill: DK, className: "ab-beat" }))),
    /* Клинок тысячи серий: скрещённые катаны */
    ach_episodes_1000: (ce("g", { className: "ab-wobble" }, [45, -45].map((r) => (ce("g", { key: r, transform: `rotate(${r} 32 32)` },
        ce("rect", { x: "29", y: "2", width: "6", height: "40", rx: "3", fill: W }),
        ce("rect", { x: "22", y: "42", width: "20", height: "4", rx: "2", fill: W }),
        ce("rect", { x: "29.5", y: "46", width: "5", height: "14", rx: "2", fill: W }),
        ce("path", { d: "M32 7v30", stroke: D, strokeWidth: "1.6", strokeLinecap: "round" })))))),
    /* Клятва воина: меч */
    ach_genre_shonen: (ce(Fragment, null,
        ce("path", { d: "M32 3l6 7v31H26V10Z", fill: W }),
        ce("path", { d: "M32 11v26", stroke: D, strokeWidth: "2", strokeLinecap: "round", className: "ab-twinkle" }),
        ce("rect", { x: "17", y: "41", width: "30", height: "5", rx: "2.5", fill: W }),
        ce("rect", { x: "29.5", y: "46", width: "5", height: "11", rx: "2", fill: W }),
        ce("circle", { cx: "32", cy: "60", r: "3", fill: W }),
        ce(Dot, { x: 50, y: 12, r: 1.8, d: 0.4 }))),
    /* Хроноритм: часы за сутки */
    ach_chrono_day: (ce(Fragment, null,
        ce("circle", { cx: "32", cy: "32", r: "26", stroke: W, strokeWidth: "3" }),
        ce("circle", { cx: "32", cy: "32", r: "30", stroke: W, strokeWidth: "1.6", strokeDasharray: "2 4.3", className: "ab-dash" }),
        [...Array(12)].map((_, i) => (ce("path", { key: i, d: ray(32, 32, i * 30, 18, 22), stroke: W, strokeWidth: i % 3 === 0 ? 3 : 1.8, strokeLinecap: "round" }))),
        ce("g", { className: "ab-spin", style: { animationDuration: "40s" } },
            ce("circle", { cx: "32", cy: "32", r: "11", fill: "none" }),
            ce("path", { d: "M32 32V22", stroke: W, strokeWidth: "3.6", strokeLinecap: "round" })),
        ce("g", { className: "ab-spin", style: { animationDuration: "5s" } },
            ce("circle", { cx: "32", cy: "32", r: "16", fill: "none" }),
            ce("path", { d: "M32 32V16", stroke: W, strokeWidth: "2.6", strokeLinecap: "round" })),
        ce("circle", { cx: "32", cy: "32", r: "3", fill: W }))),
    /* Небесный эфир: серафим */
    ach_ratings_500: (ce(Fragment, null,
        ce("g", { className: "ab-wobble" },
            ce(Wing, { x: 28, y: 42, len: 15 })),
        ce("circle", { cx: "32", cy: "40", r: "5", fill: W }),
        ce("ellipse", { cx: "32", cy: "14", rx: "10", ry: "3.4", stroke: W, strokeWidth: "2.6", className: "ab-beat" }),
        ce("circle", { cx: "32", cy: "26", r: "5", fill: W }))),
    /* Звёздный странник: планета с кольцом и спутником */
    ach_genre_fantasy: (ce(Fragment, null,
        ce("g", { transform: "rotate(-22 32 32)" },
            ce("ellipse", { cx: "32", cy: "32", rx: "27", ry: "8", stroke: W, strokeWidth: "3.4" })),
        ce("circle", { cx: "32", cy: "32", r: "13", fill: W }),
        ce("path", { d: "M21 29c7 3 15 3 22-1", stroke: D, strokeWidth: "2", strokeLinecap: "round", fill: "none" }),
        ce("g", { className: "ab-spin", style: { animationDuration: "7s" } },
            ce(Anchor, { r: 27 }),
            ce("circle", { cx: "32", cy: "5", r: "3", fill: W })),
        ce(Dot, { x: 9, y: 10, r: 1.8, d: 0.2 }),
        ce(Dot, { x: 55, y: 54, r: 1.8, d: 0.8 }),
        ce(Dot, { x: 54, y: 12, r: 1.4, d: 1.3 }))),
    /* Врата ёкай: вертикальный зрачок */
    ach_secrets_all: (ce(Fragment, null,
        ce("g", { className: "ab-blink" },
            ce("path", { d: "M4 32C14 12 50 12 60 32C50 52 14 52 4 32Z", stroke: W, strokeWidth: "3.4", strokeLinejoin: "round" }),
            ce("circle", { cx: "32", cy: "32", r: "13", fill: W }),
            ce("ellipse", { cx: "32", cy: "32", rx: "3.6", ry: "11", fill: DK })),
        ce("path", { d: "M32 3v6M16 8l3 5M48 8l-3 5", stroke: W, strokeWidth: "2.6", strokeLinecap: "round", className: "ab-twinkle" }))),
    /* Пламя феникса */
    ach_streak_365: (ce(Fragment, null,
        ce("g", { className: "ab-wobble" },
            ce("path", { d: "M22 44C10 42 4 32 4 14C14 16 22 22 26 34Z", fill: W, opacity: ".9" }),
            ce("g", { transform: "translate(64 0) scale(-1 1)" },
                ce("path", { d: "M22 44C10 42 4 32 4 14C14 16 22 22 26 34Z", fill: W, opacity: ".9" }))),
        ce(Flame, { cx: 32, cy: 34, s: 0.85 }),
        ce(Dot, { x: 10, y: 52, r: 1.6, d: 0.3 }),
        ce(Dot, { x: 54, y: 52, r: 1.6, d: 0.9 }))),
    /* Хранитель врат: ключ */
    ach_seasons_all: (ce("g", { className: "ab-wobble" },
        ce("circle", { cx: "21", cy: "21", r: "12", stroke: W, strokeWidth: "5" }),
        ce("circle", { cx: "21", cy: "21", r: "4", fill: DK }),
        ce("path", { d: "M30 30l26 26M46 46l7-7M52 52l6-6", stroke: W, strokeWidth: "5", strokeLinecap: "round" }))),
    /* Лунная владычица: полумесяц с короной */
    ach_night_500: (ce(Fragment, null,
        ce("path", { d: "M30 10A22 22 0 1 0 52 32A22 22 0 0 1 30 10Z", fill: W, className: "ab-bob" }),
        ce("path", { d: "M38 24l-2-10 5 4 4-7 4 7 5-4-2 10Z", fill: W, className: "ab-beat" }),
        ce(Dot, { x: 52, y: 50, r: 1.8, d: 0.3 }),
        ce(Dot, { x: 12, y: 12, r: 1.6, d: 0.9 }))),
    /* Вечный зритель: бесконечность */
    ach_minutes_10000: (ce(Fragment, null,
        ce("path", { d: "M32 32C38 22 52 22 52 32C52 42 38 42 32 32C26 22 12 22 12 32C12 42 26 42 32 32Z", stroke: W, strokeWidth: "5.5", strokeLinejoin: "round", fill: "none" }),
        ce("path", { d: "M32 32C38 22 52 22 52 32C52 42 38 42 32 32C26 22 12 22 12 32C12 42 26 42 32 32Z", stroke: "rgba(120,90,220,.7)", strokeWidth: "2", strokeLinejoin: "round", fill: "none", strokeDasharray: "10 38", className: "ab-dash" }),
        ce(Dot, { x: 32, y: 11, r: 2.2, d: 0.2 }),
        ce(Dot, { x: 32, y: 53, r: 2.2, d: 0.9 }))),
    /* Император аниме: корона */
    ach_all_done: (ce(Fragment, null,
        ce("path", { d: "M8 46l-3-26 14 12 13-20 13 20 14-12-3 26Z", fill: W, className: "ab-beat" }),
        ce("rect", { x: "8", y: "48", width: "48", height: "7", rx: "3", fill: W }),
        ce("circle", { cx: "20", cy: "40", r: "2.8", fill: D }),
        ce("circle", { cx: "32", cy: "37", r: "3.2", fill: D }),
        ce("circle", { cx: "44", cy: "40", r: "2.8", fill: D }),
        ce(Dot, { x: 5, y: 10, r: 1.8, d: 0.2 }),
        ce(Dot, { x: 59, y: 10, r: 1.8, d: 0.8 }),
        ce(Dot, { x: 32, y: 6, r: 2, d: 1.3 }))),
};





export type RarityKey = "common" | "rare" | "epic" | "legendary" | "mythic" | "secret";

/** Описание медали: у медалей своя форма и свои цвета */
export type MedalMeta = {
  shape: keyof typeof SHAPES;
  lvl: number;
  lvlName: string;
  c1: string;
  c2: string;
  glow: string;
};

/** То, что рисует бейдж. Данные приходят из PROGRESSION_CONFIG */
export type BadgeItem = {
  id: string;
  name: string;
  rarity: RarityKey;
  medal?: MedalMeta;
};

const RARITY: Record<RarityKey, { name: string; c1: string; c2: string; c3: string; glow: string; fx: number }> = {
    common: { name: "Обычный", c1: "#34e0a1", c2: "#18a0ff", c3: "#d7ff6a", glow: "52,224,161", fx: 1 },
    rare: { name: "Редкий", c1: "#38b6ff", c2: "#7a7dff", c3: "#6ef0ff", glow: "56,182,255", fx: 3 },
    epic: { name: "Эпический", c1: "#b06bff", c2: "#ff5fd2", c3: "#ffd0ff", glow: "176,107,255", fx: 4 },
    legendary: { name: "Легендарный", c1: "#ffd04d", c2: "#ff8a1f", c3: "#fff3a0", glow: "255,208,77", fx: 6 },
    mythic: { name: "Мифический", c1: "#6cf0ff", c2: "#ff6bd6", c3: "#ffd04d", glow: "108,240,255", fx: 7 },
    /* в палитре сайта SECRET нет (там он падает в common), здесь у него свой тёмно-фиолетовый цвет */
    secret: { name: "Секретный", c1: "#d6a8ff", c2: "#5b21b6", c3: "#ffd0ff", glow: "170,110,255", fx: 5 },
};

const poly = (p: string): string => "M" + p.split(" ").join("L") + "Z";
const SHAPES = {
    hex: { d: poly(pts(48, 52, 3, 44, 44)), inner: 0.82, sc: 0.75, ring: "hex" },
    shield: { d: "M48 8L84 20V52C84 74 68 90 48 98C28 90 12 74 12 52V20Z", inner: 0.78, sc: 0.66, ring: "circle" },
    circle: { d: "M4 52a44 44 0 1 0 88 0a44 44 0 1 0 -88 0Z", inner: 0.8, sc: 0.7, ring: "circle" },
    wing: { d: "M12 88C8 56 22 26 52 8C58 24 70 32 86 32C82 64 60 86 12 88Z", inner: 0.74, sc: 0.62, ring: "circle" },
    rhombus: { d: "M48 6L88 52L48 98L8 52Z", inner: 0.72, sc: 0.58, ring: "circle" },
    star8: { d: poly(pts(48, 52, 8, 46, 31)), inner: 0.74, sc: 0.6, ring: "circle" },
    vesica: { d: "M48 6C80 26 80 78 48 98C16 78 16 26 48 6Z", inner: 0.74, sc: 0.62, ring: "circle" },
    arch: { d: "M12 98V50C12 26 28 8 48 8S84 26 84 50V98Z", inner: 0.78, sc: 0.64, ring: "circle" },
    star4: { d: poly(pts(48, 52, 4, 46, 20)), inner: 0.72, sc: 0.56, ring: "circle" },
    octagon: { d: poly(pts(48, 52, 4, 44, 44, -67.5)), inner: 0.8, sc: 0.7, ring: "circle" },
    star12: { d: poly(pts(48, 52, 12, 47, 36)), inner: 0.76, sc: 0.6, ring: "circle" },
};

const GLOW_PX = [8, 10, 13, 17, 21, 26, 32];
const RIM = [1, 1.2, 1.5, 1.8, 2.2, 2.6, 3];
const SPARKS = [0, 2, 3, 4, 6, 8, 10];
const WAVES = [0, 0, 0, 1, 1, 2, 2];
const ORBIT = [0, 0, 0, 2, 3, 4, 6];
/** Редкость → подпись, цвет и число слоёв */
export const RARITY_INFO: Record<RarityKey, { name: string; fx: number; glow: string }> = {
  common: { name: "Обычный", fx: 1, glow: "52,224,161" },
  rare: { name: "Редкий", fx: 3, glow: "56,182,255" },
  epic: { name: "Эпический", fx: 4, glow: "176,107,255" },
  legendary: { name: "Легендарный", fx: 6, glow: "255,208,77" },
  mythic: { name: "Мифический", fx: 7, glow: "108,240,255" },
  secret: { name: "Секретный", fx: 5, glow: "170,110,255" },
};

/** Бейдж достижения. Данные — из PROGRESSION_CONFIG, начертание — из макета */
export function AchievementBadge({ item, size = 96, locked = false }: { item: BadgeItem; size?: number; locked?: boolean }) {
    const R = RARITY[item.rarity];
    const md = item.medal;
    const shape = SHAPES[md?.shape ?? "hex"];
    const c1 = md?.c1 ?? R.c1;
    const c2 = md?.c2 ?? R.c2;
    const c3 = md ? "#ffffff" : R.c3;
    const glow = md?.glow ?? R.glow;
    const fx = md ? Math.min(7, md.lvl) : R.fx;
    const i = fx - 1;
    const uid = useId().replace(/:/g, "");
    const f = `${uid}f`;
    const g = `${uid}g`;
    const h = `${uid}h`;
    const c = `${uid}c`;
    const [box, setBox] = useState<HTMLDivElement | null>(null);
    const mx = useMotionValue(0);
    const my = useMotionValue(0);
    const sx = useSpring(mx, { stiffness: 200, damping: 18 });
    const sy = useSpring(my, { stiffness: 200, damping: 18 });
    const rotateY = useTransform(sx, [-0.5, 0.5], [-18, 18]);
    const rotateX = useTransform(sy, [-0.5, 0.5], [18, -18]);
    const gx = useTransform(sx, [-0.5, 0.5], ["0%", "100%"]);
    const gy = useTransform(sy, [-0.5, 0.5], ["0%", "100%"]);
    const glare = useTransform([gx, gy], ([x, y]) => `radial-gradient(circle at ${x} ${y}, rgba(255,255,255,.45), transparent 55%)`);
    const move = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!box) return;
        const r = box.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width - 0.5);
        my.set((e.clientY - r.top) / r.height - 0.5);
    };
    const leave = () => {
        mx.set(0);
        my.set(0);
    };
    /* маска по контуру формы: блик и голограмма не вылезают за края */
    const maskUrl = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 104' preserveAspectRatio='none'><path d='${shape.d}'/></svg>`)}")`;
    const maskStyle = {
        WebkitMaskImage: maskUrl,
        maskImage: maskUrl,
        WebkitMaskSize: "100% 100%",
        maskSize: "100% 100%",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
    };
    const vars = {
        "--s": `${size}px`,
        "--c1": c1,
        "--c2": c2,
        "--c3": c3,
        "--glow": glow,
        "--gs": `${GLOW_PX[i]}px`,
        "--ai": `${-(14 + fx * 3)}%`,
    };
    const inner = `translate(48 52) scale(${shape.inner}) translate(-48 -52)`;
    const orbitN = ORBIT[i];
    return (ce("div", { ref: setBox, className: `ab ab-l${fx} ${locked ? "ab-locked" : ""}`, style: vars, onMouseMove: move, onMouseLeave: leave },

        ce("div", { className: "ab-aura" }),
        orbitN > 0 && (ce("span", { className: "ab-orbit" }, [...Array(orbitN)].map((_, k) => (ce("i", { key: k, style: { "--r": `${(k * 360) / orbitN}deg`, "--d": `${k % 2 ? 3 : 5}px` } }))))),
        ce(motion.div, { className: "ab-medal", style: { rotateX, rotateY, transformStyle: "preserve-3d" }, initial: { scale: 0.6, opacity: 0, rotate: -12 }, animate: { scale: 1, opacity: 1, rotate: 0 }, transition: { type: "spring", stiffness: 140, damping: 12 } },
            ce("svg", { viewBox: "0 0 96 104", fill: "none" },
                ce("defs", null,
                    ce("linearGradient", { id: f, x1: "0", y1: "0", x2: "1", y2: "1" },
                        ce("stop", { offset: "0", stopColor: c1 }),
                        ce("stop", { offset: ".55", stopColor: c2 }),
                        ce("stop", { offset: "1", stopColor: "#0b0a14" })),
                    ce("radialGradient", { id: g, cx: ".5", cy: ".35", r: ".8" },
                        ce("stop", { offset: "0", stopColor: c2, stopOpacity: ".6" }),
                        ce("stop", { offset: "1", stopColor: "#07060f" })),
                    ce("linearGradient", { id: h, x1: "0", y1: "0", x2: "1", y2: "0" },
                        ce("stop", { offset: "0", stopColor: "#fff", stopOpacity: "0" }),
                        ce("stop", { offset: ".5", stopColor: "#fff", stopOpacity: ".55" }),
                        ce("stop", { offset: "1", stopColor: "#fff", stopOpacity: "0" })),
                    ce("clipPath", { id: c },
                        ce("path", { d: shape.d, transform: inner }))),
                [...Array(WAVES[i])].map((_, k) => (ce("path", { key: k, className: "ab-wave", d: shape.d, stroke: c1, strokeWidth: "1.6", strokeLinejoin: "round", style: { animationDelay: `${k * 1.5}s` } }))),
                fx >= 5 &&
                    (shape.ring === "hex" ? (ce("polygon", { className: "ab-hexring ab-hexring2", points: pts(48, 52, 3, 51, 51), stroke: c1, strokeOpacity: ".5", strokeWidth: "1", strokeDasharray: "1 6", strokeLinecap: "round" })) : (ce("circle", { className: "ab-hexring ab-hexring2", cx: "48", cy: "52", r: "54", stroke: c1, strokeOpacity: ".5", strokeWidth: "1", strokeDasharray: "1 6", strokeLinecap: "round" }))),
                shape.ring === "hex" ? (ce("polygon", { className: "ab-hexring", points: pts(48, 52, 3, 48, 48), stroke: c1, strokeOpacity: ".55", strokeWidth: "1", strokeDasharray: "3 5" })) : (ce("circle", { className: "ab-hexring", cx: "48", cy: "52", r: "50", stroke: c1, strokeOpacity: ".55", strokeWidth: "1", strokeDasharray: "3 5" })),
                ce("path", { d: shape.d, fill: `url(#${f})`, stroke: c3, strokeOpacity: 0.3 + fx * 0.07, strokeWidth: RIM[i], strokeLinejoin: "round" }),
                ce("g", { transform: inner },
                    ce("path", { d: shape.d, fill: `url(#${g})`, stroke: "rgba(255,255,255,.4)", strokeWidth: "1.2", strokeLinejoin: "round", vectorEffect: "non-scaling-stroke" })),
                ce("g", { clipPath: `url(#${c})` },
                    ce("ellipse", { cx: "48", cy: "30", rx: "30", ry: "16", fill: "#fff", opacity: ".1" }),
                    ce("g", { transform: "rotate(20 48 52)" },
                        ce("rect", { className: "ab-sh", x: "-40", y: "0", width: "26", height: "110", fill: `url(#${h})` }))),
                ce("g", { className: "ab-ico", transform: `translate(${48 - 32 * shape.sc} ${52 - 32 * shape.sc}) scale(${shape.sc})` }, ICONS[item.id])),
            fx >= 6 && ce("span", { className: "ab-holo", style: maskStyle }),
            ce(motion.span, { className: "ab-glare", style: { background: glare, ...maskStyle } })),
        [...Array(SPARKS[i])].map((_, k) => (ce("span", { key: k, className: "ab-spark", style: {
                left: `${12 + ((k * 37) % 76)}%`,
                animationDelay: `${(k * 0.45) % 3.2}s`,
                animationDuration: `${2.6 + (k % 4) * 0.5}s`,
            } }))),
        fx >= 5 && ce("span", { className: "ab-glint" }),
        fx >= 7 && ce("span", { className: "ab-glint ab-glint2" })));
}
