/**
 * 대체발송(문자) 계산 테스트.
 *   npm test
 */
import assert from "node:assert/strict";
import { FAIL_REASONS, type FailCode } from "../src/data/sends.ts";
import { templates } from "../src/data/templates.ts";
import {
  estimateFallback,
  fromAlimtalk,
  headroom,
  isOverLimit,
  LMS_LIMIT,
  missingVars,
  renderVars,
  SMS_LIMIT,
  smsBytes,
  smsCost,
  smsKind,
  unsupportedChars,
  usedVars,
} from "../src/lib/sms.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

console.log("\n대체발송 계산");

test("한글은 두 바이트로 센다", () => {
  assert.equal(smsBytes("가"), 2);
  assert.equal(smsBytes("a"), 1);
  assert.equal(smsBytes("010-1234-5678"), 13);
  // SMS 한도 90바이트 = 한글 45자. 글자 수로 세면 두 배로 틀린다.
  assert.equal(smsBytes("가".repeat(45)), SMS_LIMIT);
  assert.equal(smsKind("가".repeat(45)), "SMS");
  assert.equal(smsKind("가".repeat(46)), "LMS");
});

test("줄바꿈도 한 바이트를 먹는다", () => {
  assert.equal(smsBytes("가\n나"), 5);
  assert.equal(headroom("가".repeat(44) + "\n"), 1);
});

test("이모지는 바이트가 아니라 못 쓰는 글자로 걸러 낸다", () => {
  // EUC-KR 에 없어서 깨지거나 MMS 로 바뀐다 — 길이 문제가 아니다
  assert.deepEqual(unsupportedChars("계약일 안내 🏠"), ["🏠"]);
  assert.deepEqual(unsupportedChars("계약일 안내입니다."), []);
  assert.deepEqual(unsupportedChars("★ 확인 ★ ※ ♥ ☎"), [], "이 기호들은 EUC-KR 에 있다 — 여기 경고가 뜨면 경고를 안 믿게 된다");
  assert.deepEqual(unsupportedChars("👍"), ["👍"]);
});

test("LMS 한도를 넘으면 보낼 수 없다고 본다", () => {
  assert.equal(isOverLimit("가".repeat(1000)), false);
  assert.equal(smsBytes("가".repeat(1000)), LMS_LIMIT);
  assert.equal(isOverLimit("가".repeat(1001)), true);
});

test("알림톡 본문에서 초안을 만들 때 상호를 앞에 붙인다", () => {
  // 알림톡은 말풍선 머리에 채널명이 뜨지만 문자에는 없다.
  // 안 붙이면 고객에게는 모르는 번호에서 온 문자가 된다.
  const d = fromAlimtalk("#{고객명}님, 계약일 안내입니다.", { sender: "서연공인중개사사무소" });
  assert.equal(d.text, "[서연공인중개사사무소]\n#{고객명}님, 계약일 안내입니다.");
});

test("주소를 아는 버튼만 링크로 풀고 나머지는 돌려준다", () => {
  const d = fromAlimtalk("계약일 안내입니다.", {
    sender: "서연",
    buttons: ["오시는길", "전화하기"],
    links: { 오시는길: "https://naver.me/x" },
  });
  assert.match(d.text, /오시는길: https:\/\/naver\.me\/x/);
  assert.deepEqual(d.droppedButtons, ["전화하기"], "옮기지 못한 버튼은 화면에서 알려야 한다");
});

test("링크를 풀면 SMS 한도를 넘길 수 있다", () => {
  const body = "#{고객명}님, 계약일 안내입니다. 준비물을 확인해 주세요.";
  const bare = fromAlimtalk(body, { sender: "서연공인중개사사무소" });
  const withLink = fromAlimtalk(body, { sender: "서연공인중개사사무소", buttons: ["오시는길"], links: { 오시는길: "https://map.naver.com/p/entry/place/1234567890" } });
  assert.equal(smsKind(bare.text), "SMS");
  assert.equal(smsKind(withLink.text), "LMS", "URL 한 줄이 단가를 2.5배로 올린다");
});

