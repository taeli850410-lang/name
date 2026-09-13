/**
 * 국토교통부 건축물대장 (BldRgstHubService) — 응답 정규화와 조회 키 계산.
 *
 * 이 파일은 의존성이 없는 순수 함수만 둔다. 서버 라우트와 테스트가 같이 쓴다.
 * 필드 이름은 2026-09 실제 응답에서 확인한 것이다 (test/fixtures/br-title.json 참고).
 */

/* ------------------------------------------------------------------ 조회 키 */

export type PlatGb = "0" | "1" | "2"; // 0 대지 · 1 산 · 2 블록

export type RegisterKey = {
  sigunguCd: string; // 5자리
  bjdongCd: string; // 5자리
  platGbCd: PlatGb;
  bun: string; // 4자리
  ji: string; // 4자리
};

export function pad4(v: string | number): string {
  return String(v).replace(/\D/g, "").padStart(4, "0").slice(-4);
}

/**
 * 법정동코드 10자리를 시군구(앞 5) + 법정동(뒤 5)으로 쪼갠다.
 * 다음 우편번호 서비스의 bcode 가 이 10자리다.
 */
export function splitBcode(bcode: string): { sigunguCd: string; bjdongCd: string } | null {
  const d = String(bcode).replace(/\D/g, "");
  if (d.length !== 10) return null;
  return { sigunguCd: d.slice(0, 5), bjdongCd: d.slice(5) };
}

/**
 * 지번주소에서 번·지와 대지구분을 읽는다.
 * "인천 부평구 십정동 630-1" → { bun:"0630", ji:"0001", platGbCd:"0" }
 * "인천 부평구 산곡동 산 12-4" → { bun:"0012", ji:"0004", platGbCd:"1" }
 * 뒤에서부터 처음 나오는 숫자 토큰을 쓴다. 건물명이 붙어 있어도 건너뛴다.
 */
export function parseJibun(jibunAddress: string): { bun: string; ji: string; platGbCd: PlatGb } | null {
  const cleaned = String(jibunAddress || "").replace(/번지/g, " ").trim();
  if (!cleaned) return null;
  const tokens = cleaned.split(/\s+/);
  for (let i = tokens.length - 1; i >= 0; i--) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(tokens[i]);
    if (!m) continue;
    const prev = tokens[i - 1] ?? "";
    const platGbCd: PlatGb = prev === "산" ? "1" : prev === "블록" ? "2" : "0";
    return { bun: pad4(m[1]), ji: pad4(m[2] ?? "0"), platGbCd };
  }
  return null;
}

/** 다음 우편번호 결과 → 대장 조회 키. 실패하면 어떤 값이 모자란지 알려 준다. */
export function buildKey(input: { bcode?: string; sigunguCode?: string; jibunAddress?: string }): { key: RegisterKey } | { error: "NO_BCODE" | "NO_JIBUN" } {
  const split = input.bcode ? splitBcode(input.bcode) : null;
  const sigunguCd = split?.sigunguCd ?? (input.sigunguCode ? String(input.sigunguCode).replace(/\D/g, "").slice(0, 5) : "");
  const bjdongCd = split?.bjdongCd ?? "";
  if (!sigunguCd || !bjdongCd) return { error: "NO_BCODE" };
  const jibun = parseJibun(input.jibunAddress ?? "");
  if (!jibun) return { error: "NO_JIBUN" };
  return { key: { sigunguCd, bjdongCd, platGbCd: jibun.platGbCd, bun: jibun.bun, ji: jibun.ji } };
}

/* ------------------------------------------------------------- 응답 정규화 */

export type RegisterDong = {
  /** 동 이름. 단독·상가처럼 동이 없으면 빈 문자열 */
  dongNm: string;
  /** 주건축물인지 (부속건축물이면 false) */
  main: boolean;
  /** 집합(아파트·오피스텔 등) 인지 일반(단독·상가) 인지 */
  gathered: boolean;
  bldNm: string;
  platPlc: string;
  newPlatPlc: string;
  mainPurps: string;
  etcPurps: string;
  strct: string;
  platArea: number;
  archArea: number;
  totArea: number;
  bcRat: number;
  vlRat: number;
  grndFlrCnt: number;
  ugrndFlrCnt: number;
  heit: number;
  hhldCnt: number;
  fmlyCnt: number;
  hoCnt: number;
  parkingTotal: number;
  elevator: number;
  /** YYYYMMDD */
  useAprDay: string;
  quake: string;
};

