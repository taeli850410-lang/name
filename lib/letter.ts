import { newId } from "./format";
import { links, TOPIC_LINKS } from "./links";
import { sortArticles, sourceLinks } from "./source";
import { computeTiles } from "./market";
import { findForbidden, focusRank, gradeIssue, isFresh, routeIssue, segmentImpact } from "./routing";
import { pickVideos } from "./channels";
import { PERIOD_LIMIT, PERIOD_TITLE, SEGMENTS, STATUS_LABEL, TOPIC_GLOSSARY } from "./taxonomy";
import type { Issue, Letter, LetterIssue, MarketDoc, Office, Period, Segment, Validation, VideoItem, WatchItem } from "./types";

/** 고객용 EDM 생성·검증·발행. 모두 순수 함수이며 저장은 호출자가 합니다. */

const pad2 = (n: number) => String(n).padStart(2, "0");
const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export function editionLabel(period: Period, now = Date.now()): string {
  const d = new Date(now);
  if (period === "daily") return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())} ${DOW[d.getDay()]}`;
  if (period === "weekly") {
    const diffToMon = d.getDay() === 0 ? -6 : 1 - d.getDay();
    const mon = new Date(d);
    mon.setDate(d.getDate() + diffToMon);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return `${mon.getFullYear()}.${pad2(mon.getMonth() + 1)}.${pad2(mon.getDate())} – ${pad2(sun.getMonth() + 1)}.${pad2(sun.getDate())}`;
  }
  return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}`;
}

export interface BuildOptions {
  period: Period;
  segment: Segment;
  dong?: string | null;
  now?: number;
  comment?: string;
  /** 상단 영상 기사란에 실을 영상. 발행하면 이 스냅샷 그대로 남습니다 */
  videos?: VideoItem[];
}

function toLetterIssue(issue: Issue, segment: Segment, targeted: boolean): LetterIssue {
  const forMe = issue.customer.forMe[segment] || issue.customer.forMe.first || issue.customer.forMe.move || issue.customer.forMe.asset || "";
  // 대표 기사(첫 항목)는 그대로, 나머지는 최신순으로 스냅샷에 담습니다
  const [lead, ...rest] = issue.articles.filter((a) => a.url);
  const arts = (lead ? [lead, ...sortArticles(rest)] : []).slice(0, 5).map(({ publisher, title, url, date }) => ({ publisher, title, url, date }));
  const first = arts[0];
  return {
    issueId: issue.id,
    agency: issue.agency,
    status: issue.status,
    topic: issue.topic,
    publishedAt: issue.publishedAt,
    effectiveAt: issue.effectiveAt,
    officialUrl: issue.officialUrl,
    articleUrl: first?.url ?? null,
    articleLabel: first ? `${first.publisher} 기사` : null,
    title: issue.title,
    articles: arts,
    personas: issue.personas,
    customer: issue.customer,
    forMe,
    impact: segmentImpact(issue, segment),
    links: links(TOPIC_LINKS[issue.topic].customer).slice(0, 3),
    dong: issue.dong,
    targeted,
  };
}

export function buildDraft(issues: Issue[], office: Office, market: MarketDoc, opts: BuildOptions): Letter {
  const now = opts.now ?? Date.now();
  const { period, segment } = opts;
  const dong = opts.dong?.trim() || null;

  const fresh = issues.filter((i) => i.review === "reviewed" && isFresh(i, period, now));
  const routed = fresh.map((i) => ({ i, r: routeIssue(i), g: gradeIssue(i, now) }));

  const targets = dong ? routed.filter((x) => x.r.customer === "target" && x.i.dong.includes(dong)) : [];
  const bodies = routed.filter((x) => x.r.customer === "body" && segmentImpact(x.i, segment) >= 3);

  // 등급 → 세그먼트 영향도 → 주력 주제 → 최신순. 주력 주제는 앞의 두 조건이 같을 때만 순서를 당깁니다.
  const focus = office.focusTopics;
  const gradeRank = { star: 0, ref: 1, keep: 2 } as const;
  const ranked = [
    ...targets.map((x) => ({ ...x, targeted: true })),
    ...bodies
      .map((x) => ({ ...x, targeted: false }))
      .sort((a, b) => {
        if (gradeRank[a.g] !== gradeRank[b.g]) return gradeRank[a.g] - gradeRank[b.g];
        const ia = segmentImpact(a.i, segment);
        const ib = segmentImpact(b.i, segment);
        if (ia !== ib) return ib - ia;
        const fa = focusRank(a.i.topic, focus);
        const fb = focusRank(b.i.topic, focus);
        if (fa !== fb) return fa - fb;
        return new Date(b.i.publishedAt).getTime() - new Date(a.i.publishedAt).getTime();
      }),
  ];

  // 같은 주제 2개까지, 같은 이슈 중복 없이
  const topicCount = new Map<string, number>();
  const picked: LetterIssue[] = [];
  const seen = new Set<string>();
  for (const x of ranked) {
    if (seen.has(x.i.id)) continue;
    const c = topicCount.get(x.i.topic) ?? 0;
    if (c >= 2 && !x.targeted) continue;
    topicCount.set(x.i.topic, c + 1);
    seen.add(x.i.id);
    picked.push(toLetterIssue(x.i, segment, x.targeted));
    if (picked.length >= PERIOD_LIMIT[period]) break;
  }

  // 확정 전 사안은 '주요 뉴스' 카드(제목·기사 링크만)로 싣습니다. DAILY 3 · WEEKLY/MONTHLY 5
  const watch: WatchItem[] = routed
    .filter((x) => x.r.customer === "watch" && !seen.has(x.i.id))
    .sort((a, b) => new Date(b.i.publishedAt).getTime() - new Date(a.i.publishedAt).getTime())
    .slice(0, period === "daily" ? 3 : 5)
    .map((x) => {
      const src = sourceLinks({ title: x.i.title, officialUrl: x.i.officialUrl, articles: x.i.articles });
      return {
        issueId: x.i.id,
        title: x.i.customer.headline || x.i.title,
        statusLabel: STATUS_LABEL[x.i.status],
        date: x.i.publishedAt,
        url: src.primary?.href ?? null,
        articles: src.related.map(({ publisher, title, url, date }) => ({ publisher, title, url, date })),
        count: x.i.articles.filter((a) => a.url).length,
      };
    });

  const { tiles, history, historyLabel } = computeTiles(market, segment);
  const withGlossary = picked.find((p) => p.customer.glossary);
  const glossary = withGlossary?.customer.glossary ?? (picked[0] ? TOPIC_GLOSSARY[picked[0].topic] : TOPIC_GLOSSARY.rate);

  return {
    id: newId("draft-"),
    period,
    segment,
    dong,
    status: "draft",
    createdAt: new Date(now).toISOString(),
    publishedAt: null,
    editionLabel: editionLabel(period, now),
    office,
    headline: picked[0]?.customer.headline ?? "이번 호에 실을 확정 이슈가 아직 없습니다",
    issues: picked,
    watch,
    tiles,
    history,
    historyLabel,
    regions: market.regions,
    comment: opts.comment ?? office.defaultComment,
    glossary,
    videos: pickVideos(opts.videos ?? [], period, undefined, now),
  };
}

