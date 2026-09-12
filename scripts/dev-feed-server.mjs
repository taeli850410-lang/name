// 로컬 테스트용 샘플 RSS 서버. FEEDS_JSON 과 함께 써서 수집 파이프라인을 오프라인에서 검증합니다.
//   node scripts/dev-feed-server.mjs   (포트 3999)
import http from "node:http";

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>정책브리핑 보도자료</title>
<item><title><![CDATA[국토교통부, 수도권 주택공급 확대를 위한 정비사업 규제 완화 방안 발표]]></title>
<link>https://www.korea.kr/briefing/pressReleaseView.do?newsId=TEST0001</link>
<description><![CDATA[<p>국토교통부는 9월 12일 수도권 주택공급 확대를 위해 재개발·재건축 정비사업 규제를 완화하는 방안을 발표했다. 시행일은 10월 1일.</p>]]></description>
<pubDate>Sat, 12 Sep 2026 10:00:00 +0900</pubDate></item>
<item><title>해양수산부, 가을 연근해 어업 안전 점검 실시</title>
<link>https://www.korea.kr/briefing/pressReleaseView.do?newsId=TEST0002</link>
<description>연근해 어선 안전 점검</description>
<pubDate>Sat, 12 Sep 2026 09:00:00 +0900</pubDate></item>
<item><title>안양시, 관양동 수촌마을 재개발 정비구역 지정 고시</title>
<link>https://www.anyang.go.kr/newtown/emwsWebView.do?key=2558&amp;regiNo=99999</link>
<description>안양시는 동안구 관양동 1392번지 일원 수촌마을(A블럭) 재개발 정비구역 지정을 고시했다.</description>
<pubDate>Fri, 11 Sep 2026 15:00:00 +0900</pubDate></item>
</channel></rss>`;

const gnews = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>"기준금리" - Google 뉴스</title>
<item><title>한은 기준금리 연 3.00%로 인상…두 달 연속 - 연합뉴스</title>
<link>https://news.google.com/rss/articles/TEST-A</link>
<pubDate>Thu, 27 Aug 2026 01:30:00 GMT</pubDate>
<description>&lt;a href="https://news.google.com/rss/articles/TEST-A"&gt;한은 기준금리 연 3.00%로 인상…두 달 연속&lt;/a&gt;&amp;nbsp;&amp;nbsp;&lt;font color="#6f6f6f"&gt;연합뉴스&lt;/font&gt;</description>
<source url="https://www.yna.co.kr">연합뉴스</source></item>
<item><title>한국은행, 기준금리 3.00%로 인상 - 매일경제</title>
<link>https://news.google.com/rss/articles/TEST-B</link>
<pubDate>Thu, 27 Aug 2026 02:00:00 GMT</pubDate>
<description>기준금리 인상</description>
<source url="https://www.mk.co.kr">매일경제</source></item>
<item><title>대전시의회 "둔산지구 재건축 분담금 완화해야" - 굿모닝충청</title>
<link>https://news.google.com/rss/articles/TEST-C</link>
<pubDate>Wed, 09 Sep 2026 02:00:00 GMT</pubDate>
<description>둔산지구 재건축</description>
<source url="https://www.goodmorningcc.com">굿모닝충청</source></item>
</channel></rss>`;

const atom = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"><title>테스트 Atom</title>
<entry><title>주택법 시행령 일부개정령안 입법예고</title>
<link href="https://opinion.lawmaking.go.kr/gcom/ogLmPp/TEST"/>
<updated>2026-09-10T00:00:00Z</updated>
<summary>다세대주택 6층까지 건축 허용. 의견제출 2026년 9월 28일까지.</summary></entry>
</feed>`;

http
  .createServer((req, res) => {
    const body = req.url?.startsWith("/gnews") ? gnews : req.url?.startsWith("/atom") ? atom : rss;
    res.writeHead(200, { "Content-Type": "application/rss+xml; charset=utf-8" });
    res.end(body);
  })
  .listen(3999, () => console.log("sample feed server on http://127.0.0.1:3999 (/rss /gnews /atom)"));
