/**
 * 첨부 파일 — 저장소 프록시 (S3 호환: Cloudflare R2 · AWS S3 · Supabase Storage · MinIO).
 *
 * 파일은 서버를 지나가지 않는다. 서버리스 함수의 요청 본문이 4.5MB 로 막혀 있어
 * 계약서 스캔이 들어가지 않기 때문이다. 대신 이렇게 나눈다.
 *
 *   POST ?action=upload   올릴 자리와 서명된 주소를 내준다 (이름·크기·종류를 먼저 검사)
 *   POST ?action=confirm  올라간 파일 앞부분을 되읽어 내용이 이름과 맞는지 다시 본다
 *   GET  ?key=...         내려받기. 권한을 확인하고 짧게 사는 주소로 보낸다
 *   DELETE ?key=...       지우기
 *
 * confirm 이 있는 이유: 브라우저가 바로 올리므로 서버는 내용을 못 본다.
 * 검사를 브라우저에만 맡기면 검사를 건너뛴 요청이 그대로 통과한다.
 */
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { presign, readConfig, type S3Config } from "@/lib/s3sign";
import { FILE_KINDS, KIND_RULES, extMatches, extOf, safeName, sniff, storageKey, validateUpload, type FileKind } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** 올리는 사람도 저장소도 한국 쪽이다. */
export const preferredRegion = "icn1";

/** 올리는 주소는 오래 살 필요가 없다. 받는 주소는 더 짧게. */
const PUT_TTL = 10 * 60;
const GET_TTL = 2 * 60;

const ERRORS = {
  NO_STORE: {
    message: "파일 저장소가 설정되지 않았습니다.",
    hint: "S3_ENDPOINT · S3_BUCKET · S3_ACCESS_KEY_ID · S3_SECRET_ACCESS_KEY 를 환경 변수에 넣고 다시 배포하세요. Cloudflare R2 나 AWS S3 를 쓸 수 있습니다.",
  },
  BAD_KIND: { message: "파일 종류를 알 수 없습니다.", hint: `${FILE_KINDS.join(" · ")} 중에서 골라 주세요.` },
  REJECTED: { message: "올릴 수 없는 파일입니다.", hint: "" },
  NOT_FOUND: { message: "파일을 찾을 수 없습니다.", hint: "이미 지워졌거나 보존기간이 지나 파기되었을 수 있습니다." },
  UPSTREAM: { message: "저장소가 응답하지 않습니다.", hint: "잠시 뒤 다시 시도해 주세요." },
  CHECK_FAILED: { message: "저장소 점검에 실패했습니다.", hint: "" },
} as const;

function fail(code: keyof typeof ERRORS, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, code, ...ERRORS[code], ...extra }, { status });
}

/**
 * 이 사람이 이 파일을 볼 수 있는가.
 *
 * 프로토타입이라 세션이 없어 항상 통과시키지만, 자리는 여기다 —
 * 저장소 주소를 브라우저에 그대로 주지 않고 이 라우트를 거치게 한 이유가
 * 바로 여기에 권한 확인을 넣기 위해서다. 실제 서비스에서는
 * "이 계약이 이 중개사 것인가", "이 고객이 이 계약의 당사자인가"를 본다.
 */
function mayRead(_key: string): boolean {
  return true;
}

/**
 * 저장소가 진짜로 도는지 — 작은 파일 하나를 올렸다, 되읽고, 지운다.
 *
 * "설정됨"은 환경 변수에 글자가 있다는 뜻일 뿐이다. 열쇠가 틀렸는지,
 * 버킷 이름이 다른지, 권한이 읽기 전용인지는 실제로 해 봐야 안다.
 *
 * CORS 까지 여기서 본다. 파일은 브라우저에서 저장소로 바로 가므로
 * CORS 가 없으면 서버는 멀쩡한데 화면에서만 조용히 실패한다.
 * 브라우저가 보내는 것과 똑같은 예비 요청(preflight)을 그대로 보내 확인한다.
 */
