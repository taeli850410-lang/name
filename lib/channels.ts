import { VIDEO_IN_BRIEF } from "./taxonomy";
import type { Period, VideoItem } from "./types";

/**
 * 영상 기사 기본 채널. 설정(영상 채널)을 비우면 이 목록으로 돕니다.
 *
 * 채널 피드는 최신 15편만 돌려줍니다. 그래서 하루 업로드량이 곧 수확률입니다 —
 * 부동산만 올리는 채널은 15편이 전부 쓸모 있고, 하루 수백 편을 올리는 종합뉴스 채널은
 * 부동산 영상이 방금 올라왔을 때만 걸립니다. 그 순서대로 늘어놓았습니다.
 * 아이디는 2026-09-13 에 YouTube Data API(channels.list)로 확인했습니다.
 */

export type ChannelTier = "estate" | "econ" | "news";

export interface DefaultChannel {
  /** UC 아이디 · @핸들 · 재생목록 주소. 핸들은 수집할 때 한 번 조회해 UC 로 바꿉니다 */
  id: string;
  /** id 가 재생목록·핸들이라 UC 를 알 수 없을 때, 그 목록을 만든 채널의 UC 아이디 */
  channelId?: string;
  name: string;
  tier: ChannelTier;
  /** 무엇을 기대하고 넣었는지 */
  note: string;
}

export const TIER_LABEL: Record<ChannelTier, string> = {
  estate: "부동산 전문",
  econ: "경제 전문",
  news: "종합뉴스",
};

export const DEFAULT_CHANNELS: DefaultChannel[] = [
  // 부동산만 올리는 채널 — 피드 15편이 거의 그대로 쓰입니다
  // 채널 전체가 아니라 '집코노미 타임즈' 재생목록입니다. 채널에는 30초 쇼츠가 많이 섞이는데
  // 이 목록은 주간 부동산뉴스 총정리 본편만 담겨 있어 브리핑에 그대로 쓸 수 있습니다.
  {
    id: "https://www.youtube.com/playlist?list=PLZtm8tjZjNV6jjvdmjZ-zc9jz1qKHUInQ",
    channelId: "UCAVdqlngIAxHtwlCA2hjv3A",
    name: "집코노미 타임즈",
    tier: "estate",
    note: "한국경제 주간 부동산뉴스 총정리 (재생목록)",
  },
  { id: "UCCt6iN6nJemSe_OHRihYBAQ", name: "매부리TV", tier: "estate", note: "매일경제 부동산 채널. 시장 해석과 투자자 관점" },
  { id: "UCXiDk1r8MDRqTD0j2BxNWWQ", name: "한국부동산원", tier: "estate", note: "주간 가격동향·청약 제도 공식 해설" },
  { id: "@korealand", name: "국토교통부", tier: "estate", note: "제도 시행 안내 영상" },
  // 경제 전문 — 금리·대출·정비사업 해설이 꾸준합니다
  { id: "UCF8AeLlUbEpKju6v1H6p8Eg", name: "한국경제TV", tier: "econ", note: "금리·대출·증시·경제정책" },
  { id: "UC3p-0EWA8OXko2EUDUXAy5w", name: "서울경제TV", tier: "econ", note: "경제·부동산 시장 동향" },
  { id: "UCnfwIKyFYRuqZzzKBDt6JOA", name: "매일경제TV", tier: "econ", note: "경제·금융·부동산 기사형 콘텐츠" },
  { id: "@mtn", name: "MTN 머니투데이방송", tier: "econ", note: "금리·투자·부동산" },
  // 종합뉴스 — 정부 발표·속보의 원자료. 걸리는 빈도는 낮지만 확정 여부 판정에 씁니다
  { id: "UCTHCOPwqNfZ0uiKOvFyhGwg", name: "연합뉴스TV", tier: "news", note: "정부 발표·규제 속보" },
  { id: "UChlgI3UHCOnwUGzWzbJ3H5w", name: "YTN", tier: "news", note: "정책·부동산 속보" },
  { id: "UCcQTRi69dsVYHN3exePtZ1A", name: "KBS News", tier: "news", note: "국토부·서울시 정책 보도" },
];

export const DEFAULT_VIDEO_SOURCES = DEFAULT_CHANNELS.map((c) => c.id);

/**
 * 설정 칸에 넣을 수 있는 네 가지 형태를 한 번에 보여 주는 예시입니다(입력 안내용, 저장되지 않습니다).
 * 마지막 줄이 재생목록 주소입니다 — 유튜브에서 재생목록을 열고 주소창을 그대로 복사하면 됩니다.
 * 재생목록 피드도 키 없이 열리고, 그 목록에 담긴 최신 15편을 줍니다.
 */
