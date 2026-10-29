"use client";

import { CW } from "@/lib/cards/clanwar";
import type { BattleReport } from "@/components/cards/Arena";
import { Cur, Ico } from "@/components/cards/icons";
import { Sheet, Stars } from "./shared";

/** Итог нападения: звёзды, награда и что дальше */
export function AttackResult({ report, left, onClose, onNext }: { report: BattleReport; left: number; onClose: () => void; onNext: () => void }) {
  const stars = report.campaign?.stars ?? 0;
  const win = report.win;
  return (
    <Sheet
      onClose={onClose}
      tone={win ? "win" : "lose"}
      title={win ? "База взята!" : "Атака отбита"}
      sub={report.title}
      footer={
        <div className="cw-foot row">
          <button type="button" className="cw-btn ghost lg" onClick={onClose}>
            К войне
          </button>
          {left > 0 ? (
            <button type="button" className="cw-btn primary lg" onClick={onNext}>
              Следующая атака · {left}
            </button>
          ) : null}
        </div>
      }
    >
      <div className={`cw-res ${win ? "win" : "lose"}`}>
        <div className="cw-res-stars" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className={i < stars ? "on" : ""} style={{ animationDelay: `${0.25 + i * 0.28}s` }}>
              <Stars n={i < stars ? 1 : 0} max={1} size={64} />
            </span>
          ))}
        </div>
        <p className="cw-res-line" role="status">
          {win ? `${stars} из ${CW.maxStars} звёзд · против ${report.foeName}` : `${report.foeName} устоял(а). Защитнику — +${CW.defensePoint} очко.`}
        </p>
        {win && (report.reward.dust > 0 || report.reward.diamonds > 0) ? (
          <ul className="cw-res-rew">
            {report.reward.dust > 0 ? (
              <li>
                <Cur k="dust" size={18} />+{report.reward.dust} пыли
              </li>
            ) : null}
            {report.reward.diamonds > 0 ? (
              <li>
                <Cur k="diamonds" size={18} />+{report.reward.diamonds} алмазов
              </li>
            ) : null}
          </ul>
        ) : null}
        <p className="cw-note center">
          <Ico name="flag" size={13} /> {left > 0 ? `Осталось атак: ${left}` : "Все атаки использованы"}
        </p>
      </div>
    </Sheet>
  );
}
