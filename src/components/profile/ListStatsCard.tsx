"use client";

import { useMemo } from "react";
import { STATUS_ORDER, STATUS_LABEL, loadStatuses, type WatchStatus } from "@/lib/statuses";

/**
 * Кольцо со статусами списков — «N в списках» и разбивка по статусам.
 *
 * Вёрстка по образцу чужого профиля: кольцо с долями и легенда рядом.
 * Числа настоящие — из `animehub:statuses:v1`, того же стора, которым
 * пользуется выбор статуса на странице тайтла. Ничего не выдумывается:
 * статусов ровно столько, сколько их поставил пользователь.
 *
 * Стор не подписан на изменения (в нём нет useSyncExternalStore), поэтому
 * блок читает данные один раз при монтировании — как и витрина виджетов.
 */

/** Цвета сегментов и точек легенды. Запланировано/смотрю/просмотрено —
 *  те же, что в легенде референса, брошено — приглушённый, его там нет. */
const COLOR: Record<WatchStatus, string> = {
  planned: "#38b6e8",
  watching: "#1fd6a0",
  completed: "#9a6bff",
  dropped: "#8b93a7",
};

/** Порядок легенды: как на странице тайтла, а не по алфавиту */
const LEGEND_ORDER: WatchStatus[] = ["watching", "planned", "completed", "dropped"];

const RADIUS = 46;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ListStatsCard() {
  const counts = useMemo(() => {
    const map = loadStatuses();
    const acc: Record<WatchStatus, number> = {
      planned: 0,
      watching: 0,
      completed: 0,
      dropped: 0,
    };
    let total = 0;
    for (const status of Object.values(map)) {
      if (!STATUS_ORDER.includes(status)) continue;
      acc[status] += 1;
      total += 1;
    }
    return { acc, total };
  }, []);

  /** Куски кольца: пропускаем пустые, иначе они занимали бы долю дуги */
  const arcs = useMemo(() => {
    if (counts.total === 0) return [];
    let offset = 0;
    return LEGEND_ORDER.filter((s) => counts.acc[s] > 0).map((s) => {
      const frac = counts.acc[s] / counts.total;
      const arc = { status: s, dash: frac * CIRCUMFERENCE, offset: -offset * CIRCUMFERENCE };
      offset += frac;
      return arc;
    });
  }, [counts]);

  return (
    <div className="ag-card ag-ls">
      <div className="ag-ls-top">
        <div className="ag-ls-ring">
          <svg viewBox="0 0 110 110" role="img" aria-label={`В списках: ${counts.total}`}>
            <circle className="ag-ls-track" cx="55" cy="55" r={RADIUS} />
            {arcs.map((arc) => (
              <circle
                key={arc.status}
                className="ag-ls-arc"
                cx="55"
                cy="55"
                r={RADIUS}
                stroke={COLOR[arc.status]}
                strokeDasharray={`${arc.dash} ${CIRCUMFERENCE}`}
                strokeDashoffset={arc.offset}
              />
            ))}
          </svg>
          <div className="ag-ls-hole">
            <b>{counts.total}</b>
            <span>в списках</span>
          </div>
        </div>

        <ul className="ag-ls-legend">
          {LEGEND_ORDER.map((status) => (
            <li key={status}>
              <i style={{ background: COLOR[status] }} aria-hidden />
              <span>{STATUS_LABEL[status]}</span>
              <b data-text={counts.acc[status]}>{counts.acc[status]}</b>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}