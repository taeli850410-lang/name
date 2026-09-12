# 중개톡 대시보드 프로토타입

공인중개사용 CRM **중개톡**의 화면을 사용자군별로 다시 설계한 Next.js 프로토타입입니다.
UX 검토 보고서에서 지적한 항목(내비게이션·오늘 할 일·위험 행동 분리·실패 사유 문장화·용어 통일 등)을 실제 화면으로 옮겼습니다.

- 기술: Next.js 15 (App Router) · React 19 · TypeScript · 의존성 없는 순수 CSS
- 데이터: 전부 예시(목업)이며 `src/data/*.ts` 안에 있습니다. 기준일은 **2026-09-12(토)** 로 고정되어 있습니다 (`src/lib/format.ts`의 `TODAY`).
- 저장: 화면에서 등록·수정·삭제하면 브라우저 메모리에만 반영됩니다(새로고침하면 초기화).

## 화면 구성

| 경로 | 사용자 | 내용 |
|---|---|---|
| `/` | — | 역할 선택 (고객용 / 중개사용 / 운영자용) |
| `/login` | — | 휴대폰번호 + 비밀번호 두 칸 로그인 |
| `/customer` | 고객 | 홈: 다음 일정 D-day, 등기부 안심 알림, 약속 확인, 시세, 담당 중개사 |
| `/customer/deal` · `/market` · `/settings` | 고객 | 내 계약 일정·준비물, 관심지역 시세 차트, 알림 수신 설정 |
| `/agent` | 중개사 | 대시보드: 오늘 할 일 → 다가오는 일정·알림 → 자주 쓰는 작업 → 내 현황 → 공지, 통합 캘린더 |
| `/agent/customers` · `/properties` · `/deals` · `/appointments` · `/registry` | 중개사 | 핵심 업무 (목록 우선, 슬라이드 패널 등록, 상세 패널, 더보기 메뉴) |
| `/agent/alimtalk/templates` · `/auto` · `/campaigns` · `/send` · `/history` | 중개사 | 알림톡 (미리보기, 자동발송 검증, 5분뒤 발송 기본, 배치 단위 발송 내역·재발송) |
| `/agent/settings` · `/billing` · `/logs` | 중개사 | 나의 정보(탭), 구매내역, 작업 로그(배치 묶음) |
| `/agent/notices` · `/karma` · `/inquiries` · `/links` | 중개사 | 공지, 채널 품앗이, 문의/제안, 유익한 사이트(분류) |
| `/admin` | 운영자 | 처리할 일(승인·만료·문의·장애) → 발송량 차트 → 회원 현황 → 시스템 상태 |
| `/admin/members` · `/inquiries` · `/notices` · `/templates` · `/monitor` · `/settings` | 운영자 | 회원 관리(첫 열 고정, 선택 액션 바), 문의 답변, 공지, 공용 템플릿, 서버·연동 상태, 시스템 설정(비밀값 마스킹) |

