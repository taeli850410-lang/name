/** 발송 내역 — 배치 단위로 묶고, 실패 사유는 코드 → 사람 문장으로 바꿔 보여 준다. */
import type { FallbackPolicy, SmsKind } from "@/lib/sms";

export type FailCode = "vendor_ssl" | "result_timeout" | "invalid_number" | "opt_out" | "no_kakao" | "kakao_blocked";

/**
 * 실패 사유 하나마다 "문자로 대체되는가" 가 따로 붙는다.
 * 이걸 뭉뚱그리면 대체발송을 켜 두고도 왜 안 갔는지 알 수 없다.
 */
export const FAIL_REASONS: Record<FailCode, { title: string; detail: string; retryable: boolean; fallback: FallbackPolicy; fallbackNote: string }> = {
  vendor_ssl: {
    title: "발송 대행사 서버 인증서 문제로 보내지 못했습니다",
    detail: "발송킹 서버의 보안 인증서가 만료되어 연결이 거부되었습니다. 대행사가 복구하면 자동으로 다시 시도합니다.",
    retryable: true,
    fallback: "blocked",
    fallbackNote: "대체 문자는 알림톡 요청에 실려 나갑니다. 요청 자체가 접수되지 않았으므로 문자도 함께 보류됩니다.",
  },
  result_timeout: {
    title: "30분 안에 발송 결과를 받지 못했습니다",
    detail: "발송 요청은 접수됐지만 결과 회신이 없었습니다. 실제 수신 여부는 발송킹 발송 내역에서 확인할 수 있습니다.",
    retryable: true,
    fallback: "duplicate",
    fallbackNote: "알림톡이 실제로 갔는지 알 수 없습니다. 문자로 덮으면 같은 안내를 두 번 받을 수 있어 자동으로 보내지 않습니다.",
  },
  invalid_number: {
    title: "받는 번호가 올바르지 않습니다",
    detail: "고객 정보의 휴대폰 번호를 확인해 주세요.",
    retryable: false,
    fallback: "blocked",
    fallbackNote: "번호가 잘못돼 문자도 가지 않습니다. 고객 번호를 고쳐야 합니다.",
  },
  opt_out: {
    title: "수신을 거부한 고객입니다",
    detail: "고객이 알림톡 수신을 거부해 제외되었습니다.",
    retryable: false,
    fallback: "choice",
    fallbackNote: "거부 의사를 밝힌 고객입니다. 계약일·잔금일처럼 꼭 전해야 하는 안내만 문자로 보내세요.",
  },
  no_kakao: {
    title: "카카오톡으로 받을 수 없는 고객입니다",
    detail: "카카오톡을 쓰지 않거나, 이 번호로 가입된 계정이 없습니다.",
    retryable: false,
    fallback: "auto",
    fallbackNote: "대체발송을 켜 두면 문자로 나갑니다. 알림톡으로 다시 보내도 결과는 같습니다.",
  },
  kakao_blocked: {
    title: "고객이 카카오톡에서 이 채널을 차단했습니다",
    detail: "채널을 차단했거나 메시지 수신을 막아 두었습니다.",
    retryable: false,
    fallback: "auto",
    fallbackNote: "대체발송을 켜 두면 문자로 나갑니다. 알림톡으로 다시 보내도 결과는 같습니다.",
  },
};

/** 대체 문자 한 건의 결과. 알림톡 한 건에 딸리는 예비 메시지다. */
export type FallbackResult = { kind: SmsKind; status: "발송" | "실패" | "보류" | "안 보냄"; at?: string; cost: number; note?: string };

export type SendItem = { customerId?: string; customerName: string; phoneMasked: string; status: "성공" | "실패" | "예정" | "보류"; code?: FailCode; fallback?: FallbackResult };

export type SendBatch = {
  id: string;
  kind: "지금 발송" | "정기 발송" | "자동발송" | "환영인사";
  templateId: string;
  templateName: string;
  trigger?: string;
  scheduledAt: string; // YYYY-MM-DD HH:mm
  finishedAt?: string;
  total: number;
  success: number;
  failed: number;
  pending: number;
  costPerMsg: number;
  items: SendItem[];
  dealName?: string;
  /**
   * 대체 문자 집계. items 는 큰 배치에서 일부만 싣기 때문에
   * success/failed 와 마찬가지로 배치에 따로 둔다.
   */
  fallback?: { sent: number; cost: number };
};

