/**
 * AI 소개 영상 (HeyGen) 테스트.
 *   npm test
 *
 * 응답 모양은 heygen-cli 가 OpenAPI 명세에서 생성한 스키마(gen/video.go ·
 * gen/video-agent.go · gen/user.go)를 따랐다. 실제 계정으로 받아 둔 응답이 아니다.
 */
import assert from "node:assert/strict";
import {
  buildPrompt,
  fnv1a,
  formatAprDay,
  HEYGEN_ERRORS,
  IDEMPOTENCY_RE,
  idempotencyKey,
  isSafeId,
  isTransient,
  judge,
  mapError,
  missingForAd,
  nextStep,
  parseAccount,
  parseCreate,
  parseSession,
  parseVideo,
  phaseOf,
  pollDelay,
  POLL_CAP_MS,
  priceLine,
  readApiError,
  readConfig,
  regionOf,
  stripUnit,
  TRANSIENT_STREAK_MAX,
  type BriefFacts,
  type HeygenErrorCode,
  type OfficeFacts,
  type Session,
  type Video,
} from "../src/lib/heygen.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

console.log("\nAI 소개 영상 (HeyGen)");

/* ------------------------------------------------------------- 대본 재료 */

test("소재지는 읍·면·동까지만 남긴다 — 아파트 동 번호는 행정동이 아니다", () => {
  assert.equal(regionOf("인천 부평구 십정동 630 더샵부평센트럴시티 110동 103호"), "인천 부평구 십정동");
  assert.equal(regionOf("경기 성남시 분당구 판교동 577-4 102호"), "경기 성남시 분당구 판교동");
  assert.equal(regionOf("인천 부평구 산곡동 산 12-4"), "인천 부평구 산곡동");
  assert.equal(regionOf("경기 부천시 중동 1148-2 302호"), "경기 부천시 중동");
  // 숫자가 섞인 법정동도 한글로 시작하면 잡는다
  assert.equal(regionOf("서울 종로구 종로1가 1"), "서울 종로구 종로1가");
  // "110동" 은 숫자로 시작하므로 넘어간다
  assert.equal(regionOf("어딘가 110동 5호"), "어딘가 110동 5호");
});

test("호수는 영상에 넣지 않는다 — 임대 중이면 세입자 집이 특정된다", () => {
  assert.equal(stripUnit("더샵부평 110동 103호"), "더샵부평 110동");
  assert.equal(stripUnit("판교 테크노밸리 오피스텔 1203호"), "판교 테크노밸리 오피스텔");
  assert.equal(stripUnit("계산동 상가 1층"), "계산동 상가 1층");
  assert.equal(stripUnit("구월동 단독주택"), "구월동 단독주택");
});

test("가격 문장 — 전세·월세·매매를 데이터대로", () => {
  assert.equal(priceLine({ contractTypes: ["전세"], deposit: 42000 }), "전세 4억 2,000만원");
  assert.equal(priceLine({ contractTypes: ["월세"], deposit: 3000, monthly: 120 }), "보증금 3,000만원 / 월세 120만원");
  assert.equal(priceLine({ contractTypes: ["매매"], salePrice: 78000 }), "매매 7억 8,000만원");
  // 전세·월세 둘 다 받는 물건인데 월세가 0 이면 전세로 읽는다
  assert.equal(priceLine({ contractTypes: ["전세", "월세"], deposit: 30000, monthly: 0 }), "전세 3억원");
  assert.equal(priceLine({ contractTypes: ["매매"] }), "");
});

test("사용승인일 — 모양이 다르면 지어내지 않고 비운다", () => {
  assert.equal(formatAprDay("20200131"), "2020년 1월 31일");
  assert.equal(formatAprDay(""), "");
  assert.equal(formatAprDay("2020-01-31"), "");
  assert.equal(formatAprDay(undefined), "");
});

const office: OfficeFacts = {
  office: "서연공인중개사사무소",
  agent: "이서연",
  address: "인천 부평구 열우물로 90",
  phone: "032-000-1234",
  registrationNo: "28237-2026-00001",
};

