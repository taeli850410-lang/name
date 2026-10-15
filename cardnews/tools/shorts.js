// 9:16(1080×1920) 카드뉴스를 유튜브 쇼츠 영상으로 만든다.
//   node shorts.js ../macheon3 [음악 시드]
// 카드마다 anim.js 로 등장 애니메이션을 프레임 단위로 찍고, 마지막 프레임은 data-hold 까지 멈춰 둔다.
// 장 사이는 0.5초 겹쳐 넘기고, 배경음악은 bgm.py 로 합성한다. 결과는 <폴더>/<폴더이름>-shorts.mp4.
// 프레임은 FRAME_DIR(기본: <폴더>/frames)에 쌓인다.
const path = require("path");
const fs = require("fs");
const { execFileSync } = require("child_process");
const { chromium } = require("playwright");
const { openDeck } = require("./cards");

const FPS = 30;
const XFADE = 0.5; // anim.js 의 LEAD 와 같게
const [W, H] = [1080, 1920];

(async () => {
  const dir = path.resolve(process.argv[2] || ".");
  const seed = process.argv[3] || "2026";
  const name = path.basename(dir);
  const frames = path.join(process.env.FRAME_DIR || path.join(dir, "frames"), name);

  const browser = await chromium.launch();
  const page = await openDeck(browser, dir, { width: W, height: H });
  await page.addScriptTag({ path: path.join(__dirname, "anim.js") });
  const plan = await page.evaluate(() => window.__setup());

  for (const card of plan) {
    const out = path.join(frames, card.id);
    fs.rmSync(out, { recursive: true, force: true });
    fs.mkdirSync(out, { recursive: true });
    await page.evaluate(id => window.__show(id), card.id);
    card.frames = Math.ceil(card.anim * FPS);
    if (card.frames / FPS > card.hold) throw new Error(`${card.id}: 애니메이션(${card.anim.toFixed(1)}초)이 머무는 시간보다 길다`);
    for (let f = 0; f < card.frames; f++) {
      await page.evaluate(([id, t]) => window.__seek(id, t), [card.id, f / FPS]);
      await page.screenshot({ path: path.join(out, String(f).padStart(4, "0") + ".png"), clip: { x: 0, y: 0, width: W, height: H } });
    }
    console.log(`${card.id}: ${card.frames}프레임 + ${(card.hold - card.frames / FPS).toFixed(1)}초 정지`);
  }
  await browser.close();

  const total = plan.reduce((s, c) => s + c.hold, 0) - XFADE * (plan.length - 1);
  const bgm = path.join(frames, "bgm.wav");
  execFileSync("python3", ["-I", path.join(__dirname, "bgm.py"), String(total + 1), bgm, seed], { stdio: "inherit" });

  const args = ["-y", "-hide_banner", "-loglevel", "error"];
  for (const c of plan) args.push("-framerate", String(FPS), "-i", path.join(frames, c.id, "%04d.png"));
  args.push("-i", bgm);
  const f = plan.map((c, i) =>
    `[${i}:v]tpad=stop_mode=clone:stop_duration=${(c.hold - c.frames / FPS).toFixed(3)},setsar=1,format=yuv420p,settb=AVTB[v${i}]`);
  let prev = "v0", offset = 0;
  for (let i = 1; i < plan.length; i++) {
    offset += plan[i - 1].hold - XFADE;
    f.push(`[${prev}][v${i}]xfade=transition=fade:duration=${XFADE}:offset=${offset.toFixed(3)}[x${i}]`);
    prev = `x${i}`;
  }
  f.push(`[${prev}]fade=t=out:st=${(total - 0.8).toFixed(3)}:d=0.8[v]`);
  f.push(`[${plan.length}:a]atrim=0:${total.toFixed(3)},afade=t=in:d=1.5,afade=t=out:st=${(total - 2.5).toFixed(3)}:d=2.5[a]`);

  const out = path.join(dir, `${name}-shorts.mp4`);
  args.push("-filter_complex", f.join(";"), "-map", "[v]", "-map", "[a]",
    "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-tune", "stillimage", "-pix_fmt", "yuv420p", "-r", String(FPS),
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", out);
  execFileSync("ffmpeg", args, { stdio: "inherit" });
  console.log(`${path.relative(process.cwd(), out)} (${total.toFixed(1)}초)`);
})();
