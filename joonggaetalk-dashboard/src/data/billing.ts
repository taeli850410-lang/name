/**
 * 구독·결제 상태.
 *
 * 카드번호는 어디에도 없다. PG 에 카드를 등록하고 받은 빌링키와,
 * PG 가 화면 표시용으로 내려준 카드사·뒤 4자리만 들고 있다.
 */
import type { CardInfo, Cycle, PlanId } from "@/lib/billing";
import { TODAY } from "@/lib/format";

export type PayStatus = "결제완료" | "결제실패" | "재시도 예정" | "결제예정" | "환불";

export type Charge = {
  id: string;
  /** 주문번호 — 같은 결제는 몇 번을 요청해도 같은 값 */
  orderId: string;
  at: string;
  planId: PlanId;
  planName: string;
  cycle: Cycle;
  amount: number;
  status: PayStatus;
  /** 실패 사유 코드 (PAY_FAIL_REASONS) */
  code?: string;
  /** 몇 번째 재시도인지. 0이면 정기 결제일에 나간 첫 시도 */
  attempt?: number;
  method?: string;
  receiptUrl?: string;
};

export type Subscription = {
  planId: PlanId;
  cycle: Cycle;
  /** 자동결제 사용 여부. 끄면 기간이 끝나고 무료로 내려간다 */
  autoRenew: boolean;
  /** 최초 결제일 — 매달 결제일의 기준일을 여기서 뽑는다 */
  startedAt: string | null;
  /** 이용기한 */
  expiresAt: string;
  /** 다음 결제 예정일. 자동결제를 껐으면 null */
  nextChargeAt: string | null;
  card: CardInfo | null;
  /** 해지 예약 — 이 날짜까지는 쓰고 그 뒤로 무료 */
  cancelAt?: string | null;
};

/** 지금은 무료 체험 중이고 곧 만료된다 — 결제수단이 아직 없다. */
export const subscription: Subscription = {
  planId: "free",
  cycle: "월",
  autoRenew: false,
  startedAt: null,
  expiresAt: "2026-09-30",
  nextChargeAt: null,
  card: null,
  cancelAt: null,
};

export const charges: Charge[] = [];

/**
 * 다른 회원(이 화면에는 안 나온다)의 결제 흐름을 본뜬 예시.
 * 결제가 실패했을 때 화면이 어떻게 되는지 확인하는 데 쓴다.
 */
export const DEMO_CHARGES: Charge[] = [
  { id: "c5", orderId: "jt_m001_basic_m_20260930", at: "2026-09-30 09:00", planId: "basic", planName: "베이직", cycle: "월", amount: 33_000, status: "결제예정" },
  { id: "c4", orderId: "jt_m001_basic_m_20260831", at: "2026-08-31 09:02", planId: "basic", planName: "베이직", cycle: "월", amount: 33_000, status: "결제완료", method: "신한 신용카드 ···· 1234", receiptUrl: "#" },
  { id: "c3", orderId: "jt_m001_basic_m_20260731_r1", at: "2026-08-01 09:00", planId: "basic", planName: "베이직", cycle: "월", amount: 33_000, status: "결제완료", attempt: 1, method: "신한 신용카드 ···· 1234", receiptUrl: "#" },
  { id: "c2", orderId: "jt_m001_basic_m_20260731", at: "2026-07-31 09:00", planId: "basic", planName: "베이직", cycle: "월", amount: 33_000, status: "결제실패", code: "insufficient" },
  { id: "c1", orderId: "jt_m001_basic_m_20260630", at: "2026-06-30 09:01", planId: "basic", planName: "베이직", cycle: "월", amount: 33_000, status: "결제완료", method: "신한 신용카드 ···· 1234", receiptUrl: "#" },
];

export const DEMO_CARD: CardInfo = { issuer: "신한", last4: "1234", kind: "신용", billingKeyAt: "2026-06-30" };

/** 결제가 실패한 상태가 화면에서 어떻게 보이는지 확인하는 데 쓰는 예시. */
export const DEMO_SUB: Subscription = {
  planId: "basic",
  cycle: "월",
  autoRenew: true,
  startedAt: "2026-06-30",
  expiresAt: "2026-09-30",
  nextChargeAt: "2026-09-30",
  card: DEMO_CARD,
  cancelAt: null,
};

/** 결제수단을 등록하면 오늘부터 시작한다. */
export function startToday(): string {
  return TODAY;
}
