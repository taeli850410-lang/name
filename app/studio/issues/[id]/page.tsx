import Link from "next/link";
import { notFound } from "next/navigation";
import { llmEnabled } from "@/lib/enrich";
import { getIssue } from "@/lib/repo";
import IssueEditor from "./IssueEditor";

export const dynamic = "force-dynamic";

export default async function IssuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const issue = await getIssue(id);
  if (!issue) notFound();
  return (
    <>
      <div className="page-head">
        <div>
          <p className="small muted" style={{ margin: 0 }}>
            <Link href="/studio">← Pocket</Link>
          </p>
          <h1 style={{ marginTop: 6 }}>이슈 상세</h1>
          <p>왼쪽은 중개사용(팩트·스크립트·체크리스트)과 고객용 필드, 오른쪽은 고객이 실제로 보게 될 카드입니다. 검수 완료로 바꿔야 EDM에 실립니다.</p>
        </div>
      </div>
      <IssueEditor issue={issue} llm={llmEnabled()} />
    </>
  );
}
