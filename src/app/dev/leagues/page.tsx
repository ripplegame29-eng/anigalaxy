import type { Metadata } from "next";
import type { CSSProperties } from "react";
import "../../cards-card.css";
import "../../cards.css";
import "../../cards-battle.css";
import "../../cards-campaign.css";
import "../../cards-shop.css";
import { LEAGUES } from "@/lib/cards/config";
import { LEAGUE_PLATE_Y } from "@/lib/cards/league-art";

export const metadata: Metadata = { title: "Лиги — превью", robots: { index: false, follow: false } };

/** Превью эмблем лиг без входа. Только для разработки. */
export default function Page() {
  const curIdx = 2;
  return (
    <div className="cg" style={{ padding: 40, background: "#0a0e22", minHeight: "100vh" }}>
      <div className="bt-lg" style={{ width: "calc(100% - 72px)" }}>
        <span className="bt-lg-bar"><i style={{ width: "40%" }} /></span>
        <ol>
          {LEAGUES.map((l, i) => (
            <li key={l.id} className={i === curIdx ? "cur" : i < curIdx ? "done" : ""} style={{ ["--lc" as string]: l.color, left: `${(i / (LEAGUES.length - 1)) * 100}%` } as CSSProperties}>
              <span className="lg-emb" style={{ ["--img" as string]: `url(/cards/leagues/${l.id}.webp)`, ["--py" as string]: `${LEAGUE_PLATE_Y[l.id] ?? 82}%` } as CSSProperties}>
                <img src={`/cards/leagues/${l.id}.webp`} alt={l.name} width={140} height={180} draggable={false} />
                <b className="lg-plate">{l.name}</b>
                <u aria-hidden className="lg-sp s1" />
                <u aria-hidden className="lg-sp s2" />
                <u aria-hidden className="lg-sp s3" />
              </span>
              <small>{l.from} оч.</small>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
