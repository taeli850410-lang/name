/**
 * 건축물대장 조회 — 국토교통부 BldRgstHubService 프록시.
 *
 * 인증키는 서버에만 두고 브라우저로 내보내지 않는다.
 * GET  : 키가 설정돼 있는지만 알려 준다 (한도를 쓰지 않는다)
 * POST : 표제부(기본) · 층별개요(floors=true) 조회
 */
import { NextResponse } from "next/server";
import { BR_SAMPLE_TITLE } from "@/data/brSample";
import {
  buildKey,
  mapResultCode,
  normalizeDongs,
  normalizeFloors,
  normalizeServiceKey,
  readHeader,
  readTotalCount,
  unwrapItems,
  REGISTER_ERRORS,
  type RegisterErrorCode,
  type RegisterKey,
} from "@/lib/bldrgst";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = process.env.BLD_RGST_BASE || "https://apis.data.go.kr/1613000/BldRgstHubService";
const TIMEOUT_MS = 10_000;

function serviceKey(): string {
  return normalizeServiceKey(process.env.DATA_GO_KR_API_KEY || process.env.BUILDING_REGISTER_API_KEY || "");
}

function fail(code: RegisterErrorCode, status = 400) {
  return NextResponse.json({ ok: false, code, ...REGISTER_ERRORS[code] }, { status });
}

async function callOperation(op: string, key: RegisterKey, numOfRows: number): Promise<{ payload: unknown } | { code: RegisterErrorCode }> {
  const qs = new URLSearchParams({
    serviceKey: serviceKey(),
    sigunguCd: key.sigunguCd,
    bjdongCd: key.bjdongCd,
    platGbCd: key.platGbCd,
    bun: key.bun,
    ji: key.ji,
    numOfRows: String(numOfRows),
    pageNo: "1",
    _type: "json",
  });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${BASE}/${op}?${qs}`, { signal: ctrl.signal, cache: "no-store", headers: { Accept: "application/json" } });
  } catch {
    return { code: "UPSTREAM" };
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  // 인증키 오류는 _type=json 을 줘도 XML 로 돌아온다.
  if (!text.trim().startsWith("{")) {
    if (/SERVICE_KEY_IS_NOT_REGISTERED|SERVICE_ACCESS_DENIED/i.test(text)) return { code: "KEY_INVALID" };
    if (/LIMITED_NUMBER_OF_SERVICE_REQUESTS/i.test(text)) return { code: "QUOTA" };
    return { code: res.ok ? "BAD_RESPONSE" : "UPSTREAM" };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return { code: "BAD_RESPONSE" };
  }

  const mapped = mapResultCode(readHeader(payload).code);
  if (mapped) return { code: mapped };
  return { payload };
}

export async function GET(req: Request) {
  // ?demo=1 — 인증키 없이 화면을 확인할 때. 실제로 받아 둔 응답 한 건을 같은 정규화로 돌려준다.
  if (new URL(req.url).searchParams.get("demo") === "1") {
    return NextResponse.json({
      ok: true,
      demo: true,
      demoAddress: "인천광역시 부평구 십정동 630",
      key: { sigunguCd: "28237", bjdongCd: "10200", platGbCd: "0", bun: "0630", ji: "0000" },
      totalCount: readTotalCount(BR_SAMPLE_TITLE),
      truncated: true,
      dongs: normalizeDongs(unwrapItems(BR_SAMPLE_TITLE)),
    });
  }
  return NextResponse.json({ configured: Boolean(serviceKey()), base: BASE });
}

export async function POST(req: Request) {
  if (!serviceKey()) return fail("NO_KEY", 503);

  let body: {
    bcode?: string;
    sigunguCode?: string;
    jibunAddress?: string;
    key?: Partial<RegisterKey>;
    floors?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return fail("NO_BCODE");
  }

  // 조회 키: 직접 준 값이 있으면 그것을 쓰고, 없으면 우편번호 결과에서 만든다.
  let key: RegisterKey;
  const given = body.key;
  if (given?.sigunguCd && given.bjdongCd && given.bun) {
    key = {
      sigunguCd: String(given.sigunguCd).slice(0, 5),
      bjdongCd: String(given.bjdongCd).slice(-5),
      platGbCd: (given.platGbCd ?? "0") as RegisterKey["platGbCd"],
      bun: String(given.bun).padStart(4, "0").slice(-4),
      ji: String(given.ji ?? "0").padStart(4, "0").slice(-4),
    };
  } else {
    const built = buildKey({ bcode: body.bcode, sigunguCode: body.sigunguCode, jibunAddress: body.jibunAddress });
    if ("error" in built) return fail(built.error);
    key = built.key;
  }

  const op = body.floors ? "getBrFlrOulnInfo" : "getBrTitleInfo";
  const result = await callOperation(op, key, 100);
  if ("code" in result) return fail(result.code, result.code === "UPSTREAM" ? 502 : 400);

  const items = unwrapItems(result.payload);
  const totalCount = readTotalCount(result.payload);
  if (items.length === 0) return fail("NO_DATA", 404);

  return NextResponse.json({
    ok: true,
    key,
    totalCount,
    /** 100건을 넘으면 이 응답에는 앞의 100건만 들어 있다 */
    truncated: totalCount > items.length,
    ...(body.floors ? { floors: normalizeFloors(items) } : { dongs: normalizeDongs(items) }),
  });
}
