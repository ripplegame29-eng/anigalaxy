/* Лисёнок из прототипа шапки → public/images.
 *
 * В прототипе он вшит двумя base64 (логотип 200×200 и окно бонуса 240×240).
 * Выносим в файлы: ~200–256 px по большей стороне (в макете ~56 и ~96 px,
 * запас на retina), WebP с альфой, без белой подложки.
 */
import sharp from "sharp";
import fs from "node:fs";

const TMP = "C:/Users/WHITE POWER/AppData/Local/Temp/opencode";
const OUT = "C:/Users/WHITE POWER/anime-hub/public/images";

const JOBS = [
  { src: `${TMP}/fox1.png`, out: "fox-logo.webp", width: 256 },
  { src: `${TMP}/fox2.png`, out: "fox-gift.webp", width: 256 },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const job of JOBS) {
    const img = sharp(job.src);
    const meta = await img.metadata();
    const buf = await img
      .resize({ width: job.width, withoutEnlargement: false, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 92, alphaQuality: 100 })
      .toBuffer();
    await fs.promises.writeFile(`${OUT}/${job.out}`, buf);

    /* Проверяем альфу: углы должны быть прозрачными, иначе будет
       белый квадрат на тёмном фоне шапки */
    const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const px = (x, y) => data[(y * info.width + x) * info.channels + 3];
    const corners = [px(0, 0), px(info.width - 1, 0), px(0, info.height - 1), px(info.width - 1, info.height - 1)];
    let opaqueWhite = 0;
    for (let y = 0; y < info.height; y += 4) {
      for (let x = 0; x < info.width; x += 4) {
        const o = (y * info.width + x) * info.channels;
        if (data[o + 3] > 250 && data[o] > 245 && data[o + 1] > 245 && data[o + 2] > 245) opaqueWhite += 1;
      }
    }
    console.log(
      `${job.out}: ${meta.width}×${meta.height} → ${info.width}×${info.height}, ` +
      `${Math.round(buf.length / 1024)} КБ, альфа углов ${corners.join("/")}, ` +
      `белых непрозрачных точек ${opaqueWhite}`,
    );
  }
})().catch((e) => {
  console.error(String(e).slice(0, 400));
  process.exit(1);
});