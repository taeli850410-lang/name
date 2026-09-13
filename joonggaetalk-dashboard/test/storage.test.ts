/**
 * 첨부 파일 규칙 테스트.
 *   npm test
 */
import assert from "node:assert/strict";
import {
  contentDisposition,
  extMatches,
  extOf,
  FILE_KINDS,
  formatBytes,
  KIND_RULES,
  retentionState,
  retentionUntil,
  safeName,
  sniff,
  storageKey,
  validateUpload,
} from "../src/lib/storage.ts";
import { amzDates, presign, readConfig, uriEncode } from "../src/lib/s3sign.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

/** 형식별 첫 바이트만 흉내 낸 것 */
const HEAD = {
  pdf: Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]),
  jpg: Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
  png: Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  webp: Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]),
  zip: Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]),
  exe: Uint8Array.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]), // MZ — 윈도 실행 파일
};

console.log("\n첨부 파일 규칙");

test("확장자를 뽑는다", () => {
  assert.equal(extOf("계약서.pdf"), "pdf");
  assert.equal(extOf("사진.JPG"), "jpg", "대문자도 같게 본다");
  assert.equal(extOf("a/b/c.png"), "png");
  assert.equal(extOf("확장자없음"), "");
  assert.equal(extOf("끝이점."), "", "점으로 끝나면 확장자가 아니다");
  assert.equal(extOf(".gitignore"), "", "숨김 파일은 이름이지 확장자가 아니다");
});

test("매직 바이트로 실제 형식을 본다", () => {
  assert.equal(sniff(HEAD.pdf), "pdf");
  assert.equal(sniff(HEAD.jpg), "jpg");
  assert.equal(sniff(HEAD.png), "png");
  assert.equal(sniff(HEAD.webp), "webp");
  assert.equal(sniff(HEAD.zip), "zip");
  assert.equal(sniff(HEAD.exe), null, "실행 파일은 아는 형식이 아니다");
  assert.equal(sniff(Uint8Array.from([])), null);
  assert.equal(sniff(Uint8Array.from([0x25, 0x50])), null, "앞부분만 왔으면 단정하지 않는다");
});

test("확장자만 바꾼 파일을 막는다", () => {
  // 실제로 일어나는 일: 실행 파일을 계약서.pdf 로 이름만 바꿔 올린다
  const r = validateUpload("계약서.pdf", 1000, "계약서", HEAD.exe);
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.code, "UNKNOWN_TYPE");

  // 내용은 PNG 인데 이름만 pdf
  const r2 = validateUpload("계약서.pdf", 1000, "계약서", HEAD.png);
  assert.equal(r2.ok, false);
  assert.equal(r2.ok === false && r2.code, "CONTENT");
  assert.match(r2.ok === false ? r2.why : "", /PNG/);

  // 제대로 된 것은 통과
  assert.equal(validateUpload("계약서.pdf", 1000, "계약서", HEAD.pdf).ok, true);
  assert.equal(validateUpload("신분증.jpeg", 1000, "신분증", HEAD.jpg).ok, true, "jpg 와 jpeg 는 같은 형식이다");
});

test("종류마다 받는 형식이 다르다", () => {
  // 등기부등본은 PDF 만 — 사진으로 찍은 등기부는 원본으로 쓸 수 없다
  assert.equal(validateUpload("등기부.jpg", 1000, "등기부등본", HEAD.jpg).ok, false);
  assert.equal(validateUpload("등기부.pdf", 1000, "등기부등본", HEAD.pdf).ok, true);
  // 물건사진에 PDF 를 올리지 않는다
  assert.equal(validateUpload("사진.pdf", 1000, "물건사진", HEAD.pdf).ok, false);
  assert.equal(validateUpload("사진.webp", 1000, "물건사진", HEAD.webp).ok, true);
  // hwpx·docx 는 zip 이라 내용 검사를 통과해야 한다
  assert.equal(validateUpload("양식.hwpx", 1000, "기타", HEAD.zip).ok, true);
  assert.equal(extMatches("docx", "zip"), true);
  assert.equal(extMatches("pdf", "zip"), false);
});

test("크기와 빈 파일을 막는다", () => {
  const big = validateUpload("계약서.pdf", 21 * 1024 * 1024, "계약서", HEAD.pdf);
  assert.equal(big.ok, false);
  assert.equal(big.ok === false && big.code, "SIZE");
  assert.match(big.ok === false ? big.why : "", /20MB/);

  assert.equal(validateUpload("계약서.pdf", 0, "계약서").ok, false);
  assert.equal(validateUpload("확장자없음", 100, "계약서").ok, false);
  // 내용을 못 읽었으면 이름·크기까지만 보고 통과시킨다 (서버가 다시 본다)
  assert.equal(validateUpload("계약서.pdf", 1000, "계약서").ok, true);
});

