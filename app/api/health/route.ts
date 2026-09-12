import { NextResponse } from "next/server";
import { studioProtected } from "@/lib/auth";
import { llmEnabled } from "@/lib/enrich";
import { getMeta } from "@/lib/repo";
import { storeStatus } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const meta = await getMeta();
  return NextResponse.json({
    ok: true,
    store: storeStatus().kind,
    persistent: storeStatus().persistent,
    studioProtected: studioProtected(),
    llm: llmEnabled(),
    lastCollectAt: meta.lastCollectAt,
    lastMarketAt: meta.lastMarketAt,
  });
}
