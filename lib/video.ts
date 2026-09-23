import { XMLParser } from "fast-xml-parser";
import { detectPlace, detectTopic, hashtagsSayRealEstate, isStrongRealEstate } from "./classify";
import { clamp, stripHtml } from "./format";
import { VIDEO_KEEP } from "./taxonomy";
export { DEFAULT_VIDEO_SOURCES } from "./channels";
import { channelTier } from "./channels";
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
export function parseVideoFeed(xml: string, trustHashtags = true): VideoItem[] {
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
    //
    // 해시태그는 종합뉴스 채널에서만 믿지 않습니다. 그 채널들은 영상마다 같은 태그 묶음을 다는데
    // 거기 부동산 낱말이 섞여 있어서, 2026-09-13 라이브 브리핑에 이런 것들이 실려 있었습니다.
    //   · 5명으로 줄어든 장관 후보자…이번 주 인사청문회
    //   · [날씨] 낮에도 선선한 휴일…올해 단풍 작년보다 빠를 듯
    //   · [잇슈#태그] "중국 자본에 제주도 질식 위기"…독일 신문 보도
    // 저장된 영상을 다시 거를 때(mergeVideos)는 제목만 보므로, 해시태그로 들어온 영상은 다음 수집에
    // 조용히 사라집니다 — 담는 규칙과 남기는 규칙이 어긋나 있었던 셈입니다. 종합뉴스에서는 맞췄습니다.
    if (!isStrongRealEstate(title) && !(trustHashtags && hashtagsSayRealEstate(raw))) continue;

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
  /** 같은 영상인데 제목·요약이 달라져 갈아 끼운 편수 */
  refreshed: number;
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
export function mergeVideos(existing: VideoItem[], incoming: VideoItem[]): { videos: VideoItem[]; added: number; dropped: number; refreshed: number } {
  // 제목만 봅니다. 요약까지 보면 종합뉴스 채널의 채널 소개 문구에 '부동산'이 한 번 들어 있어서
  // 인사청문회 영상이 그대로 남습니다 — 수집할 때 설명문을 안 보는 것과 같은 이유입니다.
  const kept = existing.filter((v) => isStrongRealEstate(v.title));
  const dropped = existing.length - kept.length;
  const seen = new Map(kept.map((v) => [v.id, v]));
  let added = 0;
  let refreshed = 0;
  for (const v of incoming) {
    const cur = seen.get(v.id);
    if (cur) {
      // 같은 영상이 다시 들어오면 방금 정리한 쪽으로 갈아 끼웁니다.
      //
      // 예전에는 저장된 쪽을 그대로 뒀습니다. 그래서 설명문 정리 규칙을 고쳐도 이미 담긴 영상은
      // 안 바뀌어서, "프리미엄9만 가입하면 월 2만원…" 같은 홍보 문구가 몇 주씩 카드에 실렸습니다.
      // 이미 알아낸 재생시간은 새 쪽에 옮겨 붙여 다시 부르지 않게 합니다.
      const merged = cur.seconds != null && v.seconds == null ? { ...v, seconds: cur.seconds } : v;
      if (merged.summary !== cur.summary || merged.title !== cur.title) refreshed++;
      seen.set(v.id, merged);
      continue;
    }
    seen.set(v.id, v);
    added++;
  }
  const videos = [...seen.values()].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()).slice(0, VIDEO_KEEP);
  return { videos, added, dropped, refreshed };
}

