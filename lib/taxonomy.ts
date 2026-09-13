import type { AgencyGroup, Period, Persona, Region, Segment, Status, Topic } from "./types";

/** B축 정책 단계 — 기존 7단계 + 통계 발표 + 지자체 고시·공고 */
export const STATUS_LABEL: Record<Status, string> = {
  CONFIRMED: "확정·시행",
  SCHEDULED: "시행 예정",
  LEGISLATIVE_NOTICE: "입법예고",
  IN_ASSEMBLY: "국회 심의 중",
  UNDER_REVIEW: "정부 검토",
  PRESS_REPORTED: "언론 보도",
  OUTLOOK: "전망·분석",
  STAT: "통계 발표",
  LOCAL_NOTICE: "지자체 고시·공고",
};

export const STATUS_TONE: Record<Status, "ok" | "warn" | "info" | "neutral"> = {
  CONFIRMED: "ok",
  SCHEDULED: "ok",
  STAT: "info",
  LOCAL_NOTICE: "info",
  LEGISLATIVE_NOTICE: "warn",
  IN_ASSEMBLY: "warn",
  UNDER_REVIEW: "warn",
  PRESS_REPORTED: "neutral",
  OUTLOOK: "neutral",
};

export const STATUSES = Object.keys(STATUS_LABEL) as Status[];

/** C축 주제 */
export const TOPIC_LABEL: Record<Topic, string> = {
  rate: "금리·대출",
  tax: "세금",
  subs: "청약·분양",
  supply: "공급·택지·신도시",
  redev: "정비사업",
  lease: "임대차·전세 안전",
  transit: "교통·개발",
  stat: "시장 통계",
  regulation: "규제지역·거래허가",
  broker: "중개업 제도",
};
export const TOPICS = Object.keys(TOPIC_LABEL) as Topic[];

/** 영상 기사 — 저장해 두는 편수와 브리핑·EDM에 싣는 편수 */
export const VIDEO_KEEP = 40;
export const VIDEO_IN_BRIEF = 3;

/** E축 지역 */
export const REGION_LABEL: Record<Region, string> = {
  national: "전국",
  metro: "수도권",
  local: "우리 지역",
  other: "타 지역",
};

/**
 * 뱃지에 쓸 지역 이름. 제목에 지명이 있으면 그 이름을(서울·부산·안양), 없으면 4단계 라벨을 씁니다.
 * '우리 지역'은 고객이 읽는 말이라 지명으로 바꾸지 않습니다.
 */
export function regionLabel(region: Region, place?: string | null): string {
  if (region === "local") return REGION_LABEL.local;
  return place || REGION_LABEL[region];
}

/** 구버전 저장본의 지역 값을 현재 4종으로 옮깁니다 */
const LEGACY_REGION: Record<string, Region> = { seoul: "metro", gyeonggi: "metro", anyang: "local" };
export function normalizeRegion(r: unknown): Region {
  if (typeof r === "string") {
    if (r in REGION_LABEL) return r as Region;
    if (r in LEGACY_REGION) return LEGACY_REGION[r];
  }
  return "national";
}
export const REGIONS = Object.keys(REGION_LABEL) as Region[];

/** A축 발표 주체 */
export const AGENCY_GROUP_LABEL: Record<AgencyGroup, string> = {
  molit: "국토교통부",
  fsc: "금융위원회·금감원",
  mofe: "재정경제부",
  nts: "국세청",
  bok: "한국은행",
  reb: "부동산원·HUG·LH",
  law: "법제처·국회",
  local: "지자체",
  industry: "협회·업계",
  press: "언론",
  other: "기타",
};
export const AGENCY_GROUPS = Object.keys(AGENCY_GROUP_LABEL) as AgencyGroup[];

/** D축 영향 대상 */
export const PERSONAS: Persona[] = [
  "무주택자",
  "1주택자",
  "다주택자",
  "매수 예정자",
  "매도 예정자",
  "임대인",
  "임차인",
  "공인중개사",
];

/** 고객 세그먼트 3종 — 보유형태 7종의 묶음 */
export const SEGMENTS: Record<Segment, { label: string; personas: Persona[]; desc: string; topics: Topic[] }> = {
  first: {
    label: "내집마련",
    personas: ["무주택자", "임차인"],
    desc: "무주택자 · 임차인 · 청약 준비",
    topics: ["rate", "subs", "lease", "stat", "supply"],
  },
  move: {
    label: "보유·갈아타기",
    personas: ["1주택자", "매수 예정자", "매도 예정자"],
    desc: "1주택자 · 매수 예정 · 매도 예정",
    topics: ["tax", "regulation", "stat", "redev", "rate"],
  },
  asset: {
    label: "자산·임대",
    personas: ["다주택자", "임대인"],
    desc: "다주택자 · 임대인 · 투자",
    topics: ["tax", "lease", "redev", "stat", "regulation"],
  },
};
export const SEGMENT_KEYS = Object.keys(SEGMENTS) as Segment[];

export const PERIOD_LABEL: Record<Period, string> = { daily: "DAILY", weekly: "WEEKLY", monthly: "MONTHLY" };
export const PERIOD_TITLE: Record<Period, string> = {
  daily: "오늘의 부동산 브리핑",
  weekly: "이번 주 부동산 브리핑",
  monthly: "이달의 부동산 브리핑",
};
/** R8 분량 상한 */
export const PERIOD_LIMIT: Record<Period, number> = { daily: 3, weekly: 5, monthly: 8 };
/** R8 신선도 창 */
export const PERIOD_WINDOW_MS: Record<Period, number> = {
  daily: 48 * 3600 * 1000,
  weekly: 7 * 24 * 3600 * 1000,
  monthly: 31 * 24 * 3600 * 1000,
};

