export type Notification = { id: string; tone: "danger" | "warn" | "info" | "good"; title: string; when: string; href: string; read: boolean };

/** 상단 종 아이콘의 알림. 정상 상태는 알림이 아니다. */
export const notifications: Notification[] = [
  { id: "n1", tone: "danger", title: "알림톡 발송 대행사 장애 — 보류 3건", when: "오늘 12:35", href: "/agent/alimtalk/history?status=failed", read: false },
  { id: "n2", tone: "warn", title: "채널 품앗이 · 응대 필요 1건", when: "어제", href: "/agent/karma", read: false },
  { id: "n3", tone: "info", title: "공지 · 채널품앗이가 선팔·맞팔 방식으로 바뀌었습니다", when: "09-08", href: "/agent/notices", read: true },
  { id: "n4", tone: "good", title: "문의 답변이 도착했습니다 — 등기부 감시 설치 문의", when: "09-06", href: "/agent/inquiries", read: true },
];
