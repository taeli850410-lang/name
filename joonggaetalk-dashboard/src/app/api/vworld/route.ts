/**
 * 주소 → 좌표·필지 — VWorld 오픈API 프록시.
 *
 * 인증키는 서버에만 두고 브라우저로 내보내지 않는다.
 * GET  : 키 설정 여부 · ?demo=1 예시 응답 · ?check=1 실제 호출 한 번
 * POST : 지오코딩 + 연속지적도(지목·공시지가) + 용도지역
 *
 * 도로명주소만 있어도 좌표로 필지를 되짚어 지번과 PNU, 그리고
 * 건축물대장 조회 키까지 얻는다.
 */
import { NextResponse } from "next/server";
import { VW_SAMPLE_GEOCODE_PARCEL, VW_SAMPLE_PARCEL, VW_SAMPLE_ZONING } from "@/data/vworldSample";
import {
  guessAddressType,
  mapVworldStatus,
  parseGeocode,
  parseParcel,
  parseZoning,
  readDataError,
  readDataStatus,
  readFeatures,
  readGeoError,
  readGeoStatus,
  VWORLD_ERRORS,
  type GeocodeHit,
  type VworldErrorCode,
} from "@/lib/vworld";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/**
 * 서울에서 부른다. VWorld 는 미국 리전(iad1)에서 부르면 게이트웨이가 502 를 주거나
 * 연결을 끊는다 — 키·Referer 와 무관하게 요청 자체가 거절된다. 같은 주소를 서울
 * 리전에서 부르면 정상 응답한다. 부르는 상대가 전부 한국 서버라 다른 라우트도 같다.
 */
export const preferredRegion = "icn1";

const GEO = "https://api.vworld.kr/req/address";
const DATA = "https://api.vworld.kr/req/data";
const TIMEOUT_MS = 10_000;
const LAYER_PARCEL = "LP_PA_CBND_BUBUN"; // 연속지적도
const LAYER_ZONING = "LT_C_UQ111"; // 용도지역 (국토계획법)

/** ?check=1 이 실제로 조회해 보는 주소. 오래전부터 있는 지번이라 없어질 일이 없다. */
const CHECK_ADDRESS = "인천광역시 부평구 십정동 630";

function apiKey(): string {
  return (process.env.VWORLD_API_KEY || process.env.VWORLD_KEY || "").trim();
}

/**
 * VWorld 키는 발급 시 등록한 서비스 URL 에서만 동작한다. 서버에서 부를 땐 Referer 로 맞춘다.
 *
 * User-Agent 를 직접 넣는 이유: Node 의 fetch(undici)는 User-Agent 를 아예 보내지
 * 않는다. 공공기관 앞단의 보안장비는 이런 요청을 응답 없이 연결만 끊는 경우가 있고,
 * 그러면 우리 쪽에는 "소켓이 닫혔다"로만 보여 원인을 알 수 없다.
 * 어차피 부르는 쪽을 밝히는 게 맞다.
 */
function headers(withReferer = true): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "budongsan-talk/1.0 (+https://joonggaetalk-dashboard.vercel.app)",
    "Accept-Language": "ko-KR,ko;q=0.9",
  };
  const ref = referer();
  if (withReferer && ref) h.Referer = ref;
  return h;
}

function referer(): string {
  return (process.env.VWORLD_REFERER || "").trim();
}

function fail(code: VworldErrorCode, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, code, ...VWORLD_ERRORS[code], ...extra }, { status });
}

/**
 * 실패했을 때 무엇 때문인지. ?check=1 에서만 밖으로 내보낸다.
 * 인증키가 들어 있는 요청 주소는 절대 넣지 않는다.
 */
export type UpstreamDetail = { error?: string; status?: number; snippet?: string; ms?: number };

async function getJson(url: string, withReferer = true): Promise<{ payload: unknown } | { code: VworldErrorCode; detail?: UpstreamDetail }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(url, { signal: ctrl.signal, cache: "no-store", headers: headers(withReferer) });
  } catch (e) {
    const err = e as { name?: string; message?: string; cause?: { code?: string } };
    return {
      code: "UPSTREAM",
      detail: {
        // 10초를 넘겨 우리가 끊은 것인지, 아예 닿지 못한 것인지 구분한다
        error: err?.name === "AbortError" ? "TIMEOUT" : (err?.cause?.code || err?.name || "FETCH_FAILED"),
        ms: Date.now() - started,
      },
    };
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  if (!text.trim().startsWith("{")) {
    return {
      code: res.ok ? "BAD_RESPONSE" : "UPSTREAM",
      detail: { status: res.status, snippet: redact(text.slice(0, 200)), ms: Date.now() - started },
    };
  }
  try {
    return { payload: JSON.parse(text) };
  } catch {
    return { code: "BAD_RESPONSE", detail: { status: res.status, snippet: redact(text.slice(0, 200)) } };
  }
}

/** 혹시라도 응답이 인증키를 되비추면 지운다. */
function redact(text: string): string {
  const k = apiKey();
  return k ? text.split(k).join("***") : text;
}

async function geocode(address: string, type: "parcel" | "road", withReferer = true): Promise<{ hit: GeocodeHit } | { code: VworldErrorCode; detail?: UpstreamDetail }> {
  const qs = new URLSearchParams({
    service: "address",
    request: "getcoord",
    version: "2.0",
    crs: "epsg:4326",
    type: type === "road" ? "ROAD" : "PARCEL",
    address,
    refine: "true",
    simple: "false",
    format: "json",
    key: apiKey(),
  });
  const r = await getJson(`${GEO}?${qs}`, withReferer);
  if ("code" in r) return r;
  const mapped = mapVworldStatus(readGeoStatus(r.payload), readGeoError(r.payload));
  if (mapped) return { code: mapped };
  const hit = parseGeocode(r.payload, type);
  return hit ? { hit } : { code: "NOT_FOUND" };
}

