// 카드뉴스 폴더의 index.html 에서 카드(.card)를 한 장씩 PNG 로 찍는다. 크기는 카드 크기 그대로.
// 유튜브 썸네일(.thumb)이 있으면 thumbnail.png 로 함께 찍는다.
//   node cards.js ../macheon3
// 폰트(Pretendard)는 jsDelivr 에서 받는다. 막힌 환경이면 woff2 폴더를 FONT_DIR 로 넘긴다.
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

async function openDeck(browser, dir, viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  if (process.env.FONT_DIR) {
    await page.route("**/pretendard@*/**/*.woff2", route => {
      const file = path.join(process.env.FONT_DIR, path.basename(new URL(route.request().url()).pathname));
      route.fulfill({ status: 200, contentType: "font/woff2", body: fs.readFileSync(file) });
    });
  }
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("file://" + path.join(dir, "index.html"));
  const failed = await page.evaluate(async () => {
    const res = await Promise.allSettled([...document.fonts].map(f => f.load()));
    return res.filter(r => r.status === "rejected").length;
  });
  if (failed) throw new Error(`폰트 ${failed}개가 로드되지 않았다`);
  if (errors.length) throw new Error(errors.join("\n"));
  return page;
}

module.exports = { openDeck };

if (require.main === module) {
  (async () => {
    const dir = path.resolve(process.argv[2] || ".");
    const browser = await chromium.launch();
    const page = await openDeck(browser, dir, { width: 1400, height: 2000 });
    for (const card of await page.$$(".card")) {
      const out = path.join(dir, `card-${(await card.getAttribute("id")).slice(1)}.png`);
      await card.screenshot({ path: out });
      console.log(path.relative(process.cwd(), out));
    }
    const thumb = await page.$(".thumb");
    if (thumb) {
      const out = path.join(dir, "thumbnail.png");
      await thumb.screenshot({ path: out });
      console.log(path.relative(process.cwd(), out));
    }
    await browser.close();
  })();
}