test("경로 조작을 막는다", () => {
  assert.equal(safeName("../../etc/passwd"), "passwd");
  assert.equal(safeName("C:\\Windows\\system32\\x.dll"), "x.dll");
  assert.equal(safeName("....//계약서.pdf"), "계약서.pdf");
  assert.equal(safeName("계약서.pdf"), "계약서.pdf", "한글 이름은 그대로 둔다");
  assert.equal(safeName(""), "파일");
  assert.equal(safeName("   "), "파일");
  assert.equal(safeName("a?b*c.pdf"), "a_b_c.pdf");
});

test("저장 경로에 파일 이름을 쓰지 않는다", () => {
  // 주소만 새어도 내용을 짐작하게 하면 안 된다
  const key = storageKey("deals", "d1", "Xk9fQ2mB7pLr", "김민수_주민등록증.jpg");
  assert.equal(key, "deals/d1/Xk9fQ2mB7pLr.jpg");
  assert.equal(key.includes("주민등록증"), false, "경로에 내용이 드러나면 안 된다");
  assert.equal(key.includes("김민수"), false);
  // 토큰·소유자에 경로 문자가 섞여도 빠져나가지 못한다
  assert.equal(storageKey("deals/../x", "../d1", "../../tok", "a.pdf"), "dealsx/d1/tok.pdf");
});

test("보존기간은 종류가 정한다", () => {
  // 거래계약서 5년 · 확인설명서 3년 (공인중개사법)
  assert.equal(retentionUntil("계약서", "2026-09-12"), "2031-09-12");
  assert.equal(retentionUntil("확인설명서", "2026-09-12"), "2029-09-12");
  assert.equal(retentionUntil("등기부등본", "2026-09-12"), "2029-09-12");
  // 신분증은 석 달만
  assert.equal(retentionUntil("신분증", "2026-09-12"), "2026-12-12");
  // 물건 사진은 보존 의무가 없다
  assert.equal(retentionUntil("물건사진", "2026-09-12"), null);
  // 없는 날짜는 말일로 당긴다
  assert.equal(retentionUntil("신분증", "2026-11-30"), "2027-02-28");
  assert.equal(retentionUntil("신분증", "2027-11-30"), "2028-02-29", "윤년");
});

test("보존기간이 지난 파일을 파기 대상으로 집어낸다", () => {
  // 쌓아 두는 것 자체가 위반이라, 지났는지를 화면이 알아야 한다
  assert.equal(retentionState("신분증", "2026-06-12", "2026-09-12"), "보존 중");
  assert.equal(retentionState("신분증", "2026-06-11", "2026-09-12"), "파기 대상");
  assert.equal(retentionState("신분증", "2026-06-12", "2026-09-13"), "파기 대상", "기한 당일까지는 보존");
  assert.equal(retentionState("계약서", "2022-01-01", "2026-09-12"), "보존 중", "5년은 아직 안 지났다");
  assert.equal(retentionState("계약서", "2021-01-01", "2026-09-12"), "파기 대상");
  assert.equal(retentionState("물건사진", "2020-01-01", "2026-09-12"), "보존 의무 없음");
  // 시각이 붙어 있어도 날짜만 본다
  assert.equal(retentionState("신분증", "2026-06-12 14:30", "2026-09-12"), "보존 중");
});

test("계약서는 공개 주소에 두지 않는다", () => {
  assert.equal(KIND_RULES.계약서.open, false);
  assert.equal(KIND_RULES.확인설명서.open, false);
  assert.equal(KIND_RULES.등기부등본.open, false);
  assert.equal(KIND_RULES.신분증.open, false);
  // 광고에 쓰라고 올리는 사진만 공개다
  assert.equal(KIND_RULES.물건사진.open, true);
  // 신분증에는 경고가 붙어 있어야 한다
  assert.ok(KIND_RULES.신분증.warn, "신분증은 그냥 받으면 안 된다");
  for (const k of FILE_KINDS) {
    assert.ok(KIND_RULES[k].basis, `${k} 에 보존 근거 설명이 없다`);
    assert.ok(KIND_RULES[k].accept.length > 0);
    assert.ok(KIND_RULES[k].maxBytes > 0);
  }
});

test("한글 파일 이름이 깨지지 않게 내려준다", () => {
  const cd = contentDisposition("전세계약서 사본.pdf");
  assert.match(cd, /filename\*=UTF-8''/);
  assert.match(cd, /filename="[^"]*\.pdf"/, "옛 브라우저용 이름도 있어야 한다");
  assert.equal(cd.includes("전세계약서"), false, 'filename= 쪽에는 아스키만 넣는다');
  assert.ok(decodeURIComponent(cd.split("UTF-8''")[1]).includes("전세계약서"));
  // 따옴표로 헤더를 깨뜨리지 못한다
  assert.equal(contentDisposition('a"b.pdf').includes('"a'), true);
  assert.equal(contentDisposition('a"b.pdf').split('filename="')[1].split('"')[0].includes('"'), false);
});

test("크기를 사람이 읽는 단위로", () => {
  assert.equal(formatBytes(512), "512B");
  assert.equal(formatBytes(2048), "2KB");
  assert.equal(formatBytes(1024 * 1024), "1MB");
  assert.equal(formatBytes(1.5 * 1024 * 1024), "1.5MB");
  assert.equal(formatBytes(20 * 1024 * 1024), "20MB");
});


