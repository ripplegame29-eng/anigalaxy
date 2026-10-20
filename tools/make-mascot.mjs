/*
 * Кадрирование маскота под размер шапки.
 *
 * Целая фигура на 36px превращается в синее пятно: грива и хвост занимают
 * больше половины кадра, а лицо — пятно в центре. Поэтому для знака в шапке
 * берём не всю фигуру, а голову с гривой: она читается даже в таком размере.
 */
import sharp from "sharp";
import fs from "node:fs";

const SRC = "public/donate-cat2.png";
const OUT = "public/cat-mascot.png";
const WIDTH = 192;

(async () => {
  const meta = await sharp(SRC).metadata();
  const { width, height } = meta;

  // Голова с гривой и ушами: по исходнику это примерно верхние 62% кадра,
  // плюс небольшой запас снизу, чтобы подбородок не обрезался
  const cropTop = Math.round(height * 0.04);
  const cropH = Math.round(height * 0.62);
  const outW = WIDTH;
  const outH = Math.round((cropH / width) * outW);

  await sharp(SRC)
    .extract({ left: 0, top: cropTop, width, height: cropH })
    .resize({ width: outW, height: outH, fit: "fill" })
    .png({ compressionLevel: 9, palette: false, effort: 10 })
    .toFile(OUT);

  const out = await sharp(OUT).metadata();
  const size = fs.statSync(OUT).size;
  console.log(
    `исходник ${width}×${height} → кадр ${outW}×${outH} (верхние ${Math.round((cropH / height) * 100)}%), ${Math.round(size / 1024)} КБ`,
  );

  // Контрольный лист: как знак будет выглядеть в шапке
  await sharp(OUT)
    .resize({ width: 36, height: 36, fit: "contain", background: { r: 7, g: 7, b: 12, alpha: 1 } })
    .extend({ top: 6, bottom: 6, left: 6, right: 6, background: { r: 7, g: 7, b: 12, alpha: 1 } })
    .png()
    .toFile("tools/preview-logo-36.png");
  console.log("контрольный кадр: tools/preview-logo-36.png");
})().catch((e) => { console.error(String(e).slice(0, 300)); process.exit(1); });