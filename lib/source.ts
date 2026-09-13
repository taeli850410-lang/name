import { LINKS } from "./links";
import type { Article } from "./types";

/**
 * 이슈 카드가 '어디로 보낼지'를 한 곳에서 정합니다.
 * 원본 EDM 처럼 카드의 큰 버튼은 기사·보도자료 원문으로 가고, 공공데이터 사이트(부동산원·청약홈 등)는
 * 참고 링크로만 붙습니다. 저장된 기사 목록의 첫 항목이 대표 기사(이슈를 만든 기사)이고,
 * 나머지는 관련 보도로 최신순 정렬합니다.
 */

const SITE_URLS = new Set(Object.values(LINKS).map((l) => l.url));

export interface SourceInput {
  title: string;
  officialUrl: string | null;
  articles: Article[];
  agency?: string;
}

export interface SourceLink {
  label: string;
  href: string;
}

export interface SourceLinks {
  /** 큰 버튼: 대표 기사, 없으면 공식 원문 */
  primary: SourceLink | null;
  /** 특정 보도자료·고시 문서를 가리킬 때만 (목록·통계 페이지는 제외) */
  official: SourceLink | null;
  /** 대표 기사와 공식 원문을 뺀 관련 보도, 최신순 */
  related: Article[];
  /** 최신 뉴스 검색 (네이버 최신순 · 구글 뉴스) */
  search: SourceLink[];
}

export function sortArticles<T extends { date: string }>(articles: T[]): T[] {
  return [...articles].sort((a, b) => (new Date(b.date).getTime() || 0) - (new Date(a.date).getTime() || 0));
}

/** 목록·통계 페이지(공공데이터 바로가기와 같은 주소)가 아닌, 특정 문서를 가리키는 공식 URL만 돌려줍니다 */
export function specificOfficialUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return SITE_URLS.has(url) ? null : url;
}

/** 뉴스 검색어: 대괄호 말머리와 큰따옴표 인용구를 빼고 기호를 정리해 앞쪽 7어절 */
export function searchQuery(title: string): string {
  let t = title.replace(/\[[^\]]*\]/g, " ");
  const noQuote = t.replace(/[“"][^”"]*[”"]/g, " ");
  if (noQuote.split(/\s+/).filter(Boolean).length >= 3) t = noQuote;
  const words = t
    .replace(/…|⋯|\.{3}/g, " ")
    .replace(/[^\p{L}\p{N}\s%.]/gu, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^\.+|\.+$/g, ""))
    .filter(Boolean);
  return words.slice(0, 7).join(" ");
}

export function newsSearchLinks(query: string): SourceLink[] {
  const q = encodeURIComponent(query);
  return [
    { label: "네이버 뉴스", href: `https://search.naver.com/search.naver?where=news&sort=1&query=${q}` },
    { label: "구글 뉴스", href: `https://news.google.com/search?q=${q}&hl=ko&gl=KR&ceid=KR:ko` },
  ];
}

export function sourceLinks(input: SourceInput, maxRelated = 3): SourceLinks {
  const arts = input.articles.filter((a) => a && a.url);
  const official = specificOfficialUrl(input.officialUrl);
  const lead = arts[0] ?? null;
  const primaryHref = lead?.url ?? official ?? input.officialUrl ?? null;
  const leadIsNews = !!lead && lead.url !== official && lead.url !== input.officialUrl;
  const primary = primaryHref ? { label: leadIsNews ? "원문·관련보도 보기" : "원문 보기", href: primaryHref } : null;
  const officialLink = official && official !== primaryHref ? { label: `${input.agency ? `${input.agency} ` : ""}공식 원문`, href: official } : null;
  const related = sortArticles(arts.filter((a) => a.url !== primaryHref && a.url !== official)).slice(0, maxRelated);
  return { primary, official: officialLink, related, search: newsSearchLinks(searchQuery(input.title)) };
}
