/**
 * VWorld (국토교통부 공간정보 오픈플랫폼) — 주소·좌표·필지.
 *
 * 여기서 하는 일은 "그게 어디인가" 까지다. 시세·거래는 실거래가 API,
 * 건물 정보는 건축물대장이 답한다. 다만 이 조회가 내는 PNU 와 법정동코드가
 * 그 두 조회의 출발점이 된다 — 도로명주소밖에 없을 때 특히 그렇다.
 *
 * 의존성 없는 순수 함수만 둔다. 필드 이름은 2026-09 실제 응답에서 확인했다.
 */

import type { PlatGb, RegisterKey } from "./bldrgst";

/* ------------------------------------------------------------------- 타입 */

export type Point = { lon: number; lat: number };

export type GeocodeHit = {
  /** 지번으로 찾았는지 도로명으로 찾았는지 */
  type: "parcel" | "road";
  point: Point;
  /** 정제된 전체 주소 */
  address: string;
  /** 19자리 필지 식별자. 도로명으로 찾으면 없다. */
  pnu: string | null;
  /** 법정동코드 10자리. 도로명으로 찾으면 없다. */
  bjdCode: string | null;
  /** 건축물대장·실거래가 조회 키. PNU 가 있을 때만 만들어진다. */
  registerKey: RegisterKey | null;
  sido: string;
  sigungu: string;
  /** 법정동 (도로명이면 도로명이 들어온다) */
  dong: string;
  /** 지번 또는 건물번호 */
  number: string;
  detail: string;
};

export type Parcel = {
  pnu: string;
  /** 지번 표기 ("630") */
  jibun: string;
  /** 지목 ("대", "전", "답", "임야" …) */
  jimok: string;
  address: string;
  /** 개별공시지가 — 원/㎡ 와 기준연월. 없으면 null */
  landPrice: { wonPerSqm: number; asOf: string } | null;
  registerKey: RegisterKey | null;
};

export type Zoning = {
  /** 용도지역 이름 ("준주거지역", "제1종일반주거지역" …) */
  name: string;
  /** 결정 연도 */
  year: string;
};

export type VworldSnapshot = {
  fetchedAt: string;
  demo?: boolean;
  point: Point;
  address: string;
  pnu: string | null;
  parcel: Parcel | null;
  zoning: Zoning | null;
};

/* --------------------------------------------------------------------- PNU */

/**
 * PNU 19자리 = 법정동코드(10) + 필지구분(1) + 본번(4) + 부번(4).
 *
 * 필지구분 숫자와 건축물대장의 대지구분 코드는 값이 다르다.
 *   PNU 1(일반) → platGbCd 0(대지)
 *   PNU 2(산)   → platGbCd 1(산)
 * 실제 응답에서 확인한 규칙이다. 그대로 넘기면 산 번지가 조회되지 않는다.
 */
export function pnuToRegisterKey(pnu: string): RegisterKey | null {
  const d = String(pnu ?? "").replace(/\D/g, "");
  if (d.length !== 19) return null;
  const platGbCd: PlatGb = d[10] === "2" ? "1" : "0";
  return {
    sigunguCd: d.slice(0, 5),
    bjdongCd: d.slice(5, 10),
    platGbCd,
    bun: d.slice(11, 15),
    ji: d.slice(15, 19),
  };
}

/** PNU 에서 읽은 사람이 보는 지번. "630" 또는 "산 12-4" */
export function pnuToJibunText(pnu: string): string {
  const d = String(pnu ?? "").replace(/\D/g, "");
  if (d.length !== 19) return "";
  const mountain = d[10] === "2";
  const bun = Number(d.slice(11, 15));
  const ji = Number(d.slice(15, 19));
  return `${mountain ? "산 " : ""}${bun}${ji ? `-${ji}` : ""}`;
}

/* -------------------------------------------------------------- 응답 읽기 */

function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function str(v: unknown): string {
  const s = String(v ?? "").trim();
  return s === "-" ? "" : s;
}

type GeoResponse = {
  response?: {
    status?: string;
    error?: { text?: string; code?: string };
    refined?: { text?: string; structure?: Record<string, string> };
    result?: { point?: { x?: string | number; y?: string | number } };
  };
};

export function readGeoStatus(payload: unknown): string {
  return str((payload as GeoResponse)?.response?.status).toUpperCase();
}

/** 지오코더 응답 → 좌표·PNU·조회 키. 좌표가 없으면 null. */
export function parseGeocode(payload: unknown, type: "parcel" | "road"): GeocodeHit | null {
  const r = (payload as GeoResponse)?.response;
  const p = r?.result?.point;
  const lon = num(p?.x);
  const lat = num(p?.y);
  if (!lon || !lat) return null;

  const s = r?.refined?.structure ?? {};
  // 지번으로 찾으면 level4LC 에 PNU 19자리가 들어온다. 도로명은 비어 있다.
  const raw = str(s.level4LC);
  const pnu = raw.length === 19 ? raw : null;

  return {
    type,
    point: { lon, lat },
    address: str(r?.refined?.text),
    pnu,
    bjdCode: pnu ? pnu.slice(0, 10) : null,
    registerKey: pnu ? pnuToRegisterKey(pnu) : null,
    sido: str(s.level1),
    sigungu: str(s.level2),
    dong: str(s.level4L),
    number: str(s.level5),
    detail: str(s.detail),
  };
}

type DataResponse = {
  response?: {
    status?: string;
    error?: { text?: string };
    result?: { featureCollection?: { features?: { properties?: Record<string, unknown> }[] } };
  };
};