export async function collectVideos(
  inputs: string[],
  existing: VideoItem[],
  cache: Record<string, string> = {},
): Promise<{ videos: VideoItem[]; stats: VideoCollectStats; cache: Record<string, string> }> {
  const stats: VideoCollectStats = { fetched: 0, added: 0, dropped: 0, refreshed: 0, sources: [] };
  const nextCache = { ...cache };
  const incoming: VideoItem[] = [];

  // 채널 열네 곳을 한꺼번에 부르지 않습니다.
  //
  // 2026-09-16 수집에서 열네 곳 중 열두 곳이 404·500 섞여 실패했습니다(머리글을 고친 뒤라
  // 두 곳은 성공). 404 와 500 이 섞여 나오는 것은 주소가 틀린 것이 아니라 한 주소에서
  // 한꺼번에 몰려온 요청을 유튜브가 흘린 쪽입니다. 넷씩 나눠 부르고 사이를 조금 둡니다.
  // 하루 한 번 도는 일이라 이 정도 느려지는 것은 문제가 되지 않습니다.
  const BATCH = 4;
  const GAP = 400;
  const fetchOne = async (input: string) => {
      const src = await resolveSource(input, cache);
      if (!src) return { input, key: null, items: [] as VideoItem[], ok: false, error: "채널을 찾지 못했습니다" };
      try {
        // 종합뉴스 채널(연합뉴스TV·YTN·KBS)은 제목에 부동산 낱말이 있을 때만 담습니다
        const tier = channelTier(src.key) ?? channelTier(input.trim());
        // 워치 페이지와 같은 머리글을 씁니다. v53 에서 워치 페이지만 고치고 여기를 빼먹었는데,
        // 2026-09-15 수집에서 채널 열네 곳이 전부 HTTP 404 로 돌아왔습니다 — 하루 전까지는
        // 서른다섯 편을 받아 오던 자리입니다. 우리를 봇이라고 밝히던 머리글이 유력합니다.
        const res = await fetch(feedUrl(src), { headers: WATCH_HEADERS, cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return { input, key: src.key, items: parseVideoFeed(await res.text(), tier !== "news"), ok: true };
      } catch (e) {
        // 피드가 막히면 공식 API 로 한 번 더 갑니다(키가 있을 때만). 업로드 목록은 한 번에 1 유닛이라
        // 채널 열네 곳을 다 물어도 하루 14 유닛, 할당량 10,000 의 0.14% 입니다.
        const tier = channelTier(src.key) ?? channelTier(input.trim());
        const viaApi = src.kind === "channel" ? await apiChannelVideos(src.key, tier !== "news") : [];
        if (viaApi.length) return { input, key: src.key, items: viaApi, ok: true, error: undefined };
        return { input, key: src.key, items: [] as VideoItem[], ok: false, error: e instanceof Error ? e.message : String(e) };
      }
  };

  const results: Awaited<ReturnType<typeof fetchOne>>[] = [];
  for (let i = 0; i < inputs.length; i += BATCH) {
    if (i) await new Promise((r) => setTimeout(r, GAP));
    results.push(...(await Promise.all(inputs.slice(i, i + BATCH).map(fetchOne))));
  }

  for (const r of results) {
    if (r.key) nextCache[r.input.trim()] = r.key;
    incoming.push(...r.items);
    stats.fetched += r.items.length;
    stats.sources.push({ input: r.input, key: r.key, items: r.items.length, ok: r.ok, error: r.error });
  }

  const { videos, added, dropped, refreshed } = mergeVideos(existing, incoming);
  stats.added = added;
  stats.dropped = dropped;
  stats.refreshed = refreshed;
  return { videos, stats, cache: nextCache };
}

/**
 * 공식 API 로 한 채널의 최근 업로드를 받습니다. YT_API_KEY 가 있을 때만 씁니다.
 *
 * 채널 UCxxxx 의 업로드 목록은 UUxxxx 입니다(유튜브가 오래 지켜 온 규칙). 그 목록을
 * playlistItems 로 읽으면 한 번에 1 유닛입니다 — search 로 찾으면 100 유닛이라 채널
 * 열네 곳이면 하루 1,400 유닛이 됩니다. 같은 것을 100분의 1 로 받습니다.
 *
 * 피드가 살아 있으면 이 길은 안 탑니다. 피드가 막힌 날에만 뒤를 받칩니다.
 */
export async function apiChannelVideos(channelId: string, trustHashtags = true): Promise<VideoItem[]> {
  const key = process.env.YT_API_KEY;
  if (!key || !/^UC[\w-]{20,}$/.test(channelId)) return [];
  const base = process.env.YT_API_PLAYLIST_BASE || "https://www.googleapis.com/youtube/v3/playlistItems";
  const uploads = `UU${channelId.slice(2)}`;
  const url = `${base}?part=snippet&maxResults=15&playlistId=${encodeURIComponent(uploads)}&key=${encodeURIComponent(key)}`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), DURATION_TIMEOUT);
  try {
    const res = await fetch(url, { cache: "no-store", signal: ctl.signal });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      items?: { snippet?: { title?: string; description?: string; publishedAt?: string; channelTitle?: string; resourceId?: { videoId?: string } } }[];
    };
    const out: VideoItem[] = [];
    for (const it of json.items ?? []) {
      const sn = it.snippet ?? {};
      const videoId = sn.resourceId?.videoId ?? "";
      const title = stripHtml(String(sn.title ?? ""));
      if (!videoId || !title || NOT_A_REPORT.test(title)) continue;
      // 피드로 들어올 때와 똑같은 규칙을 태웁니다. 들어오는 길이 둘이어도 담기는 기준은 하나여야 합니다
      const raw = String(sn.description ?? "");
      if (!isStrongRealEstate(title) && !(trustHashtags && hashtagsSayRealEstate(raw))) continue;
      const summary = clamp(stripHtml(cleanDescription(raw)), 320);
      out.push({
        id: videoId,
        title,
        summary,
        channel: stripHtml(String(sn.channelTitle ?? "")),
        channelId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        thumb: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        publishedAt: toIso(String(sn.publishedAt ?? "")),
        topic: detectTopic(title, summary),
        place: detectPlace(title),
      });
    }
    out.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    return out.slice(0, PER_CHANNEL);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
    ctl.abort();
  }
}

