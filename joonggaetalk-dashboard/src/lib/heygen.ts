/**
 * AI 소개 영상 (HeyGen) — 물건 정보로 아바타가 설명하는 짧은 영상을 만든다.
 *
 * HeyGen 의 v3 Video Agent 는 프롬프트 한 줄을 받아 대본·아바타·장면·렌더링을
 * 알아서 한다. 편한 만큼 위험하다. 대본을 AI 가 직접 쓰기 때문에 "역까지 도보 3분",
 * "투자 가치 최고" 같은 말을 지어낼 수 있고, 그 영상을 올리는 순간 표시·광고
 * 책임은 중개사에게 온다(공인중개사법 제18조의2). 그래서 이 파일의 절반은
 * 영상을 만드는 법이 아니라 AI 가 넘지 말아야 할 선을 적는 데 쓴다.
 *
 * 나머지 절반은 heygen-cli(공식 CLI)가 이미 겪고 정리해 둔 규칙을 옮긴 것이다.
 *   - 오류는 HTTP 상태와 API 코드로 나눠 고칠 곳을 알려 준다 (FromAPIError)
 *   - 만들기 요청은 Idempotency-Key 로 두 번 과금되지 않게 한다
 *   - 상태 확인은 "진행 중"이 확실한 값에서만 계속하고, 모르는 값이면 멈춘다
 *   - 확인은 5~10초 간격, 최대 20분에서 끊는다
 *
 * 의존성 없는 순수 함수만 둔다. 키는 서버(route.ts)에만 있다.
 */
import { formatManwon } from "./format.ts";

export const API_BASE = "https://api.heygen.com";

/** HeyGen 이 받는 프롬프트 길이 (1~10000자) */
export const PROMPT_MAX = 10_000;

/** 세로는 릴스·숏츠, 가로는 유튜브·블로그 */
export type Orientation = "portrait" | "landscape";
export const ORIENTATIONS: Orientation[] = ["portrait", "landscape"];

/**
 * 물건에 남기는 것은 번호뿐이다. 영상 주소(video_url)는 시간이 지나면 만료되는
 * 서명 주소라 저장해 두면 며칠 뒤 깨진 링크가 된다. 열 때마다 번호로 새로 받는다.
 */
export type VideoRef = {
  videoId: string;
  sessionId: string;
  orientation: Orientation;
  createdAt: string;
  /** 중복 방지 키에 들어간 회차. [새로 만들기] 는 이 값 + 1 로 보낸다 */
  attempt: number;
};

/* ------------------------------------------------------------- 설정 */

export type HeygenConfig = {
  apiKey: string;
  /** 보통은 API_BASE. heygen-cli 의 BaseURL 설정처럼 바꿀 수 있게 둔다 — 시험용 가짜 서버 등 */
  baseUrl: string;
  /** 중개사 본인 아바타를 만들어 두었으면 그걸 쓴다. 없으면 HeyGen 이 고른다. */
  avatarId?: string;
  voiceId?: string;
};

function opt(v: string | undefined): string | undefined {
  const s = (v || "").trim();
  return s || undefined;
}

export function readConfig(env: Record<string, string | undefined>): HeygenConfig | null {
  const apiKey = (env.HEYGEN_API_KEY || "").trim();
  if (!apiKey) return null;
  const baseUrl = (opt(env.HEYGEN_BASE_URL) ?? API_BASE).replace(/\/+$/, "");
  return { apiKey, baseUrl, avatarId: opt(env.HEYGEN_AVATAR_ID), voiceId: opt(env.HEYGEN_VOICE_ID) };
}

/* ------------------------------------------------------------- 대본 재료 */

/** 영상에 넣을 물건 사실. 화면의 Property 에서 골라 담는다 — 소유자·호수는 애초에 받지 않는다. */
export type BriefFacts = {
  /** 아파트 · 오피스텔 · 토지 … */
  type: string;
  /** 단지·건물 이름 (호수는 뺀 것) */
  title: string;
  /** 시·군·구 + 읍·면·동 */
  region: string;
  areaM2?: number;
  /** "8/20" — 해당 층 / 총 층 */
  floor?: string;
  parking?: number;
  /** 매매 · 전세 · 월세 */
  contractTypes: string[];
  salePrice?: number; // 만원
  deposit?: number; // 만원
  monthly?: number; // 만원
  /** 건축물대장 사용승인일 YYYYMMDD — 대장을 조회했을 때만 */
  useAprDay?: string;
  /** 아래 넷은 데이터에 없어 중개사가 카드에서 채운다 */
  direction?: string;
  rooms?: string;
  moveIn?: string;
  maintenance?: string;
  /** 중개사가 강조하고 싶은 점 (사실만) */
  notes?: string;
};