async function selfCheck(cfg: S3Config, req: Request) {
  const origin = `https://${req.headers.get("host") || new URL(req.url).host}`;
  // 점검용 파일은 계약·물건과 섞이지 않게 따로 둔다. 어차피 바로 지운다.
  const key = `_점검/${randomBytes(8).toString("base64url")}.txt`;
  const body = `budongsan-talk storage check ${new Date().toISOString()}`;

  const steps: Record<string, boolean> = {};
  const detail: Record<string, string> = {};

  // 1. 올리기
  let uploaded = false;
  try {
    const put = await fetch(presign(cfg, "PUT", key, 60), { method: "PUT", body });
    uploaded = put.ok;
    if (!put.ok) detail["올리기"] = `저장소가 HTTP ${put.status} 로 거절했습니다.`;
  } catch {
    detail["올리기"] = "저장소에 닿지 못했습니다.";
  }
  steps["올리기"] = uploaded;

  // 2. 되읽기 — 올린 내용이 그대로 돌아오는가
  let readBack = false;
  if (uploaded) {
    try {
      const got = await fetch(presign(cfg, "GET", key, 60), { cache: "no-store" });
      if (got.ok) {
        readBack = (await got.text()) === body;
        if (!readBack) detail["되읽기"] = "올린 내용과 다른 것이 돌아왔습니다.";
      } else {
        detail["되읽기"] = `저장소가 HTTP ${got.status} 로 답했습니다.`;
      }
    } catch {
      detail["되읽기"] = "저장소에 닿지 못했습니다.";
    }
  }
  steps["되읽기"] = readBack;

  // 3. 브라우저에서 올리기 (CORS) — 올리기가 실패해도 따로 본다
  let cors = false;
  try {
    const pre = await fetch(presign(cfg, "PUT", key, 60), {
      method: "OPTIONS",
      headers: { Origin: origin, "Access-Control-Request-Method": "PUT" },
    });
    const allow = (pre.headers.get("access-control-allow-origin") || "").trim();
    cors = allow === "*" || allow === origin;
    if (!cors) {
      detail["브라우저에서 올리기"] = allow
        ? `허용된 주소가 다릅니다 — 저장소는 "${allow}" 만 받습니다.`
        : "버킷에 CORS 설정이 없습니다. 서버에서는 되지만 화면에서 올리면 실패합니다.";
    }
  } catch {
    detail["브라우저에서 올리기"] = "예비 요청(preflight)에 실패했습니다.";
  }
  steps["브라우저에서 올리기"] = cors;

  // 4. 지우기 — 점검 파일을 남겨 두지 않는다
  let removed = false;
  if (uploaded) {
    try {
      const del = await fetch(presign(cfg, "DELETE", key, 60), { method: "DELETE" });
      removed = del.ok || del.status === 204 || del.status === 404;
      if (!removed) detail["지우기"] = `저장소가 HTTP ${del.status} 로 거절했습니다. 쓰기 권한을 확인하세요.`;
    } catch {
      detail["지우기"] = "저장소에 닿지 못했습니다.";
    }
  }
  steps["지우기"] = removed;

  const failed = Object.keys(steps).filter((k) => !steps[k]);
  const bucket = cfg.bucket;
  const host = new URL(cfg.endpoint).host;

  if (failed.length === 0) {
    return NextResponse.json({ ok: true, live: true, bucket, endpoint: host, steps });
  }
  return NextResponse.json(
    {
      ok: false,
      live: true,
      code: "CHECK_FAILED",
      message: `${failed.join(" · ")} 에서 막혔습니다.`,
      hint: detail[failed[0]] ?? "",
      bucket,
      endpoint: host,
      steps,
      detail,
    },
    { status: 502 },
  );
}

