# LAND LANGUAGE 브리핑 — 중개사용 STUDIO + 고객용 LETTER

안양 공인중개사무소를 위한 부동산 정책·시장 브리핑 서비스입니다. 정부 보도자료·언론 기사·안양시 고시를 모아
5축(발표 주체 · 정책 단계 · 주제 · 영향 대상 · 지역)으로 태깅하고, 중개사는 **스튜디오**에서 검수·선택하며,
고객은 세그먼트별로 3~8개 이슈만 쉬운 말로 담은 **읽기 전용 레터**를 받습니다.

기획 배경과 규칙(R1~R8)은 [`docs/plan-customer-broker-split.md`](docs/plan-customer-broker-split.md) 를 참고하세요.

## 화면

| 경로 | 대상 | 내용 |
|---|---|---|
| `/studio` | 중개사 | 인박스 — 수집된 이슈, 5축 태그, 추천 등급(★ 발송 권장 · ◎ 참고 · ○ 보관), 검수·보관, 지금 수집 |
| `/studio/issues/[id]` | 중개사 | 이슈 상세 — 태그·영향도 편집, 고객용 문장, 중개사용 팩트·스크립트·체크리스트·FAQ, 고객 카드 미리보기, 자동 초안 |
| `/studio/letters` | 중개사 | 레터 빌더 — 주기(DAILY 3 · WEEKLY 5 · MONTHLY 8) × 세그먼트(내집마련 · 보유·갈아타기 · 자산·임대) × 동네 타깃, 발행 전 검증, 발행 |
| `/studio/brief` | 중개사 | 중개사용 브리핑(그린) — 원본 EDM 구조에 팩트·상담 포인트·실무 체크·지역 영향, DAILY/WEEKLY/MONTHLY, PDF 인쇄 |
| `/studio/instagram` | 중개사 | 인스타 카드뉴스 — 주제 선택 → 1~8장 · 테마 4종 · 템플릿 3종 → 1080×1350 PNG 개별/ZIP 저장, 구성 저장 |
| `/studio/blog` | 중개사 | 블로그 포스팅 — SEO 골격 초안(메타·목차·소제목 8개·이미지 위치·직접 경험 슬롯·표·차트·FAQ) 생성 → 편집·저장·마크다운/HTML 복사 |
| `/studio/data` | 중개사 | 우리 동네 숫자(안양 만안·동안 실거래 집계, 기준금리)와 공공데이터 바로가기 |
| `/studio/settings` | 중개사 | 사무소 정보(상호·대표·등록번호·연락처·수신거부), 슬로건, 한마디 기본 문구 |
| `/l/[id]` | 고객 | 발행된 레터(읽기 전용, 로그인 없음). `/l/demo` 는 샘플 |
| `/anyang-dashboard/` | 참고 | 기존 안양 실거래 대시보드 |

## Vercel 배포

1. 이 저장소를 GitHub 에 두고 Vercel 에서 **Import** 합니다. 프레임워크는 Next.js 로 자동 인식됩니다.
2. 환경변수를 넣습니다 (`.env.example` 참고).

   | 변수 | 필수 | 설명 |
   |---|---|---|
   | `STUDIO_PASSWORD` | 권장 | 스튜디오(`/studio`, `/api/studio/*`) 접근 비밀번호. 비우면 누구나 접근 가능 |
   | `KV_REST_API_URL`, `KV_REST_API_TOKEN` | 권장 | Upstash Redis. Vercel Marketplace → Upstash 연동 시 자동 주입. 없으면 배포 환경에서는 메모리 저장(재시작 시 초기화) |
   | `CRON_SECRET` | 권장 | Vercel Cron 이 `Authorization: Bearer` 로 보내는 값. 설정 시 크론 엔드포인트가 보호됩니다 |
   | `ANTHROPIC_API_KEY` | 선택 | 수집된 이슈의 고객용·중개사용 초안을 Claude 가 작성(기본 모델 `claude-opus-5`, `ANTHROPIC_MODEL` 로 변경). 검수 후 발행 |
   | `DATA_GO_KR_KEY` | 선택 | 공공데이터포털 실거래가 API 키. 안양 실거래 집계 자동 갱신 |
   | `ECOS_API_KEY` | 선택 | 한국은행 ECOS API 키. 기준금리 자동 갱신 |
   | `NEXT_PUBLIC_SITE_URL` | 선택 | 발행 URL 생성에 쓸 사이트 주소(예: `https://brief.example.com`) |