export function validateLetter(letter: Letter): Validation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const o = letter.office;

  const required: [keyof Office, string][] = [
    ["officeName", "중개사무소 상호"],
    ["repName", "대표 공인중개사 성명"],
    ["registrationNo", "중개사무소 등록번호"],
    ["phone", "연락처"],
  ];
  for (const [k, label] of required) if (!String(o[k] || "").trim()) errors.push(`사무소 정보에 ${label}이(가) 없습니다. 설정에서 입력하세요.`);
  if (!o.unsubscribeUrl && !o.email) errors.push("수신거부 링크 또는 수신거부용 이메일이 없습니다. 광고성 메일에는 실제로 동작하는 수신거부 수단이 필요합니다.");
  if (letter.issues.length === 0) errors.push("실을 이슈가 없습니다. 검수 완료된 확정·통계 이슈가 신선도 창 안에 있어야 합니다.");

  const texts: [string, string][] = [["오늘의 한 줄", letter.headline], ["중개사의 한마디", letter.comment]];
  letter.issues.forEach((it, idx) => {
    texts.push([`이슈 ${idx + 1} 제목`, it.customer.headline]);
    texts.push([`이슈 ${idx + 1} 무슨 일`, it.customer.what]);
    texts.push([`이슈 ${idx + 1} 나에게는`, it.forMe]);
    it.customer.actions.forEach((a, j) => texts.push([`이슈 ${idx + 1} 할 일 ${j + 1}`, a]));
    if (!it.customer.headline.trim() || !it.customer.what.trim()) errors.push(`이슈 ${idx + 1}: 고객용 제목 또는 '무슨 일' 본문이 비어 있습니다.`);
    if (!it.forMe.trim()) warnings.push(`이슈 ${idx + 1}: 이 세그먼트의 '나에게는' 문장이 비어 있습니다.`);
  });
  for (const [where, text] of texts) {
    const hits = findForbidden(text || "");
    if (hits.length) errors.push(`${where}에 고객용 금지 표현이 있습니다: ${hits.join(", ")}`);
  }

  if (!o.kakaoUrl) warnings.push("카카오톡 채널 주소가 없어 상담 버튼은 전화만 표시됩니다.");
  if (letter.tiles.some((t) => t.provisional)) warnings.push("우리 동네 숫자 중 잠정치(신고 기한 미도래 월)가 포함되어 '잠정' 표시가 붙습니다.");
  if (letter.issues.length < PERIOD_LIMIT[letter.period]) warnings.push(`분량 상한(${PERIOD_LIMIT[letter.period]}개)보다 적은 ${letter.issues.length}개 이슈입니다.`);
  if (letter.period !== "daily" && letter.watch.length === 0) warnings.push("'주요 뉴스'(확정 전 사안)가 비어 있습니다.");
  return { errors, warnings };
}

export function publishLetter(draft: Letter, now = Date.now()): Letter {
  return { ...draft, id: newId("l"), status: "published", publishedAt: new Date(now).toISOString() };
}

export function letterTitle(letter: Letter): string {
  return `${PERIOD_TITLE[letter.period]} · ${letter.editionLabel}`;
}

export function segmentLabel(segment: Segment): string {
  return SEGMENTS[segment].label;
}

export function shareText(letter: Letter, url: string): string {
  const o = letter.office;
  const lines = letter.issues.slice(0, 3).map((it, i) => `${["①", "②", "③"][i]} ${it.customer.headline}`);
  return [
    `[${o.officeName}] ${letterTitle(letter)}`,
    "",
    letter.headline,
    "",
    ...lines,
    "",
    "▶ 전체 브리핑 보기",
    url,
    "",
    `${o.officeName}${o.repName ? ` · ${o.repName} 공인중개사` : ""}${o.phone ? ` · ${o.phone}` : ""}`,
  ].join("\n");
}
