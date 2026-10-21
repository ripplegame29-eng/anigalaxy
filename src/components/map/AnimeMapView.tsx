"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgTag } from "@/components/progression/AgTag";
import { AvatarView } from "@/components/profile/AvatarView";
import { PROGRESSION_CONFIG } from "@/lib/progression/progression.config";
import { useProgress } from "@/lib/progression/events";
import { useProfile } from "@/lib/profile";
import {
  NODE_H,
  NODE_W,
  RARITY_COLOR,
  RARITY_LABEL,
  ROUTES,
  allRewardItems,
  bonusItems,
  itemInfo,
  type ItemInfo,
  claimNode,
  foundStore,
  mapStore,
  resetLayout,
  setNodePos,
  viewRoute,
  type Found,
  type MapRoute,
  type NodeView,
} from "@/lib/anime-map";
import { watchStore } from "@/lib/history";
import "./anime-map.css";

/**
 * Карта аниме: граф маршрутов. Фон двигается мышью/пальцем, колесо и щипок
 * масштабируют, узлы можно перетаскивать (положение запоминается).
 */

interface Cam {
  x: number;
  y: number;
  k: number;
}
const K_MIN = 0.35;
const K_MAX = 2.2;
const STATUS_LABEL: Record<NodeView["status"], string> = {
  locked: "Закрыто",
  open: "Можно начинать",
  doing: "В процессе",
  done: "Готово к награде",
  claimed: "Пройдено",
};

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/* ----------------------- Карточка награды (как в магазине) ----------------------- */

const nf = new Intl.NumberFormat("ru-RU");

function ItemArt({ info }: { info: ItemInfo }) {
  if (info.kind === "tag") {
    const tag = PROGRESSION_CONFIG.tags.find((t) => t.id === info.id);
    return tag ? <AgTag tag={tag} /> : null;
  }
  if (info.kind === "frame") {
    return <AvatarView nickname="AG" frameImg={info.img} frameScale={info.scale} className="h-16 w-16" textClass="text-base" />;
  }
  return <span className="am-title-art">{info.name}</span>;
}

