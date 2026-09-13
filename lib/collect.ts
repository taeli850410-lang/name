import { XMLParser } from "fast-xml-parser";
import { classify, titleHash, titleSimilarity } from "./classify";
import { enrichIssue, llmEnabled } from "./enrich";
import { clamp, newId, stripHtml } from "./format";
import { getArea, getIssues, getMeta, getSettings, saveIssues, saveMeta } from "./repo";
import type { AreaConfig, BrokerFields, CollectStats, CustomerFields, Issue, SourceKind } from "./types";

/**
 * 수집 파이프라인 ①: 정부 보도자료 RSS(1차 소스)와 주제별 언론 기사(보강)를 읽어
 * 5축 태그를 붙인 이슈 레코드로 만들고, 같은 이슈의 다른 기사는 관련 기사로 묶습니다.
 */

export interface Feed {
  id: string;
  name: string;
  kind: SourceKind;
  url: string;
  /** 부동산과 무관한 항목을 걸러낼지 (전 부처 통합 피드용) */
  relevanceFilter?: boolean;
}

const gn = (q: string) => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=ko&gl=KR&ceid=KR:ko`;

export const FEEDS: Feed[] = [
  { id: "korea-press", name: "정책브리핑 보도자료", kind: "official", url: "https://www.korea.kr/rss/pressrelease.xml", relevanceFilter: true },
  { id: "gn-policy", name: "언론 · 주택 정책", kind: "press", url: gn("국토교통부 주택 OR 부동산 대책 OR 규제지역 OR 주택 공급") },
  { id: "gn-rate", name: "언론 · 금리·대출", kind: "press", url: gn("기준금리 OR 주택담보대출 OR DSR OR 전세대출") },
  { id: "gn-tax", name: "언론 · 세금", kind: "press", url: gn("양도세 OR 종부세 OR 취득세 OR 부동산 세제") },
  { id: "gn-lease", name: "언론 · 임대차", kind: "press", url: gn("전세 OR 월세 OR 임대차 OR 전세사기") },
  { id: "gn-subs", name: "언론 · 청약·분양", kind: "press", url: gn("청약 OR 분양 OR 미분양") },
  { id: "gn-redev", name: "언론 · 정비사업", kind: "press", url: gn("재개발 OR 재건축 OR 정비구역 OR 노후계획도시") },
  { id: "gn-broker", name: "언론 · 중개업", kind: "press", url: gn("공인중개사 OR 중개보수") },
];

/** 지역 밀착 사무소면 그 시군구 뉴스 피드를 하나 더 붙입니다. 전국구면 주제 피드만 돕니다. */
export function localFeed(area?: AreaConfig): Feed | null {
  const name = area?.sigungu?.trim();
  if (!name) return null;
  const short = name.replace(/(특별자치시|특별자치도|특별시|광역시|시|군|구|도)$/, "") || name;
  const dongs = (area?.dongs ?? []).filter(Boolean).slice(0, 3);
  const q = [name, `${short} 재개발`, `${short} 아파트`, ...dongs].join(" OR ");
  return { id: "gn-local", name: `언론 · ${name}`, kind: "press", url: gn(q) };
}

/** FEEDS_JSON 환경변수(JSON 배열)로 피드 목록을 통째로 바꿀 수 있습니다. 테스트나 사무소별 관심 피드 지정용. */
export function activeFeeds(area?: AreaConfig): Feed[] {
  const local = localFeed(area);
  const withLocal = (list: Feed[]) => (local ? [...list, local] : list);
  const raw = process.env.FEEDS_JSON;
  if (!raw) return withLocal(FEEDS);
  try {
    const parsed = JSON.parse(raw) as Partial<Feed>[];
    const list = parsed
      .filter((f) => f && typeof f.url === "string" && typeof f.id === "string")
      .map((f) => ({ id: f.id as string, name: f.name || (f.id as string), kind: (f.kind as SourceKind) || "press", url: f.url as string, relevanceFilter: Boolean(f.relevanceFilter) }));
    return withLocal(list.length ? list : FEEDS);
  } catch {
    return withLocal(FEEDS);
  }
}

export interface RawItem {
  title: string;
  url: string;
  date: string;
  summary: string;
  publisher: string;
  feed: Feed;
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text", trimValues: true });

function txt(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (Array.isArray(v)) return txt(v[0]);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("#text" in o) return txt(o["#text"]);
    if ("@_href" in o) return txt(o["@_href"]);
  }
  return "";
}

function toIso(s: string): string {
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? new Date().toISOString() : new Date(t).toISOString();
}

export function parseFeed(xml: string, feed: Feed): RawItem[] {
  const parsed = parser.parse(xml) as Record<string, unknown>;
  const rss = parsed.rss as { channel?: { item?: unknown } } | undefined;
  const atom = parsed.feed as { entry?: unknown } | undefined;
  let raw: unknown = rss?.channel?.item ?? atom?.entry ?? [];
  if (!Array.isArray(raw)) raw = [raw];
  const out: RawItem[] = [];
  for (const it of raw as Record<string, unknown>[]) {
    let title = stripHtml(txt(it.title));
    if (!title) continue;
    let publisher = stripHtml(txt(it.source)) || "";
    if (!publisher && feed.kind === "press") {
      const m = title.match(/\s-\s([^-]{2,30})$/);
      if (m) publisher = m[1].trim();
    }
    if (feed.kind === "press") title = title.replace(/\s-\s[^-]{2,30}$/, "").trim();
    const url = txt(it.link) || txt(it.guid) || "";
    const summary = clamp(stripHtml(txt(it.description ?? it.summary ?? it.content)), 400);
    const date = toIso(txt(it.pubDate ?? it.published ?? it.updated ?? it["dc:date"]));
    out.push({ title, url, date, summary, publisher: publisher || (feed.kind === "official" ? "정부" : feed.name), feed });
  }
  return out;
}

async function fetchText(url: string, timeoutMs = 12000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; landlanguage-brief/1.0)", Accept: "application/rss+xml, application/xml, text/xml, */*" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

export function emptyCustomer(title: string, summary: string): CustomerFields {
  return { headline: clamp(title, 40), what: clamp(summary, 220), forMe: {}, actions: [], glossary: null };
}
export function emptyBroker(): BrokerFields {
  return { facts: [], script: [], checklist: [], faq: [], local: "" };
}

export function mergeItems(existing: Issue[], items: RawItem[], now = Date.now(), area?: AreaConfig): { issues: Issue[]; added: number; merged: number; skipped: number } {
  const issues = [...existing];
  let added = 0;
  let merged = 0;
  let skipped = 0;
  const maxAge = 45 * 24 * 3600 * 1000;
  const recent = () => issues.filter((i) => now - new Date(i.publishedAt).getTime() < maxAge);

  for (const item of items) {
    if (!item.url || now - new Date(item.date).getTime() > maxAge) {
      skipped++;
      continue;
    }
    const hash = titleHash(item.title);
    let target = issues.find((i) => i.hash === hash || i.articles.some((a) => a.url === item.url));
    if (!target) target = recent().find((i) => titleSimilarity(i.title, item.title) >= 0.55);
    if (target) {
      if (!target.articles.some((a) => a.url === item.url) && target.articles.length < 6) {
        target.articles.push({ publisher: item.publisher, title: item.title, url: item.url, date: item.date, excerpt: item.summary });
        target.updatedAt = new Date(now).toISOString();
        if (item.feed.kind === "official" && !target.officialUrl) target.officialUrl = item.url;
        merged++;
      } else {
        skipped++;
      }
      continue;
    }
    const c = classify({ title: item.title, summary: item.summary, sourceKind: item.feed.kind, sourceName: item.publisher }, area);
    if (item.feed.relevanceFilter && !c.relevant) {
      skipped++;
      continue;
    }
    const iso = new Date(now).toISOString();
    issues.push({
      id: newId("i"),
      createdAt: iso,
      updatedAt: iso,
      title: item.title,
      summary: item.summary,
      sourceKind: item.feed.kind,
      sourceName: item.publisher,
      agency: c.agency,
      agencyGroup: c.agencyGroup,
      status: c.status,
      topic: c.topic,
      region: c.region,
      dong: c.dong,
      publishedAt: item.date,
      effectiveAt: null,
      officialUrl: item.feed.kind === "official" ? item.url : null,
      articles: [{ publisher: item.publisher, title: item.title, url: item.url, date: item.date, excerpt: item.summary }],
      personas: c.personas,
      customer: emptyCustomer(item.title, item.summary),
      broker: emptyBroker(),
      review: "draft",
      enrichedBy: "rules",
      hash,
    });
    added++;
  }
  issues.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  return { issues: issues.slice(0, 400), added, merged, skipped };
}

export interface CollectOptions {
  enrich?: boolean;
  enrichLimit?: number;
}

export async function runCollect(opts: CollectOptions = {}): Promise<CollectStats> {
  const stats: CollectStats = { fetched: 0, added: 0, merged: 0, skipped: 0, enriched: 0, errors: [], feeds: [] };
  const items: RawItem[] = [];
  const area = await getArea();
  await Promise.all(
    activeFeeds(area).map(async (feed) => {
      try {
        const xml = await fetchText(feed.url);
        const parsedItems = parseFeed(xml, feed);
        items.push(...parsedItems);
        stats.feeds.push({ id: feed.id, items: parsedItems.length, ok: true });
      } catch (e) {
        stats.errors.push(`${feed.name}: ${(e as Error).message}`);
        stats.feeds.push({ id: feed.id, items: 0, ok: false });
      }
    }),
  );
  stats.fetched = items.length;

  const existing = await getIssues();
  const merged = mergeItems(existing, items, Date.now(), area);
  stats.added = merged.added;
  stats.merged = merged.merged;
  stats.skipped = merged.skipped;
  const issues = merged.issues;

  if (opts.enrich !== false && llmEnabled()) {
    const office = await getSettings();
    const limit = opts.enrichLimit ?? 3;
    const targets = issues.filter((i) => i.review === "draft" && i.enrichedBy === "rules").slice(0, limit);
    for (const t of targets) {
      try {
        const patch = await enrichIssue(t, office);
        if (patch) {
          Object.assign(t, patch);
          stats.enriched++;
        }
      } catch (e) {
        stats.errors.push(`초안 생성 실패(${clamp(t.title, 30)}): ${(e as Error).message}`);
      }
    }
  }

  await saveIssues(issues);
  const meta = await getMeta();
  await saveMeta({ ...meta, lastCollectAt: new Date().toISOString(), lastCollect: stats });
  return stats;
}
