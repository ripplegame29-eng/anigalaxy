"use client";

/**
 * Карта орбит рефералки.
 *
 * Перенесена из макета как есть: та же геометрия (центр 310, радиусы
 * 80 + 29·i в viewBox 620×620), те же классы, те же анимации — кольца
 * с дугой прогресса, вращающиеся иконки рубежей, звёзды-друзья,
 * пульсирующее ядро. Изменены только данные: рубежи и друзья берутся
 * из хранилища, а не из демонстрационного массива макета.
 */

import { useState, type ReactNode } from "react";

export interface OrbitStep {
  /** Порог по числу друзей */
  at: number;
  name: string;
  /** Цвет редкости — тот же, что у карточек хранилища */
  color: string;
  /** Иконка рубежа, штрих 24×24 */
  icon: ReactNode;
  /** Награда строкой: титул, рамка, дни Premium */
  reward: string;
  xp: number;
}

interface Props {
  steps: OrbitStep[];
  /** Приглашённые: сколько их и как их зовут */
  friends: string[];
  /** Сколько нужно до следующего рубежа */
  nextLeft: number;
  /** Награда ближайшего рубежа */
  next: OrbitStep | null;
  /** Ник в ядре */
  nickname: string;
  friendsCount: number;
  xpEarned: number;
  premiumDays: number;
}

const CENTER = 310;
const R0 = 80;
const STEP = 29;

/** Длина окружности — нужна для dasharray дуги прогресса */
function circumference(radius: number): number {
  return 2 * Math.PI * radius;
}

