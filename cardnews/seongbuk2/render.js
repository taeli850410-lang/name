// index.html 의 카드(.card)를 한 장씩 1080×1350 PNG 로 찍는다.
//   node render.js
// 폰트(Pretendard)는 jsDelivr 에서 받는다. 막힌 환경이면 woff2 가 든 폴더를 FONT_DIR 로 넘긴다.
//   FONT_DIR=/path/to/woff2 node render.js
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

(async () => {
  const dir = __dirname;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 1500 }, deviceScaleFactor: 1 });

  if (process.env.FONT_DIR) {
    await page.route("**/pretendard@*/**/*.woff2", route => {
      const file = path.join(process.env.FONT_DIR, path.basename(new URL(route.request().url()).pathname));
      route.fulfill({ status: 200, contentType: "font/woff2", body: fs.readFileSync(file) });
    });
  }

  await page.goto("file://" + path.join(dir, "index.html"));
  const failed = await page.evaluate(async () => {
    const res = await Promise.allSettled([...document.fonts].map(f => f.load()));
    return res.filter(r => r.status === "rejected").length;
  });
  if (failed) throw new Error(`폰트 ${failed}개가 로드되지 않았다`);

  const cards = await page.$$(".card");
  for (const card of cards) {
    const id = await card.getAttribute("id");
    const out = path.join(dir, `card-${id.slice(1)}.png`);
    await card.screenshot({ path: out });
    console.log(path.relative(process.cwd(), out));
  }
  await browser.close();
})();
