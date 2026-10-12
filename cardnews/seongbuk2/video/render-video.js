// 카드뉴스(../index.html)를 유튜브 영상으로 만든다.
//   node render-video.js            → 가로 16:9 본편 + 세로 9:16 쇼츠 + 썸네일
//   node render-video.js wide       → 본편만 (short, thumb 도 따로 가능)
// 폰트(Pretendard)는 jsDelivr 에서 받는다. 막힌 환경이면 woff2 폴더를 FONT_DIR 로 넘긴다.
// 프레임은 FRAME_DIR(기본: ./frames)에 쌓이고, 배경음악은 bgm.py 로 합성한다.
const path = require("path");
const fs = require("fs");
const { execFileSync } = require("child_process");
const { chromium } = require("playwright");

const FPS = 30;
const XFADE = 0.6; // 장과 장 사이 겹쳐 넘기는 시간 (video.js 의 LEAD 와 같게)
const DIR = __dirname;
const FRAMES = process.env.FRAME_DIR || path.join(DIR, "frames");
const SIZE = { wide: [1920, 1080], short: [1080, 1920] };
const OUT = { wide: "seongbuk2-youtube.mp4", short: "seongbuk2-shorts.mp4" };

async function openPage(browser, w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  if (process.env.FONT_DIR) {
    await page.route("**/pretendard@*/**/*.woff2", route => {
      const file = path.join(process.env.FONT_DIR, path.basename(new URL(route.request().url()).pathname));
      route.fulfill({ status: 200, contentType: "font/woff2", body: fs.readFileSync(file) });
    });
  }
  await page.goto("file://" + path.join(DIR, "..", "index.html"));
  await page.addStyleTag({ path: path.join(DIR, "video.css") });
  await page.addScriptTag({ path: path.join(DIR, "video.js") });
  const failed = await page.evaluate(async () => {
    const res = await Promise.allSettled([...document.fonts].map(f => f.load()));
    return res.filter(r => r.status === "rejected").length;
  });
  if (failed) throw new Error(`폰트 ${failed}개가 로드되지 않았다`);
  return page;
}

async function captureFrames(browser, mode) {
  const [w, h] = SIZE[mode];
  const page = await openPage(browser, w, h);
  const plan = await page.evaluate(m => window.__setup(m), mode);
  for (const card of plan) {
    const dir = path.join(FRAMES, mode, card.id);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    await page.evaluate(id => window.__show(id), card.id);
    card.frames = Math.ceil(card.anim * FPS);
    for (let f = 0; f < card.frames; f++) {
      await page.evaluate(([id, t]) => window.__seek(id, t), [card.id, f / FPS]);
      await page.screenshot({ path: path.join(dir, String(f).padStart(4, "0") + ".png"), clip: { x: 0, y: 0, width: w, height: h } });
    }
    console.log(`${mode} ${card.id}: ${card.frames}프레임 + ${(card.hold - card.frames / FPS).toFixed(1)}초 정지`);
  }
  await page.close();
  return plan;
}

function assemble(mode, plan) {
  const [w] = SIZE[mode];
  const total = plan.reduce((s, c) => s + c.hold, 0) - XFADE * (plan.length - 1);
  const bgm = path.join(FRAMES, `bgm-${mode}.wav`);
  execFileSync("python3", ["-I", path.join(DIR, "bgm.py"), String(total + 1), bgm], { stdio: "inherit" });

  const args = ["-y", "-hide_banner", "-loglevel", "error"];
  for (const c of plan) args.push("-framerate", String(FPS), "-i", path.join(FRAMES, mode, c.id, "%04d.png"));
  args.push("-i", bgm);

  const f = [];
  plan.forEach((c, i) => {
    f.push(`[${i}:v]tpad=stop_mode=clone:stop_duration=${(c.hold - c.frames / FPS).toFixed(3)},setsar=1,format=yuv420p,settb=AVTB[v${i}]`);
  });
  let prev = "v0", offset = 0;
  for (let i = 1; i < plan.length; i++) {
    offset += plan[i - 1].hold - XFADE;
    f.push(`[${prev}][v${i}]xfade=transition=fade:duration=${XFADE}:offset=${offset.toFixed(3)}[x${i}]`);
    prev = `x${i}`;
  }
  f.push(`[${prev}]fade=t=out:st=${(total - 1).toFixed(3)}:d=1[vf]`);
  if (mode === "wide") {
    f.push(`color=c=0xD9452B:s=${w}x6:r=${FPS}:d=${total.toFixed(3)}[pb]`);
    f.push(`[vf][pb]overlay=x='-w+w*t/${total.toFixed(3)}':y=H-h:shortest=1[v]`);
  } else {
    f.push(`[vf]null[v]`);
  }
  f.push(`[${plan.length}:a]atrim=0:${total.toFixed(3)},afade=t=in:d=2,afade=t=out:st=${(total - 3).toFixed(3)}:d=3[a]`);

  const out = path.join(DIR, OUT[mode]);
  args.push("-filter_complex", f.join(";"), "-map", "[v]", "-map", "[a]",
    "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-tune", "stillimage", "-pix_fmt", "yuv420p", "-r", String(FPS),
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", out);
  execFileSync("ffmpeg", args, { stdio: "inherit" });

  // 유튜브 챕터용 시작 시각
  let t = 0;
  const chapters = plan.map((c, i) => { const s = t; t += c.hold - XFADE; return { id: c.id, start: i ? s + XFADE / 2 : 0 }; });
  fs.writeFileSync(path.join(FRAMES, `chapters-${mode}.json`), JSON.stringify({ total, chapters }, null, 2));
  console.log(`${path.relative(process.cwd(), out)} (${total.toFixed(1)}초)`);
}

async function thumbnail(browser) {
  const page = await openPage(browser, 1280, 720);
  await page.evaluate(() => window.__thumb());
  await page.evaluate(async () => { await Promise.all([...document.fonts].map(f => f.load())); });
  const out = path.join(DIR, "thumbnail.png");
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1280, height: 720 } });
  await page.close();
  console.log(path.relative(process.cwd(), out));
}

(async () => {
  const which = process.argv.slice(2);
  const want = m => !which.length || which.includes(m);
  const browser = await chromium.launch();
  for (const mode of ["wide", "short"]) {
    if (!want(mode)) continue;
    const plan = await captureFrames(browser, mode);
    assemble(mode, plan);
  }
  if (want("thumb")) await thumbnail(browser);
  await browser.close();
})();
