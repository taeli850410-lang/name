"use client";

import { useSearchParams } from "next/navigation";
import { Fragment, Suspense, useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Badge, Banner, EmptyState, MoreMenu, PageHead, SearchBox, Switch, type Tone } from "@/components/ui/Bits";
import { ConfirmModal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { FAIL_REASONS, sendBatches as seed, type SendBatch } from "@/data/sends";
import { systemStatus } from "@/data/system";
import { addDays, formatDateTime, formatWon, relativeDay, TODAY } from "@/lib/format";

type Status = "all" | "scheduled" | "failed" | "done";

function statusOf(b: SendBatch): "예정" | "보류" | "실패" | "일부 실패" | "성공" {
  if (b.pending > 0 && b.items.some((i) => i.status === "보류")) return "보류";
  if (b.pending > 0) return "예정";
  if (b.failed === b.total) return "실패";
  if (b.failed > 0) return "일부 실패";
  return "성공";
}
const TONE: Record<ReturnType<typeof statusOf>, Tone> = { 예정: "info", 보류: "warn", 실패: "danger", "일부 실패": "warn", 성공: "good" };

export default function HistoryPage() {
  return (
    <Suspense>
      <History />
    </Suspense>
  );
}

/** 발송 내역 — 예정과 결과를 배치 단위로. 실패 사유는 문장으로, 원문은 '자세히' 뒤에. */
function History() {
  const toast = useToast();
  const params = useSearchParams();
  const [list, setList] = useState<SendBatch[]>(seed);
  const [status, setStatus] = useState<Status>((params.get("status") as Status) || "all");
  const [kind, setKind] = useState("");
  const [days, setDays] = useState(30);
  const [q, setQ] = useState("");
  const [auto, setAuto] = useState(false);
  const [open, setOpen] = useState<Set<string>>(() => new Set(params.get("focus") ? [params.get("focus")!] : []));
  const [tech, setTech] = useState<Set<string>>(new Set());
  const [retry, setRetry] = useState<SendBatch | null>(null);
  const [cancel, setCancel] = useState<SendBatch | null>(null);

  const filtered = useMemo(() => {
    const since = addDays(TODAY, -days);
    return list
      .filter((b) => {
        const s = statusOf(b);
        if (status === "scheduled" && !(s === "예정" || s === "보류")) return false;
        if (status === "failed" && !(s === "실패" || s === "일부 실패" || s === "보류")) return false;
        if (status === "done" && !(s === "성공" || s === "일부 실패")) return false;
        if (kind && b.kind !== kind) return false;
        if (b.scheduledAt.slice(0, 10) < since) return false;
        if (q && !(b.templateName.includes(q) || (b.dealName ?? "").includes(q) || b.items.some((i) => i.customerName.includes(q)))) return false;
        return true;
      })
      .sort((a, b) => (a.scheduledAt < b.scheduledAt ? 1 : -1));
  }, [list, status, kind, days, q]);

  const counts = {
    all: list.length,
    scheduled: list.filter((b) => ["예정", "보류"].includes(statusOf(b))).length,
    failed: list.filter((b) => ["실패", "일부 실패", "보류"].includes(statusOf(b))).length,
    done: list.filter((b) => ["성공", "일부 실패"].includes(statusOf(b))).length,
  };
  const toggleOpen = (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleTech = (id: string) => setTech((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const retryable = (b: SendBatch) => b.items.filter((i) => i.status === "실패" && i.code && FAIL_REASONS[i.code].retryable).length;
  const vendorDown = systemStatus.balsongking.status !== "ok";

  return (
    <>
      <PageHead title="발송 내역" desc="계약 시점 자동발송·정기 발송·지금 발송·환영인사의 예정과 결과를 한 곳에서 봅니다. 환영인사는 고객 등록 1분 뒤 자동 발송됩니다." />
      {vendorDown && (
        <div className="mb-16">
          <Banner tone="danger" title={`알림톡 발송이 ${systemStatus.balsongking.since.slice(5)}부터 보류되고 있습니다 · 영향 ${systemStatus.balsongking.affected}건`} body={`${systemStatus.balsongking.reason} ${systemStatus.balsongking.impact}`} actions={<button type="button" className="btn btn--sm" onClick={() => toast({ tone: "info", message: "상태를 다시 확인했습니다. 아직 복구되지 않았습니다." })}><Icon name="refresh" size={14} /> 상태 확인</button>} />
        </div>
      )}

      <div className="tabs" role="tablist">
        {([["all", "전체"], ["scheduled", "예정"], ["failed", "실패·보류"], ["done", "완료"]] as [Status, string][]).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={status === k} className={`tab${status === k ? " is-active" : ""}`} onClick={() => setStatus(k)}>
            {l} <span className="n">{counts[k]}</span>
          </button>
        ))}
      </div>
      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="템플릿 · 계약 · 고객명" />
        <select className="select" style={{ width: 140 }} aria-label="종류" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">종류 전체</option>
          {["자동발송", "정기 발송", "지금 발송", "환영인사"].map((k) => <option key={k}>{k}</option>)}
        </select>
        <div className="chips" role="group" aria-label="기간">
          {[7, 30, 90].map((d) => (
            <button key={d} type="button" className={`chip${days === d ? " is-on" : ""}`} aria-pressed={days === d} onClick={() => setDays(d)}>{d}일</button>
          ))}
        </div>
        <span className="spacer" />
        <Switch checked={auto} onChange={(v) => { setAuto(v); toast({ tone: "info", message: v ? "30초마다 자동 갱신합니다." : "자동 갱신을 껐습니다." }); }} label="자동 갱신" />
        <span className="muted small">마지막 갱신 21:20</span>
        <button type="button" className="btn btn--sm" onClick={() => toast("새로고침했습니다. 변경 없음.")}><Icon name="refresh" size={14} /></button>
      </div>

      <div className="table-wrap">
        {filtered.length === 0 ? (
          <EmptyState icon="clock" title="해당하는 발송이 없습니다" desc="기간이나 상태 필터를 바꿔 보세요." />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 36 }}></th>
                <th>일시</th>
                <th>상태</th>
                <th>템플릿 · 종류</th>
                <th>대상</th>
                <th style={{ width: 300 }}>결과</th>
                <th className="th-right">관리</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => {
                const s = statusOf(b);
                const isOpen = open.has(b.id);
                const codes = Array.from(new Set(b.items.filter((i) => i.code).map((i) => i.code!)));
                const date = b.scheduledAt.slice(0, 10);
                return (
                  <Fragment key={b.id}>
                    <tr className={`is-clickable${isOpen ? " is-selected" : ""}`} onClick={() => toggleOpen(b.id)}>
                      <td>
                        <button type="button" className="btn btn--ghost btn--sm btn--icon" aria-expanded={isOpen} aria-label="펼치기" onClick={(e) => { e.stopPropagation(); toggleOpen(b.id); }}>
                          <Icon name="chevronRight" size={16} style={{ transform: isOpen ? "rotate(90deg)" : undefined }} />
                        </button>
                      </td>
                      <td className="nowrap">
                        <div className="num">{formatDateTime(b.scheduledAt)}</div>
                        <div className="cell-sub">{b.pending ? relativeDay(date) : b.finishedAt ? `완료 ${b.finishedAt.slice(11)}` : ""}</div>
                      </td>
                      <td><Badge tone={TONE[s]} dot>{s}</Badge></td>
                      <td>
                        <div className="cell-title">{b.templateName}</div>
                        <div className="cell-sub">{b.kind}{b.trigger ? ` · ${b.trigger}` : ""}{b.dealName ? ` · ${b.dealName}` : ""}</div>
                      </td>
                      <td className="nowrap">{b.total === 1 && b.items[0] ? b.items[0].customerName : `${b.total}명`}</td>
                      <td>
                        {b.pending > 0 ? (
                          <span className="muted">{s === "보류" ? "복구 후 자동 발송" : "예정"}</span>
                        ) : (
                          <>
                            <div className="progress" style={{ maxWidth: 200 }}>
                              <i className="ok" style={{ width: `${(b.success / b.total) * 100}%` }} />
                              <i className="ng" style={{ width: `${(b.failed / b.total) * 100}%` }} />
                            </div>
                            <div className="cell-sub">성공 {b.success} · 실패 {b.failed} · {formatWon(b.success * b.costPerMsg)}</div>
                            {codes.length > 0 && <div className="small" style={{ color: "var(--danger)" }}>{codes.map((c) => FAIL_REASONS[c].title).join(" / ")}</div>}
                          </>
                        )}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="row-actions">
                          {retryable(b) > 0 && (
                            <button type="button" className="btn btn--sm" onClick={() => setRetry(b)}><Icon name="refresh" size={13} /> 다시 보내기 ({retryable(b)})</button>
                          )}
                          <MoreMenu items={[
                            ...(b.pending > 0 ? [{ label: "예약 취소", icon: "x" as const, danger: true, onClick: () => setCancel(b) }] : []),
                            { label: "같은 대상에게 새로 보내기", icon: "send" as const, onClick: () => (window.location.href = `/agent/alimtalk/send?template=${b.templateId}`) },
                            { label: "엑셀로 내려받기", icon: "download" as const, onClick: () => toast({ tone: "info", message: "이 배치의 결과를 엑셀로 내려받습니다. (프로토타입)" }) },
                          ]} />
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="expand-row">
                        <td colSpan={7}>
                          {b.items.length === 0 ? (
                            <div className="muted small">대상은 발송 시점에 조건으로 확정됩니다 (정기 발송).</div>
                          ) : (
                            <table className="table table--dense" style={{ background: "transparent" }}>
                              <thead><tr><th>고객</th><th>번호</th><th>상태</th><th>사유</th></tr></thead>
                              <tbody>
                                {b.items.map((it, i) => (
                                  <tr key={i}>
                                    <td>{it.customerName}</td>
                                    <td className="num">{it.phoneMasked}</td>
                                    <td><Badge tone={it.status === "성공" ? "good" : it.status === "실패" ? "danger" : it.status === "보류" ? "warn" : "info"} dot>{it.status}</Badge></td>
                                    <td>{it.code ? <span>{FAIL_REASONS[it.code].title}<span className="muted"> — {FAIL_REASONS[it.code].detail}</span></span> : <span className="muted">—</span>}</td>
                                  </tr>
                                ))}
                                {b.total > b.items.length && <tr><td colSpan={4} className="muted small">외 {b.total - b.items.length}명 (성공)</td></tr>}
                              </tbody>
                            </table>
                          )}
                          {codes.includes("vendor_ssl") && (
                            <div className="mt-8 small">
                              <button type="button" className="link" style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }} onClick={() => toggleTech(b.id)}>{tech.has(b.id) ? "기술 원문 숨기기" : "기술 원문 보기 (운영자 문의 시 첨부)"}</button>
                              {tech.has(b.id) && <pre className="mt-8" style={{ margin: 0, padding: 10, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12, whiteSpace: "pre-wrap" }}>{systemStatus.balsongking.detail}</pre>}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmModal
        open={!!retry}
        onClose={() => setRetry(null)}
        title={retry ? `실패한 ${retryable(retry)}건을 다시 보냅니다` : ""}
        description="수신 거부·번호 오류 건은 제외됩니다. 대행사 장애 건은 복구 직후 자동으로 나갑니다."
        summary={retry ? [{ k: "템플릿", v: retry.templateName }, { k: "대상", v: `${retryable(retry)}명` }, { k: "예상 비용", v: formatWon(retryable(retry) * retry.costPerMsg) }] : undefined}
        confirmLabel={retry ? `${retryable(retry)}건 다시 보내기` : "다시 보내기"}
        onConfirm={() => { const b = retry; setRetry(null); if (b) toast({ message: `${retryable(b)}건을 다시 보내도록 예약했습니다.`, action: { label: "실행 취소", onClick: () => toast({ tone: "info", message: "예약을 취소했습니다." }) } }); }}
      />
      <ConfirmModal
        open={!!cancel}
        onClose={() => setCancel(null)}
        danger
        title={cancel ? `'${cancel.templateName}' 예약 ${cancel.pending}건을 취소할까요?` : ""}
        description="취소한 예약은 되살릴 수 없습니다. 자동발송 예약은 계약 일정을 바꾸면 다시 만들어집니다."
        confirmLabel="예약 취소"
        onConfirm={() => { const b = cancel; setCancel(null); if (b) { setList((xs) => xs.filter((x) => x.id !== b.id)); toast(`'${b.templateName}' 예약을 취소했습니다.`); } }}
      />
    </>
  );
}