console.log("\n저장소 주소 서명");

const CFG = {
  endpoint: "https://acct.r2.cloudflarestorage.com",
  region: "auto",
  bucket: "budongsantalk",
  accessKeyId: "AKIAEXAMPLE",
  secretAccessKey: "secret-example-key",
};
const WHEN = new Date("2026-09-12T01:23:45.000Z");

test("서명은 같은 입력에 늘 같은 값을 낸다", () => {
  const a = presign(CFG, "PUT", "deals/d1/tok.pdf", 600, WHEN);
  assert.equal(a, presign(CFG, "PUT", "deals/d1/tok.pdf", 600, WHEN));
  assert.match(a, /^https:\/\/acct\.r2\.cloudflarestorage\.com\/budongsantalk\/deals\/d1\/tok\.pdf\?/);
  assert.match(a, /X-Amz-Algorithm=AWS4-HMAC-SHA256/);
  assert.match(a, /X-Amz-Expires=600/);
  assert.match(a, /X-Amz-Signature=[0-9a-f]{64}$/, "서명은 끝에 64자리 16진수로 붙는다");
});

test("무엇 하나만 달라져도 서명이 달라진다", () => {
  const base = presign(CFG, "PUT", "deals/d1/tok.pdf", 600, WHEN);
  const sig = (u: string) => u.split("X-Amz-Signature=")[1];
  assert.notEqual(sig(base), sig(presign(CFG, "GET", "deals/d1/tok.pdf", 600, WHEN)), "메서드");
  assert.notEqual(sig(base), sig(presign(CFG, "PUT", "deals/d1/other.pdf", 600, WHEN)), "키");
  assert.notEqual(sig(base), sig(presign(CFG, "PUT", "deals/d1/tok.pdf", 601, WHEN)), "만료");
  assert.notEqual(sig(base), sig(presign(CFG, "PUT", "deals/d1/tok.pdf", 600, new Date("2026-09-12T01:23:46.000Z"))), "시각");
  assert.notEqual(sig(base), sig(presign({ ...CFG, secretAccessKey: "other" }, "PUT", "deals/d1/tok.pdf", 600, WHEN)), "비밀키");
  assert.notEqual(sig(base), sig(presign({ ...CFG, bucket: "other" }, "PUT", "deals/d1/tok.pdf", 600, WHEN)), "버킷");
});

test("쿼리는 이름 순으로 정렬해 서명한다", () => {
  // 순서가 어긋나면 저장소가 서명을 거절한다
  const u = new URL(presign(CFG, "GET", "a.pdf", 60, WHEN));
  const names = [...u.searchParams.keys()].filter((k) => k !== "X-Amz-Signature");
  assert.deepEqual(names, [...names].sort(), "정렬돼 있어야 한다");
  assert.deepEqual(names, ["X-Amz-Algorithm", "X-Amz-Credential", "X-Amz-Date", "X-Amz-Expires", "X-Amz-SignedHeaders"]);
});

test("RFC 3986 으로 인코딩한다", () => {
  // encodeURIComponent 가 남겨 두는 문자들까지 인코딩해야 서명이 맞는다
  assert.equal(uriEncode("a!b'c(d)e*f"), "a%21b%27c%28d%29e%2Af");
  assert.equal(uriEncode("a b"), "a%20b", "공백은 + 가 아니라 %20");
  assert.equal(uriEncode("a/b"), "a%2Fb");
  assert.equal(uriEncode("a/b", true), "a/b", "경로에서는 슬래시를 남긴다");
  assert.equal(uriEncode("가"), "%EA%B0%80", "한글은 UTF-8 바이트로");
  assert.equal(uriEncode("-_.~"), "-_.~", "이 넷은 그대로 둔다");
});

test("서명 시각 형식", () => {
  const { amzDate, stamp } = amzDates(WHEN);
  assert.equal(amzDate, "20260912T012345Z");
  assert.equal(stamp, "20260912");
});

test("설정이 하나라도 비면 저장소를 끈 것으로 본다", () => {
  assert.equal(readConfig({}), null);
  assert.equal(readConfig({ S3_ENDPOINT: "https://x", S3_BUCKET: "b", S3_ACCESS_KEY_ID: "k" }), null, "비밀키가 없다");
  assert.equal(readConfig({ S3_ENDPOINT: "https://x", S3_BUCKET: "b", S3_ACCESS_KEY_ID: "k", S3_SECRET_ACCESS_KEY: "   " }), null, "공백만 있는 것도 없는 것");
  const ok = readConfig({ S3_ENDPOINT: "https://x", S3_BUCKET: "b", S3_ACCESS_KEY_ID: "k", S3_SECRET_ACCESS_KEY: "s" });
  assert.equal(ok?.region, "auto", "지역을 안 적으면 auto (R2 기본)");
});

console.log(`\n${passed}개 통과`);
