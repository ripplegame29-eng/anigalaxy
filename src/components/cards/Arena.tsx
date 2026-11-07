"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BattleEvent, BattleOutcome, StatusKind, Unit } from "@/lib/cards/battle";
import { ENERGY, ULTIMATES, passiveDef, skillDef, type SkillFx } from "@/lib/cards/skills";
import { CLASSES, ELEMENTS, RANKS } from "@/lib/cards/config";
import type { Synergy } from "@/lib/cards/synergy";
import { GameCard } from "./GameCard";
import { Portal } from "./common";
import { SkillGlyph, SynChips, TARGET_LABEL } from "./skillui";
import { Cur, Ico, type IcoName } from "./icons";
import { ArenaRule, RelicTile } from "./gearui";
import { RARITY, boosterDef, relicDef, type Drops, type GearInfo } from "@/lib/cards/gear";
import { fmt } from "./common";

export interface BattleReport {
  outcome: BattleOutcome;
  you: Unit[];
  foe: Unit[];
  foeName: string;
  foeRating: number;
  pvp: boolean;
  youSyn?: Synergy[];
  foeSyn?: Synergy[];
  win: boolean;
  reward: { diamonds: number; dust: number; rating: number; scroll: number };
  rating: number;
  training: boolean;
  title?: string;
  campaign?: { chapter: number; stage: number; stars: number; best: number; newStars: number; firstClear: boolean; reward: { diamonds?: number; dust?: number; packs?: number; scroll?: number } };
  raid?: { damage: number; maxPerFight: number; poolHp: number; poolMax: number; hitsLeft: number; defeated: boolean };
  /** Правило арены дня, снаряжение сторон и добыча (в старых записях нет) */
  arena?: string;
  youGear?: GearInfo;
  foeGear?: GearInfo;
  drops?: Drops;
}

interface UV {
  hp: number;
  sh: number;
  st: StatusKind[];
  en: number;
}
interface Float {
  id: number;
  key: string;
  text: string;
  kind: "dmg" | "crit" | "big" | "heal" | "shield" | "dot" | "info";
}
/** Снаряд умения: путь от кастера к цели в координатах поля */
interface Proj {
  id: number;
  fx: SkillFx;
  kind: ProjKind;
  x0: number;
  y0: number;
  len: number;
  ang: number;
  ms: number;
  dl: number;
  rev?: boolean;
}
type ProjKind = "orb" | "streak" | "needle" | "blade" | "beam" | "fall" | "shard" | "wisp" | "mote" | "glob" | "rock";
interface Cine {
  n: number;
  fx: SkillFx;
  name: string;
  who: string;
  cls: string;
}

/** Какой снаряд летит от кастера к цели и как долго (мс); без записи — эффект только на цели */
const PROJ: Partial<Record<SkillFx, { k: ProjKind; ms: number }>> = {
  slash: { k: "streak", ms: 240 },
  pierce: { k: "needle", ms: 260 },
  whirl: { k: "blade", ms: 420 },
  wind: { k: "blade", ms: 380 },
  burst: { k: "orb", ms: 460 },
  fire: { k: "orb", ms: 440 },
  rain: { k: "fall", ms: 420 },
  ice: { k: "shard", ms: 380 },
  debuff: { k: "wisp", ms: 520 },
  drain: { k: "wisp", ms: 480 },
  dark: { k: "wisp", ms: 560 },
  heal: { k: "mote", ms: 560 },
  poison: { k: "glob", ms: 520 },
  beam: { k: "beam", ms: 460 },
  earth: { k: "rock", ms: 420 },
};
/** Тяжёлые умения трясут поле при ударе */
const HEAVY: SkillFx[] = ["burst", "quake", "earth", "dark", "fire"];

const STATUS_ICO: Record<StatusKind, { ico: IcoName; label: string }> = {
  stun: { ico: "clock", label: "Оглушён" },
  burn: { ico: "fire", label: "Горение" },
  atkUp: { ico: "bolt", label: "Атака +" },
  defDown: { ico: "shield", label: "Защита −" },
  taunt: { ico: "ban", label: "Провокация" },
  shield: { ico: "shield", label: "Щит" },
};

const reduced = (): boolean => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};

const ecoOn = (): boolean => {
  try {
    return document.documentElement.getAttribute("data-eco") === "on";
  } catch {
    return false;
  }
};

const FX_KEY = "ag:arena:fx";
const readFx = (): "full" | "lite" => {
  try {
    return localStorage.getItem(FX_KEY) === "lite" ? "lite" : "full";
  } catch {
    return "full";
  }
};

/** Кто действует в каждом событии: из этого строится шкала очереди ходов */
function actorOf(e: BattleEvent): string | null {
  if (e.t === "cast") return e.from;
  if (e.t === "skip") return e.from;
  if (e.t === "hit" && !e.skill) return e.from;
  return null;
}

