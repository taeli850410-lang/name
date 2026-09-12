import { NextResponse } from "next/server";
import { runCollect } from "@/lib/collect";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  try {
    const stats = await runCollect({ enrich: true, enrichLimit: 2 });
    return NextResponse.json({ stats });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
