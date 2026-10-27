"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { adminGet, fmtNum } from "./api";
import { CountUp, Empty, Segmented } from "./ui";

interface TitleStat { id: string; title: string; poster: string; views: number; viewers: number; prev: number }
interface Data {
  days: number;
  labels: string[];
  regs: number[];
  total: number[];
  dau: number[];
  views: number[];
  hours: number[];
  titles: TitleStat[];
  kpi: {
    totalUsers: number; regs: number; regsPrev: number; active: number; activePrev: number;
    dauToday: number; wau: number; mau: number; views: number; viewsPrev: number;
  };
}

const W = 640;
const H = 220;
const PAD = { l: 34, r: 12, t: 14, b: 26 };

const dayLabel = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}.${m}`;
};

function niceMax(v: number): number {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

function Delta({ cur, prev }: { cur: number; prev: number }) {
  if (!prev && !cur) return <span className="an-delta flat">без изменений</span>;
  if (!prev) return <span className="an-delta up">▲ новое</span>;
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) return <span className="an-delta flat">как раньше</span>;
  return <span className={`an-delta ${pct > 0 ? "up" : "down"}`}>{pct > 0 ? "▲" : "▼"} {Math.abs(pct)}%</span>;
}

/** Столбцы или линия с подсказкой при наведении */
function Chart({ labels, values, kind, color, unit }: { labels: string[]; values: number[]; kind: "bars" | "line"; color: string; unit: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const n = values.length;
  const max = niceMax(Math.max(1, ...values));
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const step = iw / n;
  const x = (i: number) => PAD.l + step * (i + 0.5);
  const y = (v: number) => PAD.t + ih - (v / max) * ih;
  const bw = Math.min(24, step * 0.62);
  const ticks = [0, 0.5, 1].map((t) => Math.round(max * t));
  const every = Math.ceil(n / 8);

  const onMove = (e: React.PointerEvent) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const px = ((e.clientX - box.left) / box.width) * W;
    setHover(Math.max(0, Math.min(n - 1, Math.floor((px - PAD.l) / step))));
  };

  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)} ${PAD.t + ih} L${x(0).toFixed(1)} ${PAD.t + ih} Z`;
  const gid = `an-g-${color.replace(/\W/g, "")}`;

  return (
    <div className="an-chart">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`График: ${unit}`} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity=".32" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line className="an-grid" x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} />
            <text className="an-tick" x={PAD.l - 8} y={y(t) + 4} textAnchor="end">{t}</text>
          </g>
        ))}
        {labels.map((l, i) =>
          i % every === 0 || i === n - 1 ? (
            <text key={l} className="an-tick" x={x(i)} y={H - 6} textAnchor="middle">{dayLabel(l)}</text>
          ) : null,
        )}
        {hover !== null && <line className="an-cross" x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + ih} />}
        {kind === "bars" ? (
          values.map((v, i) => {
            const h = Math.max(v ? 3 : 0, (v / max) * ih);
            const r = Math.min(4, bw / 2, h);
            const bx = x(i) - bw / 2;
            const by = PAD.t + ih - h;
            return (
              <path
                key={i}
                d={`M${bx} ${by + h}V${by + r}Q${bx} ${by} ${bx + r} ${by}H${bx + bw - r}Q${bx + bw} ${by} ${bx + bw} ${by + r}V${by + h}Z`}
                fill={color}
                opacity={hover === null || hover === i ? 1 : 0.45}
              />
            );
          })
        ) : (
          <>
            <path d={area} fill={`url(#${gid})`} />
            <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={x(hover ?? n - 1)} cy={y(values[hover ?? n - 1])} r="5" fill={color} className="an-dot" />
          </>
        )}
      </svg>
      {hover !== null && (
        <div className="an-tip" style={{ left: `${(x(hover) / W) * 100}%` }}>
          <b>{dayLabel(labels[hover])}</b>
          <span>{fmtNum(values[hover])} {unit}</span>
        </div>
      )}
    </div>
  );
}

function Card({ title, sub, chip, children }: { title: string; sub?: string; chip?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="adm-card an-card">
      <header className="an-card-h">
        <div>
          <h3>{title}</h3>
          {sub && <p>{sub}</p>}
        </div>
        {chip}
      </header>
      {children}
    </section>
  );
}

