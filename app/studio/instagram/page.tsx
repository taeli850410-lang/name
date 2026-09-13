import { getInstaSaves, getIssues, getMarket, getSettings } from "@/lib/repo";
import { isFresh } from "@/lib/routing";
import type { Period } from "@/lib/types";
import InstaClient from "./InstaClient";

export const dynamic = "force-dynamic";

const PERIODS: Period[] = ["daily", "weekly", "monthly"];

/** 인스타 카드뉴스. 상단 바의 주기(DAILY/WEEKLY/MONTHLY)에 맞는 주제만 보여 줍니다. */
export default async function InstagramPage({ searchParams }: { searchParams: Promise<{ issue?: string; period?: string }> }) {
  const sp = await searchParams;
  const period: Period = PERIODS.includes(sp.period as Period) ? (sp.period as Period) : "daily";
  const [issues, office, market, saves] = await Promise.all([getIssues(), getSettings(), getMarket(), getInstaSaves()]);
  const live = issues.filter((i) => i.review !== "archived");
  // 주제 목록은 주기 창 안의 이슈. 이슈 상세에서 넘어온 경우(?issue=)는 창 밖이어도 포함
  const topics = live.filter((i) => isFresh(i, period) || i.id === sp.issue);
  return <InstaClient issues={topics} office={office} market={market} initialSaves={saves} initialIssueId={sp.issue ?? null} period={period} />;
}
