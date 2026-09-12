import { addDays, pick, seeded, TODAY } from "@/lib/format";

/** 관심유형 분류 — 등록·필터·엑셀 양식이 모두 이 하나를 쓴다. */
export const INTEREST_TYPES = [
  "아파트",
  "빌라·다세대",
  "원룸·투룸",
  "다가구주택",
  "상가주택",
  "단독주택",
  "오피스텔",
  "상가",
  "사무실",
  "공장·창고",
  "건물",
  "토지",
  "분양권",
  "입주권",
  "기타",
] as const;
export type InterestType = (typeof INTEREST_TYPES)[number];

export const CONTRACT_TYPES = ["매매", "전세", "월세"] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];

export type KeywordColor = "red" | "orange" | "yellow" | "green" | "teal" | "blue" | "purple" | "pink" | "gray";
export type Keyword = { label: string; color: KeywordColor };

/** 메모 키워드 카탈로그(고객용) */
export const CUSTOMER_KEYWORDS: Keyword[] = [
  { label: "급매 희망", color: "red" },
  { label: "급구", color: "red" },
  { label: "컴플레인 주의", color: "red" },
  { label: "예산 빠듯", color: "orange" },
  { label: "대출 필요", color: "orange" },
  { label: "부재중", color: "yellow" },
  { label: "결정 보류", color: "yellow" },
  { label: "신중한 편", color: "yellow" },
  { label: "적극적", color: "green" },
  { label: "가망고객", color: "green" },
  { label: "가격협의 가능", color: "green" },
  { label: "현금 보유", color: "green" },
  { label: "즉시 입주 희망", color: "green" },
  { label: "재계약 희망", color: "green" },
  { label: "자녀 학군 중시", color: "teal" },
  { label: "반려동물 동반", color: "teal" },
  { label: "주차 필수", color: "teal" },
  { label: "실거주 목적", color: "blue" },
  { label: "첫 상담", color: "blue" },
  { label: "재방문", color: "blue" },
  { label: "이사 예정", color: "blue" },
  { label: "임차 희망", color: "blue" },
  { label: "투자 목적", color: "purple" },
  { label: "매도 의뢰", color: "purple" },
  { label: "매수 희망", color: "purple" },
  { label: "VIP", color: "pink" },
  { label: "소개 고객", color: "pink" },
  { label: "신혼부부", color: "pink" },
  { label: "단순문의", color: "gray" },
  { label: "연락두절", color: "gray" },
];

export const REGIONS = [
  "인천 부평구 부평동",
  "인천 부평구 십정동",
  "인천 부평구 산곡동",
  "인천 계양구 계산동",
  "인천 남동구 구월동",
  "인천 서구 청라동",
  "경기 부천시 중동",
  "경기 성남시 분당구 판교동",
  "서울 강서구 마곡동",
];

export type Customer = {
  id: string;
  name: string;
  /** 이름을 비워 두면 전화번호 뒷자리로 자동 생성된다 — 목록에서 구분 표시 */
  autoNamed: boolean;
  phone: string;
  carrier?: "SKT" | "KT" | "LGU+" | "알뜰폰";
  interestTypes: InterestType[];
  contractTypes: ContractType[];
  regions: string[];
  keywords: Keyword[];
  memo: string;
  alimtalkConsent: boolean;
  consentedAt?: string;
  registryAlert: boolean;
  createdAt: string;
  lastActivity: string;
  sends: number;
  deals: number;
  properties: number;
};

const SURNAMES = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임", "한", "오", "서", "신", "권", "황", "안", "송", "류", "전", "홍", "고", "문", "양", "손", "배", "백", "허", "유", "남"];
const GIVEN = ["민준", "서연", "지훈", "하은", "도윤", "지우", "예준", "수아", "시우", "지민", "하준", "서윤", "주원", "채원", "지호", "유진", "현우", "다은", "건우", "소율", "우진", "지아", "선우", "예은", "연우", "가은", "정우", "나은", "승현", "윤서", "태양", "은서", "재민", "하린", "성민", "미래", "동현", "예린", "준서", "수빈"];