/** 물건에 저장해 두는 대장 스냅샷 */
export type RegisterSnapshot = { fetchedAt: string; demo?: boolean; dong: RegisterDong };

export type RegisterFloor = {
  dongNm: string;
  gb: string; // 지상 / 지하
  flrNo: number;
  flrNm: string;
  mainPurps: string;
  etcPurps: string;
  strct: string;
  area: number;
};

function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function str(v: unknown): string {
  const s = String(v ?? "").trim();
  return s === "-" ? "" : s;
}

/**
 * data.go.kr 응답 봉투에서 항목 배열을 꺼낸다.
 * 항목이 0개면 items 가 빈 문자열, 1개면 객체로 오는 경우를 모두 받는다.
 */
export function unwrapItems(payload: unknown): Record<string, unknown>[] {
  const body = (payload as { response?: { body?: { items?: unknown } } })?.response?.body;
  const items = body?.items;
  if (!items || typeof items === "string") return [];
  const item = (items as { item?: unknown }).item;
  if (!item) return [];
  return (Array.isArray(item) ? item : [item]) as Record<string, unknown>[];
}

export function readHeader(payload: unknown): { code: string; msg: string } {
  const h = (payload as { response?: { header?: { resultCode?: string; resultMsg?: string } } })?.response?.header;
  return { code: str(h?.resultCode), msg: str(h?.resultMsg) };
}

export function readTotalCount(payload: unknown): number {
  return num((payload as { response?: { body?: { totalCount?: unknown } } })?.response?.body?.totalCount);
}

export function normalizeDongs(items: Record<string, unknown>[]): RegisterDong[] {
  return items.map((r) => ({
    dongNm: str(r.dongNm),
    main: str(r.mainAtchGbCd) === "0",
    gathered: str(r.regstrGbCdNm) === "집합",
    bldNm: str(r.bldNm),
    platPlc: str(r.platPlc),
    newPlatPlc: str(r.newPlatPlc),
    mainPurps: str(r.mainPurpsCdNm),
    etcPurps: str(r.etcPurps),
    strct: str(r.strctCdNm) || str(r.etcStrct),
    platArea: num(r.platArea),
    archArea: num(r.archArea),
    totArea: num(r.totArea),
    bcRat: num(r.bcRat),
    vlRat: num(r.vlRat),
    grndFlrCnt: num(r.grndFlrCnt),
    ugrndFlrCnt: num(r.ugrndFlrCnt),
    heit: num(r.heit),
    hhldCnt: num(r.hhldCnt),
    fmlyCnt: num(r.fmlyCnt),
    hoCnt: num(r.hoCnt),
    parkingTotal: num(r.indrAutoUtcnt) + num(r.oudrAutoUtcnt) + num(r.indrMechUtcnt) + num(r.oudrMechUtcnt),
    elevator: num(r.rideUseElvtCnt) + num(r.emgenUseElvtCnt),
    useAprDay: str(r.useAprDay),
    quake: str(r.rserthqkAblty),
  }));
}

export function normalizeFloors(items: Record<string, unknown>[]): RegisterFloor[] {
  return items
    .map((r) => ({
      dongNm: str(r.dongNm),
      gb: str(r.flrGbCdNm),
      flrNo: num(r.flrNo),
      flrNm: str(r.flrNoNm),
      mainPurps: str(r.mainPurpsCdNm),
      etcPurps: str(r.etcPurps),
      strct: str(r.strctCdNm),
      area: num(r.area),
    }))
    .sort((a, b) => (a.gb === b.gb ? a.flrNo - b.flrNo : a.gb === "지하" ? -1 : 1));
}

