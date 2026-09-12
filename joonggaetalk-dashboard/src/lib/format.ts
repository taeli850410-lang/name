/**
 * 날짜·숫자·전화번호 표기 — 서버/클라이언트에서 같은 결과가 나오도록
 * toLocale* 계열은 쓰지 않고 직접 조립한다(하이드레이션 불일치 방지).
 */

/** 프로토타입의 '오늘'. 실제 서비스에서는 서버 시각으로 대체. */
export const TODAY = "2026-09-12";

export const DOW_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** "YYYY-MM-DD" → Date(로컬 자정). */
export function parseDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function addDays(iso: string, days: number): string {
  const d = parseDate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** 두 날짜의 일수 차이 (b - a). */
export function diffDays(a: string, b: string): number {
  const ms = parseDate(b).getTime() - parseDate(a).getTime();
  return Math.round(ms / 86400000);
}

/** D-day 표기. 오늘이면 "D-day", 미래면 "D-3", 과거면 "D+2". */
export function dday(iso: string, base: string = TODAY): string {
  const n = diffDays(base, iso);
  if (n === 0) return "D-day";
  return n > 0 ? `D-${n}` : `D+${Math.abs(n)}`;
}

/** "9월 12일(토)" */
export function formatKoDate(iso: string, withYear = false): string {
  const d = parseDate(iso);
  const base = `${d.getMonth() + 1}월 ${d.getDate()}일(${DOW_KO[d.getDay()]})`;
  return withYear ? `${d.getFullYear()}년 ${base}` : base;
}

/** "09-12(토)" */
export function formatShortDate(iso: string): string {
  const d = parseDate(iso);
  return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}(${DOW_KO[d.getDay()]})`;
}

/** "2026-09-12 12:35" → "09-12 12:35" */
export function formatDateTime(iso: string): string {
  const [date, time = ""] = iso.split(" ");
  return `${date.slice(5)} ${time.slice(0, 5)}`.trim();
}

/** "12:35" → "오후 12:35" */
export function formatTimeKo(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h < 12 ? "오전" : "오후";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${ampm} ${hh}:${pad2(m)}`;
}

/** 상대 표현: 오늘 / 내일 / 3일 후 / 2일 전 */
export function relativeDay(iso: string, base: string = TODAY): string {
  const n = diffDays(base, iso);
  if (n === 0) return "오늘";
  if (n === 1) return "내일";
  if (n === -1) return "어제";
  return n > 0 ? `${n}일 후` : `${Math.abs(n)}일 전`;
}

export function formatNumber(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** 만원 단위 금액 → "3억 5,000만원" */
export function formatManwon(manwon: number): string {
  if (!manwon) return "0원";
  const eok = Math.floor(manwon / 10000);
  const rest = manwon % 10000;
  if (eok && rest) return `${eok}억 ${formatNumber(rest)}만원`;
  if (eok) return `${eok}억원`;
  return `${formatNumber(rest)}만원`;
}

/** 원 단위 소수 허용 금액 → "1,059.5원" */
export function formatWon(won: number): string {
  const fixed = Number.isInteger(won) ? String(won) : won.toFixed(1);
  const [int, dec] = fixed.split(".");
  return `${formatNumber(Number(int))}${dec ? "." + dec : ""}원`;
}

export function formatPhone(raw: string): string {
  const p = raw.replace(/\D/g, "");
  if (/^01[016789]/.test(p) && p.length === 11) return `${p.slice(0, 3)}-${p.slice(3, 7)}-${p.slice(7)}`;
  if (p.startsWith("02") && p.length === 10) return `${p.slice(0, 2)}-${p.slice(2, 6)}-${p.slice(6)}`;
  if (p.length === 10) return `${p.slice(0, 3)}-${p.slice(3, 6)}-${p.slice(6)}`;
  return raw;
}

/** 가운데 4자리 마스킹: 010-****-1234 */
export function maskPhone(raw: string): string {
  const f = formatPhone(raw);
  const parts = f.split("-");
  if (parts.length === 3) return `${parts[0]}-****-${parts[2]}`;
  return f;
}

export function compact(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(n % 10000 === 0 ? 0 : 1)}만`;
  if (n >= 1000) return formatNumber(n);
  return String(n);
}

/** 결정적 의사난수 (mulberry32) — 서버/클라이언트 동일한 목업 데이터를 위해. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rnd: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rnd() * arr.length)];
}
