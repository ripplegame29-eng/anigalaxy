/**
 * Съёмка сцен для промо-ролика AniGalaxy.
 *
 * Ничего не меняет в сайте: открывает его в Chrome, плавно «ведёт камеру»
 * (скролл, наведения, клики по публичным кнопкам) и пишет кадры через
 * CDP-скринкаст в promo/raw/<сцена>/. Монтаж делается отдельно.
 *
 * Запуск (сайт должен работать на localhost:3000):
 *   npm i --no-save playwright-core
 *   node promo/capture.mjs            — все сцены
 *   node promo/capture.mjs d03 m01    — только выбранные (по началу имени)
 *
 * Нужен установленный Google Chrome или Microsoft Edge. Гостевой режим:
 * личных данных в кадре нет. Переменная BASE меняет адрес сайта.
 */
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = path.resolve("promo/raw");
const only = process.argv.slice(2);

const DESKTOP = { width: 1920, height: 1080, dsf: 1, mobile: false };
const MOBILE = { width: 540, height: 960, dsf: 2, mobile: true };

/** Прячем то, чего не должно быть в кадре: полосы прокрутки и dev-индикатор Next */
const HIDE_CSS = `
  ::-webkit-scrollbar{display:none!important}
  html{scrollbar-width:none!important;scroll-behavior:auto!important}
  nextjs-portal,[data-nextjs-toast],[data-nextjs-dev-tools-button]{display:none!important}
`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch() {
  const args = ["--autoplay-policy=no-user-gesture-required", "--hide-scrollbars", "--force-color-profile=srgb"];
  if (process.env.PW_BUNDLED) return await chromium.launch({ headless: true, args });
  for (const channel of ["chrome", "msedge"]) {
    try {
      return await chromium.launch({ channel, headless: true, args });
    } catch {
      /* пробуем следующий браузер */
    }
  }
  throw new Error("Не найден Google Chrome / Microsoft Edge. Установите Chrome и запустите снова.");
}

/* ----------------------------- помощники ----------------------------- */

const settle = async (page, extra = 1200) => {
  await page.waitForLoadState("load").catch(() => {});
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  // ждём картинки в первом экране (постеры грузятся с внешних CDN)
  await page
    .waitForFunction(
      () => [...document.images].filter((i) => i.getBoundingClientRect().top < innerHeight * 1.5).every((i) => i.complete),
      null,
      { timeout: 15000 },
    )
    .catch(() => {});
  await page.keyboard.press("Escape").catch(() => {});
  await sleep(extra);
};

/** Плавный скролл с ease-in-out: «ход камеры» */
const scrollTo = (page, to, ms) =>
  page.evaluate(
    ({ to, ms }) =>
      new Promise((resolve) => {
        const from = scrollY;
        const max = document.documentElement.scrollHeight - innerHeight;
        const target = Math.max(0, Math.min(to, max));
        const t0 = performance.now();
        const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
        const step = (now) => {
          const k = Math.min(1, (now - t0) / ms);
          window.scrollTo({ top: from + (target - from) * ease(k), behavior: "instant" });
          k < 1 ? requestAnimationFrame(step) : resolve();
        };
        requestAnimationFrame(step);
      }),
    { to, ms },
  );

const glide = async (page, x, y, ms = 700) => {
  await page.mouse.move(x, y, { steps: Math.max(8, Math.round(ms / 16)) });
};

const hoverEl = async (page, locator, ms = 700, hold = 500) => {
  const box = await locator.boundingBox().catch(() => null);
  if (!box) return false;
  await glide(page, box.x + box.width / 2, box.y + box.height / 2, ms);
  await sleep(hold);
  return true;
};

const tryClick = async (locator, timeout = 2500) => {
  try {
    await locator.first().click({ timeout });
    return true;
  } catch {
    return false;
  }
};

/* ------------------------------ запись ------------------------------- */