/** 좌표가 올라앉은 레이어의 속성 한 건. 실패해도 조회 전체를 막지 않는다. */
async function featureAt(layer: string, lon: number, lat: number): Promise<Record<string, unknown> | null> {
  const qs = new URLSearchParams({
    service: "data",
    request: "GetFeature",
    data: layer,
    key: apiKey(),
    format: "json",
    crs: "EPSG:4326",
    geomFilter: `POINT(${lon} ${lat})`,
    geometry: "false",
    size: "1",
    page: "1",
  });
  const r = await getJson(`${DATA}?${qs}`);
  if ("code" in r) return null;
  if (mapVworldStatus(readDataStatus(r.payload), readDataError(r.payload))) return null;
  return readFeatures(r.payload)[0] ?? null;
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  if (sp.get("demo") === "1") {
    const hit = parseGeocode(VW_SAMPLE_GEOCODE_PARCEL, "parcel")!;
    return NextResponse.json({
      ok: true,
      demo: true,
      demoAddress: "인천광역시 부평구 십정동 630",
      ...hit,
      parcel: parseParcel(readFeatures(VW_SAMPLE_PARCEL)[0]),
      zoning: parseZoning(readFeatures(VW_SAMPLE_ZONING)[0]),
    });
  }
  // 키가 있다는 것과 키가 먹힌다는 것은 다르다. 도메인을 등록하지 않은 키는
  // 환경 변수에 멀쩡히 들어 있어도 VWorld 가 거절한다. 설정 여부만 보고
  // "정상"이라고 하면 모니터가 또 거짓말을 하게 된다 — 그래서 한 번 불러 본다.
  // 호출 한도를 쓰므로 화면을 열 때가 아니라 운영자가 누를 때만 돈다.
  if (sp.get("check") === "1") {
    if (!apiKey()) return fail("NO_KEY", 503, { live: true });
    const ref = referer();
    const r = await geocode(CHECK_ADDRESS, "parcel");
    if (!("code" in r)) {
      return NextResponse.json({ ok: true, live: true, address: CHECK_ADDRESS, referer: ref || null, pnu: r.hit.pnu ?? null, point: r.hit.point });
    }

    // 실패했으면 Referer 를 빼고 한 번 더. 이것만으로 되면 원인은 키도
    // 네트워크도 아니라 VWORLD_REFERER 값이다 — 운영자가 고칠 수 있는 것이다.
    let withoutReferer: string | null = null;
    if (ref) {
      const retry = await geocode(CHECK_ADDRESS, "parcel", false);
      withoutReferer = "code" in retry ? `실패 (${retry.code})` : "성공";
    }

    // 운영자만 보는 확인이라 실패 원인을 그대로 붙인다. "잠시 뒤 다시"만
    // 보여 주면 도메인 문제인지 시간 초과인지 영영 알 수 없다.
    return fail(r.code, r.code === "UPSTREAM" ? 502 : 400, {
      live: true,
      address: CHECK_ADDRESS,
      referer: ref || null,
      withoutReferer,
      detail: r.detail ?? null,
    });
  }

  return NextResponse.json({ configured: Boolean(apiKey()), referer: Boolean(process.env.VWORLD_REFERER) });
}

export async function POST(req: Request) {
  if (!apiKey()) return fail("NO_KEY", 503);

  let body: { address?: string; type?: "parcel" | "road" | "auto" };
  try {
    body = await req.json();
  } catch {
    return fail("NOT_FOUND");
  }
  const address = String(body.address ?? "").trim();
  if (!address) return fail("NOT_FOUND");

  // 주소 모양으로 먼저 시도하고, 못 찾으면 반대쪽으로 한 번 더.
  const first = body.type && body.type !== "auto" ? body.type : guessAddressType(address);
  let r = await geocode(address, first);
  let fellBack = false;
  if ("code" in r && r.code === "NOT_FOUND") {
    const second = first === "parcel" ? "road" : "parcel";
    const retry = await geocode(address, second);
    if (!("code" in retry)) {
      r = retry;
      fellBack = true;
    }
  }
  if ("code" in r) return fail(r.code, r.code === "UPSTREAM" ? 502 : r.code === "NOT_FOUND" ? 404 : 400);

  const hit = r.hit;
  const [parcelProps, zoningProps] = await Promise.all([
    featureAt(LAYER_PARCEL, hit.point.lon, hit.point.lat),
    featureAt(LAYER_ZONING, hit.point.lon, hit.point.lat),
  ]);
  const parcel = parcelProps ? parseParcel(parcelProps) : null;

  return NextResponse.json({
    ok: true,
    fellBack,
    ...hit,
    // 도로명으로 찾았으면 지오코더에는 PNU 가 없다. 좌표로 되짚은 필지가 그 자리를 채운다.
    pnu: hit.pnu ?? parcel?.pnu ?? null,
    bjdCode: hit.bjdCode ?? (parcel?.pnu ? parcel.pnu.slice(0, 10) : null),
    registerKey: hit.registerKey ?? parcel?.registerKey ?? null,
    parcel,
    zoning: zoningProps ? parseZoning(zoningProps) : null,
  });
}
