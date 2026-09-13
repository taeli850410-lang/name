import { addDays, pick, seeded, TODAY } from "@/lib/format";

export type Plan = "유료" | "무료" | "만료" | "미승인" | "운영자";
export type Member = {
  id: string;
  name: string;
  office: string;
  phone: string;
  plan: Plan;
  grade?: "1차" | "2차" | "VIP";
  memo: string;
  expiresAt?: string;
  lastPurchase?: string;
  joinedAt: string;
  region: string;
  integrations: { balsongking: boolean; calendar: boolean; telegram: boolean };
  channelUrl?: string;
  customers: number;
  sends30d: number;
};

const SUR = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임", "한", "오", "서", "신", "권", "황", "안", "송", "류", "전"];
const GIV = ["선미", "서영", "미숙", "경아", "순희", "현아", "순영", "선심", "유림", "갑숙", "인순", "지효", "희병", "애라", "인선", "은정", "일숙", "다연", "철원", "형빈", "민재", "수정", "재현", "경희", "태호", "성호", "연주", "미경", "정훈", "은지"];
const TOWNS = ["힐스테이트", "디딤돌", "죽전역", "꿈에그린", "은혜", "타워누리", "계양역", "센트럴", "리드포레", "신화", "염창동 미소", "단지내", "경남", "수성", "센텀스타", "명동", "웰스트림", "황금힐", "우리세무", "삼성", "한라", "한울", "새터", "굿모닝", "향기", "래미안", "태영", "동문", "만남", "비전"];
const REGIONS = ["서울", "인천", "경기 북부", "경기 남부", "부산", "대구", "광주", "대전", "제주", "충남", "전남", "강원"];

function make(count: number): Member[] {
  const rnd = seeded(173);
  const out: Member[] = [];
  for (let i = 0; i < count; i++) {
    const r = rnd();
    const plan: Plan = i < 2 ? "운영자" : i < 5 ? "미승인" : r < 0.24 ? "유료" : r < 0.94 ? "무료" : "만료";
    const joinedAt = addDays(TODAY, -Math.floor(rnd() * 400));
    const expiresAt = plan === "만료" ? addDays(TODAY, -Math.floor(rnd() * 20) - 1) : plan === "유료" ? addDays(TODAY, 30 + Math.floor(rnd() * 350)) : plan === "무료" ? addDays(TODAY, Math.floor(rnd() * 60)) : undefined;
    const last4 = String(1000 + Math.floor(rnd() * 9000));
    out.push({
      id: `m${String(i + 1).padStart(3, "0")}`,
      name: `${pick(rnd, SUR)}${pick(rnd, GIV)}`,
      office: `${pick(rnd, TOWNS)}공인중개사사무소`,
      phone: `0100${100 + Math.floor(rnd() * 900)}${last4}`,
      plan,
      grade: rnd() < 0.3 ? pick(rnd, ["1차", "2차", "VIP"] as const) : undefined,
      memo: rnd() < 0.15 ? pick(rnd, ["2차/정기수강", "2차/박현배", "비밀노트", "정기 결제 예정"]) : "",
      expiresAt,
      lastPurchase: plan === "유료" ? addDays(TODAY, -Math.floor(rnd() * 200)) : undefined,
      joinedAt,
      region: pick(rnd, REGIONS),
      integrations: { balsongking: rnd() < 0.7, calendar: rnd() < 0.4, telegram: rnd() < 0.6 },
      channelUrl: rnd() < 0.6 ? `https://pf.kakao.com/_${Math.floor(rnd() * 1e6).toString(36)}` : undefined,
      customers: Math.floor(rnd() * 400),
      sends30d: Math.floor(rnd() * 300),
    });
  }
  out[0] = { ...out[0], name: "이서연", office: "서연공인중개사사무소", plan: "운영자", region: "인천", customers: 188, sends30d: 593, integrations: { balsongking: true, calendar: false, telegram: true } };
  out[1] = { ...out[1], name: "박준서", office: "부동산TALK 운영팀", plan: "운영자", region: "서울" };
  // 승인 대기 3명: 최근 가입
  [2, 3, 4].forEach((i, k) => {
    out[i] = { ...out[i], plan: "미승인", joinedAt: addDays(TODAY, -k), customers: 0, sends30d: 0, expiresAt: undefined };
  });
  return out;
}

export const members: Member[] = make(173);

export const memberCounts = {
  total: members.length,
  paid: members.filter((m) => m.plan === "유료").length,
  free: members.filter((m) => m.plan === "무료").length,
  expired: members.filter((m) => m.plan === "만료").length,
  pending: members.filter((m) => m.plan === "미승인").length,
  admin: members.filter((m) => m.plan === "운영자").length,
};

