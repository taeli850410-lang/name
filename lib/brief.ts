import { clamp, fmtDate } from "./format";
import { editionLabel, letterTitle } from "./letter";
import { links, TOPIC_LINKS } from "./links";
import { computeTiles } from "./market";
import { focusRank, gradeIssue, isFresh, maxSegmentImpact, ROUTE_LABEL, routeIssue } from "./routing";
import { pickVideos, VIDEO_MAX_AGE } from "./channels";
import { isRealEstateRelevant } from "./classify";
import { descriptionPoints } from "./video";
import { sourceLinks, type SourceLink } from "./source";
import { PERIOD_LABEL, PERSONAS, regionLabel, SEGMENTS, STATUS_LABEL, STATUS_TONE, TOPIC_LABEL } from "./taxonomy";
import type { Article, Glossary, HistoryPoint, Issue, Letter, LetterIssue, MarketDoc, MarketTile, Office, Period, Persona, Segment, Topic, VideoItem } from "./types";

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
/** 상단 영상 기사란 한 칸 */
export interface BriefVideoModel {
  id: string;
  title: string;
  channel: string;
  channelUrl: string | null;
  topicLabel: string;
  place?: string | null;
  summary: string;
  /** 설명문 첫 문장 — 대표 영상 카드의 리드 */
  lead: string;
  /** 설명문의 ①②③ 꼭지 — '이 영상에서 다루는 것' */
  points: string[];
  url: string;
  thumb: string;
  date: string;
  /** 이 영상과 같은 주제의 보도 — 대표 영상에만 채웁니다 */
  articles: BriefArticle[];
  /** 영상에서 확인되는 것. 보도한 곳과 날짜를 붙여 출처를 남깁니다 */
  fact?: string;
  /** 중개사가 판단할 것. 사실이 아니라 해석이라는 걸 화면에서 갈라 보여 줍니다 */
  analysis?: string;
}

/** 영상 한 편에 딸리는 보도 묶음을 찾을 때 쓰는 최소 정보 */
export interface VideoNewsSource {
  topic: Topic;
  place?: string | null;
  publishedAt: string;
  articles: Article[];
}

export interface BriefModel {
  audience: Audience;
  office: Office;
  kicker: string;
  vol: string;
  keynote: { main: string; sub: string };
  eyebrow: string;
  headline: string;
  /** 정책 섹션 위에 서는 영상 기사란. 수집된 영상이 없으면 없습니다 */
  video?: { brand: string; title: string; sub: string; head: BriefVideoModel; items: BriefVideoModel[] };
  policy: { title: string; sub: string; cards: BriefCardModel[]; empty: string };
  news?: { title: string; sub: string; items: BriefNewsModel[] };
  numbers: { title: string; sub: string; tiles: MarketTile[]; history: HistoryPoint[]; historyLabel: string; note: string };
  persona?: { title: string; sub: string; rows: { label: string; level: number; note: string }[]; note: string; glossary?: Glossary | null };
  comment?: { name: string; tag: string; body: string };
  cta: { title: string; sub: string; buttons: BriefLink[] };
  footer: { head: string; rows: [string, string][]; legal: string[]; links: { label: string; href: string }[] };
}

export const DISCLAIMER =
  "본 자료는 정부·공공기관의 발표자료 및 공개된 언론보도를 바탕으로 일반적인 부동산 정보를 제공하기 위해 작성되었습니다. 개별 부동산의 매수·매도·세무·법률 판단은 개인별 상황에 따라 달라질 수 있으므로 필요한 경우 관련 전문가의 별도 확인을 권합니다.";
export const AD_FOOTER =
  "본 자료는 일반적인 부동산 정보 제공을 목적으로 작성되었으며 개별적인 투자·세무·법률 판단을 대신하지 않습니다. 광고성 정보 수신에 동의한 고객에게 발송되었습니다.";
