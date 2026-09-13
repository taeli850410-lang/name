import type { LinkRef, Topic } from "./types";

/**
 * 공공데이터 바로가기. verified=true 는 기획 검토 시 검색 결과로 URL을 확인한 사이트,
 * false 는 널리 쓰이는 공식 도메인이지만 검토 세션에서 접속 검증을 하지 못한 사이트입니다.
 *
 * 전국 공통 사이트만 둡니다. 시군구 고시공고·지역 포털은 주소가 지자체마다 달라 카드에 자동으로 붙이지 않고,
 * 카드 아래 '최신 뉴스 검색'과 설정의 지역 이름으로 찾도록 했습니다. 온누리(경기)·정보몽땅(서울)·GRIS(경기)는 시도 단위 예시로 남깁니다.
 */
const L = (id: string, label: string, url: string, desc: string, verified = true): LinkRef => ({ id, label, url, desc, verified });

export const LINKS: Record<string, LinkRef> = Object.fromEntries(
  [
    // 금리·대출
    L("bokRate", "한국은행 기준금리 추이", "https://www.bok.or.kr/portal/singl/baseRate/list.do?dataSeCd=01&menuNo=200643", "변경 이력과 현재 금리"),
    L("bokMpc", "통화정책방향 결정회의", "https://www.bok.or.kr/portal/singl/crncyPolicyDrcMtg/listYear.do?menuNo=200755&mtgSe=A", "결정문·의사록·다음 회의 일정"),
    L("ecos", "한국은행 ECOS", "https://ecos.bok.or.kr/", "금리·대출 시계열 통계", false),
    L("finlifeMortgage", "금융상품한눈에 주담대 비교", "https://finlife.fss.or.kr/finlife/ldng/houseMrtg/list.do?menuNo=700007", "은행별 주택담보대출 금리·조건"),
    L("finlifeJeonse", "금융상품한눈에 전세대출 비교", "https://finlife.fss.or.kr/finlife/ldng/lfstsFunds/list.do?menuNo=700008", "은행별 전세자금대출 비교"),
    L("nhuf", "주택도시기금", "https://nhuf.molit.go.kr/", "디딤돌·버팀목 대출 안내"),
    L("enhuf", "기금e든든", "https://enhuf.molit.go.kr/", "정책대출 자격 조회와 신청"),
    L("hf", "한국주택금융공사", "https://www.hf.go.kr/", "보금자리론, 전세보증", false),
    L("fsc", "금융위원회 보도자료", "https://www.fsc.go.kr/no010101", "가계부채 관리방안, DSR·LTV"),
    // 세금
    L("hometax", "홈택스", "https://hometax.go.kr/", "양도세 모의계산, 신고"),
    L("wetax", "위택스", "https://www.wetax.go.kr/", "취득세·재산세 조회", false),
    L("realtyprice", "부동산공시가격 알리미", "https://www.realtyprice.kr/notice/town/nfSiteLink.htm", "공동주택 공시가격 열람"),
    L("nts", "국세청", "https://www.nts.go.kr/", "세법 해석과 신고 안내"),
    L("mofe", "재정경제부 보도·참고자료", "https://www.mofe.go.kr/", "세제개편안 원문"),
    L("lawgo", "국가법령정보센터", "https://www.law.go.kr/", "법령 조문 원문", false),
    L("lawmaking", "국민참여입법센터", "https://opinion.lawmaking.go.kr/", "입법예고 원문과 의견제출 기한"),
    L("moleg", "법제처 입법예고", "https://www.moleg.go.kr/lawinfo/makingInfo.mo", "부처별 입법예고 목록"),
    // 청약·공급
    L("applyhome", "청약홈", "https://www.applyhome.co.kr/", "청약 일정·경쟁률·가점 계산", false),
    L("lhApply", "LH 청약플러스", "https://apply.lh.or.kr/", "공공분양·임대 청약"),
    L("myhome", "마이홈포털", "https://www.myhome.go.kr/", "주거복지 자가진단, 임대주택 공고"),
    L("molitNews", "국토교통부 보도자료", "https://www.molit.go.kr/USR/NEWS/m_71/lst.jsp", "공급대책·규제지역·청약제도 원문"),
    L("molitLaw", "국토교통부 입법예고", "https://www.molit.go.kr/USR/law/m_46/lst.jsp", "주택법·정비법 개정안"),
    L("statMolit", "국토교통 통계누리", "https://stat.molit.go.kr/", "거래량·미분양·인허가 통계"),
    L("mtc", "대도시권광역교통위원회", "https://www.molit.go.kr/mtc/", "GTX·광역철도 사업 현황"),
    L("gnews", "경기도뉴스포털 보도자료", "https://gnews.gg.go.kr/briefing/brief_gongbo.do", "경기도 주택·교통 정책"),
    // 정비사업 — 전국 공통 + 시도 포털(내 지역 포털은 설정의 시군구 이름으로 검색)
    L("onnuri", "경기도 정비사업 온누리", "https://www.gg.go.kr/onnuri/index.do", "경기도 조합 정보 공개"),
    L("onnuriSearch", "온누리 사업장 검색", "https://www.gg.go.kr/onnuri/view.do?no=109", "구역별 조합·추진 단계"),
    L("cleanup", "서울 정비사업 정보몽땅", "https://cleanup.seoul.go.kr/", "서울 정비사업 현황", false),
    // 물건 조사
    L("eais", "세움터 건축물대장", "https://www.eais.go.kr/moct/bci/aaa02/BCIAAA02L01", "건축물대장·위반건축물"),
    L("kras", "일사편리", "https://www.kras.go.kr/", "부동산종합증명서"),
    L("eum", "토지이음", "https://www.eum.go.kr/", "토지이용계획·용도지역", false),
    L("vworld", "브이월드", "https://www.vworld.kr/", "공간정보·필지 경계", false),
    L("seereal", "씨:리얼(LH)", "https://seereal.lh.or.kr/main.do", "지도 기반 부동산 종합 정보"),
    L("gris", "경기부동산포털 GRIS", "https://gris.gg.go.kr/", "경기도 토지·건물·공시가격·실거래"),
    L("grisPermit", "GRIS 토지거래허가구역 지도", "https://gris.gg.go.kr/map/main/grisMapView.do?contentId=ui-cont-tojiTrade-id", "허가구역 확인"),
    L("gov", "정부24", "https://www.gov.kr/", "토지·건축물대장 발급", false),
    L("iros", "인터넷등기소", "https://www.iros.go.kr/", "등기부등본 열람", false),
    L("dataIros", "등기정보광장", "https://data.iros.go.kr/", "소유권이전·근저당 등기 통계"),
    // 거래 안전·임대차
    L("rtms", "부동산거래관리시스템", "https://rtms.molit.go.kr/", "거래신고·주택임대차 신고"),
    L("irts", "부동산거래 전자계약시스템", "https://irts.molit.go.kr/", "전자계약"),
    L("adr", "임대차분쟁조정위원회", "https://adrhome.reb.or.kr/", "보증금·수선·갱신 분쟁 조정"),
    L("hldcc", "법률구조공단 분쟁조정위원회", "https://www.hldcc.or.kr/", "임대차 분쟁 조정"),
    L("vworldBroker", "부동산중개업 조회", "https://www.vworld.kr/dtld/broker/dtld_list_s001.do", "중개사무소 등록·휴폐업 확인"),
    L("hugJeonse", "HUG 안심전세포털", "https://www.khug.or.kr/jeonse/index.jsp", "전세보증·전세사기 예방"),
    L("hugLandlord", "보증금 미반환 임대인 조회", "https://www.khug.or.kr/jeonse/web/s01/s010320.jsp", "상습 채무불이행자 명단"),
    L("hugBrokerCheck", "안심전세 공인중개사 확인", "https://www.khug.or.kr/jeonse/web/s03/s030204.jsp", "계약 전 중개사 확인 방법"),
    // 시세·통계
    L("rt", "국토교통부 실거래가 공개시스템", "https://rt.molit.go.kr/", "아파트·연립·오피스텔 실거래"),
    L("rtGis", "실거래가 지도 검색", "https://rt.molit.go.kr/pt/gis/gis.do", "지도에서 단지별 실거래"),
    L("rtXls", "실거래가 자료제공", "https://rt.molit.go.kr/pt/xls/xls.do", "월별 엑셀 다운로드"),
    L("kb", "KB부동산 데이터허브", "https://data.kbland.kr/", "KB 시세·통계보드"),
    L("rone", "부동산원 R-ONE 쉬운 통계", "https://www.reb.or.kr/r-one/portal/stat/easyStatPage.do", "가격지수·전세가율"),
    L("roneWeekly", "주간아파트가격동향 보도자료", "https://www.reb.or.kr/r-one/portal/bbs/pres/searchBulletinPage.do", "매주 목요일 공표"),
    L("roneReport", "R-ONE 공표보고서·시계열", "https://www.reb.or.kr/r-one/portal/bbs/rpt/searchBulletinPage.do", "주간·월간 시계열 통계표"),
    L("kosis", "KOSIS 국가통계포털", "https://kosis.kr/", "인구·가구 통계", false),
    L("kapt", "K-apt 관리비 비교", "https://www.k-apt.go.kr/apiinfo/goApiSearchCompare.do", "단지별 관리비 1:1 비교"),
    L("schoolzone", "학구도안내서비스", "https://schoolzone.emac.kr/gis/gis.do", "초·중 통학구역"),
    L("safemap", "생활안전지도", "https://www.safemap.go.kr/", "치안·재난 지도", false),
    // 경·공매, 업계, 보도자료 소스
    L("courtauction", "법원경매정보", "https://www.courtauction.go.kr/", "매각 일정·낙찰가율", false),
    L("onbid", "온비드", "https://www.onbid.co.kr/", "공매 물건", false),
    L("kar", "한국공인중개사협회", "https://www.kar.or.kr/", "협회 공지·교육", false),
    L("koreaPress", "정책브리핑 보도자료", "https://www.korea.kr/briefing/pressReleaseList.do", "전 부처 보도자료 통합"),
    L("koreaRss", "정책브리핑 보도자료 RSS", "https://www.korea.kr/rss/pressrelease.xml", "수집 파이프라인 1차 소스"),
    L("dataGoKr", "공공데이터포털", "https://www.data.go.kr/", "실거래가·건축물대장 API", false),
    L("likms", "국회 의안정보시스템", "https://likms.assembly.go.kr/bill/main.do", "법안 심의 단계", false),
  ].map((l) => [l.id, l]),
);