const apt: BriefFacts = {
  type: "아파트",
  title: stripUnit("더샵부평 110동 103호"),
  region: regionOf("인천 부평구 십정동 630 더샵부평센트럴시티 110동 103호"),
  areaM2: 84.9,
  floor: "1/29",
  parking: 1.2,
  contractTypes: ["전세"],
  deposit: 42000,
  useAprDay: "20200131",
  direction: "남향",
  rooms: "방 3 · 욕실 2",
  moveIn: "즉시",
  maintenance: "월 평균 25만원",
};

test("프롬프트에 사실과 금지 목록, 중개사무소 정보가 다 들어간다", () => {
  const p = buildPrompt(apt, office, "portrait");
  assert.ok(p.includes("세로(9:16)"));
  assert.ok(p.includes("- 소재지: 인천 부평구 십정동"));
  assert.ok(p.includes("- 거래: 전세 4억 2,000만원"));
  assert.ok(p.includes("- 층: 1층 (총 29층)"));
  assert.ok(p.includes("- 사용승인일: 2020년 1월 31일"));
  assert.ok(p.includes("전용 84.9㎡ (약 25.7평)"));
  assert.ok(p.includes("- 주차: 세대당 1.2대"));
  // AI 가 빈칸을 채우지 못하게
  assert.ok(p.includes("목록에 없는 숫자·거리·시간"));
  assert.ok(p.includes("단정·과장 표현을 쓰지 않는다"));
  assert.ok(p.includes("AI 아바타가 안내합니다"));
  // 광고 명시사항 — 마지막 장면
  for (const v of Object.values(office)) assert.ok(p.includes(v), v);
  // 호수는 어디에도 없다
  assert.ok(!p.includes("103호"));
  assert.ok(p.length < 10_000);
});

test("빈 값은 줄째 빼고, 가로 영상은 길이가 다르다", () => {
  const p = buildPrompt({ ...apt, direction: "", maintenance: "  ", notes: "" }, office, "landscape");
  assert.ok(p.includes("가로(16:9)"));
  assert.ok(!p.includes("- 방향:"));
  assert.ok(!p.includes("- 관리비:"));
  assert.ok(!p.includes("[중개사가 강조한 점"));
  const withNotes = buildPrompt({ ...apt, notes: "2024년 욕실 전체 수리" }, office, "portrait");
  assert.ok(withNotes.includes("[중개사가 강조한 점 — 사실 그대로 전달한다]\n2024년 욕실 전체 수리"));
});

test("광고 명시사항 — 다 채우면 빠진 게 없다", () => {
  assert.deepEqual(missingForAd(apt, office), []);
});

test("광고 명시사항 — 등록번호·사용승인일·방향이 빠지면 알려 준다", () => {
  const miss = missingForAd({ ...apt, useAprDay: undefined, direction: "" }, { ...office, registrationNo: "" });
  assert.deepEqual(miss, ["중개사무소 등록번호", "사용승인일", "방향"]);
});

test("토지에는 건축물 항목을 묻지 않고, 상가에는 방 수를 묻지 않는다", () => {
  const land: BriefFacts = { type: "토지", title: "산곡동 토지", region: "인천 부평구 산곡동", areaM2: 1057.8, contractTypes: ["매매"], salePrice: 150000 };
  assert.deepEqual(missingForAd(land, office), []);
  const shop: BriefFacts = { ...apt, type: "상가", rooms: "", parking: 3 };
  assert.ok(!missingForAd(shop, office).includes("방·욕실 수"));
  // 상가 주차는 세대당이 아니다
  assert.ok(buildPrompt(shop, office, "portrait").includes("- 주차: 3대"));
  // 주차 0대는 '없음'이라는 사실이다. 비어 있는 것과 다르다
  assert.ok(!missingForAd({ ...apt, parking: 0 }, office).includes("주차대수"));
  assert.ok(missingForAd({ ...apt, parking: undefined }, office).includes("주차대수"));
});

/* ------------------------------------------------------------- 중복 과금 방지 */

test("FNV-1a 지문 — 알려진 값과 같다", () => {
  assert.equal(fnv1a(""), "811c9dc5");
  assert.equal(fnv1a("a"), "e40c292c");
  assert.equal(fnv1a("foobar"), "bf9cf968");
});