export const NUMBERS_NOTE = "※ 실거래 신고 기한이 30일이라 최근 두 달 수치는 잠정치이며 이후 늘어날 수 있습니다. 출처와 기준일이 확인되지 않은 수치는 표시하지 않습니다.";

/** 실거래 타일이 어느 지역 집계인지 밝히고, 아직 설정하지 않았으면 안내합니다 */
export function numbersNote(office: Office, marketArea: string): string {
  if ((office.lawdCodes ?? []).length > 0) return `${NUMBERS_NOTE} 실거래 집계 대상: ${marketArea}.`;
  return `${NUMBERS_NOTE} 지금 실거래 집계는 샘플(${marketArea})입니다. 설정 → 지역에서 시군구와 법정동코드 5자리를 넣으면 그 지역 수치로 갱신됩니다.`;
}

/** 원본 EDM 의 섹션 제목·부제. 주기에 따라 '오늘/이번 주/이달'만 바뀝니다 */
export const PERIOD_EYEBROW: Record<Period, string> = { daily: "TODAY'S REAL ESTATE BRIEF", weekly: "THIS WEEK'S REAL ESTATE BRIEF", monthly: "THIS MONTH'S REAL ESTATE BRIEF" };
export const POLICY_TITLE: Record<Period, string> = { daily: "오늘 꼭 알아야 할 정책", weekly: "이번 주 꼭 알아야 할 정책", monthly: "이달 꼭 알아야 할 정책" };
export const NEWS_TITLE: Record<Period, string> = { daily: "오늘의 주요 뉴스", weekly: "이번 주 주요 뉴스", monthly: "이달의 주요 뉴스" };
export const NUMBERS_TITLE: Record<Period, string> = { daily: "오늘의 숫자", weekly: "이번 주 숫자", monthly: "이달의 숫자" };
export const VIDEO_TITLE: Record<Period, string> = { daily: "오늘의 영상 기사", weekly: "이번 주 영상 기사", monthly: "이달의 영상 기사" };
export const VIDEO_SUB = "언론사·공공기관 유튜브 채널이 만든 영상 보도입니다 · 제목을 누르면 유튜브로 이동합니다";
export const VIDEO_POINTS_TITLE = "이 영상에서 다루는 것";
/**
 * 영상 기사란 코너 이름. 설정에서 바꾸고, 비우면 코너 이름 없이 제목만 섭니다.
 *
 * 마스트헤드가 REAL ESTATE REPORT ALERT 라서 코너까지 REPORT 를 쓰면 같은 말이 두 번 섭니다.
 * 이 코너는 영상을 '보고' 그 아래에서 사실과 해석을 갈라 읽는 자리라 VIEW 가 두 뜻으로 맞습니다.
 */
export const VIDEO_BRAND = "NEWS VIEW";
/**
 * ANALYSIS 칸에 들어가는 문장. 영상이 말한 내용을 옮기는 게 아니라,
 * 그 주제에서 중개사가 원문을 열고 무엇부터 확인해야 하는지를 적습니다.
 * 사실(FACT)과 섞이면 안 되는 칸이라 지어낸 시장 전망은 넣지 않습니다.
 */
export const VIDEO_ANALYSIS: Record<Topic, string> = {
  rate: "적용 시점과 대상 대출(신규·대환·생활안정)을 원문에서 확인하세요. 기존 차주에게 소급되는지가 상담의 갈림길입니다.",
  tax: "취득·보유·양도 중 어느 단계인지, 시행일 기준이 계약일인지 잔금일인지 확인하세요. 주택 수 산정이 함께 바뀌는 경우가 많습니다.",
  subs: "공급 유형(특별·일반)과 거주·무주택 기간 요건, 재당첨 제한 기간을 확인하세요. 지역별로 요건이 갈립니다.",
  supply: "지구 지정인지 착공·분양 일정인지 단계를 확인하세요. 발표 물량과 실제 입주 시점은 몇 년 차이가 납니다.",
  redev: "어느 단계(조합설립·사업시행·관리처분)의 이야기인지 확인하세요. 단계마다 조합원 지위 양도 가능 여부가 달라집니다.",
  lease: "보증금 보호 한도와 대항력·우선변제 요건에 영향이 있는지 확인하세요. 계약 중인 임차인에게 소급되는지가 핵심입니다.",
  transit: "예비타당성·기본계획·착공 중 어느 단계인지 확인하세요. 노선도만 보고 개통 시점을 말하지 않습니다.",
  stat: "조사 기관과 기준일, 표본을 확인하세요. 실거래 신고 기한 30일 때문에 최근 두 달 수치는 잠정치입니다.",
  regulation: "지정·해제의 효력 발생일과 대상 구역 경계를 확인하세요. 거래허가는 계약 체결 전에 받아야 합니다.",
  broker: "시행일과 적용 대상 중개행위를 확인하세요. 기존 계약·기존 등록 사무소에 소급되는지 함께 봐야 합니다.",
};

