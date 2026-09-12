export type TemplateStatus = "승인" | "검수중" | "반려";
export type Template = {
  id: string;
  name: string;
  body: string;
  buttons: string[];
  status: TemplateStatus;
  rejectReason?: string;
  shared: boolean;
  createdAt: string;
  usedBy?: string;
};

export const VARIABLES = ["고객명", "물건명", "계약일", "중도금일", "잔금일", "입주일", "계약만료일", "물건실거래가URL", "관심지역실거래가URL", "물건주소", "약속일시", "약속장소", "약속유형", "사무실 전화", "중개사상호"];

export const templates: Template[] = [
  { id: "t1", name: "[중개톡] 신규", body: "#{고객명}님, 안녕하세요.\n#{중개사상호}입니다. 고객으로 등록해 주셔서 감사합니다.\n계약 일정과 물건 정보를 알림톡으로 안내해 드립니다.", buttons: ["오시는길", "네이버부동산"], status: "승인", shared: true, createdAt: "2026-06-24", usedBy: "고객등록" },
  { id: "t2", name: "[중개톡] 계약일정", body: "#{고객명}님, #{물건명} 계약일이 #{계약일}입니다.\n신분증과 도장을 준비해 주세요.\n문의: #{사무실 전화}", buttons: ["오시는길"], status: "승인", shared: true, createdAt: "2026-06-24", usedBy: "계약일 1일 전" },
  { id: "t3", name: "[중개톡] 중도금 도래", body: "#{고객명}님, #{물건명} 중도금일이 #{중도금일}입니다.\n입금 계좌를 다시 한번 확인해 주세요.", buttons: [], status: "승인", shared: true, createdAt: "2026-06-24", usedBy: "중도금일 1일 전" },
  { id: "t4", name: "잔금일", body: "#{고객명}님, #{물건명} 잔금일 #{잔금일} 안내드립니다.\n당일 확정일자·전입신고를 함께 진행합니다.", buttons: ["오시는길"], status: "승인", shared: false, createdAt: "2026-07-11", usedBy: "잔금일 3일 전" },
  { id: "t5", name: "[중개톡] 입주 후 알림", body: "#{고객명}님, 입주 한 달이 지났습니다. 불편한 점은 없으신가요?\n#{중개사상호}가 계속 도와드리겠습니다.", buttons: ["홈페이지"], status: "승인", shared: true, createdAt: "2026-06-25", usedBy: "입주일 30일 후" },
  { id: "t6", name: "[중개톡] 계약 만료일", body: "#{고객명}님, #{물건명} 계약 만료일이 #{계약만료일}입니다.\n재계약 또는 이사 계획을 미리 상의해 주세요.", buttons: ["오시는길"], status: "승인", shared: true, createdAt: "2026-06-24", usedBy: "임대차 만료일 90일 전" },
  { id: "t7", name: "등기부 변동 알리미", body: "[중개톡 무료 안심 서비스]\n#{고객명}님, #{물건주소} 등기부에 변동이 확인되었습니다. 자세한 내용은 #{중개사상호}로 문의해 주세요.", buttons: ["전화하기"], status: "승인", shared: true, createdAt: "2026-07-11", usedBy: "등기부 변동 당일" },
  { id: "t8", name: "정보수신알림서비스", body: "안녕하세요, #{고객명}님. 의뢰해 주신 부동산 건에 대해 실거래가·시세 정보를 정기적으로 보내드립니다.", buttons: ["관심지역 실거래가"], status: "승인", shared: false, createdAt: "2026-07-23", usedBy: "정보수신동의서" },
  { id: "t9", name: "관심지역 실거래가", body: "#{고객명}님, 요청하신 관심지역 실거래가 정보입니다.\n이번 주 거래 동향을 확인해 보세요.", buttons: ["관심지역 실거래가"], status: "승인", shared: false, createdAt: "2026-07-03", usedBy: "정기 발송 · 매주시세" },
  { id: "t10", name: "전문가 칼럼 알림", body: "#{고객명}님, 안녕하세요. 이번 주 부동산 전문가 칼럼이 업데이트되었습니다.", buttons: ["홈페이지"], status: "승인", shared: false, createdAt: "2026-09-07" },
  { id: "t11", name: "[방문예약 안내]", body: "#{고객명}님, #{약속일시} #{약속유형} 예약이 접수되었습니다.\n장소: #{약속장소}", buttons: ["오시는길"], status: "검수중", shared: false, createdAt: "2026-09-11" },
  { id: "t12", name: "희망 매물 조건 접수 안내", body: "#{고객명}님, 희망 매물 조건이 접수되었습니다. 지금 가입하시면 특별 혜택을 드립니다!", buttons: ["홈페이지"], status: "반려", rejectReason: "광고성 문구('특별 혜택')가 포함되어 정보성 알림톡으로 승인할 수 없습니다. 문구를 삭제하고 다시 검수 요청하세요.", shared: false, createdAt: "2026-09-02" },
];

