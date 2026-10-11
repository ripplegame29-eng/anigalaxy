/**
 * Балансовый симулятор прогрессии (§15.8, §16).
 *
 *   node tools/balance-sim.mjs
 *
 * Моделирует три профиля темпа (casual / regular / hardcore), печатает дни
 * до уровней 5 · 10 · 25 · 50 · 75 · 100 и **падает с ненулевым кодом**,
 * если любой результат выходит за целевые коридоры §5 (допуск ±25%).
 *
 * Модель (все числа — из `progression.config`, инструмент своих не хранит):
 *  - кривая уровней `xpToNext(L) = round(base × L^exponent)` — реальная
 *    `totalXpFor()` из движка, а не пересчёт в скрипте;
 *  - день игрока приносит `profile.xpPerDay` ACTIVITY-XP; все профили ≤
 *    `softCap.dailyXp` (проверяется) — смягчение не срабатывает;
 *  - «одноразовые достижения» = сумма `reward.xp` всех включённых
 *    достижений (§5: «≈150 000 XP суммарно»); пул копится по кривой
 *    `p^achievementShape`, где p — доля пути к L100: поздние пороги
 *    (1000–2000 серий, 365 дней, 500 оценок, 10 000 минут) дают львиную
 *    долю наград, поэтому на середине пути получено меньше половины;
 *  - дни(L) = (xpForLevel(L) − пул × p^shape) / xpPerDay.
 *
 * Код выхода = число проваленных проверок (0 — зелёный прогон).
 */

import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, ".tsc-tests");

const tsc = spawnSync("npx tsc -p tsconfig.tools.json", {
  cwd: root,
  stdio: "inherit",
  shell: true,
});
if (tsc.status !== 0) {
  console.error("[balance-sim] сборка не удалась");
  process.exit(tsc.status ?? 1);
}

