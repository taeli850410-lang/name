import { buildDraft, publishLetter } from "./letter";
import { PERSONA_MATRIX, TOPIC_GLOSSARY } from "./taxonomy";
import { titleHash } from "./classify";
import type { AgencyGroup, Article, BrokerFields, CustomerFields, Issue, Letter, MarketDoc, Office, Persona, Region, Status, Topic } from "./types";

/**
 * 샘플 데이터. 2026년 9월 둘째 주 실제 보도·안양시 고시를 바탕으로 손으로 쓴 초안이며,
 * 수집 파이프라인이 채우기 전에도 스튜디오와 레터가 어떻게 보이는지 보여 줍니다.
 */

export const DEFAULT_OFFICE: Office = {
  officeName: "랜드랭귀지 샘플공인중개사사무소",
  brandName: "LAND LANGUAGE / 랜드랭귀지",
  repName: "홍길동",
  registrationNo: "41171-2026-00000",
  phone: "010-0000-0000",
  address: "경기도 안양시 만안구 안양로 000, 1층",
  email: "hello@example.com",
  kakaoUrl: "",
  unsubscribeUrl: "",
  slogan: "안양 부동산 소식, 3분 브리핑",
  defaultComment:
    "정책은 '발표'보다 '적용 대상'과 '시행 시점'이 중요합니다. 이번 호에는 확정된 내용만 본문에 담고, 논의 중인 사안은 '지켜볼 이슈'로 따로 두었습니다. 내 상황에 어떻게 적용되는지 궁금하시면 편하게 연락 주세요.",
  areaLabel: "안양 만안·동안구",
};

interface SeedSpec {
  id: string;
  title: string;
  summary: string;
  sourceKind: Issue["sourceKind"];
  sourceName: string;
  agency: string;
  agencyGroup: AgencyGroup;
  status: Status;
  topic: Topic;
  region: Region;
  dong?: string[];
  publishedAt: string;
  effectiveAt?: string | null;
  officialUrl?: string | null;
  articles: Article[];
  personas?: Partial<Record<Persona, number>>;
  customer: CustomerFields;
  broker: BrokerFields;
  review?: Issue["review"];
}

function mk(s: SeedSpec): Issue {
  const personas = { ...PERSONA_MATRIX[s.topic], ...(s.personas ?? {}) } as Record<Persona, number>;
  return {
    id: s.id,
    createdAt: s.publishedAt,
    updatedAt: s.publishedAt,
    title: s.title,
    summary: s.summary,
    sourceKind: s.sourceKind,
    sourceName: s.sourceName,
    agency: s.agency,
    agencyGroup: s.agencyGroup,
    status: s.status,
    topic: s.topic,
    region: s.region,
    dong: s.dong ?? [],
    publishedAt: s.publishedAt,
    effectiveAt: s.effectiveAt ?? null,
    officialUrl: s.officialUrl ?? null,
    articles: s.articles,
    personas,
    customer: s.customer,
    broker: s.broker,
    review: s.review ?? "reviewed",
    enrichedBy: "manual",
    hash: titleHash(s.title),
  };
}

