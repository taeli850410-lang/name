/** 이슈 레코드와 화면 모델. 하나의 레코드를 중개사용(STUDIO)과 고객용(LETTER)이 함께 읽습니다. */

export type Status =
  | "CONFIRMED"
  | "SCHEDULED"
  | "LEGISLATIVE_NOTICE"
  | "IN_ASSEMBLY"
  | "UNDER_REVIEW"
  | "PRESS_REPORTED"
  | "OUTLOOK"
  | "STAT"
  | "LOCAL_NOTICE";

export type Topic =
  | "rate"
  | "tax"
  | "subs"
  | "supply"
  | "redev"
  | "lease"
  | "transit"
  | "stat"
  | "regulation"
  | "broker";

export type Region = "national" | "metro" | "gyeonggi" | "anyang" | "seoul" | "other";

export type Persona =
  | "무주택자"
  | "1주택자"
  | "다주택자"
  | "매수 예정자"
  | "매도 예정자"
  | "임대인"
  | "임차인"
  | "공인중개사";

export type Segment = "first" | "move" | "asset";

export type AgencyGroup =
  | "molit"
  | "fsc"
  | "mofe"
  | "nts"
  | "bok"
  | "reb"
  | "law"
  | "gyeonggi"
  | "anyang"
  | "industry"
  | "press"
  | "other";

export type SourceKind = "official" | "press" | "notice" | "sample";
export type ReviewState = "draft" | "reviewed" | "archived";
export type EnrichedBy = "none" | "rules" | "llm" | "manual";
export type Period = "daily" | "weekly" | "monthly";
export type CustomerRoute = "body" | "watch" | "target" | "exclude";
export type Grade = "star" | "ref" | "keep";

export interface Article {
  publisher: string;
  title: string;
  url: string;
  date: string;
  excerpt?: string;
}

export interface Glossary {
  term: string;
  def: string;
}

export interface CustomerFields {
  /** 고객용 제목, 30자 안팎 */
  headline: string;
  /** 무슨 일이 있었는지, 2문장 */
  what: string;
  /** 세그먼트별 "나에게는" 한 문장 */
  forMe: Partial<Record<Segment, string>>;
  /** 지금 할 일 1~3개 */
  actions: string[];
  glossary: Glossary | null;
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface BrokerFields {
  /** 대상·수치·일정·경과규정 */
  facts: string[];
  /** 고객이 물으면 이렇게 설명 */
  script: string[];
  /** 계약서 특약·확인설명서·신고 의무 */
  checklist: string[];
  faq: FaqItem[];
  /** 안양 만안·동안 관련 구역·단지·규제 */
  local: string;
}

export interface Issue {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  summary: string;
  sourceKind: SourceKind;
  sourceName: string;
  agency: string;
  agencyGroup: AgencyGroup;
  status: Status;
  topic: Topic;
  region: Region;
  dong: string[];
  publishedAt: string;
  effectiveAt: string | null;
  officialUrl: string | null;
  articles: Article[];
  personas: Record<Persona, number>;
  customer: CustomerFields;
  broker: BrokerFields;
  review: ReviewState;
  enrichedBy: EnrichedBy;
  hash: string;
}

export interface Office {
  officeName: string;
  brandName: string;
  repName: string;
  registrationNo: string;
  phone: string;
  address: string;
  email: string;
  kakaoUrl: string;
  unsubscribeUrl: string;
  slogan: string;
  defaultComment: string;
  areaLabel: string;
}

export interface MonthRow {
  month: string;
  sale: number | null;
  saleN: number;
  jeonse: number | null;
  jeonseN: number;
  wolse: number | null;
  wolseN: number;
}

export interface MarketDoc {
  area: string;
  areaCodes: string[];
  generatedAt: string;
  source: string;
  monthly: MonthRow[];
  rate: { value: number; asOf: string; sourceUrl: string; note?: string };
}

export interface MarketTile {
  key: string;
  label: string;
  value: string;
  delta: string;
  deltaDir: "up" | "down" | "flat";
  asOf: string;
  source: string;
  sourceUrl: string;
  provisional: boolean;
}

export interface HistoryPoint {
  label: string;
  value: number;
}

export interface LinkRef {
  id: string;
  label: string;
  url: string;
  desc?: string;
  verified: boolean;
}

export interface LetterIssue {
  issueId: string;
  agency: string;
  status: Status;
  topic: Topic;
  publishedAt: string;
  effectiveAt: string | null;
  officialUrl: string | null;
  articleUrl: string | null;
  articleLabel: string | null;
  customer: CustomerFields;
  forMe: string;
  impact: number;
  links: LinkRef[];
  dong: string[];
  targeted: boolean;
}

export interface WatchItem {
  issueId: string;
  title: string;
  statusLabel: string;
  date: string;
  url: string | null;
}

export interface Letter {
  id: string;
  period: Period;
  segment: Segment;
  dong: string | null;
  status: "draft" | "published";
  createdAt: string;
  publishedAt: string | null;
  editionLabel: string;
  office: Office;
  headline: string;
  issues: LetterIssue[];
  watch: WatchItem[];
  tiles: MarketTile[];
  history: HistoryPoint[];
  historyLabel: string;
  comment: string;
  glossary: Glossary | null;
}

export interface Validation {
  errors: string[];
  warnings: string[];
}

export interface CollectStats {
  fetched: number;
  added: number;
  merged: number;
  skipped: number;
  enriched: number;
  errors: string[];
  feeds: { id: string; items: number; ok: boolean }[];
}

export interface Meta {
  lastCollectAt: string | null;
  lastCollect: CollectStats | null;
  lastMarketAt: string | null;
}