async function record(browser, name, vp, run) {
  if (only.length && !only.some((prefix) => name.startsWith(prefix))) return;
  const dir = path.join(OUT, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  console.log(`▶ ${name}`);

  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dsf,
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    locale: "ru-RU",
    timezoneId: "Asia/Yekaterinburg",
    colorScheme: "dark",
  });
  await context.addInitScript((css) => {
    const add = () => {
      const style = document.createElement("style");
      style.textContent = css;
      document.documentElement.appendChild(style);
    };
    document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", add) : add();
  }, HIDE_CSS);

  const page = await context.newPage();
  const stamps = [];
  let index = 0;
  let started = 0;
  let ended = 0;

  /** Телефон, живая запись: скриншоты в цикле, пока идёт сцена (реальное время) */
  const liveStills = async (scene) => {
    let running = true;
    started = Date.now() / 1000;
    const loop = (async () => {
      while (running) {
        const at = Date.now() / 1000;
        const file = path.join(dir, `${String(index).padStart(5, "0")}.jpg`);
        const ok = await page.screenshot({ path: file, type: "jpeg", quality: 94 }).then(() => true).catch(() => false);
        if (ok) {
          stamps.push(at);
          index += 1;
        }
      }
    })();
    await scene();
    running = false;
    await loop;
    ended = Date.now() / 1000;
    await page.screenshot({ path: path.join(dir, "preview.jpg"), quality: 80, type: "jpeg" }).catch(() => {});
  };

  try {
    await run({
      page,
      /** Живая запись (десктоп): CDP-скринкаст, кадры с реальными метками времени */
      async shoot(scene) {
        if (vp.mobile) return liveStills(scene);
        const cdp = await context.newCDPSession(page);
        cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
          const file = path.join(dir, `${String(index).padStart(5, "0")}.jpg`);
          fs.writeFileSync(file, Buffer.from(data, "base64"));
          stamps.push(metadata.timestamp);
          index += 1;
          cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
        });
        await cdp.send("Page.startScreencast", {
          format: "jpeg",
          quality: 96,
          maxWidth: vp.width * vp.dsf,
          maxHeight: vp.height * vp.dsf,
          everyNthFrame: 1,
        });
        started = Date.now() / 1000;
        await scene();
        ended = Date.now() / 1000;
        await sleep(150);
        await cdp.send("Page.stopScreencast").catch(() => {});
        await page.screenshot({ path: path.join(dir, "preview.jpg"), quality: 80, type: "jpeg" }).catch(() => {});
      },
      /**
       * Покадровый скролл (телефон): скриншоты в родных 1080×1920. Положение
       * страницы считается по времени, поэтому движение ровное, как бы
       * медленно ни снимался каждый кадр. segments: [{ to, ms }], to=null — пауза.
       */
      async scrub(segments, fps = 30) {
        started = Date.now() / 1000;
        let y = await page.evaluate(() => scrollY);
        let frame = 0;
        const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
        for (const seg of segments) {
          const count = Math.max(1, Math.round((seg.ms / 1000) * fps));
          const from = y;
          const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
          const target = seg.to == null ? from : Math.max(0, Math.min(seg.to, max));
          for (let i = 1; i <= count; i += 1) {
            const pos = from + (target - from) * ease(i / count);
            await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), pos);
            await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
            await page.screenshot({ path: path.join(dir, `${String(index).padStart(5, "0")}.jpg`), type: "jpeg", quality: 94 });
            stamps.push(frame / fps);
            index += 1;
            frame += 1;
          }
          y = target;
        }
        ended = frame / fps;
        await page.screenshot({ path: path.join(dir, "preview.jpg"), quality: 80, type: "jpeg" }).catch(() => {});
      },
    });
  } catch (error) {
    console.log(`  ⚠ ${name}: ${error.message}`);
  }
  fs.writeFileSync(
    path.join(dir, "frames.json"),
    JSON.stringify({ name, width: vp.width * vp.dsf, height: vp.height * vp.dsf, started, ended, stamps }),
  );
  console.log(`  кадров: ${index}`);
  await context.close();
}

/* ------------------------------- сцены ------------------------------- */

const browser = await launch();
fs.mkdirSync(OUT, { recursive: true });

/* ——— десктоп 1920×1080 ——— */

await record(browser, "d01_hero", DESKTOP, async ({ page, shoot }) => {
  await page.goto(BASE + "/");
  await settle(page, 1500);
  await shoot(async () => {
    await glide(page, 1500, 520, 1200);
    await sleep(2600);
    await tryClick(page.getByLabel("Следующий слайд"));
    await glide(page, 1100, 600, 900);
    await sleep(3200);
    await tryClick(page.getByLabel("Следующий слайд"));
    await sleep(3200);
  });
});

await record(browser, "d02_home", DESKTOP, async ({ page, shoot }) => {
  await page.goto(BASE + "/");
  await settle(page, 1500);
  await shoot(async () => {
    await sleep(500);
    await scrollTo(page, 760, 2600);
    await sleep(1200);
    await scrollTo(page, 1700, 3200);
    await sleep(1200);
    await scrollTo(page, 2900, 3600);
    await sleep(1000);
  });
});

await record(browser, "d03_catalog", DESKTOP, async ({ page, shoot }) => {
  await page.goto(BASE + "/catalog");
  await settle(page, 1800);
  await shoot(async () => {
    await sleep(700);
    await scrollTo(page, 380, 1800);
    const cards = page.locator('a[href^="/title/"]');
    for (const i of [1, 2, 5, 6]) {
      await hoverEl(page, cards.nth(i), 650, 650);
    }
    await scrollTo(page, 1100, 2800);
    await sleep(900);
  });
});

await record(browser, "d04_swipe", DESKTOP, async ({ page, shoot }) => {
  await page.goto(BASE + "/aniswipe");
  await settle(page, 1800);
  await shoot(async () => {
    await sleep(1400);
    await tryClick(page.getByRole("button", { name: /Нравится/ }));
    await sleep(1500);
    await tryClick(page.getByRole("button", { name: /Позже/ }));
    await sleep(1500);
    await tryClick(page.getByRole("button", { name: /Пропустить/ }));
    await sleep(1500);
    await tryClick(page.getByRole("button", { name: /Нравится/ }));
    await sleep(1600);
  });
});

