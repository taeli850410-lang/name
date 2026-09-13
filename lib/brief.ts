import { clamp, fmtDate } from "./format";
import { editionLabel, letterTitle } from "./letter";
import { links, TOPIC_LINKS } from "./links";
import { computeTiles } from "./market";
import { focusRank, gradeIssue, isFresh, maxSegmentImpact, ROUTE_LABEL, routeIssue } from "./routing";
import { sourceLinks, type SourceLink } from "./source";
import { PERIOD_LABEL, PERSONAS, REGION_LABEL, SEGMENTS, STATUS_LABEL, STATUS_TONE, TOPIC_LABEL } from "./taxonomy";
import type { Article, Glossary, HistoryPoint, Issue, Letter, LetterIssue, MarketDoc, MarketTile, Office, Period, Persona, Segment } from "./types";

/**
 * 브리핑 뷰 모델. 원본 EDM 의 구조(마스트헤드 → 슬로건 → 헤드라인 → 정책 카드 → 뉴스 → 숫자 →
 * 그래서 내 부동산에는? → 한마디 → CTA → 푸터)를 그대로 두고, 중개사용(그린)과 고객용(남색)이
 * 같은 렌더러를 씁니다. 내용의 깊이와 색만 다릅니다.
 */

export type Audience = "broker" | "customer";
export type BadgeTone = "agency" | "ok" | "warn" | "info" | "neutral" | "target" | "route";

export interface BriefBadge {
  label: string;
  tone: BadgeTone;
}
export interface BriefLink {
  label: string;
  href: string;
  kind: "primary" | "ghost" | "link";
  external?: boolean;
}
export interface BriefArticle {
  publisher: string;
  date: string;
  title: string;
  url: string;
}
export interface BriefList {
  title: string;
  items: string[];
}
export interface BriefCardModel {
  id: string;
  badges: BriefBadge[];
  date: string;
  title: string;
  lead?: string;
  bullets?: BriefList;
  extra?: BriefList;
  checklist?: BriefList;
  impact?: { label: string; value: string; dots?: number };
  /** 큰 버튼들: 원문·관련보도 보기(대표 기사) · 공식 원문 · 이슈 상세 */
  links: BriefLink[];
  /** 대표 기사를 뺀 관련 보도, 최신순 */
  articles: BriefArticle[];
  /** 최신 뉴스 검색(네이버·구글) */
  search: BriefLink[];
  /** 참고 사이트(공공데이터 바로가기) — 작게 */
  refs: BriefLink[];
}
export interface BriefNewsModel {
  id: string;
  badges: BriefBadge[];
  title: string;
  href: string | null;
  excerpt: string;
  /** 대표 기사를 뺀 관련 보도 */
  articles: BriefArticle[];
  /** 전체 기사 수 */
  count: number;
}
export interface BriefModel {
  audience: Audience;
  office: Office;
  kicker: string;
  vol: string;
  keynote: { main: string; sub: string };
  eyebrow: string;
  headline: string;
  policy: { title: string; sub: string; cards: BriefCardModel[]; empty: string };
  news?: { title: string; sub: string; items: BriefNewsModel[] };
  numbers: { title: string; sub: string; tiles: MarketTile[]; history: HistoryPoint[]; historyLabel: string; note: string };
  persona?: { title: string; sub: string; rows: { label: string; level: number; note: string }[]; note: string; glossary?: Glossary | null };
  comment?: { name: string; tag: string; body: string };
  cta: { title: string; sub: string; buttons: BriefLink[] };
  footer: { head: string; rows: [string, string][]; legal: string[]; links: { label: string; href: string }[] };
  demoNote?: string;
}

export const DISCLAIMER =
  "본 자료는 정부·공공기관의 발표자료 및 공개된 언론보도를 바탕으로 일반적인 부동산 정보를 제공하기 위해 작성되었습니다. 개별 부동산의 매수·매도·세무·법률 판단은 개인별 상황에 따라 달라질 수 있으므로 필요한 경우 관련 전문가의 별도 확인을 권합니다.";
export const AD_FOOTER =
  "본 자료는 일반적인 부동산 정보 제공을 목적으로 작성되었으며 개별적인 투자·세무·법률 판단을 대신하지 않습니다. 광고성 정보 수신에 동의한 고객에게 발송되었습니다.";