test("같은 요청이면 같은 키, 하나라도 다르면 다른 키", () => {
  const body = { prompt: "x", orientation: "portrait", mode: "generate" };
  const k = idempotencyKey("p1", body, 0);
  assert.equal(k, idempotencyKey("p1", { ...body }, 0));
  assert.notEqual(k, idempotencyKey("p1", { ...body, prompt: "y" }, 0));
  assert.notEqual(k, idempotencyKey("p1", { ...body, orientation: "landscape" }, 0));
  assert.notEqual(k, idempotencyKey("p2", body, 0));
  // [새로 만들기] 는 회차를 올려 일부러 다른 영상을 받는다
  assert.notEqual(k, idempotencyKey("p1", body, 1));
  assert.match(k, IDEMPOTENCY_RE);
});

test("키는 HeyGen 이 받는 글자만 쓴다 — 물건 ID 에 이상한 글자가 있어도", () => {
  const k = idempotencyKey("물건/1 ?&", { prompt: "x" }, 0);
  assert.match(k, IDEMPOTENCY_RE);
  assert.ok(idempotencyKey("p".repeat(500), { prompt: "x" }, 0).length <= 255);
  assert.match(idempotencyKey("", { prompt: "x" }, -3), /_0$/);
});

/* ------------------------------------------------------------- 오류 */

test("오류 — HTTP 상태로 고칠 곳을 나눈다", () => {
  const cases: [number, HeygenErrorCode][] = [
    [401, "BAD_KEY"],
    [403, "FORBIDDEN"],
    [402, "NO_CREDIT"],
    [400, "INVALID"],
    [422, "INVALID"],
    [404, "NOT_FOUND"],
    [429, "RATE_LIMIT"],
    [500, "UPSTREAM"],
    [503, "UPSTREAM"],
    [0, "UPSTREAM"],
    [405, "REJECTED"],
    [409, "REJECTED"],
  ];
  for (const [status, want] of cases) assert.equal(mapError(status), want, String(status));
});

test("오류 — API 코드가 있으면 상태보다 코드를 믿는다", () => {
  assert.equal(mapError(409, "request_in_progress"), "IN_PROGRESS");
  assert.equal(mapError(400, "insufficient_credit"), "NO_CREDIT");
  assert.equal(mapError(400, "quota_exceeded"), "RATE_LIMIT");
  assert.equal(mapError(400, "video_not_found"), "NOT_FOUND");
  assert.equal(mapError(500, "internal_error"), "UPSTREAM");
  // 모르는 코드면 상태로 넘긴다
  assert.equal(mapError(403, "some_new_code"), "FORBIDDEN");
});

test("기다리면 풀리는 오류만 다시 묻는다 — 없는 영상은 기다려도 안 생긴다", () => {
  assert.equal(isTransient("RATE_LIMIT"), true);
  assert.equal(isTransient("UPSTREAM"), true);
  assert.equal(isTransient("IN_PROGRESS"), true);
  for (const c of ["NOT_FOUND", "BAD_KEY", "FORBIDDEN", "NO_CREDIT", "INVALID", "REJECTED"] as HeygenErrorCode[]) {
    assert.equal(isTransient(c), false, c);
  }
});

test("오류 문구는 모든 코드에 원인과 할 일이 다 있다", () => {
  for (const [code, e] of Object.entries(HEYGEN_ERRORS)) {
    assert.ok(e.message.trim(), code);
    assert.ok(e.hint.trim(), code);
  }
});

test("오류 봉투를 읽는다", () => {
  const e = readApiError({ error: { code: "validation_error", message: "prompt is required", param: "prompt", doc_url: "https://developers.heygen.com/docs/error-codes" } });
  assert.deepEqual(e, { code: "validation_error", message: "prompt is required", param: "prompt", docUrl: "https://developers.heygen.com/docs/error-codes" });
  assert.deepEqual(readApiError("<html>502</html>"), { code: "", message: "", param: "", docUrl: "" });
});

/* ------------------------------------------------------------- 응답 읽기 */

test("만들기 응답 — video_id 가 없을 수 있다", () => {
  assert.deepEqual(parseCreate({ data: { session_id: "s1", status: "generating", video_id: "v1", created_at: 1 } }), { sessionId: "s1", videoId: "v1", status: "generating" });
  assert.deepEqual(parseCreate({ data: { session_id: "s1", status: "thinking", video_id: null } }), { sessionId: "s1", videoId: null, status: "thinking" });
});