/** 30일 이내 만료 예정 회원 */
export const expiringSoon = members
  .filter((m) => (m.plan === "유료" || m.plan === "무료") && m.expiresAt && m.expiresAt >= TODAY && m.expiresAt <= addDays(TODAY, 30))
  .sort((a, b) => (a.expiresAt! < b.expiresAt! ? -1 : 1));

export const pendingMembers = members.filter((m) => m.plan === "미승인");

export type AdminInquiry = { id: string; member: string; office: string; kind: "문의" | "제안" | "오류"; title: string; body: string; status: "답변대기" | "답변완료"; createdAt: string; answer?: string };

export const adminInquiries: AdminInquiry[] = [
  { id: "aq1", member: "이서연", office: "서연공인중개사사무소", kind: "제안", title: "발송 내역에서 실패 건만 다시 보내고 싶습니다", body: "실패한 건을 하나씩 다시 보내기 번거롭습니다.", status: "답변대기", createdAt: "2026-09-11" },
  { id: "aq2", member: "김선미", office: "힐스테이트공인중개사사무소", kind: "오류", title: "오늘 알림톡이 전부 실패로 나옵니다", body: "12시 이후 보낸 게 다 실패입니다. 예치금은 충분합니다.", status: "답변대기", createdAt: "2026-09-12" },
  { id: "aq3", member: "박미숙", office: "죽전역공인중개사사무소", kind: "문의", title: "등기부 감시 프로그램이 설치되지 않아요", body: "설치파일을 실행하면 아무 반응이 없습니다.", status: "답변완료", createdAt: "2026-09-05", answer: "Windows 보안 경고에서 '추가 정보 → 실행'을 눌러 주세요." },
  { id: "aq4", member: "신경아", office: "꿈에그린공인중개사사무소", kind: "문의", title: "구글 캘린더 연동이 풀렸습니다", body: "어제부터 일정이 안 들어갑니다.", status: "답변완료", createdAt: "2026-09-03", answer: "나의 정보 > 연동에서 다시 연결해 주세요. 구글 토큰이 만료되면 재연결이 필요합니다." },
  { id: "aq5", member: "황순희", office: "은혜공인중개사사무소", kind: "문의", title: "이용기한 연장은 어디서 하나요", body: "", status: "답변완료", createdAt: "2026-08-30", answer: "구매내역 화면 상단 '연장하기'로 결제 페이지에 갈 수 있습니다." },
  { id: "aq6", member: "이순영", office: "계양역부동산공인중개사사무소", kind: "제안", title: "고객 목록에서 키워드로 필터하고 싶어요", body: "", status: "답변완료", createdAt: "2026-08-21", answer: "9월 업데이트에 반영했습니다. 고객 목록 상단 필터 칩을 확인해 주세요." },
];

/** 최근 30일 일별 발송 건수 (전체 시스템) */
export const dailySends: { date: string; count: number }[] = (() => {
  const rnd = seeded(12992);
  const out: { date: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const date = addDays(TODAY, -i);
    const dow = new Date(date).getDay();
    const base = dow === 0 || dow === 6 ? 180 : 460;
    let count = Math.round(base + rnd() * 260);
    if (date === "2026-09-07") count = 1240; // 대량 발송일
    if (date === TODAY) count = 96; // 장애로 오후 발송 중단
    out.push({ date, count });
  }
  return out;
})();

export const dailySignups: { date: string; count: number }[] = (() => {
  const rnd = seeded(24);
  const out: { date: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) out.push({ date: addDays(TODAY, -i), count: Math.floor(rnd() * 3) });
  out[out.length - 1].count = 0;
  return out;
})();

export const publicTemplates = [
  { id: "pt1", name: "[부동산TALK] 신규", users: 141, updatedAt: "2026-06-24" },
  { id: "pt2", name: "[부동산TALK] 계약일정", users: 138, updatedAt: "2026-06-24" },
  { id: "pt3", name: "[부동산TALK] 중도금 도래", users: 120, updatedAt: "2026-06-24" },
  { id: "pt4", name: "[부동산TALK] 입주 후 알림", users: 97, updatedAt: "2026-06-25" },
  { id: "pt5", name: "[부동산TALK] 계약 만료 3개월전", users: 133, updatedAt: "2026-06-25" },
  { id: "pt6", name: "[부동산TALK] 계약 만료일", users: 130, updatedAt: "2026-06-24" },
  { id: "pt7", name: "등기부 변동 알리미", users: 88, updatedAt: "2026-07-11" },
];
