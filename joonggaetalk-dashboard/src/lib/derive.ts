import { appointments } from "@/data/appointments";
import { deals } from "@/data/deals";
import { FAIL_REASONS, sendBatches } from "@/data/sends";
import { registryWatches } from "@/data/registry";
import { addDays, TODAY } from "@/lib/format";
import type { CalEvent } from "@/components/dashboard/MonthCalendar";

export type Upcoming = { date: string; time: string; kind: "appt" | "deal" | "send"; title: string; sub: string; href: string; done?: boolean };

const DEAL_DATE_LABELS: [keyof typeof dealDateKeys, string][] = [
  ["contractDate", "계약일"],
  ["interimDate", "중도금일"],
  ["balanceDate", "잔금일"],
  ["moveInDate", "입주일"],
  ["expiryDate", "계약 만료일"],
];
const dealDateKeys = { contractDate: 1, interimDate: 1, balanceDate: 1, moveInDate: 1, expiryDate: 1 } as const;

/** 약속·계약 일정·발송을 한 줄로 모은다. */
export function allEvents(): Upcoming[] {
  const out: Upcoming[] = [];
  appointments.forEach((a) => {
    if (a.status === "취소") return;
    out.push({ date: a.date, time: a.time, kind: "appt", title: `${a.customerName} ${a.type}`, sub: a.propertyName ?? a.place, href: `/agent/appointments?date=${a.date}` });
  });
  deals.forEach((d) => {
    DEAL_DATE_LABELS.forEach(([k, label]) => {
      const v = d[k];
      if (v) out.push({ date: v, time: "", kind: "deal", title: `${label} · ${d.propertyName}`, sub: `${d.buyer !== "-" ? d.buyer : d.seller} · ${d.method}`, href: `/agent/deals?focus=${d.id}` });
    });
  });
  sendBatches.forEach((b) => {
    const [date, time] = b.scheduledAt.split(" ");
    out.push({ date, time, kind: "send", title: `${b.templateName} · ${b.total}명`, sub: b.trigger ? `${b.kind} · ${b.trigger}` : b.kind, href: `/agent/alimtalk/history?focus=${b.id}`, done: !!b.finishedAt });
  });
  return out.sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1));
}

export function upcoming(days = 7): Upcoming[] {
  const end = addDays(TODAY, days);
  // 이미 끝난 발송은 '다가오는' 목록에서 뺀다 (캘린더에는 남긴다)
  return allEvents().filter((e) => e.date >= TODAY && e.date <= end && !e.done);
}

export function calendarEvents(): CalEvent[] {
  return allEvents().map((e) => ({ date: e.date, kind: e.kind, title: e.title, sub: e.time || e.sub, href: e.href }));
}

export function todaysAppointments() {
  return appointments.filter((a) => a.date === TODAY && a.status === "예정").sort((a, b) => (a.time < b.time ? -1 : 1));
}

/** 최근 7일 실패 요약 — 다시 보낼 수 있는 건과 아닌 건을 구분한다. */
export function failedSummary() {
  const since = addDays(TODAY, -7);
  const recent = sendBatches.filter((b) => b.finishedAt && b.scheduledAt.slice(0, 10) >= since && b.failed > 0);
  const total = recent.reduce((s, b) => s + b.failed, 0);
  let retryable = 0;
  const byCode: Partial<Record<keyof typeof FAIL_REASONS, number>> = {};
  recent.forEach((b) =>
    b.items.forEach((it) => {
      if (it.status !== "실패" || !it.code) return;
      byCode[it.code] = (byCode[it.code] ?? 0) + 1;
      if (FAIL_REASONS[it.code].retryable) retryable++;
    }),
  );
  const cost = Math.round(retryable * 6.5 * 10) / 10;
  return { total, retryable, byCode, batches: recent, cost };
}

export function todaysSends() {
  const today = sendBatches.filter((b) => b.scheduledAt.startsWith(TODAY));
  const pending = today.filter((b) => b.pending > 0).reduce((s, b) => s + b.pending, 0);
  const tomorrow = sendBatches.filter((b) => b.scheduledAt.startsWith(addDays(TODAY, 1))).reduce((s, b) => s + b.pending, 0);
  return { pending, tomorrow };
}

export function registrySummary() {
  const failed = registryWatches.filter((w) => w.status === "실패").length;
  const changed = registryWatches.filter((w) => w.status === "변동").length;
  return { watching: registryWatches.length, failed, changed };
}

export function activeDeals() {
  return deals.filter((d) => d.status === "의뢰" || d.status === "계약");
}