/** R1 고객용 본문에 실을 수 있는 단계 */
export const CUSTOMER_BODY_STATUSES: Status[] = ["CONFIRMED", "SCHEDULED", "STAT"];

/** 주제별 보유형태 영향도 기본값 (0~5). 분류기 초안이며 스튜디오에서 수정합니다. */
export const PERSONA_MATRIX: Record<Topic, Record<Persona, number>> = {
  rate: { 무주택자: 4, "1주택자": 3, 다주택자: 3, "매수 예정자": 4, "매도 예정자": 3, 임대인: 2, 임차인: 3, 공인중개사: 4 },
  tax: { 무주택자: 1, "1주택자": 3, 다주택자: 5, "매수 예정자": 3, "매도 예정자": 4, 임대인: 4, 임차인: 1, 공인중개사: 4 },
  subs: { 무주택자: 5, "1주택자": 2, 다주택자: 1, "매수 예정자": 4, "매도 예정자": 1, 임대인: 1, 임차인: 3, 공인중개사: 3 },
  supply: { 무주택자: 3, "1주택자": 2, 다주택자: 2, "매수 예정자": 3, "매도 예정자": 2, 임대인: 1, 임차인: 2, 공인중개사: 3 },
  redev: { 무주택자: 2, "1주택자": 3, 다주택자: 3, "매수 예정자": 3, "매도 예정자": 3, 임대인: 3, 임차인: 2, 공인중개사: 4 },
  lease: { 무주택자: 3, "1주택자": 1, 다주택자: 3, "매수 예정자": 1, "매도 예정자": 1, 임대인: 5, 임차인: 5, 공인중개사: 4 },
  transit: { 무주택자: 2, "1주택자": 3, 다주택자: 3, "매수 예정자": 4, "매도 예정자": 3, 임대인: 2, 임차인: 1, 공인중개사: 3 },
  stat: { 무주택자: 3, "1주택자": 3, 다주택자: 3, "매수 예정자": 4, "매도 예정자": 4, 임대인: 2, 임차인: 3, 공인중개사: 4 },
  regulation: { 무주택자: 3, "1주택자": 3, 다주택자: 4, "매수 예정자": 5, "매도 예정자": 4, 임대인: 3, 임차인: 1, 공인중개사: 5 },
  broker: { 무주택자: 1, "1주택자": 1, 다주택자: 1, "매수 예정자": 2, "매도 예정자": 2, 임대인: 1, 임차인: 2, 공인중개사: 5 },
};

/** 고객용 용어 풀이 사전 — 이슈에 용어가 없을 때 주제별 기본값 */
export const TOPIC_GLOSSARY: Record<Topic, { term: string; def: string }> = {
  rate: {
    term: "기준금리",
    def: "한국은행이 정하는 정책금리예요. 은행 대출금리는 여기에 가산금리가 더해져 정해지니, 실제 내 금리는 대출 약정서의 금리 변경일과 함께 확인하세요.",
  },
  tax: {
    term: "양도소득세",
    def: "집을 팔아 남긴 차익에 매기는 세금이에요. 보유 기간, 주택 수, 거주 여부에 따라 세율과 비과세 여부가 크게 달라집니다.",
  },
  subs: {
    term: "청약가점제",
    def: "무주택 기간, 부양가족 수, 청약통장 가입 기간을 점수로 매겨 당첨자를 정하는 방식이에요. 점수가 높을수록 당첨 확률이 올라갑니다.",
  },
  supply: {
    term: "공공택지",
    def: "국가나 LH 같은 공공기관이 조성해 주택을 짓는 땅이에요. 분양가가 상대적으로 낮은 대신 청약 자격과 전매 제한이 따릅니다.",
  },
  redev: {
    term: "정비구역",
    def: "재개발·재건축을 할 수 있도록 지자체가 지정한 구역이에요. 지정되면 사업이 시작되지만, 완공까지는 보통 10년 안팎이 걸립니다.",
  },
  lease: {
    term: "전세가율",
    def: "매매가격 대비 전세보증금 비율이에요. 이 비율이 너무 높으면 집값이 내릴 때 보증금을 돌려받기 어려워질 수 있습니다.",
  },
  transit: {
    term: "역세권",
    def: "보통 역에서 걸어서 10분 안쪽인 지역을 말해요. 개통 계획은 착공부터 개통까지 여러 단계가 남아 실제 시점이 늦어지는 일이 흔합니다.",
  },
  stat: {
    term: "실거래가",
    def: "실제로 계약된 가격을 국토교통부에 신고한 값이에요. 신고 기한이 30일이라 최근 두 달 수치는 나중에 더 늘어날 수 있습니다.",
  },
  regulation: {
    term: "조정대상지역",
    def: "집값이 빠르게 오른 곳에 정부가 지정하는 규제지역이에요. 지정되면 대출 한도와 세금, 청약 조건이 함께 까다로워집니다.",
  },
  broker: {
    term: "중개대상물 확인·설명서",
    def: "계약 전에 공인중개사가 집의 권리관계와 상태를 확인해 설명하는 서류예요. 계약서와 함께 꼭 받아 두세요.",
  },
};
