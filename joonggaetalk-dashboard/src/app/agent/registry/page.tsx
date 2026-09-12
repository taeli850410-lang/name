"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Badge, MoreMenu, PageHead, StatTile, type Tone } from "@/components/ui/Bits";
import { ConfirmModal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { registryChanges, registryProgram, registryWatches, type WatchStatus } from "@/data/registry";
import { formatDateTime } from "@/lib/format";

const TONE: Record<WatchStatus, Tone> = { 정상: "good", 변동: "danger", 실패: "warn", 대기: "neutral" };

/** 등기부 감시 — 상태는 표 4줄, 강제종료는 프로그램 관리 메뉴 안에서 확인을 거친다. */
export default function RegistryPage() {
  const toast = useToast();
  const [tab, setTab] = useState<"watch" | "changes" | "today">("watch");
  const [killOpen, setKillOpen] = useState(false);
  const failed = registryWatches.filter((w) => w.status === "실패").length;

  return (
    <>
      <PageHead
        title="등기부 감시"
        desc="임대차 물건의 등기부 변동을 하루 두 번 사무실 PC의 로컬 프로그램이 자동으로 확인하고, 변동이 있으면 임차인에게 알림톡을 보냅니다."
        actions={
          <>
            <button type="button" className="btn" onClick={() => toast("사무실 PC에 확인 신호를 보냈습니다. 응답 09-12 21:11 · 정상")}>
              <Icon name="refresh" size={15} /> 지금 확인
            </button>
            <MoreMenu
              label="프로그램 관리"
              items={[
                { label: "설치 파일 다운로드 (v69)", icon: "download", onClick: () => toast({ tone: "info", message: "JoonggaeAgentSetup.exe 다운로드 (프로토타입)" }) },
                { label: "조회 시각 설정", icon: "clock", onClick: () => toast({ tone: "info", message: "조회 시각은 운영자가 시스템 설정에서 정합니다. 현재 10:00 · 17:00" }) },
                { label: "프로그램 강제종료", icon: "xCircle", danger: true, onClick: () => setKillOpen(true) },
              ]}
            />
          </>
        }
      />

      <div className="tiles mb-24">
        <StatTile label="프로그램 상태" icon="monitor" value={registryProgram.running ? "작동 중" : "중지"} tone={registryProgram.running ? "good" : "danger"} sub={`마지막 응답 ${formatDateTime(registryProgram.lastPing)} · ${registryProgram.pc}`} />
        <StatTile label="다음 조회" icon="clock" value={registryProgram.schedule[0]} sub={`매일 ${registryProgram.schedule.join(" · ")} · 등기소 부하 방지 3~7초 간격`} />
        <StatTile label="감시 중인 물건" icon="shield" value={registryWatches.length} unit="건" sub={`오늘 완료 ${registryProgram.todayDone} · 실패 ${registryProgram.todayFailed}`} tone={failed ? "warn" : undefined} />
        <StatTile label="변동 발견" icon="alertCircle" value={registryChanges.filter((c) => c.foundAt.startsWith("2026-09")).length} unit="건" sub="이번 달 · 전체 이력은 아래 탭" />
      </div>

      <div className="tabs" role="tablist">
        <button type="button" role="tab" className={`tab${tab === "watch" ? " is-active" : ""}`} aria-selected={tab === "watch"} onClick={() => setTab("watch")}>
          감시 물건 <span className="n">{registryWatches.length}</span>
        </button>
        <button type="button" role="tab" className={`tab${tab === "changes" ? " is-active" : ""}`} aria-selected={tab === "changes"} onClick={() => setTab("changes")}>
          변동 발견 이력 <span className="n">{registryChanges.length}</span>
        </button>
        <button type="button" role="tab" className={`tab${tab === "today" ? " is-active" : ""}`} aria-selected={tab === "today"} onClick={() => setTab("today")}>
          오늘 조회 현황
        </button>
      </div>

      {tab === "watch" && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>물건</th>
                <th>임차인</th>
                <th>마지막 조회</th>
                <th>다음 조회</th>
                <th>상태</th>
                <th className="th-right">관리</th>
              </tr>
            </thead>
            <tbody>
              {registryWatches.map((w) => (
                <tr key={w.id}>
                  <td>
                    <div className="cell-title">{w.propertyName}</div>
                    <div className="cell-sub">{w.address}</div>
                  </td>
                  <td>
                    {w.tenant === "-" ? <span className="muted">임차인 미지정</span> : w.tenant}
                    {w.dealId && (
                      <Link href={`/agent/deals?focus=${w.dealId}`} className="cell-sub link">
                        계약 보기
                      </Link>
                    )}
                  </td>
                  <td className="num nowrap">{formatDateTime(w.lastChecked)}</td>
                  <td className="num nowrap">{formatDateTime(w.nextCheck)}</td>
                  <td>
                    <Badge tone={TONE[w.status]} dot>
                      {w.status === "정상" ? "변동 없음" : w.status}
                    </Badge>
                    {w.note && <div className="cell-sub">{w.note}</div>}
                  </td>
                  <td>
                    <div className="row-actions">
                      {w.status === "실패" && (
                        <button type="button" className="btn btn--sm" onClick={() => toast("다음 조회(내일 10:00)에 우선 조회하도록 표시했습니다.")}>
                          다시 조회
                        </button>
                      )}
                      <MoreMenu items={[{ label: "등기부 열람 (인터넷등기소)", icon: "external", onClick: () => window.open("https://www.iros.go.kr/", "_blank") }, { label: "감시 중단", icon: "x", danger: true, onClick: () => toast(`${w.propertyName} 감시를 중단했습니다.`) }]} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "changes" && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>발견 시각</th>
                <th>물건</th>
                <th>임차인</th>
                <th>변동 요약</th>
                <th>알림톡</th>
              </tr>
            </thead>
            <tbody>
              {registryChanges.map((c) => (
                <tr key={c.id}>
                  <td className="num nowrap">{formatDateTime(c.foundAt)}</td>
                  <td className="cell-title">{c.propertyName}</td>
                  <td>{c.tenant}</td>
                  <td>{c.summary}</td>
                  <td>
                    <Badge tone={c.alimtalk === "발송 완료" ? "good" : c.alimtalk === "발송 실패" ? "danger" : "neutral"} dot>
                      {c.alimtalk}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "today" && (
        <div className="card">
          <div className="card__body">
            <dl className="kv">
              <dt>오전 조회 10:00</dt>
              <dd>
                완료 {registryProgram.todayDone}건 · 실패 {registryProgram.todayFailed}건 <span className="muted">(부천 중동 신축빌라 302호 — 등기소 응답 없음)</span>
              </dd>
              <dt>오후 조회 17:00</dt>
              <dd>완료 5건 · 변동 0건</dd>
              <dt>실패 처리</dt>
              <dd>실패한 물건은 다음 조회에서 자동으로 다시 시도합니다. 3회 연속 실패하면 알림을 보냅니다.</dd>
            </dl>
          </div>
        </div>
      )}

      <ConfirmModal
        open={killOpen}
        onClose={() => setKillOpen(false)}
        danger
        title="사무실 PC의 감시 프로그램을 강제종료할까요?"
        description="프로그램이 꺼지면 등기부 조회가 중단됩니다. 다음 조회(내일 10:00)는 건너뛰며, PC에서 프로그램을 다시 실행해야 재개됩니다."
        summary={[{ k: "PC", v: registryProgram.pc }, { k: "감시 중", v: `${registryWatches.length}건` }, { k: "영향", v: "내일 10:00 조회 건너뜀" }]}
        confirmLabel="강제종료"
        onConfirm={() => { setKillOpen(false); toast({ tone: "danger", message: "종료 신호를 보냈습니다. 프로그램은 30초 안에 꺼집니다." }); }}
      />
    </>
  );
}
