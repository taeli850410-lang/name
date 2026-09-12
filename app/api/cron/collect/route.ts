import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/auth";
import { runCollect } from "@/lib/collect";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Vercel Cron: 보도자료·기사 수집. CRON_SECRET 이 있으면 Authorization: Bearer 헤더를 확인합니다. */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const stats = await runCollect({ enrich: true, enrichLimit: 3 });
    return NextResponse.json({ ok: true, stats });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
