export type WatchStatus = "정상" | "변동" | "실패" | "대기";
export type RegistryWatch = {
  id: string;
  propertyId: string;
  propertyName: string;
  address: string;
  tenant: string;
  dealId?: string;
  lastChecked: string;
  nextCheck: string;
  status: WatchStatus;
  note?: string;
};

export const registryWatches: RegistryWatch[] = [
  { id: "w1", propertyId: "p1", propertyName: "더샵부평 110동 103호", address: "인천 부평구 십정동 630", tenant: "박지훈", dealId: "d1", lastChecked: "2026-09-12 17:02", nextCheck: "2026-09-13 10:00", status: "정상" },
  { id: "w2", propertyId: "p2", propertyName: "부평 금호어울림 102동 801호", address: "인천 부평구 십정동 609", tenant: "-", lastChecked: "2026-09-12 17:03", nextCheck: "2026-09-13 10:00", status: "정상" },
  { id: "w3", propertyId: "p6", propertyName: "부천 중동 신축빌라 302호", address: "경기 부천시 중동 1148-2", tenant: "정하은", dealId: "d4", lastChecked: "2026-09-12 10:04", nextCheck: "2026-09-13 10:00", status: "실패", note: "오후 조회 때 등기소 응답이 없었습니다. 다음 조회에서 자동으로 다시 시도합니다." },
  { id: "w4", propertyId: "p8", propertyName: "마곡 힐스테이트 301동 2201호", address: "서울 강서구 마곡동 797", tenant: "남유진", dealId: "d5", lastChecked: "2026-09-12 17:05", nextCheck: "2026-09-13 10:00", status: "정상" },
  { id: "w5", propertyId: "p5", propertyName: "청라 한양수자인 205동 1502호", address: "인천 서구 청라동 168-1", tenant: "-", lastChecked: "2026-09-12 17:06", nextCheck: "2026-09-13 10:00", status: "정상" },
];

export type RegistryChange = {
  id: string;
  foundAt: string;
  propertyName: string;
  tenant: string;
  summary: string;
  alimtalk: "발송 완료" | "발송 실패" | "미발송";
};

export const registryChanges: RegistryChange[] = [
  { id: "rc1", foundAt: "2026-08-28 10:07", propertyName: "마곡 힐스테이트 301동 2201호", tenant: "남유진", summary: "을구 근저당권 설정 (채권최고액 2억 4,000만원)", alimtalk: "발송 완료" },
  { id: "rc2", foundAt: "2026-07-19 17:12", propertyName: "부천 중동 신축빌라 302호", tenant: "정하은", summary: "갑구 소유권 이전 (매매)", alimtalk: "발송 완료" },
];

export const registryProgram = {
  running: true,
  lastPing: "2026-09-12 21:11",
  version: "v69",
  pc: "사무실 PC (DESKTOP-SY)",
  schedule: ["10:00", "17:00"],
  todayDone: 4,
  todayFailed: 1,
};
