import { NextResponse } from "next/server";
import { getSettings, resetIssuesToSeed, saveSettings } from "@/lib/repo";
import { TOPICS } from "@/lib/taxonomy";
import type { Office, Topic } from "@/lib/types";

export const dynamic = "force-dynamic";

/** 문자열 필드만 화이트리스트로 받습니다. focusTopics(배열)는 아래에서 따로 검증합니다. */
type TextKey = Extract<{ [K in keyof Office]-?: NonNullable<Office[K]> extends string ? K : never }[keyof Office], string>;
const KEYS: TextKey[] = ["officeName", "brandName", "repName", "registrationNo", "phone", "address", "email", "kakaoUrl", "unsubscribeUrl", "privacyUrl", "slogan", "defaultComment", "areaLabel"];

export async function GET() {
  return NextResponse.json({ office: await getSettings() });
}

export async function PUT(req: Request) {
  let body: Partial<Office>;
  try {
    body = (await req.json()) as Partial<Office>;
  } catch {
    return NextResponse.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }
  const current = await getSettings();
  const next: Office = { ...current };
  for (const k of KEYS) if (typeof body[k] === "string") next[k] = (body[k] as string).trim();
  if (Array.isArray(body.focusTopics)) {
    next.focusTopics = Array.from(new Set(body.focusTopics.filter((t): t is Topic => TOPICS.includes(t as Topic))));
  }
  await saveSettings(next);
  return NextResponse.json({ office: next });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  if (body.action === "reset-issues") {
    const issues = await resetIssuesToSeed();
    return NextResponse.json({ ok: true, count: issues.length });
  }
  return NextResponse.json({ error: "알 수 없는 action" }, { status: 400 });
}
