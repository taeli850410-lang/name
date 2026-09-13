/**
 * 정기결제 계산 테스트.
 *   npm test
 */
import assert from "node:assert/strict";
import {
  anchorDayOf,
  daysInMonth,
  failPolicy,
  GRACE_DAYS,
  graceEndsAt,
  maskCard,
  nextChargeDate,
  orderId,
  parseOrderId,
  PAY_FAIL_REASONS,
  PLANS,
  priceOf,
  proratedCharge,
  refundOnCancel,
  retrySchedule,
  vatBreakdown,
  yearlyFreeMonths,
  yearlySaving,
} from "../src/lib/billing.ts";
import { MAX_SKEW_SEC, sign, verifyWebhook } from "../src/lib/webhook.ts";
import { euro } from "../src/lib/format.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

console.log("\n정기결제 계산");

test("없는 날짜는 말일로 당기되 기준일은 그대로 둔다", () => {
  // 31일에 시작한 결제가 2월을 지났다고 영영 28일이 되면 안 된다
  assert.equal(nextChargeDate("2026-01-31", 31), "2026-02-28");
  assert.equal(nextChargeDate("2026-02-28", 31), "2026-03-31");
  assert.equal(nextChargeDate("2026-03-31", 31), "2026-04-30");
  assert.equal(nextChargeDate("2026-04-30", 31), "2026-05-31");
  // 30일 기준도 같다
  assert.equal(nextChargeDate("2026-01-30", 30), "2026-02-28");
  assert.equal(nextChargeDate("2026-02-28", 30), "2026-03-30");
});

test("윤년 2월을 제대로 센다", () => {
  assert.equal(daysInMonth(2028, 2), 29);
  assert.equal(daysInMonth(2026, 2), 28);
  assert.equal(daysInMonth(2100, 2), 28, "100으로 나뉘고 400으로 안 나뉘면 평년");
  assert.equal(nextChargeDate("2028-01-31", 31), "2028-02-29");
});

test("해를 넘어가도 맞는다", () => {
  assert.equal(nextChargeDate("2026-12-15", 15), "2027-01-15");
  assert.equal(nextChargeDate("2026-12-31", 31), "2027-01-31");
  assert.equal(nextChargeDate("2026-03-15", 15, 12), "2027-03-15", "년 결제");
  assert.equal(anchorDayOf("2026-01-31"), 31);
});

test("부가세를 역산해도 합계가 어긋나지 않는다", () => {
  const b = vatBreakdown(33_000);
  assert.equal(b.supply, 30_000);
  assert.equal(b.vat, 3_000);
  assert.equal(b.supply + b.vat, b.total, "세금계산서 합계는 청구액과 같아야 한다");
  // 딱 떨어지지 않는 금액에서도 합계가 맞아야 한다
  for (const total of [330_000, 660_000, 1, 99_999, 12_345]) {
    const x = vatBreakdown(total);
    assert.equal(x.supply + x.vat, total, `${total}원에서 합계가 틀어진다`);
    assert.ok(Number.isInteger(x.supply) && Number.isInteger(x.vat));
  }
});

test("가격표는 서버가 가진 이 값만 쓴다", () => {
  assert.equal(priceOf("basic", "월"), 33_000);
  assert.equal(priceOf("basic", "년"), 330_000);
  assert.equal(priceOf("free", "월"), 0);
  // 년 결제를 팔지 않는 플랜에 년을 물으면 월×12 로 답한다
  assert.equal(priceOf("free", "년"), 0);
  assert.equal(yearlySaving("basic"), 66_000);
  assert.equal(yearlySaving("free"), 0, "할인이 없으면 0 — 화면에서 감춘다");
  assert.equal(yearlyFreeMonths("basic"), 2, "년 결제는 두 달치가 빠진다");
  assert.equal(yearlyFreeMonths("free"), 0);
  // 부가세를 빼도 딱 떨어지는 금액이라야 화면에 공급가액을 적을 수 있다
  assert.equal(vatBreakdown(330_000).supply, 300_000);
  for (const p of PLANS) assert.ok(p.monthly >= 0);
});

test("실패 사유마다 다음에 할 일이 다르다", () => {
  // 시간이 지나면 될 수 있는 것
  assert.equal(failPolicy("insufficient"), "retry");
  assert.equal(failPolicy("issuer_down"), "retry");
  // 같은 카드로는 몇 번을 해도 안 되는 것
  assert.equal(failPolicy("expired_card"), "card");
  assert.equal(failPolicy("lost_stolen"), "card");
  assert.equal(failPolicy("invalid_billing_key"), "card");
  assert.equal(failPolicy("cancelled_by_user"), "stop");
  // 모르는 코드는 일단 재시도로 본다 (돈을 못 받는 쪽보다 한 번 더 시도하는 쪽)
  assert.equal(failPolicy("something_new_from_pg"), "retry");
  for (const [code, r] of Object.entries(PAY_FAIL_REASONS)) {
    assert.ok(r.title && r.detail, `${code} 에 설명이 없다`);
  }
});

