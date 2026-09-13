// 로컬 테스트용 샘플 RSS 서버. FEEDS_JSON 과 함께 써서 수집 파이프라인을 오프라인에서 검증합니다.
//   node scripts/dev-feed-server.mjs   (포트 3999)
//
// 실제 구글 뉴스·정책브리핑에 닿지 않는 환경에서 분류기(발표 주체 × 정책 단계 × 주제 × 지역)를
// 확인하려고 만든 고정 데이터입니다. 제목·요약은 분류 규칙을 시험하려고 손으로 쓴 가짜 문장입니다.
import http from "node:http";

const item = (title, link, desc, date, source) =>
  `<item><title><![CDATA[${title}]]></title><link>${link}</link>` +
  `<description><![CDATA[${desc}]]></description><pubDate>${date}</pubDate>` +
  (source ? `<source url="https://example.com">${source}</source>` : "") +
  `</item>`;

const wrap = (title, items) => `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${title}</title>${items.join("")}</channel></rss>`;

/** 정부 통합 보도자료 — 확정·시행 예정·지자체 고시, 부동산 무관 항목 섞음 */
const rss = wrap("정책브리핑 보도자료", [
  item(
    "국토교통부, 수도권 주택공급 확대를 위한 정비사업 규제 완화 방안 발표",
    "https://www.korea.kr/briefing/pressReleaseView.do?newsId=TEST0001",
    "<p>국토교통부는 9월 12일 수도권 주택공급 확대를 위해 재개발·재건축 정비사업 규제를 완화하는 방안을 발표했다. 시행일은 10월 1일.</p>",
    "Sat, 12 Sep 2026 10:00:00 +0900",
  ),
  item(
    "금융위원회, 가계부채 관리방안 확정…DSR 산정 방식 내년 1월 시행",
    "https://www.korea.kr/briefing/pressReleaseView.do?newsId=TEST0002",
    "금융위원회는 가계부채 관리방안을 확정했다. 주택담보대출 DSR 산정 방식 변경은 2027년 1월 1일 시행된다.",
    "Fri, 11 Sep 2026 11:00:00 +0900",
  ),
  item(
    "재정경제부, 소득세법 시행령 일부개정령안 입법예고",
    "https://www.korea.kr/briefing/pressReleaseView.do?newsId=TEST0003",
    "재정경제부는 양도소득세 특례 적용기한을 연장하는 소득세법 시행령 개정안을 입법예고했다. 의견제출 기한은 9월 30일.",
    "Thu, 10 Sep 2026 09:00:00 +0900",
  ),
  item(
    "국세청, 주택 양도소득세 신고 도움자료 배포",
    "https://www.korea.kr/briefing/pressReleaseView.do?newsId=TEST0004",
    "국세청은 1세대 1주택 비과세 요건을 정리한 양도소득세 신고 도움자료를 배포한다고 밝혔다.",
    "Wed, 09 Sep 2026 09:00:00 +0900",
  ),
  item(
    "해양수산부, 가을 연근해 어업 안전 점검 실시",
    "https://www.korea.kr/briefing/pressReleaseView.do?newsId=TEST0005",
    "연근해 어선 안전 점검",
    "Sat, 12 Sep 2026 09:00:00 +0900",
  ),
  item(
    "안양시, 관양동 수촌마을 재개발 정비구역 지정 고시",
    "https://www.anyang.go.kr/newtown/emwsWebView.do?key=2558&amp;regiNo=99999",
    "안양시는 동안구 관양동 1392번지 일원 수촌마을(A블럭) 재개발 정비구역 지정을 고시했다.",
    "Fri, 11 Sep 2026 15:00:00 +0900",
  ),
]);

