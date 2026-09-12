import { getInstaSaves, getIssues, getMarket, getSettings } from "@/lib/repo";
import InstaClient from "./InstaClient";

export const dynamic = "force-dynamic";

export default async function InstagramPage({ searchParams }: { searchParams: Promise<{ issue?: string }> }) {
  const { issue } = await searchParams;
  const [issues, office, market, saves] = await Promise.all([getIssues(), getSettings(), getMarket(), getInstaSaves()]);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>인스타 카드뉴스</h1>
          <p>주제를 고르면 1080×1350 카드 1~8장을 만듭니다. 본문은 고객용 문장(무슨 일·나에게는·지금 할 일·용어·우리 동네 숫자)으로 채워지며, PNG 개별 저장과 ZIP 일괄 저장, 구성 저장을 지원합니다.</p>
        </div>
      </div>
      <InstaClient issues={issues.filter((i) => i.review !== "archived")} office={office} market={market} initialSaves={saves} initialIssueId={issue ?? null} />
    </>
  );
}