const out = [];
const fail = [];
const check = (name, cond, extra = "") => {
  out.push(`${cond ? "OK  " : "FAIL"} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!cond) fail.push(name);
};

/** Дни → человекочитаемо: до 10 дней — часы/дни с точностью, дальше — дни */
const fmtDays = (d) => (d < 10 ? `${d.toFixed(1)}` : `${Math.round(d)}`);

try {
  const config = await import(
    pathToFileURL(path.join(outDir, "lib", "progression", "progression.config.js")).href
  );
  const curve = await import(
    pathToFileURL(path.join(outDir, "lib", "progression", "curve.js")).href
  );

  const cfg = config.PROGRESSION_CONFIG;
  const sim = cfg.sim;
  const { totalXpFor, levelFromXp } = curve;

  /* ------------------------- 1. Опорные суммы §5 ------------------------ */

  const reference = { 5: 620, 10: 3200, 25: 25900, 50: 121500, 75: 298700, 100: 564600 };
  out.push(`— Опорные суммы XP (§5) —`);
  for (const [level, expected] of Object.entries(reference)) {
    const actual = totalXpFor(Number(level));
    const delta = Math.abs(actual - expected) / expected;
    check(
      `суммарный XP до ур.${level}`,
      delta <= 0.01,
      `${actual} ≈ ${expected} (отклонение ${(delta * 100).toFixed(2)}%)`,
    );
  }

  const xp100 = totalXpFor(cfg.levels.maxLevel);
  const pool = cfg.achievements
    .filter((a) => a.enabled !== false)
    .reduce((sum, a) => sum + (a.reward.xp ?? 0), 0);
  const levels = Object.keys(reference).map(Number);

  out.push("");
  out.push(
    `Кривая: xpToNext(L) = round(${cfg.levels.base} × L^${cfg.levels.exponent}); ` +
      `пул XP достижений: ${pool} XP (${cfg.achievements.filter((a) => a.enabled !== false).length} шт.); ` +
      `форма накопления: p^${sim.achievementShape}`,
  );
  out.push(`Soft-cap: ${cfg.softCap.dailyXp} XP/сутки — все профили обязаны быть не выше.`);
  out.push("");

  /* ---------------------------- 2. Симуляция ---------------------------- */

  /**
   * Дни до уровня для профиля: активность закрывает разницу между нужным
   * XP и уже накопленным «одноразовым» пулом достижений.
   * @param {{xpPerDay:number}} profile
   * @param {number} level
   */
  const daysToLevel = (profile, level) => {
    const need = totalXpFor(level);
    const progress = Math.min(1, need / xp100);
    const credited = pool * progress ** sim.achievementShape;
    return Math.max(0, (need - credited) / profile.xpPerDay);
  };

  out.push("Дни до уровня (средний темп, дробные сутки):");
  const header = ["Профиль".padEnd(9), "XP/сут".padStart(7), ...levels.map((l) => `ур.${l}`.padStart(9))].join("  ");
  out.push(header);
  out.push("-".repeat(header.length));

  const table = new Map();
  for (const profile of sim.profiles) {
    const row = levels.map((level) => daysToLevel(profile, level));
    table.set(profile.id, row);
    out.push(
      [
        profile.label.padEnd(9),
        String(profile.xpPerDay).padStart(7),
        ...row.map((d) => fmtDays(d).padStart(9)),
      ].join("  "),
    );
  }
  out.push("");

  /* --------------------------- 3. Согласованность ----------------------- */

  check(
    "профили не превышают soft-cap (иначе модель не сработает)",
    sim.profiles.every((p) => p.xpPerDay <= cfg.softCap.dailyXp),
    sim.profiles.map((p) => `${p.label}=${p.xpPerDay}`).join(", "),
  );

  for (const profile of sim.profiles) {
    const row = table.get(profile.id);
    const monotonic = row.every((d, i) => i === 0 || d > row[i - 1]);
    check(`${profile.label}: дни до уровня растут монотонно`, monotonic, row.map(fmtDays).join(" → "));
    check(
      `${profile.label}: уровень достижим (не «вечно»)`,
      row[row.length - 1] < 3650 * 4,
      `${fmtDays(row[row.length - 1])} дн до ур.100`,
    );
    check(
      `${profile.label}: кривая инвертируется (levelFromXp верна)`,
      levels.every((level) => levelFromXp(totalXpFor(level)) === level),
    );
  }

  /* ------------------------- 4. Целевые коридоры §5 --------------------- */

  out.push(`Коридоры §5 (допуск ±${Math.round(sim.tolerance * 100)}%):`);
  for (const target of sim.targets) {
    const profile = sim.profiles.find((p) => p.id === target.profile);
    if (!profile) {
      check(`коридор ур.${target.level}: профиль «${target.profile}» существует`, false);
      continue;
    }
    const row = table.get(profile.id);
    const days = row[levels.indexOf(target.level)];
    const low = target.minDays * (1 - sim.tolerance);
    const high = target.maxDays * (1 + sim.tolerance);
    const window = target.minDays === target.maxDays
      ? `≈${target.minDays} дн → ${low.toFixed(0)}–${high.toFixed(0)}`
      : `${target.minDays}–${target.maxDays} дн → ${low.toFixed(0)}–${high.toFixed(0)}`;
    check(
      `${profile.label} · ур.${target.level}: ${fmtDays(days)} дн в коридоре ${window}`,
      days >= low && days <= high,
      `${fmtDays(days)} дн`,
    );
  }

  out.push("");
  out.push(`ИТОГ: ${fail.length ? `${fail.length} провал(ов)` : "все проверки пройдены"}`);
  if (fail.length) out.push("провалено: " + fail.join(", "));
  console.log(out.join("\n"));
} catch (e) {
  console.log(out.join("\n"));
  console.error("[balance-sim] ошибка: " + String(e));
  process.exitCode = 1;
} finally {
  try {
    rmSync(outDir, { recursive: true, force: true });
  } catch {
    // не критично
  }
}

if (fail.length) process.exit(fail.length);