export const NUMBERS_NOTE = "※ 실거래 신고 기한이 30일이라 최근 두 달 수치는 잠정치이며 이후 늘어날 수 있습니다. 출처와 기준일이 확인되지 않은 수치는 표시하지 않습니다.";

/** 원본 EDM 의 섹션 제목·부제. 주기에 따라 '오늘/이번 주/이달'만 바뀝니다 */
export const PERIOD_EYEBROW: Record<Period, string> = { daily: "TODAY'S REAL ESTATE BRIEF", weekly: "THIS WEEK'S REAL ESTATE BRIEF", monthly: "THIS MONTH'S REAL ESTATE BRIEF" };
export const POLICY_TITLE: Record<Period, string> = { daily: "오늘 꼭 알아야 할 정책", weekly: "이번 주 꼭 알아야 할 정책", monthly: "이달 꼭 알아야 할 정책" };
export const NEWS_TITLE: Record<Period, string> = { daily: "오늘의 주요 뉴스", weekly: "이번 주 주요 뉴스", monthly: "이달의 주요 뉴스" };
export const NUMBERS_TITLE: Record<Period, string> = { daily: "오늘의 숫자", weekly: "이번 주 숫자", monthly: "이달의 숫자" };
export const PERSONA_TITLE = "그래서 내 부동산에는?";
export const PERSONA_NOTE = "※ 매수·매도 판단을 단정적으로 권하지 않습니다. 적용 여부는 주택 수·취득시기·지역·보유기간 등에 따라 달라질 수 있습니다.";
export const CTA_TITLE = "이 정책이 내 집에 어떤 영향을 주는지 궁금하신가요?";
export const CTA_SUB = "지금 매도할지 보유할지, 갈아타기를 계획 중이신지. 공인중개사가 확정된 숫자로 함께 정리해 드립니다.";

/** 고객에게 보이는 영향 대상 7종 — 원본 순서 */
const CUSTOMER_PERSONAS = PERSONAS.filter((p) => p !== "공인중개사");
const SEGMENT_OF: Partial<Record<Persona, Segment>> = Object.fromEntries(
  (Object.keys(SEGMENTS) as Segment[]).flatMap((s) => SEGMENTS[s].personas.map((p) => [p, s] as const)),
);

/** '그래서 내 부동산에는?' 행: 영향 대상별 영향도 + 그 대상이 속한 세그먼트의 한 줄 */
function personaRows(levels: Record<Persona, number>, forMe: Partial<Record<Segment, string>>, personas: Persona[]): { label: string; level: number; note: string }[] {
  return personas.map((p) => {
    const seg = SEGMENT_OF[p];
    const note = seg ? forMe[seg] || "" : "중개사 실무 영향 · 이슈 상세의 상담 스크립트 참고";
    return { label: p, level: levels[p] ?? 0, note };
  });
}

function officeRows(o: Office): [string, string][] {
  const rows: [string, string][] = [];
  if (o.repName) rows.push(["대표 공인중개사", o.repName]);
  if (o.phone) rows.push(["연락처", o.phone]);
  if (o.address) rows.push(["소재지", o.address]);
  if (o.registrationNo) rows.push(["등록번호", o.registrationNo]);
  return rows;
}

function dateLabel(publishedAt: string, effectiveAt: string | null): string {
  return effectiveAt ? `${fmtDate(effectiveAt)} 시행` : `${fmtDate(publishedAt)} 발표`;
}

const ext = (l: SourceLink, kind: BriefLink["kind"]): BriefLink => ({ label: l.label, href: l.href, kind, external: true });
const toBriefArticle = (a: Article): BriefArticle => ({ publisher: a.publisher, date: a.date, title: a.title, url: a.url });

/* ───────── 고객용: 발행된 레터 → 브리핑 모델 ───────── */