/* ───────── 재생시간 ───────── */

/** 워치 페이지 주소. YT_WATCH_BASE 로 바꿀 수 있습니다(피드와 같은 이유) */
function watchUrl(videoId: string): string {
  const base = process.env.YT_WATCH_BASE || "https://www.youtube.com/watch";
  return `${base}?v=${encodeURIComponent(videoId)}`;
}

const LENGTH_MARK = /"lengthSeconds":"(\d+)"/;
/** 머리말에 먼저 나오는 표시. 재생 정보보다 앞이라 이쪽이 먼저 걸릴 때가 많습니다 */
const META_MARK = /itemprop="duration"[^>]*content="PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?"/i;
/** 표시를 못 찾아도 여기까지만 읽고 포기합니다 */
const MAX_SCAN = 1536 * 1024;
/** 한 편을 기다리는 최대 시간. 열 편을 한꺼번에 부르므로 이게 곧 이 단계의 상한입니다 */
const DURATION_TIMEOUT = 9000;

/**
 * 워치 페이지를 부를 때 붙이는 것들.
 *
 * 처음에는 `Mozilla/5.0 (compatible; RealEstateReportAlert/1.0)` 로 우리를 밝혔습니다.
 * 그랬더니 **배포한 데서 열 편이 전부 빈손으로 돌아왔습니다**(2026-09-14 수집, 저장된 40편
 * 모두 재생시간 없음). 로컬에서는 되던 것이라 코드 문제는 아니고, 유튜브가 데이터센터 주소에서
 * 오는 이런 요청에 동의 화면이나 다른 페이지를 주는 쪽으로 봅니다 — 그 페이지에는 재생 정보가
 * 없습니다. 그래서 평범한 브라우저처럼 보내고, 동의 화면을 건너뛰는 쿠키를 같이 답니다.
 *
 * 우리가 하는 일은 공개된 페이지 한 장을 읽어 길이를 보는 것뿐입니다. 로그인도, 남의 자료도
 * 아닙니다. 수집 한 번에 열 번이라 부담을 줄 양도 아닙니다.
 */
const WATCH_HEADERS: Record<string, string> = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  // 동의 화면을 건너뜁니다. 이게 없으면 본문 대신 동의 페이지가 옵니다
  "cookie": "CONSENT=YES+cb; SOCS=CAI",
};

/** 왜 못 읽었는지. 배포한 데서 무슨 일이 있었는지 알아야 다음에 고칠 수 있습니다 */
export type DurationWhy = "ok" | "key" | "http" | "empty" | "notfound" | "timeout" | "error";

/**
 * 공식 API 로 재생시간을 받습니다. YT_API_KEY 가 있을 때만 씁니다.
 *
 * 워치 페이지를 긁는 쪽은 2026-09-14 배포본에서 열 편 전부 실패했습니다(durationWhy
 * `{notfound: 10}` — 200 은 왔는데 길이 표시가 없는 페이지). 브라우저인 척해도 안 됐습니다.
 * 데이터센터 주소에서 오는 요청에는 유튜브가 다른 페이지를 주는 것으로 보입니다.
 *
 * 공식 API 는 그런 다툼이 없습니다. 쉰 편을 한 번에 물어보고 1 유닛을 씁니다(하루 10,000).
 * 하루 한 번 열 편이면 하루 1 유닛입니다.
 *
 * 키가 없으면 이 함수는 아무것도 하지 않고, 예전처럼 제목·설명문 어림으로 갑니다.
 */
const API_DURATION = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i;

export async function apiDurations(ids: string[]): Promise<Map<string, number>> {
  const key = process.env.YT_API_KEY;
  const out = new Map<string, number>();
  if (!key || !ids.length) return out;
  const base = process.env.YT_API_BASE || "https://www.googleapis.com/youtube/v3/videos";
  const url = `${base}?part=contentDetails&maxResults=50&id=${encodeURIComponent(ids.slice(0, 50).join(","))}&key=${encodeURIComponent(key)}`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), DURATION_TIMEOUT);
  try {
    const res = await fetch(url, { cache: "no-store", signal: ctl.signal });
    if (!res.ok) return out;
    const json = (await res.json()) as { items?: { id?: string; contentDetails?: { duration?: string } }[] };
    for (const it of json.items ?? []) {
      const m = API_DURATION.exec(String(it.contentDetails?.duration ?? ""));
      if (!m || !it.id) continue;
      const sec = Number(m[1] ?? 0) * 86400 + Number(m[2] ?? 0) * 3600 + Number(m[3] ?? 0) * 60 + Number(m[4] ?? 0);
      if (sec > 0) out.set(it.id, sec);
    }
    return out;
  } catch {
    return out;
  } finally {
    clearTimeout(timer);
    ctl.abort();
  }
}

