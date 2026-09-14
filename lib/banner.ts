import type { Banner, BannerPlace, BannerTone } from "./types";

/**
 * 사무소가 직접 쓰는 홍보 배너.
 *
 * 이 앱에서 사무소가 자유 문장을 넣는 거의 유일한 자리라, 다른 화면보다 검증을 세게 겁니다.
 * 그리고 영상 기사와 반대로 **발행 시점에 얼리지 않습니다** — 영상은 '그날의 기사'라 고정돼야
 * 하지만, 배너는 '지금 알리고 싶은 것'이라 이미 보낸 링크에서도 최신이 보여야 합니다.
 * 대신 기간이 지나면 스스로 사라집니다(endAt). 그래야 설 연휴 안내가 3월까지 남지 않습니다.
 */

export const BANNER_TONES: BannerTone[] = ["navy", "green", "gold", "plain"];
export const BANNER_PLACES: BannerPlace[] = ["customer", "broker"];

export const TONE_LABEL: Record<BannerTone, string> = {
  navy: "남색 (고객용 기본)",
  green: "초록 (중개사용 기본)",
  gold: "금색",
  plain: "테두리만",
};

export const PLACE_LABEL: Record<BannerPlace, string> = {
  customer: "고객용 EDM",
  broker: "중개사용 브리핑",
};

export const TITLE_MAX = 30;
export const BODY_MAX = 90;
export const CTA_MAX = 24;
export const BANNER_MAX = 20;

/** 버튼 주소로 허용하는 것. javascript: 같은 건 들어올 자리가 없습니다 */
const SAFE_URL = /^(https?:\/\/|tel:|mailto:)/i;

/**
 * 그림 주소로 받는 것 둘.
 *
 * 하나는 우리가 직접 내주는 주소입니다 — 사무소가 파일을 올리면 이 모양이 됩니다.
 * 다른 하나는 남의 주소(http · https)입니다. 이미 어딘가에 올려 둔 그림을 그대로 쓸 때입니다.
 *
 * 그림을 data: 로 통째로 붙여 넣는 것은 막습니다. 저장소가 한 번에 받는 양(1MB)을 배너
 * 한 장이 다 먹습니다. 올린 그림은 배너 목록과 다른 키에 따로 둡니다(lib/bannerImage.ts).
 *
 * `//다른곳` 같은 주소가 새지 않도록 두 번째 글자까지 못 박아 둡니다.
 */
const SAFE_IMAGE_URL = /^(https?:\/\/|\/api\/banner-image\/[A-Za-z0-9_-]{1,64}(?:\?|$))/i;

export function isSafeBannerUrl(url: string): boolean {
  return SAFE_URL.test(url.trim());
}

export function isSafeImageUrl(url: string): boolean {
  return SAFE_IMAGE_URL.test(url.trim());
}

/** 저장 전에 거는 검증. 사람이 읽는 문장으로 돌려줍니다 */
export function validateBanner(b: Banner): string[] {
  const errors: string[] = [];
  const title = b.title.trim();
  if (!title) errors.push("제목을 넣으세요.");
  else if (title.length > TITLE_MAX) errors.push(`제목은 ${TITLE_MAX}자까지입니다. 지금 ${title.length}자입니다.`);
  if (b.body.trim().length > BODY_MAX) errors.push(`본문은 ${BODY_MAX}자까지입니다. 지금 ${b.body.trim().length}자입니다.`);
  if (b.ctaLabel.trim().length > CTA_MAX) errors.push(`버튼 글자는 ${CTA_MAX}자까지입니다.`);

  const url = b.ctaUrl.trim();
  if (url && !isSafeBannerUrl(url)) errors.push("버튼 주소는 http · https · tel: · mailto: 만 넣을 수 있습니다.");
  if (url && !b.ctaLabel.trim()) errors.push("버튼 주소를 넣었으면 버튼에 쓸 글자도 넣으세요.");
  if (!url && b.ctaLabel.trim()) errors.push("버튼 글자를 넣었으면 눌렀을 때 갈 주소도 넣으세요.");

  const img = b.imageUrl.trim();
  if (img && !isSafeImageUrl(img)) {
    errors.push("그림은 파일을 올리거나, http · https 로 시작하는 주소를 넣으세요.");
  }

  if (b.startAt && b.endAt && b.startAt > b.endAt) errors.push("노출 시작일이 종료일보다 뒤입니다.");
  if (b.where.length === 0) errors.push("노출할 곳을 최소 한 곳은 고르세요. 지금은 아무 데도 안 보입니다.");
  return errors;
}

/** 저장소에서 읽은 값을 믿지 않고 한 번 더 다듬습니다 — 손으로 고친 JSON 이 들어올 수 있습니다 */
export function normalizeBanner(raw: Partial<Banner>, fallbackId: string): Banner {
  const where = Array.isArray(raw.where) ? BANNER_PLACES.filter((p) => raw.where!.includes(p)) : [];
  const tone = BANNER_TONES.includes(raw.tone as BannerTone) ? (raw.tone as BannerTone) : "navy";
  const date = (v: unknown): string | null => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : fallbackId,
    title: String(raw.title ?? "").trim().slice(0, TITLE_MAX),
    body: String(raw.body ?? "").trim().slice(0, BODY_MAX),
    ctaLabel: String(raw.ctaLabel ?? "").trim().slice(0, CTA_MAX),
    ctaUrl: isSafeBannerUrl(String(raw.ctaUrl ?? "")) ? String(raw.ctaUrl).trim() : "",
    imageUrl: isSafeImageUrl(String(raw.imageUrl ?? "")) ? String(raw.imageUrl).trim() : "",
    tone,
    where: where.length ? where : ["customer"],
    isAd: raw.isAd !== false,
    startAt: date(raw.startAt),
    endAt: date(raw.endAt),
    enabled: raw.enabled !== false,
    order: Number.isFinite(raw.order) ? Number(raw.order) : 0,
  };
}

/** 오늘(YYYY-MM-DD, 한국 시간)을 기간 비교에 쓸 문자열로 */
export function todayKst(now = Date.now()): string {
  return new Date(now + 9 * 3600000).toISOString().slice(0, 10);
}

/**
 * 지금 이 화면에 걸 배너 한 장. 여러 장을 돌리지 않습니다 —
 * 켜져 있고, 오늘이 기간 안이고, 그 화면을 대상으로 고른 것 중 order 가 가장 앞선 하나.
 * 맞는 것이 없으면 undefined 를 돌려주고, 그러면 배너 자리 자체가 안 그려집니다.
 */
export function activeBanner(banners: Banner[], where: BannerPlace, now = Date.now()): Banner | undefined {
  const day = todayKst(now);
  return banners
    .filter((b) => b.enabled && b.where.includes(where) && b.title.trim())
    .filter((b) => (!b.startAt || b.startAt <= day) && (!b.endAt || day <= b.endAt))
    .sort((a, b) => (a.order !== b.order ? a.order - b.order : a.id.localeCompare(b.id)))[0];
}

/** 목록 화면에 쓸 한 줄 설명 — 왜 안 보이는지 바로 알 수 있게 */
export function bannerState(b: Banner, now = Date.now()): { label: string; tone: "on" | "off" | "wait" | "done" } {
  if (!b.enabled) return { label: "꺼짐", tone: "off" };
  const day = todayKst(now);
  if (b.startAt && day < b.startAt) return { label: `${b.startAt}부터`, tone: "wait" };
  if (b.endAt && day > b.endAt) return { label: `${b.endAt}에 끝남`, tone: "done" };
  return { label: "노출 중", tone: "on" };
}
