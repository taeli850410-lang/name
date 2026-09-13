/**
 * 텔레그램 알림 테스트.
 *   npm test
 */
import assert from "node:assert/strict";
import {
  clamp,
  escapeHtml,
  formatAlert,
  looksLikeToken,
  mapError,
  MAX_LEN,
  readChats,
  readConfig,
  readDescription,
  readOk,
} from "../src/lib/telegram.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

console.log("\n텔레그램 알림");

test("서식 문자를 바꾼다 — 안 바꾸면 텔레그램이 거절한다", () => {
  assert.equal(escapeHtml("a < b & c > d"), "a &lt; b &amp; c &gt; d");
  // 오류 원문에 꺾쇠가 들어 있는 건 흔하다. 이게 그대로 나가면 400 이 온다.
  assert.equal(
    escapeHtml("<html><body><h1>502 Bad Gateway</h1>"),
    "&lt;html&gt;&lt;body&gt;&lt;h1&gt;502 Bad Gateway&lt;/h1&gt;",
  );
});

test("& 를 먼저 바꾼다 — 순서가 틀리면 두 번 바뀐다", () => {
  // "&lt;" 가 "&amp;lt;" 로 되면 화면에 &lt; 라는 글자가 그대로 보인다
  assert.equal(escapeHtml("<"), "&lt;");
  assert.ok(!escapeHtml("<").includes("&amp;"));
});

test("알림 본문을 만든다", () => {
  const out = formatAlert({
    kind: "장애",
    title: "발송 대행사 장애",
    lines: ["12:35부터 알림톡이 보류되고 있습니다.", "영향: 3건"],
    url: "https://joonggaetalk-dashboard.vercel.app/admin/monitor",
  }, "2026-09-13 09:00");

  assert.ok(out.startsWith("🔴 <b>발송 대행사 장애</b>"));
  assert.ok(out.includes("영향: 3건"));
  assert.ok(out.includes("<i>2026-09-13 09:00</i>"));
  // 주소는 바꾸지 않는다 — 바꾸면 누를 수 없게 된다
  assert.ok(out.includes("https://joonggaetalk-dashboard.vercel.app/admin/monitor"));
});

test("종류마다 표시가 다르다", () => {
  const kinds = ["장애", "발송실패", "등기변동", "문의답변", "점검"] as const;
  const marks = kinds.map((kind) => formatAlert({ kind, title: "x" }).slice(0, 2).trim());
  assert.equal(new Set(marks).size, kinds.length, "표시가 겹치면 목록에서 구분이 안 된다");
});

test("본문이 없어도 만들어진다", () => {
  const out = formatAlert({ kind: "점검", title: "3/3 정상" });
  assert.equal(out, "✅ <b>3/3 정상</b>");
});

test("빈 줄은 버린다", () => {
  const out = formatAlert({ kind: "점검", title: "확인", lines: ["", "  ", "한 줄"] });
  assert.equal(out, "✅ <b>확인</b>\n한 줄");
});

test("4096자를 넘으면 줄이고 줄였다고 밝힌다", () => {
  const long = "가".repeat(5000);
  const out = clamp(long);
  assert.ok(out.length <= MAX_LEN);
  assert.ok(out.endsWith("(너무 길어 줄였습니다)"), "말없이 잘리면 뒷부분이 사라진 줄 모른다");
  // 짧은 건 건드리지 않는다
  assert.equal(clamp("짧다"), "짧다");
});

test("토큰과 받는 사람이 둘 다 있어야 설정된 것으로 본다", () => {
  assert.equal(readConfig({}), null);
  assert.equal(readConfig({ TELEGRAM_BOT_TOKEN: "123:abc" }), null, "받을 사람이 없으면 못 보낸다");
  assert.equal(readConfig({ TELEGRAM_CHAT_ID: "5" }), null, "토큰이 없으면 못 보낸다");
  assert.deepEqual(readConfig({ TELEGRAM_BOT_TOKEN: " 123:abc ", TELEGRAM_CHAT_ID: " 5 " }), {
    token: "123:abc",
    chatId: "5",
  });
  // 빈 문자열은 없는 것과 같다
  assert.equal(readConfig({ TELEGRAM_BOT_TOKEN: "  ", TELEGRAM_CHAT_ID: "5" }), null);
});

test("토큰 모양을 본다", () => {
  assert.ok(looksLikeToken("123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw"));
  assert.ok(!looksLikeToken("그냥글자"));
  assert.ok(!looksLikeToken("123456789"), "콜론 뒤가 없으면 토큰이 아니다");
  assert.ok(!looksLikeToken(""));
});

test("실패 원인을 나눈다 — 고치는 곳이 다르기 때문", () => {
  assert.equal(mapError(401, "Unauthorized"), "BAD_TOKEN");
  assert.equal(mapError(400, "Bad Request: chat not found"), "NO_CHAT");
  assert.equal(mapError(403, "Forbidden: bot was blocked by the user"), "BLOCKED");
  assert.equal(mapError(429, "Too Many Requests: retry after 30"), "RATE_LIMIT");
  assert.equal(mapError(500, ""), "UPSTREAM");
  // 400 인데 사유를 모르면 대화 문제로 본다 — 제일 흔한 원인이다
  assert.equal(mapError(400, ""), "NO_CHAT");
});

test("응답에서 성공 여부와 사유를 읽는다", () => {
  assert.equal(readOk({ ok: true }), true);
  assert.equal(readOk({ ok: false }), false);
  assert.equal(readOk(null), false);
  assert.equal(readOk("문자열"), false);
  assert.equal(readDescription({ description: "chat not found" }), "chat not found");
  assert.equal(readDescription({}), "");
});

test("말을 건 사람 목록을 뽑는다", () => {
  const chats = readChats({
    ok: true,
    result: [
      { message: { chat: { id: 5551, first_name: "태리", last_name: "이", username: "taeli" } } },
      { message: { chat: { id: 5551, first_name: "태리" } } }, // 같은 사람 두 번
      { message: { chat: { id: -100234, title: "부동산TALK 운영" } } },
      { edited_message: { chat: { id: 999 } } }, // message 가 아니면 무시
    ],
  });
  assert.deepEqual(chats, [
    { id: "5551", name: "태리 이" },
    { id: "-100234", name: "부동산TALK 운영" },
  ]);
});

test("이름이 없어도 id 는 건진다", () => {
  const chats = readChats({ result: [{ message: { chat: { id: 42 } } }] });
  assert.deepEqual(chats, [{ id: "42", name: "이름 없음" }]);
  // id 가 0 이어도 버리지 않는다 — 숫자 0 을 없는 값으로 보면 안 된다
  assert.equal(readChats({ result: [{ message: { chat: { id: 0 } } }] }).length, 1);
});

test("응답이 이상해도 터지지 않는다", () => {
  assert.deepEqual(readChats(null), []);
  assert.deepEqual(readChats({ result: "목록이 아님" }), []);
  assert.deepEqual(readChats({ result: [null, {}, { message: {} }] }), []);
});

console.log(`\n${passed}개 통과\n`);