export function OrbitMap({
  steps,
  friends,
  nextLeft,
  next,
  nickname,
  friendsCount,
  xpEarned,
  premiumDays,
}: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const active = selected ?? (next ? steps.indexOf(next) : steps.length - 1);

  return (
    <div className="ag-ref-mapwrap">
      <section className="ag-ref-map" aria-label="Карта орбит рубежей">
      {/* ------------------------------ Счётчики ---------------------------- */}
      <div className="ag-ref-hud">
        <div className="ag-ref-hc">
          <b>{friendsCount}</b>
          <span>друзей</span>
        </div>
        <div className="ag-ref-hc">
          <b>{xpEarned}</b>
          <span>XP заработано</span>
        </div>
        <div className="ag-ref-hc">
          <b>{premiumDays}</b>
          <span>дней Premium</span>
        </div>
      </div>

      {/* -------------------------------- Карта ------------------------------ */}
      <svg className="ag-ref-sv" viewBox="0 0 620 620" role="img" aria-label={`Приглашено ${friendsCount}`}>
        <defs>
          <radialGradient id="ag-core" cx="50%" cy="40%">
            <stop offset="0" stopColor="#3a8bff" />
            <stop offset="1" stopColor="#0b1a42" />
          </radialGradient>
        </defs>

        {/* Кольца-рубежи: пунктирная основа + дуга прогресса */}
        {steps.map((item, i) => {
          const radius = R0 + i * STEP;
          const total = circumference(radius);
          const prev = i > 0 ? steps[i - 1].at : 0;
          const progress = Math.max(0, Math.min(1, (friendsCount - prev) / (item.at - prev)));
          const done = friendsCount >= item.at;
          return (
            <g
              key={item.at}
              className={`ag-ring ${done ? "done" : ""} ${active === i ? "sel" : ""}`}
              style={{ ["--rc" as string]: item.color }}
            >
              <circle className="base" cx={CENTER} cy={CENTER} r={radius} />
              <circle
                className="prog"
                cx={CENTER}
                cy={CENTER}
                r={radius}
                strokeDasharray={`${(total * progress).toFixed(1)} ${total.toFixed(1)}`}
                transform={`rotate(-90 ${CENTER} ${CENTER})`}
              />
              <circle
                className="hit"
                cx={CENTER}
                cy={CENTER}
                r={radius}
                onClick={() => setSelected(i)}
                role="button"
                aria-label={`Рубеж ${item.name}`}
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") setSelected(i);
                }}
              />
            </g>
          );
        })}

        {/* Иконки рубежей на орбите; группы вращаются в разные стороны */}
        {steps.map((item, i) => {
          const radius = R0 + i * STEP;
          const angle = ((i * 137.5) % 360) * (Math.PI / 180);
          const px = CENTER + radius * Math.cos(angle);
          const py = CENTER + radius * Math.sin(angle);
          const prev = i > 0 ? steps[i - 1].at : 0;
          const onRing = Math.min(10, Math.max(0, Math.min(friendsCount, item.at) - prev));

          // Друзья расставляются по кольцу равномерно: их число на кольце
          // равно тому, сколько закрыто между предыдущим и этим рубежом
          const stars = [];
          for (let j = 0; j < onRing; j += 1) {
            const a = angle + ((j + 1) * 2 * Math.PI) / (onRing + 1);
            stars.push(
              <circle
                key={j}
                className="ag-fs"
                cx={(CENTER + radius * Math.cos(a)).toFixed(1)}
                cy={(CENTER + radius * Math.sin(a)).toFixed(1)}
                r="3.2"
                style={{ animationDelay: `-${(j * 0.7).toFixed(1)}s` }}
              />,
            );
          }

          return (
            <g
              key={item.at}
              className={`ag-orb ${i % 2 ? "rv" : ""}`}
              style={{ ["--d" as string]: `${70 + i * 16}s`, ["--rc" as string]: item.color }}
            >
              {stars}
              <g
                className={`ag-pl ${friendsCount >= item.at ? "" : "lk"} ${active === i ? "sel" : ""}`}
                onClick={() => setSelected(i)}
                role="button"
                aria-label={item.name}
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") setSelected(i);
                }}
              >
                <circle className="pc" cx={px.toFixed(1)} cy={py.toFixed(1)} r="13" />
                <svg
                  x={(px - 8).toFixed(1)}
                  y={(py - 8).toFixed(1)}
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {item.icon}
                </svg>
              </g>
            </g>
          );
        })}

        {/* Ядро: пульс, круг с обводкой и буква ника */}
        <circle className="ag-pulse" cx={CENTER} cy={CENTER} r="44" />
        <g className="ag-core">
          <circle cx={CENTER} cy={CENTER} r="42" fill="url(#ag-core)" />
          <circle cx={CENTER} cy={CENTER} r="42" fill="none" stroke="#ff4d5e" strokeWidth="3" />
        </g>
        <text
          x={CENTER}
          y={CENTER + 12}
          textAnchor="middle"
          className="ag-core-nick"
          fontSize="34"
          fontWeight="800"
          fill="#fff"
        >
          {(nickname || "R").slice(0, 1).toUpperCase()}
        </text>

        {/* Зелёная подпись у выбранного рубежа — прямо на его кольце */}
        {steps[active] && (
          <g transform={`translate(${CENTER - 96} ${CENTER + R0 + active * STEP - 4})`}>
            <rect width="192" height="26" rx="9" fill="#0b1328" stroke={steps[active].color} strokeWidth="1" />
            <circle cx="15" cy="13" r="3" fill={steps[active].color} />
            <text x="26" y="17" className="ag-tip-t" fontSize="11.5" fontWeight="700" fill="#8fe3c6">
              ×{steps[active].at} · {steps[active].name}
            </text>
          </g>
        )}
      </svg>
      </section>

      {/* ----------------------- Плашка выбранного рубежа ------------------- */}
      {/* Стоит рядом с картой, а не внутри неё: карта держит квадрат, и
          вложенный блок сдвигал его геометрию. Вид тот же — рамка,
          скругление и цвет рубежа. */}
      <div
        className="ag-ref-mini"
        style={{
          ["--rc" as string]: steps[active]?.color ?? "#2b7fff",
          width: "100%",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          alignItems: "center",
        }}
      >
        <b>
          ×{steps[active]?.at} {steps[active]?.name}
        </b>
        <small>
          +{steps[active]?.xp.toLocaleString("ru-RU")} XP ·{" "}
          {next ? steps[active]?.reward : "Все рубежи открыты"}
        </small>
        <em>{next ? `ещё ${nextLeft} ${nextLeft === 1 ? "друг" : "друзей"}` : "8 из 8"}</em>
      </div>
    </div>
  );
}