const ok = (name: string, last4: string): SendItem => ({ customerName: name, phoneMasked: `010-****-${last4}`, status: "성공" });
const ng = (name: string, last4: string, code: FailCode): SendItem => ({ customerName: name, phoneMasked: `010-****-${last4}`, status: "실패", code });
/** 알림톡은 실패했지만 대체 문자가 대신 나간 건 */
const sms = (name: string, last4: string, code: FailCode, kind: SmsKind, at: string): SendItem => ({
  ...ng(name, last4, code),
  fallback: { kind, status: "발송", at, cost: kind === "SMS" ? 20 : 50 },
});

const failed29: SendItem[] = [
  ["김서준", "1183"], ["이하은", "2231"], ["박도윤", "5520"], ["최지우", "8811"], ["정예준", "0091"], ["강수아", "3345"], ["조시우", "7728"], ["윤지민", "1962"], ["장하준", "4471"], ["임서윤", "5039"],
  ["한주원", "6602"], ["오채원", "9384"], ["서지호", "2710"], ["신유진", "8125"], ["권현우", "3396"], ["황다은", "7541"], ["안건우", "0287"], ["송소율", "6853"], ["류우진", "1490"], ["전지아", "5917"],
  ["홍선우", "2264"], ["고예은", "8036"], ["문연우", "4172"], ["양가은", "9605"], ["손정우", "3348"], ["배나은", "7789"], ["백승현", "0512"], ["허윤서", "6231"], ["유태양", "1874"],
].map(([n, l]) => ng(n, l, "result_timeout"));

