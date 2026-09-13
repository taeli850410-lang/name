import { VIDEO_IN_BRIEF } from "./taxonomy";
import type { VideoItem } from "./types";

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
  /** UC 아이디 또는 @핸들. 핸들은 수집할 때 한 번 조회해 UC 로 바꿉니다 */
  id: string;
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
  { id: "UCAVdqlngIAxHtwlCA2hjv3A", name: "집코노미", tier: "estate", note: "한국경제 부동산 채널. 청약·재개발·재건축·세금" },
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

/** 채널 목록을 설정 칸에 넣을 여러 줄 문자열로. 아이디 뒤에 이름을 주석처럼 붙이지 않습니다(그대로 저장되므로) */
export const DEFAULT_CHANNELS_TEXT = DEFAULT_VIDEO_SOURCES.join("\n");

/**
 * 채널을 돌아가며 한 편씩 고릅니다. 부동산만 올리는 채널이 가장 많이 걸리기 때문에
 * 최신순으로만 자르면 세 칸이 한 채널로 채워집니다.
 */
export function pickVideos(videos: VideoItem[], limit = VIDEO_IN_BRIEF): VideoItem[] {
  const byChannel = new Map<string, VideoItem[]>();
  for (const v of videos) {
    const key = v.channelId || v.channel;
    const cur = byChannel.get(key);
    if (cur) cur.push(v);
    else byChannel.set(key, [v]);
  }
  const queues = [...byChannel.values()];
  const out: VideoItem[] = [];
  for (let round = 0; out.length < limit; round++) {
    let took = false;
    for (const q of queues) {
      if (out.length >= limit) break;
      if (q.length > round) {
        out.push(q[round]);
        took = true;
      }
    }
    if (!took) break;
  }
  return out.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

