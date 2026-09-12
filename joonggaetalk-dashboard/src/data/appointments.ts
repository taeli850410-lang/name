export type AppointmentType = "상담" | "방문" | "임장" | "기타";
export type AppointmentStatus = "예정" | "완료" | "노쇼" | "취소";
export type Appointment = {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  customerId?: string;
  customerName: string;
  type: AppointmentType;
  propertyName?: string;
  place: string;
  memo: string;
  status: AppointmentStatus;
  resultMemo?: string;
};

export const appointments: Appointment[] = [
  { id: "a1", date: "2026-09-12", time: "10:00", customerId: "c002", customerName: "김민수", type: "상담", propertyName: "청라 한양수자인 205동 1502호", place: "사무실", memo: "중도금 대출 서류 안내", status: "예정" },
  { id: "a2", date: "2026-09-12", time: "15:00", customerId: "c001", customerName: "박지훈", type: "임장", propertyName: "더샵부평 110동 103호", place: "현장 (십정동)", memo: "잔금 전 하자 점검 동행", status: "예정" },
  { id: "a3", date: "2026-09-13", time: "11:00", customerId: "c004", customerName: "정하은", type: "방문", place: "사무실", memo: "확정일자·전입 서류 전달", status: "예정" },
  { id: "a4", date: "2026-09-14", time: "10:00", customerId: "c001", customerName: "박지훈", type: "임장", propertyName: "더샵부평 110동 103호", place: "현장 (십정동)", memo: "가전 실측", status: "예정" },
  { id: "a5", date: "2026-09-16", time: "14:00", customerName: "남유진", type: "상담", propertyName: "마곡 힐스테이트 301동 2201호", place: "사무실", memo: "재계약서 서명", status: "예정" },
  { id: "a6", date: "2026-09-10", time: "16:00", customerId: "c005", customerName: "최도윤", type: "상담", place: "사무실", memo: "산곡동 토지 검토", status: "완료", resultMemo: "지목 변경 여부 확인 후 재상담" },
  { id: "a7", date: "2026-09-09", time: "11:00", customerName: "윤채원", type: "임장", propertyName: "부평 금호어울림 102동 801호", place: "현장", memo: "", status: "노쇼", resultMemo: "연락 두절" },
  { id: "a8", date: "2026-09-05", time: "10:30", customerId: "c004", customerName: "정하은", type: "방문", place: "사무실", memo: "잔금 정산", status: "완료", resultMemo: "잔금 완료, 입주 안내" },
];