test("영상 응답을 읽는다", () => {
  const v = parseVideo({
    data: {
      id: "v1",
      status: "completed",
      video_url: "https://files.example/v1.mp4?sig=x",
      thumbnail_url: "https://files.example/v1.jpg",
      video_page_url: "https://app.heygen.com/videos/v1",
      duration: 38.4,
    },
  });
  assert.equal(v.status, "completed");
  assert.equal(v.duration, 38.4);
  assert.equal(v.pageUrl, "https://app.heygen.com/videos/v1");
  assert.equal(v.failureMessage, "");
});

test("세션 응답 — 메시지는 최신순, AI 가 마지막으로 한 말을 꺼낸다", () => {
  const s = parseSession({
    data: {
      status: "waiting_for_input",
      progress: 20,
      messages: [
        { role: "model", type: "resource", content: "video", created_at: 3 },
        { role: "model", type: "text", content: "어떤 목소리로 할까요?", created_at: 2 },
        { role: "user", type: "text", content: "만들어 줘", created_at: 1 },
      ],
    },
  });
  assert.equal(s.status, "waiting_for_input");
  assert.equal(s.progress, 20);
  assert.equal(s.lastModelText, "어떤 목소리로 할까요?");
});

test("계정 응답 — 잔액은 결제 방식에 맞는 칸에서만 읽는다", () => {
  assert.deepEqual(parseAccount({ data: { username: "seoyeon", billing_type: "wallet", wallet: { currency: "usd", remaining_balance: 12.5 } } }), {
    name: "seoyeon",
    billing: "wallet",
    remaining: "$12.50",
  });
  assert.equal(parseAccount({ data: { first_name: "서연", last_name: "이", billing_type: "usage_based", usage_based: { remaining_credits: 40 } } }).remaining, "40 크레딧");
  // 구독은 어느 크레딧이 API 용인지 스키마로 확정할 수 없어 비워 둔다
  assert.equal(parseAccount({ data: { billing_type: "subscription", subscription: { plan: "pro" } } }).remaining, "");
});

/* ------------------------------------------------------------- 상태 판단 */

test("진행 중이 확실한 값은 둘뿐 — 모르는 값은 멈춘다", () => {
  assert.equal(phaseOf("pending"), "working");
  assert.equal(phaseOf("processing"), "working");
  assert.equal(phaseOf("completed"), "done");
  assert.equal(phaseOf("failed"), "failed");
  // heygen-cli: 리소스마다 철자가 다르다(complete / completed). 짐작하지 않는다.
  assert.equal(phaseOf("complete"), "unknown");
  assert.equal(phaseOf("waiting"), "unknown");
  assert.equal(phaseOf(""), "unknown");
});

const vid = (status: string, extra: Partial<Video> = {}): Video => ({
  id: "v1",
  status,
  videoUrl: "",
  thumbnailUrl: "",
  pageUrl: "",
  duration: null,
  failureCode: "",
  failureMessage: "",
  ...extra,
});
const sess = (status: string, extra: Partial<Session> = {}): Session => ({ status, progress: null, errorCode: "", errorMessage: "", lastModelText: "", ...extra });

test("세션이 입력을 기다리면 영상 '실패'를 실패로 읽지 않는다", () => {
  // HeyGen: generate 세션이 멈추면 세션은 waiting_for_input, 예약된 영상은 failed
  const j = judge(vid("failed"), sess("waiting_for_input", { lastModelText: "가로로 할까요, 세로로 할까요?" }));
  assert.deepEqual(j, { kind: "stop", code: "NEEDS_INPUT", why: "가로로 할까요, 세로로 할까요?" });
});

test("세션을 못 읽어도 영상 상태만으로 판단한다", () => {
  assert.deepEqual(judge(vid("processing"), null), { kind: "working", progress: null });
  assert.deepEqual(judge(vid("completed"), null), { kind: "done" });
  assert.deepEqual(judge(vid("failed", { failureMessage: "Script too long" }), null), { kind: "stop", code: "FAILED", why: "Script too long" });
  assert.deepEqual(judge(vid("archived"), null), { kind: "stop", code: "UNKNOWN_STATE", why: "archived" });
});

test("세션이 먼저 실패하면 영상이 대기여도 멈춘다", () => {
  const j = judge(vid("pending"), sess("failed", { errorCode: "insufficient_credit", errorMessage: "Not enough credits" }));
  assert.deepEqual(j, { kind: "stop", code: "NO_CREDIT", why: "Not enough credits" });
  assert.deepEqual(judge(vid("processing"), sess("generating", { progress: 63 })), { kind: "working", progress: 63 });
});

