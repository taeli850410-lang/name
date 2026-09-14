import { NextResponse, type NextRequest } from "next/server";
import { STUDIO_COOKIE, tokenFor } from "@/lib/auth";
import { storedToken } from "@/lib/authStore";

/**
 * 스튜디오 보호. 비밀번호는 두 곳에서 올 수 있습니다.
 *
 *   환경변수 STUDIO_PASSWORD  Vercel 에 넣고 재배포해야 걸립니다. 저장소와 무관해서 가장 확실합니다.
 *   저장소에 둔 비밀번호       관리자 → 접근 관리에서 바로 겁니다. 재배포가 필요 없습니다.
 *
 * 둘 다 없으면 지금처럼 열려 있습니다. 둘 다 있으면 어느 쪽으로 로그인해도 들어옵니다 —
 * 환경변수를 넣어 둔 사무소가 화면에서 비밀번호를 바꿔도 잠기지 않게.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/studio/login") || pathname.startsWith("/api/studio/login")) return NextResponse.next();

  const envPassword = process.env.STUDIO_PASSWORD;
  const [envToken, kvToken] = await Promise.all([envPassword ? tokenFor(envPassword) : Promise.resolve(null), storedToken()]);
  const expected = [envToken, kvToken].filter((t): t is string => Boolean(t));
  if (expected.length === 0) return NextResponse.next();

  const got = req.cookies.get(STUDIO_COOKIE)?.value;
  if (got && expected.includes(got)) return NextResponse.next();

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
