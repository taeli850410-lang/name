import { getBlogPosts, getIssues, getMarket, getSettings } from "@/lib/repo";
import BlogClient from "./BlogClient";

export const dynamic = "force-dynamic";

export default async function BlogPage({ searchParams }: { searchParams: Promise<{ issue?: string; post?: string }> }) {
  const { issue, post } = await searchParams;
  const [issues, office, market, posts] = await Promise.all([getIssues(), getSettings(), getMarket(), getBlogPosts()]);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>블로그 포스팅</h1>
          <p>주제를 고르면 SEO 골격(제목·메타 설명·목차·소제목 8개·이미지 위치·직접 경험 슬롯·표·차트·FAQ·상담 안내)에 맞춘 초안을 만듭니다. ✍️ 표시 부분에 직접 경험을 채우고 수치·날짜를 원문과 대조한 뒤 발행하세요.</p>
        </div>
      </div>
      <BlogClient issues={issues.filter((i) => i.review !== "archived")} office={office} market={market} initialPosts={posts} initialIssueId={issue ?? null} initialPostId={post ?? null} />
    </>
  );
}