export const sendBatches: SendBatch[] = [
  // 예정
  { id: "b-up1", kind: "자동발송", templateId: "t4", templateName: "잔금일", trigger: "잔금일 3일 전", dealName: "마곡 힐스테이트 301동 2201호 전세 재계약", scheduledAt: "2026-09-13 09:00", total: 1, success: 0, failed: 0, pending: 1, costPerMsg: 6.5, items: [{ customerName: "남유진", phoneMasked: "010-****-4402", status: "보류" }] },
  { id: "b-up2", kind: "정기 발송", templateId: "t9", templateName: "관심지역 실거래가", trigger: "매주시세", scheduledAt: "2026-09-14 09:00", total: 24, success: 0, failed: 0, pending: 24, costPerMsg: 6.5, items: [] },
  { id: "b-up3", kind: "자동발송", templateId: "t3", templateName: "[중개톡] 중도금 도래", trigger: "중도금일 1일 전", dealName: "청라 한양수자인 205동 1502호 매매", scheduledAt: "2026-09-24 09:00", total: 1, success: 0, failed: 0, pending: 1, costPerMsg: 6.5, items: [{ customerId: "c002", customerName: "김민수", phoneMasked: "010-****-2201", status: "예정" }] },
  { id: "b-up4", kind: "자동발송", templateId: "t6", templateName: "[중개톡] 계약 만료일", trigger: "임대차 만료일", dealName: "판교 오피스텔 1203호 월세", scheduledAt: "2026-09-26 09:00", total: 1, success: 0, failed: 0, pending: 1, costPerMsg: 6.5, items: [{ customerName: "한서윤", phoneMasked: "010-****-9013", status: "예정" }] },
  { id: "b-up5", kind: "자동발송", templateId: "t4", templateName: "잔금일", trigger: "잔금일 3일 전", dealName: "더샵부평 110동 103호 전세", scheduledAt: "2026-09-27 09:00", total: 1, success: 0, failed: 0, pending: 1, costPerMsg: 6.5, items: [{ customerId: "c001", customerName: "박지훈", phoneMasked: "010-****-7788", status: "예정" }] },
  // 오늘 실패 (대행사 장애)
  { id: "b1", kind: "지금 발송", templateId: "t10", templateName: "전문가 칼럼 알림", scheduledAt: "2026-09-12 12:35", finishedAt: "2026-09-12 12:35", total: 1, success: 0, failed: 1, pending: 0, costPerMsg: 6.5, fallback: { sent: 0, cost: 0 }, items: [ng("이서연", "1848", "vendor_ssl")] },
  { id: "b2", kind: "환영인사", templateId: "t1", templateName: "[중개톡] 신규", trigger: "고객 등록", scheduledAt: "2026-09-12 20:36", finishedAt: "2026-09-12 20:36", total: 2, success: 0, failed: 2, pending: 0, costPerMsg: 6.5, fallback: { sent: 0, cost: 0 }, items: [ng("정관영", "3402", "vendor_ssl"), ng("이데아", "7712", "vendor_ssl")] },
  // 최근 완료
  { id: "b3", kind: "지금 발송", templateId: "t9", templateName: "관심지역 실거래가", scheduledAt: "2026-09-11 12:12", finishedAt: "2026-09-11 12:12", total: 1, success: 1, failed: 0, pending: 0, costPerMsg: 6.5, items: [ok("정하은", "0352")] },
  { id: "b4", kind: "환영인사", templateId: "t1", templateName: "[중개톡] 신규", trigger: "고객 등록", scheduledAt: "2026-09-11 12:12", finishedAt: "2026-09-11 12:12", total: 1, success: 1, failed: 0, pending: 0, costPerMsg: 6.5, items: [ok("정하은", "0352")] },
  { id: "b5", kind: "자동발송", templateId: "t4", templateName: "잔금일", trigger: "잔금일 3일 전", dealName: "부천 중동 신축빌라 302호 전세", scheduledAt: "2026-09-02 09:00", finishedAt: "2026-09-02 09:00", total: 1, success: 1, failed: 0, pending: 0, costPerMsg: 6.5, items: [ok("정하은", "0352")] },
  { id: "b6", kind: "정기 발송", templateId: "t9", templateName: "관심지역 실거래가", trigger: "매주시세", scheduledAt: "2026-09-07 09:00", finishedAt: "2026-09-07 09:01", total: 24, success: 23, failed: 1, pending: 0, costPerMsg: 6.5, items: [ok("박지훈", "7788"), ok("김민수", "2201"), { ...ng("최도윤", "9471", "opt_out"), fallback: { kind: "LMS", status: "안 보냄", cost: 0, note: "거부 의사를 밝힌 고객이라 자동으로 보내지 않았습니다." } }] },
  { id: "b7", kind: "지금 발송", templateId: "t10", templateName: "전문가 칼럼 알림", scheduledAt: "2026-09-07 09:39", finishedAt: "2026-09-07 10:09", total: 29, success: 0, failed: 29, pending: 0, costPerMsg: 6.5, items: failed29 },
  { id: "b8", kind: "지금 발송", templateId: "t10", templateName: "중개톡 회원 알림", scheduledAt: "2026-09-07 11:05", finishedAt: "2026-09-07 11:06", total: 163, success: 161, failed: 2, pending: 0, costPerMsg: 6.5, items: [ok("김진년", "2210"), ok("김태이", "9908"), ng("공진희", "3311", "invalid_number"), ng("권리원", "8823", "invalid_number")] },
  { id: "b9", kind: "환영인사", templateId: "t1", templateName: "[중개톡] 신규", trigger: "고객 등록", scheduledAt: "2026-09-07 20:35", finishedAt: "2026-09-07 20:41", total: 75, success: 75, failed: 0, pending: 0, costPerMsg: 6.5, items: [ok("변영균", "1102"), ok("유천", "1303")] },
  { id: "b10", kind: "자동발송", templateId: "t2", templateName: "[중개톡] 계약일정", trigger: "계약일 1일 전", dealName: "청라 한양수자인 205동 1502호 매매", scheduledAt: "2026-08-30 09:00", finishedAt: "2026-08-30 09:00", total: 2, success: 2, failed: 0, pending: 0, costPerMsg: 6.5, items: [ok("김민수", "2201"), ok("오지민", "5570")] },
  // 대체발송을 켜기 전에 나간 건. 알림톡으로 다시 보내도 결과가 같아 문자로만 덮을 수 있다.
  { id: "b13", kind: "자동발송", templateId: "t6", templateName: "[중개톡] 계약 만료일", trigger: "임대차 만료일 90일 전", dealName: "부천 중동 신축빌라 302호 전세", scheduledAt: "2026-08-24 09:00", finishedAt: "2026-08-24 09:00", total: 2, success: 1, failed: 1, pending: 0, costPerMsg: 6.5, items: [ok("정하은", "0352"), ng("서동혁", "6614", "no_kakao")] },
  { id: "b12", kind: "자동발송", templateId: "t2", templateName: "[중개톡] 계약일정", trigger: "계약일 1일 전", dealName: "계산동 상가 1층 임대차", scheduledAt: "2026-09-05 09:00", finishedAt: "2026-09-05 09:00", total: 3, success: 1, failed: 2, pending: 0, costPerMsg: 6.5, fallback: { sent: 2, cost: 100 }, items: [ok("이수현", "1120"), sms("최영호", "7245", "no_kakao", "LMS", "2026-09-05 09:00"), sms("장미경", "3391", "kakao_blocked", "LMS", "2026-09-05 09:00")] },
  { id: "b11", kind: "자동발송", templateId: "t7", templateName: "등기부 변동 알리미", trigger: "등기부 변동", dealName: "마곡 힐스테이트 301동 2201호", scheduledAt: "2026-08-28 10:08", finishedAt: "2026-08-28 10:08", total: 1, success: 1, failed: 0, pending: 0, costPerMsg: 6.5, items: [ok("남유진", "4402")] },
];

export const monthlySends = { thisMonth: 593, lastMonth: 412 };
