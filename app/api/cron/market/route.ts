import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/auth";
import { applyArea, refreshMarket } from "@/lib/market";
import { getMarket, getMeta, getSettings, saveMarket, saveMeta } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Vercel Cron: 설정한 지역의 실거래 집계와 기준금리 갱신. API 키가 없으면 저장된 값을 유지합니다. */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const [current, office] = await Promise.all([getMarket(), getSettings()]);
    const { doc, notes } = await refreshMarket(applyArea(current, office));
    await saveMarket(doc);
    const meta = await getMeta();
    await saveMeta({ ...meta, lastMarketAt: new Date().toISOString() });
    return NextResponse.json({ ok: true, notes });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
