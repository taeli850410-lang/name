/**
 * 정기결제 계산.
 *
 * 카드번호·유효기간·CVC 는 이 서비스가 갖지 않는다. 여신전문금융업법상
 * 가맹점이 카드 정보를 저장할 수 없어서, PG(포트원·토스페이먼츠)에
 * 카드를 등록하고 받은 **빌링키**만 보관한다. 화면에 보이는 카드 정보는
 * PG 가 내려준 마스킹 값이지 우리가 가진 카드번호가 아니다.
 *
 * 결제 금액도 브라우저에서 받지 않는다. 아래 PLANS 가 유일한 가격표이고,
 * 서버가 여기서 다시 계산해 PG 에 보낸다.
 */

export type PlanId = "free" | "basic" | "pro";
export type Cycle = "월" | "년";

export type Plan = {
  id: PlanId;
  name: string;
  /** 부가세 포함 월 금액(원). 년 결제는 monthly × 12 에서 할인. */
  monthly: number;
  /** 년 결제 시 부가세 포함 금액. 없으면 년 결제를 팔지 않는다. */
  yearly?: number;
  desc: string;
  limits: string[];
};

/** 가격표 — 서버가 믿는 유일한 출처. */
export const PLANS: Plan[] = [
  { id: "free", name: "무료", monthly: 0, desc: "가입 후 체험", limits: ["고객 50명", "자동발송 없음", "등기부 감시 1건"] },
  { id: "basic", name: "베이직", monthly: 33_000, yearly: 330_000, desc: "1인 사무소", limits: ["고객 무제한", "자동발송 전체", "등기부 감시 20건"] },
  { id: "pro", name: "프로", monthly: 66_000, yearly: 660_000, desc: "직원을 둔 사무소", limits: ["고객 무제한", "자동발송 전체", "등기부 감시 100건", "계정 5개"] },
];

export function planOf(id: PlanId): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

/** 주기에 맞는 청구 금액(부가세 포함). 년 결제를 팔지 않는 플랜이면 월 금액을 낸다. */
export function priceOf(id: PlanId, cycle: Cycle): number {
  const p = planOf(id);
  return cycle === "년" ? (p.yearly ?? p.monthly * 12) : p.monthly;
}

/** 년 결제로 아끼는 금액. 0이면 할인이 없다는 뜻이라 화면에서 감춘다. */
export function yearlySaving(id: PlanId): number {
  const p = planOf(id);
  return p.yearly ? p.monthly * 12 - p.yearly : 0;
}

/** 년 결제 할인을 "몇 개월치"로 환산. 딱 떨어지지 않으면 0을 내고 화면은 금액으로 말한다. */
export function yearlyFreeMonths(id: PlanId): number {
  const p = planOf(id);
  const saved = yearlySaving(id);
  if (!saved || !p.monthly) return 0;
  return saved % p.monthly === 0 ? saved / p.monthly : 0;
}

export const VAT_RATE = 0.1;

/**
 * 부가세 역산. 표시 가격은 부가세 포함이고, 세금계산서에는 공급가액이 따로 필요하다.
 * 공급가액을 원 단위로 떨어뜨리고 나머지를 부가세로 둬야 합계가 어긋나지 않는다.
 */
