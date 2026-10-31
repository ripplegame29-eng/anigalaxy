/*
 * Подготовка маскота под размер знака/логотипа.
 *
 * Полная фигура персонажа с лапками, хвостами и пламенем без обрезки.
 */
import sharp from "sharp";
import fs from "node:fs";

const SRC = "public/donate-cat2.png";
const OUT = "public/cat-mascot.png";
const WIDTH = 400;

(async () => {
  const meta = await sharp(SRC).metadata();
  const { width, height } = meta;
  const outW = WIDTH;
  const outH = Math.round((height / width) * outW);

  await sharp(SRC)
    .resize({ width: outW, height: outH, fit: "contain" })
    .png({ compressionLevel: 9, palette: false, effort: 10 })
    .toFile(OUT);

  const size = fs.statSync(OUT).size;
  console.log(
    `исходник ${width}×${height} → знак ${outW}×${outH}, ${Math.round(size / 1024)} КБ`,
  );
})().catch((e) => { console.error(String(e).slice(0, 300)); process.exit(1); });