3. **Deploy**. 배포 직후 샘플 이슈 10건과 샘플 레터(`/l/demo`)가 들어 있습니다.
4. 크론은 `vercel.json` 에 정의되어 있습니다.
   - `/api/cron/collect` 매일 07:00 KST (22:00 UTC) — 보도자료·기사 수집 + 자동 초안(키가 있을 때)
   - `/api/cron/market` 매일 06:00 KST (21:00 UTC) — 실거래·기준금리 갱신(키가 있을 때)
   - Hobby 플랜은 하루 1회 실행이 한도입니다. Pro 플랜이면 `schedule` 을 `0 */3 * * *` 처럼 줄일 수 있습니다. 스튜디오의 **지금 수집** 버튼으로 언제든 수동 실행할 수 있습니다.

## 로컬 실행

```bash
npm install
cp .env.example .env.local   # 필요한 값만 채우세요
npm run dev                  # http://localhost:3000
```

로컬에서는 `.data/` 폴더에 파일로 저장됩니다(`.gitignore` 됨).

## 데이터 흐름

```
① 수집  korea.kr 보도자료 RSS + Google News 주제별 RSS(정책·금리·세금·임대차·청약·정비·안양·중개업)
② 태깅  규칙 분류기(lib/classify.ts) → 발표 주체·단계·주제·지역·영향도 초안, 제목 유사도로 관련 기사 묶음
        (ANTHROPIC_API_KEY 가 있으면 lib/enrich.ts 가 고객용·중개사용 초안까지 작성)
③ 검수  스튜디오 인박스·이슈 상세에서 태그와 문장을 고치고 '검수 완료'
④ 발행  레터 빌더가 R1~R8(lib/routing.ts, lib/letter.ts)로 이슈를 선정 → 검증 → 읽기 전용 스냅샷 /l/[id]
```

### 라우팅 규칙 요약

- **R1** 확정·시행 예정·통계·지자체 고시만 고객 본문. 입법예고·국회 심의·정부 검토·언론 보도·전망은 '지켜볼 이슈' 한 줄.
- **R2** 중개업 제도(중개보수·임장비·확인설명 의무 등)는 중개사 전용. 시행 확정 시에만 한 줄.
- **R3** 안양시 고시·동네 사안은 해당 동을 지정한 레터에만.
- **R5** 서울 통계는 안양 '우리 동네 숫자'로 치환.
- **R7** 고객용 금지 표현(고객에게 · 안내하세요 · 설명하세요 · 상담 시 · 영업 · 경쟁 · 수주 · 협회 · DEMO · 입력해 주세요 · 미설정)이 있으면 발행 차단.
- **R8** DAILY 3개(48시간) · WEEKLY 5개(7일) · MONTHLY 8개(31일), 같은 주제 2개까지.

## 구조

```
app/                 Next.js App Router (studio, l/[id], api/studio/*, api/cron/*)
components/          LetterView(고객 레터 렌더러), Badges
lib/                 types · taxonomy · links(공공데이터 바로가기) · classify · routing · letter · market · collect · enrich · store · repo · seed
data/market-anyang.json   안양 실거래 월별 집계(기존 monthly.json) + 기준금리
public/anyang-dashboard/  기존 대시보드 사본
docs/                기획안
```

저장소는 `lib/store.ts` 어댑터로 추상화되어 있습니다. Upstash 대신 다른 KV/DB 를 쓰려면 `KV` 인터페이스(`get`/`set`)만 구현하면 됩니다.

## 주의

- 자동 초안은 초안일 뿐입니다. 검수 완료로 바꾸기 전에는 레터에 실리지 않습니다.
- 인스타 카드 PNG 저장은 브라우저에서 `html-to-image` 로 렌더링합니다. 웹폰트가 이미지에 포함되지 않으면 기본 글꼴로 저장될 수 있으니 저장 결과를 한 번 확인하세요. 카드·블로그 본문은 고객용 문장에서 가져오며, R7 금지 표현이 있으면 화면에 경고가 뜹니다.
- 실거래 신고 기한이 30일이라 최근 두 달 집계는 잠정치로 표시됩니다.
- 광고성 메일 발송에는 실제로 동작하는 수신거부 수단이 필요합니다. 설정의 수신거부 링크 또는 이메일을 채우세요.
- `fetch.js` 등 루트의 기존 스크립트에 들어 있던 API 키는 환경변수(`DATA_GO_KR_KEY`)로 옮기고 재발급하는 것을 권합니다.
