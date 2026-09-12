import { NextResponse } from "next/server";
import { buildDraft, publishLetter, validateLetter } from "@/lib/letter";
import { getIssues, getLetters, getMarket, getSettings, saveLetter } from "@/lib/repo";
import type { Letter, Period, Segment } from "@/lib/types";

export const dynamic = "force-dynamic";

const PERIODS: Period[] = ["daily", "weekly", "monthly"];
const SEGMENTS: Segment[] = ["first", "move", "asset"];

function siteUrl(req: Request): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, "");
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  return `${proto}://${host}`;
}

export async function GET() {
  const letters = await getLetters();
  return NextResponse.json({ letters });
}

export async function POST(req: Request) {
  let body: { action?: string; period?: Period; segment?: Segment; dong?: string | null; comment?: string; letter?: Letter };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  if (body.action === "draft") {
    const period = PERIODS.includes(body.period as Period) ? (body.period as Period) : "weekly";
    const segment = SEGMENTS.includes(body.segment as Segment) ? (body.segment as Segment) : "first";
    const [issues, office, market] = await Promise.all([getIssues(), getSettings(), getMarket()]);
    const letter = buildDraft(issues, office, market, { period, segment, dong: body.dong ?? null, comment: body.comment });
    return NextResponse.json({ letter, validation: validateLetter(letter) });
  }

  if (body.action === "publish") {
    const draft = body.letter;
    if (!draft || !Array.isArray(draft.issues)) return NextResponse.json({ error: "초안이 없습니다." }, { status: 400 });
    const office = await getSettings();
    const candidate: Letter = { ...draft, office };
    const validation = validateLetter(candidate);
    if (validation.errors.length) return NextResponse.json({ error: "검증에 실패했습니다.", validation }, { status: 422 });
    const published = publishLetter(candidate);
    await saveLetter(published);
    return NextResponse.json({ letter: published, url: `${siteUrl(req)}/l/${published.id}`, validation });
  }

  return NextResponse.json({ error: "action 은 draft 또는 publish 여야 합니다." }, { status: 400 });
}
