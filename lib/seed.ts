import { buildDraft, publishLetter } from "./letter";
import { PERSONA_MATRIX, TOPIC_GLOSSARY } from "./taxonomy";
import { detectPlace, shortName, titleHash } from "./classify";
import type { AgencyGroup, AreaConfig, Article, BrokerFields, CustomerFields, Issue, Letter, MarketDoc, Office, Persona, Region, Status, Topic } from "./types";

/**
 * 샘플 데이터. 2026년 9월 둘째 주 실제 보도를 바탕으로 손으로 쓴 초안이며,
 * 수집 파이프라인이 채우기 전에도 스튜디오와 레터가 어떻게 보이는지 보여 줍니다.
 * 기본은 전국구입니다. 인천 사례 2건(정비사업 현황·부평 산곡)은 설정에서 시군구를 '미추홀구'나 '부평구'로 두면
 * '우리 지역'으로 잡혀 동네 타깃이 되고, 그 밖에는 타 지역 참고로만 남습니다.
 */

export const DEFAULT_OFFICE: Office = {
  officeName: "랜드랭귀지 샘플공인중개사사무소",
  brandName: "REAL ESTATE REPORT ALERT",
  videoBrand: "NEWS VIEW",
  repName: "홍길동",
  registrationNo: "41171-2026-00000",
  phone: "010-0000-0000",
  address: "",
  email: "hello@example.com",
  kakaoUrl: "",
  unsubscribeUrl: "",
  privacyUrl: "",
  // 전국구 기본 추천 조합 — 세 세그먼트 공통(금리) · 거래 빈도(임대차) · 무주택 수요(청약·분양)
  focusTopics: ["rate", "lease", "subs"],
  scope: "national",
  sido: "",
  sigungu: "",
  dongs: [],
  lawdCodes: [],
  slogan: "부동산 소식, 3분 브리핑",
  defaultComment:
    "정책은 '발표'보다 '적용 대상'과 '시행 시점'이 중요합니다. 이번 호에는 확정된 내용만 본문에 담고, 논의 중인 사안은 '주요 뉴스'에 따로 두었습니다. 내 상황에 어떻게 적용되는지 궁금하시면 편하게 연락 주세요.",
  areaLabel: "전국",
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
  /** 이 시군구를 맡은 사무소에서는 '우리 지역'으로 잡히는 샘플 (예: 미추홀구) */
  localArea?: string;
}

