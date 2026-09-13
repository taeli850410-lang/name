import { NextResponse } from "next/server";
import { studioProtected } from "@/lib/auth";
import { llmEnabled } from "@/lib/enrich";
import { getMeta } from "@/lib/repo";
import { storeStatus } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const [meta, store] = await Promise.all([getMeta(), storeStatus()]);
  return NextResponse.json({
    ok: true,
    store: store.kind,
    persistent: store.persistent,
    storeError: store.error,
    studioProtected: studioProtected(),
    llm: llmEnabled(),
    lastCollectAt: meta.lastCollectAt,
    lastMarketAt: meta.lastMarketAt,
  });
}