export type AutoRule = {
  id: string;
  trigger: string;
  hint: string;
  templateId?: string;
  timing: string;
  timingOptions: string[];
  enabled: boolean;
};

export const autoRules: AutoRule[] = [
  { id: "r1", trigger: "고객 등록", hint: "새 고객이 저장되면", templateId: "t1", timing: "당일 (1분 뒤)", timingOptions: ["당일 (1분 뒤)", "다음 날 09:00"], enabled: true },
  { id: "r2", trigger: "계약일", hint: "계약 등록의 계약일 기준", templateId: "t2", timing: "1일 전", timingOptions: ["당일", "1일 전", "3일 전"], enabled: true },
  { id: "r3", trigger: "중도금일", hint: "", templateId: "t3", timing: "1일 전", timingOptions: ["당일", "1일 전", "3일 전"], enabled: true },
  { id: "r4", trigger: "잔금일", hint: "", templateId: "t4", timing: "3일 전", timingOptions: ["당일", "1일 전", "3일 전", "7일 전"], enabled: true },
  { id: "r5", trigger: "입주일", hint: "", templateId: "t5", timing: "30일 후", timingOptions: ["당일", "7일 후", "30일 후"], enabled: true },
  { id: "r6", trigger: "임대차 만료일", hint: "재계약 상담 유도", templateId: "t6", timing: "90일 전", timingOptions: ["30일 전", "60일 전", "90일 전"], enabled: true },
  { id: "r7", trigger: "등기부 변동 안내", hint: "감시 중인 물건에 변동이 생기면", templateId: "t7", timing: "당일", timingOptions: ["당일"], enabled: true },
  { id: "r8", trigger: "정보수신동의서", hint: "버튼 클릭 시 발송", templateId: "t8", timing: "버튼 클릭 시", timingOptions: ["버튼 클릭 시"], enabled: true },
  { id: "r9", trigger: "약속 알림", hint: "약속 등록 기준", templateId: undefined, timing: "당일", timingOptions: ["당일", "1일 전"], enabled: false },
];

export type Campaign = {
  id: string;
  name: string;
  templateId: string;
  schedule: string;
  targets: number;
  optOut: number;
  nextRun: string;
  enabled: boolean;
  lastRun?: string;
};

export const campaigns: Campaign[] = [
  { id: "cp1", name: "매주시세", templateId: "t9", schedule: "매주 월요일 09:00", targets: 24, optOut: 1, nextRun: "2026-09-14 09:00", enabled: true, lastRun: "2026-09-07 09:00" },
  { id: "cp2", name: "월간 부동산 리포트", templateId: "t10", schedule: "매월 1일 10:00", targets: 188, optOut: 6, nextRun: "2026-10-01 10:00", enabled: false, lastRun: "2026-09-01 10:00" },
];

export function templateById(id?: string) {
  return templates.find((t) => t.id === id);
}
