import type { ReactNode } from "react";
import { Ico, type IcoName } from "./icons";

export interface HeroBadge {
  icon: IcoName;
  text: string;
  hot?: boolean;
}
export interface HeroKpi {
  icon: IcoName;
  value: string;
  label: string;
}

/**
 * Шапка вкладки гачи: заголовок, пояснение, бейджи и четыре плитки сводки.
 * Оформление — стили `pgh-*` (те же, что у вкладки «Прогресс»).
 */
export function TabHero({ eyebrow, title, text, badges, kpi, extra }: { eyebrow: string; title: string; text: string; badges?: HeroBadge[]; kpi: HeroKpi[]; extra?: ReactNode }) {
  return (
    <section className="pgh pgh-slim" aria-label={title}>
      <i className="pgh-glow" aria-hidden />
      <div className="pgh-main">
        <span className="cg-eyebrow">{eyebrow}</span>
        <h3>{title}</h3>
        <p>{text}</p>
        {badges && badges.length > 0 && (
          <div className="pgh-badges">
            {badges.map((b) => (
              <span key={b.text} className={b.hot ? "hot" : ""}>
                <Ico name={b.icon} size={15} /> {b.text}
              </span>
            ))}
          </div>
        )}
        {extra}
      </div>
      <ul className="pgh-kpi">
        {kpi.map((k) => (
          <li key={k.label}>
            <Ico name={k.icon} size={18} />
            <span>
              <b>{k.value}</b>
              <small>{k.label}</small>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