function markSeconds(buf: string): number | null {
  const m = LENGTH_MARK.exec(buf);
  if (m) return Number(m[1]) || null;
  const t = META_MARK.exec(buf);
  if (!t) return null;
  const sec = Number(t[1] ?? 0) * 3600 + Number(t[2] ?? 0) * 60 + Number(t[3] ?? 0);
  return sec > 0 ? sec : null;
}

/**
 * 영상 한 편의 재생시간(초). Atom 피드에 없어서 워치 페이지에서 읽습니다.
 *
 * 워치 페이지는 1MB가 넘지만 재생시간은 앞쪽 재생 정보에 들어 있습니다. 그래서 전부 받지 않고
 * 조각을 읽어 가며 표시를 만나는 즉시 끊습니다 — 수집 한 번에 여덟 번을 불러도 부담이 적습니다.
 */
export async function tryDuration(videoId: string): Promise<{ seconds: number | null; why: DurationWhy; bytes?: number }> {
  // 끊는 수단을 abort 하나로 통일합니다. 스트림을 reader.cancel() 로 닫으면 Next 가 감싼 fetch 에서
  // 응답이 끝날 때까지 돌아오지 않는 자리가 있었습니다(수집이 100초를 넘겨도 안 끝났습니다).
  const ctl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctl.abort();
  }, DURATION_TIMEOUT);
  try {
    const res = await fetch(watchUrl(videoId), { headers: WATCH_HEADERS, cache: "no-store", signal: ctl.signal });
    if (!res.ok) return { seconds: null, why: "http" };
    if (!res.body) return { seconds: null, why: "empty" };
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let read = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      read += value.byteLength;
      buf += dec.decode(value, { stream: true });
      const sec = markSeconds(buf);
      if (sec) return { seconds: sec, why: "ok" };
      if (read >= MAX_SCAN) break;
      // 표시가 조각 경계에 걸칠 수 있어 꼬리만 남깁니다. 머리말 표시가 더 길어서 넉넉히 둡니다
      buf = buf.slice(-256);
    }
    // 몇 바이트를 받았는지 같이 남깁니다. 동의·봇 페이지는 몇십 KB 이고 진짜 워치 페이지는
    // 1MB 가 넘어서, 이 수 하나로 둘이 갈립니다.
    return { seconds: null, why: "notfound", bytes: read };
  } catch {
    return { seconds: null, why: timedOut ? "timeout" : "error" };
  } finally {
    clearTimeout(timer);
    ctl.abort();
  }
}

export async function fetchDuration(videoId: string): Promise<number | null> {
  return (await tryDuration(videoId)).seconds;
}

/**
 * 고른 몇 편의 재생시간을 채워 돌려줍니다. 한 편이라도 실패하면 그 편만 비워 두고 넘어갑니다 —
 * 재생시간은 있으면 더 정확해지는 정보이지 없으면 못 도는 정보가 아닙니다.
 */
export async function withDurations(
  videos: VideoItem[],
  targets: VideoItem[],
): Promise<{ videos: VideoItem[]; timed: number; tried: number; why: Partial<Record<DurationWhy, number>>; bytes?: number }> {
  if (!targets.length) return { videos, timed: 0, tried: 0, why: {} };

  // 키가 있으면 공식 API 로 한 번에 묻습니다. 쉰 편까지 한 번, 하루 할당량의 1/10000 입니다.
  const secs = await apiDurations(targets.map((v) => v.id));
  const why: Partial<Record<DurationWhy, number>> = secs.size ? { key: secs.size } : {};

  // API 가 못 준 것만 워치 페이지로 내려갑니다. 키가 없으면 전부 이쪽입니다.
  const rest = targets.filter((v) => !secs.has(v.id));
  let bytes: number | undefined;
  if (rest.length) {
    const found = await Promise.all(rest.map(async (v) => [v.id, await tryDuration(v.id)] as const));
    // 왜 못 읽었는지 세어 둡니다. 전부 null 로만 남으면 배포한 데서 무슨 일이 있었는지 알 길이 없습니다 —
    // 실제로 한 번 그래서, 막힌 것인지 느린 것인지를 두고 한참 헤맸습니다.
    for (const [id, r] of found) {
      why[r.why] = (why[r.why] ?? 0) + 1;
      if (typeof r.bytes === "number") bytes = Math.max(bytes ?? 0, r.bytes);
      if (typeof r.seconds === "number") secs.set(id, r.seconds);
    }
  }

  const out = secs.size ? videos.map((v) => (secs.has(v.id) ? { ...v, seconds: secs.get(v.id) } : v)) : videos;
  return { videos: out, timed: secs.size, tried: targets.length, why, bytes };
}
