/**
 * VWorld 실제 응답 모음 (2026-09 조회).
 * 값은 원본 그대로이고, VWorld 가 쓰는 봉투 모양으로 감쌌다.
 *
 * 두 곳에서 쓴다.
 *  - 정규화 테스트(test/vworld.test.ts)의 입력
 *  - 인증키가 없을 때 화면에서 눌러 볼 수 있는 "예시 응답"
 */

/** 지번주소 → 좌표. level4LC 에 PNU 19자리가 들어온다. */
export const VW_SAMPLE_GEOCODE_PARCEL = {
  response: {
    status: "OK",
    input: { type: "PARCEL", address: "인천광역시 부평구 십정동 630" },
    refined: {
      text: "인천광역시 부평구 십정동 630",
      structure: {
        level0: "대한민국",
        level1: "인천광역시",
        level2: "부평구",
        level3: "",
        level4L: "십정동",
        level4LC: "2823710200106300000",
        level4A: "십정1동",
        level4AC: "2823768000",
        level5: "630",
        detail: "101동",
      },
    },
    result: { crs: "EPSG:4326", point: { x: "126.6982780317143", y: "37.47637893315455" } },
  },
} as const;

/** 도로명주소 → 좌표. PNU 도 법정동코드도 오지 않는다 (건물번호는 번지가 아니다). */
export const VW_SAMPLE_GEOCODE_ROAD = {
  response: {
    status: "OK",
    input: { type: "ROAD", address: "인천광역시 부평구 열우물로 90" },
    refined: {
      text: "인천광역시 부평구 열우물로 90 (십정동)",
      structure: {
        level0: "대한민국",
        level1: "인천광역시",
        level2: "부평구",
        level3: "십정동",
        level4L: "열우물로",
        level4LC: "",
        level4A: "십정1동",
        level4AC: "2823768000",
        level5: "90",
        detail: "",
      },
    },
    result: { crs: "EPSG:4326", point: { x: "126.70006512945213", y: "37.475934902701034" } },
  },
} as const;

/** 산 번지. PNU 11번째 자리가 2다. */
export const VW_SAMPLE_GEOCODE_MOUNTAIN = {
  response: {
    status: "OK",
    input: { type: "PARCEL", address: "경기도 가평군 가평읍 두밀리 산 1" },
    refined: {
      text: "경기도 가평군 가평읍 두밀리 산 1-1",
      structure: {
        level0: "대한민국",
        level1: "경기도",
        level2: "가평군",
        level3: "",
        level4L: "가평읍",
        level4LC: "4182025026200010001",
        level4A: "",
        level4AC: "",
        level5: "1-1",
        detail: "",
      },
    },
    result: { crs: "EPSG:4326", point: { x: "127.4654091423991", y: "37.81710461759832" } },
  },
} as const;

/** 연속지적도 LP_PA_CBND_BUBUN — 면적 속성이 없다. jiga 는 개별공시지가 원/㎡. */
export const VW_SAMPLE_PARCEL = {
  response: {
    status: "OK",
    record: { total: "1", current: "1" },
    result: {
      featureCollection: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            id: "LP_PA_CBND_BUBUN.1",
            properties: {
              gosi_year: "2025",
              pnu: "2823710200106300000",
              jibun: "630 대",
              bonbun: "630",
              bubun: "",
              addr: "인천광역시 부평구 십정동 630",
              gosi_month: "01",
              jiga: "1990000",
            },
            geometry: null,
          },
        ],
      },
    },
  },
} as const;

/** 용도지역 LT_C_UQ111 — uname 이 용도지역 이름. */
export const VW_SAMPLE_ZONING = {
  response: {
    status: "OK",
    record: { total: "1", current: "1" },
    result: {
      featureCollection: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            id: "LT_C_UQ111.41452",
            properties: { uname: "준주거지역", dyear: "2016", dnum: "0037", sido_name: "인천광역시", sigg_name: "부평구" },
            geometry: null,
          },
        ],
      },
    },
  },
} as const;

export const VW_SAMPLE_NOT_FOUND = {
  response: { status: "NOT_FOUND", input: { type: "PARCEL", address: "없는 주소" } },
} as const;

export const VW_SAMPLE_KEY_ERROR = {
  response: { status: "ERROR", error: { level: "3", code: "INCORRECT_KEY", text: "인증키가 유효하지 않습니다." } },
} as const;

export const VW_SAMPLE_DOMAIN_ERROR = {
  response: { status: "ERROR", error: { level: "3", code: "INVALID_DOMAIN", text: "등록되지 않은 도메인입니다." } },
} as const;
