/**
 * PG 웹훅 수신.
 *
 * 웹훅은 "가서 확인해 보라"는 알림이지 결제 결과 자체가 아니다.
 * 본문을 그대로 믿고 이용기한을 늘리면, 누구든 이 주소로 성공 웹훅을
 * 흉내 내 유료 플랜을 공짜로 쓸 수 있다. 그래서 두 겹으로 본다.
 *
 *   1. 서명 검증 — 포트원은 Standard Webhooks 서명을 준다.
 *      토스페이먼츠는 서명이 없어 이 단계를 건너뛴다(그래서 2번이 더 중요하다).
 *   2. 재조회 대조 — PG API 로 그 결제를 다시 읽어 상태와 금액을 맞춰 본다.
 *      실제로 이용기한을 늘리는 근거는 웹훅 본문이 아니라 이 재조회 결과다.
 */
import { NextResponse } from "next/server";
import { parseOrderId, priceOf } from "@/lib/billing";
import { verifyWebhook } from "@/lib/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PG 에 그 결제를 다시 물어본다. 이용기한을 늘리는 근거는 이 응답뿐이다. */
async function refetch(pg: "portone" | "toss", id: string): Promise<{ status: string; amount: number } | null> {
  try {
    const res =
      pg === "portone"
        ? await fetch(`https://api.portone.io/payments/${encodeURIComponent(id)}`, {
            headers: { Authorization: `PortOne ${(process.env.PORTONE_API_SECRET || "").trim()}` },
            cache: "no-store",
          })
        : await fetch(`https://api.tosspayments.com/v1/payments/orders/${encodeURIComponent(id)}`, {
            headers: { Authorization: `Basic ${Buffer.from(`${(process.env.TOSS_SECRET_KEY || "").trim()}:`).toString("base64")}` },
            cache: "no-store",
          });
    if (!res.ok) return null;
    const b = (await res.json()) as Record<string, unknown>;
    return pg === "portone"
      ? { status: String(b.status ?? ""), amount: Number((b.amount as { total?: number })?.total ?? 0) }
      : { status: String(b.status ?? ""), amount: Number(b.totalAmount ?? 0) };
  } catch {
    return null;
  }
}

const PAID = new Set(["PAID", "DONE"]);

export async function POST(req: Request) {
  // 서명은 원문을 대상으로 하므로 파싱 전에 텍스트로 받는다
  const raw = await req.text();

  const portone = (process.env.PORTONE_API_SECRET || "").trim();
  const toss = (process.env.TOSS_SECRET_KEY || "").trim();
  // PG 가 하나도 설정되지 않았으면 받을 이유가 없다. 토스로 넘겨짚지 않는다.
  if (!portone && !toss) return NextResponse.json({ ok: false, why: "결제 대행사가 설정되지 않았습니다" }, { status: 503 });

  const pg: "portone" | "toss" = portone ? "portone" : "toss";

  if (pg === "portone") {
    const secret = (process.env.PORTONE_WEBHOOK_SECRET || "").trim();
    if (!secret) return NextResponse.json({ ok: false, why: "PORTONE_WEBHOOK_SECRET 이 없어 서명을 확인할 수 없습니다" }, { status: 503 });
    const v = verifyWebhook(raw, { id: req.headers.get("webhook-id"), timestamp: req.headers.get("webhook-timestamp"), signature: req.headers.get("webhook-signature") }, secret);
    if (!v.ok) return NextResponse.json({ ok: false, why: v.why }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, why: "본문을 읽을 수 없습니다" }, { status: 400 });
  }

  // 포트원은 data.paymentId, 토스는 orderId 로 온다
  const id = String((body.data as { paymentId?: string })?.paymentId ?? body.orderId ?? body.paymentId ?? "");
  if (!id) return NextResponse.json({ ok: false, why: "결제 식별자가 없습니다" }, { status: 400 });

  const fresh = await refetch(pg, id);
  if (!fresh) return NextResponse.json({ ok: false, why: "재조회에 실패해 처리를 보류했습니다" }, { status: 502 });

  if (!PAID.has(fresh.status)) {
    // 실패·취소도 그대로 기록한다. 재시도 일정은 실패 사유에 따라 정해진다.
    return NextResponse.json({ ok: true, handled: "not_paid", orderId: id, status: fresh.status });
  }

  // 주문번호에 박아 둔 플랜과 실제 입금액이 맞는지 본다.
  // 금액이 다르면 성공으로 처리하지 않는다 — 결제창 금액 위조가 여기서 걸린다.
  const parsed = parseOrderId(id);
  const expected = parsed ? priceOf(parsed.planId, parsed.cycle) : null;
  if (expected !== null && expected !== fresh.amount) {
    return NextResponse.json({ ok: false, why: "결제 금액이 주문과 다릅니다", orderId: id, expected, paid: fresh.amount }, { status: 409 });
  }

  // 여기서 이용기한을 늘린다. (프로토타입이라 저장소가 없어 결과만 돌려준다)
  return NextResponse.json({ ok: true, handled: "paid", orderId: id, amount: fresh.amount, planId: parsed?.planId ?? null });
}
