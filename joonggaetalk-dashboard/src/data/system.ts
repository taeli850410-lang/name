/** 시스템·연동 상태 — 정상은 숨기고 이상만 화면에 드러낸다. */
export type ServiceStatus = "ok" | "down" | "degraded";

export const systemStatus = {
  server: { status: "ok" as ServiceStatus, checkedAt: "2026-09-12 21:20" },
  balsongking: {
    status: "down" as ServiceStatus,
    since: "2026-09-12 12:35",
    /** 사람이 읽는 원인. 원문(예외)은 detail에만 둔다. */
    reason: "발송 대행사(발송킹) 서버의 보안 인증서가 만료되어 연결할 수 없습니다.",
    impact: "12:35 이후 예약된 알림톡이 보류 중입니다. 복구되면 자동으로 다시 시도합니다.",
    detail: "SSLCertVerificationError: certificate has expired (balsongking.com:443)",
    affected: 3,
    balance: null as number | null,
    balanceCheckedAt: "2026-09-12 11:40",
    lastBalance: 48_250,
  },
  registry: {
    status: "ok" as ServiceStatus,
    running: 12,
    watching: 1347,
    queued: 1026,
    failed: 47,
    doneToday: 0,
    changesToday: 0,
    lastPing: "2026-09-12 21:11",
    schedule: ["10:00", "17:00"],
  },
  naverSync: { status: "ok" as ServiceStatus, every: 5, lastAt: "2026-09-12 21:20" },
  telegram: { status: "ok" as ServiceStatus },
};

export const usage = {
  plan: "무료",
  expiresAt: "2026-09-30",
  daysLeft: 18,
};