export function seedIssues(): Issue[] {
  return [
    mk({
      id: "sample-bok-rate",
      title: "한국은행, 기준금리 연 3.00%로 인상…두 달 연속",
      summary: "한국은행 금융통화위원회가 8월 27일 기준금리를 2.75%에서 3.00%로 0.25%p 올렸다. 7월 16일 인상에 이어 두 달 연속 인상이다.",
      sourceKind: "sample",
      sourceName: "한국은행",
      agency: "한국은행",
      agencyGroup: "bok",
      status: "CONFIRMED",
      topic: "rate",
      region: "national",
      publishedAt: "2026-08-27T10:00:00+09:00",
      officialUrl: "https://www.bok.or.kr/portal/singl/baseRate/list.do?dataSeCd=01&menuNo=200643",
      articles: [
        { publisher: "한국은행", title: "한국은행 기준금리 추이 — 2026.08.27 3.00%", url: "https://www.bok.or.kr/portal/singl/baseRate/list.do?dataSeCd=01&menuNo=200643", date: "2026-08-27" },
        { publisher: "YTN", title: "거래 절벽에 \"민간 살아나야\"...대출 규제 '딜레마'", url: "https://www.ytn.co.kr/_ln/0102_202609120526240840", date: "2026-09-12" },
      ],
      customer: {
        headline: "기준금리가 3.0%로 올랐어요. 대출 이자를 다시 확인할 때입니다",
        what: "한국은행이 8월 27일 기준금리를 연 3.00%로 올렸습니다. 7월에 이어 두 달 연속 인상이며, 은행 대출금리는 여기에 가산금리가 더해져 정해집니다.",
        forMe: {
          first: "전세대출이나 주택담보대출이 변동금리라면 다음 금리 변경일부터 이자가 오를 수 있어요.",
          move: "갈아타기를 준비 중이라면 대출 한도가 줄어들 수 있으니 자금 계획을 다시 점검하세요.",
          asset: "임대 목적으로 보유한 주택의 대출 이자 부담이 커집니다. 만기와 갱신 시점을 확인하세요.",
        },
        actions: [
          "대출 약정서에서 '금리 변경일'과 금리 유형(변동·고정·혼합)을 확인하기",
          "고정·혼합형으로 갈아탈 때 드는 중도상환수수료 비교하기",
          "디딤돌·버팀목 같은 정책대출 자격 확인하기",
        ],
        glossary: TOPIC_GLOSSARY.rate,
      },
      broker: {
        facts: ["2.75% → 3.00% (+0.25%p), 7월 16일 인상 이후 2회 연속", "다음 통화정책방향 결정회의 일정은 한국은행 공지에서 확인", "시장금리(코픽스·은행채)는 별도로 움직이므로 실제 대출금리 반영 시점은 은행별 확인"],
        script: [
          "'기준금리 인상 = 내 대출금리 즉시 인상'이 아닙니다. 변동형은 갱신 주기(3·6개월)에 반영됩니다.",
          "DSR 산정 금리가 오르면 한도가 줄어듭니다. 매수 예정 고객은 한도를 다시 계산한 뒤 계약 일정을 잡도록 안내합니다.",
        ],
        checklist: ["잔금일 전 대출 승인 조건 재확인 특약 문구 준비", "전세대출 이용 임차인의 갱신 시점·상환 시나리오 정리", "정책대출 자격 변경 여부 확인(기금e든든)"],
        faq: [{ q: "지금 사도 되나요?", a: "금리 방향만으로 답하지 않습니다. 한도·상환 여력·보유 기간을 함께 보고, 확정된 숫자로 시나리오를 비교해 드립니다." }],
        local: "안양(만안·동안) 6월 매매 중위가 7.2억(실거래 잠정). 4억 대출 기준 0.25%p 인상 시 연 이자 약 100만 원 증가.",
      },
    }),
    mk({
      id: "sample-supply-levy",
      title: "\"땅 놀리지 말고 집 지어라\"…내년 말까지 착공 땐 개발부담금 면제",
      summary: "정부가 8·13 공급대책 후속으로 2027년 말까지 착공하는 주택사업의 개발부담금을 면제한다. 1990년 도입된 개발부담금은 지가 상승분을 환수하는 제도다.",
      sourceKind: "sample",
      sourceName: "헤럴드경제",
      agency: "국토교통부",
      agencyGroup: "molit",
      status: "SCHEDULED",
      topic: "supply",
      region: "national",
      publishedAt: "2026-09-12T11:01:00+09:00",
      officialUrl: "https://www.molit.go.kr/USR/NEWS/m_71/lst.jsp",
      articles: [{ publisher: "헤럴드경제", title: "\"땅 놀리지 말고 집 지어라\"…내년 말까지 착공 땐 부담금 면제", url: "https://biz.heraldcorp.com/article/10871052", date: "2026-09-12" }],
      customer: {
        headline: "내년 말까지 착공하면 개발부담금이 면제돼요",
        what: "정부가 8·13 공급대책 후속으로, 2027년 말까지 착공하는 주택사업의 개발부담금을 면제하기로 했습니다. 사업자가 땅을 놀리지 말고 빨리 집을 짓게 하려는 조치입니다.",
        forMe: {
          first: "당장 청약 자격이 바뀌지는 않지만, 착공이 빨라지면 2~3년 뒤 분양 물량이 늘 수 있어요.",
          move: "보유 주택에 직접 영향은 없습니다. 관심 지역의 착공 소식을 지켜보세요.",
          asset: "토지나 사업 부지를 갖고 있다면 착공 시점에 따라 부담금 차이가 큽니다. 일정 확인이 필요해요.",
        },
        actions: ["관심 지역의 신규 분양·착공 일정 확인하기(청약홈·LH 청약플러스)", "사업 부지를 보유했다면 착공 시점별 부담금 차이 확인하기"],
        glossary: TOPIC_GLOSSARY.supply,
      },
      broker: {
        facts: ["개발부담금: 1990년 도입, 지가 상승분 환수 제도", "면제 요건: 2027년 12월 31일까지 착공(세부 요건은 시행령 확정 시 확인)", "8·13 공급대책 후속 인센티브 중 하나"],
        script: ["고객이 '공급이 늘어 집값이 내리나'라고 물으면, 착공에서 입주까지 3년 안팎이 걸리고 지역별 편차가 크다고 설명합니다."],
        checklist: ["토지주 고객: 착공 계획과 인허가 일정 확인", "시행령 개정 원문 확인 후 요건 재안내"],
        faq: [{ q: "우리 동네에도 해당되나요?", a: "전국 공통 제도이지만 실제 효과는 착공 가능한 사업지가 있는 곳에 한정됩니다. 안양은 정비사업 구역이 주 대상입니다." }],
        local: "안양 정비구역(수촌마을·충훈부 등)의 착공 시점이 앞당겨질 수 있음. 조합 일정 확인 필요.",
      },
    }),
    mk({
      id: "sample-rent-stat",
      title: "전세 사라질수록 월세 오른다…서울 월세 160만원 시대",
      summary: "한국부동산원 집계로 서울 아파트 평균 월세가 160만 원을 넘었다. 올해 1~5월 전국 임대차 거래 중 월세 비중은 68.6%로 전년 대비 7.6%p 늘었다.",
      sourceKind: "sample",
      sourceName: "뉴시스",
      agency: "한국부동산원",
      agencyGroup: "reb",
      status: "STAT",
      topic: "lease",
      region: "seoul",
      publishedAt: "2026-09-11T12:30:00+09:00",
      officialUrl: "https://www.reb.or.kr/r-one/portal/stat/easyStatPage.do",
      articles: [
        { publisher: "뉴시스", title: "전세 사라질수록 월세 오른다…서울 월세 160만원 시대", url: "https://www.newsis.com/view/NISX20260911_0003786400", date: "2026-09-11" },
        { publisher: "데일리안", title: "집은 나중에, 전월세는 지금…국토위 국감, '주거정책' 공방 예고", url: "https://www.dailian.co.kr/news/view/1687316/", date: "2026-09-08" },
      ],
      customer: {
        headline: "월세가 계속 오르고 있어요. 전세를 찾는다면 서두르세요",
        what: "한국부동산원 통계로 서울 아파트 평균 월세가 처음 160만 원을 넘었고, 올해 전국 임대차 거래의 68.6%가 월세였습니다. 전세 물건이 줄고 월세로 옮겨 가는 흐름이 뚜렷합니다.",
        forMe: {
          first: "전세를 구한다면 물건이 빠르게 줄고 있어요. 전세대출 한도와 보증 가입 가능 여부를 먼저 확인하세요.",
          move: "임대 중인 집이 있다면 재계약 조건을 시장 흐름에 맞게 다시 볼 때예요.",
          asset: "월세 수요가 늘어 임대 수익 구조가 바뀌고 있어요. 전월세 전환율을 확인하세요.",
        },
        actions: ["안양 전세·월세 실거래 확인하기(아래 '우리 동네 숫자' 참고)", "전세보증보험 가입 가능 여부 확인하기", "재계약 예정이라면 갱신요구권 사용 여부 정하기"],
        glossary: { term: "전월세 전환율", def: "전세보증금을 월세로 바꿀 때 적용하는 비율이에요. 법정 상한(기준금리+2%p)이 있어 그 이상을 요구하면 거절할 수 있습니다." },
      },
      broker: {
        facts: ["서울 아파트 평균 월세 160만 원 초과(부동산원 집계 이후 최초), 올해 월세 누적 상승률 5.73%", "올해 1~5월 전국 임대차 거래 중 월세 비중 68.6%(전년 대비 +7.6%p)", "안양 수치는 실거래 API 집계(우리 동네 숫자)로 대체"],
        script: ["전세 → 월세 전환 요구 시 법정 전환율(기준금리+2%p)을 계산해 보여 줍니다.", "임차인 고객에게는 보증보험 가입 요건(전세가율·공시가격)을 먼저 확인합니다."],
        checklist: ["임대차 신고(rtms) 30일 내 이행 안내", "갱신 계약 시 5% 상한·전환율 계산 근거를 계약서 특약에 기재"],
        faq: [{ q: "월세로 바꾸자는데 얼마가 적정한가요?", a: "법정 전환율로 계산한 값을 상한선으로 두고, 주변 실거래 월세와 비교해 제시합니다." }],
        local: "안양 월세 평균과 전세 중위가는 실거래 집계 타일 참고. 평촌·범계 역세권 소형 월세 수요 증가.",
      },
    }),
    mk({
      id: "sample-broker-fee",
      title: "\"집 보여주면 돈 내라\"…공인중개사 '임장비' 법적 근거 논란",
      summary: "한국공인중개사협회가 매물 현장 확인에 대한 기본보수(임장비)를 추진할 여지를 남기자 논란이 일었다. 국토교통부는 현행 공인중개사법령상 중개보수와 실비 외에 별도 수수료 근거가 없다고 설명했다.",
      sourceKind: "sample",
      sourceName: "이투데이",
      agency: "한국공인중개사협회",
      agencyGroup: "industry",
      status: "PRESS_REPORTED",
      topic: "broker",
      region: "national",
      publishedAt: "2026-09-10T06:02:00+09:00",
      articles: [
        { publisher: "이투데이", title: "\"집 보여주면 돈 내라\"⋯공인중개사 '임장비' 법적 근거 논란", url: "https://www.etoday.co.kr/news/view/2623578", date: "2026-09-10" },
        { publisher: "뉴시스", title: "\"매물 보러 가는데 돈 내라고?\"…다시 불붙은 '임장비' 논란", url: "https://www.newsis.com/view/NISX20260908_0003780557", date: "2026-09-08" },
      ],
      customer: {
        headline: "'임장비' 논의는 아직 확정된 것이 없습니다",
        what: "매물을 보여줄 때 비용을 받는 '임장 기본보수'를 추진한다는 보도가 있었지만, 국토교통부는 현행 법령상 중개보수와 실비 외에 별도 수수료 근거가 없다고 설명했습니다.",
        forMe: {},
        actions: [],
        glossary: null,
      },
      broker: {
        facts: ["협회: 임장 기본보수제 추진 여지 언급(8월 26일 기자간담회, 9월 재부각)", "국토부 설명자료: 현행 공인중개사법령상 중개보수·실비 외 '현장 방문 수수료' 근거 없음", "법 개정 여부·기준·수준 모두 미정"],
        script: ["고객이 '집 보는 데 돈을 내야 하냐'고 물으면, 현재는 근거가 없고 거래 성사 시 중개보수만 받는다고 답합니다."],
        checklist: ["임장비 명목의 별도 청구는 현행법상 근거 없음 — 사무소 안내문 점검"],
        faq: [{ q: "임장비 받나요?", a: "받지 않습니다. 법령이 바뀌면 그때 기준을 안내드립니다." }],
        local: "",
      },
    }),
    mk({
      id: "sample-kar-statutory",
      title: "'법정단체' 공인중개사협회 \"카르텔 감시센터 운영…임장비도 추진\"",
      summary: "공인중개사법 개정으로 8월 28일부터 한국공인중개사협회가 법정단체 지위를 갖는다. 확인·설명서 오기 등 과태료 체계 조정을 추진하며, 의무가입과 지도·징계권은 이번 개정에서 빠졌다.",
      sourceKind: "sample",
      sourceName: "뉴스1",
      agency: "국토교통부",
      agencyGroup: "molit",
      status: "CONFIRMED",
      topic: "broker",
      region: "national",
      publishedAt: "2026-08-27T09:00:00+09:00",
      effectiveAt: "2026-08-28",
      articles: [{ publisher: "뉴스1", title: "'법정단체' 공인중개사협회 \"카르텔 감시센터 운영…임장비도 추진\"", url: "https://www.news1.kr/realestate/general/6270419", date: "2026-08-27" }],
      customer: {
        headline: "공인중개사협회가 법정단체가 됐어요. 등록된 중개사무소인지 확인하고 계약하세요",
        what: "8월 28일부터 한국공인중개사협회가 법정단체로 바뀌었습니다. 무등록 중개와 확인·설명서 오류에 대한 감시가 강화됩니다.",
        forMe: {
          first: "계약할 중개사무소가 정식 등록됐는지 조회하고 계약하세요.",
          move: "계약할 중개사무소가 정식 등록됐는지 조회하고 계약하세요.",
          asset: "임대 계약을 맡길 중개사무소의 등록 여부를 확인하세요.",
        },
        actions: ["계약 전 중개사무소 등록 여부 조회하기(브이월드 부동산중개업 조회)"],
        glossary: TOPIC_GLOSSARY.broker,
      },
      broker: {
        facts: ["공인중개사법 개정안 1월 국회 통과, 8월 28일 시행", "카르텔 감시센터 운영, 확인·설명서 수치 오기 등 과태료 체계 조정 추진", "의무가입·지도·징계권은 이번 개정에서 제외"],
        script: ["고객에게는 '등록 중개사무소 확인'이라는 실질적 변화만 안내합니다."],
        checklist: ["확인·설명서 기재 항목 재점검(관리비·권리관계 수치)", "협회 공지의 자율규제 일정 확인"],
        faq: [],
        local: "",
      },
    }),
    mk({
      id: "sample-mgmt-fee",
      title: "공인중개사, 원룸·오피스텔 계약 전 공동관리비 설명 의무화",
      summary: "국토교통부 개정안은 공인중개사가 기존 관리비 총액 외에 공동관리비 금액을 확인·설명하도록 했다. 전용 85㎡ 이하 주거용 오피스텔 중개보수는 상한요율 이내에서 정한다.",
      sourceKind: "sample",
      sourceName: "한국아파트신문",
      agency: "국토교통부",
      agencyGroup: "molit",
      status: "LEGISLATIVE_NOTICE",
      topic: "broker",
      region: "national",
      publishedAt: "2026-08-14T13:00:00+09:00",
      officialUrl: "https://www.molit.go.kr/USR/law/m_46/lst.jsp",
      articles: [{ publisher: "한국아파트신문", title: "공인중개사, 원룸ㆍ오피스텔 계약 전 공동관리비 설명 의무화", url: "https://www.hapt.co.kr/news/articleView.html?idxno=169254", date: "2026-08-14" }],
      customer: {
        headline: "원룸·오피스텔 계약 전에 관리비 내역을 설명받게 됩니다",
        what: "국토교통부가 공인중개사가 관리비 총액 외에 공동관리비 금액까지 확인·설명하도록 하는 개정안을 내놓았습니다. 확정되면 원룸·오피스텔 계약 전에 관리비 내역을 요구할 수 있습니다.",
        forMe: {
          first: "월세 외에 관리비가 얼마인지 계약 전에 확인할 권리가 생겨요.",
          move: "임대 중인 원룸·오피스텔이 있다면 관리비 내역을 미리 정리해 두세요.",
          asset: "임대 중인 원룸·오피스텔이 있다면 관리비 내역을 미리 정리해 두세요.",
        },
        actions: ["계약 전 관리비 총액과 항목을 문서로 요청하기"],
        glossary: null,
      },
      broker: {
        facts: ["개정안: 기존 관리비 총액 외 공동관리비 금액 확인·설명 의무", "주거용 오피스텔(전용 85㎡ 이하, 부엌·화장실 구비) 중개보수 상한요율 적용 명확화", "시행일: 확정 공포 후 별도 확인"],
        script: ["시행 전에도 관리비 내역을 먼저 확인해 주는 사무소라는 점을 설명합니다."],
        checklist: ["확인·설명서 관리비 항목 서식 준비", "임대인에게 관리비 내역서 사전 요청"],
        faq: [],
        local: "",
      },
    }),
    mk({
      id: "sample-tax-notice",
      title: "소득세법 시행령 일부개정령안 입법예고 — 주택 수 제외 적용기한 2027년 말까지 연장",
      summary: "양도소득세 특례 및 주택 수 제외의 적용기한을 2027년 12월 31일로 1년 연장하는 소득세법 시행령 개정안이 입법예고됐다. 의견제출 기한은 2026년 9월 10일.",
      sourceKind: "sample",
      sourceName: "국민참여입법센터",
      agency: "재정경제부",
      agencyGroup: "mofe",
      status: "LEGISLATIVE_NOTICE",
      topic: "tax",
      region: "national",
      publishedAt: "2026-08-21T09:00:00+09:00",
      officialUrl: "https://opinion.lawmaking.go.kr/gcom/ogLmPp/88010",
      articles: [{ publisher: "국민참여입법센터", title: "소득세법 시행령 일부개정령안 입법예고", url: "https://opinion.lawmaking.go.kr/gcom/ogLmPp/88010", date: "2026-08-21" }],
      customer: {
        headline: "양도세 계산 때 '주택 수 제외' 특례가 1년 연장될 예정이에요",
        what: "소득세법 시행령 개정안이 입법예고됐습니다. 양도세 특례와 주택 수 계산에서 제외되는 적용 기한을 2027년 12월 31일까지 1년 연장하는 내용입니다. 확정 전이라 바뀔 수 있습니다.",
        forMe: {
          first: "무주택자에게 직접 영향은 없어요.",
          move: "갈아타기 중 일시적 2주택이라면 특례 기한 연장이 유리할 수 있어요. 확정 후 세무 상담을 받으세요.",
          asset: "다주택 보유자는 특례 대상 주택이 무엇인지, 연장 요건이 어떻게 확정되는지 지켜보세요.",
        },
        actions: ["보유 주택별 취득일·용도 정리해 두기", "확정 공포 후 양도세 모의계산(홈택스) 다시 해 보기"],
        glossary: TOPIC_GLOSSARY.tax,
      },
      broker: {
        facts: ["의견제출 기한 2026-09-10(국민참여입법센터)", "핵심: 특례 및 주택 수 제외 적용기한 2027.12.31로 1년 연장", "확정·공포 시 시행일 재확인"],
        script: ["'논의'와 '확정'을 구분해 설명합니다. 입법예고안은 의견수렴 후 바뀔 수 있습니다.", "세액 계산은 세무사 확인을 병행합니다."],
        checklist: ["다주택·일시적 2주택 고객 리스트에 특례 기한 메모", "공포 후 시행일 기준으로 매도 일정 재상담"],
        faq: [{ q: "지금 팔면 중과되나요?", a: "현행 기준으로 안내하고, 개정 확정 시 달라지는 점을 다시 알려드립니다." }],
        local: "",
      },
    }),
    mk({
      id: "sample-suchon-redev",
      title: "수촌마을(A블럭) 재개발사업 정비계획 결정 및 정비구역 지정(안) 주민공람·시의회 의견청취",
      summary: "안양시가 동안구 관양동 1392번지 일원 수촌마을(A블럭) 재개발 정비계획 결정 및 정비구역 지정(안)을 주민공람(공고 제2026-1260호, 7월 22일)했고, 9월 7일 제314회 임시회에서 의견청취 안건으로 다뤄졌다.",
      sourceKind: "sample",
      sourceName: "안양시",
      agency: "안양시",
      agencyGroup: "anyang",
      status: "LOCAL_NOTICE",
      topic: "redev",
      region: "anyang",
      dong: ["관양동"],
      publishedAt: "2026-09-07T09:00:00+09:00",
      officialUrl: "https://www.anyang.go.kr/newtown/selectEminwonView.do?not_ancmt_mgt_no=84313&key=2558",
      articles: [
        { publisher: "안양시 고시공고", title: "수촌마을(A블럭) 재개발사업 정비계획 결정 및 정비구역 지정(안) 주민공람·공고", url: "https://www.anyang.go.kr/newtown/selectEminwonView.do?not_ancmt_mgt_no=84313&key=2558", date: "2026-07-22" },
        { publisher: "에너지경제", title: "[패트롤] 군포시의회-부천시의회-안양시의회-하남시의회", url: "https://www.ekn.kr/web/view.php?key=20260908029051762", date: "2026-09-08" },
      ],
      personas: { "매수 예정자": 4, "1주택자": 4, 임차인: 3, 공인중개사: 5 },
      customer: {
        headline: "관양동 수촌마을(A블럭) 재개발 정비구역 지정이 진행 중이에요",
        what: "안양시가 동안구 관양동 1392번지 일원 수촌마을(A블럭) 재개발 정비계획과 정비구역 지정(안)을 주민공람했고, 9월 7일 시의회 의견청취 안건으로 올랐습니다. 지정 고시가 나면 사업이 공식 시작됩니다.",
        forMe: {
          first: "이 구역에 세 들어 산다면 향후 이주 시점과 임대차 계약 기간을 미리 생각해 두세요.",
          move: "구역 안 주택을 갖고 있다면 정비구역 지정 이후 거래 조건(조합원 지위 등)이 달라져요. 매도·보유 판단 전에 확인하세요.",
          asset: "구역 지정 후에는 분담금 추정과 사업 일정이 가격에 반영됩니다. 조합 설립 단계를 지켜보세요.",
        },
        actions: ["안양시 고시공고에서 구역도와 공람 원문 확인하기", "보유 주택이 구역 안인지 지번으로 확인하기"],
        glossary: TOPIC_GLOSSARY.redev,
      },
      broker: {
        facts: ["위치: 동안구 관양동 1392번지 일원", "절차: 주민공람(공고 제2026-1260호, 2026-07-22) → 시의회 의견청취(9.7) → 도시계획위원회 심의 → 지정 고시", "담당: 안양시 도시정비과"],
        script: ["정비구역 지정은 '착공'이 아니라 '시작'입니다. 완공까지 통상 10년 안팎이라고 설명합니다.", "조합원 지위 양도 제한 규정은 지정 고시 이후 적용 여부를 확인해 안내합니다."],
        checklist: ["구역 경계 지번 목록 확보", "토지등소유자 동의 절차 일정 파악", "구역 내 매물 확인·설명서에 정비구역 지정(안) 공람 사실 기재"],
        faq: [{ q: "지금 사면 새 아파트 받나요?", a: "지정 고시와 조합 설립 이후 조합원 자격 요건을 확인해야 합니다. 단정하지 않습니다." }],
        local: "관양동 1392번지 일원. 인덕원역세권·중촌마을과 함께 동안구 정비 축.",
      },
    }),
    mk({
      id: "sample-chunghun-lotte",
      title: "롯데건설, 안양 충훈부 일원 공공재개발 시공권 확보…공사비 7,567억",
      summary: "롯데건설이 안양 충훈부 일원 공공재개발(7,567억 원) 시공권을 확보했다. 성수4지구, 도곡우성 등과 함께 올해 정비사업 누적 수주 4조 원을 넘겼다.",
      sourceKind: "sample",
      sourceName: "뉴스1",
      agency: "업계",
      agencyGroup: "industry",
      status: "PRESS_REPORTED",
      topic: "redev",
      region: "anyang",
      dong: ["충훈동"],
      publishedAt: "2026-09-08T18:35:00+09:00",
      articles: [{ publisher: "뉴스1", title: "롯데건설, 도곡우성 재건축 수주…올해 정비사업 4조 돌파", url: "https://www.news1.kr/realestate/general/6284088", date: "2026-09-08" }],
      customer: {
        headline: "충훈부 공공재개발 시공사가 정해졌어요",
        what: "만안구 충훈부 일원 공공재개발 사업의 시공사로 롯데건설이 선정됐습니다(공사비 7,567억 원 규모). 시공사 선정은 사업이 실행 단계로 넘어간다는 신호입니다.",
        forMe: {
          first: "이 일대 전세·월세는 이주 시점이 다가오면 물건이 줄 수 있어요.",
          move: "구역 내 보유자라면 분담금 추정치와 이주 일정이 곧 구체화됩니다.",
          asset: "공사비 확정은 분담금 계산의 핵심 변수예요. 조합 총회 자료를 확인하세요.",
        },
        actions: ["경기도 정비사업 온누리에서 조합 공고 확인하기"],
        glossary: null,
      },
      broker: {
        facts: ["시공사: 롯데건설, 공사비 7,567억 원(보도 기준)", "사업 형태: 공공재개발", "정비계획 변경 고시 이력: 충훈부 일원 정비구역 지정 변경"],
        script: ["공사비가 정해져도 분담금은 감정평가·일반분양가에 따라 달라진다고 설명합니다."],
        checklist: ["조합 총회 의결 내용·계약 조건 확인", "구역 내 매물의 권리산정기준일·조합원 지위 확인"],
        faq: [],
        local: "만안구 충훈부 일원(충훈동). 석수지구 지구단위계획과 연계.",
      },
    }),
    mk({
      id: "sample-gg-jeonse-ai",
      title: "전세사기, 계약 전에 AI로 잡는다…경기도의회 안전망 조례안",
      summary: "경기도의회에 전세사기 예방 AI 권리분석 안전망 구축·운영 조례안이 올라왔다. 개업공인중개사와 거래 당사자 등 누구나 이용할 수 있도록 하고, 관계기관 업무협약과 정보 수집 근거를 담았다.",
      sourceKind: "sample",
      sourceName: "아시아타임즈",
      agency: "경기도",
      agencyGroup: "gyeonggi",
      status: "IN_ASSEMBLY",
      topic: "lease",
      region: "gyeonggi",
      publishedAt: "2026-09-07T16:42:00+09:00",
      articles: [{ publisher: "아시아타임즈", title: "전세사기, 계약 전에 AI로 잡는다⋯ 경기도의회 민생·교육·안전 조례", url: "https://www.asiatime.co.kr/article/20260907500350", date: "2026-09-07" }],
      customer: {
        headline: "경기도가 계약 전 전세사기 위험을 분석해 주는 안전망을 준비 중이에요",
        what: "경기도의회에 전세사기 예방 AI 권리분석 안전망 조례안이 올라왔습니다. 통과되면 계약 전 권리분석 서비스를 이용할 수 있습니다.",
        forMe: {
          first: "확정되면 계약 전 권리분석을 받을 수 있어요. 그전까지는 안심전세포털의 미반환 임대인 조회를 활용하세요.",
          move: "임대 중인 집이 있다면 세입자가 권리분석을 요청할 수 있으니 등기·보증 조건을 정리해 두세요.",
          asset: "임대 중인 집이 있다면 세입자가 권리분석을 요청할 수 있으니 등기·보증 조건을 정리해 두세요.",
        },
        actions: ["계약 전 HUG 안심전세포털에서 임대인 보증금 미반환 이력 조회하기", "등기부등본에서 근저당·가압류 확인하기"],
        glossary: TOPIC_GLOSSARY.lease,
      },
      broker: {
        facts: ["조례안 심의 중(경기도의회, 9월 7일 보도)", "이용 대상: 개업공인중개사, 거래 당사자, 안전망이 필요한 도민", "관계기관 업무협약·정보 수집 근거 포함"],
        script: ["시행 전에는 안심전세포털 조회와 등기부 확인을 계약 절차에 넣어 설명합니다."],
        checklist: ["시행 시 권리분석 결과를 확인·설명서에 첨부하는 절차 준비"],
        faq: [],
        local: "",
      },
    }),
  ];
}

/** 샘플 레터: 2026-09-12 기준 MONTHLY · 내집마련 호를 미리 발행해 둡니다. */
export function seedLetters(market: MarketDoc): Letter[] {
  const now = Date.parse("2026-09-12T12:00:00+09:00");
  const draft = buildDraft(seedIssues(), DEFAULT_OFFICE, market, { period: "monthly", segment: "first", now });
  const published = publishLetter(draft, now);
  return [{ ...published, id: "demo" }];
}