test("카드를 바꿔야 하는 실패는 재시도 일정을 만들지 않는다", () => {
  assert.deepEqual(retrySchedule("2026-09-30", "insufficient"), ["2026-10-01", "2026-10-03", "2026-10-07"]);
  assert.deepEqual(retrySchedule("2026-09-30", "expired_card"), [], "결과가 같은 시도를 세 번 더 하지 않는다");
  assert.deepEqual(retrySchedule("2026-09-30", "cancelled_by_user"), []);
  // 달을 넘어가도 맞는다
  assert.deepEqual(retrySchedule("2026-12-29", "insufficient"), ["2026-12-30", "2027-01-01", "2027-01-05"]);
});

test("결제가 실패해도 그날 바로 끊지 않는다", () => {
  assert.equal(GRACE_DAYS, 7);
  assert.equal(graceEndsAt("2026-09-30"), "2026-10-07");
  // 마지막 재시도(D+7)와 유예 종료가 같은 날이라 그 전까지는 서비스가 살아 있다
  assert.equal(retrySchedule("2026-09-30", "insufficient").at(-1), graceEndsAt("2026-09-30"));
});

test("플랜을 올릴 때 남은 기간만큼만 받는다", () => {
  // 30일 주기 중 15일 남음, 33,000 → 66,000
  assert.equal(proratedCharge(66_000, 33_000, 15, 30), 16_500);
  // 내려가는 변경은 즉시 청구하지 않는다 (다음 결제일에 반영)
  assert.equal(proratedCharge(33_000, 66_000, 15, 30), 0);
  // 1원이라도 더 받는 쪽으로 반올림하지 않는다
  assert.equal(proratedCharge(66_000, 33_000, 1, 30), Math.floor(33_000 / 30));
  assert.equal(proratedCharge(66_000, 33_000, 15, 0), 0, "0으로 나누지 않는다");
});

test("중도 해지 환불은 쓴 날만 뺀다", () => {
  assert.equal(refundOnCancel(33_000, 10, 30), 22_000);
  assert.equal(refundOnCancel(33_000, 30, 30), 0);
  assert.equal(refundOnCancel(33_000, 40, 30), 0, "다 쓰고도 더 쓴 경우 음수가 나오면 안 된다");
  assert.equal(refundOnCancel(33_000, 0, 30), 33_000);
});

test("같은 결제는 몇 번을 요청해도 같은 주문번호다", () => {
  // 이게 어긋나면 재시도가 두 번 청구된다
  const a = orderId("m001", "basic", "월", "2026-09-30");
  assert.equal(a, orderId("m001", "basic", "월", "2026-09-30"));
  assert.equal(a, "jt_m001_basic_m_20260930");
  // 재시도는 별개 주문이라 구분된다
  assert.notEqual(a, orderId("m001", "basic", "월", "2026-09-30", 1));
  assert.notEqual(a, orderId("m002", "basic", "월", "2026-09-30"));
  assert.notEqual(a, orderId("m001", "pro", "월", "2026-09-30"));
  assert.notEqual(a, orderId("m001", "basic", "년", "2026-09-30"), "주기가 다르면 다른 주문이다");
});

test("웹훅이 주문번호만 보고 청구했어야 할 금액을 알아낸다", () => {
  // 주기가 주문번호에 없으면 년 결제가 월 금액과 대조돼 멀쩡한 결제가 막힌다
  for (const cycle of ["월", "년"] as const) {
    const id = orderId("m001", "basic", cycle, "2026-09-30");
    const p = parseOrderId(id)!;
    assert.equal(p.cycle, cycle);
    assert.equal(p.planId, "basic");
    assert.equal(p.memberId, "m001");
    assert.equal(p.date, "20260930");
    assert.equal(priceOf(p.planId, p.cycle), priceOf("basic", cycle));
  }
  // 재시도 주문번호도 같은 주문으로 읽힌다
  assert.equal(parseOrderId(orderId("m001", "pro", "년", "2026-09-30", 2))!.cycle, "년");
  // 우리가 만들지 않은 주문번호는 금액 대조를 하지 않는다
  assert.equal(parseOrderId("아무거나"), null);
  assert.equal(parseOrderId("jt_m001_basic_20260930"), null, "주기 없는 옛 형식은 받지 않는다");
});

