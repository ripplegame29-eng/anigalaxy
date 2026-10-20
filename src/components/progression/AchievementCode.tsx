"use client";

/**
 * Название достижения в формате кода: «Ночной дозор II — Страж II».
 *
 * Римские цифры помечены классом `.ag-aw-rom`, чтобы подсветить их цветом
 * золота — как в макетах. Сама сборка текста живёт в
 * `lib/progression/achievement-codes`, здесь только вывод.
 *
 * Для тайных знаков, которые ещё не получены, текст не показывается вовсе:
 * наружу отдаётся `disguised`, и вместо названия рисуется «???».
 */

import { achievementCode, parseCode } from "@/lib/progression/achievement-codes";
import { medalOf } from "./medals";

export function AchievementCode({
  id,
  family,
  tier,
  disguised = false,
  className,
  romanClassName = "ag-aw-rom",
}: {
  /** id достижения: если на него надета медаль, её код главнее */
  id?: string;
  family: string;
  tier: number;
  /** Неполученный тайный знак — вместо названия показываем «???» */
  disguised?: boolean;
  className?: string;
  romanClassName?: string;
}) {
  if (disguised) return <>{className ? <span className={className}>???</span> : "???"}</>;

  // У переодетых достижений код задан медалью дословно из макета
  const medal = id ? medalOf(id) : undefined;
  const parts = medal ? parseCode(medal.code) : achievementCode(family, tier).parts;
  return (
    <>
      {parts.map((part, i) =>
        part.roman ? (
          <span key={i} className={romanClassName}>
            {part.text}
          </span>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}