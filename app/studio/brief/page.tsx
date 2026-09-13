import BriefView from "@/components/Brief";
import { buildBrokerBrief } from "@/lib/brief";
import { getIssues, getMarket, getSettings } from "@/lib/repo";
import type { Period } from "@/lib/types";

export const dynamic = "force-dynamic";

const PERIODS: Period[] = ["daily", "weekly", "monthly"];

/** 중개사용 브리핑(그린). 주기·이메일/모바일 보기는 상단 바에서 고릅니다. */
export default async function BriefPage({ searchParams }: { searchParams: Promise<{ period?: string; view?: string }> }) {
  const sp = await searchParams;
  const period: Period = PERIODS.includes(sp.period as Period) ? (sp.period as Period) : "daily";
  const view = sp.view === "mobile" ? "mobile" : "email";
  const [issues, office, market] = await Promise.all([getIssues(), getSettings(), getMarket()]);
  const model = buildBrokerBrief(issues, office, market, period);
  return (
    <div className="brief-stage">
      <div className={`brief-device ${view}`}>
        <BriefView model={model} />
      </div>
    </div>
  );
}
