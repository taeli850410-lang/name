import { NextResponse } from "next/server";
import { refreshMarket } from "@/lib/market";
import { getMarket, getMeta, saveMarket, saveMeta } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  try {
    const current = await getMarket();
    const { doc, notes } = await refreshMarket(current);
    await saveMarket(doc);
    const meta = await getMeta();
    await saveMeta({ ...meta, lastMarketAt: new Date().toISOString() });
    return NextResponse.json({ notes, market: doc });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
