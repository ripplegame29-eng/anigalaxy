"use client";

import type { CSSProperties } from "react";
import { MEDALS, MedalArt, medalOf, type MedalDef } from "@/components/progression/medals";

const COLLECTIONS: { title: string; note: string; ids: string[] }[] = [
  {
    title: "Коллекция 01 · обычные",
    note: "шестиугольная подложка, пунктирная шестерёнка",
    ids: ["ach_night_10", "ach_titles_1", "ach_comments_100", "ach_secret_0404", "ach_episodes_1000"],
  },
  {
    title: "Коллекция 02 · разные формы",
    note: "круг, крыло, щит, ромб, звезда",
    ids: ["ach_chrono_day", "ach_ratings_500", "ach_genre_shonen", "ach_genre_fantasy", "ach_secrets_all"],
  },
  {
    title: "Коллекция 03 · легендарные",
    note: "восьмиугольник, везика, арка, звезда-4, звезда-12",
    ids: ["ach_minutes_10000", "ach_streak_365", "ach_seasons_all", "ach_night_500", "ach_all_done"],
  },
];

function Card({ medal }: { medal: MedalDef }) {
  return (
    <article className="md-card" style={{ "--g": medal.g } as CSSProperties}>
      <div className="md-wrap">
        <MedalArt medal={medal} size={96} />
      </div>
      {medal.tier && <span className="md-tag">{medal.tier === "АБСОЛЮТ" ? "✦ АБСОЛЮТ ✦" : medal.tier}</span>}
      <h3 className="md-name">
        {medal.code.split(/(\b[IVX]{1,4}\b)/).map((part, i) =>
          /^[IVX]{1,4}$/.test(part) ? (
            <span key={i} className="md-rom">
              {part}
            </span>
          ) : (
            <span key={i}>{part}</span>
          ),
        )}
      </h3>
      <p className="md-desc">{medal.description}</p>
      <span className="md-rar">
        <i />
        {medal.shape} · {medal.icon}
      </span>
    </article>
  );
}

/**
 * Превью пятнадцати медалей из трёх макетов. Служебная страница рядом с
 * `dev/ranks`, чтобы видеть фигуры и анимации, не заходя в профиль.
 */
export default function MedalsPreviewPage() {
  return (
    <div className="md-page">
      <style>{PREVIEW_CSS}</style>
      <h1>Медали достижений</h1>
      <p className="md-sub">Пятнадцать медалей из трёх коллекций · порт 1:1</p>

      {COLLECTIONS.map((group) => (
        <section key={group.title}>
          <h2>{group.title}</h2>
          <p className="md-note">{group.note}</p>
          <div className="md-grid">
            {group.ids.map((id) => {
              const medal = medalOf(id);
              return medal ? <Card key={id} medal={medal} /> : null;
            })}
          </div>
        </section>
      ))}

      <section>
        <h2>Все {Object.keys(MEDALS).length} — одним рядом</h2>
        <div className="md-grid">
          {Object.values(MEDALS).map((medal) => (
            <Card key={medal.achievementId} medal={medal} />
          ))}
        </div>
      </section>
    </div>
  );
}

const PREVIEW_CSS = `
.md-page{max-width:1100px;margin:0 auto;padding:40px 20px 80px;color:#fff;font-family:var(--font-body),system-ui,sans-serif}
.md-page h1{margin:0 0 6px;font-size:30px;font-weight:800}
.md-sub{margin:0 0 36px;color:rgba(255,255,255,.45);font-size:14px}
.md-page section{margin-bottom:48px}
.md-page h2{margin:0 0 4px;font-size:15px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.5)}
.md-note{margin:0 0 16px;font-size:12px;color:rgba(255,255,255,.32)}
.md-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px}
.md-card{
  position:relative;display:grid;justify-items:center;gap:7px;padding:18px 14px 14px;
  border-radius:18px;text-align:center;
  border:1px solid rgba(var(--g),.22);
  background:
    radial-gradient(110% 70% at 50% -10%,rgba(var(--g),.16),transparent 60%),
    linear-gradient(180deg,rgba(18,16,28,.9),rgba(9,8,16,.95));
  transition:transform .25s,border-color .25s;
}
.md-card:hover{transform:translateY(-5px);border-color:rgba(var(--g),.55)}
.md-wrap{width:96px;height:104px}
.md-tag{
  display:inline-flex;align-items:center;padding:3px 10px;border-radius:99px;
  font-size:10px;font-weight:800;letter-spacing:.12em;
  color:#ffd778;background:rgba(255,215,120,.1);border:1px solid rgba(255,215,120,.35);
}
.md-name{margin:0;font-size:14px;font-weight:800;line-height:1.35;min-height:2.7em;display:grid;place-items:center}
.md-rom{color:#ffd66b}
.md-desc{margin:0;font-size:11.5px;line-height:1.4;color:rgba(255,255,255,.5)}
.md-rar{display:inline-flex;align-items:center;gap:6px;padding:3px 9px;border-radius:99px;font-size:10.5px;color:rgba(255,255,255,.55);background:rgba(var(--g),.1);border:1px solid rgba(var(--g),.25)}
.md-rar i{width:5px;height:5px;border-radius:50%;background:rgb(var(--g));box-shadow:0 0 7px 1px rgba(var(--g),1)}
`;