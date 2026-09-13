import { XMLParser } from "fast-xml-parser";
import { detectPlace, detectTopic, hashtagsOf, isStrongRealEstate } from "./classify";
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
// 이메일만 덩그러니 있는 줄은 연락처지 내용이 아닙니다 — 매부리TV 쇼츠가 이 한 줄 때문에 본편으로 잡혔습니다
const PROMO_LINE = /[\w.+-]+@[\w-]+\.[\w.]+|https?:\/\/|바로가기|구독하기|구독 신청|채널 가입|멤버십|제보|무단\s*전재|저작권|앱에서도|자동이체|광고\s*문의|협업\s*문의|비즈니스\s*문의|출연\s*문의|문의는/;

/**
 * 홍보 문구는 한 줄씩 걸러내다 끝이 없습니다. 낱말로 잡아 보니 이런 것들이 남았습니다.
 *
 *   프리미엄9만 가입하면 월 2만원(첫 6개월 1만원), 연 10만원입니다
 *   영상 내 일부 이미지는 게티이미지뱅크의 정식 라이선스를 받아 사용했습니다
 *   '매부리TV' 에서 최신 부동산 트렌드를 확인하세요!
 *
 * 낱말을 계속 더하는 대신 자리로 끊습니다. 유튜브 설명문은 본문이 위에 오고 홍보가 아래에
 * 붙습니다 — 구독 안내가 시작되면 그 아래는 전부 홍보입니다. 그래서 홍보 줄을 만나면
 * 거기서 멈춥니다. 해시태그·목차·장식 줄은 그냥 건너뜁니다(본문이 그 아래 또 올 수 있어서).
 */
export function cleanDescription(raw: string): string {
  const kept: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (PROMO_LINE.test(t)) break;
    if (!t || HASHTAG_LINE.test(t) || CHAPTER_LINE.test(t) || DECOR_LINE.test(t)) continue;
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
    // 제목이나 해시태그에 부동산 낱말이 있어야 싣습니다.
    //
    // 설명문 전체를 보면 안 됩니다. 종합뉴스 채널은 설명문 끝에 채널 소개·구독 안내를 길게 붙이는데
    // 거기 '부동산' 한 번만 들어 있어도 증시·정치 영상이 통과합니다. 실제로 그렇게 올라왔습니다.
    // 금리·대출 같은 말도 제목에 있다고 부동산은 아니라서(→ isStrongRealEstate) 따로 가릅니다.
    if (!isStrongRealEstate(title) && !isStrongRealEstate(hashtagsOf(raw))) continue;

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

/**
 * 설명문에서 ①②③ 으로 늘어놓은 꼭지를 뽑습니다. 집코노미 타임즈처럼 주간 종합 영상은
 * "이번주엔 ①용산 개발과 ②청약통장 전환 ③…" 식으로 다룰 내용을 적어 두는데,
 * 그게 곧 이 영상의 목차라 카드에 체크 목록으로 세웁니다. 없으면 빈 배열.
 */
const CIRCLED = /[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]/;

export function descriptionPoints(text: string): { lead: string; points: string[] } {
  const at = text.search(CIRCLED);
  if (at < 0) return { lead: text.trim(), points: [] };
  const parts = text
    .slice(at)
    .split(CIRCLED)
    .map((x) => x.trim())
    .filter(Boolean);
  const points = parts.map((p, i) =>
    // 마지막 꼭지 뒤에는 "등 한국경제신문의 주요 기사를 짚어봅니다" 같은 맺음말이 붙습니다
    i === parts.length - 1 ? p.replace(/\s*등\s.*$/, "").trim() : p,
  );
  // 리드는 마지막 문장까지만 — 안 그러면 "…라이브입니다. 이번주엔" 처럼 접속 조각이 남습니다
  const lead = text.slice(0, at).trim().replace(/([.!?])[^.!?]*$/, "$1");
  return { lead: lead.trim(), points: points.filter(Boolean) };
}

export interface VideoCollectStats {
  fetched: number;
  added: number;
  /** 예전 기준으로 담겨 있다가 지금 기준에 안 맞아 빠진 편수 */
  dropped: number;
  sources: { input: string; key: string | null; items: number; ok: boolean; error?: string }[];
}

/**
 * 같은 영상은 videoId 로 한 번만. 새로 온 것을 앞에 두고 최신순으로 자릅니다.
 *
 * 이미 담겨 있던 영상도 지금 기준으로 다시 걸러냅니다. 걸러내는 규칙을 고쳐도 저장소에 남아 있던
 * 영상은 그대로 남아서, 예전에 들어온 증시·정치 영상이 신선도가 다할 때까지(최대 21일) 브리핑에
 * 계속 올라왔습니다. 해시태그는 저장하지 않으므로 제목과 요약만 봅니다 — 해시태그로만 통과했던
 * 영상이 여기서 빠질 수 있는데, 애매한 걸 남기는 것보다 낫습니다.
 */
export function mergeVideos(existing: VideoItem[], incoming: VideoItem[]): { videos: VideoItem[]; added: number; dropped: number } {
  // 제목만 봅니다. 요약까지 보면 종합뉴스 채널의 채널 소개 문구에 '부동산'이 한 번 들어 있어서
  // 인사청문회 영상이 그대로 남습니다 — 수집할 때 설명문을 안 보는 것과 같은 이유입니다.
  const kept = existing.filter((v) => isStrongRealEstate(v.title));
  const dropped = existing.length - kept.length;
  const seen = new Map(kept.map((v) => [v.id, v]));
  let added = 0;
  for (const v of incoming) {
    if (seen.has(v.id)) continue;
    seen.set(v.id, v);
    added++;
  }
  const videos = [...seen.values()].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()).slice(0, VIDEO_KEEP);
  return { videos, added, dropped };
}

export async function collectVideos(
  inputs: string[],
  existing: VideoItem[],
  cache: Record<string, string> = {},
): Promise<{ videos: VideoItem[]; stats: VideoCollectStats; cache: Record<string, string> }> {
  const stats: VideoCollectStats = { fetched: 0, added: 0, dropped: 0, sources: [] };
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

  const { videos, added, dropped } = mergeVideos(existing, incoming);
  stats.added = added;
  stats.dropped = dropped;
  return { videos, stats, cache: nextCache };
}
