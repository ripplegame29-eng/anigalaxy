"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  CAPITAL_HP,
  CLAIM_COST,
  EDGE_FOR_DIR,
  HEX_SIZE,
  KINDS,
  MIN_ACTION,
  MIN_ATTACK,
  MIN_WORLD_MEMBERS,
  NEIGHBOR_DIRS,
  TIER_NAME,
  TILE_SCORE,
  TILE_TRIBUTE,
  WORLD_REWARDS,
  buildWorld,
  claimCost,
  hexPoints,
  type TileKind,
  type WorldTile,
} from "@/lib/clan-world";
import { addNotice, purchaseItem } from "@/lib/profile";
import { playSfx } from "@/lib/sfx";
import { num, timeLeft, useNow } from "./common";
import "../../app/clan-world.css";

interface TileS { tileId: number; clanId: number; hp: number; shieldUntil: number; capital: boolean; since: number }
interface ClanS { id: number; name: string; tag: string; league: number; color: string }
interface Row { rank: number; clanId: number; name: string; tag: string; tiles: number; score: number; tribute: number }
interface FeedItem { id: number; kind: string; tileId: number; clanId: number; otherId: number; amount: number; at: number; clan: string; other: string }
interface Mine { id: number; name: string; tag: string; role: string; color: string; owned: number; points: number; spent: number; available: number }
interface Data { season: string; endsAt: number; tiles: TileS[]; clans: ClanS[]; standings: Row[]; feed: FeedItem[]; mine: Mine | null }

const TITLE_NAME: Record<string, string> = { "t-world-sovereign": "Владыка карты", "t-world-warlord": "Завоеватель", "t-world-keeper": "Страж границ" };

async function api(url: string, body?: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  try {
    const res = await fetch(url, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: { error: "Нет связи с сервером" } };
  }
}

/* ------------------------------ Значки местности ------------------------ */

function Glyph({ kind, x, y, s }: { kind: TileKind; x: number; y: number; s: number }): ReactNode {
  const t = `translate(${x} ${y}) scale(${s})`;
  const common = { fill: "none", stroke: "rgba(255,255,255,.62)", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (kind) {
    case "mountain":
      return <g transform={t} {...common}><path d="M-12 8 -3 -8 3 0 7 -5 14 8z" /><path d="M-3 -8-1 -3" /></g>;
    case "forest":
      return <g transform={t} {...common}><path d="M-8 8-8 4M-12 4l4-9 4 9zM6 8V3M2 3l4-8 4 8z" /></g>;
    case "crystal":
      return <g transform={t} {...common}><path d="M0-11 6-2 0 9-6-2zM-6-2h12M0-11v20" /></g>;
    case "rift":
      return <g transform={t} {...common}><path d="M-3-11 3-3-4 1 4 11" strokeWidth={2.2} /></g>;
    case "shrine":
      return <g transform={t} {...common}><path d="M-11-6h22M-8-2h16M-6-6v14M6-6v14" /></g>;
    case "ruins":
      return <g transform={t} {...common}><path d="M-9 9V-2h4v5h3V-7h4v10h3V0h4v9z" /></g>;
    case "city":
      return <g transform={t} {...common}><path d="M-10 9V-1l5-4 5 4v10M0 9V-7l5-4 5 4v16M-10 9h20" /></g>;
    case "throne":
      return <g transform={t} fill="rgba(255,224,150,.9)" stroke="#fff3c9" strokeWidth={1.2}><path d="M-12 9h24l2-17-7 6-7-11-7 11-7-6z" /></g>;
    default:
      return <g transform={t} {...common}><path d="M-11 4q5.5-6 11 0t11 0M-11 10q5.5-6 11 0t11 0" opacity=".6" /></g>;
  }
}

const Crown = ({ x, y, s, c }: { x: number; y: number; s: number; c: string }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} className="cw-crown">
    <path d="M-10 6h20l2-12-6 5-6-9-6 9-6-5z" fill={c} stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
  </g>
);
const ShieldMark = ({ x, y, s }: { x: number; y: number; s: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} className="cw-shield">
    <path d="M0-8 7-5v5c0 4-3 7-7 9-4-2-7-5-7-9v-5z" fill="rgba(120,200,255,.25)" stroke="#9bdcff" strokeWidth="1.5" />
  </g>
);

