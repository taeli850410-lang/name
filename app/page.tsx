import Link from "next/link";
import { getLetters } from "@/lib/repo";
import { letterTitle, segmentLabel } from "@/lib/letter";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  const letters = (await getLetters()).filter((l) => l.status === "published").slice(0, 5);
  return (
    <main className="landing">
      <div className="kicker">REAL ESTATE REPORT ALERT · 전국 부동산 브리핑</div>
      <h1>하나의 이슈 레코드, 두 개의 렌더링</h1>
      <p style={{ color: "var(--ink-2)", maxWidth: "64ch", marginTop: 12 }}>
        정부 보도자료와 뉴스, 지자체 고시를 모아 5축(발표 주체·정책 단계·주제·영향 대상·지역)으로 태깅하고, 중개사는 스튜디오에서
        선택·검수하며, 고객은 세그먼트별로 3~8개 이슈만 쉬운 말로 받아 봅니다.
      </p>
      <div className="doors">
        <Link href="/studio/brief" className="door b">
          <span className="chip chip-b">중개사용</span>
          <p>팩트·상담 포인트·실무 체크가 담긴 중개사용 브리핑. Pocket 검수 · EDM 빌더 · 우리 동네 숫자 · 설정.</p>
        </Link>
        <Link href="/l/demo" className="door c">
          <span className="chip chip-c">고객용</span>
          <p>같은 구조를 고객 눈높이로 줄인 읽기 전용 브리핑. 샘플 EDM(MONTHLY · 내집마련)를 열어 봅니다.</p>
        </Link>
      </div>
      {letters.length > 0 && (
        <section style={{ marginTop: 36 }}>
          <h3>최근 발행</h3>
          <ul style={{ marginTop: 8 }}>
            {letters.map((l) => (
              <li key={l.id}>
                <Link href={`/l/${l.id}`}>{letterTitle(l)}</Link> · {segmentLabel(l.segment)} · {fmtDate(l.publishedAt)}
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="small muted" style={{ marginTop: 40 }}>
        기존 안양 실거래 대시보드(예시)는 <a href="/anyang-dashboard/index.html">/anyang-dashboard</a> 에서 그대로 볼 수 있습니다.
      </p>
    </main>
  );
}
