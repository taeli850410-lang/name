import { NextResponse } from "next/server";
import { getSettings, resetIssuesToSeed, saveSettings } from "@/lib/repo";
import { TOPICS } from "@/lib/taxonomy";
import type { Office, Topic } from "@/lib/types";

export const dynamic = "force-dynamic";

/** 문자열 필드만 화이트리스트로 받습니다. focusTopics(배열)는 아래에서 따로 검증합니다. */
type TextKey = Extract<{ [K in keyof Office]-?: string extends NonNullable<Office[K]> ? K : never }[keyof Office], string>;
const KEYS: TextKey[] = ["officeName", "brandName", "repName", "registrationNo", "phone", "address", "email", "kakaoUrl", "unsubscribeUrl", "privacyUrl", "sido", "sigungu", "slogan", "defaultComment", "areaLabel", "videoBrand"];

const strings = (v: unknown, re: RegExp): string[] =>
  Array.isArray(v) ? Array.from(new Set(v.map((x) => String(x ?? "").trim()).filter((x) => re.test(x)))) : [];

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
  if (typeof body.showVideos === "boolean") next.showVideos = body.showVideos;
  // 채널 주소·@핸들·UC 아이디. 해석은 수집할 때 하므로 여기서는 모양만 봅니다
  if (Array.isArray(body.videoSources)) next.videoSources = strings(body.videoSources, /^(https?:\/\/\S+|@[\w.\-가-힣]{2,40}|(?:UC|PL|UU)[\w-]{16,})$/);
  if (body.scope === "national" || body.scope === "local") next.scope = body.scope;
  if (Array.isArray(body.dongs)) next.dongs = strings(body.dongs, /^.{1,20}$/);
  if (Array.isArray(body.lawdCodes)) next.lawdCodes = strings(body.lawdCodes, /^\d{5}$/);
  // 전국구로 돌리면 지역 값은 비워 둡니다 — '우리 지역' 분류가 생기지 않게
  if (next.scope !== "local") {
    next.sido = "";
    next.sigungu = "";
    next.dongs = [];
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
