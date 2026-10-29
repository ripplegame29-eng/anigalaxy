"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BattleEvent, BattleOutcome, StatusKind, Unit } from "@/lib/cards/battle";
import { setSound, sfx, useSoundOn } from "@/lib/cards/sound";
import { ENERGY, passiveDef, skillDef, type SkillFx } from "@/lib/cards/skills";
import type { Synergy } from "@/lib/cards/synergy";
import { GameCard } from "./GameCard";
import { Portal } from "./common";
import { SkillGlyph, SynChips, TARGET_LABEL } from "./skillui";
import { Cur, Ico, type IcoName } from "./icons";

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
  kind: "dmg" | "crit" | "heal" | "shield" | "dot" | "info";
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

export function Arena({ report, onClose }: { report: BattleReport; onClose: () => void }) {
  const events = report.outcome.events;
  const snd = useSoundOn();
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
  const [log, setLog] = useState<string[]>([]);
  const counter = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const done = step >= events.length;
  const calm = useRef(reduced());

  useEffect(() => {
    const list = timers.current;
    return () => list.forEach(clearTimeout);
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

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

  /** Проигрывает событие, возвращает его длительность (мс) */
  const play = (e: BattleEvent): number => {
    setRound(e.round);
    switch (e.t) {
      case "cast": {
        const sk = skillDef(e.skill);
        const ult = !!e.ult;
        const who = nameOf(e.from);
        const nm = sk?.name ?? e.skill;
        sfx(ult ? "ult" : "cast");
        say(`${who} применяет ${ult ? "УЛЬТИМЕЙТ " : ""}«${nm}»`);
        const lite = calm.current || ecoOn();
        const casterCls = info.current.get(e.from)?.cls;
        const n = ++counter.current;
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
        addFloat(e.to, `−${e.dmg - e.absorbed > 0 ? e.dmg - e.absorbed : e.dmg}`, e.crit ? "crit" : "dmg");
        if (e.absorbed > 0) addFloat(e.to, `щит −${e.absorbed}`, "shield");
        shake(e.to, e.crit);
        sfx(e.crit ? "crit" : "hit");
        if (e.dead) window.setTimeout(() => sfx("ko"), 220);
        if (!e.skill) {
          act(e.from, "atk", 600);
          burst([e.to], "slash");
        }
        if (e.crit) {
          flashScreen("crit");
          shakeField("lite");
        }
        say(`${nameOf(e.from)} → ${nameOf(e.to)}: −${e.dmg}${e.skill === "p-thorns" ? " (шипы)" : ""}${e.crit ? " (крит)" : ""}${e.dead ? ", повержен" : ""}`);
        return e.skill ? 480 : 720;
      }
      case "heal":
        patch(e.to, (u) => ({ ...u, hp: e.hp }));
        addFloat(e.to, `+${e.amount}`, "heal");
        sfx("heal");
        if (!e.skill) {
          act(e.from, "cast", 700);
          burst([e.to], "heal");
        }
        say(`${nameOf(e.from)} лечит ${nameOf(e.to)}: +${e.amount}`);
        return e.skill ? 420 : 700;
      case "shield":
        patch(e.to, (u) => ({ ...u, sh: e.amount, st: u.st.includes("shield") ? u.st : [...u.st, "shield"] }));
        addFloat(e.to, `щит ${e.amount}`, "shield");
        sfx("shield");
        return 420;
      case "status":
        patch(e.to, (u) => ({ ...u, st: e.on ? (u.st.includes(e.kind) ? u.st : [...u.st, e.kind]) : u.st.filter((k) => k !== e.kind), sh: e.kind === "shield" && !e.on ? 0 : u.sh }));
        if (e.on) addFloat(e.to, STATUS_ICO[e.kind].label, "info");
        return e.on ? 260 : 120;
      case "dot":
        patch(e.to, (u) => ({ ...u, hp: e.hp, sh: e.sh, st: e.dead ? [] : u.st }));
        addFloat(e.to, `−${e.dmg}`, "dot");
        burst([e.to], "fire");
        say(`${nameOf(e.to)} получает урон от горения: −${e.dmg}`);
        return 560;
      case "energy":
        patch(e.to, (u) => ({ ...u, en: e.en }));
        return 0;
      case "revive": {
        patch(e.to, (u) => ({ ...u, hp: e.hp }));
        addFloat(e.to, passiveDef("p-revive")?.name ?? "Второе дыхание", "heal");
        burst([e.to], "heal");
        say(`${nameOf(e.to)} возвращается в бой: «Второе дыхание»`);
        return 800;
      }
      case "skip":
        addFloat(e.from, "Пропуск хода", "info");
        say(`${nameOf(e.from)} оглушён и пропускает ход`);
        return 600;
    }
  };

  useEffect(() => {
    if (done) return;
    const t = setTimeout(() => {
      const dur = play(events[step]);
      setDelay(calm.current ? 160 : dur / speed);
      setStep((s) => s + 1);
    }, delay / (step === 0 ? speed : 1));
    return () => clearTimeout(t);
    // play зависит только от стабильных колбэков и состояния отображения
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, done, speed]);

  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(() => {
      if (report.raid) sfx("star");
      else sfx(report.win ? "win" : "lose");
    }, 250);
    return () => window.clearTimeout(t);
  }, [done, report.win, report.raid]);

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
    setStep(events.length);
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
          <div key={u.key} className={`ar-unit ${dead ? "dead" : ""} ${acting[u.key] ? `act-${acting[u.key]}` : ""} ${ht ? "hit" : ""} ${ht?.crit ? "crit" : ""} ${v.en >= ENERGY.max && !dead ? "ult-ready" : ""} ${stc}`} style={{ ["--dir" as string]: s === "a" ? 1 : -1 }}>
            <div className="ar-card" data-uk={u.key}>
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
          <span className="cg-chip">Раунд {round}</span>
          <button type="button" className="cg-btn sm" aria-pressed={snd} aria-label={snd ? "Выключить звук" : "Включить звук"} onClick={() => setSound(!snd)}>
            <Ico name={snd ? "vol" : "volx"} size={15} />
          </button>
          {!done && (
            <>
              <div className="cg-seg" role="group" aria-label="Скорость">
                {([1, 2] as const).map((n) => (
                  <button key={n} type="button" aria-pressed={speed === n} onClick={() => setSpeed(n)}>
                    ×{n}
                  </button>
                ))}
              </div>
              <button type="button" className="cg-btn sm" onClick={skip}>
                Пропустить
              </button>
            </>
          )}
        </div>

        {((report.youSyn?.length ?? 0) > 0 || (report.foeSyn?.length ?? 0) > 0) && (
          <div className="ar-syns">
            <SynChips list={report.youSyn ?? []} />
            <SynChips list={report.foeSyn ?? []} right />
          </div>
        )}

        <div ref={fieldRef} className={`ar-field ${flash ? `flash-${flash}` : ""} ${shk ? `shk-${shk}` : ""} ${cine ? "cine-on" : ""}`}>
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
              <div className="ar-vs">VS</div>
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

        {done && (
          <div className={`ar-result ${report.win ? "win" : "lose"}`}>
            <h2>{report.raid ? "Удар по боссу" : report.win ? "Победа" : "Поражение"}</h2>
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
              <p className="cg-hint">Тренировка: награды не меняются.</p>
            ) : report.campaign ? (
              <p className="cg-hint">
                {report.campaign.newStars > 0 ? `Новых звёзд: ${report.campaign.newStars}` : "Новых звёзд нет"}
                {report.campaign.reward.diamonds ? <> · {report.campaign.reward.diamonds} <Cur k="diamonds" /></> : null}
                {report.campaign.reward.dust ? <> · {report.campaign.reward.dust} <Cur k="dust" /></> : null}
              </p>
            ) : report.raid ? null : (
              <p className="cg-hint">
                {report.reward.diamonds} <Cur k="diamonds" /> · {report.reward.dust} <Cur k="dust" />
                {report.reward.scroll ? " · свиток заточки" : ""} · рейтинг {report.reward.rating > 0 ? "+" : ""}
                {report.reward.rating}
              </p>
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
