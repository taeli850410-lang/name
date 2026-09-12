"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Badge, PageHead, StatTile } from "@/components/ui/Bits";
import { useToast } from "@/components/ui/Toast";
import { karma } from "@/data/notices";

export default function KarmaPage() {
  return (
    <Suspense>
      <Karma />
    </Suspense>
  );
}

function Karma() {
  const toast = useToast();
  const params = useSearchParams();
  const [tab, setTab] = useState<"received" | "candidates" | "sent">(params.get("tab") === "received" ? "received" : karma.needResponse ? "received" : "candidates");
  const [received, setReceived] = useState(karma.received);
  const [sent, setSent] = useState<string[]>([]);
  const [explain, setExplain] = useState(false);

  return (
    <>
      <PageHead
        title="채널 품앗이"
        desc={
          <>
            다른 회원의 카카오채널을 먼저 추가하면(선팔) 상대의 받은 선팔에 뜨고, 상대가 내 채널을 추가하면(맞팔) 서로친구가 됩니다.{" "}
            <button type="button" className="link" style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }} onClick={() => setExplain((v) => !v)}>{explain ? "접기" : "왜 필요한가요?"}</button>
            {explain && <span className="muted"> — 채널 친구 수가 많을수록 카카오채널 검색 노출과 알림톡 도달률에 유리합니다. 받은 선팔을 오래 방치하면 미응대 랭킹에 오르니 빨리 응대해 주세요.</span>}
          </>
        }
        actions={<a href="https://pf.kakao.com/" target="_blank" rel="noreferrer" className="btn"><Icon name="external" size={15} /> 내 채널 열기</a>}
      />
      <div className="tiles mb-24">
        <StatTile label="선팔" icon="heart" value={karma.sent + sent.length} unit="건" sub="내가 먼저 추가한 채널" />
        <StatTile label="맞팔" icon="checkCircle" value={karma.mutual} unit="건" sub="서로친구 완성" tone="good" />
        <StatTile label="응대 필요" icon="alertCircle" value={received.length} unit="건" sub={received.length ? "받은 선팔에 맞팔해 주세요" : "모두 응대했습니다"} tone={received.length ? "warn" : "good"} />
        <StatTile label="활동 랭킹" icon="star" value={`${karma.myRank}위`} sub="전체 회원 중 · 선팔 기준" />
      </div>

      <div className="split">
        <div>
          <div className="tabs" role="tablist">
            <button type="button" role="tab" className={`tab${tab === "received" ? " is-active" : ""}`} aria-selected={tab === "received"} onClick={() => setTab("received")}>받은 선팔 <span className="n">{received.length}</span></button>
            <button type="button" role="tab" className={`tab${tab === "candidates" ? " is-active" : ""}`} aria-selected={tab === "candidates"} onClick={() => setTab("candidates")}>선팔 가능 회원 <span className="n">{karma.candidates.length - sent.length}</span></button>
            <button type="button" role="tab" className={`tab${tab === "sent" ? " is-active" : ""}`} aria-selected={tab === "sent"} onClick={() => setTab("sent")}>보낸 선팔 <span className="n">{karma.sent + sent.length}</span></button>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>상호</th><th>대표자</th><th>지역</th><th className="th-right">응대</th></tr></thead>
              <tbody>
                {tab === "received" && received.map((r) => (
                  <tr key={r.office}>
                    <td className="cell-title">{r.office}<div className="cell-sub">{r.when} 선팔</div></td>
                    <td>{r.rep}</td>
                    <td className="muted">{r.region}</td>
                    <td><div className="row-actions">
                      <button type="button" className="btn btn--sm" onClick={() => { setReceived((xs) => xs.filter((x) => x.office !== r.office)); toast({ tone: "info", message: `${r.office}의 선팔을 거절했습니다. 사유가 상대에게 전달됩니다.` }); }}>거절</button>
                      <button type="button" className="btn btn--primary btn--sm" onClick={() => { setReceived((xs) => xs.filter((x) => x.office !== r.office)); toast(`${r.office}와 서로친구가 되었습니다.`); }}><Icon name="heart" size={13} /> 맞팔하기</button>
                    </div></td>
                  </tr>
                ))}
                {tab === "received" && received.length === 0 && <tr><td colSpan={4} className="muted center" style={{ padding: 32 }}>응대할 선팔이 없습니다.</td></tr>}
                {tab === "candidates" && karma.candidates.filter((c) => !sent.includes(c.office)).map((c) => (
                  <tr key={c.office}>
                    <td className="cell-title">{c.office}</td>
                    <td>{c.rep}</td>
                    <td className="muted">{c.region}</td>
                    <td><div className="row-actions">
                      <button type="button" className="btn btn--sm" onClick={() => toast({ tone: "info", message: "회원 지도에서 위치를 봅니다. (프로토타입)" })}><Icon name="mapPin" size={13} /> 지도</button>
                      <button type="button" className="btn btn--primary btn--sm" onClick={() => { setSent((xs) => [...xs, c.office]); toast(`${c.office}에 선팔했습니다. 상대가 맞팔하면 알려 드립니다.`); }}>선팔하기</button>
                    </div></td>
                  </tr>
                ))}
                {tab === "sent" && (
                  <>
                    {sent.map((s) => <tr key={s}><td className="cell-title">{s}</td><td className="muted" colSpan={2}>방금</td><td className="td-right"><Badge tone="info" dot>맞팔 대기</Badge></td></tr>)}
                    <tr><td className="cell-title">굿모닝공인중개사</td><td>김선미</td><td className="muted">서울 강서구</td><td className="td-right"><Badge tone="good" dot>맞팔 완료</Badge></td></tr>
                    <tr><td className="cell-title">향기부동산공인중개사사무소</td><td>이서영</td><td className="muted">경기 성남시</td><td className="td-right"><Badge tone="good" dot>맞팔 완료</Badge></td></tr>
                    <tr><td colSpan={4} className="muted small center" style={{ padding: 16 }}>외 {karma.sent - 2}건</td></tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <section className="card">
          <div className="card__head"><h2>활동 랭킹</h2><button type="button" className="btn btn--ghost btn--sm" onClick={() => toast({ tone: "info", message: "전체 랭킹 (프로토타입)" })}>전체 보기</button></div>
          <div className="list">
            {karma.ranking.map((r, i) => (
              <div key={r.office} className="list__item">
                <span className="when"><b>{i + 1}위</b></span>
                <span className="what"><div className="t">{r.office}</div><div className="s">선팔 {r.sent} · 맞팔 {r.mutual}</div></span>
              </div>
            ))}
            <div className="list__item" style={{ background: "var(--brand-soft)" }}>
              <span className="when"><b>{karma.myRank}위</b></span>
              <span className="what"><div className="t">서연공인중개사사무소 <Badge tone="info">나</Badge></div><div className="s">선팔 {karma.sent + sent.length} · 맞팔 {karma.mutual}</div></span>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
