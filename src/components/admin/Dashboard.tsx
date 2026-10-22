"use client";

import { useEffect, useState } from "react";
import { adminGet, fmtNum, fmtUptime } from "./api";
import { AreaChart, CountUp, Empty, Initial, useSpotlight } from "./ui";

interface Data {
  stats: Record<"users" | "newToday" | "newWeek" | "online" | "premium" | "banned" | "comments" | "chatMessages" | "openReports" | "rooms", number>;
  series: { day: string; users: number; online: number }[];
  top: { id: number; nickname: string; level: number; xp: number; ac: number }[];
  economy: { ac: number; xp: number };
  errors: { open: number; day: number };
  system: { uptimeSec: number; rssMb: number; heapMb: number; dbMb: number; node: string };
}

export function Dashboard({ go, openUser }: { go: (tab: string) => void; openUser: (id: number) => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const spot = useSpotlight();

  useEffect(() => {
    let alive = true;
    const load = () =>
      void adminGet<Data>("dashboard").then((d) => {
        if (!alive) return;
        if (d) setData(d);
        else setFailed(true);
      });
    load();
    const timer = window.setInterval(load, 30_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  if (failed && !data) return <Empty>Не удалось загрузить сводку. Проверьте, что вы вошли под администратором.</Empty>;
  if (!data) {
    return (
      <div className="adm-grid-tiles">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className="adm-skel" style={{ height: 112 }} />
        ))}
      </div>
    );
  }
  const s = data.stats;
  const tiles: { label: string; value: number; hint?: string; tone?: string; to?: string }[] = [
    { label: "Игроков", value: s.users, hint: `+${s.newToday} за сутки · +${s.newWeek} за неделю`, to: "users" },
    { label: "Сейчас на сайте", value: s.online, hint: "последние 5 минут", tone: "live", to: "users" },
    { label: "С Premium", value: s.premium, tone: "gold", to: "users" },
    { label: "Открытых жалоб", value: s.openReports, tone: s.openReports ? "warn" : "", to: "moderation" },
    { label: "Ошибок за сутки", value: data.errors.day, hint: `${data.errors.open} типов не разобрано`, tone: data.errors.open ? "warn" : "", to: "errors" },
    { label: "Комментариев", value: s.comments, to: "moderation" },
    { label: "Сообщений в чате", value: s.chatMessages, to: "moderation" },
    { label: "Комнат просмотра", value: s.rooms, to: "moderation" },
  ];

  return (
    <div className="adm-stack-lg">
      <div className="adm-grid-tiles" onPointerMove={spot}>
        {tiles.map((t, i) => (
          <button key={t.label} type="button" className={`adm-card adm-tile ${t.tone ? `adm-tone-${t.tone}` : ""}`} style={{ "--i": i } as React.CSSProperties} onClick={() => t.to && go(t.to)}>
            <span className="adm-tile-label">{t.label}</span>
            <CountUp value={t.value} className="adm-tile-num" />
            {t.hint ? <small>{t.hint}</small> : null}
            {t.tone === "live" ? <i className="adm-pulse" aria-hidden /> : null}
          </button>
        ))}
      </div>

      <div className="adm-two" onPointerMove={spot}>
        <section className="adm-card adm-panel" style={{ "--i": 8 } as React.CSSProperties}>
          <h3>Новые и активные игроки · 14 дней</h3>
          <AreaChart
            labels={data.series.map((p) => p.day)}
            series={[
              { name: "Регистрации", color: "#4f9bff", values: data.series.map((p) => p.users) },
              { name: "Заходили", color: "#22d3ee", values: data.series.map((p) => p.online) },
            ]}
          />
        </section>
        <section className="adm-card adm-panel" style={{ "--i": 9 } as React.CSSProperties}>
          <h3>Топ по опыту</h3>
          {data.top.length ? (
            <ol className="adm-top">
              {data.top.map((p, i) => (
                <li key={p.id}>
                  <button type="button" onClick={() => openUser(p.id)}>
                    <span className="adm-rank">{i + 1}</span>
                    <Initial name={p.nickname} size={34} />
                    <span className="adm-top-name">
                      <b>{p.nickname}</b>
                      <small>
                        ур. {p.level} · {fmtNum(p.ac)} AC
                      </small>
                    </span>
                    <span className="adm-top-xp">{fmtNum(p.xp)} XP</span>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <Empty>Пока нет данных прогресса</Empty>
          )}
        </section>
      </div>

      <div className="adm-two adm-two-even" onPointerMove={spot}>
        <section className="adm-card adm-panel" style={{ "--i": 10 } as React.CSSProperties}>
          <h3>Экономика</h3>
          <div className="adm-kv">
            <span>AniCoin у игроков</span>
            <b>{fmtNum(data.economy.ac)} AC</b>
            <span>Суммарный опыт</span>
            <b>{fmtNum(data.economy.xp)} XP</b>
            <span>Заблокировано</span>
            <b>{s.banned}</b>
          </div>
        </section>
        <section className="adm-card adm-panel" style={{ "--i": 11 } as React.CSSProperties}>
          <h3>Сервер</h3>
          <div className="adm-kv">
            <span>Работает</span>
            <b>{fmtUptime(data.system.uptimeSec)}</b>
            <span>Память</span>
            <b>
              {data.system.rssMb} МБ (heap {data.system.heapMb})
            </b>
            <span>База данных</span>
            <b>{data.system.dbMb} МБ</b>
            <span>Node.js</span>
            <b>{data.system.node}</b>
          </div>
        </section>
      </div>
    </div>
  );
}
