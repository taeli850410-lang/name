/**
 * AI 소개 영상 — HeyGen v3 API 프록시.
 *
 * API 키는 서버에만 둔다. 키가 새면 남이 이 계정의 크레딧으로 영상을 만든다.
 *
 *   GET  ?                          설정 여부만 (키를 쓰지 않는다)
 *   GET  ?check=1                   계정 조회 한 번 — 크레딧을 쓰지 않는다
 *   GET  ?video=<id>&session=<id>   영상 상태 한 번. 브라우저가 5~10초 간격으로 부른다
 *   POST                            영상 만들기 (Video Agent, generate 모드)
 *
 * 상태 확인을 서버에서 돌리지 않는 이유: 영상은 몇 분이 걸리는데 서버리스
 * 함수는 그만큼 붙잡아 둘 수 없다. 서버는 한 번씩만 묻고, 기다리는 일은
 * 브라우저가 한다 (판단 규칙은 src/lib/heygen.ts 의 nextStep).
 */
import { NextResponse } from "next/server";
import {
  HEYGEN_ERRORS,
  IDEMPOTENCY_RE,
  idempotencyKey,
  isSafeId,
  judge,
  mapError,
  ORIENTATIONS,
  parseAccount,
  parseCreate,
  parseSession,
  parseVideo,
  PROMPT_MAX,
  readApiError,
  readConfig,
  type HeygenConfig,
  type HeygenErrorCode,
  type Orientation,
} from "@/lib/heygen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** 만들기 요청 응답이 늦을 때를 위해. 상태 확인은 금방 끝난다. */
export const maxDuration = 30;

/** heygen-cli 의 요청당 기본 제한시간(30초)보다 짧게 — 함수가 먼저 끊기면 오류 문구도 못 돌려준다 */
const TIMEOUT_MS = 25_000;

function fail(code: HeygenErrorCode, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, code, ...HEYGEN_ERRORS[code], ...extra }, { status });
}

/** HeyGen 이 거절했을 때 우리 쪽 HTTP 상태. 기다리면 풀리는 것은 502/503 으로 둔다. */
function statusFor(code: HeygenErrorCode): number {
  if (code === "NO_KEY") return 503;
  if (code === "UPSTREAM") return 502;
  if (code === "RATE_LIMIT" || code === "IN_PROGRESS") return 503;
  if (code === "NOT_FOUND") return 404;
  return 400;
}

type Call = { status: number; payload: unknown; requestId: string };

async function call(
  cfg: HeygenConfig,
  path: string,
  init?: { method: "POST"; body: Record<string, unknown>; idempotencyKey?: string },
): Promise<Call> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "x-api-key": cfg.apiKey,
      "User-Agent": "budongsan-talk/1.0 (+https://joonggaetalk-dashboard.vercel.app)",
    };
    if (init) headers["Content-Type"] = "application/json";
    if (init?.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;
    const res = await fetch(`${cfg.baseUrl}${path}`, {
      method: init?.method ?? "GET",
      headers,
      body: init ? JSON.stringify(init.body) : undefined,
      signal: ctrl.signal,
      cache: "no-store",
    });
    const payload = await res.json().catch(() => null);
    return { status: res.status, payload, requestId: res.headers.get("x-request-id") ?? "" };
  } catch {
    return { status: 0, payload: null, requestId: "" };
  } finally {
    clearTimeout(timer);
  }
}

/** 실패한 호출 → 화면에 줄 오류. 원문(why)은 '자세히' 뒤에 둔다. */
function upstreamFail(r: Call, extra?: Record<string, unknown>) {
  const e = readApiError(r.payload);
  const code = mapError(r.status, e.code);
  const why = [e.message, e.param && `항목: ${e.param}`].filter(Boolean).join(" · ") || (r.status ? `HTTP ${r.status}` : "응답 없음");
  return fail(code, statusFor(code), { why, docUrl: e.docUrl || null, requestId: r.requestId || null, ...extra });
}

const ok = (r: Call) => r.status >= 200 && r.status < 300;