test("카드 표기에는 카드번호가 없다", () => {
  const c = { issuer: "신한", last4: "1234", kind: "신용" as const, billingKeyAt: "2026-09-01" };
  const s = maskCard(c);
  assert.equal(s, "신한 신용카드 ···· 1234");
  assert.equal(/\d{5,}/.test(s), false, "네 자리보다 긴 숫자가 보이면 안 된다");
});


test("플랜 이름에 조사를 맞게 붙인다", () => {
  // 받침이 있으면 "으로", 없거나 ㄹ 받침이면 "로"
  assert.equal(`베이직${euro("베이직")}`, "베이직으로");
  assert.equal(`프로${euro("프로")}`, "프로로");
  assert.equal(`서울${euro("서울")}`, "서울로", "ㄹ 받침은 예외다");
  assert.equal(`Pro${euro("Pro")}`, "Pro로", "한글이 아니면 받침을 알 수 없다");
  for (const p of PLANS) assert.ok(["로", "으로"].includes(euro(p.name)));
});

console.log("\n웹훅 서명 검증");

const SECRET = "whsec_c2VjcmV0LWtleS1mb3ItdGVzdA==";
const BODY = JSON.stringify({ type: "Transaction.Paid", data: { paymentId: "jt_m001_basic_m_20260930" } });
const ID = "wh_abc123";
const NOW = 1_790_000_000;
const headersFor = (raw: string, ts = NOW, secret = SECRET) => ({
  id: ID,
  timestamp: String(ts),
  signature: `v1,${sign(raw, ID, String(ts), secret)}`,
});

test("제대로 서명된 웹훅은 통과한다", () => {
  assert.deepEqual(verifyWebhook(BODY, headersFor(BODY), SECRET, NOW), { ok: true });
});

test("본문을 한 글자만 바꿔도 막는다", () => {
  const h = headersFor(BODY);
  const tampered = BODY.replace("basic", "pro__");
  assert.equal(tampered.length, BODY.length, "길이가 같아도 막혀야 한다");
  const r = verifyWebhook(tampered, h, SECRET, NOW);
  assert.equal(r.ok, false);
  // 파싱했다 다시 문자열로 만들면 서명이 어긋난다 — 원문을 그대로 넣어야 하는 이유
  assert.equal(verifyWebhook(JSON.stringify(JSON.parse(BODY)) + " ", h, SECRET, NOW).ok, false);
});

test("다른 키로 만든 서명은 막는다", () => {
  const r = verifyWebhook(BODY, headersFor(BODY, NOW, "whsec_b3RoZXIta2V5"), SECRET, NOW);
  assert.equal(r.ok, false);
});

test("오래된 서명은 막는다 — 가로챈 요청 재전송", () => {
  const old = NOW - MAX_SKEW_SEC - 1;
  assert.equal(verifyWebhook(BODY, headersFor(BODY, old), SECRET, NOW).ok, false);
  // 경계 안쪽은 통과한다
  assert.equal(verifyWebhook(BODY, headersFor(BODY, NOW - MAX_SKEW_SEC + 1), SECRET, NOW).ok, true);
  // 미래 시각도 같은 폭으로 막는다
  assert.equal(verifyWebhook(BODY, headersFor(BODY, NOW + MAX_SKEW_SEC + 1), SECRET, NOW).ok, false);
});

test("서명이 없으면 통과시키지 않는다", () => {
  assert.equal(verifyWebhook(BODY, { id: null, timestamp: null, signature: null }, SECRET, NOW).ok, false);
  assert.equal(verifyWebhook(BODY, headersFor(BODY), "", NOW).ok, false, "키가 없으면 검증 자체가 안 된다");
  assert.equal(verifyWebhook(BODY, { ...headersFor(BODY), timestamp: "어제" }, SECRET, NOW).ok, false);
});

test("키를 바꾸는 중이라 서명이 여러 개여도 하나만 맞으면 된다", () => {
  const good = sign(BODY, ID, String(NOW), SECRET);
  const h = { id: ID, timestamp: String(NOW), signature: `v1,AAAAinvalid v1,${good}` };
  assert.equal(verifyWebhook(BODY, h, SECRET, NOW).ok, true);
  const bothBad = { id: ID, timestamp: String(NOW), signature: "v1,AAAA v1,BBBB" };
  assert.equal(verifyWebhook(BODY, bothBad, SECRET, NOW).ok, false);
});

console.log(`\n${passed}개 통과`);