/* ----------------------------------------------------------------- 고르기 */

/** 사용자가 입력한 동("110", "110동", "가")과 대장의 dongNm 을 맞춘다. */
export function pickDong(dongs: RegisterDong[], wanted?: string): RegisterDong | undefined {
  const mains = dongs.filter((d) => d.main);
  const pool = mains.length ? mains : dongs;
  const w = String(wanted ?? "").trim();
  if (w) {
    const wd = w.replace(/\D/g, "");
    const exact = pool.find((d) => d.dongNm === w || d.dongNm === `${w}동`);
    if (exact) return exact;
    if (wd) {
      const byNum = pool.find((d) => d.dongNm.replace(/\D/g, "") === wd);
      if (byNum) return byNum;
    }
  }
  if (pool.length === 1) return pool[0];
  // 동을 특정하지 못하면 연면적이 가장 큰 주건축물
  return pool.slice().sort((a, b) => b.totArea - a.totArea)[0];
}

/* ------------------------------------------------------- 물건 폼으로 옮기기 */

export type GuessedType = "아파트" | "오피스텔" | "빌라·다세대" | "상가" | "단독주택" | "토지";

/** 주용도·기타용도로 물건 유형을 추정한다. 확실하지 않으면 undefined. */
export function guessPropertyType(mainPurps: string, etcPurps = ""): GuessedType | undefined {
  const t = `${mainPurps} ${etcPurps}`;
  if (/오피스텔/.test(t)) return "오피스텔";
  if (/아파트/.test(t)) return "아파트";
  if (/연립|다세대/.test(t)) return "빌라·다세대";
  if (/다가구|단독주택/.test(t)) return "단독주택";
  if (/근린생활|판매시설|상가/.test(t)) return "상가";
  if (/공동주택/.test(t)) return "아파트";
  return undefined;
}

/** YYYYMMDD → "2022-05-02". 값이 없으면 빈 문자열. */
export function formatRegisterDate(yyyymmdd: string): string {
  const d = String(yyyymmdd ?? "").replace(/\D/g, "");
  if (d.length !== 8) return "";
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
}

/** 사용승인일로부터 지난 햇수. 계산할 수 없으면 null. */
export function buildingAge(useAprDay: string, today: string): number | null {
  const d = String(useAprDay ?? "").replace(/\D/g, "");
  if (d.length !== 8) return null;
  const y = Number(d.slice(0, 4));
  const ty = Number(String(today).slice(0, 4));
  if (!y || !ty) return null;
  return ty - y;
}

/**
 * 세대당 주차대수. 산출할 수 없으면 null 이다 — 0대로 쓰지 않는다.
 * 표제부의 주차 항목은 단지형 아파트에서 0으로 비어 있고 총괄표제부에 실리는 경우가 많다.
 * 0을 "주차 없음"으로 오해하지 않도록, 기재가 없으면 채우지 않는다.
 */
export function parkingPerHousehold(d: Pick<RegisterDong, "parkingTotal" | "hhldCnt">): number | null {
  if (!d.hhldCnt || !d.parkingTotal) return null;
  return Math.round((d.parkingTotal / d.hhldCnt) * 10) / 10;
}

/**
 * 물건 등록 폼에 자동으로 넣을 값.
 * 집합건물의 연면적은 동 전체 면적이라 개별 호의 면적이 아니다 — 그래서 면적은 비워 둔다.
 */
export function toFormPatch(d: RegisterDong): { name?: string; type?: GuessedType; totalFloor?: string; areaM2?: number; parking?: number | null; areaNote?: string } {
  const name = [d.bldNm, d.dongNm].filter(Boolean).join(" ").trim();
  return {
    name: name || undefined,
    type: guessPropertyType(d.mainPurps, d.etcPurps),
    totalFloor: d.grndFlrCnt ? String(d.grndFlrCnt) : undefined,
    areaM2: d.gathered ? undefined : d.totArea || undefined,
    parking: parkingPerHousehold(d),
    areaNote: d.gathered ? "집합건물이라 대장의 연면적은 동 전체 면적입니다. 호별 전용면적은 등기부나 분양계약서에서 확인해 주세요." : undefined,
  };
}