/** 언론 기사 — 확정·검토·전망·통계·국회 심의가 섞이도록 */
const gnews = wrap("부동산 - Google 뉴스", [
  item(
    "한은 기준금리 연 3.00%로 인상…두 달 연속 - 연합뉴스",
    "https://news.google.com/rss/articles/TEST-A",
    "한국은행 금융통화위원회가 기준금리를 연 3.00%로 0.25%포인트 인상했다.",
    "Thu, 27 Aug 2026 01:30:00 GMT",
    "연합뉴스",
  ),
  item(
    "국토부, 재건축 초과이익 부담금 완화 검토…\"연내 방안 마련\" - 머니투데이",
    "https://news.google.com/rss/articles/TEST-B",
    "국토교통부가 재건축초과이익 환수 부담금 완화를 검토 중인 것으로 알려졌다. 구체적인 방안은 연내 마련될 전망이다.",
    "Wed, 09 Sep 2026 02:00:00 GMT",
    "머니투데이",
  ),
  item(
    "한국부동산원 \"9월 첫째 주 서울 아파트값 0.05% 상승\" - 뉴스1",
    "https://news.google.com/rss/articles/TEST-C",
    "한국부동산원 주간 아파트가격동향에 따르면 9월 첫째 주 서울 아파트 매매가격은 0.05% 올랐다. 전세가격지수는 보합이다.",
    "Thu, 04 Sep 2026 23:00:00 GMT",
    "뉴스1",
  ),
  item(
    "국회 국토위, 공인중개사법 개정안 법안소위 상정 - 이투데이",
    "https://news.google.com/rss/articles/TEST-D",
    "국회 국토교통위원회가 중개보수 산정 방식을 바꾸는 공인중개사법 개정안을 법안소위에 상정했다.",
    "Mon, 08 Sep 2026 02:00:00 GMT",
    "이투데이",
  ),
  item(
    "전문가들 \"금리 인상에도 수도권 집값 하락 제한적\" 전망 - 한국경제",
    "https://news.google.com/rss/articles/TEST-E",
    "부동산 전문가들은 기준금리 인상에도 수도권 집값 하락은 제한적일 것으로 관측했다.",
    "Fri, 05 Sep 2026 02:00:00 GMT",
    "한국경제",
  ),
  item(
    "대전시의회 \"둔산지구 재건축 분담금 완화해야\" - 굿모닝충청",
    "https://news.google.com/rss/articles/TEST-F",
    "대전시의회가 둔산지구 재건축 주민 분담금 완화를 촉구했다.",
    "Wed, 09 Sep 2026 02:00:00 GMT",
    "굿모닝충청",
  ),
  item(
    "국토부, 서울 강남3구 토지거래허가구역 재지정 - 서울경제",
    "https://news.google.com/rss/articles/TEST-G",
    "국토교통부는 서울 강남3구 일대 토지거래허가구역을 1년 재지정한다고 밝혔다. 10월 1일부터 적용된다.",
    "Tue, 02 Sep 2026 02:00:00 GMT",
    "서울경제",
  ),
  item(
    "GTX-C 창동·광운대 구간 착공…2030년 개통 목표 - 조선비즈",
    "https://news.google.com/rss/articles/TEST-H",
    "GTX-C 노선 창동·광운대 구간이 착공했다. 국토교통부는 2030년 개통을 목표로 한다고 밝혔다.",
    "Mon, 01 Sep 2026 02:00:00 GMT",
    "조선비즈",
  ),
  item(
    "서울시, 신속통합기획 재개발 후보지 24곳 선정 - 연합뉴스",
    "https://news.google.com/rss/articles/TEST-I",
    "서울시는 신속통합기획 재개발 후보지 24곳을 선정했다고 밝혔다. 자치구별 공모를 거쳐 확정했다.",
    "Wed, 10 Sep 2026 02:00:00 GMT",
    "연합뉴스",
  ),
  item(
    "부산 해운대 재건축 조합설립 인가…내년 상반기 시공사 선정 - 부산일보",
    "https://news.google.com/rss/articles/TEST-J",
    "부산 해운대구 한 재건축 단지가 조합설립 인가를 받았다. 내년 상반기 시공사를 선정할 예정이다.",
    "Tue, 09 Sep 2026 02:00:00 GMT",
    "부산일보",
  ),
  item(
    "전국 미분양 6만2천호…지방이 80% - 헤럴드경제",
    "https://news.google.com/rss/articles/TEST-K",
    "국토교통부 주택통계에 따르면 7월 말 전국 미분양 주택은 6만2천호로 집계됐다. 이 가운데 80%가 지방이다.",
    "Mon, 08 Sep 2026 02:00:00 GMT",
    "헤럴드경제",
  ),
]);

/** Atom 형식 — 입법예고 */
const atom = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"><title>테스트 Atom</title>
<entry><title>주택법 시행령 일부개정령안 입법예고</title>
<link href="https://opinion.lawmaking.go.kr/gcom/ogLmPp/TEST"/>
<updated>2026-09-10T00:00:00Z</updated>
<summary>국토교통부는 다세대주택 6층까지 건축을 허용하는 주택법 시행령 개정안을 입법예고했다. 의견제출 2026년 9월 28일까지.</summary></entry>
</feed>`;

http
  .createServer((req, res) => {
    const body = req.url?.startsWith("/gnews") ? gnews : req.url?.startsWith("/atom") ? atom : rss;
    res.writeHead(200, { "Content-Type": "application/rss+xml; charset=utf-8" });
    res.end(body);
  })
  .listen(3999, () => console.log("sample feed server on http://127.0.0.1:3999 (/rss /gnews /atom)"));
