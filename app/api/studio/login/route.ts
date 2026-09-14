import { NextResponse } from "next/server";
import { STUDIO_COOKIE, tokenFor } from "@/lib/auth";
import { storedToken } from "@/lib/authStore";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const envPassword = process.env.STUDIO_PASSWORD;
  const kvToken = await storedToken();
  if (!envPassword && !kvToken) return NextResponse.json({ ok: true, open: true });

  const body = (await req.json().catch(() => ({}))) as { password?: string };
  const given = String(body.password ?? "");
  if (!given) return NextResponse.json({ error: "비밀번호를 입력하세요." }, { status: 401 });

  // 어느 쪽 비밀번호로 들어와도 통과시킵니다. 쿠키에는 맞은 쪽 토큰을 심습니다
  const givenToken = await tokenFor(given);
  const ok = (envPassword && given === envPassword) || (kvToken && givenToken === kvToken);
  if (!ok) return NextResponse.json({ error: "비밀번호가 맞지 않습니다." }, { status: 401 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(STUDIO_COOKIE, givenToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(STUDIO_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
