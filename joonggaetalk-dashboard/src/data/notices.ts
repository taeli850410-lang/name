export type Notice = { id: string; title: string; body: string; author: string; createdAt: string; important?: boolean; unread?: boolean; visible: boolean };

export const notices: Notice[] = [
  {
    id: "no1",
    title: "[알림] 발송 대행사 장애로 알림톡 발송이 보류되고 있습니다",
    body: "안녕하세요, 부동산TALK입니다.\n9월 12일 12:35부터 알림톡 발송 대행사(발송킹) 서버의 보안 인증서 만료로 발송이 실패하고 있습니다.\n보류된 발송은 복구 즉시 자동으로 다시 시도되며, 별도로 하실 일은 없습니다.\n복구되면 이 공지를 갱신하겠습니다.",
    author: "부동산TALK 운영팀",
    createdAt: "2026-09-12",
    important: true,
    unread: true,
    visible: true,
  },
  {
    id: "no2",
    title: "채널 품앗이가 선팔·맞팔 방식으로 바뀌었습니다",
    body: "다른 회원의 카카오채널을 먼저 추가하면(선팔) 상대의 '받은 선팔' 목록에 뜨고, 상대도 내 채널을 추가해야(맞팔) 서로친구가 완성됩니다.\n받은 선팔을 오래 방치하면 미응대 랭킹에 오르니 되도록 빨리 응대해 주세요.",
    author: "부동산TALK 운영팀",
    createdAt: "2026-09-08",
    unread: true,
    visible: true,
  },
  { id: "no3", title: "[안내] 자동발송 알림톡 — 템플릿 교체 시 발송 실패 문제 수정", body: "자동발송 설정에서 템플릿을 다른 것으로 바꾼 경우, 이미 예약된 발송이 옛 템플릿을 참조해 실패하던 문제를 수정했습니다.", author: "부동산TALK 운영팀", createdAt: "2026-09-05", visible: true },
  { id: "no4", title: "고객 대량등록 기능 개선 안내", body: "엑셀 대량등록 시 전화번호 형식이 달라도(하이픈 유무) 자동으로 정리되며, 중복 번호는 건너뛰고 결과를 표로 보여 줍니다.", author: "부동산TALK 운영팀", createdAt: "2026-08-26", visible: true },
  { id: "no5", title: "10만 공인중개사의 고객관리, 부동산TALK", body: "부동산TALK은 공인중개사를 위한 고객·물건·계약 관리와 알림톡 자동발송 서비스입니다.", author: "부동산TALK 운영팀", createdAt: "2026-06-27", visible: true },
];

export type LinkItem = { title: string; url: string; desc: string; group: "공공·행정" | "커뮤니티·교육" | "업무 도구" | "부동산TALK" };

