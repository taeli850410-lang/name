/**
 * 정기결제 — PG 프록시 (포트원 · 토스페이먼츠).
 *
 * 지켜야 하는 것 세 가지.
 *  1. 카드 정보는 이 서버를 지나가지 않는다. 브라우저가 PG 결제창에 직접 넣고,
 *     우리는 PG 가 돌려준 빌링키만 받는다. (여신전문금융업법)
 *  2. 금액은 요청 본문에서 읽지 않는다. PLANS 가격표에서 서버가 다시 계산한다.
 *     브라우저가 보낸 금액을 믿으면 1원 결제로 유료 플랜을 살 수 있다.
 *  3. 같은 결제는 같은 주문번호로 나간다. 재시도가 두 번 청구되면 안 된다.
 */
import { NextResponse } from "next/server";
import { orderId, planOf, priceOf, PG_LABEL, type Cycle, type PgName, type PlanId } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** 결제대행사 서버가 한국에 있다. */
export const preferredRegion = "icn1";

const TIMEOUT_MS = 15_000;

function pg(): PgName | null {
  if ((process.env.PORTONE_API_SECRET || "").trim()) return "portone";
  if ((process.env.TOSS_SECRET_KEY || "").trim()) return "toss";
  return null;
}

const ERRORS = {
  NO_KEY: {
    message: "결제 대행사(PG) 인증키가 설정되지 않았습니다.",
    hint: "포트원은 PORTONE_API_SECRET, 토스페이먼츠는 TOSS_SECRET_KEY 를 환경 변수에 넣고 다시 배포하세요.",
  },
  NO_BILLING_KEY: {
    message: "등록된 결제수단이 없습니다.",
    hint: "카드를 먼저 등록해 주세요. 카드 정보는 PG 에 저장되고 이 서비스는 빌링키만 보관합니다.",
  },
  BAD_PLAN: { message: "결제할 수 없는 플랜입니다.", hint: "플랜을 다시 선택해 주세요." },
  UPSTREAM: { message: "결제 대행사가 응답하지 않습니다.", hint: "잠시 뒤 다시 시도해 주세요. 중복 청구는 주문번호로 막습니다." },
  DECLINED: { message: "카드사가 결제를 거절했습니다.", hint: "카드 상태를 확인하거나 다른 카드를 등록해 주세요." },
  PG_AUTH: {
    message: "결제 대행사 인증에 실패했습니다.",
    hint: "회원의 카드 문제가 아닙니다. 서버의 PG 인증키가 잘못됐거나 만료됐습니다. 운영자에게 알려 주세요.",
  },
} as const;

function fail(code: keyof typeof ERRORS, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, code, ...ERRORS[code], ...extra }, { status });
}

async function callPg(url: string, init: RequestInit): Promise<{ status: number; body: Record<string, unknown> } | { error: "UPSTREAM" }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
    const text = await res.text();
    let body: Record<string, unknown> = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text.slice(0, 500) };
    }
    return { status: res.status, body };
  } catch {
    return { error: "UPSTREAM" };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const name = pg();
  return NextResponse.json({
    configured: Boolean(name),
    pg: name,
    label: name ? PG_LABEL[name] : null,
    webhook: Boolean((process.env.PORTONE_WEBHOOK_SECRET || "").trim()),
  });
}

/**
 * 빌링키로 한 건 결제한다.
 * 요청에서 받는 것은 "누가 · 어떤 플랜을 · 어떤 주기로" 까지다. 금액은 여기서 정한다.
 */
export async function POST(req: Request) {
  const name = pg();
  if (!name) return fail("NO_KEY", 503);

  let body: { memberId?: string; planId?: PlanId; cycle?: Cycle; billingKey?: string; customerKey?: string; chargeDate?: string; attempt?: number };
  try {
    body = await req.json();
  } catch {
    return fail("BAD_PLAN", 400);
  }

  const planId = body.planId as PlanId;
  const plan = planOf(planId);
  if (!planId || plan.id !== planId || plan.monthly === 0) return fail("BAD_PLAN", 400);

  const billingKey = String(body.billingKey ?? "").trim();
  if (!billingKey) return fail("NO_BILLING_KEY", 400);

  const memberId = String(body.memberId ?? "").trim() || "unknown";
  const cycle: Cycle = body.cycle === "년" ? "년" : "월";
  const chargeDate = String(body.chargeDate ?? "").slice(0, 10);
  const amount = priceOf(planId, cycle); // ← 가격표에서. 요청 본문에서 읽지 않는다.
  const id = orderId(memberId, planId, cycle, chargeDate, body.attempt ?? 0);
  const orderName = `부동산TALK ${plan.name} ${cycle} 이용권`;

  const r =
    name === "portone"
      ? await callPg(`https://api.portone.io/payments/${encodeURIComponent(id)}/billing-key`, {
          method: "POST",
          headers: { Authorization: `PortOne ${(process.env.PORTONE_API_SECRET || "").trim()}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            billingKey,
            orderName,
            customer: { id: memberId },
            amount: { total: amount },
            currency: "KRW",
          }),
        })
      : await callPg(`https://api.tosspayments.com/v1/billing/${encodeURIComponent(billingKey)}`, {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${(process.env.TOSS_SECRET_KEY || "").trim()}:`).toString("base64")}`,
            "Content-Type": "application/json",
            // 같은 키로 두 번 오면 토스가 앞의 결과를 그대로 돌려준다 — 중복 청구 방지
            "Idempotency-Key": id,
          },
          body: JSON.stringify({ customerKey: body.customerKey ?? memberId, amount, orderId: id, orderName }),
        });

  if ("error" in r) return fail("UPSTREAM", 502, { orderId: id });

  // PG 가 준 코드를 그대로 넘겨, 화면이 재시도할지 카드를 바꿀지 판단하게 한다
  const pgCode = String((r.body as { code?: string; type?: string }).code ?? (r.body as { type?: string }).type ?? "");
  const pgMessage = String((r.body as { message?: string }).message ?? "");

  // 우리 인증키 문제를 카드 거절로 알리면 회원이 멀쩡한 카드를 바꾸게 된다.
  if (r.status === 401 || r.status === 403) return fail("PG_AUTH", 502, { orderId: id, pgCode, pgMessage });
  // 대행사 장애(5xx)도 거절이 아니다. 재시도로 풀릴 수 있다.
  if (r.status >= 500) return fail("UPSTREAM", 502, { orderId: id, pgCode, pgMessage });
  if (r.status >= 400) return fail("DECLINED", 402, { orderId: id, pgCode, pgMessage });

  return NextResponse.json({ ok: true, pg: name, orderId: id, amount, planId, cycle, raw: r.body });
}
