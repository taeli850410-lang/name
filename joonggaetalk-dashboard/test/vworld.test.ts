/**
 * VWorld 정규화 테스트.
 * 실제 응답(src/data/vworldSample.ts)을 그대로 넣고 결과를 확인한다.
 *   npm test
 */
import assert from "node:assert/strict";
import {
  VW_SAMPLE_DOMAIN_ERROR,
  VW_SAMPLE_GEOCODE_MOUNTAIN,
  VW_SAMPLE_GEOCODE_PARCEL,
  VW_SAMPLE_GEOCODE_ROAD,
  VW_SAMPLE_KEY_ERROR,
  VW_SAMPLE_NOT_FOUND,
  VW_SAMPLE_PARCEL,
  VW_SAMPLE_ZONING,
} from "../src/data/vworldSample.ts";
import {
  guessAddressType,
  landValue,
  mapVworldStatus,
  parseGeocode,
  parseParcel,
  parseZoning,
  pnuToJibunText,
  pnuToRegisterKey,
  readDataError,
  readFeatures,
  readGeoError,
  readGeoStatus,
} from "../src/lib/vworld.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

console.log("\nVWorld 정규화");

test("지번주소를 좌표·PNU·조회 키로 바꾼다", () => {
  const hit = parseGeocode(VW_SAMPLE_GEOCODE_PARCEL, "parcel")!;
  assert.equal(hit.address, "인천광역시 부평구 십정동 630");
  assert.equal(hit.point.lon, 126.6982780317143);
  assert.equal(hit.point.lat, 37.47637893315455);
  assert.equal(hit.pnu, "2823710200106300000");
  assert.equal(hit.bjdCode, "2823710200");
  assert.deepEqual(hit.registerKey, { sigunguCd: "28237", bjdongCd: "10200", platGbCd: "0", bun: "0630", ji: "0000" });
  assert.equal(hit.sigungu, "부평구");
});

test("도로명주소에는 PNU 가 없다", () => {
  const hit = parseGeocode(VW_SAMPLE_GEOCODE_ROAD, "road")!;
  assert.equal(hit.point.lat, 37.475934902701034);
  assert.equal(hit.pnu, null, "건물번호를 번지로 쓰면 안 된다");
  assert.equal(hit.bjdCode, null);
  assert.equal(hit.registerKey, null);
  // 좌표는 나오므로 이 좌표로 필지를 되짚으면 지번을 알아낼 수 있다
  assert.ok(hit.point.lon > 126 && hit.point.lon < 127);
});

test("산 번지는 대지구분이 바뀐다", () => {
  const hit = parseGeocode(VW_SAMPLE_GEOCODE_MOUNTAIN, "parcel")!;
  assert.equal(hit.pnu, "4182025026200010001");
  // PNU 의 필지구분 2(산) → 건축물대장 platGbCd 1(산). 그대로 넘기면 조회되지 않는다.
  assert.deepEqual(hit.registerKey, { sigunguCd: "41820", bjdongCd: "25026", platGbCd: "1", bun: "0001", ji: "0001" });
  assert.equal(pnuToJibunText(hit.pnu!), "산 1-1");
});

test("PNU 를 조회 키와 지번으로 되돌린다", () => {
  assert.deepEqual(pnuToRegisterKey("2823710200106300000"), { sigunguCd: "28237", bjdongCd: "10200", platGbCd: "0", bun: "0630", ji: "0000" });
  assert.equal(pnuToJibunText("2823710200106300000"), "630");
  assert.equal(pnuToRegisterKey("28237"), null);
  assert.equal(pnuToJibunText(""), "");
});

test("연속지적도에서 지목과 공시지가를 읽는다", () => {
  const parcel = parseParcel(readFeatures(VW_SAMPLE_PARCEL)[0])!;
  assert.equal(parcel.pnu, "2823710200106300000");
  assert.equal(parcel.jibun, "630");
  assert.equal(parcel.jimok, "대", "jibun '630 대' 에서 지목을 떼어낸다");
  assert.deepEqual(parcel.landPrice, { wonPerSqm: 1990000, asOf: "2025.01" });
  assert.equal(parcel.registerKey?.bun, "0630");
  // 이 레이어에는 면적이 없다 — Parcel 타입에 면적 자체를 두지 않았다
  assert.equal("area" in parcel, false);
});

test("용도지역을 읽는다", () => {
  const zoning = parseZoning(readFeatures(VW_SAMPLE_ZONING)[0])!;
  assert.equal(zoning.name, "준주거지역");
  assert.equal(zoning.year, "2016");
  assert.equal(parseZoning({}), null);
});

test("공시지가 기준 토지가액은 면적이 있을 때만 낸다", () => {
  assert.equal(landValue({ wonPerSqm: 1990000, asOf: "2025.01" }, 100), 199000000);
  assert.equal(landValue({ wonPerSqm: 1990000, asOf: "2025.01" }, undefined), null, "면적을 모르면 계산하지 않는다");
  assert.equal(landValue(null, 100), null);
});

test("status 와 오류 문구를 우리 오류로 옮긴다", () => {
  assert.equal(readGeoStatus(VW_SAMPLE_GEOCODE_PARCEL), "OK");
  assert.equal(mapVworldStatus("OK"), null);
  assert.equal(readGeoStatus(VW_SAMPLE_NOT_FOUND), "NOT_FOUND");
  assert.equal(mapVworldStatus("NOT_FOUND"), "NOT_FOUND");
  assert.equal(mapVworldStatus("ERROR", readGeoError(VW_SAMPLE_KEY_ERROR)), "KEY_INVALID");
  assert.equal(mapVworldStatus("ERROR", readGeoError(VW_SAMPLE_DOMAIN_ERROR)), "DOMAIN", "도메인 미등록은 키 오류와 조치가 다르다");
  assert.equal(mapVworldStatus("ERROR", "일일 호출 한도를 초과하였습니다"), "QUOTA");
  assert.equal(mapVworldStatus("ERROR", ""), "UPSTREAM");
  assert.equal(readDataError(VW_SAMPLE_ZONING), "");
});

test("주소 모양으로 지번·도로명을 고른다", () => {
  assert.equal(guessAddressType("인천광역시 부평구 열우물로 90"), "road");
  assert.equal(guessAddressType("서울특별시 중구 세종대로 110"), "road");
  assert.equal(guessAddressType("경기 부천시 부일로 300"), "road");
  assert.equal(guessAddressType("인천광역시 부평구 십정동 630"), "parcel");
  assert.equal(guessAddressType("인천 부평구 산곡동 산 12-4"), "parcel");
});

test("빈 응답에도 터지지 않는다", () => {
  assert.equal(parseGeocode({}, "parcel"), null);
  assert.equal(parseGeocode(null, "road"), null);
  assert.deepEqual(readFeatures({}), []);
  assert.equal(parseParcel({}), null);
});

console.log(`\n${passed}개 통과`);
