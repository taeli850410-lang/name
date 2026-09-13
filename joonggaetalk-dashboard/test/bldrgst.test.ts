/**
 * 건축물대장 정규화 테스트.
 * 실제 응답(src/data/brSample.ts)을 그대로 넣고 결과를 확인한다.
 *   npm test
 */
import assert from "node:assert/strict";
import { BR_SAMPLE_TITLE } from "../src/data/brSample.ts";
import {
  buildKey,
  buildingAge,
  formatRegisterDate,
  guessPropertyType,
  mapResultCode,
  normalizeDongs,
  normalizeServiceKey,
  pad4,
  parkingPerHousehold,
  parseJibun,
  pickDong,
  readHeader,
  readTotalCount,
  splitBcode,
  toFormPatch,
  unwrapItems,
} from "../src/lib/bldrgst.ts";

const fixture: unknown = BR_SAMPLE_TITLE;

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

console.log("건축물대장 정규화");

test("번·지를 지번주소에서 읽는다", () => {
  assert.deepEqual(parseJibun("인천 부평구 십정동 630"), { bun: "0630", ji: "0000", platGbCd: "0" });
  assert.deepEqual(parseJibun("인천 부평구 십정동 630-1"), { bun: "0630", ji: "0001", platGbCd: "0" });
  assert.deepEqual(parseJibun("인천광역시 부평구 십정동 630번지"), { bun: "0630", ji: "0000", platGbCd: "0" });
  assert.deepEqual(parseJibun("인천 부평구 산곡동 산 12-4"), { bun: "0012", ji: "0004", platGbCd: "1" });
  // 건물명이 뒤에 붙어 있어도 숫자 지번을 찾아낸다
  assert.deepEqual(parseJibun("인천 부평구 십정동 630 더샵부평센트럴시티"), { bun: "0630", ji: "0000", platGbCd: "0" });
  assert.equal(parseJibun(""), null);
  assert.equal(parseJibun("십정동"), null);
  // 도로명주소를 넣으면 건물번호를 번으로 읽는다 — 구분할 방법이 없다.
  // 그래서 호출하는 쪽은 항상 우편번호 결과의 jibunAddress 를 넘겨야 한다.
  assert.deepEqual(parseJibun("인천 부평구 열우물로 90"), { bun: "0090", ji: "0000", platGbCd: "0" });
});

test("법정동코드 10자리를 시군구·법정동으로 쪼갠다", () => {
  assert.deepEqual(splitBcode("2823710200"), { sigunguCd: "28237", bjdongCd: "10200" });
  assert.equal(splitBcode("28237"), null);
  assert.equal(pad4("630"), "0630");
  assert.equal(pad4(7), "0007");
});

test("우편번호 결과로 조회 키를 만든다", () => {
  const r = buildKey({ bcode: "2823710200", jibunAddress: "인천 부평구 십정동 630" });
  assert.ok("key" in r);
  assert.deepEqual(r.key, { sigunguCd: "28237", bjdongCd: "10200", platGbCd: "0", bun: "0630", ji: "0000" });
  assert.deepEqual(buildKey({ jibunAddress: "인천 부평구 십정동 630" }), { error: "NO_BCODE" });
  assert.deepEqual(buildKey({ bcode: "2823710200", jibunAddress: "" }), { error: "NO_JIBUN" });
});

test("응답 봉투에서 항목을 꺼낸다", () => {
  assert.equal(readHeader(fixture).code, "00");
  assert.equal(readTotalCount(fixture), 61);
  assert.equal(unwrapItems(fixture).length, 3);
  // 0건이면 items 가 빈 문자열로 온다
  assert.deepEqual(unwrapItems({ response: { body: { items: "" } } }), []);
  // 1건이면 item 이 배열이 아니라 객체로 온다
  assert.equal(unwrapItems({ response: { body: { items: { item: { bldNm: "가" } } } } }).length, 1);
  assert.deepEqual(unwrapItems(null), []);
});

test("표제부를 정규화한다", () => {
  const dongs = normalizeDongs(unwrapItems(fixture));
  const apt = dongs.find((d) => d.dongNm === "116동")!;
  assert.equal(apt.main, true);
  assert.equal(apt.gathered, true);
  assert.equal(apt.bldNm, "더샵 부평센트럴시티");
  assert.equal(apt.totArea, 26004.9933);
  assert.equal(apt.grndFlrCnt, 39);
  assert.equal(apt.hhldCnt, 223);
  assert.equal(apt.elevator, 6);
  assert.equal(apt.useAprDay, "20220502");
  assert.equal(apt.quake, "Ⅶ-0.169g");
  assert.equal(apt.strct, "철근콘크리트구조");

  // 부속건축물은 main=false
  assert.equal(dongs.find((d) => d.dongNm === "주민공동시설-1")!.main, false);
  // 공백만 있는 값은 빈 문자열로 정리된다
  assert.equal(dongs.find((d) => d.dongNm === "주민공동시설-1")!.quake, "");
});

