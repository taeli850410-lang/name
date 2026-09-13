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

/** 유튜브 채널 Atom — YT_FEED_BASE=http://127.0.0.1:3999/yt 로 붙입니다 */
const ytEntry = (videoId, title, desc, published, channel, channelId) =>
  `<entry><id>yt:video:${videoId}</id><yt:videoId>${videoId}</yt:videoId><yt:channelId>${channelId}</yt:channelId>` +
  `<title>${title}</title><link rel="alternate" href="https://www.youtube.com/watch?v=${videoId}"/>` +
  `<author><name>${channel}</name></author><published>${published}</published>` +
  `<media:group><media:title>${title}</media:title>` +
  `<media:thumbnail url="http://127.0.0.1:3999/thumb?t=${encodeURIComponent(channel)}" width="480" height="360"/>` +
  `<media:description>${desc}</media:description></media:group></entry>`;

const ytFeed = (channel, channelId, entries) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">` +
  `<title>${channel}</title><yt:channelId>${channelId}</yt:channelId>${entries.join("")}</feed>`;

const YT = {
  UCTHCOPwqNfZ0uiKOvFyhGwg: ytFeed("연합뉴스TV", "UCTHCOPwqNfZ0uiKOvFyhGwg", [
    ytEntry(
      "yt0001",
      "[뉴스초점] 강남3구 토지거래허가 1년 재지정…실수요 영향은",
      "국토교통부가 서울 강남3구 토지거래허가구역을 1년 재지정했습니다. 실수요자 매매에 어떤 영향이 있는지 짚어봅니다.",
      "2026-09-12T09:10:00+00:00",
      "연합뉴스TV",
      "UCTHCOPwqNfZ0uiKOvFyhGwg",
    ),
    ytEntry("yt0002", "오늘의 증시 마감 시황", "코스피 코스닥 마감 시황입니다.", "2026-09-12T08:00:00+00:00", "연합뉴스TV", "UCTHCOPwqNfZ0uiKOvFyhGwg"),
    ytEntry(
      "yt0003",
      "전세 줄고 월세 늘고…서울 월세 160만원 시대",
      "한국부동산원 통계에서 서울 아파트 월세 평균이 160만원을 넘었습니다. 임대차 시장 흐름을 정리했습니다.",
      "2026-09-11T10:00:00+00:00",
      "연합뉴스TV",
      "UCTHCOPwqNfZ0uiKOvFyhGwg",
    ),
    ytEntry("yt0004", "24시간 뉴스 LIVE 스트리밍", "연합뉴스TV 24시간 라이브입니다. 부동산 주택 뉴스 포함.", "2026-09-13T00:00:00+00:00", "연합뉴스TV", "UCTHCOPwqNfZ0uiKOvFyhGwg"),
  ]),
  UCF8AeLlUbEpKju6v1H6p8Eg: ytFeed("한국경제TV", "UCF8AeLlUbEpKju6v1H6p8Eg", [
    ytEntry(
      "yt0101",
      "기준금리 또 올랐다…주택담보대출 이자 얼마나 늘까",
      "한국은행이 기준금리를 연 3.00%로 인상했습니다. 변동금리 주택담보대출 상환액이 얼마나 달라지는지 계산해 봤습니다.",
      "2026-09-12T02:30:00+00:00",
      "한국경제TV",
      "UCF8AeLlUbEpKju6v1H6p8Eg",
    ),
    ytEntry(
      "yt0102",
      "재건축 초과이익 부담금 완화 검토…조합들 셈법은",
      "국토교통부가 재건축초과이익 환수 부담금 완화를 검토합니다. 정비사업 조합의 분담금이 어떻게 달라질지 살펴봅니다.",
      "2026-09-10T04:00:00+00:00",
      "한국경제TV",
      "UCF8AeLlUbEpKju6v1H6p8Eg",
    ),
  ]),
  UCXiDk1r8MDRqTD0j2BxNWWQ: ytFeed("한국부동산원", "UCXiDk1r8MDRqTD0j2BxNWWQ", [
    ytEntry(
      "yt0201",
      "9월 첫째 주 주간 아파트가격동향 브리핑",
      "전국 아파트 매매가격지수와 전세가격지수 변동률을 한국부동산원이 직접 설명합니다.",
      "2026-09-09T01:00:00+00:00",
      "한국부동산원",
      "UCXiDk1r8MDRqTD0j2BxNWWQ",
    ),
  ]),
  // 집코노미 — 2026-09-13 업로드 재생목록 실제 15편(YouTube Data API playlistItems.list).
  // 설명문은 API 로 받을 수 없어 비워 두었습니다. 실제 RSS 에는 media:description 이 있어 더 많이 통과합니다.
  // 채널 피드와 업로드 재생목록(UU…)은 같은 내용이라 두 키에 같은 피드를 답니다.
  // 집코노미 — 2026-09-13 실제 업로드 15편. 제목·날짜는 playlistItems.list, 설명문은 videos.list 앞 150자.
  // 해시태그·구독 링크가 그대로 들어 있어 cleanDescription 이 무엇을 걷어내는지 보려고 원문 그대로 둡니다.
  // 채널 피드와 업로드 재생목록(UU…)은 같은 내용이라 두 키에 같은 피드를 답니다.
  // 집코노미 타임즈 재생목록(PLZtm8…) — 2026-09-13 기준 실제 6편.
  // 채널 전체(UC…/UU…)와 달리 쇼츠가 없고 주간 본편만 담깁니다. 설명문은 videos.list 원문 그대로라
  // cleanDescription 이 구독 링크·타임스탬프 목차를 어떻게 걷어내는지 그대로 확인됩니다.
  "PLZtm8tjZjNV6jjvdmjZ-zc9jz1qKHUInQ": ytFeed("집코노미", "UCAVdqlngIAxHtwlCA2hjv3A", [
    ytEntry("TOWywN1ic_k", "동탄, 집값 하극상 넘어 학군도 흔든다 | 집코노미 타임즈 | 부동산뉴스 총정리", "한 주 동안의 부동산 뉴스를 짚어보는 집코노미 타임즈 라이브입니다. 이번주엔 ①새 국면을 맞는 용산 개발과 ②청약통장 전환 ③새로운 자산층이 된 삼성전자/하이닉스 직원 등 한국경제신문의 주요 기사를 짚어봅니다.\n\n한국경제신문 구독하기📰 https://vo.la/N79F", "2026-09-10T14:34:45Z", "집코노미", "UCAVdqlngIAxHtwlCA2hjv3A"),
    ytEntry("iwfiSOS_WHE", "또 전부 바뀐 종부세 계산법 | 집코노미 타임즈 | 부동산뉴스 총정리", "한 주 동안의 부동산 뉴스를 짚어보는 집코노미 타임즈 라이브입니다. 이번주엔 ①부동산 시황과 ②이 대통령의 금리인상 경고 ③세제개편안 정부안 확정 등 한국경제신문의 주요 기사를 짚어봅니다.\n\n0:00 다시보기는 2배속 권장\n0:19 강남구청장 생각은..\n3:37 재건축", "2026-09-03T14:28:12Z", "집코노미", "UCAVdqlngIAxHtwlCA2hjv3A"),
    ytEntry("RHBzXEbDytU", "용산 vs 탄천 | 집코노미 타임즈 | 부동산뉴스 총정리", "한 주 동안의 부동산 뉴스를 짚어보는 집코노미 타임즈 라이브입니다. 이번주엔 ①기준금리와 ②세제개편안 후폭풍 ③용산공원을 둘러싼 주택공급 갈등 등 한국경제신문의 주요 기사를 짚어봅니다.\n\n0:00 다시보기는 2배속 권장\n0:26 기준금리 인상\n2:37 뉴홈 말바꾸기", "2026-08-27T02:32:12Z", "집코노미", "UCAVdqlngIAxHtwlCA2hjv3A"),
    ytEntry("5TU8OGdsKmI", "뜨거운 감자, 용산공원 | 집코노미 타임즈 | 부동산뉴스 총정리", "한 주 동안의 부동산 뉴스를 짚어보는 집코노미 타임즈 라이브입니다. 이번주엔 ①지자체별 세제개편안 대처 ②빌라시장 활성화 ③용산공원 주택공급 등 한국경제신문의 주요 기사를 짚어봅니다.\n\n0:00 다시보기는 2배속 권장\n0:24 우리집 종부세는 얼마?\n3:20 빌라의 시", "2026-08-20T14:30:24Z", "집코노미", "UCAVdqlngIAxHtwlCA2hjv3A"),
    ytEntry("UpFNC9aNUVc", "8·13 부동산대책 속성 요약 | 집코노미 타임즈", "예고됐던 부동산 종합대책이 나왔습니다. 그런데 국토교통부와 금융위원회가 준비한 자료를 합치면 80페이지 넘을 정도로 방대한 양이죠😅 그래서 집코노미가 요약했습니다. 바쁘신 형님들을 위한 정보 급행열차🚅\n\n#대출 #공공택지 #재건축 #부동산대책 #부동산정책\n\n한국경제신문", "2026-08-13T09:00:32Z", "집코노미", "UCAVdqlngIAxHtwlCA2hjv3A"),
    ytEntry("WycsrifU5LI", "대통령도 놀란 세제개편안 후폭풍 | 집코노미 타임즈 | 부동산뉴스 총정리", "한 주 동안의 부동산 뉴스를 짚어보는 집코노미 타임즈 라이브입니다. 이번주엔 ①세제개편안 영향으로 변화할 시장의 움직임과 ②이재명 대통령의 반응 ③쟁점사항 등 한국경제신문의 주요 기사를 짚어봅니다.\n\n0:00 다시보기는 2배속 권장\n0:29 제대로 설명했냐고 물은 대통", "2026-08-06T02:38:54Z", "집코노미", "UCAVdqlngIAxHtwlCA2hjv3A"),
  ]),
  UCCt6iN6nJemSe_OHRihYBAQ: ytFeed("매부리TV", "UCCt6iN6nJemSe_OHRihYBAQ", [
    ytEntry(
      "yt0501",
      "DSR 산정 바뀐다…내년 1월부터 대출 한도 얼마나 줄까",
      "금융위원회의 가계부채 관리방안으로 주택담보대출 한도가 어떻게 달라지는지 사례로 계산했습니다.",
      "2026-09-12T22:00:00+00:00",
      "매부리TV",
      "UCCt6iN6nJemSe_OHRihYBAQ",
    ),
  ]),
  // 재생목록 피드 — 그 목록에 담긴 영상만 옵니다 (KBS News 의 '부동산' 재생목록이라 가정)
  PLkbsRealEstateTest00000: ytFeed("KBS News", "UCcQTRi69dsVYHN3exePtZ1A", [
    ytEntry(
      "yt0601",
      "[뉴스9] 공시가격 현실화율 동결…보유세는 얼마나",
      "정부가 내년 공시가격 현실화율을 올해 수준으로 동결하기로 했습니다. 보유세 부담 변화를 짚었습니다.",
      "2026-09-12T12:00:00+00:00",
      "KBS News",
      "UCcQTRi69dsVYHN3exePtZ1A",
    ),
    ytEntry(
      "yt0602",
      "[집중취재] 지방 미분양 6만호…빈집 되는 새 아파트",
      "지방 미분양 물량이 6만 호를 넘었습니다. 준공 후에도 비어 있는 단지를 취재했습니다.",
      "2026-09-10T12:00:00+00:00",
      "KBS News",
      "UCcQTRi69dsVYHN3exePtZ1A",
    ),
  ]),
  UCmolitKOREALANDtest0000: ytFeed("국토교통부", "UCmolitKOREALANDtest0000", [
    ytEntry(
      "yt0301",
      "공동관리비 설명 의무화, 이렇게 달라집니다",
      "원룸·오피스텔 임대차 계약 전 공인중개사가 공동관리비를 설명하도록 하는 공인중개사법 시행규칙 개정 내용을 안내합니다.",
      "2026-09-08T05:00:00+00:00",
      "국토교통부",
      "UCmolitKOREALANDtest0000",
    ),
  ]),
};