export async function GET(req: Request) {
  const cfg = readConfig(process.env);
  const url = new URL(req.url);
  const key = url.searchParams.get("key");

  // 실제로 올렸다 지워 본다. 운영자가 누를 때만 돈다.
  if (url.searchParams.get("check") === "1") {
    if (!cfg) return fail("NO_STORE", 503, { live: true });
    return selfCheck(cfg, req);
  }

  if (!key) {
    return NextResponse.json({
      configured: Boolean(cfg),
      bucket: cfg?.bucket ?? null,
      endpoint: cfg ? new URL(cfg.endpoint).host : null,
      kinds: FILE_KINDS.map((k) => ({ kind: k, ...KIND_RULES[k] })),
    });
  }

  if (!cfg) return fail("NO_STORE", 503);
  if (!mayRead(key)) return fail("NOT_FOUND", 404);

  // 저장소 주소를 그대로 알려 주지 않는다. 2분 뒤 죽는 주소로 보낸다.
  const signed = presign(cfg, "GET", key, GET_TTL);
  return NextResponse.redirect(signed, { status: 302, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const cfg = readConfig(process.env);
  if (!cfg) return fail("NO_STORE", 503);

  const action = new URL(req.url).searchParams.get("action") ?? "upload";
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("BAD_KIND", 400);
  }

  if (action === "upload") {
    const kind = String(body.kind ?? "") as FileKind;
    if (!FILE_KINDS.includes(kind)) return fail("BAD_KIND", 400);

    const name = safeName(String(body.name ?? ""));
    const size = Number(body.size ?? 0);
    // 이름·크기까지는 여기서 본다. 내용은 올라간 뒤 confirm 에서 다시 본다.
    const v = validateUpload(name, size, kind);
    if (!v.ok) return fail("REJECTED", 400, { why: v.why, reason: v.code });

    const scope = String(body.scope ?? "misc");
    const ownerId = String(body.ownerId ?? "unknown");
    const key = storageKey(scope, ownerId, randomBytes(12).toString("base64url"), name);

    return NextResponse.json({
      ok: true,
      key,
      name,
      kind,
      uploadUrl: presign(cfg, "PUT", key, PUT_TTL),
      expiresIn: PUT_TTL,
    });
  }

  if (action === "confirm") {
    const key = String(body.key ?? "");
    const kind = String(body.kind ?? "") as FileKind;
    if (!key || !FILE_KINDS.includes(kind)) return fail("BAD_KIND", 400);

    // 앞부분 몇 바이트만 되읽어 실제 형식을 본다
    let head: Uint8Array;
    try {
      const res = await fetch(presign(cfg, "GET", key, GET_TTL), { headers: { Range: "bytes=0-15" }, cache: "no-store" });
      if (res.status === 404) return fail("NOT_FOUND", 404);
      if (!res.ok && res.status !== 206) return fail("UPSTREAM", 502);
      head = new Uint8Array(await res.arrayBuffer());
    } catch {
      return fail("UPSTREAM", 502);
    }

    const ext = extOf(key);
    const got = sniff(head);
    if (!extMatches(ext, got)) {
      // 내용이 이름과 다르면 바로 치운다. 남겨 두면 그게 그대로 저장소에 있는 셈이다.
      try {
        await fetch(presign(cfg, "DELETE", key, 60), { method: "DELETE" });
      } catch {
        /* 지우기에 실패해도 통과시키지는 않는다 */
      }
      return fail("REJECTED", 400, {
        why: got
          ? `이름은 .${ext} 인데 실제 내용은 ${got.toUpperCase()} 입니다. 올린 파일을 지웠습니다.`
          : "내용을 알 수 없는 파일이라 지웠습니다. PDF 나 이미지로 다시 저장해 올려 주세요.",
        reason: got ? "CONTENT" : "UNKNOWN_TYPE",
      });
    }

    return NextResponse.json({ ok: true, key, kind, verified: got });
  }

  return fail("BAD_KIND", 400);
}

export async function DELETE(req: Request) {
  const cfg = readConfig(process.env);
  if (!cfg) return fail("NO_STORE", 503);
  const key = new URL(req.url).searchParams.get("key");
  if (!key) return fail("NOT_FOUND", 404);
  if (!mayRead(key)) return fail("NOT_FOUND", 404);

  try {
    const res = await fetch(presign(cfg, "DELETE", key, 60), { method: "DELETE" });
    if (!res.ok && res.status !== 204 && res.status !== 404) return fail("UPSTREAM", 502);
  } catch {
    return fail("UPSTREAM", 502);
  }
  return NextResponse.json({ ok: true, key });
}