await record(browser, "d05_title", DESKTOP, async ({ page, shoot }) => {
  await page.goto(BASE + "/catalog");
  await settle(page, 800);
  const href = await page.locator('a[href^="/title/"]').first().getAttribute("href");
  await page.goto(BASE + (href ?? "/"));
  await settle(page, 2200);
  await shoot(async () => {
    await sleep(1300);
    await scrollTo(page, 520, 2200);
    await sleep(900);
    const player = page.locator(".wb-shell").first();
    await player.scrollIntoViewIfNeeded().catch(() => {});
    await hoverEl(page, player, 900, 900);
    await tryClick(page.getByText("Источник", { exact: false }), 1500);
    await sleep(1800);
    await page.keyboard.press("Escape").catch(() => {});
    await sleep(900);
  });
});

await record(browser, "d06_battlepass", DESKTOP, async ({ page, shoot }) => {
  await page.goto(BASE + "/battlepass");
  await settle(page, 1800);
  await shoot(async () => {
    await sleep(1300);
    await scrollTo(page, 700, 3200);
    await sleep(1000);
    await scrollTo(page, 1500, 3000);
    await sleep(900);
  });
});

await record(browser, "d07_premium", DESKTOP, async ({ page, shoot }) => {
  await page.goto(BASE + "/premium");
  await settle(page, 1800);
  await shoot(async () => {
    await sleep(1200);
    await scrollTo(page, 800, 3200);
    await sleep(1000);
    await scrollTo(page, 1700, 3000);
    await sleep(800);
  });
});

await record(browser, "d08_clans", DESKTOP, async ({ page, shoot }) => {
  await page.goto(BASE + "/clans");
  await settle(page, 1800);
  await shoot(async () => {
    await sleep(1800);
    await scrollTo(page, 600, 2800);
    await sleep(1400);
  });
});

await record(browser, "d09_schedule", DESKTOP, async ({ page, shoot }) => {
  await page.goto(BASE + "/schedule");
  await settle(page, 1800);
  await shoot(async () => {
    await sleep(1400);
    await scrollTo(page, 500, 2600);
    await sleep(1000);
  });
});

await record(browser, "d10_apps", DESKTOP, async ({ page, shoot }) => {
  await page.goto(BASE + "/apps");
  await settle(page, 3000);
  await shoot(async () => {
    await sleep(3200);
    await scrollTo(page, 900, 2800);
    await sleep(1200);
  });
});

await record(browser, "d11_chat", DESKTOP, async ({ page, shoot }) => {
  await page.goto(BASE + "/");
  await settle(page, 1500);
  await shoot(async () => {
    await sleep(600);
    await tryClick(page.getByLabel(/Открыть общий чат/));
    await sleep(3500);
  });
});

/* ——— телефон 540×960 @2x = 1080×1920 ——— */

await record(browser, "m01_hero", MOBILE, async ({ page, scrub }) => {
  await page.goto(BASE + "/");
  await settle(page, 1800);
  await scrub([{ to: null, ms: 2500 }, { to: 700, ms: 2600 }, { to: null, ms: 1200 }]);
});

await record(browser, "m02_catalog", MOBILE, async ({ page, scrub }) => {
  await page.goto(BASE + "/catalog");
  await settle(page, 1800);
  await scrub([{ to: null, ms: 900 }, { to: 900, ms: 3400 }, { to: null, ms: 600 }, { to: 1900, ms: 3400 }, { to: null, ms: 500 }]);
});

await record(browser, "m03_swipe", MOBILE, async ({ page, shoot }) => {
  await page.goto(BASE + "/aniswipe");
  await settle(page, 1800);
  await shoot(async () => {
    await sleep(1300);
    await tryClick(page.getByRole("button", { name: /Нравится/ }));
    await sleep(1500);
    await tryClick(page.getByRole("button", { name: /Позже/ }));
    await sleep(1500);
    await tryClick(page.getByRole("button", { name: /Нравится/ }));
    await sleep(1500);
  });
});

await record(browser, "m04_title", MOBILE, async ({ page, scrub }) => {
  await page.goto(BASE + "/catalog");
  await settle(page, 800);
  const href = await page.locator('a[href^="/title/"]').first().getAttribute("href");
  await page.goto(BASE + (href ?? "/"));
  await settle(page, 2200);
  await scrub([{ to: null, ms: 1400 }, { to: 600, ms: 2800 }, { to: null, ms: 1200 }, { to: 1300, ms: 2600 }, { to: null, ms: 600 }]);
});

await record(browser, "m05_battlepass", MOBILE, async ({ page, scrub }) => {
  await page.goto(BASE + "/battlepass");
  await settle(page, 1800);
  await scrub([{ to: null, ms: 1400 }, { to: 900, ms: 3400 }, { to: null, ms: 900 }]);
});

await record(browser, "m06_apps", MOBILE, async ({ page, scrub }) => {
  await page.goto(BASE + "/apps");
  await settle(page, 2500);
  await scrub([{ to: null, ms: 2200 }, { to: 800, ms: 2800 }, { to: null, ms: 900 }]);
});

await browser.close();
console.log("\nГотово. Кадры лежат в promo/raw — теперь можно монтировать.");
