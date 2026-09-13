import { XMLParser } from "fast-xml-parser";
import { detectPlace, detectTopic, isRealEstateRelevant } from "./classify";
import { clamp, stripHtml } from "./format";
import { VIDEO_KEEP } from "./taxonomy";
export { DEFAULT_VIDEO_SOURCES } from "./channels";
import type { VideoItem } from "./types";

/**
 * 영상 기사 수집. 유튜브는 채널·재생목록마다 키 없이 열리는 Atom 피드를 줍니다.
 *   https://www.youtube.com/feeds/videos.xml?channel_id=UC…
 *   https://www.youtube.com/feeds/videos.xml?playlist_id=PL…
 * 이 피드는 최신 15편만 돌려주므로, 하루에 수백 편을 올리는 종합뉴스 채널에서는
 * 부동산 영상이 마침 최근일 때만 걸립니다. 그래서 부동산·경제 전문 채널을 기본으로 두고,
 * 사무소가 설정에서 채널을 더하거나 뺄 수 있게 했습니다.
 */

/** 한 채널에서 한 번에 담는 최대 편수 — 부동산만 올리는 채널이 목록을 덮지 않게 */
const PER_CHANNEL = 5;

/**
 * 유튜브 설명문은 절반이 홍보 문구입니다 — 해시태그 줄, 구독 링크, 타임스탬프 목차.
 * 그대로 카드에 실으면 "#영끌 #서울집값 한국경제신문의 새로운 투자 정보 플랫폼…" 이 됩니다.
 * 본문만 남기고 나머지는 버립니다.
 */
const HASHTAG_LINE = /^\s*(#[^\s#]+\s*)+$/;
const CHAPTER_LINE = /^\d{1,2}:\d{2}(:\d{2})?(\s|$)/;
const DECOR_LINE = /^[\s✅📰📌▶️▶◆◇■□※·\-–—=*]+$/u;
const PROMO_LINE = /https?:\/\/|바로가기|구독하기|구독 신청|채널 가입|멤버십|제보|무단\s*전재|저작권|앱에서도|자동이체|광고\s*문의|협업\s*문의|비즈니스\s*문의|출연\s*문의|문의는/;

export function cleanDescription(raw: string): string {
  const kept: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || HASHTAG_LINE.test(t) || CHAPTER_LINE.test(t) || DECOR_LINE.test(t) || PROMO_LINE.test(t)) continue;
    const body = t.replace(/#[^\s#]+/g, "").trim();
    if (body) kept.push(body);
  }
  return kept.join(" ").replace(/\s+/g, " ").trim();
}

/** 24시간 라이브 루프·다시보기 모음은 기사로 쓰지 않습니다 */
const NOT_A_REPORT = /24시간|다시보기|풀영상 모음|전체 다시|LIVE 스트리밍/i;

export interface VideoSource {
  /** 설정에 적힌 원문 — 채널 주소·@핸들·UC 아이디 모두 허용 */
  input: string;
  /** 해석된 피드 키. UC…(채널) 또는 PL…·UU…(재생목록) */
  key: string;
  kind: "channel" | "playlist";
}

const CHANNEL_ID = /(UC[\w-]{22})/;
const PLAYLIST_ID = /((?:PL|UU|OL)[\w-]{16,})/;
const HANDLE = /@([A-Za-z0-9._\-가-힣]{2,40})/;

/**
 * 설정에 적은 문자열을 피드 키로 바꿉니다. @핸들은 아이디가 주소에 없으므로
 * 채널 페이지를 한 번 읽어 뽑아내고, 결과는 호출부에서 캐시합니다.
 */
export async function resolveSource(input: string, cache: Record<string, string> = {}): Promise<VideoSource | null> {
  const raw = input.trim();
  if (!raw) return null;
  if (cache[raw]) return { input: raw, key: cache[raw], kind: cache[raw].startsWith("UC") ? "channel" : "playlist" };

  const list = raw.match(/[?&]list=([\w-]+)/);
  if (list) return { input: raw, key: list[1], kind: "playlist" };
  const ch = raw.match(CHANNEL_ID);
  if (ch) return { input: raw, key: ch[1], kind: "channel" };
  const pl = raw.match(PLAYLIST_ID);
  if (pl) return { input: raw, key: pl[1], kind: "playlist" };

  const handle = raw.match(HANDLE);
  if (!handle) return null;
  const id = await channelIdFromHandle(handle[1]);
  return id ? { input: raw, key: id, kind: "channel" } : null;
}

