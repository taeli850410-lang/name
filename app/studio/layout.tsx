import Link from "next/link";
import type { ReactNode } from "react";
import { studioProtected } from "@/lib/auth";
import { llmEnabled, llmModel } from "@/lib/enrich";
import { fmtDateTime } from "@/lib/format";
import { getMeta } from "@/lib/repo";
import { storeStatus } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function StudioLayout({ children }: { children: ReactNode }) {
  const store = storeStatus();
  const meta = await getMeta();
  const llm = llmEnabled();
  const guarded = studioProtected();
  return (
    <div className="studio">
      <header className="studio-top">
        <div className="inner">
          <Link href="/studio" className="studio-brand" style={{ color: "var(--ink)" }}>
            LAND LANGUAGE<small>STUDIO · 중개사용</small>
          </Link>
          <nav className="studio-nav" aria-label="스튜디오 메뉴">
            <Link href="/studio">인박스</Link>
            <Link href="/studio/letters">레터 빌더</Link>
            <Link href="/studio/data">우리 동네 숫자</Link>
            <Link href="/studio/settings">설정</Link>
          </nav>
          <div className="studio-status">
            <span className={`chip ${store.persistent ? "chip-ok" : "chip-warn"}`} title="저장소 상태">
              {store.label}
            </span>
            <span className={`chip ${llm ? "chip-ok" : "chip-neutral"}`} title="자동 초안">
              {llm ? `자동 초안 · ${llmModel()}` : "자동 초안 꺼짐"}
            </span>
            <span className="chip chip-neutral" title="마지막 수집">
              {meta.lastCollectAt ? `수집 ${fmtDateTime(meta.lastCollectAt)}` : "수집 이력 없음"}
            </span>
          </div>
        </div>
      </header>
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
