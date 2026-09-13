import { Suspense, type ReactNode } from "react";
import { studioProtected } from "@/lib/auth";
import { llmEnabled, llmModel } from "@/lib/enrich";
import { fmtCollect } from "@/lib/format";
import { letterTitle, shareText } from "@/lib/letter";
import { getLetters, getMeta } from "@/lib/repo";
import { storeStatus } from "@/lib/store";
import StudioChrome, { type ChromeLetter } from "./StudioChrome";

export const dynamic = "force-dynamic";

export default async function StudioLayout({ children }: { children: ReactNode }) {
  const store = await storeStatus();
  const [meta, letters] = await Promise.all([getMeta(), getLetters()]);
  const llm = llmEnabled();
  const guarded = studioProtected();
  const published: ChromeLetter[] = letters
    .filter((l) => l.status === "published")
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
    .slice(0, 9)
    .map((l) => ({ id: l.id, period: l.period, title: letterTitle(l), headline: l.headline, share: shareText(l, "{{URL}}") }));

  return (
    <div className="studio">
      <Suspense fallback={<header className="studio-top" style={{ minHeight: 52 }} />}>
        <StudioChrome collectLabel={fmtCollect(meta.lastCollectAt)} letters={published} storeLabel={store.label} storePersistent={store.persistent} storeError={store.error} llmLabel={llm ? llmModel() : null} />
      </Suspense>
      <main className="studio-main">
        {!guarded && (
          <div className="alert alert-warn banner">
            STUDIO_PASSWORD 환경변수가 비어 있어 스튜디오가 누구에게나 열려 있습니다. 배포 환경에서는 반드시 설정하세요.
          </div>
        )}
        {!store.persistent && (
          <div className="alert alert-warn banner">
            {store.error ? (
              <>Upstash 에 연결하지 못했습니다. 편집 내용이 저장되지 않습니다 — {store.error}</>
            ) : (
              <>
                영구 저장소가 연결되지 않아 편집 내용이 재시작 시 사라집니다. Vercel → Storage 에서 Upstash Redis 를 연동하면 KV_REST_API_URL /
                KV_REST_API_TOKEN(또는 UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN)이 주입됩니다. 환경변수는 <b>새로 만드는 배포</b>부터
                들어가므로, 연동한 뒤 이 브랜치를 한 번 재배포해야 이 줄이 사라집니다.
              </>
            )}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