/* --------------------------------- Карта ------------------------------- */

interface View { x: number; y: number; k: number }

export function WorldMapTab() {
  const world = useMemo(() => buildWorld(), []);
  const now = useNow();
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [sel, setSel] = useState<number | null>(null);
  const [panel, setPanel] = useState<"tile" | "rank" | "feed">("tile");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [amount, setAmount] = useState(300);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 0.55 });
  const [flash, setFlash] = useState<Set<number>>(new Set());
  const stage = useRef<HTMLDivElement>(null);
  const prev = useRef<Map<number, number>>(new Map());
  const size = useRef({ w: 900, h: 620 });
  const [box, setBox] = useState({ w: 900, h: 620 });
  const fitted = useRef(false);

  const load = useCallback(async () => {
    const r = await api("/api/clans/map");
    if (!r.ok) { setErr(String(r.data.error ?? "Не удалось загрузить карту")); return; }
    const d = r.data as unknown as Data;
    setErr("");
    // Подсвечиваем клетки, сменившие владельца после прошлого обновления
    const changed = new Set<number>();
    if (prev.current.size) for (const t of d.tiles) if (prev.current.get(t.tileId) !== t.clanId) changed.add(t.tileId);
    prev.current = new Map(d.tiles.map((t) => [t.tileId, t.clanId]));
    if (changed.size) { setFlash(changed); window.setTimeout(() => setFlash(new Set()), 2600); }
    setData(d);
  }, []);

  useEffect(() => {
    const first = window.setTimeout(() => void load(), 0);
    const id = window.setInterval(() => void load(), 20_000);
    return () => { window.clearTimeout(first); window.clearInterval(id); };
  }, [load]);

  /* Титулы за прошлые недели выдаём в профиль игрока */
  useEffect(() => {
    if (!data?.mine) return;
    void api("/api/clans/map/action", { action: "prizes" }).then((r) => {
      const titles = (r.data.titles as string[] | undefined) ?? [];
      for (const id of titles) { purchaseItem(id, 0); addNotice(`Карта мира: получен титул «${TITLE_NAME[id] ?? id}».`); }
    });
  }, [data?.mine?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const owners = useMemo(() => new Map((data?.tiles ?? []).map((t) => [t.tileId, t])), [data]);
  const clans = useMemo(() => new Map((data?.clans ?? []).map((c) => [c.id, c])), [data]);
  const mineId = data?.mine?.id ?? -1;
  const colorOf = (id: number) => (id === mineId && data?.mine ? data.mine.color : clans.get(id)?.color ?? "#8a93b8");

  /* Размер сцены и стартовый кадр на своей столице */
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(() => { size.current = { w: el.clientWidth, h: el.clientHeight }; setBox(size.current); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const focus = useCallback((tileId: number | null, k = 1.1) => {
    const { w, h } = size.current;
    const t = tileId === null ? null : world.tiles[tileId];
    const cx = t ? t.x : world.minX + world.width / 2;
    const cy = t ? t.y : world.minY + world.height / 2;
    setView({ k, x: w / 2 - cx * k, y: h / 2 - cy * k });
  }, [world]);
  useEffect(() => {
    if (!data || fitted.current) return;
    fitted.current = true;
    const cap = data.tiles.find((t) => t.capital && t.clanId === data.mine?.id);
    const { w, h } = size.current;
    if (cap) focus(cap.tileId, 1.15);
    else focus(null, Math.min(w / (world.width + 80), h / (world.height + 80)));
  }, [data, focus, world]);

  /* Перетаскивание и масштаб */
  const drag = useRef<{ id: number; x: number; y: number; moved: boolean; tile: number | null } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<number | null>(null);
  const zoomAt = useCallback((factor: number, px: number, py: number) => {
    setView((v) => {
      const k = Math.min(3.2, Math.max(0.3, v.k * factor));
      const f = k / v.k;
      return { k, x: px - (px - v.x) * f, y: py - (py - v.y) * f };
    });
  }, []);
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.14 : 1 / 1.14, e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const onDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const hit = (e.target as Element).closest?.("[data-tile]");
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, tile: hit ? Number(hit.getAttribute("data-tile")) : null };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current) {
        const r = stage.current!.getBoundingClientRect();
        zoomAt(d / pinch.current, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      }
      pinch.current = d;
      if (drag.current) drag.current.moved = true;
      return;
    }
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    d.moved = true;
    d.x = e.clientX;
    d.y = e.clientY;
    setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
  };
  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    pinch.current = null;
    const d = drag.current;
    if (d && d.id === e.pointerId && !d.moved && d.tile !== null && e.type === "pointerup") pick(d.tile);
    drag.current = null;
  };
  const pick = (id: number) => {
    setSel(id);
    setPanel("tile");
    setMsg(null);
  };

  /* Границы владений: ребро рисуем там, где сосед принадлежит другому клану или это берег */
  const borders = useMemo(() => {
    const out: { d: string; color: string; mine: boolean }[] = [];
    if (!data) return out;
    const byClan = new Map<number, string[]>();
    for (const t of data.tiles) {
      const tile = world.tiles[t.tileId];
      if (!tile) continue;
      const pts = hexPoints(tile.x, tile.y, HEX_SIZE);
      for (const [dq, dr] of NEIGHBOR_DIRS) {
        const nid = world.byCoord.get(`${tile.q + dq},${tile.r + dr}`);
        const same = nid !== undefined && owners.get(nid)?.clanId === t.clanId;
        if (same) continue;
        const e = EDGE_FOR_DIR[`${dq},${dr}`];
        const a = pts[e];
        const b = pts[(e + 1) % 6];
        const list = byClan.get(t.clanId) ?? [];
        list.push(`M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}`);
        byClan.set(t.clanId, list);
      }
    }
    for (const [id, list] of byClan) out.push({ d: list.join(""), color: colorOf(id), mine: id === mineId });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, world, owners, mineId]);

  const labels = useMemo(() => {
    if (!data) return [];
    const acc = new Map<number, { x: number; y: number; n: number }>();
    for (const t of data.tiles) {
      const tile = world.tiles[t.tileId];
      const a = acc.get(t.clanId) ?? { x: 0, y: 0, n: 0 };
      a.x += tile.x; a.y += tile.y; a.n += 1;
      acc.set(t.clanId, a);
    }
    return [...acc].map(([id, a]) => ({ id, x: a.x / a.n, y: a.y / a.n, n: a.n, tag: clans.get(id)?.tag ?? "" }));
  }, [data, world, clans]);

  const recentSiege = useMemo(() => {
    const s = new Set<number>();
    for (const f of data?.feed ?? []) if (f.kind === "siege" && now - f.at < 15 * 60_000) s.add(f.tileId);
    return s;
  }, [data, now]);

  const mine = data?.mine ?? null;
  const canAct = !!mine && mine.role !== "member";
  const touches = useCallback((tileId: number) => world.tiles[tileId].neighbors.some((n) => owners.get(n)?.clanId === mineId), [world, owners, mineId]);

  const act = async (action: string, tile: number, amt?: number) => {
    setBusy(true);
    const r = await api("/api/clans/map/action", { action, tile, amount: amt });
    setBusy(false);
    if (r.ok) {
      const res = r.data.result as { captured?: boolean; spent?: number } | null;
      const text = action === "found" ? "Столица основана. Щит активен 12 часов." : action === "claim" ? "Земля ваша." : action === "fortify" ? `Укреплено на ${num(res?.spent ?? 0)}.` : res?.captured ? "Клетка захвачена!" : `Осада: потрачено ${num(res?.spent ?? 0)} влияния.`;
      setMsg({ ok: true, text });
      playSfx(res?.captured ? "reward" : "ok");
      await load();
    } else {
      setMsg({ ok: false, text: String(r.data.error ?? "Не получилось") });
      playSfx("err");
    }
  };

  const selTile: WorldTile | null = sel === null ? null : world.tiles[sel];
  const selState = sel === null ? undefined : owners.get(sel);
  const available = mine?.available ?? 0;

  if (err && !data) return <div className="cw-empty"><b>Карта недоступна</b><p>{err}</p><button type="button" onClick={() => void load()}>Повторить</button></div>;
  if (!data) return <div className="cw-empty"><div className="cw-spin" /><p>Рисуем карту мира…</p></div>;

  const accent = mine?.color ?? "#4d8bff";
  const opponent = selState && selState.clanId !== mineId ? clans.get(selState.clanId) : null;
  const maxHpSel = selTile ? (selState?.capital ? Math.max(selTile.maxHp, CAPITAL_HP) : selTile.maxHp) : 0;
  const shielded = !!selState && selState.shieldUntil > now;
  const noClan = !mine;
  const showSpawns = !!mine && canAct && mine.owned === 0;

  let actions: ReactNode = null;
  if (selTile) {
    if (noClan) actions = <p className="cw-hint">Вступите в клан во вкладке «Лига и кристаллы», чтобы бороться за земли.</p>;
    else if (!canAct) actions = <p className="cw-hint">Действовать на карте могут лидер и офицеры клана.</p>;
    else if (mine!.owned === 0) {
      actions = selTile.spawn && !selState
        ? <button className="cw-btn primary" disabled={busy} onClick={() => void act("found", selTile.id)}>Основать столицу здесь</button>
        : <p className="cw-hint">Столицу можно основать только на золотых пульсирующих клетках по краю карты. Выберите одну из них. В клане должно быть минимум {MIN_WORLD_MEMBERS} игрока.</p>;
    } else if (!selState) {
      const cost = claimCost(selTile.tier, mine!.owned);
      actions = touches(selTile.id)
        ? <button className="cw-btn primary" disabled={busy || available < cost} onClick={() => void act("claim", selTile.id)}>Занять за {num(cost)} влияния</button>
        : <p className="cw-hint">Занимать можно только клетки рядом с вашими землями.</p>;
    } else if (selState.clanId === mineId) {
      const missing = maxHpSel - selState.hp;
      actions = missing <= 0 ? <p className="cw-hint">Клетка на полной прочности.</p> : (
        <div className="cw-amount">
          <label>Укрепить на <b>{num(Math.min(amount, missing))}</b></label>
          <input type="range" min={MIN_ACTION} max={Math.max(MIN_ACTION, Math.min(available, missing))} step={10} value={Math.min(amount, Math.max(MIN_ACTION, Math.min(available, missing)))} onChange={(e) => setAmount(Number(e.target.value))} disabled={available < MIN_ACTION} />
          <button className="cw-btn" disabled={busy || available < MIN_ACTION} onClick={() => void act("fortify", selTile.id, Math.min(amount, missing))}>Укрепить</button>
        </div>
      );
    } else if (shielded) actions = <p className="cw-hint">Клетка под щитом ещё {timeLeft(selState.shieldUntil - now)}.</p>;
    else if (!touches(selTile.id)) actions = <p className="cw-hint">Атаковать можно только клетки рядом с вашими землями.</p>;
    else {
      const cap = Math.min(available, Math.ceil(selState.hp));
      actions = (
        <div className="cw-amount">
          <label>Осада: <b>{num(Math.min(amount, cap))}</b> из {num(Math.ceil(selState.hp))}</label>
          <input type="range" min={MIN_ATTACK} max={Math.max(MIN_ATTACK, cap)} step={10} value={Math.min(Math.max(amount, MIN_ATTACK), Math.max(MIN_ATTACK, cap))} onChange={(e) => setAmount(Number(e.target.value))} disabled={cap < MIN_ATTACK} />
          <button className="cw-btn danger" disabled={busy || cap < MIN_ATTACK} onClick={() => void act("attack", selTile.id, Math.min(amount, cap))}>Штурмовать</button>
        </div>
      );
    }
  }

  const feedText = (f: FeedItem): string => {
    const t = world.tiles[f.tileId]?.name ?? "земли";
    switch (f.kind) {
      case "found": return `${f.clan} основал столицу — ${t}`;
      case "claim": return `${f.clan} занял «${t}»`;
      case "siege": return `${f.clan} осаждает «${t}» (${f.other})`;
      case "capture": return `${f.clan} захватил «${t}» у ${f.other}`;
      case "fall": return `Пала столица ${f.other}: «${t}» захватил ${f.clan}`;
      case "fortify": return `${f.clan} укрепил «${t}»`;
      default: return f.kind;
    }
  };

  return (
    <div className="cw" style={{ ["--c" as string]: accent } as CSSProperties}>
      <div className="cw-hud">
        <div className="cw-hud-card">
          <small>Неделя заканчивается через</small>
          <b>{timeLeft(data.endsAt - now)}</b>
        </div>
        {mine ? (
          <div className="cw-hud-card wide">
            <small>Влияние клана [{mine.tag}] · земель: {mine.owned}</small>
            <b>{num(mine.available)} <em>из {num(mine.points)}</em></b>
            <div className="cw-meter"><i style={{ width: `${mine.points ? Math.min(100, (mine.available / mine.points) * 100) : 0}%` }} /></div>
          </div>
        ) : (
          <div className="cw-hud-card wide"><small>Вы смотрите карту как гость</small><b>Вступите в клан, чтобы воевать</b></div>
        )}
        <div className="cw-hud-card">
          <small>Награды недели</small>
          <b>до {num(WORLD_REWARDS[0].memberAc)} AC + титул</b>
        </div>
      </div>

      <div className="cw-body">
        <div className="cw-stage" ref={stage} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <svg className="cw-svg" width="100%" height="100%" role="img" aria-label="Карта мира кланов">
            <defs>
              {(Object.keys(KINDS) as TileKind[]).map((k) => (
                <linearGradient key={k} id={`cwk-${k}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={KINDS[k].a} /><stop offset="1" stopColor={KINDS[k].b} />
                </linearGradient>
              ))}
              <pattern id="cw-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0v8" stroke="rgba(255,255,255,.35)" strokeWidth="2" /></pattern>
              <radialGradient id="cw-throne-glow"><stop offset="0" stopColor="#ffe9a8" stopOpacity=".7" /><stop offset="1" stopColor="#ffe9a8" stopOpacity="0" /></radialGradient>
            </defs>
            <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
              <circle cx={0} cy={0} r={HEX_SIZE * 5} fill="url(#cw-throne-glow)" className="cw-glow" />
              <g className="cw-land">
                {world.tiles.map((t) => {
                  const st = owners.get(t.id);
                  const pts = hexPoints(t.x, t.y, HEX_SIZE - 0.8).map((p) => p.map((n) => n.toFixed(1)).join(",")).join(" ");
                  const color = st ? colorOf(st.clanId) : null;
                  const hot = recentSiege.has(t.id);
                  return (
                    <g key={t.id} className={`cw-tile${sel === t.id ? " sel" : ""}${flash.has(t.id) ? " flash" : ""}${hot ? " hot" : ""}`} data-tile={t.id}>
                      <polygon points={pts} fill={`url(#cwk-${t.kind})`} className="cw-base" />
                      {color && <polygon points={pts} fill={color} className="cw-own" style={{ opacity: st!.clanId === mineId ? 0.46 : 0.36 }} />}
                      {st && st.hp < (st.capital ? CAPITAL_HP : t.maxHp) * 0.4 && <polygon points={pts} fill="url(#cw-hatch)" opacity=".28" />}
                      {view.k > 0.45 && <Glyph kind={t.kind} x={t.x} y={t.y - 2} s={view.k > 1.3 ? 1.1 : 0.9} />}
                      {st?.capital && <Crown x={t.x} y={t.y - 20} s={0.9} c={color ?? "#fff"} />}
                      {st && st.shieldUntil > now && <ShieldMark x={t.x + 22} y={t.y + 18} s={0.9} />}
                      {st && view.k > 0.8 && (
                        <rect x={t.x - 18} y={t.y + 22} width={36 * Math.min(1, st.hp / (st.capital ? CAPITAL_HP : t.maxHp))} height={3.4} rx={1.7} fill={color ?? "#fff"} className="cw-hp" />
                      )}
                      {showSpawns && t.spawn && !st && <circle cx={t.x} cy={t.y} r={HEX_SIZE * 0.5} className="cw-spawn" />}
                      {hot && <polygon points={pts} fill="none" className="cw-alert" />}
                      {view.k > 1.6 && <text x={t.x} y={t.y + 36} className="cw-name">{t.name}</text>}
                    </g>
                  );
                })}
              </g>
              <g className="cw-borders" pointerEvents="none">
                {borders.map((b, i) => (
                  <path key={i} d={b.d} stroke={b.color} className={b.mine ? "mine" : ""} />
                ))}
              </g>
              {selTile && <polygon points={hexPoints(selTile.x, selTile.y, HEX_SIZE).map((p) => p.join(",")).join(" ")} className="cw-sel" pointerEvents="none" />}
              <g pointerEvents="none">
                {labels.map((l) => (
                  <g key={l.id} transform={`translate(${l.x} ${l.y})`} className="cw-label">
                    <text className="cw-tag" fontSize={Math.min(46, 20 + l.n * 1.6)}>{l.tag}</text>
                  </g>
                ))}
              </g>
            </g>
          </svg>

          <div className="cw-zoom">
            <button type="button" aria-label="Приблизить" onClick={() => zoomAt(1.3, size.current.w / 2, size.current.h / 2)}>+</button>
            <button type="button" aria-label="Отдалить" onClick={() => zoomAt(1 / 1.3, size.current.w / 2, size.current.h / 2)}>−</button>
            <button type="button" aria-label="К столице" title="К столице" onClick={() => { const cap = data.tiles.find((t) => t.capital && t.clanId === mineId); focus(cap ? cap.tileId : null, cap ? 1.15 : Math.min(size.current.w / (world.width + 80), size.current.h / (world.height + 80))); }}>◎</button>
          </div>
          <Legend />
          <MiniMap world={world} owners={owners} colorOf={colorOf} view={view} size={box} />
        </div>

        <aside className="cw-side">
          <nav className="cw-tabs">
            {([["tile", "Клетка"], ["rank", "Рейтинг"], ["feed", "Лента"]] as const).map(([id, label]) => (
              <button key={id} type="button" aria-pressed={panel === id} onClick={() => setPanel(id)}>{label}</button>
            ))}
          </nav>

          {panel === "tile" && (
            selTile ? (
              <div className="cw-card">
                <div className="cw-card-head" style={{ ["--k" as string]: KINDS[selTile.kind].a } as CSSProperties}>
                  <svg viewBox="-16 -16 32 32" width="46" height="46" aria-hidden><Glyph kind={selTile.kind} x={0} y={0} s={1.05} /></svg>
                  <div>
                    <h3>{selTile.name}</h3>
                    <small>{KINDS[selTile.kind].label} · {TIER_NAME[selTile.tier]}</small>
                  </div>
                </div>
                <p className="cw-blurb">{KINDS[selTile.kind].blurb}</p>
                <dl className="cw-facts">
                  <div><dt>Владелец</dt><dd>{selState ? <><i style={{ background: colorOf(selState.clanId) }} />{selState.clanId === mineId ? mine?.name : opponent?.name ?? "Клан"}</> : "Свободна"}</dd></div>
                  <div><dt>Прочность</dt><dd>{selState ? `${num(selState.hp)} / ${num(maxHpSel)}` : `${num(selTile.maxHp)} при занятии`}</dd></div>
                  <div><dt>Очки недели</dt><dd>+{TILE_SCORE[selTile.tier]} · дань {TILE_TRIBUTE[selTile.tier]} AC</dd></div>
                  {!selState && <div><dt>Цена</dt><dd>{num(mine ? claimCost(selTile.tier, mine.owned) : CLAIM_COST[selTile.tier])} влияния</dd></div>}
                  {selState && <div><dt>Щит</dt><dd>{shielded ? `ещё ${timeLeft(selState.shieldUntil - now)}` : "нет"}</dd></div>}
                  {selState?.capital && <div><dt>Статус</dt><dd>Столица клана</dd></div>}
                </dl>
                {selState && <div className="cw-hpbar"><i style={{ width: `${Math.min(100, (selState.hp / maxHpSel) * 100)}%`, background: colorOf(selState.clanId) }} /></div>}
                <div className="cw-actions">{actions}</div>
                {msg && <p className={`cw-msg ${msg.ok ? "ok" : "bad"}`} role="status">{msg.text}</p>}
              </div>
            ) : (
              <div className="cw-card"><p className="cw-hint">Выберите клетку на карте. Перетаскивайте, чтобы двигать, колесом или щипком меняйте масштаб.</p>
                <RewardsList /></div>
            )
          )}

          {panel === "rank" && (
            <div className="cw-card">
              <ol className="cw-rank">
                {data.standings.length === 0 && <li className="cw-hint">Земель пока никто не занял. Станьте первыми.</li>}
                {data.standings.map((r) => (
                  <li key={r.clanId} className={r.clanId === mineId ? "me" : ""} onClick={() => { const t = data.tiles.find((x) => x.clanId === r.clanId && x.capital) ?? data.tiles.find((x) => x.clanId === r.clanId); if (t) { focus(t.tileId, 1); setSel(t.tileId); setPanel("tile"); } }}>
                    <span className="n">{r.rank}</span>
                    <i style={{ background: colorOf(r.clanId) }} />
                    <span className="nm"><b>{r.name}</b><small>[{r.tag}] · {r.tiles} земель</small></span>
                    <span className="sc">{r.score}</span>
                  </li>
                ))}
              </ol>
              <RewardsList />
            </div>
          )}

          {panel === "feed" && (
            <div className="cw-card">
              <ul className="cw-feed">
                {data.feed.length === 0 && <li className="cw-hint">Тишина. Пока никто не воюет.</li>}
                {data.feed.map((f) => (
                  <li key={f.id} className={f.kind} onClick={() => { focus(f.tileId, 1.2); setSel(f.tileId); setPanel("tile"); }}>
                    <span>{feedText(f)}</span>
                    <small>{timeLeft(now - f.at)} назад</small>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function RewardsList() {
  return (
    <div className="cw-rewards">
      <h4>Награды недели</h4>
      <ul>
        {WORLD_REWARDS.map((r) => (
          <li key={r.label}>
            <b>{r.from === r.to ? `#${r.from}` : r.to > 999 ? `#${r.from}+` : `#${r.from}–${r.to}`} · {r.label}</b>
            <span>{r.memberAc} AC игроку · {r.treasuryAc} AC в казну{r.trophies ? ` · ${r.trophies} 🏆` : ""}{r.titleId ? ` · титул` : ""}</span>
          </li>
        ))}
      </ul>
      <small>Награду получают активные игроки клана, принёсшие хотя бы 150 очков. Плюс дань с каждой земли.</small>
    </div>
  );
}

function Legend() {
  return (
    <div className="cw-legend" aria-hidden>
      <span><i className="sh" />Щит</span>
      <span><i className="cr" />Столица</span>
      <span><i className="hot" />Осада</span>
    </div>
  );
}

function MiniMap({ world, owners, colorOf, view, size }: { world: ReturnType<typeof buildWorld>; owners: Map<number, TileS>; colorOf: (id: number) => string; view: View; size: { w: number; h: number } }) {
  const W = 150;
  const sc = W / world.width;
  const H = world.height * sc;
  const vx = (-view.x / view.k - world.minX) * sc;
  const vy = (-view.y / view.k - world.minY) * sc;
  return (
    <svg className="cw-mini" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden>
      {world.tiles.map((t) => {
        const st = owners.get(t.id);
        return <circle key={t.id} cx={(t.x - world.minX) * sc} cy={(t.y - world.minY) * sc} r={sc * HEX_SIZE * 0.82} fill={st ? colorOf(st.clanId) : "#2a3358"} opacity={st ? 0.95 : 0.7} />;
      })}
      <rect x={vx} y={vy} width={(size.w / view.k) * sc} height={(size.h / view.k) * sc} fill="none" stroke="#fff" strokeWidth="1.2" rx="2" />
    </svg>
  );
}