function makeCustomers(count: number): Customer[] {
  const rnd = seeded(20260912);
  const out: Customer[] = [];
  for (let i = 0; i < count; i++) {
    const autoNamed = rnd() < 0.06;
    const last4 = String(1000 + Math.floor(rnd() * 9000));
    const mid = String(100 + Math.floor(rnd() * 900));
    const phone = `0100${mid}${last4}`;
    const name = autoNamed ? last4 : `${pick(rnd, SURNAMES)}${pick(rnd, GIVEN)}`;
    const nTypes = rnd() < 0.55 ? 1 + Math.floor(rnd() * 2) : 0;
    const interestTypes: InterestType[] = [];
    for (let k = 0; k < nTypes; k++) {
      const t = pick(rnd, INTEREST_TYPES);
      if (!interestTypes.includes(t)) interestTypes.push(t);
    }
    const contractTypes: ContractType[] = rnd() < 0.5 ? [pick(rnd, CONTRACT_TYPES)] : [];
    const regions = rnd() < 0.45 ? [pick(rnd, REGIONS)] : [];
    const keywords: Keyword[] = [];
    const nKw = rnd() < 0.5 ? 1 + Math.floor(rnd() * 3) : 0;
    for (let k = 0; k < nKw; k++) {
      const kw = pick(rnd, CUSTOMER_KEYWORDS);
      if (!keywords.some((x) => x.label === kw.label)) keywords.push(kw);
    }
    // 등록일: 최근 120일. 09-07에 대량등록이 있었다.
    const bulk = rnd() < 0.4;
    const createdAt = bulk ? "2026-09-07" : addDays(TODAY, -Math.floor(rnd() * 120));
    const lastActivity = addDays(createdAt, Math.floor(rnd() * 6));
    const consent = rnd() < 0.9;
    out.push({
      id: `c${String(i + 1).padStart(3, "0")}`,
      name,
      autoNamed,
      phone,
      carrier: rnd() < 0.6 ? pick(rnd, ["SKT", "KT", "LGU+", "알뜰폰"] as const) : undefined,
      interestTypes,
      contractTypes,
      regions,
      keywords,
      memo: rnd() < 0.3 ? pick(rnd, ["주말 오전 통화 선호", "전세 만기 10월 말", "부모님 명의 매수 검토", "직장 이전으로 이사 예정", "대출 한도 확인 필요", "소개: 박지훈 고객"]) : "",
      alimtalkConsent: consent,
      consentedAt: consent ? createdAt : undefined,
      registryAlert: rnd() < 0.5,
      createdAt,
      lastActivity: lastActivity > TODAY ? TODAY : lastActivity,
      sends: Math.floor(rnd() * 8),
      deals: rnd() < 0.08 ? 1 : 0,
      properties: rnd() < 0.05 ? 1 : 0,
    });
  }
  // 이름이 있는 고정 고객 몇 명 — 다른 화면(계약·약속·포털)과 이어진다.
  const fixed: Partial<Customer>[] = [
    { id: "c001", name: "박지훈", autoNamed: false, phone: "01003217788", interestTypes: ["아파트"], contractTypes: ["전세"], regions: ["인천 부평구 십정동"], keywords: [{ label: "즉시 입주 희망", color: "green" }, { label: "신혼부부", color: "pink" }], createdAt: "2026-08-02", lastActivity: "2026-09-11", deals: 1, sends: 6, registryAlert: true, alimtalkConsent: true, consentedAt: "2026-08-02", memo: "잔금 9/30 · 입주 10/1 · 등기부 감시 신청" },
    { id: "c002", name: "김민수", autoNamed: false, phone: "01004452201", interestTypes: ["아파트", "오피스텔"], contractTypes: ["매매"], regions: ["인천 부평구 부평동"], keywords: [{ label: "현금 보유", color: "green" }, { label: "가격협의 가능", color: "green" }], createdAt: "2026-07-15", lastActivity: "2026-09-10", deals: 1, sends: 4, memo: "오늘 10:00 상담 예정" },
    { id: "c003", name: "이수현", autoNamed: false, phone: "01006678093", interestTypes: ["상가"], contractTypes: ["월세"], regions: ["인천 계양구 계산동"], keywords: [{ label: "매도 의뢰", color: "purple" }], createdAt: "2026-06-20", lastActivity: "2026-09-05", properties: 1, sends: 3, memo: "" },
    { id: "c004", name: "정하은", autoNamed: false, phone: "01008810352", interestTypes: ["빌라·다세대"], contractTypes: ["전세"], regions: ["경기 부천시 중동"], keywords: [{ label: "첫 상담", color: "blue" }], createdAt: "2026-09-11", lastActivity: "2026-09-11", sends: 1, memo: "내일 11:00 방문" },
    { id: "c005", name: "최도윤", autoNamed: false, phone: "01002239471", interestTypes: ["토지"], contractTypes: ["매매"], regions: [], keywords: [{ label: "투자 목적", color: "purple" }, { label: "결정 보류", color: "yellow" }], createdAt: "2026-05-30", lastActivity: "2026-08-28", sends: 2, memo: "" },
  ];
  fixed.forEach((f, i) => Object.assign(out[i], f));
  return out;
}

export const customers: Customer[] = makeCustomers(188);

export function customerById(id: string): Customer | undefined {
  return customers.find((c) => c.id === id);
}
