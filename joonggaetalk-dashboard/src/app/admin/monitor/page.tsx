"use client";

import { Icon } from "@/components/ui/Icon";
import { Badge, Banner, PageHead, StatTile } from "@/components/ui/Bits";
import { useToast } from "@/components/ui/Toast";
import { systemStatus } from "@/data/system";
import { IntegrationHelp, IntegrationList, IntegrationTile, useIntegrationProbe } from "@/components/admin/IntegrationStatus";
import { formatNumber } from "@/lib/format";

const agents = [
  ["이서연", "서연공인중개사사무소", "v69", "21:11", "정상"],
  ["김선미", "힐스테이트공인중개사사무소", "v69", "21:10", "정상"],
  ["이서영", "디딤돌공인중개사사무소", "v69", "21:09", "정상"],
  ["박미숙", "죽전역공인중개사사무소", "v68", "21:08", "구버전"],
  ["신경아", "꿈에그린공인중개사사무소", "v69", "20:41", "정상"],
  ["황순희", "은혜공인중개사사무소", "v69", "18:02", "응답 지연"],
  ["김현아", "타워누리부동산", "v69", "21:11", "정상"],
  ["이순영", "계양역부동산공인중개사사무소", "v69", "21:07", "정상"],
  ["유선심", "센트럴114", "v67", "17:30", "구버전"],
  ["이유림", "리드포레온공인중개사사무소", "v69", "21:11", "정상"],
  ["임갑숙", "신화부동산공인중개사사무소", "v69", "21:05", "정상"],
  ["장인순", "염창동 미소공인중개사", "v69", "21:11", "정상"],
];

export default function MonitorPage() {
  const toast = useToast();
  const bk = systemStatus.balsongking;
  const rg = systemStatus.registry;
  const probe = useIntegrationProbe();
  return (
    <>
      <PageHead title="서버·연동 상태" desc="앱 서버, 발송 대행사, 등기 감시 로컬 프로그램, 외부 API 연동의 현재 상태입니다. 이상은 텔레그램으로도 통보됩니다." actions={<button type="button" className="btn" disabled={probe.checking} onClick={() => { void probe.probe(); toast(bk.status === "ok" ? "연동 상태를 다시 확인했습니다." : "연동 상태를 다시 확인했습니다. 발송 대행사 장애는 계속됩니다."); }}><Icon name="refresh" size={15} /> {probe.checking ? "확인 중…" : "전체 다시 확인"}</button>} />
      {bk.status !== "ok" && (
        <div className="mb-16">
          <Banner tone="danger" title={`발송 대행사 장애 진행 중 · ${bk.since}부터`} body={<>{bk.reason} 영향: 전체 회원 발송 보류. 기술 원문: <code>{bk.detail}</code></>} actions={<button type="button" className="btn btn--sm" onClick={() => toast({ tone: "info", message: "대행사 고객센터에 장애 문의를 접수했습니다. (프로토타입)" })}>대행사 문의</button>} />
        </div>
      )}
      <div className="tiles mb-24">
        <StatTile label="앱 서버" icon="monitor" value="정상" tone="good" sub={`응답 120ms · 오류율 0.1% · 확인 ${systemStatus.server.checkedAt.slice(11)}`} />
        <StatTile label="발송 대행사" icon="send" value={bk.status === "ok" ? "정상" : "장애"} tone={bk.status === "ok" ? "good" : "danger"} sub={bk.status === "ok" ? "정상 응답" : `보류 누적 · 예치금 조회 불가 (마지막 ${bk.balanceCheckedAt.slice(11)})`} />
        <StatTile label="등기 감시 PC" icon="shield" value={rg.running} unit="대" tone={rg.failed ? "warn" : "good"} sub={`감시 ${formatNumber(rg.watching)} · 대기 ${formatNumber(rg.queued)} · 실패 ${rg.failed}`} />
        <IntegrationTile probe={probe} />
      </div>

      <section className="card mb-16">
        <div className="card__head">
          <h2>외부 연동</h2>
          <span className="muted small">각 연동의 서버 설정 여부를 지금 확인한 값입니다</span>
        </div>
        <IntegrationList probe={probe} />
        <div className="card__body" style={{ paddingTop: 0 }}>
          <IntegrationHelp probe={probe} />
        </div>
      </section>

      <div className="split">
        <section className="card">
          <div className="card__head"><h2>등기 감시 프로그램 <span className="sub">회원 PC {agents.length}대</span></h2><button type="button" className="btn btn--sm" onClick={() => toast("구버전 2대에 업데이트 신호를 보냈습니다.")}>구버전 업데이트</button></div>
          <div className="table-wrap" style={{ border: 0, borderRadius: 0 }}>
            <table className="table table--dense">
              <thead><tr><th>회원</th><th>버전</th><th>마지막 응답</th><th>상태</th></tr></thead>
              <tbody>
                {agents.map(([n, o, v, t, s]) => (
                  <tr key={n}>
                    <td><div className="cell-title">{n}</div><div className="cell-sub">{o}</div></td>
                    <td className="num">{v}</td>
                    <td className="num">{t}</td>
                    <td><Badge tone={s === "정상" ? "good" : s === "구버전" ? "warn" : "danger"} dot>{s}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="card">
          <div className="card__head"><h2>장애 타임라인</h2></div>
          <div className="card__body">
            <div className="timeline">
              <div className="timeline__item is-done"><div className="t">12:35 실패 감지</div><div className="s">발송 요청 SSL 인증서 검증 실패 · 자동 알림</div></div>
              <div className="timeline__item is-done"><div className="t">12:38 회원 화면 배너 게시</div><div className="s">발송 관련 4개 화면 상단, 실패 사유 매핑 적용</div></div>
              <div className="timeline__item is-done"><div className="t">12:40 공지 등록</div><div className="s">"발송 대행사 장애로 알림톡 발송이 보류되고 있습니다"</div></div>
              <div className="timeline__item is-next"><div className="t">진행 중 · 대행사 복구 대기</div><div className="s">복구 감지 시 보류 건 자동 재시도 → 공지 갱신</div></div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
