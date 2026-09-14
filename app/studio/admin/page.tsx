import { studioProtected } from "@/lib/auth";
import { channelTier } from "@/lib/channels";
import { llmEnabled, llmModel } from "@/lib/enrich";
import { fmtCollect } from "@/lib/format";
import { getIssues, getMeta, getVideos } from "@/lib/repo";
import { storeEnvNames, storeStatus } from "@/lib/store";
import AdminTabs from "./AdminTabs";

export const dynamic = "force-dynamic";

/**
 * 현황판 — 자동으로 도는 것들이 지금 어떤 상태인지 한 화면에서 봅니다.
 *
 * 이 화면이 없어서 "새 채널이 왜 안 들어왔지"를 알아내는 데 한참 걸렸습니다. 답은
 * '수집이 배포보다 먼저 돌았다' 였는데, 두 시각이 나란히 있으면 바로 보였을 일입니다.
 * 여기서는 아무것도 고치지 않습니다. 보기만 하는 자리입니다.
 */

function ago(iso: string | null): string {
  if (!iso) return "기록 없음";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "기록 없음";
  const min = Math.round((Date.now() - t) / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const h = Math.round(min / 60);
  return h < 48 ? `${h}시간 전` : `${Math.round(h / 24)}일 전`;
}

function Row({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "ok" | "warn" | "bad" }) {
  return (
    <div className="adm-row">
      <div className="adm-row-k">{label}</div>
      <div>
        <span className={`adm-row-v${tone ? ` adm-${tone}` : ""}`}>{value}</span>
        {note && <span className="adm-row-note">{note}</span>}
      </div>
    </div>
  );
}

export default async function AdminHomePage() {
  const [store, meta, issues, videos] = await Promise.all([storeStatus(), getMeta(), getIssues(), getVideos()]);
  const guarded = studioProtected();
  const llm = llmEnabled();
  const stats = meta.lastCollect;

  const reviewed = issues.filter((i) => i.review === "reviewed").length;
  const drafts = issues.filter((i) => i.review === "draft").length;

  // 채널별 편수 — 구분(부동산 전문·생활 안내·경제·종합뉴스)을 같이 보여 줍니다
  const byChannel = new Map<string, { n: number; timed: number; id: string }>();
  for (const v of videos) {
    const cur = byChannel.get(v.channel) ?? { n: 0, timed: 0, id: v.channelId };
    cur.n += 1;
    if (typeof v.seconds === "number") cur.timed += 1;
    byChannel.set(v.channel, cur);
  }
  const channels = [...byChannel.entries()].sort((a, b) => b[1].n - a[1].n);
  const timed = videos.filter((v) => typeof v.seconds === "number").length;

  const failed = (stats?.feeds ?? []).filter((f) => !f.ok);
  const errors = stats?.errors ?? [];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>관리자</h1>
          <p>자동으로 도는 것들의 상태입니다. 수집·저장소·영상·자동 초안이 지금 어떤지 확인만 하는 자리이고, 여기서는 아무것도 바뀌지 않습니다.</p>
        </div>
      </div>
      <AdminTabs />

      <section className="adm-sec">
        <h2 className="adm-h">지금 상태</h2>
        <div className="adm-grid">
          <Row
            label="저장소"
            value={store.label}
            tone={store.persistent ? "ok" : "bad"}
            note={store.error ?? (storeEnvNames().length ? `변수 ${storeEnvNames().join(" · ")}` : "환경변수 없음")}
          />
          <Row
            label="스튜디오 보호"
            value={guarded ? "비밀번호 있음" : "누구나 열림"}
            tone={guarded ? "ok" : "bad"}
            note={guarded ? undefined : "Vercel → Settings → Environment Variables 에 STUDIO_PASSWORD 를 넣고 재배포하세요"}
          />
          <Row label="자동 초안" value={llm ? llmModel() : "꺼짐"} tone={llm ? "ok" : undefined} note={llm ? undefined : "ANTHROPIC_API_KEY 가 없으면 초안은 직접 씁니다"} />
          <Row label="마지막 수집" value={fmtCollect(meta.lastCollectAt) ?? "수집 전"} tone={meta.lastCollectAt ? "ok" : "warn"} note={ago(meta.lastCollectAt)} />
          <Row label="마지막 시장 갱신" value={fmtCollect(meta.lastMarketAt) ?? "갱신 전"} note={ago(meta.lastMarketAt)} />
          <Row label="검수 대기" value={`${drafts}건`} tone={drafts ? "warn" : "ok"} note={`검수 완료 ${reviewed}건 · 전체 ${issues.length}건`} />
        </div>
      </section>

      <section className="adm-sec">
        <h2 className="adm-h">마지막 수집에서 일어난 일</h2>
        {stats ? (
          <>
            <div className="adm-grid">
              <Row label="기사 읽음" value={`${stats.fetched}건`} note={`새로 담김 ${stats.added} · 같은 기사로 묶음 ${stats.merged} · 건너뜀 ${stats.skipped}`} />
              <Row
                label="영상"
                value={stats.videos ? `${stats.videos.fetched}편 읽음` : "수집 안 함"}
                note={
                  stats.videos
                    ? `새로 담김 ${stats.videos.added} · 갈아 끼움 ${stats.videos.refreshed ?? 0} · 밀려남 ${stats.videos.dropped ?? 0} · 재생시간 읽음 ${stats.videos.timed ?? 0}`
                    : undefined
                }
              />
              <Row label="자동 초안" value={`${stats.enriched}건`} note={llm ? undefined : "자동 초안이 꺼져 있어 0건입니다"} />
            </div>
            {failed.length > 0 && (
              <div className="adm-fail">
                <div className="adm-fail-h">읽지 못한 소스 {failed.length}곳</div>
                {failed.map((f) => (
                  <div className="adm-fail-r" key={f.id}>
                    {f.id}
                  </div>
                ))}
              </div>
            )}
            {errors.length > 0 && (
              <div className="adm-fail">
                <div className="adm-fail-h">오류 {errors.length}건</div>
                {errors.slice(0, 12).map((e, i) => (
                  <div className="adm-fail-r" key={i}>
                    {e}
                  </div>
                ))}
                {errors.length > 12 && <div className="adm-fail-r adm-row-note">… 그 외 {errors.length - 12}건</div>}
              </div>
            )}
          </>
        ) : (
          <p className="adm-empty">아직 수집을 돌린 적이 없습니다. 상단의 <b>지금 수집</b> 버튼을 누르면 여기에 결과가 쌓입니다.</p>
        )}
      </section>

      <section className="adm-sec">
        <h2 className="adm-h">
          저장된 영상 {videos.length}편
          <span className="adm-h-note">재생시간을 읽어 온 것 {timed}편</span>
        </h2>
        {channels.length ? (
          <div className="adm-chan">
            {channels.map(([name, c]) => {
              const tier = channelTier(c.id) ?? channelTier(name);
              const label = tier === "estate" ? "부동산 전문" : tier === "guide" ? "생활·제도 안내" : tier === "econ" ? "경제 전문" : tier === "news" ? "종합뉴스" : "직접 추가";
              return (
                <div className="adm-chan-r" key={name}>
                  <span className="adm-chan-n">{name}</span>
                  <span className={`adm-chan-t adm-t-${tier ?? "custom"}`}>{label}</span>
                  <span className="adm-chan-c">{c.n}편</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="adm-empty">담긴 영상이 없습니다. 수집을 한 번 돌리면 채워집니다.</p>
        )}
      </section>
    </>
  );
}
