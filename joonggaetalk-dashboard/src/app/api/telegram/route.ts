/**
 * 텔레그램 알림 — 봇 API 프록시.
 *
 * 봇 토큰은 서버에만 둔다. 토큰이 새면 남이 이 봇으로 아무 말이나 보낸다.
 *
 *   GET  ?               설정 여부만 (토큰을 쓰지 않는다)
 *   GET  ?chats=1        이 봇에게 말을 건 사람 목록 — TELEGRAM_CHAT_ID 를 찾을 때
 *   GET  ?check=1        실제로 한 통 보내 본다 (운영자가 누를 때만)
 *   POST                 알림 한 건 보내기
 */
import { NextResponse } from "next/server";
import {
  clamp,
  formatAlert,
  looksLikeToken,
  mapError,
  readChats,
  readConfig,
  readDescription,
  readOk,
  TELEGRAM_ERRORS,
  type Alert,
  type AlertKind,
  type TelegramConfig,
  type TelegramErrorCode,
} from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** 텔레그램 서버는 어디서 불러도 되지만, 다른 라우트와 맞춰 둔다. */
export const preferredRegion = "icn1";

const API = "https://api.telegram.org";
const TIMEOUT_MS = 10_000;

const KINDS: AlertKind[] = ["장애", "발송실패", "등기변동", "문의답변", "점검"];

function fail(code: TelegramErrorCode, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, code, ...TELEGRAM_ERRORS[code], ...extra }, { status });
}

/** 토큰은 주소에 들어간다. 어떤 경우에도 이 주소를 밖으로 내보내지 않는다. */
async function call(cfg: TelegramConfig, method: string, body?: Record<string, unknown>) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API}/bot${cfg.token}/${method}`, {
      method: body ? "POST" : "GET",
      signal: ctrl.signal,
      cache: "no-store",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await res.json().catch(() => null);
    return { status: res.status, payload };
  } catch {
    return { status: 0, payload: null };
  } finally {
    clearTimeout(timer);
  }
}

async function send(cfg: TelegramConfig, alert: Alert, now: string) {
  const { status, payload } = await call(cfg, "sendMessage", {
    chat_id: cfg.chatId,
    text: clamp(formatAlert(alert, now)),
    parse_mode: "HTML",
    // 주소를 붙여도 미리보기 카드를 만들지 않는다. 알림이 길어지면 잘 안 읽힌다.
    disable_web_page_preview: true,
  });
  if (status === 0) return { code: "UPSTREAM" as TelegramErrorCode };
  if (!readOk(payload)) return { code: mapError(status, readDescription(payload)), why: readDescription(payload) };
  return null;
}

function nowKo(): string {
  // 서버는 UTC 로 돈다. 보는 사람은 한국에 있다.
  return new Date(Date.now() + 9 * 3600_000).toISOString().replace("T", " ").slice(0, 16);
}

export async function GET(req: Request) {
  const cfg = readConfig(process.env);
  const sp = new URL(req.url).searchParams;

  if (!sp.get("chats") && !sp.get("check")) {
    return NextResponse.json({
      configured: Boolean(cfg),
      chat: Boolean(cfg?.chatId),
      /** 토큰 모양이 틀리면 부르기 전에 알 수 있다 */
      tokenLooksValid: cfg ? looksLikeToken(cfg.token) : false,
      kinds: KINDS,
    });
  }

  // 받을 사람 찾기 — chat_id 를 사람이 직접 뒤지지 않게
  if (sp.get("chats") === "1") {
    const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
    if (!token) return fail("NO_CONFIG", 503, { live: true });
    const { status, payload } = await call({ token, chatId: "" }, "getUpdates");
    if (status === 0) return fail("UPSTREAM", 502, { live: true });
    if (!readOk(payload)) return fail(mapError(status, readDescription(payload)), 400, { live: true });
    const chats = readChats(payload);
    return NextResponse.json({
      ok: true,
      live: true,
      chats,
      hint: chats.length
        ? "이 중 받을 사람의 id 를 TELEGRAM_CHAT_ID 에 넣으세요."
        : "아직 아무도 봇에게 말을 걸지 않았습니다. 텔레그램에서 봇을 찾아 /start 를 보낸 뒤 다시 확인하세요.",
    });
  }

  // 실제로 한 통 보내 본다. 설정됐다는 것과 도착한다는 것은 다르다.
  if (!cfg) return fail("NO_CONFIG", 503, { live: true });
  const err = await send(cfg, {
    kind: "점검",
    title: "연결 확인",
    lines: ["부동산TALK 에서 보낸 시험 메시지입니다.", "이 메시지가 보이면 알림이 정상으로 나갑니다."],
  }, nowKo());
  if (err) return fail(err.code, err.code === "UPSTREAM" ? 502 : 400, { live: true, why: err.why ?? null });
  return NextResponse.json({ ok: true, live: true, sent: true, chatId: cfg.chatId });
}

export async function POST(req: Request) {
  const cfg = readConfig(process.env);
  if (!cfg) return fail("NO_CONFIG", 503);

  let body: Partial<Alert>;
  try {
    body = await req.json();
  } catch {
    return fail("NO_CONFIG", 400);
  }

  const kind = String(body.kind ?? "") as AlertKind;
  const title = String(body.title ?? "").trim();
  if (!KINDS.includes(kind) || !title) {
    return NextResponse.json(
      { ok: false, code: "BAD_ALERT", message: "알림 종류와 제목이 필요합니다.", hint: `종류: ${KINDS.join(" · ")}` },
      { status: 400 },
    );
  }

  const err = await send(
    cfg,
    { kind, title, lines: Array.isArray(body.lines) ? body.lines.map(String) : [], url: body.url ? String(body.url) : undefined },
    nowKo(),
  );
  if (err) return fail(err.code, err.code === "UPSTREAM" ? 502 : 400, { why: err.why ?? null });
  return NextResponse.json({ ok: true, sent: true });
}
