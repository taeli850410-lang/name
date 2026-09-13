import { NextResponse } from "next/server";
import { enrichIssue, llmEnabled } from "@/lib/enrich";
import { getIssue, getSettings, updateIssue } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!llmEnabled()) return NextResponse.json({ error: "ANTHROPIC_API_KEY 가 설정되지 않아 자동 초안을 만들 수 없습니다." }, { status: 400 });
  const { id } = await params;
  const issue = await getIssue(id);
  if (!issue) return NextResponse.json({ error: "이슈를 찾을 수 없습니다." }, { status: 404 });
  try {
    const patch = await enrichIssue(issue, await getSettings());
    if (!patch) return NextResponse.json({ error: "모델이 초안을 반환하지 않았습니다. 다시 시도하세요." }, { status: 502 });
    const updated = await updateIssue(id, patch);
    return NextResponse.json({ issue: updated });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