test("끝난 영상의 서버 오류는 '잠시 뒤 다시'가 아니라 실패다", () => {
  const j = judge(vid("failed"), sess("failed", { errorCode: "internal_error", errorMessage: "render crashed" }));
  assert.deepEqual(j, { kind: "stop", code: "FAILED", why: "render crashed" });
});

test("완성된 영상은 세션 상태와 관계없이 완성이다", () => {
  assert.deepEqual(judge(vid("completed"), sess("failed")), { kind: "done" });
});

/* ------------------------------------------------------------- 확인 간격 */

test("5초에서 시작해 10초까지 — 5초보다 자주 묻지 않는다", () => {
  assert.deepEqual([0, 1, 2, 3, 10].map(pollDelay), [5000, 7500, 10000, 10000, 10000]);
});

test("멈추는 조건 — 완성 · 실패 · 기다려도 안 풀리는 오류", () => {
  assert.deepEqual(nextStep({ judgement: { kind: "done" }, attempt: 0, elapsedMs: 0, transientStreak: 0 }), { action: "stop", code: null });
  assert.deepEqual(nextStep({ judgement: { kind: "stop", code: "FAILED", why: "" }, attempt: 0, elapsedMs: 0, transientStreak: 0 }), { action: "stop", code: "FAILED" });
  assert.deepEqual(nextStep({ error: "NOT_FOUND", attempt: 0, elapsedMs: 0, transientStreak: 1 }), { action: "stop", code: "NOT_FOUND" });
  assert.deepEqual(nextStep({ error: "BAD_KEY", attempt: 3, elapsedMs: 0, transientStreak: 1 }), { action: "stop", code: "BAD_KEY" });
});

test("잠깐 막힌 건 기다리되, 연달아 막히면 멈춘다", () => {
  assert.deepEqual(nextStep({ error: "RATE_LIMIT", attempt: 2, elapsedMs: 60_000, transientStreak: 1 }), { action: "wait", delayMs: 10_000 });
  assert.deepEqual(nextStep({ error: "UPSTREAM", attempt: 2, elapsedMs: 60_000, transientStreak: TRANSIENT_STREAK_MAX }), { action: "stop", code: "UPSTREAM" });
});

test("20분 상한 — 넘기면 '아직 만드는 중일 수 있다'로 멈춘다", () => {
  const working = { kind: "working" as const, progress: 90 };
  assert.deepEqual(nextStep({ judgement: working, attempt: 5, elapsedMs: 60_000, transientStreak: 0 }), { action: "wait", delayMs: 10_000 });
  assert.deepEqual(nextStep({ judgement: working, attempt: 120, elapsedMs: POLL_CAP_MS - 5_000, transientStreak: 0 }), { action: "stop", code: "STALLED" });
});

/* ------------------------------------------------------------- 설정 · 경로 */

test("설정 — 키가 없으면 없음, 아바타·목소리는 선택", () => {
  assert.equal(readConfig({}), null);
  assert.equal(readConfig({ HEYGEN_API_KEY: "   " }), null);
  assert.deepEqual(readConfig({ HEYGEN_API_KEY: " k ", HEYGEN_AVATAR_ID: "", HEYGEN_VOICE_ID: "ko_v1" }), {
    apiKey: "k",
    baseUrl: "https://api.heygen.com",
    avatarId: undefined,
    voiceId: "ko_v1",
  });
  // 끝의 / 는 뗀다 — 붙은 채로 경로를 이으면 //v3/... 가 된다
  assert.equal(readConfig({ HEYGEN_API_KEY: "k", HEYGEN_BASE_URL: "http://127.0.0.1:4010/" })?.baseUrl, "http://127.0.0.1:4010");
});

test("경로에 끼우는 번호는 모양을 본다 — ../ 로 다른 API 를 못 부르게", () => {
  assert.equal(isSafeId("a1B2_c3-d4"), true);
  assert.equal(isSafeId("../users/me"), false);
  assert.equal(isSafeId("v1?x=1"), false);
  assert.equal(isSafeId(""), false);
  assert.equal(isSafeId("a".repeat(129)), false);
});

console.log(`\n  ${passed}개 통과\n`);
