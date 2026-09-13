/**
 * PG 웹훅 서명 검증 (Standard Webhooks — 포트원이 쓰는 방식).
 *
 * 웹훅 주소는 인터넷에 열려 있다. 본문을 그대로 믿으면 누구든 성공 웹훅을
 * 흉내 내 이용기한을 늘릴 수 있다. 그래서 서명을 먼저 보고, 그다음에도
 * PG 에 재조회해 금액을 대조한다. 여기는 그중 첫 번째 관문이다.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** 서명이 이보다 오래되면 가로챈 요청을 다시 보내는 것으로 본다. */
export const MAX_SKEW_SEC = 5 * 60;

export type SigHeaders = { id: string | null; timestamp: string | null; signature: string | null };

export type VerifyResult = { ok: true } | { ok: false; why: string };

/** 길이가 달라도 시간이 새지 않게 비교한다. */
function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

/** whsec_ 로 시작하면 그 뒤가 base64 로 인코딩된 키다. */
export function decodeSecret(secret: string): Buffer {
  return secret.startsWith("whsec_") ? Buffer.from(secret.slice(6), "base64") : Buffer.from(secret, "utf8");
}

export function sign(raw: string, id: string, timestamp: string, secret: string): string {
  return createHmac("sha256", decodeSecret(secret)).update(`${id}.${timestamp}.${raw}`).digest("base64");
}

/**
 * 본문 원문을 대상으로 검증한다. JSON 으로 파싱했다가 다시 문자열로 만들면
 * 공백·키 순서가 달라져 서명이 어긋난다 — 반드시 받은 그대로 넣어야 한다.
 */
export function verifyWebhook(raw: string, h: SigHeaders, secret: string, nowSec = Math.floor(Date.now() / 1000)): VerifyResult {
  if (!secret) return { ok: false, why: "웹훅 서명 키가 설정되지 않았습니다" };
  if (!h.id || !h.timestamp || !h.signature) return { ok: false, why: "서명 헤더가 없습니다" };

  const ts = Number(h.timestamp);
  if (!Number.isFinite(ts)) return { ok: false, why: "서명 시각을 읽을 수 없습니다" };
  if (Math.abs(nowSec - ts) > MAX_SKEW_SEC) return { ok: false, why: "서명 시각이 너무 오래됐습니다" };

  const expected = sign(raw, h.id, h.timestamp, secret);
  // 키를 바꾸는 중에는 "v1,서명A v1,서명B" 처럼 여러 개가 온다. 하나만 맞으면 된다.
  const given = h.signature.split(" ").filter(Boolean).map((s) => (s.includes(",") ? s.slice(s.indexOf(",") + 1) : s));
  return given.some((g) => safeEqual(g, expected)) ? { ok: true } : { ok: false, why: "서명이 맞지 않습니다" };
}
