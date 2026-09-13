import Link from "next/link";
import BriefView from "@/components/Brief";
import { buildBrokerBrief } from "@/lib/brief";
import { fmtDateTime } from "@/lib/format";
import { getIssues, getMarket, getMeta, getSettings } from "@/lib/repo";
import { PERIOD_LABEL } from "@/lib/taxonomy";
import type { Period } from "@/lib/types";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

const PERIODS: Period[] = ["daily", "weekly", "monthly"];
const VIEWS = [
  { key: "email", label: "이메일" },
  { key: "mobile", label: "모바일" },
] as const;
type View = (typeof VIEWS)[number]["key"];

export default async function BriefPage({ searchParams }: { searchParams: Promise<{ period?: string; view?: string }> }) {
  const sp = await searchParams;
  const period: Period = PERIODS.includes(sp.period as Period) ? (sp.period as Period) : "daily";
  const view: View = sp.view === "mobile" ? "mobile" : "email";
  const [issues, office, market, meta] = await Promise.all([getIssues(), getSettings(), getMarket(), getMeta()]);
  const model = buildBrokerBrief(issues, office, market, period);
  const href = (p: Period, v: View) => `/studio/brief?period=${p}&view=${v}`;
  return (
    <>
      <div className="brief-toolbar">
        <div className="seg" role="group" aria-label="주기">
          {PERIODS.map((p) => (
            <Link key={p} href={href(p, view)} aria-pressed={period === p} role="button">
              {PERIOD_LABEL[p]}
            </Link>
          ))}
        </div>
        <div className="seg" role="group" aria-label="보기">
          {VIEWS.map((v) => (
            <Link key={v.key} href={href(period, v.key)} aria-pressed={view === v.key} role="button">
              {v.label}
            </Link>
          ))}
        </div>
        <Link className="btn btn-sm" href="/studio/instagram">
          인스타 카드
        </Link>
        <Link className="btn btn-sm" href="/studio/blog">
          블로그 포스팅
        </Link>
        <span style={{ flex: 1 }} />
        <span className="tb-status" title="마지막 수집 시각">
          {meta.lastCollectAt ? `실시간 뉴스 · ${fmtDateTime(meta.lastCollectAt)} 수집` : "실시간 뉴스 · 아직 수집 전(샘플 데이터)"}
        </span>
        <Link className="btn btn-sm" href="/studio/settings">
          🏢 사무소
        </Link>
        <PrintButton />
        <Link className="btn btn-primary btn-sm" href="/studio/letters">
          레터 빌더
        </Link>
      </div>
      <p className="small muted" style={{ margin: "-6px 0 12px" }}>
        중개사용 브리핑(그린)입니다. 검수 전 이슈도 포함되며, 고객에게는 레터 빌더에서 남색 레터로 발행하세요.
      </p>
      <div className="brief-stage">
        <div className={`brief-device ${view}`}>
          <BriefView model={model} />
        </div>
      </div>
    </>
  );
}