export function vatBreakdown(total: number): { supply: number; vat: number; total: number } {
  const supply = Math.round(total / (1 + VAT_RATE));
  return { supply, vat: total - supply, total };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * 다음 결제일.
 *
 * 기준일(anchorDay)을 따로 들고 다닌다. 그 달에 없는 날이면 말일로 당기되
 * 다음 달에는 다시 기준일로 돌아가야 한다.
 *   31일 기준 → 1/31, 2/28, 3/31
 * 당긴 날짜를 새 기준으로 삼으면 한 번 2월을 지난 뒤로 영영 28일이 된다.
 */
export function nextChargeDate(from: string, anchorDay: number, months = 1): string {
  const [y, m] = from.split("-").map(Number);
  const total = (y * 12 + (m - 1)) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const day = Math.min(anchorDay, daysInMonth(ny, nm));
  return `${ny}-${String(nm).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** 결제일에서 기준일을 뽑는다. 말일로 당겨진 날짜를 기준일로 오해하지 않도록 최초 결제일을 쓴다. */
export function anchorDayOf(firstChargeDate: string): number {
  return Number(firstChargeDate.slice(8, 10));
}

/** 전자상거래법상 정기결제는 결제 전에 알려야 한다. */
export const NOTICE_DAYS_BEFORE = 7;

export type PayFailPolicy = "retry" | "card" | "stop";

/**
 * 실패 사유마다 다음에 할 일이 다르다.
 *   retry 시간이 지나면 될 수 있다 (잔액·한도·카드사 점검)
 *   card  같은 카드로는 몇 번을 해도 안 된다. 카드를 바꿔야 한다
 *   stop  우리 쪽에서 멈춘 것이라 재시도 대상이 아니다
 */
export const PAY_FAIL_REASONS: Record<string, { title: string; detail: string; policy: PayFailPolicy }> = {
  insufficient: { title: "카드 잔액이나 한도가 부족합니다", detail: "체크카드는 잔액을, 신용카드는 이번 달 한도를 확인해 주세요.", policy: "retry" },
  limit_exceeded: { title: "카드 한도를 넘었습니다", detail: "이번 달 사용 한도를 넘었습니다. 한도를 올리거나 다른 카드를 등록해 주세요.", policy: "retry" },
  issuer_down: { title: "카드사 시스템 점검 중입니다", detail: "카드사 사정이라 잠시 뒤 다시 시도하면 됩니다.", policy: "retry" },
  declined: { title: "카드사가 결제를 거절했습니다", detail: "사유를 알려 주지 않는 거절입니다. 카드사에 문의하거나 다른 카드를 등록해 주세요.", policy: "retry" },
  expired_card: { title: "카드 유효기간이 지났습니다", detail: "같은 카드로는 결제되지 않습니다. 새 카드를 등록해 주세요.", policy: "card" },
  lost_stolen: { title: "분실·도난 신고된 카드입니다", detail: "카드사에서 막은 카드입니다. 다른 카드를 등록해 주세요.", policy: "card" },
  suspended: { title: "정지되었거나 해지된 카드입니다", detail: "쓸 수 없는 카드입니다. 다른 카드를 등록해 주세요.", policy: "card" },
  invalid_billing_key: { title: "등록된 카드 정보가 만료되었습니다", detail: "결제수단을 다시 등록해 주세요. 카드를 재발급받았다면 이 상태가 됩니다.", policy: "card" },
  cancelled_by_user: { title: "회원이 결제를 취소했습니다", detail: "자동결제를 해지한 뒤 예약된 건입니다.", policy: "stop" },
};

export function failPolicy(code: string): PayFailPolicy {
  return PAY_FAIL_REASONS[code]?.policy ?? "retry";
}

/**
 * 재시도 일정 — 실패일 기준 1일, 3일, 7일 뒤. 세 번까지만 한다.
 * 무한 재시도는 카드사에서 어뷰징으로 보고 가맹점을 막는다.
 * 카드를 바꿔야 하는 실패는 아예 일정을 만들지 않는다 — 결과가 같기 때문이다.
 */
export const RETRY_OFFSETS = [1, 3, 7] as const;

export function retrySchedule(failedAt: string, code: string): string[] {
  if (failPolicy(code) !== "retry") return [];
  return RETRY_OFFSETS.map((d) => addDaysISO(failedAt, d));
}

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

/**
 * 결제가 실패해도 그날 바로 끊지 않는다.
 * 이 서비스는 계약일·잔금일 알림톡이 자동으로 나가는 곳이라, 결제 문제로
 * 그게 멈추면 회원의 고객이 안내를 못 받는다. 유예기간 동안은 이미 예약된
 * 자동발송을 계속 내보내고 새 발송만 막는다.
 */
export const GRACE_DAYS = 7;

export function graceEndsAt(firstFailedAt: string): string {
  return addDaysISO(firstFailedAt, GRACE_DAYS);
}

/**
 * 플랜을 바꿀 때 남은 기간만큼 정산한다.
 * 원 단위는 내려서 청구한다 — 반올림으로 1원을 더 받는 쪽으로 기울지 않게.
 */
export function proratedCharge(newPrice: number, oldPrice: number, remainingDays: number, cycleDays: number): number {
  if (cycleDays <= 0) return 0;
  const diff = ((newPrice - oldPrice) * remainingDays) / cycleDays;
  return diff <= 0 ? 0 : Math.floor(diff);
}

/** 중도 해지 환불액. 쓴 날짜만 빼고 돌려준다. */
export function refundOnCancel(paid: number, usedDays: number, cycleDays: number): number {
  if (cycleDays <= 0 || usedDays >= cycleDays) return 0;
  return Math.floor((paid * (cycleDays - usedDays)) / cycleDays);
}

/**
 * 주문번호. 같은 회원·같은 플랜·같은 주기·같은 결제일이면 항상 같은 값이 나와야
 * 재시도나 중복 요청이 두 번 청구되지 않는다. PG 는 이 값이 겹치면 거절한다.
 *
 * 주기를 넣어 두는 이유는 따로 있다. 웹훅이 왔을 때 "이 주문은 얼마여야 하는가"를
 * 주문번호만 보고 알 수 있어야 입금액 대조가 된다. 주기가 없으면 년 결제를
 * 월 금액과 맞춰 보고 멀쩡한 결제를 금액 불일치로 막는다.
 */
export function orderId(memberId: string, planId: PlanId, cycle: Cycle, chargeDate: string, attempt = 0): string {
  const base = `jt_${memberId}_${planId}_${cycle === "년" ? "y" : "m"}_${chargeDate.replace(/-/g, "")}`;
  return attempt > 0 ? `${base}_r${attempt}` : base;
}

/** 주문번호에서 무엇을 주문한 것인지 되읽는다. 웹훅의 금액 대조가 이 값을 쓴다. */
export function parseOrderId(id: string): { memberId: string; planId: PlanId; cycle: Cycle; date: string } | null {
  const m = /^jt_(.+?)_(free|basic|pro)_([my])_(\d{8})(?:_r\d+)?$/.exec(id);
  if (!m) return null;
  return { memberId: m[1], planId: m[2] as PlanId, cycle: m[3] === "y" ? "년" : "월", date: m[4] };
}

/** 화면에 보이는 카드 표기. 우리가 가진 건 PG 가 내려준 마스킹 값뿐이다. */
export type CardInfo = { issuer: string; last4: string; kind: "신용" | "체크"; billingKeyAt: string };

export function maskCard(c: CardInfo): string {
  return `${c.issuer} ${c.kind}카드 ···· ${c.last4}`;
}

export type PgName = "portone" | "toss";
export const PG_LABEL: Record<PgName, string> = { portone: "포트원", toss: "토스페이먼츠" };
