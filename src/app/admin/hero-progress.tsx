/**
 * График «кистью» в блоке обзора.
 *
 * Два слоя: серый контур всей истории и цветная заливка той части, что уже
 * разобрана. Заливка сделана через clip-path по переменной `--w`, поэтому
 * доля разобранного меняется без перерисовки точек — только ширина отсечения.
 *
 * Рисуем вручную, а не готовой библиотекой: здесь нужна одна ломаная без
 * осей и подписей, а весить ради неё полноценный график — значит тащить в
 * панель зависимость на 30–40 КБ.
 */

/** Точка ломаной: x в процентах ширины, y в процентах высоты. */
type Point = readonly [number, number];

const VIEW_W = 1000;
const VIEW_H = 100;

/** Высота контура: у краёв линия чуть приподнята, иначе она липнет к рамке. */
const PAD_Y = 12;

function path(points: readonly Point[]): string {
  if (points.length < 2) return "";

  // Сглаживание кубическими кривыми через середины отрезков: ломаная с
  // острыми углами выглядит как шум, а кривая — как «кисть» из макета.
  let d = `M ${points[0][0]} ${points[0][1]}`;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const midX = (prev[0] + cur[0]) / 2;
    d += ` C ${midX} ${prev[1]}, ${midX} ${cur[1]}, ${cur[0]} ${cur[1]}`;
  }

  return d;
}

/**
 * Переводит ряд чисел в точки ломаной.
 *
 * Значения нормализуются к максимуму ряда, а не всего периода: иначе неделя
 * без сбоев «прижимала» график к нулю и полоса разобранного выглядела бы
 * почти пустой при полной разборке.
 */
function toPoints(series: readonly number[]): Point[] {
  if (series.length === 0) return [];

  const max = Math.max(...series, 1);

  return series.map((value, index) => {
    const x = series.length === 1 ? 0 : (index / (series.length - 1)) * VIEW_W;
    const ratio = value / max;
    const y = PAD_Y + (1 - ratio) * (VIEW_H - PAD_Y * 2);
    return [x, y] as const;
  });
}

export function HeroProgress({
  series,
  done,
  label,
  caption,
}: {
  /** Ряд по дням, от старого к новому. */
  series: readonly number[];
  /** Доля в процентах: сколько уже разобрано. */
  done: number;
  label: string;
  caption: string;
}) {
  const points = toPoints(series);
  const d = path(points);
  // Полоса не должна схлопываться в ноль: при 0% всё равно виден кусочек
  // заливки, иначе кажется, что графика нет вовсе.
  const width = Math.max(1.5, Math.min(100, done));

  return (
    <div className="ag-prog" style={{ ["--w" as string]: `${width}%` }}>
      <div className="ag-pn">
        <div>
          <strong>{Math.round(done)}%</strong>
          <span style={{ display: "block" }}>{label}</span>
        </div>
        <span>{caption}</span>
      </div>

      <div className="ag-track">
        <div className="ag-ghost">
          <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none" aria-hidden="true">
            <path d={d} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
          </svg>
        </div>

        <div className="ag-brush">
          <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none" aria-hidden="true">
            <path d={d} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
          </svg>
        </div>

        <span className="ag-mk" style={{ ["--w" as string]: `${width}%` }} />
      </div>

      <div className="ag-ruler" aria-hidden="true" />
      <small>{caption}</small>
    </div>
  );
}