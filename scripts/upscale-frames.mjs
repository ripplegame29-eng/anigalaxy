// Нейро-апскейл рамок карт (Real-ESRGAN anime, GPU). Запуск из папки проекта:
//   node scripts/upscale-frames.mjs
// Исходники 600x840 лежат в scripts/frames-src, результат: public/cards/frames/<rank>.webp (1800x2520).
// Нужен tools/realesrgan (его уже скачал scripts/upscale-art.ps1).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "scripts", "frames-src");
const tmp = join(root, "tools", "frames-hd");
const out = join(root, "public", "cards", "frames");

function findExe(dir) {
  if (!existsSync(dir)) return null;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      const r = findExe(p);
      if (r) return r;
    } else if (e.name.toLowerCase() === "realesrgan-ncnn-vulkan.exe") return p;
  }
  return null;
}
const exe = findExe(join(root, "tools", "realesrgan"));
if (!exe) throw new Error("tools/realesrgan не найден: сначала запусти scripts/upscale-art.ps1");

mkdirSync(tmp, { recursive: true });
console.log("Апскейл рамок…");
execFileSync(exe, ["-i", src, "-o", tmp, "-n", "realesrgan-x4plus-anime", "-s", "4", "-f", "png"], { cwd: join(exe, ".."), stdio: "inherit" });

for (const f of readdirSync(tmp).filter((n) => n.endsWith(".png"))) {
  const name = f.replace(/\.png$/, "");
  await sharp(join(tmp, f))
    .resize(1800, 2520, { kernel: "lanczos3" })
    .sharpen({ sigma: 0.6, m1: 0.8, m2: 1.2 })
    .webp({ quality: 92, alphaQuality: 100, effort: 6 })
    .toFile(join(out, `${name}.webp`));
  console.log("готово:", name);
}
rmSync(tmp, { recursive: true, force: true });
console.log("Готово. Обнови сайт (Ctrl+F5).");
