"use client";

import Link from "next/link";
import { useState } from "react";
import { AvatarFrame } from "@/components/profile/AvatarFrame";
import { BACKGROUNDS, FRAMES } from "@/lib/cosmetics";
import { useLeaderboardBoard, type BoardMetric, type BoardRow } from "@/lib/leaderboard-cloud";
import "./home-top-users.css";

const TABS: { id: BoardMetric; label: string; period: "week" | "all" }[] = [
  { id: "hours", label: "По часам", period: "all" },
  { id: "xp", label: "Опыт недели", period: "week" },
  { id: "series", label: "По сериям", period: "all" },
];

const fmt = new Intl.NumberFormat("ru-RU");

function value(metric: BoardMetric, points: number): string {
  if (metric === "hours") return `${fmt.format(Math.floor(points / 60))} ч.`;
  if (metric === "series") return `${fmt.format(points)} сер.`;
  return `${fmt.format(points)} XP`;
}

function Crown() {
  return (
    <svg className="htu-crown" viewBox="0 0 34 26" fill="currentColor" aria-hidden>
      <path d="M2 8l7 6 8-11 8 11 7-6-3 16H5z" />
    </svg>
  );
}

function Card({ row, metric }: { row: BoardRow; metric: BoardMetric }) {
  const frame = row.frameId ? FRAMES.find((f) => f.id === row.frameId) : undefined;
  const place = row.rank <= 3 ? ` p${row.rank}` : "";
  // Фон карточки — фон профиля игрока: свой загруженный или пресет из каталога
  const preset = row.backgroundId ? BACKGROUNDS.find((b) => b.id === row.backgroundId) : undefined;
  const bg: React.CSSProperties = row.bgImage
    ? { backgroundImage: `url(${row.bgImage})`, backgroundSize: "cover", backgroundPosition: "center" }
    : preset
      ? { background: preset.css, backgroundSize: preset.backgroundSize ?? "cover" }
      : {};
  return (
    <li className={`htu-card${place}`}>
      <span className="htu-bg" style={bg} aria-hidden />
      <Link href="/leaderboard" className="htu-link" aria-label={`${row.rank} место: ${row.nickname}`}>
        <span className="htu-rank">{row.rank}</span>
        <span className="htu-av">
          <AvatarFrame nickname={row.nickname} avatar={row.avatar || undefined} frame={frame} size="sm" />
          {row.rank === 1 && <Crown />}
        </span>
        <span className="htu-info">
          <b>{row.nickname}</b>
          <span>
            <em>{value(metric, row.points)}</em>
            <i>Ур. {row.level}</i>
          </span>
        </span>
      </Link>
    </li>
  );
}

/** Топ пользователей на главной: реальный лидерборд, переключатель метрики. */
export function HomeTopUsers() {
  const [metric, setMetric] = useState<BoardMetric>("hours");
  const tab = TABS.find((t) => t.id === metric) ?? TABS[0];
  const board = useLeaderboardBoard(tab.period, tab.id);
  const rows = board.rows.slice(0, 10);

  // Лидерборд ответил и пуст — секция не нужна
  if (board.ready && rows.length === 0 && metric === "hours") return null;

  return (
    <section className="htu" aria-labelledby="htu-title">
      <header className="htu-head">
        <div>
          <h2 id="htu-title">Топ пользователей</h2>
          <p>Самые активные зрители нашего сообщества</p>
        </div>
        <div className="hm-tabs" role="tablist" aria-label="Метрика рейтинга">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === metric}
              className={t.id === metric ? "is-on" : ""}
              onClick={() => setMetric(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="htu-scroll">
        {!board.ready ? (
          <ul className="htu-list" aria-hidden>
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="htu-card skeleton" style={{ height: 96 }} />
            ))}
          </ul>
        ) : rows.length === 0 ? (
          <p className="htu-empty">Пока никого в этом рейтинге — станьте первым.</p>
        ) : (
          <ul className="htu-list">
            {rows.map((row) => (
              <Card key={`${metric}:${row.rank}:${row.nickname}`} row={row} metric={metric} />
            ))}
          </ul>
        )}
      </div>

      <Link href="/leaderboard" className="htu-all">
        Весь лидерборд
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
          <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
    </section>
  );
}
