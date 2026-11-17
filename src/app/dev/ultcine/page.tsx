import type { Metadata } from "next";
import "../../cards-card.css";
import "../../cards.css";
import "../../cards-battle.css";
import "../../cards-ult.css";
import { SkillGlyph } from "@/components/cards/skillui";

export const metadata: Metadata = { title: "Ульт — превью", robots: { index: false, follow: false } };

/** Превью кат-сцены обычного ультимейта. Только для разработки. */
export default async function Page({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const freeze = `.ar-cine *{animation-play-state:paused!important;animation-delay:-${Number(t ?? 0.9) || 0.9}s!important}`;
  return (
    <div className="cg" style={{ padding: 24, background: "#0a0e22", minHeight: "100vh" }}>
      <style>{freeze}</style>
      <div id="stage" style={{ position: "relative", width: 1200, height: 600, margin: "0 auto", overflow: "hidden", background: "radial-gradient(70% 90% at 50% 50%, #5b4a6e, #2a2140 70%, #14102a)" }}>
        <div className="ar-cine fx-c-slash cls-0" style={{ ["--fxc" as string]: "#e6ecff" }}>
          <i className="cn-dim" />
          <i className="cn-rays" />
          <i className="cn-bar t" />
          <i className="cn-bar b" />
          <div className="cn-plate">
            <span className="cn-ico"><SkillGlyph fx="slash" size={58} /></span>
            <span className="cn-txt">
              <small>Ультимейт · Всемогущий</small>
              <b>Крушение небес</b>
            </span>
          </div>
          <i className="cn-streak s1" />
          <i className="cn-streak s2" />
          <i className="cn-streak s3" />
        </div>
      </div>
    </div>
  );
}
