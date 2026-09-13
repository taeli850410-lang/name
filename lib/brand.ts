/**
 * 서비스 이름. 두 줄 로고로 쓰입니다 — 흰 글씨 위, 금색 자간 넓은 줄 아래.
 * 스튜디오 상단 바와 고객용 레터 맨 위가 같은 값을 씁니다.
 *
 * 사무소가 설정에서 고치는 '브랜드 표기'(office.brandName)와는 다릅니다.
 * 그건 마스트헤드 아래 사무소의 브랜드고, 이건 서비스 자체의 이름입니다.
 */
export const SERVICE_BRAND = { line1: "REAL ESTATE", line2: "REPORT ALERT" } as const;

/**
 * 로고를 누르면 가는 곳 — 중개사용·고객용을 고르는 메인 화면.
 * NEXT_PUBLIC_SITE_URL 이 있으면 절대 주소로 만듭니다. 레터 HTML 을 발송 서비스에
 * 옮겨 붙였을 때 상대 주소는 그쪽 도메인으로 잘못 걸리기 때문입니다.
 */
export function serviceHome(): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  return base ? `${base}/` : "/";
}
