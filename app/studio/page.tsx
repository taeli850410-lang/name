import { llmEnabled } from "@/lib/enrich";
import { getIssues, getMeta } from "@/lib/repo";
import InboxClient from "./InboxClient";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const [issues, meta] = await Promise.all([getIssues(), getMeta()]);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>인박스</h1>
          <p>수집된 보도자료·기사·고시에 5축 태그가 붙어 있습니다. 검수를 마친 이슈만 레터에 실립니다. 추천 등급은 라우팅 규칙(R1~R8)과 영향도·신선도로 계산합니다.</p>
        </div>
      </div>
      <InboxClient issues={issues} lastCollect={meta.lastCollect} llm={llmEnabled()} />
    </>
  );
}
