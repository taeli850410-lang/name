/*
 * Vercel 빌드 부트스트랩
 * ---------------------------------------------------------------
 * 소스 파일을 통째로 올리지 않고, 공개 GitHub 저장소의 브랜치에서
 * 앱 소스(joonggaetalk-dashboard/)를 받아 온 뒤 `next build` 합니다.
 * 같은 부트스트랩을 다시 배포하면 그 시점의 브랜치 최신 커밋이 빌드됩니다.
 *
 * 환경 변수로 바꿀 수 있습니다: SOURCE_REPO, SOURCE_BRANCH, SOURCE_DIR
 */
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO = process.env.SOURCE_REPO || "taeli850410-lang/name";
const BRANCH = process.env.SOURCE_BRANCH || "claude/modest-bohr-bhbc4b";
const SUBDIR = process.env.SOURCE_DIR || "joonggaetalk-dashboard";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "jt-src-"));
const url = `https://codeload.github.com/${REPO}/tar.gz/refs/heads/${BRANCH}`;
console.log(`[bootstrap] fetching ${url}`);
execSync(`curl -fsSL "${url}" | tar xz -C "${tmp}"`, { stdio: "inherit" });

const root = fs
  .readdirSync(tmp)
  .map((d) => path.join(tmp, d))
  .find((d) => fs.statSync(d).isDirectory());
if (!root) throw new Error("[bootstrap] archive is empty");
const appDir = path.join(root, SUBDIR);
if (!fs.existsSync(appDir)) throw new Error(`[bootstrap] ${SUBDIR} not found in ${BRANCH}`);

for (const entry of ["src", "public", "tsconfig.json", "next.config.ts", "next-env.d.ts"]) {
  const from = path.join(appDir, entry);
  if (!fs.existsSync(from)) continue;
  const to = path.join(process.cwd(), entry);
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
  console.log(`[bootstrap] copied ${entry}`);
}
console.log("[bootstrap] source ready");
