import { Icon } from "@/components/ui/Icon";
import { Badge, PageHead } from "@/components/ui/Bits";
import { billing } from "@/data/misc";
import { formatKoDate } from "@/lib/format";

export const metadata = { title: "구매내역" };

export default function BillingPage() {
  const soon = billing.daysLeft <= 30;
  return (
    <>
      <PageHead title="구매내역" desc="사용기한이 부여·연장된 내역입니다. 무료·결제·보정 건을 모두 볼 수 있습니다." />
      <section className={`card mb-16`} style={{ borderColor: soon ? "#f1d49a" : undefined }}>
        <div className="card__body row row--between">
          <div>
            <div className="muted small">현재 사용기한</div>
            <div className="row" style={{ gap: 10 }}>
              <span className="hero-num" style={{ fontSize: 28 }}>{formatKoDate(billing.expiresAt, true)}</span>
              <span className={`dday${soon ? " dday--soon" : ""}`}>D-{billing.daysLeft}</span>
              <Badge tone="outline">{billing.plan} 이용 중</Badge>
            </div>
            {soon && <div className="small mt-8" style={{ color: "var(--warn)" }}>만료 30일 이내입니다. 만료되면 알림톡 자동발송이 멈추고 로그인만 가능합니다.</div>}
          </div>
          <a href={billing.priceUrl} target="_blank" rel="noreferrer" className="btn btn--primary btn--lg">
            <Icon name="card" size={16} /> 이용권 연장하기
          </a>
        </div>
      </section>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>처리일</th>
              <th>구분</th>
              <th>내용</th>
              <th className="th-right">변동 일수</th>
              <th>이전 사용기한</th>
              <th>적용 후 사용기한</th>
            </tr>
          </thead>
          <tbody>
            {billing.history.map((h, i) => (
              <tr key={i}>
                <td className="num nowrap">{h.date}</td>
                <td>
                  <Badge tone={h.kind.includes("보정") ? "warn" : "good"}>{h.kind}</Badge>
                </td>
                <td>{h.desc}</td>
                <td className="td-num" style={{ color: h.delta < 0 ? "var(--danger)" : "var(--good)", fontWeight: 600 }}>
                  {h.delta > 0 ? "+" : ""}
                  {h.delta}일
                </td>
                <td className="num muted">{h.before}</td>
                <td className="num">{h.after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="help mt-12">'보정'은 운영자의 오류를 바로잡거나 회원과 합의한 내용을 반영하기 위한 처리입니다. 결제 영수증은 네이버 스마트스토어 주문 내역에서 확인할 수 있습니다.</p>
    </>
  );
}
