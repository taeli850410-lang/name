import { NextResponse } from "next/server";
import { getSettings, resetIssuesToSeed, saveSettings } from "@/lib/repo";
import type { Office } from "@/lib/types";

export const dynamic = "force-dynamic";

const KEYS: (keyof Office)[] = ["officeName", "brandName", "repName", "registrationNo", "phone", "address", "email", "kakaoUrl", "unsubscribeUrl", "privacyUrl", "slogan", "defaultComment", "areaLabel"];

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