/** 광고에 반드시 들어가야 하는 중개사무소 정보 */
export type OfficeFacts = {
  office: string;
  agent: string;
  address: string;
  phone: string;
  registrationNo: string;
};

/**
 * 주소에서 시·군·구 + 읍·면·동까지만 남긴다.
 *
 * "인천 부평구 십정동 630 더샵… 110동 103호" → "인천 부평구 십정동".
 * "110동" 같은 아파트 동 번호는 숫자로 시작하므로 행정동으로 잡지 않는다.
 * "종로1가"처럼 숫자가 섞인 법정동은 한글로 시작하므로 잡는다.
 */
export function regionOf(address: string): string {
  const tokens = address.trim().split(/\s+/).filter(Boolean);
  const at = tokens.findIndex((t, i) => i >= 1 && /^[가-힣][가-힣0-9]*(동|읍|면|리|가)$/.test(t));
  return (at >= 0 ? tokens.slice(0, at + 1) : tokens.slice(0, 3)).join(" ");
}

/**
 * 물건 이름에서 호수를 뗀다.
 *
 * 영상은 한 번 올라가면 지울 수 없다고 봐야 한다. 임대 중인 집이면 호수까지
 * 나간 영상이 세입자의 집 주소를 공개하는 셈이 된다. 소개 영상에 호수는 필요 없다.
 */
export function stripUnit(name: string): string {
  return name.replace(/\s*\d+\s*호\s*$/, "").trim();
}

export function priceLine(f: Pick<BriefFacts, "contractTypes" | "salePrice" | "deposit" | "monthly">): string {
  const parts: string[] = [];
  if (f.contractTypes.includes("매매") && f.salePrice) parts.push(`매매 ${formatManwon(f.salePrice)}`);
  const lease = f.contractTypes.some((t) => t !== "매매");
  if (lease && f.deposit !== undefined) {
    parts.push(f.monthly ? `보증금 ${formatManwon(f.deposit)} / 월세 ${formatManwon(f.monthly)}` : `전세 ${formatManwon(f.deposit)}`);
  }
  return parts.join(", ");
}

/** "20240131" → "2024년 1월 31일". 모양이 다르면 지어내지 않고 비운다. */
export function formatAprDay(ymd?: string): string {
  if (!ymd || !/^\d{8}$/.test(ymd)) return "";
  return `${ymd.slice(0, 4)}년 ${Number(ymd.slice(4, 6))}월 ${Number(ymd.slice(6, 8))}일`;
}

/** 주차대수를 세대당으로 적는 종류. 상가·단독은 건물 전체 대수다. */
const PER_HOUSEHOLD = ["아파트", "오피스텔", "빌라·다세대"];

function floorText(floor?: string): string {
  if (!floor) return "";
  const [cur, total] = floor.split("/").map((s) => s.trim());
  if (cur && total) return `${cur}층 (총 ${total}층)`;
  if (total) return `총 ${total}층`;
  return cur ? `${cur}층` : "";
}

/**
 * 인터넷 표시·광고에 들어가야 하는 항목 중 빠진 것.
 *
 * 공인중개사법 제18조의2 는 중개대상물을 광고할 때 중개사무소와 개업공인중개사
 * 정보를, 인터넷 광고에서는 물건의 소재지·면적·가격·종류·거래형태와 건축물이면
 * 총층수·사용승인일·해당층·방향·방/욕실 수·입주가능일·주차대수·관리비를
 * 밝히도록 한다. 영상을 유튜브·인스타그램에 올리면 이 광고에 해당한다.
 *
 * 막지는 않는다 — 고객에게 따로 보내는 영상일 수도 있다. 대신 무엇이 빠졌는지
 * 만들기 전에 보여 준다.
 */
