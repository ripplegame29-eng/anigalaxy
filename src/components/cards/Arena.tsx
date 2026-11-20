"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { simulate, type ActOpt, type BattleEvent, type BattleOutcome, type Choice, type SimOpts, type StatusKind, type Unit } from "@/lib/cards/battle";
import { SPELL_COLOR, SPELL_RANK, TACTIC_RULES, tacticDef } from "@/lib/cards/tactics";
import { act as cardsAct } from "@/lib/cards/client";
import { toast } from "./common";
import { runUltFx } from "./ultfx";
import { createBattleFx, type BattleFx } from "./battlefx";
import { ENERGY, heroUlt, passiveDef, skillDef, ultOf, type SkillFx } from "@/lib/cards/skills";
import { CLASSES, ELEMENTS, RANKS } from "@/lib/cards/config";
import type { Synergy } from "@/lib/cards/synergy";
import { GameCard } from "./GameCard";
import { Portal } from "./common";
import { SkillGlyph, SynChips, TARGET_LABEL } from "./skillui";
import { SpellArt } from "./spellart";
import { Cur, Ico, type IcoName } from "./icons";
import { ArenaRule, RelicTile } from "./gearui";
import { RARITY, boosterDef, relicDef, type Drops, type GearInfo } from "@/lib/cards/gear";
import { fmt } from "./common";
import { bs, startMusic, stopMusic, setBattleSfx, setBattleMusic, setBattleVolume, useBattleSfx, useBattleMusic, useBattleVolume } from "@/lib/cards/battle-audio";

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
  /** Управляемый бой: зерно и параметры, чтобы считать ходы на клиенте до подтверждения сервером */
  live?: { id: string; seed: number; perks?: SimOpts["perks"]; maxRounds: number; spells?: string[] };
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
  /** 0 — обычный кинематограф, 1 — S (легендарная), 2 — SS (мифическая) */
  tier: 0 | 1 | 2;
  el: string;
  cardId: Unit["cardId"];
  side: "a" | "b";
  T: number;
  /** Именной ультимейт (Бан-кай и т.п.): иероглифы и название формы */
  bk?: { kanji: string; form: string };
}
/** Добивающий удар стихии для SS */
interface Fin {
  n: number;
  el: string;
  side: "a" | "b";
  aid: boolean;
  T: number;
  /** Центры целей и высота карты в координатах поля; power — сила эффекта (S скромнее SS) */
  pts: { x: number; y: number }[];
  unit: number;
  power: number;
}

/** Холст с добивающим ударом стихии */
function FinFx({ f }: { f: Fin }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    return runUltFx(cv, { el: f.el, aid: f.aid, dur: f.T, pts: f.pts, dir: f.side === "a" ? 1 : -1, unit: f.unit, power: f.power });
  }, [f]);
  return <canvas ref={ref} className="ar-fin" aria-hidden />;
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