export const SOURCE_EXAMPLES = [
  "UCAVdqlngIAxHtwlCA2hjv3A",
  "@korealand",
  "https://www.youtube.com/channel/UCTHCOPwqNfZ0uiKOvFyhGwg",
  "https://www.youtube.com/playlist?list=PL0Uzao5umnToeNR6m0wYRd2Td-QJcO1oh",
];
export const SOURCE_EXAMPLES_TEXT = SOURCE_EXAMPLES.join("\n");

/** 채널 목록을 설정 칸에 넣을 여러 줄 문자열로. 아이디 뒤에 이름을 주석처럼 붙이지 않습니다(그대로 저장되므로) */
export const DEFAULT_CHANNELS_TEXT = DEFAULT_VIDEO_SOURCES.join("\n");

/** 이보다 짧은 요약만 남는 영상은 쇼츠·클립으로 봅니다 */
const CLIP_SUMMARY = 25;

/**
 * 브리핑에 실을 수 있는 최대 나이(일). 집코노미 타임즈처럼 주 1회 올리는 목록도 있어서
 * 넉넉히 잡되, 지난달 영상이 오늘 브리핑에 남아 있지는 않게 합니다.
 */
export const VIDEO_MAX_AGE: Record<Period, number> = { daily: 10, weekly: 21, monthly: 60 };

/** 기본 목록에 있는 채널의 순서와 구분 — 브리핑 세 칸을 무엇으로 채울지 정할 때 씁니다 */
const CHANNEL_META = new Map<string, { rank: number; tier: ChannelTier }>();
DEFAULT_CHANNELS.forEach((c, rank) => {
  const uc = c.channelId ?? c.id.match(/UC[\w-]{22}/)?.[0];
  if (uc) CHANNEL_META.set(uc, { rank, tier: c.tier });
  CHANNEL_META.set(c.name, { rank, tier: c.tier });
});

const channelKey = (v: VideoItem) => v.channelId || v.channel;
const isClip = (v: VideoItem) => v.summary.trim().length < CLIP_SUMMARY;
const newest = (a: VideoItem, b: VideoItem) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();

/**
 * 브리핑 상단 세 칸을 고릅니다.
 *
 * 최신순으로만 자르면 하루에 여러 편 올리는 채널이 세 칸을 다 가져갑니다. 집코노미 타임즈처럼
 * 주 1회 올리는 목록은 영영 못 올라옵니다. 그래서 이렇게 뽑습니다.
 *
 *   ① 기간에 맞는 신선도 안에서
 *   ② 채널마다 대표 한 편 — 쇼츠·클립보다 본편을 먼저(설명문 길이로 가름)
 *   ③ 설정에 적은 채널 순서대로, 구분(부동산 전문·경제·종합뉴스)이 겹치지 않게 한 편씩
 *   ④ 그래도 자리가 남으면 남은 대표들 중에서 순서대로
 *
 * 그래서 한 줄이 "부동산 전문 + 경제 + 종합뉴스"로 서고, 목록 맨 위에 둔 채널이 우선합니다.
 * 기본 목록에 없는 채널은 저마다 다른 구분으로 쳐서, 그 사무소가 적은 순서대로 채워집니다.
 */
export function pickVideos(videos: VideoItem[], period: Period = "weekly", limit = VIDEO_IN_BRIEF, now = Date.now()): VideoItem[] {
  const cutoff = now - VIDEO_MAX_AGE[period] * 86400000;
  const fresh = videos.filter((v) => new Date(v.publishedAt).getTime() >= cutoff);

  const best = new Map<string, VideoItem>();
  for (const v of fresh) {
    const cur = best.get(channelKey(v));
    if (!cur) best.set(channelKey(v), v);
    else if (isClip(cur) && !isClip(v)) best.set(channelKey(v), v);
  }

  const meta = (v: VideoItem) => CHANNEL_META.get(v.channelId) ?? CHANNEL_META.get(v.channel);
  const reps = [...best.values()].sort((a, b) => {
    const ra = meta(a)?.rank ?? Number.MAX_SAFE_INTEGER;
    const rb = meta(b)?.rank ?? Number.MAX_SAFE_INTEGER;
    return ra !== rb ? ra - rb : newest(a, b);
  });

  const out: VideoItem[] = [];
  const usedTier = new Set<string>();
  for (const v of reps) {
    if (out.length >= limit) break;
    const tier = meta(v)?.tier ?? channelKey(v);
    if (usedTier.has(tier)) continue;
    usedTier.add(tier);
    out.push(v);
  }
  for (const v of reps) {
    if (out.length >= limit) break;
    if (!out.includes(v)) out.push(v);
  }
  return out.sort(newest);
}
