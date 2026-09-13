import { addDays, TODAY } from "@/lib/format";

export type LogEntry = { id: string; at: string; actor: string; action: "등록" | "수정" | "삭제" | "발송" | "설정" | "로그인"; target: string; summary: string; count?: number; details?: string[] };

/** 작업 로그 — 배치 작업은 한 행으로 묶고 펼쳐서 본다. */
export const logs: LogEntry[] = [
  { id: "l1", at: "2026-09-12 20:36", actor: "이서연", action: "등록", target: "고객", summary: "고객 대량등록 (엑셀) · 2명 · 환영 알림톡 2건 예약", count: 2, details: ["정관영 (010-****-3402) 등록", "이데아 (010-****-7712) 등록", "환영 알림톡 2건 1분 뒤 발송 예약"] },
  { id: "l2", at: "2026-09-12 12:35", actor: "이서연", action: "발송", target: "알림톡", summary: "지금 발송 · 전문가 칼럼 알림 · 1명 → 실패 1 (대행사 인증서 문제)" },
  { id: "l3", at: "2026-09-12 09:14", actor: "이서연", action: "수정", target: "계약", summary: "마곡 힐스테이트 301동 2201호 전세 재계약 · 잔금일 09-13으로 변경" },
  { id: "l4", at: "2026-09-11 12:12", actor: "이서연", action: "등록", target: "고객", summary: "정하은 등록 · 환영 알림톡 1건 발송 완료" },
  { id: "l5", at: "2026-09-11 12:12", actor: "이서연", action: "발송", target: "알림톡", summary: "지금 발송 · 관심지역 실거래가 · 1명 → 성공 1" },
  { id: "l6", at: "2026-09-10 16:40", actor: "이서연", action: "수정", target: "약속", summary: "최도윤 상담 · 결과 '완료' 처리" },
  { id: "l7", at: "2026-09-09 11:30", actor: "이서연", action: "수정", target: "약속", summary: "윤채원 임장 · 결과 '노쇼' 처리" },
  { id: "l8", at: "2026-09-08 10:02", actor: "이서연", action: "설정", target: "자동발송", summary: "잔금일 알림 시점 1일 전 → 3일 전" },
  { id: "l9", at: "2026-09-07 20:35", actor: "이서연", action: "등록", target: "고객", summary: "고객 대량등록 (엑셀) · 75명 · 환영 알림톡 75건 예약", count: 75, details: ["변영균 외 74명 등록", "중복 번호 3건 건너뜀", "환영 알림톡 75건 1분 뒤 발송 예약"] },
  { id: "l10", at: "2026-09-07 11:05", actor: "이서연", action: "발송", target: "알림톡", summary: "지금 발송 · 부동산TALK 회원 알림 · 163명 → 성공 161 · 실패 2" },
  { id: "l11", at: "2026-09-07 09:39", actor: "이서연", action: "발송", target: "알림톡", summary: "지금 발송 · 전문가 칼럼 알림 · 29명 → 실패 29 (결과확인 시간초과)" },
  { id: "l12", at: "2026-09-07 09:00", actor: "시스템", action: "발송", target: "알림톡", summary: "정기 발송 · 매주시세 · 24명 → 성공 23 · 거부 1" },
  { id: "l13", at: "2026-09-02 09:00", actor: "시스템", action: "발송", target: "알림톡", summary: "자동발송 · 잔금일 3일 전 · 정하은 → 성공" },
  { id: "l14", at: "2026-09-01 14:20", actor: "이서연", action: "등록", target: "계약", summary: "마곡 힐스테이트 301동 2201호 전세 재계약 등록" },
  { id: "l15", at: "2026-08-29 17:05", actor: "이서연", action: "등록", target: "계약", summary: "청라 한양수자인 205동 1502호 매매 등록" },
  { id: "l16", at: "2026-08-28 10:08", actor: "시스템", action: "발송", target: "알림톡", summary: "등기부 변동 알리미 · 남유진 → 성공" },
  { id: "l17", at: "2026-08-22 09:30", actor: "이서연", action: "로그인", target: "계정", summary: "새 기기에서 로그인 (Windows · Chrome)" },
];

export const billing = {
  plan: "무료",
  expiresAt: "2026-09-30",
  daysLeft: 18,
  history: [
    { date: "2026-07-07", kind: "운영자 보정", desc: "체험 기간 오류 정정", delta: -13, before: "2026-10-13", after: "2026-09-30" },
    { date: "2026-06-07", kind: "운영자 무료", desc: "교육 수강 회원 무료 연장", delta: 120, before: "2026-06-14", after: "2026-10-13" },
    { date: "2026-06-07", kind: "가입 무료", desc: "가입 승인 시 7일 무료", delta: 7, before: "-", after: "2026-06-14" },
  ],
  priceUrl: "https://smartstore.naver.com/",
};

export const termsHistory = [{ version: "v1", title: "부동산TALK 이용약관", agreedAt: "2026-07-23 16:25" }];

export const profile = {
  name: "이서연",
  phone: "01000001848",
  office: "서연공인중개사사무소",
  email: "seoyeon@example.com",
  address: "인천 부평구 십정동 630 더샵부평센트럴시티 상가 102호",
  roadAddress: "인천 부평구 열우물로 90",
  directionsUrl: "https://naver.me/example",
  homepageUrl: "https://m.land.naver.com/r/example",
  naverUrl: "https://m.land.naver.com/r/example",
  officePhone: "",
  balsongkingId: "seoyeon_bk",
  kakaoChannelId: "@서연부동산",
  kakaoChannelUrl: "http://pf.kakao.com/_example",
  telegram: { connected: true, account: "@seoyeon_jt", lastAlert: "2026-09-12 12:36" },
  /**
   * 알림톡 대체발송(문자) — 계정 단위 설정.
   * dailyCap 은 안전장치다. 문자는 알림톡의 3~8배라 대량 발송에서
   * 상한이 없으면 비용이 하루 만에 예치금을 비운다.
   */
  smsFallback: { enabled: true, dailyCap: 300, usedToday: 0 },
  googleCalendar: { connected: false },
};

export const upcomingDates = addDays(TODAY, 0);
