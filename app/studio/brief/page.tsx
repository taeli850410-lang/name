import Link from "next/link";
import BriefView from "@/components/Brief";
import { buildBrokerBrief } from "@/lib/brief";
import { getIssues, getMarket, getSettings } from "@/lib/repo";
import { PERIOD_LABEL } from "@/lib/taxonomy";
import type { Period } from "@/lib/types";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

const PERIODS: Period[] = ["daily", "weekly", "monthly"];

export default async function BriefPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const sp = await searchParams;
  const period: Period = PERIODS.includes(sp.period as Period) ? (sp.period as Period) : "daily";
  const [issues, office, market] = await Promise.all([getIssues(), getSettings(), getMarket()]);
  const model = buildBrokerBrief(issues, office, market, period);
  return (
    <>
      <div className="brief-toolbar">
        <div className="seg" role="group" aria-label="주기">
          {PERIODS.map((p) => (
            <Link key={p} href={`/studio/brief?period=${p}`} aria-pressed={period === p} role="button">
              {PERIOD_LABEL[p]}
            </Link>
          ))}
        </div>
        <span className="small muted">중개사용 브리핑 · 검수 전 이슈도 포함됩니다. 고객에게는 레터 빌더로 발행하세요.</span>
        <span style={{ flex: 1 }} />
        <PrintButton />
        <Link className="btn btn-primary" href="/studio/letters">
          레터 빌더
        </Link>
      </div>
      <div className="brief-stage">
        <div className="brief-device">
          <BriefView model={model} />
        </div>
      </div>
    </>
  );
}