export function customerCard(item: LetterIssue, _index: number): BriefCardModel {
  const c = item.customer;
  const badges: BriefBadge[] = [
    { label: item.agency, tone: "agency" },
    { label: STATUS_LABEL[item.status], tone: STATUS_TONE[item.status] },
  ];
  if (item.targeted && item.dong.length) badges.push({ label: `${item.dong.join("·")} 소식`, tone: "target" });
  // 이전 스냅샷(articles 없음)은 대표 기사 한 건으로 복원합니다
  const arts: Article[] =
    item.articles ?? (item.articleUrl ? [{ publisher: (item.articleLabel ?? "기사").replace(/ 기사$/, ""), title: c.headline, url: item.articleUrl, date: item.publishedAt }] : []);
  const src = sourceLinks({ title: item.title ?? c.headline, officialUrl: item.officialUrl, articles: arts, agency: item.agency });
  const linkList: BriefLink[] = [];
  if (src.primary) linkList.push(ext(src.primary, "primary"));
  if (src.official) linkList.push(ext(src.official, "ghost"));
  return {
    id: item.issueId,
    badges,
    date: dateLabel(item.publishedAt, item.effectiveAt),
    title: c.headline,
    lead: c.what,
    bullets: c.actions.length ? { title: "지금 할 일", items: c.actions } : undefined,
    impact: item.forMe ? { label: "나에게는", value: item.forMe, dots: item.impact } : undefined,
    links: linkList,
    articles: src.related.map(toBriefArticle),
    search: src.search.map((l) => ext(l, "link")),
    refs: item.links.slice(0, 3).map((l) => ({ label: l.label, href: l.url, kind: "link" as const, external: true })),
  };
}

export function letterToBrief(letter: Letter): BriefModel {
  const o = letter.office;
  const telHref = o.phone ? `tel:${o.phone.replace(/[^0-9+]/g, "")}` : null;
  const unsubscribeHref = o.unsubscribeUrl || (o.email ? `mailto:${o.email}?subject=${encodeURIComponent("수신거부 요청")}` : null);
  const buttons: BriefLink[] = [];
  if (telHref) buttons.push({ label: `☏ ${o.phone}`, href: telHref, kind: "primary" });
  if (o.kakaoUrl) buttons.push({ label: "카카오톡으로 상담하기", href: o.kakaoUrl, kind: "ghost", external: true });

  const lead = letter.issues[0];
  const period = letter.period;
  const footLinks: { label: string; href: string }[] = [];
  if (unsubscribeHref) footLinks.push({ label: "수신거부", href: unsubscribeHref });
  if (o.privacyUrl) footLinks.push({ label: "개인정보처리방침", href: o.privacyUrl });
  const news: BriefNewsModel[] = letter.watch.map((w) => ({
    id: w.issueId,
    badges: [{ label: w.statusLabel, tone: "warn" as BadgeTone }],
    title: w.title,
    href: w.url,
    excerpt: `${w.statusLabel} 단계라 아직 확정되지 않았습니다. 기사 원문에서 구체 수치·일정·대상을 확인하세요.`,
    articles: (w.articles ?? []).map(toBriefArticle),
    count: w.count ?? (w.url ? 1 : 0),
  }));

  return {
    audience: "customer",
    office: o,
    kicker: `${PERIOD_LABEL[period]} BRIEFING · ${letter.editionLabel}`,
    vol: `${SEGMENTS[letter.segment].label} 호`,
    keynote: { main: o.slogan, sub: "확정된 정책과 우리 동네 숫자만 골라, 내 상황에 무엇이 달라지는지 3분 안에 정리해 드립니다." },
    eyebrow: `${PERIOD_EYEBROW[period]} · ${letter.editionLabel}`,
    headline: letter.headline,
    policy: {
      title: POLICY_TITLE[period],
      sub: "공식 고시·발표 종합 · 확정·시행 예정·통계만",
      cards: letter.issues.map(customerCard),
      empty: "이번 호에 실을 확정 이슈가 없습니다.",
    },
    news: news.length ? { title: NEWS_TITLE[period], sub: "기사 제목을 누르면 원문으로 이동합니다 · 확정 전 사안", items: news } : undefined,
    numbers: {
      title: NUMBERS_TITLE[period],
      sub: `${o.areaLabel} · 출처·기준일이 확인된 수치만 게시`,
      tiles: letter.tiles,
      history: letter.history,
      historyLabel: letter.historyLabel,
      note: NUMBERS_NOTE,
    },
    persona: lead
      ? {
          title: PERSONA_TITLE,
          sub: clamp(lead.customer.headline, 40),
          rows: lead.personas
            ? personaRows(lead.personas, lead.customer.forMe, CUSTOMER_PERSONAS)
            : letter.issues.map((it) => ({ label: clamp(it.customer.headline, 34), level: it.impact, note: it.forMe })),
          note: PERSONA_NOTE,
          glossary: letter.glossary,
        }
      : undefined,
    comment: letter.comment
      ? { name: o.repName ? `${o.repName} 공인중개사의 한마디` : `${o.officeName}의 한마디`, tag: "전문가 코멘트", body: letter.comment }
      : undefined,
    cta: { title: CTA_TITLE, sub: CTA_SUB, buttons },
    footer: {
      head: `${o.officeName} 안내`,
      rows: officeRows(o),
      legal: [DISCLAIMER, AD_FOOTER],
      links: footLinks,
    },
    demoNote: letter.id === "demo" ? "샘플 레터입니다. 스튜디오 → 설정에서 사무소 정보를 입력하고 레터 빌더에서 발행하면 실제 정보로 만들어집니다." : undefined,
  };
}

