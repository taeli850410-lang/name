/**
 * S3 호환 저장소의 미리 서명된 주소(presigned URL) 만들기 — AWS SigV4.
 *
 * 왜 서버를 거치지 않고 브라우저가 바로 올리는가:
 * Vercel 서버리스 함수는 요청 본문이 4.5MB 로 막혀 있다. 계약서 스캔 PDF 는
 * 그걸 쉽게 넘는다. 그래서 서버는 "여기에 올려라"는 서명된 주소만 내주고
 * 파일은 브라우저에서 저장소로 바로 간다.
 *
 * 대신 서버가 파일 내용을 못 보므로, 올린 뒤에 앞부분 바이트를 되읽어
 * 확장자와 내용이 맞는지 다시 확인한다 (api/files 의 confirm).
 *
 * 라이브러리를 쓰지 않고 직접 서명하는 이유는 이 프로젝트가 의존성 없이
 * 굴러가기 때문이고, 이렇게 하면 Cloudflare R2·AWS S3·Supabase Storage·MinIO
 * 어디에 붙여도 같은 코드가 쓰인다.
 */
import { createHash, createHmac } from "node:crypto";

const ALGO = "AWS4-HMAC-SHA256";
const SERVICE = "s3";
/** 본문 해시를 미리 못 구하므로 서명 대상에서 뺀다. presigned URL 의 표준 방식이다. */
const UNSIGNED = "UNSIGNED-PAYLOAD";

export type S3Config = {
  endpoint: string; // https://<account>.r2.cloudflarestorage.com
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

/**
 * RFC 3986. encodeURIComponent 는 ! ' ( ) * 를 남겨 두는데
 * SigV4 는 이것들도 인코딩한 문자열로 서명한다. 안 맞추면 서명이 어긋난다.
 */
export function uriEncode(s: string, keepSlash = false): string {
  let out = "";
  for (const ch of s) {
    if (/[A-Za-z0-9\-_.~]/.test(ch)) out += ch;
    else if (ch === "/" && keepSlash) out += ch;
    else {
      for (const b of Buffer.from(ch, "utf8")) out += `%${b.toString(16).toUpperCase().padStart(2, "0")}`;
    }
  }
  return out;
}

const sha256hex = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const hmac = (key: Buffer | string, data: string) => createHmac("sha256", key).update(data, "utf8").digest();

/** yyyymmddThhmmssZ 와 yyyymmdd */
export function amzDates(now: Date): { amzDate: string; stamp: string } {
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amzDate, stamp: amzDate.slice(0, 8) };
}

function signingKey(secret: string, stamp: string, region: string): Buffer {
  return hmac(hmac(hmac(hmac(`AWS4${secret}`, stamp), region), SERVICE), "aws4_request");
}

/**
 * 지정한 시간 동안만 유효한 주소를 만든다.
 * method 가 PUT 이면 올리기용, GET 이면 내려받기용이다.
 */
export function presign(
  cfg: S3Config,
  method: "PUT" | "GET" | "DELETE",
  key: string,
  expiresSec: number,
  now: Date = new Date(),
  extraQuery: Record<string, string> = {},
): string {
  const url = new URL(cfg.endpoint);
  const host = url.host;
  const { amzDate, stamp } = amzDates(now);
  const scope = `${stamp}/${cfg.region}/${SERVICE}/aws4_request`;

  // 경로 방식(path-style): 버킷이 경로 앞에 온다. R2·MinIO·Supabase 가 이 방식이다.
  const canonicalPath = `/${uriEncode(cfg.bucket)}/${uriEncode(key, true)}`;

  const q: Record<string, string> = {
    "X-Amz-Algorithm": ALGO,
    "X-Amz-Credential": `${cfg.accessKeyId}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresSec),
    "X-Amz-SignedHeaders": "host",
    ...extraQuery,
  };
  // 쿼리는 이름 순으로 정렬한 뒤 서명한다. 순서가 다르면 서명이 어긋난다.
  const canonicalQuery = Object.keys(q)
    .sort()
    .map((k) => `${uriEncode(k)}=${uriEncode(q[k])}`)
    .join("&");

  const canonicalRequest = [method, canonicalPath, canonicalQuery, `host:${host}\n`, "host", UNSIGNED].join("\n");
  const stringToSign = [ALGO, amzDate, scope, sha256hex(canonicalRequest)].join("\n");
  const signature = createHmac("sha256", signingKey(cfg.secretAccessKey, stamp, cfg.region)).update(stringToSign, "utf8").digest("hex");

  return `${url.origin}${canonicalPath}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

/** 설정이 다 있는지. 하나라도 비면 저장소를 끈 것으로 본다. */
export function readConfig(env: Record<string, string | undefined>): S3Config | null {
  const endpoint = (env.S3_ENDPOINT || "").trim();
  const bucket = (env.S3_BUCKET || "").trim();
  const accessKeyId = (env.S3_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = (env.S3_SECRET_ACCESS_KEY || "").trim();
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  return { endpoint, bucket, accessKeyId, secretAccessKey, region: (env.S3_REGION || "auto").trim() };
}