export const VIDEO_FACT_LABEL = "FACT";
export const VIDEO_ANALYSIS_LABEL = "ANALYSIS";
export const VIDEO_SPLIT_TITLE = "전문가 영향도 분석";
export const VIDEO_SUMMARY_TITLE = "핵심 요약";
export const VIDEO_RELATED_TITLE = "관련 기사";
export const VIDEO_CTA = "원문·관련보도 보기";
/** 플레이어 위 좌우에 앉는 꼬리표 */
export const VIDEO_TAG = "VIDEO NEWS";
export const VIDEO_ASIDE = "관련 영상";

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
    video: videoSection(
      letter.videos,
      period,
      o.videoBrand ?? VIDEO_BRAND,
      // 레터 스냅샷에는 지역이 실리지 않습니다. 주제만으로 묶고, 지역 가산점은 중개사용에서만 씁니다
      letter.issues.map((i) => ({ topic: i.topic, publishedAt: i.publishedAt, articles: i.articles ?? [] })),
    ),
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
      note: numbersNote(o, letter.historyLabel.replace(/ 매매 중위가.*$/, "")),
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
  };
}

/**
 * 영상과 같은 주제의 보도를 골라 붙입니다.
 *
 * 영상은 이슈와 따로 수집되기 때문에, 그대로 두면 영상 한 편이 아무 데로도 이어지지 않습니다.
 * 같은 주제(그리고 영상에 지역이 찍혀 있으면 같은 시도)의 기사를 최신순으로 세 건까지 붙여
 * '영상 → 요약 → 해석 → 원문' 한 흐름으로 만듭니다. 억지로 채우지 않습니다 — 없으면 빈 배열입니다.
 */
