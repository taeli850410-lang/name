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
  // 부동산만 올리는 채널 — 피드 15편이 거의 그대로 쓰입니다.
  //
  // 맨 위가 대표 영상 자리를 가져갑니다. 그래서 '자주 올리면서 부동산만 올리는' 채널이 와야 합니다.
  // 2026-09-13 에 유튜브에서 최근 업로드를 세어 본 값(제목 기준):
  //
  //   매부리TV        하루 2.1편 · 부동산 85% · 피드가 7.3일치를 덮음
  //   집코노미(채널)   하루 1.4편 · 부동산 60% · 10.9일치
  //   연합뉴스TV      하루 293편 · 부동산  3% · 1.2시간치
  //
  // 종합뉴스는 올리는 양이 너무 많아 피드 15편이 한두 시간치밖에 안 됩니다.
  // 하루 한 번 수집으로는 그 사이에 부동산 영상이 떠 있어야 하는데 그럴 일이 드뭅니다.
  { id: "UCCt6iN6nJemSe_OHRihYBAQ", name: "매부리TV", tier: "estate", note: "매일경제 부동산 채널. 하루 2편꼴로 꾸준하고 거의 다 부동산" },
  // 재생목록('집코노미 타임즈')이 아니라 채널입니다. 목록은 주 1회라 대표 영상이 며칠씩 묵었습니다.
  // 채널은 매일 올라오고, 30초 쇼츠는 pickVideos 가 본편보다 뒤로 미룹니다.
  { id: "UCAVdqlngIAxHtwlCA2hjv3A", name: "집코노미", tier: "estate", note: "한국경제 부동산 채널. 주간 '집코노미 타임즈' 총정리도 여기 올라옵니다" },
  { id: "UCXiDk1r8MDRqTD0j2BxNWWQ", name: "한국부동산원", tier: "estate", note: "주간 가격동향·청약 제도 공식 해설" },
  { id: "@korealand", name: "국토교통부", tier: "estate", note: "제도 시행 안내 영상" },
  // 경제 전문 — 금리·대출·정비사업 해설이 꾸준합니다
  { id: "UCF8AeLlUbEpKju6v1H6p8Eg", name: "한국경제TV", tier: "econ", note: "금리·대출·증시·경제정책" },
  { id: "UC3p-0EWA8OXko2EUDUXAy5w", name: "서울경제TV", tier: "econ", note: "경제·부동산 시장 동향" },
  { id: "UCnfwIKyFYRuqZzzKBDt6JOA", name: "매일경제TV", tier: "econ", note: "경제·금융·부동산 기사형 콘텐츠" },
  { id: "@mtn", name: "MTN 머니투데이방송", tier: "econ", note: "금리·투자·부동산" },
  // 종합뉴스 — 정부 발표·속보의 원자료. 걸리는 빈도는 낮지만 확정 여부 판정에 씁니다
  { id: "UCTHCOPwqNfZ0uiKOvFyhGwg", name: "연합뉴스TV", tier: "news", note: "정부 발표 속보의 원자료. 올리는 양이 많아 걸리는 날이 드뭅니다" },
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
  "https://www.youtube.com/playlist?list=PLZtm8tjZjNV6jjvdmjZ-zc9jz1qKHUInQ",
];
export const SOURCE_EXAMPLES_TEXT = SOURCE_EXAMPLES.join("\n");

/** 채널 목록을 설정 칸에 넣을 여러 줄 문자열로. 아이디 뒤에 이름을 주석처럼 붙이지 않습니다(그대로 저장되므로) */
export const DEFAULT_CHANNELS_TEXT = DEFAULT_VIDEO_SOURCES.join("\n");

/** 이보다 짧은 요약만 남는 영상은 쇼츠·클립으로 봅니다 */
const CLIP_SUMMARY = 25;

/**
 * 코너 이름. 본편에는 프로그램 이름이 붙습니다 — `| 부동산now`, `| 집코노미 타임즈`,
 * `｜분양나우(牛)`, `[주택청약 아카데미 EP.01]`. 쇼츠에는 안 붙습니다.
 * 제목 앞머리의 `[속보]` 같은 건 코너가 아니라서, 막대 뒤 또는 제목 끝 괄호만 봅니다.
 */