export function link(id: string): LinkRef {
  const l = LINKS[id];
  if (!l) throw new Error(`unknown link id: ${id}`);
  return l;
}

export function links(ids: string[]): LinkRef[] {
  return ids.map(link);
}

/** 4.4 주제별 자동 삽입 매핑 — 고객용 2~3개, 중개사용 3~4개 */
export const TOPIC_LINKS: Record<Topic, { customer: string[]; broker: string[] }> = {
  rate: { customer: ["bokRate", "finlifeMortgage", "enhuf"], broker: ["bokMpc", "ecos", "fsc", "hf"] },
  tax: { customer: ["hometax", "wetax", "realtyprice"], broker: ["mofe", "nts", "lawgo", "lawmaking"] },
  subs: { customer: ["applyhome", "lhApply", "myhome"], broker: ["molitNews", "statMolit", "molitLaw"] },
  supply: { customer: ["myhome", "lhApply"], broker: ["molitNews", "gnews", "mtc"] },
  redev: { customer: ["seereal", "eum"], broker: ["molitLaw", "eais", "eum", "onnuriSearch"] },
  lease: { customer: ["hugLandlord", "iros", "adr"], broker: ["rtms", "hugBrokerCheck", "lawgo"] },
  transit: { customer: ["mtc", "seereal"], broker: ["mtc", "statMolit", "molitNews"] },
  stat: { customer: ["rtGis", "kb", "rone"], broker: ["rtXls", "roneReport", "dataIros", "statMolit"] },
  regulation: { customer: ["eum", "molitNews"], broker: ["molitNews", "eum", "lawgo"] },
  broker: { customer: ["vworldBroker"], broker: ["kar", "molitNews", "lawgo", "irts"] },
};