export function Arena({ report: initial, onClose }: { report: BattleReport; onClose: () => void }) {
  const [report, setReport] = useState(initial);
  /* управляемый бой: решения игрока, пока сервер не подтвердил итог */
  const liveRef = useRef(initial.live ?? null);
  const choices = useRef<Choice[]>([]);
  const [settled, setSettled] = useState(!initial.live);
  const [auto, setAuto] = useState(false);
  const [sel, setSel] = useState<ActOpt | null>(null);
  const [cards, setCards] = useState<string[]>([]);
  const [tac, setTac] = useState<{ side: "a" | "b"; id: string; n: number } | null>(null);
  /* раздача карт перед боем: 0 — ждём начала, 1 — карты летят рубашкой вверх и переворачиваются, 2 — готово */
  const [deal, setDeal] = useState<0 | 1 | 2>(0);
  /* куда летит карта при обычной атаке (смещение до цели) */
  const [vec, setVec] = useState<Record<string, { x: number; y: number }>>({});
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
  const [shk, setShk] = useState<"lite" | "heavy" | "ult" | null>(null);
  const [fin, setFin] = useState<Fin | null>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  /* боевые эффекты на холсте: удары, снаряды, лечение, гибель карт */
  const cfxRef = useRef<HTMLCanvasElement>(null);
  const bfx = useRef<BattleFx | null>(null);
  useEffect(() => {
    const cv = cfxRef.current;
    if (!cv) return;
    const f = createBattleFx(cv, () => fieldRef.current?.querySelector(".ar-card")?.getBoundingClientRect().height ?? 0);
    bfx.current = f;
    return () => {
      bfx.current = null;
      f.destroy();
    };
  }, []);
  /** Холст эффектов; null — при отключённых или облегчённых эффектах */
  const cfx = (): BattleFx | null => (calm.current || ecoOn() ? null : bfx.current);
  const [acting, setActing] = useState<Record<string, "cast" | "atk">>({});
  const [hit, setHit] = useState<Record<string, { n: number; crit: boolean }>>({});
  const [banner, setBanner] = useState<{ who: string; name: string; tg: string; fx: SkillFx; n: number; ult: boolean } | null>(null);
  const [flash, setFlash] = useState<SkillFx | "crit" | "ult" | null>(null);
  const [round, setRound] = useState(1);
  /* смена раунда: короткий титр по центру поля */
  const [rbn, setRbn] = useState<{ r: number; n: number } | null>(null);
  const roundSeen = useRef(1);
  /* финальный титр «Победа / Поражение» перед окном итогов */
  const [outroOver, setOutroOver] = useState(false);
  const sfxOn = useBattleSfx();
  const musOn = useBattleMusic();
  const musVol = useBattleVolume();
  const [intro, setIntro] = useState(() => !reduced() && !ecoOn() && events.length > 0);
  const [combo, setCombo] = useState<{ side: "a" | "b"; n: number; id: number } | null>(null);
  const comboRef = useRef<{ side: "a" | "b"; n: number } | null>(null);
  const maxCombo = useRef({ a: 0, b: 0 });
  const [kill, setKill] = useState<{ key: string; n: number; last: boolean } | null>(null);
  const alive = useRef({ a: report.you.length, b: report.foe.length });
  const [log, setLog] = useState<string[]>([]);
  const counter = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const pend = settled ? null : (report.outcome.pending ?? null);
  const waiting = !!pend && step >= events.length;
  const done = step >= events.length && settled;
  const [fxq, setFxq] = useState<"full" | "lite">(() => (typeof window === "undefined" ? "full" : readFx()));
  const calm = useRef(reduced() || fxq === "lite");
  calm.current = reduced() || fxq === "lite";
  const [paused, setPaused] = useState(false);
  const [hold, setHold] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState(false);
  const [sure, setSure] = useState(false);
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
    startMusic();
    return () => stopMusic();
  }, []);
  useEffect(() => {
    if (intro) bs.intro();
  }, [intro]);
  useEffect(() => {
    if (deal === 1) bs.deal();
  }, [deal]);
  useEffect(() => {
    if (!done) return;
    stopMusic();
    if (report.win) bs.win();
    else bs.lose();
  }, [done, report.win]);
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
    (k: "lite" | "heavy" | "ult") => {
      setShk(k);
      later(() => setShk(null), k === "ult" ? 720 : k === "heavy" ? 620 : 380);
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
    const cx = cfx();
    if (cx && src) {
      const dsts = targets.map((t) => centerOf(t)).filter((c): c is { x: number; y: number } => !!c);
      return cx.shoot(src, dsts, f, info.current.get(from)?.element ?? "light", cfg?.ms ?? 0);
    }
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
    bs.ko(last);
    if (last) {
      shakeField("heavy");
      flashScreen("ult");
    }
    return calm.current || ecoOn() ? 600 : last ? 2000 : 1150;
  };

  /** Проигрывает событие, возвращает его длительность (мс) */
  const play = (e: BattleEvent): number => {
    setRound(Math.max(1, e.round));
    if (e.round > roundSeen.current) {
      roundSeen.current = e.round;
      if (!calm.current && !ecoOn()) {
        const rn = ++counter.current;
        setRbn({ r: e.round, n: rn });
        bs.round();
        later(() => setRbn((p) => (p?.n === rn ? null : p)), 1500);
      }
    }
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
        let big = false;
        const impact = (fl: number) => {
          e.targets.forEach((t, i) => later(() => burst([t], e.fx), fl + i * 70));
          later(() => {
            bs.impact(e.fx, ult, big);
            flashScreen(ult ? "ult" : e.fx);
            if (big) shakeField("ult");
            else if (ult || HEAVY.includes(e.fx)) shakeField("heavy");
            else if (e.fx === "slash" || e.fx === "pierce" || e.fx === "whirl") shakeField("lite");
          }, fl);
        };
        const cu = info.current.get(e.from);
        const hu = ult && !lite ? heroUlt(cu?.cardId) : undefined;
        const tier: 0 | 1 | 2 = !ult || lite || !cu ? 0 : hu ? 2 : cu.rank >= 4 ? 2 : cu.rank >= 3 ? 1 : 0;
        bs.cast(e.fx, ult, tier);
        if (hu) bs.bankai();
        if (ult && tier && cu) {
          /* эксклюзивный кат-ин S/SS: панель с героем, у SS — ещё и добивающий удар стихии */
          big = true;
          const C = (tier === 2 ? (hu ? 3200 : 2500) : 1800) / speed;
          const aid = e.fx === "heal" || e.fx === "shield" || e.fx === "buff";
          act(e.from, "cast", C + 900 / speed);
          setCine({ n, fx: e.fx, name: nm, who, cls: casterCls ?? "", tier, el: cu.element, cardId: cu.cardId, side: cu.side, T: C, bk: hu ? { kanji: hu.kanji, form: hu.form } : undefined });
          later(() => setCine((p) => (p?.n === n ? null : p)), C);
          {
            /* добивающий удар стихии по целям: у SS полный, у S короче */
            const F = (tier === 2 ? 1700 : 1150) / speed;
            later(() => {
              const pts = e.targets.map((k) => centerOf(k)).filter((c): c is { x: number; y: number } => !!c);
              const unit = fieldRef.current?.querySelector(`[data-uk="${e.from}"]`)?.getBoundingClientRect().height ?? 0;
              setFin({ n, el: cu.element, side: cu.side, aid, T: F, pts, unit, power: tier === 2 ? 1 : 0.65 });
            }, C - 120 / speed);
            later(() => setFin((p) => (p?.n === n ? null : p)), C - 120 / speed + F + 260);
          }
          later(() => impact(launch(e.from, e.targets, e.fx)), tier === 2 ? C + 420 / speed : C - 60 / speed);
          return tier === 2 ? (hu ? 5300 : 4600) : 3500;
        }
        if (ult) {
          act(e.from, "cast", 2300);
          if (!lite) {
            setCine({ n, fx: e.fx, name: nm, who, cls: casterCls ?? "", tier: 0, el: "", cardId: cu?.cardId ?? "", side: cu?.side ?? "a", T: 2500 });
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
        {
          const c0 = centerOf(e.from);
          if (c0) cfx()?.charge(c0, e.fx, cu?.element ?? "light");
        }
        /* короткий замах кастера, затем снаряд */
        later(() => impact(launch(e.from, e.targets, e.fx)), 180);
        return 1100 + (PROJ[e.fx]?.ms ?? 0);
      }
      case "hit": {
        const apply = (): number => {
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
        bs.hit(!!e.crit, e.dmg >= (info.current.get(e.to)?.maxHp ?? 1) * 0.22);
        if (!e.skill) burst([e.to], "slash");
        {
          const cx = cfx();
          const pb = centerOf(e.to);
          if (cx && pb) {
            const pa = centerOf(e.from);
            if (!e.skill && pa) cx.strike(pa, pb, info.current.get(e.from)?.element ?? "light", e.crit, e.dead);
            if (e.dead) later(() => cfx()?.death(pb, RANKS[info.current.get(e.to)?.rank ?? 0]?.color ?? "#8fb0ff"), 140);
          }
        }
        if (e.crit) {
          flashScreen("crit");
          shakeField("lite");
        }
        say(`${nameOf(e.from)} → ${nameOf(e.to)}: −${e.dmg}${e.skill === "p-thorns" ? " (шипы)" : ""}${e.crit ? " (крит)" : ""}${e.dead ? ", повержен" : ""}`);
        if (e.dead) return knockout(e.to);
        return e.skill ? 480 : 720;
        };
        if (e.skill) return apply();
        setTurn({ from: e.from, targets: [e.to], n: ++counter.current });
        const a = centerOf(e.from);
        const b = centerOf(e.to);
        if (a && b) setVec((p) => ({ ...p, [e.from]: { x: (b.x - a.x) * 0.74, y: (b.y - a.y) * 0.74 } }));
        bs.swing();
        act(e.from, "atk", 640);
        if (calm.current || ecoOn()) return apply();
        /* карта долетает до цели за ~0.2 с — урон и реакция цели показываются в момент касания */
        const sdT = info.current.get(e.to)?.side ?? "a";
        const dur = e.dead ? (alive.current[sdT] - 1 <= 0 ? 2000 : 1150) : 720;
        later(apply, 200);
        return dur + 200;
      }
      case "heal":
        patch(e.to, (u) => ({ ...u, hp: e.hp }));
        addFloat(e.to, `+${e.amount}`, "heal");
        if (e.skill === "g-vamp") return 140;
        bs.heal();
        if (!e.skill) {
          act(e.from, "cast", 700);
          burst([e.to], "heal");
        }
        {
          const c0 = centerOf(e.to);
          if (c0) cfx()?.heal(c0);
        }
        say(`${nameOf(e.from)} лечит ${nameOf(e.to)}: +${e.amount}`);
        return e.skill ? 420 : 700;
      case "shield":
        patch(e.to, (u) => ({ ...u, sh: e.amount, st: u.st.includes("shield") ? u.st : [...u.st, "shield"] }));
        addFloat(e.to, `щит ${e.amount}`, "shield");
        if (e.round > 0) {
          bs.shield();
          const c0 = centerOf(e.to);
          if (c0) cfx()?.shield(c0);
        }
        return e.round === 0 ? 70 : 420;
      case "status":
        patch(e.to, (u) => ({ ...u, st: e.on ? (u.st.includes(e.kind) ? u.st : [...u.st, e.kind]) : u.st.filter((k) => k !== e.kind), sh: e.kind === "shield" && !e.on ? 0 : u.sh }));
        if (e.on) addFloat(e.to, STATUS_ICO[e.kind].label, "info");
        if (e.on && e.kind !== "shield") (e.kind === "stun" ? bs.stun : () => bs.status(e.kind === "atkUp", true))();
        return e.on ? 260 : 120;
      case "dot":
        patch(e.to, (u) => ({ ...u, hp: e.hp, sh: e.sh, st: e.dead ? [] : u.st }));
        addFloat(e.to, `−${e.dmg}`, "dot");
        bs.dot();
        burst([e.to], "fire");
        {
          const c0 = centerOf(e.to);
          if (c0) {
            cfx()?.dot(c0);
            if (e.dead) cfx()?.death(c0, RANKS[info.current.get(e.to)?.rank ?? 0]?.color ?? "#8fb0ff");
          }
        }
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
        bs.revive();
        flashScreen("heal");
        {
          const c0 = centerOf(e.to);
          if (c0) cfx()?.revive(c0);
        }
        say(`${nameOf(e.to)} возвращается в бой: «${label}»`);
        return 1000;
      }
      case "card": {
        const d = tacticDef(e.card);
        const n = ++counter.current;
        say(`${e.side === "a" ? "Ваш отряд" : "Соперник"}: тактика «${d?.name ?? e.card}»`);
        setTac({ side: e.side, id: e.card, n });
        bs.tactic();
        later(() => setTac((p) => (p?.n === n ? null : p)), 1650);
        if (d) later(() => burst([e.from], d.fx), 900);
        if (d) later(() => flashScreen(d.fx), 900);
        return calm.current || ecoOn() ? 250 : 1250;
      }
      case "skip":
        setTurn({ from: e.from, targets: [], n: ++counter.current });
        addFloat(e.from, "Пропуск хода", "info");
        bs.stun();
        say(`${nameOf(e.from)} оглушён и пропускает ход`);
        return 600;
    }
  };

  useEffect(() => {
    if (done || intro || deal !== 2 || paused || infoKey || step >= events.length) return;
    const t = setTimeout(() => {
      const dur = play(events[step]);
      setDelay(calm.current ? 160 : dur / speed);
      setStep((s) => s + 1);
    }, delay / (step === 0 ? speed : 1));
    return () => clearTimeout(t);
    // play зависит только от стабильных колбэков и состояния отображения
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, done, speed, intro, deal, paused, infoKey, events.length]);

  useEffect(() => {
    if (intro || deal === 2) return;
    if (deal === 0) {
      const t = setTimeout(() => setDeal(calm.current || ecoOn() ? 2 : 1), 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setDeal(2), 2100);
    return () => clearTimeout(t);
  }, [intro, deal]);

  const resRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setOutroOver(true), calm.current || ecoOn() || !events.length ? 0 : 2300);
    return () => clearTimeout(t);
  }, [done, events.length]);

  /** Пересчёт управляемого боя с текущими решениями (детерминирован по зерну) */
  const resim = (): BattleOutcome => {
    const lv = liveRef.current!;
    return simulate(initial.you, initial.foe, Math.random, { perks: lv.perks, maxRounds: lv.maxRounds, ctl: { seed: lv.seed, choices: choices.current, stop: true, spells: lv.spells } });
  };
  /** Бой доигран: сервер пересчитывает его по тем же решениям и выдаёт награды */
  const settle = (localLen: number) => {
    const lv = liveRef.current;
    if (!lv) return;
    liveRef.current = null;
    void cardsAct<BattleReport>("live-finish", { id: lv.id, choices: choices.current }).then((r) => {
      if (!r.ok) {
        toast(r.error, true);
        onClose();
        return;
      }
      setReport(r.result);
      setSettled(true);
      try {
        window.dispatchEvent(new Event("ag:battle-done"));
      } catch {}
      /* итог сервера главный: если он разошёлся с показанным — сразу к результату */
      if (r.result.outcome.events.length !== localLen) jump(r.result.outcome);
    });
  };
  const decide = (ch: Choice) => {
    if (!liveRef.current) return;
    choices.current.push(ch);
    const out = resim();
    setHold(null);
    setSel(null);
    setCards([]);
    setReport((r) => ({ ...r, outcome: out }));
    if (!out.pending) settle(out.events.length);
  };
  /** Разыграть карту боя сразу: героя это не тратит, движок пересчитает бой с картой */
  const playNow = (id: string) => {
    setHold(null);
    setDrag(null);
    decide({ a: "card", c: [id] });
  };
  /** Сдаться: только в онлайн-бою с живым управлением — весь отряд выбывает, бой засчитывается поражением */
  const surrender = () => {
    if (!liveRef.current) return;
    setMenu(false);
    setSure(false);
    decide({ a: "forfeit" });
  };
  const skip = () => {
    let out = report.outcome;
    if (liveRef.current) {
      let guard = 0;
      while (out.pending && guard++ < 400) {
        choices.current.push({ a: "auto" });
        out = resim();
      }
      const fin = out;
      setReport((r) => ({ ...r, outcome: fin }));
      setSel(null);
      setCards([]);
      settle(out.events.length);
    }
    jump(out);
  };
  const jump = (out: BattleOutcome) => {
    const final: Record<string, UV> = {};
    [...out.a, ...out.b].forEach((u) => (final[u.key] = { hp: u.hp, sh: 0, st: [], en: 0 }));
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
    setFin(null);
    setProjs([]);
    setAura({});
    setFx({});
    setRound(out.rounds);
    setIntro(false);
    setKill(null);
    setCombo(null);
    setTurn(null);
    setTac(null);
    setRbn(null);
    setDeal(2);
    setPaused(false);
    setStep(out.events.length);
  };

  /* ход игрока: подсветить героя; в режиме «Авто» решение принимает ИИ */
  const pendUnit = waiting ? pend?.unit : undefined;
  useEffect(() => {
    if (!pendUnit) return;
    setTurn({ from: pendUnit, targets: [], n: ++counter.current });
    if (!auto) return;
    const t = setTimeout(() => decide({ a: "auto" }), 220);
    return () => clearTimeout(t);
    // decide опирается на refs и стабильные сеттеры
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendUnit, auto, events.length]);

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
    <div className={`ar-side ${s} ${done ? (report.win === (s === "a") ? "won" : "lost") : ""}`}>
      {units.map((u) => {
        const v = uv[u.key];
        const dead = v.hp <= 0;
        const f = fx[u.key];
        const au = aura[u.key];
        const ht = hit[u.key];
        const stc = v.st.map((k) => `st-${k}`).join(" ");
        return (
          <div key={u.key} role="button" tabIndex={0} aria-label={`${u.name}: подробнее`} onClick={() => (hold ? undefined : sel && waiting ? sel.targets.includes(u.key) && decide({ a: sel.a, t: u.key, c: cards }) : setInfoKey(u.key))} onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && setInfoKey(u.key)}
            className={`ar-unit ${waiting && sel?.targets.includes(u.key) ? "pick" : ""} ${!done && turn?.from === u.key && !dead ? "is-turn" : ""} ${!done && turn?.targets.includes(u.key) && !dead ? "is-target" : ""} ${!dead && v.hp / u.maxHp < 0.35 ? "is-low" : ""} ${v.st.some((k) => k === "atkUp" || k === "shield") ? "has-buff" : ""} ${v.st.some((k) => k === "burn" || k === "defDown" || k === "stun") ? "has-debuff" : ""} ${dead ? "dead" : ""} ${acting[u.key] ? `act-${acting[u.key]}` : ""} ${ht ? "hit" : ""} ${ht?.crit ? "crit" : ""} ${v.en >= ENERGY.max && !dead ? "ult-ready" : ""} ${kill?.key === u.key ? "kc" : ""} r-${u.rank} ${stc}`} style={{ ["--dir" as string]: s === "a" ? 1 : -1, ["--i" as string]: u.slot, ["--sd" as string]: s === "a" ? 0 : 1, ["--rc" as string]: RANKS[u.rank]?.color ?? "#8fb0ff", ...(vec[u.key] ? { ["--ax" as string]: `${vec[u.key].x.toFixed(1)}px`, ["--ay" as string]: `${vec[u.key].y.toFixed(1)}px` } : {}) }}>
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
              {deal < 2 && <span className="ar-back" aria-hidden />}
              {dead && (
                <span className="ar-death" aria-hidden>
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
              )}
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
    <div className={`cg-modal ar-overlay ${report.arena ? `bg-${report.arena}` : ""}`} onClickCapture={(ev) => { if ((ev.target as HTMLElement).closest("button")) bs.ui(); }} role="dialog" aria-modal="true" aria-label="Бой">
      {/* сцена за столом: туманность, звёзды, планета с кольцами; палитра — по правилу арены дня */}
      <div className="ar-bg" aria-hidden>
        <i className="ar2-scene" />
        <i className="bg-vig" />
      </div>
      <div className={`ar-wrap${done ? " is-done" : ""}`}>
        <div className="ar-top">
          <b className="ar-title">
            {report.title ?? `Вы vs ${report.foeName}`} <small>{report.title ? report.foeName : report.pvp ? "игрок" : "бот"}</small>
          </b>
          {!done && (
            <div className="ar-vol" style={{ ["--p" as string]: `${Math.round((musOn ? musVol : 0) * 100)}%` }} title="Музыка боя: Bleach OST">
              <button type="button" className="ar-vol-b" aria-label={musOn && musVol > 0 ? "Выключить музыку" : "Включить музыку"} aria-pressed={!musOn || musVol === 0} onClick={() => setBattleMusic(!musOn)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M11 5 6.5 9H3.5v6h3L11 19z" fill="currentColor" stroke="none" />
                  {musOn && musVol > 0 ? (
                    <>
                      <path d="M15 9.2a4 4 0 0 1 0 5.6" />
                      {musVol > 0.45 && <path d="M17.6 6.6a7.6 7.6 0 0 1 0 10.8" />}
                    </>
                  ) : (
                    <path d="m16 9.5 5 5m0-5-5 5" />
                  )}
                </svg>
              </button>
              <input type="range" className="ar-vol-r" min={0} max={100} step={1} value={Math.round((musOn ? musVol : 0) * 100)} aria-label="Громкость музыки" onChange={(ev) => setBattleVolume(Number(ev.target.value) / 100)} />
            </div>
          )}
          {!done && (
            <div className="ar-menuwrap">
              <button type="button" className="ar-set" aria-haspopup="true" aria-expanded={menu} onClick={() => { setMenu((x) => !x); setSure(false); }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                <span>Настройки</span>
              </button>
              {menu && (
                <>
                  <button type="button" className="ar-menu-bg" aria-label="Закрыть меню" tabIndex={-1} onClick={() => setMenu(false)} />
                  <div className="ar-menu" role="group" aria-label="Настройки боя">
                    <b className="am-h">Настройки боя</b>
                    {!settled && (
                      <div className="am-row">
                        <span>Авто-бой<small>ИИ ходит за ваш отряд</small></span>
                        <button type="button" role="switch" aria-checked={auto} aria-label="Авто-бой" className="am-sw" onClick={() => setAuto((x) => !x)}><i /></button>
                      </div>
                    )}
                    <div className="am-row">
                      <span>Эффекты<small>Качество анимаций</small></span>
                      <div className="am-seg" role="group" aria-label="Качество эффектов">
                        {(["full", "lite"] as const).map((q) => (
                          <button key={q} type="button" aria-pressed={fxq === q} onClick={() => { setFxq(q); try { localStorage.setItem(FX_KEY, q); } catch {} }}>
                            {q === "full" ? "Полные" : "Лёгкие"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="am-row">
                      <span>Звуки<small>Удары, умения, фанфары</small></span>
                      <button type="button" role="switch" aria-checked={sfxOn} aria-label="Звуки" className="am-sw" onClick={() => setBattleSfx(!sfxOn)}><i /></button>
                    </div>
                    <div className="am-row">
                      <span>Музыка<small>Фоновая тема боя</small></span>
                      <button type="button" role="switch" aria-checked={musOn} aria-label="Музыка" className="am-sw" onClick={() => setBattleMusic(!musOn)}><i /></button>
                    </div>
                    {!report.pvp && (
                      <>
                        <div className="am-row">
                          <span>Скорость<small>Только в офлайн-боях</small></span>
                          <div className="am-seg" role="group" aria-label="Скорость">
                            {([1, 2] as const).map((n) => (
                              <button key={n} type="button" aria-pressed={speed === n} onClick={() => setSpeed(n)}>
                                ×{n}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="am-row">
                          <span>Пауза<small>Остановить анимацию</small></span>
                          <button type="button" role="switch" aria-checked={paused} aria-label="Пауза" className="am-sw" onClick={() => setPaused((x) => !x)}><i /></button>
                        </div>
                        <button type="button" className="am-act" onClick={() => { setMenu(false); skip(); }}>
                          Пропустить бой
                        </button>
                      </>
                    )}
                    {report.pvp && !settled && (
                      sure ? (
                        <div className="am-sure">
                          <p>Сдаться? Бой будет засчитан как поражение.</p>
                          <div>
                            <button type="button" className="am-act" onClick={() => setSure(false)}>Остаться</button>
                            <button type="button" className="am-act danger" onClick={surrender}>Да, сдаться</button>
                          </div>
                        </div>
                      ) : (
                        <button type="button" className="am-act danger" onClick={() => setSure(true)}>
                          Сдаться
                        </button>
                      )
                    )}
                  </div>
                </>
              )}
            </div>
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
                      <img src={`/api/cards/art/${u.cardId}?w=480`} alt="" loading="lazy" draggable={false} />
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

        <div ref={fieldRef} onClick={() => { if (hold && waiting) playNow(hold); }} className={`ar-field ${!done && teamPct(report.you) < 30 ? "danger " : ""}${(hold || drag) && waiting ? "drop-on " : ""}${deal < 2 ? `deal-${deal}` : done ? "" : "live"} ${flash ? `flash-${flash}` : ""} ${shk ? `shk-${shk}` : ""} ${cine ? "cine-on" : ""} ${kill ? (kill.last ? "kill-on kill-last" : "kill-on") : ""} ${report.arena ? `arena-${report.arena}` : ""}`}>
          {/* игровой стол: рама, угловые накладки, осевая линия, кольца и пылинки света */}
          <div className="ar-board" aria-hidden>
            <i className="bd-ring" />
            <i className="bd-line" />
            <i className="bd-sheen" />
            {Array.from({ length: 10 }, (_, i) => (
              <i key={i} className="bd-m" style={{ left: `${6 + i * 9}%`, animationDelay: `${(-i * 1.3).toFixed(1)}s`, ["--mx" as string]: `${((i % 3) - 1) * 30}px` }} />
            ))}
            <i className="bd-frame" />
            <i className="bd-c tl" />
            <i className="bd-c tr" />
            <i className="bd-c bl" />
            <i className="bd-c br" />
          </div>
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
          {([["a", report.you], ["b", report.foe]] as const).map(([s, us]) => {
            const top = us.reduce((m, u) => Math.max(m, u.rank), 0);
            const alive = us.filter((u) => (uv[u.key]?.hp ?? 0) > 0).length;
            return (
              <div key={s} className={`ar2-deck ${s} r-${top}`} aria-hidden style={{ ["--rc" as string]: RANKS[top]?.color ?? "#8fb0ff" }}>
                <i />
                <i />
                <i />
                <b>{alive}</b>
              </div>
            );
          })}
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
                <small>{report.title ?? (report.pvp ? "Рейтинговый бой" : "Бой")}</small>
                <b>Ваш отряд</b>
                <div className="in-pics">
                  {report.you.map((u, i) => (
                    <span key={u.key} style={{ ["--rc" as string]: RANKS[u.rank]?.color ?? "#8fb0ff", ["--i" as string]: i }}>
                      <img src={`/api/cards/art/${u.cardId}?w=480`} alt="" draggable={false} />
                    </span>
                  ))}
                </div>
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
                <div className="in-pics">
                  {report.foe.map((u, i) => (
                    <span key={u.key} style={{ ["--rc" as string]: RANKS[u.rank]?.color ?? "#ff8fb0", ["--i" as string]: i }}>
                      <img src={`/api/cards/art/${u.cardId}?w=480`} alt="" draggable={false} />
                    </span>
                  ))}
                </div>
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
          {tac && !done && (() => {
            const d = tacticDef(tac.id);
            if (!d) return null;
            return (
              <div key={tac.n} className={`ar-cshow side-${tac.side} fx-c-${d.fx}`} style={{ ["--rc" as string]: SPELL_COLOR[d.rank] }} aria-hidden>
                <i className="cs-glow" />
                <span className="cs-tag">{tac.side === "a" ? "Вы разыгрываете" : "Соперник разыгрывает"}</span>
                <div className="hc cs-card">
                  <CardFace d={d} />
                </div>
                <i className="cs-ring" />
                <i className="cs-ring r2" />
              </div>
            );
          })()}
          {rbn && !done && (
            <div key={rbn.n} className="ar-rbn" aria-hidden>
              <i className="rb-line" />
              <span>
                <small>Раунд</small>
                <b>{rbn.r}</b>
                <em>+{TACTIC_RULES.perRound} маны · новые карты</em>
              </span>
              <i className="rb-line r" />
            </div>
          )}
          <canvas ref={cfxRef} className="ar-fin ar-cfx" aria-hidden />
          {fin && !done && <FinFx key={`f${fin.n}`} f={fin} />}
          {cine && !done && cine.bk && (
            <div key={cine.n} className={`ar-bk ec-${cine.el} side-${cine.side}`} style={{ ["--T" as string]: `${Math.round(cine.T)}ms` }} aria-hidden>
              <i className="bk-dim" />
              <i className="bk-rays" />
              <i className="bk-ring r1" />
              <i className="bk-ring r2" />
              <i className="bk-ring r3" />
              <span className="bk-kanji">{cine.bk.kanji}</span>
              <span className="bk-hero">
                <img src={`/api/cards/art/${cine.cardId}?w=720`} alt="" draggable={false} />
              </span>
              <i className="bk-embers" />
              <div className="bk-txt">
                <small>{cine.bk.form} · {cine.who}</small>
                <b>{cine.name}</b>
              </div>
              <i className="bk-slash s1" />
              <i className="bk-slash s2" />
              <i className="bk-flash" />
            </div>
          )}
          {cine && !done && !cine.bk && cine.tier > 0 && (
            <div key={cine.n} className={`ar-ucut tier-${cine.tier === 2 ? "ss" : "s"} ec-${cine.el} side-${cine.side}`} style={{ ["--T" as string]: `${Math.round(cine.T)}ms` }} aria-hidden>
              <i className="uc-dim" />
              <i className="uc-lines" />
              <div className="uc-band">
                <i className="uc-glow" />
                {cine.tier === 2 && <span className="uc-stamp">SS</span>}
                <span className="uc-art uc-card">
                  <GameCard cardId={cine.cardId} stats={false} />
                </span>
                {cine.tier === 2 && (
                  <span className="uc-art uc-card ghost">
                    <GameCard cardId={cine.cardId} stats={false} />
                  </span>
                )}
                <div className="uc-txt">
                  <small>
                    <em>{cine.tier === 2 ? "SS" : "S"}</em>
                    {cine.tier === 2 ? "Мифический ультимейт" : "Легендарный ультимейт"}
                  </small>
                  <b>{cine.name}</b>
                  <span>{cine.who}</span>
                </div>
              </div>
              {cine.tier === 2 && <i className="uc-shards" />}
              <i className="uc-cut" />
              <i className="uc-white" />
            </div>
          )}
          {cine && !done && cine.tier === 0 && (
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

        {drag && (() => {
          const d = tacticDef(drag.id);
          return d ? (
            <div className="hc ghost" style={{ left: drag.x, top: drag.y, ["--rc" as string]: SPELL_COLOR[d.rank] }} aria-hidden>
              <CardFace d={d} />
            </div>
          ) : null;
        })()}
        <div ref={dockRef} className="ar-dockwrap">
        {waiting && pend && !auto && !intro && (() => {
          const u = info.current.get(pend.unit);
          if (!u) return null;
          const spent = cards.reduce((a, id) => a + (tacticDef(id)?.cost ?? 0), 0);
          const mana = pend.mana - spent;
          const pick = (o: ActOpt) => {
            if (!o.ready) return;
            if (o.targets.length > 1) {
              setSel((p) => (p?.a === o.a ? null : o));
              return;
            }
            decide({ a: o.a, t: o.targets[0], c: cards });
          };
          return (
            <div className={`ar-cmd ec-${u.element}`}>
              <div className="cmd-who">
                <span className="cmd-av">
                  <img src={`/api/cards/art/${u.cardId}?w=480`} alt="" draggable={false} />
                </span>
                <span className="cmd-wt">
                  <small>Ваш ход · раунд {pend.round}</small>
                  <b>{u.name}</b>
                </span>
              </div>
              <div className="cmd-acts" role="group" aria-label="Действие героя">
                {pend.acts.map((o) => {
                  const ult = o.a === "ult";
                  const sk = ult ? ultOf(u.cardId, u.cls) : o.a === "basic" ? null : skillDef(o.a);
                  const name = o.a === "basic" ? (u.cls === "support" ? "Атака / лечение" : "Атака") : (sk?.name ?? o.a);
                  const sub = ult ? (o.ready ? "Ультимейт готов" : `Энергия ${uv[u.key]?.en ?? 0}/${ENERGY.max}`) : o.cd > 0 ? `Перезарядка: ${o.cd}` : sk ? TARGET_LABEL[sk.target] : "Без перезарядки";
                  return (
                    <button key={o.a} type="button" disabled={!o.ready} aria-pressed={sel?.a === o.a} className={`cmd-act ${ult ? "ult" : ""} fx-c-${sk?.fx ?? "slash"}`} title={sk?.desc ?? "Обычная атака"} onClick={() => pick(o)}>
                      <span className="cmd-g">
                        <SkillGlyph fx={sk?.fx ?? "slash"} size={22} />
                      </span>
                      <span className="cmd-n">
                        <b>{name}</b>
                        <small>{sub}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="cmd-hand">
                <span className="cmd-mana" aria-label={`Мана: ${mana} из ${TACTIC_RULES.max}`}>
                  <em>Мана</em>
                  <b>
                    {mana}
                    <small>/{TACTIC_RULES.max}</small>
                  </b>
                  <span>
                    {Array.from({ length: TACTIC_RULES.max }, (_, i) => (
                      <i key={i} className={i < mana ? "on" : ""} />
                    ))}
                  </span>
                </span>
                <div className="hc-row">
                  {pend.hand.map((id) => {
                    const d = tacticDef(id);
                    if (!d) return null;
                    const off = d.cost > mana;
                    const grab = (ev: React.PointerEvent) => {
                      if (off || ev.button !== 0) return;
                      const x0 = ev.clientX;
                      const y0 = ev.clientY;
                      let moved = false;
                      const mv = (e: PointerEvent) => {
                        if (!moved && Math.hypot(e.clientX - x0, e.clientY - y0) < 8) return;
                        moved = true;
                        setDrag({ id, x: e.clientX, y: e.clientY });
                      };
                      const up = (e: PointerEvent) => {
                        window.removeEventListener("pointermove", mv);
                        window.removeEventListener("pointerup", up);
                        window.removeEventListener("pointercancel", up);
                        if (!moved) {
                          setHold((h) => (h === id ? null : id));
                          return;
                        }
                        setDrag(null);
                        const top = dockRef.current?.getBoundingClientRect().top ?? 0;
                        if (e.type === "pointerup" && e.clientY < top - 8) playNow(id);
                      };
                      window.addEventListener("pointermove", mv);
                      window.addEventListener("pointerup", up);
                      window.addEventListener("pointercancel", up);
                    };
                    return (
                      <button key={id} type="button" className={`hc fx-c-${d.fx}${hold === id ? " on" : ""}${drag?.id === id ? " lifted" : ""}${off ? " off" : ""}`} style={{ ["--rc" as string]: SPELL_COLOR[d.rank] }} aria-pressed={hold === id} aria-disabled={off} title={`${d.name}: ${d.desc}`} onPointerDown={grab} onClick={(e) => { if (e.detail === 0 && !off) setHold((h) => (h === id ? null : id)); }}>
                        <CardFace d={d} />
                      </button>
                    );
                  })}
                  {pend.hand.length === 0 && <p className="hc-empty">Рука пуста: новые карты придут в следующем раунде</p>}
                </div>
              </div>
              <p className="cmd-hint">
                {hold ? (
                  <>
                    Нажмите на поле или героя, чтобы сыграть карту
                    <button type="button" className="hc-go" onClick={() => playNow(hold)}>Сыграть</button>
                  </>
                ) : sel ? "Выберите цель на поле" : "Перетащите карту боя на поле, чтобы сыграть её, затем выберите действие героя"}
              </p>
            </div>
          );
        })()}

        <ul className="ar-log" aria-live="off">
          {log.slice(-4).map((l, i) => (
            <li key={`${i}-${l}`}>{l}</li>
          ))}
        </ul>
        </div>

        {infoKey && (() => {
          const u = info.current.get(infoKey);
          if (!u) return null;
          const v = uv[u.key];
          const rk = RANKS[u.rank];
          const sks = (u.skills ?? []).map((id) => skillDef(id)).filter((x): x is NonNullable<typeof x> => !!x);
          const ult = ultOf(u.cardId, u.cls);
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

        {done && !outroOver && (
          <div className={`ar-outro ${report.raid ? "raid" : report.win ? "win" : "lose"}`} role="status" onClick={() => setOutroOver(true)}>
            <i className="ao-veil" />
            <i className="ao-rays" />
            <div className="ao-core">
              <small>{report.raid ? "Рейд" : report.pvp ? "Бой с игроком" : report.campaign ? "Кампания" : "Бой окончен"}</small>
              <b data-t={report.raid ? "Удар нанесён" : report.win ? "Победа" : "Поражение"}>{report.raid ? "Удар нанесён" : report.win ? "Победа" : "Поражение"}</b>
              <i className="ao-bar" />
            </div>
          </div>
        )}
        {done && outroOver && (
          <div className="rs-scrim" role="dialog" aria-modal="true" aria-label={report.win ? "Победа" : "Поражение"}>
            <div ref={resRef} className={`rs ${report.win ? "rs-win" : "rs-lose"}`}>
              <header className="rs-head">
                <span className="rs-eye">{report.raid ? "Рейд" : report.campaign ? "Кампания" : report.training ? "Тренировка" : report.pvp ? "Бой с игроком" : "Бой"}</span>
                <h2>{report.raid ? "Удар по боссу" : report.win ? "Победа" : "Поражение"}</h2>
                <p>
                  {report.outcome.rounds} раунд. · урон отряда {fmt(stats.side.a.dmg)} · потери {report.outcome.a.filter((u) => u.hp <= 0).length} из {report.outcome.a.length}
                </p>
              </header>

              <div className="rs-main">
                {stats.mvp && (
                  <div className="rs-mvp">
                    <span className="rs-mvp-tag">
                      <Ico name="crown" size={13} /> MVP
                    </span>
                    <div className="rs-mvp-card">
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
                <ul className="rs-kpi">
                  <li><Ico name="swords" size={16} /><b>{fmt(stats.side.a.dmg)}</b><small>урона нанесено</small></li>
                  <li><Ico name="target" size={16} /><b>{stats.side.a.crits}</b><small>критов</small></li>
                  <li><Ico name="bolt" size={16} /><b>{fmt(stats.side.a.best)}</b><small>лучший удар</small></li>
                  <li><Ico name="skull" size={16} /><b>{stats.side.a.kills}</b><small>врагов повержено</small></li>
                  <li><Ico name="fire" size={16} /><b>×{Math.max(1, maxCombo.current.a)}</b><small>лучшая серия</small></li>
                  <li><Ico name="heart" size={16} /><b>{fmt(stats.side.a.heal)}</b><small>вылечено</small></li>
                </ul>
              </div>

              <div className="rs-tbl" aria-label="Статистика героев">
                {report.you.map((u) => {
                  const v = stats.per.get(u.key) ?? { dmg: 0, heal: 0, crits: 0, kills: 0, best: 0 };
                  const top = Math.max(1, ...report.you.map((x) => stats.per.get(x.key)?.dmg ?? 0));
                  const alive = (report.outcome.a.find((x) => x.key === u.key)?.hp ?? 0) > 0;
                  return (
                    <div key={u.key} className={`rs-row ${stats.mvp?.u.key === u.key ? "mvp" : ""} ${alive ? "" : "out"}`}>
                      <span className="rs-av" style={{ ["--rc" as string]: RANKS[u.rank]?.color ?? "#8fb0ff" }}><img src={`/api/cards/art/${u.cardId}?w=480`} alt="" loading="lazy" /></span>
                      <span className="rs-nm"><b>{u.name}</b><small>{v.kills ? `побед ${v.kills} · ` : ""}{v.crits ? `критов ${v.crits}` : alive ? "в строю" : "выбыл"}</small></span>
                      <span className="rs-bar"><i style={{ width: `${(v.dmg / top) * 100}%` }} /></span>
                      <span className="rs-num"><b>{fmt(v.dmg)}</b>{v.heal > 0 && <small>+{fmt(v.heal)}</small>}</span>
                    </div>
                  );
                })}
              </div>

              {report.campaign && (
                <div className="rs-stars" aria-label={`Звёзд: ${report.campaign.stars} из 3`}>
                  {[0, 1, 2].map((i) => (
                    <Ico key={i} name="star" size={34} className={i < report.campaign!.stars ? "on" : ""} />
                  ))}
                </div>
              )}
              {report.raid && (
                <p className="rs-note">
                  <b>{report.raid.damage.toLocaleString("ru-RU")}</b> урона · запас босса {report.raid.poolHp.toLocaleString("ru-RU")} / {report.raid.poolMax.toLocaleString("ru-RU")}
                  {report.raid.defeated ? " · босс повержен!" : ""} · попыток сегодня: {report.raid.hitsLeft}
                </p>
              )}
              {report.training ? (
                <p className="rs-note">Тренировка: награды не меняются, бустер не потрачен.</p>
              ) : report.campaign ? (
                <div className="rs-rew">
                  <span className="rs-chip">{report.campaign.newStars > 0 ? `Новых звёзд: ${report.campaign.newStars}` : "Новых звёзд нет"}</span>
                  {report.campaign.reward.diamonds ? <span className="rs-chip"><Cur k="diamonds" /> {report.campaign.reward.diamonds}</span> : null}
                  {report.campaign.reward.dust ? <span className="rs-chip"><Cur k="dust" /> {report.campaign.reward.dust}</span> : null}
                </div>
              ) : report.raid ? null : (
                <div className="rs-rew">
                  <span className="rs-chip"><Cur k="diamonds" /> {report.reward.diamonds}</span>
                  <span className="rs-chip"><Cur k="dust" /> {report.reward.dust}</span>
                  {report.reward.scroll ? <span className="rs-chip"><Ico name="scroll" size={15} /> свиток заточки</span> : null}
                  <span className={`rs-chip rt ${report.reward.rating >= 0 ? "up" : "down"}`}>
                    <Ico name="trophy" size={15} /> рейтинг {report.reward.rating > 0 ? "+" : ""}
                    {report.reward.rating}
                  </span>
                </div>
              )}
              {(report.drops?.relic || report.drops?.booster) && (
                <div className="rs-loot">
                  {report.drops.relic && (
                    <div className="rs-drop" style={{ ["--rc" as string]: RARITY[relicDef(report.drops.relic.id)?.rarity ?? "rare"].color }}>
                      <RelicTile id={report.drops.relic.id} lv={report.drops.relic.lv} size="md" label={false} />
                      <span>
                        <small>{report.drops.relic.dup ? "Повторная реликвия" : "Новая реликвия!"}</small>
                        <b>{relicDef(report.drops.relic.id)?.name}</b>
                        <em>{report.drops.relic.dup ? `обращена в ${report.drops.relic.dust} пыли` : RARITY[relicDef(report.drops.relic.id)?.rarity ?? "rare"].name}</em>
                      </span>
                    </div>
                  )}
                  {report.drops.booster && (
                    <div className="rs-drop">
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
              <button type="button" className="rs-btn" onClick={onClose} autoFocus>
                Закрыть
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
    </Portal>
  );
}

function CardFace({ d }: { d: NonNullable<ReturnType<typeof tacticDef>> }) {
  return (
    <>
      <SpellArt id={d.id} fx={d.fx} size={34} />
      <i className="hc-cost">{d.cost}</i>
      <em className="hc-rank">{SPELL_RANK[d.rank]}</em>
      <b>{d.name}</b>
      <small>{d.desc}</small>
    </>
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