/** @핸들 → UC 아이디. 채널 페이지 HTML 에 아이디가 여러 번 박혀 있습니다 */
async function channelIdFromHandle(handle: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.youtube.com/@${encodeURIComponent(handle)}`, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; RealEstateReportAlert/1.0)" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/"(?:channelId|externalId)":"(UC[\w-]{22})"/) ?? html.match(/channel\/(UC[\w-]{22})/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/** YT_FEED_BASE 로 피드 주소를 바꿀 수 있습니다. 유튜브에 닿지 않는 환경에서 파이프라인을 확인할 때 씁니다. */
export function feedUrl(src: VideoSource): string {
  const q = src.kind === "channel" ? `channel_id=${src.key}` : `playlist_id=${src.key}`;
  const base = process.env.YT_FEED_BASE || "https://www.youtube.com/feeds/videos.xml";
  return `${base}?${q}`;
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text", trimValues: true });

function txt(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (Array.isArray(v)) return txt(v[0]);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("#text" in o) return txt(o["#text"]);
    if ("@_url" in o) return txt(o["@_url"]);
    if ("@_href" in o) return txt(o["@_href"]);
    if ("name" in o) return txt(o.name);
  }
  return "";
}

/** 유튜브 Atom 한 편 → 영상 기사. 부동산과 무관하면 null */
export function parseVideoFeed(xml: string): VideoItem[] {
  const parsed = parser.parse(xml) as Record<string, unknown>;
  const feed = parsed.feed as Record<string, unknown> | undefined;
  if (!feed) return [];
  const feedTitle = stripHtml(txt(feed.title));
  let raw: unknown = feed.entry ?? [];
  if (!Array.isArray(raw)) raw = [raw];

  const out: VideoItem[] = [];
  for (const e of raw as Record<string, unknown>[]) {
    const group = (e["media:group"] ?? {}) as Record<string, unknown>;
    const videoId = txt(e["yt:videoId"]) || (txt(e.id).match(/video:([\w-]+)/)?.[1] ?? "");
    if (!videoId) continue;
    const title = stripHtml(txt(e.title) || txt(group["media:title"]));
    if (!title || NOT_A_REPORT.test(title)) continue;
    // 줄 단위로 걸러야 하므로 줄바꿈이 살아 있는 원문에서 먼저 정리하고, 그 다음에 태그·엔티티를 풉니다
    const raw = txt(group["media:description"]);
    const summary = clamp(stripHtml(cleanDescription(raw)), 320);
    // 관련 여부는 홍보 문구를 걷어내기 전 원문으로 봅니다 — 해시태그(#재건축)도 단서라서
    if (!isRealEstateRelevant(`${title} ${stripHtml(raw)}`)) continue;

    const channel = stripHtml(txt(e.author)) || feedTitle;
    out.push({
      id: videoId,
      title,
      summary,
      channel,
      channelId: txt(e["yt:channelId"]),
      url: txt(e.link) || `https://www.youtube.com/watch?v=${videoId}`,
      thumb: txt(group["media:thumbnail"]) || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      publishedAt: toIso(txt(e.published) || txt(e.updated)),
      topic: detectTopic(title, summary),
      place: detectPlace(title),
    });
  }
  // 최신순으로 자른 뒤 돌려줍니다
  out.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  return out.slice(0, PER_CHANNEL);
}

function toIso(s: string): string {
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? new Date().toISOString() : new Date(t).toISOString();
}

export interface VideoCollectStats {
  fetched: number;
  added: number;
  sources: { input: string; key: string | null; items: number; ok: boolean; error?: string }[];
}

/** 같은 영상은 videoId 로 한 번만. 새로 온 것을 앞에 두고 최신순으로 자릅니다 */
export function mergeVideos(existing: VideoItem[], incoming: VideoItem[]): { videos: VideoItem[]; added: number } {
  const seen = new Map(existing.map((v) => [v.id, v]));
  let added = 0;
  for (const v of incoming) {
    if (seen.has(v.id)) continue;
    seen.set(v.id, v);
    added++;
  }
  const videos = [...seen.values()].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()).slice(0, VIDEO_KEEP);
  return { videos, added };
}

export async function collectVideos(
  inputs: string[],
  existing: VideoItem[],
  cache: Record<string, string> = {},
): Promise<{ videos: VideoItem[]; stats: VideoCollectStats; cache: Record<string, string> }> {
  const stats: VideoCollectStats = { fetched: 0, added: 0, sources: [] };
  const nextCache = { ...cache };
  const incoming: VideoItem[] = [];

  // 채널이 열 개를 넘으므로 한 줄씩 기다리지 않고 같이 받습니다
  const results = await Promise.all(
    inputs.map(async (input) => {
      const src = await resolveSource(input, cache);
      if (!src) return { input, key: null, items: [] as VideoItem[], ok: false, error: "채널을 찾지 못했습니다" };
      try {
        const res = await fetch(feedUrl(src), { headers: { "user-agent": "Mozilla/5.0 (compatible; RealEstateReportAlert/1.0)" }, cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return { input, key: src.key, items: parseVideoFeed(await res.text()), ok: true };
      } catch (e) {
        return { input, key: src.key, items: [] as VideoItem[], ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );

  for (const r of results) {
    if (r.key) nextCache[r.input.trim()] = r.key;
    incoming.push(...r.items);
    stats.fetched += r.items.length;
    stats.sources.push({ input: r.input, key: r.key, items: r.items.length, ok: r.ok, error: r.error });
  }

  const { videos, added } = mergeVideos(existing, incoming);
  stats.added = added;
  return { videos, stats, cache: nextCache };
}