## 실행

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # 타입 검사 포함 프로덕션 빌드
npm start
```

Node.js 18.18 이상이 필요합니다.

## Vercel 배포

환경 변수는 필요 없습니다. 글꼴(Pretendard)은 jsDelivr CDN에서 불러옵니다. 세 가지 방법 중 하나를 고릅니다.

**방법 1 · CLI (가장 빠름, 2분)**

```bash
cd joonggaetalk-dashboard
npx vercel login
npx vercel --prod      # 질문에는 모두 기본값(Enter) — 프레임워크 Next.js 자동 감지
```

**방법 2 · GitHub 저장소 가져오기**

1. Vercel 대시보드 → **Add New → Project → Import** 에서 `taeli850410-lang/name` 을 고릅니다.
2. **Root Directory** 를 `joonggaetalk-dashboard` 로 지정하고 Deploy 합니다.
3. 소스가 `main` 이 아닌 브랜치(`claude/modest-bohr-bhbc4b`)에 있으면 **Settings → Git → Production Branch** 를 그 브랜치로 바꾸고 Redeploy 하거나, 브랜치를 `main` 에 합칩니다.

**방법 3 · 부트스트랩 배포 (`deploy/` 폴더)**

소스 전체를 올리지 않고 `deploy/package.json` 과 `deploy/fetch-source.js` 두 파일만 배포하면, 빌드 단계에서 공개 저장소의 브랜치를 내려받아 `next build` 합니다. Vercel MCP나 API처럼 파일을 직접 올리는 도구에 적합하고, 같은 두 파일을 다시 배포하면 그 시점의 최신 커밋이 빌드됩니다. 저장소·브랜치·폴더는 환경 변수 `SOURCE_REPO`, `SOURCE_BRANCH`, `SOURCE_DIR` 로 바꿉니다.

```bash
cd joonggaetalk-dashboard/deploy
npx vercel --prod --name joonggaetalk-dashboard
```

## 설계 메모 (검토 보고서 대응)

- **내비게이션**: 좌측 고정 사이드바 5그룹 + 현재 위치 강조 + 상단 경로. '대시보드로' 버튼과 툴바 이동 버튼 제거. (C-01, C-02, T-01)
- **대시보드**: 첫 줄이 '오늘 할 일' 4타일. 정상 상태는 숨기고 이상만 배너·알림으로. 캘린더 하나. 유익한 사이트는 별도 메뉴. (D-01~D-07)
- **행동의 무게**: 주요 버튼은 화면당 1개, 삭제·강제종료·예약 취소는 더보기 메뉴 + 대상명이 보이는 확인 모달. 성공은 토스트(되돌릴 수 있는 행동은 '실행 취소' 포함). (C-07, C-08, C-22)
- **오류 표현**: 실패 코드 → 사람 문장 매핑(`src/data/sends.ts`의 `FAIL_REASONS`), 기술 원문은 '자세히' 뒤. 대행사 장애는 화면 상단 배너 한 줄. (C-09, C-10, S-01, S-03)
- **지금 발송**: '5분뒤 발송'이 주 버튼, '바로 발송'은 보조 + 강한 확인. 대상 0명이면 비활성. 발송 전 요약(대상·제외·비용·시점). (IS-01, IS-02)
- **폼**: 등록은 슬라이드 패널, 라벨 위, 관련 필드 2열, 조건부 필드(계약방식에 따라 금액 칸이 바뀜), 동의 체크는 기본 해제. (C-15, C-21, CU-01)
- **분류 단일화**: 관심유형은 `INTEREST_TYPES` 하나를 등록·필터가 함께 씀. (CU-02)
- **표**: 기본 열 축소, 상태 배지, 첫 열 고정(회원 관리), 행 클릭 상세, 빈 값 '—', 페이지네이션 한 벌. (P-01, DL-03, AM-02, C-06, C-11)
- **비밀값**: 시스템 설정의 키·토큰은 기본 마스킹 + 보기 토글 + 재발급. 현재 비밀번호는 표시하지 않음. (C-18)
- **접근성**: 모든 입력에 `label`, 클릭 요소는 `button`/`a`, 아이콘은 SVG(`src/components/ui/Icon.tsx`), 보조 텍스트 대비 4.5:1 이상, 포커스 링. (C-04, C-13)
- **디자인 토큰**: `src/app/globals.css` 상단의 CSS 변수(색·간격·반경). 화면별 인라인 색 없음. (C-16)

## 실제 서비스에 연결하려면

- `src/data/*.ts`의 배열을 API 호출로 바꾸면 됩니다. 화면은 타입(`Customer`, `Deal`, `SendBatch` …)만 알고 있습니다.
- `TODAY`를 서버 시각으로 바꾸고, 날짜 계산은 `src/lib/format.ts`의 함수만 쓰고 있습니다.
- 인증은 `/login`에서 역할에 따라 `/agent` 또는 `/admin`으로 보내는 부분만 붙이면 됩니다. 고객용 `/customer`는 알림톡 링크의 토큰으로 여는 것을 전제로 합니다.
- 회원현황 지도(카카오맵)는 이 프로토타입에 포함하지 않았습니다(외부 키 필요).
