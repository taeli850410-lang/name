import Link from "next/link";
import { fmtDateTime } from "@/lib/format";
import { letterTitle, segmentLabel } from "@/lib/letter";
import { getLetters, getSettings } from "@/lib/repo";
import LetterBuilder from "./LetterBuilder";

export const dynamic = "force-dynamic";

export default async function LettersPage() {
  const [letters, office] = await Promise.all([getLetters(), getSettings()]);
  const published = letters.filter((l) => l.status === "published");
  return (
    <>
      <div className="page-head">
        <div>
          <h1>레터 빌더</h1>
          <p>주기와 세그먼트를 고르면 규칙 R1~R8로 이슈를 자동 선정합니다. 발행 전 검증(사무소 필수 정보·수신거부·금지어·빈 카드)을 통과해야 발행됩니다. 발행본은 읽기 전용 URL로 고객에게 전달합니다.</p>
        </div>
      </div>
      <LetterBuilder office={office} />
      <section style={{ marginTop: 28 }}>
        <h2 style={{ marginBottom: 10 }}>발행 이력</h2>
        <div className="letters-list">
          {published.length === 0 && <div className="card">아직 발행한 레터가 없습니다.</div>}
          {published.map((l) => (
            <div className="item" key={l.id}>
              <span className="chip chip-c">{segmentLabel(l.segment)}</span>
              <b>{letterTitle(l)}</b>
              <span className="small muted">{fmtDateTime(l.publishedAt)} · 이슈 {l.issues.length}개{l.dong ? ` · ${l.dong} 타깃` : ""}</span>
              <Link className="btn btn-sm" href={`/l/${l.id}`} target="_blank">
                열기
              </Link>
              <code className="small">/l/{l.id}</code>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
