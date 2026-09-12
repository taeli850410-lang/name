import type { Keyword } from "./customers";

export type DealStatus = "의뢰" | "계약" | "잔금완료" | "입주" | "만료";
export type Deal = {
  id: string;
  name: string;
  kind: "신규" | "재계약";
  method: "매매" | "전세" | "월세";
  status: DealStatus;
  propertyId?: string;
  propertyName: string;
  seller: string;
  buyer: string;
  buyerId?: string;
  coSeller?: string;
  down?: number; // 계약금 만원
  interim?: number; // 중도금
  balance?: number; // 잔금
  monthly?: number;
  fee?: number; // 중개보수
  contractDate?: string;
  interimDate?: string;
  balanceDate?: string;
  moveInDate?: string;
  expiryDate?: string;
  registryAlert: boolean;
  verified: boolean;
  keywords: Keyword[];
  memo: string;
  createdAt: string;
};

export const DEAL_STATUSES: DealStatus[] = ["의뢰", "계약", "잔금완료", "입주", "만료"];

export const deals: Deal[] = [
  { id: "d1", name: "더샵부평 110동 103호 전세", kind: "신규", method: "전세", status: "계약", propertyId: "p1", propertyName: "더샵부평 110동 103호", seller: "이수현", buyer: "박지훈", buyerId: "c001", down: 4200, interim: 0, balance: 37800, fee: 168, contractDate: "2026-08-15", balanceDate: "2026-09-30", moveInDate: "2026-10-01", expiryDate: "2028-09-30", registryAlert: true, verified: true, keywords: [{ label: "입주 예정", color: "blue" }, { label: "등기 감시", color: "teal" }], memo: "잔금 당일 확정일자 동행", createdAt: "2026-08-08" },
  { id: "d2", name: "청라 한양수자인 205동 1502호 매매", kind: "신규", method: "매매", status: "계약", propertyId: "p5", propertyName: "청라 한양수자인 205동 1502호", seller: "오지민", buyer: "김민수", buyerId: "c002", down: 7800, interim: 20000, balance: 50200, fee: 312, contractDate: "2026-08-31", interimDate: "2026-09-25", balanceDate: "2026-10-30", moveInDate: "2026-10-30", registryAlert: false, verified: true, keywords: [{ label: "세금 확인", color: "orange" }, { label: "매도인 대리", color: "purple" }], memo: "중도금 대출 승인 대기", createdAt: "2026-08-29" },
  { id: "d3", name: "판교 오피스텔 1203호 월세", kind: "재계약", method: "월세", status: "의뢰", propertyId: "p3", propertyName: "판교 테크노밸리 오피스텔 1203호", seller: "한서윤", buyer: "-", down: 0, monthly: 120, contractDate: undefined, expiryDate: "2026-09-26", registryAlert: false, verified: true, keywords: [{ label: "계약 연장", color: "green" }], memo: "임차인 연장 의사 확인 필요", createdAt: "2026-08-22" },
  { id: "d4", name: "부천 중동 신축빌라 302호 전세", kind: "신규", method: "전세", status: "잔금완료", propertyId: "p6", propertyName: "부천 중동 신축빌라 302호", seller: "류가은", buyer: "정하은", buyerId: "c004", down: 2100, balance: 18900, fee: 84, contractDate: "2026-08-05", balanceDate: "2026-09-05", moveInDate: "2026-09-06", expiryDate: "2028-09-05", registryAlert: true, verified: true, keywords: [{ label: "입주 완료", color: "green" }], memo: "", createdAt: "2026-08-04" },
  { id: "d5", name: "마곡 힐스테이트 301동 2201호 전세 재계약", kind: "재계약", method: "전세", status: "계약", propertyId: "p8", propertyName: "마곡 힐스테이트 301동 2201호", seller: "허나은", buyer: "남유진", down: 0, balance: 5000, fee: 130, contractDate: "2026-09-02", balanceDate: "2026-09-13", expiryDate: "2028-09-12", registryAlert: true, verified: true, keywords: [{ label: "증액분 잔금", color: "orange" }], memo: "증액분 5,000만원 09-13 입금 예정", createdAt: "2026-09-01" },
  { id: "d6", name: "계산동 상가 1층 월세", kind: "신규", method: "월세", status: "의뢰", propertyId: "p4", propertyName: "계산동 상가 1층", seller: "이수현", buyer: "-", down: 0, monthly: 250, registryAlert: false, verified: false, keywords: [{ label: "공실", color: "gray" }], memo: "권리금 없음, 즉시 입점 가능", createdAt: "2026-08-20" },
  { id: "d7", name: "부평 금호어울림 102동 801호 전세", kind: "신규", method: "전세", status: "의뢰", propertyId: "p2", propertyName: "부평 금호어울림 102동 801호", seller: "박정우", buyer: "-", down: 0, balance: 30000, registryAlert: false, verified: true, keywords: [], memo: "9월 말 퇴거 예정, 사진 촬영 필요", createdAt: "2026-08-08" },
  { id: "d8", name: "구월동 원룸 월세 (만료)", kind: "신규", method: "월세", status: "만료", propertyName: "구월동 프라임빌 402호", seller: "백승현", buyer: "송예린", down: 500, monthly: 55, contractDate: "2024-08-20", moveInDate: "2024-08-25", expiryDate: "2026-08-24", registryAlert: false, verified: true, keywords: [{ label: "재계약 거절", color: "gray" }], memo: "", createdAt: "2024-08-18" },
];

export function dealById(id: string) {
  return deals.find((d) => d.id === id);
}
