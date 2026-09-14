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

/** E축 지역. local 은 설정에서 지정한 우리 시군구, other 는 그 밖의 특정 지역 */
export type Region = "national" | "metro" | "local" | "other";

/** 사무소가 맡은 지역. 비우면 전국구로 동작합니다. */
export interface AreaConfig {
  sido?: string;
  sigungu?: string;
  dongs?: string[];
}

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
  | "local"
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
  /** 우리 지역 관련 구역·단지·규제. 전국구면 지역별 편차 메모 */
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
  /** 제목에 잡힌 지명(서울·부산·안양…). 전국 사안이면 비어 있습니다 */
  place?: string | null;
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
  /** 푸터 '수신거부·개인정보처리방침' 링크. 이전 설정에는 없을 수 있음 */
  privacyUrl?: string;
  /** 주력 주제. 같은 등급 안에서 이 주제를 앞으로 당깁니다(규칙 R1~R8을 덮어쓰지는 않음). 비우면 가중치 없음 */
  focusTopics?: Topic[];
  /** 영상 기사를 가져올 유튜브 채널. 채널 주소·@핸들·UC 아이디 모두 됩니다. 비우면 기본 채널 */
  videoSources?: string[];
  /** 브리핑 상단 영상 기사란을 켤지. 기본 켬 */
  showVideos?: boolean;
  /** 영상 기사란 코너 이름. 비우면 코너 이름 없이 제목만 섭니다 */
  videoBrand?: string;
  /** 서비스 범위. national = 전국구(기본), local = 지역 밀착 */
  scope?: "national" | "local";
  /** 지역 밀착일 때 시도 (예: 경기도) */
  sido?: string;
  /** 지역 밀착일 때 시군구 (예: 안양시). 이 이름이 걸리는 기사는 '우리 지역'으로 분류됩니다 */
  sigungu?: string;
  /** 동네 타깃(R3)에 쓸 행정동 목록 */
  dongs?: string[];
  /** 실거래가 API 법정동코드 5자리. 우리 지역 숫자를 여기서 집계합니다 */
  lawdCodes?: string[];
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
  /** 시도 단위 비교 — 서울·경기·인천. 실거래 집계(monthly)와 달리 한국부동산원 공표 통계입니다 */
  regions?: RegionRow[];
}

/**
 * 시도 한 칸. 실거래 API 는 시군구(법정동코드 5자리) 단위라 시도 전체를 받으려면
 * 서울만 25개 구를 돌아야 합니다 — 한 번 수집에 수백 번을 부를 수 없습니다.
 * 그래서 시도 값은 한국부동산원이 이미 집계해 공표한 평균가격을 씁니다. 단위는 만원/㎡.
 */
export interface RegionRow {
  name: string;
  /** 한국부동산원 통계표의 지역 분류 ID */
  cls: string;
  /** 기준 월 (YYYY-MM) */
  month: string;
  sale: number | null;
  salePrev: number | null;
  jeonse: number | null;
  jeonsePrev: number | null;
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
  /** 원 제목(뉴스 검색어용). 이전 스냅샷에는 없을 수 있음 */
  title?: string;
  /** 관련 보도 스냅샷(대표 기사 먼저). 이전 스냅샷에는 없을 수 있음 */
  articles?: Article[];
  /** 영향 대상별 영향도(그래서 내 부동산에는?). 이전 스냅샷에는 없을 수 있음 */
  personas?: Record<Persona, number>;
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
  /** 관련 보도(대표 기사 제외, 최신순). 이전 스냅샷에는 없을 수 있음 */
  articles?: Article[];
  /** 전체 기사 수 */
  count?: number;
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
  /** 발행 시점의 시도 비교(서울·경기·인천). 이전 스냅샷에는 없을 수 있음 */
  regions?: RegionRow[];
  comment: string;
  glossary: Glossary | null;
  /** 발행 시점의 영상 기사 스냅샷. 이전 스냅샷에는 없을 수 있음 */
  videos?: VideoItem[];
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
  /** 유튜브 영상 기사 — 가져온 편수 / 새로 담은 편수 */
  videos?: {
    fetched: number;
    added: number;
    dropped?: number;
    refreshed?: number;
    /** 재생시간을 실제로 읽은 편수 / 확인해 본 편수 / 못 읽은 이유별 횟수 */
    timed?: number;
    tried?: number;
    durationWhy?: Record<string, number>;
  };
}

/* ───────── 홍보 배너 ───────── */

export type BannerTone = "navy" | "green" | "gold" | "plain";
/** 배너를 걸 화면. 고객용 EDM 맨 아래, 중개사용 브리핑 맨 아래 */
export type BannerPlace = "customer" | "broker";

/** 사무소가 직접 쓰는 홍보 배너 한 장. 이미지 없이 글·색·버튼으로만 만듭니다 */
export interface Banner {
  id: string;
  title: string;
  body: string;
  ctaLabel: string;
  /** http · https · tel: · mailto: 만 */
  ctaUrl: string;
  /** 글자 위에 얹는 그림의 주소. 비우면 지금처럼 글자만 나옵니다. http · https 만 */
  imageUrl: string;
  tone: BannerTone;
  where: BannerPlace[];
  /** 켜면 고객용에 (광고) 표기와 수신거부 안내가 붙습니다 */
  isAd: boolean;
  /** YYYY-MM-DD. 비우면 제한 없음 */
  startAt: string | null;
  endAt: string | null;
  enabled: boolean;
  /** 기간이 겹치면 작은 값이 이깁니다 */
  order: number;
}

export interface Meta {
  lastCollectAt: string | null;
  lastCollect: CollectStats | null;
  lastMarketAt: string | null;
  /** @핸들 → UC 아이디. 매번 채널 페이지를 읽지 않으려고 남깁니다 */
  channelIds?: Record<string, string>;
}

/** 유튜브 영상 기사 한 편 */
export interface VideoItem {
  /** 유튜브 videoId */
  id: string;
  title: string;
  summary: string;
  /** 채널 이름 — 연합뉴스TV, 한국부동산원 … */
  channel: string;
  channelId: string;
  url: string;
  thumb: string;
  publishedAt: string;
  /** 재생시간(초). 피드에는 없어서 대표 후보만 워치 페이지에서 따로 읽어 옵니다 */
  seconds?: number;
  topic: Topic;
  place?: string | null;
}

/** 인스타 카드뉴스 저장 구성 */
export interface InstaSave {
  id: string;
  issueId: string;
  title: string;
  count: number;
  theme: string;
  template: string;
  segment: Segment;
  createdAt: string;
}

/** 블로그 포스팅 초안 (마크다운) */
export interface BlogPost {
  id: string;
  issueId: string;
  topicLabel: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}
