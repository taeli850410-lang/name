import { isImageId } from "@/lib/bannerImage";
import { getBannerImage } from "@/lib/repo";

export const dynamic = "force-dynamic";

/**
 * 배너 그림을 내줍니다.
 *
 * 스튜디오 아래가 아니라 여기 있는 이유는, **고객이 열어야 하기 때문입니다.** 비밀번호를
 * 걸면 /studio 아래는 미들웨어가 막는데, 그림이 막히면 EDM 에 빈 자리가 남습니다.
 * 주소에 든 것은 사무소가 스스로 올린 홍보물이라 가려야 할 것이 아닙니다.
 *
 * 주소에 ?v= 가 붙어 오고 새로 올리면 그 값이 바뀝니다. 그래서 오래 캐시해도 낡은 그림이
 * 남지 않습니다.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isImageId(id)) return new Response("잘못된 주소입니다.", { status: 400 });

  const img = await getBannerImage(id);
  if (!img) return new Response("그림이 없습니다.", { status: 404 });

  let bytes: Buffer;
  try {
    bytes = Buffer.from(img.data, "base64");
  } catch {
    return new Response("그림을 읽지 못했습니다.", { status: 500 });
  }

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": img.type,
      "Content-Length": String(bytes.length),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
