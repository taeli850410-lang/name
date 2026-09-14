import BriefView from "@/components/Brief";
import { buildBrokerBrief, letterToBrief } from "@/lib/brief";
import { buildDraft } from "@/lib/letter";
import { getBanners, getIssues, getMarket, getSettings, getVideos } from "@/lib/repo";
import { SEGMENTS, SEGMENT_KEYS } from "@/lib/taxonomy";
import type { Period, Segment } from "@/lib/types";
import Link from "next/link";

export const dynamic = "force-dynamic";

const PERIODS: Period[] = ["daily", "weekly", "monthly"];

/**
 * 브리핑 화면. 상단 바에서 고객용·중개사용, 주기, 이메일·모바일 보기를 고릅니다.
 *
 * 둘 다 **지금 사무소 정보와 지금 이슈로** 그립니다. 발행한 EDM(/l/…)과 다른 점이 그것입니다 —
 * 거기는 그날 고른 이슈가 얼어 있고, 여기는 사무소가 지금 무엇을 내보내게 되는지를 봅니다.
 * 그래서 상단 「🏢 사무소」에서 고친 것이 두 화면에 곧바로 비칩니다.
 */
export default async function BriefPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; view?: string; audience?: string; segment?: string }>;
}) {
  const sp = await searchParams;
  const period: Period = PERIODS.includes(sp.period as Period) ? (sp.period as Period) : "daily";
  const view = sp.view === "mobile" ? "mobile" : "email";
  const forCustomer = sp.audience === "customer";
  const segment: Segment = SEGMENT_KEYS.includes(sp.segment as Segment) ? (sp.segment as Segment) : "first";

  const [issues, office, market, videos, banners] = await Promise.all([
    getIssues(),
    getSettings(),
    getMarket(),
    getVideos(),
    getBanners(),
  ]);
  const pool = office.showVideos === false ? [] : videos;

  if (!forCustomer) {
    const model = buildBrokerBrief(issues, office, market, period, Date.now(), pool, banners);
    return (
      <div className="brief-stage">
        <div className={`brief-device ${view}`}>
          <BriefView model={model} />
        </div>
      </div>
    );
  }

  // 고객용은 보낼 사람이 누구냐에 따라 본문이 달라집니다. 세그먼트 영향도가 3 이상인 이슈만
  // 실리고 영상 대표도 그 세그먼트 기준으로 뽑히므로, 고를 수 있게 해 둡니다.
  const draft = buildDraft(issues, office, market, { period, segment, comment: office.defaultComment, videos: pool });
  const model = letterToBrief(draft, banners, Date.now(), office);
  const href = (s: Segment) => `/studio/brief?audience=customer&period=${period}&view=${view}&segment=${s}`;

  return (
    <div className="brief-stage with-seg">
      <div className="brief-seg-bar">
        <span className="brief-seg-k">받는 사람</span>
        <nav className="chrome-seg" aria-label="세그먼트">
          {SEGMENT_KEYS.map((s) => (
            <Link key={s} href={href(s)} {...(segment === s ? { "aria-current": "true" as const } : {})}>
              {SEGMENTS[s].label}
            </Link>
          ))}
        </nav>
        <span className="brief-seg-note">{SEGMENTS[segment].desc}</span>
      </div>
      <div className={`brief-device ${view}`}>
        <BriefView model={model} />
      </div>
    </div>
  );
}
