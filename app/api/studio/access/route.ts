import { NextResponse } from "next/server";
import { STUDIO_COOKIE, tokenFor } from "@/lib/auth";
import { canStorePassword, saveStoredToken, storedToken } from "@/lib/authStore";

export const dynamic = "force-dynamic";

const MIN = 4;

export async function GET() {
  return NextResponse.json({
    envPassword: Boolean(process.env.STUDIO_PASSWORD),
    stored: Boolean(await storedToken()),
    canStore: canStorePassword(),
  });
}

/**
 * 비밀번호를 걸거나 풉니다.
 *
 * 지금 잠겨 있다면 이 주소도 미들웨어가 막으므로, 들어와 있는 사람만 바꿀 수 있습니다.
 * 아직 안 잠겨 있다면 누구나 걸 수 있는데, 그건 지금 스튜디오 전체가 그런 상태라 같은 이야기입니다.
 * 원문은 저장하지 않고 SHA-256 값만 둡니다.
 */
export async function PUT(req: Request) {
  if (!canStorePassword()) {
    return NextResponse.json(
      { error: "영구 저장소(Upstash)가 연결돼 있어야 비밀번호를 저장할 수 있습니다. 로컬에서는 STUDIO_PASSWORD 환경변수를 쓰세요." },
      { status: 409 },
    );
  }
  const body = (await req.json().catch(() => ({}))) as { password?: string; clear?: boolean };

  if (body.clear) {
    await saveStoredToken(null);
    const res = NextResponse.json({ ok: true, stored: false });
    res.cookies.set(STUDIO_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  }

  const password = String(body.password ?? "").trim();
  if (password.length < MIN) {
    return NextResponse.json({ error: `비밀번호는 ${MIN}자 이상이어야 합니다.` }, { status: 400 });
  }

  const token = await tokenFor(password);
  await saveStoredToken(token);

  // 방금 건 비밀번호로 바로 로그인된 상태로 만들어 둡니다 — 안 그러면 저장하자마자 자기가 튕깁니다
  const res = NextResponse.json({ ok: true, stored: true });
  res.cookies.set(STUDIO_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