export const usefulLinks: LinkItem[] = [
  { title: "인터넷등기소", url: "https://www.iros.go.kr/", desc: "등기부등본 열람·발급", group: "공공·행정" },
  { title: "정부24", url: "https://plus.gov.kr/", desc: "민원 서류 발급", group: "공공·행정" },
  { title: "실거래가 조회", url: "https://rt.molit.go.kr/", desc: "국토교통부 실거래가", group: "공공·행정" },
  { title: "부동산거래관리시스템", url: "https://rtms.molit.go.kr/", desc: "거래 신고", group: "공공·행정" },
  { title: "일사편리", url: "https://www.kras.go.kr/", desc: "부동산종합증명서", group: "공공·행정" },
  { title: "토지이음", url: "https://www.eum.go.kr/", desc: "토지이용계획 확인", group: "공공·행정" },
  { title: "세움터", url: "https://www.eais.go.kr/", desc: "건축물대장·평면도", group: "공공·행정" },
  { title: "부동산공시가격 알리미", url: "https://www.realtyprice.kr/", desc: "공시가격 조회", group: "공공·행정" },
  { title: "주민등록증 진위확인", url: "https://www.gov.kr/", desc: "신분증 확인", group: "공공·행정" },
  { title: "국토부 보도자료", url: "https://www.molit.go.kr/", desc: "정책 동향", group: "공공·행정" },
  { title: "나는중개사", url: "https://cafe.naver.com/budongsanpan", desc: "10만 공인중개사 카페", group: "커뮤니티·교육" },
  { title: "공인중개사 실전성장클럽", url: "https://cafe.naver.com/chobojungaesa", desc: "교육·실무·커뮤니티", group: "커뮤니티·교육" },
  { title: "중개실무교육 라이브클래스", url: "https://fly-budongsan.liveklass.com/", desc: "실무 무료교육 영상", group: "커뮤니티·교육" },
  { title: "법률자문", url: "https://cafe.naver.com/budongsanpan", desc: "중개사고 법률 상담", group: "커뮤니티·교육" },
  { title: "네이버부동산", url: "https://new.land.naver.com/", desc: "매물·시세", group: "업무 도구" },
  { title: "밸류맵", url: "https://www.valueupmap.com/", desc: "토지·건물 실거래", group: "업무 도구" },
  { title: "모아톡", url: "https://moatalk.kr/", desc: "카톡 자동 발송", group: "업무 도구" },
  { title: "오토문자", url: "https://automunja.qshop.ai/", desc: "자동 문자메시지", group: "업무 도구" },
  { title: "부동산TALK 홈페이지", url: "https://www.joonggaetalk.com/", desc: "서비스 안내", group: "부동산TALK" },
  { title: "부동산TALK 카톡채널", url: "https://pf.kakao.com/", desc: "카톡 채널로 문의", group: "부동산TALK" },
  { title: "부동산TALK 결제", url: "https://smartstore.naver.com/", desc: "이용권 결제", group: "부동산TALK" },
];

export type Inquiry = { id: string; kind: "문의" | "제안" | "오류"; title: string; body: string; status: "답변대기" | "답변완료"; createdAt: string; updatedAt: string; answer?: string; member?: string };

export const myInquiries: Inquiry[] = [
  { id: "q1", kind: "문의", title: "등기부 감시 프로그램이 설치되지 않아요", body: "설치파일을 실행하면 아무 반응이 없습니다.", status: "답변완료", createdAt: "2026-09-05", updatedAt: "2026-09-06", answer: "Windows 보안 경고에서 '추가 정보 → 실행'을 눌러 주세요. 그래도 안 되면 원격 지원을 요청해 주세요." },
  { id: "q2", kind: "제안", title: "발송 내역에서 실패 건만 다시 보내고 싶습니다", body: "실패한 건을 하나씩 다시 보내기 번거롭습니다.", status: "답변대기", createdAt: "2026-09-11", updatedAt: "2026-09-11" },
];

export const karma = {
  sent: 91,
  mutual: 30,
  needResponse: 1,
  myRank: 19,
  received: [{ office: "새터공인중개사사무소", rep: "우문경", region: "대전 서구 관저동", when: "2026-09-11" }],
  candidates: [
    { office: "염창동 미소공인중개사", rep: "장인순", region: "서울 강서구 염창동" },
    { office: "웰사랑부동산공인중개사무소", rep: "송미애", region: "인천 연수구 송도동" },
    { office: "웰스트림부동산", rep: "김일숙", region: "서울 마포구 현석동" },
    { office: "한라공인중개사사무소", rep: "이미숙", region: "경기 화성시 남양읍" },
    { office: "한울공인중개사사무소", rep: "최현수", region: "경기 시흥시 배곧동" },
  ],
  ranking: [
    { office: "굿모닝공인중개사", sent: 99, mutual: 34 },
    { office: "향기부동산공인중개사사무소", sent: 99, mutual: 33 },
    { office: "래미안공인중개사사무소", sent: 99, mutual: 33 },
    { office: "꿈에그린좋은집부동산", sent: 98, mutual: 25 },
    { office: "태영부동산 공인중개사사무소", sent: 98, mutual: 27 },
  ],
};
