import { GRADE_LABEL, ROUTE_LABEL } from "@/lib/routing";
import { regionLabel, STATUS_LABEL, STATUS_TONE, TOPIC_LABEL } from "@/lib/taxonomy";
import type { CustomerRoute, Grade, Region, Status, Topic } from "@/lib/types";

export function StatusPill({ status }: { status: Status }) {
  return <span className={`chip chip-${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>;
}

export function TopicChip({ topic }: { topic: Topic }) {
  return <span className="chip chip-outline">{TOPIC_LABEL[topic]}</span>;
}

export function RegionChip({ region, dong, place }: { region: Region; dong?: string[]; place?: string | null }) {
  const base = regionLabel(region, place);
  const label = dong && dong.length ? `${base} · ${dong.join("·")}` : base;
  return <span className={`chip ${region === "local" ? "chip-c" : "chip-neutral"}`}>{label}</span>;
}

export function AgencyBadge({ agency }: { agency: string }) {
  return <span className="chip chip-b">{agency}</span>;
}

export function GradeChip({ grade }: { grade: Grade }) {
  const cls = grade === "star" ? "chip-star" : grade === "ref" ? "chip-neutral" : "chip-outline";
  return <span className={`chip ${cls}`}>{GRADE_LABEL[grade]}</span>;
}

export function RouteChip({ route }: { route: CustomerRoute }) {
  const cls = route === "body" ? "chip-c" : route === "target" ? "chip-warn" : route === "watch" ? "chip-neutral" : "chip-outline";
  return <span className={`chip ${cls}`}>{ROUTE_LABEL[route]}</span>;
}

export function ReviewChip({ review }: { review: "draft" | "reviewed" | "archived" }) {
  if (review === "reviewed") return <span className="chip chip-ok">검수 완료</span>;
  if (review === "archived") return <span className="chip chip-outline">보관</span>;
  return <span className="chip chip-warn">초안 · 검수 필요</span>;
}