export function Arena({ report, onClose }: { report: BattleReport; onClose: () => void }) {
  const events = report.outcome.events;
  const all = [...report.you, ...report.foe];
  const info = useRef(new Map(all.map((u) => [u.key, u])));
  const [step, setStep] = useState(0);
  const [delay, setDelay] = useState(700);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const [uv, setUv] = useState<Record<string, UV>>(() => Object.fromEntries(all.map((u) => [u.key, { hp: u.maxHp, sh: 0, st: [], en: u.passive === "p-swift" ? 30 : 0 }])));
  const [floats, setFloats] = useState<Float[]>([]);
  const [fx, setFx] = useState<Record<string, { fx: SkillFx; n: number }>>({});
  const [aura, setAura] = useState<Record<string, { fx: SkillFx; n: number; ult: boolean }>>({});
  const [projs, setProjs] = useState<Proj[]>([]);
  const [cine, setCine] = useState<Cine | null>(null);
  const [shk, setShk] = useState<"lite" | "heavy" | null>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const [acting, setActing] = useState<Record<string, "cast" | "atk">>({});
  const [hit, setHit] = useState<Record<string, { n: number; crit: boolean }>>({});
  const [banner, setBanner] = useState<{ who: string; name: string; tg: string; fx: SkillFx; n: number; ult: boolean } | null>(null);
  const [flash, setFlash] = useState<SkillFx | "crit" | "ult" | null>(null);
  const [round, setRound] = useState(1);
  const [intro, setIntro] = useState(() => !reduced() && !ecoOn() && events.length > 0);
  const [combo, setCombo] = useState<{ side: "a" | "b"; n: number; id: number } | null>(null);
  const comboRef = useRef<{ side: "a" | "b"; n: number } | null>(null);
  const maxCombo = useRef({ a: 0, b: 0 });
  const [kill, setKill] = useState<{ key: string; n: number; last: boolean } | null>(null);
  const alive = useRef({ a: report.you.length, b: report.foe.length });
  const [log, setLog] = useState<string[]>([]);
  const counter = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const done = step >= events.length;
  const [fxq, setFxq] = useState<"full" | "lite">(() => (typeof window === "undefined" ? "full" : readFx()));
  const calm = useRef(reduced() || fxq === "lite");
  calm.current = reduced() || fxq === "lite";
  const [paused, setPaused] = useState(false);
  const [infoKey, setInfoKey] = useState<string | null>(null);
  const [turn, setTurn] = useState<{ from: string; targets: string[]; n: number } | null>(null);
  /* очередь ходов: порядок действующих героев по событиям симуляции (скорость уже учтена движком) */
  const queue = useMemo(() => {
    const actors: { key: string; at: number }[] = [];
    events.forEach((e, i) => {
      const a = actorOf(e);
      if (a && actors[actors.length - 1]?.key !== a) actors.push({ key: a, at: i });
    });
    return actors;
  }, [events]);

  useEffect(() => {
    const list = timers.current;
    return () => list.forEach(clearTimeout);
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  useEffect(() => {
    if (!intro) return;
    const t = setTimeout(() => setIntro(false), 3200);
    return () => clearTimeout(t);
  }, [intro]);

  const nameOf = (key: string) => info.current.get(key)?.name ?? "?";
  const say = (t: string) => setLog((p) => [...p.slice(-5), t]);

  const addFloat = useCallback(
    (key: string, text: string, kind: Float["kind"]) => {
      const id = ++counter.current;
      setFloats((p) => [...p.slice(-12), { id, key, text, kind }]);
      later(() => setFloats((p) => p.filter((f) => f.id !== id)), 1300);
    },
    [later],
  );
  const act = useCallback(
    (key: string, kind: "cast" | "atk", ms = 650) => {
      setActing((p) => ({ ...p, [key]: kind }));
      later(() => setActing((p) => (p[key] === kind ? Object.fromEntries(Object.entries(p).filter(([k]) => k !== key)) : p)), ms);
    },
    [later],
  );
  const shake = useCallback(
    (key: string, crit = false) => {
      const n = ++counter.current;
      setHit((p) => ({ ...p, [key]: { n, crit } }));
      later(() => setHit((p) => (p[key]?.n === n ? Object.fromEntries(Object.entries(p).filter(([k]) => k !== key)) : p)), 560);
    },
    [later],
  );
  const burst = useCallback(
    (keys: string[], f: SkillFx) => {
      const n = ++counter.current;
      setFx((p) => ({ ...p, ...Object.fromEntries(keys.map((k) => [k, { fx: f, n }])) }));
    },
    [],
  );
  const shakeField = useCallback(
    (k: "lite" | "heavy") => {
      setShk(k);
      later(() => setShk(null), k === "heavy" ? 620 : 380);
    },
    [later],
  );
  /** Центр карты героя в координатах поля боя */
  const centerOf = (key: string): { x: number; y: number } | null => {
    const f = fieldRef.current;
    const el = f?.querySelector(`[data-uk="${key}"]`);
    if (!f || !el) return null;
    const a = f.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    return { x: b.left - a.left + b.width / 2, y: b.top - a.top + b.height / 2 };
  };
  /** Запускает снаряды от кастера к целям; возвращает время полёта (мс) */
  const launch = (from: string, targets: string[], f: SkillFx): number => {
    const cfg = PROJ[f];
    const src = centerOf(from);
    if (!cfg || !src) return 0;
    const list: Proj[] = [];
    targets.forEach((t, i) => {
      if (t === from) return;
      const dst = centerOf(t);
      if (!dst) return;
      const base = { fx: f, kind: cfg.k, ms: cfg.ms, dl: i * 70 };
      if (cfg.k === "fall") {
        for (let j = 0; j < 3; j++) {
          const x = dst.x + (j - 1) * 26;
          list.push({ ...base, id: ++counter.current, x0: x, y0: dst.y - 190, len: 190, ang: 90, dl: i * 70 + j * 70 });
        }
        return;
      }
      const dx = dst.x - src.x;
      const dy = dst.y - src.y;
      const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
      const len = Math.hypot(dx, dy);
      list.push({ ...base, id: ++counter.current, x0: src.x, y0: src.y, len, ang });
      if (f === "drain") list.push({ ...base, id: ++counter.current, x0: dst.x, y0: dst.y, len, ang: ang + 180, dl: cfg.ms + i * 70, rev: true });
      if (f === "heal" || f === "whirl") list.push({ ...base, id: ++counter.current, x0: src.x, y0: src.y, len, ang: ang + (i % 2 ? 6 : -6), dl: i * 70 + 90 });
    });
    if (!list.length) return 0;
    setProjs((p) => [...p.slice(-14), ...list]);
    const ids = new Set(list.map((x) => x.id));
    later(() => setProjs((p) => p.filter((x) => !ids.has(x.id))), cfg.ms + Math.max(...list.map((x) => x.dl)) + 700);
    return cfg.ms;
  };
  const flashScreen = useCallback(
    (f: SkillFx | "crit" | "ult") => {
      setFlash(f);
      later(() => setFlash(null), 520);
    },
    [later],
  );

  const patch = (key: string, fn: (u: UV) => UV) => setUv((p) => ({ ...p, [key]: fn(p[key] ?? { hp: 0, sh: 0, st: [], en: 0 }) }));

  const gearReviveLabel = (key: string): string => {
    const gi = info.current.get(key)?.side === "a" ? report.youGear : report.foeGear;
    if (gi?.relics.some((r) => r.id === "r-phoenix")) return relicDef("r-phoenix")?.name ?? "Феникс";
    return boosterDef(gi?.booster ?? "")?.name ?? "Возрождение";
  };
  /** Добивание: замедление и «кадр победы»; возвращает длительность события */
  const knockout = (key: string): number => {
    const sd = info.current.get(key)?.side ?? "a";
    alive.current[sd] -= 1;
    const last = alive.current[sd] <= 0;
    const n = ++counter.current;
    setKill({ key, n, last });
    later(() => setKill((p) => (p?.n === n ? null : p)), last ? 2200 : 1100);
    if (last) {
      shakeField("heavy");
      flashScreen("ult");
    }
    return calm.current || ecoOn() ? 600 : last ? 2000 : 1150;
  };

  /** Проигрывает событие, возвращает его длительность (мс) */
  const play = (e: BattleEvent): number => {
    setRound(Math.max(1, e.round));
    switch (e.t) {
      case "cast": {
        const sk = skillDef(e.skill);
        const ult = !!e.ult;
        const who = nameOf(e.from);
        const nm = sk?.name ?? e.skill;
        say(`${who} применяет ${ult ? "УЛЬТИМЕЙТ " : ""}«${nm}»`);
        const lite = calm.current || ecoOn();
        const casterCls = info.current.get(e.from)?.cls;
        const n = ++counter.current;
        setTurn({ from: e.from, targets: e.targets.filter((x) => x !== e.from), n });
        setAura((p) => ({ ...p, [e.from]: { fx: e.fx, n, ult } }));
        later(() => setAura((p) => (p[e.from]?.n === n ? Object.fromEntries(Object.entries(p).filter(([k]) => k !== e.from)) : p)), ult ? 2300 : 1000);
        setBanner({ who, name: nm, tg: sk ? TARGET_LABEL[sk.target] : "", fx: e.fx, n, ult });
        /* момент удара: после полёта снаряда (ультимейт — после кинематографа) */
        const impact = (fl: number) => {
          e.targets.forEach((t, i) => later(() => burst([t], e.fx), fl + i * 70));
          later(() => {
            flashScreen(ult ? "ult" : e.fx);
            if (ult || HEAVY.includes(e.fx)) shakeField("heavy");
            else if (e.fx === "slash" || e.fx === "pierce" || e.fx === "whirl") shakeField("lite");
          }, fl);
        };
        if (ult) {
          act(e.from, "cast", 2300);
          if (!lite) {
            setCine({ n, fx: e.fx, name: nm, who, cls: casterCls ?? "" });
            later(() => setCine((p) => (p?.n === n ? null : p)), 2500);
          }
          const at = lite ? 0 : 1050;
          later(() => impact(launch(e.from, e.targets, e.fx)), at);
          return lite ? 1500 : 2700;
        }
        act(e.from, "cast", 900);
        if (lite) {
          burst(e.targets, e.fx);
          flashScreen(e.fx);
          return 950;
        }
        /* короткий замах кастера, затем снаряд */
        later(() => impact(launch(e.from, e.targets, e.fx)), 180);
        return 1100 + (PROJ[e.fx]?.ms ?? 0);
      }
      case "hit": {
        patch(e.to, (u) => ({ ...u, hp: e.hp, sh: e.sh, st: e.dead ? [] : u.st }));
        {
          const maxHp = info.current.get(e.to)?.maxHp ?? 1;
          addFloat(e.to, `−${e.dmg - e.absorbed > 0 ? e.dmg - e.absorbed : e.dmg}`, e.crit ? "crit" : e.dmg >= maxHp * 0.22 ? "big" : "dmg");
        }
        if (e.absorbed > 0) addFloat(e.to, `щит −${e.absorbed}`, "shield");
        if (e.skill !== "p-thorns") {
          const sd = info.current.get(e.from)?.side;
          if (sd) {
            const cur = comboRef.current;
            const n = cur && cur.side === sd ? cur.n + 1 : 1;
            comboRef.current = { side: sd, n };
            maxCombo.current[sd] = Math.max(maxCombo.current[sd], n);
            const cid = ++counter.current;
            if (n >= 3) {
              setCombo({ side: sd, n, id: cid });
              later(() => setCombo((p) => (p?.id === cid ? null : p)), 2400);
            } else setCombo(null);
          }
        }
        shake(e.to, e.crit);
        if (!e.skill) setTurn({ from: e.from, targets: [e.to], n: ++counter.current });
        if (!e.skill) {
          act(e.from, "atk", 600);
          burst([e.to], "slash");
        }
        if (e.crit) {
          flashScreen("crit");
          shakeField("lite");
        }
        say(`${nameOf(e.from)} → ${nameOf(e.to)}: −${e.dmg}${e.skill === "p-thorns" ? " (шипы)" : ""}${e.crit ? " (крит)" : ""}${e.dead ? ", повержен" : ""}`);
        if (e.dead) return knockout(e.to);
        return e.skill ? 480 : 720;
      }
      case "heal":
        patch(e.to, (u) => ({ ...u, hp: e.hp }));
        addFloat(e.to, `+${e.amount}`, "heal");
        if (e.skill === "g-vamp") return 140;
        if (!e.skill) {
          act(e.from, "cast", 700);
          burst([e.to], "heal");
        }
        say(`${nameOf(e.from)} лечит ${nameOf(e.to)}: +${e.amount}`);
        return e.skill ? 420 : 700;
      case "shield":
        patch(e.to, (u) => ({ ...u, sh: e.amount, st: u.st.includes("shield") ? u.st : [...u.st, "shield"] }));
        addFloat(e.to, `щит ${e.amount}`, "shield");
        return e.round === 0 ? 70 : 420;
      case "status":
        patch(e.to, (u) => ({ ...u, st: e.on ? (u.st.includes(e.kind) ? u.st : [...u.st, e.kind]) : u.st.filter((k) => k !== e.kind), sh: e.kind === "shield" && !e.on ? 0 : u.sh }));
        if (e.on) addFloat(e.to, STATUS_ICO[e.kind].label, "info");
        return e.on ? 260 : 120;
      case "dot":
        patch(e.to, (u) => ({ ...u, hp: e.hp, sh: e.sh, st: e.dead ? [] : u.st }));
        addFloat(e.to, `−${e.dmg}`, "dot");
        burst([e.to], "fire");
        say(`${nameOf(e.to)} получает урон от горения: −${e.dmg}`);
        if (e.dead) return knockout(e.to);
        return 560;
      case "energy":
        patch(e.to, (u) => ({ ...u, en: e.en }));
        return 0;
      case "revive": {
        patch(e.to, (u) => ({ ...u, hp: e.hp }));
        alive.current[info.current.get(e.to)?.side ?? "a"] += 1;
        const label = e.src === "gear" ? gearReviveLabel(e.to) : passiveDef("p-revive")?.name ?? "Второе дыхание";
        addFloat(e.to, label, "heal");
        burst([e.to], "heal");
        flashScreen("heal");
        say(`${nameOf(e.to)} возвращается в бой: «${label}»`);
        return 1000;
      }
      case "skip":
        setTurn({ from: e.from, targets: [], n: ++counter.current });
        addFloat(e.from, "Пропуск хода", "info");
        say(`${nameOf(e.from)} оглушён и пропускает ход`);
        return 600;
    }
  };

  useEffect(() => {
    if (done || intro || paused || infoKey) return;
    const t = setTimeout(() => {
      const dur = play(events[step]);
      setDelay(calm.current ? 160 : dur / speed);
      setStep((s) => s + 1);
    }, delay / (step === 0 ? speed : 1));
    return () => clearTimeout(t);
    // play зависит только от стабильных колбэков и состояния отображения
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, done, speed, intro, paused, infoKey]);

  const resRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => resRef.current?.scrollIntoView({ behavior: calm.current ? "auto" : "smooth", block: "start" }), calm.current ? 0 : 450);
    return () => clearTimeout(t);
  }, [done]);

  const skip = () => {
    const final: Record<string, UV> = {};
    [...report.outcome.a, ...report.outcome.b].forEach((u) => (final[u.key] = { hp: u.hp, sh: 0, st: [], en: 0 }));
    setUv(final);
    setFloats([]);
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setActing({});
    setHit({});
    setShk(null);
    setFlash(null);
    setBanner(null);
    setCine(null);
    setProjs([]);
    setAura({});
    setFx({});
    setRound(report.outcome.rounds);
    setIntro(false);
    setKill(null);
    setCombo(null);
    setTurn(null);
    setPaused(false);
    setStep(events.length);
  };

  const stats = useMemo(() => {
    const per = new Map<string, { dmg: number; heal: number; crits: number; kills: number; best: number }>();
    const get = (k: string) => {
      let v = per.get(k);
      if (!v) per.set(k, (v = { dmg: 0, heal: 0, crits: 0, kills: 0, best: 0 }));
      return v;
    };
    const side = { a: { dmg: 0, crits: 0, kills: 0, best: 0, heal: 0 }, b: { dmg: 0, crits: 0, kills: 0, best: 0, heal: 0 } };
    const sideOf = new Map(all.map((u) => [u.key, u.side]));
    for (const e of events) {
      if (e.t === "hit") {
        const sd = sideOf.get(e.from);
        if (!sd) continue;
        const v = get(e.from);
        v.dmg += e.dmg;
        v.best = Math.max(v.best, e.dmg);
        side[sd].dmg += e.dmg;
        side[sd].best = Math.max(side[sd].best, e.dmg);
        if (e.crit) {
          v.crits += 1;
          side[sd].crits += 1;
        }
        if (e.dead) {
          v.kills += 1;
          side[sd].kills += 1;
        }
      } else if (e.t === "heal") {
        const sd = sideOf.get(e.from);
        if (!sd) continue;
        get(e.from).heal += e.amount;
        side[sd].heal += e.amount;
      }
    }
    let mvp: { key: string; score: number } | null = null;
    for (const u of report.you) {
      const v = per.get(u.key);
      if (!v) continue;
      const score = v.dmg + v.heal * 0.7 + v.kills * 140;
      if (!mvp || score > mvp.score) mvp = { key: u.key, score };
    }
    return { per, side, mvp: mvp ? { u: report.you.find((u) => u.key === mvp!.key)!, ...per.get(mvp.key)! } : null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  const teamHp = (us: Unit[]) => us.reduce((a, u) => a + Math.max(0, uv[u.key]?.hp ?? 0), 0);
  const teamPct = (us: Unit[]) => {
    const mx = us.reduce((a, u) => a + u.maxHp, 0);
    return mx ? Math.max(0, Math.min(100, (teamHp(us) / mx) * 100)) : 0;
  };

  const side = (units: Unit[], s: "a" | "b") => (
    <div className={`ar-side ${s}`}>
      {units.map((u) => {
        const v = uv[u.key];
        const dead = v.hp <= 0;
        const f = fx[u.key];
        const au = aura[u.key];
        const ht = hit[u.key];
        const stc = v.st.map((k) => `st-${k}`).join(" ");
        return (
          <div key={u.key} role="button" tabIndex={0} aria-label={`${u.name}: подробнее`} onClick={() => setInfoKey(u.key)} onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && setInfoKey(u.key)}
            className={`ar-unit ${!done && turn?.from === u.key && !dead ? "is-turn" : ""} ${!done && turn?.targets.includes(u.key) && !dead ? "is-target" : ""} ${!dead && v.hp / u.maxHp < 0.35 ? "is-low" : ""} ${v.st.some((k) => k === "atkUp" || k === "shield") ? "has-buff" : ""} ${v.st.some((k) => k === "burn" || k === "defDown" || k === "stun") ? "has-debuff" : ""} ${dead ? "dead" : ""} ${acting[u.key] ? `act-${acting[u.key]}` : ""} ${ht ? "hit" : ""} ${ht?.crit ? "crit" : ""} ${v.en >= ENERGY.max && !dead ? "ult-ready" : ""} ${kill?.key === u.key ? "kc" : ""} ${stc}`} style={{ ["--dir" as string]: s === "a" ? 1 : -1 }}>
            <div className="ar-card" data-uk={u.key}>
              {!done && turn?.from === u.key && !dead && <span key={`t${turn.n}`} className="ar-turnmark" aria-hidden>ХОД</span>}
              {!done && turn?.targets.includes(u.key) && !dead && <span key={`r${turn.n}`} className="ar-reticle" aria-hidden><i /><i /><i /><i /></span>}
              {au && !dead && (
                <span key={au.n} className={`ar-aura fx-c-${au.fx} ${au.ult ? "ult" : ""}`} aria-hidden>
                  <i />
                  <i />
                  <i />
                </span>
              )}
              <GameCard cardId={u.cardId} foil={u.foil} level={u.level} stats={false} />
              <span className="ar-stfx" aria-hidden />
              {f && (
                <span key={f.n} className={`ar-fx fx-${f.fx}`} aria-hidden>
                  <i />
                  <b />
                  <u />
                </span>
              )}
              <span key={`h${ht?.n ?? 0}`} className="ar-hitfx" aria-hidden />
              {kill?.key === u.key && (
                <span key={kill.n} className="ar-ko" aria-hidden>
                  K.O.
                </span>
              )}
            </div>
            <div className={`ar-hp ${v.hp / u.maxHp < 0.35 ? "low" : ""}`} role="progressbar" aria-valuemin={0} aria-valuemax={u.maxHp} aria-valuenow={v.hp} aria-label={`${u.name}: здоровье`}>
              <i className="gh" style={{ width: `${Math.max(0, (v.hp / u.maxHp) * 100)}%` }} />
              <i className="hp" style={{ width: `${Math.max(0, (v.hp / u.maxHp) * 100)}%` }} />
              {v.sh > 0 && <i className="sh" style={{ width: `${Math.min(100, (v.sh / u.maxHp) * 100)}%` }} />}
            </div>
            <div className="ar-en" role="progressbar" aria-valuemin={0} aria-valuemax={ENERGY.max} aria-valuenow={v.en} aria-label={`${u.name}: энергия ультимейта`}>
              <i style={{ width: `${Math.min(100, (v.en / ENERGY.max) * 100)}%` }} />
            </div>
            <div className="ar-meta">
              <span className="ar-name">{u.name}</span>
              <span className="ar-num">
                {Math.max(0, v.hp)}/{u.maxHp}
              </span>
            </div>
            <div className="ar-st">
              {v.st.map((k) => (
                <span key={k} className={`ar-badge b-${k}`} title={STATUS_ICO[k].label}>
                  <Ico name={STATUS_ICO[k].ico} size={11} />
                </span>
              ))}
            </div>
            <div className="ar-floats" aria-hidden>
              {floats
                .filter((x) => x.key === u.key)
                .map((x) => (
                  <span key={x.id} className={`ar-float ${x.kind}`} style={{ ["--x" as string]: `${((x.id * 37) % 41) - 20}px`, ["--r" as string]: `${((x.id * 13) % 9) - 4}deg` }}>
                    {x.kind === "crit" && <small>крит!</small>}
                    {x.text}
                  </span>
                ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <Portal>
    <div className="cg-modal ar-overlay" role="dialog" aria-modal="true" aria-label="Бой">
      <div className="ar-wrap">
        <div className="ar-top">
          <b className="ar-title">
            {report.title ?? `Вы vs ${report.foeName}`} <small>{report.title ? report.foeName : report.pvp ? "игрок" : "бот"}</small>
          </b>
          {!done && (
            <>
              <div className="cg-seg" role="group" aria-label="Скорость">
                {([1, 2] as const).map((n) => (
                  <button key={n} type="button" aria-pressed={speed === n} onClick={() => setSpeed(n)}>
                    ×{n}
                  </button>
                ))}
              </div>
              <button type="button" className="cg-btn sm ar-ctl" aria-pressed={paused} aria-label={paused ? "Продолжить" : "Пауза"} onClick={() => setPaused((x) => !x)}>
                <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>{paused ? <path d="M7 4l13 8-13 8z" fill="currentColor" /> : <path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor" />}</svg>
              </button>
              <button type="button" className="cg-btn sm ar-ctl" title="Качество эффектов" aria-label={`Эффекты: ${fxq === "full" ? "полные" : "лёгкие"}`}
                onClick={() => setFxq((q) => { const n = q === "full" ? "lite" : "full"; try { localStorage.setItem(FX_KEY, n); } catch {} return n; })}>
                {fxq === "full" ? "FX" : "FX−"}
              </button>
              <button type="button" className="cg-btn sm" onClick={skip}>
                Пропустить
              </button>
            </>
          )}
        </div>

        <div className="ar-hud">
          <div className="ar-team a">
            <span className="ar-tn">Ваш отряд</span>
            <span className="ar-tb">
              <i style={{ width: `${teamPct(report.you)}%` }} />
            </span>
            <em>{teamHp(report.you)}</em>
          </div>
          <div className="ar-round">
            <small>Раунд</small>
            <b>{round}</b>
          </div>
          <div className="ar-team b">
            <span className="ar-tn">{report.foeName}</span>
            <span className="ar-tb">
              <i style={{ width: `${teamPct(report.foe)}%` }} />
            </span>
            <em>{teamHp(report.foe)}</em>
          </div>
        </div>

        {!done && queue.length > 0 && (() => {
          let cur = 0;
          for (let i = 0; i < queue.length; i++) if (queue[i].at < step) cur = i;
          const list = queue.slice(cur, cur + 7);
          return (
            <div className="ar-queue" aria-label="Очередь ходов">
              <small>Очередь</small>
              <div className="aq-list">
                {list.map((q, i) => {
                  const u = info.current.get(q.key);
                  if (!u) return null;
                  return (
                    <span key={`${q.at}`} className={`aq-it side-${u.side} ${i === 0 ? "now" : ""}`} title={u.name} style={{ ["--rc" as string]: RANKS[u.rank]?.color ?? "#8fb0ff" }}>
                      <img src={`/api/cards/art/${u.cardId}`} alt="" loading="lazy" draggable={false} />
                    </span>
                  );
                })}
              </div>
              <span className="aq-prog" aria-label="Прогресс боя"><i style={{ width: `${Math.round((step / Math.max(1, events.length)) * 100)}%` }} /></span>
            </div>
          );
        })()}

        {((report.youSyn?.length ?? 0) > 0 || (report.foeSyn?.length ?? 0) > 0) && (
          <div className="ar-syns">
            <SynChips list={report.youSyn ?? []} />
            <SynChips list={report.foeSyn ?? []} right />
          </div>
        )}

        {(report.arena || report.youGear || report.foeGear) && (
          <div className="ar-gear">
            <div className="ag-side a">
              {(report.youGear?.relics ?? []).map((r) => (
                <RelicTile key={r.id} id={r.id} lv={r.lv} size="sm" />
              ))}
              {report.youGear?.booster && <BoosterBadge id={report.youGear.booster} />}
            </div>
            {report.arena && <ArenaRule id={report.arena} compact />}
            <div className="ag-side b">
              {(report.foeGear?.relics ?? []).map((r) => (
                <RelicTile key={r.id} id={r.id} lv={r.lv} size="sm" />
              ))}
            </div>
          </div>
        )}

        <div ref={fieldRef} className={`ar-field ${flash ? `flash-${flash}` : ""} ${shk ? `shk-${shk}` : ""} ${cine ? "cine-on" : ""} ${kill ? (kill.last ? "kill-on kill-last" : "kill-on") : ""} ${report.arena ? `arena-${report.arena}` : ""}`}>
          {side(report.you, "a")}
          <div className="ar-mid">
            {banner && !done && !banner.ult ? (
              <div key={banner.n} className={`ar-banner fx-c-${banner.fx}`}>
                <span className="ar-b-ico">
                  <SkillGlyph fx={banner.fx} size={26} />
                </span>
                <small className="ar-b-who">{banner.who}</small>
                <b className="ar-b-name">{banner.name}</b>
                {banner.tg && <em className="ar-b-tg">{banner.tg}</em>}
              </div>
            ) : (
              <div className="ar-vs" aria-hidden>
                <Ico name="swords" size={30} />
                <b>VS</b>
              </div>
            )}
          </div>
          {side(report.foe, "b")}
          <div className="ar-projs" aria-hidden>
            {projs.map((p) => (
              <span key={p.id} className={`ar-proj p-${p.kind} fx-c-${p.fx} ${p.rev ? "rev" : ""}`} style={{ left: p.x0, top: p.y0, ["--len" as string]: `${p.len}px`, ["--ang" as string]: `${p.ang}deg`, ["--ms" as string]: `${p.ms}ms`, ["--dl" as string]: `${p.dl}ms` }}>
                <i className="bm" />
                <b className="hd">
                  <i className="tr" />
                </b>
              </span>
            ))}
          </div>
          {paused && !done && (
            <button type="button" className="ar-paused" onClick={() => setPaused(false)}>
              <b>Пауза</b>
              <small>Нажмите, чтобы продолжить</small>
            </button>
          )}
          {combo && !done && (
            <div key={combo.id} className={`ar-combo side-${combo.side}`} aria-hidden>
              <b>{combo.n}</b>
              <small>удара подряд</small>
            </div>
          )}
          {intro && (
            <div className="ar-intro" role="button" tabIndex={0} aria-label="Начать бой" onClick={() => setIntro(false)} onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && setIntro(false)}>
              <i className="in-bg" />
              <div className="in-side a">
                <small>Ваш отряд</small>
                <b>{report.you.map((u) => u.name.split(" ")[0]).join(" · ")}</b>
                <div className="in-gear">
                  {(report.youGear?.relics ?? []).map((r) => (
                    <RelicTile key={r.id} id={r.id} lv={r.lv} size="sm" />
                  ))}
                  {report.youGear?.booster && <BoosterBadge id={report.youGear.booster} />}
                </div>
              </div>
              <div className="in-vs">
                <Ico name="swords" size={38} />
                <b>VS</b>
              </div>
              <div className="in-side b">
                <small>{report.pvp ? `Игрок${report.foeRating ? ` · ${fmt(report.foeRating)}` : ""}` : "Противник"}</small>
                <b>{report.foeName}</b>
                <div className="in-gear">
                  {(report.foeGear?.relics ?? []).map((r) => (
                    <RelicTile key={r.id} id={r.id} lv={r.lv} size="sm" />
                  ))}
                </div>
              </div>
              {report.arena && (
                <div className="in-rule">
                  <ArenaRule id={report.arena} />
                </div>
              )}
              <span className="in-hint">Нажмите, чтобы начать</span>
            </div>
          )}
          {cine && !done && (
            <div key={cine.n} className={`ar-cine fx-c-${cine.fx} cls-${cine.cls}`} aria-hidden>
              <i className="cn-dim" />
              <i className="cn-rays" />
              <i className="cn-bar t" />
              <i className="cn-bar b" />
              <div className="cn-plate">
                <span className="cn-ico">
                  <SkillGlyph fx={cine.fx} size={58} />
                </span>
                <span className="cn-txt">
                  <small>Ультимейт · {cine.who}</small>
                  <b>{cine.name}</b>
                </span>
              </div>
              <i className="cn-streak s1" />
              <i className="cn-streak s2" />
              <i className="cn-streak s3" />
            </div>
          )}
        </div>

        <ul className="ar-log" aria-live="off">
          {log.slice(-4).map((l, i) => (
            <li key={`${i}-${l}`}>{l}</li>
          ))}
        </ul>

        {infoKey && (() => {
          const u = info.current.get(infoKey);
          if (!u) return null;
          const v = uv[u.key];
          const rk = RANKS[u.rank];
          const sks = (u.skills ?? []).map((id) => skillDef(id)).filter((x): x is NonNullable<typeof x> => !!x);
          const ult = ULTIMATES[u.cls];
          const pas = u.passive ? passiveDef(u.passive) : undefined;
          return (
            <div className="ar-sheet-bg" role="presentation" onClick={() => setInfoKey(null)}>
              <div className="ar-sheet" role="dialog" aria-label={u.name} onClick={(ev) => ev.stopPropagation()} style={{ ["--rc" as string]: rk?.color ?? "#8fb0ff" }}>
                <div className="ash-head">
                  <div className="ash-card"><GameCard cardId={u.cardId} foil={u.foil} level={u.level} stats={false} /></div>
                  <div className="ash-id">
                    <span className="ash-rank">{rk?.short} · {rk?.name}</span>
                    <b>{u.name}</b>
                    <small>{CLASSES[u.cls]?.name} · {ELEMENTS[u.element]?.name} · ур. {u.level} · {u.side === "a" ? "ваш отряд" : "противник"}</small>
                    <div className="ash-bars">
                      <span>HP <b>{Math.max(0, v.hp)}</b> / {u.maxHp}</span>
                      <i className="hp"><em style={{ width: `${Math.max(0, (v.hp / u.maxHp) * 100)}%` }} /></i>
                      <span>Энергия <b>{v.en}</b> / {ENERGY.max}</span>
                      <i className="en"><em style={{ width: `${Math.min(100, (v.en / ENERGY.max) * 100)}%` }} /></i>
                    </div>
                  </div>
                  <button type="button" className="ash-x" aria-label="Закрыть" onClick={() => setInfoKey(null)}>×</button>
                </div>
                <small className="ash-cap">Базовые параметры</small>
                <div className="ash-stats">
                  <span><small>Атака</small><b>{u.atk}</b></span>
                  <span><small>Защита</small><b>{u.def}</b></span>
                  <span><small>Скорость</small><b>{u.spd}</b></span>
                  <span><small>Здоровье</small><b>{u.maxHp}</b></span>
                </div>
                {v.st.length > 0 && (
                  <div className="ash-st">
                    {v.st.map((k) => <span key={k} className={`ar-badge b-${k}`}><Ico name={STATUS_ICO[k].ico} size={12} /> {STATUS_ICO[k].label}</span>)}
                  </div>
                )}
                <ul className="ash-skills">
                  {ult && <li className="ult"><SkillGlyph fx={ult.fx} size={20} /><span><b>{ult.name} <em>ультимейт</em></b><small>{ult.desc}</small></span></li>}
                  {sks.map((sk) => <li key={sk.id}><SkillGlyph fx={sk.fx} size={20} /><span><b>{sk.name} <em>перезарядка {sk.cd}</em></b><small>{sk.desc}</small></span></li>)}
                  {pas && <li className="pas"><SkillGlyph fx={pas.fx} size={20} /><span><b>{pas.name} <em>пассивка</em></b><small>{pas.desc}</small></span></li>}
                </ul>
              </div>
            </div>
          );
        })()}

        {done && (
          <div ref={resRef} className={`ar-result gx-res ${report.win ? "win" : "lose"}`}>
            <i className="gx-res-rays" aria-hidden />
            <span className="gx-res-eyebrow">{report.raid ? "Рейд" : report.campaign ? "Кампания" : report.pvp ? "Бой с игроком" : "Бой"}</span>
            <h2>{report.raid ? "Удар по боссу" : report.win ? "Победа" : "Поражение"}</h2>
            <p className="gx-res-sub">
              {report.outcome.rounds} раунд. · урон отряда {fmt(stats.side.a.dmg)} · потери {report.outcome.a.filter((u) => u.hp <= 0).length} из {report.outcome.a.length}
            </p>
            <div className="gx-res-body">
              {stats.mvp && (
                <div className="gx-mvp">
                  <span className="gx-mvp-tag">
                    <Ico name="crown" size={14} /> MVP
                  </span>
                  <div className="gx-mvp-card">
                    <GameCard cardId={stats.mvp.u.cardId} foil={stats.mvp.u.foil} level={stats.mvp.u.level} stats={false} />
                  </div>
                  <b>{stats.mvp.u.name}</b>
                  <small>
                    урон {fmt(stats.mvp.dmg)}
                    {stats.mvp.heal > 0 ? ` · лечение ${fmt(stats.mvp.heal)}` : ""}
                    {stats.mvp.kills > 0 ? ` · побед ${stats.mvp.kills}` : ""}
                  </small>
                </div>
              )}
              <ul className="gx-stats">
                <li>
                  <Ico name="swords" size={16} />
                  <b>{fmt(stats.side.a.dmg)}</b>
                  <small>урона нанесено</small>
                </li>
                <li>
                  <Ico name="target" size={16} />
                  <b>{stats.side.a.crits}</b>
                  <small>критов</small>
                </li>
                <li>
                  <Ico name="bolt" size={16} />
                  <b>{fmt(stats.side.a.best)}</b>
                  <small>лучший удар</small>
                </li>
                <li>
                  <Ico name="skull" size={16} />
                  <b>{stats.side.a.kills}</b>
                  <small>врагов повержено</small>
                </li>
                <li>
                  <Ico name="fire" size={16} />
                  <b>×{Math.max(1, maxCombo.current.a)}</b>
                  <small>лучшая серия</small>
                </li>
                <li>
                  <Ico name="heart" size={16} />
                  <b>{fmt(stats.side.a.heal)}</b>
                  <small>вылечено</small>
                </li>
              </ul>
            </div>
            <div className="ar-table" aria-label="Статистика героев">
              {report.you.map((u) => {
                const v = stats.per.get(u.key) ?? { dmg: 0, heal: 0, crits: 0, kills: 0, best: 0 };
                const top = Math.max(1, ...report.you.map((x) => stats.per.get(x.key)?.dmg ?? 0));
                const alive = (report.outcome.a.find((x) => x.key === u.key)?.hp ?? 0) > 0;
                return (
                  <div key={u.key} className={`at-row ${stats.mvp?.u.key === u.key ? "mvp" : ""} ${alive ? "" : "out"}`}>
                    <span className="at-av" style={{ ["--rc" as string]: RANKS[u.rank]?.color ?? "#8fb0ff" }}><img src={`/api/cards/art/${u.cardId}`} alt="" loading="lazy" /></span>
                    <span className="at-nm"><b>{u.name}</b><small>{v.kills ? `побед ${v.kills} · ` : ""}{v.crits ? `критов ${v.crits}` : alive ? "в строю" : "выбыл"}</small></span>
                    <span className="at-bar"><i style={{ width: `${(v.dmg / top) * 100}%` }} /></span>
                    <span className="at-num"><b>{fmt(v.dmg)}</b>{v.heal > 0 && <small>+{fmt(v.heal)}</small>}</span>
                  </div>
                );
              })}
            </div>
            {report.campaign && (
              <div className="ar-stars" aria-label={`Звёзд: ${report.campaign.stars} из 3`}>
                {[0, 1, 2].map((i) => (
                  <Ico key={i} name="star" size={34} className={i < report.campaign!.stars ? "on" : ""} />
                ))}
              </div>
            )}
            {report.raid && (
              <p className="ar-dmg">
                <b>{report.raid.damage.toLocaleString("ru-RU")}</b> урона · запас босса {report.raid.poolHp.toLocaleString("ru-RU")} / {report.raid.poolMax.toLocaleString("ru-RU")}
                {report.raid.defeated ? " · босс повержен!" : ""} · попыток сегодня: {report.raid.hitsLeft}
              </p>
            )}
            {report.training ? (
              <p className="cg-hint">Тренировка: награды не меняются, бустер не потрачен.</p>
            ) : report.campaign ? (
              <div className="ar-rew">
                <span className="ar-rw">{report.campaign.newStars > 0 ? `Новых звёзд: ${report.campaign.newStars}` : "Новых звёзд нет"}</span>
                {report.campaign.reward.diamonds ? (
                  <span className="ar-rw">
                    <Cur k="diamonds" /> {report.campaign.reward.diamonds}
                  </span>
                ) : null}
                {report.campaign.reward.dust ? (
                  <span className="ar-rw">
                    <Cur k="dust" /> {report.campaign.reward.dust}
                  </span>
                ) : null}
              </div>
            ) : report.raid ? null : (
              <div className="ar-rew">
                <span className="ar-rw">
                  <Cur k="diamonds" /> {report.reward.diamonds}
                </span>
                <span className="ar-rw">
                  <Cur k="dust" /> {report.reward.dust}
                </span>
                {report.reward.scroll ? (
                  <span className="ar-rw">
                    <Ico name="scroll" size={15} /> свиток заточки
                  </span>
                ) : null}
                <span className={`ar-rw rt ${report.reward.rating >= 0 ? "up" : "down"}`}>
                  <Ico name="trophy" size={15} /> рейтинг {report.reward.rating > 0 ? "+" : ""}
                  {report.reward.rating}
                </span>
              </div>
            )}
            {(report.drops?.relic || report.drops?.booster) && (
              <div className="gx-loot">
                {report.drops.relic && (
                  <div className={`gx-drop rar-${relicDef(report.drops.relic.id)?.rarity ?? "rare"}`} style={{ ["--rc" as string]: RARITY[relicDef(report.drops.relic.id)?.rarity ?? "rare"].color }}>
                    <RelicTile id={report.drops.relic.id} lv={report.drops.relic.lv} size="md" label={false} />
                    <span>
                      <small>{report.drops.relic.dup ? "Повторная реликвия" : "Новая реликвия!"}</small>
                      <b>{relicDef(report.drops.relic.id)?.name}</b>
                      <em>{report.drops.relic.dup ? `обращена в ${report.drops.relic.dust} пыли` : RARITY[relicDef(report.drops.relic.id)?.rarity ?? "rare"].name}</em>
                    </span>
                  </div>
                )}
                {report.drops.booster && (
                  <div className="gx-drop bst">
                    <BoosterBadge id={report.drops.booster} />
                    <span>
                      <small>Трофей</small>
                      <b>{boosterDef(report.drops.booster)?.name}</b>
                      <em>добавлен в запас</em>
                    </span>
                  </div>
                )}
              </div>
            )}
            <button type="button" className="cg-btn pri lg" onClick={onClose}>
              Закрыть
            </button>
          </div>
        )}
      </div>
    </div>
    </Portal>
  );
}

function BoosterBadge({ id }: { id: string }) {
  const b = boosterDef(id);
  if (!b) return null;
  return (
    <span className="gx-bbadge" title={`${b.name}: ${b.desc}`}>
      <Ico name={b.ico} size={15} />
      <b>{b.name}</b>
    </span>
  );
}
