/**
 * 배너에 올린 그림.
 *
 * 사무소가 파일을 고르면 **브라우저에서 먼저 1200px 로 줄여** 올립니다. 그래서 서버에
 * 닿는 것은 늘 배너에 쓸 만한 크기이고, 원본이 8MB 짜리 사진이어도 상관없습니다.
 *
 * 그림은 배너 목록과 **다른 키에** 한 장씩 따로 둡니다. 목록에 같이 넣으면 배너 스무 장을
 * 저장할 때 그림 스무 장이 한 번에 날아가는데, Upstash 는 한 번에 1MB 까지만 받습니다.
 * 전에 EDM 100통을 넓은 영상 목록과 같이 저장하려다 1.1MB 로 넘쳐서 되돌린 적이 있습니다.
 *
 * 파일 저장소(Blob)를 따로 붙이지 않은 것은 설정 때문입니다. 그쪽을 쓰면 Vercel 화면에서
 * 저장소를 만들고 토큰을 환경변수에 넣고 다시 배포해야 합니다. 지금 쓰는 Upstash 는 이미
 * 붙어 있어서, 사무소가 더 할 일이 없습니다.
 */

/** 브라우저에서 줄일 때 맞출 가로 길이. 화면에 600px 로 들어가니 두 배입니다 */
export const IMAGE_WIDTH = 1200;

/** 저장할 수 있는 base64 길이. Upstash 가 한 번에 받는 1MB 안에 넉넉히 들어갑니다 */
export const IMAGE_BASE64_MAX = 600 * 1024;

/** 브라우저가 줄이기 전 원본으로 받아 줄 크기. 요즘 폰 사진 한 장이 5~8MB 입니다 */
export const IMAGE_SOURCE_MAX = 20 * 1024 * 1024;

export const IMAGE_TYPES = ["image/webp", "image/jpeg", "image/png"] as const;
export type BannerImageType = (typeof IMAGE_TYPES)[number];

export interface BannerImage {
  type: BannerImageType;
  /** 그림 자체를 base64 로. 저장소가 문자열만 받습니다 */
  data: string;
  at: string;
}

/** 그림 주소에 쓸 수 있는 id. 저장소 키를 만들 때 쓰므로 다른 키로 새지 않게 좁게 잡습니다 */
const ID = /^[A-Za-z0-9_-]{1,64}$/;

export function isImageId(id: string): boolean {
  return ID.test(id);
}

export function imageKey(id: string): string {
  return `banner-img-${id}`;
}

/** 배너에 넣을 주소. ?v= 를 붙여 새로 올린 그림이 곧바로 보이게 합니다 */
export function imageHref(id: string, at = Date.now()): string {
  return `/api/banner-image/${id}?v=${at}`;
}

/** 우리가 내주는 그림 주소인가. 배너를 지울 때 딸린 그림도 같이 지우려고 id 를 꺼냅니다 */
export function imageIdOf(url: string): string | null {
  const m = /^\/api\/banner-image\/([A-Za-z0-9_-]{1,64})(?:\?|$)/.exec(url.trim());
  return m ? m[1] : null;
}

/** data:image/…;base64,… 한 줄을 풀어 봅니다. 아니면 null */
export function parseDataUrl(raw: string): { type: BannerImageType; data: string } | null {
  const m = /^data:([a-z/+-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(raw.trim());
  if (!m) return null;
  const type = m[1].toLowerCase() as BannerImageType;
  if (!IMAGE_TYPES.includes(type)) return null;
  return { type, data: m[2] };
}