function RewardCard({ id, owned, compact }: { id: string; owned: boolean; compact?: boolean }) {
  const info = itemInfo(id);
  if (!info) return null;
  const color = RARITY_COLOR[info.rarity] ?? "#9fb0d6";
  return (
    <div className={`am-rc${compact ? " compact" : ""}${owned ? " owned" : ""}`} style={{ "--rc": color } as React.CSSProperties}>
      <div className="am-rc-art"><ItemArt info={info} /></div>
      <div className="am-rc-body">
        <small>{RARITY_LABEL[info.rarity] ?? info.rarity} · {info.kind === "tag" ? "Тег" : info.kind === "frame" ? "Рамка" : "Титул"}</small>
        <b>{info.name}</b>
        <div className="am-rc-price">
          <s>{nf.format(info.price)} AC</s>
          <em>{owned ? "Получено ✓" : "Бесплатно"}</em>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Узел карты ------------------------------ */

function NodeCard({ view, index, found, selected, start, pos }: {
  view: NodeView;
  index: number;
  found: Found | null | undefined;
  selected: boolean;
  start: boolean;
  pos: [number, number];
}) {
  const { node, status, watched } = view;
  const pct = Math.round((watched / node.need) * 100);
  return (
    <div
      className={`am-n s-${status}${selected ? " sel" : ""}${node.tag === "boss" ? " boss" : ""}`}
      data-node={node.id}
      style={{ left: pos[0], top: pos[1], width: NODE_W }}
    >
      {start && <span className="am-here">▶ Начните отсюда</span>}
      <div className="am-poster" style={{ "--p": `${pct}%` } as React.CSSProperties}>
        {found?.poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={found.poster} alt="" draggable={false} referrerPolicy="no-referrer" />
        ) : (
          <span className="am-ph">{node.title.slice(0, 1)}</span>
        )}
        {status === "locked" && <i className="am-lock" aria-hidden>🔒</i>}
        {status === "done" && <i className="am-gift" aria-hidden>🎁</i>}
        {status === "claimed" && <i className="am-ck" aria-hidden>✓</i>}
        {(status === "doing" || status === "open") && node.need > 1 && <b className="am-bar"><u style={{ width: `${pct}%` }} /></b>}
      </div>
      <span className="am-num">{index + 1}</span>
      <b className="am-t">{node.title}</b>
      <small className="am-m">{node.year} · {node.kind}</small>
      {node.tag === "side" && <small className="am-tag">Побочная ветка</small>}
      {node.tag === "boss" && <small className="am-tag boss">Финал маршрута</small>}
    </div>
  );
}

/* --------------------------- Панель выбранного -------------------------- */

function Panel({ view, found, onClose, onClaim, owned }: {
  owned: (id: string) => boolean;
  view: NodeView;
  found: Found | null | undefined;
  onClose: () => void;
  onClaim: () => void;
}) {
  const { node, status, watched } = view;
  const href = found?.id ? `/title/${found.id}` : `/catalog?q=${encodeURIComponent(node.q)}`;
  return (
    <aside className="am-panel" aria-label="Выбранный тайтл">
      <div className="am-ph-top">
        <small>Выбранный тайтл</small>
        <button type="button" onClick={onClose} aria-label="Закрыть">✕</button>
      </div>
      <div className="am-pi">
        <div className="am-pp">
          {found?.poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={found.poster} alt="" referrerPolicy="no-referrer" />
          ) : (
            <span className="am-ph">{node.title.slice(0, 1)}</span>
          )}
        </div>
        <div>
          <h3>{node.title}</h3>
          <div className="am-chips"><span>{node.year}</span><span>{node.kind}</span><span>{node.need} эп.</span></div>
        </div>
      </div>
      <p className="am-blurb">{node.blurb}</p>
      <div className="am-quest">
        <small>Задание</small>
        <b>Посмотрите {node.need} {node.need === 1 ? "серию" : node.need < 5 ? "серии" : "серий"}</b>
        <div className="am-qbar"><u style={{ width: `${(watched / node.need) * 100}%` }} /></div>
        <span>{watched} из {node.need} · {STATUS_LABEL[status]}</span>
      </div>
      <div className="am-reward">
        <span><i className="am-coin" />+{node.ac} AC</span>
        <span><i className="am-xp">XP</i>+{node.xp}</span>
      </div>
      {node.item && <RewardCard id={node.item} owned={owned(node.item)} />}
      {status === "done" ? (
        <button type="button" className="am-cta" onClick={onClaim}>Забрать награду</button>
      ) : status === "claimed" ? (
        <div className="am-claimed">Награда получена ✓</div>
      ) : status === "locked" ? (
        <div className="am-claimed lock">Сначала пройдите предыдущие тайтлы</div>
      ) : (
        <Link className="am-cta" href={href}>Смотреть</Link>
      )}
      {(status === "doing" || status === "done") && (
        <Link className="am-link" href={href}>Открыть страницу тайтла</Link>
      )}
    </aside>
  );
}

/* ------------------------------ Главный вид ----------------------------- */

