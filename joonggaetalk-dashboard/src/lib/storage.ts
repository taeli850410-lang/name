/**
 * 첨부 파일 — 종류·검증·보존기간.
 *
 * 부동산 중개에서 다루는 파일은 "그냥 파일"이 아니다.
 *   - 거래계약서와 확인·설명서는 법으로 보존기간이 정해져 있다 (공인중개사법)
 *   - 신분증 사본에는 주민등록번호가 들어간다 (개인정보보호법)
 *   - 물건 사진은 광고에 쓰라고 공개하는 것이고, 계약서는 절대 아니다
 * 그래서 종류를 먼저 정하고, 그 종류가 규칙을 정한다.
 */

export type FileKind = "계약서" | "확인설명서" | "등기부등본" | "신분증" | "물건사진" | "기타";

export type KindRule = {
  /** 공개 주소에 둬도 되는가. 아니면 받을 때마다 서버가 권한을 확인한다 */
  open: boolean;
  /** 보존기간(개월). null 이면 정해진 기간이 없다 */
  keepMonths: number | null;
  /** 왜 이 기간인지 — 화면에 그대로 보여 준다 */
  basis: string;
  accept: readonly string[];
  maxBytes: number;
  /** 올리기 전에 사람에게 한 번 물어야 하는 것 */
  warn?: string;
};

const MB = 1024 * 1024;

export const KIND_RULES: Record<FileKind, KindRule> = {
  계약서: {
    open: false,
    keepMonths: 60,
    basis: "공인중개사법에 따라 거래계약서는 5년 보존합니다.",
    accept: ["pdf", "jpg", "jpeg", "png"],
    maxBytes: 20 * MB,
  },
  확인설명서: {
    open: false,
    keepMonths: 36,
    basis: "공인중개사법에 따라 중개대상물 확인·설명서는 3년 보존합니다.",
    accept: ["pdf", "jpg", "jpeg", "png"],
    maxBytes: 20 * MB,
  },
  등기부등본: {
    open: false,
    keepMonths: 36,
    basis: "계약 근거 자료로 계약서와 함께 보관합니다.",
    accept: ["pdf"],
    maxBytes: 10 * MB,
  },
  신분증: {
    open: false,
    keepMonths: 3,
    basis: "주민등록번호가 담긴 자료라 목적을 다하면 바로 지웁니다. 최대 3개월만 둡니다.",
    accept: ["pdf", "jpg", "jpeg", "png"],
    maxBytes: 10 * MB,
    warn: "신분증 사본은 법령 근거 없이 보관할 수 없습니다. 꼭 필요한 경우가 아니면 올리지 말고, 올렸다면 주민등록번호 뒷자리를 가려 주세요.",
  },
  물건사진: {
    open: true,
    keepMonths: null,
    basis: "광고에 쓰는 사진이라 보존 의무가 없습니다. 매물이 내려가면 함께 지웁니다.",
    accept: ["jpg", "jpeg", "png", "webp"],
    maxBytes: 10 * MB,
  },
  기타: {
    open: false,
    keepMonths: 36,
    basis: "분류하지 않은 자료는 3년 뒤 지웁니다.",
    accept: ["pdf", "jpg", "jpeg", "png", "webp", "hwp", "hwpx", "docx", "xlsx", "zip"],
    maxBytes: 20 * MB,
  },
};

export const FILE_KINDS = Object.keys(KIND_RULES) as FileKind[];

/** 확장자. 점이 없거나 이름 끝이 점이면 빈 문자열. */
export function extOf(name: string): string {
  const base = name.slice(name.lastIndexOf("/") + 1);
  const i = base.lastIndexOf(".");
  return i <= 0 || i === base.length - 1 ? "" : base.slice(i + 1).toLowerCase();
}

/**
 * 파일 앞부분의 매직 바이트로 실제 형식을 본다.
 * 확장자는 누구나 바꿀 수 있어서, .pdf 로 이름 붙인 실행 파일이 그대로 올라간다.
 */
export type Sniffed = "pdf" | "jpg" | "png" | "webp" | "zip" | null;

export function sniff(head: Uint8Array): Sniffed {
  const b = head;
  if (b.length >= 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "pdf"; // %PDF
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "png";
  // RIFF....WEBP
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "webp";
  // hwpx·docx·xlsx 는 전부 zip 이다. 여기서는 zip 까지만 가른다.
  if (b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07)) return "zip";
  return null;
}

/** 확장자와 실제 내용이 같은 것을 가리키는지. jpg/jpeg 는 같은 형식이다. */
export function extMatches(ext: string, sniffed: Sniffed): boolean {
  if (!sniffed) return false;
  if (sniffed === "jpg") return ext === "jpg" || ext === "jpeg";
  if (sniffed === "zip") return ["zip", "hwpx", "docx", "xlsx"].includes(ext);
  return ext === sniffed;
}

