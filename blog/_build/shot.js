// 미리보기 페이지를 데스크톱·모바일 폭으로 찍고, 가로 넘침과 소제목 id 를 확인한다.
// 사용법: NODE_PATH=$(npm root -g) node shot.js <페이지.html> <출력 폴더>
const { chromium } = require('playwright');
(async () => {
  const [file, outDir] = process.argv.slice(2);
  const browser = await chromium.launch();
  for (const [name, vp] of [['desk', { width: 1100, height: 900 }], ['mob', { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport: vp });
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => m.type() === 'error' && errs.push(m.text()));
    await page.goto('file://' + file);
    await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const ids = await page.evaluate(() => [...document.querySelectorAll('#preview h2[id]')].map(h => h.id).join(','));
    console.log(name, 'overflow', overflow, 'h2 ids', ids, 'errors', errs);
  }
  await browser.close();
})();
