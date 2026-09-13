import { CUSTOMER_BODY_STATUSES, PERIOD_WINDOW_MS, SEGMENTS, STATUS_LABEL, TOPIC_LABEL } from "./taxonomy";
import type { CustomerRoute, Grade, Issue, Period, Segment, Topic } from "./types";

/**
 * 라우팅 규칙 R1~R8. 같은 보도자료가 중개사에게는 전문으로, 고객에게는 본문/한 줄/동네 타깃으로 가거나 제외됩니다.
 */

export interface RouteResult {
  customer: CustomerRoute;
  rules: string[];
  reasons: string[];
}

export function routeIssue(issue: Issue): RouteResult {
  const rules: string[] = [];
  const reasons: string[] = [];

  // R2 중개업 제도는 중개사 전용. 시행이 확정된 것만 고객에게 한 줄.
  if (issue.topic === "broker") {
    rules.push("R2");
    if (issue.status === "CONFIRMED" || issue.status === "SCHEDULED") {
      reasons.push("중개업 제도이지만 시행이 확정되어 고객에게 달라지는 점을 한 줄로만 알립니다.");
      return { customer: "watch", rules, reasons };
    }
    reasons.push("중개업 제도(중개보수·임장비·확인설명 의무 등)는 중개사 전용입니다.");
    return { customer: "exclude", rules, reasons };
  }

  const localTopic = issue.topic === "redev" || issue.topic === "transit" || issue.topic === "regulation";

  // R3 지자체 고시·동네 사안은 우리 지역 고객에게만. 전국구(지역 미설정)면 '우리 지역'이 없어 자동으로 꺼집니다.
  if (issue.status === "LOCAL_NOTICE" || (issue.region === "local" && issue.dong.length > 0 && localTopic)) {
    rules.push("R3");
    if (issue.region !== "local") {
      reasons.push("우리 지역이 아닌 지자체 고시·공고라 중개사용 참고로만 둡니다. 설정에서 시군구를 지정하면 그 지역 고시가 동네 타깃이 됩니다.");
      return { customer: "exclude", rules, reasons };
    }
    reasons.push(issue.dong.length ? `${issue.dong.join("·")} 거주·보유 고객에게만 발송합니다.` : "우리 지역 사안입니다. 동 정보를 채우면 해당 고객에게만 발송됩니다.");
    return { customer: "target", rules, reasons };
  }

  // E축: 특정 타 지역의 구역·교통·규제 사안은 고객용에서 제외. 통계·세금·금리처럼 지역과 무관한 주제는 그대로 둡니다.
  if (issue.region === "other" && localTopic) {
    rules.push("E");
    reasons.push("다른 지역의 구역·교통·규제 사안이라 중개사용 참고로만 둡니다.");
    return { customer: "exclude", rules, reasons };
  }

  // R1 단계로 1차 결정
  rules.push("R1");
  if (CUSTOMER_BODY_STATUSES.includes(issue.status)) {
    reasons.push(`${STATUS_LABEL[issue.status]} 단계라 고객용 본문에 실을 수 있습니다.`);
    if (issue.topic === "stat" && issue.region !== "national" && issue.region !== "local") {
      rules.push("R5");
      reasons.push("다른 지역 통계라 우리 지역 숫자 타일을 함께 싣습니다.");
    }
    return { customer: "body", rules, reasons };
  }
  reasons.push(`${STATUS_LABEL[issue.status]} 단계라 고객용에서는 '주요 뉴스' 카드(제목·기사 링크)로만 다룹니다.`);
  return { customer: "watch", rules, reasons };
}

export function segmentImpact(issue: Issue, segment: Segment): number {
  const personas = SEGMENTS[segment].personas;
  return Math.max(0, ...personas.map((p) => issue.personas[p] ?? 0));
}

export function maxSegmentImpact(issue: Issue): number {
  return Math.max(segmentImpact(issue, "first"), segmentImpact(issue, "move"), segmentImpact(issue, "asset"));
}

export function isFresh(issue: Issue, period: Period, now = Date.now()): boolean {
  const t = new Date(issue.publishedAt).getTime();
  if (Number.isNaN(t)) return false;
  return now - t <= PERIOD_WINDOW_MS[period];
}

/** 인박스 추천 등급: ★ 발송 권장 · ◎ 참고 · ○ 보관 */
export function gradeIssue(issue: Issue, now = Date.now()): Grade {
  const route = routeIssue(issue).customer;
  if (route === "exclude" || issue.review === "archived") return "keep";
  if (route === "body" && maxSegmentImpact(issue) >= 4 && isFresh(issue, "weekly", now)) return "star";
  if (route === "target" && isFresh(issue, "monthly", now)) return "star";
  return "ref";
}

/**
 * 주력 주제 가중치. 주력이면 0, 아니면 1 을 돌려주어 같은 등급·영향도 안에서만 순서를 당깁니다.
 * 규칙 R1~R8(고객 본문 여부·분량·신선도)은 그대로 두고 정렬에만 관여합니다.
 */
export function focusRank(topic: Topic, focus?: Topic[]): number {
  return focus && focus.length > 0 && focus.includes(topic) ? 0 : 1;
}

export const GRADE_LABEL: Record<Grade, string> = { star: "★ 발송 권장", ref: "◎ 참고", keep: "○ 보관" };
export const ROUTE_LABEL: Record<CustomerRoute, string> = {
  body: "고객 본문",
  watch: "주요 뉴스",
  target: "동네 타깃",
  exclude: "중개사 전용",
};

/** R7 고객용 금지 목록 — 걸리면 발행이 막힙니다. */
export const FORBIDDEN_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /고객에게/, label: "고객에게" },
  { re: /안내하세요/, label: "안내하세요" },
  { re: /설명하세요/, label: "설명하세요" },
  { re: /상담\s?시/, label: "상담 시" },
  { re: /영업/, label: "영업" },
  { re: /경쟁사|경쟁/, label: "경쟁" },
  { re: /수주/, label: "수주" },
  { re: /협회/, label: "협회" },
  { re: /DEMO|데모 데이터/i, label: "DEMO" },
  { re: /입력해 주세요|입력해주세요/, label: "입력해 주세요" },
  { re: /미설정/, label: "미설정" },
];

export function findForbidden(text: string): string[] {
  return FORBIDDEN_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.label);
}

export function describeTopic(issue: Issue): string {
  return TOPIC_LABEL[issue.topic];
}