function relatedForVideo(v: VideoItem, pool: VideoNewsSource[], period: Period, limit = 3): BriefArticle[] {
  // 이슈는 정책 섹션 기준(주간이면 7일)으로 걸러져 들어오지만 영상은 그보다 오래된 것도 실립니다.
  // 그래서 '이번 호에 실린 기간'이 아니라 '이 영상이 올라온 무렵'을 기준으로 봅니다.
  const span = VIDEO_MAX_AGE[period] * 86400000;
  const vAt = new Date(v.publishedAt).getTime();
  const sameTopic = pool.filter((n) => n.topic === v.topic && Math.abs(new Date(n.publishedAt).getTime() - vAt) <= span);
  // 영상에 지역이 있으면 같은 지역을 먼저, 그다음 같은 주제 전체
  const ranked = [...sameTopic].sort((a, b) => {
    const pa = v.place && a.place === v.place ? 0 : 1;
    const pb = v.place && b.place === v.place ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });
  const out: BriefArticle[] = [];
  const seen = new Set<string>();
  for (const n of ranked) {
    for (const a of n.articles) {
      if (!a.url || seen.has(a.url)) continue;
      // 주제만 맞추면 '시장 통계'에 걸린 어업 안전 점검 같은 기사가 부동산 영상 밑에 붙습니다.
      // 제목에 부동산 낱말이 없으면 버립니다 — 세 칸을 채우는 것보다 엉뚱한 걸 안 붙이는 게 낫습니다.
      if (!isRealEstateRelevant(a.title)) continue;
      seen.add(a.url);
      out.push(toBriefArticle(a));
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/**
 * 영상 기사 → 브리핑 모델. 주제·지역을 함께 붙여 열기 전에 무슨 영상인지 알게 합니다.
 * 맨 앞 한 편(head)은 플레이어를 붙이고 설명문 꼭지까지 펴서 기사 카드처럼 세웁니다.
 *
 * 대표 영상에는 FACT / ANALYSIS 를 갈라 담습니다. FACT 는 어디가 언제 보도했는지까지 적어
 * 출처를 남기고, ANALYSIS 는 주제별로 '무엇부터 확인할 것' 한 줄입니다. 둘을 한 칸에 섞으면
 * 방송이 말한 사실과 중개사의 해석이 구분되지 않습니다.
 */
function toBriefVideo(v: VideoItem, full: boolean, period: Period, pool: VideoNewsSource[] = []): BriefVideoModel {
  const { lead, points } = descriptionPoints(v.summary);
  const leadText = clamp(lead || v.summary, full ? 200 : 110);
  return {
    id: v.id,
    title: v.title,
    channel: v.channel,
    channelUrl: v.channelId ? `https://www.youtube.com/channel/${v.channelId}` : null,
    topicLabel: TOPIC_LABEL[v.topic],
    place: v.place,
    summary: clamp(v.summary, 110),
    lead: leadText,
    points: full ? points.slice(0, 5) : [],
    url: v.url,
    thumb: v.thumb,
    date: fmtDate(v.publishedAt),
    articles: full ? relatedForVideo(v, pool, period) : [],
    // 채널 이름 뒤에 조사를 붙이면 받침에 따라 이/가가 갈립니다. 받침을 안 가리는 "에서"를 씁니다
    fact: full ? `${v.channel}에서 ${fmtDate(v.publishedAt)}에 보도한 내용입니다. ${leadText}`.trim() : undefined,
    analysis: full ? VIDEO_ANALYSIS[v.topic] : undefined,
  };
}

export function videoSection(videos: VideoItem[] | undefined, period: Period, brand = VIDEO_BRAND, pool: VideoNewsSource[] = []): BriefModel["video"] {
  const picked = pickVideos(videos ?? [], period);
  if (!picked.length) return undefined;
  return {
    brand,
    title: VIDEO_TITLE[period],
    sub: VIDEO_SUB,
    head: toBriefVideo(picked[0], true, period, pool),
    items: picked.slice(1).map((v) => toBriefVideo(v, false, period)),
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
  if (issue.region === "local") badges.push({ label: issue.dong.length ? `우리 지역 · ${issue.dong.join("·")}` : "우리 지역", tone: "target" });
  else if (issue.place || issue.region !== "national") badges.push({ label: regionLabel(issue.region, issue.place), tone: "neutral" });
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
      ...(issue.region === "local" ? [{ label: "우리 지역", tone: "target" as BadgeTone }] : []),
    ],
    title: issue.title,
    href: src.primary?.href ?? null,
    excerpt: clamp(issue.summary, 150),
    articles: src.related.map(toBriefArticle),
    count: issue.articles.filter((a) => a.url).length,
  };
}

export function buildBrokerBrief(issues: Issue[], office: Office, market: MarketDoc, period: Period, now = Date.now(), videos: VideoItem[] = []): BriefModel {
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
    video: videoSection(
      videos,
      period,
      office.videoBrand ?? VIDEO_BRAND,
      // 정책 카드에 못 든 이슈도 '관련 기사'로는 쓸 수 있습니다. 버려진 것(archived)만 뺍니다
      issues.filter((i) => i.review !== "archived").map((i) => ({ topic: i.topic, place: i.place, publishedAt: i.publishedAt, articles: i.articles })),
    ),
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
      note: numbersNote(office, market.area),
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