export interface LinkGroup {
  title: string;
  ids: string[];
}

/** 4.2 고객용 바로가기 (필요한 순간별) */
export const CUSTOMER_LINK_GROUPS: LinkGroup[] = [
  { title: "집을 고를 때", ids: ["rt", "rtGis", "kb", "rone", "realtyprice", "kapt", "schoolzone", "safemap"] },
  { title: "청약·주거지원", ids: ["applyhome", "lhApply", "myhome", "nhuf", "enhuf"] },
  { title: "전세·월세 계약 전", ids: ["hugJeonse", "hugLandlord", "hugBrokerCheck", "iros", "vworldBroker", "adr", "hldcc"] },
  { title: "대출·세금", ids: ["bokRate", "finlifeMortgage", "finlifeJeonse", "hf", "hometax", "wetax"] },
  { title: "우리 지역·정비사업", ids: ["seereal", "eum", "onnuri", "cleanup", "gris"] },
];

/** 4.3 중개사용 바로가기 (업무별) */
export const BROKER_LINK_GROUPS: LinkGroup[] = [
  { title: "물건 조사", ids: ["iros", "gov", "eais", "kras", "eum", "vworld", "seereal", "gris"] },
  { title: "신고·계약", ids: ["rtms", "irts", "adr"] },
  { title: "시장 데이터", ids: ["rtXls", "statMolit", "dataIros", "kb", "roneReport", "roneWeekly", "kosis", "ecos"] },
  { title: "법령·규제", ids: ["lawgo", "lawmaking", "moleg", "molitLaw", "molitNews", "mtc", "likms"] },
  { title: "정비사업", ids: ["molitLaw", "onnuri", "onnuriSearch", "cleanup", "eais", "eum"] },
  { title: "경·공매·업계", ids: ["courtauction", "onbid", "kar"] },
  { title: "보도자료 소스", ids: ["koreaPress", "koreaRss", "molitNews", "fsc", "mofe", "nts", "bokMpc", "roneWeekly", "gnews", "hugJeonse", "dataGoKr"] },
];