const PROGRAM_MARK = /[|｜]\s*\S|[[［【][^\]］】]{2,}[\]］】]\s*$/;

/** 제목 끝에 해시태그가 줄줄이 달린 건 쇼츠입니다 — `#청약 #부동산 #다자녀 #청약전략` */
const HASHTAG_TAIL = /#[^\s#]+(?:\s+#[^\s#]+){1,}\s*$/;

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
/**
 * 쇼츠인가 본편인가. 피드에 재생 시간이 없어서 제목과 설명문으로 가릅니다.
 *
 * 설명문 길이만 보다가 `상가 복병 만난 은마아파트 재건축 | 부동산now`(2분 21초, 매일경제
 * 부동산부 뉴스 코너)를 쇼츠로 버렸습니다. 설명문이 해시태그와 구독 안내뿐이라서요.
 * 유튜브에서 재생 시간을 받아 15편을 맞춰 보고 이 순서로 정했습니다.
 */
const isClip = (v: VideoItem) => {
  if (PROGRAM_MARK.test(v.title)) return false;
  if (HASHTAG_TAIL.test(v.title)) return true;
  return v.summary.trim().length < CLIP_SUMMARY;
};
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

  // 채널마다 대표 한 편: 본편을 쇼츠보다 먼저, 같은 급이면 새 것으로.
  // 들어온 순서에 기대지 않습니다 — 지금은 저장할 때 최신순으로 정렬해 두지만,
  // 그 전제가 여기 적혀 있지 않으면 나중에 순서가 바뀌는 날 조용히 묵은 영상이 올라옵니다.
  const best = new Map<string, VideoItem>();
  for (const v of fresh) {
    const cur = best.get(channelKey(v));
    if (!cur || (isClip(cur) !== isClip(v) ? !isClip(v) : newest(v, cur) < 0)) best.set(channelKey(v), v);
  }

  const meta = (v: VideoItem) => CHANNEL_META.get(v.channelId) ?? CHANNEL_META.get(v.channel);
  const reps = [...best.values()].sort((a, b) => {
    const ra = meta(a)?.rank ?? Number.MAX_SAFE_INTEGER;
    const rb = meta(b)?.rank ?? Number.MAX_SAFE_INTEGER;
    return ra !== rb ? ra - rb : newest(a, b);
  });

  const out: VideoItem[] = [];
  const usedTier = new Set<string>();
  const take = (v: VideoItem) => {
    out.push(v);
    usedTier.add(meta(v)?.tier ?? channelKey(v));
  };

  // 대표(플레이어가 붙는 자리)는 '부동산 전문 채널 중 가장 새 영상'이 가져갑니다.
  //
  // 14일치를 돌려 보고 정했습니다.
  //   목록 순서대로  → 한 채널이 14일 내내 대표. 다른 채널은 영영 못 올라옵니다.
  //   그냥 최신순    → 14일 중 12일을 종합뉴스·증시 채널이 차지합니다. 하루 수백 편을
  //                   올리니 어쩌다 하나 나온 부동산 영상도 늘 제일 새것이라서요.
  // 부동산 전문 채널로 범위를 좁혀 최신순으로 고르면 둘 다 피합니다 — 대표는 늘 오늘 것이고,
  // 그날 누가 먼저 올렸느냐에 따라 채널이 자연스럽게 돌아갑니다.
  const head = reps.filter((v) => meta(v)?.tier === "estate").sort(newest)[0];
  if (head) take(head);

  for (const v of reps) {
    if (out.length >= limit) break;
    if (out.includes(v)) continue;
    if (usedTier.has(meta(v)?.tier ?? channelKey(v))) continue;
    take(v);
  }
  for (const v of reps) {
    if (out.length >= limit) break;
    if (!out.includes(v)) out.push(v);
  }
  // 고른 순서 그대로 돌려줍니다. 여기서 다시 최신순으로 섞으면 위에서 정한 대표가 밀립니다.
  return out;
}