export type RejectCode = "EXT" | "SIZE" | "EMPTY" | "CONTENT" | "UNKNOWN_TYPE";
export type Validation = { ok: true } | { ok: false; code: RejectCode; why: string };

/**
 * 올려도 되는 파일인지.
 * 브라우저에서 한 번, 서버에서 또 한 번 부른다. 브라우저 검사는 안내용이고
 * 믿는 것은 서버 쪽뿐이다 — 브라우저는 사용자가 건너뛸 수 있다.
 */
export function validateUpload(name: string, size: number, kind: FileKind, head?: Uint8Array): Validation {
  const rule = KIND_RULES[kind];
  const ext = extOf(name);

  if (size <= 0) return { ok: false, code: "EMPTY", why: "빈 파일입니다." };
  if (!ext) return { ok: false, code: "EXT", why: "확장자가 없는 파일은 올릴 수 없습니다." };
  if (!rule.accept.includes(ext)) {
    return { ok: false, code: "EXT", why: `${kind}에는 ${rule.accept.join(", ")} 만 올릴 수 있습니다.` };
  }
  if (size > rule.maxBytes) {
    return { ok: false, code: "SIZE", why: `${formatBytes(rule.maxBytes)}까지 올릴 수 있습니다. 이 파일은 ${formatBytes(size)}입니다.` };
  }
  // 내용을 못 읽었으면 여기서 통과시키고 서버가 다시 본다
  if (!head) return { ok: true };

  const got = sniff(head);
  if (!got) return { ok: false, code: "UNKNOWN_TYPE", why: "내용을 알 수 없는 파일입니다. PDF 나 이미지로 다시 저장해 올려 주세요." };
  if (!extMatches(ext, got)) {
    return { ok: false, code: "CONTENT", why: `이름은 .${ext} 인데 실제 내용은 ${got.toUpperCase()} 입니다. 확장자만 바꾼 파일일 수 있습니다.` };
  }
  return { ok: true };
}

/**
 * 저장할 이름. 경로 조작을 막고 한 줄로 만든다.
 * 보여 줄 이름은 따로 들고 다니므로 여기서 한글을 버리지 않는다.
 */
export function safeName(raw: string): string {
  const base = String(raw ?? "").split(/[/\\]/).pop() ?? "";
  const cleaned = Array.from(base)
    .filter((ch) => {
      const c = ch.codePointAt(0)!;
      return c > 31 && c !== 127;
    })
    .join("")
    .replace(/^\.+/, "")
    .replace(/[<>:"|?*]/g, "_")
    .trim()
    .slice(0, 120);
  return cleaned || "파일";
}

/**
 * 저장소 안의 경로.
 * 파일 이름을 그대로 쓰지 않는다 — "김민수_주민등록증.jpg" 같은 경로는
 * 주소만 새어도 내용을 짐작하게 한다. 무작위 토큰으로 짓고 확장자만 남긴다.
 */
export function storageKey(scope: string, ownerId: string, token: string, name: string): string {
  const ext = extOf(name);
  const safeScope = scope.replace(/[^a-zA-Z0-9-]/g, "");
  const safeOwner = ownerId.replace(/[^a-zA-Z0-9_-]/g, "");
  const safeToken = token.replace(/[^a-zA-Z0-9_-]/g, "");
  return `${safeScope}/${safeOwner}/${safeToken}${ext ? `.${ext}` : ""}`;
}

/** 보존기간이 끝나는 날. 보존 의무가 없으면 null. */
export function retentionUntil(kind: FileKind, from: string): string | null {
  const months = KIND_RULES[kind].keepMonths;
  if (months === null) return null;
  const [y, m, d] = from.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  // 없는 날짜(2월 30일)는 말일로 당긴다
  const day = Math.min(d, new Date(ny, nm, 0).getDate());
  return `${ny}-${String(nm).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export type RetentionState = "보존 중" | "파기 대상" | "보존 의무 없음";

/**
 * 보존기간이 지난 파일은 지워야 한다. 쌓아 두는 것 자체가 위반이다.
 * 그래서 "언제까지"가 아니라 "지금 지워야 하는가"로 답한다.
 */
export function retentionState(kind: FileKind, uploadedAt: string, today: string): RetentionState {
  const until = retentionUntil(kind, uploadedAt);
  if (until === null) return "보존 의무 없음";
  return today > until ? "파기 대상" : "보존 중";
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < MB) return `${Math.round(n / 1024)}KB`;
  const mb = n / MB;
  return `${mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10}MB`;
}

/**
 * 내려받을 때 붙일 Content-Disposition.
 * 한글 이름은 그대로 넣으면 깨지므로 RFC 5987 로 한 번 더 적어 준다.
 */
export function contentDisposition(name: string): string {
  const safe = safeName(name);
  const ascii = Array.from(safe)
    .map((ch) => {
      const c = ch.codePointAt(0)!;
      if (ch === '"') return "'";
      return c >= 32 && c <= 126 ? ch : "_";
    })
    .join("");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}
