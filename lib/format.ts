/** 표시용 포맷 함수 */

const pad2 = (n: number) => String(n).padStart(2, "0");

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`;
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${fmtDate(iso)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** 만원 단위 정수 → "7억 2,000만원" */
export function fmtManwon(v: number | null | undefined, unit = "만원"): string {
  if (v == null || Number.isNaN(v)) return "산출 불가";
  const n = Math.round(v);
  if (n < 10000) return `${n.toLocaleString("ko-KR")}${unit}`;
  const eok = Math.floor(n / 10000);
  const rest = n % 10000;
  return rest === 0 ? `${eok}억원` : `${eok}억 ${rest.toLocaleString("ko-KR")}${unit}`;
}

export function fmtPct(v: number, digits = 1): string {
  const s = Math.abs(v).toFixed(digits);
  if (v > 0) return `▲ ${s}%`;
  if (v < 0) return `▼ ${s}%`;
  return "보합";
}

export function relTime(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = now.getTime() - t;
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "방금";
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 31) return `${d}일 전`;
  return fmtDate(iso);
}

export function dots(n: number): string {
  const k = Math.max(0, Math.min(5, Math.round(n)));
  return "●".repeat(k) + "○".repeat(5 - k);
}

export function clamp(s: string, n: number): string {
  const t = (s || "").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

export function stripHtml(s: string): string {
  return (s || "")
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function newId(prefix = ""): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `${prefix}${t}${r}`;
}

/** 안양 실거래 월 키 "2026-06" → "26.06" */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${y.slice(2)}.${m}`;
}

/** 상단 바의 수집 시각: "09. 12. 오후 07:45" (한국 시간, ICU 로캘 데이터에 의존하지 않음) */
export function fmtCollect(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const k = new Date(d.getTime() + 9 * 3600 * 1000); // KST = UTC+9, 서머타임 없음
  const p2 = (n: number) => String(n).padStart(2, "0");
  const h = k.getUTCHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${p2(k.getUTCMonth() + 1)}. ${p2(k.getUTCDate())}. ${h < 12 ? "오전" : "오후"} ${p2(h12)}:${p2(k.getUTCMinutes())}`;
}
