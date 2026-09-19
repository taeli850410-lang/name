import { Suspense, type ReactNode } from "react";
import { studioProtected } from "@/lib/auth";
import { storedToken } from "@/lib/authStore";
import { llmEnabled, llmModel } from "@/lib/enrich";
import { fmtCollect } from "@/lib/format";
import { letterTitle, shareText } from "@/lib/letter";
import { getLetters, getMeta } from "@/lib/repo";
import { storeStatus } from "@/lib/store";
import StudioChrome, { type ChromeLetter } from "./StudioChrome";

export const dynamic = "force-dynamic";

export default async function StudioLayout({ children }: { children: ReactNode }) {
  const store = await storeStatus();
  const [meta, letters, kvToken] = await Promise.all([getMeta(), getLetters(), storedToken()]);
  const llm = llmEnabled();
  // 비밀번호는 두 곳에서 올 수 있습니다(미들웨어와 같습니다) — 환경변수와 「관리자 → 접근 관리」.
  // 환경변수만 보다가, 화면에서 비밀번호를 건 사무소한테도 「누구에게나 열려 있습니다」라고
  // 모든 쪽마다 빨간 줄을 띄우고 있었습니다. 저장소가 잠깐 흔들리면 storedToken() 이 null 을
  // 주지만, 그때는 미들웨어도 같이 열리므로 이 줄이 뜨는 것이 맞습니다.
  const guarded = studioProtected() || Boolean(kvToken);
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
            스튜디오에 비밀번호가 걸려 있지 않습니다 — 주소를 아는 사람은 누구나 들어와 사무소 정보와 배너를 고칠 수 있습니다.{" "}
            <b>관리자 → 접근 관리</b>에서 바로 걸 수 있습니다(재배포가 필요 없습니다). 환경변수 STUDIO_PASSWORD 로 걸어도 됩니다.
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
