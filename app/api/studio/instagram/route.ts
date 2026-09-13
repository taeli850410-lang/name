import { NextResponse } from "next/server";
import { newId } from "@/lib/format";
import { addInstaSave, deleteInstaSave, getInstaSaves } from "@/lib/repo";
import type { InstaSave, Segment } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ saves: await getInstaSaves() });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Partial<InstaSave> | null;
  if (!body || !body.issueId) return NextResponse.json({ error: "issueId 가 필요합니다." }, { status: 400 });
  const save: InstaSave = {
    id: newId("ig"),
    issueId: body.issueId,
    title: String(body.title || "").slice(0, 120),
    count: Math.max(1, Math.min(10, Number(body.count) || 5)),
    theme: String(body.theme || "navy"),
    template: String(body.template || "editorial"),
    segment: (["first", "move", "asset"].includes(String(body.segment)) ? body.segment : "first") as Segment,
    createdAt: new Date().toISOString(),
  };
  return NextResponse.json({ saves: await addInstaSave(save), save });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id 가 필요합니다." }, { status: 400 });
  return NextResponse.json({ saves: await deleteInstaSave(id) });
}
