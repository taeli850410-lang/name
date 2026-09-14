import { NextResponse } from "next/server";
import { BANNER_MAX, normalizeBanner, validateBanner } from "@/lib/banner";
import { getBanners, saveBanners } from "@/lib/repo";
import type { Banner } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ banners: await getBanners() });
}

/**
 * 목록을 통째로 받습니다. 배너는 많아야 스무 장이고 순서가 곧 우선순위라,
 * 한 장씩 고치는 것보다 화면에 보이는 그대로 저장하는 편이 어긋날 일이 없습니다.
 */
export async function PUT(req: Request) {
  let body: { banners?: unknown };
  try {
    body = (await req.json()) as { banners?: unknown };
  } catch {
    return NextResponse.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }
  if (!Array.isArray(body.banners)) {
    return NextResponse.json({ error: "banners 는 배열이어야 합니다." }, { status: 400 });
  }
  if (body.banners.length > BANNER_MAX) {
    return NextResponse.json({ error: `배너는 ${BANNER_MAX}장까지 둘 수 있습니다.` }, { status: 400 });
  }

  // 순서는 화면에 놓인 그대로 매깁니다 — 사무소가 위아래로 옮긴 것이 곧 우선순위입니다
  const list: Banner[] = body.banners.map((b, i) => ({ ...normalizeBanner(b as Partial<Banner>, `banner-${Date.now()}-${i}`), order: i }));

  const problems = list.flatMap((b, i) => validateBanner(b).map((m) => `${i + 1}번째 배너: ${m}`));
  if (problems.length) return NextResponse.json({ error: problems.join("\n"), problems }, { status: 422 });

  await saveBanners(list);
  return NextResponse.json({ banners: list });
}
