import type { Keyword } from "./customers";

export type PropertyType = "아파트" | "오피스텔" | "빌라·다세대" | "상가" | "토지" | "단독주택";

export type Property = {
  id: string;
  name: string;
  type: PropertyType;
  address: string;
  roadAddress: string;
  dong?: string;
  ho?: string;
  floor?: string;
  ownerId?: string;
  ownerName?: string;
  coOwner?: string;
  areaM2?: number;
  parking?: number;
  contractTypes: ("매매" | "전세" | "월세")[];
  salePrice?: number; // 만원
  deposit?: number; // 만원
  monthly?: number; // 만원
  verified: boolean;
  registryWatch: boolean;
  tenantStatus: "임대중" | "공실" | "-";
  keywords: Keyword[];
  createdAt: string;
};

export const properties: Property[] = [
  { id: "p1", name: "더샵부평 110동 103호", type: "아파트", address: "인천 부평구 십정동 630 더샵부평센트럴시티 110동 103호", roadAddress: "인천 부평구 열우물로 90", dong: "110", ho: "103", floor: "1/29", ownerId: "c003", ownerName: "이수현", areaM2: 84.9, parking: 1.2, contractTypes: ["전세"], deposit: 42000, verified: true, registryWatch: true, tenantStatus: "임대중", keywords: [{ label: "풀옵션", color: "green" }, { label: "역세권", color: "blue" }], createdAt: "2026-08-13" },
  { id: "p2", name: "부평 금호어울림 102동 801호", type: "아파트", address: "인천 부평구 십정동 609 부평금호어울림 102동 801호", roadAddress: "인천 부평구 경원대로1110번길 20", dong: "102", ho: "801", floor: "8/20", ownerName: "박정우", areaM2: 59.8, parking: 1.0, contractTypes: ["전세", "월세"], deposit: 30000, monthly: 0, verified: true, registryWatch: true, tenantStatus: "임대중", keywords: [{ label: "즉시 입주", color: "green" }], createdAt: "2026-08-08" },
  { id: "p3", name: "판교 테크노밸리 오피스텔 1203호", type: "오피스텔", address: "경기 성남시 분당구 판교동 577-4 102호", roadAddress: "경기 성남시 분당구 서판교로 32", dong: "", ho: "1203", floor: "12/15", ownerName: "한서윤", areaM2: 33.1, parking: 0.5, contractTypes: ["월세"], deposit: 3000, monthly: 120, verified: true, registryWatch: false, tenantStatus: "공실", keywords: [{ label: "역세권", color: "blue" }, { label: "만기 임박", color: "orange" }], createdAt: "2026-07-15" },
  { id: "p4", name: "계산동 상가 1층", type: "상가", address: "인천 계양구 계산동 1075-3", roadAddress: "인천 계양구 계양대로 120", floor: "1/4", ownerId: "c003", ownerName: "이수현", areaM2: 66.1, contractTypes: ["월세"], deposit: 5000, monthly: 250, verified: false, registryWatch: false, tenantStatus: "공실", keywords: [{ label: "권리금 없음", color: "teal" }], createdAt: "2026-07-02" },
  { id: "p5", name: "청라 한양수자인 205동 1502호", type: "아파트", address: "인천 서구 청라동 168-1 205동 1502호", roadAddress: "인천 서구 청라라임로 60", dong: "205", ho: "1502", floor: "15/25", ownerName: "오지민", areaM2: 101.9, parking: 1.5, contractTypes: ["매매"], salePrice: 78000, verified: true, registryWatch: true, tenantStatus: "-", keywords: [{ label: "매도 의뢰", color: "purple" }, { label: "가격협의 가능", color: "green" }], createdAt: "2026-06-25" },
  { id: "p6", name: "부천 중동 신축빌라 302호", type: "빌라·다세대", address: "경기 부천시 중동 1148-2 302호", roadAddress: "경기 부천시 부일로 300", ho: "302", floor: "3/5", ownerName: "류가은", areaM2: 48.2, parking: 1.0, contractTypes: ["전세"], deposit: 21000, verified: true, registryWatch: true, tenantStatus: "임대중", keywords: [{ label: "올수리", color: "teal" }], createdAt: "2026-06-11" },
  { id: "p7", name: "구월동 단독주택", type: "단독주택", address: "인천 남동구 구월동 1233-9", roadAddress: "인천 남동구 인주대로 590", ownerName: "백승현", areaM2: 132.0, parking: 2.0, contractTypes: ["매매"], salePrice: 92000, verified: false, registryWatch: false, tenantStatus: "-", keywords: [], createdAt: "2026-05-20" },
  { id: "p8", name: "마곡 힐스테이트 301동 2201호", type: "아파트", address: "서울 강서구 마곡동 797 301동 2201호", roadAddress: "서울 강서구 마곡중앙로 161", dong: "301", ho: "2201", floor: "22/28", ownerName: "허나은", areaM2: 84.3, parking: 1.3, contractTypes: ["전세"], deposit: 65000, verified: true, registryWatch: true, tenantStatus: "임대중", keywords: [{ label: "재계약 희망", color: "green" }], createdAt: "2026-04-30" },
  { id: "p9", name: "산곡동 토지 320평", type: "토지", address: "인천 부평구 산곡동 산 12-4", roadAddress: "-", areaM2: 1057.8, contractTypes: ["매매"], salePrice: 150000, verified: false, registryWatch: false, tenantStatus: "-", keywords: [{ label: "투자", color: "purple" }], createdAt: "2026-03-18" },
];

export function propertyById(id: string) {
  return properties.find((p) => p.id === id);
}