test("입력한 동과 대장의 동을 맞춘다", () => {
  const dongs = normalizeDongs(unwrapItems(fixture));
  assert.equal(pickDong(dongs, "116")!.dongNm, "116동");
  assert.equal(pickDong(dongs, "116동")!.dongNm, "116동");
  assert.equal(pickDong(dongs, "상가B동")!.dongNm, "상가B동");
  // 동을 못 고르면 주건축물 중 연면적이 가장 큰 것
  assert.equal(pickDong(dongs)!.dongNm, "116동");
  // 부속건축물은 후보에서 빠진다
  assert.equal(pickDong(dongs, "주민공동시설-1")!.main, true);
});

test("주용도로 물건 유형을 추정한다", () => {
  assert.equal(guessPropertyType("공동주택", "공동주택(아파트)"), "아파트");
  assert.equal(guessPropertyType("공동주택", "공동주택(다세대주택)"), "빌라·다세대");
  assert.equal(guessPropertyType("업무시설", "오피스텔"), "오피스텔");
  assert.equal(guessPropertyType("제2종근린생활시설", "제1,2종근린생활시설"), "상가");
  assert.equal(guessPropertyType("단독주택", "다가구주택"), "단독주택");
  assert.equal(guessPropertyType("창고시설", ""), undefined);
});

test("집합건물의 연면적은 폼 면적으로 넣지 않는다", () => {
  const dongs = normalizeDongs(unwrapItems(fixture));
  const apt = toFormPatch(pickDong(dongs, "116")!);
  assert.equal(apt.name, "더샵 부평센트럴시티 116동");
  assert.equal(apt.type, "아파트");
  assert.equal(apt.totalFloor, "39");
  assert.equal(apt.areaM2, undefined, "동 전체 연면적을 호의 면적으로 채우면 안 된다");
  assert.ok(apt.areaNote);

  // 일반건물(상가동)은 연면적을 넣어도 된다 — 다만 이 단지는 상가도 집합이라 note 가 붙는다
  const shop = toFormPatch(dongs.find((d) => d.dongNm === "상가B동")!);
  assert.equal(shop.type, "상가");
  assert.equal(shop.totalFloor, "1");
});

test("주차는 산출 가능할 때만 낸다", () => {
  assert.equal(parkingPerHousehold({ parkingTotal: 300, hhldCnt: 223 }), 1.3);
  assert.equal(parkingPerHousehold({ parkingTotal: 0, hhldCnt: 0 }), null, "0으로 나눠 0대로 쓰면 안 된다");
  // 단지형 아파트는 표제부 주차가 비어 있고 총괄표제부에 실린다. 0을 '주차 없음'으로 쓰면 안 된다.
  assert.equal(parkingPerHousehold({ parkingTotal: 0, hhldCnt: 223 }), null);
  // 실제 응답에서도 폼에 주차가 채워지지 않아야 한다
  const apt = pickDong(normalizeDongs(unwrapItems(fixture)), "116")!;
  assert.equal(apt.parkingTotal, 0);
  assert.equal(toFormPatch(apt).parking, null);
});

test("날짜와 노후도", () => {
  assert.equal(formatRegisterDate("20220502"), "2022-05-02");
  assert.equal(formatRegisterDate(" "), "");
  assert.equal(buildingAge("20220502", "2026-09-13"), 4);
  assert.equal(buildingAge("", "2026-09-13"), null);
});

test("resultCode 를 우리 오류로 옮긴다", () => {
  assert.equal(mapResultCode("00"), null);
  assert.equal(mapResultCode("03"), "NO_DATA");
  assert.equal(mapResultCode("30"), "KEY_INVALID");
  assert.equal(mapResultCode("22"), "QUOTA");
  assert.equal(mapResultCode("99"), "UPSTREAM");
});

test("Encoding 키를 넣어도 이중 인코딩되지 않는다", () => {
  assert.equal(normalizeServiceKey("abc%2Bdef%3D%3D"), "abc+def==");
  assert.equal(normalizeServiceKey("abc+def=="), "abc+def==");
  assert.equal(normalizeServiceKey("  key  "), "key");
});

console.log(`\n${passed}개 통과`);
