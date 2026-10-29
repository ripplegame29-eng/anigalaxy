"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BattleEvent, BattleOutcome, StatusKind, Unit } from "@/lib/cards/battle";
import { setSound, sfx, useSoundOn } from "@/lib/cards/sound";
import { ENERGY, passiveDef, skillDef, type SkillFx } from "@/lib/cards/skills";
import type { Synergy } from "@/lib/cards/synergy";
import { GameCard } from "./GameCard";
import { Portal } from "./common";
import { SkillGlyph, SynChips } from "./skillui";
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
  const [acting, setActing] = useState<Record<string, "cast" | "atk">>({});
  const [hit, setHit] = useState<Record<string, number>>({});
  const [banner, setBanner] = useState<{ text: string; fx: SkillFx; n: number; ult: boolean } | null>(null);
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
    (key: string) => {
      const n = ++counter.current;
      setHit((p) => ({ ...p, [key]: n }));
      later(() => setHit((p) => (p[key] === n ? Object.fromEntries(Object.entries(p).filter(([k]) => k !== key)) : p)), 480);
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
        sfx(e.ult ? "ult" : "cast");
        act(e.from, "cast", 900);
        setBanner({ text: `${nameOf(e.from)} · ${sk?.name ?? e.skill}`, fx: e.fx, n: ++counter.current, ult: !!e.ult });
        burst(e.targets, e.fx);
        flashScreen(e.ult ? "ult" : e.fx);
        if (e.ult) act(e.from, "cast", 1300);
        say(`${nameOf(e.from)} применяет ${e.ult ? "УЛЬТИМЕЙТ " : ""}«${sk?.name ?? e.skill}»`);
        return e.ult ? 1500 : 950;
      }
      case "hit": {
        patch(e.to, (u) => ({ ...u, hp: e.hp, sh: e.sh, st: e.dead ? [] : u.st }));
        addFloat(e.to, `−${e.dmg - e.absorbed > 0 ? e.dmg - e.absorbed : e.dmg}`, e.crit ? "crit" : "dmg");
        if (e.absorbed > 0) addFloat(e.to, `щит −${e.absorbed}`, "shield");
        shake(e.to);
        sfx(e.crit ? "crit" : "hit");
        if (e.dead) window.setTimeout(() => sfx("ko"), 220);
        if (!e.skill) {
          act(e.from, "atk", 600);
          burst([e.to], "slash");
        }
        if (e.crit) flashScreen("crit");
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
    setBanner(null);
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
        return (
          <div key={u.key} className={`ar-unit ${dead ? "dead" : ""} ${acting[u.key] ? `act-${acting[u.key]}` : ""} ${hit[u.key] ? "hit" : ""} ${v.en >= ENERGY.max && !dead ? "ult-ready" : ""}`} style={{ ["--dir" as string]: s === "a" ? 1 : -1 }}>
            <div className="ar-card">
              <GameCard cardId={u.cardId} foil={u.foil} level={u.level} stats={false} />
              {f && <span key={f.n} className={`ar-fx fx-${f.fx}`} aria-hidden />}
              <span key={`h${hit[u.key] ?? 0}`} className="ar-hitfx" aria-hidden />
            </div>
            <div className="ar-hp" role="progressbar" aria-valuemin={0} aria-valuemax={u.maxHp} aria-valuenow={v.hp} aria-label={`${u.name}: здоровье`}>
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
                  <span key={x.id} className={`ar-float ${x.kind}`} style={{ ["--x" as string]: `${((x.id * 37) % 41) - 20}px` }}>
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

        <div className={`ar-field ${flash ? `flash-${flash}` : ""}`}>
          {side(report.you, "a")}
          <div className="ar-mid">
            {banner && !done ? (
              <div key={banner.n} className={`ar-banner fx-c-${banner.fx} ${banner.ult ? "ult" : ""}`}>
                {banner.ult && <b className="ar-ult-tag">Ультимейт</b>}
                <SkillGlyph fx={banner.fx} size={22} />
                <span>{banner.text}</span>
              </div>
            ) : (
              <div className="ar-vs">VS</div>
            )}
          </div>
          {side(report.foe, "b")}
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
