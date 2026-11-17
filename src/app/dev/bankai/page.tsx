import type { Metadata } from "next";
import "../../cards-card.css";
import "../../cards.css";
import "../../cards-battle.css";
import "../../cards-ult.css";

export const metadata: Metadata = { title: "Бан-кай — превью", robots: { index: false, follow: false } };

/** Превью кат-сцены именного ультимейта. Только для разработки. */
export default async function Page({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const freeze = t ? `.ar-bk *{animation-play-state:paused!important;animation-delay:-${Number(t) || 0}s!important}` : "";
  return (
    <div className="cg" style={{ padding: 24, background: "#0a0e22", minHeight: "100vh" }}>
      {freeze && <style>{freeze}</style>}
      <div style={{ position: "relative", width: 960, height: 560, margin: "0 auto", background: "#10162f", overflow: "hidden" }}>
        <div className="ar-bk ec-light side-a" style={{ ["--T" as string]: "3200ms" }}>
          <i className="bk-dim" />
          <i className="bk-rays" />
          <i className="bk-ring r1" />
          <i className="bk-ring r2" />
          <i className="bk-ring r3" />
          <span className="bk-kanji">卍解</span>
          <span className="bk-hero">
            <img src="/api/cards/art/ichigo-kurosaki" alt="" />
          </span>
          <i className="bk-embers" />
          <div className="bk-txt">
            <small>Бан-кай · Ичиго Куросаки</small>
            <b>Бан-кай: Тенса Зангецу</b>
          </div>
          <i className="bk-slash s1" />
          <i className="bk-slash s2" />
          <i className="bk-flash" />
        </div>
      </div>
    </div>
  );
}