/* ───────── 중개사용: 인박스 이슈 → 브리핑 모델 ───────── */

const POLICY_LIMIT: Record<Period, number> = { daily: 4, weekly: 6, monthly: 8 };
const NEWS_LIMIT: Record<Period, number> = { daily: 8, weekly: 12, monthly: 12 };

function brokerCard(issue: Issue): BriefCardModel {
  const route = routeIssue(issue);
  const badges: BriefBadge[] = [
    { label: issue.agency, tone: "agency" },
    { label: STATUS_LABEL[issue.status], tone: STATUS_TONE[issue.status] },
    { label: ROUTE_LABEL[route.customer], tone: "route" },
  ];
  if (issue.region === "anyang") badges.push({ label: issue.dong.length ? `안양 · ${issue.dong.join("·")}` : "안양", tone: "target" });
  else if (issue.region !== "national") badges.push({ label: REGION_LABEL[issue.region], tone: "neutral" });
  if (issue.review === "draft") badges.push({ label: "검수 필요", tone: "warn" });

  const facts = issue.broker.facts.filter(Boolean);
  const src = sourceLinks({ title: issue.title, officialUrl: issue.officialUrl, articles: issue.articles, agency: issue.agency });
  const linkList: BriefLink[] = [];
  if (src.primary) linkList.push(ext(src.primary, "primary"));
  if (src.official) linkList.push(ext(src.official, "ghost"));
  linkList.push({ label: "이슈 상세", href: `/studio/issues/${issue.id}`, kind: "ghost" });

  const top = maxSegmentImpact(issue);
  return {
    id: issue.id,
    badges,
    date: dateLabel(issue.publishedAt, issue.effectiveAt),
    title: issue.title,
    lead: facts.length ? undefined : clamp(issue.summary, 180) || undefined,
    bullets: facts.length ? { title: "팩트", items: facts.slice(0, 4) } : undefined,
    extra: issue.broker.script.length ? { title: "상담 포인트", items: issue.broker.script.slice(0, 3) } : undefined,
    checklist: issue.broker.checklist.length ? { title: "실무 체크", items: issue.broker.checklist.slice(0, 4) } : undefined,
    impact: {
      label: "전문가 영향도 분석",
      value: issue.broker.local || `${TOPIC_LABEL[issue.topic]} · 세그먼트 최대 영향도 ${top}/5`,
      dots: top,
    },
    links: linkList,
    articles: src.related.map(toBriefArticle),
    search: src.search.map((l) => ext(l, "link")),
    refs: links(TOPIC_LINKS[issue.topic].broker)
      .slice(0, 2)
      .map((l) => ({ label: l.label, href: l.url, kind: "link" as const, external: true })),
  };
}

function brokerNews(issue: Issue): BriefNewsModel {
  const route = routeIssue(issue);
  const src = sourceLinks({ title: issue.title, officialUrl: issue.officialUrl, articles: issue.articles, agency: issue.agency });
  return {
    id: issue.id,
    badges: [
      { label: STATUS_LABEL[issue.status], tone: STATUS_TONE[issue.status] },
      { label: ROUTE_LABEL[route.customer], tone: "route" },
      ...(issue.region === "anyang" ? [{ label: "안양", tone: "target" as BadgeTone }] : []),
    ],
    title: issue.title,
    href: src.primary?.href ?? null,
    excerpt: clamp(issue.summary, 150),
    articles: src.related.map(toBriefArticle),
    count: issue.articles.filter((a) => a.url).length,
  };
}

