import { NextResponse } from "next/server";
import { studioProtected } from "@/lib/auth";
import { llmEnabled } from "@/lib/enrich";
import { getMeta } from "@/lib/repo";
import { storeEnvNames, storeStatus } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const [meta, store] = await Promise.all([getMeta(), storeStatus()]);
  return NextResponse.json({
    ok: true,
    // production | preview | development — 변수의 환경 체크와 맞춰 볼 값입니다
    env: process.env.VERCEL_ENV ?? "local",
    store: store.kind,
    persistent: store.persistent,
    storeError: store.error,
    storeVars: storeEnvNames(),
    studioProtected: studioProtected(),
    llm: llmEnabled(),
    lastCollectAt: meta.lastCollectAt,
    lastMarketAt: meta.lastMarketAt,
  });
}
