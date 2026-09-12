import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/auth";
import { refreshMarket } from "@/lib/market";
import { getMarket, getMeta, saveMarket, saveMeta } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Vercel Cron: 안양 실거래 집계와 기준금리 갱신. API 키가 없으면 저장된 값을 유지합니다. */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const { doc, notes } = await refreshMarket(await getMarket());
    await saveMarket(doc);
    const meta = await getMeta();
    await saveMeta({ ...meta, lastMarketAt: new Date().toISOString() });
    return NextResponse.json({ ok: true, notes });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
