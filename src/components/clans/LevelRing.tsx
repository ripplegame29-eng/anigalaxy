"use client";

import {
  clanLevel,
  clanLevelProgress,
  levelProgress,
  type Clan,
} from "@/lib/clans";

/**
 * Кольцо уровня с орбитой и внешней шкалой — собрано по мотивам `.bp-ring`
 * боевого пропуска: по центру стеклянный диск с номером, вокруг вращается
 * орбита со «спутником», снаружи — дуговая шкала прогресса.
 *
 * У своего клана уровень считается по вкладам, у чужого — по очкам.
 */
export function LevelRing({ clan, size = 92 }: { clan: Clan; size?: number }) {
  const mine = Boolean(clan.mine);
  const level = mine ? clan.level : clanLevel(clan.points);
  const progress = mine
    ? Math.round(levelProgress(clan.cells) * 100)
    : Math.round(clanLevelProgress(clan.points) * 100);

  return (
    <span
      className="cl-ring"
      style={{
        ["--c" as string]: clan.color,
        ["--p" as string]: progress,
        ["--size" as string]: `${size}px`,
      }}
      role="img"
      aria-label={`Уровень ${level}, ${progress}% до следующего`}
    >
      <i className="halo" aria-hidden />
      <i className="orb" aria-hidden />
      <span className="n" aria-hidden>
        {level}
        <small>ур.</small>
      </span>
    </span>
  );
}