export function missingForAd(f: BriefFacts, o: OfficeFacts): string[] {
  const miss: string[] = [];
  if (!o.office.trim()) miss.push("중개사무소 명칭");
  if (!o.address.trim()) miss.push("중개사무소 소재지");
  if (!o.phone.trim()) miss.push("중개사무소 연락처");
  if (!o.registrationNo.trim()) miss.push("중개사무소 등록번호");
  if (!o.agent.trim()) miss.push("개업공인중개사 성명");

  if (!f.region.trim()) miss.push("소재지");
  if (!f.areaM2) miss.push("면적");
  if (!priceLine(f)) miss.push("가격");

  if (f.type !== "토지") {
    const [cur, total] = (f.floor || "").split("/").map((s) => s.trim());
    if (!total) miss.push("총 층수");
    if (!cur) miss.push("해당 층");
    if (!formatAprDay(f.useAprDay)) miss.push("사용승인일");
    if (!f.direction?.trim()) miss.push("방향");
    if (!f.rooms?.trim() && f.type !== "상가") miss.push("방·욕실 수");
    if (!f.moveIn?.trim()) miss.push("입주가능일");
    if (f.parking === undefined) miss.push("주차대수");
    if (!f.maintenance?.trim()) miss.push("관리비");
  }
  return miss;
}

/**
 * HeyGen Video Agent 에 보낼 프롬프트.
 *
 * 사실 목록과 금지 목록을 따로 적는다. 사실은 그대로 읽게 하고, 목록에 없는
 * 수치·거리·시설·전망·수익은 말하지 못하게 한다. AI 는 빈칸을 그럴듯하게
 * 채우는 데 능하고, 부동산 광고에서 그럴듯한 빈칸은 허위 광고다.
 */
export function buildPrompt(f: BriefFacts, o: OfficeFacts, orientation: Orientation): string {
  const facts: [string, string][] = [
    ["종류", f.type],
    ["이름", f.title],
    ["소재지", f.region],
    ["면적", f.areaM2 ? `전용 ${f.areaM2}㎡ (약 ${(f.areaM2 / 3.3058).toFixed(1)}평)` : ""],
    ["거래", priceLine(f)],
    ["층", floorText(f.floor)],
    ["사용승인일", formatAprDay(f.useAprDay)],
    ["방향", f.direction?.trim() || ""],
    ["방·욕실", f.rooms?.trim() || ""],
    ["입주가능일", f.moveIn?.trim() || ""],
    ["주차", f.parking !== undefined ? `${PER_HOUSEHOLD.includes(f.type) ? "세대당 " : ""}${f.parking}대` : ""],
    ["관리비", f.maintenance?.trim() || ""],
  ];
  const office: [string, string][] = [
    ["중개사무소", o.office],
    ["대표 공인중개사", o.agent],
    ["소재지", o.address],
    ["연락처", o.phone],
    ["등록번호", o.registrationNo],
  ];
  const list = (rows: [string, string][]) =>
    rows.filter(([, v]) => v.trim()).map(([k, v]) => `- ${k}: ${v.trim()}`).join("\n");

  const shape =
    orientation === "portrait"
      ? "세로(9:16) 숏폼 영상, 30~45초. 릴스·숏츠에 올린다."
      : "가로(16:9) 영상, 45~60초. 유튜브·블로그에 올린다.";

  return [
    `공인중개사가 고객에게 매물을 소개하는 ${shape}`,
    "내레이션과 자막은 모두 한국어로, 차분하고 신뢰감 있는 말투로 한다.",
    "",
    "[매물 정보 — 아래 사실만 말한다]",
    list(facts),
    ...(f.notes?.trim() ? ["", "[중개사가 강조한 점 — 사실 그대로 전달한다]", f.notes.trim()] : []),
    "",
    "[반드시 지킬 것]",
    "- 위 목록에 없는 숫자·거리·시간·학교·역·편의시설·조망·시세·수익률을 만들어 말하지 않는다.",
    "- '최고', '유일', '확실한 수익', '반드시 오른다' 같은 단정·과장 표현을 쓰지 않는다.",
    "- 가격은 목록에 적힌 금액 그대로 말하고 반올림하거나 바꾸지 않는다.",
    "- 첫 장면 하단에 'AI 아바타가 안내합니다' 문구를 작게 표시한다.",
    "- 마지막 장면에 아래 중개사무소 정보를 글자로 모두 표시한다.",
    "",
    "[중개사무소 정보 — 마지막 장면]",
    list(office) || "- (중개사무소 정보 없음)",
  ].join("\n");
}

