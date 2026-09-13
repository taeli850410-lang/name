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

/** VWorld 키는 발급 시 등록한 서비스 URL 에서만 동작한다. 서버에서 부를 땐 Referer 로 맞춘다. */
function headers(): Record<string, string> {
  const ref = (process.env.VWORLD_REFERER || "").trim();
  return ref ? { Referer: ref, Accept: "application/json" } : { Accept: "application/json" };
}

function fail(code: VworldErrorCode, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, code, ...VWORLD_ERRORS[code], ...extra }, { status });
}

async function getJson(url: string): Promise<{ payload: unknown } | { code: VworldErrorCode }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, { signal: ctrl.signal, cache: "no-store", headers: headers() });
  } catch {
    return { code: "UPSTREAM" };
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  if (!text.trim().startsWith("{")) return { code: res.ok ? "BAD_RESPONSE" : "UPSTREAM" };
  try {
    return { payload: JSON.parse(text) };
  } catch {
    return { code: "BAD_RESPONSE" };
  }
}

async function geocode(address: string, type: "parcel" | "road"): Promise<{ hit: GeocodeHit } | { code: VworldErrorCode }> {
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
  const r = await getJson(`${GEO}?${qs}`);
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
    const r = await geocode(CHECK_ADDRESS, "parcel");
    if ("code" in r) {
      return fail(r.code, r.code === "UPSTREAM" ? 502 : 400, { live: true, address: CHECK_ADDRESS });
    }
    return NextResponse.json({
      ok: true,
      live: true,
      address: CHECK_ADDRESS,
      pnu: r.hit.pnu ?? null,
      point: r.hit.point,
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