export function AnimeMapView() {
  const state = mapStore.useStore();
  const watch = watchStore.useStore();
  const found = foundStore.useStore();
  const [routeId, setRouteId] = useState(ROUTES[0].id);
  const [mode, setMode] = useState<"graph" | "list" | "rewards">("graph");
  const profile = useProfile();
  const progress = useProgress();
  const owned = useCallback(
    (id: string) => {
      const info = itemInfo(id);
      if (!info) return false;
      return info.kind === "tag" ? Boolean(progress.tags[id]) : profile.purchased.includes(id);
    },
    [profile.purchased, progress.tags],
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [cam, setCam] = useState<Cam>({ x: 40, y: 40, k: 1 });
  const [toast, setToast] = useState<string | null>(null);
  const [legend, setLegend] = useState(false);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const route: MapRoute = ROUTES.find((r) => r.id === routeId) ?? ROUTES[0];

  const views = useMemo(() => viewRoute(route, state, watch, found), [route, state, watch, found]);
  const posOf = useCallback(
    (id: string): [number, number] => {
      const n = route.nodes.find((x) => x.id === id)!;
      return state.pos[`${route.id}:${id}`] ?? [n.x, n.y];
    },
    [route, state.pos],
  );

  const claimedCount = views.filter((v) => v.status === "claimed").length;
  const startView = views.find((v) => v.status === "open" || v.status === "doing" || v.status === "done");
  const totals = useMemo(() => {
    let nodes = 0;
    let done = 0;
    for (const rt of ROUTES) {
      for (const n of rt.nodes) {
        nodes += 1;
        if (state.claimed.includes(`${rt.id}:${n.id}`)) done += 1;
      }
    }
    const items = allRewardItems();
    const got = items.filter((x) => owned(x.id)).length;
    const saved = items.reduce((sum, x) => (owned(x.id) ? sum + (itemInfo(x.id)?.price ?? 0) : sum), 0);
    return { nodes, done, got, total: items.length, saved };
  }, [state.claimed, owned]);

  /* Подгружаем постеры и страницы тайтлов маршрута (по одному запросу, результат запоминаем) */
  useEffect(() => {
    let alive = true;
    const todo = route.nodes.filter((n) => foundStore.get()[n.q] === undefined);
    (async () => {
      for (const n of todo) {
        if (!alive) return;
        let result: Found | null = null;
        try {
          const res = await fetch(`/api/kodik/search?q=${encodeURIComponent(n.q)}&limit=3`);
          if (res.ok) {
            const data = (await res.json()) as { results?: { id: string; title: string; poster?: string }[] };
            const first = data.results?.[0];
            if (first) result = { id: first.id, title: first.title, poster: first.poster };
          } else {
            continue; // временный сбой — не запоминаем «не найдено»
          }
        } catch {
          continue;
        }
        foundStore.update((cur) => ({ ...cur, [n.q]: result }));
      }
    })();
    return () => {
      alive = false;
    };
  }, [route]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  /* Вписать весь маршрут в окно */
  const fit = useCallback(() => {
    const el = canvasRef.current;
    if (!el) return;
    const pts = route.nodes.map((n) => posOf(n.id));
    const minX = Math.min(...pts.map((p) => p[0]));
    const maxX = Math.max(...pts.map((p) => p[0])) + NODE_W;
    const minY = Math.min(...pts.map((p) => p[1]));
    const maxY = Math.max(...pts.map((p) => p[1])) + NODE_H;
    const w = el.clientWidth;
    const h = el.clientHeight;
    const k = clamp(Math.min((w - 80) / (maxX - minX), (h - 120) / (maxY - minY)), K_MIN, 1.1);
    setCam({ k, x: (w - (maxX - minX) * k) / 2 - minX * k, y: (h - (maxY - minY) * k) / 2 - minY * k + 10 });
  }, [route, posOf]);

  useEffect(() => {
    const id = requestAnimationFrame(fit);
    return () => cancelAnimationFrame(id);
    // подгонка только при смене маршрута или режима, а не при перетаскивании узла
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.id, mode]);

  const zoomAt = useCallback((factor: number, cx?: number, cy?: number) => {
    const el = canvasRef.current;
    if (!el) return;
    const px = cx ?? el.clientWidth / 2;
    const py = cy ?? el.clientHeight / 2;
    setCam((c) => {
      const k = clamp(c.k * factor, K_MIN, K_MAX);
      const r = k / c.k;
      return { k, x: px - (px - c.x) * r, y: py - (py - c.y) * r };
    });
  }, []);

  /* Колесо — масштаб (нужен не-пассивный слушатель, чтобы не прокручивать страницу) */
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || mode !== "graph") return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt, mode]);

  /* Перетаскивание фона / узлов, щипок двумя пальцами */
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<null | { kind: "pan" | "node"; id?: string; sx: number; sy: number; ox: number; oy: number; moved: boolean }>(null);
  const pinch = useRef<null | { d: number; k: number }>(null);

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest(".am-ctl, .am-legend, .am-cta-wrap")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), k: cam.k };
      drag.current = null;
      return;
    }
    const nodeEl = (e.target as HTMLElement).closest<HTMLElement>("[data-node]");
    if (nodeEl) {
      const id = nodeEl.dataset.node!;
      const [ox, oy] = posOf(id);
      drag.current = { kind: "node", id, sx: e.clientX, sy: e.clientY, ox, oy, moved: false };
    } else {
      drag.current = { kind: "pan", sx: e.clientX, sy: e.clientY, ox: cam.x, oy: cam.y, moved: false };
    }
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (ptrs.current.has(e.pointerId)) ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const rect = e.currentTarget.getBoundingClientRect();
      const k = clamp(pinch.current.k * (d / pinch.current.d), K_MIN, K_MAX);
      const mx = (a.x + b.x) / 2 - rect.left;
      const my = (a.y + b.y) / 2 - rect.top;
      setCam((c) => ({ k, x: mx - (mx - c.x) * (k / c.k), y: my - (my - c.y) * (k / c.k) }));
      return;
    }
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    d.moved = true;
    if (d.kind === "pan") setCam((c) => ({ ...c, x: d.ox + dx, y: d.oy + dy }));
    else if (d.id) setNodePos(route.id, d.id, d.ox + dx / cam.k, d.oy + dy / cam.k);
  };
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    ptrs.current.delete(e.pointerId);
    if (ptrs.current.size < 2) pinch.current = null;
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.kind === "node" && !d.moved && d.id) setSelected(d.id);
    else if (d.kind === "pan" && !d.moved) setSelected(null);
  };

  const focusNode = (id: string) => {
    const el = canvasRef.current;
    if (!el) return;
    const [x, y] = posOf(id);
    setSelected(id);
    setCam((c) => ({ ...c, x: el.clientWidth / 2 - (x + NODE_W / 2) * c.k, y: el.clientHeight / 2 - (y + NODE_H / 2) * c.k }));
  };

  const pickRandom = () => {
    const open = views.filter((v) => v.status === "open" || v.status === "doing");
    if (open.length === 0) {
      setToast("Нет доступных тайтлов: заберите награды или смените маршрут");
      return;
    }
    focusNode(open[Math.floor(Math.random() * open.length)].node.id);
  };

  const selView = views.find((v) => v.node.id === selected) ?? null;
  const onClaim = (id: string) => {
    const msg = claimNode(route, id, watch, found);
    if (msg) setToast(msg);
  };

  /* Рёбра */
  const edges = route.nodes.flatMap((n) =>
    n.requires.map((r) => {
      const [x1, y1] = posOf(r);
      const [x2, y2] = posOf(n.id);
      const a = { x: x1 + NODE_W / 2, y: y1 + 78 };
      const b = { x: x2 + NODE_W / 2, y: y2 + 78 };
      const dx = Math.max(60, Math.abs(b.x - a.x) * 0.5);
      const parent = views.find((v) => v.node.id === r);
      return {
        id: `${r}-${n.id}`,
        d: `M${a.x} ${a.y} C${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`,
        on: parent?.status === "claimed",
      };
    }),
  );

  return (
    <div className="am" style={{ "--c1": route.c1, "--c2": route.c2 } as React.CSSProperties}>
      <header className="am-head">
        <div className="am-hl">
          <h1>Карта аниме</h1>
          <p>{route.title} · {route.subtitle}</p>
          <small>{route.nodes.length} тайтлов · пройдено {claimedCount}</small>
        </div>
        <div className="am-stats">
          <div><b>{totals.done}<i>/{totals.nodes}</i></b><span>тайтлов пройдено</span></div>
          <div><b>{totals.got}<i>/{totals.total}</i></b><span>наград получено</span></div>
          <div className="gold"><b>{nf.format(totals.saved)}</b><span>AC сэкономлено</span></div>
        </div>
        <div className="am-seg" role="tablist" aria-label="Вид">
          <button type="button" role="tab" aria-selected={mode === "graph"} onClick={() => setMode("graph")}>Граф</button>
          <button type="button" role="tab" aria-selected={mode === "list"} onClick={() => setMode("list")}>Списком</button>
          <button type="button" role="tab" aria-selected={mode === "rewards"} onClick={() => setMode("rewards")}>Награды</button>
        </div>
      </header>

      <div className="am-routes" role="tablist" aria-label="Маршруты">
        {ROUTES.map((r) => {
          const done = r.nodes.filter((n) => state.claimed.includes(`${r.id}:${n.id}`)).length;
          return (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={r.id === routeId}
              className={r.id === routeId ? "on" : ""}
              style={{ "--c1": r.c1, "--c2": r.c2 } as React.CSSProperties}
              onClick={() => {
                setRouteId(r.id);
                setSelected(null);
              }}
            >
              <b>{r.title}</b>
              <small>{done}/{r.nodes.length}</small>
            </button>
          );
        })}
      </div>

      {mode === "graph" ? (
        <div
          className="am-canvas"
          ref={canvasRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <div className="am-grid" aria-hidden />
          <div className="am-world" style={{ transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.k})` }}>
            <svg className="am-edges" width="1" height="1" aria-hidden>
              <defs>
                <linearGradient id="am-eg" x1="0" x2="1">
                  <stop offset="0" stopColor={route.c1} />
                  <stop offset="1" stopColor={route.c2} />
                </linearGradient>
              </defs>
              {edges.map((e) => (
                <path key={e.id} d={e.d} className={e.on ? "on" : ""} stroke={e.on ? "url(#am-eg)" : undefined} />
              ))}
            </svg>
            {views.map((v, i) => (
              <NodeCard
                key={v.node.id}
                view={v}
                index={i}
                found={found[v.node.q]}
                selected={selected === v.node.id}
                start={startView?.node.id === v.node.id}
                pos={posOf(v.node.id)}
              />
            ))}
          </div>

          <div className="am-ctl">
            <button type="button" onClick={pickRandom} className="am-reset">🎲 Что посмотреть?</button>
            <button type="button" onClick={() => resetLayout(route.id)} className="am-reset">↺ Вернуть раскладку</button>
            <div className="am-zoom">
              <button type="button" aria-label="Приблизить" onClick={() => zoomAt(1.2)}>+</button>
              <span>{Math.round(cam.k * 100)}%</span>
              <button type="button" aria-label="Отдалить" onClick={() => zoomAt(1 / 1.2)}>−</button>
              <button type="button" aria-label="Вписать" onClick={fit}>⤢</button>
            </div>
          </div>

          <div className="am-legend">
            <button type="button" onClick={() => setLegend((v) => !v)}>Обозначения {legend ? "▴" : "▾"}</button>
            {legend && (
              <ul>
                <li><i className="lk" />Закрыто — пройдите предыдущие</li>
                <li><i className="op" />Можно смотреть</li>
                <li><i className="gf" />Награда готова</li>
                <li><i className="ok" />Пройдено</li>
                <li>Узлы можно двигать, фон — тянуть, колесо — масштаб</li>
              </ul>
            )}
          </div>

          {startView && (
            <div className="am-cta-wrap">
              <button type="button" className="am-go" onClick={() => focusNode(startView.node.id)}>
                <span>▶</span>
                <b>{startView.status === "done" ? "Забрать награду" : "Продолжить"}<small>{startView.node.title}</small></b>
              </button>
            </div>
          )}
        </div>
      ) : mode === "rewards" ? (
        <div className="am-rewards">
          {ROUTES.map((rt) => (
            <section key={rt.id} style={{ "--c1": rt.c1, "--c2": rt.c2 } as React.CSSProperties}>
              <h2>{rt.title}<small>{bonusItems(rt).filter(owned).length} из 1 · за финал маршрута</small></h2>
              <div className="am-rgrid">
                {bonusItems(rt).map((id) => (
                  <button
                    key={id}
                    type="button"
                    className="bonus"
                    onClick={() => {
                      setRouteId(rt.id);
                      setMode("graph");
                    }}
                  >
                    <RewardCard id={id} owned={owned(id)} compact />
                    <span className="am-rfrom">🏁 За финал: {rt.nodes.find((n) => n.tag === "boss")?.title}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <ul className="am-list">
          {views.map((v, i) => (
            <li key={v.node.id}>
              <button type="button" className={`s-${v.status}`} onClick={() => setSelected(v.node.id)}>
                <span className="am-num">{i + 1}</span>
                <span className="am-li-t"><b>{v.node.title}</b><small>{v.node.year} · {v.node.kind} · {v.watched}/{v.node.need} эп.</small></span>
                <em>{STATUS_LABEL[v.status]}</em>
                <span className="am-li-r">+{v.node.ac} AC</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selView && (
        <Panel
          view={selView}
          found={found[selView.node.q]}
          onClose={() => setSelected(null)}
          onClaim={() => onClaim(selView.node.id)}
          owned={owned}
        />
      )}
      {toast && <div className="am-toast" role="status">{toast}</div>}
    </div>
  );
}