function mk(s: SeedSpec, area?: AreaConfig): Issue {
  const isLocal = Boolean(s.localArea && area?.sigungu && (area.sigungu.includes(s.localArea) || s.localArea.includes(area.sigungu)));
  const region: Region = s.localArea ? (isLocal ? "local" : "other") : s.region;
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
    region,
    dong: isLocal ? s.dong ?? [] : [],
    place: detectPlace(s.title) ?? (s.agencyGroup === "local" ? shortName(s.agency) : null),
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

/** 샘플 이슈 10건. 설정에 시군구가 있으면 그 지역 샘플이 '우리 지역'으로 잡힙니다. */
export function seedIssues(area?: AreaConfig): Issue[] {
  const m = (s: SeedSpec) => mk(s, area);
  return [
    m({
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
        { publisher: "더구루", title: "한은, 두 달 연속 기준금리 인상…부동산 시장 관망세 짙어지나", url: "https://www.theguru.co.kr/news/article.html?no=106340", date: "2026-08-27" },
        { publisher: "연합뉴스", title: "기준금리 연속 인상에 주택 거래 더 위축…\"집값 하락은 제한적\"", url: "https://www.yna.co.kr/view/AKR20260827094000003", date: "2026-08-27" },
        { publisher: "한국일보", title: "금리 2연속 인상에 부동산 시장 멈칫?... '외곽 강세' 잦아들까", url: "https://www.hankookilbo.com/news/article/A2026082713390001494", date: "2026-08-27" },
        { publisher: "MS투데이", title: "금리 3% 시대…거래 얼고 집값은 버틴다", url: "https://www.mstoday.co.kr/news/articleView.html?idxno=102446", date: "2026-08-28" },
        { publisher: "뉴스핌", title: "내년 기준금리 3.5% 오나...\"거래 위축에도 집값 급락은 제한적\"", url: "https://www.newspim.com/news/view/20260901000973", date: "2026-09-01" },
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
        local: "4억 대출 기준 0.25%p 인상 시 연 이자 약 100만 원 증가. 우리 지역 매매 중위가는 아래 실거래 집계 타일 참고.",
      },
    }),
    m({
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
      officialUrl: null,
      articles: [
        { publisher: "헤럴드경제", title: "\"땅 놀리지 말고 집 지어라\"…내년 말까지 착공 땐 부담금 면제", url: "https://biz.heraldcorp.com/article/10871052", date: "2026-09-12" },
        { publisher: "이투데이", title: "다가구 4층까지 짓고 부담금 면제⋯'사라진 빌라' 공급 되살린다 [8·13 대책]", url: "https://www.etoday.co.kr/news/view/2614230", date: "2026-08-13" },
        { publisher: "더팩트", title: "[8·13 대책] '결혼 페널티' 없애고 민간 공급 밀어준다…금융·세제 지원", url: "https://news.tf.co.kr/read/economy/2353696.htm", date: "2026-08-13" },
        { publisher: "머니투데이", title: "강남·용산은 빠졌다…수도권 23만가구+α 첫 타자는 어디", url: "https://www.mt.co.kr/estate/2026/08/14/2026081322080769942", date: "2026-08-14" },
      ],
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
        faq: [{ q: "우리 동네에도 해당되나요?", a: "전국 공통 제도이지만 실제 효과는 착공 가능한 사업지가 있는 곳에 한정됩니다. 정비사업 구역과 미착공 택지가 주 대상입니다." }],
        local: "관할 정비구역의 착공 시점이 앞당겨질 수 있음. 조합 일정과 인허가 단계 확인 필요.",
      },
    }),
    m({
      id: "sample-rent-stat",
      title: "전세 사라질수록 월세 오른다…서울 월세 160만원 시대",
      summary: "한국부동산원 집계로 서울 아파트 평균 월세가 160만 원을 넘었다. 올해 1~5월 전국 임대차 거래 중 월세 비중은 68.6%로 전년 대비 7.6%p 늘었다.",
      sourceKind: "sample",
      sourceName: "뉴시스",
      agency: "한국부동산원",
      agencyGroup: "reb",
      status: "STAT",
      topic: "lease",
      region: "metro",
      publishedAt: "2026-09-12T12:30:00+09:00",
      officialUrl: null,
      articles: [
        { publisher: "뉴시스", title: "전세 사라질수록 월세 오른다…서울 월세 160만원 시대", url: "https://www.newsis.com/view/NISX20260911_0003786400", date: "2026-09-12" },
        { publisher: "데일리안", title: "집은 나중에, 전월세는 지금…국토위 국감, '주거정책' 공방 예고", url: "https://www.dailian.co.kr/news/view/1687316/", date: "2026-09-08" },
        { publisher: "조선일보", title: "공급 겉도는 사이 집값 더 뛰어… 전세 규제에 월세도 14% 올라", url: "https://www.chosun.com/economy/real_estate/2026/09/07/3DEACJUJYJAWVCUADFXK6DI7II/", date: "2026-09-07" },
        { publisher: "뉴시스", title: "\"월급보다 월세가 더 올라\"…서울 아파트 월세 160만원 돌파[월세시대①]", url: "https://www.newsis.com/view/NISX20260904_0003776967", date: "2026-09-05" },
        { publisher: "뉴스1", title: "[8·3 세제개편 한 달]② 서울 전세 매물 13%↓…전셋값 역대 최고 7.1억", url: "https://www.news1.kr/realestate/general/6275218", date: "2026-09-01" },
      ],
      customer: {
        headline: "월세가 계속 오르고 있어요. 전세를 찾는다면 서두르세요",
        what: "한국부동산원 통계로 서울 아파트 평균 월세가 처음 160만 원을 넘었고, 올해 전국 임대차 거래의 68.6%가 월세였습니다. 전세 물건이 줄고 월세로 옮겨 가는 흐름이 뚜렷합니다.",
        forMe: {
          first: "전세를 구한다면 물건이 빠르게 줄고 있어요. 전세대출 한도와 보증 가입 가능 여부를 먼저 확인하세요.",
          move: "임대 중인 집이 있다면 재계약 조건을 시장 흐름에 맞게 다시 볼 때예요.",
          asset: "월세 수요가 늘어 임대 수익 구조가 바뀌고 있어요. 전월세 전환율을 확인하세요.",
        },
        actions: ["우리 지역 전세·월세 실거래 확인하기(아래 '우리 동네 숫자' 참고)", "전세보증보험 가입 가능 여부 확인하기", "재계약 예정이라면 갱신요구권 사용 여부 정하기"],
        glossary: { term: "전월세 전환율", def: "전세보증금을 월세로 바꿀 때 적용하는 비율이에요. 법정 상한(기준금리+2%p)이 있어 그 이상을 요구하면 거절할 수 있습니다." },
      },
      broker: {
        facts: ["서울 아파트 평균 월세 160만 원 초과(부동산원 집계 이후 최초), 올해 월세 누적 상승률 5.73%", "올해 1~5월 전국 임대차 거래 중 월세 비중 68.6%(전년 대비 +7.6%p)", "우리 지역 수치는 실거래 API 집계(우리 동네 숫자)로 대체"],
        script: ["전세 → 월세 전환 요구 시 법정 전환율(기준금리+2%p)을 계산해 보여 줍니다.", "임차인 고객에게는 보증보험 가입 요건(전세가율·공시가격)을 먼저 확인합니다."],
        checklist: ["임대차 신고(rtms) 30일 내 이행 안내", "갱신 계약 시 5% 상한·전환율 계산 근거를 계약서 특약에 기재"],
        faq: [{ q: "월세로 바꾸자는데 얼마가 적정한가요?", a: "법정 전환율로 계산한 값을 상한선으로 두고, 주변 실거래 월세와 비교해 제시합니다." }],
        local: "우리 지역 월세 평균과 전세 중위가는 실거래 집계 타일 참고. 역세권 소형 월세 수요가 특히 빠르게 늡니다.",
      },
    }),
    m({
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
        { publisher: "스마트비즈앤", title: "집 보려면 돈 내라고? '임장비' 논란에 부동산 시장 시끌", url: "https://www.smartbizn.com/news/articleView.html?idxno=153623", date: "2026-09-11" },
        { publisher: "뉴스핌", title: "\"집 보려면 돈 내세요\"…부동산 시장 다시 번진 '임장비' 논란", url: "https://www.newspim.com/news/view/20260909000246", date: "2026-09-09" },
        { publisher: "뉴시스", title: "\"매물 보러 가는데 돈 내라고?\"…다시 불붙은 '임장비' 논란", url: "https://www.newsis.com/view/NISX20260908_0003780557", date: "2026-09-08" },
        { publisher: "경기일보", title: "\"계약 안 해도 돈 내라니\"…공인중개사 '임장비' 논란 재점화", url: "https://www.kyeonggi.com/article/20260908580214", date: "2026-09-08" },
        { publisher: "TV조선", title: "[티조챗] 복비도 비싼데 집 구경비까지 내라고?…부동산 '임장비' 추진 논란", url: "https://news.tvchosun.com/site/data/html_dir/2026/09/08/2026090890127.html", date: "2026-09-08" },
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
    m({
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
      articles: [
        { publisher: "뉴스1", title: "'법정단체' 공인중개사협회 \"카르텔 감시센터 운영…임장비도 추진\"", url: "https://www.news1.kr/realestate/general/6270419", date: "2026-08-27" },
        { publisher: "뉴시스", title: "'법정단체' 중개사협회 \"중개보수 정률제·임장비 필요\"", url: "https://www.newsis.com/view/NISX20260826_0003764162", date: "2026-08-27" },
        { publisher: "파이낸셜뉴스", title: "김종호 공인중개사협회장 \"법정단체, 권한 아닌 책임…자정 기능 강화할 것\"", url: "https://www.fnnews.com/news/202608262121199744", date: "2026-08-27" },
        { publisher: "서울경제", title: "법정단체 출범 앞둔 공인중개사협회…\"전세사기·불법 중개 근절\"", url: "https://www.sedaily.com/article/20083586", date: "2026-08-27" },
      ],
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
    m({
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
      officialUrl: null,
      articles: [
        { publisher: "한국아파트신문", title: "공인중개사, 원룸ㆍ오피스텔 계약 전 공동관리비 설명 의무화", url: "https://www.hapt.co.kr/news/articleView.html?idxno=169254", date: "2026-08-14" },
        { publisher: "조선비즈", title: "원룸·오피스텔 '깜깜이 공동 관리비' 손본다… 중개사 설명 의무화", url: "https://biz.chosun.com/real_estate/real_estate_general/2026/08/11/S6ZHFQVVZVEN3G4HWKRY6R6IKI/", date: "2026-08-11" },
        { publisher: "MBC", title: "원룸·오피스텔 '깜깜이 관리비' 막는다‥공인중개사 설명 의무화", url: "https://imnews.imbc.com/news/2026/econo/article/6843914_36932.html", date: "2026-08-11" },
        { publisher: "뉴스1", title: "원룸·오피스텔 '깜깜이 관리비' 막는다…공인중개사 설명 의무화", url: "https://www.news1.kr/realestate/general/6254952", date: "2026-08-11" },
      ],
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
    m({
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
    m({
      id: "sample-incheon-status",
      title: "인천 재개발·재건축 124곳…부평·미추홀에 절반, 착공 전 단계만 25곳",
      summary:
        "인천의 도시정비사업이 124곳(후보지 포함), 소규모주택정비가 109곳으로 집계됐다. 이 가운데 착공 직전 단계가 25곳(관리처분 14·사업시행인가 11)이다. 자치구별로는 부평구 27%, 미추홀구 24%, 서구 16% 순으로 몰려 있다.",
      sourceKind: "sample",
      sourceName: "인천투데이",
      agency: "인천광역시",
      agencyGroup: "local",
      status: "STAT",
      topic: "redev",
      region: "other",
      localArea: "미추홀구",
      dong: ["주안동", "도화동", "숭의동", "용현동"],
      publishedAt: "2026-09-09T09:00:00+09:00",
      officialUrl: "https://renewal.incheon.go.kr/ires/program/0000-0011-0025/program/business/search.do",
      articles: [
        {
          publisher: "인천투데이",
          title: "[특집] 인천 재개발·재건축, 공공성 확보돼야",
          url: "https://www.incheontoday.com/news/articleView.html?idxno=309387",
          date: "2026-09-09",
        },
        {
          publisher: "인천in",
          title: "인천 정비사업, 부평·미추홀구에 집중… \"교통망 확충 맞물려 경쟁력 커질것\"",
          url: "https://www.incheonin.com/news/articleView.html?idxno=112049",
          date: "2026-09-05",
        },
        {
          publisher: "한경비즈니스",
          title: "인천 부동산, 미추홀구·부평구 중심으로 개발 활기",
          url: "https://magazine.hankyung.com/business/article/202510224705b",
          date: "2026-08-28",
        },
      ],
      personas: { "매수 예정자": 4, "공인중개사": 5, 무주택자: 3 },
      customer: {
        headline: "인천 정비사업, 우리 동네는 어느 단계인가요",
        what: "인천 전역에서 재개발·재건축이 124곳(후보지 포함) 진행 중입니다. 그중 25곳은 관리처분·사업시행인가를 받아 착공을 앞두고 있습니다. 부평구와 미추홀구에 절반이 몰려 있습니다.",
        forMe: {
          first: "구역 안 물건은 입주권 요건이 따로 있습니다. 지번으로 구역 포함 여부부터 확인하세요.",
          move: "착공 전 단계 구역은 이주 수요가 먼저 움직입니다. 갈아타기 시점을 그 일정에 맞춰 보세요.",
          asset: "관리처분 이후에는 조합원 지위 양도 제한이 걸릴 수 있습니다. 매도 계획이 있으면 단계를 먼저 확인하세요.",
        },
        glossary: { term: "관리처분계획", def: "누가 어느 집을 받고 얼마를 더 내는지 정하는 단계입니다. 여기까지 오면 착공이 가깝습니다." },
        actions: ["인천시 정비사업 검색에서 우리 동네 구역과 단계 확인하기", "보유 주택이 구역 안인지 지번으로 확인하기"],
      },
      broker: {
        facts: [
          "인천 도시정비사업 124곳(후보지 포함) · 소규모주택정비 109곳 — 인천투데이 집계",
          "착공 전 단계 25곳: 관리처분 14 · 사업시행인가 11",
          "자치구 비중: 부평구 27% · 미추홀구 24% · 서구 16% — 인천in",
          "iH 인천도시공사: 동인천역·제물포역·굴포천역 일대 3개 사업 약 30,795세대",
          "인천시 2차 재개발 후보지 33곳 선정(약 5만 세대 공급 가능)",
        ],
        script: [
          "구역 '지정'과 '착공'을 구분해 설명합니다. 지정은 시작이고 완공까지 통상 10년 안팎입니다.",
          "착공 전 단계(관리처분·사업시행인가) 구역은 이주 수요가 먼저 붙는다고 안내합니다.",
        ],
        checklist: ["담당 구역의 현재 단계를 인천시 정비사업 검색에서 확인", "구역 내 매물은 조합원 지위 양도 제한 여부 확인 후 설명서 기재"],
        faq: [{ q: "지금 사면 새 아파트 받나요?", a: "구역·단계·취득 시점에 따라 달라집니다. 조합원 자격 요건을 먼저 확인해야 하며 단정하지 않습니다." }],
        local: "부평구·미추홀구에 절반. 주안·도화·숭의·용현 일대와 부평 산곡 일대가 축입니다.",
      },
    }),
    m({
      id: "sample-incheon-sangok",
      title: "부평 산곡5구역 사업시행계획 변경 인가…최고 37층 1,565세대로",
      summary:
        "부평구가 산곡5구역 재개발조합의 사업시행계획 변경안을 인가했다. 2011년 최초 인가 이후 14년 만의 새 계획으로 최고 37층 15개 동 1,565세대를 짓는다. 시공은 GS건설·포스코이앤씨 컨소시엄이 맡고 이주 개시 목표는 2026년 말~2027년 초다.",
      sourceKind: "sample",
      sourceName: "위클리한국주택경제신문",
      agency: "부평구",
      agencyGroup: "local",
      status: "LOCAL_NOTICE",
      topic: "redev",
      region: "other",
      localArea: "부평구",
      dong: ["산곡동"],
      publishedAt: "2026-09-06T10:00:00+09:00",
      officialUrl: "https://www.icbp.go.kr/main/life/cr/status.jsp",
      articles: [
        {
          publisher: "위클리한국주택경제신문",
          title: "인천 산곡6구역 관리처분 변경… 막바지 재개발 속도",
          url: "https://www.arunews.com/news/articleView.html?idxno=52217",
          date: "2026-09-04",
        },
        {
          publisher: "인천투데이",
          title: "부평 산곡구역 재개발 2500여세대 8월 내 착공, 2028년 2월 준공",
          url: "https://www.incheontoday.com/news/articleView.html?idxno=250897",
          date: "2026-08-14",
        },
      ],
      personas: { "매수 예정자": 4, "공인중개사": 5, "임차인": 4 },
      customer: {
        headline: "부평 산곡 일대, 이주가 곧 시작됩니다",
        what: "부평구가 산곡5구역 사업시행계획 변경을 인가했습니다. 최고 37층 1,565세대로 바뀌었고 이주 개시 목표는 2026년 말~2027년 초입니다. 옆 산곡6구역도 관리처분 변경을 마쳤습니다.",
        forMe: {
          first: "이주가 시작되면 주변 전월세 매물이 한꺼번에 줄어듭니다. 계약 시점을 앞당겨 잡아 보세요.",
          move: "이주 수요가 먼저 붙는 구간입니다. 인근 단지 시세 흐름을 같이 보세요.",
          asset: "임대 중이라면 이주 일정과 임차인 계약 만료일을 맞춰 두는 편이 낫습니다.",
        },
        glossary: { term: "사업시행계획인가", def: "몇 층·몇 세대로 지을지 확정하는 단계입니다. 다음이 관리처분, 그다음이 이주·철거입니다." },
        actions: ["부평구 정비사업 현황에서 구역 경계와 단계 확인하기", "이주 일정에 맞춰 전월세 계약 시점 잡기"],
      },
      broker: {
        facts: [
          "산곡5구역: 최고 37층 15개 동 1,565세대, 2011년 최초 사업시행인가 이후 14년 만의 변경 인가",
          "시공: GS건설·포스코이앤씨 컨소시엄",
          "이주 개시 목표: 2026년 말~2027년 초",
          "산곡6구역: 부평구 산곡동 10번지 일원 123,461.5㎡ · 2,706세대, 관리처분계획 변경 완료",
        ],
        script: [
          "이주 개시는 '목표'입니다. 조합 사정으로 미뤄질 수 있다고 함께 설명합니다.",
          "이주가 시작되면 인근 전월세 물량이 줄어듭니다. 임차인 고객에게는 계약 시점을 먼저 잡아 드립니다.",
        ],
        checklist: ["산곡5·6구역 경계 지번 목록 확보", "구역 내 매물은 조합원 지위 양도 제한 여부 확인", "인근 전월세 재고 추이 주간 점검"],
        faq: [{ q: "이주비는 얼마나 나오나요?", a: "조합·시공사 조건에 따라 달라집니다. 조합 공지로 확인하시는 것이 정확합니다." }],
        local: "부평구 산곡동 일대. 산곡5·6구역과 갈산1·부개4구역이 같은 축입니다.",
      },
    }),
    m({
      id: "sample-gg-jeonse-ai",
      title: "전세사기, 계약 전에 AI로 잡는다…경기도의회 안전망 조례안",
      summary: "경기도의회에 전세사기 예방 AI 권리분석 안전망 구축·운영 조례안이 올라왔다. 개업공인중개사와 거래 당사자 등 누구나 이용할 수 있도록 하고, 관계기관 업무협약과 정보 수집 근거를 담았다.",
      sourceKind: "sample",
      sourceName: "아시아타임즈",
      agency: "경기도",
      agencyGroup: "local",
      status: "IN_ASSEMBLY",
      topic: "lease",
      region: "metro",
      publishedAt: "2026-09-07T16:42:00+09:00",
      articles: [
        { publisher: "아시아타임즈", title: "전세사기, 계약 전에 AI로 잡는다⋯ 경기도의회 민생·교육·안전 조례", url: "https://www.asiatime.co.kr/article/20260907500350", date: "2026-09-07" },
        { publisher: "이투데이", title: "전세사기 피해 최다 수원…주소 넣으면 AI가 거래 위험 진단", url: "https://www.etoday.co.kr/news/view/2622813", date: "2026-09-07" },
        { publisher: "서울신문", title: "경기도의회 도시환경위원회, 제393회 임시회 제1차 회의 개최", url: "https://www.seoul.co.kr/news/publicnews/local_govern/kyungki_do/2026/09/07/20260907500257", date: "2026-09-07" },
        { publisher: "경기매일", title: "김태희 경기도의원, \"전세사기 사후 대응보다 거래 단계 예방 중요\"", url: "https://www.kmaeil.com/news/articleView.html?idxno=649935", date: "2026-08-28" },
      ],
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
