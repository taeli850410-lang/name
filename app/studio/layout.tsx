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
  const store = storeStatus();
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
        <StudioChrome collectLabel={fmtCollect(meta.lastCollectAt)} letters={published} storeLabel={store.label} storePersistent={store.persistent} llmLabel={llm ? llmModel() : null} />
      </Suspense>
      <main className="studio-main">
        {!guarded && (
          <div className="alert alert-warn banner">
            STUDIO_PASSWORD 환경변수가 비어 있어 스튜디오가 누구에게나 열려 있습니다. 배포 환경에서는 반드시 설정하세요.
          </div>
        )}
        {!store.persistent && (
          <div className="alert alert-warn banner">
            영구 저장소가 연결되지 않아 편집 내용이 재시작 시 사라집니다. Vercel Marketplace에서 Upstash Redis를 연동하면 KV_REST_API_URL / KV_REST_API_TOKEN 이
            자동으로 주입됩니다.
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