export function readDataStatus(payload: unknown): string {
  return str((payload as DataResponse)?.response?.status).toUpperCase();
}

export function readFeatures(payload: unknown): Record<string, unknown>[] {
  const f = (payload as DataResponse)?.response?.result?.featureCollection?.features;
  if (!Array.isArray(f)) return [];
  return f.map((x) => x?.properties ?? {});
}

/**
 * 연속지적도(LP_PA_CBND_BUBUN) 속성 → 필지.
 * 이 레이어에는 면적이 없다. 면적을 아는 척하지 않는다.
 */
export function parseParcel(props: Record<string, unknown>): Parcel | null {
  const pnu = str(props.pnu);
  if (!pnu) return null;
  // jibun 은 "630 대" 처럼 지번과 지목이 붙어 온다
  const jibunRaw = str(props.jibun);
  const parts = jibunRaw.split(/\s+/).filter(Boolean);
  const jimok = parts.length > 1 ? parts[parts.length - 1] : "";
  const jibun = parts.length > 1 ? parts.slice(0, -1).join(" ") : jibunRaw;
  const jiga = num(props.jiga);
  const year = str(props.gosi_year);
  const month = str(props.gosi_month);
  return {
    pnu,
    jibun,
    jimok,
    address: str(props.addr),
    landPrice: jiga ? { wonPerSqm: jiga, asOf: year ? `${year}.${month || "01"}` : "" } : null,
    registerKey: pnuToRegisterKey(pnu),
  };
}

/** 용도지역(LT_C_UQ111) 속성 → 용도지역. */
export function parseZoning(props: Record<string, unknown>): Zoning | null {
  const name = str(props.uname);
  if (!name) return null;
  return { name, year: str(props.dyear) };
}

/** 개별공시지가 × 면적 = 공시지가 기준 토지가액(원). 둘 중 하나라도 없으면 null. */
export function landValue(landPrice: Parcel["landPrice"], areaM2?: number): number | null {
  if (!landPrice?.wonPerSqm || !areaM2) return null;
  return Math.round(landPrice.wonPerSqm * areaM2);
}

/* ------------------------------------------------------------- 오류 메시지 */

export type VworldErrorCode = "NO_KEY" | "NOT_FOUND" | "KEY_INVALID" | "DOMAIN" | "QUOTA" | "UPSTREAM" | "BAD_RESPONSE";

export const VWORLD_ERRORS: Record<VworldErrorCode, { message: string; hint: string }> = {
  NO_KEY: {
    message: "VWorld 인증키가 설정되지 않았습니다.",
    hint: "vworld.kr 에서 오픈API 인증키를 발급받아 환경 변수 VWORLD_API_KEY 에 넣고 다시 배포하세요. 발급은 당일에 됩니다.",
  },
  NOT_FOUND: {
    message: "이 주소를 찾지 못했습니다.",
    hint: "시·도부터 포함한 전체 주소인지 확인해 주세요. 신축이라 아직 주소가 부여되지 않았을 수도 있습니다.",
  },
  KEY_INVALID: {
    message: "VWorld 인증키가 유효하지 않습니다.",
    hint: "키를 다시 확인하고, vworld.kr 마이페이지에서 키가 '승인' 상태인지 보세요.",
  },
  DOMAIN: {
    message: "이 도메인에서는 VWorld 키를 쓸 수 없습니다.",
    hint: "VWorld 키는 발급할 때 등록한 서비스 URL 에서만 동작합니다. vworld.kr 마이페이지에서 배포 도메인을 추가하거나, 환경 변수 VWORLD_REFERER 에 등록된 주소를 넣어 주세요.",
  },
  QUOTA: {
    message: "VWorld 일일 호출 한도를 넘었습니다.",
    hint: "내일 자정에 초기화됩니다. 자주 쓰는 주소는 조회 결과를 물건에 저장해 두면 다시 부르지 않습니다.",
  },
  UPSTREAM: { message: "VWorld 서버가 응답하지 않습니다.", hint: "잠시 뒤 다시 시도해 주세요." },
  BAD_RESPONSE: { message: "VWorld 가 예상과 다른 응답을 보냈습니다.", hint: "잠시 뒤 다시 시도해 주세요. 반복되면 운영자에게 알려 주세요." },
};

/** VWorld status / error 문구 → 우리 오류 코드. 정상이면 null. */
export function mapVworldStatus(status: string, errorText = ""): VworldErrorCode | null {
  const s = String(status ?? "").toUpperCase();
  if (s === "OK") return null;
  if (s === "NOT_FOUND") return "NOT_FOUND";
  const t = String(errorText ?? "");
  if (/도메인|domain|referer/i.test(t)) return "DOMAIN";
  if (/인증키|apikey|key/i.test(t)) return "KEY_INVALID";
  if (/초과|한도|limit|quota/i.test(t)) return "QUOTA";
  return "UPSTREAM";
}

export function readGeoError(payload: unknown): string {
  return str((payload as GeoResponse)?.response?.error?.text);
}
export function readDataError(payload: unknown): string {
  return str((payload as DataResponse)?.response?.error?.text);
}

/** 주소 모양으로 지번/도로명을 고른다. 도로명 키워드가 있으면 road. */
export function guessAddressType(address: string): "parcel" | "road" {
  const a = String(address ?? "");
  if (/(로|길)\s*\d/.test(a)) return "road";
  return "parcel";
}
