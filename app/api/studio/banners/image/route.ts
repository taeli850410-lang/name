import { NextResponse } from "next/server";
import { IMAGE_BASE64_MAX, imageHref, isImageId, parseDataUrl } from "@/lib/bannerImage";
import { saveBannerImage } from "@/lib/repo";

export const dynamic = "force-dynamic";

/**
 * 배너 그림 한 장을 받습니다.
 *
 * 브라우저가 이미 1200px 로 줄여서 보내므로 여기서는 다시 줄이지 않습니다 —
 * 서버에서 그림을 다루려면 라이브러리가 하나 더 붙는데, 줄이는 일은 이미 끝나 있습니다.
 * 대신 들어온 것이 정말 그림인지, 저장소가 받아 줄 크기인지만 봅니다.
 */
export async function POST(req: Request) {
  let body: { id?: unknown; dataUrl?: unknown };
  try {
    body = (await req.json()) as { id?: unknown; dataUrl?: unknown };
  } catch {
    return NextResponse.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const id = String(body.id ?? "");
  if (!isImageId(id)) return NextResponse.json({ error: "배너를 먼저 고르세요." }, { status: 400 });

  const parsed = parseDataUrl(String(body.dataUrl ?? ""));
  if (!parsed) {
    return NextResponse.json({ error: "그림 파일만 올릴 수 있습니다. JPG · PNG · WebP 를 고르세요." }, { status: 415 });
  }
  if (parsed.data.length > IMAGE_BASE64_MAX) {
    return NextResponse.json(
      { error: `그림이 너무 큽니다(${Math.round(parsed.data.length / 1024)}KB). 더 작은 파일로 올려 주세요.` },
      { status: 413 },
    );
  }

  const at = Date.now();
  try {
    await saveBannerImage(id, { type: parsed.type, data: parsed.data, at: new Date(at).toISOString() });
  } catch (e) {
    return NextResponse.json({ error: `그림을 저장하지 못했습니다. ${(e as Error).message}` }, { status: 502 });
  }
  return NextResponse.json({ url: imageHref(id, at) });
}