export function buildBrokerBrief(issues: Issue[], office: Office, market: MarketDoc, period: Period, now = Date.now()): BriefModel {
  const gradeRank = { star: 0, ref: 1, keep: 2 } as const;
  const focus = office.focusTopics;
  const fresh = issues
    .filter((i) => i.review !== "archived" && isFresh(i, period, now))
    .map((i) => ({ i, g: gradeIssue(i, now) }))
    .sort((a, b) => {
      if (gradeRank[a.g] !== gradeRank[b.g]) return gradeRank[a.g] - gradeRank[b.g];
      const fa = focusRank(a.i.topic, focus);
      const fb = focusRank(b.i.topic, focus);
      if (fa !== fb) return fa - fb;
      return new Date(b.i.publishedAt).getTime() - new Date(a.i.publishedAt).getTime();
    })
    .map((x) => x.i);

  const policyIssues = fresh.slice(0, POLICY_LIMIT[period]);
  const newsIssues = fresh.slice(POLICY_LIMIT[period], POLICY_LIMIT[period] + NEWS_LIMIT[period]);
  const lead = policyIssues[0];
  const { tiles, history, historyLabel } = computeTiles(market, "move");
  const edition = editionLabel(period, now);

  return {
    audience: "broker",
    office,
    kicker: `${PERIOD_LABEL[period]} BRIEFING · ${edition}`,
    vol: "STUDIO",
    keynote: {
      main: "AI는 중개사를 대체하지 못합니다.\nAI를 아는 중개사가 대체합니다.",
      sub: "정부 발표와 시장 뉴스를 발표 주체·단계·주제·대상·지역으로 정리했습니다. 확정과 논의를 구분해 상담하세요.",
    },
    eyebrow: `${PERIOD_EYEBROW[period]} · ${edition}`,
    headline: lead ? lead.title : "이 기간에 새로 수집된 이슈가 없습니다",
    policy: {
      title: POLICY_TITLE[period],
      sub: "공식 고시·발표 종합 · 추천 등급 순 · 검수 전 이슈는 '검수 필요' 표시",
      cards: policyIssues.map(brokerCard),
      empty: "표시할 이슈가 없습니다. 인박스에서 '지금 수집'을 눌러 보세요.",
    },
    news: newsIssues.length ? { title: NEWS_TITLE[period], sub: "기사 제목을 누르면 원문으로 이동합니다", items: newsIssues.map(brokerNews) } : undefined,
    numbers: {
      title: NUMBERS_TITLE[period],
      sub: `${office.areaLabel} · 출처·기준일이 확인된 수치만 게시`,
      tiles,
      history,
      historyLabel,
      note: NUMBERS_NOTE,
    },
    persona: lead
      ? {
          title: PERSONA_TITLE,
          sub: clamp(lead.title, 40),
          rows: personaRows(lead.personas, lead.customer.forMe, PERSONAS),
          note: "※ 영향도는 분류기 초안입니다. 이슈 상세에서 수정하면 레터에도 반영됩니다.",
          glossary: lead.customer.glossary,
        }
      : undefined,
    comment: office.defaultComment
      ? { name: office.repName ? `${office.repName} 공인중개사의 한마디` : `${office.officeName}의 한마디`, tag: "전문가 코멘트 · 레터에 실을 기본 문구, 설정에서 수정", body: office.defaultComment }
      : undefined,
    cta: {
      title: "고객용 레터를 만들 준비가 됐습니다",
      sub: "검수 완료된 이슈만 규칙 R1~R8을 거쳐 세그먼트별 레터로 발행됩니다.",
      buttons: [
        { label: "레터 빌더 열기", href: "/studio/letters", kind: "primary" },
        { label: "인박스에서 검수하기", href: "/studio", kind: "ghost" },
      ],
    },
    footer: {
      head: `${office.officeName} · 중개사용`,
      rows: officeRows(office),
      legal: ["중개사 내부용 자료입니다. 이 화면을 고객에게 그대로 전달하지 마세요. 고객용은 레터 빌더에서 금지 표현 검사와 분량 규칙을 거쳐 발행됩니다."],
      links: [
        { label: "인박스", href: "/studio" },
        { label: "우리 동네 숫자", href: "/studio/data" },
      ],
    },
  };
}