export function Analytics() {
  const [days, setDays] = useState<"7" | "30" | "90">("7");
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    void adminGet<Data>("analytics", { days }).then((d) => {
      if (!alive) return;
      if (d) { setData(d); setFailed(false); } else setFailed(true);
    });
    return () => { alive = false; };
  }, [days]);

  const peak = useMemo(() => {
    if (!data) return -1;
    const m = Math.max(...data.hours);
    return m > 0 ? data.hours.indexOf(m) : -1;
  }, [data]);

  if (failed && !data) return <Empty>Не удалось загрузить аналитику. Проверьте, что вы вошли под администратором.</Empty>;
  const loading = !data;
  const k = data?.kpi;
  const maxViews = Math.max(1, ...(data?.titles.map((t) => t.views) ?? [1]));
  const maxHour = Math.max(1, ...(data?.hours ?? [1]));

  const tiles = k
    ? [
        { label: "Новых игроков", value: k.regs, chip: <Delta cur={k.regs} prev={k.regsPrev} />, hint: `всего ${fmtNum(k.totalUsers)}` },
        { label: "Активных игроков", value: k.active, chip: <Delta cur={k.active} prev={k.activePrev} />, hint: `сегодня ${fmtNum(k.dauToday)}` },
        { label: "Просмотров серий", value: k.views, chip: <Delta cur={k.views} prev={k.viewsPrev} />, hint: `${fmtNum(k.active ? k.views / k.active : 0)} на игрока` },
        { label: "Недельная / месячная аудитория", value: k.wau, chip: <span className="an-delta flat">{fmtNum(k.mau)} за 30 дней</span>, hint: "уникальные игроки" },
      ]
    : [];

  return (
    <div className="adm-stack-lg an-root">
      <div className="an-bar">
        <Segmented
          label="Период"
          value={days}
          onChange={setDays}
          options={[{ id: "7", label: "7 дней" }, { id: "30", label: "30 дней" }, { id: "90", label: "90 дней" }]}
        />
        <span className="adm-hint">Сравнение — с предыдущими {days} днями. Точная активность по дням копится с момента обновления.</span>
      </div>

      <div className="adm-grid-tiles">
        {loading
          ? Array.from({ length: 4 }, (_, i) => <span key={i} className="adm-skel" style={{ height: 112 }} />)
          : tiles.map((t) => (
              <div key={t.label} className="adm-card an-tile">
                <span className="an-tile-l">{t.label}</span>
                <CountUp value={t.value} className="an-tile-v" />
                <div className="an-tile-f">{t.chip}<small>{t.hint}</small></div>
              </div>
            ))}
      </div>

      <div className="an-two">
        <Card title="Регистрации" sub="Новые игроки по дням" chip={data && <span className="an-sum">{fmtNum(data.kpi.regs)}</span>}>
          {data ? <Chart labels={data.labels} values={data.regs} kind="bars" color="#3b8bff" unit="регистраций" /> : <span className="adm-skel" style={{ height: 220 }} />}
        </Card>
        <Card title="Активные игроки" sub="Уникальные игроки за сутки" chip={data && <span className="an-sum">{fmtNum(data.kpi.dauToday)} сегодня</span>}>
          {data ? <Chart labels={data.labels} values={data.dau} kind="line" color="#22d3ee" unit="игроков" /> : <span className="adm-skel" style={{ height: 220 }} />}
        </Card>
      </div>

      <div className="an-two an-two-wide">
        <Card title="Популярные тайтлы" sub={`Топ по просмотрам за ${days} дн.`}>
          {data && data.titles.length === 0 && <Empty>Пока нет просмотров за этот период.</Empty>}
          <ol className="an-titles">
            {(data?.titles ?? []).map((t, i) => (
              <li key={t.id}>
                <span className="an-rank">{i + 1}</span>
                <div className="an-t-body">
                  <div className="an-t-top">
                    <b title={t.title}>{t.title}</b>
                    <span>{fmtNum(t.views)} <small>просм.</small></span>
                  </div>
                  <div className="an-t-track"><i style={{ width: `${(t.views / maxViews) * 100}%` }} /></div>
                  <div className="an-t-sub">
                    <span>{fmtNum(t.viewers)} зрит.</span>
                    <Delta cur={t.views} prev={t.prev} />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <Card title="Когда смотрят" sub="Просмотры по часам (по времени сервера)" chip={peak >= 0 && <span className="an-sum">пик {String(peak).padStart(2, "0")}:00</span>}>
          <div className="an-hours" role="img" aria-label="Просмотры по часам суток">
            {(data?.hours ?? Array.from({ length: 24 }, () => 0)).map((v, h) => (
              <div key={h} className={`an-hr${h === peak ? " peak" : ""}`} title={`${String(h).padStart(2, "0")}:00 — ${v}`}>
                <i style={{ height: `${Math.max(v ? 4 : 2, (v / maxHour) * 100)}%` }} />
                {h % 3 === 0 && <span>{h}</span>}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
