// 4:5 카드뉴스를 16:9(1920×1080) 유튜브 본편으로 만든다.
//   node youtube.js ../macheon3-total [음악 시드]
//   PREVIEW=1 node youtube.js ../macheon3-total   → 장마다 다 올라온 화면만 PNG 로 (FRAME_DIR/<폴더>/preview)
// 카드뉴스 HTML 의 body.wide 스타일을 켜고, .body 안에서 class "L" 인 요소는 왼쪽 단, 나머지는 오른쪽 단으로 옮긴다.
// 등장 애니메이션은 anim.js, 배경음악은 bgm.py. 결과는 <폴더>/<폴더이름>-youtube.mp4 와 chapters.txt.
const path = require("path");
const fs = require("fs");
const { execFileSync } = require("child_process");
const { chromium } = require("playwright");
const { openDeck } = require("./cards");

const FPS = 30;
const XFADE = 0.5; // anim.js 의 LEAD 와 같게
const [W, H] = [1920, 1080];

const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

(async () => {
  const dir = path.resolve(process.argv[2] || ".");
  const seed = process.argv[3] || "2026";
  const name = path.basename(dir);
  const frames = path.join(process.env.FRAME_DIR || path.join(dir, "frames"), `${name}-wide`);

  const browser = await chromium.launch();
  const page = await openDeck(browser, dir, { width: W, height: H });
  await page.addScriptTag({ path: path.join(__dirname, "anim.js") });
  await page.evaluate(() => {
    document.body.classList.add("wide");
    for (const body of document.querySelectorAll(".card .body")) {
      const L = document.createElement("div"); L.className = "colL";
      const R = document.createElement("div"); R.className = "colR";
      for (const el of [...body.children]) (el.classList.contains("L") ? L : R).appendChild(el);
      body.append(L, R);
    }
  });
  const plan = await page.evaluate(() => window.__setup());
  const chapters = await page.evaluate(() => [...document.querySelectorAll(".card")].map(c => c.dataset.chapter || c.id));

  if (process.env.PREVIEW) {
    const out = path.join(frames, "preview");
    fs.mkdirSync(out, { recursive: true });
    for (const card of plan) {
      await page.evaluate(id => window.__show(id), card.id);
      await page.evaluate(id => window.__seek(id, 999), card.id);
      await page.screenshot({ path: path.join(out, `${card.id}.png`), clip: { x: 0, y: 0, width: W, height: H } });
    }
    console.log(out);
    await browser.close();
    return;
  }

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
  f.push(`[${prev}]fade=t=out:st=${(total - 1).toFixed(3)}:d=1[vf]`);
  // 아래쪽 진행 막대
  f.push(`color=c=0xD9452B:s=${W}x6:r=${FPS}:d=${total.toFixed(3)}[pb]`);
  f.push(`[vf][pb]overlay=x='-w+w*t/${total.toFixed(3)}':y=H-h:shortest=1[v]`);
  f.push(`[${plan.length}:a]atrim=0:${total.toFixed(3)},afade=t=in:d=2,afade=t=out:st=${(total - 3).toFixed(3)}:d=3[a]`);

  const out = path.join(dir, `${name}-youtube.mp4`);
  args.push("-filter_complex", f.join(";"), "-map", "[v]", "-map", "[a]",
    "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-tune", "stillimage", "-pix_fmt", "yuv420p", "-r", String(FPS),
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", out);
  execFileSync("ffmpeg", args, { stdio: "inherit" });

  // 유튜브 챕터: 첫 줄은 0:00, 다음 장은 겹쳐 넘어가는 중간 지점부터.
  // 유튜브는 한 챕터가 10초 이상이어야 챕터로 인정하므로, 그보다 짧은 장은 다음 장과 한 챕터로 묶는다.
  let t = 0;
  const marks = plan.map((c, i) => {
    const start = i ? t + XFADE / 2 : 0;
    t += c.hold - XFADE;
    return { start, title: chapters[i] };
  });
  const kept = [];
  marks.forEach((m, i) => {
    const prev = kept[kept.length - 1];
    if (prev && m.start - prev.start < 10) return;
    const next = marks[i + 1];
    if (next && next.start - m.start < 10 && i > 0) return;
    kept.push(m);
  });
  const lines = kept.map(m => `${mmss(m.start)} ${m.title}`);
  fs.writeFileSync(path.join(dir, "chapters.txt"), lines.join("\n") + "\n");
  console.log(`${path.relative(process.cwd(), out)} (${mmss(total)})`);
})();
