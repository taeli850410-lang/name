import { NextResponse } from "next/server";
import { getIssue, updateIssue } from "@/lib/repo";
import type { Issue } from "@/lib/types";

export const dynamic = "force-dynamic";

const ALLOWED: (keyof Issue)[] = [
  "customer",
  "broker",
  "personas",
  "agency",
  "agencyGroup",
  "status",
  "topic",
  "region",
  "dong",
  "effectiveAt",
  "officialUrl",
  "review",
  "enrichedBy",
];

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const issue = await getIssue(id);
  if (!issue) return NextResponse.json({ error: "이슈를 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ issue });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: Partial<Issue>;
  try {
    body = (await req.json()) as Partial<Issue>;
  } catch {
    return NextResponse.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }
  const patch: Partial<Issue> = {};
  for (const k of ALLOWED) {
    if (k in body) (patch as Record<string, unknown>)[k] = body[k];
  }
  const issue = await updateIssue(id, patch);
  if (!issue) return NextResponse.json({ error: "이슈를 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ issue });
}
