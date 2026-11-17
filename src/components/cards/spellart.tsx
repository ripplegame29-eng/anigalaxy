"use client";

import { useState } from "react";
import { spellArt, type Tactic } from "@/lib/cards/tactics";
import { SkillGlyph } from "./skillui";

/** Арт карты боя; пока файл не добавлен — символ эффекта */
export function SpellArt({ id, fx, size = 46 }: { id: string; fx: Tactic["fx"]; size?: number }) {
  const [bad, setBad] = useState(false);
  return (
    <span className="sp-art">
      {!bad && <img src={spellArt(id)} alt="" draggable={false} onError={() => setBad(true)} />}
      {bad && (
        <span className="sp-ph">
          <SkillGlyph fx={fx} size={size} />
        </span>
      )}
    </span>
  );
}