test("채워지지 않은 변수를 집어낸다", () => {
  // 알림톡은 카카오 검수가 변수를 봐 주지만 문자는 아무도 안 봐 준다
  const body = "#{고객명}님, #{물건명} 계약일이 #{계약일}입니다.";
  assert.deepEqual(usedVars(body), ["고객명", "물건명", "계약일"]);
  assert.deepEqual(missingVars(body, { 고객명: "박지훈" }), ["물건명", "계약일"]);
  assert.equal(renderVars(body, { 고객명: "박지훈" }), "박지훈님, #{물건명} 계약일이 #{계약일}입니다.");
  assert.deepEqual(missingVars(body, { 고객명: "박지훈", 물건명: "더샵부평", 계약일: "9월 30일" }), []);
});

test("변수가 채워지면 길이가 달라진다", () => {
  const body = "[서연공인중개사사무소]\n#{고객명}님, #{물건명} 계약일이 #{계약일}입니다.";
  const short = renderVars(body, { 고객명: "김민", 물건명: "부평 A", 계약일: "9/30" });
  const long = renderVars(body, { 고객명: "박지훈", 물건명: "더샵부평센트럴시티 110동 103호", 계약일: "2026년 9월 30일(수)" });
  assert.ok(smsBytes(long) > smsBytes(short));
  assert.equal(smsKind(short), "SMS");
  assert.equal(smsKind(long), "LMS", "긴 물건명 하나로 단가가 바뀐다 — 미리보기는 실제 값으로 재야 한다");
});

test("대체발송 비용은 알림톡과 나란히 낸다", () => {
  const e = estimateFallback(163, "가".repeat(200));
  assert.equal(e.kind, "LMS");
  assert.equal(e.cost, 163 * 50);
  assert.equal(e.alimtalkCost, 1059.5);
  assert.equal(e.multiple, 7.7, "알림톡 6.5원 대비 몇 배인지가 켜고 끄는 판단 기준이다");
  assert.equal(smsCost("짧은 안내", 10), 200);
});

test("실패 사유마다 문자가 나가는지가 다르다", () => {
  // 대행사 장애는 요청 자체가 접수되지 않아 예비 문자도 함께 보류된다
  assert.equal(FAIL_REASONS.vendor_ssl.fallback, "blocked");
  // 결과를 못 받은 건은 알림톡이 갔을 수도 있어 자동으로 덮으면 중복이 된다
  assert.equal(FAIL_REASONS.result_timeout.fallback, "duplicate");
  // 번호가 틀렸으면 문자도 못 간다
  assert.equal(FAIL_REASONS.invalid_number.fallback, "blocked");
  // 거부 의사를 밝힌 고객은 중개사가 직접 켜야 한다
  assert.equal(FAIL_REASONS.opt_out.fallback, "choice");
  // 카카오톡으로 못 받는 고객이야말로 대체발송이 존재하는 이유다
  assert.equal(FAIL_REASONS.no_kakao.fallback, "auto");
  assert.equal(FAIL_REASONS.kakao_blocked.fallback, "auto");
  for (const [code, r] of Object.entries(FAIL_REASONS) as [FailCode, (typeof FAIL_REASONS)[FailCode]][]) {
    assert.ok(r.fallbackNote.length > 0, `${code} 에 사유 설명이 없다`);
  }
});

test("템플릿에 붙은 대체 문구가 실제로 보낼 수 있는 것인지 본다", () => {
  const withSms = templates.filter((t) => t.sms);
  assert.ok(withSms.length > 0);
  for (const t of withSms) {
    assert.equal(isOverLimit(t.sms!.body), false, `${t.name} 이 LMS 한도를 넘는다`);
    assert.deepEqual(unsupportedChars(t.sms!.body), [], `${t.name} 에 문자로 못 보내는 글자가 있다`);
    // 문자에는 채널명이 안 붙으므로 본문이 보낸 사람을 밝혀야 한다
    assert.match(t.sms!.body, /^\[.+\]\n/, `${t.name} 에 상호 표기가 없다`);
    // 알림톡 본문에 없는 변수를 문자에서 쓰면 발송 때 치환되지 않는다
    const known = new Set(usedVars(t.body));
    for (const v of usedVars(t.sms!.body)) {
      assert.ok(known.has(v) || v === "사무실 전화", `${t.name}: 알림톡에 없는 변수 #{${v}}`);
    }
  }
});

test("빈 값에도 터지지 않는다", () => {
  assert.equal(smsBytes(""), 0);
  assert.equal(smsKind(""), "SMS");
  assert.deepEqual(unsupportedChars(""), []);
  assert.deepEqual(usedVars(""), []);
  assert.deepEqual(fromAlimtalk("", { sender: "" }), { text: "", droppedButtons: [] });
});

console.log(`\n${passed}개 통과`);