/* ------------------------------------------------------------- 중복 과금 방지 */

/** HeyGen 이 받는 Idempotency-Key 모양: 1~255자, 영문·숫자·_:.- */
export const IDEMPOTENCY_RE = /^[A-Za-z0-9_:.-]{1,255}$/;

/** FNV-1a 32비트. 암호용이 아니라 "같은 요청인가"를 가르는 지문이다. 엣지·브라우저 어디서나 돈다. */
export function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(text)) {
    h ^= byte;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * 같은 영상 요청에는 같은 키가 나온다.
 *
 * 만들기 요청은 서버가 받아 놓고 응답만 늦을 수 있다. 그때 다시 누르면
 * 영상이 두 개 만들어지고 크레딧도 두 번 빠진다. 같은 키를 보내면 HeyGen 은
 * 24시간 동안 처음 결과를 그대로 돌려준다(heygen-cli 의 --idempotency-key).
 *
 * 본문 전체(프롬프트·방향·아바타·목소리)를 지문에 넣는다 — 같은 키로 다른
 * 본문을 보내는 일이 없게. attempt 는 중개사가 [새로 만들기] 를 눌러
 * 일부러 다른 영상을 원할 때만 올라간다.
 */
export function idempotencyKey(propertyId: string, body: Record<string, unknown>, attempt = 0): string {
  const id = propertyId.replace(/[^A-Za-z0-9_.-]/g, "-").slice(0, 64) || "x";
  const key = `jt_vid_${id}_${fnv1a(JSON.stringify(body))}_${Math.max(0, Math.floor(attempt))}`;
  return key;
}

/* ------------------------------------------------------------- 오류 */

export type HeygenErrorCode =
  | "NO_KEY"
  | "BAD_KEY"
  | "FORBIDDEN"
  | "NO_CREDIT"
  | "INVALID"
  | "NOT_FOUND"
  | "IN_PROGRESS"
  | "RATE_LIMIT"
  | "UPSTREAM"
  | "REJECTED"
  | "NO_VIDEO_ID"
  | "NEEDS_INPUT"
  | "FAILED"
  | "UNKNOWN_STATE"
  | "STALLED";

export const HEYGEN_ERRORS: Record<HeygenErrorCode, { message: string; hint: string }> = {
  NO_KEY: {
    message: "HeyGen 이 설정되지 않았습니다.",
    hint: "app.heygen.com/settings/api 에서 API 키를 만들어 HEYGEN_API_KEY 환경 변수에 넣고 다시 배포하세요. 키가 없어도 아래 대본을 복사해 HeyGen 화면에서 쓸 수 있습니다.",
  },
  BAD_KEY: {
    message: "HeyGen API 키가 맞지 않습니다.",
    hint: "키를 앞뒤 잘림 없이 넣었는지, 삭제되거나 만료된 키가 아닌지 확인하세요.",
  },
  FORBIDDEN: {
    message: "이 키로는 영상을 만들 수 없습니다.",
    hint: "HeyGen API 키의 권한(scope)에 영상 생성이 들어 있는지 확인하세요. 읽기 전용 키일 수 있습니다.",
  },
  NO_CREDIT: {
    message: "HeyGen 크레딧이 부족합니다.",
    hint: "HeyGen 결제 화면에서 API 크레딧을 충전하세요. API 키는 구독 크레딧이 아니라 API 크레딧을 씁니다.",
  },
  INVALID: {
    message: "HeyGen 이 요청 내용을 받아들이지 않았습니다.",
    hint: "아래 '자세히'의 항목을 확인하세요. 아바타·목소리 ID 를 환경 변수로 지정했다면 그 값이 맞는지도 보세요.",
  },
  NOT_FOUND: {
    message: "영상을 찾을 수 없습니다.",
    hint: "HeyGen 에서 지워졌거나 다른 계정에서 만든 영상입니다. 다시 기다려도 생기지 않으니 새로 만들어야 합니다.",
  },
  IN_PROGRESS: {
    message: "같은 영상 요청을 이미 처리하고 있습니다.",
    hint: "잠시 뒤 이어서 확인합니다. 새로 만들어지지 않으니 기다리면 됩니다.",
  },
  RATE_LIMIT: { message: "요청이 많아 HeyGen 이 잠시 막았습니다.", hint: "잠시 뒤 다시 시도하면 풀립니다." },
  UPSTREAM: {
    message: "HeyGen 서버가 응답하지 않습니다.",
    hint: "잠시 뒤 다시 눌러 주세요. 같은 내용으로 다시 누르면 영상이 두 번 만들어지지 않습니다.",
  },
  REJECTED: { message: "HeyGen 이 요청을 거절했습니다.", hint: "아래 '자세히'의 원문을 확인하세요." },
  NO_VIDEO_ID: {
    message: "요청은 접수됐지만 영상 번호를 받지 못했습니다.",
    hint: "HeyGen 화면의 Video Agent 목록에서 이 세션을 직접 확인하세요.",
  },
  NEEDS_INPUT: {
    message: "AI 가 결정을 기다리며 멈췄습니다.",
    hint: "AI 가 물어본 내용을 '강조할 점'에 적어 새로 만들거나, HeyGen 화면에서 이어서 답하세요.",
  },
  FAILED: { message: "영상을 만들지 못했습니다.", hint: "HeyGen 이 알려 준 사유를 확인하고 내용을 고쳐 새로 만들어 주세요." },
  UNKNOWN_STATE: {
    message: "영상 상태를 알 수 없습니다.",
    hint: "모르는 상태에서 계속 기다리지 않고 멈췄습니다. HeyGen 화면에서 직접 확인하세요.",
  },
  STALLED: {
    message: "20분이 지나도 끝나지 않았습니다.",
    hint: "HeyGen 에서 아직 만드는 중일 수 있습니다. 나중에 [다시 확인] 을 누르면 이어서 봅니다.",
  },
};

/**
 * HeyGen 응답 → 우리 오류 코드.
 *
 * heygen-cli 의 FromAPIError 와 같은 순서로 본다. API 가 구체적인 코드를 주면
 * 그것을, 아니면 HTTP 상태를 따른다. 나누는 이유는 고치는 곳이 다르기 때문이다 —
 * 키(환경 변수), 권한(HeyGen 키 설정), 크레딧(결제), 내용(대본).
 */
export function mapError(status: number, code = ""): HeygenErrorCode {
  const known = fromApiCode(code);
  if (known) return known;

  if (status === 0) return "UPSTREAM"; // 연결 자체가 안 됨 · 시간 초과
  if (status === 401) return "BAD_KEY";
  if (status === 403) return "FORBIDDEN";
  if (status === 402) return "NO_CREDIT";
  if (status === 400 || status === 422) return "INVALID";
  if (status === 404) return "NOT_FOUND";
  if (status === 429) return "RATE_LIMIT";
  if (status >= 500) return "UPSTREAM";
  return "REJECTED";
}

/** API 가 준 코드만으로 판단할 수 있으면 그 결과. 모르는 코드면 null — 상태로 넘긴다. */
export function fromApiCode(code: string): HeygenErrorCode | null {
  const c = code.toLowerCase();
  if (c === "request_in_progress") return "IN_PROGRESS";
  if (c === "insufficient_credit") return "NO_CREDIT";
  if (c === "rate_limit_exceeded" || c === "quota_exceeded") return "RATE_LIMIT";
  if (c === "unauthorized") return "BAD_KEY";
  if (c === "forbidden") return "FORBIDDEN";
  if (c === "not_found" || c.endsWith("_not_found")) return "NOT_FOUND";
  if (c === "validation_error") return "INVALID";
  if (c === "internal_error") return "UPSTREAM";
  return null;
}

/**
 * 기다리면 풀리는 오류인가.
 *
 * 나머지(키·권한·크레딧·없는 영상)는 몇 번을 다시 물어도 같은 답이 온다.
 * heygen-cli 도 not_found 를 "아직 안 됨"으로 읽지 말라고 못박아 둔다.
 */
export function isTransient(code: HeygenErrorCode): boolean {
  return code === "RATE_LIMIT" || code === "UPSTREAM" || code === "IN_PROGRESS";
}

/* ------------------------------------------------------------- 응답 읽기 */

type Obj = Record<string, unknown>;
function obj(v: unknown): Obj {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {};
}
function s(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function n(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export type ApiError = { code: string; message: string; param: string; docUrl: string };

/** {"error": {"code","message","param","doc_url"}} — HeyGen 표준 오류 봉투 */
export function readApiError(payload: unknown): ApiError {
  const e = obj(obj(payload).error);
  return { code: s(e.code), message: s(e.message), param: s(e.param), docUrl: s(e.doc_url) };
}

export type Created = { sessionId: string; videoId: string | null; status: string };

export function parseCreate(payload: unknown): Created {
  const d = obj(obj(payload).data);
  return { sessionId: s(d.session_id), videoId: s(d.video_id) || null, status: s(d.status) };
}

export type Video = {
  id: string;
  status: string;
  videoUrl: string;
  thumbnailUrl: string;
  pageUrl: string;
  duration: number | null;
  failureCode: string;
  failureMessage: string;
};

export function parseVideo(payload: unknown): Video {
  const d = obj(obj(payload).data);
  return {
    id: s(d.id),
    status: s(d.status),
    videoUrl: s(d.video_url),
    thumbnailUrl: s(d.thumbnail_url),
    pageUrl: s(d.video_page_url),
    duration: n(d.duration),
    failureCode: s(d.failure_code),
    failureMessage: s(d.failure_message),
  };
}

export type Session = {
  status: string;
  progress: number | null;
  errorCode: string;
  errorMessage: string;
  /** AI 가 마지막으로 한 말 — 멈췄을 때 무엇을 물었는지 보여 준다 */
  lastModelText: string;
};

export function parseSession(payload: unknown): Session {
  const d = obj(obj(payload).data);
  const err = obj(d.error);
  const messages = Array.isArray(d.messages) ? d.messages.map(obj) : [];
  // messages 는 최신순이다
  const last = messages.find((m) => s(m.role) === "model" && s(m.type) !== "resource" && s(m.content).trim());
  return {
    status: s(d.status),
    progress: n(d.progress),
    errorCode: s(err.code),
    errorMessage: s(err.message),
    lastModelText: last ? s(last.content).trim() : "",
  };
}

export type Account = { name: string; billing: string; remaining: string };

/** GET /v3/users/me — 크레딧을 쓰지 않는 확인용 호출 */
export function parseAccount(payload: unknown): Account {
  const d = obj(obj(payload).data);
  const name = s(d.username) || [s(d.first_name), s(d.last_name)].filter(Boolean).join(" ");
  const billing = s(d.billing_type);
  let remaining = "";
  if (billing === "wallet") {
    const w = obj(d.wallet);
    const bal = n(w.remaining_balance);
    if (bal !== null) remaining = s(w.currency) === "usd" ? `$${bal.toFixed(2)}` : `${bal} 크레딧`;
  } else if (billing === "usage_based") {
    const u = obj(d.usage_based);
    const left = n(u.remaining_credits);
    if (left !== null) remaining = `${left} 크레딧`;
  }
  return { name, billing, remaining };
}

/* ------------------------------------------------------------- 상태 판단 */

/**
 * 영상 상태(GET /v3/videos/{id}) → 다음 행동.
 *
 * "진행 중"이 확실한 값은 pending · processing 둘뿐이다. 그 밖의 값은
 * 모르는 값이라도 멈춘다. 모르는 상태에서 계속 기다리면 20분을 허비하고,
 * 그사이 사용자는 영상이 만들어지고 있다고 믿는다.
 */
export type Phase = "working" | "done" | "failed" | "unknown";

export function phaseOf(status: string): Phase {
  if (status === "pending" || status === "processing") return "working";
  if (status === "completed") return "done";
  if (status === "failed") return "failed";
  return "unknown";
}

export type Judgement =
  | { kind: "working"; progress: number | null }
  | { kind: "done" }
  | { kind: "stop"; code: HeygenErrorCode; why: string };

/**
 * 영상 + 세션을 함께 보고 판단한다.
 *
 * 세션을 같이 보는 이유: generate 모드 세션이 결정을 기다리며 멈추면 세션은
 * waiting_for_input 이 되고, 예약해 둔 영상은 failed 가 된다(HeyGen 스키마 설명).
 * 영상만 보면 "실패"로 끝나 버려 왜 멈췄는지 — AI 가 무엇을 물었는지 — 를 놓친다.
 * 세션을 못 읽었으면(null) 영상 상태만으로 판단한다.
 */
export function judge(video: Video, session: Session | null): Judgement {
  const phase = phaseOf(video.status);
  if (phase === "done") return { kind: "done" };

  if (session?.status === "waiting_for_input") {
    return { kind: "stop", code: "NEEDS_INPUT", why: session.lastModelText };
  }
  // 세션이 먼저 실패를 알 수 있다 (예: 결제 한도). 그때 영상은 대기로 남아 있을 수 있다.
  const sessionFailed = session?.status === "failed";
  if (phase === "working" && !sessionFailed) return { kind: "working", progress: session?.progress ?? null };
  if (phase === "failed" || (phase === "working" && sessionFailed)) {
    const why = [video.failureMessage || video.failureCode, session?.errorMessage || session?.errorCode]
      .filter(Boolean)
      .join(" · ");
    // 이미 끝난 영상이다. "잠시 뒤 다시"로 읽히는 코드(서버 오류 등)는 실패로 둔다 —
    // 같은 키로 다시 보내면 이 실패한 결과가 그대로 돌아오기 때문이다.
    const mapped = session?.errorCode ? fromApiCode(session.errorCode) : null;
    const code: HeygenErrorCode = mapped && !isTransient(mapped) ? mapped : "FAILED";
    return { kind: "stop", code, why };
  }
  return { kind: "stop", code: "UNKNOWN_STATE", why: video.status || "(상태 없음)" };
}

/* ------------------------------------------------------------- 확인 간격 */

/** heygen-cli --wait 의 기본 제한시간과 같다 */
export const POLL_CAP_MS = 20 * 60_000;
/** 기다리면 풀리는 오류라도 연달아 이만큼 나면 멈춘다 */
export const TRANSIENT_STREAK_MAX = 5;

/** 5초에서 시작해 10초까지 늘린다. 5초보다 자주 묻지 않는다. */
export function pollDelay(attempt: number): number {
  return Math.min(10_000, Math.round(5_000 * Math.pow(1.5, Math.max(0, attempt))));
}

export type PollStep = { action: "wait"; delayMs: number } | { action: "stop"; code: HeygenErrorCode | null };

/**
 * 한 번 확인한 뒤 계속 기다릴지.
 *
 * 멈추는 조건 셋을 다 갖춘다 (heygen-cli SKILL.md 의 폴링 규칙):
 *   1. 진행 중이 확실할 때만 계속한다
 *   2. 기다려도 안 풀리는 오류(키·권한·없는 영상)면 바로 멈춘다
 *   3. 시간 상한과 연속 오류 상한을 둔다
 */
export function nextStep(input: {
  judgement?: Judgement;
  error?: HeygenErrorCode;
  attempt: number;
  elapsedMs: number;
  transientStreak: number;
}): PollStep {
  const { judgement, error, attempt, elapsedMs, transientStreak } = input;
  if (error) {
    if (!isTransient(error)) return { action: "stop", code: error };
    if (transientStreak >= TRANSIENT_STREAK_MAX) return { action: "stop", code: error };
  } else if (judgement) {
    if (judgement.kind === "done") return { action: "stop", code: null };
    if (judgement.kind === "stop") return { action: "stop", code: judgement.code };
  }
  const delayMs = pollDelay(attempt);
  if (elapsedMs + delayMs > POLL_CAP_MS) return { action: "stop", code: "STALLED" };
  return { action: "wait", delayMs };
}

/** 경로에 끼워 넣는 ID 는 모양을 먼저 본다. "../" 가 들어가면 다른 API 를 부르게 된다. */
export function isSafeId(id: string): boolean {
  return /^[A-Za-z0-9_-]{1,128}$/.test(id);
}
