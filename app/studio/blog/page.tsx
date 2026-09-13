import { getBlogPosts, getIssues, getMarket, getSettings } from "@/lib/repo";
import { isFresh } from "@/lib/routing";
import type { Period } from "@/lib/types";
import BlogClient from "./BlogClient";

export const dynamic = "force-dynamic";

const PERIODS: Period[] = ["daily", "weekly", "monthly"];

/** 블로그 포스팅. 상단 바의 주기(DAILY/WEEKLY/MONTHLY)에 맞는 주제만 보여 줍니다. */
export default async function BlogPage({ searchParams }: { searchParams: Promise<{ issue?: string; post?: string; period?: string }> }) {
  const sp = await searchParams;
  const period: Period = PERIODS.includes(sp.period as Period) ? (sp.period as Period) : "daily";
  const [issues, office, market, posts] = await Promise.all([getIssues(), getSettings(), getMarket(), getBlogPosts()]);
  const live = issues.filter((i) => i.review !== "archived");
  const topics = live.filter((i) => isFresh(i, period) || i.id === sp.issue);
  return <BlogClient issues={topics} office={office} market={market} initialPosts={posts} initialIssueId={sp.issue ?? null} initialPostId={sp.post ?? null} period={period} focusTopics={office.focusTopics ?? []} />;
}