http
  .createServer((req, res) => {
    const url = req.url ?? "/";
    if (url.startsWith("/thumb")) {
      // 샌드박스에서 i.ytimg.com 에 못 닿아서 스크린샷용으로 대신 그려 주는 자리표시자입니다.
      // 실제 유튜브 썸네일처럼 재생 단추는 그리지 않습니다 — 화면 쪽에서 얹습니다.
      const label = new URL(url, "http://x").searchParams.get("t") ?? "VIDEO";
      res.writeHead(200, { "Content-Type": "image/svg+xml; charset=utf-8" });
      res.end(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 270"><rect width="480" height="270" fill="#1b2435"/>` +
          `<rect x="0" y="214" width="480" height="56" fill="#0f1622"/>` +
          `<text x="24" y="250" fill="#c9a227" font-family="sans-serif" font-size="26" font-weight="700">${label}</text>` +
          `</svg>`,
      );
      return;
    }
    if (url.startsWith("/yt")) {
      const sp = new URL(url, "http://x").searchParams;
      const id = sp.get("channel_id") ?? sp.get("playlist_id") ?? "";
      res.writeHead(200, { "Content-Type": "application/atom+xml; charset=utf-8" });
      res.end(YT[id] ?? ytFeed("빈 채널", id, []));
      return;
    }
    const body = url.startsWith("/gnews") ? gnews : url.startsWith("/atom") ? atom : rss;
    res.writeHead(200, { "Content-Type": "application/rss+xml; charset=utf-8" });
    res.end(body);
  })
  .listen(3999, () => console.log("sample feed server on http://127.0.0.1:3999 (/rss /gnews /atom /yt?channel_id=…)"));