export async function GET(req: Request) {
  const cfg = readConfig(process.env);
  const sp = new URL(req.url).searchParams;

  if (!sp.get("check") && !sp.get("video")) {
    return NextResponse.json({
      configured: Boolean(cfg),
      /** 중개사 본인 아바타·목소리를 정해 뒀는지. 없으면 HeyGen 이 고른다. */
      avatar: Boolean(cfg?.avatarId),
      voice: Boolean(cfg?.voiceId),
      orientations: ORIENTATIONS,
      promptMax: PROMPT_MAX,
    });
  }

  if (!cfg) return fail("NO_KEY", 503, { live: true });

  // 키가 살아 있는지 — 계정 조회는 크레딧을 쓰지 않는다
  if (sp.get("check") === "1") {
    const r = await call(cfg, "/v3/users/me");
    if (!ok(r)) return upstreamFail(r, { live: true });
    return NextResponse.json({ ok: true, live: true, account: parseAccount(r.payload) });
  }

  // 영상 상태 한 번
  const videoId = sp.get("video") ?? "";
  const sessionId = sp.get("session") ?? "";
  if (!isSafeId(videoId) || (sessionId && !isSafeId(sessionId))) {
    return NextResponse.json(
      { ok: false, code: "BAD_ID", message: "영상 번호 모양이 맞지 않습니다.", hint: "물건에 저장된 영상 번호를 확인하세요." },
      { status: 400 },
    );
  }

  const [v, sess] = await Promise.all([
    call(cfg, `/v3/videos/${videoId}`),
    sessionId ? call(cfg, `/v3/video-agents/${sessionId}`) : Promise.resolve(null),
  ]);
  if (!ok(v)) return upstreamFail(v);

  const video = parseVideo(v.payload);
  // 세션은 보조 정보다. 못 읽어도 영상 상태만으로 판단한다.
  const session = sess && ok(sess) ? parseSession(sess.payload) : null;
  const judgement = judge(video, session);

  return NextResponse.json({
    ok: true,
    video,
    session,
    judgement,
    ...(judgement.kind === "stop" ? HEYGEN_ERRORS[judgement.code] : {}),
  });
}

export async function POST(req: Request) {
  const cfg = readConfig(process.env);
  if (!cfg) return fail("NO_KEY", 503);

  let body: { propertyId?: unknown; prompt?: unknown; orientation?: unknown; attempt?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, code: "BAD_REQUEST", message: "요청 본문을 읽지 못했습니다.", hint: "" }, { status: 400 });
  }

  const propertyId = String(body.propertyId ?? "").trim();
  const prompt = String(body.prompt ?? "").trim();
  const orientation = String(body.orientation ?? "") as Orientation;
  const attempt = Number(body.attempt ?? 0);

  if (!propertyId || !prompt || !ORIENTATIONS.includes(orientation)) {
    return NextResponse.json(
      { ok: false, code: "BAD_REQUEST", message: "물건·대본·화면 방향이 필요합니다.", hint: "화면 방향은 세로(portrait) 또는 가로(landscape) 입니다." },
      { status: 400 },
    );
  }
  if (prompt.length > PROMPT_MAX) {
    return NextResponse.json(
      { ok: false, code: "TOO_LONG", message: `대본 요청이 너무 깁니다 (${prompt.length.toLocaleString()}자).`, hint: `HeyGen 은 ${PROMPT_MAX.toLocaleString()}자까지 받습니다. '강조할 점'을 줄여 주세요.` },
      { status: 400 },
    );
  }

  const payload: Record<string, unknown> = {
    prompt,
    orientation,
    // 한 번에 영상 하나. chat 모드는 AI 가 사람 대답을 기다리며 멈출 수 있다.
    mode: "generate",
    // 이 화면에서 보면 된다. HeyGen 워크스페이스 전체에 열어 둘 이유가 없다.
    visibility: "private",
    // 세션 기억을 끈다. 켜 두면 앞 물건의 가격·면적이 다음 물건 영상에 섞여 들 수 있다.
    incognito_mode: true,
    ...(cfg.avatarId ? { avatar_id: cfg.avatarId } : {}),
    ...(cfg.voiceId ? { voice_id: cfg.voiceId } : {}),
  };

  // 같은 요청이면 같은 키 — 응답이 늦어 다시 눌러도 영상·크레딧이 두 번 나가지 않는다
  const key = idempotencyKey(propertyId, payload, attempt);
  if (!IDEMPOTENCY_RE.test(key)) return fail("INVALID", 400, { why: "중복 방지 키를 만들지 못했습니다." });

  const r = await call(cfg, "/v3/video-agents", { method: "POST", body: payload, idempotencyKey: key });
  if (!ok(r)) return upstreamFail(r);

  const created = parseCreate(r.payload);
  if (!created.videoId) {
    // heygen-cli 도 이 경우를 오류로 둔다 — 번호 없이는 상태를 물을 수 없다
    return fail("NO_VIDEO_ID", 502, { sessionId: created.sessionId || null, why: created.status || null });
  }
  return NextResponse.json({ ok: true, ...created, idempotencyKey: key });
}
