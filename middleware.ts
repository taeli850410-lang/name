import { NextResponse, type NextRequest } from "next/server";
import { STUDIO_COOKIE, tokenFor } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const password = process.env.STUDIO_PASSWORD;
  if (!password) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/studio/login") || pathname.startsWith("/api/studio/login")) return NextResponse.next();

  const expected = await tokenFor(password);
  const got = req.cookies.get(STUDIO_COOKIE)?.value;
  if (got === expected) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "스튜디오 로그인이 필요합니다." }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/studio/login";
  url.search = "";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/studio/:path*", "/api/studio/:path*"],
};