/* ------------------------------------------------------------- 오류 메시지 */

export type RegisterErrorCode = "NO_KEY" | "NO_BCODE" | "NO_JIBUN" | "NO_DATA" | "KEY_INVALID" | "QUOTA" | "UPSTREAM" | "BAD_RESPONSE";

/** 원인 한 줄 + 지금 할 수 있는 일. 예외 원문은 화면에 내보내지 않는다. */
export const REGISTER_ERRORS: Record<RegisterErrorCode, { message: string; hint: string }> = {
  NO_KEY: {
    message: "국토교통부 인증키가 설정되지 않았습니다.",
    hint: "공공데이터포털에서 '건축물대장정보 서비스' 활용 신청 후, 일반 인증키(Decoding)를 환경 변수 DATA_GO_KR_API_KEY에 넣고 다시 배포하세요.",
  },
  NO_BCODE: {
    message: "주소의 법정동코드를 읽지 못했습니다.",
    hint: "주소를 직접 입력하지 말고 [주소 검색]으로 다시 골라 주세요. 검색 결과에 법정동코드가 함께 들어옵니다.",
  },
  NO_JIBUN: {
    message: "주소에서 번·지를 읽지 못했습니다.",
    hint: "지번이 없는 주소(도로명만 있는 신축 등)일 수 있습니다. 번·지를 직접 입력해 조회해 보세요.",
  },
  NO_DATA: {
    message: "이 지번에는 등록된 건축물대장이 없습니다.",
    hint: "나대지이거나 아직 사용승인 전인 건물일 수 있습니다. 번·지가 맞는지 확인하고, 산 번지라면 대지구분을 '산'으로 바꿔 보세요.",
  },
  KEY_INVALID: {
    message: "인증키가 등록되지 않았거나 이 서비스에 활용 신청이 되어 있지 않습니다.",
    hint: "공공데이터포털 마이페이지에서 '건축물대장정보 서비스' 승인 상태를 확인하고, Encoding 키가 아닌 Decoding 키를 넣었는지 보세요.",
  },
  QUOTA: {
    message: "오늘 조회 한도를 모두 썼습니다.",
    hint: "공공데이터포털에서 운영 계정으로 전환을 신청하면 한도가 올라갑니다. 내일 자정에 한도가 초기화됩니다.",
  },
  UPSTREAM: {
    message: "국토교통부 서버가 응답하지 않습니다.",
    hint: "잠시 뒤 다시 시도해 주세요. 계속 같으면 공공데이터포털 공지에서 점검 일정을 확인하세요.",
  },
  BAD_RESPONSE: {
    message: "국토교통부 서버가 예상과 다른 응답을 보냈습니다.",
    hint: "잠시 뒤 다시 시도해 주세요. 반복되면 운영자에게 알려 주세요.",
  },
};

/** data.go.kr resultCode → 우리 오류 코드 */
export function mapResultCode(code: string): RegisterErrorCode | null {
  switch (String(code)) {
    case "00":
      return null;
    case "03":
      return "NO_DATA";
    case "30":
    case "31":
    case "32":
      return "KEY_INVALID";
    case "20":
      return "KEY_INVALID";
    case "22":
      return "QUOTA";
    case "":
      return null;
    default:
      return "UPSTREAM";
  }
}

/**
 * 인증키 정리.
 * 포털은 Encoding 키와 Decoding 키를 함께 준다. Encoding 키(이미 % 인코딩됨)를 그대로
 * 쿼리에 넣으면 이중 인코딩이 되어 인증에 실패한다. 인코딩된 형태면 먼저 풀어 둔다.
 */
export function normalizeServiceKey(raw: string): string {
  const k = String(raw ?? "").trim();
  if (!k) return "";
  if (/%[0-9A-Fa-f]{2}/.test(k)) {
    try {
      return decodeURIComponent(k);
    } catch {
      return k;
    }
  }
  return k;
}
