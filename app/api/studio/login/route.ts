import { NextResponse } from "next/server";
import { STUDIO_COOKIE, tokenFor } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const password = process.env.STUDIO_PASSWORD;
  if (!password) return NextResponse.json({ ok: true, open: true });
  const body = (await req.json().catch(() => ({}))) as { password?: string };
  if (!body.password || body.password !== password) {
    return NextResponse.json({ error: "비밀번호가 맞지 않습니다." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(STUDIO_COOKIE, await tokenFor(password), {
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
